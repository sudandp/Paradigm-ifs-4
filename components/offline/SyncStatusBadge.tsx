import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { getAll, subscribeOutbox } from '../../services/offline/outbox';
import type { OutboxItem } from '../../services/offline/db';
import { getCurrentUserId } from '../../services/offline/syncEngine';
import SyncReviewModal from './SyncReviewModal';

interface SyncStatusBadgeProps {
  theme?: 'light' | 'dark';
  className?: string;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ theme = 'light', className = '' }) => {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const refresh = async () => {
    try {
      const all = await getAll();
      const currentUid = getCurrentUserId();
      const userItems = currentUid
        ? all.filter((i) => !i.userId || i.userId === currentUid || i.userId === 'anonymous')
        : all;
      setItems(userItems);
    } catch {
      // Ignored during startup
    }
  };

  useEffect(() => {
    refresh();
    const unsub = subscribeOutbox(() => {
      refresh();
    });
    return () => {
      unsub();
    };
  }, []);

  const conflicts = items.filter((i) => i.status === 'conflict');
  const failed = items.filter((i) => i.status === 'failed' || i.status === 'auth_paused');
  const syncing = items.filter((i) => i.status === 'syncing');
  const pending = items.filter((i) => i.status === 'pending');

  const isLight = theme === 'light';

  if (items.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer shadow-2xs select-none shrink-0 ${
            isLight
              ? 'text-emerald-800 bg-emerald-50/90 hover:bg-emerald-100/90 border border-emerald-200/90'
              : 'text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30'
          } ${className}`}
          title="All changes synced to cloud. Click to open sync review."
        >
          <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
          <span className="hidden sm:inline">Synced</span>
        </button>
        <SyncReviewModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  if (conflicts.length > 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer shadow-2xs animate-pulse select-none shrink-0 ${
            isLight
              ? 'text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300'
              : 'text-amber-200 bg-amber-950/70 hover:bg-amber-900/70 border border-amber-500/50'
          } ${className}`}
          title={`${conflicts.length} edit conflict(s) require resolution. Click to resolve.`}
        >
          <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
          <span>{conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''}</span>
        </button>
        <SyncReviewModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  if (failed.length > 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer shadow-2xs select-none shrink-0 ${
            isLight
              ? 'text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-300'
              : 'text-rose-200 bg-rose-950/70 hover:bg-rose-900/70 border border-rose-500/50'
          } ${className}`}
          title={`${failed.length} item(s) need attention. Click to inspect.`}
        >
          <AlertCircle className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-rose-600' : 'text-rose-400'}`} />
          <span>{failed.length} Failed</span>
        </button>
        <SyncReviewModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  if (syncing.length > 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer shadow-2xs select-none shrink-0 ${
            isLight
              ? 'text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-300'
              : 'text-sky-200 bg-sky-950/70 hover:bg-sky-900/70 border border-sky-500/40'
          } ${className}`}
          title="Syncing items to cloud..."
        >
          <RefreshCw className={`w-3.5 h-3.5 shrink-0 animate-spin ${isLight ? 'text-sky-600' : 'text-sky-400'}`} />
          <span>Syncing...</span>
        </button>
        <SyncReviewModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer shadow-2xs select-none shrink-0 ${
          isLight
            ? 'text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200/90'
            : 'text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-slate-700'
        } ${className}`}
        title={`${pending.length} pending offline items. Click to review.`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${isLight ? 'bg-emerald-500' : 'bg-emerald-400'}`} />
        <span>{pending.length} Queued</span>
      </button>
      <SyncReviewModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};

export default SyncStatusBadge;
