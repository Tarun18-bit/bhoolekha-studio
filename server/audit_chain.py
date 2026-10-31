"""
Tamper-evident audit trail: every entry's hash covers its own content AND the previous
entry's hash (one global chain, ordered by `seq`). Editing or deleting any past entry
breaks every hash after it, which verify_chain() detects.

The hook runs on every flush, so all existing code paths that db.add(AuditLogEntry(...))
are chained automatically; the hash they pass in is replaced. The officer on the entry
is taken from the logged-in user (auth.current_officer) when there is one.
"""
import hashlib
import json
from typing import Dict, Any

from sqlalchemy import event, text
from sqlalchemy.orm import Session

from models import AuditLogEntry

GENESIS = "0" * 64


def entry_hash(e: AuditLogEntry, prev_hash: str) -> str:
    body = json.dumps({
        "seq": e.seq, "prev": prev_hash, "id": e.id, "parcel": e.parcel_id, "ts": e.timestamp,
        "officerId": e.officer_id, "officer": e.officer_name, "designation": e.officer_designation,
        "action": e.action, "field": e.field_label, "old": e.old_value, "new": e.new_value,
    }, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _tail(session: Session):
    with session.no_autoflush:
        row = (session.query(AuditLogEntry.seq, AuditLogEntry.sha256_hash)
               .filter(AuditLogEntry.seq.isnot(None))
               .order_by(AuditLogEntry.seq.desc()).first())
    return (row[0], row[1]) if row else (0, GENESIS)


@event.listens_for(Session, "before_flush")
def _chain_new_entries(session: Session, flush_context, instances):
    new = [o for o in session.new if isinstance(o, AuditLogEntry)]
    if not new:
        return
    try:
        from auth import current_officer
        who = current_officer.get()
    except Exception:
        who = None
    seq, prev = _tail(session)
    for e in sorted(new, key=lambda x: (x.timestamp or "", x.id or "")):
        _apply_column_defaults(e)
        if who:
            e.officer_id, e.officer_name, e.officer_designation = who["id"], who["name"], who["designation"]
        seq += 1
        e.seq = seq
        e.prev_hash = prev
        e.sha256_hash = entry_hash(e, prev)
        prev = e.sha256_hash


def _apply_column_defaults(e: AuditLogEntry):
    """Column defaults are normally applied at INSERT time, i.e. AFTER we hash. Apply them
    now so the hash covers exactly the values that get stored."""
    for col in AuditLogEntry.__table__.columns:
        if getattr(e, col.key, None) is None and col.default is not None and getattr(col.default, "is_scalar", False):
            setattr(e, col.key, col.default.arg)


def backfill_chain(session: Session) -> int:
    """One-time: chain entries written before chaining existed (insertion order = rowid)."""
    if not session.query(AuditLogEntry).filter(AuditLogEntry.seq.is_(None)).first():
        return 0
    rows = session.query(AuditLogEntry).order_by(text("audit_trail.rowid")).all()
    prev = GENESIS
    for i, e in enumerate(rows, start=1):
        e.seq = i
        e.prev_hash = prev
        e.sha256_hash = entry_hash(e, prev)
        prev = e.sha256_hash
    session.commit()
    return len(rows)


def verify_chain(session: Session) -> Dict[str, Any]:
    rows = session.query(AuditLogEntry).order_by(AuditLogEntry.seq.asc()).all()
    prev = GENESIS
    for i, e in enumerate(rows, start=1):
        if e.seq != i:
            return {"intact": False, "entries": len(rows), "brokenAt": e.id, "reason": f"sequence gap at #{i} (entry deleted?)"}
        if e.prev_hash != prev:
            return {"intact": False, "entries": len(rows), "brokenAt": e.id, "reason": "previous-hash link does not match"}
        if entry_hash(e, prev) != e.sha256_hash:
            return {"intact": False, "entries": len(rows), "brokenAt": e.id, "reason": "entry content was altered"}
        prev = e.sha256_hash
    return {"intact": True, "entries": len(rows), "headHash": prev}
