import re
from typing import List, Set

COMBINING_MARKS = re.compile(r'([\u0900-\u097F])\s+([\u0901-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963])')

KNOWN_INDIC_WORDS = [
    (re.compile(r'रा\s*जे\s*श'), 'राजेश'),
    (re.compile(r'या\s*द\s*व'), 'यादव'),
    (re.compile(r'रा\s*म\s*न\s*क्ष\s*त्र'), 'रामनक्षत्र'),
    (re.compile(r'रा\s*म\s*ने\s*वा\s*ज'), 'रामनेवाज'),
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
    (re.compile(r'जो\s*सं\s*क्र\s*म\s*णी\s*य|जोसंक्रमणीय'), 'जो संक्रमणीय'),
    (re.compile(r'जु\s*ला\s*ई'), 'जुलाई'),
    (re.compile(r'भू\s*मि\s*ध\s*र'), 'भूमिधर'),
    (re.compile(r'फ\s*स\s*ली'), 'फसली'),
    (re.compile(r'हे\s*०|हे\s*0'), 'हे०'),
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

    # 1. Strip leading numbering like '1) ', '1. ' (ONLY when not a decimal like 1.0 or code like 1-Ka)
    t = re.sub(r'^\s*(?:\(\d+\)|\d+\))\s*', '', t)
    t = re.sub(r'^\s*\d+\.\s+(?=[^\d\s])', '', t)

    # 2. Join split matras e.g. 'र ' + 'ा' -> 'रा'
    t = COMBINING_MARKS.sub(r'\1\2', t)

    # 3. Known dictionary terms
    for pattern, rep in KNOWN_INDIC_WORDS:
        t = pattern.sub(rep, t)

    # 4a. Join a 1-2 letter fragment onto the previous word when that word ends in a vowel sign
    #     (PDF kerning split: "रामकुमा र" -> "रामकुमार", "महे श" -> "महेश")
    pre: List[str] = []
    for tok in t.split():
        if (pre and re.match(r'^[\u0900-\u097F]+$', tok) and tok not in INDIC_STOP_WORDS
                and re.match(r'^[\u0900-\u097F]+$', pre[-1])
                and (pre[-1].endswith('\u094D')            # a half letter never ends a word: "नेन् सी"
                     or (len(tok) <= 2 and re.search(r'[\u093E-\u094C]$', pre[-1]))
                     # this font always leaves a gap after the u-matra: "अजयकु मार", "सुनिलकु मार"
                     or (len(tok) <= 3 and re.search(r'[\u0941\u0942]$', pre[-1])))):
            pre[-1] += tok
        else:
            pre.append(tok)
    t = " ".join(pre)

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

def devanagari_to_arabic_numerals(text: str) -> str:
    """Converts Devanagari numerals (०-९) to Hindu-Arabic numerals (0-9)."""
    if not text:
        return ""
    dev_digits = "०१२३४५६७८९"
    arab_digits = "0123456789"
    trans = str.maketrans(dev_digits, arab_digits)
    return text.translate(trans)

def is_mutation_or_non_owner(text: str) -> bool:
    """
    Determines if a candidate name is a mutation order, court remark, or bank detail.
    Supports ALL Indian scripts: Devanagari, Telugu, Kannada, Tamil, Malayalam, Bengali, Gujarati, Odia, Gurmukhi, and English.
    """
    if not text:
        return False
    
    clean = clean_indic_text(text).replace(" ", "").lower()

    # Reject if no Indic or Latin alphabetic characters, or pure numbers
    # Unicode Indic blocks: \u0900-\u0D7F encompasses Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada, Malayalam
    if not re.search(r'[\u0900-\u0D7F\u0041-\u005A\u0061-\u007A]', clean):
        return True
    
    # Reject pure numbers or single characters
    if re.match(r'^\d+$', clean) or len(clean) < 2:
        return True

    # Check for mutation/court orders in Hindi, Telugu, and English
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
        "ఆదేశం",
        "కోర్టు",
        "వివాదం",
        "తీర్పు",
        "రిజిస్ట్రార్",
        "బ్యాంక్",
    ]
    return any(p in clean for p in reject_patterns)
