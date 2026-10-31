"""
Officer-correction learning loop.

1. Every officer review of a machine-extracted field is logged (edit = the extractor was
   wrong, confirm = it was right) with the ORIGINAL extracted value.
2. Learned corrections: when officers have corrected the same misreading (same state, same
   field type, same extracted text -> same corrected text) at least MIN_SUPPORT times, later
   extractions apply it automatically. The field stays unverified, keeps the original reading
   in rawOcrValue, and is flagged so the officer can confirm or revert it. A revert counts
   against the rule.
3. Confidence calibration: field types that officers often correct get lower confidence, so
   they are routed for review first.
4. Prompt hints: recent corrections are passed to the Gemini prompt as known misreadings.
5. Accuracy over time: share of reviewed machine-extracted fields the officer did NOT change,
   in chronological windows.
"""
import datetime
import re
from collections import defaultdict
from typing import Any, Dict, Iterator, List, Optional, Tuple

from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import Session

from database import Base

MIN_SUPPORT = 2            # identical corrections needed before a rule is applied automatically
CALIBRATION_MIN_N = 5      # reviews of a field type needed before calibrating its confidence
PIPELINE_SOURCES = {"statutory_pdf_text", "gemini_vision", "tesseract"}


class ExtractionCorrection(Base):
    __tablename__ = "extraction_corrections"
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(String(32), nullable=False)
    parcel_id = Column(String(64), index=True, nullable=False)
    state = Column(String(64), index=True)
    extraction_source = Column(String(32))
    field_type = Column(String(64), index=True)        # e.g. owners.*.name
    field_path = Column(String(64))                     # e.g. owners.2.name
    kind = Column(String(16), nullable=False)           # edit | confirm | revert_learned
    extracted_value = Column(Text)
    corrected_value = Column(Text)
    officer = Column(String(128))


def field_type(path: str) -> str:
    return re.sub(r"\.\d+\.", ".*.", path)


def _norm(v: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (v or "").strip())


def iter_fields(rec: Dict[str, Any]) -> Iterator[Tuple[str, Dict[str, Any]]]:
    for k in ("khataNumber", "fasliYear", "totalStatedArea"):
        if isinstance(rec.get(k), dict):
            yield k, rec[k]
    for i, o in enumerate(rec.get("owners") or []):
        for k in ("name", "relativeName", "shareFraction"):
            if isinstance(o.get(k), dict):
                yield f"owners.{i}.{k}", o[k]
    for i, p in enumerate(rec.get("plots") or []):
        for k in ("khasraNumber", "regionalAreaText", "landClassification", "annualRevenueLagaan"):
            if isinstance(p.get(k), dict):
                yield f"plots.{i}.{k}", p[k]


# ---------------------------------------------------------------- logging reviews
def log_review(db: Session, parcel, path: str, kind: str, extracted: str, corrected: str, officer: str):
    """Called by update_parcel_field for machine-extracted records only (no commit here)."""
    if (parcel.extraction_source or "") not in PIPELINE_SOURCES:
        return
    db.add(ExtractionCorrection(
        created_at=datetime.datetime.now().isoformat(timespec="seconds"),
        parcel_id=parcel.id, state=parcel.state,
        extraction_source=parcel.extraction_source, field_type=field_type(path), field_path=path,
        kind=kind, extracted_value=_norm(extracted), corrected_value=_norm(corrected), officer=officer))


# ---------------------------------------------------------------- learned rules
def learned_rules(db: Session, state: Optional[str]) -> Dict[Tuple[str, str], Dict[str, Any]]:
    """{(field_type, extracted): {"to": corrected, "support": n}} with net support >= MIN_SUPPORT."""
    q = db.query(ExtractionCorrection).filter(ExtractionCorrection.kind.in_(("edit", "revert_learned")))
    if state:
        q = q.filter(ExtractionCorrection.state == state)
    counts: Dict[Tuple[str, str, str], int] = defaultdict(int)
    for c in q.all():
        if not c.extracted_value or c.extracted_value == c.corrected_value:
            continue
        if c.kind == "edit":
            counts[(c.field_type, c.extracted_value, c.corrected_value)] += 1
        else:  # officer reverted an auto-applied rule: extracted=rule output, corrected=original
            counts[(c.field_type, c.corrected_value, c.extracted_value)] -= 1
    best: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for (ft, frm, to), n in counts.items():
        if n >= MIN_SUPPORT and n > best.get((ft, frm), {}).get("support", 0):
            best[(ft, frm)] = {"to": to, "support": n}
    return best


def apply_learned_rules(rec: Dict[str, Any], db: Session) -> int:
    """Rewrite fields that match a learned misreading. Call BEFORE score_record."""
    rules = learned_rules(db, _state_of(rec))
    applied = 0
    for path, f in iter_fields(rec):
        v = _norm(f.get("value"))
        r = rules.get((field_type(path), v)) if v else None
        if not r:
            continue
        f["rawOcrValue"] = f.get("rawOcrValue") or f.get("value")
        f["value"] = r["to"]
        f["learnedCorrection"] = {"from": v, "to": r["to"], "support": r["support"]}
        applied += 1
        rec.setdefault("discrepancies", []).append({
            "id": f"learned-{path}", "fieldKey": f.get("key", path),
            "title": "Learned correction applied",
            "description": f"Read as “{v}”; officers corrected this exact reading to “{r['to']}” "
                           f"{r['support']} times before, so it was changed automatically.",
            "severity": "low", "status": "PENDING_REVIEW",
            "suggestedAction": "Confirm the value against the scan, or edit it back if the rule is wrong."})
    return applied


# ---------------------------------------------------------------- calibration
def error_rates(db: Session, state: Optional[str]) -> Dict[str, Tuple[float, int]]:
    q = db.query(ExtractionCorrection).filter(ExtractionCorrection.kind.in_(("edit", "confirm")))
    if state:
        q = q.filter(ExtractionCorrection.state == state)
    tot: Dict[str, List[int]] = defaultdict(lambda: [0, 0])
    for c in q.all():
        tot[c.field_type][0] += c.kind == "edit"
        tot[c.field_type][1] += 1
    return {ft: (e / n, n) for ft, (e, n) in tot.items() if n}


def calibrate(rec: Dict[str, Any], db: Session) -> None:
    """Lower confidence for field types officers frequently correct. Call AFTER score_record."""
    from validation_engine import tier_for, _count_tiers, _route
    rates = error_rates(db, _state_of(rec))
    deltas, n_fields = 0.0, 0
    for path, f in iter_fields(rec):
        n_fields += 1
        if f.get("learnedCorrection"):
            new = min(f.get("confidence", 0), 0.80)   # auto-applied: always needs a look
            reason = f"auto-corrected from {f['learnedCorrection']['support']} past officer corrections"
        else:
            rate, n = rates.get(field_type(path), (0.0, 0))
            if n < CALIBRATION_MIN_N or rate < 0.10 or not f.get("value"):
                continue
            new = round(f.get("confidence", 0) * (1 - 0.6 * rate), 3)
            reason = f"officers corrected this field type in {rate:.0%} of {n} reviews"
        deltas += f.get("confidence", 0) - new
        f["confidence"] = new
        f["confidenceTier"] = tier_for(new)
        f.setdefault("confidenceReasons", []).append(reason)
        if f["confidenceTier"] != "high":
            f["discrepancyNote"] = "Low confidence: " + "; ".join(f["confidenceReasons"])
    if deltas and n_fields:
        rec["overallConfidence"] = round(max(0.0, rec.get("overallConfidence", 0) - deltas / n_fields), 3)
    rec["confidenceSummary"] = _count_tiers(rec)
    _route(rec)


# ---------------------------------------------------------------- prompt hints
def prompt_hints(db: Session, state: Optional[str], limit: int = 15) -> str:
    rules = learned_rules(db, state)
    q = db.query(ExtractionCorrection).filter(ExtractionCorrection.kind == "edit")
    if state:
        q = q.filter(ExtractionCorrection.state == state)
    recent = q.order_by(ExtractionCorrection.id.desc()).limit(limit).all()
    lines, seen = [], set()
    for (ft, frm), r in rules.items():
        lines.append(f'- {ft}: "{frm}" is usually "{r["to"]}" (confirmed {r["support"]}x)')
        seen.add((ft, frm))
    for c in recent:
        if (c.field_type, c.extracted_value) in seen or not c.extracted_value:
            continue
        seen.add((c.field_type, c.extracted_value))
        lines.append(f'- {c.field_type}: previously misread "{c.extracted_value}" -> correct was "{c.corrected_value}"')
    if not lines:
        return ""
    return ("\n    Known misreadings from officer corrections on earlier documents of this state "
            "(use only if the page really shows that text; never copy these values otherwise):\n    "
            + "\n    ".join(lines[:limit]) + "\n")


# ---------------------------------------------------------------- dashboard
def learning_stats(db: Session) -> Dict[str, Any]:
    rows = (db.query(ExtractionCorrection).filter(ExtractionCorrection.kind.in_(("edit", "confirm")))
            .order_by(ExtractionCorrection.id.asc()).all())
    n = len(rows)
    series = []
    if n:
        size = max(5, -(-n // 8))   # at most ~8 points, at least 5 reviews per point
        for i in range(0, n, size):
            chunk = rows[i:i + size]
            ok = sum(1 for c in chunk if c.kind == "confirm")
            series.append({"label": f"{i + 1}–{i + len(chunk)}", "reviews": len(chunk),
                           "accuracy": round(ok / len(chunk), 3),
                           "until": chunk[-1].created_at})
    rules = learned_rules(db, None)
    return {
        "reviewsLogged": n,
        "corrections": sum(1 for c in rows if c.kind == "edit"),
        "accuracySeries": series,
        "learnedRules": [{"fieldType": ft, "from": frm, "to": r["to"], "support": r["support"]}
                         for (ft, frm), r in sorted(rules.items(), key=lambda x: -x[1]["support"])][:20],
        "minSupport": MIN_SUPPORT,
    }


def _state_of(rec: Dict[str, Any]) -> Optional[str]:
    return rec.get("state") or rec.get("stateName") or None
