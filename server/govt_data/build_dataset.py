"""
Builds govt_land_records.json: a SIMULATED state land-records (LRMS / Bhulekh / Bhu-Naksha)
dataset for the hackathon, because no public government API is available.

* Current versions of khata 00287 (Gauri Lal Ghosa) are transcribed from the sample
  Bhulekh PDF in this repo, including its real 2024 inheritance (वरासत) and the 2023 order.
* Older versions, other khatas' history, and ALL plot geometry are simulated and marked so.
* Village codes are Census 2011 codes; village positions are approximate (near the tehsil HQ).

    python build_dataset.py      -> writes govt_land_records.json (deterministic)
"""
import json, math, random
from pathlib import Path

OUT = Path(__file__).parent / "govt_land_records.json"            # anonymised, committed
OUT_LOCAL = Path(__file__).parent / "govt_land_records.local.json" # real names, gitignored


def own(name, rel, share="", relation="पुत्र"):
    return {"name": name, "relative": rel, "relation": relation, "share": share}


def plot(khasra, area_ha, cls="1-क", code=""):
    return {"khasra": khasra, "uniqueCode": code, "areaHa": area_ha, "class": cls}


# ------------------------------------------------------------------ khata 00287 (from sample PDF)
k287_v4_owners = [
    own("विकासकुमार", "हरिप्रसाद"), own("रिया आनन्द", "स्व0 प्रदीपकुमार", relation="पुत्री (अवयस्क)"),
    own("तनु आनन्द", "स्व0 प्रदीपकुमार", relation="पुत्री (अवयस्क)"), own("धर्मेन्द्र", "रामधारी"),
    own("नितेश", "शिवनारायण", "0.1337 हे०"), own("सरोज देवी", "हरिप्रसाद", relation="पत्नी"),
    own("मीना देवी", "स्व0 प्रदीपकुमार", relation="पत्नी"), own("सत्यप्रकाश", "रामधारी"),
    own("भरत", "मंगरू"), own("नेहा आनन्द", "स्व0 प्रदीपकुमार", relation="पुत्री"),
    own("पूजा आनन्द", "स्व0 प्रदीपकुमार", relation="पुत्री (अवयस्क)"),
]
k287_plot = [plot("365", 0.5350, "1-क", "1976840365000012")]
k287 = {
    "khata": "00287", "category": "1-क/भूमि जो संक्रमणीय भूमिधरों के अधिकार में हो",
    "versions": [
        {"fasli": "1417-1422", "source": "simulated",
         "owners": [own("हरिप्रसाद", "रामदेव"), own("रामधारी", "रामदेव"), own("मंगरू", "शिवनाथ")],
         "plots": k287_plot, "totalAreaHa": 0.5350, "revenue": "8.80", "mortgages": [],
         "mutations": []},
        {"fasli": "1423-1428", "source": "simulated",
         "owners": [own("विकासकुमार", "हरिप्रसाद"), own("सरोज देवी", "हरिप्रसाद", relation="पत्नी"),
                    own("प्रदीपकुमार", "हरिप्रसाद"), own("धर्मेन्द्र", "रामधारी"), own("सत्यप्रकाश", "रामधारी"),
                    own("शिवनारायण", "मंगरू"), own("भरत", "मंगरू")],
         "plots": k287_plot, "totalAreaHa": 0.5350, "revenue": "8.80", "mortgages": [],
         "mutations": [
             {"date": "2016-08-11", "type": "वरासत", "removed": ["हरिप्रसाद"],
              "added": ["विकासकुमार", "सरोज देवी", "प्रदीपकुमार"], "simulated": True},
             {"date": "2017-01-20", "type": "वरासत", "removed": ["रामधारी"], "added": ["धर्मेन्द्र", "सत्यप्रकाश"], "simulated": True},
             {"date": "2017-06-02", "type": "वरासत", "removed": ["मंगरू"], "added": ["शिवनारायण", "भरत"], "simulated": True}]},
        {"fasli": "1429-1434", "source": "simulated",
         "note": "First version of the current fasli period, before the 2024 inheritance.",
         "owners": [o for o in k287_v4_owners if o["name"] != "नितेश"] + [own("शिवनारायण", "मंगरू")],
         "plots": k287_plot, "totalAreaHa": 0.5350, "revenue": "8.80", "mortgages": [],
         "mutations": [
             {"date": "2022-03-14", "type": "वरासत", "removed": ["प्रदीपकुमार"],
              "added": ["मीना देवी", "रिया आनन्द", "तनु आनन्द", "नेहा आनन्द", "पूजा आनन्द"], "simulated": True},
             {"date": "2023-06-14", "type": "वसीयत (न्यायालय आदेश)", "case": "T2023000000XXXX1",
              "removed": ["भरत"], "added": ["आशा देवी", "सरोज देवी"],
              "note": "Order of Tehsildar Belthara Road dated 12/05/2023 (structure from a sample PDF; details fictional).",
              "simulated": False}]},
        {"fasli": "1429-1434", "source": "document", "asOf": "2025-12-14",
         "note": "Structure transcribed from a sample Bhulekh khatauni; names, case numbers and amounts are fictional in this public copy.",
         "owners": k287_v4_owners, "plots": k287_plot, "totalAreaHa": 0.5350, "revenue": "8.80",
         "mortgages": [{"bank": "Bank of Baroda", "date": "2025-02-11", "amount": 125000.00, "holder": "भरत"}],
         "mutations": [
             {"date": "2024-10-26", "type": "वरासत (ऑनलाइन उत्तराधिकार)", "case": "2024000000000000XXX1",
              "removed": ["शिवनारायण"], "added": ["नितेश"], "areaHa": 0.1337, "simulated": False}]},
    ],
}

# Local-only: if the real transcription exists (gitignored), use it instead of the anonymised one.
_REAL = Path(__file__).parent / "real_sample_00287.json"
k287_public = k287
if _REAL.exists():
    k287 = json.loads(_REAL.read_text(encoding="utf-8"))

# ------------------------------------------------------------------ khata 00548 (seed record)
k548_owners = [own("शिवसरन", "मुरली"), own("भोला", "मुरली"), own("भोभल", "मुरली"), own("टुडी", "हरिनाथ"),
               own("बांके", "हरिनाथ"), own("हवलदार", "हरिनाथ"), own("हरिनाथ", "जगपति"), own("रामआसरे", "देवराज"),
               own("कमलेश", "देवराज"), own("मोहन", "इन्द्रदेव"), own("बिरजू", "इन्द्रदेव"), own("सूर्यनाथ", "इन्द्रदेव"),
               own("अशोक", "इन्द्रदेव"), own("बांकेलाल", "हरिनाथ")]
k548_plot = [plot("32", 0.8290, "1-क", "2033070032000001")]
k548 = {
    "khata": "00548", "category": "1-क/भूमि जो संक्रमणीय भूमिधरों के अधिकार में हो",
    "versions": [
        {"fasli": "1422-1427", "source": "simulated",
         "owners": [own("मुरली", "रामधनी"), own("हरिनाथ", "जगपति"), own("देवराज", "रामधनी"), own("इन्द्रदेव", "रामधनी")],
         "plots": k548_plot, "totalAreaHa": 0.8290, "revenue": "12.40", "mortgages": [], "mutations": []},
        {"fasli": "1428-1433", "source": "simulated",
         "owners": k548_owners, "plots": k548_plot, "totalAreaHa": 0.8290, "revenue": "12.40", "mortgages": [],
         "mutations": [
             {"date": "2019-02-02", "type": "वरासत", "removed": ["मुरली"], "added": ["शिवसरन", "भोला", "भोभल"], "simulated": True},
             {"date": "2019-09-17", "type": "वरासत", "removed": ["देवराज"], "added": ["रामआसरे", "कमलेश"], "simulated": True},
             {"date": "2020-01-08", "type": "वरासत", "removed": ["इन्द्रदेव"], "added": ["मोहन", "बिरजू", "सूर्यनाथ", "अशोक"], "simulated": True},
             {"date": "2020-05-21", "type": "दानपत्र", "removed": [], "added": ["टुडी", "बांके", "हवलदार", "बांकेलाल"],
              "note": "हरिनाथ gifted part of his share to his sons and remains a co-holder.", "simulated": True}]},
    ],
}

# ------------------------------------------------------------------ khata 00858 (seed record)
k858_owners = [own("राजेश यादव", "रामनक्षत्र यादव", "0.0710 हे०"), own("लाल बच्ची यादव", "रामनक्षत्र यादव", "0.0237 हे०"),
               own("सुनील यादव", "रामनक्षत्र यादव", "0.0237 हे०"), own("रामनक्षत्र", "बांसदेव", "0.0236 हे०")]
k858_plot = [plot("861", 0.1420, "1-क", "1976940861000003")]
k858 = {
    "khata": "00858", "category": "1-क/भूमि जो संक्रमणीय भूमिधरों के अधिकार में हो",
    "versions": [
        {"fasli": "1420-1425", "source": "simulated",
         "owners": [own("रामनक्षत्र", "बांसदेव", "0.1420 हे०")],
         "plots": k858_plot, "totalAreaHa": 0.1420, "revenue": "2.10", "mortgages": [], "mutations": []},
        {"fasli": "1426-1431", "source": "simulated",
         "owners": k858_owners, "plots": k858_plot, "totalAreaHa": 0.1420, "revenue": "2.10",
         "mortgages": [{"bank": "Kisan Credit Card (simulated)", "date": "2021-07-09", "amount": 60000.0, "holder": "राजेश यादव"}],
         "mutations": [
             {"date": "2019-04-12", "type": "दानपत्र", "removed": [], "added": ["राजेश यादव", "लाल बच्ची यादव", "सुनील यादव"],
              "areaHa": 0.1184, "note": "रामनक्षत्र gifted 0.1184 ha to his sons and keeps 0.0236 ha.", "simulated": True}]},
    ],
}

# ------------------------------------------------------------------ khata 706 (AP sample)
k706 = {
    "khata": "706", "category": "రైత్వారీ / పట్టా",
    "versions": [
        {"fasli": "1431", "source": "simulated",
         "owners": [own("మర్రెడ్డి సత్యనారాయణ రెడ్డి", "", "")],
         "plots": [plot("299A", 1.7360, "మెట్ట"), plot("299B", 1.6350, "మెట్ట")],
         "totalAreaHa": 3.3710, "revenue": "4.37", "mortgages": [], "mutations": []}],
}

VILLAGES = [
    {"id": "UP-BAL-197684", "state": "Uttar Pradesh", "district": "बलिया (Ballia)", "tehsil": "बेल्थरा रोड (Belthara Road)",
     "village": "गौरी ताल घोसा (Gauri Tal Ghosa)", "aliases": ["गौरी ताल घोसा", "गौरी लाल घोसा", "गोरितलघोसा", "Gauri Lal Ghosa"],
     "villageCode": "197684", "center": [26.1310, 83.8300], "khatas": [k287], "plotStart": 271},
    {"id": "UP-BAL-197694", "state": "Uttar Pradesh", "district": "बलिया (Ballia)", "tehsil": "बेल्थरा रोड (Belthara Road)",
     "village": "चैनपुर गुलौरा (Chainpur Gulaura)", "aliases": ["चैनपुर गुलौरा", "Chainpur Guloura", "चैनपुर"],
     "villageCode": "197694", "center": [26.1060, 83.8640], "khatas": [k858], "plotStart": 781},
    {"id": "UP-JAU-203307", "state": "Uttar Pradesh", "district": "जौनपुर (Jaunpur)", "tehsil": "केराकत (Kerakat)",
     "village": "हीरापुरमचहटी (Heerapur Machhati)", "aliases": ["हीरापुरमचहटी", "हीरापुर", "Hirapur Machahati"],
     "villageCode": "203307", "center": [25.6440, 82.9110], "khatas": [k548], "plotStart": 1},
    {"id": "AP-EG-DODDI", "state": "Andhra Pradesh", "district": "East Godavari", "tehsil": "రాజమండ్రి (Rajahmundry)",
     "village": "దొడ్డిమడి", "aliases": ["దొడ్డిమడి", "దొడ్డంగి", "Doddangi"],
     "villageCode": "", "center": None, "khatas": [k706], "plotStart": None},
]


# ------------------------------------------------------------------ synthetic cadastral geometry
def _clip(poly, a, b, c):
    """Keep the part of polygon `poly` where a*x + b*y <= c (Sutherland-Hodgman, one half-plane)."""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        fp, fq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if fp <= 0:
            out.append(p)
        if (fp < 0 < fq) or (fq < 0 < fp):
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def _area(poly):
    return abs(sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1]
                   for i in range(len(poly)))) / 2


def _centroid(poly):
    a = cx = cy = 0.0
    for i in range(len(poly)):
        x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % len(poly)]
        cr = x0 * y1 - x1 * y0
        a += cr; cx += (x0 + x1) * cr; cy += (y0 + y1) * cr
    if abs(a) < 1e-9:
        return sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)
    return cx / (3 * a), cy / (3 * a)


def _inside(pt, poly):
    x, y, ins = pt[0], pt[1], False
    for i in range(len(poly)):
        x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % len(poly)]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            ins = not ins
    return ins


def _voronoi(seeds, boundary, reach):
    cells = []
    for i, (sx, sy) in enumerate(seeds):
        cell = list(boundary)
        for j, (tx, ty) in enumerate(seeds):
            if i == j or abs(tx - sx) > reach or abs(ty - sy) > reach:
                continue
            a, b = tx - sx, ty - sy
            c = (tx * tx + ty * ty - sx * sx - sy * sy) / 2
            cell = _clip(cell, a, b, c)
            if len(cell) < 3:
                break
        cells.append(cell)
    return cells


def make_map(v, rng):
    """Bhu-Naksha-style synthetic village: irregular boundary, ~180 irregular plots numbered in a
    serpentine order, two cart tracks and a drain. Coordinates are metres -> lat/lng around the centre."""
    if not v["center"]:
        return [], None, []
    lat0, lng0 = v["center"]
    m_lat = 1 / 111320.0
    m_lng = 1 / (111320.0 * math.cos(math.radians(lat0)))
    n_plots, mean_ha = 180, 0.32
    R = math.sqrt(n_plots * mean_ha * 10000 / math.pi) * 1.05
    ph1, ph2 = rng.uniform(0, 6.28), rng.uniform(0, 6.28)
    boundary = []
    for k in range(64):
        t = 2 * math.pi * k / 64
        r = R * (1 + 0.20 * math.sin(3 * t + ph1) + 0.10 * math.sin(5 * t + ph2) + rng.uniform(-0.03, 0.03))
        boundary.append((r * math.cos(t) * 1.35, r * math.sin(t) * 0.8))
    xs, ys = [p[0] for p in boundary], [p[1] for p in boundary]
    seeds = []
    while len(seeds) < n_plots:
        pt = (rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys)))
        if _inside(pt, boundary):
            seeds.append(pt)
    reach = 6 * math.sqrt(mean_ha * 10000)
    for _ in range(3):                                   # Lloyd relaxation -> field-like shapes
        cells = _voronoi(seeds, boundary, reach)
        seeds = [_centroid(c) if len(c) >= 3 else s for c, s in zip(cells, seeds)]
        seeds = [(x + rng.uniform(-6, 6), y * rng.uniform(0.97, 1.03)) for x, y in seeds]
    cells = _voronoi(seeds, boundary, reach)
    cells = [c for c in cells if len(c) >= 3 and _area(c) > 200]

    # serpentine numbering in horizontal bands (north to south), like a khasra map
    band = math.sqrt(mean_ha * 10000) * 1.6
    def order(i):
        cx, cy = _centroid(cells[i])
        row = int((max(ys) - cy) // band)
        return (row, cx if row % 2 == 0 else -cx)
    idx = sorted(range(len(cells)), key=order)

    known = {p["khasra"]: (k["khata"], p["areaHa"]) for k in v["khatas"] for p in k["versions"][-1]["plots"]}
    start = v["plotStart"]
    numbers = {i: str(start + n) for n, i in enumerate(idx)}
    # give each recorded khasra the cell whose area is closest to its recorded area (central cells only)
    used = set()
    for ks, (_, ha) in known.items():
        target = ha * 10000
        holder = next((i for i, num in numbers.items() if num == ks), None)
        cands = sorted((i for i in range(len(cells)) if i not in used and
                        math.hypot(*_centroid(cells[i])) < R * 0.6), key=lambda i: abs(_area(cells[i]) - target))
        if cands:
            best = cands[0]
            if holder is not None and holder != best:
                numbers[holder], numbers[best] = numbers[best], numbers[holder]
            elif holder is None:
                numbers[best] = ks
            used.add(best)

    to_ll = lambda x, y: [round(lng0 + x * m_lng, 6), round(lat0 + y * m_lat, 6)]
    parcels = []
    for i, cell in enumerate(cells):
        ks = numbers[i]
        khata, rec_ha = known.get(ks, (f"00{rng.randint(100, 999)}", None))
        ring = [to_ll(x, y) for x, y in cell] + [to_ll(*cell[0])]
        cx, cy = _centroid(cell)
        parcels.append({"khasra": ks, "khata": khata, "areaHa": round(_area(cell) / 10000, 4),
                        "recordedAreaHa": rec_ha, "simulatedHolder": ks not in known,
                        "labelAt": to_ll(cx, cy), "polygon": ring})
    # two cart tracks crossing the village and a drain along the eastern edge
    lines = []
    for ang in (rng.uniform(-0.3, 0.3), math.pi / 2 + rng.uniform(-0.4, 0.4)):
        pts = []
        for k in range(-12, 13):
            d = k * R / 9
            off = 25 * math.sin(k / 2.5)
            x, y = d * math.cos(ang) - off * math.sin(ang), d * math.sin(ang) + off * math.cos(ang)
            if _inside((x, y), boundary):
                pts.append(to_ll(x, y))
        if len(pts) > 2:
            lines.append({"kind": "road", "name": "चक मार्ग", "coords": pts})
    east = sorted(boundary, key=lambda p: -p[0])[:1][0]
    k0 = boundary.index(east)
    drain = [boundary[(k0 + j) % len(boundary)] for j in range(-9, 10)]
    lines.append({"kind": "drain", "name": "नाला", "coords": [to_ll(x + 12, y) for x, y in drain]})
    return parcels, [to_ll(x, y) for x, y in boundary] + [to_ll(*boundary[0])], lines



# ------------------------------------------------------------------ simulated neighbour khatas
FIRST = ["राम", "श्याम", "रमेश", "सुरेश", "दिनेश", "महेश", "राजेन्द्र", "विनोद", "अनिल", "सुनील", "संजय", "अजय",
         "विजय", "मनोज", "प्रमोद", "राकेश", "उमेश", "कमलेश", "हरिशंकर", "शिवशंकर", "रामप्रसाद", "जगदीश",
         "ओमप्रकाश", "चन्द्रशेखर", "लालजी", "रामदुलारी", "शान्ति देवी", "कमला देवी", "सुशीला देवी", "गीता देवी"]
FATHER = ["रामनाथ", "शिवनाथ", "हरिनारायण", "रामअवध", "बैजनाथ", "रामकिशुन", "जगन्नाथ", "सूर्यनारायण",
          "रामबचन", "मुन्नीलाल", "रामलखन", "बालेश्वर", "रघुनाथ", "भगवती", "रामसूरत"]
SURNAME = ["यादव", "सिंह", "राय", "पाण्डेय", "तिवारी", "गुप्ता", "वर्मा", "चौहान", "राजभर", "मौर्य", ""]
PUBLIC = [("ग्राम सभा", "तालाब", "6-2 / भूमि जो जलमग्न हो (तालाब)"), ("ग्राम सभा", "खलिहान", "6-1 / खलिहान"),
          ("ग्राम सभा", "आबादी", "6-1 / आबादी"), ("ग्राम सभा", "बंजर", "5-3 / बंजर भूमि"),
          ("ग्राम सभा", "खेल का मैदान", "6-1 / सार्वजनिक उपयोग")]
SHARE_SETS = {1: ["1/1"], 2: ["1/2", "1/2"], 3: ["1/3", "1/3", "1/3"], 4: ["1/2", "1/6", "1/6", "1/6"]}


def sim_khatas(v, parcels, rng):
    """Group neighbour plots into simulated khatas with holders, shares, class, revenue, mutations."""
    real = {k["khata"] for k in v["khatas"]}
    neighbours = [p for p in parcels if p["simulatedHolder"]]
    rng.shuffle(neighbours)
    out, i, n_k = {}, 0, 0
    while i < len(neighbours):
        size = rng.choice([1, 1, 1, 2, 2, 3])
        group = neighbours[i:i + size]; i += size
        while True:
            kh = f"{rng.randint(1, 990):05d}"
            if kh not in real and kh not in out:
                break
        public = rng.random() < 0.06
        if public:
            holder, use, cls = rng.choice(PUBLIC)
            owners = [{"name": f"{holder} ({use})", "relative": "", "relation": "", "share": "1/1"}]
        else:
            cls = rng.choice(["1-क / संक्रमणीय भूमिधर"] * 8 + ["1-ख / असंक्रमणीय भूमिधर", "2 / असामी"])
            sur = rng.choice(SURNAME)
            fam_father = rng.choice(FATHER) + (f" {sur}" if sur else "")
            n_o = rng.choice([1, 1, 2, 2, 3, 4])
            owners = []
            for sh, fn in zip(SHARE_SETS[n_o], rng.sample(FIRST, n_o)):
                female = fn.endswith("देवी") or fn == "रामदुलारी"
                owners.append({"name": fn + ("" if female or not sur else f" {sur}"), "relative": fam_father,
                               "relation": "पत्नी" if female else "पुत्र", "share": sh})
        total = round(sum(p["recordedAreaHa"] or p["areaHa"] for p in group), 4)
        muts = []
        if not public and rng.random() < 0.35:
            y = rng.randint(2012, 2024)
            muts.append({"date": f"{y}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
                         "type": rng.choice(["वरासत", "वरासत", "बैनामा", "दानपत्र"]),
                         "case": f"T{y}{rng.randint(10**9, 10**10 - 1)}", "simulated": True})
        mort = []
        if not public and rng.random() < 0.15:
            mort.append({"bank": rng.choice(["State Bank of India", "Bank of Baroda", "Punjab National Bank", "UP Gramin Bank"]),
                         "date": f"{rng.randint(2018, 2025)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
                         "amount": float(rng.choice([50000, 75000, 100000, 150000, 200000])), "holder": owners[0]["name"]})
        out[kh] = {"khata": kh, "class": cls, "owners": owners, "plots": [p["khasra"] for p in group],
                   "totalAreaHa": total, "revenue": f"{total * 16.4:.2f}", "mutations": muts, "mortgages": mort,
                   "public": public}
        for p in group:
            p["khata"] = kh
        n_k += 1
    return out


def main():
    build(OUT, k287_public)
    if k287 is not k287_public:
        build(OUT_LOCAL, k287)


def build(path, khata_287):
    VILLAGES[0]["khatas"] = [khata_287]
    rng = random.Random(26018)
    out = {
        "_note": ("SIMULATED government land-records dataset for SIH26018 (no public LRMS API available). "
                  "Versions marked source='document' are transcribed from the sample Bhulekh PDF; everything "
                  "marked 'simulated' is invented for demonstration. Plot geometry is synthetic; village "
                  "positions are approximate. Village codes: Census 2011."),
        "villages": [],
    }
    for v in VILLAGES:
        vv = {k: v[k] for k in ("id", "state", "district", "tehsil", "village", "aliases", "villageCode", "center")}
        vv["khatas"] = v["khatas"]
        vv["parcels"], vv["boundary"], vv["lines"] = make_map(v, rng)
        vv["simKhatas"] = sim_khatas(v, vv["parcels"], rng) if vv["parcels"] else {}
        out["villages"].append(vv)
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {path.name}: {sum(len(v['khatas']) for v in out['villages'])} khatas, "
          f"{sum(len(v['parcels']) for v in out['villages'])} parcels")
    for v in out["villages"]:
        if v["parcels"]:
            rec = [p for p in v["parcels"] if not p["simulatedHolder"]]
            print("  ", v["village"], len(v["parcels"]), "plots;", [(p["khasra"], p["areaHa"], p["recordedAreaHa"]) for p in rec])


if __name__ == "__main__":
    main()
