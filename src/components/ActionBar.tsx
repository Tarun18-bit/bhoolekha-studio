import React from 'react';
import { 
  CheckCheck, 
  FileDown, 
  RotateCcw
} from 'lucide-react';
import type { LandRecordDocument } from '../types/landRecord';

interface ActionBarProps {
  record: LandRecordDocument;
  onApproveRecord: () => void;
  canApprove: boolean;
  onResetRecord: () => void;
  onOpenExport: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  record,
  onApproveRecord,
  canApprove,
  onResetRecord,
  onOpenExport,
}) => {
  // Calculate verified count
  const allFields = [
    record.khataNumber,
    ...(record.fasliYear ? [record.fasliYear] : []),
    ...(record.totalStatedArea ? [record.totalStatedArea] : []),
    ...record.owners.flatMap((o) => [o.name, o.relativeName, o.shareFraction]),
    ...record.plots.flatMap((p) => [
      p.khasraNumber,
      p.regionalAreaText,
      p.landClassification,
      p.annualRevenueLagaan,
    ]),
  ];

  const verifiedCount = allFields.filter((f) => f.isVerified).length;
  const totalCount = allFields.length;
  const progressPercent = Math.round((verifiedCount / totalCount) * 100);

  const isApproved = record.verificationStatus === 'OFFICER_APPROVED';

  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-3 sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-4 shadow-md">
      {/* Verification Progress */}
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">
              Human Verification Progress:
            </span>
            <span className="text-xs font-mono font-bold text-emerald-700">
              {verifiedCount} of {totalCount} ({progressPercent}%)
            </span>
          </div>

          <div className="w-48 bg-slate-200 h-2 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400 pl-4 border-l border-slate-200">
          <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-600 font-mono text-[10px]">
            Tab
          </kbd>
          <span>to cycle fields</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onResetRecord}
          className="text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5"
          title="Reset back to raw AI draft"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Draft</span>
        </button>

        {isApproved ? (
          <button
            onClick={onOpenExport}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            <span>Export Verified Record & Certificate</span>
          </button>
        ) : (
          <button
            onClick={onApproveRecord}
            disabled={!canApprove}
            title={canApprove ? undefined : 'Only a verifier or admin can approve and seal'}
            className="disabled:opacity-40 disabled:cursor-not-allowed text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all flex items-center gap-2 hover:shadow-md"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Approve & Digitally Seal Record</span>
          </button>
        )}
      </div>
    </footer>
  );
};
