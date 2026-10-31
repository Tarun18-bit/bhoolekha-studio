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

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import base64
import datetime
import cv2
from sqlalchemy.orm import Session

from database import get_db, DB_DIR
from db_service import (
    init_db,
    save_extracted_record,
    get_all_parcels,
    get_parcel_by_id,
    update_parcel_field,
    approve_parcel_record,
    resolve_parcel_discrepancy,
    get_lrms_rows,
    get_existing_index,
    add_owner_to_parcel,
    add_plot_to_parcel,
)
from validation_engine import score_record, cross_verify, file_sha256
from dashboard import compute_dashboard
from auth import require, authenticate, issue_token, AppUser
from audit_chain import verify_chain
import learning
import govt_registry
import consistency
from citizen import router as citizen_router
import extractor as extractor_module
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
app.include_router(citizen_router)   # public, no login, nothing stored

@app.on_event("startup")
def on_startup():
    """Initializes tables and seeds canonical Digital India records into SQLite."""
    print("[FastAPI Startup] Initializing Bhoomi SQLite database...")
    init_db()

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Telephony Helplines (Exotel / Twilio Webhooks)

# Physical Scan Uploads Directory on Disk
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Also mirror to Vite public directory for instant frontend static asset serving
PUBLIC_UPLOADS_DIR = Path(__file__).parent.parent / "public" / "uploads"
PUBLIC_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

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
async def preprocess_document(req: PreprocessRequest, user: AppUser = Depends(require("ingest"))):
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
async def extract_record(req: ExtractRequest, db: Session = Depends(get_db), user: AppUser = Depends(require("ingest"))):
    """
    Extracts structured entities, owners, sub-plots, and bounding boxes.
    Persists uploaded scan as physical file on disk (server/uploads/) and 
    commits all structured tables into SQLite Digital India database (server/bhoolekha.db).
    """
    try:
        extractor_module.learned_hints.set(learning.prompt_hints(db, req.state))
        record_json = extract_land_record_from_image(
            image_base64=req.image_base64,
            state=req.state,
            record_type=req.record_type,
            village=req.village,
            tehsil=req.tehsil
        )
        
        # 1. Physical Raw File Storage on Local Disk
        raw_b64 = req.image_base64.split(",")[-1] if "," in req.image_base64 else req.image_base64
        file_ext = ".jpg"
        try:
            raw_bytes = base64.b64decode(raw_b64)
            is_pdf = raw_bytes.startswith(b'%PDF') or b'%PDF-' in raw_bytes[:32]
            if is_pdf:
                file_ext = ".pdf"
            elif raw_bytes.startswith(b'\x89PNG'):
                file_ext = ".png"
            elif raw_bytes.startswith(b'<svg') or b'<svg' in raw_bytes[:100]:
                file_ext = ".svg"
            
            ulpin_val = record_json.get("ulpin") or f"ULPIN{int(datetime.datetime.now().timestamp())}"
            timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"scan_{ulpin_val}_{timestamp_str}{file_ext}"
            file_disk_path = UPLOADS_DIR / filename
            with open(file_disk_path, "wb") as f:
                f.write(raw_bytes)
            # Mirror to public uploads for Vite
            with open(PUBLIC_UPLOADS_DIR / filename, "wb") as f_pub:
                f_pub.write(raw_bytes)
            print(f"[Physical Storage] File successfully written to disk: {file_disk_path.resolve()} ({len(raw_bytes):,} bytes)")
            
            # If uploaded file is a PDF, render its pages to high-res JPEG so browser <img> displays it cleanly
            if is_pdf:
                try:
                    cv_img = bytes_to_cv2(raw_bytes)
                    img_filename = f"scan_{ulpin_val}_{timestamp_str}_rendered.jpg"
                    img_disk_path = UPLOADS_DIR / img_filename
                    _, img_buf = cv2.imencode(".jpg", cv_img, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
                    img_bytes = img_buf.tobytes()
                    with open(img_disk_path, "wb") as f_img:
                        f_img.write(img_bytes)
                    # Mirror rendered scan to public uploads for Vite
                    with open(PUBLIC_UPLOADS_DIR / img_filename, "wb") as f_pub_img:
                        f_pub_img.write(img_bytes)
                    record_json["originalDocumentUrl"] = f"/uploads/{img_filename}"
                    print(f"[PDF Render] Rendered PDF scan to JPEG: {img_disk_path.resolve()}")
                except Exception as render_err:
                    print(f"[PDF Render Warning] Failed to render PDF to image: {render_err}")
                    record_json["originalDocumentUrl"] = f"/uploads/{filename}"
            elif len(raw_bytes) > 200:
                record_json["originalDocumentUrl"] = f"/uploads/{filename}"
            elif not record_json.get("originalDocumentUrl"):
                record_json["originalDocumentUrl"] = ""  # never show another document's scan
        except Exception as disk_err:
            print(f"[Storage Warning] Could not write physical file: {disk_err}")
            if not record_json.get("originalDocumentUrl"):
                record_json["originalDocumentUrl"] = ""  # never show another document's scan

        # 2. Validation pipeline: computed confidence -> duplicate & LRMS cross-check
        try:
            sha = file_sha256(req.image_base64)
        except Exception:
            sha = None
        learned = learning.apply_learned_rules(record_json, db)   # fix known misreadings
        score_record(record_json)
        learning.calibrate(record_json, db)                       # lower trust in often-corrected fields
        if learned:
            print(f"[Learning] Applied {learned} learned correction(s)")
        cross_verify(record_json, get_lrms_rows(db), get_existing_index(db), sha)

        # 3. Persist as a NEW record (never overwrites)
        saved_parcel = save_extracted_record(record_json, db, file_sha=sha)
        return {"success": True, "record": saved_parcel.to_dict()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

@app.get("/api/storage-info")
async def get_storage_info(db: Session = Depends(get_db), user: AppUser = Depends(require("read"))):
    """
    Returns transparency report on where citizen records and physical files are stored on disk.
    """
    db_file = DB_DIR / "bhoolekha.db"
    db_size = db_file.stat().st_size if db_file.exists() else 0
    parcels = get_all_parcels(db)
    
    physical_files = []
    if UPLOADS_DIR.exists():
        for f in UPLOADS_DIR.iterdir():
            if f.is_file():
                physical_files.append({
                    "filename": f.name,
                    "size_bytes": f.stat().st_size,
                    "size_kb": round(f.stat().st_size / 1024, 2),
                    "path": str(f.resolve()),
                    "url": f"/uploads/{f.name}"
                })

    return {
        "status": "active",
        "database_file": {
            "path": str(db_file.resolve()),
            "size_bytes": db_size,
            "size_kb": round(db_size / 1024, 2),
            "format": "SQLite 3 with Write-Ahead Logging (WAL)",
            "total_parcels": len(parcels),
        },
        "physical_uploads_dir": {
            "path": str(UPLOADS_DIR.resolve()),
            "total_files": len(physical_files),
            "files": physical_files
        }
    }

@app.get("/api/parcels")
async def list_parcels(db: Session = Depends(get_db), user: AppUser = Depends(require("read"))):
    """Lists all digitized land parcels from the SQLite database."""
    try:
        parcels = get_all_parcels(db)
        return {"success": True, "parcels": parcels, "count": len(parcels)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch parcels: {str(e)}")

@app.get("/api/parcels/{parcel_id}")
async def get_parcel(parcel_id: str, db: Session = Depends(get_db), user: AppUser = Depends(require("read"))):
    """Retrieves a specific digitized land parcel by its ID or ULPIN."""
    parcel = get_parcel_by_id(parcel_id, db)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel record not found")
    return {"success": True, "record": parcel}

class UpdateFieldRequest(BaseModel):
    field_key: str
    new_value: str = ""
    mode: str = "edit"   # "edit" = corrected value, "confirm" = officer confirms the value as read

@app.put("/api/parcels/{parcel_id}/fields")
async def update_field(parcel_id: str, req: UpdateFieldRequest, db: Session = Depends(get_db),
                       user: AppUser = Depends(require("edit"))):
    """Edit or confirm one field; writes a chained audit entry under the logged-in officer."""
    updated = update_parcel_field(parcel_id, req.field_key, req.new_value, user.display_name, db,
                                  mode="confirm" if req.mode == "confirm" else "edit")
    if not updated:
        raise HTTPException(status_code=404, detail="Parcel or field not found")
    return {"success": True, "record": updated}

class ApproveRecordRequest(BaseModel):
    note: Optional[str] = None

@app.post("/api/parcels/{parcel_id}/approve")
async def approve_record(parcel_id: str, req: ApproveRecordRequest, db: Session = Depends(get_db),
                         user: AppUser = Depends(require("approve"))):
    """Verifier/admin seals the record. The officer is the logged-in user."""
    sealed = approve_parcel_record(parcel_id, user.display_name, user.designation, db)
    if not sealed:
        raise HTTPException(status_code=404, detail="Parcel record not found")
    return {"success": True, "record": sealed}

class ResolveDiscrepancyRequest(BaseModel):
    justification: str

@app.post("/api/parcels/{parcel_id}/discrepancies/{disc_id}/resolve")
async def resolve_discrepancy(parcel_id: str, disc_id: str, req: ResolveDiscrepancyRequest,
                              db: Session = Depends(get_db), user: AppUser = Depends(require("resolve"))):
    """Verifier/admin resolves a discrepancy with a written justification."""
    if not (req.justification or "").strip():
        raise HTTPException(status_code=400, detail="A justification is required.")
    resolved = resolve_parcel_discrepancy(parcel_id, disc_id, req.justification.strip(), user.display_name, db)
    if not resolved:
        raise HTTPException(status_code=404, detail="Parcel or Discrepancy entry not found")
    return {"success": True, "record": resolved}

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    u = authenticate(db, req.username, req.password)
    if not u:
        raise HTTPException(status_code=401, detail="Wrong username or password.")
    return {"success": True, "token": issue_token(u.username), "user": u.public()}

@app.get("/api/auth/me")
async def me(user: AppUser = Depends(require("read"))):
    return {"success": True, "user": user.public()}

@app.get("/api/audit/verify")
async def audit_verify(db: Session = Depends(get_db), user: AppUser = Depends(require("read"))):
    """Recompute the whole audit hash chain and report whether any entry was altered or removed."""
    return {"success": True, **verify_chain(db)}

def _record_or_404(parcel_id: str, db: Session) -> Dict[str, Any]:
    rec = get_parcel_by_id(parcel_id, db)
    if not rec:
        raise HTTPException(status_code=404, detail="Parcel record not found")
    return rec

@app.get("/api/parcels/{parcel_id}/govt-compare")
async def govt_compare(parcel_id: str, db: Session = Depends(get_db), user: AppUser = Depends(require("read"))):
    """Field-by-field comparison of this record with the (simulated) government record."""
    return {"success": True, **govt_registry.compare(_record_or_404(parcel_id, db))}

@app.get("/api/parcels/{parcel_id}/history")
async def record_history(parcel_id: str, db: Session = Depends(get_db), user: AppUser = Depends(require("read"))):
    """Versions of this khata across fasli years, with mutation-consistency flags."""
    return {"success": True, **govt_registry.history(_record_or_404(parcel_id, db))}

@app.get("/api/parcels/{parcel_id}/consistency")
async def record_consistency(parcel_id: str, db: Session = Depends(get_db), user: AppUser = Depends(require("read"))):
    """Run the automated consistency rules on one record."""
    return {"success": True, **consistency.check(_record_or_404(parcel_id, db))}

@app.get("/api/consistency/summary")
async def consistency_summary(db: Session = Depends(get_db), user: AppUser = Depends(require("read"))):
    """Run every consistency rule over every record in the repository."""
    return {"success": True, **consistency.summarize(get_all_parcels(db))}

@app.get("/api/parcels/{parcel_id}/gis")
async def record_gis(parcel_id: str, db: Session = Depends(get_db), user: AppUser = Depends(require("read"))):
    """Village plots as GeoJSON, coloured by digitization status, with this record's plots highlighted."""
    from validation_engine import norm_khasra
    rec = _record_or_404(parcel_id, db)
    v = govt_registry.village_for(rec)
    if not v or not v.get("parcels"):
        return {"success": True, "found": False, "message": "No map data for this village in the govt dataset."}
    status: Dict[str, str] = {}
    rank = {"mismatch": 4, "in_review": 3, "approved": 2, "not_digitized": 1}
    for p in get_all_parcels(db):
        if not govt_registry.village_matches(v, p.get("village", "")):
            continue
        st = "approved" if p.get("verificationStatus") == "OFFICER_APPROVED" else "in_review"
        cmp = govt_registry.compare(p)
        if cmp.get("found") and cmp["summary"]["mismatch"] + cmp["summary"]["missing_in_govt"] > 0:
            st = "mismatch"
        for pl in p.get("plots") or []:
            k = norm_khasra((pl.get("khasraNumber") or {}).get("value", ""))
            if k and rank[st] > rank.get(status.get(k, "not_digitized"), 0):
                status[k] = st
    hl = [(pl.get("khasraNumber") or {}).get("value", "") for pl in rec.get("plots") or []]
    return {"success": True, "found": True, **govt_registry.village_geojson(v, status, hl)}

@app.get("/api/gis/plot")
async def gis_plot(village_id: str, khasra: str, db: Session = Depends(get_db), user: AppUser = Depends(require("read"))):
    """Khatauni-style details of one plot (govt dataset) + its digitization status in this system."""
    from validation_engine import norm_khasra
    d = govt_registry.plot_details(village_id, khasra)
    if not d:
        raise HTTPException(status_code=404, detail="Plot not found in the govt dataset")
    v = next(x for x in govt_registry.villages() if x["id"] == village_id)
    digitized = []
    for p in get_all_parcels(db):
        if not govt_registry.village_matches(v, p.get("village", "")):
            continue
        if not any(norm_khasra((pl.get("khasraNumber") or {}).get("value", "")) == norm_khasra(khasra) for pl in p.get("plots") or []):
            continue
        cmp = govt_registry.compare(p)
        digitized.append({"id": p["id"], "status": p.get("verificationStatus"), "confidence": p.get("overallConfidence"),
                          "openDiscrepancies": sum(1 for x in p.get("discrepancies") or [] if x.get("status") != "RESOLVED"),
                          "compare": cmp.get("summary") if cmp.get("found") else None})
    return {"success": True, **d, "digitized": digitized}

@app.get("/api/lrms")
async def list_lrms(db: Session = Depends(get_db), user: AppUser = Depends(require("read"))):
    """Mock LRMS master records used for cross-verification (sandbox)."""
    rows = get_lrms_rows(db)
    return {"success": True, "source": "MOCK_LRMS_SANDBOX", "count": len(rows), "records": rows}

@app.get("/api/dashboard")
async def dashboard(db: Session = Depends(get_db), user: AppUser = Depends(require("read"))):
    """Operations dashboard: documents processed, accuracy, validation status, pending, errors, progress."""
    return {"success": True, **compute_dashboard(db), "auditChain": verify_chain(db),
            "learning": learning.learning_stats(db)}

class AddOwnerRequest(BaseModel):
    name: str
    relative_name: str = ""
    relation_type: str = "s/o"
    share_fraction: str = ""

class AddPlotRequest(BaseModel):
    khasra_number: str
    area_text: str
    classification: str = ""
    tax: str = ""

@app.post("/api/parcels/{parcel_id}/owners")
async def add_owner(parcel_id: str, req: AddOwnerRequest, db: Session = Depends(get_db),
                    user: AppUser = Depends(require("edit"))):
    """Officer manually adds a tenure holder the extractor missed (or on a manual-entry record)."""
    rec = add_owner_to_parcel(parcel_id, {**req.model_dump(), "officer_name": user.display_name}, db)
    if not rec:
        raise HTTPException(status_code=404, detail="Parcel record not found")
    return {"success": True, "record": rec}

@app.post("/api/parcels/{parcel_id}/plots")
async def add_plot(parcel_id: str, req: AddPlotRequest, db: Session = Depends(get_db),
                   user: AppUser = Depends(require("edit"))):
    """Officer manually adds a khasra plot the extractor missed."""
    rec = add_plot_to_parcel(parcel_id, {**req.model_dump(), "officer_name": user.display_name}, db)
    if not rec:
        raise HTTPException(status_code=404, detail="Parcel record not found")
    return {"success": True, "record": rec}

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
