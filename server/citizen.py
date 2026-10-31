"""
Public citizen explainer: a landholder uploads their own Bhulekh PDF (or a photo) and gets
the same record view the officers see, explained in plain language.

Privacy by design:
  * no login, and NOTHING is stored: the record is built in a throwaway in-memory SQLite
    database that is discarded at the end of the request; no file is written to disk;
  * it never reads or writes the official database or the learning log;
  * the response says plainly that this is an unverified machine reading, not a legal opinion.
"""
import base64
import time
from collections import deque
from typing import Optional

import cv2
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from cv_processor import bytes_to_cv2
from extractor import extract_land_record_from_image, learned_hints
from validation_engine import score_record

router = APIRouter(prefix="/api/citizen", tags=["Citizen"])

MAX_BYTES = 10 * 1024 * 1024
_recent = deque(maxlen=200)          # crude rate limit: 20 requests / minute / client IP


class ExplainRequest(BaseModel):
    file_base64: str
    state: str = "Uttar Pradesh"


def _rate_limit(ip: str):
    now = time.time()
    hits = sum(1 for t, i in _recent if i == ip and now - t < 60)
    if hits >= 20:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a minute.")
    _recent.append((now, ip))


@router.post("/explain")
async def explain(req: ExplainRequest, request: Request):
    _rate_limit(request.client.host if request.client else "?")
    raw_b64 = req.file_base64.split(",")[-1]
    try:
        raw = base64.b64decode(raw_b64, validate=False)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read the file.")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 10 MB.")
    is_pdf = raw.startswith(b"%PDF") or b"%PDF-" in raw[:32]
    if not (is_pdf or raw.startswith(b"\x89PNG") or raw.startswith(b"\xff\xd8")):
        raise HTTPException(status_code=415, detail="Please upload a PDF, JPG or PNG.")

    learned_hints.set("")   # citizen uploads never use or feed the officers' learning data
    rec = extract_land_record_from_image(image_base64=raw_b64, state=req.state,
                                         record_type="Khasra-Khatauni", village="", tehsil="")
    score_record(rec)

    # Preview image as a data URL (nothing written to disk)
    preview: Optional[str] = None
    try:
        img = bytes_to_cv2(raw)
        h, w = img.shape[:2]
        if max(h, w) > 1600:
            s = 1600.0 / max(h, w)
            img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
        ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if ok:
            preview = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()
    except Exception:
        pass
    rec["originalDocumentUrl"] = preview or ""

    # Build the exact record shape the UI uses, in a throwaway in-memory database.
    from db_service import save_extracted_record
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    try:
        out = save_extracted_record(rec, db).to_dict()
    finally:
        db.close()
        engine.dispose()

    out["originalDocumentUrl"] = preview or ""
    # Plain-language problems in the record (orders not applied, shares, deceased holders, mortgage)
    full_text = ""
    if is_pdf:
        try:
            import pypdfium2 as pdfium
            full_text = "\n".join(p.get_textpage().get_text_range() for p in pdfium.PdfDocument(raw))
        except Exception:
            full_text = ""
    try:
        from citizen_checks import findings
        out["citizenFindings"] = findings(out, full_text)
    except Exception as e:
        print(f"[Citizen] findings failed: {e}")
        out["citizenFindings"] = []
    out["auditTrail"] = []
    out["citizenView"] = True
    out["notice"] = ("Machine reading of your document, not verified by any officer and not a legal "
                     "opinion. Nothing you upload is stored.")
    return {"success": True, "record": out}
