import React, { useEffect, useState } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { offlineDb } from '../services/offline/database';
import { WifiOff, RefreshCcw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const OfflineStatusBanner: React.FC = () => {
  const { isOnline } = useNetworkStatus();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      offlineDb.getSyncTime().then(time => {
        setLastSync(time);
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
    }
  }, [isOnline]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] animate-in fade-in slide-in-from-top duration-300">
      <div className="bg-amber-500 text-white px-4 py-2 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff className="w-5 h-5" />
          <div className="flex flex-col">
            <span className="font-bold text-sm">Working Offline</span>
            {lastSync && (
              <span className="text-xs opacity-90">
                Last synced: {format(new Date(lastSync), 'MMM d, h:mm a')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-100" />
            <button 
                onClick={() => setIsVisible(false)}
                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
            >
                Dismiss
            </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineStatusBanner;
