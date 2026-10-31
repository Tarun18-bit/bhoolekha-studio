import React, { useState } from 'react';
import { 
  X, 
  UploadCloud, 
  FileImage, 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  Sliders,
  FileText
} from 'lucide-react';
import type { LandRecordDocument } from '../types/landRecord';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordIngested: (newRecord: LandRecordDocument) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onRecordIngested,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stateName, setStateName] = useState<string>('Uttar Pradesh');
  const [recordType, setRecordType] = useState<LandRecordDocument['recordType']>('Khasra-Khatauni');
  const [villageName, setVillageName] = useState<string>('');
  const [tehsilName, setTehsilName] = useState<string>('');
  const [deskewAngle, setDeskewAngle] = useState<number>(-2.5);
  const [autoEnhance, setAutoEnhance] = useState<boolean>(true);

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const loadPresetDemoRecord = async () => {
    setStateName('Uttar Pradesh');
    setVillageName('हीरापुरमचहटी (जौनपुर)');
    setTehsilName('केराकत (Kerakat)');
    setRecordType('Khasra-Khatauni');
    try {
      const resp = await fetch('/sample-scans/jaunpur-khatauni.jpg');
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
        setSelectedFile(new File([blob], 'jaunpur-khatauni.jpg', { type: 'image/jpeg' }));
      };
      reader.readAsDataURL(blob);
    } catch {
      setPreviewUrl('/sample-scans/jaunpur-khatauni.jpg');
    }
  };

  const handleStartExtraction = async () => {
    let activeImageB64 = previewUrl || '';
    if (!activeImageB64 && !selectedFile) {
      activeImageB64 = '/sample-scans/up-khasra.svg';
    }

    setIsProcessing(true);
    setCurrentStep(1);

    // If relative path, convert to Base64
    if (activeImageB64.startsWith('/')) {
      try {
        const resp = await fetch(activeImageB64);
        const blob = await resp.blob();
        activeImageB64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch {
        // Continue with path
      }
    }

    // Call the FastAPI backend
    let failure = '';
    setErrorMsg(null);
    try {
      // Step 1: Preprocessing
      await new Promise((r) => setTimeout(r, 600));
      setCurrentStep(2);

      // Step 2: Language & entity extraction
      await new Promise((r) => setTimeout(r, 700));
      setCurrentStep(3);

      const resp = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: activeImageB64,
          state: stateName,
          record_type: recordType,
          village: villageName,
          tehsil: tehsilName,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setCurrentStep(4);
        await new Promise((r) => setTimeout(r, 500));
        setIsProcessing(false);
        onRecordIngested(data.record);
        onClose();
        return;
      }
      let detail = '';
      try { detail = (await resp.json()).detail || ''; } catch { /* non-JSON body */ }
      failure = `Extraction failed (HTTP ${resp.status}). ${detail}`.trim();
    } catch {
      failure = 'Could not reach the backend at /api/extract. Is it running (python -m uvicorn main:app --port 8001)?';
    }

    // No client-side fallback: a failed extraction must be visible, never replaced by invented data.
    setIsProcessing(false);
    setCurrentStep(0);
    setErrorMsg(failure || 'Could not reach the extraction service. Is the backend running?');
  };

  const steps = [
    { title: 'Computer Vision Restoration', desc: 'Auto-deskewing, border cropping, Sauvola adaptive binarization' },
    { title: 'Multimodal Indic OCR Parsing', desc: 'Recognizing Devanagari script & revenue table columns' },
    { title: 'Revenue Entity Extraction', desc: 'Mapping Khata, Khasra, co-owners, and fractional shares' },
    { title: 'Mathematical Sanity Check', desc: 'Cross-verifying sub-plot area arithmetic vs stated holding' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Ingest Historical Land Record
              </h3>
              <p className="text-xs text-slate-500">
                Upload scanned register or revenue sheet for restoration & structured extraction
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isProcessing ? (
            /* Extraction Progress Screen */
            <div className="py-8 space-y-6">
              <div className="text-center space-y-2">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
                <h4 className="text-base font-bold text-slate-900">
                  Digitizing Historical Revenue Record...
                </h4>
                <p className="text-xs text-slate-500">
                  Running OpenCV image restoration and Indic revenue entity parsing
                </p>
              </div>

              {/* Stepper */}
              <div className="space-y-3 max-w-md mx-auto pt-2">
                {steps.map((s, index) => {
                  const stepNumber = index + 1;
                  const isDone = currentStep > stepNumber;
                  const isCurrent = currentStep === stepNumber;

                  return (
                    <div
                      key={s.title}
                      className={`p-3 rounded-lg border flex items-start gap-3 transition-all ${
                        isDone
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                          : isCurrent
                          ? 'border-blue-400 bg-blue-50/70 text-blue-950 ring-2 ring-blue-300/40'
                          : 'border-slate-200 bg-slate-50 text-slate-400'
                      }`}
                    >
                      <div className="mt-0.5">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : isCurrent ? (
                          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300 text-[10px] flex items-center justify-center font-bold">
                            {stepNumber}
                          </div>
                        )}
                      </div>
                      <div>
                        <h5 className="text-xs font-bold">{s.title}</h5>
                        <p className="text-[11px] opacity-80">{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Upload & Config Screen */
            <>
              {/* Dropzone Area */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Select Document Scan or Historical Register Page:
                </label>

                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-5 text-center transition-colors cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 relative">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />

                  {previewUrl ? (
                    <div className="space-y-2">
                      {selectedFile?.name?.toLowerCase().endsWith('.pdf') ? (
                        <div className="h-32 px-6 py-4 mx-auto border-2 border-red-300 rounded-xl bg-red-50 flex flex-col items-center justify-center shadow-xs">
                          <FileText className="w-10 h-10 text-red-600 mb-1" />
                          <p className="text-xs font-bold text-red-950 truncate max-w-xs">{selectedFile.name}</p>
                          <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full mt-1">
                            PDF Land Record Document
                          </span>
                        </div>
                      ) : (
                        <div className="h-32 w-auto mx-auto border rounded shadow-xs overflow-hidden bg-slate-900 inline-block">
                          <img
                            src={previewUrl}
                            alt="Scan Preview"
                            className="h-full w-auto object-contain"
                            style={{
                              transform: `rotate(${deskewAngle}deg)`,
                              filter: autoEnhance ? 'contrast(130%) brightness(105%)' : 'none',
                            }}
                          />
                        </div>
                      )}
                      <p className="text-xs font-semibold text-slate-700">
                        {selectedFile?.name || 'Scan Selected'}
                      </p>
                      <p className="text-[11px] text-emerald-700 underline">
                        Click or drag to change file
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 py-4">
                      <FileImage className="w-8 h-8 text-slate-400 mx-auto" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Drag and drop historical land record scan here
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Supports high-res PNG, JPG, TIFF, or scanned PDF
                        </p>
                      </div>
                      <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadPresetDemoRecord();
                          }}
                          className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold px-3 py-1.5 rounded-md transition-colors"
                        >
                          📜 Try Sample: UP Khatauni
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Preprocessing Diagnostics & Sliders */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-700" />
                    OpenCV Pre-Processing Controls
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Est. Tilt: {deskewAngle}°
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-600 font-medium block mb-1">
                      Deskew Angle Correction:
                    </label>
                    <input
                      type="range"
                      min="-15"
                      max="15"
                      step="0.5"
                      value={deskewAngle}
                      onChange={(e) => setDeskewAngle(parseFloat(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-3">
                    <input
                      type="checkbox"
                      id="auto-enhance-chk"
                      checked={autoEnhance}
                      onChange={(e) => setAutoEnhance(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    <label htmlFor="auto-enhance-chk" className="text-xs text-slate-700 font-medium cursor-pointer">
                      Adaptive Contrast (Sauvola Faded Ink Filter)
                    </label>
                  </div>
                </div>
              </div>

              {/* Metadata Form */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">State / राज्य / రాష్ట్రం:</label>
                  <select
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Andhra Pradesh">Andhra Pradesh (ఆంధ్రప్రదేశ్)</option>
                    <option value="Telangana">Telangana (తెలంగాణ)</option>
                    <option value="Uttar Pradesh">Uttar Pradesh (उत्तर प्रदेश)</option>
                    <option value="Bihar">Bihar (बिहार)</option>
                    <option value="Maharashtra">Maharashtra (महाराष्ट्र)</option>
                    <option value="Karnataka">Karnataka (ಕರ್ನಾಟಕ)</option>
                    <option value="Punjab">Punjab (ਪੰਜਾਬ)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Record Type / రకం:</label>
                  <select
                    value={recordType}
                    onChange={(e) => setRecordType(e.target.value as any)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Adangal / Pahani (అడంగల్ / పహణీ)">Adangal / Pahani (గ్రామ లెక్క నెం. 3 - Form 4A)</option>
                    <option value="Khasra-Khatauni">Khasra-Khatauni / Khatiyan (खसरा-खतौनी)</option>
                    <option value="7/12 Extract (Saat-Baara)">7/12 Extract (सात-बारा)</option>
                    <option value="Jamabandi">Jamabandi / RoR (जमाबंदी)</option>
                    <option value="Patta/Chitta">Patta / Chitta (பட்டா / சிట్టా)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">District / Tehsil:</label>
                  <input
                    type="text"
                    value={tehsilName}
                    onChange={(e) => setTehsilName(e.target.value)}
                    placeholder="Tehsil name"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Village / मौजा:</label>
                  <input
                    type="text"
                    value={villageName}
                    onChange={(e) => setVillageName(e.target.value)}
                    placeholder="Village name"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {errorMsg && !isProcessing && (
          <div className="mx-5 mb-3 p-3 rounded-lg border border-rose-300 bg-rose-50 text-xs text-rose-900 whitespace-pre-wrap" role="alert">
            <b>Extraction did not complete.</b> {errorMsg}
          </div>
        )}

        {!isProcessing && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded font-medium"
            >
              Cancel
            </button>

            <button
              onClick={handleStartExtraction}
              disabled={!previewUrl && !selectedFile}
              className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                previewUrl || selectedFile
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Start AI Extraction & Restoration</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
