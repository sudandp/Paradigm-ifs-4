import React, { useState } from 'react';

interface AssistBotAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isThinking?: boolean;
  isOnline?: boolean;
  className?: string;
}

export const AssistBotAvatar: React.FC<AssistBotAvatarProps> = ({
  size = 'md',
  isThinking = false,
  isOnline = true,
  className = ''
}) => {
  const [videoError, setVideoError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const statusDotSizes = {
    sm: 'w-2 h-2 ring-1',
    md: 'w-2.5 h-2.5 ring-2',
    lg: 'w-3.5 h-3.5 ring-2',
    xl: 'w-4 h-4 ring-3'
  };

  return (
    <div className={`relative inline-flex items-center justify-center flex-shrink-0 ${sizeClasses[size]} ${className}`}>
      {/* Outer energetic glow ring when thinking */}
      {isThinking && (
        <span className="absolute inset-0 rounded-full animate-ping bg-cyan-500/40 opacity-75" />
      )}

      {/* Main Circular Container */}
      <div className={`w-full h-full rounded-full overflow-hidden shadow-lg border-2 transition-all duration-300 ${
        isThinking 
          ? 'border-cyan-400 ring-4 ring-cyan-500/30 shadow-cyan-500/50' 
          : 'border-emerald-500/60 shadow-emerald-500/20'
      } bg-slate-900 flex items-center justify-center`}>
        {!videoError ? (
          <video
            src="/assist/assist_bot.mp4"
            poster="/assist/assist_bot.png"
            autoPlay
            loop
            muted
            playsInline
            onError={() => setVideoError(true)}
            className="w-full h-full object-cover scale-110 pointer-events-none select-none"
          />
        ) : (
          <img
            src="/assist/assist_bot.png"
            alt="Paradigm Assist Bot"
            className="w-full h-full object-cover select-none"
          />
        )}
      </div>

      {/* Online / Active Status Badge */}
      {isOnline && (
        <span
          className={`absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-slate-900 ${statusDotSizes[size]} ${
            isThinking ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-500'
          }`}
          title="Paradigm Assist Ready"
        />
      )}
    </div>
  );
};

export default AssistBotAvatar;
