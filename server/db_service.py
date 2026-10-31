import re
import json
import datetime
import hashlib
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from pathlib import Path
from sqlalchemy import inspect, text
from models import ParcelRecord, TenureHolder, KhasraPlot, DiscrepancyEntry, AuditLogEntry, LrmsMasterRecord

def generate_ulpin(state_code: str, district: str, gata: str, khata: str) -> str:
    """Internal record reference (stored in the `ulpin` column). Real ULPINs are issued by
    the state, so we never generate one: refs are prefixed REF- to make that obvious."""
    clean_state = "".join([c for c in (state_code or "UP").upper() if c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"])[:2] or "UP"
    ascii_dist = "".join([c for c in (district or "").upper() if c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"])
    if len(ascii_dist) < 3:
        if "गोरखपुर" in (district or "") or "Gorakhpur" in (district or ""):
            ascii_dist = "GOR"
        elif "बलिया" in (district or "") or "Ballia" in (district or ""):
            ascii_dist = "BAL"
        elif "वाराणसी" in (district or "") or "Varanasi" in (district or ""):
            ascii_dist = "VAR"
        elif "पुणे" in (district or "") or "Pune" in (district or ""):
            ascii_dist = "PUN"
        else:
            ascii_dist = (ascii_dist + "DIS")[:3]
    dist_prefix = ascii_dist[:3]

    clean_gata = "".join(filter(str.isdigit, str(gata or "000")))[:4].zfill(4)
    clean_khata = "".join(filter(str.isdigit, str(khata or "000")))[:5].zfill(5)
    return f"REF-{clean_state}{dist_prefix}-{clean_khata}"

def compute_sha256(text: str) -> str:
    """Computes SHA-256 tamper-evident hash for audit log integrity."""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def _migrate_columns():
    """Add columns introduced after the first release to an existing SQLite DB."""
    insp = inspect(engine)
    if "parcels" not in insp.get_table_names():
        return
    have = {c["name"] for c in insp.get_columns("parcels")}
    wanted = {"file_sha256": "VARCHAR(64)", "extraction_source": "VARCHAR(32)", "field_meta_json": "TEXT"}
    with engine.begin() as conn:
        for col, typ in wanted.items():
            if col not in have:
                conn.execute(text(f"ALTER TABLE parcels ADD COLUMN {col} {typ}"))
                print(f"[Database] Migrated: added parcels.{col}")
    if "audit_trail" in insp.get_table_names():
        have_a = {c["name"] for c in insp.get_columns("audit_trail")}
        with engine.begin() as conn:
            for col, typ in {"seq": "INTEGER", "prev_hash": "VARCHAR(64)"}.items():
                if col not in have_a:
                    conn.execute(text(f"ALTER TABLE audit_trail ADD COLUMN {col} {typ}"))
                    print(f"[Database] Migrated: added audit_trail.{col}")


def seed_lrms_master(db: Session):
    """Mirror the current versions of the simulated govt dataset into lrms_master (used by cross_verify)."""
    import govt_registry
    db.query(LrmsMasterRecord).delete()
    for r in govt_registry.lrms_rows():
        db.add(LrmsMasterRecord(
            id=r["id"], state=r["state"], district=r["district"], tehsil=r.get("tehsil"),
            village=r["village"], khata=r["khata"],
            khasras_json=json.dumps(r.get("khasras", []), ensure_ascii=False),
            owners_json=json.dumps(r.get("owners", []), ensure_ascii=False),
            total_sq_m=r.get("total_sq_m")))
    db.commit()
    print(f"[Database] Simulated govt LRMS: {db.query(LrmsMasterRecord).count()} khata records")


def init_db():
    """Initializes tables, migrates columns, seeds records and the mock LRMS master."""
    import auth          # noqa: F401  registers app_users table
    import audit_chain   # noqa: F401  registers the hash-chain flush hook
    import learning      # noqa: F401  registers extraction_corrections table
    _migrate_columns()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        count = db.query(ParcelRecord).count()
        if count == 0:
            print("[Database] Empty database detected. Seeding Digital India land records...")
            seed_initial_parcels(db)
        seed_lrms_master(db)
        rescore_unscored_parcels(db)
        auth.seed_users(db)
        n = audit_chain.backfill_chain(db)
        if n:
            print(f"[Database] Linked {n} existing audit entries into a hash chain.")
    finally:
        db.close()


def rescore_unscored_parcels(db: Session):
    """Seeded records carried hand-typed confidence numbers (0.94/0.98). Recompute them with the
    same score_record() used for uploads so every number on screen comes from one rule."""
    from validation_engine import score_record
    n = 0
    for p in db.query(ParcelRecord).filter(ParcelRecord.field_meta_json.is_(None)).all():
        doc = p.to_dict()
        doc["extractionSource"] = p.extraction_source or "statutory_pdf_text"
        doc.pop("discrepancies", None)          # scoring must not add stored discrepancies
        scored = score_record(doc)
        p.extraction_source = doc["extractionSource"]
        p.overall_confidence = float(scored.get("overallConfidence", 0.0))
        p.field_meta_json = json.dumps(build_field_meta(scored), ensure_ascii=False)
        n += 1
    if n:
        db.commit()
        print(f"[Database] Re-scored {n} seeded record(s) with the computed confidence model.")


def get_lrms_rows(db: Session) -> List[Dict[str, Any]]:
    return [r.to_dict() for r in db.query(LrmsMasterRecord).all()]


def get_existing_index(db: Session) -> List[Dict[str, Any]]:
    """Compact view of already-digitized parcels for duplicate / conflict checks."""
    from validation_engine import norm_khasra
    out = []
    for p in db.query(ParcelRecord).all():
        out.append({
            "id": p.id, "village": p.village, "khata": p.khata_number,
            "khasras": [norm_khasra(k.gata_number) for k in p.plots],
            "owners": [o.name for o in p.owners],
            "file_sha256": p.file_sha256,
        })
    return out


FIELD_META_KEYS = ("confidence", "confidenceTier", "confidenceReasons", "discrepancyNote",
                   "isVerified", "hasDiscrepancy", "boundingBox", "hasBoundingBox", "learnedCorrection")


def build_field_meta(doc: Dict[str, Any]) -> Dict[str, Any]:
    fields: Dict[str, Any] = {}

    def put(path, f):
        if isinstance(f, dict):
            fields[path] = {k: f[k] for k in FIELD_META_KEYS if k in f}

    for k in ("khataNumber", "fasliYear", "totalStatedArea"):
        put(k, doc.get(k))
    for i, o in enumerate(doc.get("owners", []) or []):
        for k in ("name", "relativeName", "shareFraction"):
            put(f"owners.{i}.{k}", o.get(k))
    for i, pl in enumerate(doc.get("plots", []) or []):
        for k in ("khasraNumber", "regionalAreaText", "landClassification", "annualRevenueLagaan"):
            put(f"plots.{i}.{k}", pl.get(k))
    meta = {"fields": fields}
    for k in ("crossVerification", "lrmsVerification", "confidenceSummary", "reviewReasons", "needsReview"):
        if k in doc:
            meta[k] = doc[k]
    return meta


def _set_field_meta(p: ParcelRecord, path: str, **updates):
    meta = json.loads(p.field_meta_json) if p.field_meta_json else {"fields": {}}
    meta.setdefault("fields", {}).setdefault(path, {}).update(updates)
    p.field_meta_json = json.dumps(meta, ensure_ascii=False)

def seed_initial_parcels(db: Session):
    """Seeds the 2 authentic verified Digital India land records (Jaunpur & Ballia)."""
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M IST")

    # =========================================================================
    # RECORD 1: हीरापुरमचहटी (Heerapur Machhati) - Jaunpur (जौनपुर)
    # =========================================================================
    rec_0 = ParcelRecord(
        id='rec-up-jaunpur-548',
        ulpin='REF-UPJAU-00548',
        title='उत्तर प्रदेश भूलेख खतौनी - ग्राम: हीरापुरमचहटी (जौनपुर)',
        state='Uttar Pradesh',
        state_code='UP',
        district='Jaunpur (जौनपुर)',
        tehsil='Kerakat (केराकत)',
        village='हीरापुरमचहटी (Heerapur Machhati)',
        lgd_code='192831',
        record_type='Khasra-Khatauni',
        primary_language='Hindi',
        original_document_url='/sample-scans/jaunpur-khatauni.jpg',
        scan_condition='Standard Digital Scan',
        estimated_year=2026,
        khata_number='00548',
        fasli_year='1428 फसली -1433 (01 जुलाई, 2020 से 30 जून, 2026)',
        total_stated_area_ha=0.829,
        total_stated_sq_m=8290.0,
        total_biswa=65.55,
        total_stated_display='0.8290 हेक्टेयर (8,290 वर्ग मीटर · लगभग 65.6 बिस्वा)',
        is_verified=True,
        verification_status='OFFICER_APPROVED',
        approved_by='Demo seed (sample record, pre-approved)',
        approved_at=now_str,
        overall_confidence=0.98,
        has_discrepancy=True
    )
    db.add(rec_0)

    # Owners for rec-up-jaunpur-548
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o1',
        parcel_id='rec-up-jaunpur-548',
        name='शिवसरन',
        relation_type='s/o',
        relative_name='मुरली',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='शिवसरन',
        bbox_x=12.0,
        bbox_y=28.0,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o2',
        parcel_id='rec-up-jaunpur-548',
        name='भोला',
        relation_type='s/o',
        relative_name='मुरली',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='भोला',
        bbox_x=12.0,
        bbox_y=32.5,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o3',
        parcel_id='rec-up-jaunpur-548',
        name='भोभल',
        relation_type='s/o',
        relative_name='मुरली',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='भोभल',
        bbox_x=12.0,
        bbox_y=37.0,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o4',
        parcel_id='rec-up-jaunpur-548',
        name='टुडी',
        relation_type='s/o',
        relative_name='हरिनाथ',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='टूड़ी',
        bbox_x=12.0,
        bbox_y=41.5,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o5',
        parcel_id='rec-up-jaunpur-548',
        name='बांके',
        relation_type='s/o',
        relative_name='हरिनाथ',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='बांके',
        bbox_x=12.0,
        bbox_y=46.0,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o6',
        parcel_id='rec-up-jaunpur-548',
        name='हवलदार',
        relation_type='s/o',
        relative_name='हरिनाथ',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='हवलदार',
        bbox_x=12.0,
        bbox_y=50.5,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o7',
        parcel_id='rec-up-jaunpur-548',
        name='हरिनाथ',
        relation_type='s/o',
        relative_name='जगपति',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='हरिनाथ',
        bbox_x=12.0,
        bbox_y=55.0,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o8',
        parcel_id='rec-up-jaunpur-548',
        name='रामआसरे',
        relation_type='s/o',
        relative_name='देवराज',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='रामआसरे',
        bbox_x=12.0,
        bbox_y=59.5,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o9',
        parcel_id='rec-up-jaunpur-548',
        name='कमलेश',
        relation_type='s/o',
        relative_name='देवराज',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='कमलेश',
        bbox_x=12.0,
        bbox_y=64.0,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o10',
        parcel_id='rec-up-jaunpur-548',
        name='मोहन',
        relation_type='s/o',
        relative_name='इन्द्रदेव',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='मोहन',
        bbox_x=12.0,
        bbox_y=68.5,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o11',
        parcel_id='rec-up-jaunpur-548',
        name='बिरजू',
        relation_type='s/o',
        relative_name='इन्द्रदेव',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='बिरजू',
        bbox_x=12.0,
        bbox_y=73.0,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o12',
        parcel_id='rec-up-jaunpur-548',
        name='सूर्यनाथ',
        relation_type='s/o',
        relative_name='इन्द्रदेव',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='सूर्यनाथ',
        bbox_x=12.0,
        bbox_y=77.5,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o13',
        parcel_id='rec-up-jaunpur-548',
        name='अशोक',
        relation_type='s/o',
        relative_name='इन्द्रदेव',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='अशोक',
        bbox_x=12.0,
        bbox_y=82.0,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-jaunpur-548-o14',
        parcel_id='rec-up-jaunpur-548',
        name='बांकेलाल',
        relation_type='s/o',
        relative_name='हरिनाथ',
        share_fraction='',
        share_percentage=100.0,
        individual_ha=0.0592,
        individual_sq_m=592.1,
        individual_biswa=4.69,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='बांकेलाल',
        bbox_x=12.0,
        bbox_y=86.5,
        bbox_w=28.0,
        bbox_h=4.0
    ))

    # Plots for rec-up-jaunpur-548
    db.add(KhasraPlot(
        id='rec-up-jaunpur-548-p1',
        parcel_id='rec-up-jaunpur-548',
        gata_number='गाटा 32',
        area_ha=0.829,
        area_sq_m=8290.0,
        area_biswa=65.55,
        area_display='0.8290 हे० (8,290 वर्ग मीटर)',
        land_classification='श्रेणी 1-क · संक्रमणीय भूमिधर (स्वयं की निजी भूमि — बिक्री व वसीयत का पूर्ण अधिकार)',
        annual_tax_cess='दोपांच दशमलव दो',
        chauhaddi_north='गाटा 860 · सुरेश चौबे',
        chauhaddi_south='गाटा 862 · रविन्द्र यादव',
        chauhaddi_east='चकमार्ग (12 फीट रास्ता)',
        chauhaddi_west='गाटा 859 · राजकीय नलकूप व नाली',
        has_road_access=True,
        confidence=0.95,
        confidence_tier="high",
        bbox_x=10.0,
        bbox_y=50.0,
        bbox_w=84.0,
        bbox_h=8.0
    ))

    db.add(DiscrepancyEntry(
        id='rec-up-jaunpur-548-d1',
        parcel_id='rec-up-jaunpur-548',
        field_key='totalStatedArea',
        title='🚨 बैंक बंधक दर्ज (1 ऋण)',
        description='सक्रिय बैंक बंधक: Baroda U.P Bank (₹ 237,000.00)। बैंक NOC आवश्यक।',
        severity='high',
        suggested_action='बैंक नो-ड्यूज सर्टिफिकेट (NOC) प्राप्त करें।',
        status='PENDING_REVIEW'
    ))

    db.add(AuditLogEntry(
        id='audit-rec-up-jaunpur-548-genesis',
        parcel_id='rec-up-jaunpur-548',
        timestamp=now_str,
        officer_id="DEMO-SEED",
        officer_name="Demo seed",
        officer_designation="Naib Tehsildar (Digitization Division)",
        action="FINAL_DIGITIZATION_SIGN_OFF",
        field_label="National Bhoomi Portal Sealed",
        old_value="Physical Archival Ingestion",
        new_value='Demo seed record created (ref REF-UPJAU-00548)',
        sha256_hash=compute_sha256(f"rec-up-jaunpur-548-genesis")
    ))

    # =========================================================================
    # RECORD 2: चैनपुर गुलौरा - बलिया तहसील: बेल्थरा रोड ग्राम: चैनपुर गुलौरा
    # =========================================================================
    rec_1 = ParcelRecord(
        id='rec-up-861-193',
        ulpin='REF-UPBAL-00858',
        title='उत्तर प्रदेश भूलेख - गाटा 861 (चैनपुर गुलौरा, बलिया तहसील: बेल्थरा रोड ग्राम: चैनपुर गुलौरा)',
        state='Uttar Pradesh',
        state_code='UP',
        district='Ballia (बलिया)',
        tehsil='बेल्थरा रोड ग्राम: चैनपुर गुलौरा',
        village='चैनपुर गुलौरा (Chainpur Gulaura)',
        lgd_code='192831',
        record_type='Khasra-Khatauni',
        primary_language='Hindi',
        original_document_url='/uploads/scan_ULPIN1793303110_20261030_011510_rendered.jpg',
        scan_condition='Standard Digital Scan',
        estimated_year=2026,
        khata_number='00858',
        fasli_year='1426 फसली -1431 (01 जुलाई, 2026 से 30',
        total_stated_area_ha=1.0,
        total_stated_sq_m=10000.0,
        total_biswa=79.07,
        total_stated_display='1.0000 हेक्टेयर (10,000 वर्ग मीटर · लगभग 79.1 बिस्वा)',
        is_verified=False,
        verification_status='IN_REVIEW',
        approved_by=None,
        approved_at=now_str,
        overall_confidence=0.98,
        has_discrepancy=False
    )
    db.add(rec_1)

    # Owners for rec-up-861-193
    db.add(TenureHolder(
        id='rec-up-861-193-o1',
        parcel_id='rec-up-861-193',
        name='राजेश यादव',
        relation_type='s/o',
        relative_name='रामनक्षत्र यादव',
        share_fraction='0.071000 हे०',
        share_percentage=100.0,
        individual_ha=0.25,
        individual_sq_m=2500.0,
        individual_biswa=19.77,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='रा जेश या दव',
        bbox_x=12.0,
        bbox_y=28.0,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-861-193-o2',
        parcel_id='rec-up-861-193',
        name='लाल बच्ची यादव',
        relation_type='s/o',
        relative_name='रामनक्षत्र यादव',
        share_fraction='0.023700 हे०',
        share_percentage=100.0,
        individual_ha=0.25,
        individual_sq_m=2500.0,
        individual_biswa=19.77,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='2) ला ल बच्ची या दव',
        bbox_x=12.0,
        bbox_y=32.5,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-861-193-o3',
        parcel_id='rec-up-861-193',
        name='सुनील यादव',
        relation_type='s/o',
        relative_name='रामनक्षत्र यादव',
        share_fraction='0.023700 हे०',
        share_percentage=100.0,
        individual_ha=0.25,
        individual_sq_m=2500.0,
        individual_biswa=19.77,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='सुनी ल या दव',
        bbox_x=12.0,
        bbox_y=37.0,
        bbox_w=28.0,
        bbox_h=4.0
    ))
    db.add(TenureHolder(
        id='rec-up-861-193-o4',
        parcel_id='rec-up-861-193',
        name='रामनक्षत्र',
        relation_type='s/o',
        relative_name='बां सदेव',
        share_fraction='0.023600 हे०',
        share_percentage=100.0,
        individual_ha=0.25,
        individual_sq_m=2500.0,
        individual_biswa=19.77,
        mobile_number=None,
        confidence=0.99,
        confidence_tier="high",
        is_verified=True,
        raw_ocr_value='रा मनक्षत्र',
        bbox_x=12.0,
        bbox_y=41.5,
        bbox_w=28.0,
        bbox_h=4.0
    ))

    # Plots for rec-up-861-193
    db.add(KhasraPlot(
        id='rec-up-861-193-p1',
        parcel_id='rec-up-861-193',
        gata_number='गाटा 861',
        area_ha=1.0,
        area_sq_m=10000.0,
        area_biswa=79.07,
        area_display='1.0000 हे० (10,000 वर्ग मीटर)',
        land_classification='श्रेणी 1-क · संक्रमणीय भूमिधर (स्वयं की निजी भूमि — बिक्री व वसीयत का पूर्ण अधिकार)',
        annual_tax_cess='₹ 0.01',
        chauhaddi_north='गाटा 860 · सुरेश चौबे',
        chauhaddi_south='गाटा 862 · रविन्द्र यादव',
        chauhaddi_east='चकमार्ग (12 फीट रास्ता)',
        chauhaddi_west='गाटा 859 · राजकीय नलकूप व नाली',
        has_road_access=True,
        confidence=0.95,
        confidence_tier="high",
        bbox_x=10.0,
        bbox_y=50.0,
        bbox_w=84.0,
        bbox_h=8.0
    ))


    db.add(AuditLogEntry(
        id='audit-rec-up-861-193-genesis',
        parcel_id='rec-up-861-193',
        timestamp=now_str,
        officer_id="DEMO-SEED",
        officer_name="Demo seed",
        officer_designation="Naib Tehsildar (Digitization Division)",
        action="FINAL_DIGITIZATION_SIGN_OFF",
        field_label="National Bhoomi Portal Sealed",
        old_value="Physical Archival Ingestion",
        new_value='Demo seed record created (ref REF-UPBAL-00858)',
        sha256_hash=compute_sha256(f"rec-up-861-193-genesis")
    ))

    db.commit()
    print(f"[Database] Successfully seeded authentic Digital India parcels (Jaunpur & Ballia).")

def save_extracted_record(doc: Dict[str, Any], db: Session, file_sha: Optional[str] = None) -> ParcelRecord:
    """
    Ingests and saves ANY newly extracted or restored archival document into database.
    Full support for illegible patches, discrepancy flags, and Section 65B audit trails.
    """
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M IST")
    rec_id = doc.get("id") or f"rec-{int(datetime.datetime.now().timestamp())}"
    
    # Extract clean fields
    state = doc.get("state", "Uttar Pradesh")
    state_code = doc.get("stateCode", "UP")
    district = doc.get("district", "Varanasi")
    tehsil = doc.get("tehsil", "Pindra")
    village = doc.get("village", "Rampur Kalan")
    khata_val = doc.get("khataNumber", {}).get("value", "") if isinstance(doc.get("khataNumber"), dict) else str(doc.get("khataNumber") or "")
    fasli_val = doc.get("fasliYear", {}).get("value", "") if isinstance(doc.get("fasliYear"), dict) else str(doc.get("fasliYear") or "")
    
    plots_data = doc.get("plots", [])
    primary_gata = ""
    if plots_data:
        p_val = plots_data[0].get("khasraNumber")
        primary_gata = p_val.get("value", "") if isinstance(p_val, dict) else str(p_val or "")
    
    total_sq_m = float(doc.get("totalStatedAreaInSqMeters", 0) or 0.0)
    total_ha = round(total_sq_m / 10000.0, 4)
    total_biswa = round(total_sq_m / 126.464, 1)
    
    total_display = doc.get("totalStatedArea", {}).get("value") if isinstance(doc.get("totalStatedArea"), dict) else doc.get("totalStatedArea")
    if not total_display:
        total_display = f"{total_ha:.4f} हेक्टेयर ({total_sq_m:,.0f} वर्ग मीटर · लगभग {total_biswa} बिस्वा)" if total_sq_m else ""
    
    ulpin = doc.get("ulpin") or generate_ulpin(state_code, district, primary_gata, khata_val)

    # NEVER overwrite an existing record. Duplicates are flagged by validation_engine
    # and saved as a separate draft so an officer decides which one survives.
    if db.query(ParcelRecord).filter(ParcelRecord.id == rec_id).first():
        rec_id = f"{rec_id}-{datetime.datetime.now().strftime('%H%M%S%f')}"
    base_ulpin, n = ulpin, 0
    while db.query(ParcelRecord).filter(ParcelRecord.ulpin == ulpin).first():
        n += 1
        ulpin = f"{base_ulpin}-{n}"

    parcel = ParcelRecord(
        id=rec_id,
        ulpin=ulpin,
        title=doc.get("title", f"{state} राजस्व खतौनी"),
        state=state,
        state_code=state_code,
        district=district,
        tehsil=tehsil,
        village=village,
        lgd_code=doc.get("lgdCode", "192831"),
        record_type=doc.get("recordType", "Khasra-Khatauni"),
        primary_language=doc.get("primaryLanguage", "Hindi"),
        original_document_url=doc.get("originalDocumentUrl") or "/sample-scans/up-khasra.svg",
        scan_condition=doc.get("scanCondition", "Archival Document Scan"),
        estimated_year=int(doc.get("estimatedYear", 1984)),
        khata_number=str(khata_val),
        fasli_year=str(fasli_val),
        total_stated_area_ha=total_ha,
        total_stated_sq_m=total_sq_m,
        total_biswa=total_biswa,
        total_stated_display=total_display,
        boundary_geojson=json.dumps(doc.get("boundaryGeoJson")) if doc.get("boundaryGeoJson") else None,
        is_verified=doc.get("verificationStatus") == "OFFICER_APPROVED",
        verification_status=doc.get("verificationStatus", "IN_REVIEW"),
        approved_by=doc.get("approvedBy"),
        approved_at=doc.get("approvedAt"),
        overall_confidence=float(doc.get("overallConfidence", 0.0)),
        has_discrepancy=len(doc.get("discrepancies", [])) > 0,
        file_sha256=file_sha,
        extraction_source=doc.get("extractionSource"),
        field_meta_json=json.dumps(build_field_meta(doc), ensure_ascii=False),
    )
    db.add(parcel)

    # Save owners
    raw_owners = doc.get("owners", [])
    owner_count = len(raw_owners) or 1
    for idx, o in enumerate(raw_owners):
        name_dict = o.get("name") if isinstance(o.get("name"), dict) else {}
        name = name_dict.get("value", f"खातेदार #{idx+1}") if name_dict else str(o.get("name", ""))
        rel_dict = o.get("relativeName") if isinstance(o.get("relativeName"), dict) else {}
        rel = rel_dict.get("value", "") if rel_dict else str(o.get("relativeName", ""))
        share_dict = o.get("shareFraction") if isinstance(o.get("shareFraction"), dict) else {}
        share = share_dict.get("value", "") if share_dict else str(o.get("shareFraction", ""))
        # Per-holder area only when the share is actually stated (never assume equal shares)
        _fr = re.search(r"(\d+)\s*/\s*(\d+)", share or "")
        _ha = re.search(r"(\d+\.\d+)\s*हे", share or "")
        frac = (int(_fr.group(1)) / int(_fr.group(2))) if _fr and int(_fr.group(2)) else \
               ((float(_ha.group(1)) / total_ha) if _ha and total_ha else None)
        
        conf = float(name_dict.get("confidence", 0.95) if name_dict else o.get("confidence", 0.95))
        conf_tier = name_dict.get("confidenceTier", "high") if name_dict else ("low" if conf < 0.6 else "high")
        discrepancy_note = name_dict.get("discrepancyNote") or o.get("discrepancyNote")
        raw_ocr = name_dict.get("rawOcrValue") or name

        bbox = name_dict.get("boundingBox") or o.get("boundingBox") or {}
        bx = float(bbox.get("x", 12.0))
        by = float(bbox.get("y", 28.0 + (idx * 6.0)))
        bw = float(bbox.get("width", 28.0))
        bh = float(bbox.get("height", 5.0))

        holder = TenureHolder(
            id=f"{rec_id}-o{idx+1}",
            parcel_id=rec_id,
            name=name,
            relation_type=o.get("relationType", "s/o"),
            relative_name=rel,
            share_fraction=share,
            share_percentage=round(100.0 * frac, 2) if frac is not None else 0.0,
            individual_ha=round(total_ha * frac, 4) if frac is not None else 0.0,
            individual_sq_m=round(total_sq_m * frac, 1) if frac is not None else 0.0,
            individual_biswa=round(total_biswa * frac, 2) if frac is not None else 0.0,
            mobile_number=o.get("mobileNumber"),
            confidence=conf,
            confidence_tier=conf_tier,
            is_verified=o.get("isVerified", False),
            raw_ocr_value=raw_ocr,
            discrepancy_note=discrepancy_note,
            bbox_x=bx,
            bbox_y=by,
            bbox_w=bw,
            bbox_h=bh
        )
        db.add(holder)

    # Save plots
    for idx, p in enumerate(plots_data):
        k_dict = p.get("khasraNumber") if isinstance(p.get("khasraNumber"), dict) else {}
        gata_no = k_dict.get("value", str(idx+1)) if k_dict else str(p.get("khasraNumber", ""))
        clean_gata_no = gata_no.replace("गाटा", "").replace("खसरा", "").strip()
        plot_ha = float(p.get("areaInHectares") or 0.0)
        plot_sq_m = float(p.get("areaInSqMeters") or 0.0)
        plot_biswa = round(plot_sq_m / 126.464, 1)
        plot_display = p.get("regionalAreaText", {}).get("value") if isinstance(p.get("regionalAreaText"), dict) else p.get("regionalAreaText")
        if not plot_display:
            plot_display = f"{plot_ha:.4f} हे० ({plot_sq_m:,.0f} वर्ग मीटर)"
        
        class_val = p.get("landClassification", {}).get("value") if isinstance(p.get("landClassification"), dict) else p.get("landClassification", "श्रेणी 1-क · संक्रमणीय भूमिधर")
        tax_val = p.get("annualRevenueLagaan", {}).get("value") if isinstance(p.get("annualRevenueLagaan"), dict) else p.get("annualRevenueLagaan", "₹ 0.01")
        
        p_bbox = p.get("boundingBox") or {}
        pbx = float(p_bbox.get("x", 10.0))
        pby = float(p_bbox.get("y", 50.0 + (idx * 7.5)))
        pbw = float(p_bbox.get("width", 84.0))
        pbh = float(p_bbox.get("height", 7.0))

        kplot = KhasraPlot(
            id=f"{rec_id}-p{idx+1}",
            parcel_id=rec_id,
            gata_number=clean_gata_no or str(idx+1),
            area_ha=plot_ha,
            area_sq_m=plot_sq_m,
            area_biswa=plot_biswa,
            area_display=plot_display,
            land_classification=class_val,
            annual_tax_cess=tax_val,
            chauhaddi_north=None,   # boundaries are not on the RoR; never invent them
            chauhaddi_south=None,
            chauhaddi_east=None,
            chauhaddi_west=None,
            has_road_access=None,
            confidence=float((k_dict or {}).get("confidence", 0.0)),
            confidence_tier=(k_dict or {}).get("confidenceTier", "low"),
            bbox_x=pbx,
            bbox_y=pby,
            bbox_w=pbw,
            bbox_h=pbh
        )
        db.add(kplot)

    # Save discrepancies if any
    for idx, d in enumerate(doc.get("discrepancies", [])):
        disc = DiscrepancyEntry(
            id=f"{rec_id}-d{idx+1}",
            parcel_id=rec_id,
            field_key=d.get("fieldKey", "totalStatedArea"),
            title=d.get("title", "Discrepancy"),
            description=d.get("description", ""),
            severity=d.get("severity", "medium"),
            suggested_action=d.get("suggestedAction", ""),
            status=d.get("status", "PENDING_REVIEW")
        )
        db.add(disc)

    # Genesis cryptographic audit entry
    genesis_audit = AuditLogEntry(
        id=f"{rec_id}-audit-genesis",
        parcel_id=rec_id,
        timestamp=now_str,
        officer_id="SYSTEM",
        officer_name="Demo seed",
        officer_designation="Naib Tehsildar (Digitization Division)",
        action="ARCHIVAL_INGESTION_SEALED",
        field_label="Automated Document Extraction",
        old_value="Physical Scan Ingestion",
        new_value=f"Record created from upload (ref {ulpin})",
        sha256_hash=compute_sha256(f"{rec_id}-{ulpin}-{now_str}")
    )
    db.add(genesis_audit)

    db.commit()
    db.refresh(parcel)
    print(f"[Database] Successfully saved archival parcel {rec_id} (ULPIN: {ulpin}) into database.")
    return parcel

def get_all_parcels(db: Session) -> List[Dict[str, Any]]:
    """Returns all digitized parcels prioritizing user's real Jaunpur record first."""
    parcels = db.query(ParcelRecord).all()
    order_weights = {
        "rec-up-jaunpur-548": 0,
        "rec-up-mau-124": 1,
        "rec-up-1431-varanasi": 2,
        "rec-mh-pune-712": 3,
    }
    sorted_parcels = sorted(parcels, key=lambda p: (order_weights.get(p.id, 99), str(p.created_at)))
    return [p.to_dict() for p in sorted_parcels]

def get_parcel_by_id(parcel_id: str, db: Session) -> Optional[Dict[str, Any]]:
    p = db.query(ParcelRecord).filter(ParcelRecord.id == parcel_id).first()
    return p.to_dict() if p else None

def get_parcel_by_khata_or_phone(query_str: str, db: Session) -> Optional[Dict[str, Any]]:
    clean = query_str.strip().lstrip("0")
    # Search by khata
    p = db.query(ParcelRecord).filter(
        (ParcelRecord.khata_number == query_str.strip()) |
        (ParcelRecord.khata_number.endswith(clean))
    ).first()
    if p:
        return p.to_dict()

    # Search by owner phone number
    holder = db.query(TenureHolder).filter(TenureHolder.mobile_number.endswith(query_str[-10:])).first()
    if holder and holder.parcel:
        return holder.parcel.to_dict()

    return None

def update_parcel_field(
    parcel_id: str,
    field_key: str,
    new_value: str,
    officer_name: str,
    db: Session,
    mode: str = "edit",
) -> Optional[Dict[str, Any]]:
    """
    Officer edits a field (mode="edit") or confirms it unchanged (mode="confirm").
    Handles header, holder and plot fields. Logs a chained audit entry either way:
    FIELD_EDITED when the value changed, CONFIRMED_MATCH when it was confirmed as read.
    Returns None if the parcel or the field key is unknown.
    """
    p = db.query(ParcelRecord).filter(ParcelRecord.id == parcel_id).first()
    if not p:
        return None
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M IST")

    # Resolve key -> (object, attribute, meta path, label)
    target = None
    header = {"khataNumber": ("khata_number", "Khata Number"),
              "fasliYear": ("fasli_year", "Fasli Assessment Year"),
              "totalStatedArea": ("total_stated_display", "Total Stated Area")}
    if field_key in header:
        attr, label = header[field_key]
        target = (p, attr, field_key, label)
    else:
        for i, o in enumerate(p.owners):
            for suffix, attr, mk, label in (("name", "name", "name", "Tenure Holder"),
                                            ("rel", "relative_name", "relativeName", "Relative Name"),
                                            ("share", "share_fraction", "shareFraction", "Share")):
                if field_key == f"{o.id}-{suffix}":
                    target = (o, attr, f"owners.{i}.{mk}", f"{label} #{i + 1}")
        for i, pl in enumerate(p.plots):
            for suffix, attr, mk, label in (("khasra", "gata_number", "khasraNumber", "Khasra/Gata No."),
                                            ("area", "area_display", "regionalAreaText", "Plot Area"),
                                            ("class", "land_classification", "landClassification", "Land Class"),
                                            ("tax", "annual_tax_cess", "annualRevenueLagaan", "Revenue/Lagaan")):
                if field_key == f"{pl.id}-{suffix}":
                    target = (pl, attr, f"plots.{i}.{mk}", f"{label} (plot #{i + 1})")
    if not target or not hasattr(target[0], target[1]):
        return None
    obj, attr, path, label = target

    old_val = getattr(obj, attr) or ""
    changed = mode != "confirm" and (new_value or "") != old_val

    # Learning loop: log the officer's verdict on the MACHINE reading (first review of this field only)
    meta_now = (json.loads(p.field_meta_json) if p.field_meta_json else {}).get("fields", {}).get(path, {})
    if not meta_now.get("verifiedBy"):
        import learning
        lc = meta_now.get("learnedCorrection")
        if not changed:
            learning.log_review(db, p, path, "confirm", old_val, old_val, officer_name)
        elif lc and (new_value or "").strip() == lc.get("from"):
            learning.log_review(db, p, path, "revert_learned", old_val, new_value, officer_name)
        else:
            learning.log_review(db, p, path, "edit", lc.get("from") if lc else old_val, new_value, officer_name)
    if changed:
        setattr(obj, attr, new_value)
        if attr == "area_display":
            from revenue_math import parse_regional_land_area
            try:
                sq = parse_regional_land_area(new_value)
                if sq:
                    obj.area_sq_m = sq
                    obj.area_ha = round(sq / 10000, 4)
            except Exception:
                pass
    # Only this one field is marked verified (via field meta) - not the whole row or parcel.
    _set_field_meta(p, path, isVerified=True, confidence=1.0, confidenceTier="high",
                    discrepancyNote=None, verifiedBy=officer_name, verifiedAt=now_str,
                    confidenceReasons=[f"{'corrected' if changed else 'confirmed as read'} by {officer_name}"])

    db.add(AuditLogEntry(
        id=f"audit-{int(datetime.datetime.now().timestamp()*1000)}",
        parcel_id=parcel_id, timestamp=now_str,
        officer_name=officer_name, officer_designation="",
        action="FIELD_EDITED" if changed else "CONFIRMED_MATCH",
        field_label=label, old_value=old_val, new_value=new_value if changed else old_val,
        sha256_hash="pending"))  # replaced by the hash-chain hook on flush
    db.commit()
    db.refresh(p)
    return p.to_dict()

def approve_parcel_record(
    parcel_id: str,
    officer_name: str,
    officer_desig: str,
    db: Session
) -> Optional[Dict[str, Any]]:
    """Approves and digitally seals the land record."""
    p = db.query(ParcelRecord).filter(ParcelRecord.id == parcel_id).first()
    if not p:
        return None

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M IST")
    p.verification_status = "OFFICER_APPROVED"
    p.is_verified = True
    p.approved_by = f"{officer_name} ({officer_desig})"
    p.approved_at = now_str

    for o in p.owners:
        o.is_verified = True
    for plot in p.plots:
        plot.is_verified = True

    audit = AuditLogEntry(
        id=f"audit-seal-{int(datetime.datetime.now().timestamp()*1000)}",
        parcel_id=parcel_id,
        timestamp=now_str,
        officer_id="SYSTEM",
        officer_name=officer_name,
        officer_designation=officer_desig,
        action="FINAL_DIGITIZATION_SIGN_OFF",
        field_label="Complete Record Dossier",
        old_value="IN_REVIEW",
        new_value=f"Officer approved; record locked (ref {p.ulpin})",
        sha256_hash=compute_sha256(f"{parcel_id}-sealed-{now_str}")
    )
    db.add(audit)
    db.commit()
    db.refresh(p)
    return p.to_dict()

def resolve_parcel_discrepancy(
    parcel_id: str,
    disc_id: str,
    justification: str,
    officer_name: str,
    db: Session
) -> Optional[Dict[str, Any]]:
    """Resolves a discrepancy, updates parcel status, and logs a chained audit record."""
    disc = db.query(DiscrepancyEntry).filter(
        DiscrepancyEntry.id == disc_id,
        DiscrepancyEntry.parcel_id == parcel_id
    ).first()
    if not disc:
        return None

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M IST")
    disc.status = "RESOLVED"

    p = db.query(ParcelRecord).filter(ParcelRecord.id == parcel_id).first()
    if p:
        pending_count = db.query(DiscrepancyEntry).filter(
            DiscrepancyEntry.parcel_id == parcel_id,
            DiscrepancyEntry.status == "PENDING_REVIEW"
        ).count()
        p.has_discrepancy = (pending_count > 0)

        audit = AuditLogEntry(
            id=f"audit-disc-{int(datetime.datetime.now().timestamp()*1000)}",
            parcel_id=parcel_id,
            timestamp=now_str,
            officer_id="SYSTEM",
            officer_name=officer_name or "Unknown officer",
            officer_designation="Naib Tehsildar (Pindra)",
            action="DISCREPANCY_OVERRIDDEN",
            field_label=f"Discrepancy: {disc.title}",
            old_value="PENDING_REVIEW",
            new_value=f"RESOLVED: {justification}",
            sha256_hash=compute_sha256(f"{parcel_id}-{disc_id}-{justification}-{now_str}")
        )
        db.add(audit)
        db.commit()
        db.refresh(p)
        return p.to_dict()
    return None


def _manual_audit(p: ParcelRecord, officer: str, label: str, new_value: str, db: Session):
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M IST")
    db.add(AuditLogEntry(
        id=f"audit-{int(datetime.datetime.now().timestamp()*1000)}", parcel_id=p.id, timestamp=now_str,
        officer_id="SYSTEM", officer_name=officer or "Unknown officer",
        officer_designation="Naib Tehsildar (Pindra)", action="FIELD_EDITED", field_label=label,
        old_value="(not extracted)", new_value=new_value,
        sha256_hash=compute_sha256(f"{p.id}-{label}-{new_value}-{now_str}")))


def add_owner_to_parcel(parcel_id: str, data: Dict[str, Any], db: Session) -> Optional[Dict[str, Any]]:
    from revenue_math import parse_regional_land_area  # noqa: F401
    p = db.query(ParcelRecord).filter(ParcelRecord.id == parcel_id).first()
    if not p or not (data.get("name") or "").strip():
        return None
    n = len(p.owners) + 1
    while db.query(TenureHolder).filter(TenureHolder.id == f"{p.id}-o{n}").first():
        n += 1
    count = len(p.owners) + 1
    db.add(TenureHolder(
        id=f"{p.id}-o{n}", parcel_id=p.id, name=data["name"].strip(),
        relation_type=data.get("relation_type") or "s/o", relative_name=(data.get("relative_name") or "").strip(),
        share_fraction=(data.get("share_fraction") or "").strip(),
        share_percentage=round(100.0 / count, 2),
        individual_ha=round((p.total_stated_area_ha or 0) / count, 4),
        individual_sq_m=round((p.total_stated_sq_m or 0) / count, 1),
        individual_biswa=round((p.total_biswa or 0) / count, 2),
        confidence=1.0, confidence_tier="high", is_verified=True,
        raw_ocr_value="(entered by officer)", bbox_x=0, bbox_y=0, bbox_w=0, bbox_h=0))
    _manual_audit(p, data.get("officer_name"), f"Tenure Holder added ({data['name'].strip()})", data["name"].strip(), db)
    db.commit(); db.refresh(p)
    return p.to_dict()


def add_plot_to_parcel(parcel_id: str, data: Dict[str, Any], db: Session) -> Optional[Dict[str, Any]]:
    from revenue_math import parse_regional_land_area
    p = db.query(ParcelRecord).filter(ParcelRecord.id == parcel_id).first()
    if not p or not (data.get("khasra_number") or "").strip():
        return None
    conv = parse_regional_land_area(data.get("area_text") or "")
    n = len(p.plots) + 1
    while db.query(KhasraPlot).filter(KhasraPlot.id == f"{p.id}-p{n}").first():
        n += 1
    gata = data["khasra_number"].replace("गाटा", "").replace("खसरा", "").strip()
    db.add(KhasraPlot(
        id=f"{p.id}-p{n}", parcel_id=p.id, gata_number=gata,
        area_ha=conv["hectares"], area_sq_m=conv["sq_meters"], area_biswa=round(conv["sq_meters"] / 126.464, 1),
        area_display=(data.get("area_text") or "").strip(), land_classification=(data.get("classification") or "").strip(),
        annual_tax_cess=(data.get("tax") or "").strip(), confidence=1.0, confidence_tier="high",
        bbox_x=0, bbox_y=0, bbox_w=0, bbox_h=0))
    _manual_audit(p, data.get("officer_name"), f"Khasra plot added ({gata})", data["khasra_number"].strip(), db)
    db.commit(); db.refresh(p)
    return p.to_dict()
