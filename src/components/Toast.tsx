import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div 
      aria-live="polite" 
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const config = {
    success: {
      bg: 'bg-emerald-950/95 border-emerald-500/80 text-emerald-100',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
      titleCol: 'text-emerald-200'
    },
    warning: {
      bg: 'bg-amber-950/95 border-amber-500/80 text-amber-100',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
      titleCol: 'text-amber-200'
    },
    error: {
      bg: 'bg-red-950/95 border-red-500/80 text-red-100',
      icon: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />,
      titleCol: 'text-red-200'
    },
    info: {
      bg: 'bg-slate-900/95 border-slate-600 text-slate-100',
      icon: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
      titleCol: 'text-slate-100'
    }
  }[toast.type];

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 transition-all ${config.bg}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{config.icon}</div>
        <div className="text-xs">
          <div className={`font-semibold tracking-tight ${config.titleCol}`}>
            {toast.title}
          </div>
          {toast.message && (
            <div className="text-[11px] opacity-85 mt-0.5 leading-relaxed font-sans">
              {toast.message}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/60 hover:text-white p-0.5 rounded transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
