import React, { useRef, useState } from 'react';
import { UploadCloud, ShieldCheck, ArrowLeft, FileText, Loader2 } from 'lucide-react';
import type { LandRecordDocument } from '../types/landRecord';
import { CitizenExplainer } from './CitizenExplainer';
import { VoiceAssistantWidget } from './VoiceAssistantWidget';

const STATES = ['Uttar Pradesh', 'Bihar', 'Madhya Pradesh', 'Rajasthan', 'Maharashtra', 'Andhra Pradesh', 'Telangana'];

export const CitizenPortal: React.FC = () => {
  const [record, setRecord] = useState<LandRecordDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState('Uttar Pradesh');
  const [showScan, setShowScan] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) { setError('File is larger than 10 MB.'); return; }
    setBusy(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      const resp = await fetch('/api/citizen/explain', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_base64: b64, state }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || `Could not read the document (HTTP ${resp.status}).`);
      const rec = data.record as LandRecordDocument;
      if (!rec.owners?.length && !rec.plots?.length) {
        throw new Error('We could not read this document automatically. It works best with the Khatauni PDF downloaded from your state Bhulekh website.');
      }
      setRecord(rec);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes('Failed to fetch') ? 'The service is not reachable right now. Please try again later.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center"><FileText className="w-5 h-5" /></div>
          <div>
            <h1 className="font-bold text-slate-900 leading-tight">अपना खतौनी समझें · Understand your land record</h1>
            <p className="text-[11px] text-slate-500">भू-लेखा Studio · for citizens</p>
          </div>
        </div>
        {record
          ? <button onClick={() => { setRecord(null); setShowScan(false); }} className="text-xs text-emerald-800 font-semibold flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />Another document</button>
          : <a href="/officer" className="text-xs text-slate-500 hover:text-slate-800">अधिकारी लॉगिन · Officer login</a>}
      </header>

      <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-2 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          यह एक मशीन द्वारा पढ़ा गया सरल सारांश है — किसी अधिकारी द्वारा सत्यापित नहीं और कानूनी राय नहीं। आपकी फ़ाइल सहेजी नहीं जाती।
          <span className="block text-amber-800/90">A machine reading in simple words, not verified by an officer and not legal advice. Your file is not stored.</span>
        </span>
      </div>

      {!record ? (
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="font-bold text-slate-900">अपना खतौनी / भूलेख PDF अपलोड करें</h2>
              <p className="text-xs text-slate-500 mt-1">Upload the Khatauni PDF you downloaded from the Bhulekh website (best), or a clear photo. We explain who owns the land, how much, and whether any loan is recorded.</p>
            </div>
            <label className="block text-xs font-medium text-slate-700">State
              <select value={state} onChange={(e) => setState(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <button
              onClick={() => inputRef.current?.click()} disabled={busy}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              className="w-full border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl py-10 flex flex-col items-center gap-2 text-slate-600 disabled:opacity-60">
              {busy ? <Loader2 className="w-7 h-7 animate-spin text-emerald-700" /> : <UploadCloud className="w-7 h-7 text-emerald-700" />}
              <span className="text-sm font-semibold">{busy ? 'पढ़ा जा रहा है… Reading your document…' : 'फ़ाइल चुनें या यहाँ छोड़ें · Choose or drop a file'}</span>
              <span className="text-[11px] text-slate-400">PDF, JPG or PNG · up to 10 MB</span>
            </button>
            <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            {error && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
          </div>
        </main>
      ) : (
        <main className="flex-1 flex flex-col">
          {record.originalDocumentUrl && (
            <div className="px-4 pt-3">
              <button onClick={() => setShowScan((v) => !v)} className="text-xs text-emerald-800 font-semibold underline">
                {showScan ? 'Hide my document' : 'Show my document'}
              </button>
              {showScan && <img src={record.originalDocumentUrl} alt="Your uploaded document" className="mt-2 max-h-[70vh] w-auto mx-auto rounded-lg border border-slate-300 bg-white" />}
            </div>
          )}
          <FindingsCard record={record} />
          <div className="flex-1 min-h-[600px] flex">
            <CitizenExplainer record={record} />
          </div>
          <VoiceAssistantWidget record={record} />
        </main>
      )}
    </div>
  );
};


interface Finding {
  severity: 'high' | 'medium' | 'low' | 'info';
  kind: string;
  title: { hi: string; en: string };
  detail: { hi: string; en: string };
  action: { hi: string; en: string };
}

const SEV: Record<string, { label: string; cls: string; dot: string }> = {
  high: { label: 'ज़रूरी · Important', cls: 'border-rose-300 bg-rose-50', dot: 'bg-rose-600' },
  medium: { label: 'जाँचें · Check', cls: 'border-amber-300 bg-amber-50', dot: 'bg-amber-500' },
  low: { label: 'छोटी बात · Minor', cls: 'border-slate-300 bg-slate-50', dot: 'bg-slate-400' },
  info: { label: 'जानकारी · Good to know', cls: 'border-blue-300 bg-blue-50', dot: 'bg-blue-500' },
};

const FindingsCard: React.FC<{ record: LandRecordDocument }> = ({ record }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const findings: Finding[] = (record as any).citizenFindings || [];
  const problems = findings.filter((f) => f.severity !== 'info').length;
  return (
    <section className="mx-4 mt-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <h2 className="font-bold text-slate-900">
        {problems > 0
          ? `आपके अभिलेख में ${problems} संभावित समस्या मिली · ${problems} possible problem${problems === 1 ? '' : 's'} in your record`
          : 'कोई स्पष्ट समस्या नहीं मिली · No obvious problems found'}
      </h2>
      <p className="text-[11px] text-slate-500 mt-0.5">
        AI ने आपके दस्तावेज़ की जाँच की — आदेश, हिस्से, खातेदार और बंधक। यह कानूनी राय नहीं है; तहसील का अभिलेख ही मान्य है।
        <span className="block">The AI checked orders, shares, holders and mortgages in your document. Not legal advice; the tehsil record is the authority.</span>
      </p>
      <div className="mt-3 space-y-2.5">
        {findings.map((f, i) => (
          <div key={i} className={`rounded-xl border p-3 ${SEV[f.severity]?.cls || ''}`}>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              <span className={`w-2 h-2 rounded-full ${SEV[f.severity]?.dot}`} />{SEV[f.severity]?.label}
            </div>
            <div className="mt-1 font-semibold text-slate-900 text-sm">{f.title.hi}</div>
            <div className="text-xs text-slate-600">{f.title.en}</div>
            <p className="mt-1.5 text-xs text-slate-800">{f.detail.hi}</p>
            {f.detail.en !== f.detail.hi && <p className="text-[11px] text-slate-600">{f.detail.en}</p>}
            <div className="mt-2 text-xs bg-white/70 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <b>क्या करें · What you can do:</b> {f.action.hi}
              <span className="block text-slate-600">{f.action.en}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
