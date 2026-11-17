import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { getAll, subscribeOutbox } from '../../services/offline/outbox';
import type { OutboxItem } from '../../services/offline/db';
import { getCurrentUserId } from '../../services/offline/syncEngine';
import SyncReviewModal from './SyncReviewModal';

export const SyncStatusBadge: React.FC = () => {
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

  if (items.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 hover:bg-emerald-900/40 transition-colors"
          title="All changes synced to cloud. Click to open sync review."
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
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
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/50 hover:bg-amber-900/60 animate-pulse transition-colors"
          title={`${conflicts.length} edit conflict(s) require resolution. Click to resolve.`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
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
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-red-300 bg-red-950/60 border border-red-500/50 hover:bg-red-900/60 transition-colors"
          title={`${failed.length} item(s) need attention. Click to inspect.`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
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
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 hover:bg-cyan-900/60 transition-colors"
          title="Syncing items to cloud..."
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
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
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-slate-300 bg-slate-900/80 border border-slate-700 hover:bg-slate-800 transition-colors"
        title={`${pending.length} pending offline items. Click to review.`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>{pending.length} Queued</span>
      </button>
      <SyncReviewModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};

export default SyncStatusBadge;
