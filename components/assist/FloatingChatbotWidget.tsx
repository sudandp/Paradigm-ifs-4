import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  MessageSquare, 
  X, 
  Sliders, 
  Sparkles,
  ExternalLink,
  Move,
  Pin
} from 'lucide-react';

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

  // Saved or clamped position (null = docked in default corner)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  // Dynamic footer clearance state (in pixels from bottom)
  // 0 = sits flush down in the bottom-right corner (red box area)
  // > 0 = lifted up by exactly the footer height so it never overlaps
  const [footerLift, setFooterLift] = useState<number>(0);

  // Bot size scale (0.6x to 1.8x, default 1.0x)
  const [botScale, setBotScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('paradigm_bot_scale');
      return saved ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });

  // Customisation popup state (opened via right click or mobile long press)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Greeting speech bubble visibility setting
  const [isGreetingEnabled, setIsGreetingEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('paradigm_bot_greeting_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isGreetingVisible, setIsGreetingVisible] = useState<boolean>(true);

  const widgetRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<{ x: number; y: number } | null>(position);
  const greetingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // =========================================================================
  // DYNAMIC FOOTER SENSING:
  // If footer is NOT in viewport &rarr; default to bottom-right corner (red box)
  // If footer appears into view &rarr; smoothly float above the footer
  // =========================================================================
  useEffect(() => {
    if (position !== null) return; // Only apply when docked in default mode

    const checkFooter = () => {
      const footer = document.querySelector('footer');
      if (!footer) {
        setFooterLift(0);
        return;
      }

      const rect = footer.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const overlap = viewportH - rect.top;

      if (overlap > 0) {
        // Footer is partially or fully visible in viewport!
        // Lift bot cleanly above footer (overlap + 12px), capped to max 115px
        const safeLift = Math.min(overlap + 12, 115);
        setFooterLift(safeLift);
      } else {
        // Footer is not in viewport -> dock cleanly in bottom-right corner
        setFooterLift(0);
      }
    };

    checkFooter();
    // Capture scroll events from any scrolling container (e.g. <main>, window)
    window.addEventListener('scroll', checkFooter, { passive: true, capture: true });
    window.addEventListener('resize', checkFooter, { passive: true });

    // Mutation observer to detect dynamic page loads
    const observer = new MutationObserver(checkFooter);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('scroll', checkFooter, { capture: true });
      window.removeEventListener('resize', checkFooter);
      observer.disconnect();
    };
  }, [position]);

  // Handle scaling change with persistence
  const handleScaleChange = (newScale: number) => {
    const clamped = Math.max(0.6, Math.min(1.8, Math.round(newScale * 100) / 100));
    setBotScale(clamped);
    try {
      localStorage.setItem('paradigm_bot_scale', clamped.toString());
    } catch {}
  };

  // Toggle periodic greeting bubble
  const handleToggleGreeting = () => {
    const nextVal = !isGreetingEnabled;
    setIsGreetingEnabled(nextVal);
    if (!nextVal) setIsGreetingVisible(false);
    try {
      localStorage.setItem('paradigm_bot_greeting_enabled', String(nextVal));
    } catch {}
  };

  // Reset position back to default floating corner (red box area)
  const handleResetPosition = () => {
    setPosition(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };

  // Quick preset docking positions
  const handleDockToPreset = (corner: 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left') => {
    if (corner === 'bottom-right') {
      handleResetPosition();
      return;
    }

    const halfW = (isMobile ? 36 : 44) * botScale;
    const halfH = (isMobile ? 44 : 50) * botScale;
    const baseW = isMobile ? 73.6 : 88;
    const baseH = isMobile ? 89.6 : 100;
    const maxX = Math.max(0, window.innerWidth - 8 - (baseW / 2) - halfW);
    const maxY = Math.max(0, window.innerHeight - 8 - (baseH / 2) - halfH);
    const minX = Math.max(0, 8 + halfW - (baseW / 2));

    let newX = minX;
    let newY = 80;

    switch (corner) {
      case 'top-right':
        newX = maxX;
        newY = 80;
        break;
      case 'bottom-left':
        newX = minX;
        newY = maxY;
        break;
      case 'top-left':
        newX = Math.max(80, minX); // avoid overlapping sidebar toggle
        newY = 80;
        break;
    }

    const pos = { x: newX, y: newY };
    setPosition(pos);
    positionRef.current = pos;
    try {
      localStorage.setItem(storageKey, JSON.stringify(pos));
    } catch {}
  };

  // Periodic greeting message: "Hey! Hi, I'm Paradigm AI"
  useEffect(() => {
    if (isMobile || !isGreetingEnabled) {
      setIsGreetingVisible(false);
      return;
    }

    setIsGreetingVisible(true);
    greetingTimerRef.current = setTimeout(() => {
      setIsGreetingVisible(false);
    }, 7000);

    const interval = setInterval(() => {
      if (!isGreetingEnabled) return;
      setIsGreetingVisible(true);
      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
      greetingTimerRef.current = setTimeout(() => {
        setIsGreetingVisible(false);
      }, 6000);
    }, 28000);

    return () => {
      if (greetingTimerRef.current) clearTimeout(greetingTimerRef.current);
      clearInterval(interval);
    };
  }, [isMobile, isGreetingEnabled]);

  // Click outside listener to dismiss settings
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSettingsOpen(false);
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen]);

  // Keep position clamped within window on resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        const halfW = (isMobile ? 36 : 44) * botScale;
        const halfH = (isMobile ? 44 : 50) * botScale;
        const baseW = isMobile ? 73.6 : 88;
        const baseH = isMobile ? 89.6 : 100;
        const minX = Math.max(0, 8 + halfW - (baseW / 2));
        const maxX = Math.max(minX, window.innerWidth - 8 - (baseW / 2) - halfW);
        const minY = Math.max(0, 8 + halfH - (baseH / 2));
        const maxY = Math.max(minY, window.innerHeight - 8 - (baseH / 2) - halfH);
        const clampedX = Math.max(minX, Math.min(maxX, prev.x));
        const clampedY = Math.max(minY, Math.min(maxY, prev.y));
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, botScale]);

  // Right-click: open Customisation Settings
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSettingsOpen((prev) => !prev);
  };

  // =========================================================================
  // SMOOTH DRAG & DROP ANYWHERE (Window-Level Pointer Tracking)
  // =========================================================================
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only primary mouse button / touch

    const rect = widgetRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const startElemX = rect.left;
    const startElemY = rect.top;
    let hasMoved = false;

    // Mobile long-press to open settings
    longPressTimerRef.current = setTimeout(() => {
      if (!hasMoved) {
        setIsSettingsOpen(true);
      }
    }, 550);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startPointerX;
      const dy = moveEvent.clientY - startPointerY;

      if (!hasMoved) {
        if (Math.hypot(dx, dy) >= 5) {
          hasMoved = true;
          setIsDragging(true);
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
      }

      if (hasMoved) {
        const rawX = startElemX + dx;
        const rawY = startElemY + dy;

        // Visual bounding box accounting for botScale and transformOrigin: center center
        const halfW = (isMobile ? 36 : 44) * botScale;
        const halfH = (isMobile ? 44 : 50) * botScale;
        const baseW = isMobile ? 73.6 : 88;
        const baseH = isMobile ? 89.6 : 100;

        // Ensure 8px minimum margin from visible viewport boundaries so the character is NEVER cut off
        const minX = Math.max(0, 8 + halfW - (baseW / 2));
        const maxX = Math.max(minX, window.innerWidth - 8 - (baseW / 2) - halfW);
        const minY = Math.max(0, 8 + halfH - (baseH / 2));
        const maxY = Math.max(minY, window.innerHeight - 8 - (baseH / 2) - halfH);

        const clampedX = Math.max(minX, Math.min(maxX, rawX));
        const clampedY = Math.max(minY, Math.min(maxY, rawY));

        const nextPos = { x: clampedX, y: clampedY };
        setPosition(nextPos);
        positionRef.current = nextPos;
      }
    };

    const onPointerUp = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      setIsDragging(false);

      if (hasMoved) {
        // Auto-snap flush to corner if dropped within 60px of the bottom-right corner
        const halfW = (isMobile ? 36 : 44) * botScale;
        const halfH = (isMobile ? 44 : 50) * botScale;
        const baseW = isMobile ? 73.6 : 88;
        const baseH = isMobile ? 89.6 : 100;
        const maxX = Math.max(0, window.innerWidth - 8 - (baseW / 2) - halfW);
        const maxY = Math.max(0, window.innerHeight - 8 - (baseH / 2) - halfH);

        const isNearBottomRightCorner = 
          positionRef.current &&
          positionRef.current.x >= maxX - 50 &&
          positionRef.current.y >= maxY - 50;

        if (isNearBottomRightCorner) {
          handleResetPosition();
          return;
        }

        // Persist new dropped location in localStorage
        if (positionRef.current) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(positionRef.current));
          } catch {}
        }
        return;
      }

      // If user merely tapped/clicked without dragging:
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return;
      }

      // Left click &rarr; Navigate to Paradigm Assist
      navigate('/assist');
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
  };

  // Base proportional dimensions for the tightly cropped avatar
  const widgetSize = isMobile
    ? 'w-[4.6rem] h-[5.6rem]'
    : 'w-20 h-25 sm:w-22 sm:h-27';

  const imageSize = isMobile
    ? 'w-[4.4rem] h-[5.4rem]'
    : 'w-19 h-24 sm:w-21 sm:h-26';

  const shadowSize = isMobile
    ? 'w-[3.2rem] h-[6px]'
    : 'w-12 h-2';

  // DEFAULT DOCK POSITION:
  // Dock flush on the right-hand side edge (laptop display edge)
  // If footer is NOT present in viewport &rarr; bottom: ~8px (flush in the red box corner)
  // If footer appears in viewport &rarr; bottom: ${footerLift}px (above footer)
  // Safe margin ensuring the avatar is never clipped by the screen boundary even when scaled up
  const scaleExpansionX = Math.max(0, (botScale - 1) * 44);
  const scaleExpansionY = Math.max(0, (botScale - 1) * 50);

  const defaultBottom = footerLift > 0
    ? `${footerLift + scaleExpansionY}px`
    : (isMobile 
        ? `calc(max(0.25rem, var(--safe-area-inset-bottom, 0px)) + 0.15rem + ${scaleExpansionY}px)` 
        : `calc(0.35rem + ${scaleExpansionY}px)`);

  const defaultRight = isMobile 
    ? `calc(0.25rem + ${scaleExpansionX}px)` 
    : `calc(0.5rem + ${scaleExpansionX}px)`;

  const containerStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
        zIndex: 50,
      }
    : {
        position: 'fixed',
        bottom: defaultBottom,
        right: defaultRight,
        touchAction: 'none',
        zIndex: 50,
        transition: isDragging ? 'none' : 'bottom 0.3s cubic-bezier(0.2, 0, 0, 1)',
      };

  const showSpeechBubble = (isGreetingVisible || isHovered) && !isDragging && !isSettingsOpen && isGreetingEnabled;

  // Adaptive direction: when placed or dragged on the left half of the viewport,
  // flip the speech bubble and settings popover to open towards the right so they are never clipped by the screen edge.
  const isLeftSide = position !== null && position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 400);
  const isTopSide = position !== null && position.y < 220;

  return (
    <div 
      ref={widgetRef}
      aria-label="Paradigm Assist Chatbot Widget" 
      style={containerStyle}
      className={`pointer-events-none no-print select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={handleContextMenu}
    >
      {/* Right-Click Bot Customisation Settings Modal / Popover */}
      {isSettingsOpen && (
        <div 
          className={`absolute ${isTopSide ? 'top-full mt-3' : 'bottom-full mb-3'} ${
            isLeftSide ? 'left-0' : 'right-0'
          } z-50 w-76 p-3.5 rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-white/20 dark:border-emerald-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10 text-white animate-fade-in pointer-events-auto`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-tight leading-none">Paradigm Bot</h3>
                <span className="text-[10px] text-emerald-400 font-medium leading-none">Customisation & Placement</span>
              </div>
            </div>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Size Adjuster Controls (Increase / Decrease Size) */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Bot Size
              </span>
              <span className="text-emerald-400 font-mono text-xs font-bold">
                {Math.round(botScale * 100)}%
              </span>
            </div>

            {/* Stepper + Presets */}
            <div className="flex items-center justify-between gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-white/10">
              <button
                onClick={() => handleScaleChange(botScale - 0.15)}
                className="p-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-slate-200 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={botScale <= 0.6}
                title="Decrease size (-15%)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1">
                {[
                  { label: 'S', scale: 0.75, name: 'Small (75%)' },
                  { label: 'M', scale: 1.0, name: 'Normal (100%)' },
                  { label: 'L', scale: 1.3, name: 'Large (130%)' },
                  { label: 'XL', scale: 1.6, name: 'X-Large (160%)' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleScaleChange(preset.scale)}
                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                      Math.abs(botScale - preset.scale) < 0.1
                        ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/50'
                        : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white'
                    }`}
                    title={preset.name}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleScaleChange(botScale + 0.15)}
                className="p-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-slate-200 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={botScale >= 1.8}
                title="Increase size (+15%)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Dock Presets */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5 text-cyan-400" />
                Dock Placement
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Drag or Click</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleDockToPreset('bottom-right')}
                className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-left text-[11px] font-medium text-slate-300 hover:text-white border border-white/5 transition-all flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Bottom Right (Red Box)
              </button>
              <button
                onClick={() => handleDockToPreset('top-right')}
                className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-left text-[11px] font-medium text-slate-300 hover:text-white border border-white/5 transition-all flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Top Right
              </button>
              <button
                onClick={() => handleDockToPreset('bottom-left')}
                className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-left text-[11px] font-medium text-slate-300 hover:text-white border border-white/5 transition-all flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Bottom Left
              </button>
              <button
                onClick={() => handleDockToPreset('top-left')}
                className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-left text-[11px] font-medium text-slate-300 hover:text-white border border-white/5 transition-all flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Top Left
              </button>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="space-y-1.5 pt-1 border-t border-white/10">
            {/* Open Assist */}
            <button
              onClick={() => {
                setIsSettingsOpen(false);
                navigate('/assist');
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-semibold transition-all"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Open Paradigm Assist (Left-Click)
              </span>
              <ExternalLink className="w-3 h-3 text-emerald-400" />
            </button>

            {/* Toggle Greeting Bubble */}
            <button
              onClick={handleToggleGreeting}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-white/5 text-slate-300 hover:text-white text-xs font-medium transition-all"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                Greeting Speech Bubble
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isGreetingEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                {isGreetingEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Reset Position (if moved) */}
            {position && (
              <button
                onClick={handleResetPosition}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-white/5 text-slate-300 hover:text-white text-xs font-medium transition-all"
              >
                <span className="flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  Reset to Bottom-Right Corner
                </span>
                <span className="text-[10px] text-slate-400">Reset</span>
              </button>
            )}
          </div>

          {/* Pointer tail */}
          <div className="absolute -bottom-1.5 right-8 w-3 h-3 bg-slate-900/95 dark:bg-slate-950/95 border-r border-b border-white/20 dark:border-emerald-500/30 rotate-45 transform" />
        </div>
      )}

      {/* Main Bot Scalable Container (Free Drag & Drop Anywhere) */}
      <div
        role="button"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        style={{
          transform: `scale(${botScale})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)'
        }}
        className={`group relative flex flex-col items-center justify-end ${widgetSize} cursor-grab active:cursor-grabbing outline-none focus:outline-none pointer-events-auto select-none ${
          isDragging ? 'scale-105 opacity-90' : 'active:scale-95'
        }`}
        aria-label="Paradigm AI: Left-click to open Assist, right-click for settings, drag anywhere on screen"
      >
        {/* Ambient Back Glow (Smooth 3D Aura on hover) */}
        <div 
          className={`absolute top-1 ${isMobile ? 'w-14 h-11' : 'w-16 h-13'} rounded-full bg-cyan-400/20 blur-xl transition-all duration-300 pointer-events-none opacity-0 group-hover:opacity-100`} 
        />

        {/* Drag Hint indicator on hover */}
        <div className="absolute -top-2 right-1 opacity-0 group-hover:opacity-80 transition-opacity pointer-events-none p-0.5 rounded-md bg-slate-900/80 border border-white/20 text-white">
          <Move className="w-2.5 h-2.5" />
        </div>

        {/* 3D Animated Floating & Waving Avatar + Floating Speech Bubble */}
        <div 
          className="relative flex flex-col items-center transition-all duration-300 ease-out opacity-100 scale-100 animate-float-bot group-hover:[animation-play-state:paused]"
        >
          {/* Floating Waving Greeting Speech Bubble */}
          {showSpeechBubble && (
            <div 
              className={`absolute ${isTopSide ? 'top-full mt-2.5' : 'bottom-full mb-2.5'} z-30 pointer-events-none transition-all duration-300 animate-fade-in`}
              style={{
                filter: 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.25))',
                left: isLeftSide ? 'calc(50% - 24px)' : undefined,
                right: !isLeftSide ? 'calc(50% - 24px)' : undefined,
              }}
            >
              <div className="relative px-3.5 py-2 rounded-2xl bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-xl border border-white/20 dark:border-emerald-500/30 shadow-[0_12px_36px_rgba(0,0,0,0.35)] ring-1 ring-white/10 flex items-center whitespace-nowrap overflow-visible before:absolute before:inset-0 before:rounded-2xl before:border-t before:border-white/30 before:pointer-events-none">
                <div className={`relative z-10 flex flex-col ${isLeftSide ? 'text-left' : 'text-right'}`}>
                  <span className="text-[11px] font-extrabold tracking-tight text-white leading-tight drop-shadow-sm">
                    Hey! Hi, I'm Paradigm AI
                  </span>
                  <span className="text-[9px] font-semibold text-emerald-400 leading-tight mt-0.5 drop-shadow-sm">
                    Right-click me for settings
                  </span>
                </div>
                {/* Triangular speech bubble tail pointing directly down into the avatar's head */}
                <div 
                  className={`absolute ${
                    isTopSide 
                      ? '-top-1.5 border-l border-t'
                      : '-bottom-1.5 border-r border-b'
                  } w-3 h-3 bg-slate-900/90 dark:bg-slate-950/95 border-white/20 dark:border-emerald-500/30 rotate-45 transform`} 
                  style={{
                    left: isLeftSide ? '18px' : undefined,
                    right: !isLeftSide ? '18px' : undefined,
                  }}
                />
              </div>
            </div>
          )}

          {/* Standalone Cutout Waving Robot / Avatar Graphic */}
          <img
            src="/assist/companion_waving_hd.webp?v=paradigm-avatar-v5"
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
