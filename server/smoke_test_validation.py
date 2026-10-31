"""
Smoke test for the validation pipeline + database layer.
Runs against a COPY of bhoolekha.db, so your real database is untouched.

    cd server
    python smoke_test_validation.py
"""
import base64, os, re, shutil, sys, tempfile
from pathlib import Path

HERE = Path(__file__).parent
tmp = Path(tempfile.mkdtemp())
for f in HERE.glob("bhoolekha.db*"):
    shutil.copy(f, tmp / f.name)
os.environ["DATABASE_URL"] = f"sqlite:///{(tmp / 'bhoolekha.db').as_posix()}"
sys.path.insert(0, str(HERE))

from database import SessionLocal
from db_service import (init_db, save_extracted_record, get_lrms_rows, get_existing_index,
                        get_parcel_by_id, update_parcel_field, get_all_parcels)
from validation_engine import score_record, cross_verify, file_sha256
from extractor import extract_land_record_from_image

ok = True
def check(cond, msg):
    global ok
    print(("  PASS " if cond else "  FAIL ") + msg)
    ok &= bool(cond)

init_db()
db = SessionLocal()
check(len(get_lrms_rows(db)) >= 4, "mock LRMS master seeded")
before = len(get_all_parcels(db))

pdf = HERE.parent / "public" / "uploads" / "scan_ULPIN1793392324_20261031_020204.pdf"
data = base64.b64encode(pdf.read_bytes()).decode()
ids = []
for i in range(2):
    rec = extract_land_record_from_image(data, "Uttar Pradesh", "Khasra-Khatauni", "", "")
    sha = file_sha256(data)
    score_record(rec)
    cross_verify(rec, get_lrms_rows(db), get_existing_index(db), sha)
    p = save_extracted_record(rec, db, file_sha=sha)
    ids.append(p.id)
    d = p.to_dict()
    print(f"\nupload #{i+1}: {p.id}  status={d['verificationStatus']}  overall={d['overallConfidence']}")
    for x in d["discrepancies"]:
        print(f"   [{x['severity']}] {x['title']}")
    check(d["extractionSource"] == "statutory_pdf_text", "source recorded")
    check(not d["khataNumber"]["isVerified"], "extracted fields are NOT auto-verified")
    check(d["khataNumber"]["confidence"] >= 0.9, "khata matched LRMS -> high confidence")
    if i == 1:
        check(any("Duplicate upload" in x["title"] for x in d["discrepancies"]), "re-upload flagged as duplicate")

check(len(get_all_parcels(db)) == before + 2, "both uploads kept (nothing overwritten)")

p = get_parcel_by_id(ids[1], db)
bad = [o for o in p["owners"] if any(ch.isdigit() for ch in o["name"]["value"])]
if bad:
    check(bad[0]["name"]["confidenceTier"] == "low", "garbled owner name flagged low")
    upd = update_parcel_field(ids[1], bad[0]["name"]["key"], "राजेश", "Test Officer", db)
    fixed = [o for o in upd["owners"] if o["name"]["value"] == "राजेश" and o["name"]["isVerified"]]
    check(bool(fixed), "officer edit marks that field verified")
    check(upd["khataNumber"]["isVerified"] is False, "editing one field doesn't verify the others")

seed = get_parcel_by_id("rec-up-jaunpur-548", db)
if seed:
    check(seed["khataNumber"]["isVerified"], "approved seeded record still renders as verified")

# --- manual entry: officer adds a holder and a plot ---
from db_service import add_owner_to_parcel, add_plot_to_parcel
from record_builder import manual_entry_record
blank = manual_entry_record("Andhra Pradesh", "Adangal", "దొడ్డిమడి", "", "test: no extraction")
from validation_engine import score_record as _s
_s(blank)
mp = save_extracted_record(blank, db)
r = add_owner_to_parcel(mp.id, {"name": "మర్రెడ్డి సత్యనారాయణ రెడ్డి", "relative_name": "", "share_fraction": "1/1"}, db)
check(r and len(r["owners"]) == 1 and r["owners"][0]["name"]["isVerified"], "officer can add a holder to a manual-entry record")
r = add_plot_to_parcel(mp.id, {"khasra_number": "299A", "area_text": "4.00 acre"}, db)
check(r and len(r["plots"]) == 1 and r["plots"][0]["areaInSqMeters"] > 16000, "officer can add a plot (area parsed)")

# --- dashboard ---
from dashboard import compute_dashboard
dash = compute_dashboard(db)
check(dash["documentsProcessed"] == before + 3, "dashboard counts documents")
check(dash["pendingVerification"] >= 3 and dash["errorStats"]["open"] > 0, "dashboard pending + error stats")
check(any(s["state"] == "Uttar Pradesh" for s in dash["progress"]), "dashboard state/district progress")
print("   dashboard:", {k: dash[k] for k in ("documentsProcessed", "avgConfidence", "extractionAccuracy", "pendingVerification")})

# ---- Day 2: re-scoring, roles/login, chained audit trail ----------------------------
import auth, audit_chain
from models import ParcelRecord, AuditLogEntry
print("\nroles / audit chain:")
seeded = db.query(ParcelRecord).filter(ParcelRecord.id == "rec-up-jaunpur-548").first()
if seeded:
    check(seeded.field_meta_json is not None, "seeded record re-scored with computed confidence")
check(auth.authenticate(db, "verifier", os.getenv("DEMO_PASSWORD", "demo@123")) is not None, "demo verifier can log in")
check(auth.authenticate(db, "verifier", "wrong") is None, "wrong password rejected")
tok = auth.issue_token("operator")
check(auth._read_token(tok) == "operator", "token round-trips")
check(auth._read_token(tok[:-2] + "00") is None, "tampered token rejected")
check("approve" not in auth.ROLE_PERMISSIONS["operator"], "operator cannot approve")
check("ingest" not in auth.ROLE_PERMISSIONS["verifier"], "verifier cannot upload (separation of duties)")

v = audit_chain.verify_chain(db)
check(v["intact"] and v["entries"] > 0, f"audit chain intact ({v['entries']} entries) {'' if v['intact'] else v}")
conf = update_parcel_field(ids[0], "khataNumber", "", "Test Officer", db, mode="confirm")
last = db.query(AuditLogEntry).order_by(AuditLogEntry.seq.desc()).first()
check(last.action == "CONFIRMED_MATCH" and last.prev_hash == v.get("headHash"), "new entry links to previous hash")
last.new_value = "tampered"; db.commit()
check(not audit_chain.verify_chain(db)["intact"], "editing a past audit entry is detected")

# ---- Learning loop -------------------------------------------------------------------
import learning
print("\nlearning loop:")
a, b = get_parcel_by_id(ids[0], db), get_parcel_by_id(ids[1], db)
idx = next((i for i in range(min(len(a["owners"]), len(b["owners"])))
            if a["owners"][i]["name"]["value"] == b["owners"][i]["name"]["value"]
            and not a["owners"][i]["name"].get("verifiedBy") and not b["owners"][i]["name"].get("verifiedBy")), None)
check(idx is not None, "found the same unreviewed owner field on both uploads")
if idx is not None:
    misread = a["owners"][idx]["name"]["value"]
    for rec in (a, b):
        update_parcel_field(rec["id"], rec["owners"][idx]["name"]["key"], "सुधारित नाम", "Officer A", db)
    rules = learning.learned_rules(db, "Uttar Pradesh")
    check(any(r["to"] == "सुधारित नाम" for r in rules.values()), "two identical corrections create a learned rule")
    rec3 = extract_land_record_from_image(data, "Uttar Pradesh", "Khasra-Khatauni", "", "")
    n = learning.apply_learned_rules(rec3, db)
    score_record(rec3); learning.calibrate(rec3, db)
    f = rec3["owners"][idx]["name"]
    check(n >= 1, f"learned rule applied to the next upload ({n} field)")
    check(f["value"] == "सुधारित नाम", f"field value auto-corrected (got {f['value']!r})")
    check((f.get("learnedCorrection") or {}).get("from") == misread, "original machine reading kept with the correction")
    check(not f["isVerified"] and f["confidenceTier"] != "high", "auto-corrected field still needs officer review")
    check("सुधारित नाम" in learning.prompt_hints(db, "Uttar Pradesh"), "correction is fed into the extraction prompt")
    p3 = save_extracted_record(rec3, db)
    d3 = p3.to_dict()
    key3 = d3["owners"][idx]["name"]["key"]
    update_parcel_field(p3.id, key3, misread, "Officer B", db)          # officer reverts the rule
    check(not any(r["to"] == "सुधारित नाम" for r in learning.learned_rules(db, "Uttar Pradesh").values()),
          "an officer revert weakens the rule below the threshold")
st = learning.learning_stats(db)
check(st["reviewsLogged"] >= 3 and st["accuracySeries"], f"accuracy-over-time series ({st['reviewsLogged']} reviews)")

# ---- Govt comparison, consistency, history, GIS ---------------------------------------
import govt_registry, consistency
print("\ngovt dataset / checks:")
# fresh upload (the learning test above renamed a holder on ids[0] / ids[1])
_fresh = extract_land_record_from_image(data, "Uttar Pradesh", "Khasra-Khatauni", "", "")
score_record(_fresh)
up = save_extracted_record(_fresh, db).to_dict()
cmp = govt_registry.compare(up)
check(cmp["found"] and cmp["khata"] == "00287", "uploaded PDF matched to govt khata 00287")
n_up = len([o for o in up["owners"] if o["name"]["value"]])
check(n_up == 11, f"PDF column reader found all 11 holders (got {n_up})")
missing_holders = [r for r in cmp["rows"] if r["section"] == "Owners" and r["status"] == "missing_in_upload" and r["field"].startswith("Holder")]
check(not missing_holders, f"no govt holder missing from the upload ({[r['govt'] for r in missing_holders]})")
names = [o["name"]["value"] for o in up["owners"]]
check(not any(re.search(r"\d|\)", n) for n in names), "holder names clean (no serial numbers / junk rows)")
check(not any(re.search(r"\S[\u0941\u0942] \S{1,3}(\s|$)", n) for n in names), "no kerning-split names left (e.g. 'कु मार')")
hist = govt_registry.history(up)
check(len(hist["timeline"]) >= 4, "history has govt versions + the upload")
check(any("still listed" in f["message"] for f in hist["flags"]), "history flags the 2023 order that was not reflected in the record")
seeds = {p["id"]: p for p in get_all_parcels(db)}
bal = seeds.get("rec-up-861-193")
if bal:
    res = {x["id"]: x for x in consistency.check(bal)["results"]}
    check(res["C05"]["status"] == "fail", "consistency: Ballia shares do not add up to the total")
    check(res["C10"]["status"] == "fail", "consistency: fasli 1426 vs 2026 mismatch caught")
summ = consistency.summarize(get_all_parcels(db))
check(summ["recordsChecked"] == len(get_all_parcels(db)), "consistency summary covers every record")
v = govt_registry.village_for(up)
gj = govt_registry.village_geojson(v, {}, ["365"])
check(len(gj["features"]) > 10 and any(f["properties"]["inCurrentRecord"] for f in gj["features"]), "GIS: village plots with the record's plot highlighted")

# ---- Citizen findings ------------------------------------------------------------------
import citizen_checks, pypdfium2
print("\ncitizen findings:")
_txt = "\n".join(pg.get_textpage().get_text_range() for pg in pypdfium2.PdfDocument(pdf.read_bytes()))
_f = citizen_checks.findings(up, _txt)
check(any(x["kind"] == "order_not_applied" for x in _f), "order printed in the khatauni but not applied is reported to the citizen")
check(any(x["kind"] == "mortgage" for x in _f), "bank mortgage reported to the citizen")
check(all(x["action"]["hi"] and x["action"]["en"] for x in _f), "every finding says what the citizen can do (Hindi + English)")

# ---- Real bounding boxes from the PDF text layer ---------------------------------------
print("\nbounding boxes:")
b = get_parcel_by_id(ids[0], db)
kb = b["khataNumber"]
check(kb.get("hasBoundingBox") and 0 <= kb["boundingBox"]["x"] <= 100 and 0 <= kb["boundingBox"]["y"] <= 100, f"khata box measured from the PDF: {kb.get('boundingBox')}")
ob = [o["name"] for o in b["owners"] if o["name"].get("hasBoundingBox")]
check(len(ob) >= 3, f"{len(ob)} owner name boxes measured")
if ob and kb.get("hasBoundingBox"):
    check(kb["boundingBox"]["y"] < ob[0]["boundingBox"]["y"], "khata (header) sits above the owners table")
seed = get_parcel_by_id("rec-up-jaunpur-548", db)
if seed:
    check(not seed["khataNumber"].get("hasBoundingBox"), "seed record without measured positions shows no box")

try:
    from fastapi.testclient import TestClient
    import main
    c = TestClient(main.app)
    check(c.get("/api/parcels").status_code == 401, "API refuses calls without login")
    t = c.post("/api/auth/login", json={"username": "operator", "password": os.getenv("DEMO_PASSWORD", "demo@123")}).json()["token"]
    h = {"Authorization": f"Bearer {t}"}
    check(c.get("/api/parcels", headers=h).status_code == 200, "operator can read")
    check(c.post(f"/api/parcels/{ids[0]}/approve", json={}, headers=h).status_code == 403, "operator gets 403 on approve")
except ImportError as e:
    print(f"  (skipped HTTP checks: {e})")

print("\nALL PASSED" if ok else "\nSOME CHECKS FAILED — paste this output back to Claude")
shutil.rmtree(tmp, ignore_errors=True)
