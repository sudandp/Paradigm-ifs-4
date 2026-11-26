import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  Server,
  Smartphone,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { OutboxItem } from '../../services/offline/db';
import {
  buildConflictComparison,
  fetchServerConflictRecord,
  resolveKeepMine,
  resolveUseServer,
  exportConflictDraft,
  type ConflictComparison,
} from '../../services/offline/conflictActions';

interface ConflictResolverModalProps {
  isOpen: boolean;
  item: OutboxItem | null;
  onClose: () => void;
  onResolved?: () => void;
}

export const ConflictResolverModal: React.FC<ConflictResolverModalProps> = ({
  isOpen,
  item,
  onClose,
  onResolved,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [comparison, setComparison] = useState<ConflictComparison | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !item) {
      setComparison(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetchServerConflictRecord(item.tableName, item.id)
      .then((serverRec) => {
        if (!isMounted) return;
        const comp = buildConflictComparison(item, serverRec);
        setComparison(comp);
      })
      .catch((err) => {
        console.warn('[ConflictResolver] Failed to build comparison:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleKeepMine = async () => {
    try {
      setActionLoading('keep');
      const ok = await resolveKeepMine(item.id);
      if (ok) {
        toast.success('Your version re-queued for sync with latest server base.');
        onResolved?.();
        onClose();
      } else {
        toast.error('Failed to re-queue item.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error resolving conflict.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUseServer = async () => {
    try {
      setActionLoading('server');
      const ok = await resolveUseServer(item.id);
      if (ok) {
        toast.success('Server version accepted and local cache updated.');
        onResolved?.();
        onClose();
      } else {
        toast.error('Failed to apply server version.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error resolving conflict.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    try {
      setActionLoading('export');
      const res = await exportConflictDraft(item.id);
      if (res.success) {
        toast.success(`Draft downloaded: ${res.filename}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export draft.');
    } finally {
      setActionLoading(null);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#0b1310] border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        style={{
          marginTop: 'max(env(safe-area-inset-top, 0px), 12px)',
          marginBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)'
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-500/20 bg-[#101b17]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-wide">Sync Conflict Detected</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                  {item.tableName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Record <span className="font-mono text-slate-300">{item.id.slice(0, 8)}...</span> was modified on the server while offline.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-sm">Comparing local draft with server version...</p>
            </div>
          ) : (
            <>
              {/* Guidance Notice */}
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200/90 text-xs flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p>
                  Review the differences below. You can overwrite the server with your device edits (<strong>Keep Mine</strong>), discard your draft to take the server version (<strong>Use Server</strong>), or download a local JSON draft before deciding.
                </p>
              </div>

              {/* Diff Comparison Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                <div className="grid grid-cols-12 text-xs font-semibold px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-slate-300">
                  <div className="col-span-4 sm:col-span-3">Field</div>
                  <div className="col-span-4 sm:col-span-4 flex items-center space-x-1 text-emerald-400">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Your Unsynced Version</span>
                  </div>
                  <div className="col-span-4 sm:col-span-5 flex items-center space-x-1 text-amber-400">
                    <Server className="w-3.5 h-3.5" />
                    <span>Current Server Version</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-800/80 max-h-[42vh] overflow-y-auto">
                  {comparison?.fields.map((field) => (
                    <div
                      key={field.key}
                      className={`grid grid-cols-12 px-4 py-3 text-xs items-start transition-colors ${
                        field.isDifferent ? 'bg-amber-950/10' : 'hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="col-span-4 sm:col-span-3 font-medium text-slate-300 flex items-center space-x-1.5">
                        {field.isDifferent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        )}
                        <span className="truncate">{field.label}</span>
                      </div>
                      <div className="col-span-4 sm:col-span-4 pr-2 font-mono break-words text-emerald-300">
                        {formatValue(field.clientValue)}
                      </div>
                      <div className="col-span-4 sm:col-span-5 font-mono break-words text-slate-300">
                        {formatValue(field.serverValue)}
                      </div>
                    </div>
                  ))}

                  {(!comparison?.fields || comparison.fields.length === 0) && (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No matching fields to display.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-4 border-t border-emerald-500/20 bg-[#101b17] flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleExport}
            disabled={actionLoading !== null}
            className="px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            {actionLoading === 'export' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Export Draft (JSON)</span>
          </button>

          <div className="flex items-center space-x-2 ml-auto">
            <button
              type="button"
              onClick={handleUseServer}
              disabled={actionLoading !== null}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-600 bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'server' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              ) : (
                <Server className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Accept Server Version</span>
            </button>

            <button
              type="button"
              onClick={handleKeepMine}
              disabled={actionLoading !== null}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'keep' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Keep My Version</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

function formatValue(val: unknown): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
export default ConflictResolverModal;
