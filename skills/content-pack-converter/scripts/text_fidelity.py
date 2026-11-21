"""Book-text fidelity for setting and homebrew packs (ruled 2026-11-03: rules text is the book's exact words; app
text is the pack's own). Three parts, all without PyMuPDF:

- strip_page_numbers(lines, pageno): drop printed page numbers from one page of a text dump without dropping table
  data. A number-only line is a page number only at the page's edge (first or last three non-empty lines) AND close
  to the page's own number (within 4). Elsewhere it is a round, a count or a die face and must stay.
- norm(text): the comparison form. Soft hyphens and the space after them go, line-end hyphens join, bullets go,
  curly quotes, dashes and primes are evened out, spaces collapse, case folds.
- is_rules_text(path, value): which strings are rules text: every key but app text, names and references, and
  every word cell of a lookup table.
- is_verbatim(text, book): the whole text is in the book, or (a passage the pack joined from several places) every
  sentence of it is. Sentences split after . ! ? : and at footnote marks.

Usage (the audit): py text_fidelity.py PACK.json BOOKTEXT.txt [BOOKTEXT2.txt ...] [--list OUT.json]
Prints, per group of fields, how many rules texts are the book's words; --list writes the ones that aren't.
App-text fields (blurb, description, help, why) are skipped: they are meant to be the pack's own words.
"""
import argparse
import json
import re
import sys
from collections import defaultdict

# Every string is rules text unless its key is app text, a name or a reference (a first version looked at five keys
# only and missed about 130 rules texts). Short strings are names, labels and values, except under the usual rules
# keys and in table cells, which are checked whatever their length if they hold words.
APP_KEYS = {"blurb", "description", "help", "why", "id", "name", "title", "heading", "label", "source", "die",
            "appearsAs", "pluralName", "unitName", "tableId", "nextTable", "formula", "icon", "image", "file", "kind",
            "category"}
RULES_KEYS = {"notes", "note", "text", "result", "effect"}
MIN_LEN = 40
KINDS = ("classes", "races", "spells", "items", "statBlocks", "tables", "options", "rulesSets", "traitLists",
         "conditions", "treasureTypes", "startingKits", "spellLists", "lightTypes")


def strip_page_numbers(lines, pageno=None):
    idx = [i for i, line in enumerate(lines) if line.strip()]
    edge = set(idx[:3] + idx[-3:])

    def is_pagenum(line):
        t = line.strip()
        if not re.match(r"^\d{1,3}$", t):
            return False
        return pageno is None or abs(int(t) - pageno) <= 4

    return [line for i, line in enumerate(lines) if not (i in edge and is_pagenum(line))]


def norm(s):
    s = re.sub("­\\s*", "", s)
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("–", "-"),
                 ("—", "-"), ("′", "'"), ("▶", " "), (" ", " ")):
        s = s.replace(a, b)
    s = re.sub(r"(\w)-\s+(\w)", r"\1\2", s)
    return re.sub(r"\s+", " ", s).strip().lower()


def sentences(s):
    parts = re.split(r"(?<=[.!?:])\s+|(?<=[*†‡])\s*", s)
    return [p.strip() for p in parts if len(p.strip()) > 3]


def is_verbatim(text, book):
    """book is norm()'d already."""
    n = norm(text)
    if n in book or n.rstrip(".…") in book:
        return True
    parts = sentences(n)
    return len(parts) > 1 and all(p in book or p.rstrip(".") in book for p in parts)


def is_rules_text(path, v):
    if not path or not re.search(r"[A-Za-z]{3,}", v):
        return False
    last = path[-1]
    if isinstance(last, int):  # a list item: a table's columns, a lookup row's values
        return len(path) > 1 and path[-2] in ("values", "columns")
    if last in APP_KEYS:
        return False
    if path[0] == "tables" and last == "key":
        return True
    return len(v) >= (25 if last in RULES_KEYS else MIN_LEN)


def audit(pack, book):
    """Returns ({group: [verbatim, not]}, [(path, text) not verbatim])."""
    stats, misses = defaultdict(lambda: [0, 0]), []

    def group(path):
        names = [x for x in path if not isinstance(x, int)]
        return ".".join(names[:3] if len(names) > 3 else names)

    def walk(v, path):
        if isinstance(v, dict):
            for k, x in v.items():
                walk(x, path + [k])
        elif isinstance(v, list):
            for i, x in enumerate(v):
                walk(x, path + [i])
        elif isinstance(v, str) and is_rules_text(path, v):
            ok = is_verbatim(v, book)
            stats[group(path)][0 if ok else 1] += 1
            if not ok:
                misses.append((".".join(str(x) for x in path), v))

    for k in KINDS:
        if k in pack:
            walk(pack[k], [k])
    return stats, misses


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("pack")
    ap.add_argument("books", nargs="+")
    ap.add_argument("--list")
    a = ap.parse_args()
    pack = json.load(open(a.pack, encoding="utf-8"))
    book = norm(" ".join(open(f, encoding="utf-8").read() for f in a.books))
    stats, misses = audit(pack, book)
    total_ok = sum(s[0] for s in stats.values())
    total = sum(s[0] + s[1] for s in stats.values())
    for g, (ok, bad) in sorted(stats.items(), key=lambda kv: -sum(kv[1])):
        print(f"{g:50s} {ok:5d}/{ok + bad:<5d}")
    print(f"rules texts in the book's words: {total_ok} of {total}")
    if a.list:
        json.dump([{"path": p, "text": t} for p, t in misses], open(a.list, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
