import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Building, ShieldCheck, HelpCircle } from 'lucide-react';
import type { LandRecordDocument } from '../types/landRecord';

interface RecordSelectorProps {
  currentRecord: LandRecordDocument;
  records: LandRecordDocument[];
  onSelectRecord: (recordId: string) => void;
}

export const RecordSelector: React.FC<RecordSelectorProps> = ({
  currentRecord,
  records,
  onSelectRecord,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredRecords = records.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.village?.toLowerCase().includes(q) ||
      r.district?.toLowerCase().includes(q) ||
      r.state?.toLowerCase().includes(q) ||
      r.stateCode?.toLowerCase().includes(q) ||
      r.title?.toLowerCase().includes(q) ||
      (r as any).ulpin?.toLowerCase().includes(q) ||
      r.khataNumber?.value?.includes(q)
    );
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-2xs group"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-300/40" />
        <span className="font-bold text-emerald-800 bg-emerald-100/70 px-1 rounded text-[10px]">
          {currentRecord.stateCode}
        </span>
        <span className="truncate max-w-[140px] md:max-w-[200px] text-slate-900 font-medium">
          {currentRecord.village}
        </span>
        <span className="text-[11px] text-slate-400 hidden xl:inline font-mono">
          ({currentRecord.khataNumber?.value ? `खाता ${currentRecord.khataNumber.value}` : currentRecord.id})
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-80 md:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="खोजें: मौजा, जिला, Ref, खाता..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 font-indic"
                autoFocus
              />
            </div>
          </div>

          {/* Records List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {filteredRecords.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                कोई अभिलेख नहीं मिला
              </div>
            ) : (
              filteredRecords.map((r) => {
                const isSelected = r.id === currentRecord.id;
                const ulpin = (r as any).ulpin || '—';
                const isApproved = r.verificationStatus === 'OFFICER_APPROVED';

                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      onSelectRecord(r.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-start justify-between gap-2 ${
                      isSelected ? 'bg-emerald-50/60 font-semibold' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1 rounded">
                          {r.stateCode}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {r.village}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate">
                          • {r.district}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-indic truncate">
                        {r.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                        <span>Ref: {ulpin}</span>
                        <span>•</span>
                        <span>खाता: {r.khataNumber?.value || '—'}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isSelected && (
                        <Check className="w-4 h-4 text-emerald-600" />
                      )}
                      {isApproved ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                          <ShieldCheck className="w-2.5 h-2.5" /> Sealed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-full">
                          <HelpCircle className="w-2.5 h-2.5" /> In Review
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="p-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Building className="w-3 h-3 text-slate-400" /> Digitized records
            </span>
            <span className="font-mono">{filteredRecords.length} records</span>
          </div>
        </div>
      )}
    </div>
  );
};
