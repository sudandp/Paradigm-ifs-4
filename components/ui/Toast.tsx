
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
    }, 5000);

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

  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center p-4 rounded-lg text-white shadow-lg ${bgColor}`}>
      <Icon className="h-6 w-6 mr-3" />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-4 -mr-2 p-1.5 rounded-md hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

export default Toast;