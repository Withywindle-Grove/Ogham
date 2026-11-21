"""The book as printed units, from a PDF's text spans and fonts (the scorecard's first step).

Usage: py book_units.py BOOK.pdf --offset N --out units.json [--book P] [--skip 1-5,250-257]

Each unit is `{id, page, kind, text, path, ...}`: `page` is the printed page (PDF page - offset), `path` the heading
trail (chapter > section > sub-heading), `kind` one of
- heading   a chapter, section or sub-heading (by size and weight; `level` 1-4; level 5 = a table's column
            headings, so a table flattened into one string still matches)
- label     a bold lead-in such as "Duration:" (the text after it is the next para)
- para      a paragraph, joined across lines, columns and pages; a line-end hyphen is joined only when the joined
            word appears elsewhere in the book, and kept before a digit (a chance written "x-in-y")
- list      a bulleted item
- cell      a table cell (`table`, `row`, `col`); tables are found from aligned spans (these books rule no lines, so
            PyMuPDF's table finder is tried first and the aligned-span fallback does the work); a monster-style
            stat line (inline bold labels "AC", "HD"...) is split into cells too, one per label
- running   page numbers, running heads, tiny print: counted, not written (`--keep-running` writes them)

Units are small enough to score one at a time: a paragraph, a list item, a cell; never a page. The layout rules are
generic (sizes relative to the body size, two columns by the page's middle) so the same script reads any volume laid
out like these. Nothing here depends on a game: the text is the book's and stays in the private output folder.
"""
import argparse
import json
import re
import sys
from collections import Counter, defaultdict

from _pdf import open_pdf, parse_pages, printed

BULLETS = "▶•▪●‣⁃"
CONNECTOR_END = r"(,|;|-|(and|or|of|the|a|an|to|in|with|for|is|are|by|on|at|as|be|from|that|which))$"
SOFT_HYPHEN = "­"
ROLL_RANGE = re.compile(r"^(\d{1,3}([–—-]\d{1,3})?|00)\+?$")  # a die-roll cell: "7", "16–22", "00", "20+"
DASHES = "–—-"


# ----------------------------------------------------------------------------------------------- reading the PDF

def read_pages(doc, pages):
    """[(pdf_page_number, width, height, lines)]; a line is {bbox, spans: [{text, font, size, flags, bbox}]}."""
    out = []
    for pno in pages:
        page = doc[pno - 1]
        lines = []
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                spans = [{"text": s["text"], "font": s["font"], "size": round(s["size"], 1), "flags": s["flags"],
                          "bbox": [round(x, 1) for x in s["bbox"]]}
                         for s in line["spans"] if s["text"].strip()]
                # a wide gap between two spans is a column gap: two cells on one line
                pieces, piece = [], []
                for sp in spans:
                    if piece and sp["bbox"][0] - piece[-1]["bbox"][2] > 6:
                        pieces.append(piece)
                        piece = []
                    piece.append(sp)
                if piece:
                    pieces.append(piece)
                for piece in pieces:
                    lines.append({"bbox": [min(x["bbox"][0] for x in piece), min(x["bbox"][1] for x in piece),
                                           max(x["bbox"][2] for x in piece), max(x["bbox"][3] for x in piece)],
                                  "spans": piece})
        # some books print a line twice at the same place (a shadow or outline layer): keep one
        seen, kept = set(), []
        for line in lines:
            key = (" ".join(s["text"] for s in line["spans"]).strip(), tuple(round(v) for v in line["bbox"]))
            if key in seen:
                continue
            seen.add(key)
            kept.append(line)
        out.append((pno, page.rect.width, page.rect.height, kept))
    return out


def finder_tables(doc, pages):
    """PyMuPDF's own table finder, where the book rules its tables. {pdf_page: [(bbox, rows)]}."""
    found = {}
    for pno in pages:
        try:
            tabs = doc[pno - 1].find_tables()
        except Exception:  # older PyMuPDF without find_tables
            return found
        tables = []
        for t in tabs.tables:
            rows = t.extract()
            if t.row_count >= 2 and t.col_count >= 2 and any(any(c for c in r) for r in rows):
                tables.append((tuple(t.bbox), rows))
        if tables:
            found[pno] = tables
    return found


# ----------------------------------------------------------------------------------------------- styles

def is_bold(span):
    return bool(span["flags"] & 16) or bool(re.search(r"bold|semibold|black|heavy|-bol\b", span["font"], re.I))


def is_italic(span):
    return bool(span["flags"] & 2) or bool(re.search(r"italic|-it\b|boldit|semiboldit", span["font"], re.I))


VOCAB = set()   # the book's whole words, set by build_units (to read a soft hyphen inside a line)


def line_text(line):
    """A soft hyphen followed by a space inside a line: the halves are one word when the book prints that word whole
    elsewhere (a split such as "geoman- tic"), else a word break the typesetter didn't use: just a space."""
    parts = []
    for k, s in enumerate(line["spans"]):
        t = s["text"]
        if k and parts:
            prev = line["spans"][k - 1]
            # one word split into two spans (a kerning or font change mid-word): no visible gap, no space
            tight = "bbox" in s and "bbox" in prev and s["bbox"][0] - prev["bbox"][2] < 0.6
            if t.startswith(SOFT_HYPHEN):
                pass   # a soft hyphen in its own span ends the word before it: no space
            elif not (tight and parts[-1][-1:].isalpha() and t[:1].isalpha()):
                parts.append(" ")
        parts.append(t)
    text = "".join(parts).replace(" ", " ")

    def soft(m):
        joined = (m.group(1) + m.group(2)).lower()
        return m.group(1) + m.group(2) if joined in VOCAB else m.group(1) + " " + m.group(2)
    text = re.sub(r"([A-Za-zÀ-ɏ]+)" + SOFT_HYPHEN + r"\s+([A-Za-zÀ-ɏ]+)", soft, text)
    return re.sub(SOFT_HYPHEN + r"\s+", " ", text).strip()


def body_size(pages):
    sizes = Counter()
    for _, _, _, lines in pages:
        for line in lines:
            for s in line["spans"]:
                sizes[s["size"]] += len(s["text"])
    return sizes.most_common(1)[0][0] if sizes else 10.0


def classify(line, body, width, height):
    """'chapter' | 'section' | 'sub' | 'h4' | 'label' | 'body' | 'running' | 'caption' for one line."""
    spans = line["spans"]
    first = spans[0]
    size = max(s["size"] for s in spans)
    text = line_text(line)
    x0, y0, x1, y1 = line["bbox"]
    if re.fullmatch(r"\d{1,4}", text) and (y0 > height - 36 or y1 < 30) and size < body:
        return "running"
    if size < 0.7 * body:
        return "running"
    # a letter-spaced running header ("P a r t O n e | T h e F e n"), with or without the page number beside it
    words = re.sub(r"^\d{1,4}\s+|\s+\d{1,4}$", "", text).replace("|", " ").split()
    if len(words) >= 6 and sum(len(w) == 1 for w in words) >= 0.8 * len(words) and (y0 < 60 or y1 > height - 60):
        return "running"
    if size >= 4 * body:
        return "chapter"
    if size >= 2 * body:
        return "section"
    bold = all(is_bold(s) for s in spans)
    if bold and size >= 1.3 * body:
        return "sub"
    if bold and size > body + 0.5:
        return "h4"
    if size < 0.95 * body and all(is_italic(s) for s in spans):
        return "caption"
    return "body"


# ----------------------------------------------------------------------------------------------- regions and rows

def region(line, width):
    x0, _, x1, _ = line["bbox"]
    mid = width / 2
    if x1 <= mid + 6:
        return "L"
    if x0 >= mid - 6:
        return "R"
    return "F"


def column_edges(lines, body, width, height):
    """Right edge of the text in each column of one page: the widest body line's x1, per region."""
    edges = {}
    for line in lines:
        if classify(line, body, width, height) == "body":
            r = region(line, width)
            edges[r] = max(edges.get(r, 0), line["bbox"][2])
    return edges


def ends_paragraph(text, x1, edge, col_width, next_text):
    """Ragged-right text: a line ends its paragraph when it stops well short of the column's edge, or stops a
    little short on a sentence end with the next line opening a new sentence. A hyphen never ends one."""
    if text.endswith("-") or text.endswith(SOFT_HYPHEN):
        return False
    if x1 < edge - 0.22 * col_width:
        return True
    opener = not next_text or next_text[:1].isupper() or next_text[:1] in BULLETS
    if x1 < edge - 0.12 * col_width and opener and not re.search(r"(,|;|(and|or|of|the|a|an|to|in|with|for|is|are|by|on|at|as|be|from|that|which))$", text):
        return True
    if x1 < edge - 10 and re.search(r"[.!?:”\")\]]$", text) and (not next_text or next_text[:1].isupper()
                                                                        or next_text[:1] in BULLETS):
        return True
    return False


def baseline_clusters(lines, tol=2.5):
    """Group lines by baseline (bottom of bbox): [[line, ...]] sorted top to bottom, left to right."""
    lines = sorted(lines, key=lambda l: (l["bbox"][3], l["bbox"][0]))
    clusters = []
    for line in lines:
        if clusters and abs(clusters[-1][-1]["bbox"][3] - line["bbox"][3]) <= tol:
            clusters[-1].append(line)
        else:
            clusters.append([line])
    for c in clusters:
        c.sort(key=lambda l: l["bbox"][0])
    return clusters


def is_long_text(line, col_width):
    text = line_text(line)
    return (line["bbox"][2] - line["bbox"][0]) > 0.7 * col_width and len(text.split()) >= 6


def find_rows(lines, width, body, height):
    """Table rows from aligned spans: a baseline shared by two or more short lines in one column region.
    Returns (rows, rest): rows = [{'lines': [...], 'y0', 'y1', 'x0', 'x1', 'head': bool}], rest = the other lines."""
    col_width = width / 2 - 30
    by_region = defaultdict(list)
    rows, rest = [], []
    for line in lines:
        kind = classify(line, body, width, height)
        if kind in ("running", "chapter", "section", "sub", "caption"):
            rest.append(line)
            continue
        by_region[region(line, width)].append(line)
    for reg, reg_lines in by_region.items():
        for cluster in baseline_clusters(reg_lines):
            cells = [l for l in cluster if not is_long_text(l, col_width)]
            # a long result beside a roll range ("9–15  Copper kettle that never boils dry, a gift") is a cell, not prose
            if cells and len(cells) < len(cluster) and all(ROLL_RANGE.match(line_text(c)) for c in cells):
                left = max(c["bbox"][2] for c in cells)
                cells = [l for l in cluster if l in cells or l["bbox"][0] > left]
            if len(cells) >= 2 and (len(cells) >= 3 or reg != "F" or len(cluster) == len(cells)):
                rows.append({"lines": cells, "region": reg})
                rest.extend(l for l in cluster if l not in cells)
            else:
                rest.extend(cluster)
    for row in rows:
        ls = row["lines"]
        row["y0"] = min(l["bbox"][1] for l in ls)
        row["y1"] = max(l["bbox"][3] for l in ls)
        row["x0"] = min(l["bbox"][0] for l in ls)
        row["x1"] = max(l["bbox"][2] for l in ls)
        row["head"] = all(classify(l, body, width, height) == "h4" for l in ls)
    rows.sort(key=lambda r: (r["y1"], r["x0"]))
    # a wide table: its header row has cells left and right of the page's middle; body rows under it that share a
    # baseline (one left, one right) are one row, as long as the rows keep coming without a gap
    merged, wide_open = [], False
    for row in rows:
        prev = merged[-1] if merged else None
        same_line = prev and abs(prev["y1"] - row["y1"]) <= 2.5 and prev["region"] != row["region"]             and row["x0"] - prev["x1"] < 70 and prev["head"] == row["head"]
        if same_line and (row["head"] or (wide_open and row["y0"] - wide_open < 2.2 * (row["y1"] - row["y0"]))):
            prev["lines"] = sorted(prev["lines"] + row["lines"], key=lambda l: l["bbox"][0])
            prev["x1"] = max(prev["x1"], row["x1"])
            prev["y0"] = min(prev["y0"], row["y0"])
            prev["region"] = "F"
            wide_open = prev["y1"]
        else:
            merged.append(row)
            if wide_open and row["y0"] - wide_open > 2.2 * (row["y1"] - row["y0"]):
                wide_open = False
    return merged, rest


def group_tables(rows, line_height, rest=None, body=None, width=None, height=None):
    """Consecutive rows in one column region (small vertical gap, overlapping x) form a table. A lone bold line
    just above a table's header, inside the table's span, is a header cell on its own baseline (a two-line
    heading such as "Weight / (Coins)"); a lone bold line at the table's left edge is its title (left to the caller)."""
    tables, open_tables = [], {}
    for row in rows:
        t = open_tables.get(row["region"])
        if t and row["y0"] - t["y1"] < 2.2 * line_height                 and row["x0"] < t["x1"] + 20 and row["x1"] > t["x0"] - 20                 and not (row["head"] and not t["rows"][-1]["head"] and row["y0"] - t["y1"] > 0.8 * line_height):
            t["rows"].append(row)
            t["y1"] = max(t["y1"], row["y1"])
            t["x0"] = min(t["x0"], row["x0"])
            t["x1"] = max(t["x1"], row["x1"])
        else:
            t = {"rows": [row], "y0": row["y0"], "y1": row["y1"], "x0": row["x0"], "x1": row["x1"],
                 "region": row["region"]}
            tables.append(t)
            open_tables[row["region"]] = t
            if row["region"] == "F":
                open_tables.pop("L", None)
                open_tables.pop("R", None)
    tables.sort(key=lambda t: (t["y0"], t["x0"]))
    keep = [t for t in tables if not all(r["head"] for r in t["rows"])]
    if rest is not None:
        used = set()
        for t in keep:
            first = t["rows"][0]
            if not first["head"]:
                continue
            for line in rest:
                if id(line) in used or classify(line, body, width, height) != "h4":
                    continue
                x0, y0, x1, y1 = line["bbox"]
                if first["y0"] - 1.4 * line_height <= y0 < first["y0"] and x0 > t["x0"] + 15 and x1 <= t["x1"] + 5:
                    first["lines"].append(line)
                    first["lines"].sort(key=lambda l: l["bbox"][0])
                    first["y0"] = min(first["y0"], y0)
                    used.add(id(line))
        rest[:] = [l for l in rest if id(l) not in used]
    return keep


def attach_wrapped(tables, rest, line_height, body=None, width=None, height=None):
    """Lines directly under a row, aligned with one of its cells and staying inside that cell's column, are the
    cell's wrapped text: one line or several, each just under the last (a cell may wrap over three lines). They are
    kept in the cell's `wraps` and joined like a paragraph's lines (`cell_text`). A line that reaches into the next
    column, or starts with a bold lead-in (a legend under the table: "Charges: ..."), is not a wrap."""
    used = set()
    ordered = sorted(rest, key=lambda l: l["bbox"][1])
    for t in tables:
        for i, row in enumerate(t["rows"]):
            next_y = t["rows"][i + 1]["y0"] if i + 1 < len(t["rows"]) else row["y1"] + 3 * line_height
            cells = sorted(row["lines"], key=lambda l: l["bbox"][0])
            for line in ordered:
                if id(line) in used or (body and classify(line, body, width, height) != "body"):
                    continue
                x0, y0, x1, _ = line["bbox"]
                if y0 >= next_y - 0.4 * line_height or not (t["x0"] - 10 <= x0 <= t["x1"]):
                    continue
                if any(is_bold(sp) for sp in line["spans"]):
                    continue
                for k, cell in enumerate(cells):
                    if abs(cell["bbox"][0] - x0) > 4:
                        continue
                    bottom = cell.get("_bottom", cell["bbox"][3])
                    if not (bottom - 0.4 * line_height <= y0 <= bottom + 1.4 * line_height):  # line boxes may overlap
                        break
                    limit = cells[k + 1]["bbox"][0] if k + 1 < len(cells) else max(t["x1"], cell["bbox"][2]) + 10
                    if x1 > limit + 2:
                        break
                    cell.setdefault("wraps", []).append(line)
                    cell["_bottom"] = line["bbox"][3]
                    used.add(id(line))
                    break
    return [l for l in rest if id(l) not in used]


def cell_text(cell, vocab=frozenset()):
    """A table cell's text, its wrapped lines joined like a paragraph's (hyphens by the book's vocabulary)."""
    return join_lines([line_text(cell)] + [line_text(w) for w in cell.get("wraps", [])], vocab)


def table_columns(table):
    """Column anchors (x-centres) from the header rows, else from the body cells' x positions."""
    heads = [r for r in table["rows"] if r["head"]]
    source = heads if heads else table["rows"]
    xs = []
    for r in source:
        for l in r["lines"]:
            xs.append(((l["bbox"][0] + l["bbox"][2]) / 2, l["bbox"][0], l["bbox"][2]))
    xs.sort()
    anchors = []
    for cx, x0, x1 in xs:
        if anchors and (cx - anchors[-1][0] < 12 or (x0 < anchors[-1][2] - 2 and x1 > anchors[-1][1] + 2)):
            a = anchors[-1]
            anchors[-1] = ((a[0] + cx) / 2, min(a[1], x0), max(a[2], x1))
        else:
            anchors.append((cx, x0, x1))
    return anchors


def column_of(line, anchors):
    cx = (line["bbox"][0] + line["bbox"][2]) / 2
    best, best_d = 0, 1e9
    for i, (acx, ax0, ax1) in enumerate(anchors):
        d = min(abs(cx - acx), abs(line["bbox"][0] - ax0), abs(line["bbox"][2] - ax1))
        if ax0 - 2 <= cx <= ax1 + 2:
            d = min(d, 1)
        if d < best_d:
            best, best_d = i, d
    return best


def header_names(table, anchors):
    names = [""] * len(anchors)
    for r in table["rows"]:
        if not r["head"]:
            continue
        for l in sorted(r["lines"], key=lambda l: (round(l["bbox"][1]), l["bbox"][0])):
            c = column_of(l, anchors)
            names[c] = (names[c] + " " + line_text(l)).strip()
    return names


# ----------------------------------------------------------------------------------------------- text joining

def vocabulary(pages):
    """Every word that appears whole (not at a line end) somewhere in the book, lower-cased."""
    vocab = set()
    for _, _, _, lines in pages:
        for line in lines:
            words = re.findall(r"[A-Za-zÀ-ɏ]{2,}", line_text(line))
            vocab.update(w.lower() for w in words[1:-1])  # a line's first and last words may be halves
    return vocab


def join_lines(texts, vocab):
    """Lines of one paragraph into one text. A soft hyphen always joins; a hard hyphen at a line end joins when the
    joined word is the book's elsewhere, else it stays (a compound or a chance written "x-in-y")."""
    out = ""
    for text in texts:
        text = text.strip()
        if not out:
            out = text
            continue
        if out.endswith(SOFT_HYPHEN):
            out = out[:-1] + text
        elif out.endswith("-") and len(out) > 1 and (out[-2].isdigit() or text[:1].isdigit()):
            out = out + text  # a range or a chance written "x-in-y": the hyphen stays
        elif out.endswith("-") and len(out) > 1 and out[-2].isalpha():
            before = re.findall(r"[A-Za-zÀ-ɏ]+$", out[:-1])
            after = re.match(r"[A-Za-zÀ-ɏ]+", text)
            if not (before and after):
                out = out + text
            elif (before[0] + after.group(0)).lower() in vocab:
                out = out[:-1] + text
            elif before[0].lower() in vocab and after.group(0).lower() in vocab:
                out = out + text  # a compound of two real words keeps its hyphen
            else:
                out = out[:-1] + text  # a rare word broken by the typesetter
        else:
            out = out + " " + text
    out = out.replace(SOFT_HYPHEN, "")
    return re.sub(r"\s+", " ", out).strip()


def split_label(line):
    """A bold lead-in ending in ':' (or a short bold run followed by regular text) -> (label, rest_spans)."""
    spans = line["spans"]
    if not is_bold(spans[0]) or len(spans) == 1 and ":" not in spans[0]["text"]:
        return None, spans
    lead = []
    i = 0
    while i < len(spans) and is_bold(spans[i]):
        lead.append(spans[i]["text"])
        i += 1
    if any(is_bold(sp) for sp in spans[i:]):
        return None, spans  # several bold lead-ins on one line: a legend, not a label
    label = " ".join(lead).strip()
    if ":" in label and not label.endswith(":") and label.index(":") <= 40:
        # the whole line is bold ("Range: The caster or a creature touched"): the lead-in ends at the colon
        head, tail = label.split(":", 1)
        rest = [dict(spans[0], text=tail, flags=spans[0]["flags"] & ~16, font="Regular")] + spans[i:]
        return head + ":", rest
    if len(label.split()) > 6:
        return None, spans
    if not label.endswith(":"):
        return None, spans
    return label, spans[i:]


STAT_LABEL = re.compile(r"^[A-Z][A-Za-z0-9]{0,4}$")


def stat_cells(lines, vocab=frozenset()):
    """A stat line with inline bold labels ("AC 5 [14], HD 3+1 ...") -> [(label, value)] or None."""
    spans = [s for l in lines for s in l["spans"]]
    labels = [s for s in spans if is_bold(s) and STAT_LABEL.match(s["text"].strip())]
    if len(labels) < 4:
        return None
    cells, label, pieces, piece, lead = [], None, [], "", []
    for line in lines:
        for s in line["spans"]:
            if is_bold(s) and STAT_LABEL.match(s["text"].strip()):
                if label:
                    cells.append((label, pieces + [piece]))
                label, pieces, piece = s["text"].strip(), [], ""
            elif label:
                piece += s["text"]
            else:
                lead.append(s["text"])  # the words before the first label ("Lesser reaper:"), kept as a unit of their own
        pieces.append(piece)
        piece = ""
    if label:
        cells.append((label, pieces + [piece]))
    out = [(k, re.sub(r"[\s,]+$", "", join_lines([p for p in v if p.strip()], vocab))) for k, v in cells]
    lead_text = join_lines([t for t in lead if t.strip()], vocab).strip()
    if lead_text:
        out.insert(0, ("", lead_text))
    return out


# ----------------------------------------------------------------------------------------------- reading order

def order_page(items):
    """items: [{'region', 'y0', 'y1', ...}] -> reading order: for each band between full-width items, the left
    column, then the right, then the full-width item."""
    wide = sorted([i for i in items if i["region"] == "F"], key=lambda i: i["y0"])
    cols = [i for i in items if i["region"] != "F"]
    out, top = [], -1e9
    for w in wide + [None]:
        bottom = w["y0"] if w else 1e9
        for reg in ("L", "R"):
            out.extend(sorted([i for i in cols if i["region"] == reg and top <= i["y0"] < bottom],
                              key=lambda i: i["y0"]))
        if w:
            out.append(w)
            top = w["y0"]
    return out


# ----------------------------------------------------------------------------------------------- the builder

def merge_drop_caps(lines, body, vocab):
    """A drop cap (one big capital opening a section, set beside the paragraph's first lines) joins the first line
    to its right ("T" + "his book is" -> "This book is"; "A" + "small door" -> "A small door"). It is not a heading."""
    used = set()
    for line in lines:
        text = line_text(line)
        size = max(s["size"] for s in line["spans"])
        if not (len(text) == 1 and text.isupper() and size >= 2.5 * body):
            continue
        x1, y0, y1 = line["bbox"][2], line["bbox"][1], line["bbox"][3]
        beside = [m for m in lines if m is not line and id(m) not in used
                  and line["bbox"][0] + 10 <= m["bbox"][0] <= x1 + 20 and y0 - 6 <= m["bbox"][1] <= y1
                  and max(s["size"] for s in m["spans"]) < 0.5 * size]
        if not beside:
            continue
        first = min(beside, key=lambda m: m["bbox"][1])
        rest = line_text(first)
        word = re.match(r"[A-Za-zÀ-ɏ]+", rest)
        joined = (text + word.group(0)).lower() if word else ""
        glue = "" if rest[:1].islower() and (text not in "AI" or joined in vocab) else " "
        sp = dict(first["spans"][0])
        sp["text"] = text + glue + sp["text"].lstrip()
        first["spans"] = [sp] + first["spans"][1:]
        used.add(id(line))
    return [l for l in lines if id(l) not in used]


def build_units(pages, offset, book, pdf_tables=None, keep_running=False):
    body = body_size(pages)
    vocab = vocabulary(pages)
    VOCAB.clear()
    VOCAB.update(vocab)
    line_height = body * 1.2
    units, counts = [], Counter()
    path = []  # [(level, text)]
    pending = None  # an open paragraph: {'kind', 'lines': [text], 'last_short': bool, 'page', 'path', 'label'}
    seq = Counter()

    def new_id(page):
        seq[page] += 1
        return f"{book}{page:03d}.{seq[page]:03d}"

    def trail():
        return [t for _, t in path]

    def set_heading(level, text):
        while path and path[-1][0] >= level:
            path.pop()
        path.append((level, text))

    def flush():
        nonlocal pending
        if pending:
            cells = stat_cells(pending["spans"], vocab) if pending["kind"] == "para" else None
            if cells:
                entry = path[-1][1] if path else "stats"
                for k, v in cells:
                    if k == "":
                        emit(pending["page"], "label" if v.endswith(":") else "para", v)
                        continue
                    emit(pending["page"], "cell", v, {"table": entry, "row": 1, "col": k, "stat": True})
                counts["stat-lines"] += 1
                pending = None
                return
            text = join_lines(pending["lines"], vocab)
            if text:
                unit = {"id": new_id(pending["page"]), "page": pending["page"], "kind": pending["kind"],
                        "text": text, "path": pending["path"]}
                if pending.get("label"):
                    unit["label"] = pending["label"]
                units.append(unit)
                counts[pending["kind"]] += 1
            pending = None

    def emit(page, kind, text, extra=None):
        unit = {"id": new_id(page), "page": page, "kind": kind, "text": text, "path": trail()}
        if extra:
            unit.update(extra)
        units.append(unit)
        counts[kind] += 1
        return unit

    last_heading = None  # (level, page, y1, region, text) for joining a multi-line heading

    for pno, width, height, lines in pages:
        lines = merge_drop_caps(lines, body, vocab)
        page = printed(pno, offset) or pno
        col_width = width / 2 - 30
        rows, rest = find_rows(lines, width, body, height)
        tables = group_tables(rows, line_height, rest, body, width, height)
        rest = attach_wrapped(tables, rest, line_height, body, width, height)
        edges = column_edges(rest, body, width, height)
        items = [{"region": t["region"], "y0": t["y0"], "y1": t["y1"], "table": t} for t in tables]
        for line in rest:
            items.append({"region": region(line, width), "y0": line["bbox"][1], "y1": line["bbox"][3], "line": line})
        prev_y1, prev_region = None, None
        ordered = order_page(items)
        for n, item in enumerate(ordered):
            next_text = line_text(ordered[n + 1]["line"]) if n + 1 < len(ordered) and "line" in ordered[n + 1] else ""
            if "table" in item:
                flush()
                t = item["table"]
                anchors = table_columns(t)
                names = header_names(t, anchors)
                title = None
                if units and units[-1]["kind"] == "heading" and units[-1].get("level") == 4 \
                        and units[-1]["page"] == page and units[-1].get("_y1", -1e9) > t["y0"] - 3 * line_height:
                    title = units[-1]["text"]
                tname = title or f"table@{page}.{len([u for u in units if u['kind'] == 'cell' and u['page'] == page])}"
                head_text = " ".join(x for x in names if x)
                if head_text:
                    emit(page, "heading", head_text, {"level": 5, "table": tname})
                r = 0
                for row in t["rows"]:
                    if row["head"]:
                        continue
                    r += 1
                    for cell in row["lines"]:
                        c = column_of(cell, anchors)
                        emit(page, "cell", cell_text(cell, vocab), {"table": tname, "row": r, "col": names[c] or c,
                                                            "colIndex": c})
                prev_y1, prev_region = t["y1"], t["region"]
                continue
            line = item["line"]
            kind = classify(line, body, width, height)
            text = line_text(line)
            reg = item["region"]
            if kind == "running" or kind == "caption":
                counts["running"] += 1
                if keep_running:
                    emit(page, "running", text)
                continue
            if kind in ("chapter", "section", "sub", "h4"):
                flush()
                level = {"chapter": 1, "section": 2, "sub": 3, "h4": 4}[kind]
                if last_heading and last_heading[0] == level and last_heading[1] == page \
                        and last_heading[3] == reg and line["bbox"][1] - last_heading[2] < 0.6 * line_height \
                        and units and units[-1]["kind"] == "heading" and units[-1]["text"] == last_heading[4]:
                    if text != units[-1]["text"]:  # a title page prints its title twice
                        units[-1]["text"] = (units[-1]["text"] + " " + text).strip()
                    units[-1]["_y1"] = line["bbox"][3]
                    last_heading = (level, page, line["bbox"][3], reg, units[-1]["text"], line["bbox"][0])
                    set_heading(level, units[-1]["text"])
                    continue
                if last_heading and last_heading[0] == level and last_heading[1] == page and last_heading[4] == text:
                    continue  # a title page prints its title twice
                set_heading(level, text)
                unit = emit(page, "heading", text, {"level": level})
                unit["path"] = trail()[:-1]
                unit["_y1"] = line["bbox"][3]
                last_heading = (level, page, line["bbox"][3], reg, text, line["bbox"][0])
                prev_y1, prev_region = line["bbox"][3], reg
                continue
            # body text
            gap = (line["bbox"][1] - prev_y1) if prev_y1 is not None and prev_region == reg else None
            label, rest_spans = split_label(line)
            if label is not None and pending is not None and pending["lines"] and pending["lines"][-1].endswith("-"):
                label, rest_spans = None, line["spans"]  # a bold lead-in broken over two lines
            bullet = text[:1] in BULLETS
            short = ends_paragraph(text, line["bbox"][2], edges.get(reg, width), col_width, next_text)
            after_label = pending is not None and pending.get("label") and len(pending["lines"]) == 1 \
                and text[:1].isupper() and not re.search(CONNECTOR_END, pending["lines"][0])
            starts_new = bullet or label is not None or (gap is not None and gap > 0.9 * line_height) \
                or (pending is not None and pending["last_short"]) or pending is None or after_label
            if starts_new:
                flush()
                if label is not None:
                    emit(page, "label", label)
                    text = line_text({"spans": rest_spans})
                    if not text:
                        pending = None
                        prev_y1, prev_region = line["bbox"][3], reg
                        continue
                if bullet:
                    text = text[1:].strip()
                pending = {"kind": "list" if bullet else "para", "lines": [text], "page": page,
                           "path": trail(), "spans": [line], "last_short": short, "label": label}
            elif stat_cells(pending["spans"]) and not any(is_bold(sp) for sp in line["spans"])                     and text[:1].isupper() and len(text.split()) >= 4:
                flush()  # a stat line ends where plain text starts a new sentence
                pending = {"kind": "para", "lines": [text], "page": page, "path": trail(), "spans": [line],
                           "last_short": short, "label": None}
            else:
                pending["lines"].append(text)
                pending["spans"].append(line)
                pending["last_short"] = short
            prev_y1, prev_region = line["bbox"][3], reg
    flush()
    for u in units:
        u.pop("_y1", None)
    return units, counts


# ----------------------------------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("pdf")
    ap.add_argument("--offset", type=int, default=0, help="printed page = PDF page - offset")
    ap.add_argument("--out", required=True)
    ap.add_argument("--book", default=None, help="id prefix for the units (default: the file's first letter)")
    ap.add_argument("--skip", default="", help="PDF pages to leave out, e.g. 1-5,250-257")
    ap.add_argument("--keep-running", action="store_true")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    doc = open_pdf(a.pdf)
    skip = set(parse_pages(a.skip, doc.page_count)) if a.skip else set()
    pages_wanted = [p for p in range(1, doc.page_count + 1) if p not in skip]
    pages = read_pages(doc, pages_wanted)
    book = a.book or re.sub(r"[^A-Za-z]", "", a.pdf.split("/")[-1].split("\\")[-1])[:1].upper() or "B"
    pdf_tables = finder_tables(doc, pages_wanted)
    units, counts = build_units(pages, a.offset, book, pdf_tables)
    # each page's raw text layer, for the scorer's last check (a pack text the units split is still on the page)
    page_text = {str(printed(p, a.offset) or p): doc[p - 1].get_text() for p in pages_wanted}
    json.dump({"book": book, "file": a.pdf, "offset": a.offset, "bodySize": body_size(pages),
               "finderTables": sum(len(v) for v in pdf_tables.values()), "units": units, "pageText": page_text},
              open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"{len(units)} units from {len(pages)} pages -> {a.out}")
    for k, v in sorted(counts.items()):
        print(f"  {k}: {v}")
    if pdf_tables:
        print(f"  (PyMuPDF's table finder saw {sum(len(v) for v in pdf_tables.values())} ruled tables; "
              f"the aligned-span fallback is what the units use)")


if __name__ == "__main__":
    main()
