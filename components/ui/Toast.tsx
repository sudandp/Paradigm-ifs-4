import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, X, Info, AlertTriangle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);

    return () => {
      clearTimeout(timer);
    };
  }, [onDismiss]);

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return {
          bgColor: 'bg-emerald-600 text-white shadow-emerald-900/20 border-emerald-500/30',
          Icon: CheckCircle2
        };
      case 'error':
        return {
          bgColor: 'bg-rose-600 text-white shadow-rose-900/20 border-rose-500/30',
          Icon: XCircle
        };
      case 'info':
        return {
          bgColor: 'bg-sky-600 text-white shadow-sky-900/20 border-sky-500/30',
          Icon: Info
        };
      case 'warning':
        return {
          bgColor: 'bg-amber-600 text-white shadow-amber-900/20 border-amber-500/30',
          Icon: AlertTriangle
        };
      default:
        return {
          bgColor: 'bg-slate-800 text-white shadow-black/20 border-slate-700',
          Icon: Info
        };
    }
  };

  const { bgColor, Icon } = getToastStyles();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const toastContent = (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed z-[10000] inline-flex items-center gap-2.5 py-2 px-3.5 md:py-2.5 md:px-4 rounded-xl shadow-lg border backdrop-blur-xs transition-all animate-in fade-in slide-in-from-top-3 duration-200 ${bgColor} 
      ${isMobile 
        ? 'top-[calc(0.75rem+env(safe-area-inset-top))] left-3 right-3 max-w-[calc(100vw-1.5rem)] justify-between' 
        : 'top-4 right-6 max-w-2xl'}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="text-xs md:text-sm font-medium tracking-tight whitespace-nowrap truncate select-none">
        {message}
      </span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="ml-2 -mr-1 p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors focus:outline-none flex-shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(toastContent, document.body);
};

export default Toast;