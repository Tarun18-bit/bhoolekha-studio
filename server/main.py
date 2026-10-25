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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
