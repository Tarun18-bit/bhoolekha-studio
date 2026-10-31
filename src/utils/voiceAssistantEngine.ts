/**
 * Bhoo-Mitra record assistant.
 * Answers ONLY from the fields on the current record. When the record does not state
 * something (a share, a boundary, whether land can be sold), the answer says so instead
 * of assuming. Nothing here is legal advice.
 */

import type { LandRecordDocument } from '../types/landRecord';
import { cleanIndicText, formatKhataForSpeech, isNonOwnerRow } from './textCleaner';

export interface AssistantResponse {
  spokenText: string;
  displayText: string;
  category: 'OWNERS' | 'SHARE' | 'LOAN' | 'SALE' | 'IDENTIFIERS' | 'GENERAL';
  metrics?: Array<{ label: string; value: string }>;
  suggestedQuestions: string[];
}

const has = (q: string, words: string[]) => words.some((w) => q.includes(w));

const KW = {
  share: ['hissa', 'hisse', 'share', 'part', 'portion', 'हिस्सा', 'अंश', 'भाग'],
  owner: ['owner', 'kiske naam', 'who owns', 'holder', 'malik', 'मालिक', 'खातेदार', 'नाम', 'स्वामी', 'काश्तकार'],
  loan: ['loan', 'bank', 'mortgage', 'karz', 'bandhak', 'girvi', 'ऋण', 'लोन', 'बैंक', 'बंधक', 'कर्ज', 'गिरवी'],
  sale: ['sell', 'bech', 'registry', 'bainama', 'transfer', 'gift', 'बेच', 'रजिस्ट्री', 'बैनामा', 'हस्तांतरण', 'दान', 'वसीयत'],
  ident: ['khata', 'gata', 'khasra', 'village', 'district', 'tehsil', 'gaon', 'number', 'खाता', 'गाटा', 'खसरा', 'गाँव', 'गांव', 'जिला', 'तहसील', 'नंबर'],
  area: ['area', 'size', 'bigha', 'biswa', 'acre', 'hectare', 'kitni zameen', 'rakba', 'रकबा', 'क्षेत्रफल', 'बीघा', 'बिस्वा', 'एकड़', 'हेक्टेयर', 'कितनी ज़मीन', 'कितनी जमीन'],
};

/** Parses a recorded share like "1/3", "१/३", "0.5" into a fraction, or null. */
function parseShare(text: string): number | null {
  const t = (text || '').replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d))).trim();
  const m = t.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (m) { const v = Number(m[1]) / Number(m[2]); return v > 0 && v <= 1 ? v : null; }
  const d = t.match(/^0?\.\d+$/);
  return d ? Number(t) : null;
}

export function answerLandRecordQuery(rawQuery: string, record: LandRecordDocument, lang: 'hi' | 'en' = 'hi'): AssistantResponse {
  const q = rawQuery.toLowerCase().replace(/[?,.!\\()]/g, ' ').replace(/\s+/g, ' ').trim();
  const hi = lang === 'hi';
  const T = (h: string, e: string) => (hi ? h : e);
  const NR = T('अभिलेख में दर्ज नहीं', 'not recorded');

  const owners = record.owners
    .filter((o) => !isNonOwnerRow(o.name.value))
    .map((o) => ({
      name: cleanIndicText(o.name.value),
      relative: cleanIndicText(o.relativeName.value),
      shareText: cleanIndicText(o.shareFraction?.value || ''),
      share: parseShare(o.shareFraction?.value || ''),
      verified: !!o.name.isVerified,
    }))
    .filter((o) => o.name.length > 1);

  const totalSqM = record.totalStatedAreaInSqMeters || record.plots.reduce((a, p) => a + (p.areaInSqMeters || 0), 0);
  const areaKnown = totalSqM > 0;
  const fmtArea = (sqm: number) => `${(sqm / 10000).toFixed(4)} ${T('हेक्टेयर', 'ha')} (${Math.round(sqm).toLocaleString()} m²)`;
  const khata = record.khataNumber.value ? formatKhataForSpeech(record.khataNumber.value) : NR;
  const gatas = record.plots.map((p) => cleanIndicText(p.khasraNumber.value)).filter(Boolean);
  const village = cleanIndicText(record.village || '').replace(/\([^)]*\)/g, '').trim() || NR;
  const loans = record.discrepancies.filter((d) => /bank|बंधक|बैंक|ऋण|mortgage/i.test(d.id + ' ' + d.title));
  const pending = record.verificationStatus !== 'OFFICER_APPROVED';
  const caveat = pending ? T('\n\n_यह अभिलेख अभी अधिकारी द्वारा सत्यापित नहीं है।_', '\n\n_This record is not yet verified by an officer._') : '';
  const follow = hi
    ? ['मालिक कौन है?', 'किसका कितना हिस्सा है?', 'कुल कितनी ज़मीन है?', 'क्या कोई बैंक लोन है?']
    : ['Who owns this land?', "What is each person's share?", 'How much land is there?', 'Is there any bank loan?'];
  const reply = (category: AssistantResponse['category'], spokenText: string, displayText: string, metrics?: AssistantResponse['metrics']): AssistantResponse =>
    ({ category, spokenText, displayText: displayText + caveat, metrics, suggestedQuestions: follow });

  // Share
  if (has(q, KW.share)) {
    if (!owners.length) return reply('SHARE', T('इस अभिलेख में कोई खातेदार दर्ज नहीं है।', 'No holders are recorded on this record.'), T('कोई खातेदार दर्ज नहीं।', 'No holders recorded.'));
    const target = owners.find((o) => o.name.toLowerCase().split(' ').some((p) => p.length >= 3 && q.includes(p)));
    const list = target ? [target] : owners;
    const lines = list.map((o) => {
      const area = o.share != null && areaKnown ? ` ≈ ${fmtArea(totalSqM * o.share)}` : '';
      return `• **${o.name}**: ${o.shareText || NR}${area}`;
    });
    const anyMissing = list.some((o) => !o.shareText);
    const note = anyMissing ? T('\n\nजहाँ हिस्सा दर्ज नहीं है, वहाँ बराबर हिस्सा मानना सही नहीं है; खतौनी/वरासत आदेश देखें।', '\n\nWhere a share is not recorded, it must not be assumed equal; check the khatauni or succession order.') : '';
    const spoken = list.map((o) => `${o.name}: ${o.shareText || NR}`).join('. ');
    return reply('SHARE', spoken, lines.join('\n') + note);
  }

  // Owners
  if (has(q, KW.owner)) {
    if (!owners.length) return reply('OWNERS', T('इस अभिलेख में कोई खातेदार दर्ज नहीं है।', 'No holders are recorded on this record.'), T('कोई खातेदार दर्ज नहीं।', 'No holders recorded.'));
    const names = owners.map((o) => o.name).join(', ');
    const lines = owners.map((o, i) => `**${i + 1}. ${o.name}**${o.relative ? ` (${T('पिता/पति', 'relative')}: ${o.relative})` : ''} — ${T('हिस्सा', 'share')}: ${o.shareText || NR}`);
    return reply('OWNERS', T(`इस अभिलेख में ${owners.length} खातेदार दर्ज हैं: ${names}।`, `${owners.length} holders are recorded: ${names}.`), lines.join('\n'),
      [{ label: T('खातेदार', 'Holders'), value: String(owners.length) }]);
  }

  // Loans / encumbrance
  if (has(q, KW.loan)) {
    if (loans.length) {
      const lines = loans.map((d) => `• ${d.title}: ${d.description}`).join('\n');
      return reply('LOAN', T(`इस अभिलेख में ${loans.length} बंधक/ऋण प्रविष्टि दर्ज है।`, `The record shows ${loans.length} mortgage/loan entry.`), lines);
    }
    const msg = T('इस अभिलेख में कोई बैंक बंधक प्रविष्टि नहीं मिली। यह केवल इसी दस्तावेज़ पर आधारित है; बैंक/रजिस्ट्री से अलग से जाँच करें।',
      'No mortgage entry was found on this record. This is based on this document only; check with the bank/registry separately.');
    return reply('LOAN', msg, msg);
  }

  // Sale / transfer: never give a legal opinion
  if (has(q, KW.sale)) {
    const cls = record.plots.map((p) => cleanIndicText(p.landClassification?.value || '')).filter(Boolean);
    const msg = T(`यह उपकरण बिक्री या हस्तांतरण की वैधता तय नहीं करता। अभिलेख में भूमि श्रेणी: ${cls.join(', ') || NR}। तहसील या वकील से पुष्टि करें।`,
      `This tool cannot decide whether the land can be sold or transferred. Land class on the record: ${cls.join(', ') || NR}. Confirm with the tehsil or a lawyer.`);
    return reply('SALE', msg, msg);
  }

  // Identifiers
  if (has(q, KW.ident)) {
    const metrics = [
      { label: T('खाता', 'Khata'), value: record.khataNumber.value || NR },
      { label: T('गाटा/खसरा', 'Gata/Khasra'), value: gatas.join(', ') || NR },
      { label: T('ग्राम', 'Village'), value: village },
      { label: T('तहसील', 'Tehsil'), value: cleanIndicText(record.tehsil || '') || NR },
      { label: T('जिला', 'District'), value: cleanIndicText(record.district || '') || NR },
    ];
    return reply('IDENTIFIERS',
      T(`खाता संख्या ${khata}, गाटा ${gatas.join(', ') || NR}, ग्राम ${village}।`, `Khata ${khata}, gata ${gatas.join(', ') || NR}, village ${village}.`),
      metrics.map((m) => `• **${m.label}:** ${m.value}`).join('\n'), metrics);
  }

  // Area
  if (has(q, KW.area)) {
    if (!areaKnown) return reply('GENERAL', T('इस अभिलेख में क्षेत्रफल दर्ज नहीं है।', 'The area is not recorded on this record.'), T('क्षेत्रफल दर्ज नहीं।', 'Area not recorded.'));
    const plotLines = record.plots.map((p) => `• ${T('गाटा', 'Gata')} ${cleanIndicText(p.khasraNumber.value) || '?'}: ${p.areaInSqMeters ? fmtArea(p.areaInSqMeters) : NR}`).join('\n');
    return reply('GENERAL', T(`कुल क्षेत्रफल ${fmtArea(totalSqM)} दर्ज है।`, `The recorded total area is ${fmtArea(totalSqM)}.`),
      `**${T('कुल', 'Total')}:** ${fmtArea(totalSqM)} · ${(totalSqM / 4046.86).toFixed(2)} ${T('एकड़', 'acres')}\n${plotLines}`);
  }

  const help = T('मैं इस अभिलेख के खातेदार, हिस्सा, क्षेत्रफल, खाता/गाटा और बंधक प्रविष्टि के बारे में बता सकता हूँ।',
    'I can answer about this record\'s holders, shares, area, khata/gata numbers and mortgage entries.');
  return reply('GENERAL', help, help);
}
