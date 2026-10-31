"""
Record builder: honest record skeletons + local Tesseract OCR fallback.

Rule: nothing in this module ever invents land-record data. If a value could not
be read, it is left empty with confidence 0 and flagged for manual entry.
"""
import base64
import datetime
import re
import shutil
from typing import Any, Dict, List, Optional

from cv_processor import bytes_to_cv2
from revenue_math import parse_regional_land_area

STATE_CODES = {
    "Uttar Pradesh": "UP", "Bihar": "BR", "Maharashtra": "MH",
    "Andhra Pradesh": "AP", "Telangana": "TG", "Madhya Pradesh": "MP",
    "Rajasthan": "RJ", "Karnataka": "KA", "Tamil Nadu": "TN",
}
TESSERACT_LANGS = {
    "Hindi": "hin+eng", "Marathi": "mar+eng", "Telugu": "tel+eng",
    "Tamil": "tam+eng", "English": "eng",
}


def primary_language_for(state: str, record_type: str = "") -> str:
    if state in ("Andhra Pradesh", "Telangana") or "Adangal" in (record_type or ""):
        return "Telugu"
    if state == "Maharashtra":
        return "Marathi"
    if state == "Tamil Nadu":
        return "Tamil"
    return "Hindi"


def make_field(key: str, label: str, regional_label: str, value: str = "",
               raw: Optional[str] = None, bbox: Optional[Dict[str, float]] = None,
               source_confidence: float = 0.0) -> Dict[str, Any]:
    """One extracted field. `confidence` is filled in later by validation_engine."""
    return {
        "key": key,
        "label": label,
        "regionalLabel": regional_label,
        "value": value or "",
        "rawOcrValue": raw if raw is not None else (value or ""),
        "sourceConfidence": source_confidence,
        "confidence": 0.0,
        "confidenceTier": "low",
        "boundingBox": {"id": f"bb-{key}", "x": 0, "y": 0, "width": 0, "height": 0,
                        "label": label, **(bbox or {})},
        "hasBoundingBox": bool(bbox),
        "isVerified": False,
        "discrepancyNote": None,
    }


def make_owner(idx: int, name: str = "", relative: str = "", share: str = "",
               relation: str = "s/o", source_confidence: float = 0.0,
               bboxes: Optional[Dict[str, Dict[str, float]]] = None) -> Dict[str, Any]:
    bboxes = bboxes or {}
    n = idx + 1
    return {
        "id": f"owner-{n}",
        "name": make_field(f"owner-{n}-name", f"Tenure Holder #{n}", "खातेदार का नाम",
                           name, bbox=bboxes.get("name"), source_confidence=source_confidence),
        "relationType": relation if relation in ("s/o", "w/o", "d/o", "c/o", "h/o") else "s/o",
        "relativeName": make_field(f"owner-{n}-rel", "Father/Guardian Name", "पिता/पति का नाम",
                                   relative, bbox=bboxes.get("rel"), source_confidence=source_confidence),
        "shareFraction": make_field(f"owner-{n}-share", "Holding Share", "अंश",
                                    share, bbox=bboxes.get("share"), source_confidence=source_confidence),
    }


def make_plot(idx: int, khasra: str = "", area: str = "", classification: str = "",
              tax: str = "", source_confidence: float = 0.0,
              bboxes: Optional[Dict[str, Dict[str, float]]] = None) -> Dict[str, Any]:
    bboxes = bboxes or {}
    n = idx + 1
    conv = parse_regional_land_area(area) if area else {"sq_meters": 0.0, "hectares": 0.0}
    return {
        "id": f"plot-{n}",
        "khasraNumber": make_field(f"plot-{n}-no", "Khasra / Survey No.", "खसरा / गाटा संख्या",
                                   khasra, bbox=bboxes.get("no"), source_confidence=source_confidence),
        "regionalAreaText": make_field(f"plot-{n}-area", "Plot Area", "क्षेत्रफल",
                                       area, bbox=bboxes.get("area"), source_confidence=source_confidence),
        "areaInSqMeters": conv.get("sq_meters", 0.0) or 0.0,
        "areaInHectares": conv.get("hectares", 0.0) or 0.0,
        "landClassification": make_field(f"plot-{n}-class", "Classification", "भूमि की किस्म",
                                         classification, bbox=bboxes.get("class"),
                                         source_confidence=source_confidence),
        "annualRevenueLagaan": make_field(f"plot-{n}-tax", "Revenue Cess", "मालगुजारी",
                                          tax, bbox=bboxes.get("tax"), source_confidence=source_confidence),
        "boundingBox": {"id": f"bb-plot-{n}", "x": 0, "y": 0, "width": 0, "height": 0,
                        "label": f"Plot {n}", **(bboxes.get("row") or {})},
    }


def empty_record(state: str, record_type: str, village: str, tehsil: str,
                 district: str = "", extraction_source: str = "none") -> Dict[str, Any]:
    """A record skeleton with every data field blank. Metadata comes from the upload form."""
    lang = primary_language_for(state, record_type)
    now = datetime.datetime.now()
    return {
        "id": f"rec-{now.strftime('%Y%m%d%H%M%S%f')}",
        "title": f"{state} land record ({village or 'village not read'})",
        "state": state,
        "stateCode": STATE_CODES.get(state, (state or "XX")[:2].upper()),
        "district": district or "",
        "tehsil": tehsil or "",
        "village": village or "",
        "recordType": record_type,
        "primaryLanguage": lang,
        "originalDocumentUrl": "",
        "scanCondition": "Standard Digital Scan",
        "estimatedYear": 0,
        "khataNumber": make_field("khataNumber", "Khata Number", "खाता संख्या"),
        "fasliYear": make_field("fasliYear", "Fasli / Assessment Year", "फसली वर्ष"),
        "owners": [],
        "totalStatedArea": make_field("totalStatedArea", "Total Stated Area", "कुल क्षेत्रफल"),
        "totalStatedAreaInSqMeters": 0.0,
        "plots": [],
        "discrepancies": [],
        "uncertainFields": [],
        "extractionSource": extraction_source,
        "overallConfidence": 0.0,
        "verificationStatus": "IN_REVIEW",
        "auditTrail": [],
    }


# ---------------------------------------------------------------------------
# Local OCR fallback (Tesseract). Used when Gemini is unavailable.
# ---------------------------------------------------------------------------

_INDIC_DIGITS = str.maketrans("०१२३४५६७८९౦౧౨౩౪౫౬౭౮౯", "01234567890123456789")


def tesseract_available(lang: str) -> bool:
    if not shutil.which("tesseract"):
        return False
    try:
        import pytesseract
        installed = set(pytesseract.get_languages(config=""))
        return all(l in installed for l in lang.split("+"))
    except Exception:
        return False


def _ocr_words(img, lang: str) -> List[Dict[str, Any]]:
    import pytesseract
    data = pytesseract.image_to_data(img, lang=lang, output_type=pytesseract.Output.DICT)
    h, w = img.shape[:2]
    words = []
    for i, text in enumerate(data["text"]):
        t = (text or "").strip()
        conf = float(data["conf"][i]) if str(data["conf"][i]) not in ("-1", "") else -1
        if not t or conf < 0:
            continue
        words.append({
            "text": t, "conf": conf / 100.0,
            "line": (data["block_num"][i], data["par_num"][i], data["line_num"][i]),
            "x": data["left"][i] / w * 100, "y": data["top"][i] / h * 100,
            "w": data["width"][i] / w * 100, "h": data["height"][i] / h * 100,
        })
    return words


def _bbox_of(words: List[Dict[str, Any]]) -> Dict[str, float]:
    x0 = min(wd["x"] for wd in words); y0 = min(wd["y"] for wd in words)
    x1 = max(wd["x"] + wd["w"] for wd in words); y1 = max(wd["y"] + wd["h"] for wd in words)
    return {"x": round(x0, 2), "y": round(y0, 2), "width": round(x1 - x0, 2), "height": round(y1 - y0, 2)}


def _value_after_label(words, label_pattern: str, value_pattern: str, max_ahead: int = 6):
    """Find a label word, then the first following word on the same line matching value_pattern."""
    lab = re.compile(label_pattern)
    val = re.compile(value_pattern)
    for i, wd in enumerate(words):
        if lab.search(wd["text"]):
            for nxt in words[i + 1:i + 1 + max_ahead]:
                if nxt["line"] != wd["line"]:
                    break
                cand = nxt["text"].translate(_INDIC_DIGITS).strip(":-.,")
                if val.fullmatch(cand):
                    return cand, nxt
    return None, None


def tesseract_extract(image_base64: str, state: str, record_type: str,
                      village: str, tehsil: str) -> Optional[Dict[str, Any]]:
    """
    Best-effort local OCR. Reads only what it can locate with a label; everything
    else stays empty for the officer. Returns None if Tesseract isn't installed.
    """
    lang = TESSERACT_LANGS.get(primary_language_for(state, record_type), "eng")
    if not tesseract_available(lang):
        return None

    clean = image_base64.split(",")[-1]
    img = bytes_to_cv2(base64.b64decode(clean))
    words = _ocr_words(img, lang)

    rec = empty_record(state, record_type, village, tehsil, extraction_source="tesseract")
    rec["rawOcrText"] = " ".join(w["text"] for w in words)[:20000]

    khata, kw = _value_after_label(words, r"खाता|खाते|ఖాతా|Khata|KHATA", r"\d{1,6}")
    if khata:
        rec["khataNumber"] = make_field("khataNumber", "Khata Number", "खाता संख्या", khata,
                                        raw=kw["text"], bbox=_bbox_of([kw]), source_confidence=kw["conf"])

    khasra, sw = _value_after_label(words, r"खसरा|गाटा|गट|సర్వే|Khasra|Survey|Gata",
                                    r"\d{1,5}(?:[/-]?[0-9A-Za-zअ-ह]{1,3})?")
    area, aw = _value_after_label(words, r"क्षेत्रफल|विस्तार|క్షేత్రం|విస్తీర్ణం|Area|AREA",
                                  r"\d+(?:\.\d+)?", max_ahead=4)
    if khasra or area:
        plot = make_plot(0, khasra or "", area or "", source_confidence=min(
            [w["conf"] for w in (sw, aw) if w] or [0.0]),
            bboxes={"no": _bbox_of([sw]) if sw else None, "area": _bbox_of([aw]) if aw else None})
        rec["plots"] = [plot]

    rec["discrepancies"].append({
        "id": "disc-ocr-partial",
        "fieldKey": "owners",
        "title": "Local OCR fallback used — partial extraction",
        "description": "Cloud vision model was unavailable. Only labelled numeric fields were read "
                       "by local Tesseract OCR; owner names and remaining fields need manual entry.",
        "severity": "medium",
        "suggestedAction": "Enter missing fields from the scan in the review panel.",
        "status": "PENDING_REVIEW",
    })
    return rec


def manual_entry_record(state: str, record_type: str, village: str, tehsil: str,
                        reason: str) -> Dict[str, Any]:
    rec = empty_record(state, record_type, village, tehsil, extraction_source="manual_required")
    rec["discrepancies"].append({
        "id": "disc-extraction-unavailable",
        "fieldKey": "khataNumber",
        "title": "Automatic extraction unavailable — manual entry required",
        "description": reason,
        "severity": "high",
        "suggestedAction": "Transcribe the record manually in the review panel, or retry when the "
                           "extraction service is reachable.",
        "status": "PENDING_REVIEW",
    })
    return rec
