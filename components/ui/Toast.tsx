import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, X, Info, AlertTriangle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000); // Increased to 4s for better readability

    return () => {
      clearTimeout(timer);
    };
  }, [onDismiss]);

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return { bgColor: 'bg-green-500', Icon: CheckCircle };
      case 'error':
        return { bgColor: 'bg-red-500', Icon: XCircle };
      case 'info':
        return { bgColor: 'bg-blue-500', Icon: Info };
      case 'warning':
        return { bgColor: 'bg-amber-500', Icon: AlertTriangle };
      default:
        return { bgColor: 'bg-gray-800', Icon: Info };
    }
  };

  const { bgColor, Icon } = getToastStyles();

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const toastContent = (
    <div className={`fixed z-[10000] flex items-center p-4 rounded-xl text-white shadow-2xl transition-all animate-in fade-in slide-in-from-top-4 duration-300 ${bgColor} 
      ${isMobile 
        ? 'top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 mx-auto max-w-[calc(100vw-2rem)]' 
        : 'top-3 right-6 max-w-sm'}`}>
      <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
      <span className="text-sm font-bold tracking-tight">{message}</span>
      <button onClick={onDismiss} className="ml-auto -mr-1 p-1.5 rounded-lg hover:bg-white/20 transition-colors focus:outline-none">
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(toastContent, document.body);
};

export default Toast;