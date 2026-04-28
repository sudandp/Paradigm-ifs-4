import React from 'react';
import { MapPin } from 'lucide-react';

const MapSkeleton: React.FC = () => {
  return (
    <div className="w-full h-full bg-[#f8fafc] dark:bg-[#0f172a] relative overflow-hidden flex items-center justify-center animate-in fade-in duration-700">
      {/* Animated Background Landmass */}
      <div className="absolute inset-0 opacity-10 dark:opacity-[0.07] scale-110 animate-pulse-slow">
        <svg 
          viewBox="0 0 1000 500" 
          className="w-full h-full"
          fill="currentColor"
        >
          <path d="M250,150 Q300,100 400,120 T550,200 T700,180 T850,250 T750,400 T500,380 T300,420 T150,300 T250,150" />
          <path d="M600,300 Q650,250 750,280 T800,350 T700,420 T600,380 T600,300" />
        </svg>
      </div>

      {/* Grid Pattern with subtle movement */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] animate-subtle-drift" 
        style={{
          backgroundImage: `radial-gradient(#1e293b 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Centered Pulse for India region (as seen in screenshot) */}
      <div className="absolute top-[45%] left-[55%] -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <div className="absolute inset-0 bg-accent/20 rounded-full animate-ping scale-150" />
          <div className="relative bg-accent/30 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm border border-accent/20">
            <MapPin className="w-6 h-6 text-accent animate-bounce" />
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-card/80 backdrop-blur-md border border-border rounded-full shadow-lg flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium text-muted">Initializing interactive map...</span>
      </div>

      {/* Bottom Right Zoom Placeholder */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <div className="w-10 h-10 bg-card/80 rounded-lg border border-border" />
        <div className="w-10 h-10 bg-card/80 rounded-lg border border-border" />
      </div>
    </div>
  );
};

export default MapSkeleton;
