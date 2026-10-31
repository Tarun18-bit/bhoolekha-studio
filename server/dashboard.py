"""Operations dashboard metrics computed live from the database."""
import re
from collections import Counter, defaultdict
from typing import Any, Dict

from sqlalchemy.orm import Session
from models import ParcelRecord, AuditLogEntry, DiscrepancyEntry


def _district_key(d: str) -> str:
    d = re.split(r"\s+(तहसील|tehsil)", d or "", flags=re.I)[0].strip()
    return d or "Unknown"


def _fields_in(p: ParcelRecord) -> int:
    return 3 + 3 * len(p.owners) + 4 * len(p.plots)


def compute_dashboard(db: Session) -> Dict[str, Any]:
    parcels = db.query(ParcelRecord).all()
    total = len(parcels)
    status = Counter(p.verification_status or "IN_REVIEW" for p in parcels)
    approved = status.get("OFFICER_APPROVED", 0)

    uploaded = [p for p in parcels if p.extraction_source]
    avg_conf = round(sum(p.overall_confidence or 0 for p in uploaded) / len(uploaded), 3) if uploaded else None

    # Extraction accuracy proxy: of the fields the pipeline extracted on officer-APPROVED uploads,
    # how many did the officer have to change? (No ground truth exists, so this is stated as a proxy.)
    reviewed = [p for p in uploaded if p.verification_status == "OFFICER_APPROVED"]
    edits = 0
    if reviewed:
        ids = [p.id for p in reviewed]
        edits = db.query(AuditLogEntry).filter(AuditLogEntry.parcel_id.in_(ids),
                                               AuditLogEntry.action == "FIELD_EDITED").count()
    fields_reviewed = sum(_fields_in(p) for p in reviewed)
    accuracy = round(max(0.0, 1 - edits / fields_reviewed), 3) if fields_reviewed else None

    discs = db.query(DiscrepancyEntry).all()
    open_d = [d for d in discs if d.status != "RESOLVED"]
    by_title = Counter(re.sub(r"^[^\wऀ-ॿఀ-౿]+", "", d.title) for d in open_d)
    by_sev = Counter(d.severity for d in open_d)

    pending = sorted((p for p in parcels if p.verification_status != "OFFICER_APPROVED"),
                     key=lambda p: p.overall_confidence or 0)
    pending_list = [{"id": p.id, "village": p.village, "khata": p.khata_number,
                     "confidence": p.overall_confidence, "source": p.extraction_source or "seed",
                     "openFlags": sum(1 for d in p.discrepancies if d.status != "RESOLVED")}
                    for p in pending[:8]]

    progress: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0, "approved": 0, "districts": defaultdict(lambda: {"total": 0, "approved": 0})})
    for p in parcels:
        s = progress[p.state or "Unknown"]
        d = s["districts"][_district_key(p.district)]
        for tgt in (s, d):
            tgt["total"] += 1
            tgt["approved"] += 1 if p.verification_status == "OFFICER_APPROVED" else 0
    prog_out = [{"state": st, "total": v["total"], "approved": v["approved"],
                 "districts": [{"district": dn, **dv} for dn, dv in sorted(v["districts"].items())]}
                for st, v in sorted(progress.items())]

    sources = Counter(p.extraction_source or "seed" for p in parcels)
    return {
        "documentsProcessed": total,
        "uploadedByPipeline": len(uploaded),
        "avgConfidence": avg_conf,
        "extractionAccuracy": accuracy,
        "accuracyBasis": {"approvedUploads": len(reviewed), "fieldsReviewed": fields_reviewed,
                          "officerCorrections": edits},
        "validationStatus": {"approved": approved, "inReview": status.get("IN_REVIEW", 0),
                             "draft": status.get("DRAFT_AI_EXTRACTION", 0),
                             "flagged": sum(1 for p in parcels if p.has_discrepancy and p.verification_status != "OFFICER_APPROVED")},
        "pendingVerification": len(pending),
        "pendingList": pending_list,
        "errorStats": {"open": len(open_d), "bySeverity": dict(by_sev),
                       "byType": [{"type": t, "count": c} for t, c in by_title.most_common(8)]},
        "progress": prog_out,
        "extractionSources": dict(sources),
    }
