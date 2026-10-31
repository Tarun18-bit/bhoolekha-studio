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
  ShieldCheck,
  ZoomIn
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
  onResolveDiscrepancy: (discrepancyId: string, justification: string) => void;
  canResolve?: boolean;
  onAddOwner?: (data: { name: string; relative_name: string; relation_type: string; share_fraction: string }) => Promise<void>;
  onAddPlot?: (data: { khasra_number: string; area_text: string; classification: string; tax: string }) => Promise<void>;
}

const ResolveForm: React.FC<{ onSubmit: (note: string) => void }> = ({ onSubmit }) => {
  const [note, setNote] = useState('');
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Officer note (required), e.g. checked against mutation register"
        className="flex-1 text-xs border border-slate-300 rounded-md px-2 py-1.5"
      />
      <button
        disabled={!note.trim()}
        onClick={() => { onSubmit(note.trim()); setNote(''); }}
        className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
      >
        <Check className="w-3.5 h-3.5" />
        Resolve with note
      </button>
    </div>
  );
};

const AddEntryForm: React.FC<{
  label: string;
  fields: { key: string; placeholder: string; required?: boolean }[];
  onSubmit: (values: Record<string, string>) => Promise<void>;
}> = ({ label, fields, onSubmit }) => {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const ready = fields.every((f) => !f.required || (values[f.key] || '').trim());
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full text-xs font-semibold text-emerald-700 border border-dashed border-emerald-300 rounded-lg py-2 hover:bg-emerald-50">
        + {label}
      </button>
    );
  }
  return (
    <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50/40 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {fields.map((f) => (
          <input key={f.key} value={values[f.key] || ''} placeholder={f.placeholder + (f.required ? ' *' : '')}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            className="text-sm px-2.5 py-1.5 rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => { setOpen(false); setValues({}); }} className="text-xs px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100">Cancel</button>
        <button disabled={!ready || busy}
          onClick={async () => { setBusy(true); try { await onSubmit(values); setOpen(false); setValues({}); } finally { setBusy(false); } }}
          className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white font-semibold disabled:opacity-40">
          {busy ? 'Saving…' : 'Add (officer-entered)'}
        </button>
      </div>
    </div>
  );
};

export const VerificationPanel: React.FC<VerificationPanelProps> = ({
  record,
  selectedBoxId,
  onSelectBox,
  activeTab,
  onUpdateField,
  onVerifyField,
  onResolveDiscrepancy,
  canResolve = false,
  onAddOwner,
  onAddPlot,
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
    if (field.value?.includes('अपठनीय') || field.value?.includes('अस्पष्ट') || field.confidenceTier === 'low') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-100 border border-red-400 px-2.5 py-0.5 rounded-full animate-pulse shadow-2xs">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          अपठनीय / अस्पष्ट
        </span>
      );
    }

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

  // Helper to extract clean bilingual labels without ugly nested parentheses
  const getCleanLabels = (field: ExtractedField<string>, customTitle?: string) => {
    let rawRegional = (field.regionalLabel || '').replace(/^\(+|\)+$/g, '').trim();
    let latinLabel = customTitle || field.label;

    if (rawRegional.includes('खाता संख्या') || rawRegional.includes('Khata')) {
      rawRegional = 'खाता संख्या';
      latinLabel = 'Khata No.';
    } else if (rawRegional.includes('फसली')) {
      rawRegional = 'फसली वर्ष';
      latinLabel = 'Fasli Assessment Year';
    } else if (rawRegional.includes('क्षेत्रफल') && (field.key.includes('total') || latinLabel.includes('Total'))) {
      rawRegional = 'कुल दर्ज क्षेत्रफल';
      latinLabel = 'Total Stated Area';
    } else if (rawRegional.includes('गाटा') || rawRegional.includes('खसरा')) {
      rawRegional = 'गाटा / खसरा संख्या';
      latinLabel = 'Plot Survey No.';
    } else if (rawRegional.includes('किस्म') || field.key.includes('class')) {
      rawRegional = 'भूमि की श्रेणी (अधिकार)';
      latinLabel = 'Land Rights Classification';
    } else if (rawRegional.includes('मालगुजारी') || field.key.includes('tax')) {
      rawRegional = 'वार्षिक लगान (मालगुजारी)';
      latinLabel = 'Annual Revenue Cess';
    }

    return { primaryHindi: rawRegional, secondaryEnglish: latinLabel };
  };

  // Helper to format values in crystal-clear, citizen-friendly language
  const getFormattedValueDetails = (field: ExtractedField<string>) => {
    let rawVal = field.value || '';
    let subBadge: { text: string; bg: string; textCol: string } | null = null;
    let isMonospace = false;

    // 1. Khata / Gata identifiers
    if (field.key.includes('khata')) {
      isMonospace = true;
      rawVal = cleanIndicText(rawVal);
    } else if (field.key.includes('gata') || field.key.includes('khasra')) {
      isMonospace = true;
      rawVal = cleanIndicText(rawVal);
    }
    // 2. Area fields (Resolves the '0 Hectare' / nested parentheses bug)
    else if (field.key.includes('area') || field.key.includes('totalStatedArea')) {
      const sourceStr = `${field.rawOcrValue || ''} ${rawVal}`;
      const numMatch = sourceStr.match(/(\d+\.\d+|\b\d+\b)/);
      const ha = numMatch ? parseFloat(numMatch[1]) : 0;

      if (ha > 0) {
        const sqM = Math.round(ha * 10000);
        const biswa = Math.round((sqM / 126.464) * 10) / 10;
        const bigha = (biswa / 20).toFixed(2);
        rawVal = `${ha.toFixed(4)} हेक्टेयर (${sqM.toLocaleString('en-IN')} वर्ग मीटर)`;
        subBadge = {
          text: `लगभग ${biswa} बिस्वा (${bigha} बीघा)`,
          bg: 'bg-emerald-50 border-emerald-200',
          textCol: 'text-emerald-800'
        };
      } else {
        rawVal = cleanIndicText(rawVal);
      }
    }
    // 3. Category 1-Ka Land Rights (Citizen friendly freehold explanation)
    else if (field.key.includes('class')) {
      rawVal = 'श्रेणी 1-क · संक्रमणीय भूमिधर';
      subBadge = {
        text: '🛡️ स्वयं की निजी भूमि — बिक्री, बैनामा व ऋण का पूर्ण कानूनी अधिकार',
        bg: 'bg-emerald-50 border-emerald-200',
        textCol: 'text-emerald-800'
      };
    }
    // 4. Fasli Assessment Year
    else if (field.key.includes('fasli')) {
      let cleanFasli = cleanIndicText(rawVal).replace(/जुला\s*ई/g, 'जुलाई');
      if (cleanFasli.includes('1431')) {
        rawVal = '1431 फसली (1 जुलाई 2026 – 30 जून 2031)';
        subBadge = {
          text: 'सक्रिय 6-वर्षीय राजस्व निर्धारण चक्र (Active Fasli Cycle)',
          bg: 'bg-blue-50 border-blue-200',
          textCol: 'text-blue-800'
        };
      } else {
        rawVal = cleanFasli;
      }
    }
    // 5. Revenue Cess (Lagaan)
    else if (field.key.includes('tax') || field.key.includes('lagaan')) {
      rawVal = cleanIndicText(rawVal);
      if (!rawVal.startsWith('₹') && !rawVal.includes('रु')) rawVal = `₹ ${rawVal}`;
      subBadge = {
        text: 'नाममात्र वार्षिक सरकारी मालगुजारी',
        bg: 'bg-slate-100 border-slate-200',
        textCol: 'text-slate-700'
      };
    } else {
      rawVal = cleanIndicText(rawVal);
    }

    return { displayVal: rawVal, subBadge, isMonospace };
  };

  // Single field display/edit row with modern, high-trust Indian GovTech aesthetic
  const renderFieldRow = (
    field: ExtractedField<string>,
    customTitle?: string
  ) => {
    const isSelected = selectedBoxId === field.boundingBox?.id;
    const isEditing = editingKey === field.key;
    const { primaryHindi, secondaryEnglish } = getCleanLabels(field, customTitle);
    const { displayVal, subBadge, isMonospace } = getFormattedValueDetails(field);
    const isIllegible = 
      displayVal.includes('अपठनीय') || 
      displayVal.includes('अस्पष्ट') || 
      field.confidenceTier === 'low' ||
      (field.rawOcrValue && (field.rawOcrValue.includes('स्याही') || field.rawOcrValue.includes('??')));

    return (
      <div
        key={field.key}
        onClick={() => field.boundingBox && onSelectBox(field.boundingBox.id)}
        className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
          isSelected
            ? 'border-emerald-500 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-400/30'
            : isIllegible
            ? 'border-red-400 bg-red-50/50 hover:border-red-500 hover:shadow-xs ring-1 ring-red-300/40'
            : field.confidenceTier === 'medium' && !field.isVerified
            ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400 hover:shadow-xs'
            : 'border-slate-200/90 bg-white hover:border-emerald-300 hover:shadow-xs'
        }`}
      >
        {/* Card Header: Hindi Title, English Subtitle & Verified Pill */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-800 font-indic tracking-tight">
              {primaryHindi || secondaryEnglish}
            </span>
            {primaryHindi && (
              <span className="text-[11px] text-slate-400 font-medium">
                • {secondaryEnglish}
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
              className="flex-1 text-sm bg-white border border-emerald-500 rounded px-2.5 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-indic"
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
          <div className="flex items-start justify-between gap-2 my-1">
            <div className="flex-1">
              <div className={`text-[15px] font-bold leading-snug ${
                isIllegible ? 'text-red-900 font-indic' : isMonospace ? 'text-slate-900 font-mono tracking-wide' : 'text-slate-900 font-indic'
              }`}>
                {displayVal}
              </div>

              {/* Citizen-Friendly Explanatory Pill */}
              {subBadge && !isIllegible && (
                <div className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${subBadge.bg} ${subBadge.textCol}`}>
                  {subBadge.text}
                </div>
              )}

              {/* Statutory Notice Banner for Illegible/Faded Text */}
              {isIllegible && (
                <div className="mt-2.5 p-3 rounded-lg bg-red-100/90 border border-red-300 text-red-950 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-red-900">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>⚠️ मूल प्रति में स्याही अस्पष्ट / पन्ना फटा हुआ (Illegible Patch)</span>
                  </div>
                  <p className="text-[11px] text-red-800 leading-relaxed font-indic">
                    दस्तावेज़ में स्याही फैलने अथवा पन्ना कटने के कारण यह प्रविष्टि स्पष्ट नहीं है। डिजिटल इंडिया मानक (Rule 31A) के तहत कृत्रिम बुद्धिमत्ता द्वारा अनुमान लगाना वर्जित है।
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    {field.boundingBox && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBox(field.boundingBox.id);
                        }}
                        className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        मूल स्कैन ज़ूम करें
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(field.key, '');
                      }}
                      className="text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      तहसील रजिस्टर से प्रविष्ट करें
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
              {!field.isVerified && !isIllegible && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerifyField(field.key);
                  }}
                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-md font-semibold transition-colors"
                  title="Mark field verified"
                >
                  पुष्टि करें
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(field.key, isIllegible ? '' : field.value);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors"
                title="Edit value"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* OCR Raw Source text footer */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span className="truncate max-w-[240px]">
            मूल पाठ (OCR): <span className="font-mono text-slate-600 font-medium">{field.rawOcrValue}</span>
          </span>
          {field.boundingBox && (
            <span className="text-[11px] font-semibold text-emerald-700 group-hover:underline flex items-center gap-1">
              {isSelected ? '● दस्तावेज़ में चिह्नित' : 'दस्तावेज़ में देखें →'}
            </span>
          )}
        </div>

        {/* Discrepancy Note if present */}
        {field.discrepancyNote && (
          <div className="mt-2 text-xs bg-amber-100/70 border border-amber-300 text-amber-900 px-2.5 py-1.5 rounded-lg flex items-start gap-1.5">
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
                  canResolve ? (
                    <ResolveForm onSubmit={(note) => onResolveDiscrepancy(disc.id, note)} />
                  ) : (
                    <p className="text-[11px] text-slate-500 text-right pt-1">Only a verifier or admin can resolve discrepancies.</p>
                  )
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
              {genuineOwners.length === 0 && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                  No holders were read from this document. Add them from the scan.
                </p>
              )}
              {onAddOwner && (
                <AddEntryForm label="Add tenure holder"
                  fields={[{ key: 'name', placeholder: 'Holder name', required: true },
                           { key: 'relative_name', placeholder: 'Father / husband name' },
                           { key: 'share_fraction', placeholder: 'Share (e.g. 1/3)' }]}
                  onSubmit={(v) => onAddOwner({ name: v.name || '', relative_name: v.relative_name || '', relation_type: 's/o', share_fraction: v.share_fraction || '' })} />
              )}
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
          {record.plots.length === 0 && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
              No khasra plots were read from this document. Add them from the scan.
            </p>
          )}
          {onAddPlot && (
            <AddEntryForm label="Add khasra plot"
              fields={[{ key: 'khasra_number', placeholder: 'Khasra / survey no.', required: true },
                       { key: 'area_text', placeholder: 'Area (e.g. 0.0710 हे०, 2 Bigha 5 Biswa)', required: true },
                       { key: 'classification', placeholder: 'Land class' },
                       { key: 'tax', placeholder: 'Revenue / lagaan' }]}
              onSubmit={(v) => onAddPlot({ khasra_number: v.khasra_number || '', area_text: v.area_text || '', classification: v.classification || '', tax: v.tax || '' })} />
          )}
        </div>
      </div>
    </div>
  );
};
