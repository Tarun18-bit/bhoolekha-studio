"""
Simulated government land-records registry (stand-in for a state LRMS / Bhulekh / Bhu-Naksha API).
Data: govt_data/govt_land_records.json (see govt_data/build_dataset.py for provenance).
To connect a real API later, replace load() / find() and keep the rest.

Provides:
  find(record)        -> (village, khata) the uploaded record corresponds to
  compare(record)     -> field-by-field report: match / mismatch / missing on either side
  history(record)     -> versions across fasli years, diffs, and mutation-consistency flags
  village_geojson(..) -> plots of a village as GeoJSON for the map
"""
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from validation_engine import norm_text, norm_num, norm_khasra, similarity

_DIR = Path(__file__).parent / "govt_data"
# The real transcription of the sample PDF is kept local-only (gitignored); the committed copy is anonymised.
DATA = _DIR / "govt_land_records.local.json" if (_DIR / "govt_land_records.local.json").exists() else _DIR / "govt_land_records.json"
SOURCE_LABEL = "Simulated govt land-records dataset (no public API) — see govt_data/build_dataset.py"
NAME_MATCH = 0.80


@lru_cache(maxsize=1)
def load() -> Dict[str, Any]:
    return json.loads(DATA.read_text(encoding="utf-8"))


def villages() -> List[Dict[str, Any]]:
    return load()["villages"]


def _v(field: Any) -> str:
    return (field or {}).get("value", "") if isinstance(field, dict) else str(field or "")


def _clean_name(s: str) -> str:
    s = re.sub(r"^\s*[\d\.\)\(]+\s*", "", s or "")          # leading serials like "1)" / "1.1)"
    s = re.sub(r"(स्व0|स्व\.|श्री|श्रीमती)\s*", "", s)
    return s.strip()


def _same_person(a: str, b: str) -> float:
    a, b = _clean_name(a), _clean_name(b)
    if not a or not b:
        return 0.0
    if norm_text(a) == norm_text(b):
        return 1.0
    return similarity(a, b)


def village_matches(v: Dict[str, Any], name: str) -> bool:
    n = norm_text(name)
    if not n:
        return False
    return any(norm_text(a) and (norm_text(a) in n or n in norm_text(a)) for a in [v["village"], *v.get("aliases", [])])


def find(rec: Dict[str, Any]) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
    khata = norm_num(_v(rec.get("khataNumber")))
    khasras = {norm_khasra(_v(p.get("khasraNumber"))) for p in rec.get("plots") or []} - {""}
    best = None
    for v in villages():
        vmatch = village_matches(v, rec.get("village", ""))
        for k in v["khatas"]:
            cur = k["versions"][-1]
            kmatch = khata and norm_num(k["khata"]) == khata
            pmatch = bool(khasras & {norm_khasra(p["khasra"]) for p in cur["plots"]})
            score = (2 if kmatch else 0) + (2 if vmatch else 0) + (1 if pmatch else 0)
            if (kmatch and (vmatch or pmatch)) or (vmatch and pmatch):
                if not best or score > best[0]:
                    best = (score, v, k)
    return (best[1], best[2]) if best else None


def _pair_owners(up: List[Dict[str, str]], gov: List[Dict[str, str]]):
    """Greedy best-match pairing of uploaded vs govt owners."""
    pairs, used = [], set()
    cands = sorted(((_same_person(u["name"], g["name"]), i, j) for i, u in enumerate(up) for j, g in enumerate(gov)),
                   reverse=True)
    taken_u = set()
    for s, i, j in cands:
        if s < NAME_MATCH or i in taken_u or j in used:
            continue
        pairs.append((i, j, s)); taken_u.add(i); used.add(j)
    return pairs, [i for i in range(len(up)) if i not in taken_u], [j for j in range(len(gov)) if j not in used]


def _num(s: str) -> Optional[float]:
    m = re.search(r"\d+(?:\.\d+)?", str(s or "").translate(str.maketrans("०१२३४५६७८९", "0123456789")))
    return float(m.group()) if m else None


def _removed_by_mutation(k: Dict[str, Any], name: str) -> Optional[Dict[str, Any]]:
    for ver in k["versions"]:
        for m in ver.get("mutations", []):
            if any(_same_person(name, r) >= NAME_MATCH for r in m.get("removed", [])):
                return m
    return None


def compare(rec: Dict[str, Any]) -> Dict[str, Any]:
    hit = find(rec)
    if not hit:
        return {"found": False, "source": SOURCE_LABEL,
                "message": "No matching khata found in the government dataset for this village/khata/khasra."}
    v, k = hit
    cur = k["versions"][-1]
    rows: List[Dict[str, Any]] = []

    def row(section, field, uploaded, govt, status, note=""):
        rows.append({"section": section, "field": field, "uploaded": uploaded, "govt": govt, "status": status, "note": note})

    # header
    row("Record", "Village", rec.get("village", ""), v["village"],
        "match" if village_matches(v, rec.get("village", "")) else ("missing_in_upload" if not rec.get("village") else "mismatch"))
    up_k = _v(rec.get("khataNumber"))
    row("Record", "Khata number", up_k, k["khata"],
        "missing_in_upload" if not up_k else ("match" if norm_num(up_k) == norm_num(k["khata"]) else "mismatch"))
    up_f = _v(rec.get("fasliYear"))
    gf = cur.get("fasli", "")
    row("Record", "Fasli year", up_f, gf,
        "missing_in_upload" if not up_f else ("match" if gf[:4] in up_f.translate(str.maketrans("०१२३४५६७८९", "0123456789")) else "mismatch"))
    up_area = float(rec.get("totalStatedAreaInSqMeters") or 0)
    g_area = cur["totalAreaHa"] * 10000
    if not up_area:
        row("Record", "Total area", "", f"{cur['totalAreaHa']:.4f} ha", "missing_in_upload")
    else:
        diff = abs(up_area - g_area) / g_area if g_area else 1
        row("Record", "Total area", f"{up_area / 10000:.4f} ha", f"{cur['totalAreaHa']:.4f} ha",
            "match" if diff <= 0.01 else "mismatch", "" if diff <= 0.01 else f"differs by {diff:.0%}")

    # owners
    up_owners = [{"name": _v(o.get("name")), "relative": _v(o.get("relativeName")), "share": _v(o.get("shareFraction"))}
                 for o in rec.get("owners") or [] if _v(o.get("name"))]
    pairs, extra_up, missing_up = _pair_owners(up_owners, cur["owners"])
    for i, j, s in sorted(pairs, key=lambda p: p[1]):
        u, g = up_owners[i], cur["owners"][j]
        st = "match" if s >= 0.95 else "mismatch"
        row("Owners", f"Holder: {g['name']}", u["name"], g["name"], st, "" if st == "match" else "spelling differs")
        if g.get("relative") or u["relative"]:
            rs = _same_person(u["relative"], g["relative"])
            row("Owners", f"  father/husband of {g['name']}", u["relative"], g["relative"],
                "missing_in_upload" if not u["relative"] else ("match" if rs >= 0.9 else "mismatch"))
        if g.get("share") or u["share"]:
            gs, us = _num(g.get("share", "")), _num(u["share"])
            st2 = ("missing_in_upload" if not u["share"] else "missing_in_govt" if not g.get("share")
                   else "match" if gs is not None and us is not None and abs(gs - us) < 1e-4 else "mismatch")
            row("Owners", f"  share of {g['name']}", u["share"], g.get("share", ""), st2)
    for j in missing_up:
        g = cur["owners"][j]
        row("Owners", f"Holder: {g['name']}", "", f"{g['name']} / {g['relative']}", "missing_in_upload",
            "on the govt record but not read from the upload")
    for i in extra_up:
        u = up_owners[i]
        m = _removed_by_mutation(k, u["name"])
        note = (f"govt record shows this holder removed by {m['type']} on {m['date']}" if m
                else "not on the govt record — check for a pending mutation or a misread row")
        row("Owners", f"Holder: {u['name']}", u["name"], "", "missing_in_govt", note)

    # plots
    up_plots = {norm_khasra(_v(p.get("khasraNumber"))): p for p in rec.get("plots") or [] if _v(p.get("khasraNumber"))}
    for gp in cur["plots"]:
        key = norm_khasra(gp["khasra"])
        up = up_plots.pop(key, None)
        if not up:
            row("Plots", f"Khasra {gp['khasra']}", "", f"{gp['areaHa']:.4f} ha", "missing_in_upload")
            continue
        ua = float(up.get("areaInSqMeters") or 0)
        diff = abs(ua - gp["areaHa"] * 10000) / (gp["areaHa"] * 10000) if gp["areaHa"] else 1
        row("Plots", f"Khasra {gp['khasra']} area", f"{ua / 10000:.4f} ha" if ua else "", f"{gp['areaHa']:.4f} ha",
            "missing_in_upload" if not ua else ("match" if diff <= 0.01 else "mismatch"))
    for key, up in up_plots.items():
        row("Plots", f"Khasra {_v(up.get('khasraNumber'))}", _v(up.get("khasraNumber")), "", "missing_in_govt",
            "plot not on this khata in the govt record")

    # encumbrance
    up_loans = [d for d in rec.get("discrepancies") or [] if re.search(r"bank|बंधक|बैंक|mortgage", (d.get("id", "") + d.get("title", "")), re.I)]
    for mg in cur.get("mortgages", []):
        row("Encumbrance", f"Mortgage: {mg['bank']}", "recorded" if up_loans else "",
            f"{mg['bank']} · ₹{mg['amount']:,.0f} · {mg['date']} · {mg['holder']}",
            "match" if up_loans else "missing_in_upload")
    if up_loans and not cur.get("mortgages"):
        row("Encumbrance", "Mortgage", "recorded on upload", "", "missing_in_govt")

    summary = {s: sum(1 for r in rows if r["status"] == s) for s in ("match", "mismatch", "missing_in_upload", "missing_in_govt")}
    return {"found": True, "source": SOURCE_LABEL, "govtRecordId": f"{v['id']}-{k['khata']}",
            "village": v["village"], "villageCode": v.get("villageCode"), "khata": k["khata"],
            "govtVersion": {"fasli": cur.get("fasli"), "source": cur.get("source"), "asOf": cur.get("asOf")},
            "summary": summary, "rows": rows}


# ------------------------------------------------------------------ history
def _names(ver) -> List[str]:
    return [o["name"] for o in ver["owners"]]


def _in(name: str, names: List[str]) -> bool:
    return any(_same_person(name, n) >= NAME_MATCH for n in names)


def history(rec: Dict[str, Any]) -> Dict[str, Any]:
    hit = find(rec)
    if not hit:
        return {"found": False, "message": "No govt history found for this khata."}
    v, k = hit
    vers = k["versions"]
    timeline, flags = [], []
    for i, ver in enumerate(vers):
        entry = {"label": f"Fasli {ver['fasli']}" + (" (current)" if i == len(vers) - 1 else ""),
                 "fasli": ver["fasli"], "source": ver["source"], "note": ver.get("note", ""),
                 "owners": ver["owners"], "totalAreaHa": ver["totalAreaHa"],
                 "plots": [p["khasra"] for p in ver["plots"]], "mutations": ver.get("mutations", []),
                 "mortgages": ver.get("mortgages", []), "changes": []}
        if i:
            prev = vers[i - 1]
            muts = ver.get("mutations", [])
            explained_rm = [r for m in muts for r in m.get("removed", [])]
            explained_add = [a for m in muts for a in m.get("added", [])]
            for n in _names(prev):
                if not _in(n, _names(ver)):
                    ok = _in(n, explained_rm)
                    entry["changes"].append({"kind": "removed", "name": n, "explained": ok})
                    if not ok:
                        flags.append({"severity": "high", "version": ver["fasli"],
                                      "message": f"{n} disappears from the record with no mutation entry."})
            for n in _names(ver):
                if not _in(n, _names(prev)):
                    ok = _in(n, explained_add)
                    entry["changes"].append({"kind": "added", "name": n, "explained": ok})
                    if not ok:
                        flags.append({"severity": "high", "version": ver["fasli"],
                                      "message": f"{n} appears on the record with no mutation entry."})
            if abs(ver["totalAreaHa"] - prev["totalAreaHa"]) > 1e-4:
                ok = any(m.get("areaHa") for m in muts)
                entry["changes"].append({"kind": "area", "from": prev["totalAreaHa"], "to": ver["totalAreaHa"], "explained": ok})
                if not ok:
                    flags.append({"severity": "high", "version": ver["fasli"],
                                  "message": f"Total area changed {prev['totalAreaHa']:.4f} → {ver['totalAreaHa']:.4f} ha without a recorded reason."})
        # mutation recorded but not reflected in the record
        later_names = [n for ver2 in vers[i:] for n in _names(ver2)]
        for m in ver.get("mutations", []):
            for r in m.get("removed", []):
                if _in(r, _names(ver)):
                    flags.append({"severity": "medium", "version": ver["fasli"],
                                  "message": f"{m['type']} of {m['date']}{(' (case ' + m['case'] + ')') if m.get('case') else ''} "
                                             f"removes {r}, but {r} is still listed as a holder. Verify whether the order was implemented."})
            for a in m.get("added", []):
                if not _in(a, later_names):
                    flags.append({"severity": "medium", "version": ver["fasli"],
                                  "message": f"{m['type']} of {m['date']} adds {a}, but {a} never appears as a holder."})
        timeline.append(entry)

    # the uploaded document as the newest point
    up_names = [_v(o.get("name")) for o in rec.get("owners") or [] if _v(o.get("name"))]
    cur = vers[-1]
    up_changes = ([{"kind": "missing_in_upload", "name": n} for n in _names(cur) if not _in(n, up_names)] +
                  [{"kind": "extra_in_upload", "name": n} for n in up_names if not _in(n, _names(cur))])
    timeline.append({"label": "Uploaded document", "fasli": _v(rec.get("fasliYear")), "source": "upload",
                     "owners": [{"name": n} for n in up_names],
                     "totalAreaHa": round(float(rec.get("totalStatedAreaInSqMeters") or 0) / 10000, 4),
                     "plots": [_v(p.get("khasraNumber")) for p in rec.get("plots") or []],
                     "mutations": [], "mortgages": [], "changes": up_changes})
    # de-duplicate flags (a mutation can be checked from several versions)
    seen, uniq = set(), []
    for f in flags:
        if f["message"] not in seen:
            seen.add(f["message"]); uniq.append(f)
    return {"found": True, "source": SOURCE_LABEL, "village": v["village"], "khata": k["khata"],
            "timeline": timeline, "flags": uniq}


# ------------------------------------------------------------------ GIS
def village_for(rec: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    hit = find(rec)
    if hit:
        return hit[0]
    for v in villages():
        if village_matches(v, rec.get("village", "")):
            return v
    return None


def village_geojson(v: Dict[str, Any], status_by_khasra: Dict[str, str], highlight: List[str]) -> Dict[str, Any]:
    hl = {norm_khasra(h) for h in highlight}
    feats = []
    for p in v.get("parcels", []):
        key = norm_khasra(p["khasra"])
        feats.append({"type": "Feature",
                      "geometry": {"type": "Polygon", "coordinates": [p["polygon"]]},
                      "properties": {"kind": "plot", "khasra": p["khasra"], "khata": p["khata"],
                                     "areaHa": p.get("recordedAreaHa") or p["areaHa"], "mapAreaHa": p["areaHa"],
                                     "simulatedHolder": p["simulatedHolder"], "labelAt": p.get("labelAt"),
                                     "status": status_by_khasra.get(key, "not_digitized"),
                                     "inCurrentRecord": key in hl}})
    if v.get("boundary"):
        feats.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": v["boundary"]},
                      "properties": {"kind": "boundary", "name": "ग्राम सीमा"}})
    for ln in v.get("lines", []):
        feats.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": ln["coords"]},
                      "properties": {"kind": ln["kind"], "name": ln["name"]}})
    return {"type": "FeatureCollection", "features": feats, "villageId": v["id"],
            "tehsil": v.get("tehsil"), "district": v.get("district"),
            "village": v["village"], "villageCode": v.get("villageCode"), "center": v.get("center"),
            "note": "Approximate village location; plot shapes are synthetic (simulated Bhu-Naksha)."}


def _areas(ha: float) -> Dict[str, Any]:
    sq = ha * 10000
    return {"hectare": round(ha, 4), "sqMeters": round(sq), "biswa": round(sq / 126.46, 1),
            "bigha": round(sq / 2529.3, 2), "acres": round(sq / 4046.86, 3)}


def plot_details(village_id: str, khasra: str) -> Optional[Dict[str, Any]]:
    """Everything the (simulated) govt record knows about one plot, khatauni-style."""
    v = next((x for x in villages() if x["id"] == village_id), None)
    if not v:
        return None
    key = norm_khasra(khasra)
    parcel = next((p for p in v.get("parcels", []) if norm_khasra(p["khasra"]) == key), None)
    if not parcel:
        return None
    seq = sorted(v["parcels"], key=lambda p: int(re.sub(r"\D", "", p["khasra"]) or 0)).index(parcel) + 1
    num = int(re.sub(r"\D", "", parcel["khasra"]) or 0)
    code = f"{v.get('villageCode') or '000000'}{num:04d}{seq:06d}"
    base = {"village": v["village"], "villageCode": v.get("villageCode"), "tehsil": v["tehsil"], "district": v["district"],
            "khasra": parcel["khasra"], "mapAreaHa": parcel["areaHa"], "khata": parcel["khata"]}
    real = next((k for k in v["khatas"] if k["khata"] == parcel["khata"]), None)
    if real:
        cur = real["versions"][-1]
        pl = next((p for p in cur["plots"] if norm_khasra(p["khasra"]) == key), {})
        ha = pl.get("areaHa") or parcel["areaHa"]
        muts = [m for ver in real["versions"] for m in ver.get("mutations", [])]
        return {**base, "source": cur.get("source"), "simulated": cur.get("source") != "document",
                "uniqueCode": pl.get("uniqueCode") or code, "area": _areas(ha), "landClass": pl.get("class") or real.get("category"),
                "category": real.get("category"), "fasli": cur.get("fasli"), "revenue": cur.get("revenue"),
                "khataTotalHa": cur.get("totalAreaHa"), "otherPlots": [p["khasra"] for p in cur["plots"] if norm_khasra(p["khasra"]) != key],
                "owners": cur["owners"], "mortgages": cur.get("mortgages", []),
                "mutations": sorted(muts, key=lambda m: m.get("date", ""), reverse=True)[:3],
                "historyVersions": len(real["versions"]), "public": False}
    sk = (v.get("simKhatas") or {}).get(parcel["khata"])
    if not sk:
        return {**base, "source": "simulated", "simulated": True, "uniqueCode": code, "area": _areas(parcel["areaHa"]),
                "owners": [], "mortgages": [], "mutations": [], "otherPlots": []}
    fasli = next((k["versions"][-1]["fasli"] for k in v["khatas"]), "")
    return {**base, "source": "simulated", "simulated": True, "uniqueCode": code, "area": _areas(parcel["areaHa"]),
            "landClass": sk["class"], "category": sk["class"], "fasli": fasli, "revenue": sk["revenue"],
            "khataTotalHa": sk["totalAreaHa"], "otherPlots": [k for k in sk["plots"] if norm_khasra(k) != key],
            "owners": sk["owners"], "mortgages": sk["mortgages"], "mutations": sk["mutations"],
            "historyVersions": 1, "public": sk["public"]}


def lrms_rows() -> List[Dict[str, Any]]:
    """Current versions in the flat shape used by validation_engine.cross_verify."""
    out = []
    for v in villages():
        for k in v["khatas"]:
            cur = k["versions"][-1]
            out.append({"id": f"LRMS-{v['id']}-{k['khata']}", "state": v["state"], "district": v["district"],
                        "tehsil": v["tehsil"], "village": v["village"], "khata": k["khata"],
                        "khasras": [p["khasra"] for p in cur["plots"]], "owners": _names(cur),
                        "total_sq_m": round(cur["totalAreaHa"] * 10000, 2)})
    return out
