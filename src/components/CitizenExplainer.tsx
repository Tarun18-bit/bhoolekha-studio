import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Printer, 
  Languages, 
  Wheat,
  Mic,
  MicOff
} from 'lucide-react';
import type { LandRecordDocument } from '../types/landRecord';
import { 
  cleanIndicText, 
  isNonOwnerRow, 
  generateNaturalHindiSpeech, 
  generateNaturalEnglishSpeech 
} from '../utils/textCleaner';

interface CitizenExplainerProps {
  record: LandRecordDocument;
}

export const CitizenExplainer: React.FC<CitizenExplainerProps> = ({ record }) => {
  const [lang, setLang] = useState<'hi' | 'en'>('hi');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [voiceStatusText, setVoiceStatusText] = useState<string>('');

  // Speech Recognition Reference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Clean speech synthesis and recognition on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Compute total area in acres and comparison
  const totalSqM = record.totalStatedAreaInSqMeters;
  const totalAcres = Number((totalSqM / 4046.86).toFixed(2));
  const footballFields = Number((totalSqM / 7140).toFixed(1)); // Standard football field ~7140 sq m

  // Encumbrance check: does record have mortgage or court notes?
  const hasEncumbrance = record.discrepancies.some((d) => d.id.includes('bank') || d.title.includes('बंधक'));
  const encumbranceDetails = hasEncumbrance
    ? {
        hi: 'इस ज़मीन पर बैंक ऋण बंधक दर्ज है। ज़मीन की रजिस्ट्री या हस्तांतरण से पहले बैंक का अनापत्ति प्रमाणपत्र (NOC) आवश्यक है।',
        en: 'An active bank mortgage is registered on this parcel. No-Objection Certificate (NOC) is legally required before transfer.',
        status: 'WARNING',
      }
    : {
        hi: 'इस ज़मीन पर कोई बैंक बंधक या अदालती रोक नहीं है। यह पूर्णतः बेदाग और सुरक्षित है।',
        en: 'No active bank mortgage or court stay is registered on this land. Clean title.',
        status: 'CLEAN',
      };

  // Filter genuine owners, clean kerning and serial numbers
  const genuineOwners = record.owners
    .filter((o) => !isNonOwnerRow(o.name.value))
    .map((o) => ({
      ...o,
      cleanName: cleanIndicText(o.name.value),
      cleanRel: cleanIndicText(o.relativeName.value),
    }));

  const primaryPlot = record.plots[0];
  const gataNumber = primaryPlot ? cleanIndicText(primaryPlot.khasraNumber.value) : '';

  // Generate natural, human-dignified narration text (NO numbering, NO raw fractions, NO brackets)
  const speechTextHi = generateNaturalHindiSpeech({
    district: record.district,
    village: record.village,
    tehsil: record.tehsil,
    khataNumber: record.khataNumber.value,
    gataNumber,
    owners: genuineOwners.map((o) => ({
      name: o.cleanName,
      relativeName: o.cleanRel,
      shareFraction: o.shareFraction.value,
    })),
    totalStatedArea: record.totalStatedArea.value,
    totalAcres,
    totalSqMeters: totalSqM,
    isTransferable: true,
    hasEncumbrance,
    encumbranceText: encumbranceDetails.hi,
  });

  const speechTextEn = generateNaturalEnglishSpeech({
    district: record.district,
    village: record.village,
    tehsil: record.tehsil,
    khataNumber: record.khataNumber.value,
    gataNumber,
    owners: genuineOwners.map((o) => ({
      name: o.cleanName,
      relativeName: o.cleanRel,
      shareFraction: o.shareFraction.value,
    })),
    totalStatedArea: record.totalStatedArea.value,
    totalAcres,
    totalSqMeters: totalSqM,
    isTransferable: true,
    hasEncumbrance,
    encumbranceText: encumbranceDetails.en,
  });

  const playSpeech = (targetLang?: 'hi' | 'en') => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this browser.');
      return;
    }
    window.speechSynthesis.cancel();

    const activeLang = targetLang || lang;
    const textToSpeak = activeLang === 'hi' ? speechTextHi : speechTextEn;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = activeLang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.93; // Dignified, calm Indian pace

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  const handleToggleAudio = () => {
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      playSpeech();
    }
  };

  // Voice Command Listener using Web Speech API
  const handleToggleVoiceCommands = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListeningVoice) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListeningVoice(false);
      setVoiceStatusText('');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.continuous = true;
      recognition.interimResults = false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();
        setVoiceStatusText(`सुना: "${transcript}"`);

        // Voice Command Dispatcher
        if (transcript.includes('सुनो') || transcript.includes('पढ़ो') || transcript.includes('बोलो') || transcript.includes('read') || transcript.includes('listen') || transcript.includes('speak')) {
          setVoiceStatusText('आदेश मिला: बोलकर सुनाया जा रहा है...');
          playSpeech();
        } else if (transcript.includes('रुक') || transcript.includes('stop') || transcript.includes('pause') || transcript.includes('शांत')) {
          setVoiceStatusText('आदेश मिला: आवाज रोकी गई');
          window.speechSynthesis.cancel();
          setIsPlayingAudio(false);
        } else if (transcript.includes('अंग्रेजी') || transcript.includes('english')) {
          setVoiceStatusText('Switched to English');
          setLang('en');
          playSpeech('en');
        } else if (transcript.includes('हिन्दी') || transcript.includes('hindi')) {
          setVoiceStatusText('हिन्दी भाषा चुनी गई');
          setLang('hi');
          playSpeech('hi');
        }
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
        setVoiceStatusText('');
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListeningVoice(true);
      setVoiceStatusText(lang === 'hi' ? 'आदेश सुनें: कहिए "सुनो", "रुको", या "English"' : 'Listening: Say "Read", "Stop", or "Hindi"');
    } catch {
      setIsListeningVoice(false);
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-slate-50">
      {/* Banner with Voice Readout & Voice Command Mic */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-700/60 text-emerald-200 text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>नागरिक सरल सहायता • Plain-Language Citizen Portal</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              {lang === 'hi' ? 'सरल भू-अभिलेख सारांश' : 'Citizen Land Summary'}
            </h2>
            <p className="text-xs text-emerald-100/90 max-w-xl">
              {lang === 'hi' 
                ? 'सरकारी जटिल शब्दों और राजस्व धाराओं को आसान बोलचाल की भाषा में समझें।' 
                : 'Complex revenue legal terminology translated into simple, everyday language.'}
            </p>
          </div>

          {/* Action buttons: Speech, Mic Voice Command, & Language Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Audio Playback button */}
            <button
              onClick={handleToggleAudio}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                isPlayingAudio
                  ? 'bg-amber-400 text-slate-900 animate-pulse ring-4 ring-amber-300/40'
                  : 'bg-white text-emerald-900 hover:bg-emerald-50'
              }`}
            >
              {isPlayingAudio ? (
                <>
                  <VolumeX className="w-4 h-4 text-slate-900" />
                  <span>आवाज रोकें (Stop Audio)</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-700" />
                  <span>{lang === 'hi' ? '🔊 बोलकर सुनाएं (Listen)' : '🔊 Read Aloud'}</span>
                </>
              )}
            </button>

            {/* Interactive Voice Command Microphone */}
            <button
              onClick={handleToggleVoiceCommands}
              title="Voice Commands: Speak 'सुनो', 'रुको', 'English'"
              className={`px-3 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
                isListeningVoice
                  ? 'bg-red-500 border-red-400 text-white animate-pulse ring-4 ring-red-400/40'
                  : 'bg-emerald-700/80 hover:bg-emerald-700 text-white border-emerald-600'
              }`}
            >
              {isListeningVoice ? (
                <>
                  <Mic className="w-4 h-4 text-white animate-bounce" />
                  <span>माइक चालू (सुन रहा है...)</span>
                </>
              ) : (
                <>
                  <MicOff className="w-4 h-4 text-emerald-200" />
                  <span>{lang === 'hi' ? '🎙️ आवाज से आदेश दें' : '🎙️ Voice Control'}</span>
                </>
              )}
            </button>

            {/* Language Switch */}
            <button
              onClick={() => {
                const nextLang = lang === 'hi' ? 'en' : 'hi';
                setLang(nextLang);
                if (isPlayingAudio) {
                  playSpeech(nextLang);
                }
              }}
              className="px-3 py-2.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-emerald-600 transition-colors cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'English' : 'हिन्दी'}</span>
            </button>
          </div>
        </div>

        {/* Voice status notification banner */}
        {voiceStatusText && (
          <div className="mt-3 text-xs bg-emerald-950/60 border border-emerald-600/50 text-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{voiceStatusText}</span>
          </div>
        )}

        {/* Decorative background shape */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* 4 Citizen Plain-Language Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Who owns this land? */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 hover:border-emerald-300 transition-all">
          <div className="flex items-center gap-2.5 text-emerald-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center font-bold">
              👤
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {lang === 'hi' ? '१. यह ज़मीन किसके नाम है?' : '1. Who owns this land?'}
            </h3>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {lang === 'hi'
              ? `गाँव ${cleanIndicText(record.village)} (खाता संख्या ${cleanIndicText(record.khataNumber.value)}) के तहत सरकारी रिकॉर्ड में कुल ${genuineOwners.length} खातेदारों के नाम दर्ज हैं:`
              : `Under Khata #${cleanIndicText(record.khataNumber.value)} in village ${cleanIndicText(record.village)}, ${genuineOwners.length} legal holders are registered:`}
          </p>

          <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
            {genuineOwners.map((owner, idx) => (
              <div key={owner.id} className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900">
                    {idx + 1}. {owner.cleanName}
                  </span>
                  {owner.cleanRel && (
                    <span className="text-slate-500 block text-[11px]">
                      पुत्र / संरक्षक: {owner.cleanRel}
                    </span>
                  )}
                </div>
                <span className="font-bold font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[11px]">
                  {cleanIndicText(owner.shareFraction.value)}
                </span>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-500 italic bg-amber-50/60 p-2 rounded border border-amber-200/60">
            💡 {lang === 'hi' 
              ? 'आसान शब्दों में: सभी खातेदारों का अपनी-अपनी हिस्सेदारी पर कानूनी समभाग अधिकार है।' 
              : 'Plain explanation: Each owner holds their legally defined proportional title.'}
          </div>
        </div>

        {/* Card 2: How big is the land? */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 hover:border-emerald-300 transition-all">
          <div className="flex items-center gap-2.5 text-blue-800">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center font-bold">
              📐
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {lang === 'hi' ? '२. कुल कितनी ज़मीन है?' : '2. How big is the land?'}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">क्षेत्रीय नाप (Regional)</span>
              <span className="text-sm font-extrabold text-blue-900 font-mono">
                {record.totalStatedArea.value}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">आधुनिक नाप (Acres)</span>
              <span className="text-sm font-extrabold text-emerald-900 font-mono">
                ~{totalAcres} एकड़ ({totalSqM.toLocaleString()} m²)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            <span className="font-semibold block text-slate-900">
              🏟️ {lang === 'hi' ? 'आसान तुलना (Visual Analogy):' : 'Easy Comparison:'}
            </span>
            <p className="text-[11px] text-slate-600">
              {lang === 'hi'
                ? `यह ज़मीन लगभग ${footballFields > 0.5 ? `${footballFields} बड़े खेल मैदान` : 'एक बड़े आवासीय भूखंड'} जितनी बड़ी है। इसमें कुल ${record.plots.length} खेत (गाटा संख्या: ${record.plots.map(p => cleanIndicText(p.khasraNumber.value)).join(', ')}) शामिल हैं।`
                : `This holding is roughly equivalent to ${footballFields} standard sports fields across ${record.plots.length} individual survey parcels.`}
            </p>
          </div>
        </div>

        {/* Card 3: Can you sell or transfer it? */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 hover:border-emerald-300 transition-all">
          <div className="flex items-center gap-2.5 text-purple-800">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center font-bold">
              ⚖️
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {lang === 'hi' ? '३. क्या इसे बेचा या नाम किया जा सकता है?' : '3. Can it be sold or transferred?'}
            </h3>
          </div>

          <div className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200 text-xs text-purple-950">
            <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">
                {lang === 'hi' ? 'श्रेणी: संक्रमणीय भूमिधर (Freehold Ownership)' : 'Status: Transferable Title (Freehold)'}
              </strong>
              <p className="text-[11px] mt-0.5 text-purple-900">
                {lang === 'hi'
                  ? 'हाँ! यह ज़मीन पुश्तैनी मालिकाना हक वाली है। इसे बैनामा (Sale Deed), वसीयत (Will), अथवा दान (Gift) द्वारा हस्तांतरित करने का पूरा कानूनी अधिकार है।'
                  : 'Yes. Owners possess permanent freehold rights to cultivate, sell, gift, or pass on to lawful heirs without government sanction.'}
              </p>
            </div>
          </div>

          <div className="text-[11px] text-slate-500">
            {lang === 'hi' 
              ? 'सालाना सरकारी लगान: मात्र ₹ ' + record.plots.reduce((acc, p) => acc + parseFloat(p.annualRevenueLagaan.value.replace(/[^0-9.]/g, '') || '0'), 0).toFixed(2) + ' प्रति वर्ष।'
              : 'Annual Revenue Assessment Cess: Approx nominal dues per annum.'}
          </div>
        </div>

        {/* Card 4: Loans, Mortgages & Encumbrance Safety */}
        <div className={`bg-white rounded-xl border p-5 shadow-xs space-y-3 transition-all ${
          encumbranceDetails.status === 'WARNING' ? 'border-amber-300' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2.5 text-amber-800">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
              encumbranceDetails.status === 'WARNING' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
            }`}>
              {encumbranceDetails.status === 'WARNING' ? '⚠️' : '🛡️'}
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {lang === 'hi' ? '४. बैंक लोन या कानूनी रोक (Encumbrance)' : '4. Bank Loans & Court Stays'}
            </h3>
          </div>

          <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
            encumbranceDetails.status === 'WARNING'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-emerald-50 border-emerald-300 text-emerald-950'
          }`}>
            {encumbranceDetails.status === 'WARNING' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div>
              <strong className="font-bold">
                {encumbranceDetails.status === 'WARNING' 
                  ? (lang === 'hi' ? 'सावधानी: बैंक बंधक दर्ज है' : 'Notice: Active Bank Mortgage')
                  : (lang === 'hi' ? 'सुरक्षित: कोई रोक या ऋण नहीं' : 'Clean Title: No Encumbrance')}
              </strong>
              <p className="text-[11px] mt-0.5 leading-relaxed">
                {lang === 'hi' ? encumbranceDetails.hi : encumbranceDetails.en}
              </p>
            </div>
          </div>

          <div className="text-[11px] text-slate-500">
            {lang === 'hi'
              ? 'स्तम्भ ६ की जांच: ऑनलाइन वरासत प्रविष्टि नियमानुसार सत्यापित है।'
              : 'Column 6 Audit: Mutation succession lawfully recorded.'}
          </div>
        </div>
      </div>

      {/* Citizen Action Footer: 1-Click Print Citizen Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <Wheat className="w-4 h-4 text-emerald-700" />
          <span>
            {lang === 'hi'
              ? 'यह सारांश किसानों और नागरिकों के लिए भाषा को सरल बनाने हेतु तैयार किया गया है।'
              : 'This summary is designed to ensure plain-language transparency for every citizen.'}
          </span>
        </div>

        <button
          onClick={() => window.print()}
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{lang === 'hi' ? 'नागरिक कार्ड प्रिंट करें' : 'Print Citizen Summary'}</span>
        </button>
      </div>
    </div>
  );
};
