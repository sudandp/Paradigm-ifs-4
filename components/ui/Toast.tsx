
import React, { useEffect } from 'react';
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
    }, 2000);

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

  return (
    <div className={`fixed z-[9999] flex items-center p-4 rounded-xl text-white shadow-2xl transition-all animate-in fade-in slide-in-from-top-4 duration-300 ${bgColor} 
      ${isMobile 
        ? 'top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 mx-auto max-w-[calc(100vw-2rem)]' 
        : 'top-6 right-6 max-w-sm'}`}>
      <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
      <span className="text-sm font-bold tracking-tight">{message}</span>
      <button onClick={onDismiss} className="ml-auto -mr-1 p-1.5 rounded-lg hover:bg-white/20 transition-colors focus:outline-none">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default Toast;