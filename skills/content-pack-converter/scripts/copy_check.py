"""Copying check (07, coverage report item 6): flag 8 or more words in a row
that match the book, except ruled `quotes` and names.

Usage:
  py copy_check.py PACK.json BOOK.pdf [--offset N] [--words 8] [--out copying.json]
  py copy_check.py PACK.json --text BOOK.txt [--words 8]

PACK.json can be a whole pack or a specialist's piece. With a PDF, findings name
the printed page when --offset (meta.pageOffset) is given, else the PDF page.
The matching logic below needs no PyMuPDF, so it can be tested on its own.
"""
import argparse
import json
import os
import re
import sys
import unicodedata

# Keys whose text is never checked: names (usableBy lists class names), ids, references, file paths, page refs.
SKIP_KEYS = {"id", "name", "title", "key", "source", "file", "die", "format", "formatVersion", "usableBy"}
# Lists whose wording is exact by ruling.
SKIP_LISTS = {"quotes"}
# Mechanics, kept in full by ruling (07, Adventure packs: content rules): a stat block's stat line
# (`fields`) and a treasure entry's `amount` read like the book because they are the book's numbers.
SKIP_MECHANICS = {"fields", "amount"}


def words(text):
    """Lowercase words, with line-break hyphens joined and apostrophes dropped."""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)
    text = text.casefold().replace("'", "").replace("’", "")
    return re.findall(r"[^\W_]+", text)


def build_index(pages, n):
    """pages: [(label, text)] -> {n-word tuple: first label where it appears}."""
    index = {}
    for label, text in pages:
        found = words(text)
        for i in range(len(found) - n + 1):
            index.setdefault(tuple(found[i:i + n]), label)
    return index


def find_runs(text, index, n):
    """Runs of n or more words in `text` that appear in the index, merged."""
    found = words(text)
    runs = []
    for i in range(len(found) - n + 1):
        gram = tuple(found[i:i + n])
        if gram not in index:
            continue
        end = i + n - 1
        if runs and i <= runs[-1]["end"] + 1:
            runs[-1]["end"] = end
        else:
            runs.append({"start": i, "end": end, "page": index[gram]})
    for run in runs:
        run["words"] = run["end"] - run["start"] + 1
        run["text"] = " ".join(found[run["start"]:run["end"] + 1])
    return runs


def is_reference_key(key):
    return key.endswith(("Id", "Ids", "Ref", "Refs")) or key == "pointsTo"


def pack_strings(node, path=""):
    """Yield (path, text) for every checked string in a pack or piece."""
    if isinstance(node, dict):
        for key, value in node.items():
            if key in SKIP_KEYS or key in SKIP_LISTS or key in SKIP_MECHANICS or is_reference_key(key):
                continue
            yield from pack_strings(value, f"{path}.{key}" if path else key)
    elif isinstance(node, list):
        for i, value in enumerate(node):
            label = node_label(value)
            yield from pack_strings(value, f"{path}[{label or i}]")
    elif isinstance(node, str):
        yield path, node


def node_label(value):
    return value.get("id") if isinstance(value, dict) and isinstance(value.get("id"), str) else None


def check(pack, pages, n=8):
    index = build_index(pages, n)
    findings = []
    for path, text in pack_strings(pack):
        for run in find_runs(text, index, n):
            findings.append({"path": path, "words": run["words"], "page": run["page"], "text": run["text"]})
    return findings


def pdf_pages(path, offset):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from _pdf import open_pdf, printed

    doc = open_pdf(path)
    pages = []
    for number, page in enumerate(doc, start=1):
        shown = printed(number, offset)
        pages.append((f"p. {shown}" if shown else f"PDF {number}", page.get_text("text")))
    return pages


def main():
    parser = argparse.ArgumentParser(description="Flag runs of words copied from the book.")
    parser.add_argument("pack")
    parser.add_argument("pdf", nargs="?")
    parser.add_argument("--text", help="plain-text source instead of a PDF")
    parser.add_argument("--offset", type=int, help="meta.pageOffset, to report printed pages")
    parser.add_argument("--words", type=int, default=8)
    parser.add_argument("--out")
    args = parser.parse_args()
    if not args.pdf and not args.text:
        parser.error("give the book as a PDF or with --text")

    with open(args.pack, encoding="utf-8") as handle:
        pack = json.load(handle)
    if args.text:
        with open(args.text, encoding="utf-8") as handle:
            pages = [("text", handle.read())]
    else:
        pages = pdf_pages(args.pdf, args.offset)

    findings = check(pack, pages, args.words)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            json.dump(findings, handle, indent=2, ensure_ascii=False)
    print(f"{len(findings)} run(s) of {args.words}+ words match the book.")
    for item in findings:
        print(f"- {item['path']} ({item['words']} words, {item['page']}): {item['text'][:80]}")


if __name__ == "__main__":
    main()
