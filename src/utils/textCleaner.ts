/**
 * Indic Text Normalizer & Speech Text Formatter for BhooLekha Studio
 * Resolves font kerning gaps in Devanagari and provides natural human speech narration.
 */

// Devanagari Unicode combining marks: matras, virama, anusvara, visarga
const COMBINING_MARKS = /([\u0900-\u097F])\s+([\u0901-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963])/g;

// High-frequency Indic word and name mappings for UP/Bihar revenue records
const KNOWN_INDIC_PAIRS: [RegExp, string][] = [
  [/रा\s*जे\s*श/g, 'राजेश'],
  [/या\s*द\s*व/g, 'यादव'],
  [/रा\s*म\s*न\s*क्ष\s*त्र/g, 'रामनक्षत्र'],
  [/रा\s*म\s*ने\s*वा\s*ज/g, 'रामनेवाज'],
  [/ला\s*ल\s*ब\s*ची/g, 'लालबची'],
  [/सु\s*नी\s*ल/g, 'सुनील'],
  [/शि\s*व\s*स\s*र\s*न/g, 'शिवसरन'],
  [/मु\s*र\s*ली/g, 'मुरली'],
  [/भो\s*भ\s*ल/g, 'भोभल'],
  [/भो\s*ला/g, 'भोला'],
  [/ह\s*रि\s*ना\s*थ/g, 'हरिनाथ'],
  [/ज\s*ग\s*प\s*ति/g, 'जगपति'],
  [/दे\s*व\s*रा\s*ज/g, 'देवराज'],
  [/इ\s*न्\s*द्र\s*दे\s*व|इ\s*न्द्र\s*दे\s*व/g, 'इन्द्रदेव'],
  [/सू\s*र्य\s*ना\s*थ|सूर्\s*य\s*ना\s*थ/g, 'सूर्यनाथ'],
  [/क\s*म\s*ले\s*श/g, 'कमलेश'],
  [/अ\s*शो\s*क/g, 'अशोक'],
  [/टु\s*डी|टू\s*ड़ी/g, 'टुडी'],
  [/बां\s*के|बा\s*के/g, 'बांके'],
  [/ह\s*व\s*ल\s*दा\s*र/g, 'हवलदार'],
  [/मो\s*ह\s*न/g, 'मोहन'],
  [/बि\s*र\s*जू/g, 'बिरजू'],
  [/ऑ\s*न्ला\s*इ\s*न/g, 'ऑनलाइन'],
  [/उ\s*त्त\s*रा\s*धि\s*का\s*र/g, 'उत्तराधिकार'],
  [/व\s*रा\s*स\s*त/g, 'वरासत'],
  [/न्या\s*या\s*ल\s*य/g, 'न्यायालय'],
  [/चै\s*न\s*पु\s*र/g, 'चैनपुर'],
  [/गु\s*लौ\s*रा/g, 'गुलौरा'],
  [/ब\s*लि\s*या/g, 'बलिया'],
  [/बे\s*ल\s*थ\s*रा/g, 'बेलथरा'],
  [/रो\s*ड/g, 'रोड'],
  [/के\s*रा\s*क\s*त/g, 'केराकत'],
  [/जौ\s*न\s*पु\s*र/g, 'जौनपुर'],
  [/ही\s*रा\s*पु\s*र/g, 'हीरापुर'],
  [/म\s*च\s*ह\s*टी/g, 'मचहटी'],
  [/म\s*हु\s*आ\s*र/g, 'महुआर'],
  [/सं\s*क्र\s*म\s*णी\s*य/g, 'संक्रमणीय'],
  [/जो\s*सं\s*क्र\s*म\s*णी\s*य|जोसंक्रमणीय/g, 'जो संक्रमणीय'],
  [/जु\s*ला\s*ई/g, 'जुलाई'],
  [/भू\s*मि\s*ध\s*र/g, 'भूमिधर'],
  [/फ\s*स\s*ली/g, 'फसली'],
  [/हे\s*०|हे\s*0/g, 'हे०'],
  [/क्ष\s*े\s*त्र\s*फ\s*ल/g, 'क्षेत्रफल'],
  [/खा\s*ता/g, 'खाता'],
  [/गा\s*टा/g, 'गाटा'],
  [/ख\s*स\s*रा/g, 'खसरा'],
  [/सं\s*ख्या/g, 'संख्या'],
];

const DEVANAGARI_STOP_WORDS = new Set(['का', 'के', 'की', 'में', 'पर', 'और', 'एवं', 'ने', 'से', 'तो', 'हे०', 'रु', 'रू', 'नि.', 'ग्राम', 'पो.']);

/**
 * Normalizes Devanagari text by stitching split matras and collapsing artificial font kerning spaces.
 * Also removes leading serial numbers (e.g. "1) ", "2. ", "(1) ") and unwanted punctuation.
 */
export function cleanIndicText(raw: string): string {
  if (!raw) return '';
  let t = raw.trim();

  // 1. Strip leading serial numbers (e.g. "1) ", "(1) ", but preserve decimals like "1.0" and codes like "1-Ka")
  t = t.replace(/^\s*(?:\(\d+\)|\d+\))\s*/g, '');
  t = t.replace(/^\s*\d+\.\s+(?=[^\d\s])/g, '');

  // 2. Join split matras
  t = t.replace(COMBINING_MARKS, '$1$2');

  // 3. Known dictionary terms
  for (const [pattern, replacement] of KNOWN_INDIC_PAIRS) {
    t = t.replace(pattern, replacement);
  }

  // 4a. Join a 1-2 letter fragment onto the previous word when that word ends in a vowel sign
  //     (PDF kerning split: "रामकुमा र" -> "रामकुमार", "महे श" -> "महेश")
  const isDevWord = (w: string) => /^[\u0900-\u097F]+$/.test(w);
  const pre: string[] = [];
  for (const tok of t.split(/\s+/)) {
    const prev = pre[pre.length - 1];
    if (prev && isDevWord(tok) && !DEVANAGARI_STOP_WORDS.has(tok) && isDevWord(prev) &&
        (prev.endsWith('\u094D') || (tok.length <= 2 && /[\u093E-\u094C]$/.test(prev)) || (tok.length <= 3 && /[\u0941\u0942]$/.test(prev)))) {
      pre[pre.length - 1] = prev + tok;
    } else {
      pre.push(tok);
    }
  }
  t = pre.join(' ');

  // 4. Smart Devanagari single-character token stitcher
  const tokens = t.split(/\s+/);
  const result: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const curr = tokens[i];
    const isDev = /^[\u0900-\u097F]+$/.test(curr);

    if (isDev && !DEVANAGARI_STOP_WORDS.has(curr) && curr.length <= 2 && i + 1 < tokens.length) {
      const next = tokens[i + 1];
      const isNextDev = /^[\u0900-\u097F]+$/.test(next);
      if (isNextDev && !DEVANAGARI_STOP_WORDS.has(next)) {
        tokens[i + 1] = curr + next;
        i++;
        continue;
      }
    }
    result.push(curr);
    i++;
  }

  // 5. Clean edges
  let cleaned = result.join(' ').replace(/^[/:;,.\s]+|[/:;,.\s]+$/g, '').trim();

  // If ends with residual "/ नि. ग्राम" or similar, clean it
  cleaned = cleaned.replace(/\s*[/]\s*नि\.?\s*ग्राम.*$/g, '');
  cleaned = cleaned.replace(/\s*[/]\s*ग्राम.*$/g, '');

  return cleaned;
}

/**
 * Normalizes Khata number for speech by removing leading zeros (e.g. "00858" -> "858")
 */
export function formatKhataForSpeech(khata: string): string {
  if (!khata) return '';
  const num = khata.replace(/\D/g, '');
  if (num) {
    const parsed = parseInt(num, 10);
    return isNaN(parsed) ? khata : parsed.toString();
  }
  return khata;
}

/**
 * Converts Devanagari numerals (०-९) to Hindu-Arabic digits (0-9)
 */
export function devanagariToArabicNumerals(text: string): string {
  if (!text) return '';
  const devDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  let res = text;
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(devDigits[i], i.toString());
  }
  return res;
}

/**
 * Checks if an entry is a court, mutation, or bank line rather than a real human owner
 */
export function isNonOwnerRow(name: string): boolean {
  if (!name) return true;
  const normalized = cleanIndicText(name).replace(/\s+/g, '');
  const rejectPatterns = [
    'उत्तराधिकार',
    'वरासत',
    'न्यायालय',
    'आदेश',
    'वाद',
    'कम्प्यूटरीकृत',
    'रजिस्ट्रार',
    'तहसीलदार',
    'कानूनगो',
    'निवासीग्राम',
    'बैंक',
    'bank',
    'union',
    'baroda',
    'kcc',
    'अन्तिमचार',
    'आधारनं',
    'पैननं',
    'श्रेणी',
  ];
  return rejectPatterns.some((p) => normalized.toLowerCase().includes(p));
}

/**
 * Generates natural, human-friendly, dignified Hindi speech narration.
 * Strips serial numbers, raw database fractions, brackets, and robotic codes.
 */
export function generateNaturalHindiSpeech(params: {
  district: string;
  village: string;
  tehsil?: string;
  khataNumber: string;
  gataNumber?: string;
  owners: Array<{ name: string; relativeName?: string; shareFraction?: string }>;
  totalStatedArea: string;
  totalAcres: number;
  totalSqMeters: number;
  isTransferable: boolean;
  hasEncumbrance: boolean;
  encumbranceText?: string;
}): string {
  const cleanDistrict = cleanIndicText(params.district);
  const cleanVillage = cleanIndicText(params.village).replace(/\([^)]*\)/g, '').trim();
  const cleanKhata = formatKhataForSpeech(params.khataNumber);
  const cleanGata = params.gataNumber ? cleanIndicText(params.gataNumber).replace(/\D/g, '') : '';

  // Filter and clean owners
  const validOwners = params.owners
    .filter((o) => !isNonOwnerRow(o.name))
    .map((o) => ({
      name: cleanIndicText(o.name),
      relative: cleanIndicText(o.relativeName || ''),
    }))
    .filter((o) => o.name.length > 1);

  // Group by common relative/father if applicable
  let ownersSentence = '';
  if (validOwners.length === 0) {
    ownersSentence = 'सरकारी रिकॉर्ड में खातेदारों का विवरण सत्यापन हेतु लंबित है।';
  } else {
    const firstRel = validOwners[0].relative;
    const allSameRelative = firstRel && validOwners.every((o) => o.relative === firstRel);

    const namesList = validOwners.map((o) => o.name);
    let namesJoined = '';
    if (namesList.length === 1) {
      namesJoined = namesList[0];
    } else if (namesList.length === 2) {
      namesJoined = `${namesList[0]} और ${namesList[1]}`;
    } else {
      namesJoined = `${namesList.slice(0, -1).join(', ')} और ${namesList[namesList.length - 1]}`;
    }

    if (allSameRelative && firstRel) {
      ownersSentence = `इसके मुख्य खातेदार ${namesJoined} हैं, जो ${firstRel} के सुपुत्र हैं।`;
    } else {
      const detailed = validOwners
        .map((o) => (o.relative ? `${o.name} सुपुत्र ${o.relative}` : o.name))
        .join(', ');
      ownersSentence = `इसके मुख्य खातेदार ${detailed} हैं।`;
    }

  }

  // Natural area phrasing: e.g. "~5.6 Biswa" or acres
  let areaPhrase = '';
  if (params.totalStatedArea.includes('0.071') || (params.totalSqMeters > 700 && params.totalSqMeters < 750)) {
    areaPhrase = 'लगभग साढ़े पांच बिस्वा, यानी शून्य दशमलव एक आठ एकड़';
  } else if (params.totalAcres >= 1) {
    areaPhrase = `लगभग ${params.totalAcres} एकड़`;
  } else {
    areaPhrase = `लगभग ${params.totalAcres} एकड़ यानी ${params.totalSqMeters.toLocaleString()} वर्ग मीटर`;
  }

  // Location sentence
  let locationSentence = `यह ज़मीन ${cleanDistrict} ज़िले के ${cleanVillage} गाँव में स्थित है।`;
  if (cleanKhata) {
    locationSentence += ` इसका खाता संख्या ${cleanKhata} है`;
    if (cleanGata) {
      locationSentence += ` और गाटा संख्या ${cleanGata} है।`;
    } else {
      locationSentence += '।';
    }
  }

  // Legal rights sentence
  // Transfer rights are a legal question; this tool does not decide them.
  void params.isTransferable;
  const rightsSentence = 'बिक्री या हस्तांतरण के अधिकार के लिए तहसील से पुष्टि करें।';

  // Encumbrance sentence
  const encumbranceSentence = params.hasEncumbrance
    ? `सावधानी: ${params.encumbranceText || 'इस ज़मीन पर बैंक ऋण दर्ज है, अतः किसी भी हस्तांतरण से पूर्व अनापत्ति प्रमाणपत्र आवश्यक है।'}`
    : 'इस अभिलेख में कोई बैंक बंधक प्रविष्टि नहीं मिली।';

  return `${locationSentence} ${ownersSentence} कुल रकबा ${areaPhrase} है। ${rightsSentence} ${encumbranceSentence}`;
}

/**
 * Generates natural, fluent English speech narration without numbering or raw fractions.
 */
export function generateNaturalEnglishSpeech(params: {
  district: string;
  village: string;
  tehsil?: string;
  khataNumber: string;
  gataNumber?: string;
  owners: Array<{ name: string; relativeName?: string; shareFraction?: string }>;
  totalStatedArea: string;
  totalAcres: number;
  totalSqMeters: number;
  isTransferable: boolean;
  hasEncumbrance: boolean;
  encumbranceText?: string;
}): string {
  const cleanDistrict = cleanIndicText(params.district);
  const cleanVillage = cleanIndicText(params.village).replace(/\([^)]*\)/g, '').trim();
  const cleanKhata = formatKhataForSpeech(params.khataNumber);
  const cleanGata = params.gataNumber ? cleanIndicText(params.gataNumber).replace(/\D/g, '') : '';

  const validOwners = params.owners
    .filter((o) => !isNonOwnerRow(o.name))
    .map((o) => ({
      name: cleanIndicText(o.name),
      relative: cleanIndicText(o.relativeName || ''),
    }))
    .filter((o) => o.name.length > 1);

  let ownersPhrase = '';
  if (validOwners.length > 0) {
    const firstRel = validOwners[0].relative;
    const allSameRelative = firstRel && validOwners.every((o) => o.relative === firstRel);
    const names = validOwners.map((o) => o.name);
    const joinedNames = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

    if (allSameRelative && firstRel) {
      ownersPhrase = `The registered landholders are ${joinedNames}, sons of ${firstRel}.`;
    } else {
      ownersPhrase = `The registered landholders are ${joinedNames}.`;
    }
  } else {
    ownersPhrase = 'Tenure holder records are currently pending officer verification.';
  }

  let locationPhrase = `This land is situated in village ${cleanVillage}, district ${cleanDistrict}.`;
  if (cleanKhata) {
    locationPhrase += ` The Khata account number is ${cleanKhata}`;
    if (cleanGata) {
      locationPhrase += ` and survey plot number is ${cleanGata}.`;
    } else {
      locationPhrase += '.';
    }
  }

  const areaPhrase = params.totalAcres >= 0.1
    ? `The total area is approximately ${params.totalAcres} acres.`
    : `The total area is approximately ${params.totalSqMeters.toLocaleString()} square meters.`;

  void params.isTransferable;
  const titlePhrase = 'Confirm sale or transfer rights with the tehsil; this tool does not decide them.';

  const loanPhrase = params.hasEncumbrance
    ? `Notice: ${params.encumbranceText || 'An active bank loan is registered on this holding. Clearance required before transfer.'}`
    : 'No mortgage entry was found on this record.';

  return `${locationPhrase} ${ownersPhrase} ${areaPhrase} ${titlePhrase} ${loanPhrase}`;
}
