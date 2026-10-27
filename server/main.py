import os
from pathlib import Path

# Automatically load .env file if present
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip("'\"")

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import base64

from cv_processor import (
    bytes_to_cv2, 
    cv2_to_base64, 
    estimate_skew_angle, 
    deskew_image, 
    sauvola_binarize, 
    enhance_contrast_clahe
)
from extractor import extract_land_record_from_image
from revenue_math import parse_regional_land_area, verify_parcel_arithmetic
from telephony import telephony_router

app = FastAPI(
    title="BhooLekha Revenue Digitization API",
    description="Backend microservice for Indian land records restoration, Indic extraction, and arithmetic validation.",
    version="1.0.0",
)

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Telephony Helplines (Exotel / Twilio Webhooks)
app.include_router(telephony_router)

class PreprocessRequest(BaseModel):
    image_base64: str
    apply_deskew: bool = True
    apply_sauvola: bool = False
    apply_clahe: bool = True

class ExtractRequest(BaseModel):
    image_base64: str
    state: str = "Bihar"
    record_type: str = "Khasra-Khatauni"
    village: str = "Rajnagar East"
    tehsil: str = "Madhubani"

class MathVerifyRequest(BaseModel):
    total_stated_area_text: str
    sub_plots_area_texts: List[str]

class AssistantAskRequest(BaseModel):
    query: str
    record_context: Dict[str, Any]
    lang: str = "hi"

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "BhooLekha Studio API",
        "version": "1.0.0",
        "cv_engine": "OpenCV Headless v5.0",
        "indic_support": ["Hindi", "Marathi", "Bengali", "Gujarati", "Kannada"]
    }

@app.post("/api/preprocess")
async def preprocess_document(req: PreprocessRequest):
    """
    Applies OpenCV restoration filters (Deskewing, Sauvola Binarization, CLAHE contrast).
    """
    try:
        raw_b64 = req.image_base64.split(",")[-1] if "," in req.image_base64 else req.image_base64
        image_bytes = base64.b64decode(raw_b64)
        cv_img = bytes_to_cv2(image_bytes)

        detected_angle = estimate_skew_angle(cv_img)
        processed = cv_img

        if req.apply_deskew and abs(detected_angle) > 0.3:
            processed = deskew_image(processed, -detected_angle)

        if req.apply_clahe:
            processed = enhance_contrast_clahe(processed)

        if req.apply_sauvola:
            processed = sauvola_binarize(processed)

        result_b64 = cv2_to_base64(processed)

        return {
            "success": True,
            "detected_skew_angle": detected_angle,
            "processed_image_base64": result_b64,
            "applied_filters": {
                "deskew": req.apply_deskew,
                "clahe": req.apply_clahe,
                "sauvola": req.apply_sauvola
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")

@app.post("/api/extract")
async def extract_record(req: ExtractRequest):
    """
    Extracts structured entities, owners, sub-plots, and bounding boxes.
    """
    try:
        record_json = extract_land_record_from_image(
            image_base64=req.image_base64,
            state=req.state,
            record_type=req.record_type,
            village=req.village,
            tehsil=req.tehsil
        )
        return {"success": True, "record": record_json}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

@app.post("/api/verify-arithmetic")
async def verify_arithmetic(req: MathVerifyRequest):
    """
    Validates whether sub-plots add up to stated holding area.
    """
    total_conv = parse_regional_land_area(req.total_stated_area_text)
    subplots_conv = [parse_regional_land_area(t) for t in req.sub_plots_area_texts]
    subplots_sq_m = [c["sq_meters"] for c in subplots_conv]

    result = verify_parcel_arithmetic(total_conv["sq_meters"], subplots_sq_m)

    return {
        "success": True,
        "total_stated": total_conv,
        "subplots": subplots_conv,
        "validation": result
    }

@app.post("/api/assistant/ask")
async def assistant_ask(req: AssistantAskRequest):
    """
    Bhoo-Mitra AI Voice Assistant endpoint.
    Answers natural revenue questions using Gemini 3.8 Flash with deterministic fallback.
    """
    import requests
    import json
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and gemini_key != "your_key_here":
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={gemini_key}"
            prompt = f"""
            You are "भू-मित्र" (Bhoo-Mitra AI), an intelligent, respectful, and authoritative Indian Land Records Voice Assistant.
            
            Current Land Record Document Context (JSON):
            {json.dumps(req.record_context, ensure_ascii=False, indent=2)}

            Citizen's Query: "{req.query}"
            Assisted Language: "{req.lang}" ('hi' = Hindi, 'en' = Indian English)

            Instructions:
            1. If asked about owners (who owns the land), state the co-tenure holders, their father/guardian, and that all are legal co-sharers.
            2. If asked about individual share or "what amount of land is in his part", calculate the exact mathematical proportion in regional units (Biswa / Guntha) and metric (Hectares / m²).
            3. If asked about bank loans or mortgages, clearly explain any active encumbrances and mandatory NOC requirements. If clean, confirm zero encumbrance.
            4. If asked about selling or registry, explain category 1-Ka transferable freehold rights.
            5. Provide ONLY valid JSON with these exact keys:
               "spoken_text": A natural, conversational sentence WITHOUT brackets, slashes, or raw database codes, optimized for voice readout.
               "display_text": Formatted markdown text with bullet points and clear numbers.
               "suggested_follow_ups": Array of 2-3 short relevant follow-up questions.
            """
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            resp = requests.post(url, json=payload, timeout=3.5)
            if resp.status_code == 200:
                result = resp.json()
                raw_text = result["candidates"][0]["content"]["parts"][0]["text"]
                cleaned = raw_text.strip().replace("```json", "").replace("```", "").strip()
                parsed = json.loads(cleaned)
                return {
                    "success": True,
                    "engine": "gemini-3.8-flash",
                    "spoken_text": parsed.get("spoken_text"),
                    "display_text": parsed.get("display_text"),
                    "suggested_follow_ups": parsed.get("suggested_follow_ups", [])
                }
        except Exception as e:
            print(f"[Warning] Gemini Assistant call failed: {e}. Falling back to deterministic engine.")

    # High-precision deterministic revenue engine fallback
    from assistant_engine import calculate_python_assistant_answer
    return calculate_python_assistant_answer(req.query, req.record_context, req.lang)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
