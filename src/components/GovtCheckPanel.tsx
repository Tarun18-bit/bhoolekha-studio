import React, { useEffect, useState } from 'react';
import { Landmark, ListChecks, Loader2, CheckCircle2, XCircle, AlertTriangle, MinusCircle } from 'lucide-react';
import type { LandRecordDocument } from '../types/landRecord';

interface CompareRow { section: string; field: string; uploaded: string; govt: string; status: string; note: string }
interface CompareData {
  found: boolean; message?: string; source: string; govtRecordId?: string; village?: string; villageCode?: string; khata?: string;
  govtVersion?: { fasli: string; source: string; asOf?: string };
  summary?: Record<string, number>; rows?: CompareRow[];
}
interface RuleResult { id: string; rule: string; severity: string; status: string; detail: string }

const STATUS: Record<string, { label: string; cls: string }> = {
  match: { label: 'Match', cls: 'bg-emerald-100 text-emerald-800' },
  mismatch: { label: 'Mismatch', cls: 'bg-rose-100 text-rose-800' },
  missing_in_upload: { label: 'Missing in upload', cls: 'bg-amber-100 text-amber-800' },
  missing_in_govt: { label: 'Not in govt record', cls: 'bg-violet-100 text-violet-800' },
};

const RuleIcon: React.FC<{ s: string }> = ({ s }) =>
  s === 'pass' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
  : s === 'fail' ? <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
  : s === 'warn' ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
  : <MinusCircle className="w-4 h-4 text-slate-300 shrink-0" />;

export const GovtCheckPanel: React.FC<{ record: LandRecordDocument }> = ({ record }) => {
  const [cmp, setCmp] = useState<CompareData | null>(null);
  const [rules, setRules] = useState<RuleResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const version = record.auditTrail?.length ?? 0;

  useEffect(() => {
    let live = true;
    setCmp(null); setRules(null); setError(null);
    Promise.all([
      fetch(`/api/parcels/${record.id}/govt-compare`).then((r) => r.ok ? r.json() : Promise.reject(r.status)),
      fetch(`/api/parcels/${record.id}/consistency`).then((r) => r.ok ? r.json() : Promise.reject(r.status)),
    ]).then(([c, k]) => { if (live) { setCmp(c); setRules(k.results); } })
      .catch((e) => live && setError(`Could not load checks (${e}). Is the backend running?`));
    return () => { live = false; };
  }, [record.id, version]);

  if (error) return <div className="p-6 text-sm text-rose-700">{error}</div>;
  if (!cmp || !rules) return <div className="p-6 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Running checks…</div>;

  const rows = (cmp.rows || []).filter((r) => !onlyIssues || r.status !== 'match');
  const sections = Array.from(new Set(rows.map((r) => r.section)));
  const fails = rules.filter((r) => r.status === 'fail').length;
  const warns = rules.filter((r) => r.status === 'warn').length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 bg-slate-50">
      {/* Consistency rules */}
      <section className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><ListChecks className="w-4 h-4 text-emerald-700" />Automated consistency check</h3>
          <span className="text-xs text-slate-500">{rules.length} rules · <b className="text-rose-700">{fails} failed</b> · <b className="text-amber-700">{warns} warnings</b></span>
        </div>
        <ul className="divide-y divide-slate-100">
          {rules.map((r) => (
            <li key={r.id} className="py-2 flex items-start gap-2.5 text-xs">
              <RuleIcon s={r.status} />
              <div className="min-w-0">
                <div className="font-semibold text-slate-800">{r.id} · {r.rule}</div>
                <div className={r.status === 'fail' ? 'text-rose-700' : r.status === 'warn' ? 'text-amber-700' : 'text-slate-500'}>{r.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Govt comparison */}
      <section className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Landmark className="w-4 h-4 text-emerald-700" />Comparison with government record</h3>
          {cmp.found && (
            <label className="text-xs text-slate-600 flex items-center gap-1.5">
              <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />Show only differences
            </label>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mb-3">{cmp.source}</p>
        {!cmp.found ? (
          <p className="text-xs text-slate-600">{cmp.message}</p>
        ) : (
          <>
            <div className="text-xs text-slate-700 mb-3">
              Govt record <b>{cmp.govtRecordId}</b> · {cmp.village}{cmp.villageCode ? ` (village code ${cmp.villageCode})` : ''} · khata {cmp.khata} · fasli {cmp.govtVersion?.fasli}
              {cmp.govtVersion?.source === 'document' && <span className="text-slate-500"> · transcribed from the sample PDF</span>}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(STATUS).map(([k, s]) => (
                <span key={k} className={`text-[11px] font-semibold px-2 py-0.5 rounded ${s.cls}`}>{s.label}: {cmp.summary?.[k] ?? 0}</span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-1.5 pr-2 font-medium">Field</th><th className="py-1.5 pr-2 font-medium">Uploaded</th>
                    <th className="py-1.5 pr-2 font-medium">Govt record</th><th className="py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((sec) => (
                    <React.Fragment key={sec}>
                      <tr><td colSpan={4} className="pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{sec}</td></tr>
                      {rows.filter((r) => r.section === sec).map((r, i) => (
                        <tr key={sec + i} className="border-b border-slate-100 align-top">
                          <td className="py-1.5 pr-2 text-slate-700 whitespace-pre">{r.field}</td>
                          <td className="py-1.5 pr-2 text-slate-900">{r.uploaded || <span className="text-slate-400">—</span>}</td>
                          <td className="py-1.5 pr-2 text-slate-900">{r.govt || <span className="text-slate-400">—</span>}</td>
                          <td className="py-1.5">
                            <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</span>
                            {r.note && <div className="text-[10px] text-slate-500 mt-0.5 max-w-[220px]">{r.note}</div>}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
