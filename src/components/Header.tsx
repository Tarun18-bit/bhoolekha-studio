import React from 'react';
import { 
  Building2, 
  ShieldCheck, 
  AlertTriangle, 
  FileCheck2, 
  HelpCircle, 
  CheckCircle2, 
  FileSpreadsheet, 
  UploadCloud,
  Sparkles
} from 'lucide-react';
import type { LandRecordDocument } from '../types/landRecord';

interface HeaderProps {
  currentRecord: LandRecordDocument;
  records: LandRecordDocument[];
  onSelectRecord: (recordId: string) => void;
  onOpenUpload: () => void;
  activeTab: 'digitization' | 'citizen' | 'discrepancies' | 'audit';
  setActiveTab: (tab: 'digitization' | 'citizen' | 'discrepancies' | 'audit') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRecord,
  records,
  onSelectRecord,
  onOpenUpload,
  activeTab,
  setActiveTab,
}) => {
  const unresolvedDiscrepancies = currentRecord.discrepancies.filter(
    (d) => d.status === 'PENDING_REVIEW'
  ).length;

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      {/* Statutory Legal Disclaimer Banner - Directly addresses Problem Statement constraint */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong className="font-semibold text-amber-950">Statutory Notice:</strong> This AI system is strictly an assistive digitization and transcription workbench. It does <strong>not</strong> independently declare legal title, adjudicate land disputes, or impute culpability.
          </span>
        </div>
        <div className="hidden md:flex items-center gap-3 text-amber-800 text-[11px]">
          <span className="font-mono bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
            Rule 31(A) Assistive IT Guidelines
          </span>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Branding & Document Switcher */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                  भू-लेखा <span className="text-emerald-700 font-medium">Studio</span>
                </h1>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                  v2.4
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                AI Land Records Digitization & Human-in-the-Loop Workbench
              </p>
            </div>
          </div>

          <div className="h-7 w-[1px] bg-slate-200 hidden sm:block" />

          {/* Document Record Selector & Ingest Button */}
          <div className="flex items-center gap-2">
            <label htmlFor="record-select" className="text-xs font-semibold text-slate-500 hidden lg:inline">
              Active Record:
            </label>
            <select
              id="record-select"
              value={currentRecord.id}
              onChange={(e) => onSelectRecord(e.target.value)}
              aria-label="Select Land Record"
              className="text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
            >
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.stateCode} - {r.village} ({r.recordType})
                </option>
              ))}
            </select>

            <button
              onClick={onOpenUpload}
              className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Upload new historical land record"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-700" />
              <span>Ingest New Scan</span>
            </button>
          </div>
        </div>

        {/* Center: Tabs */}
        <nav aria-label="Workbench sections" className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
          <button
            onClick={() => setActiveTab('digitization')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'digitization'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verification Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('citizen')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'citizen'
                ? 'bg-emerald-700 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${activeTab === 'citizen' ? 'text-amber-300' : 'text-emerald-600'}`} />
            <span>सरल व्याख्या (Citizen Explainer)</span>
          </button>

          <button
            onClick={() => setActiveTab('discrepancies')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'discrepancies'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${unresolvedDiscrepancies > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>Discrepancy Sanity</span>
            {unresolvedDiscrepancies > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {unresolvedDiscrepancies}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'audit'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Audit Trail ({currentRecord.auditTrail.length})</span>
          </button>
        </nav>

        {/* Right: Confidence Score & Officer Badge */}
        <div className="flex items-center gap-3">
          {/* Overall Confidence Pill */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs">
            <span className="text-slate-500 font-medium">AI Confidence:</span>
            <span className={`font-bold ${
              currentRecord.overallConfidence >= 0.9 
                ? 'text-emerald-700' 
                : currentRecord.overallConfidence >= 0.75 
                ? 'text-amber-700' 
                : 'text-red-700'
            }`}>
              {(currentRecord.overallConfidence * 100).toFixed(0)}%
            </span>
          </div>

          {/* Status Badge */}
          {currentRecord.verificationStatus === 'OFFICER_APPROVED' ? (
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-1 rounded-md text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Verified & Sealed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 px-2 py-1 rounded-md text-xs font-semibold">
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              Review Pending
            </span>
          )}

          {/* Officer ID Chip */}
          <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-slate-200 text-xs">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-[10px]">
              NT
            </div>
            <div className="text-left leading-tight">
              <p className="font-semibold text-slate-800">R. K. Mishra</p>
              <p className="text-[10px] text-slate-500">Naib Tehsildar (#48291)</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
