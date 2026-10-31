import React, { useEffect, useState } from 'react';
import { History, Loader2, ArrowRight, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { LandRecordDocument } from '../types/landRecord';

interface Owner { name: string; relative?: string; share?: string }
interface Mutation { date: string; type: string; case?: string; removed?: string[]; added?: string[]; areaHa?: number; note?: string; simulated?: boolean }
interface Change { kind: string; name?: string; explained?: boolean; from?: number; to?: number }
interface Version { label: string; fasli: string; source: string; note?: string; owners: Owner[]; totalAreaHa: number; plots: string[]; mutations: Mutation[]; changes: Change[] }
interface HistoryData { found: boolean; message?: string; source?: string; village?: string; khata?: string; timeline?: Version[]; flags?: { severity: string; version: string; message: string }[] }

const SRC: Record<string, string> = { simulated: 'simulated history', document: 'from the sample PDF', upload: 'this upload' };

export const HistoryPanel: React.FC<{ record: LandRecordDocument }> = ({ record }) => {
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setData(null); setError(null);
    fetch(`/api/parcels/${record.id}/history`).then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => live && setData(d)).catch((e) => live && setError(`Could not load history (${e}).`));
    return () => { live = false; };
  }, [record.id]);

  if (error) return <div className="p-6 text-sm text-rose-700">{error}</div>;
  if (!data) return <div className="p-6 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Loading history…</div>;
  if (!data.found) return <div className="p-6 text-sm text-slate-600">{data.message}</div>;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50">
      <div>
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><History className="w-4 h-4 text-emerald-700" />Khata {data.khata} · {data.village} — history across fasli years</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{data.source}</p>
      </div>

      {data.flags && data.flags.length > 0 ? (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-1.5">
          <div className="text-xs font-bold text-amber-900">{data.flags.length} historical inconsistenc{data.flags.length === 1 ? 'y' : 'ies'} to verify</div>
          {data.flags.map((f, i) => (
            <div key={i} className="text-xs text-amber-900 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span><b>Fasli {f.version}:</b> {f.message}</span></div>
          ))}
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900">Every change between versions is explained by a recorded mutation.</div>
      )}

      <ol className="relative border-l-2 border-slate-200 ml-2 space-y-4">
        {data.timeline!.map((v, i) => (
          <li key={i} className="ml-4">
            <span className={`absolute -left-[7px] w-3 h-3 rounded-full border-2 border-white ${v.source === 'upload' ? 'bg-blue-600' : 'bg-emerald-600'}`} />
            <div className={`bg-white rounded-xl border p-3 ${v.source === 'upload' ? 'border-blue-300' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm font-bold text-slate-900">{v.label}</div>
                <div className="text-[11px] text-slate-500">{SRC[v.source] || v.source} · {v.totalAreaHa ? `${v.totalAreaHa.toFixed(4)} ha` : 'area —'} · plots {v.plots.join(', ') || '—'}</div>
              </div>
              {v.note && <div className="text-[11px] text-slate-500 mt-0.5">{v.note}</div>}

              {v.mutations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {v.mutations.map((m, j) => (
                    <div key={j} className="text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1">
                      <b>{m.type}</b> · {m.date}{m.case ? ` · case ${m.case}` : ''}{m.simulated ? ' · simulated' : ''}
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {(m.removed || []).map((n) => <span key={'r' + n} className="line-through text-rose-700">{n}</span>)}
                        {(m.removed?.length || 0) > 0 && <ArrowRight className="w-3 h-3 text-slate-400" />}
                        {(m.added || []).map((n) => <span key={'a' + n} className="text-emerald-700 font-semibold">{n}</span>)}
                        {m.areaHa ? <span className="text-slate-500">({m.areaHa} ha)</span> : null}
                      </div>
                      {m.note && <div className="text-slate-500">{m.note}</div>}
                    </div>
                  ))}
                </div>
              )}

              {v.changes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.changes.map((c, j) => {
                    const bad = c.explained === false || c.kind === 'missing_in_upload' || c.kind === 'extra_in_upload';
                    const txt = c.kind === 'area' ? `area ${c.from} → ${c.to} ha`
                      : c.kind === 'missing_in_upload' ? `not in upload: ${c.name}`
                      : c.kind === 'extra_in_upload' ? `extra in upload: ${c.name}`
                      : `${c.kind === 'added' ? '+' : '−'} ${c.name}`;
                    return (
                      <span key={j} className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${bad ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-700'}`}>
                        {c.explained === true && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {c.explained === false && <XCircle className="w-3 h-3 text-rose-600" />}
                        {txt}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="mt-2 text-[11px] text-slate-600">
                <span className="font-semibold">Holders ({v.owners.length}):</span> {v.owners.map((o) => o.name).join(', ') || '—'}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
