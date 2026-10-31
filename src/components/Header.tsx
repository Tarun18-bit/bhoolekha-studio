import React from 'react';
import { 
  Landmark,
  History,
  Building2, 
  ShieldCheck, 
  AlertTriangle, 
  FileCheck2, 
  HelpCircle, 
  CheckCircle2, 
  FileSpreadsheet, 
  UploadCloud,
  Sparkles,
  Compass,
  Database,
  BarChart3
} from 'lucide-react';
import type { SessionUser } from '../auth';
import type { LandRecordDocument } from '../types/landRecord';
import { RecordSelector } from './RecordSelector';

interface HeaderProps {
  currentRecord: LandRecordDocument;
  records: LandRecordDocument[];
  onSelectRecord: (recordId: string) => void;
  onOpenUpload: () => void;
  onOpenDashboard: () => void;
  user: SessionUser;
  onLogout: () => void;
  canIngest: boolean;
  activeTab: 'digitization' | 'govt' | 'history' | 'citizen' | 'map' | 'discrepancies' | 'audit';
  setActiveTab: (tab: 'digitization' | 'govt' | 'history' | 'citizen' | 'map' | 'discrepancies' | 'audit') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRecord,
  records,
  onSelectRecord,
  onOpenUpload,
  user,
  onLogout,
  canIngest,
  onOpenDashboard,
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
            <strong className="font-semibold text-amber-950">Notice:</strong> This AI system is strictly an assistive digitization and transcription workbench. It does <strong>not</strong> independently declare legal title, adjudicate land disputes, or impute culpability.
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
                <h1 className="text-xl font-extrabold text-slate-900 leading-tight tracking-tight">
                  भू-लेखा <span className="text-emerald-700 font-semibold">Studio</span>
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
            <RecordSelector
              currentRecord={currentRecord}
              records={records}
              onSelectRecord={onSelectRecord}
            />

            <button
              onClick={onOpenUpload}
              disabled={!canIngest}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
              title={canIngest ? "Upload new historical land record scan or PDF" : "Your role cannot upload scans (operator or admin only)"}
            >
              <UploadCloud className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">Ingest New Scan</span>
              <span className="sm:hidden">Upload</span>
            </button>

            <button
              onClick={onOpenDashboard}
              className="text-xs bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5"
              title="Digitization operations dashboard"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
          </div>
        </div>

        {/* Live DB Connection Chip */}
        <div className="hidden 2xl:flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-md text-[11px] font-semibold">
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>SQLite DB · hash-chained audit trail</span>
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
            onClick={() => setActiveTab('govt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'govt'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 text-emerald-600" />
            <span>Govt Check</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 text-emerald-600" />
            <span>History</span>
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
            <span>सरल व्याख्या</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'map'
                ? 'bg-emerald-700 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${activeTab === 'map' ? 'text-amber-300' : 'text-emerald-600'}`} />
            <span>भू-नक्शा (GIS)</span>
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
            <span>Discrepancies</span>
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
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-[10px] uppercase">
              {user.role.slice(0, 2)}
            </div>
            <div className="text-left leading-tight">
              <p className="font-semibold text-slate-800">{user.displayName}</p>
              <p className="text-[10px] text-slate-500">{user.designation} · {user.role}</p>
            </div>
            <button onClick={onLogout} className="ml-1 text-[10px] text-slate-500 hover:text-red-700 underline">Sign out</button>
          </div>
        </div>
      </div>
    </header>
  );
};
