import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (title: string, message?: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (title: string, message?: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { id, title, message, type };

    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Floating Toast Container */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          let icon = <Info className="h-4 w-4 text-cyan-400 shrink-0" />;
          let borderStyle = 'border-cyan-500/30 bg-[#080E1C]/90 text-cyan-200';

          if (toast.type === 'success') {
            icon = <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
            borderStyle = 'border-emerald-500/30 bg-[#061410]/90 text-emerald-200';
          } else if (toast.type === 'error') {
            icon = <XCircle className="h-4 w-4 text-rose-400 shrink-0" />;
            borderStyle = 'border-rose-500/30 bg-[#1A080C]/90 text-rose-200';
          } else if (toast.type === 'warning') {
            icon = <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />;
            borderStyle = 'border-amber-500/30 bg-[#1C1205]/90 text-amber-200';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-3.5 rounded-xl border backdrop-blur-xl shadow-2xl flex items-start justify-between gap-3 font-mono text-xs animate-in slide-in-from-top-4 duration-300 ${borderStyle}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">{icon}</div>
                <div>
                  <h4 className="font-bold uppercase tracking-wider">{toast.title}</h4>
                  {toast.message && <p className="text-[11px] opacity-80 mt-0.5 font-sans leading-normal">{toast.message}</p>}
                </div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-60 hover:opacity-100 transition-opacity p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
