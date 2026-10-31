import React, { useEffect, useState } from 'react';
import { X, BarChart3, FileStack, Target, ShieldAlert, Clock, MapPinned, RefreshCw } from 'lucide-react';

interface DashboardData {
  documentsProcessed: number;
  uploadedByPipeline: number;
  avgConfidence: number | null;
  extractionAccuracy: number | null;
  accuracyBasis: { approvedUploads: number; fieldsReviewed: number; officerCorrections: number };
  validationStatus: { approved: number; inReview: number; draft: number; flagged: number };
  pendingVerification: number;
  pendingList: { id: string; village: string; khata: string; confidence: number; source: string; openFlags: number }[];
  errorStats: { open: number; bySeverity: Record<string, number>; byType: { type: string; count: number }[] };
  progress: { state: string; total: number; approved: number; districts: { district: string; total: number; approved: number }[] }[];
  extractionSources: Record<string, number>;
  learning?: {
    reviewsLogged: number; corrections: number; minSupport: number;
    accuracySeries: { label: string; reviews: number; accuracy: number; until: string }[];
    learnedRules: { fieldType: string; from: string; to: string; support: number }[];
  };
  auditChain?: { intact: boolean; entries: number; headHash?: string; brokenAt?: string; reason?: string };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenRecord: (id: string) => void;
}

const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string }> = ({ icon, label, value, sub }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4">
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{icon}{label}</div>
    <div className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">{value}</div>
    {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
  </div>
);

const Bar: React.FC<{ value: number; max: number; tone?: string }> = ({ value, max, tone = 'bg-emerald-600' }) => (
  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
    <div className={`h-full ${tone} rounded-full`} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
  </div>
);

export const DashboardModal: React.FC<Props> = ({ isOpen, onClose, onOpenRecord }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/dashboard');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setData(await resp.json());
    } catch (e) {
      setError('Dashboard needs the backend running (python -m uvicorn main:app --port 8001).');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isOpen) load(); }, [isOpen]);

  if (!isOpen) return null;
  const vs = data?.validationStatus;
  const vsTotal = vs ? vs.approved + vs.inReview + vs.draft : 0;
  const maxErr = Math.max(1, ...(data?.errorStats.byType.map((e) => e.count) || [1]));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Operations dashboard">
      <div className="w-full max-w-6xl bg-slate-50 rounded-2xl shadow-xl border border-slate-200 my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white rounded-t-2xl">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-900">Digitization Operations Dashboard</h2>
            <span className="text-[11px] text-slate-500">live from database</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {error && <div className="m-5 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">{error}</div>}

        {data && (
          <div className="p-5 space-y-5">
            {data.auditChain && (
              <div className={`text-xs rounded-lg border px-3 py-2 ${data.auditChain.intact ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
                {data.auditChain.intact
                  ? <>Audit trail hash chain <strong>intact</strong>: {data.auditChain.entries} entries verified. Head <span className="font-mono">{data.auditChain.headHash?.slice(0, 12)}…</span></>
                  : <>Audit trail hash chain <strong>BROKEN</strong> at {data.auditChain.brokenAt}: {data.auditChain.reason}</>}
              </div>
            )}
            {/* Headline metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat icon={<FileStack className="w-3.5 h-3.5" />} label="Documents processed" value={String(data.documentsProcessed)}
                sub={`${data.uploadedByPipeline} through the extraction pipeline`} />
              <Stat icon={<Target className="w-3.5 h-3.5" />} label="Extraction accuracy" value={pct(data.extractionAccuracy)}
                sub={data.extractionAccuracy == null
                  ? 'Measured once officers approve uploaded records'
                  : `${data.accuracyBasis.officerCorrections} corrections across ${data.accuracyBasis.fieldsReviewed} reviewed fields`} />
              <Stat icon={<Clock className="w-3.5 h-3.5" />} label="Pending verification" value={String(data.pendingVerification)}
                sub={`Avg. pipeline confidence ${pct(data.avgConfidence)}`} />
              <Stat icon={<ShieldAlert className="w-3.5 h-3.5" />} label="Open discrepancies" value={String(data.errorStats.open)}
                sub={`${data.errorStats.bySeverity.high || 0} high · ${data.errorStats.bySeverity.medium || 0} medium · ${data.errorStats.bySeverity.low || 0} low`} />
            </div>


            {/* Learning loop */}
            {data.learning && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Learning from officer corrections</h3>
                <p className="text-[11px] text-slate-500 mb-3">
                  Field accuracy = share of reviewed machine-read fields the officer did not change. {data.learning.reviewsLogged} reviews logged, {data.learning.corrections} corrections.
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <AccuracyChart series={data.learning.accuracySeries} />
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-1.5">Learned corrections (applied automatically after {data.learning.minSupport}+ identical fixes)</div>
                    {data.learning.learnedRules.length === 0
                      ? <p className="text-xs text-slate-500">None yet. When officers fix the same misreading {data.learning.minSupport} times, it appears here and is applied to new uploads (still sent for review).</p>
                      : <div className="divide-y divide-slate-100 text-xs">
                          {data.learning.learnedRules.map((r, i) => (
                            <div key={i} className="py-1.5 grid grid-cols-[1fr_auto] gap-2">
                              <span className="truncate"><span className="text-slate-500">{r.fieldType}</span> · “{r.from}” → <b>“{r.to}”</b></span>
                              <span className="tabular-nums text-slate-500">×{r.support}</span>
                            </div>
                          ))}
                        </div>}
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Validation status */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">Validation status</h3>
                <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                  {vs && vsTotal > 0 && <>
                    <div className="bg-emerald-600" style={{ width: `${(vs.approved / vsTotal) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(vs.inReview / vsTotal) * 100}%` }} />
                    <div className="bg-slate-400" style={{ width: `${(vs.draft / vsTotal) * 100}%` }} />
                  </>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-600 mr-1.5" />Officer approved: <b>{vs?.approved}</b></span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5" />In review: <b>{vs?.inReview}</b></span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1.5" />AI draft (all checks clear): <b>{vs?.draft}</b></span>
                  <span>With open flags: <b>{vs?.flagged}</b></span>
                </div>
                <div className="mt-4 text-[11px] text-slate-500">
                  Extraction route: {Object.entries(data.extractionSources).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(' · ')}
                </div>
              </div>

              {/* Error stats */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">Open errors by type</h3>
                {data.errorStats.byType.length === 0 && <p className="text-xs text-slate-500">No open discrepancies.</p>}
                <div className="space-y-2.5">
                  {data.errorStats.byType.map((e) => (
                    <div key={e.type}>
                      <div className="flex justify-between text-xs text-slate-700 mb-1"><span className="truncate pr-2">{e.type}</span><b className="tabular-nums">{e.count}</b></div>
                      <Bar value={e.count} max={maxErr} tone="bg-rose-500" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5"><MapPinned className="w-3.5 h-3.5" />State & district progress</h3>
                <div className="space-y-4">
                  {data.progress.map((s) => (
                    <div key={s.state}>
                      <div className="flex justify-between text-sm font-semibold text-slate-800 mb-1">
                        <span>{s.state}</span><span className="tabular-nums text-xs">{s.approved}/{s.total} approved</span>
                      </div>
                      <Bar value={s.approved} max={s.total} />
                      <div className="mt-2 pl-3 space-y-1.5">
                        {s.districts.map((d) => (
                          <div key={d.district} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs text-slate-600">
                            <span className="truncate">{d.district}</span>
                            <span className="tabular-nums">{d.approved}/{d.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending queue */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">Review queue (lowest confidence first)</h3>
                <div className="divide-y divide-slate-100">
                  {data.pendingList.map((p) => (
                    <button key={p.id} onClick={() => { onOpenRecord(p.id); onClose(); }}
                      className="w-full text-left py-2 flex items-center justify-between gap-3 hover:bg-slate-50 rounded px-1">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">{p.village || '(village not read)'} · khata {p.khata || '?'}</div>
                        <div className="text-[11px] text-slate-500">{p.source.replace(/_/g, ' ')} · {p.openFlags} open flag(s)</div>
                      </div>
                      <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded ${p.confidence >= 0.9 ? 'bg-emerald-100 text-emerald-800' : p.confidence >= 0.75 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{pct(p.confidence)}</span>
                    </button>
                  ))}
                  {data.pendingList.length === 0 && <p className="text-xs text-slate-500">Queue is empty.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AccuracyChart: React.FC<{ series: { label: string; reviews: number; accuracy: number }[] }> = ({ series }) => {
  if (series.length === 0) {
    return <div className="h-40 flex items-center justify-center text-xs text-slate-500 bg-slate-50 rounded-lg">No officer reviews yet: the chart starts once machine-read fields are confirmed or corrected.</div>;
  }
  const W = 320, H = 150, L = 34, R = 10, T = 10, B = 28;
  const x = (i: number) => series.length === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (series.length - 1);
  const y = (v: number) => T + (1 - v) * (H - T - B);
  const pts = series.map((d, i) => `${x(i)},${y(d.accuracy)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Field accuracy over successive officer reviews">
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e2e8f0" />
          <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#64748b">{Math.round(v * 100)}%</text>
        </g>
      ))}
      <polyline points={pts} fill="none" stroke="#047857" strokeWidth="2" />
      {series.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.accuracy)} r="3" fill="#047857"><title>{`Reviews ${d.label}: ${Math.round(d.accuracy * 100)}% unchanged (${d.reviews} fields)`}</title></circle>
          <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="8" fill="#64748b">{d.label}</text>
        </g>
      ))}
      <text x={(W + L) / 2} y={H - 1} textAnchor="middle" fontSize="8" fill="#94a3b8">officer reviews, in order</text>
    </svg>
  );
};
