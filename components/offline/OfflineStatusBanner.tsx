/**
 * OfflineStatusBanner.tsx
 *
 * Global banner mounted in app layout to inform field staff and web users
 * of offline status and pending synchronization items in real time.
 * Supports both light mode (web desktop) and dark mode (mobile pro app) with
 * modern glassmorphism, crisp badges, and tactile action buttons.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useOutboxSummary } from '../../hooks/useOutboxStatus';

export interface OfflineStatusBannerProps {
  variant?: 'bar' | 'card';
  className?: string;
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({
  variant = 'bar',
  className = '',
}) => {
  const navigate = useNavigate();
  const { summary, isOnline, isReachableState, syncNow } = useOutboxSummary();

  const totalQueued = summary.pending + summary.syncing;
  const totalActionNeeded = summary.failed + summary.conflict + summary.authPaused;

  // If connected, reached, and no items queued or failing, don't display the banner
  if (isOnline && isReachableState && totalQueued === 0 && totalActionNeeded === 0) {
    return null;
  }

  const isCard = variant === 'card';

  // 1. Conflict / Failed / Auth Paused: Needs Attention (Highest Priority)
  if (totalActionNeeded > 0) {
    const containerClasses = isCard
      ? `rounded-2xl border border-amber-500/30 bg-amber-50/95 dark:bg-amber-950/85 dark:border-amber-800/50 px-3.5 py-2.5 text-amber-950 dark:text-amber-200 text-xs font-medium flex items-center justify-between shadow-xs backdrop-blur-md w-[calc(100%-1rem)] max-w-lg mx-auto mb-3 transition-all animate-fade-in ${className}`
      : `w-full bg-amber-50/95 dark:bg-amber-950/85 border-b border-amber-200/80 dark:border-amber-800/50 px-4 sm:px-6 py-2 text-amber-950 dark:text-amber-200 text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs backdrop-blur-md transition-all animate-fade-in ${className}`;

    return (
      <div className={containerClasses.trim()}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-300 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span className="truncate font-semibold text-amber-950 dark:text-amber-100">
            {summary.conflict > 0
              ? `${summary.conflict} version conflict${summary.conflict > 1 ? 's' : ''} require review`
              : summary.authPaused > 0
              ? `Session expired: ${summary.authPaused} item${summary.authPaused > 1 ? 's' : ''} paused until login`
              : `${summary.failed} item${summary.failed > 1 ? 's' : ''} need attention`}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <button
            type="button"
            onClick={() => navigate('/sync-review')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-amber-950 text-xs font-semibold shadow-xs hover:shadow transition-all duration-200 active:scale-95 cursor-pointer"
          >
            Review & Fix
          </button>
        </div>
      </div>
    );
  }

  // 2. Currently Syncing
  if (summary.syncing > 0) {
    const containerClasses = isCard
      ? `rounded-2xl border border-sky-500/30 bg-sky-50/95 dark:bg-sky-950/85 dark:border-sky-800/50 px-3.5 py-2.5 text-sky-950 dark:text-sky-200 text-xs font-medium flex items-center justify-between shadow-xs backdrop-blur-md w-[calc(100%-1rem)] max-w-lg mx-auto mb-3 transition-all animate-fade-in ${className}`
      : `w-full bg-sky-50/95 dark:bg-sky-950/85 border-b border-sky-200/80 dark:border-sky-800/50 px-4 sm:px-6 py-2 text-sky-950 dark:text-sky-200 text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs backdrop-blur-md transition-all animate-fade-in ${className}`;

    return (
      <div className={containerClasses.trim()}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/60 border border-sky-300 dark:border-sky-700/60 text-sky-700 dark:text-sky-300 shrink-0">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          </div>
          <span className="font-semibold text-sky-950 dark:text-sky-100">
            Syncing {summary.syncing} item{summary.syncing > 1 ? 's' : ''} to cloud…
          </span>
        </div>
      </div>
    );
  }

  // 3. Offline / Disconnected
  if (!isOnline) {
    const containerClasses = isCard
      ? `rounded-2xl border border-slate-300/70 dark:border-slate-800 bg-slate-100/95 dark:bg-slate-900/90 px-3.5 py-2.5 text-slate-900 dark:text-slate-200 text-xs font-medium flex items-center justify-between shadow-xs backdrop-blur-md w-[calc(100%-1rem)] max-w-lg mx-auto mb-3 transition-all animate-fade-in ${className}`
      : `w-full bg-slate-100/95 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2 text-slate-900 dark:text-slate-200 text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs backdrop-blur-md transition-all animate-fade-in ${className}`;

    return (
      <div className={containerClasses.trim()}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
            <WifiOff className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-slate-950 dark:text-slate-100">
            {totalQueued > 0
              ? `Working offline: ${totalQueued} item${totalQueued > 1 ? 's' : ''} saved locally. Will auto-sync on reconnect.`
              : 'Working offline: changes are saved safely on your device.'}
          </span>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0 ml-2">
          {totalQueued > 0 && (
            <button
              type="button"
              onClick={() => navigate('/sync-review')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
            >
              View Queue
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/settings/offline-diagnostics')}
            className="px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            Status
          </button>
        </div>
      </div>
    );
  }

  // 4. Online with pending queue waiting for drain
  if (totalQueued > 0) {
    const containerClasses = isCard
      ? `rounded-2xl border border-emerald-500/30 bg-emerald-50/95 dark:bg-emerald-950/85 dark:border-emerald-800/50 px-3.5 py-2.5 text-emerald-950 dark:text-emerald-200 text-xs font-medium flex items-center justify-between shadow-xs backdrop-blur-md w-[calc(100%-1rem)] max-w-lg mx-auto mb-3 transition-all animate-fade-in ${className}`
      : `w-full bg-emerald-50/95 dark:bg-emerald-950/85 border-b border-emerald-200/80 dark:border-emerald-800/50 px-4 sm:px-6 py-2 text-emerald-950 dark:text-emerald-200 text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs backdrop-blur-md transition-all animate-fade-in ${className}`;

    return (
      <div className={containerClasses.trim()}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-semibold text-emerald-950 dark:text-emerald-100">
              {totalQueued} item{totalQueued > 1 ? 's' : ''} saved locally
            </span>
            <span className="text-emerald-700/80 dark:text-emerald-400/80 text-xs hidden sm:inline">
              • Ready to sync to cloud
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => syncNow()}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold shadow-xs hover:shadow transition-all duration-200 active:scale-95 cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Now</span>
        </button>
      </div>
    );
  }

  return null;
};
