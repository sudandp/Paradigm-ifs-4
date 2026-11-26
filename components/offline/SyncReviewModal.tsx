import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAll,
  retryFailedItem,
  discardFailedItem,
  clearAllFailed,
  subscribeOutbox,
} from '../../services/offline/outbox';
import type { OutboxItem } from '../../services/offline/db';
import { syncEngine, getCurrentUserId } from '../../services/offline/syncEngine';
import { isOnline } from '../../services/offline/networkStatus';
import ConflictResolverModal from './ConflictResolverModal';

interface SyncReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabFilter = 'all' | 'conflicts' | 'failed' | 'pending';

export const SyncReviewModal: React.FC<SyncReviewModalProps> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [selectedConflictItem, setSelectedConflictItem] = useState<OutboxItem | null>(null);
  const [draining, setDraining] = useState<boolean>(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const all = await getAll();
      const currentUid = getCurrentUserId();
      // Prioritize current user's items, or unassigned/anonymous
      const filtered = currentUid
        ? all.filter((i) => !i.userId || i.userId === currentUid || i.userId === 'anonymous')
        : all;
      setItems(filtered);
    } catch (err) {
      console.warn('[SyncReviewModal] Error loading outbox items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchItems();

    // Subscribe to outbox events for live reactive UI updates
    const unsubscribe = subscribeOutbox(() => {
      fetchItems();
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const conflicts = items.filter((i) => i.status === 'conflict');
  const failed = items.filter((i) => i.status === 'failed' || i.status === 'auth_paused');
  const pending = items.filter((i) => i.status === 'pending' || i.status === 'syncing');

  const visibleItems = items.filter((i) => {
    if (activeTab === 'conflicts') return i.status === 'conflict';
    if (activeTab === 'failed') return i.status === 'failed' || i.status === 'auth_paused';
    if (activeTab === 'pending') return i.status === 'pending' || i.status === 'syncing';
    return true;
  });

  const handleManualSync = async () => {
    if (!isOnline()) {
      toast.error('Device is offline. Connect to network to sync.');
      return;
    }
    setDraining(true);
    try {
      const res = await syncEngine.drain();
      toast.success(`Sync complete: ${res.synced} synced, ${res.failed} remaining`);
      await fetchItems();
    } catch (err: any) {
      toast.error(err?.message || 'Sync failed.');
    } finally {
      setDraining(false);
    }
  };

  const handleRetry = async (id: string) => {
    setActionInProgressId(id);
    try {
      await retryFailedItem(id);
      toast.success('Item reset for retry.');
      await fetchItems();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to retry item.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleDiscard = async (id: string) => {
    if (!confirm('Are you sure you want to discard this item and its local attachments?')) return;
    setActionInProgressId(id);
    try {
      await discardFailedItem(id);
      toast.success('Item discarded.');
      await fetchItems();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to discard item.');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleClearAllFailed = async () => {
    if (!confirm('Discard all failed items? This action cannot be undone.')) return;
    try {
      const count = await clearAllFailed();
      toast.success(`Discarded ${count} failed items.`);
      await fetchItems();
    } catch (err: any) {
      toast.error(err?.message || 'Error clearing failed items.');
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
        <div 
          className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#0b1310] border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
          style={{
            marginTop: 'max(env(safe-area-inset-top, 0px), 12px)',
            marginBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-500/20 bg-[#101b17]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <RefreshCw className={`w-5 h-5 ${draining ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-white tracking-wide">Offline Sync Review</h3>
                  <span className="flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {isOnline() ? (
                      <>
                        <Wifi className="w-3 h-3 text-emerald-400" />
                        <span>Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3 text-amber-400" />
                        <span>Offline</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspect queued mutations, resolve version conflicts, and manage sync retries.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={draining || !isOnline()}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${draining ? 'animate-spin' : ''}`} />
                <span>{draining ? 'Syncing...' : 'Sync Now'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-800 bg-[#0d1714] px-5 py-2 space-x-2 text-xs font-medium overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === 'all'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>All Items</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                {items.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('conflicts')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === 'conflicts'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Conflicts</span>
              {conflicts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-300 font-bold text-[10px]">
                  {conflicts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('failed')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === 'failed'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span>Needs Attention</span>
              {failed.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-500/30 text-red-300 font-bold text-[10px]">
                  {failed.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === 'pending'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Pending / Syncing</span>
              {pending.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-300 text-[10px]">
                  {pending.length}
                </span>
              )}
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                <p className="text-sm">Reading outbox queue...</p>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-white">Outbox is completely clear</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  All offline records, punches, and audits have been successfully synchronized with the cloud.
                </p>
              </div>
            ) : (
              visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900/80 transition-all text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white font-mono">{item.tableName}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono text-[10px] uppercase font-bold ${
                          item.status === 'conflict'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : item.status === 'failed'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : item.status === 'syncing'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse'
                            : item.status === 'auth_paused'
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        Attempts: {item.attempts}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div className="text-slate-300 text-[11px] font-mono truncate">
                    ID: {item.id}
                  </div>

                  {item.failureReason && (
                    <div className="p-2 rounded-lg bg-red-950/20 border border-red-500/20 text-red-300 text-[11px]">
                      {item.failureReason}
                    </div>
                  )}

                  {/* Item Actions */}
                  <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-800/60">
                    {item.status === 'conflict' && (
                      <button
                        type="button"
                        onClick={() => setSelectedConflictItem(item)}
                        className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold flex items-center space-x-1 transition-colors"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Resolve Conflict</span>
                      </button>
                    )}

                    {(item.status === 'failed' || item.status === 'auth_paused') && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRetry(item.id)}
                          disabled={actionInProgressId === item.id}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center space-x-1 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDiscard(item.id)}
                          disabled={actionInProgressId === item.id}
                          className="px-2.5 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/40 text-red-300 border border-red-500/20 flex items-center space-x-1 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Discard</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {failed.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-800 bg-[#0d1714] flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {failed.length} item{failed.length > 1 ? 's' : ''} require attention
              </span>
              <button
                type="button"
                onClick={handleClearAllFailed}
                className="text-red-400 hover:text-red-300 font-medium transition-colors"
              >
                Clear all failed items
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Conflict Resolver Modal */}
      {selectedConflictItem && (
        <ConflictResolverModal
          isOpen={Boolean(selectedConflictItem)}
          item={selectedConflictItem}
          onClose={() => setSelectedConflictItem(null)}
          onResolved={() => {
            setSelectedConflictItem(null);
            fetchItems();
          }}
        />
      )}
    </>,
    document.body
  );
};

export default SyncReviewModal;
