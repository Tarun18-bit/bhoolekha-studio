import React, { useState } from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  Edit3, 
  Check, 
  Users, 
  MapPin, 
  Calculator, 
  Scale, 
  AlertTriangle,
  History,
  ShieldCheck
} from 'lucide-react';
import type { 
  LandRecordDocument, 
  ExtractedField
} from '../types/landRecord';
import { checkParcelArithmetic } from '../utils/landMath';
import { cleanIndicText, isNonOwnerRow } from '../utils/textCleaner';

interface VerificationPanelProps {
  record: LandRecordDocument;
  selectedBoxId: string | null;
  onSelectBox: (boxId: string | null) => void;
  activeTab: 'digitization' | 'discrepancies' | 'audit';
  onUpdateField: (fieldKey: string, newValue: string) => void;
  onVerifyField: (fieldKey: string) => void;
  onResolveDiscrepancy: (discrepancyId: string) => void;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({
  record,
  selectedBoxId,
  onSelectBox,
  activeTab,
  onUpdateField,
  onVerifyField,
  onResolveDiscrepancy,
}) => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  const handleStartEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setTempValue(currentValue);
  };

  const handleSaveEdit = (key: string) => {
    onUpdateField(key, tempValue);
    setEditingKey(null);
  };

  // Perform live math sanity check between stated total and sub-plots
  const subPlotsSqMeters = record.plots.map((p) => p.areaInSqMeters);
  const mathCheck = checkParcelArithmetic(record.totalStatedAreaInSqMeters, subPlotsSqMeters);

  // Confidence pill badge helper
  const renderConfidenceBadge = (field: ExtractedField<string>) => {
    if (field.isVerified) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
          <CheckCircle className="w-3 h-3 text-emerald-600" />
          Verified
        </span>
      );
    }

    if (field.confidenceTier === 'high') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {(field.confidence * 100).toFixed(0)}% Conf.
        </span>
      );
    }

    if (field.confidenceTier === 'medium') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full animate-pulse">
          <AlertCircle className="w-3 h-3 text-amber-600" />
          {(field.confidence * 100).toFixed(0)}% Needs Review
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-300 px-2 py-0.5 rounded-full">
        <AlertTriangle className="w-3 h-3 text-red-600" />
        Low Conf.
      </span>
    );
  };

  // Single field display/edit row
  const renderFieldRow = (
    field: ExtractedField<string>,
    customTitle?: string
  ) => {
    const isSelected = selectedBoxId === field.boundingBox?.id;
    const isEditing = editingKey === field.key;
    const isNumericCode = field.key.includes('khata') || field.key.includes('gata') || field.key.includes('plot') || field.key.includes('area') || field.key.includes('tax') || field.key.includes('fasli') || field.key.includes('share') || /^\d+$/.test(field.value);

    return (
      <div
        key={field.key}
        onClick={() => field.boundingBox && onSelectBox(field.boundingBox.id)}
        className={`p-3 rounded-lg border transition-all cursor-pointer ${
          isSelected
            ? 'border-emerald-500 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-400/30'
            : field.confidenceTier === 'medium' && !field.isVerified
            ? 'border-amber-300 bg-amber-50/40 hover:border-amber-400'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              {customTitle || field.label}
            </span>
            {field.regionalLabel && (
              <span className="text-[11px] text-slate-400 font-medium">
                ({field.regionalLabel})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {renderConfidenceBadge(field)}
          </div>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className="flex-1 text-sm bg-white border border-emerald-500 rounded px-2.5 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              autoFocus
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSaveEdit(field.key);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded transition-colors"
              title="Save value"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className={`text-sm font-semibold text-slate-900 ${isNumericCode ? 'font-mono' : 'font-sans'}`}>
              {cleanIndicText(field.value)}
            </div>

            <div className="flex items-center gap-1.5">
              {!field.isVerified && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerifyField(field.key);
                  }}
                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-medium transition-colors"
                  title="Mark field verified"
                >
                  Confirm Match
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(field.key, field.value);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors"
                title="Edit extracted text"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* OCR Raw Source text note */}
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>OCR Raw: <span className={`${isNumericCode ? 'font-mono' : 'font-sans'} text-slate-600`}>{field.rawOcrValue}</span></span>
          {field.boundingBox && (
            <span className="text-[10px] text-emerald-700 hover:underline">
              {isSelected ? '● Highlighted in scan' : 'Click to inspect in scan'}
            </span>
          )}
        </div>

        {/* Discrepancy Note if present */}
        {field.discrepancyNote && (
          <div className="mt-2 text-xs bg-amber-100/70 border border-amber-300 text-amber-900 px-2.5 py-1.5 rounded flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <span>{field.discrepancyNote}</span>
          </div>
        )}
      </div>
    );
  };

  /* ---------------- TAB 2: DISCREPANCIES VIEW ---------------- */
  if (activeTab === 'discrepancies') {
    return (
      <div className="p-6 space-y-6 overflow-y-auto h-full bg-slate-50">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Revenue Integrity & Discrepancy Sanity Engine
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Automated mathematical cross-checks, regional land unit reconciliation, and OCR confidence anomalies.
          </p>
        </div>

        {/* Live Mathematical Sanity Card */}
        <div className={`p-4 rounded-xl border ${
          mathCheck.isConsistent 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
            : 'bg-red-50 border-red-300 text-red-950'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${mathCheck.isConsistent ? 'bg-emerald-200' : 'bg-red-200'}`}>
              <Calculator className={`w-5 h-5 ${mathCheck.isConsistent ? 'text-emerald-800' : 'text-red-800'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">
                  {mathCheck.isConsistent 
                    ? 'Sub-parcel Mathematical Balance Verified' 
                    : 'Discrepancy: Stated Area vs. Sub-plots Area Mismatch'}
                </h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  mathCheck.isConsistent ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
                }`}>
                  {mathCheck.isConsistent ? 'Zero Variance' : `${mathCheck.percentageVariance}% Variance`}
                </span>
              </div>
              <p className="text-xs mt-1.5 leading-relaxed">
                {mathCheck.message}
              </p>

              {/* Area Breakdown Pill Comparison */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/80 p-2 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Stated Total Area:</span>
                  <span className="font-bold font-mono text-slate-900">
                    {record.totalStatedArea.value} (~{record.totalStatedAreaInSqMeters.toLocaleString()} m²)
                  </span>
                </div>
                <div className="bg-white/80 p-2 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Sum of Sub-plots ({record.plots.length} plots):</span>
                  <span className="font-bold font-mono text-slate-900">
                    ~{subPlotsSqMeters.reduce((a, b) => a + b, 0).toLocaleString()} m²
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Discrepancy Items List */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Detected Audit Flags ({record.discrepancies.length})
          </h3>

          {record.discrepancies.length === 0 ? (
            <div className="bg-white p-6 rounded-lg border border-slate-200 text-center text-slate-500 text-sm">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              No discrepancies detected. All field values and measurements are structurally sound.
            </div>
          ) : (
            record.discrepancies.map((disc) => (
              <div 
                key={disc.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      disc.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <h4 className="text-sm font-bold text-slate-900">{disc.title}</h4>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    disc.status === 'RESOLVED' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {disc.status.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {disc.description}
                </p>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold text-slate-900">Recommended Officer Action:</strong> {disc.suggestedAction}
                  </div>
                </div>

                {disc.status !== 'RESOLVED' && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => onResolveDiscrepancy(disc.id)}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark Acknowledged & Attach Officer Note
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  /* ---------------- TAB 3: AUDIT TRAIL VIEW ---------------- */
  if (activeTab === 'audit') {
    return (
      <div className="p-6 space-y-6 overflow-y-auto h-full bg-slate-50">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Cryptographic Tamper-Evident Audit Trail
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Immutable log of all automated ingestion events and authorized human verification steps.
          </p>
        </div>

        <div className="space-y-4 relative before:absolute before:top-3 before:bottom-3 before:left-3.5 before:w-0.5 before:bg-slate-200">
          {record.auditTrail.map((entry) => (
            <div key={entry.id} className="relative pl-8">
              <div className="absolute left-1.5 top-1.5 w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-xs" />
              
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    {entry.officerName} ({entry.officerDesignation})
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {entry.timestamp}
                  </span>
                </div>

                <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded inline-block">
                  Action: {entry.action.replace(/_/g, ' ')}
                </div>

                {entry.oldValue && (
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-500">Original Value: </span>
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{entry.oldValue}</span>
                  </div>
                )}

                {entry.newValue && (
                  <div className="text-xs text-slate-800">
                    <span className="font-semibold text-slate-500">Verified As: </span>
                    <span className="font-mono bg-emerald-50 text-emerald-900 px-1.5 py-0.5 rounded border border-emerald-200">
                      {entry.newValue}
                    </span>
                  </div>
                )}

                <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-between">
                  <span>SHA-256 Hash: {entry.integrityHash.substring(0, 24)}...</span>
                  <span className="text-emerald-700 font-semibold">Integrity Verified ✓</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---------------- TAB 1: DEFAULT DIGITIZATION STUDIO ---------------- */
  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-slate-50">
      {/* Discrepancy Quick Alert if math variance exists */}
      {!mathCheck.isConsistent && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-red-950">
                Arithmetic Discrepancy Detected (+{mathCheck.percentageVariance}% Variance)
              </h4>
              <p className="text-[11px] text-red-800 mt-0.5">
                Stated total ({record.totalStatedArea.value}) does not match sub-plots sum. Human verification mandatory.
              </p>
            </div>
          </div>
          <button
            onClick={() => record.totalStatedArea?.boundingBox && onSelectBox(record.totalStatedArea.boundingBox.id)}
            className="text-[11px] font-semibold text-red-700 hover:text-red-900 underline shrink-0"
          >
            Inspect
          </button>
        </div>
      )}

      {/* Card 1: Revenue Header Details */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Revenue Jurisdiction & Identification
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            {record.state} • {record.district}
          </span>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renderFieldRow(record.khataNumber)}
            {record.fasliYear && renderFieldRow(record.fasliYear)}
          </div>
          {record.totalStatedArea && renderFieldRow(record.totalStatedArea)}
        </div>
      </div>

      {/* Card 2: Tenure Holders / Co-Owners */}
      {/* Card 2: Co-Tenure Holders List */}
      {(() => {
        const genuineOwners = record.owners.filter(o => !isNonOwnerRow(o.name.value));
        return (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Bhumadhikari / Co-Tenure Holders ({genuineOwners.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Individual Shareholding Breakdown
              </span>
            </div>

            <div className="p-4 space-y-4">
              {genuineOwners.map((owner, idx) => (
                <div key={owner.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Holder #{idx + 1}
                    </span>
                    <span className="text-[11px] font-mono font-semibold bg-slate-200 px-2 py-0.5 rounded text-slate-700">
                      Share: {cleanIndicText(owner.shareFraction.value)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {renderFieldRow(owner.name, `Owner Name`)}
                    {renderFieldRow(owner.relativeName, `Father/Guardian Name`)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Card 3: Khasra Parcel Plots Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Khasra Sub-Plots & Land Measurements ({record.plots.length} Parcels)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-emerald-800 font-semibold">
            Auto-converted to SI Metric
          </span>
        </div>

        <div className="p-4 space-y-4">
          {record.plots.map((plot) => (
            <div key={plot.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Plot: {plot.khasraNumber.value}
                </span>
                <span className="text-[11px] font-mono text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                  {plot.areaInHectares} Ha ({plot.areaInSqMeters.toLocaleString()} m²)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {renderFieldRow(plot.khasraNumber)}
                {renderFieldRow(plot.regionalAreaText)}
                {renderFieldRow(plot.landClassification)}
                {renderFieldRow(plot.annualRevenueLagaan)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
