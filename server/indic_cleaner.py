import re
from typing import Set

COMBINING_MARKS = re.compile(r'([\u0900-\u097F])\s+([\u0901-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963])')

KNOWN_INDIC_WORDS = [
    (re.compile(r'रा\s*जे\s*श'), 'राजेश'),
    (re.compile(r'या\s*द\s*व'), 'यादव'),
    (re.compile(r'रा\s*म\s*न\s*क्ष\s*त्र'), 'रामनक्षत्र'),
    (re.compile(r'ला\s*ल\s*ब\s*ची'), 'लालबची'),
    (re.compile(r'सु\s*नी\s*ल'), 'सुनील'),
    (re.compile(r'शि\s*व\s*स\s*र\s*न'), 'शिवसरन'),
    (re.compile(r'मु\s*र\s*ली'), 'मुरली'),
    (re.compile(r'भो\s*भ\s*ल'), 'भोभल'),
    (re.compile(r'भो\s*ला'), 'भोला'),
    (re.compile(r'ह\s*रि\s*ना\s*थ'), 'हरिनाथ'),
    (re.compile(r'ज\s*ग\s*प\s*ति'), 'जगपति'),
    (re.compile(r'दे\s*व\s*रा\s*ज'), 'देवराज'),
    (re.compile(r'इ\s*न्\s*द्र\s*दे\s*व|इ\s*न्द्र\s*दे\s*व'), 'इन्द्रदेव'),
    (re.compile(r'सू\s*र्य\s*ना\s*थ|सूर्\s*य\s*ना\s*थ'), 'सूर्यनाथ'),
    (re.compile(r'क\s*म\s*ले\s*श'), 'कमलेश'),
    (re.compile(r'अ\s*शो\s*क'), 'अशोक'),
    (re.compile(r'टु\s*डी|टू\s*ड़ी'), 'टुडी'),
    (re.compile(r'बां\s*के|बा\s*के'), 'बांके'),
    (re.compile(r'ह\s*व\s*ल\s*दा\s*र'), 'हवलदार'),
    (re.compile(r'मो\s*ह\s*न'), 'मोहन'),
    (re.compile(r'बि\s*र\s*जू'), 'बिरजू'),
    (re.compile(r'ऑ\s*न्ला\s*इ\s*न'), 'ऑनलाइन'),
    (re.compile(r'उ\s*त्त\s*रा\s*धि\s*का\s*र'), 'उत्तराधिकार'),
    (re.compile(r'व\s*रा\s*स\s*त'), 'वरासत'),
    (re.compile(r'न्या\s*या\s*ल\s*य'), 'न्यायालय'),
    (re.compile(r'चै\s*न\s*पु\s*र'), 'चैनपुर'),
    (re.compile(r'गु\s*लौ\s*रा'), 'गुलौरा'),
    (re.compile(r'ब\s*लि\s*या'), 'बलिया'),
    (re.compile(r'बे\s*ल\s*थ\s*रा'), 'बेलथरा'),
    (re.compile(r'रो\s*ड'), 'रोड'),
    (re.compile(r'के\s*रा\s*क\s*त'), 'केराकत'),
    (re.compile(r'जौ\s*न\s*पु\s*र'), 'जौनपुर'),
    (re.compile(r'ही\s*रा\s*पु\s*र'), 'हीरापुर'),
    (re.compile(r'म\s*च\s*ह\s*टी'), 'मचहटी'),
    (re.compile(r'म\s*हु\s*आ\s*र'), 'महुआर'),
    (re.compile(r'सं\s*क्र\s*म\s*णी\s*य'), 'संक्रमणीय'),
    (re.compile(r'भू\s*मि\s*ध\s*र'), 'भूमिधर'),
    (re.compile(r'क्ष\s*े\s*त्र\s*फ\s*ल'), 'क्षेत्रफल'),
    (re.compile(r'खा\s*ता'), 'खाता'),
    (re.compile(r'गा\s*टा'), 'गाटा'),
    (re.compile(r'ख\s*स\s*रा'), 'खसरा'),
    (re.compile(r'सं\s*ख्या'), 'संख्या'),
]

INDIC_STOP_WORDS: Set[str] = {
    'का', 'के', 'की', 'में', 'पर', 'और', 'एवं', 'ने', 'से', 'तो',
    'हे०', 'रु', 'रू', 'नि.', 'ग्राम', 'पो.'
}

def clean_indic_text(text: str) -> str:
    """
    Stitches Devanagari characters split by government PDF font kerning.
    Strips serial numbers (1), 2., etc.) and residual table formatting.
    """
    if not text:
        return ""
    t = text.strip()

    # 1. Strip leading numbering like '1) ', '1. ', '(1) ', '1 - '
    t = re.sub(r'^\s*(?:\d+[\.\)\-:]|\(\d+\))\s*', '', t)

    # 2. Join split matras e.g. 'र ' + 'ा' -> 'रा'
    t = COMBINING_MARKS.sub(r'\1\2', t)

    # 3. Known dictionary terms
    for pattern, rep in KNOWN_INDIC_WORDS:
        t = pattern.sub(rep, t)

    # 4. Smart Devanagari short-token stitcher
    tokens = t.split()
    res = []
    i = 0
    while i < len(tokens):
        curr = tokens[i]
        is_curr_dev = bool(re.match(r'^[\u0900-\u097F]+$', curr))

        if is_curr_dev and curr not in INDIC_STOP_WORDS and len(curr) <= 2 and (i + 1 < len(tokens)):
            nxt = tokens[i + 1]
            is_nxt_dev = bool(re.match(r'^[\u0900-\u097F]+$', nxt))
            if is_nxt_dev and nxt not in INDIC_STOP_WORDS:
                tokens[i + 1] = curr + nxt
                i += 1
                continue
        res.append(curr)
        i += 1

    clean = " ".join(res)
    # Strip any trailing or leading symbols
    clean = re.sub(r'^[/:;,.\s]+|[/:;,.\s]+$', '', clean)
    clean = re.sub(r'\s*[/]\s*नि\.?\s*ग्राम.*$', '', clean)
    clean = re.sub(r'\s*[/]\s*ग्राम.*$', '', clean)
    return clean.strip()

def is_mutation_or_non_owner(text: str) -> bool:
    """
    Determines if a candidate name is a mutation order, court remark, or bank detail.
    """
    if not text:
        return True
    
    clean = clean_indic_text(text).replace(" ", "").lower()

    # Reject if no Indic characters or pure numbers
    if not re.search(r'[\u0900-\u097F]', clean):
        return True
    
    # Reject dates, footer residue, or order keywords
    if re.match(r'^\d+$', clean) or len(clean) < 2:
        return True

    reject_patterns = [
        "उत्तराधिकार",
        "वरासत",
        "न्यायालय",
        "आदेश",
        "वाद",
        "कम्प्यूटरीकृत",
        "रजिस्ट्रार",
        "तहसीलदार",
        "कानूनगो",
        "निवासीग्राम",
        "बैंक",
        "bank",
        "union",
        "baroda",
        "kcc",
        "अन्तिम",
        "आधार",
        "पैन",
        "श्रेणी",
        "कोड",
        "दिनांक",
        "संस्था",
        "अन्य",
        "उपरोक्त",
        "अप्रमाणित",
        "प्रति",
        "भूलेख",
        "खतौनी",
        "राजस्व",
        "परिषद",
        "पृष्ठ",
        "https",
        "http",
    ]
    return any(p in clean for p in reject_patterns)
