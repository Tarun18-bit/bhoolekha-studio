"""
Validation engine — runs on EVERY extracted record, whatever produced it
(statutory PDF parser, Gemini vision, local Tesseract, or nothing).

1. score_record()   : per-field confidence computed from explicit checks, with the
                      reasons kept so the officer can see *why* a field is low.
2. cross_verify()   : compares the record against the (mock) LRMS master database
                      and against records already digitized — conflicts become
                      discrepancies, never silent overwrites.
3. file_sha256()    : identical-file duplicate detection.

Nothing here marks a field as verified. Only an officer can do that.
"""
import base64
import difflib
import hashlib
import re
import unicodedata
from typing import Any, Dict, Iterable, List, Optional, Tuple

from revenue_math import parse_regional_land_area, verify_parcel_arithmetic

HIGH, MEDIUM = 0.90, 0.75          # tier thresholds (same as the UI legend)

SOURCE_BASE = {                    # prior trust in each extraction route
    "statutory_pdf_text": 0.97,    # text layer of a digitally issued RoR — no OCR involved
    "gemini_vision": 0.86,         # multimodal model reading a scan
    "tesseract": None,             # use Tesseract's own per-word confidence
    "manual_required": 0.0,
    "none": 0.0,
}

PLACEHOLDERS = {"", "-", "—", "n/a", "na", "null", "none", "unknown", "?"}
ILLEGIBLE_MARKERS = ("अपठनीय", "अस्पष्ट", "అస్పష్టం", "illegible", "faded", "[स्याही")
_INDIC_DIGITS = str.maketrans("०१२३४५६७८९౦౧౨౩౪౫౬౭౮౯", "01234567890123456789")
SCRIPT_RANGES = {
    "Hindi": r"[ऀ-ॿ]", "Marathi": r"[ऀ-ॿ]",
    "Telugu": r"[ఀ-౿]", "Tamil": r"[஀-௿]",
}


# ---------------------------------------------------------------- helpers
def file_sha256(image_base64: str) -> str:
    raw = base64.b64decode(image_base64.split(",")[-1])
    return hashlib.sha256(raw).hexdigest()


def norm_text(s: Any) -> str:
    """Normalise names for comparison: NFC, digits→ASCII, drop spaces/nukta/punctuation."""
    s = unicodedata.normalize("NFC", str(s or "")).translate(_INDIC_DIGITS).lower()
    s = s.replace("़", "")                       # nukta
    s = re.sub(r"\(.*?\)", "", s)                     # bracketed transliterations
    s = re.sub(r"[\s\.\,\-\:\;'\"`·]+", "", s)
    return s


def norm_num(s: Any) -> str:
    """'00548' / '००५४८' / 'खाता 548' → '548'."""
    d = "".join(ch for ch in str(s or "").translate(_INDIC_DIGITS) if ch.isdigit())
    return d.lstrip("0") or ("0" if d else "")


def norm_khasra(s: Any) -> str:
    s = str(s or "").translate(_INDIC_DIGITS)
    s = re.sub(r"(गाटा|खसरा|गट|सर्वे|survey|khasra|gata|no\.?)", "", s, flags=re.I)
    return re.sub(r"[\s\-]+", "", s).upper().lstrip("0")


def similarity(a: str, b: str) -> float:
    a, b = norm_text(a), norm_text(b)
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def tier_for(c: float) -> str:
    return "high" if c >= HIGH else ("medium" if c >= MEDIUM else "low")


def is_blank(v: Any) -> bool:
    return str(v or "").strip().lower() in PLACEHOLDERS


def is_illegible(v: Any) -> bool:
    s = str(v or "").lower()
    return any(m.lower() in s for m in ILLEGIBLE_MARKERS)


# ---------------------------------------------------------------- per-field checks
def _check_khata(v: str) -> Tuple[bool, str]:
    ok = bool(re.fullmatch(r"\d{1,6}[A-Za-z]?", re.sub(r"\s|\(.*?\)", "", str(v).translate(_INDIC_DIGITS))))
    return ok, "format ok (1–6 digits)" if ok else "not a valid khata number format"


def _check_khasra(v: str) -> Tuple[bool, str]:
    ok = bool(re.fullmatch(r"\d{1,5}(?:[/\-]?[0-9A-Za-zऀ-ॿఀ-౿]{1,4}){0,2}", norm_khasra(v)))
    return ok, "format ok" if ok else "not a valid khasra/survey number format"


def _check_area(v: str) -> Tuple[bool, str]:
    sq = parse_regional_land_area(v).get("sq_meters", 0)
    ok = sq > 0
    return ok, f"parsed to {sq:,.0f} m²" if ok else "area/unit could not be parsed"


def _check_name(v: str, lang: str) -> Tuple[bool, str]:
    s = str(v).strip()
    if re.search(r"\d", s.translate(_INDIC_DIGITS)):
        return False, "name contains digits (likely a row number or area leaked in)"
    if len(norm_text(s)) < 2:
        return False, "name too short"
    rng = SCRIPT_RANGES.get(lang)
    if rng and not re.search(rng, s) and not re.search(r"[A-Za-z]", s):
        return False, f"not in expected {lang} script"
    return True, "plausible name"


def _check_year(v: str) -> Tuple[bool, str]:
    nums = [int(n) for n in re.findall(r"\d{4}", str(v).translate(_INDIC_DIGITS))]
    ok = bool(nums) and all(1200 <= n <= 2100 for n in nums)
    return ok, "year in plausible range" if ok else "year missing or implausible"


def _score_field(field: Dict[str, Any], check, source: str, uncertain: Iterable[str],
                 extra_penalty: float = 1.0, extra_reason: Optional[str] = None) -> float:
    if not isinstance(field, dict):
        return 0.0
    v = field.get("value", "")
    reasons: List[str] = []
    base = SOURCE_BASE.get(source)
    if base is None:
        base = float(field.get("sourceConfidence") or 0.0)
    if is_blank(v):
        c, reasons = 0.0, ["not extracted — manual entry needed"]
    elif is_illegible(v):
        c, reasons = 0.2, ["marked illegible on the scan"]
    else:
        c = base
        reasons.append(f"source: {source} ({base:.2f})")
        if check:
            ok, why = check(v)
            reasons.append(why)
            if not ok:
                c *= 0.6
        if field.get("key") in uncertain or field.get("label") in uncertain:
            c *= 0.75
            reasons.append("extraction model flagged this field as uncertain")
        if extra_penalty != 1.0:
            c *= extra_penalty
            if extra_reason:
                reasons.append(extra_reason)
    c = round(max(0.0, min(1.0, c)), 3)
    field["confidence"] = c
    field["confidenceTier"] = tier_for(c)
    field["confidenceReasons"] = reasons
    field["isVerified"] = False
    if field["confidenceTier"] != "high":
        field["discrepancyNote"] = "Low confidence: " + "; ".join(reasons)
    return c


def score_record(rec: Dict[str, Any]) -> Dict[str, Any]:
    """Compute confidence for every field and route the record."""
    source = rec.get("extractionSource") or "none"
    lang = rec.get("primaryLanguage", "Hindi")
    unc = set(rec.get("uncertainFields") or [])

    # area arithmetic is a cross-field signal
    plots = rec.get("plots") or []
    total = float(rec.get("totalStatedAreaInSqMeters") or 0)
    arith_ok, arith_msg = True, None
    if total > 0 and plots and all(p.get("areaInSqMeters") for p in plots):
        m = verify_parcel_arithmetic(total, [p["areaInSqMeters"] for p in plots])
        arith_ok = m["is_consistent"] or m["percentage_variance"] <= 0.5
        if not arith_ok:
            arith_msg = m["message"]
            if not any(d.get("fieldKey") == "totalStatedArea" and "rithmetic" in d.get("title", "")
                       for d in rec.get("discrepancies", [])):
                rec.setdefault("discrepancies", []).append({
                    "id": "disc-arith", "fieldKey": "totalStatedArea",
                    "title": "Sub-parcel area arithmetic does not add up",
                    "description": arith_msg, "severity": m["severity"],
                    "suggestedAction": "Re-read plot areas on the scan; check mutation register.",
                    "status": "PENDING_REVIEW"})

    scores: List[float] = []
    scores.append(_score_field(rec.get("khataNumber"), _check_khata, source, unc))
    if not is_blank((rec.get("fasliYear") or {}).get("value")):
        scores.append(_score_field(rec.get("fasliYear"), _check_year, source, unc))
    scores.append(_score_field(rec.get("totalStatedArea"), _check_area, source, unc,
                               0.8 if not arith_ok else 1.0,
                               "plot areas do not sum to total" if not arith_ok else None))
    for o in rec.get("owners") or []:
        scores.append(_score_field(o.get("name"), lambda v: _check_name(v, lang), source, unc))
        if not is_blank((o.get("relativeName") or {}).get("value")):
            scores.append(_score_field(o.get("relativeName"), lambda v: _check_name(v, lang), source, unc))
        _score_field(o.get("shareFraction"), None, source, unc)
    if not rec.get("owners"):
        scores.append(0.0)  # a record with no owners read is not usable
    for p in plots:
        scores.append(_score_field(p.get("khasraNumber"), _check_khasra, source, unc))
        scores.append(_score_field(p.get("regionalAreaText"), _check_area, source, unc,
                                   0.8 if not arith_ok else 1.0,
                                   "plot areas do not sum to total" if not arith_ok else None))
        _score_field(p.get("landClassification"), None, source, unc)
        _score_field(p.get("annualRevenueLagaan"), None, source, unc)
    if not plots:
        scores.append(0.0)

    rec["overallConfidence"] = round(sum(scores) / len(scores), 3) if scores else 0.0
    low = _count_tiers(rec)
    rec["confidenceSummary"] = low
    _route(rec)
    return rec


def _iter_fields(rec):
    for k in ("khataNumber", "fasliYear", "totalStatedArea"):
        if isinstance(rec.get(k), dict):
            yield rec[k]
    for o in rec.get("owners") or []:
        for k in ("name", "relativeName", "shareFraction"):
            if isinstance(o.get(k), dict):
                yield o[k]
    for p in rec.get("plots") or []:
        for k in ("khasraNumber", "regionalAreaText", "landClassification", "annualRevenueLagaan"):
            if isinstance(p.get(k), dict):
                yield p[k]


def _count_tiers(rec) -> Dict[str, int]:
    out = {"high": 0, "medium": 0, "low": 0}
    for f in _iter_fields(rec):
        optional = any(t in str(f.get("key", "")) for t in ("-share", "-class", "-tax", "fasli"))
        if optional and is_blank(f.get("value")):
            continue  # an empty optional column is not a review item
        out[f.get("confidenceTier", "low")] += 1
    return out


def _route(rec):
    """IN_REVIEW if anything needs a human beyond routine sign-off."""
    open_high = any(d.get("severity") == "high" and d.get("status") != "RESOLVED"
                    for d in rec.get("discrepancies", []))
    cs = rec.get("confidenceSummary") or _count_tiers(rec)
    rec["needsReview"] = bool(open_high or cs["low"] or cs["medium"] or rec["overallConfidence"] < HIGH)
    rec["verificationStatus"] = "IN_REVIEW" if rec["needsReview"] else "DRAFT_AI_EXTRACTION"
    rec["reviewReasons"] = (
        ([f"{cs['low']} low-confidence field(s)"] if cs["low"] else []) +
        ([f"{cs['medium']} medium-confidence field(s)"] if cs["medium"] else []) +
        (["unresolved high-severity discrepancy"] if open_high else []))


# ---------------------------------------------------------------- cross-verification
def _disc(id_, field, title, desc, sev, action):
    return {"id": id_, "fieldKey": field, "title": title, "description": desc,
            "severity": sev, "suggestedAction": action, "status": "PENDING_REVIEW"}


def _owner_names(rec) -> List[str]:
    return [o["name"]["value"] for o in rec.get("owners") or []
            if isinstance(o.get("name"), dict) and not is_blank(o["name"]["value"])
            and not is_illegible(o["name"]["value"])]


def _khasras(rec) -> List[str]:
    return [norm_khasra(p["khasraNumber"]["value"]) for p in rec.get("plots") or []
            if isinstance(p.get("khasraNumber"), dict) and not is_blank(p["khasraNumber"]["value"])]


def _same_village(a: str, b: str) -> bool:
    return similarity(a, b) >= 0.8 or (norm_text(a) and norm_text(a) in norm_text(b)) or \
        (norm_text(b) and norm_text(b) in norm_text(a))


def _match_owner_sets(extracted: List[str], master: List[str]) -> Tuple[List[str], List[str], List[Tuple[str, str, float]]]:
    """Returns (extracted names not in master, master names not extracted, matched pairs)."""
    unmatched_ex, matched, used = [], [], set()
    for n in extracted:
        best, best_s = None, 0.0
        for i, m in enumerate(master):
            if i in used:
                continue
            s = similarity(n, m)
            if s > best_s:
                best, best_s = i, s
        if best is not None and best_s >= 0.75:
            used.add(best)
            matched.append((n, master[best], best_s))
        else:
            unmatched_ex.append(n)
    missing = [m for i, m in enumerate(master) if i not in used]
    return unmatched_ex, missing, matched


def _boost(field: Dict[str, Any], reason: str):
    if isinstance(field, dict) and not is_blank(field.get("value")):
        field["confidence"] = max(field.get("confidence", 0), 0.97)
        field["confidenceTier"] = tier_for(field["confidence"])
        field.setdefault("confidenceReasons", []).append(reason)
        if field["confidenceTier"] == "high":
            field["discrepancyNote"] = None


def _penalise(field: Dict[str, Any], reason: str):
    if isinstance(field, dict):
        field["confidence"] = round(field.get("confidence", 0) * 0.6, 3)
        field["confidenceTier"] = tier_for(field["confidence"])
        field.setdefault("confidenceReasons", []).append(reason)
        field["discrepancyNote"] = "Low confidence: " + "; ".join(field["confidenceReasons"])
        field["hasDiscrepancy"] = True


def cross_verify(rec: Dict[str, Any], lrms_rows: List[Dict[str, Any]],
                 existing: List[Dict[str, Any]], sha: Optional[str]) -> Dict[str, Any]:
    """
    lrms_rows : mock LRMS master records (dicts: state, district, village, khata,
                khasras[list], owners[list of names], total_sq_m)
    existing  : already-digitized parcels (dicts: id, village, khata, khasras, owners, file_sha256)
    """
    discs = rec.setdefault("discrepancies", [])
    village = rec.get("village", "")
    khata = norm_num((rec.get("khataNumber") or {}).get("value"))
    khasras = set(_khasras(rec))
    owners = _owner_names(rec)
    result = {"lrmsMatch": None, "duplicates": [], "conflicts": []}

    # 1 — identical file already ingested
    if sha:
        for e in existing:
            if e.get("file_sha256") == sha:
                discs.append(_disc("disc-dup-file", "khataNumber", "Duplicate upload — identical file",
                                   f"This exact file (SHA-256 {sha[:12]}…) was already digitized as parcel "
                                   f"{e['id']}. Saved as a new draft; nothing was overwritten.",
                                   "high", f"Discard this draft or confirm it should replace {e['id']}."))
                result["duplicates"].append(e["id"])
                break

    # 2 — same khata / khasra already digitized in this village
    for e in existing:
        if e["id"] in result["duplicates"] or not _same_village(village, e.get("village", "")):
            continue
        same_khata = khata and khata == norm_num(e.get("khata"))
        shared_plots = khasras & set(e.get("khasras") or [])
        if same_khata:
            ex_unmatched, _, _ = _match_owner_sets(owners, e.get("owners") or [])
            if owners and ex_unmatched:
                discs.append(_disc(f"disc-conflict-{e['id']}", "owners",
                                   "Conflicting ownership for an already-digitized khata",
                                   f"Khata {khata} in {village} is already digitized as {e['id']} with different "
                                   f"holders. Not in existing record: {', '.join(ex_unmatched[:5])}.",
                                   "high", "Check mutation register — this may be a newer mutation or a forged record."))
                result["conflicts"].append(e["id"])
            else:
                discs.append(_disc(f"disc-dup-{e['id']}", "khataNumber", "Possible duplicate record",
                                   f"Khata {khata} in {village} is already digitized as {e['id']}.",
                                   "medium", "Compare both records and keep one."))
                result["duplicates"].append(e["id"])
        elif shared_plots:
            discs.append(_disc(f"disc-plot-{e['id']}", "plots", "Plot claimed under two khatas",
                               f"Khasra {', '.join(sorted(shared_plots))} also appears under khata "
                               f"{e.get('khata')} ({e['id']}).",
                               "high", "Verify which account the plot belongs to before approval."))
            result["conflicts"].append(e["id"])

    # 3 — LRMS master cross-verification
    village_known = not is_blank(village)
    cands = [r for r in lrms_rows if _same_village(village, r.get("village", ""))] if village_known else list(lrms_rows)
    master = None
    for r in cands:
        if khata and khata == norm_num(r.get("khata")):
            # without a village, a khata number alone is ambiguous: require a plot or owner overlap
            if not village_known:
                r_plots = {norm_khasra(k) for k in r.get("khasras") or []}
                _, _, m = _match_owner_sets(owners, r.get("owners") or [])
                if not (khasras & r_plots or m):
                    continue
            master = r
            break
    if master is None:
        for r in cands:
            if khasras & {norm_khasra(k) for k in r.get("khasras") or []}:
                master = r
                break

    if master is None:
        discs.append(_disc("disc-lrms-missing", "khataNumber", "Not found in LRMS master",
                           f"No LRMS record for khata {khata or '?'} in village '{village or '?'}'. "
                           "Cannot cross-verify against the government database.",
                           "medium", "Confirm village and khata; new records need field verification."))
        result["lrmsMatch"] = "not_found"
    else:
        result["lrmsMatch"] = master.get("id")
        problems = 0
        if khata and khata != norm_num(master.get("khata")):
            problems += 1
            _penalise(rec.get("khataNumber"), f"differs from LRMS khata {master.get('khata')}")
            discs.append(_disc("disc-lrms-khata", "khataNumber", "Khata number differs from LRMS",
                               f"Extracted {khata}, LRMS has {master.get('khata')} for the same plot.",
                               "high", "Re-read the khata number on the scan."))
        else:
            _boost(rec.get("khataNumber"), "matches LRMS master")

        ex_unmatched, missing, matched = _match_owner_sets(owners, master.get("owners") or [])
        matched_names = {a for a, _, _ in matched}
        for o in rec.get("owners") or []:
            nm = o.get("name", {}).get("value")
            if nm in matched_names:
                _boost(o["name"], "matches LRMS owner list")
            elif nm in ex_unmatched:
                _penalise(o["name"], "not present in LRMS owner list")
        if ex_unmatched:
            problems += 1
            discs.append(_disc("disc-lrms-owner-extra", "owners", "Holder not in LRMS record",
                               f"Not found in LRMS: {', '.join(ex_unmatched[:6])}.",
                               "high", "Possible OCR error, unrecorded mutation, or forged entry — verify."))
        if missing and owners:
            problems += 1
            discs.append(_disc("disc-lrms-owner-missing", "owners", "LRMS holders missing from document",
                               f"In LRMS but not read from this document: {', '.join(missing[:6])}.",
                               "medium", "Check whether these names are on the scan but were missed."))

        m_total = float(master.get("total_sq_m") or 0)
        r_total = float(rec.get("totalStatedAreaInSqMeters") or 0)
        if m_total and r_total:
            var = abs(r_total - m_total) / m_total * 100
            if var > 2.0:
                problems += 1
                _penalise(rec.get("totalStatedArea"), f"differs from LRMS area by {var:.1f}%")
                discs.append(_disc("disc-lrms-area", "totalStatedArea", "Area differs from LRMS",
                                   f"Document: {r_total:,.0f} m², LRMS: {m_total:,.0f} m² ({var:.1f}% variance).",
                                   "high" if var > 5 else "medium",
                                   "Check for partition/mutation; verify against Bhu-Naksha."))
            else:
                _boost(rec.get("totalStatedArea"), "matches LRMS area (±2%)")
        rec["lrmsVerification"] = {"masterId": master.get("id"), "problems": problems,
                                   "ownersMatched": len(matched), "ownersInMaster": len(master.get("owners") or [])}

    rec["crossVerification"] = result
    # recompute overall + routing after boosts/penalties
    fields = list(_iter_fields(rec))
    core = [f for f in fields if f.get("key") and not any(s in f["key"] for s in ("-share", "-class", "-tax"))]
    if core:
        rec["overallConfidence"] = round(sum(f.get("confidence", 0) for f in core) / len(core), 3)
    rec["confidenceSummary"] = _count_tiers(rec)
    _route(rec)
    return rec
