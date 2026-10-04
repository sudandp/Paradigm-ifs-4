import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Sparkles, 
  Compass, 
  Check, 
  Info,
  MapPin,
  Coffee,
  Bell,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { useTutorialStore, TutorialStep } from '../../store/tutorialStore';

export const SpotlightTutorialOverlay: React.FC = () => {
  const { 
    isActive, 
    currentStepIndex, 
    steps, 
    activeRole, 
    nextStep, 
    prevStep, 
    skipTutorial 
  } = useTutorialStore();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const step: TutorialStep | undefined = steps[currentStepIndex];

  // Update target rect whenever step changes or window resizes
  const updateRect = useCallback(() => {
    if (!step) return;
    let el = document.getElementById(step.targetId);
    if (!el && step.targetId === 'tour-notification-bell') {
      el = document.getElementById('tour-notification-bell-desktop');
    }
    // Also if el has 0 dimensions, try desktop counterpart
    if (el && el.getBoundingClientRect().width === 0 && step.targetId === 'tour-notification-bell') {
      const desktopEl = document.getElementById('tour-notification-bell-desktop');
      if (desktopEl && desktopEl.getBoundingClientRect().width > 0) {
        el = desktopEl;
      }
    }

    if (el) {
      // Smoothly scroll target into visible window if not in viewport
      const rect = el.getBoundingClientRect();
      const inView = (
        rect.top >= 70 &&
        rect.bottom <= window.innerHeight - 70
      );
      if (!inView) {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {
          el.scrollIntoView();
        }
        // Poll bounding rect as smooth scrolling executes
        setTimeout(() => { if (el) setTargetRect(el.getBoundingClientRect()); }, 150);
        setTimeout(() => { if (el) setTargetRect(el.getBoundingClientRect()); }, 400);
        setTimeout(() => { if (el) setTargetRect(el.getBoundingClientRect()); }, 750);
      } else {
        setTargetRect(rect);
      }
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!isActive) return;
    updateRect();

    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      updateRect();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isActive, currentStepIndex, updateRect]);

  if (!isActive || !step) return null;

  // Calculate card positioning based on target rect
  const padding = 10;
  
  // Decide if card should be above or below the target
  const targetCenterY = targetRect ? targetRect.top + targetRect.height / 2 : windowSize.height / 2;
  const placeAbove = targetCenterY > windowSize.height / 2;

  // Clamp card top so it is ALWAYS safely visible on any mobile screen
  const cardTop = targetRect 
    ? (placeAbove 
        ? Math.max(70, Math.min(windowSize.height - 320, targetRect.top - 240)) 
        : Math.min(windowSize.height - 290, Math.max(70, targetRect.bottom + 15)))
    : Math.max(70, windowSize.height / 2 - 130);

  const roleName = activeRole === 'field_officer' 
    ? 'Field Officer Tour' 
    : activeRole === 'manager' 
      ? 'Manager Tour' 
      : 'Site Staff Tour';

  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[10000] overflow-hidden pointer-events-auto animate-fade-in select-none">
      {/* ── Dark Translucent Backdrop with Spotlight Hole ── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="spotlight-mask">
            {/* White background: blocks everything */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cut-out: transparent hole over target button */}
            {targetRect && targetRect.top >= -50 && targetRect.top <= windowSize.height + 50 && (
              <rect
                x={Math.max(4, targetRect.left - padding)}
                y={Math.max(4, targetRect.top - padding)}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx={targetRect.width > 120 ? Math.min(28, (targetRect.height + padding * 2) / 2) : 20}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(4, 27, 15, 0.88)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* ── Glowing Animated Spotlight Ring around Target ── */}
      {targetRect && targetRect.top >= -50 && targetRect.top <= windowSize.height + 50 && (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out z-[10001]"
          style={{
            left: Math.max(4, targetRect.left - padding),
            top: Math.max(4, targetRect.top - padding),
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            borderRadius: targetRect.width > 120 ? Math.min(28, (targetRect.height + padding * 2) / 2) : 20
          }}
        >
          {/* Pulsing Emerald Outline */}
          <div className="absolute inset-0 rounded-[inherit] border-2 border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.6)] animate-pulse" />
          <div className="absolute -inset-1 rounded-[inherit] border border-emerald-300/30 blur-xs" />
        </div>
      )}

      {/* ── Floating Coach-Mark Tooltip Card ── */}
      <div 
        className="fixed z-[10002] w-[92%] sm:w-[420px] max-w-md transition-all duration-300 ease-out left-1/2 -translate-x-1/2 px-2"
        style={{ top: cardTop }}
      >
        <div className="bg-[#0A3D2E] text-white rounded-3xl border border-emerald-500/40 shadow-2xl p-5 sm:p-6 backdrop-blur-xl relative overflow-hidden ring-1 ring-white/10">
          {/* Subtle Ambient Background Light */}
          <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">
                <Compass className="w-4 h-4 animate-spin-slow" />
              </span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 block">
                  {roleName}
                </span>
                <span className="text-xs font-semibold text-emerald-100/70">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
              </div>
            </div>

            <button
              onClick={skipTutorial}
              className="py-1 px-2.5 rounded-lg text-xs font-medium text-emerald-300/70 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
            >
              <span>Skip Tour</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="py-4 space-y-2.5">
            <h4 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{step.title}</span>
            </h4>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              {step.description}
            </p>

            {step.actionTip && (
              <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-2.5 mt-2 flex items-start gap-2 text-xs text-emerald-200">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{step.actionTip}</span>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
            {/* Step Indicators (Dots) */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStepIndex 
                      ? 'w-6 bg-emerald-400' 
                      : idx < currentStepIndex 
                        ? 'w-2 bg-emerald-600' 
                        : 'w-2 bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <button
                  onClick={prevStep}
                  className="py-2 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center gap-1 active:scale-95 transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}

              <button
                onClick={nextStep}
                className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#041a13] font-black text-xs flex items-center gap-1.5 active:scale-95 shadow-md shadow-emerald-900/30 transition-all"
              >
                <span>{isLastStep ? 'Get Started' : 'Next'}</span>
                {isLastStep ? <Check className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpotlightTutorialOverlay;
