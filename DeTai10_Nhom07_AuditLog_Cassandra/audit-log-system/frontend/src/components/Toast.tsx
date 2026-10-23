import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl border shadow-xl flex items-start gap-3 transition-all duration-200 animate-in slide-in-from-bottom-2 ${
              isSuccess
                ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-500/40 text-emerald-900 dark:text-emerald-200 shadow-emerald-500/10 dark:shadow-emerald-950/30'
                : isError
                ? 'bg-white/95 dark:bg-slate-900/95 border-rose-500/40 text-rose-900 dark:text-rose-200 shadow-rose-500/10 dark:shadow-rose-950/30'
                : isWarning
                ? 'bg-white/95 dark:bg-slate-900/95 border-amber-500/40 text-amber-900 dark:text-amber-200 shadow-amber-500/10 dark:shadow-amber-950/30'
                : 'bg-white/95 dark:bg-slate-900/95 border-sky-500/40 text-sky-900 dark:text-sky-200 shadow-sky-500/10 dark:shadow-sky-950/30'
            }`}
          >
            {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />}
            {isError && <AlertCircle className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />}
            {isWarning && <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />}
            {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />}

            <div className="flex-1 text-xs">
              {toast.title && <div className="font-semibold text-slate-900 dark:text-white mb-0.5">{toast.title}</div>}
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{toast.message}</p>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded transition"
              title="Dismiss"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export interface SingleToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
}

export const Toast: React.FC<SingleToastProps> = ({ message, type = 'info', onClose }) => {
  return (
    <ToastContainer
      toasts={[{ id: 'single-toast', message, type }]}
      onDismiss={() => onClose()}
    />
  );
};
