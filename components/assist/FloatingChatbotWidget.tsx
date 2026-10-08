import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface FloatingChatbotWidgetProps {
  className?: string;
  isMobile?: boolean;
}

export const FloatingChatbotWidget: React.FC<FloatingChatbotWidgetProps> = ({
  className = '',
  isMobile = false
}) => {
  const navigate = useNavigate();
  const storageKey = isMobile ? 'paradigm_bot_pos_mobile' : 'paradigm_bot_pos_desktop';

  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isHidden, setIsHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('paradigm_assist_bot_hidden') === 'true';
    } catch {
      return false;
    }
  });

  const [showHint, setShowHint] = useState<boolean>(false);
  const lastTapTimeRef = useRef<number>(0);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<{ x: number; y: number } | null>(position);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Drag tracking ref
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    elemX: number;
    elemY: number;
    hasMoved: boolean;
  } | null>(null);

  // Clamp position within viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        const widgetWidth = isMobile ? 98 : 112;
        const widgetHeight = isMobile ? 88 : 96;
        const clampedX = Math.max(8, Math.min(window.innerWidth - widgetWidth - 8, prev.x));
        const clampedY = Math.max(8, Math.min(window.innerHeight - widgetHeight - 8, prev.y));
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only primary button/touch

    const rect = widgetRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      elemX: rect.left,
      elemY: rect.top,
      hasMoved: false,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;

    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;

    if (!dragStartRef.current.hasMoved) {
      if (Math.hypot(dx, dy) >= 6) {
        dragStartRef.current.hasMoved = true;
        setIsDragging(true);
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
      }
    }

    if (dragStartRef.current.hasMoved) {
      const widgetWidth = isMobile ? 98 : 112;
      const widgetHeight = isMobile ? 88 : 96;

      const rawX = dragStartRef.current.elemX + dx;
      const rawY = dragStartRef.current.elemY + dy;

      const clampedX = Math.max(8, Math.min(window.innerWidth - widgetWidth - 8, rawX));
      const clampedY = Math.max(8, Math.min(window.innerHeight - widgetHeight - 8, rawY));

      const nextPos = { x: clampedX, y: clampedY };
      setPosition(nextPos);
      positionRef.current = nextPos;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;

    const hadMoved = dragStartRef.current.hasMoved;
    dragStartRef.current = null;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (hadMoved) {
      // User dropped the bot in a new place! Persist location
      if (positionRef.current) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(positionRef.current));
        } catch {}
      }
      return;
    }

    // Otherwise, stationary tap/click
    handleTap();
  };

  const handleTap = () => {
    const now = Date.now();
    const elapsed = now - lastTapTimeRef.current;

    if (elapsed > 0 && elapsed < 350) {
      // Double tap detected!
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapTimeRef.current = 0;

      setIsHidden((prev) => {
        const nextState = !prev;
        try {
          localStorage.setItem('paradigm_assist_bot_hidden', String(nextState));
        } catch {}
        return nextState;
      });
      setShowHint(false);
    } else {
      // First tap
      lastTapTimeRef.current = now;

      if (!isHidden) {
        singleTapTimerRef.current = setTimeout(() => {
          navigate('/assist');
        }, 300);
      } else {
        setShowHint(true);
        if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
        hintTimerRef.current = setTimeout(() => setShowHint(false), 1800);
      }
    }
  };

  const widgetSize = isMobile
    ? 'w-[6.2rem] h-[5.4rem]'
    : 'w-26 h-22 sm:w-28 sm:h-24';

  const imageSize = isMobile
    ? 'w-[5.5rem] h-[4.4rem]'
    : 'w-24 h-19 sm:w-26 sm:h-21';

  const shadowSize = isMobile
    ? 'w-[3.6rem] h-[9px]'
    : 'w-14 h-2.5';

  // If user dropped it at custom coordinates, use fixed top/left; otherwise use default anchor
  const containerStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
        zIndex: 50,
      }
    : {
        touchAction: 'none',
      };

  const defaultClasses = isMobile
    ? 'fixed bottom-[5.25rem] right-3 z-40'
    : 'fixed bottom-5 sm:bottom-6 right-16 sm:right-20 z-50';

  return (
    <div 
      ref={widgetRef}
      aria-label="Paradigm Assist Chatbot Widget" 
      style={containerStyle}
      className={`${position ? '' : defaultClasses} !bg-transparent no-print select-none ${className}`}
    >
      <div
        role="button"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          dragStartRef.current = null;
          setIsDragging(false);
        }}
        className={`group relative flex flex-col items-center justify-end ${widgetSize} cursor-grab active:cursor-grabbing outline-none focus:outline-none transition-transform ${
          isDragging ? 'scale-105 opacity-90' : 'active:scale-90'
        }`}
        aria-label={isHidden ? "Double tap to show Paradigm Assist" : "Drag to move, single tap to open, double tap to hide"}
      >
        {/* Subtle hint when single-tapping the hidden hotspot */}
        {isHidden && showHint && (
          <div className="absolute bottom-full mb-2 right-1/2 translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-900/95 border border-emerald-500/50 text-[10px] text-emerald-300 font-medium whitespace-nowrap shadow-xl pointer-events-none animate-bounce">
            Double-tap to show bot
          </div>
        )}

        {/* Ambient Back Glow (Smooth 3D Aura on hover) */}
        <div 
          className={`absolute top-1 ${isMobile ? 'w-16 h-13' : 'w-16 h-14'} rounded-full bg-cyan-400/20 blur-xl transition-all duration-300 pointer-events-none ${
            isHidden ? 'opacity-0 scale-0' : 'opacity-0 group-hover:opacity-100'
          }`} 
        />

        {/* 3D Animated Floating Robot Asset */}
        <div 
          className={`relative flex flex-col items-center transition-all duration-300 ease-out ${
            isHidden 
              ? 'opacity-0 scale-0 pointer-events-none' 
              : 'opacity-100 scale-100 animate-float-bot group-hover:[animation-play-state:paused]'
          }`}
        >
          {/* Standalone Cutout Robot Graphic */}
          <img
            src="/assist/companion_waving_hd.webp?v=hd-both-hands-v1"
            alt="Paradigm Assist Virtual Companion"
            className={`${imageSize} object-contain pointer-events-none select-none transition-all duration-300 drop-shadow-md`}
            draggable={false}
          />
        </div>

        {/* Dynamic 3D Ground Shadow */}
        <div 
          className={`${shadowSize} mt-0.5 rounded-full bg-slate-950/30 blur-[2px] pointer-events-none transition-all duration-300 ${
            isHidden ? 'opacity-0 scale-0' : 'animate-shadow-breathe group-hover:[animation-play-state:paused] group-hover:w-16'
          }`} 
        />
      </div>
    </div>
  );
};

export default FloatingChatbotWidget;
