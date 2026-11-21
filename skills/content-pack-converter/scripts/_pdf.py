"""Shared helpers for the converter scripts: open a PDF with PyMuPDF, page numbers.

Nothing here installs anything. If PyMuPDF is missing, the script stops and
says how to install it, so the user can approve that step.
"""
import sys

INSTALL_PYMUPDF = (
    "PyMuPDF isn't installed. Ask the user first, then install it with:\n"
    "  py -m pip install pymupdf        (Windows)\n"
    "  python3 -m pip install pymupdf   (Mac, Linux, cloud)"
)

INSTALL_PILLOW = (
    "Pillow isn't installed (needed to save WebP). Ask the user first, then install it with:\n"
    "  py -m pip install pillow         (Windows)\n"
    "  python3 -m pip install pillow    (Mac, Linux, cloud)"
)


def load_fitz():
    """PyMuPDF. Its new import name is `pymupdf`; `fitz` is the old one, kept for older installs."""
    try:
        import pymupdf as fitz
    except ImportError:
        try:
            import fitz
        except ImportError:
            sys.exit(INSTALL_PYMUPDF)
    return fitz


def open_pdf(path):
    fitz = load_fitz()
    try:
        return fitz.open(path)
    except Exception as error:  # PyMuPDF raises its own error types
        sys.exit(f"Couldn't open {path}: {error}")


def parse_pages(spec, page_count):
    """'10-40,55' -> [10, ..., 40, 55] as PDF page numbers (1-based). None -> all pages."""
    if not spec:
        return list(range(1, page_count + 1))
    pages = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-", 1)
            pages.extend(range(int(start), int(end) + 1))
        elif part:
            pages.append(int(part))
    return [p for p in pages if 1 <= p <= page_count]


def printed(pdf_page, offset):
    """Printed page = PDF page - offset (07, meta.pageOffset). None before page 1."""
    if offset is None:
        return None
    number = pdf_page - offset
    return number if number >= 1 else None
