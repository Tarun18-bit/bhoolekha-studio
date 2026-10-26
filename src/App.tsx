import { useState, useCallback } from 'react';
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

export function App() {
  const [records, setRecords] = useState<LandRecordDocument[]>(SAMPLE_RECORDS);
  const [selectedRecordId, setSelectedRecordId] = useState<string>(SAMPLE_RECORDS[0].id);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'digitization' | 'citizen' | 'discrepancies' | 'audit'>('digitization');
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  const currentRecord = records.find((r) => r.id === selectedRecordId) || records[0];

  // Helper to append to immutable audit trail
  const createAuditEntry = (
    action: 'FIELD_EDITED' | 'CONFIRMED_MATCH' | 'DISCREPANCY_OVERRIDDEN' | 'FINAL_DIGITIZATION_SIGN_OFF',
    fieldLabel: string,
    oldValue?: string,
    newValue?: string
  ) => {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    const randomHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    return {
      id: `audit-${Date.now()}`,
      timestamp,
      officerId: 'REV_OFFICER_4829',
      officerName: 'R. K. Mishra',
      officerDesignation: 'Naib Tehsildar (Pindra)',
      action,
      fieldLabel,
      oldValue,
      newValue,
      integrityHash: randomHash,
    };
  };

  // Update a field's value
  const handleUpdateField = useCallback((fieldKey: string, newValue: string) => {
    setRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== selectedRecordId) return rec;

        let oldValue = '';
        let foundLabel = '';

        // Check header fields
        const updatedRec = { ...rec };
        if (updatedRec.khataNumber.key === fieldKey) {
          oldValue = updatedRec.khataNumber.value;
          foundLabel = updatedRec.khataNumber.label;
          updatedRec.khataNumber = {
            ...updatedRec.khataNumber,
            value: newValue,
            isVerified: true,
            verifiedBy: 'R. K. Mishra (NT)',
          };
        } else if (updatedRec.fasliYear?.key === fieldKey) {
          oldValue = updatedRec.fasliYear.value;
          foundLabel = updatedRec.fasliYear.label;
          updatedRec.fasliYear = {
            ...updatedRec.fasliYear,
            value: newValue,
            isVerified: true,
          };
        } else if (updatedRec.totalStatedArea?.key === fieldKey) {
          oldValue = updatedRec.totalStatedArea.value;
          foundLabel = updatedRec.totalStatedArea.label;
          updatedRec.totalStatedArea = {
            ...updatedRec.totalStatedArea,
            value: newValue,
            isVerified: true,
          };
        } else {
          // Check owners
          updatedRec.owners = updatedRec.owners.map((owner) => {
            const updatedOwner = { ...owner };
            if (updatedOwner.name.key === fieldKey) {
              oldValue = updatedOwner.name.value;
              foundLabel = `Owner: ${updatedOwner.name.label}`;
              updatedOwner.name = { ...updatedOwner.name, value: newValue, isVerified: true };
            }
            if (updatedOwner.relativeName.key === fieldKey) {
              oldValue = updatedOwner.relativeName.value;
              foundLabel = `Owner: ${updatedOwner.relativeName.label}`;
              updatedOwner.relativeName = { ...updatedOwner.relativeName, value: newValue, isVerified: true };
            }
            return updatedOwner;
          });

          // Check sub-plots
          updatedRec.plots = updatedRec.plots.map((plot) => {
            const updatedPlot = { ...plot };
            if (updatedPlot.khasraNumber.key === fieldKey) {
              oldValue = updatedPlot.khasraNumber.value;
              foundLabel = `Plot ${updatedPlot.khasraNumber.value}`;
              updatedPlot.khasraNumber = { ...updatedPlot.khasraNumber, value: newValue, isVerified: true };
            }
            if (updatedPlot.regionalAreaText.key === fieldKey) {
              oldValue = updatedPlot.regionalAreaText.value;
              foundLabel = `Plot Area`;
              updatedPlot.regionalAreaText = { ...updatedPlot.regionalAreaText, value: newValue, isVerified: true };
            }
            return updatedPlot;
          });
        }

        const newAudit = createAuditEntry('FIELD_EDITED', foundLabel, oldValue, newValue);
        updatedRec.auditTrail = [newAudit, ...updatedRec.auditTrail];
        return updatedRec;
      })
    );
  }, [selectedRecordId]);

  // Mark field verified without editing
  const handleVerifyField = useCallback((fieldKey: string) => {
    setRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== selectedRecordId) return rec;

        const updatedRec = { ...rec };
        let fieldLabel = 'Field';
        let verifiedVal = '';

        if (updatedRec.khataNumber.key === fieldKey) {
          updatedRec.khataNumber = { ...updatedRec.khataNumber, isVerified: true };
          fieldLabel = updatedRec.khataNumber.label;
          verifiedVal = updatedRec.khataNumber.value;
        }

        updatedRec.owners = updatedRec.owners.map((o) => {
          const u = { ...o };
          if (u.name.key === fieldKey) {
            u.name = { ...u.name, isVerified: true };
            fieldLabel = u.name.label;
            verifiedVal = u.name.value;
          }
          if (u.relativeName.key === fieldKey) {
            u.relativeName = { ...u.relativeName, isVerified: true };
            fieldLabel = u.relativeName.label;
            verifiedVal = u.relativeName.value;
          }
          return u;
        });

        updatedRec.plots = updatedRec.plots.map((p) => {
          const u = { ...p };
          if (u.khasraNumber.key === fieldKey) {
            u.khasraNumber = { ...u.khasraNumber, isVerified: true };
            fieldLabel = `Plot ${u.khasraNumber.value}`;
            verifiedVal = u.khasraNumber.value;
          }
          return u;
        });

        const newAudit = createAuditEntry('CONFIRMED_MATCH', fieldLabel, undefined, verifiedVal);
        updatedRec.auditTrail = [newAudit, ...updatedRec.auditTrail];
        return updatedRec;
      })
    );
  }, [selectedRecordId]);

  // Resolve discrepancy
  const handleResolveDiscrepancy = useCallback((discrepancyId: string) => {
    setRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== selectedRecordId) return rec;

        const updatedDiscrepancies = rec.discrepancies.map((d) =>
          d.id === discrepancyId ? { ...d, status: 'RESOLVED' as const } : d
        );

        const targetDisc = rec.discrepancies.find((d) => d.id === discrepancyId);
        const newAudit = createAuditEntry(
          'DISCREPANCY_OVERRIDDEN',
          targetDisc?.title || 'Discrepancy',
          'PENDING_REVIEW',
          'Acknowledged & Justified with Revenue Form CH-23 Cross-Index'
        );

        return {
          ...rec,
          discrepancies: updatedDiscrepancies,
          auditTrail: [newAudit, ...rec.auditTrail],
        };
      })
    );
  }, [selectedRecordId]);

  // Final approval
  const handleApproveRecord = useCallback(() => {
    // Trigger celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.85 },
      });
    } catch {
      // Graceful fallback if canvas blocked
    }

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';

    setRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== selectedRecordId) return rec;

        const finalAudit = createAuditEntry(
          'FINAL_DIGITIZATION_SIGN_OFF',
          'Complete Record Dossier',
          'IN_REVIEW',
          'Digitally Sealed for National Land Records Portal Sync'
        );

        return {
          ...rec,
          verificationStatus: 'OFFICER_APPROVED',
          approvedBy: 'Naib Tehsildar R. K. Mishra (Emp #48291)',
          approvedAt: timestamp,
          auditTrail: [finalAudit, ...rec.auditTrail],
        };
      })
    );
  }, [selectedRecordId]);

  // Reset to original draft
  const handleResetRecord = useCallback(() => {
    const original = SAMPLE_RECORDS.find((r) => r.id === selectedRecordId);
    if (!original) return;

    setRecords((prev) =>
      prev.map((rec) => (rec.id === selectedRecordId ? JSON.parse(JSON.stringify(original)) : rec))
    );
    setSelectedBoxId(null);
  }, [selectedRecordId]);

  // Handle newly ingested document from upload modal
  const handleRecordIngested = useCallback((newRecord: LandRecordDocument) => {
    setRecords((prev) => [newRecord, ...prev]);
    setSelectedRecordId(newRecord.id);
    setSelectedBoxId(null);
    setActiveTab('digitization');
  }, []);

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
          ) : (
            <VerificationPanel
              record={currentRecord}
              selectedBoxId={selectedBoxId}
              onSelectBox={(boxId) => setSelectedBoxId(boxId)}
              activeTab={activeTab}
              onUpdateField={handleUpdateField}
              onVerifyField={handleVerifyField}
              onResolveDiscrepancy={handleResolveDiscrepancy}
            />
          )}
        </section>
      </main>

      {/* Bottom Sticky Action Bar */}
      <ActionBar
        record={currentRecord}
        onApproveRecord={handleApproveRecord}
        onResetRecord={handleResetRecord}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Ingestion & Pre-processing Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onRecordIngested={handleRecordIngested}
      />

      {/* Official Export & Certificate Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        record={currentRecord}
      />

      {/* Floating AI Voice Assistant Widget (Bhoo-Mitra AI) */}
      <VoiceAssistantWidget record={currentRecord} />
    </div>
  );
}

export default App;
