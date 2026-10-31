import { useState, useCallback, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { SAMPLE_RECORDS } from './data/sampleRecords';
import type { LandRecordDocument } from './types/landRecord';
import { Header } from './components/Header';
import { DocumentViewer } from './components/DocumentViewer';
import { VerificationPanel } from './components/VerificationPanel';
import { ActionBar } from './components/ActionBar';
import { ExportModal } from './components/ExportModal';
import { UploadModal } from './components/UploadModal';
import { CitizenExplainer } from './components/CitizenExplainer';
import { VoiceAssistantWidget } from './components/VoiceAssistantWidget';
import { GisMapViewer } from './components/GisMapViewer';
import { GovtCheckPanel } from './components/GovtCheckPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { DashboardModal } from './components/DashboardModal';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { apiError, can, type SessionUser } from './auth';

export function App({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [records, setRecords] = useState<LandRecordDocument[]>(SAMPLE_RECORDS);
  const [selectedRecordId, setSelectedRecordId] = useState<string>(SAMPLE_RECORDS[0].id);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'digitization' | 'govt' | 'history' | 'citizen' | 'map' | 'discrepancies' | 'audit'>('digitization');
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Synchronize on startup with Digital India SQLite database
  useEffect(() => {
    let isMounted = true;
    async function loadDbRecords() {
      try {
        const resp = await fetch('/api/parcels');
        if (resp.ok) {
          const data = await resp.json();
          if (data.parcels && data.parcels.length > 0 && isMounted) {
            setRecords(data.parcels);
            setSelectedRecordId(data.parcels[0].id);
            addToast({
              type: 'success',
              title: 'डिजिटल इंडिया डेटाबेस सक्रिय (Bhoomi DB Connected)',
              message: `SQLite WAL इंजन से ${data.parcels.length} भू-अभिलेख लोड किए गए। ऑडिट ट्रेल हैश-चेन सक्रिय।`,
              duration: 3500
            });
          }
        }
      } catch {
        addToast({ type: 'error', title: 'Backend unreachable', message: 'Showing bundled sample records only; changes cannot be saved.' });
      }
    }
    loadDbRecords();
    return () => { isMounted = false; };
  }, [addToast]);

  const currentRecord = records.find((r) => r.id === selectedRecordId) || records[0];

  // Every change goes to the server first; the UI then shows exactly what the server saved
  // (including the chained audit entry and the logged-in officer). Nothing is faked locally.
  const replaceRecord = useCallback((rec: LandRecordDocument) => {
    setRecords((prev) => prev.map((r) => (r.id === rec.id ? rec : r)));
  }, []);

  const callApi = useCallback(async (url: string, method: string, body: object, okTitle: string, okMsg: string) => {
    try {
      const resp = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) {
        addToast({ type: 'error', title: 'Not saved', message: await apiError(resp) });
        return null;
      }
      const data = await resp.json();
      if (data.record) replaceRecord(data.record);
      addToast({ type: 'success', title: okTitle, message: okMsg });
      return data.record as LandRecordDocument;
    } catch {
      addToast({ type: 'error', title: 'Not saved', message: 'Could not reach the backend on port 8001.' });
      return null;
    }
  }, [addToast, replaceRecord]);

  const handleUpdateField = useCallback((fieldKey: string, newValue: string) => {
    callApi(`/api/parcels/${selectedRecordId}/fields`, 'PUT', { field_key: fieldKey, new_value: newValue, mode: 'edit' },
      'Field corrected', `Saved and logged in the audit trail under ${user.displayName}.`);
  }, [selectedRecordId, callApi, user.displayName]);

  const handleVerifyField = useCallback((fieldKey: string) => {
    callApi(`/api/parcels/${selectedRecordId}/fields`, 'PUT', { field_key: fieldKey, mode: 'confirm' },
      'Field confirmed', 'Marked as matching the scan and logged in the audit trail.');
  }, [selectedRecordId, callApi]);

  const handleResolveDiscrepancy = useCallback((discrepancyId: string, justification: string) => {
    callApi(`/api/parcels/${selectedRecordId}/discrepancies/${discrepancyId}/resolve`, 'POST', { justification },
      'Discrepancy resolved', 'Your note was saved with the audit entry.');
  }, [selectedRecordId, callApi]);

  const handleApproveRecord = useCallback(async () => {
    const rec = await callApi(`/api/parcels/${selectedRecordId}/approve`, 'POST', {},
      'Record approved & sealed', `Sealed by ${user.displayName} (${user.designation}).`);
    if (rec) {
      try { confetti({ particleCount: 80, spread: 60, origin: { y: 0.85 } }); } catch { /* canvas blocked */ }
    }
  }, [selectedRecordId, callApi, user.displayName, user.designation]);

  // "Reset" reloads the record as stored on the server (all saved changes are kept).
  const handleResetRecord = useCallback(async () => {
    try {
      const resp = await fetch(`/api/parcels/${selectedRecordId}`);
      if (!resp.ok) throw new Error(await apiError(resp));
      replaceRecord((await resp.json()).record);
      setSelectedBoxId(null);
      addToast({ type: 'info', title: 'Reloaded', message: 'Showing the record exactly as saved on the server.' });
    } catch (e) {
      addToast({ type: 'error', title: 'Could not reload', message: String(e) });
    }
  }, [selectedRecordId, addToast, replaceRecord]);

  const postAndReplace = useCallback(async (path: 'owners' | 'plots', body: object, label: string) => {
    await callApi(`/api/parcels/${selectedRecordId}/${path}`, 'POST', body,
      `${label} added`, 'Saved as officer-entered and logged in the audit trail.');
  }, [selectedRecordId, callApi]);

  const handleRecordIngested = useCallback((newRecord: LandRecordDocument) => {
    setRecords((prev) => [newRecord, ...prev]);
    setSelectedRecordId(newRecord.id);
    setSelectedBoxId(null);
    setActiveTab('digitization');
    addToast({
      type: 'success',
      title: 'नया अभिलेख अंतर्ग्रहण (Archival Scan Ingested)',
      message: `${newRecord.village} (${newRecord.stateCode}) का अभिलेख सफलतापूर्वक डेटाबेस में दर्ज हुआ।`,
      duration: 5000
    });
  }, [addToast]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      {/* Top Navigation & Compliance Banner */}
      <Header
        currentRecord={currentRecord}
        records={records}
        onSelectRecord={(id) => {
          setSelectedRecordId(id);
          setSelectedBoxId(null);
        }}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenDashboard={() => setIsDashboardOpen(true)}
        user={user}
        onLogout={onLogout}
        canIngest={can(user, 'ingest')}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Split Screen Studio */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[calc(100vh-130px)]">
        {/* Left Side: Document Viewer (6 cols on lg) */}
        <section aria-label="Original Land Record Document Viewer" className="lg:col-span-6 h-full border-r border-slate-200">
          <DocumentViewer
            record={currentRecord}
            selectedBoxId={selectedBoxId}
            onSelectBox={(boxId) => setSelectedBoxId(boxId)}
          />
        </section>

        {/* Right Side: Verification Workbench or Citizen Explainer (6 cols on lg) */}
        <section aria-label="Revenue Data & Explanation Panel" className="lg:col-span-6 h-full overflow-hidden flex flex-col">
          {activeTab === 'citizen' ? (
            <CitizenExplainer record={currentRecord} />
          ) : activeTab === 'map' ? (
            <GisMapViewer record={currentRecord} onOpenRecord={(id) => { setSelectedRecordId(id); setSelectedBoxId(null); setActiveTab('digitization'); }} />
          ) : activeTab === 'govt' ? (
            <GovtCheckPanel record={currentRecord} />
          ) : activeTab === 'history' ? (
            <HistoryPanel record={currentRecord} />
          ) : (
            <VerificationPanel
              record={currentRecord}
              selectedBoxId={selectedBoxId}
              onSelectBox={(boxId) => setSelectedBoxId(boxId)}
              activeTab={activeTab}
              onUpdateField={handleUpdateField}
              onVerifyField={handleVerifyField}
              onResolveDiscrepancy={handleResolveDiscrepancy}
              canResolve={can(user, 'resolve')}
              onAddOwner={(d) => postAndReplace('owners', d, 'Holder')}
              onAddPlot={(d) => postAndReplace('plots', d, 'Plot')}
            />
          )}
        </section>
      </main>

      {/* Bottom Sticky Action Bar */}
      <ActionBar
        record={currentRecord}
        onApproveRecord={handleApproveRecord}
        canApprove={can(user, 'approve')}
        onResetRecord={handleResetRecord}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Ingestion & Pre-processing Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onRecordIngested={handleRecordIngested}
      />

      {/* Operations Dashboard */}
      <DashboardModal
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        onOpenRecord={(id) => {
          setSelectedRecordId(id);
          setSelectedBoxId(null);
          setActiveTab('digitization');
          fetch('/api/parcels').then((r) => r.json()).then((d) => d.parcels && setRecords(d.parcels)).catch(() => {});
        }}
      />

      {/* Official Export & Certificate Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        record={currentRecord}
      />

      {/* Floating AI Voice Assistant Widget (Bhoo-Mitra AI) */}
      <VoiceAssistantWidget record={currentRecord} />

      {/* Modern High-Trust Notification Toast System */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
