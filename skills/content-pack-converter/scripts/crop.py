"""Render a PDF page, or a region of it, to WebP (07 section 9).

Usage:
  py crop.py BOOK.pdf PDF_PAGE OUT.webp [--bbox x0,y0,x1,y1] [--kind crop|map|art|handout]
  py crop.py BOOK.pdf --boxes boxes.json --out-dir images/crops [--kind crop]

--bbox is in PDF points from the top left (as find_boxes.py prints them);
without it the whole page is rendered. Sizes follow 07:
  crop     about 160 dpi
  map      at most 2400 px on the long edge
  art, handout   at most 1600 px on the long edge
--dpi and --max-edge override them. With --boxes, each box is saved as
<id>.webp when it has an "id", else pdf-<page>-<n>.webp.
Needs PyMuPDF (rendering) and Pillow (WebP).
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _pdf import INSTALL_PILLOW, load_fitz, open_pdf  # noqa: E402

SIZES = {"crop": {"dpi": 160, "max_edge": None}, "map": {"dpi": 300, "max_edge": 2400},
         "art": {"dpi": 300, "max_edge": 1600}, "handout": {"dpi": 300, "max_edge": 1600}}


def render(doc, pdf_page, out, bbox=None, dpi=160, max_edge=None, quality=80):
    fitz = load_fitz()
    try:
        from PIL import Image
    except ImportError:
        sys.exit(INSTALL_PILLOW)
    page = doc[pdf_page - 1]
    clip = fitz.Rect(*bbox) if bbox else page.rect
    zoom = dpi / 72
    if max_edge:
        zoom = min(zoom, max_edge / max(clip.width, clip.height))
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip, alpha=False)
    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    image.save(out, "WEBP", quality=quality)
    print(f"Saved {out} ({pix.width} x {pix.height} px)")


def main():
    parser = argparse.ArgumentParser(description="Render a page or region to WebP.")
    parser.add_argument("pdf")
    parser.add_argument("page", nargs="?", type=int, help="PDF page number (1 = first page of the file)")
    parser.add_argument("out", nargs="?")
    parser.add_argument("--bbox", help="x0,y0,x1,y1 in PDF points")
    parser.add_argument("--kind", choices=sorted(SIZES), default="crop")
    parser.add_argument("--dpi", type=int)
    parser.add_argument("--max-edge", type=int)
    parser.add_argument("--quality", type=int, default=80)
    parser.add_argument("--boxes", help="boxes.json from find_boxes.py")
    parser.add_argument("--out-dir", default=".")
    args = parser.parse_args()

    size = SIZES[args.kind]
    dpi = args.dpi or size["dpi"]
    max_edge = args.max_edge or size["max_edge"]
    doc = open_pdf(args.pdf)

    if args.boxes:
        with open(args.boxes, encoding="utf-8") as handle:
            data = json.load(handle)
        counts = {}
        for box in data.get("boxes", []):
            page = box["pdfPage"]
            counts[page] = counts.get(page, 0) + 1
            name = box.get("id") or f"pdf-{page:04d}-{counts[page]}"
            render(doc, page, os.path.join(args.out_dir, f"{name}.webp"), box["bbox"], dpi, max_edge, args.quality)
        return

    if not args.page or not args.out:
        parser.error("give PDF_PAGE and OUT.webp, or --boxes")
    bbox = [float(v) for v in args.bbox.split(",")] if args.bbox else None
    if bbox and len(bbox) != 4:
        parser.error("--bbox needs four numbers: x0,y0,x1,y1")
    render(doc, args.page, args.out, bbox, dpi, max_edge, args.quality)


if __name__ == "__main__":
    main()
