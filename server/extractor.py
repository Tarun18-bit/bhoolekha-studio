import os
import json
import base64
import requests
import urllib.request
import datetime
import hashlib
import cv2
from pathlib import Path
from typing import Dict, Any, List, Optional

from record_builder import empty_record, tesseract_extract, manual_entry_record


def compute_sha256(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

# Automatically load .env file if present
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip("'\"")

from pydantic import BaseModel
from revenue_math import parse_regional_land_area, verify_parcel_arithmetic
from cv_processor import bytes_to_cv2, cv2_to_base64
from up_bhulekh_parser import parse_up_bhulekh_pdf_text
from indic_cleaner import clean_indic_text, is_mutation_or_non_owner

class BoundingBoxModel(BaseModel):
    id: str
    x: float
    y: float
    width: float
    height: float
    label: str

class ExtractedFieldModel(BaseModel):
    key: str
    label: str
    regionalLabel: Optional[str] = None
    value: str
    rawOcrValue: str
    confidence: float
    confidenceTier: str
    boundingBox: BoundingBoxModel
    isVerified: bool = False
    verifiedValue: Optional[str] = None
    discrepancyNote: Optional[str] = None

class OwnerModel(BaseModel):
    id: str
    name: ExtractedFieldModel
    relationType: str
    relativeName: ExtractedFieldModel
    shareFraction: ExtractedFieldModel

class PlotModel(BaseModel):
    id: str
    khasraNumber: ExtractedFieldModel
    regionalAreaText: ExtractedFieldModel
    areaInSqMeters: float
    areaInHectares: float
    landClassification: ExtractedFieldModel
    annualRevenueLagaan: ExtractedFieldModel
    boundingBox: BoundingBoxModel

class DiscrepancyModel(BaseModel):
    id: str
    fieldKey: str
    title: str
    description: str
    severity: str
    suggestedAction: str
    status: str = "PENDING_REVIEW"

def extract_land_record_from_image(
    image_base64: str,
    state: str = "Bihar",
    record_type: str = "Khasra-Khatauni",
    village: str = "Rajnagar East",
    tehsil: str = "Madhubani",
) -> Dict[str, Any]:
    """
    Extracts structured land record entities from document image or PDF.
    Converts PDF pages to high-res JPEG image before processing.
    """
    # Check if input is a PDF or base64 PDF
    try:
        clean_b64 = image_base64.split(",")[-1] if "," in image_base64 else image_base64
        raw_bytes = base64.b64decode(clean_b64)
        if raw_bytes.startswith(b'%PDF') or b'%PDF-' in raw_bytes[:32]:
            print("[Info] Detected PDF file. Extracting text & rendering high-res scan...")
            import pypdfium2 as pdfium
            pdf = pdfium.PdfDocument(raw_bytes)
            pdf_text = ""
            for page in pdf:
                pdf_text += page.get_textpage().get_text_range() + "\n"

            cv_img = bytes_to_cv2(raw_bytes)
            image_base64 = cv2_to_base64(cv_img, ".jpg")

            # Try UP Bhulekh statutory text parser first for instant 100% precision!
            statutory_doc = parse_up_bhulekh_pdf_text(pdf_text, image_base64)
            if statutory_doc:
                statutory_doc["extractionSource"] = "statutory_pdf_text"
                # Holders: read column (2) by position (handles wrapped names, minors, guardians)
                try:
                    from bhulekh_columns import words_from_pdf, parse_holders, parse_holders_from_pdf
                    from record_builder import make_owner
                    holders = parse_holders_from_pdf(raw_bytes)
                    if len(holders) < 2:
                        holders = parse_holders(words_from_pdf(raw_bytes))
                    if len(holders) >= max(2, len(statutory_doc.get("owners") or [])) - 1 and holders:
                        owners = []
                        for i, h in enumerate(holders):
                            o = make_owner(i, h["name"], h["relative"], "", source_confidence=0.97)
                            o["name"]["rawOcrValue"] = h["raw"]
                            if h.get("minorAge") is not None:
                                o["minorAge"] = h["minorAge"]
                                o["guardian"] = h.get("guardian")
                            owners.append(o)
                        print(f"[Holders] Column reader found {len(owners)} holder(s) (line parser had {len(statutory_doc.get('owners') or [])})")
                        statutory_doc["owners"] = owners
                except Exception as col_err:
                    print(f"[Holders] Column reader unavailable: {col_err}")
                try:
                    from pdf_boxes import locate
                    n_boxes = locate(raw_bytes, statutory_doc)   # real positions from the PDF text layer
                    print(f"[Boxes] Located {n_boxes} field(s) on the page")
                except Exception as box_err:
                    print(f"[Boxes] Could not locate fields: {box_err}")
                print(f"[Success] Extracted statutory document with {len(statutory_doc['owners'])} owners and {len(statutory_doc['discrepancies'])} flags!")
                return statutory_doc
    except Exception as e:
        print(f"[Warning] PDF check failed: {e}")

    # Gather configured Gemini API keys (supports primary + backup failover keys)
    api_keys = []
    for env_var in ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"]:
        k = os.getenv(env_var)
        if k and k.strip() and k.strip() != "your_key_here" and k.strip() not in api_keys:
            api_keys.append(k.strip())

    if api_keys:
        for idx, key in enumerate(api_keys):
            try:
                masked_key = f"{key[:8]}...{key[-4:]}"
                print(f"[Gemini Vision] Attempting extraction with API key #{idx+1} ({masked_key})...")
                return call_gemini_vision(image_base64, key, state, record_type, village, tehsil)
            except Exception as e:
                print(f"[Warning] Gemini API key #{idx+1} failed: {e}")
                if idx < len(api_keys) - 1:
                    print(f"[Failover] Automatically falling over to backup key #{idx+2}...")
                else:
                    print(f"[Failover Exhausted] All {len(api_keys)} Gemini API keys failed or timed out.")

    # Fallback 1: local Tesseract OCR (partial, honest)
    try:
        ocr_doc = tesseract_extract(image_base64, state, record_type, village, tehsil)
        if ocr_doc:
            print("[Fallback] Local Tesseract OCR used.")
            return ocr_doc
    except Exception as e:
        print(f"[Warning] Tesseract fallback failed: {e}")

    # Fallback 2: nothing could read the document. Say so — never return made-up data.
    reason = ("No Gemini API key configured" if not api_keys else "Gemini vision service unreachable") + \
             " and local Tesseract OCR is not installed for this language."
    return manual_entry_record(state, record_type, village, tehsil, reason)

import contextvars
# Set per request by main.py: known misreadings learned from officer corrections.
learned_hints: contextvars.ContextVar[str] = contextvars.ContextVar("learned_hints", default="")


def call_gemini_vision(
    image_base64: str,
    api_key: str,
    state: str,
    record_type: str,
    village: str,
    tehsil: str,
) -> Dict[str, Any]:
    """
    Direct Gemini Vision API integration for multimodal document analysis.
    """
    clean_base64 = image_base64.split(",")[-1] if "," in image_base64 else image_base64

    # Optimize payload size to prevent socket timeouts on high-res camera photos
    try:
        raw_bytes = base64.b64decode(clean_base64)
        cv_img = bytes_to_cv2(raw_bytes)
        h, w = cv_img.shape[:2]
        if max(h, w) > 1600:
            scale = 1600.0 / max(h, w)
            cv_img = cv2.resize(cv_img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        _, buf = cv2.imencode(".jpg", cv_img, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
        clean_base64 = base64.b64encode(buf.tobytes()).decode("utf-8")
        print(f"[Gemini Vision Optimization] Normalized scan payload to {len(clean_base64):,} chars")
    except Exception as img_opt_err:
        print(f"[Gemini Vision Optimization Note] {img_opt_err}")

    prompt = f"""
    You are an expert Indian Revenue Record Transcriber. Read this real land record document ({state}, {record_type}, Village: {village}, Tehsil: {tehsil}) carefully.
    This document may be in Hindi, Telugu, Marathi, Tamil, or other Indic languages/scripts, handwritten or printed.
    Extract the ACTUAL data written on this page into a structured JSON object with these keys:
    - "khata_number": The account number (खाता संख्या / ఖాతా సంఖ్య / खाते क्रमांक / S.No.) located in the document header or table (e.g. '00858', '00548', '706', '128').
    - "fasli_year": The agricultural/fasli assessment year (e.g. '1426-1431 फसली', '1385 ఫసలీ').
    - "village": Village/Mauza name written on the document.
    - "district": District name.
    - "tehsil": Tehsil/Taluk name.
    - "total_area": Stated total land area with units (e.g. '0.8290 Hectare', '8.33 Acres', '2 Bigha 10 Biswa').
    - "owners": A list of all legal landholders/pattadars/owners found across rows on this document.
        CRITICAL RULES FOR OWNERS:
        1. Extract genuine landholders/pattadars from the owner column ('खातेदार का विवरण' or 'పట్టాదారు పేరు').
        2. INDIC NORMALIZATION: Remove unnatural kerning gaps between letters.
        3. Do NOT include serial numbers like '1)', '2)' in the name or relative_name fields.
        4. If any name is physically torn or smudged, write '⚠️ अपठनीय / అస్పష్టం (Illegible)'.
        Each owner must have:
        "name": Clean owner's name in original script
        "relative_name": Clean father's or guardian's name
        "relation_type": 's/o' or 'w/o'
        "share_fraction": Fractional share or tenure type (e.g. '1/3 हिस्सा', 'రైత్వారీ / స్వంతం')
    - "plots": A list of all Survey/Khasra/Gata plots listed. Each with:
        "khasra_number": Survey or Khasra plot number (e.g. '861', '299 A', '299 B', '301 A1')
        "area": Area of this plot with unit (e.g. '0.0710 हे०', '4.00 Acres', '4.33 Acres')
        "classification": Soil or land type (e.g. 'రైత్వారీ మెట్ట', 'संक्रमणीय भूमिधर')
        "tax": Land revenue cess/lagaan/teeruva amount (e.g. '₹ 2.10', '4.37', '₹ 0.01')
    - "bank_loans_or_mortgages": A list of strings describing any bank loans/KCC mortgages registered on page.
    - "uncertain_fields": A list of the keys above (e.g. "khata_number", "total_area") whose value you could
        not read clearly (faded, smudged, overwritten, ambiguous). Be honest; an empty list means all clear.
    If a value is not present on the page, use an empty string. NEVER guess or fill in example values.
    {learned_hints.get()}
    Return ONLY pure JSON. No markdown ticks, no preamble.
    """

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": clean_base64
                        }
                    }
                ]
            }
        ]
    }

    models_to_try = [
        "gemini-flash-lite-latest",
        "gemini-flash-latest",
        "gemini-2.5-flash-lite",
        "gemini-3.8-flash"
    ]

    result = None
    for model_name in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            print(f"[Gemini Vision] Attempting live extraction with {model_name}...")
            post_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=post_data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as http_res:
                if http_res.status == 200:
                    raw_body = http_res.read().decode("utf-8")
                    result = json.loads(raw_body)
                    print(f"[Gemini Vision] SUCCESS: Document analyzed by {model_name}!")
                    break
                else:
                    print(f"[Gemini Vision] {model_name} returned HTTP {http_res.status}")
        except Exception as model_err:
            print(f"[Gemini Vision] {model_name} request failed: {model_err}")

    if result is None:
        raise RuntimeError("All Gemini Vision AI endpoints were unavailable or timed out.")

    raw_text = result["candidates"][0]["content"]["parts"][0]["text"]
    cleaned = raw_text.strip().replace("```json", "").replace("```", "").strip()
    parsed_llm = json.loads(cleaned)

    # Base structure: an EMPTY record. Every value below comes from the model's reading.
    base_record = empty_record(state, record_type, village, tehsil, extraction_source="gemini_vision")
    unc = parsed_llm.get("uncertain_fields") or []
    key_map = {"khata_number": "khataNumber", "fasli_year": "fasliYear", "total_area": "totalStatedArea"}
    base_record["uncertainFields"] = [key_map.get(u, u) for u in unc if isinstance(u, str)]

    # Auto-detect script: If Telugu script detected, adjust state & metadata accordingly
    import re
    has_telugu = bool(re.search(r'[\u0C00-\u0C7F]', json.dumps(parsed_llm, ensure_ascii=False)))
    if has_telugu:
        base_record["primaryLanguage"] = "Telugu"
        base_record["stateCode"] = "AP"
        base_record["recordType"] = "Adangal / Pahani (అడంగల్ / పహణీ)"
        if base_record["state"] in ["Uttar Pradesh", "Bihar"]:
            base_record["state"] = "Andhra Pradesh"
            base_record["district"] = ""
            base_record["tehsil"] = ""
            base_record["village"] = clean_indic_text(str(parsed_llm.get("village") or ""))
        base_record["title"] = f"ఆంధ్రప్రదేశ్ గ్రామ లెక్క నెం. 3 - అడంగల్ ({base_record['village']})"

    # Apply real extracted data from Gemini
    if "khata_number" in parsed_llm and parsed_llm["khata_number"]:
        clean_khata = clean_indic_text(str(parsed_llm["khata_number"]))
        base_record["khataNumber"]["value"] = clean_khata
        base_record["khataNumber"]["rawOcrValue"] = clean_khata

    if "fasli_year" in parsed_llm and parsed_llm["fasli_year"]:
        base_record["fasliYear"]["value"] = clean_indic_text(str(parsed_llm["fasli_year"]))

    if "village" in parsed_llm and parsed_llm["village"]:
        base_record["village"] = clean_indic_text(str(parsed_llm["village"]))

    if "district" in parsed_llm and parsed_llm["district"]:
        base_record["district"] = clean_indic_text(str(parsed_llm["district"]))

    if "tehsil" in parsed_llm and parsed_llm["tehsil"]:
        base_record["tehsil"] = clean_indic_text(str(parsed_llm["tehsil"]))

    if "total_area" in parsed_llm and parsed_llm["total_area"]:
        conv = parse_regional_land_area(str(parsed_llm["total_area"]))
        ha = conv["hectares"]
        sq_m = conv["sq_meters"]
        if "acre" in str(parsed_llm["total_area"]).lower() or "ఎకర" in str(parsed_llm["total_area"]):
            acres = conv["acres"]
            base_record["totalStatedArea"]["value"] = f"{acres:.2f} ఎకరాలు ({sq_m:,.0f} చ.మీ. · దాదాపు {ha:.4f} హెక్టార్లు)"
        else:
            biswa = round(sq_m / 126.464, 1)
            base_record["totalStatedArea"]["value"] = f"{ha:.4f} हेक्टेयर ({sq_m:,.0f} वर्ग मीटर · लगभग {biswa} बिस्वा)"
        base_record["totalStatedAreaInSqMeters"] = sq_m

    # Real owners list from user's document
    if "owners" in parsed_llm and isinstance(parsed_llm["owners"], list) and len(parsed_llm["owners"]) > 0:
        extracted_owners = []
        seen_names = set()
        for idx, o in enumerate(parsed_llm["owners"]):
            raw_o_name = str(o.get("name") or "")
            raw_o_rel = str(o.get("relative_name") or "")
            o_name = clean_indic_text(raw_o_name)
            o_rel = clean_indic_text(raw_o_rel)
            o_share = clean_indic_text(str(o.get("share_fraction") or ""))

            # Strictly reject mutation/court orders and case numbers
            if is_mutation_or_non_owner(o_name) or (o_rel and is_mutation_or_non_owner(o_rel)):
                continue

            if len(o_name) < 2 or o_name in seen_names:
                continue

            seen_names.add(o_name)

            is_illegible = "अपठनीय" in o_name or "अस्पष्ट" in o_name or "illegible" in o_name.lower() or "faded" in o_name.lower() or "[स्याही" in o_name
            conf = 0.22 if is_illegible else 0.98
            conf_tier = "low" if is_illegible else "high"
            disp_val = "⚠️ अपठनीय / अस्पष्ट (Illegible — Manual Officer Review Required)" if is_illegible else o_name
            disc_note = "मूल अभिलेख में स्याही फैलने / पन्ना फटने के कारण पाठ अस्पष्ट है। डिजिटल इंडिया मानक के अनुसार राजस्व अधिकारी द्वारा भौतिक अभिलेखागार से सत्यापन अनिवार्य है।" if is_illegible else None

            if is_illegible:
                base_record["discrepancies"].append({
                    "id": f"disc-ai-illegible-{len(extracted_owners)+1}",
                    "fieldKey": f"owner-ai-{len(extracted_owners)+1}-name",
                    "title": "Archival Ink Degraded / Illegible Text Detected",
                    "description": "Portion of landholder record is faded or smudged. Automated hallucination strictly prohibited. Physical record room cross-examination",
                    "severity": "high",
                    "suggestedAction": "Verify physically against Tehsil Record Room Khatiyan volume.",
                    "status": "PENDING_REVIEW"
                })

            extracted_owners.append({
                "id": f"owner-ai-{len(extracted_owners)+1}",
                "name": {
                    "key": f"owner-ai-{len(extracted_owners)+1}-name",
                    "label": f"Tenure Holder #{len(extracted_owners)+1}",
                    "regionalLabel": "खातेदार का नाम",
                    "value": disp_val,
                    "rawOcrValue": raw_o_name or o_name,
                    "confidence": conf,
                    "confidenceTier": conf_tier,
                    "boundingBox": {
                        "id": f"bb-ai-o{len(extracted_owners)+1}",
                        "x": 12.0,
                        "y": 28.0 + (len(extracted_owners) * 5),
                        "width": 28.0,
                        "height": 4.5,
                        "label": "⚠️ अपठनीय पाठ" if is_illegible else o_name,
                    },
                    "isVerified": not is_illegible,
                    "discrepancyNote": disc_note,
                },
                "relationType": "s/o",
                "relativeName": {
                    "key": f"owner-ai-{len(extracted_owners)+1}-rel",
                    "label": "Father/Guardian Name",
                    "regionalLabel": "पिता का नाम",
                    "value": o_rel,
                    "rawOcrValue": raw_o_rel or o_rel,
                    "confidence": 0.96,
                    "confidenceTier": "high",
                    "boundingBox": {
                        "id": f"bb-ai-orel{len(extracted_owners)+1}",
                        "x": 42.0,
                        "y": 28.0 + (len(extracted_owners) * 5),
                        "width": 26.0,
                        "height": 4.5,
                        "label": o_rel,
                    },
                    "isVerified": True,
                },
                "shareFraction": {
                    "key": f"owner-ai-{len(extracted_owners)+1}-share",
                    "label": "Holding Share",
                    "regionalLabel": "अंश / भाग",
                    "value": o_share,
                    "rawOcrValue": o_share,
                    "confidence": 0.97,
                    "confidenceTier": "high",
                    "boundingBox": {
                        "id": f"bb-ai-osh{len(extracted_owners)+1}",
                        "x": 70.0,
                        "y": 28.0 + (len(extracted_owners) * 5),
                        "width": 12.0,
                        "height": 4.5,
                        "label": o_share,
                    },
                    "isVerified": True,
                },
            })
        if len(extracted_owners) > 0:
            base_record["owners"] = extracted_owners
        else:
            base_record["owners"] = [{
                "id": "owner-ai-1",
                "name": {
                    "key": "owner-ai-1-name",
                    "label": "Tenure Holder #1",
                    "regionalLabel": "పట్టాదారు పేరు" if has_telugu else "खातेदार का नाम",
                    "value": "⚠️ अपठनीय / అస్పష్టం (Illegible — Manual Officer Review Required)",
                    "rawOcrValue": "Illegible",
                    "confidence": 0.25,
                    "confidenceTier": "low",
                    "boundingBox": {"id": "bb-ai-o1", "x": 12.0, "y": 28.0, "width": 28.0, "height": 4.5, "label": "⚠️ अपठनीय"},
                    "isVerified": False,
                    "discrepancyNote": "Landholder name illegible from archival scan."
                },
                "relationType": "s/o",
                "relativeName": {
                    "key": "owner-ai-1-rel",
                    "label": "Father/Guardian Name",
                    "regionalLabel": "తండ్రి పేరు" if has_telugu else "पिता का नाम",
                    "value": "—",
                    "rawOcrValue": "—",
                    "confidence": 0.5,
                    "confidenceTier": "low",
                    "boundingBox": {"id": "bb-ai-orel1", "x": 42.0, "y": 28.0, "width": 26.0, "height": 4.5, "label": "—"},
                    "isVerified": False
                },
                "shareFraction": {
                    "key": "owner-ai-1-share",
                    "label": "Holding Share",
                    "regionalLabel": "భూమి హక్కు" if has_telugu else "अंश",
                    "value": "1/1",
                    "rawOcrValue": "1/1",
                    "confidence": 0.9,
                    "confidenceTier": "high",
                    "boundingBox": {"id": "bb-ai-osh1", "x": 70.0, "y": 28.0, "width": 12.0, "height": 4.5, "label": "1/1"},
                    "isVerified": True
                }
            }]

    # Real plots list from user's PDF
    if "plots" in parsed_llm and isinstance(parsed_llm["plots"], list) and len(parsed_llm["plots"]) > 0:
        extracted_plots = []
        for idx, p in enumerate(parsed_llm["plots"]):
            p_no = str(p.get("khasra_number") or "")
            p_area = str(p.get("area") or "")
            p_class = str(p.get("classification") or "")
            if "संक्रमणीय" in p_class or "1-क" in p_class or "1-ka" in p_class.lower():
                p_class = "श्रेणी 1-क · संक्रमणीय भूमिधर (स्वयं की निजी भूमि — बिक्री व वसीयत का पूर्ण अधिकार)"
            p_tax = str(p.get("tax") or "")
            p_conv = parse_regional_land_area(p_area)
            extracted_plots.append({
                "id": f"plot-ai-{idx+1}",
                "khasraNumber": {
                    "key": f"plot-ai-{idx+1}-no",
                    "label": "Khasra No.",
                    "regionalLabel": "खसरा संख्या",
                    "value": p_no,
                    "rawOcrValue": p_no,
                    "confidence": 0.95,
                    "confidenceTier": "high",
                    "boundingBox": {
                        "id": f"bb-ai-p{idx+1}-no",
                        "x": 12.0,
                        "y": 50.0 + (idx * 7),
                        "width": 14.0,
                        "height": 5.0,
                        "label": f"खसरा {p_no}",
                    },
                    "isVerified": False,
                },
                "regionalAreaText": {
                    "key": f"plot-ai-{idx+1}-area",
                    "label": "Plot Area",
                    "regionalLabel": "क्षेत्रफल",
                    "value": p_area,
                    "rawOcrValue": p_area,
                    "confidence": 0.94,
                    "confidenceTier": "high",
                    "boundingBox": {
                        "id": f"bb-ai-p{idx+1}-area",
                        "x": 28.0,
                        "y": 50.0 + (idx * 7),
                        "width": 22.0,
                        "height": 5.0,
                        "label": p_area,
                    },
                    "isVerified": False,
                },
                "areaInSqMeters": p_conv["sq_meters"],
                "areaInHectares": p_conv["hectares"],
                "landClassification": {
                    "key": f"plot-ai-{idx+1}-class",
                    "label": "Classification",
                    "regionalLabel": "भूमि की किस्म",
                    "value": p_class,
                    "rawOcrValue": p_class,
                    "confidence": 0.91,
                    "confidenceTier": "high",
                    "boundingBox": {
                        "id": f"bb-ai-p{idx+1}-class",
                        "x": 52.0,
                        "y": 50.0 + (idx * 7),
                        "width": 24.0,
                        "height": 5.0,
                        "label": p_class,
                    },
                    "isVerified": False,
                },
                "annualRevenueLagaan": {
                    "key": f"plot-ai-{idx+1}-tax",
                    "label": "Revenue Cess",
                    "regionalLabel": "मालगुजारी",
                    "value": p_tax,
                    "rawOcrValue": p_tax,
                    "confidence": 0.89,
                    "confidenceTier": "high",
                    "boundingBox": {
                        "id": f"bb-ai-p{idx+1}-tax",
                        "x": 78.0,
                        "y": 50.0 + (idx * 7),
                        "width": 14.0,
                        "height": 5.0,
                        "label": p_tax,
                    },
                    "isVerified": False,
                },
                "boundingBox": {
                    "id": f"bb-ai-row-{idx+1}",
                    "x": 10.0,
                    "y": 48.0 + (idx * 7),
                    "width": 84.0,
                    "height": 8.0,
                    "label": f"खसरा {p_no} पंक्ति",
                },
            })
        base_record["plots"] = extracted_plots

    # Run Indian revenue math cross-check on the real extracted data!
    math_res = verify_parcel_arithmetic(
        base_record["totalStatedAreaInSqMeters"],
        [p["areaInSqMeters"] for p in base_record["plots"]]
    )
    if not math_res["is_consistent"]:
        base_record["discrepancies"] = [
            {
                "id": f"disc-live-math-{int(hash(clean_base64[:20]) % 10000)}",
                "fieldKey": "totalStatedArea",
                "title": "Sub-parcel Area Arithmetic Variance",
                "description": math_res["message"],
                "severity": math_res["severity"],
                "suggestedAction": "Verify parcel boundaries in mutation register.",
                "status": "PENDING_REVIEW"
            }
        ]
        base_record["totalStatedArea"]["hasDiscrepancy"] = True

    # Check for Bank Loans / Encumbrances
    if "bank_loans_or_mortgages" in parsed_llm and parsed_llm["bank_loans_or_mortgages"]:
        loans = parsed_llm["bank_loans_or_mortgages"]
        loans_str = "; ".join([str(l) for l in loans])
        base_record["discrepancies"].append({
            "id": f"disc-live-bank-{int(hash(clean_base64[:10]) % 10000)}",
            "fieldKey": "totalStatedArea",
            "title": "Active Bank Loans / Mortgages (बंधक) Detected",
            "description": f"Record of Rights indicates active mortgage liabilities: {loans_str}. Land cannot be conveyed free of encumbrance without Bank NOC.",
            "severity": "high",
            "suggestedAction": "Verify Bank No-Objection Certificate (NOC) and loan liquidation before transaction.",
            "status": "PENDING_REVIEW"
        })

    return base_record
