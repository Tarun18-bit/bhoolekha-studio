import re
from typing import Dict, Any, List

UNIT_CONSTANTS = {
    "HECTARE_TO_SQ_M": 10000.0,
    "ACRE_TO_SQ_M": 4046.86,
    "PUCCA_BIGHA_TO_SQ_M": 2529.285, # 1 Bigha = 20 Biswa
    "BISWA_TO_SQ_M": 126.464,
    "GUNTHA_TO_SQ_M": 101.171,      # 40 Guntha = 1 Acre
    "KANAL_TO_SQ_M": 505.857,       # 8 Kanal = 1 Acre
    "MARLA_TO_SQ_M": 25.292,
    "CENT_TO_SQ_M": 40.468,
}

def parse_regional_land_area(input_str: str) -> Dict[str, Any]:
    """
    Parses strings like '2 Bigha 4 Biswa', '18 Guntha', '0.45 Hectare' into standard SI metrics.
    """
    clean = (input_str or "").strip().lower()
    sq_m = 0.0

    # Hectares
    if any(h in clean for h in ["hectare", "हेक्टेयर", "hec", "h."]):
        match = re.search(r"([\d.]+)\s*(hectare|हेक्टेयर|hec|h)", clean)
        if match:
            sq_m += float(match.group(1)) * UNIT_CONSTANTS["HECTARE_TO_SQ_M"]

    # Bigha
    if any(b in clean for b in ["bigha", "बीघा"]):
        match = re.search(r"([\d.]+)\s*(bigha|बीघा)", clean)
        if match:
            sq_m += float(match.group(1)) * UNIT_CONSTANTS["PUCCA_BIGHA_TO_SQ_M"]

    # Biswa
    if any(bw in clean for bw in ["biswa", "बिस्वा"]):
        match = re.search(r"([\d.]+)\s*(biswa|बिस्वा)", clean)
        if match:
            sq_m += float(match.group(1)) * UNIT_CONSTANTS["BISWA_TO_SQ_M"]

    # Guntha
    if any(g in clean for g in ["guntha", "गुंठा"]):
        match = re.search(r"([\d.]+)\s*(guntha|गुंठा)", clean)
        if match:
            sq_m += float(match.group(1)) * UNIT_CONSTANTS["GUNTHA_TO_SQ_M"]

    # Acre
    if any(a in clean for a in ["acre", "एकड़"]):
        match = re.search(r"([\d.]+)\s*(acre|एकड़)", clean)
        if match:
            sq_m += float(match.group(1)) * UNIT_CONSTANTS["ACRE_TO_SQ_M"]

    # Numeric fallback
    if sq_m == 0.0:
        match = re.search(r"^([\d.]+)$", clean)
        if match:
            sq_m = float(match.group(1)) * UNIT_CONSTANTS["HECTARE_TO_SQ_M"]

    hectares = round(sq_m / UNIT_CONSTANTS["HECTARE_TO_SQ_M"], 4)
    acres = round(sq_m / UNIT_CONSTANTS["ACRE_TO_SQ_M"], 3)

    return {
        "sq_meters": round(sq_m, 2),
        "hectares": hectares,
        "acres": acres,
        "formatted": f"{hectares} Ha ({round(sq_m, 1)} m²)"
    }

def verify_parcel_arithmetic(total_stated_sq_m: float, subplot_sq_m_list: List[float]) -> Dict[str, Any]:
    """
    Evaluates whether sub-parcel subdivisions sum up to the total stated holding.
    """
    sum_subplots = sum(subplot_sq_m_list)
    diff = round(sum_subplots - total_stated_sq_m, 2)
    abs_diff = abs(diff)

    if abs_diff <= 1.0:
        return {
            "is_consistent": True,
            "discrepancy_sq_m": 0.0,
            "percentage_variance": 0.0,
            "severity": "none",
            "message": "Sub-parcel sum matches stated total holding area."
        }

    variance = round((abs_diff / (total_stated_sq_m or 1.0)) * 100.0, 2)
    is_overage = diff > 0

    return {
        "is_consistent": False,
        "discrepancy_sq_m": diff,
        "percentage_variance": variance,
        "severity": "high" if variance > 5.0 else "medium",
        "message": (
            f"Sub-parcel sum ({sum_subplots:,.1f} m²) exceeds stated holding ({total_stated_sq_m:,.1f} m²) "
            f"by {abs_diff:,.1f} m² (+{variance}%)."
            if is_overage else
            f"Sub-parcel sum ({sum_subplots:,.1f} m²) falls short of stated holding ({total_stated_sq_m:,.1f} m²) "
            f"by {abs_diff:,.1f} m² (-{variance}%)."
        )
    }
