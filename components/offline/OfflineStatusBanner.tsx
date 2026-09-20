/**
 * OfflineStatusBanner.tsx
 *
 * Global banner mounted in app layout to inform field staff of offline status
 * and pending synchronization items in real time.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, RefreshCw, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
      ? `rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-2 text-amber-200 text-xs font-medium flex items-center justify-between shadow-sm w-[calc(100%-2rem)] max-w-md mx-auto mb-3 ${className}`
      : `w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-amber-200 text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs ${className}`;

    return (
      <div className={containerClasses.trim()}>
        <div className="flex items-center gap-2 overflow-hidden">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
          <span className="truncate">
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
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded border border-amber-500/40 text-xs font-semibold transition-colors shadow-xs cursor-pointer"
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
      ? `rounded-xl border border-blue-500/40 bg-blue-500/15 px-3.5 py-2 text-blue-200 text-xs font-medium flex items-center justify-between shadow-sm w-[calc(100%-2rem)] max-w-md mx-auto mb-3 ${className}`
      : `w-full bg-blue-500/15 border-b border-blue-500/30 px-4 py-1.5 text-blue-200 text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs ${className}`;

    return (
      <div className={containerClasses.trim()}>
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-400 flex-shrink-0 animate-spin" />
          <span>Syncing {summary.syncing} item{summary.syncing > 1 ? 's' : ''} to cloud…</span>
        </div>
      </div>
    );
  }

  // 3. Offline / Disconnected
  if (!isOnline) {
    const containerClasses = isCard
      ? `rounded-xl border border-emerald-700/50 bg-emerald-950/90 backdrop-blur-md px-3.5 py-2 text-emerald-200 text-xs font-medium flex items-center justify-between shadow-md w-[calc(100%-2rem)] max-w-md mx-auto mb-3 ${className}`
      : `w-full bg-emerald-950/80 border-b border-emerald-800/40 px-4 py-2 text-emerald-300 text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs ${className}`;

    return (
      <div className={containerClasses.trim()}>
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
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
              className="text-xs text-emerald-400 hover:text-emerald-300 underline font-semibold"
            >
              View Queue
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/settings/offline-diagnostics')}
            className="px-2.5 py-0.5 rounded-full bg-emerald-800/40 hover:bg-emerald-800/60 text-emerald-200 border border-emerald-700/50 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
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
      ? `rounded-xl border border-emerald-700/40 bg-emerald-900/40 px-3.5 py-2 text-emerald-200 text-xs font-medium flex items-center justify-between shadow-sm w-[calc(100%-2rem)] max-w-md mx-auto mb-3 ${className}`
      : `w-full bg-emerald-900/30 border-b border-emerald-700/30 px-4 py-1.5 text-emerald-200 text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs ${className}`;

    return (
      <div className={containerClasses.trim()}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{totalQueued} item{totalQueued > 1 ? 's' : ''} pending upload.</span>
        </div>
        <button
          type="button"
          onClick={() => syncNow()}
          className="px-2.5 py-0.5 bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-200 rounded text-xs font-semibold transition-colors border border-emerald-600/40 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Sync Now
        </button>
      </div>
    );
  }

  return null;
};
