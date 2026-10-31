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
  const storageKey = isMobile ? 'paradigm_bot_corner_mobile' : 'paradigm_bot_corner_desktop';

  // Saved or clamped position (default null to stick flush in the bottom-right corner)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      // Clear legacy position from previous centered layout so bot docks cleanly in corner
      localStorage.removeItem('paradigm_bot_pos_desktop');
      localStorage.removeItem('paradigm_bot_corner_desktop');
      localStorage.removeItem('paradigm_bot_corner_mobile');
    } catch {}
    return null;
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isGreetingVisible, setIsGreetingVisible] = useState<boolean>(true);

  const widgetRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<{ x: number; y: number } | null>(position);
  const greetingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Periodic waving greeting message: "Hey! Hi, I'm Paradigm AI"
  // Shows for 7 seconds on mount, and reappears periodically every 25 seconds
  useEffect(() => {
    // On mobile devices, do not trigger auto-repeating popup speech bubbles that block content
    if (isMobile) {
      setIsGreetingVisible(false);
      return;
    }

    setIsGreetingVisible(true);
    greetingTimerRef.current = setTimeout(() => {
      setIsGreetingVisible(false);
    }, 7000);

    const interval = setInterval(() => {
      setIsGreetingVisible(true);
      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
      greetingTimerRef.current = setTimeout(() => {
        setIsGreetingVisible(false);
      }, 6000);
    }, 25000);

    return () => {
      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
      clearInterval(interval);
    };
  }, [isMobile]);

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
        const widgetWidth = isMobile ? 84 : 96;
        const widgetHeight = isMobile ? 76 : 88;
        const clampedX = Math.max(4, Math.min(window.innerWidth - widgetWidth - 4, prev.x));
        const clampedY = Math.max(4, Math.min(window.innerHeight - widgetHeight - 4, prev.y));
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

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
      }
    }

    if (dragStartRef.current.hasMoved) {
      const widgetWidth = isMobile ? 84 : 96;
      const widgetHeight = isMobile ? 76 : 88;

      const rawX = dragStartRef.current.elemX + dx;
      const rawY = dragStartRef.current.elemY + dy;

      const clampedX = Math.max(4, Math.min(window.innerWidth - widgetWidth - 4, rawX));
      const clampedY = Math.max(4, Math.min(window.innerHeight - widgetHeight - 4, rawY));

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
      // User dropped the bot in a custom position: persist location
      if (positionRef.current) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(positionRef.current));
        } catch {}
      }
      return;
    }

    // Otherwise, stationary tap/click: open Paradigm Assist
    navigate('/assist');
  };

  // Compact dimensions so it fits cleanly in the right corner gutter without covering table buttons
  const widgetSize = isMobile
    ? 'w-[5.4rem] h-[4.6rem]'
    : 'w-22 h-19 sm:w-24 sm:h-21';

  const imageSize = isMobile
    ? 'w-[4.6rem] h-[3.8rem]'
    : 'w-20 h-17 sm:w-22 sm:h-19';

  const shadowSize = isMobile
    ? 'w-[3rem] h-[7px]'
    : 'w-12 h-2';

  // Corner positioning: flush in the bottom-right corner as shown in red box
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
    ? 'fixed bottom-[calc(max(5.5rem,var(--safe-area-inset-bottom,0px))+0.5rem)] right-2 z-40'
    : 'fixed bottom-3 sm:bottom-4 right-3 sm:right-4 z-50';

  const showSpeechBubble = (isGreetingVisible || isHovered) && !isDragging;

  return (
    <div 
      ref={widgetRef}
      aria-label="Paradigm Assist Chatbot Widget" 
      style={containerStyle}
      className={`${position ? '' : defaultClasses} !bg-transparent no-print select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
          isDragging ? 'scale-105 opacity-95' : 'active:scale-95'
        }`}
        aria-label="Paradigm AI: Click to open Assist, drag to move"
      >
        {/* Ambient Back Glow (Smooth 3D Aura on hover) */}
        <div 
          className={`absolute top-1 ${isMobile ? 'w-14 h-11' : 'w-16 h-13'} rounded-full bg-cyan-400/20 blur-xl transition-all duration-300 pointer-events-none opacity-0 group-hover:opacity-100`} 
        />

        {/* 3D Animated Floating & Waving Robot Asset + Floating Speech Bubble (Moving together in sync) */}
        <div 
          className="relative flex flex-col items-center transition-all duration-300 ease-out opacity-100 scale-100 animate-float-bot group-hover:[animation-play-state:paused]"
        >
          {/* Floating Waving Greeting Speech Bubble: Text on the right side, floating in sync with the bot */}
          {showSpeechBubble && (
            <div 
              className="absolute bottom-full mb-2.5 right-0 z-30 pointer-events-none transition-all duration-300 animate-fade-in"
              style={{ filter: 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.25))' }}
            >
              <div className="relative px-4 py-2.5 rounded-2xl bg-slate-900/75 dark:bg-slate-950/80 backdrop-blur-xl border border-white/20 dark:border-emerald-500/30 shadow-[0_12px_36px_rgba(0,0,0,0.35)] ring-1 ring-white/10 flex items-center whitespace-nowrap overflow-visible before:absolute before:inset-0 before:rounded-2xl before:border-t before:border-white/30 before:pointer-events-none">
                {/* Text aligned to the right side */}
                <div className="relative z-10 flex flex-col text-right">
                  <span className="text-[11px] font-extrabold tracking-tight text-white leading-tight drop-shadow-sm">
                    Hey! Hi, I'm Paradigm AI
                  </span>
                  <span className="text-[9px] font-semibold text-emerald-400 leading-tight mt-0.5 drop-shadow-sm">
                    How can I help you today?
                  </span>
                </div>

                {/* Triangular speech bubble tail pointing directly down to the robot */}
                <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-slate-900/75 dark:bg-slate-950/80 backdrop-blur-xl border-r border-b border-white/20 dark:border-emerald-500/30 rotate-45 transform" />
              </div>
            </div>
          )}

          {/* Standalone Cutout Waving Robot Graphic */}
          <img
            src="/assist/companion_waving_hd.webp?v=hd-both-hands-v1"
            alt="Paradigm Assist Virtual Companion"
            className={`${imageSize} object-contain pointer-events-none select-none transition-all duration-300 drop-shadow-md group-hover:scale-105`}
            draggable={false}
          />
        </div>

        {/* Dynamic 3D Ground Shadow */}
        <div 
          className={`${shadowSize} mt-0.5 rounded-full bg-slate-950/30 blur-[2px] pointer-events-none transition-all duration-300 animate-shadow-breathe group-hover:[animation-play-state:paused] group-hover:w-14`} 
        />
      </div>
    </div>
  );
};

export default FloatingChatbotWidget;
