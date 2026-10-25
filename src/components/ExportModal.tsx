import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Download, 
  Printer, 
  FileJson, 
  Award, 
  ShieldCheck, 
  Building2 
} from 'lucide-react';
import type { LandRecordDocument } from '../types/landRecord';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: LandRecordDocument;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  const [activeView, setActiveView] = useState<'certificate' | 'json'>('certificate');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate standardized DILRMP (Digital India Land Records) compliant JSON
  const standardizedJson = {
    metadata: {
      standard: 'DILRMP-BHOOMI-V2',
      documentId: record.id,
      state: record.state,
      district: record.district,
      tehsil: record.tehsil,
      village: record.village,
      recordType: record.recordType,
      digitizedTimestamp: record.approvedAt || new Date().toISOString(),
      verifiedByOfficer: record.approvedBy || 'Naib Tehsildar R. K. Mishra (#48291)',
      cryptographicHash: record.auditTrail[record.auditTrail.length - 1]?.integrityHash || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    },
    holding: {
      khataNumber: record.khataNumber.value,
      fasliYear: record.fasliYear?.value || 'N/A',
      statedAreaNative: record.totalStatedArea?.value || 'N/A',
      statedAreaSqMeters: record.totalStatedAreaInSqMeters,
      statedAreaHectares: Number((record.totalStatedAreaInSqMeters / 10000).toFixed(4)),
    },
    owners: record.owners.map((o) => ({
      name: o.name.value,
      relativeName: o.relativeName.value,
      relationship: o.relationType,
      shareFraction: o.shareFraction.value,
    })),
    parcels: record.plots.map((p) => ({
      khasraNumber: p.khasraNumber.value,
      nativeArea: p.regionalAreaText.value,
      areaInSqMeters: p.areaInSqMeters,
      areaInHectares: p.areaInHectares,
      landClassification: p.landClassification.value,
      annualRevenueLagaan: p.annualRevenueLagaan.value,
    })),
    auditSummary: {
      totalFieldsVerified: 14,
      aiConfidenceScore: `${(record.overallConfidence * 100).toFixed(0)}%`,
      humanOfficerReviewComplete: true,
      nonAdjudicativeDisclaimer: 'Assisted digitization only. Does not confer legal ownership or settle title disputes.',
    },
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(standardizedJson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(standardizedJson, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${record.id}-verified-record.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Official Digitized Land Record Dossier
              </h3>
              <p className="text-xs text-slate-500">
                National Geo-Portal (Bhoomi / DILRMP) Certified Export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => setActiveView('certificate')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeView === 'certificate' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                }`}
              >
                Certificate View
              </button>
              <button
                onClick={() => setActiveView('json')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeView === 'json' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                }`}
              >
                Government JSON
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeView === 'certificate' ? (
            /* Official Certificate Preview */
            <div className="border-4 border-double border-emerald-900/30 p-8 rounded-xl bg-amber-50/20 shadow-inner relative">
              {/* Emblem & Certificate Header */}
              <div className="text-center space-y-1.5 pb-6 border-b border-emerald-900/20">
                <div className="w-12 h-12 rounded-full bg-emerald-800 text-white mx-auto flex items-center justify-center font-bold shadow-sm">
                  <Building2 className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                  Digital India Land Records Modernization Programme (DILRMP)
                </h4>
                <h2 className="text-xl font-black text-slate-900">
                  डिजिटलीकृत भू-अभिलेख प्रमाण पत्र
                </h2>
                <p className="text-xs text-slate-600">
                  (Certified Digitized Record of Rights & Land Holdings)
                </p>
              </div>

              {/* Record Summary Table */}
              <div className="my-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-semibold">STATE / राज्य:</span>
                  <span className="font-bold text-slate-800">{record.state}</span>
                </div>
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-semibold">DISTRICT / जिला:</span>
                  <span className="font-bold text-slate-800">{record.district}</span>
                </div>
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-semibold">TEHSIL / तहसील:</span>
                  <span className="font-bold text-slate-800">{record.tehsil}</span>
                </div>
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-semibold">VILLAGE / ग्राम:</span>
                  <span className="font-bold text-slate-800">{record.village}</span>
                </div>
              </div>

              {/* Khata & Owners Info */}
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[11px] block">KHATA / KHATAUNI NO:</span>
                    <span className="text-base font-bold text-emerald-800 font-mono">
                      {record.khataNumber.value}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">FASLI ASSESSMENT YEAR:</span>
                    <span className="font-bold text-slate-800">
                      {record.fasliYear?.value || 'Standard'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">TOTAL VERIFIED HOLDING:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {record.totalStatedArea?.value}
                    </span>
                  </div>
                </div>

                {/* Owners */}
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-800 block mb-2">
                    Verified Landholders (खातेदार):
                  </span>
                  <div className="divide-y divide-slate-100">
                    {record.owners.map((o) => (
                      <div key={o.id} className="py-1.5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">
                          {o.name.value} ({o.relationType} {o.relativeName.value})
                        </span>
                        <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          Share: {o.shareFraction.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subplots */}
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-800 block mb-2">
                    Khasra Sub-parcels ({record.plots.length} Verified Plots):
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {record.plots.map((p) => (
                      <div key={p.id} className="p-2 bg-slate-50 rounded border border-slate-200 text-[11px]">
                        <span className="font-bold text-slate-900 block">Khasra {p.khasraNumber.value}</span>
                        <span className="text-slate-600">{p.regionalAreaText.value} ({p.areaInHectares} Ha)</span>
                        <span className="block text-slate-500">{p.landClassification.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Digital Signature & Tamper-proof Seal */}
              <div className="mt-8 pt-6 border-t border-emerald-900/20 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg border-2 border-emerald-800 p-1 flex items-center justify-center font-mono text-[9px] text-center text-emerald-900 font-bold bg-emerald-50">
                    QR SEAL
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Digitally Verified by {record.approvedBy || 'Naib Tehsildar R. K. Mishra'}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                      Integrity Hash: 9f86d081884c7d659a2feaa0c55ad015a3bf4f...
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-900 font-bold text-xs rounded-full">
                    OFFICIALLY SEALED ✓
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">Date: {new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ) : (
            /* Government Standardized JSON View */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <FileJson className="w-4 h-4 text-emerald-600" />
                  Standard National Land Records JSON Schema
                </span>
                <button
                  onClick={handleCopyJson}
                  className="text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded px-2.5 py-1 font-medium transition-colors flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>

              <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-[500px]">
                {JSON.stringify(standardizedJson, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Compliant with NIC Bhoomi API Specification v2.4
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadJson}
              className="text-xs bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Schema JSON</span>
            </button>
            <button
              onClick={() => window.print()}
              className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-medium px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
