import React from 'react';
import { WifiOff } from 'lucide-react';

interface OfflineBannerProps {
  isMobileView?: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isMobileView }) => {
  return (
    <div className={`bg-gradient-to-r from-amber-600 to-amber-500 text-white text-center py-2 px-4 text-[11px] md:text-xs font-bold flex items-center justify-center gap-2 select-none z-[100] shadow-sm relative shrink-0 ${isMobileView ? 'pt-[calc(env(safe-area-inset-top)+0.5rem)]' : ''}`}>
      <WifiOff className="w-3.5 h-3.5 animate-pulse text-amber-100 shrink-0" />
      <span>Working Offline. Changes will be synced when you go back online.</span>
    </div>
  );
};

export default OfflineBanner;
