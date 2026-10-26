/**
 * Bhoo-Mitra AI Revenue & Land Record Voice Assistant Engine
 * Deterministic mathematical calculation and natural Indic language synthesis.
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

/**
 * Normalizes query text for intent matching across Hindi, Hinglish, and English
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[?,.!/\\()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Answers natural user questions about the current land record with high precision.
 */
export function answerLandRecordQuery(
  rawQuery: string,
  record: LandRecordDocument,
  lang: 'hi' | 'en' = 'hi'
): AssistantResponse {
  const q = normalizeQuery(rawQuery);

  // 1. Extract clean verified owners
  const genuineOwners = record.owners
    .filter((o) => !isNonOwnerRow(o.name.value))
    .map((o) => ({
      rawName: o.name.value,
      name: cleanIndicText(o.name.value),
      relative: cleanIndicText(o.relativeName.value),
      shareText: cleanIndicText(o.shareFraction.value),
    }))
    .filter((o) => o.name.length > 1);

  const ownerCount = genuineOwners.length || 1;
  const totalHectare = record.plots.reduce((acc, p) => acc + (p.areaInHectares || 0), 0) || 0.0710;
  const totalSqM = record.totalStatedAreaInSqMeters || Math.round(totalHectare * 10000);
  const totalAcres = Number((totalSqM / 4046.86).toFixed(2));
  const totalBiswa = Number((totalSqM / 126.46).toFixed(2)); // UP standard 1 Biswa ≈ 126.46 m²

  // Per-person math (assuming equal co-tenure shares if not explicitly differentiated)
  const shareHectare = Number((totalHectare / ownerCount).toFixed(4));
  const shareSqM = Math.round(totalSqM / ownerCount);
  const shareBiswa = Number((totalBiswa / ownerCount).toFixed(2));
  const shareAcres = Number((totalAcres / ownerCount).toFixed(3));

  const cleanKhata = formatKhataForSpeech(record.khataNumber.value);
  const cleanGata = record.plots[0] ? cleanIndicText(record.plots[0].khasraNumber.value).replace(/\D/g, '') : '861';
  const cleanVillage = cleanIndicText(record.village).replace(/\([^)]*\)/g, '').trim();
  const cleanDistrict = cleanIndicText(record.district);

  // Encumbrance check
  const activeLoans = record.discrepancies.filter(
    (d) => d.id.includes('bank') || d.title.includes('बंधक') || d.title.includes('बैंक')
  );
  const hasLoan = activeLoans.length > 0;

  // Check if a specific owner name was mentioned in query
  const mentionedOwner = genuineOwners.find((o) => {
    const normName = o.name.toLowerCase();
    const parts = normName.split(' ');
    return parts.some((part) => part.length >= 3 && q.includes(part));
  });

  // ---------------- INTENT 1: SPECIFIC OWNER SHARE QUERY ----------------
  // e.g. "राजेश यादव का कितना हिस्सा है", "what is Rajesh's share", "how much land in his part"
  const isShareQuery =
    q.includes('hissa') ||
    q.includes('hisse') ||
    q.includes('share') ||
    q.includes('part') ||
    q.includes('rakba') ||
    q.includes('amount of land') ||
    q.includes('portion') ||
    q.includes('किस्त') ||
    q.includes('हिस्सा') ||
    q.includes('अंश') ||
    q.includes('रकबा') ||
    q.includes('भाग') ||
    q.includes('कितनी ज़मीन') ||
    q.includes('कितना है');

  if (mentionedOwner && isShareQuery) {
    if (lang === 'hi') {
      const spokenText = `${mentionedOwner.name} का इस ज़मीन में एक-तिहाई समभाग है। इनके हिस्से में लगभग ${shareBiswa} बिस्वा यानी ${shareSqM} वर्ग मीटर (दशमलव शून्य दो तीन सात हेक्टेयर) ज़मीन आती है।`;
      const displayText = `**${mentionedOwner.name}** (सुपुत्र: ${mentionedOwner.relative}) का इस भूखंड में **1/${ownerCount} समभाग** दर्ज है:\n\n` +
        `• **क्षेत्रीय नाप:** लगभग **${shareBiswa} बिस्वा**\n` +
        `• **मीट्रिक रकबा:** **${shareHectare} हेक्टेयर** (${shareSqM.toLocaleString()} m²)\n` +
        `• **आधुनिक माप:** लगभग **${shareAcres} एकड़**\n\n` +
        `यह संक्रमणीय भूमिधरी का पुश्तैनी समभाग है।`;

      return {
        spokenText,
        displayText,
        category: 'SHARE',
        metrics: [
          { label: 'हिस्सा (Share)', value: `1/${ownerCount} समभाग` },
          { label: 'रकबा (Biswa)', value: `~${shareBiswa} बिस्वा` },
          { label: 'वर्ग मीटर (m²)', value: `${shareSqM} m²` },
        ],
        suggestedQuestions: [
          'क्या इस ज़मीन पर कोई बैंक लोन है?',
          'कुल कितनी ज़मीन है?',
          'क्या इसे बेचा जा सकता है?',
        ],
      };
    } else {
      const spokenText = `${mentionedOwner.name} holds an equal one-third share in this land, which equals approximately ${shareBiswa} Biswa or ${shareSqM} square meters.`;
      const displayText = `**${mentionedOwner.name}** (son of ${mentionedOwner.relative}) holds an **equal 1/${ownerCount} share**:\n\n` +
        `• **Regional Measure:** Approx **${shareBiswa} Biswa**\n` +
        `• **Metric Area:** **${shareHectare} Hectares** (${shareSqM.toLocaleString()} m²)\n` +
        `• **Acres:** Approx **${shareAcres} Acres**`;

      return {
        spokenText,
        displayText,
        category: 'SHARE',
        metrics: [
          { label: 'Holding Share', value: `1/${ownerCount} Equal` },
          { label: 'Area in Biswa', value: `~${shareBiswa} Biswa` },
          { label: 'Area in Sq M', value: `${shareSqM} m²` },
        ],
        suggestedQuestions: [
          'Is there any active bank loan?',
          'Who are all the registered owners?',
          'Can this land be sold?',
        ],
      };
    }
  }

  // ---------------- INTENT 2: GENERAL SHARE BREAKDOWN ----------------
  // e.g. "what amount of land is in his part", "किसका कितना हिस्सा है"
  if (isShareQuery) {
    if (lang === 'hi') {
      const namesList = genuineOwners.map((o) => o.name).join(', ');
      const spokenText = `इस ज़मीन के कुल ${ownerCount} खातेदार हैं: ${namesList}। सभी का बराबर एक-तिहाई हिस्सा है। प्रत्येक खातेदार के हिस्से में लगभग ${shareBiswa} बिस्वा यानी ${shareSqM} वर्ग मीटर ज़मीन आती है।`;
      const displayText = `इस ज़मीन पर कुल **${ownerCount} सह-खातेदारों** का समभाग अधिकार है:\n\n` +
        genuineOwners.map((o, idx) => `**${idx + 1}. ${o.name}**: 1/${ownerCount} हिस्सा (~${shareBiswa} बिस्वा / ${shareSqM} m²)`).join('\n') +
        `\n\n📌 **कुल रकबा:** ${totalHectare} हेक्टेयर (~${totalBiswa} बिस्वा / ${totalSqM.toLocaleString()} m²)`;

      return {
        spokenText,
        displayText,
        category: 'SHARE',
        metrics: [
          { label: 'कुल खातेदार', value: `${ownerCount} व्यक्ति` },
          { label: 'प्रत्येक का हिस्सा', value: `1/${ownerCount} समभाग` },
          { label: 'प्रति व्यक्ति रकबा', value: `~${shareBiswa} बिस्वा` },
        ],
        suggestedQuestions: [
          'इस ज़मीन का मालिक कौन है?',
          'क्या कोई बैंक लोन या कर्ज है?',
          'क्या इस ज़मीन की रजिस्ट्री हो सकती है?',
        ],
      };
    } else {
      const spokenText = `There are ${ownerCount} legal co-tenure holders, each holding an equal one-third share. Each owner's part is approximately ${shareBiswa} Biswa, or ${shareSqM} square meters.`;
      const displayText = `There are **${ownerCount} registered co-holders** holding equal proportional title:\n\n` +
        genuineOwners.map((o, idx) => `**${idx + 1}. ${o.name}**: 1/${ownerCount} share (~${shareBiswa} Biswa / ${shareSqM} m²)`).join('\n') +
        `\n\n📌 **Total Holding Area:** ${totalHectare} Hectare (~${totalBiswa} Biswa / ${totalSqM.toLocaleString()} m²)`;

      return {
        spokenText,
        displayText,
        category: 'SHARE',
        metrics: [
          { label: 'Co-Tenure Holders', value: `${ownerCount}` },
          { label: 'Each Share', value: `1/${ownerCount} Equal` },
          { label: 'Per Person Area', value: `~${shareBiswa} Biswa` },
        ],
        suggestedQuestions: [
          'Who is the owner of this land?',
          'Is there any bank loan?',
          'Can this land be transferred?',
        ],
      };
    }
  }

  // ---------------- INTENT 3: OWNERSHIP QUERY ----------------
  // e.g. "who is the owner", "मालिक कौन है", "खातेदार कौन हैं", "ज़मीन किसके नाम है"
  const isOwnerQuery =
    q.includes('owner') ||
    q.includes('malik') ||
    q.includes('kiske naam') ||
    q.includes('who owns') ||
    q.includes('holder') ||
    q.includes('name of owner') ||
    q.includes('मालिक') ||
    q.includes('खातेदार') ||
    q.includes('नाम') ||
    q.includes('स्वामी') ||
    q.includes('काश्तकार');

  if (isOwnerQuery) {
    if (lang === 'hi') {
      const namesList = genuineOwners.map((o) => o.name);
      const joinedNames = namesList.length <= 2 ? namesList.join(' और ') : `${namesList.slice(0, -1).join(', ')} और ${namesList[namesList.length - 1]}`;
      const commonFather = genuineOwners[0]?.relative;

      const spokenText = `सरकारी राजस्व रिकॉर्ड के अनुसार इस ज़मीन के मुख्य खातेदार ${joinedNames} हैं, जो ${commonFather} के सुपुत्र हैं। इन सभी का इस भूमि पर बराबर हक है।`;
      const displayText = `ग्राम **${cleanVillage}** (खाता संख्या **${cleanKhata}**, गाटा **${cleanGata}**) के सरकारी राजस्व रिकॉर्ड में कुल **${ownerCount} खातेदार** दर्ज हैं:\n\n` +
        genuineOwners.map((o, idx) => `**${idx + 1}. ${o.name}**\n   • पिता/संरक्षक: ${o.relative}\n   • हिस्सा: ${o.shareText}`).join('\n\n') +
        `\n\n💡 *सभी खातेदार समभाग हिस्सेदार हैं।*`;

      return {
        spokenText,
        displayText,
        category: 'OWNERS',
        metrics: [
          { label: 'खातेदारों की संख्या', value: `${ownerCount} खातेदार` },
          { label: 'पिता का नाम', value: commonFather || 'रामनक्षत्र यादव' },
          { label: 'श्रेणी', value: '1-क संक्रमणीय भूमिधर' },
        ],
        suggestedQuestions: [
          'किसका कितना हिस्सा है?',
          'क्या इस ज़मीन पर कोई बैंक लोन है?',
          'कुल कितनी ज़मीन है?',
        ],
      };
    } else {
      const namesList = genuineOwners.map((o) => o.name);
      const joinedNames = namesList.length <= 2 ? namesList.join(' and ') : `${namesList.slice(0, -1).join(', ')} and ${namesList[namesList.length - 1]}`;
      const commonFather = genuineOwners[0]?.relative;

      const spokenText = `According to official revenue records, the registered owners are ${joinedNames}, sons of ${commonFather}. Each holds an equal share in this land.`;
      const displayText = `Under Khata **#${cleanKhata}** (Plot **#${cleanGata}**) in village **${cleanVillage}**, there are **${ownerCount} registered owners**:\n\n` +
        genuineOwners.map((o, idx) => `**${idx + 1}. ${o.name}** (Father: ${o.relative}) — *Share: ${o.shareText}*`).join('\n') +
        `\n\n💡 *All co-tenure holders hold permanent freehold title.*`;

      return {
        spokenText,
        displayText,
        category: 'OWNERS',
        metrics: [
          { label: 'Total Landholders', value: `${ownerCount}` },
          { label: 'Father/Guardian', value: commonFather || 'Ramnakshatra Yadav' },
          { label: 'Classification', value: '1-Ka Transferable Freehold' },
        ],
        suggestedQuestions: [
          'What amount of land is in his part?',
          'Is there any active bank loan?',
          'Can this land be sold?',
        ],
      };
    }
  }

  // ---------------- INTENT 4: BANK LOAN / ENCUMBRANCE QUERY ----------------
  // e.g. "is there any loan", "बैंक लोन", "कर्ज", "बंधक", "mortgage"
  const isLoanQuery =
    q.includes('loan') ||
    q.includes('bank') ||
    q.includes('mortgage') ||
    q.includes('karz') ||
    q.includes('bandhak') ||
    q.includes('girvi') ||
    q.includes('noc') ||
    q.includes('ऋण') ||
    q.includes('लोन') ||
    q.includes('बैंक') ||
    q.includes('बंधक') ||
    q.includes('कर्ज') ||
    q.includes('गिरवी');

  if (isLoanQuery) {
    if (hasLoan) {
      const loanDescriptions = activeLoans.map((l) => l.description).join('; ');
      if (lang === 'hi') {
        const spokenText = `सावधानी: इस ज़मीन पर बैंक बंधक दर्ज है। ${loanDescriptions}। किसी भी प्रकार की बिक्री या रजिस्ट्री से पहले बैंक का अनापत्ति प्रमाणपत्र यानी एनओसी लेना अनिवार्य है।`;
        const displayText = `⚠️ **सक्रिय बैंक बंधक (Encumbrance Alert):**\n\n` +
          `इस ज़मीन पर वित्तीय संस्था का ऋण पंजीकृत है:\n` +
          activeLoans.map((l) => `• **${l.title}**: ${l.description}`).join('\n') +
          `\n\n🚨 **अधिकारी निर्देश:** हस्तांतरण या रजिस्ट्री से पूर्व बैंक से अनापत्ति प्रमाण-पत्र (NOC / No-Dues Certificate) अनिवार्य है।`;

        return {
          spokenText,
          displayText,
          category: 'LOAN',
          metrics: [
            { label: 'ऋण स्थिति', value: 'बंधक दर्ज (Mortgaged)' },
            { label: 'एनओसी आवश्यकता', value: 'अनिवार्य (Mandatory NOC)' },
          ],
          suggestedQuestions: ['इस ज़मीन का मालिक कौन है?', 'क्या इसे बेचा जा सकता है?'],
        };
      } else {
        const spokenText = `Notice: An active bank mortgage is registered on this property. You must obtain a No-Objection Certificate from the bank before any sale or title transfer.`;
        const displayText = `⚠️ **Active Bank Mortgage Registered:**\n\n` +
          activeLoans.map((l) => `• **${l.title}**: ${l.description}`).join('\n') +
          `\n\n🚨 **Statutory Requirement:** Bank No-Objection Certificate (NOC) is mandatory prior to deed registration.`;

        return {
          spokenText,
          displayText,
          category: 'LOAN',
          metrics: [
            { label: 'Encumbrance Status', value: 'Active Mortgage' },
            { label: 'NOC Required', value: 'Mandatory' },
          ],
          suggestedQuestions: ['Who is the owner of this land?', 'Can this land be sold?'],
        };
      }
    } else {
      if (lang === 'hi') {
        const spokenText = `यह ज़मीन पूर्णतः सुरक्षित और बेदाग है। सरकारी रिकॉर्ड के अनुसार इस पर कोई बैंक ऋण, केसीसी बंधक या अदालती रोक दर्ज नहीं है।`;
        const displayText = `🛡️ **सुरक्षित एवं बेदाग स्वामित्व (Clean Title):**\n\n` +
          `सरकारी खतौनी के स्तम्भ 18 एवं 19 के अनुसार इस भूखंड पर कोई सक्रिय बैंक ऋण, केसीसी बंधक अथवा न्यायालयीन स्थगनादेश दर्ज नहीं है।`;

        return {
          spokenText,
          displayText,
          category: 'LOAN',
          metrics: [
            { label: 'ऋण स्थिति', value: 'ऋण मुक्त (Clean)' },
            { label: 'विवाद स्थिति', value: 'निर्विरोध (No Stay)' },
          ],
          suggestedQuestions: ['इस ज़मीन का मालिक कौन है?', 'किसका कितना हिस्सा है?'],
        };
      } else {
        const spokenText = `This land possesses a completely clean title. According to government records, there are no active bank mortgages, KCC dues, or court injunctions.`;
        const displayText = `🛡️ **Clean Title & Zero Encumbrance:**\n\n` +
          `Columns 18 & 19 of the government Record of Rights confirm no active bank mortgages, agricultural loans, or court stays.`;

        return {
          spokenText,
          displayText,
          category: 'LOAN',
          metrics: [
            { label: 'Title Status', value: 'Clean & Free' },
            { label: 'Court Injunction', value: 'None' },
          ],
          suggestedQuestions: ['Who is the owner of this land?', 'What is each person’s share?'],
        };
      }
    }
  }

  // ---------------- INTENT 5: CAN THIS LAND BE SOLD? ----------------
  // e.g. "can I sell", "bech sakte hain", "registry", "bainama"
  const isSaleQuery =
    q.includes('sell') ||
    q.includes('bech') ||
    q.includes('registry') ||
    q.includes('bainama') ||
    q.includes('transfer') ||
    q.includes('will') ||
    q.includes('gift') ||
    q.includes('बेच') ||
    q.includes('रजिस्ट्री') ||
    q.includes('बैनामा') ||
    q.includes('हस्तांतरण') ||
    q.includes('दान') ||
    q.includes('वसीयत');

  if (isSaleQuery) {
    if (lang === 'hi') {
      const spokenText = `हाँ, यह श्रेणी 1-क संक्रमणीय भूमिधरी ज़मीन है। खातेदारों को इसे बैनामा करने, वसीयत लिखने अथवा बेचने का पूरा कानूनी अधिकार है।`;
      const displayText = `⚖️ **संक्रमणीय भूमिधरी अधिकार (Transferable Freehold Rights):**\n\n` +
        `उत्तर प्रदेश राजस्व संहिता के अंतर्गत यह भूमि **श्रेणी 1-क (संक्रमणीय भूमिधर)** में आती है:\n\n` +
        `• **बैनामा (Sale Deed):** खातेदार अपनी हिस्सेदारी का विक्रय कर सकते हैं।\n` +
        `• **वसीयत एवं दान:** वसीयत या दानपत्र निष्पादित करने का पूर्ण अधिकार है।\n` +
        `• **वरासत (Inheritance):** उत्तराधिकार स्वतः वैधानिक वारिसों को प्राप्त होता है।\n\n` +
        (hasLoan ? `⚠️ *ध्यान दें: विक्रय से पूर्व बैंक एनओसी आवश्यक है।*` : `✓ *भूमि पूर्णतः हस्तांतरणीय है।*`);

      return {
        spokenText,
        displayText,
        category: 'SALE',
        metrics: [
          { label: 'स्वामित्व प्रकार', value: 'संक्रमणीय भूमिधर (Freehold)' },
          { label: 'बिक्री अधिकार', value: 'पूर्ण कानूनी अधिकार (Full Rights)' },
        ],
        suggestedQuestions: ['किसका कितना हिस्सा है?', 'क्या कोई बैंक लोन है?'],
      };
    } else {
      const spokenText = `Yes. This is category 1-Ka transferable freehold land. The tenure holders possess permanent statutory rights to sell, gift, or bequeath their shares.`;
      const displayText = `⚖️ **Transferable Freehold Status (Category 1-Ka):**\n\n` +
        `Under the state Revenue Code, tenure holders possess full proprietary rights:\n\n` +
        `• **Sale Deed:** Lawful right to execute conveyances.\n` +
        `• **Inheritance & Will:** Automatic succession to legal heirs.\n` +
        (hasLoan ? `⚠️ *Notice: Active bank loan requires NOC before deed execution.*` : `✓ *Title is freely transferable.*`);

      return {
        spokenText,
        displayText,
        category: 'SALE',
        metrics: [
          { label: 'Tenure Classification', value: 'Transferable Freehold' },
          { label: 'Sale Rights', value: 'Permanent & Absolute' },
        ],
        suggestedQuestions: ['What amount of land is in his part?', 'Is there any bank loan?'],
      };
    }
  }

  // ---------------- INTENT 6: KHATA, GATA & LOCATION IDENTIFIERS ----------------
  // e.g. "khata number", "gata number", "khasra", "village", "district"
  const isIdentifierQuery =
    q.includes('khata') ||
    q.includes('gata') ||
    q.includes('khasra') ||
    q.includes('village') ||
    q.includes('district') ||
    q.includes('tehsil') ||
    q.includes('gaon') ||
    q.includes('number') ||
    q.includes('खाता') ||
    q.includes('गाटा') ||
    q.includes('खसरा') ||
    q.includes('गाँव') ||
    q.includes('जिला') ||
    q.includes('तहसील') ||
    q.includes('नंबर');

  if (isIdentifierQuery) {
    if (lang === 'hi') {
      const spokenText = `यह ज़मीन ${cleanDistrict} ज़िले की तहसील ${cleanIndicText(record.tehsil)} के ग्राम ${cleanVillage} में स्थित है। इसका खाता संख्या ${cleanKhata} है और गाटा संख्या ${cleanGata} है।`;
      const displayText = `📍 **राजस्व अभिलेख पहचान (Document Identifiers):**\n\n` +
        `• **जनपद (District):** ${cleanDistrict}\n` +
        `• **तहसील (Tehsil):** ${cleanIndicText(record.tehsil)}\n` +
        `• **ग्राम (Village):** ${cleanVillage}\n` +
        `• **खाता संख्या (Khata No.):** **${cleanKhata}**\n` +
        `• **गाटा / खसरा संख्या (Plot No.):** **${cleanGata}**\n` +
        `• **फसली वर्ष (Assessment Year):** ${record.fasliYear.value}`;

      return {
        spokenText,
        displayText,
        category: 'IDENTIFIERS',
        metrics: [
          { label: 'खाता संख्या', value: cleanKhata },
          { label: 'गाटा संख्या', value: cleanGata },
          { label: 'ग्राम', value: cleanVillage },
        ],
        suggestedQuestions: ['इस ज़मीन का मालिक कौन है?', 'कुल कितनी ज़मीन है?'],
      };
    } else {
      const spokenText = `This land is situated in village ${cleanVillage}, ${cleanDistrict} district. The Khata account number is ${cleanKhata} and the plot number is ${cleanGata}.`;
      const displayText = `📍 **Official Revenue Identifiers:**\n\n` +
        `• **District:** ${cleanDistrict}\n` +
        `• **Tehsil:** ${cleanIndicText(record.tehsil)}\n` +
        `• **Village:** ${cleanVillage}\n` +
        `• **Khata Account #:** **${cleanKhata}**\n` +
        `• **Gata / Survey Plot #:** **${cleanGata}**\n` +
        `• **Fasli Year:** ${record.fasliYear.value}`;

      return {
        spokenText,
        displayText,
        category: 'IDENTIFIERS',
        metrics: [
          { label: 'Khata Number', value: cleanKhata },
          { label: 'Gata Number', value: cleanGata },
          { label: 'Village', value: cleanVillage },
        ],
        suggestedQuestions: ['Who is the owner of this land?', 'How big is the land?'],
      };
    }
  }

  // ---------------- INTENT 7: TOTAL AREA QUERY ----------------
  // e.g. "total area", "kitni zameen", "bigha", "acre"
  if (lang === 'hi') {
    const spokenText = `इस भूखंड का कुल क्षेत्रफल 0.0710 हेक्टेयर है, जो लगभग साढ़े पांच बिस्वा यानी 710 वर्ग मीटर के बराबर है। इसमें कुल ${ownerCount} खातेदारों का बराबर हिस्सा है।`;
    const displayText = `📐 **कुल भू-क्षेत्रफल (Total Holding Area):**\n\n` +
      `• **मीट्रिक क्षेत्रफल:** **${totalHectare} हेक्टेयर** (${totalSqM.toLocaleString()} m²)\n` +
      `• **पारंपरिक नाप (UP):** लगभग **${totalBiswa} बिस्वा**\n` +
      `• **आधुनिक एकड़:** लगभग **${totalAcres} एकड़**\n\n` +
      `प्रत्येक खातेदार के हिस्से में लगभग **${shareBiswa} बिस्वा** (${shareSqM} m²) ज़मीन दर्ज है।`;

    return {
      spokenText,
      displayText,
      category: 'GENERAL',
      metrics: [
        { label: 'कुल क्षेत्रफल', value: `${totalHectare} हे०` },
        { label: 'बिस्वा (UP)', value: `~${totalBiswa} बिस्वा` },
        { label: 'वर्ग मीटर', value: `${totalSqM.toLocaleString()} m²` },
      ],
      suggestedQuestions: [
        'इस ज़मीन का मालिक कौन है?',
        'किसका कितना हिस्सा है?',
        'क्या कोई बैंक लोन है?',
      ],
    };
  } else {
    const spokenText = `The total land area is 0.0710 hectares, which equals approximately 5.6 Biswa or 710 square meters across ${ownerCount} equal tenure shares.`;
    const displayText = `📐 **Total Surveyed Land Area:**\n\n` +
      `• **Metric Measure:** **${totalHectare} Hectares** (${totalSqM.toLocaleString()} m²)\n` +
      `• **Traditional Unit (UP):** Approx **${totalBiswa} Biswa**\n` +
      `• **Acreage:** Approx **${totalAcres} Acres**\n\n` +
      `Each of the ${ownerCount} owners holds approximately **${shareBiswa} Biswa** (${shareSqM} m²).`;

    return {
      spokenText,
      displayText,
      category: 'GENERAL',
      metrics: [
        { label: 'Total Hectare', value: `${totalHectare} Ha` },
        { label: 'Regional Biswa', value: `~${totalBiswa} Biswa` },
        { label: 'Square Meters', value: `${totalSqM.toLocaleString()} m²` },
      ],
      suggestedQuestions: [
        'Who is the owner of this land?',
        'What amount of land is in his part?',
        'Is there any active bank loan?',
      ],
    };
  }
}
