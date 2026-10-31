"""
Automated land-record consistency checker: named, explainable rules run on any record
(uploaded or already digitized). Each rule returns pass / fail / warn / n/a with a reason.
These are internal-consistency checks; comparison with the govt dataset lives in govt_registry.
"""
import re
from typing import Any, Callable, Dict, List, Optional, Tuple

from validation_engine import norm_text, norm_khasra

_DIG = str.maketrans("०१२३४५६७८९", "0123456789")
Result = Tuple[str, str]          # (status, detail)


def _v(f: Any) -> str:
    return (f or {}).get("value", "") if isinstance(f, dict) else str(f or "")


def _owners(r):  return [o for o in r.get("owners") or [] if _v(o.get("name")).strip()]
def _plots(r):   return [p for p in r.get("plots") or [] if _v(p.get("khasraNumber")).strip()]


def r_khata_format(r) -> Result:
    k = _v(r.get("khataNumber")).translate(_DIG).strip()
    if not k:
        return "fail", "khata number is missing"
    return ("pass", f"'{k}' is a valid khata number") if re.fullmatch(r"\d{1,6}[A-Za-z]?", k) \
        else ("fail", f"'{k}' is not a valid khata number (1–6 digits)")


def r_khasra_format(r) -> Result:
    bad = [_v(p.get("khasraNumber")) for p in _plots(r)
           if not re.fullmatch(r"\d{1,5}(\s*[/\-]?\s*\d{0,3})?\s*[A-Za-zअ-ह]{0,3}\d?",
                               re.sub(r"(गाटा|खसरा)\s*", "", _v(p.get("khasraNumber"))).translate(_DIG).strip())]
    if not _plots(r):
        return "n/a", "no plots"
    return ("fail", f"invalid khasra/gata number(s): {', '.join(bad)}") if bad else ("pass", f"{len(_plots(r))} khasra number(s) well-formed")


def r_has_holders_and_plots(r) -> Result:
    o, p = len(_owners(r)), len(_plots(r))
    if o and p:
        return "pass", f"{o} holder(s), {p} plot(s)"
    return "fail", ("no holders" if not o else "") + (" and " if not o and not p else "") + ("no plots" if not p else "")


def r_plot_area_sum(r) -> Result:
    total = float(r.get("totalStatedAreaInSqMeters") or 0)
    areas = [float(p.get("areaInSqMeters") or 0) for p in _plots(r)]
    if not total or not areas or not all(areas):
        return "n/a", "total or plot areas not recorded"
    s = sum(areas)
    diff = abs(s - total) / total
    return ("pass", f"plots add up to the total ({s / 10000:.4f} ha)") if diff <= 0.005 else \
        ("fail", f"plots add up to {s / 10000:.4f} ha but the total says {total / 10000:.4f} ha")


def _share_values(r) -> Tuple[List[float], str]:
    vals, kind = [], ""
    for o in _owners(r):
        s = _v(o.get("shareFraction")).translate(_DIG)
        m = re.search(r"(\d+)\s*/\s*(\d+)", s)
        if m and int(m.group(2)):
            vals.append(int(m.group(1)) / int(m.group(2))); kind = kind or "fraction"
            continue
        m = re.search(r"\d+\.\d+", s)
        if m and ("हे" in s or "ha" in s.lower() or "hect" in s.lower()):
            vals.append(float(m.group())); kind = kind or "hectare"
            continue
        return [], ""            # some share missing or unparseable -> rule n/a
    return vals, kind


def r_share_sum(r) -> Result:
    vals, kind = _share_values(r)
    if not vals:
        return "n/a", "shares not recorded for every holder"
    if kind == "fraction":
        s = sum(vals)
        return ("pass", "shares add up to 1") if abs(s - 1) < 0.01 else ("fail", f"fractional shares add up to {s:.3f}, not 1")
    total_ha = float(r.get("totalStatedAreaInSqMeters") or 0) / 10000
    if not total_ha:
        return "n/a", "total area not recorded"
    s = sum(vals)
    return ("pass", f"holders' areas add up to the total ({s:.4f} ha)") if abs(s - total_ha) <= max(0.0005, total_ha * 0.005) else \
        ("fail", f"holders' areas add up to {s:.4f} ha but the total says {total_ha:.4f} ha")


def r_duplicate_holder(r) -> Result:
    seen, dups = {}, []
    for o in _owners(r):
        key = (norm_text(_v(o.get("name"))), norm_text(_v(o.get("relativeName"))))
        if key in seen:
            dups.append(_v(o.get("name")))
        seen[key] = 1
    return ("fail", f"listed twice: {', '.join(dups)}") if dups else ("pass", "no holder listed twice")


def r_duplicate_khasra(r) -> Result:
    ks = [norm_khasra(_v(p.get("khasraNumber"))) for p in _plots(r)]
    d = sorted({k for k in ks if ks.count(k) > 1})
    return ("fail", f"khasra repeated: {', '.join(d)}") if d else ("pass", "no khasra repeated") if ks else ("n/a", "no plots")


def r_holder_name_clean(r) -> Result:
    bad = [_v(o.get("name")) for o in _owners(r) if re.search(r"[0-9०-९]|\)|/", _v(o.get("name")))]
    return ("warn", f"name contains numbers/symbols, likely a misread row: {'; '.join(bad)}") if bad \
        else ("pass", "holder names contain no stray numbers or symbols")


def r_relative_present(r) -> Result:
    miss = [_v(o.get("name")) for o in _owners(r) if not _v(o.get("relativeName")).strip()]
    if not _owners(r):
        return "n/a", "no holders"
    return ("warn", f"father/husband name missing for: {', '.join(miss)}") if miss else ("pass", "every holder has a father/husband name")


def r_fasli_year(r) -> Result:
    f = _v(r.get("fasliYear")).translate(_DIG)
    if not f.strip():
        return "n/a", "fasli year not recorded"
    years = [int(y) for y in re.findall(r"\b(1[2-4]\d\d)\b", f)]
    if not years:
        return "fail", f"no fasli year found in '{f}'"
    if any(y < 1300 or y > 1445 for y in years):
        return "fail", f"fasli year {years} outside the plausible range"
    if len(years) >= 2 and years[1] < years[0]:
        return "fail", f"fasli period runs backwards ({years[0]}–{years[1]})"
    ce = [int(y) for y in re.findall(r"\b(19\d\d|20\d\d)\b", f)]
    if ce:
        expected = years[0] + 592            # fasli year N starts in July of CE N+592 (UP/Bihar)
        if abs(ce[0] - expected) > 1:
            return "fail", f"fasli {years[0]} corresponds to about {expected}–{expected + 1}, but the record says {ce[0]}"
    return "pass", f"fasli year {years[0]} is plausible"


def r_area_plausible(r) -> Result:
    big = [(_v(p.get("khasraNumber")), float(p.get("areaInSqMeters") or 0)) for p in _plots(r)
           if float(p.get("areaInSqMeters") or 0) > 50 * 10000]
    zero = [_v(p.get("khasraNumber")) for p in _plots(r) if p.get("areaInSqMeters") is not None and float(p.get("areaInSqMeters") or 0) == 0]
    if big:
        return "warn", "unusually large plot(s): " + ", ".join(f"{k} = {a / 10000:.1f} ha" for k, a in big)
    if zero:
        return "warn", f"plot area missing or zero for: {', '.join(zero)}"
    return ("pass", "plot areas are plausible") if _plots(r) else ("n/a", "no plots")


def r_location_complete(r) -> Result:
    miss = [n for n, k in (("village", "village"), ("tehsil", "tehsil"), ("district", "district")) if not str(r.get(k) or "").strip()]
    odd = [k for k in ("tehsil", "district") if re.search(r"ग्राम\s*:|जनपद\s*:", str(r.get(k) or ""))]
    if miss:
        return "fail", f"missing: {', '.join(miss)}"
    if odd:
        return "warn", f"{', '.join(odd)} field contains another field's label (parsing slip)"
    return "pass", "village, tehsil and district recorded"


def r_deceased_holder(r) -> Result:
    dec = [_v(o.get("name")) for o in _owners(r) if re.search(r"^\s*(स्व0|स्व\.|मृतक|late)\b", _v(o.get("name")), re.I)]
    return ("warn", f"deceased person listed as holder (inheritance/वरासत pending?): {', '.join(dec)}") if dec \
        else ("pass", "no deceased person listed as a holder")


def r_land_class(r) -> Result:
    miss = [_v(p.get("khasraNumber")) for p in _plots(r) if not _v(p.get("landClassification")).strip()]
    if not _plots(r):
        return "n/a", "no plots"
    return ("warn", f"land class missing for: {', '.join(miss)}") if miss else ("pass", "land class recorded for every plot")


RULES: List[Tuple[str, str, str, Callable]] = [
    ("C01", "Khata number format", "high", r_khata_format),
    ("C02", "Khasra/gata number format", "high", r_khasra_format),
    ("C03", "Has holders and plots", "high", r_has_holders_and_plots),
    ("C04", "Plot areas add up to total", "high", r_plot_area_sum),
    ("C05", "Holders' shares add up", "high", r_share_sum),
    ("C06", "No holder listed twice", "medium", r_duplicate_holder),
    ("C07", "No khasra repeated", "medium", r_duplicate_khasra),
    ("C08", "Holder names are clean", "medium", r_holder_name_clean),
    ("C09", "Father/husband name present", "low", r_relative_present),
    ("C10", "Fasli year valid and matches calendar year", "medium", r_fasli_year),
    ("C11", "Plot areas plausible", "medium", r_area_plausible),
    ("C12", "Location fields complete", "medium", r_location_complete),
    ("C13", "No deceased person as holder", "medium", r_deceased_holder),
    ("C14", "Land class recorded", "low", r_land_class),
]


def check(rec: Dict[str, Any]) -> Dict[str, Any]:
    results = []
    for rid, name, sev, fn in RULES:
        try:
            status, detail = fn(rec)
        except Exception as e:                     # a rule must never break the report
            status, detail = "n/a", f"could not evaluate ({e.__class__.__name__})"
        results.append({"id": rid, "rule": name, "severity": sev, "status": status, "detail": detail})
    counts = {s: sum(1 for x in results if x["status"] == s) for s in ("pass", "fail", "warn", "n/a")}
    return {"results": results, "counts": counts}


def summarize(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_rule = {rid: {"id": rid, "rule": name, "severity": sev, "fail": 0, "warn": 0, "records": []}
               for rid, name, sev, _ in RULES}
    clean = 0
    for rec in records:
        res = check(rec)
        if not res["counts"]["fail"] and not res["counts"]["warn"]:
            clean += 1
        for x in res["results"]:
            if x["status"] in ("fail", "warn"):
                b = by_rule[x["id"]]
                b[x["status"]] += 1
                b["records"].append({"id": rec.get("id"), "village": rec.get("village"), "detail": x["detail"]})
    rules = sorted(by_rule.values(), key=lambda b: (-(b["fail"] * 2 + b["warn"]), b["id"]))
    return {"recordsChecked": len(records), "recordsClean": clean, "rules": rules}
