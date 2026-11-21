"""Page map: find the printed page number on each PDF page and work out
meta.pageOffset (printed page = PDF page - offset, 07 section 1).

Usage:
  py page_map.py BOOK.pdf [--out page-map.json] [--margin 0.12] [--text-dir DIR]

It looks for a lone number (or "Page 12", "- 12 -") near the top or bottom edge
of each page, takes the most common PDF-minus-printed difference as the offset,
and lists the pages that disagree so the Reader can look at them.
--text-dir also saves each page's text as pdf-0001.txt, ... for searching.
"""
import argparse
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pdf import open_pdf  # noqa: E402

NUMBER = re.compile(r"^(?:page\s*)?[-–—]?\s*(\d{1,4})\s*[-–—]?$", re.IGNORECASE)


def margin_numbers(page, margin):
    """Numbers standing alone in the top or bottom band of the page."""
    height = page.rect.height
    found = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            match = NUMBER.match(text)
            if not match:
                continue
            top, bottom = line["bbox"][1], line["bbox"][3]
            if bottom < height * margin or top > height * (1 - margin):
                found.append(int(match.group(1)))
    return found


def main():
    parser = argparse.ArgumentParser(description="Map PDF pages to printed pages.")
    parser.add_argument("pdf")
    parser.add_argument("--out", default="page-map.json")
    parser.add_argument("--margin", type=float, default=0.12, help="share of the page height to search, top and bottom")
    parser.add_argument("--text-dir")
    args = parser.parse_args()

    doc = open_pdf(args.pdf)
    candidates = []
    for number, page in enumerate(doc, start=1):
        candidates.append(margin_numbers(page, args.margin))
        if args.text_dir:
            os.makedirs(args.text_dir, exist_ok=True)
            with open(os.path.join(args.text_dir, f"pdf-{number:04d}.txt"), "w", encoding="utf-8") as handle:
                handle.write(page.get_text("text"))

    votes = Counter(pdf - n for pdf, found in enumerate(candidates, start=1) for n in found)
    offset = votes.most_common(1)[0][0] if votes else None

    pages, disagree, missing = [], [], []
    for pdf, found in enumerate(candidates, start=1):
        shown = pdf - offset if offset is not None and pdf - offset >= 1 else None
        if not found:
            status = "no number found"
            missing.append(pdf)
        elif shown in found:
            status = "matches"
        else:
            status = "differs"
            disagree.append(pdf)
        pages.append({"pdf": pdf, "printed": shown, "found": found, "status": status})

    result = {"pageOffset": offset, "pdfPages": len(doc), "agreeing": sum(p["status"] == "matches" for p in pages),
              "differs": disagree, "noNumber": missing, "pages": pages}
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)

    if offset is None:
        print("No printed page numbers found. Ask the GM which PDF page is printed page 1.")
    else:
        print(f"pageOffset {offset}: printed page = PDF page - {offset}.")
        print(f"Agrees on {result['agreeing']} of {len(doc)} pages.")
        if disagree:
            print(f"Look at these PDF pages (a different number was found): {disagree}")
        print(f"No number found on {len(missing)} page(s) (often maps, art or blank pages).")
    print(f"Saved {args.out}")


if __name__ == "__main__":
    main()
