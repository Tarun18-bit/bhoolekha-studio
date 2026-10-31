import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Crosshair } from 'lucide-react';
import type { LandRecordDocument } from '../types/landRecord';

/* Bhu-Naksha style village map. Leaflet is loaded from a CDN at runtime (no npm install).
   The cadastral view needs no internet tiles; satellite is an optional background. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type L = any;
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
let leafletPromise: Promise<L> | null = null;
function loadLeaflet(): Promise<L> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = LEAFLET_CSS;
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = LEAFLET_JS; s.async = true;
      s.onload = () => resolve(w.L);
      s.onerror = () => { leafletPromise = null; reject(new Error('Could not load the map library. Check the internet connection once; it is cached afterwards.')); };
      document.head.appendChild(s);
    });
  }
  return leafletPromise;
}

interface Props { kind: string; name?: string; khasra: string; khata: string; areaHa: number; mapAreaHa?: number;
  simulatedHolder: boolean; status: string; inCurrentRecord: boolean; labelAt?: [number, number] }
interface Feature { type: string; geometry: { type: string; coordinates: unknown }; properties: Props }
interface Geo { found: boolean; message?: string; villageId?: string; village?: string; villageCode?: string; tehsil?: string; district?: string;
  note?: string; features?: Feature[] }

const STATUS: Record<string, { fill: string; label: string }> = {
  approved: { fill: '#10b981', label: 'डिजिटाइज़्ड · स्वीकृत (approved)' },
  in_review: { fill: '#f59e0b', label: 'डिजिटाइज़्ड · समीक्षा में (in review)' },
  mismatch: { fill: '#f43f5e', label: 'सरकारी अभिलेख से अंतर (mismatch)' },
  not_digitized: { fill: '#ffffff', label: 'अभी डिजिटाइज़ नहीं (not digitized)' },
};

export const GisMapViewer: React.FC<{ record: LandRecordDocument; onOpenRecord?: (id: string) => void }> = ({ record, onOpenRecord }) => {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L>(null);
  const focusRef = useRef<() => void>(() => {});
  const [geo, setGeo] = useState<Geo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Props | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [satellite, setSatellite] = useState(false);

  useEffect(() => {
    let live = true;
    setGeo(null); setError(null); setSelected(null);
    fetch(`/api/parcels/${record.id}/gis`).then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => live && setGeo(d)).catch((e) => live && setError(`Could not load map data (${e}).`));
    return () => { live = false; };
  }, [record.id]);

  useEffect(() => {
    if (!geo?.found || !el.current) return;
    let cancelled = false;
    loadLeaflet().then((Lf) => {
      if (cancelled || !el.current) return;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      const map = Lf.map(el.current, { zoomControl: true, attributionControl: false, zoomSnap: 0.25 });
      mapRef.current = map;
      if (satellite) {
        Lf.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 20, opacity: 0.85 }).addTo(map);
      }
      const feats = geo.features || [];
      const plots = feats.filter((f) => f.properties.kind === 'plot');

      const plotLayer = Lf.geoJSON({ type: 'FeatureCollection', features: plots }, {
        style: (f: Feature) => {
          const p = f.properties;
          const fill = p.inCurrentRecord ? '#fde047' : showStatus ? STATUS[p.status]?.fill : '#ffffff';
          return { color: p.inCurrentRecord ? '#b91c1c' : '#111827', weight: p.inCurrentRecord ? 2.5 : 0.7,
                   fillColor: fill, fillOpacity: satellite && !p.inCurrentRecord && !showStatus ? 0 : p.inCurrentRecord ? 0.85 : 0.7 };
        },
        onEachFeature: (f: Feature, lyr: L) => {
          lyr.on('click', () => setSelected(f.properties));
          lyr.on('mouseover', () => lyr.setStyle({ weight: 2.5 }));
          lyr.on('mouseout', () => plotLayer.resetStyle(lyr));
        },
      }).addTo(map);

      feats.filter((f) => f.properties.kind !== 'plot').forEach((f) => {
        const k = f.properties.kind;
        const style = k === 'boundary' ? { color: '#000', weight: 3 }
          : k === 'drain' ? { color: '#2563eb', weight: 4 }
          : { color: '#9a3412', weight: 3, dashArray: '8 4' };
        Lf.geoJSON(f, { style, interactive: false }).addTo(map);
      });

      // khasra numbers inside plots
      const labels = Lf.layerGroup();
      plots.forEach((f) => {
        const p = f.properties;
        if (!p.labelAt) return;
        Lf.marker([p.labelAt[1], p.labelAt[0]], {
          interactive: false,
          icon: Lf.divIcon({ className: '', iconSize: [40, 12], iconAnchor: [20, 6],
            html: `<div style="font:${p.inCurrentRecord ? '700 11px' : '500 9px'} system-ui;color:${p.inCurrentRecord ? '#7f1d1d' : '#111'};text-align:center;white-space:nowrap">${p.khasra}</div>` }),
        }).addTo(labels);
      });
      const village = plotLayer.getBounds();
      map.fitBounds(village.pad(0.04));
      const labelZoom = map.getZoom() - 0.5;
      const syncLabels = () => (map.getZoom() >= labelZoom ? labels.addTo(map) : labels.remove());
      map.on('zoomend', syncLabels); syncLabels();
      Lf.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

      const hl = plots.filter((f) => f.properties.inCurrentRecord);
      focusRef.current = () => {
        if (hl.length) map.fitBounds(Lf.geoJSON({ type: 'FeatureCollection', features: hl }).getBounds().pad(1.2));
      };
      if (hl.length) setSelected(hl[0].properties);
      setTimeout(() => map.invalidateSize(), 60);
    }).catch((e) => setError(String(e.message || e)));
    return () => { cancelled = true; };
  }, [geo, showStatus, satellite]);

  useEffect(() => () => { if (mapRef.current) mapRef.current.remove(); }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="px-3 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={showStatus} onChange={(e) => setShowStatus(e.target.checked)} />डिजिटाइज़ेशन स्थिति (status colours)</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={satellite} onChange={(e) => setSatellite(e.target.checked)} />Satellite background</label>
        </div>
        <button onClick={() => focusRef.current()} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800">
          <Crosshair className="w-3.5 h-3.5" />इस अभिलेख का गाटा (zoom to plot)
        </button>
      </div>

      {error && <div className="p-4 text-sm text-rose-700">{error}</div>}
      {!error && !geo && <div className="p-6 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Loading village map…</div>}
      {geo && !geo.found && <div className="p-6 text-sm text-slate-600">{geo.message}</div>}

      {geo?.found && (
        <div className="flex-1 relative isolate z-0 min-h-[420px]" style={{ background: '#fff' }}>
          <div ref={el} className="absolute inset-0" style={{ background: '#fff' }} />

          {/* Title block, like a Bhu-Naksha sheet */}
          <div className="absolute top-2 left-12 z-[1000] bg-white/95 border border-slate-800 px-2.5 py-1.5 text-[11px] leading-snug text-slate-900">
            <div><b>मौजा :</b> {geo.village}</div>
            <div><b>तहसील :</b> {geo.tehsil} · <b>जिला :</b> {geo.district}</div>
            {geo.villageCode && <div><b>ग्राम कोड :</b> {geo.villageCode}</div>}
          </div>

          {/* North arrow */}
          <div className="absolute top-24 left-3 z-[1000] text-center text-slate-900 select-none" aria-label="North">
            <svg width="22" height="34" viewBox="0 0 22 34"><path d="M11 2 L19 26 L11 21 L3 26 Z" fill="#111" /><path d="M11 2 L11 21 L3 26 Z" fill="#fff" stroke="#111" /></svg>
            <div className="text-[10px] font-bold -mt-1">उ / N</div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-2 left-2 z-[1000] bg-white/95 border border-slate-800 p-2 text-[10.5px] space-y-1 text-slate-900">
            <div className="font-bold">संकेत (Legend)</div>
            <div className="flex items-center gap-2"><span className="w-5 h-3 border border-slate-900 bg-white" />गाटा / खसरा</div>
            <div className="flex items-center gap-2"><span className="w-5 h-3 border-2 border-red-700 bg-yellow-300" />इस अभिलेख का गाटा</div>
            <div className="flex items-center gap-2"><span className="w-5 border-t-[3px] border-dashed border-orange-800" />चक मार्ग (cart track)</div>
            <div className="flex items-center gap-2"><span className="w-5 border-t-4 border-blue-600" />नाला (drain)</div>
            <div className="flex items-center gap-2"><span className="w-5 border-t-[3px] border-black" />ग्राम सीमा (village boundary)</div>
            {showStatus && Object.entries(STATUS).map(([k, s]) => (
              <div key={k} className="flex items-center gap-2"><span className="w-5 h-3 border border-slate-900" style={{ background: s.fill }} />{s.label}</div>
            ))}
          </div>

          {selected && geo.villageId && (
            <PlotDetails villageId={geo.villageId} plot={selected} onClose={() => setSelected(null)} onOpenRecord={onOpenRecord} />
          )}
        </div>
      )}
      {geo?.found && <div className="px-3 py-1 text-[10px] text-slate-500 border-t border-slate-200">{geo.note} Not a survey map; for illustration of the workflow.</div>}
    </div>
  );
};


/* ---------------------------------------------------------------- plot details panel */
interface Owner { name: string; relative?: string; relation?: string; share?: string }
interface PlotInfo {
  khasra: string; khata: string; village: string; villageCode?: string; tehsil: string; district: string;
  source: string; simulated: boolean; uniqueCode: string; public?: boolean;
  area: { hectare: number; sqMeters: number; biswa: number; bigha: number; acres: number }; mapAreaHa: number;
  landClass?: string; category?: string; fasli?: string; revenue?: string; khataTotalHa?: number; otherPlots: string[];
  owners: Owner[]; mortgages: { bank: string; date: string; amount: number; holder: string }[];
  mutations: { date: string; type: string; case?: string; removed?: string[]; added?: string[] }[]; historyVersions?: number;
  digitized: { id: string; status: string; confidence: number; openDiscrepancies: number; compare: Record<string, number> | null }[];
}

const Row: React.FC<{ k: string; children: React.ReactNode }> = ({ k, children }) => (
  <div className="grid grid-cols-[92px_1fr] gap-2 py-0.5"><span className="text-slate-500">{k}</span><span className="text-slate-900">{children}</span></div>
);

const PlotDetails: React.FC<{ villageId: string; plot: Props; onClose: () => void; onOpenRecord?: (id: string) => void }> =
  ({ villageId, plot, onClose, onOpenRecord }) => {
  const [d, setD] = useState<PlotInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setD(null); setErr(null);
    fetch(`/api/gis/plot?village_id=${encodeURIComponent(villageId)}&khasra=${encodeURIComponent(plot.khasra)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status)).then((x) => live && setD(x))
      .catch((e) => live && setErr(`Could not load plot details (${e}).`));
    return () => { live = false; };
  }, [villageId, plot.khasra]);

  return (
    <div className="absolute top-2 right-2 bottom-2 z-[1000] bg-white border border-slate-800 shadow-lg w-[300px] max-w-[85%] flex flex-col text-[11.5px]">
      <div className="px-3 py-2 border-b border-slate-300 flex items-start justify-between gap-2 bg-slate-50">
        <div>
          <div className="font-bold text-sm text-slate-900">गाटा संख्या {plot.khasra}</div>
          <div className="text-slate-600">खाता संख्या {plot.khata}{plot.inCurrentRecord ? ' · इस अभिलेख का गाटा' : ''}</div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-900 text-base leading-none" aria-label="Close">×</button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {err && <div className="text-rose-700">{err}</div>}
        {!d && !err && <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading…</div>}
        {d && <>
          <div className={`text-[10.5px] px-2 py-1 rounded ${d.simulated ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-800'}`}>
            {d.simulated ? 'Simulated govt data (demo neighbour plot)' : 'Govt data transcribed from the sample Bhulekh PDF'}
          </div>

          <section>
            <div className="font-bold text-slate-800 mb-0.5">भूखंड विवरण (Plot)</div>
            <Row k="यूनीक कोड">{d.uniqueCode}</Row>
            <Row k="क्षेत्रफल">{d.area.hectare.toFixed(4)} हे० · {d.area.sqMeters.toLocaleString()} m²</Row>
            <Row k="">≈ {d.area.biswa} बिस्वा · {d.area.bigha} बीघा · {d.area.acres} एकड़</Row>
            <Row k="नक्शे पर">{d.mapAreaHa.toFixed(4)} हे० <span className="text-slate-400">(sketch, approx.)</span></Row>
            {d.landClass && <Row k="श्रेणी">{d.landClass}</Row>}
            <Row k="ग्राम">{d.village}{d.villageCode ? ` (${d.villageCode})` : ''}</Row>
            <Row k="तहसील/जिला">{d.tehsil} · {d.district}</Row>
          </section>

          <section>
            <div className="font-bold text-slate-800 mb-0.5">खाता विवरण (Khata {d.khata})</div>
            {d.fasli && <Row k="फसली वर्ष">{d.fasli}</Row>}
            {d.revenue && <Row k="भू-राजस्व">₹ {d.revenue}</Row>}
            {d.khataTotalHa != null && <Row k="खाते का कुल">{d.khataTotalHa.toFixed(4)} हे०</Row>}
            <Row k="अन्य गाटे">{d.otherPlots.length ? d.otherPlots.join(', ') : '—'}</Row>
          </section>

          <section>
            <div className="font-bold text-slate-800 mb-1">खातेदार (Holders) · {d.owners.length}</div>
            {d.owners.length === 0 && <div className="text-slate-500">दर्ज नहीं</div>}
            <ol className="space-y-1">
              {d.owners.map((o, i) => (
                <li key={i} className="flex justify-between gap-2 border-b border-slate-100 pb-1">
                  <span><b>{i + 1}. {o.name}</b>{o.relative ? <span className="text-slate-500"> · {o.relation || 'पुत्र'} {o.relative}</span> : null}</span>
                  <span className="font-mono text-slate-700 shrink-0">{o.share || '—'}</span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <div className="font-bold text-slate-800 mb-0.5">बंधक (Mortgage)</div>
            {d.mortgages.length === 0 ? <div className="text-slate-500">कोई बंधक दर्ज नहीं (none recorded)</div> :
              d.mortgages.map((m, i) => (
                <div key={i} className="bg-rose-50 border border-rose-200 rounded px-2 py-1 text-rose-900">
                  {m.bank} · ₹{m.amount.toLocaleString('en-IN')} · {m.date}<br /><span className="text-rose-700">खातेदार: {m.holder}</span>
                </div>
              ))}
          </section>

          <section>
            <div className="font-bold text-slate-800 mb-0.5">नामांतरण (Mutations)</div>
            {d.mutations.length === 0 ? <div className="text-slate-500">कोई हालिया नामांतरण नहीं</div> :
              d.mutations.map((m, i) => (
                <div key={i} className="border-b border-slate-100 pb-1 mb-1">
                  <b>{m.type}</b> · {m.date}{m.case ? <span className="text-slate-500"> · {m.case}</span> : null}
                  {(m.removed?.length || m.added?.length) ? (
                    <div className="text-[10.5px]">
                      {m.removed?.map((n) => <span key={n} className="line-through text-rose-700 mr-1">{n}</span>)}
                      {m.added?.length ? <span className="text-slate-400 mr-1">→</span> : null}
                      {m.added?.map((n) => <span key={n} className="text-emerald-700 font-semibold mr-1">{n}</span>)}
                    </div>
                  ) : null}
                </div>
              ))}
            {d.historyVersions && d.historyVersions > 1 ? <div className="text-[10.5px] text-slate-500">{d.historyVersions} versions on record — see the History tab.</div> : null}
          </section>

          <section>
            <div className="font-bold text-slate-800 mb-0.5">इस प्रणाली में (In this system)</div>
            {d.digitized.length === 0 ? <div className="text-slate-500">यह गाटा अभी डिजिटाइज़ नहीं हुआ (not digitized yet)</div> :
              d.digitized.map((x) => (
                <div key={x.id} className="border border-slate-200 rounded px-2 py-1.5 mb-1.5">
                  <div className="font-mono text-[10.5px] text-slate-600 truncate">{x.id}</div>
                  <div>{x.status === 'OFFICER_APPROVED' ? '✅ Officer approved' : '🟡 In review'} · confidence {Math.round((x.confidence || 0) * 100)}%</div>
                  <div>{x.openDiscrepancies} open discrepanc{x.openDiscrepancies === 1 ? 'y' : 'ies'}</div>
                  {x.compare && <div className="text-[10.5px] text-slate-600">vs govt: {x.compare.match} match · {x.compare.mismatch} mismatch · {x.compare.missing_in_upload} missing · {x.compare.missing_in_govt} extra</div>}
                  {onOpenRecord && <button onClick={() => onOpenRecord(x.id)} className="mt-1 text-[11px] font-semibold text-emerald-800 underline">Open this record →</button>}
                </div>
              ))}
          </section>
        </>}
      </div>
    </div>
  );
};
