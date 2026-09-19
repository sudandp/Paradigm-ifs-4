/**
 * SyncReview.tsx — Dedicated Offline Outbox Review & Conflict Resolution Screen
 *
 * Allows field personnel and managers to:
 * - View all queued, syncing, failed, conflict, and auth-paused records.
 * - Manually trigger sync with live feedback.
 * - Retry individual failed items.
 * - Resolve version conflicts (Keep Mine / Keep Theirs).
 * - Discard invalid or duplicate mutations with safety confirmation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  ArrowLeft,
  FileText,
  ShieldAlert,
  ChevronRight,
  Split,
} from 'lucide-react';
import * as outbox from '../../services/offline/outbox';
import { useOutboxSummary } from '../../hooks/useOutboxStatus';
import type { OutboxItem } from '../../services/offline/db';

export const SyncReview: React.FC = () => {
  const navigate = useNavigate();
  const { summary, isOnline, isReachableState, syncNow, refresh: refreshSummary } = useOutboxSummary();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'attention' | 'pending' | 'conflicts'>('all');
  const [selectedItemForDiscard, setSelectedItemForDiscard] = useState<OutboxItem | null>(null);
  const [diffModalItem, setDiffModalItem] = useState<OutboxItem | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const all = await outbox.getAll();
      setItems(all.sort((a, b) => b.createdAt - a.createdAt));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
    const unsub = outbox.subscribeOutbox(() => {
      loadItems();
    });
    return () => unsub();
  }, [loadItems]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncNow();
      await loadItems();
      await refreshSummary();
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryItem = async (id: string) => {
    await outbox.retryFailedItem(id);
    await handleManualSync();
  };

  const handleConfirmDiscard = async () => {
    if (!selectedItemForDiscard) return;
    await outbox.discardFailedItem(selectedItemForDiscard.id);
    setSelectedItemForDiscard(null);
    await loadItems();
    await refreshSummary();
  };

  const handleKeepMine = async (item: OutboxItem) => {
    // Overwrite conflict by clearing baseUpdatedAt and resetting to pending
    const db = await (await import('../../services/offline/db')).getDb();
    const updated: OutboxItem = {
      ...item,
      baseUpdatedAt: undefined, // Clears version constraint so upsert forces latest
      status: 'pending',
      attempts: 0,
      failureReason: undefined,
      lastError: undefined,
    };
    await db.put('outbox', updated);
    await handleManualSync();
  };

  const getModuleTitle = (tableName: string) => {
    switch (tableName) {
      case 'snag_audits':
        return 'Snag Audit';
      case 'ht_yard_audits':
        return 'Site Audit (HT Yard)';
      case 'ppm_executions':
        return 'PPM Audit';
      case 'onboarding_submissions':
        return 'New Enrollment';
      default:
        return tableName.replace(/_/g, ' ');
    }
  };

  const getRecordTitle = (item: OutboxItem) => {
    const p = item.payload;
    return (
      (p.name_of_site as string) ||
      (p.site_name as string) ||
      (p.reference_number as string) ||
      (p.personal_name as string) ||
      (p.employee_name as string) ||
      `Record #${item.id.slice(0, 8)}`
    );
  };

  const getRouteForEdit = (item: OutboxItem) => {
    switch (item.tableName) {
      case 'snag_audits':
        return `/operations/snag-audit`;
      case 'ht_yard_audits':
        return `/operations/ht-yard-audit`;
      case 'ppm_executions':
        return `/operations/ppm`;
      case 'onboarding_submissions':
        return `/onboarding/new`;
      default:
        return '/';
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === 'attention') return item.status === 'failed' || item.status === 'conflict' || item.status === 'auth_paused';
    if (filter === 'pending') return item.status === 'pending' || item.status === 'syncing';
    if (filter === 'conflicts') return item.status === 'conflict';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              Offline Sync Review
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Outbox v2
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-2 mt-0.5">
              {isOnline && isReachableState ? (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Wifi className="w-3.5 h-3.5" /> Online & Connected to Cloud
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-400">
                  <WifiOff className="w-3.5 h-3.5" /> Working Offline
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/settings/offline-diagnostics')}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold border border-slate-800 flex items-center gap-1.5 transition-colors"
            title="Open detailed offline diagnostics"
          >
            Diagnostics
          </button>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing || !isOnline}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing Now…' : 'Sync All Pending'}
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div
          onClick={() => setFilter('all')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            filter === 'all'
              ? 'bg-slate-900 border-emerald-500/50 ring-1 ring-emerald-500/30'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-xs text-slate-400 font-medium">Total Queued</div>
          <div className="text-2xl font-bold mt-1">{summary.total}</div>
        </div>

        <div
          onClick={() => setFilter('pending')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            filter === 'pending'
              ? 'bg-blue-950/40 border-blue-500/50 ring-1 ring-blue-500/30'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-xs text-blue-400 font-medium">Pending / Syncing</div>
          <div className="text-2xl font-bold text-blue-300 mt-1">{summary.pending + summary.syncing}</div>
        </div>

        <div
          onClick={() => setFilter('attention')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            filter === 'attention'
              ? 'bg-amber-950/40 border-amber-500/50 ring-1 ring-amber-500/30'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-xs text-amber-400 font-medium">Needs Attention</div>
          <div className="text-2xl font-bold text-amber-300 mt-1">{summary.failed + summary.authPaused}</div>
        </div>

        <div
          onClick={() => setFilter('conflicts')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            filter === 'conflicts'
              ? 'bg-rose-950/40 border-rose-500/50 ring-1 ring-rose-500/30'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-xs text-rose-400 font-medium">Conflicts</div>
          <div className="text-2xl font-bold text-rose-300 mt-1">{summary.conflict}</div>
        </div>
      </div>

      {/* Main Items List */}
      <div className="max-w-5xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
            <span>Loading offline queue…</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/70" />
            <div className="text-base font-semibold text-slate-200">No items found</div>
            <p className="text-xs text-slate-400 max-w-sm">
              {filter === 'all'
                ? 'Your offline outbox is completely clean. All field records have synced to Supabase.'
                : `No items matching the selected filter "${filter}".`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredItems.map((item) => (
              <div key={item.id} className="p-4 sm:p-5 hover:bg-slate-800/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        {getModuleTitle(item.tableName)}
                      </span>

                      {/* Status Badges */}
                      {item.status === 'pending' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Queued
                        </span>
                      )}
                      {item.status === 'syncing' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Failed
                        </span>
                      )}
                      {item.status === 'conflict' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Split className="w-3 h-3" /> Conflict
                        </span>
                      )}
                      {item.status === 'auth_paused' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> Auth Paused
                        </span>
                      )}

                      {item.attachments && item.attachments.length > 0 && (
                        <span className="text-xs font-medium text-slate-400">
                          📎 {item.attachments.length} file{item.attachments.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div className="font-semibold text-slate-200 text-sm sm:text-base truncate">
                      {getRecordTitle(item)}
                    </div>

                    <div className="text-xs text-slate-400">
                      Action: <code className="text-emerald-400">{item.action}</code> · Created{' '}
                      {new Date(item.createdAt).toLocaleString()} · Attempts: {item.attempts}
                    </div>

                    {/* Error details if failed or conflict */}
                    {(item.failureReason || item.lastError?.message) && (
                      <div className="mt-2 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/40 rounded-lg p-2.5 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Reason: </span>
                          {item.failureReason || item.lastError?.message}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions for this item */}
                  <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center mt-2 sm:mt-0">
                    {item.status === 'conflict' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleKeepMine(item)}
                          className="px-2.5 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Keep Mine
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedItemForDiscard(item)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Keep Server's
                        </button>
                      </div>
                    ) : (
                      <>
                        {(item.status === 'failed' || item.status === 'auth_paused') && (
                          <button
                            type="button"
                            onClick={() => handleRetryItem(item.id)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Retry
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(getRouteForEdit(item))}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
                          title="Open module"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedItemForDiscard(item)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 rounded-lg transition-colors border border-slate-700 hover:border-rose-800"
                          title="Discard from queue"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discard Confirmation Modal */}
      {selectedItemForDiscard && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Discard Unsynced Item?</h3>
            </div>
            <p className="text-sm text-slate-300">
              Are you sure you want to remove <span className="font-semibold text-white">{getRecordTitle(selectedItemForDiscard)}</span> from your device's outbox?
            </p>
            <p className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              ⚠️ This data has not been uploaded to Supabase yet. Discarding will permanently erase local changes.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedItemForDiscard(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Discard Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncReview;
