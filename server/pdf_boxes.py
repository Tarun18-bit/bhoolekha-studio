"""
Real bounding boxes for fields extracted from a text-layer PDF (e.g. Bhulekh khatauni).
Each field value is located in the PDF's own text layer, and the character boxes are converted
to percentages of the image that cv_processor.bytes_to_cv2 renders (pages stacked vertically,
scale 1.6, each page resized to the widest page). Fields that cannot be located get no box.
"""
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

RENDER_SCALE = 1.6
MAX_PAGES = 5


def _chars(pdf) -> Tuple[str, List[Tuple[int, Tuple[float, float, float, float]]], List[Tuple[float, float, float]]]:
    """Non-whitespace characters of the first pages with (page, box). Also page geometry."""
    s, meta, pages = [], [], []
    n_pages = min(len(pdf), MAX_PAGES)
    widths = [pdf[i].get_size()[0] for i in range(n_pages)]
    max_w_px = max(w * RENDER_SCALE for w in widths) if widths else 1
    offset = 0.0
    for i in range(n_pages):
        page = pdf[i]
        w, h = page.get_size()
        f = max_w_px / (w * RENDER_SCALE)
        h_px = h * RENDER_SCALE * f
        pages.append((w, h, offset, h_px))
        tp = page.get_textpage()
        for ci in range(tp.count_chars()):
            ch = tp.get_text_range(ci, 1)
            if not ch or ch.isspace():
                continue
            try:
                box = tp.get_charbox(ci)
            except Exception:
                continue
            s.append(unicodedata.normalize("NFC", ch))
            meta.append((i, box))
        offset += h_px
    return "".join(s), meta, pages


class Locator:
    def __init__(self, pdf_bytes: bytes):
        import pypdfium2 as pdfium
        self.pdf = pdfium.PdfDocument(pdf_bytes)
        self.text, self.meta, self.pages = _chars(self.pdf)
        self.total_h = sum(p[3] for p in self.pages) or 1

    def find(self, target: str, start: int = 0, numeric: bool = False, end: Optional[int] = None) -> Optional[Tuple[int, int]]:
        t = re.sub(r"\s+", "", unicodedata.normalize("NFC", target or ""))
        if len(t) < (1 if numeric else 2):
            return None
        hay = self.text if end is None else self.text[:end]
        i = hay.find(t, start)
        while i != -1:
            j = i + len(t)
            if not numeric or ((i == 0 or not (self.text[i - 1].isdigit() or self.text[i - 1] == "."))
                               and (j >= len(self.text) or not (self.text[j].isdigit() or self.text[j] == "."))):
                return i, j
            i = hay.find(t, i + 1)
        return None

    def box(self, span: Tuple[int, int], label: str, key: str) -> Optional[Dict[str, Any]]:
        sel = self.meta[span[0]:span[1]]
        if not sel:
            return None
        page = sel[0][0]
        sel = [b for p, b in sel if p == page]           # keep the part on the first page of the match
        w, h, off, h_px = self.pages[page]
        l = min(b[0] for b in sel); r = max(b[2] for b in sel)
        bot = min(b[1] for b in sel); top = max(b[3] for b in sel)
        pad = 1.5
        x = max(0.0, (l - pad) / w * 100)
        y = (off + (h - top - pad) * h_px / h) / self.total_h * 100
        return {"id": f"bb-{key}", "x": round(x, 3), "y": round(max(0.0, y), 3),
                "width": round(min(100 - x, (r - l + 2 * pad) / w * 100), 3),
                "height": round((top - bot + 2 * pad) * h_px / h / self.total_h * 100, 3), "label": label}


def _set(field: Dict[str, Any], b: Optional[Dict[str, Any]]):
    if not isinstance(field, dict):
        return
    if b:
        field["boundingBox"] = b
        field["hasBoundingBox"] = True
    else:
        field["hasBoundingBox"] = False


def _first(pattern: str, s: str) -> str:
    m = re.search(pattern, s or "")
    return m.group(0) if m else ""


def locate(pdf_bytes: bytes, rec: Dict[str, Any]) -> int:
    """Attach real boxes to the record's fields. Returns how many fields were located."""
    try:
        L = Locator(pdf_bytes)
    except Exception as e:
        print(f"[Boxes] PDF text layer not readable: {e}")
        return 0
    v = lambda f: (f or {}).get("value", "") if isinstance(f, dict) else ""
    found = 0

    def put(field, target, start=0, numeric=False, end=None):
        nonlocal found
        if not isinstance(field, dict):
            return None
        span = L.find(target, start, numeric, end) if target else None
        b = L.box(span, field.get("label", ""), field.get("key", "")) if span else None
        _set(field, b)
        found += bool(b)
        return span

    put(rec.get("khataNumber"), _first(r"\d{3,6}", v(rec.get("khataNumber"))), numeric=True)
    put(rec.get("fasliYear"), re.sub(r"\s", "", _first(r"\d{4}\s*-\s*\d{4}", v(rec.get("fasliYear")))) or _first(r"\d{4}", v(rec.get("fasliYear"))), numeric=True)
    put(rec.get("totalStatedArea"), _first(r"\d+\.\d+", v(rec.get("totalStatedArea"))), numeric=True)

    first_owner_at = None
    for p in rec.get("plots") or []:
        span = put(p.get("khasraNumber"), _first(r"\d+[A-Za-z]?", v(p.get("khasraNumber"))), numeric=True)
        if span and first_owner_at is None:
            first_owner_at = span[1]
        put(p.get("regionalAreaText"), _first(r"\d+\.\d+", v(p.get("regionalAreaText"))), numeric=True)
        for k in ("landClassification", "annualRevenueLagaan"):
            _set(p.get(k), None)

    cursor = first_owner_at or 0
    for o in rec.get("owners") or []:
        name = re.sub(r"^[\d\.\)\(\s]+", "", v(o.get("name")))
        name = re.sub(r"[\d\.\)\(]+", " ", name).strip()
        span = put(o.get("name"), name, cursor) or None
        if not span:
            span = put(o.get("name"), name, 0)
        if span:
            cursor = span[1]
            rel = put(o.get("relativeName"), v(o.get("relativeName")), span[1], end=span[1] + 120)
            if rel:
                cursor = max(cursor, rel[1])
        else:
            _set(o.get("relativeName"), None)
        share = _first(r"\d+\.\d+|\d+/\d+", v(o.get("shareFraction")))
        put(o.get("shareFraction"), share, 0, numeric=True) if share and "." in share else _set(o.get("shareFraction"), None)
    return found
