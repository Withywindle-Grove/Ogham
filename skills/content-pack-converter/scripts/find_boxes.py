"""Find candidate read-aloud boxes by their print style, through the PDF's text layer
(07 section 18).

Usage:
  py find_boxes.py BOOK.pdf [--pages 10-40] [--offset N]
      Lists the text styles used (font, size, colour, italic/bold), how much text
      each has, and how often it sits on a shaded or framed shape. The body style
      is marked. Read-aloud text is usually a style that differs from the body
      and is often framed.
  py find_boxes.py BOOK.pdf --style "FONT|SIZE|COLOUR|FLAGS" [--pages ...] [--offset N] [--out boxes.json]
      Lists every box in that style (neighbouring lines joined), with its PDF page,
      printed page and position in PDF points (x0, y0, x1, y1, from the top left),
      ready for crop.py --boxes.

Run it on a few pages first and compare with the page images; if the book has
no text layer or no distinct style, ask the GM to confirm the boxes.
"""
import argparse
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pdf import open_pdf, parse_pages, printed  # noqa: E402

ITALIC, BOLD = 2, 16  # PyMuPDF span flag bits


def style_key(span):
    flags = ("i" if span["flags"] & ITALIC else "") + ("b" if span["flags"] & BOLD else "")
    return f"{span['font']}|{round(span['size'], 1)}|#{span['color']:06x}|{flags or '-'}"


def block_style(block):
    """The style holding most of a text block's characters."""
    chars = defaultdict(int)
    for line in block["lines"]:
        for span in line["spans"]:
            chars[style_key(span)] += len(span["text"].strip())
    return max(chars, key=chars.get) if chars else None


def shapes(page):
    """Filled or stroked rectangles smaller than the page (box backgrounds, frames)."""
    area = page.rect.width * page.rect.height
    rects = []
    for drawing in page.get_drawings():
        rect = drawing.get("rect")
        if rect is not None and rect.width * rect.height < area * 0.9 and rect.width > 20 and rect.height > 10:
            rects.append(rect)
    return rects


def inside(bbox, rect, slack=4):
    x0, y0, x1, y1 = bbox
    return x0 >= rect.x0 - slack and y0 >= rect.y0 - slack and x1 <= rect.x1 + slack and y1 <= rect.y1 + slack


def page_blocks(page):
    rects = shapes(page)
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0 or not block.get("lines"):
            continue
        text = " ".join(span["text"] for line in block["lines"] for span in line["spans"]).strip()
        if not text:
            continue
        frame = next((r for r in rects if inside(block["bbox"], r)), None)
        yield {"style": block_style(block), "bbox": list(block["bbox"]), "text": text, "frame": frame}


def summary(doc, pages):
    stats = defaultdict(lambda: {"chars": 0, "blocks": 0, "framed": 0, "pages": set()})
    for number in pages:
        for block in page_blocks(doc[number - 1]):
            entry = stats[block["style"]]
            entry["chars"] += len(block["text"])
            entry["blocks"] += 1
            entry["framed"] += block["frame"] is not None
            entry["pages"].add(number)
    if not stats:
        print("No text layer on these pages. Ask the GM to confirm the read-aloud boxes from page images.")
        return
    body = max(stats, key=lambda key: stats[key]["chars"])
    ranked = sorted(stats.items(), key=lambda item: -item[1]["chars"])[:20]
    print("Text styles (FONT|SIZE|COLOUR|FLAGS, i = italic, b = bold), most text first:")
    for key, entry in ranked:
        framed = round(100 * entry["framed"] / entry["blocks"])
        mark = "  <- body text" if key == body else ""
        print(f"  {key}: {entry['chars']} chars, {entry['blocks']} blocks on {len(entry['pages'])} pages, {framed}% framed{mark}")


def boxes(doc, pages, style, offset):
    found = []
    for number in pages:
        current = None
        for block in page_blocks(doc[number - 1]):
            if block["style"] != style:
                current = None
                continue
            bbox = list(block["frame"]) if block["frame"] is not None else block["bbox"]
            near = current and bbox[1] - current["bbox"][3] < 18 and abs(bbox[0] - current["bbox"][0]) < 30
            if near:
                current["bbox"] = [min(current["bbox"][0], bbox[0]), min(current["bbox"][1], bbox[1]),
                                   max(current["bbox"][2], bbox[2]), max(current["bbox"][3], bbox[3])]
                continue
            current = {"pdfPage": number, "printed": printed(number, offset),
                       "bbox": bbox, "framed": block["frame"] is not None,
                       "firstWords": " ".join(block["text"].split()[:6])}
            found.append(current)
    for box in found:
        box["bbox"] = [round(v, 1) for v in box["bbox"]]
    return found


def main():
    parser = argparse.ArgumentParser(description="Find read-aloud boxes by print style.")
    parser.add_argument("pdf")
    parser.add_argument("--pages", help="PDF pages, e.g. 10-40,55")
    parser.add_argument("--offset", type=int, help="meta.pageOffset, to show printed pages")
    parser.add_argument("--style", help="a style key from the summary")
    parser.add_argument("--out", default="boxes.json")
    args = parser.parse_args()

    doc = open_pdf(args.pdf)
    pages = parse_pages(args.pages, len(doc))
    if not args.style:
        summary(doc, pages)
        return
    found = boxes(doc, pages, args.style, args.offset)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump({"style": args.style, "pageOffset": args.offset, "boxes": found}, handle, indent=2, ensure_ascii=False)
    print(f"{len(found)} box(es) in style {args.style}. Saved {args.out}")
    for box in found[:15]:
        print(f"  PDF {box['pdfPage']} (p. {box['printed']}) {box['bbox']}{' framed' if box['framed'] else ''}")


if __name__ == "__main__":
    main()
