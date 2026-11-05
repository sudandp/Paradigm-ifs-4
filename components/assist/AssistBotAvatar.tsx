import React from 'react';

interface AssistBotAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isThinking?: boolean;
  isOnline?: boolean;
  className?: string;
  enableFloating?: boolean;
}

export const AssistBotAvatar: React.FC<AssistBotAvatarProps> = ({
  size = 'md',
  isThinking = false,
  isOnline = true,
  className = '',
  enableFloating = true,
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  const padClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
    xl: 'p-3.5'
  };

  const statusDotSizes = {
    sm: 'w-2 h-2 -bottom-0.5 -right-0.5 ring-1.5',
    md: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5 ring-2',
    lg: 'w-3.5 h-3.5 bottom-0 right-0 ring-2',
    xl: 'w-4 h-4 bottom-0.5 right-0.5 ring-3'
  };

  return (
    <div className={`relative inline-flex flex-col items-center justify-center flex-shrink-0 group select-none ${className}`}>
      {/* Floating dynamic ground shadow */}
      {enableFloating && (
        <span 
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-1 rounded-full bg-emerald-500/25 blur-[2px] pointer-events-none transition-all duration-300"
          style={{ animation: 'paradigmAvatarShadow 3.2s ease-in-out infinite' }}
        />
      )}

      {/* Floating Capsule / Pod */}
      <div 
        className={`relative inline-flex items-center justify-center rounded-full ${sizeClasses[size]} ${
          enableFloating ? 'transform-gpu' : ''
        }`}
        style={enableFloating ? { animation: 'paradigmAvatarFloat 3.2s ease-in-out infinite' } : undefined}
      >
        {/* Outer orbital aura / thinking energy ring */}
        {isThinking ? (
          <>
            <span className="absolute -inset-1 rounded-full border border-dashed border-cyan-400/80 animate-spin [animation-duration:3.5s] pointer-events-none" />
            <span className="absolute -inset-0.5 rounded-full bg-cyan-400/20 blur-xs animate-pulse pointer-events-none" />
          </>
        ) : (
          /* Soft ambient emerald idle/hover aura */
          <span className="absolute -inset-0.5 rounded-full bg-emerald-500/20 blur-[3px] opacity-70 group-hover:opacity-100 group-hover:blur-[5px] transition-all duration-500 pointer-events-none" />
        )}

        {/* Glassmorphic Circular Floating Badge */}
        <div
          className={`w-full h-full rounded-full overflow-hidden border transition-all duration-300 ${padClasses[size]} ${
            isThinking
              ? 'border-cyan-400/80 bg-gradient-to-b from-[#162a32] via-[#0e1d24] to-[#071015] shadow-[0_0_15px_rgba(6,182,212,0.4)]'
              : 'border-emerald-500/40 bg-gradient-to-b from-[#262c28] via-[#161a18] to-[#0d100f] shadow-[0_4px_14px_rgba(16,185,129,0.28)] group-hover:border-emerald-400/80 group-hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)]'
          } flex items-center justify-center backdrop-blur-md`}
        >
          {/* Glass Specular Reflection Highlight */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/15 via-transparent to-transparent pointer-events-none" />

          {/* Paradigm Official Logo Emblem */}
          <img
            src="/favicon.png"
            alt="Paradigm Assist"
            className="w-full h-full object-contain filter drop-shadow-[0_2px_6px_rgba(16,185,129,0.45)] transform-gpu transition-transform duration-300 group-hover:scale-110 pointer-events-none select-none"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/logo-simple.png';
            }}
          />
        </div>

        {/* Live Status Badge */}
        {isOnline && (
          <span
            className={`absolute rounded-full ring-[#171717] z-10 transition-colors ${statusDotSizes[size]} ${
              isThinking 
                ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]' 
                : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
            }`}
            title="Paradigm Assist Online"
          />
        )}
      </div>

      {/* Floating animation keyframes embedded directly */}
      <style>{`
        @keyframes paradigmAvatarFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        @keyframes paradigmAvatarShadow {
          0%, 100% {
            transform: translateX(-50%) scale(1);
            opacity: 0.45;
          }
          50% {
            transform: translateX(-50%) scale(0.72);
            opacity: 0.18;
          }
        }
      `}</style>
    </div>
  );
};

export default AssistBotAvatar;
