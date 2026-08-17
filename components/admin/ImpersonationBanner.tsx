/**
 * ImpersonationBanner
 *
 * A prominent, persistent amber banner shown at the top of every page while an
 * admin is viewing the app as another user.  It shows:
 *   - The target user's name
 *   - The admin's name
 *   - An "Exit Impersonation" button to immediately restore the admin session
 *
 * Must be rendered inside App.tsx (outside of <Routes>) so it appears on every page.
 */

import React, { useEffect, useState } from 'react';
import { useImpersonationStore } from '../../store/impersonationStore';
import { useAuthStore } from '../../store/authStore';
import { AlertTriangle, LogOut, Loader2 } from 'lucide-react';

const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, impersonator, stopImpersonation } = useImpersonationStore();
  const user = useAuthStore(s => s.user);
  const [isExiting, setIsExiting] = useState(false);

  // ── IDLE INACTIVITY TIMEOUT ──────────────────────────────────────────────
  // If the admin remains idle (no mouse movement, click, scroll, touch, or keypress)
  // for 5 minutes (300,000ms) while viewing as another user:
  // 1. Auto-exit impersonation (view section closes).
  // 2. Revert back to admin profile.
  // 3. Navigate to admin profile / user management page.
  useEffect(() => {
    if (!isImpersonating) return;

    const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes (300,000 ms)
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(async () => {
        console.warn('[Impersonation] Idle timeout reached (5 minutes inactivity). Closing view section and returning to admin profile.');
        await stopImpersonation(true);
      }, IDLE_TIMEOUT_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));

    resetIdleTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      events.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
    };
  }, [isImpersonating, stopImpersonation]);

  if (!isImpersonating || !impersonator || !user) return null;

  const handleExit = async () => {
    setIsExiting(true);
    try {
      await stopImpersonation(true);
    } finally {
      setIsExiting(false);
    }
  };

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 h-10 z-[9999] flex items-center justify-between gap-3 px-4 bg-amber-500 text-white shadow-md"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Left: Warning icon + info text */}
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 animate-pulse" />
        <span className="text-xs font-semibold truncate">
          🔍 Viewing as&nbsp;
          <strong className="font-black">{user.name}</strong>
          &nbsp;
          <span className="font-normal opacity-90">
            — Logged by <strong>{impersonator.name}</strong>. All actions are audit-logged.
          </span>
        </span>
      </div>

      {/* Right: Exit button */}
      <button
        onClick={handleExit}
        disabled={isExiting}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 active:scale-95 transition-all text-xs font-bold whitespace-nowrap disabled:opacity-60"
      >
        {isExiting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LogOut className="h-3.5 w-3.5" />
        )}
        Exit Impersonation
      </button>
    </div>
  );
};

export default ImpersonationBanner;
