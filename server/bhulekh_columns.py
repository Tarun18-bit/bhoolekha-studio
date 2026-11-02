"""
Column-aware reader for the holders table of a UP Bhulekh khatauni PDF.

The holders column (2) "नाम/पिता-पति-संरक्षक…" wraps every name over several lines, so reading the
page top-to-bottom mixes it with the neighbouring columns (case numbers, shares). Here we keep only
the words whose x-position lies inside column (2), split the column at the "N)" serial markers, and
read  name / father-or-husband / village  from each block.
"""
import re
from typing import Any, Dict, List, Optional, Tuple

from indic_cleaner import clean_indic_text

Word = Tuple[int, float, float, float, float, str]          # page, x0, top, x1, bottom, text (top-down coords)


def words_from_pdf(pdf_bytes: bytes, max_pages: int = 6) -> List[Word]:
    """Words with positions from the PDF text layer (pypdfium2), top-down coordinates."""
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(pdf_bytes)
    out: List[Word] = []
    for pi in range(min(len(pdf), max_pages)):
        page = pdf[pi]
        _, h = page.get_size()
        tp = page.get_textpage()
        cur: List[Tuple[float, float, float, float, str]] = []

        def flush():
            if cur:
                out.append((pi, min(c[0] for c in cur), min(c[1] for c in cur), max(c[2] for c in cur),
                            max(c[3] for c in cur), "".join(c[4] for c in cur)))
                cur.clear()
        for ci in range(tp.count_chars()):
            ch = tp.get_text_range(ci, 1)
            if not ch or ch.isspace():
                flush(); continue
            try:
                l, b, r, t = tp.get_charbox(ci)
            except Exception:
                continue
            top, bot = h - t, h - b
            if cur:
                pl, pt, pr, pb, _ = cur[-1]
                same_line = abs(top - pt) < 3 or abs(bot - pb) < 3
                if not same_line or l - pr > 2.5:
                    flush()
            cur.append((l, top, r, bot, ch))
        flush()
    return out


def _column_range(words: List[Word]) -> Optional[Tuple[float, float, int, float]]:
    """x-range of column (2) from the '(2)' and '(3)' header markers -> (x_lo, x_hi, page, header_y)."""
    hdr2 = [w for w in words if w[5] == "(2)"]
    for h2 in hdr2:
        h3 = [w for w in words if w[5] == "(3)" and w[0] == h2[0] and abs(w[2] - h2[2]) < 4 and w[1] > h2[1]]
        if h3:
            return h2[1] - 3, min(h3, key=lambda w: w[1])[1] - 2, h2[0], h2[4]
    return None


AGE_RE = re.compile(r"(?:ना\s*0?\s*बा\s*0?\s*)?\S*उम्र\s*([0-9०-९][0-9०-९ ]*?)\s*वर्ष")      # "ना0बा0उम्र 13 वर्ष" (minor, with age)
GUARD_RE = re.compile(r"सं\s*0?\s*(मा\s*ता|पि\s*ता)\s*(.+)$")

_SIGN = re.compile(r"[\u0901-\u0903\u093E-\u094D]")


def dedupe_glyphs(text: str) -> str:
    """Some PDF engines emit a conjunct's leading cluster twice ("नेन्नेसी", "वर्ष /र्ष", "हेतुहे").
    Drop a 2-4 char chunk that carries a vowel sign / virama and repeats a chunk seen within the
    previous few characters (spaces and '/' ignored)."""
    out = ""
    i = 0
    while i < len(text):
        dropped = False
        for L in (4, 3, 2):
            chunk = text[i:i + L]
            if len(chunk) < L or not _SIGN.search(chunk) or not re.match(r"[\u0905-\u0939]", chunk):
                continue
            window = re.sub(r"[\s/]", "", out)[-(L + 6):]
            if chunk in window and (i + L >= len(text) or not _SIGN.match(text[i + L])):
                i += L
                dropped = True
                break
        if not dropped:
            out += text[i]
            i += 1
    return re.sub(r"\s+/\s*", " / ", re.sub(r" {2,}", " ", out)).strip()


def parse_holders(words: List[Word], debug: bool = False) -> List[Dict[str, Any]]:
    rng = _column_range(words)
    if not rng:
        return []
    x_lo, x_hi, p0, y0 = rng
    # where the holders table ends: the "कुल गाटे" totals line
    end = next(((w[0], w[2]) for w in words if (w[0], w[2]) > (p0, y0) and
                re.sub(r"\s", "", w[5]).startswith("कुल") and any(
                    v[0] == w[0] and abs(v[2] - w[2]) < 4 and "गाटे" in v[5] for v in words)), None)
    # word heights, to drop the large diagonal watermark glyphs
    hs = sorted(w[4] - w[2] for w in words if w[4] > w[2])
    med_h = hs[len(hs) // 2] if hs else 10
    col = [w for w in words
           if x_lo <= w[1] < x_hi and (w[0], w[2]) > (p0, y0 + 2)
           and (end is None or (w[0], w[2]) < end) and (w[4] - w[2]) < 1.8 * med_h]
    col.sort(key=lambda w: (w[0], round(w[2] / 3), w[1]))

    blocks: List[List[str]] = []
    for w in col:
        # serial markers "4)", "10)"; some PDF engines split "10)" into "1" + "0)" a few pt to the right
        if re.fullmatch(r"\d{1,2}\)", w[5]) and w[1] < x_lo + 16:
            if blocks and blocks[-1] and re.fullmatch(r"\d", blocks[-1][-1]):
                blocks[-1].pop()                      # the stray "1" of a split "10)"
            blocks.append([])
            continue
        if blocks:
            blocks[-1].append(w[5])

    return _blocks_to_holders([" ".join(b) for b in blocks], debug)



def _blocks_to_holders(texts: List[Any], debug: bool = False) -> List[Dict[str, Any]]:
    holders = []
    for item in texts:
        serial, t = item if isinstance(item, tuple) else (None, item)
        text = re.sub(r"\s+", " ", t).strip()
        if debug:
            print("  BLOCK:", text)
        if not text:
            continue
        parts = [clean_indic_text(p.strip()) for p in text.split("/")]
        name_raw = parts[0] if parts else ""
        father_raw = parts[1] if len(parts) > 1 else ""
        age = None
        m = AGE_RE.search(name_raw)
        if m:
            age = int(re.sub(r"\s", "", m.group(1)).translate(str.maketrans("०१२३४५६७८९", "0123456789")))
            name_raw = AGE_RE.sub("", name_raw)
        guardian = None
        g = GUARD_RE.search(father_raw)
        if g:
            guardian = clean_indic_text(g.group(2)); father_raw = GUARD_RE.sub("", father_raw)
        name, father = clean_indic_text(name_raw), clean_indic_text(father_raw)
        name = re.sub(r"[0-9०-९\.\)\(]+", " ", name).strip()     # stray serials / numbers
        name = re.sub(r"\s+", " ", name)
        if len(name) < 2:
            continue
        holders.append({"name": name, "relative": father, "minorAge": age, "guardian": guardian, "raw": text,
                        "serial": serial})
    return holders


def parse_holders_from_pdf(pdf_bytes: bytes, debug: bool = False, max_pages: int = 6) -> List[Dict[str, Any]]:
    """
    Read column (2) in the PDF's own character order (which is the correct reading order for
    Devanagari: vowel signs that are drawn before/above a consonant stay after it). Character
    positions are used only to decide which column a character belongs to.
    """
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(pdf_bytes)
    pages = []                                   # per page: list of (char, l, top, r, bottom) or None box
    for pi in range(min(len(pdf), max_pages)):
        page = pdf[pi]
        _, h = page.get_size()
        tp = page.get_textpage()
        chars = []
        for ci in range(tp.count_chars()):
            ch = tp.get_text_range(ci, 1) or " "
            ch = ch[0] if ch else " "
            box = None
            if not ch.isspace():
                try:
                    l, b, r, t = tp.get_charbox(ci)
                    box = (l, h - t, r, h - b)
                except Exception:
                    box = None
            chars.append((ch, box))
        pages.append(chars)

    # header "(2)" ... "(3)" on the same line -> x-range of the holders column
    rng = None
    for pi, chars in enumerate(pages):
        txt = "".join(c for c, _ in chars)
        for m in re.finditer(r"\(2\)", txt):
            b2 = chars[m.start()][1]
            if not b2:
                continue
            for m3 in re.finditer(r"\(3\)", txt):
                b3 = chars[m3.start()][1]
                if b3 and abs(b3[1] - b2[1]) < 4 and b3[0] > b2[0]:
                    rng = (b2[0] - 3, b3[0] - 2, pi, m.end(), b2[3])
                    break
            if rng:
                break
        if rng:
            break
    if not rng:
        return []
    x_lo, x_hi, p0, i0, y0 = rng

    hs = sorted(b[3] - b[1] for chars in pages for _, b in chars if b and b[3] > b[1])
    med_h = hs[len(hs) // 2] if hs else 10

    text = _column_text(pages, x_lo, x_hi, p0, i0, y0, med_h)
    cut = re.search(r"कु\s*ल\s*(गाटे|क्षे)", text)          # totals line ends the holders table
    if cut:
        text = text[:cut.start()]
    if debug:
        print("COLUMN TEXT:", text[:1500])
    parts = re.split(r"(?:(?<=\s)|^)(\d{1,2})\)", text)
    blocks = [(int(parts[k - 1]), parts[k]) for k in range(2, len(parts), 2)]   # (serial, text after marker)
    holders = _blocks_to_holders(blocks, debug)
    _attach_shares(holders, pages, rng, med_h, debug)
    return holders


def _attach_shares(holders, pages, rng, med_h, debug=False):
    """Share column (7) "हिस्सा": one entry per serial. Some printouts clip this column at the page edge
    so only "1/" survives; those are marked as cut off instead of being reported as 'not recorded'.
    A holder added by inheritance may have their area only in the mutation table ("1.1) 0.1337 1.1) राजेश")."""
    x_lo2, _, p0, i0, y0 = rng
    hdr7 = None
    for pi, chars in enumerate(pages):
        txt = "".join(c for c, _ in chars)
        for m in re.finditer(r"\(7", txt):
            b7 = chars[m.start()][1]
            if b7 and pi == p0 and b7[0] > x_lo2:
                hdr7 = b7[0] - 3
                break
        if hdr7:
            break
    shares: Dict[int, str] = {}
    if hdr7:
        col = _column_text(pages, hdr7, 10_000, p0, i0, y0, med_h)
        cur = None
        for tok in col.split():
            mm = re.fullmatch(r"(\d{1,2})\)?", tok)
            if mm and "/" not in tok:
                cur = int(mm.group(1)); shares.setdefault(cur, "")
            elif cur is not None and not shares[cur] and re.fullmatch(r"[0-9०-९./]+", tok):
                shares[cur] = tok                      # first share-like token after the serial
        if debug:
            print("SHARE COLUMN:", col[:300])
    full = "\n".join("".join(c for c, _ in chars) for chars in pages)
    mut = {}
    for m in re.finditer(r"\d+\.\d+\)\s*(\d+\.\d{3,4})\s*\d+\.\d+\)\s*([^/\n]+)", full):
        mut[re.sub(r"\s", "", clean_indic_text(m.group(2)))] = m.group(1)
    for h in holders:
        raw = shares.get(h.get("serial"), "")
        if re.fullmatch(r"\d+/\d+", raw):
            h["share"], h["shareStatus"] = raw, "read"
        elif re.fullmatch(r"\d+/", raw):
            h["share"], h["shareStatus"] = raw + "…", "clipped"
        else:
            area = mut.get(re.sub(r"\s", "", h["name"]))
            if area:
                h["share"], h["shareStatus"] = f"{area} हे०", "mutation"
            else:
                h["share"], h["shareStatus"] = "", "absent"


def _column_text(pages, x_lo, x_hi, p0, i0, y0, med_h) -> str:
    """Characters whose left edge lies in [x_lo, x_hi), in the PDF's own order, from the header down
    to the totals line. Spaces are inserted where the PDF has a gap or switches column."""
    out, gap = [], False
    for pi in range(p0, len(pages)):
        chars = pages[pi]
        txt = "".join(c for c, _ in chars)
        start = i0 if pi == p0 else 0
        endm = re.search(r"कु\s*ल\s*गाटे", txt[start:])
        stop = start + endm.start() if endm else len(chars)
        for ch, box in chars[start:stop]:
            if box is None:
                gap = True
                continue
            hgt = box[3] - box[1]
            # drop the large diagonal watermark and the tiny half-height overlay glyphs some
            # generators add (they would duplicate letters: "नेन्नेसी")
            inside = x_lo <= box[0] < x_hi and (pi > p0 or box[1] > y0) and 0.6 * med_h < hgt < 1.8 * med_h
            if not inside:
                gap = True
                continue
            if gap and out:
                out.append(" ")
            out.append(ch)
            gap = False
        if endm:
            break
    return "".join(out)
