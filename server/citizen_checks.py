"""
Citizen-facing problem finder: turns the record checks into plain-language findings with
"what you can do". Only findings about the RECORD itself are shown (not machine-reading issues).

1. Orders printed in the khatauni's own remarks (पूर्व आदेशों का विवरण) that remove or replace a
   person (deceased / name cancelled) while that person is still listed as a holder.
2. Internal consistency: shares vs total area, plot areas vs total, the same person listed twice,
   fasli year vs calendar year, a deceased person (स्व0/मृतक) listed as a holder.
3. Information the citizen should know: a bank mortgage recorded on the land.
Every finding is phrased as "possible" — the tehsil record is the authority.
"""
import re
import unicodedata
from typing import Any, Dict, List, Optional

_ZW = dict.fromkeys(map(ord, "​‌‍﻿"), None)
_DIG = str.maketrans("०१२३४५६७८९", "0123456789")


def _squash(s: str) -> str:
    """Remove spaces/punctuation (PDF fonts split Devanagari words with spaces)."""
    s = unicodedata.normalize("NFC", s or "").translate(_ZW).translate(_DIG)
    return re.sub(r"[\s\.\,\-\:\;'\"`·/()]+", "", s)


def _v(f: Any) -> str:
    return (f or {}).get("value", "") if isinstance(f, dict) else str(f or "")


def remarks_text(full_text: str) -> str:
    """The orders/remarks part of a Bhulekh khatauni or Bhu-Naksha plot report."""
    sq = _squash(full_text)
    for marker in ("पूर्वआदेशोंकाविवरण", "अभ्युक्ति", "OrderDescription"):
        i = sq.find(marker)
        if i != -1:
            return sq[i:]
    return ""


def order_conflicts(holders: List[Dict[str, str]], remarks: str) -> List[Dict[str, Any]]:
    out = []
    if not remarks:
        return out
    names = [_squash(h.get("name", "")) for h in holders]
    for h in holders:
        n, f = _squash(h.get("name", "")), _squash(h.get("relative", "")).replace("स्व0", "")
        if len(n) < 3:
            continue
        unique = names.count(n) == 1
        hits = [m.start() for m in re.finditer(re.escape(n), remarks)]
        for p in hits:
            after = remarks[p + len(n): p + len(n) + 40]
            father_ok = bool(f) and f in after
            before = remarks[max(0, p - 12): p]
            window = remarks[p: p + 320]
            if "मृतक" in before and (father_ok or (unique and after.startswith(("के", "का")))):
                kind = "deceased"            # "मृतक भोला के स्थान पर ..." (father not always written)
            elif father_ok and "नामनिरस्त" in window:
                kind = "cancelled"
            else:
                kind = None
            if kind:
                out.append({"name": h.get("name"), "relative": h.get("relative"), "kind": kind})
                break
    return out


def findings(rec: Dict[str, Any], full_text: Optional[str] = None) -> List[Dict[str, Any]]:
    from consistency import check
    res: List[Dict[str, Any]] = []
    holders = [{"name": _v(o.get("name")), "relative": _v(o.get("relativeName"))} for o in rec.get("owners") or []]

    for c in order_conflicts(holders, remarks_text(full_text or "")):
        who = f"{c['name']}" + (f" ({c['relative']})" if c.get("relative") else "")
        res.append({
            "severity": "high", "kind": "order_not_applied",
            "title": {"hi": f"आदेश के बाद भी नाम दर्ज: {who}",
                      "en": f"Still listed after an order: {who}"},
            "detail": {"hi": ("खतौनी में दर्ज पुराने आदेश के अनुसार यह व्यक्ति मृतक है और उनके स्थान पर वारिस दर्ज होने थे, "
                              "पर उनका नाम अभी भी खातेदारों में है।") if c["kind"] == "deceased" else
                             "खतौनी में दर्ज पुराने आदेश में इस व्यक्ति का नाम निरस्त करने को कहा गया है, पर नाम अभी भी खातेदारों में है।",
                       "en": ("An order printed in this khatauni says this person has died and the heirs should be recorded "
                              "in their place, but the name is still listed as a holder.") if c["kind"] == "deceased" else
                             "An order printed in this khatauni cancels this person's name, but it is still listed as a holder."},
            "action": {"hi": "तहसील में लेखपाल / राजस्व निरीक्षक से आदेश के अनुपालन (अमलदरामद) की स्थिति पूछें और सुधार का आवेदन दें।",
                       "en": "Ask the Lekhpal / Revenue Inspector at your tehsil whether the order has been implemented, and apply for correction."},
        })

    rules = {x["id"]: x for x in check(rec)["results"]}
    def rule(rid, sev, hi, en, act_hi, act_en):
        x = rules.get(rid)
        if x and x["status"] in ("fail", "warn"):
            res.append({"severity": sev, "kind": rid, "title": {"hi": hi, "en": en},
                        "detail": {"hi": x["detail"], "en": x["detail"]}, "action": {"hi": act_hi, "en": act_en}})
    rule("C13", "high", "मृत व्यक्ति खातेदार के रूप में दर्ज", "A deceased person is listed as a holder",
         "वरासत (उत्तराधिकार) दर्ज कराने के लिए तहसील में आवेदन करें।", "Apply for inheritance (वरासत) to be recorded at your tehsil.")
    rule("C05", "medium", "हिस्सों का जोड़ कुल रकबे से मेल नहीं खाता", "Holders' shares don't add up to the total area",
         "खतौनी की प्रमाणित प्रति तहसील से लेकर हिस्से जाँचें; गलती हो तो संशोधन का आवेदन दें।",
         "Get a certified copy from the tehsil and check the shares; apply for correction if they are wrong.")
    rule("C04", "medium", "गाटों का क्षेत्रफल कुल से मेल नहीं खाता", "Plot areas don't add up to the total",
         "तहसील में क्षेत्रफल का मिलान कराएँ।", "Ask the tehsil to reconcile the plot areas with the total.")
    rule("C06", "medium", "एक ही व्यक्ति दो बार दर्ज", "The same person appears twice",
         "दोहरी प्रविष्टि हटाने के लिए तहसील में आवेदन करें।", "Apply at the tehsil to remove the duplicate entry.")
    rule("C10", "low", "फसली वर्ष और तारीख मेल नहीं खाते", "Fasli year and calendar dates don't match",
         "यह छपाई की गलती हो सकती है; प्रमाणित प्रति से मिलान करें।", "This may be a printing error; compare with a certified copy.")

    for d in rec.get("discrepancies") or []:
        if re.search(r"bank|बंधक|बैंक|mortgage", (d.get("id", "") + d.get("title", "")), re.I):
            res.append({"severity": "info", "kind": "mortgage",
                        "title": {"hi": "ज़मीन पर बैंक बंधक दर्ज है", "en": "A bank mortgage is recorded on this land"},
                        "detail": {"hi": d.get("description", ""), "en": d.get("description", "")},
                        "action": {"hi": "बेचने या नाम बदलवाने से पहले बैंक से अनापत्ति (NOC) लेनी होगी।",
                                   "en": "A no-objection certificate (NOC) from the bank is needed before sale or transfer."}})
            break
    order = {"high": 0, "medium": 1, "low": 2, "info": 3}
    return sorted(res, key=lambda r: order.get(r["severity"], 9))
