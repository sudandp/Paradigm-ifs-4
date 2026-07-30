import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, FileText, Plus, Search, Filter, ShieldCheck, Zap, Droplet, Check, ChevronRight, RefreshCw, Bug, Play, RotateCcw, X, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { PPMCategory } from '../../types/ppm';
import { syncEngine } from '../../services/offline/syncEngine';
import * as outbox from '../../services/offline/outbox';
import { getDb } from '../../services/offline/db';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

// ─── Sync Debug Modal ─────────────────────────────────────────────────────────

interface SyncDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshList: () => void;
}

const SyncDebugModal: React.FC<SyncDebugModalProps> = ({ isOpen, onClose, onRefreshList }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadOutbox = React.useCallback(async () => {
    setLoading(true);
    try {
      const all = await outbox.getAll();
      setItems(all);
    } catch (err) {
      console.error('[SyncDebugModal] Failed to load outbox:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadOutbox();
    }
  }, [isOpen, loadOutbox]);

  const handleRetryItem = async (id: string) => {
    try {
      await outbox.retryFailedItem(id);
      toast.success('Item reset to pending for retry');
      loadOutbox();
    } catch (err: any) {
      toast.error('Failed to reset item: ' + err?.message);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Remove this item from offline queue?')) return;
    try {
      const db = await getDb();
      await db.delete('outbox', id);
      toast.success('Removed outbox item');
      loadOutbox();
      onRefreshList();
    } catch (err: any) {
      toast.error('Failed to remove item: ' + err?.message);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    toast.loading('Running manual sync...', { id: 'modal-sync' });
    try {
      const res = await syncEngine.drain();
      toast.success(`Sync finished: ${res.synced} synced, ${res.failed} failed`, { id: 'modal-sync' });
      await loadOutbox();
      await onRefreshList();
    } catch (err: any) {
      toast.error('Sync failed: ' + err?.message, { id: 'modal-sync' });
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  const failedItems = items.filter(i => i.status === 'failed');
  const pendingItems = items.filter(i => i.status === 'pending');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bug className="text-amber-400" size={20} />
            <div>
              <h3 className="font-bold text-lg">PPM Audit Sync Diagnostics</h3>
              <p className="text-xs text-gray-300">View error tracebacks, retry stuck records, or purge bad test entries</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 text-xs font-semibold">
            <span className="text-gray-700">Total Queued: <strong className="text-gray-900">{items.length}</strong></span>
            <span className="text-amber-700">Pending: <strong>{pendingItems.length}</strong></span>
            <span className="text-red-700">Failed: <strong>{failedItems.length}</strong></span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={loadOutbox} disabled={loading}>
              <RefreshCw size={13} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleTriggerSync} disabled={syncing}>
              <Play size={13} className={`mr-1 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync All Now'}
            </Button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <CheckCircle2 size={40} className="mx-auto mb-2 text-emerald-500" />
              <p className="font-medium text-gray-600">Outbox is completely clear!</p>
              <p className="text-xs mt-1">All offline records have been synced to the database.</p>
            </div>
          ) : (
            items.map(item => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.status === 'failed'
                    ? 'bg-red-50/50 border-red-200'
                    : item.status === 'syncing'
                    ? 'bg-blue-50/50 border-blue-200'
                    : 'bg-amber-50/50 border-amber-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-gray-200 text-gray-800">
                      {item.action}
                    </span>
                    <span className="text-xs font-mono font-semibold text-gray-700">
                      {item.tableName}
                    </span>
                    <span className="text-xs text-gray-400">ID: {item.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      item.status === 'failed' ? 'bg-red-100 text-red-700 border border-red-300' :
                      item.status === 'syncing' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {item.status} (Attempts: {item.attempts || 0})
                    </span>
                  </div>
                </div>

                {item.failureReason && (
                  <div className="mt-2 p-2.5 bg-red-100/80 rounded-lg text-xs font-mono text-red-900 border border-red-200 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
                    <div className="break-all">
                      <strong>Failure Reason:</strong> {item.failureReason}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-xs text-gray-500 border-t border-gray-200/50 pt-2">
                  <span>Queued: {new Date(item.createdAt).toLocaleTimeString()}</span>
                  <div className="flex gap-2">
                    {item.status === 'failed' && (
                      <button
                        onClick={() => handleRetryItem(item.id)}
                        className="flex items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold hover:underline"
                      >
                        <RotateCcw size={12} /> Retry Item
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold hover:underline"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// A mock dashboard for the PPM Module Phase 1
export const PPMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<PPMCategory>('ELECTRICAL_PANEL');
  const [pendingOrFailedCount, setPendingOrFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);

  const updateOutboxCount = React.useCallback(async () => {
    try {
      const items = await outbox.getAll();
      setPendingOrFailedCount(items.length);
    } catch {
      setPendingOrFailedCount(0);
    }
  }, []);

  useEffect(() => {
    updateOutboxCount();
    const interval = setInterval(updateOutboxCount, 3000);
    return () => clearInterval(interval);
  }, [updateOutboxCount]);

  const handleManualSync = React.useCallback(async () => {
    setIsSyncing(true);
    try {
      const allOutbox = await outbox.getAll();
      if (allOutbox.length === 0) {
        toast.success('All PPM Audits are already synced to cloud!');
        setIsSyncing(false);
        return;
      }
      toast.loading(`Syncing ${allOutbox.length} offline item(s)...`, { id: 'manual-ppm-sync' });
      const result = await syncEngine.drain();
      const remainingFailed = await outbox.getFailed();

      if (remainingFailed.length > 0) {
        toast.error(`Sync finished: ${result.synced} synced, ${remainingFailed.length} failed. Opening diagnostics...`, {
          id: 'manual-ppm-sync',
          duration: 5000,
        });
        setShowDebugModal(true);
      } else {
        toast.success(`✅ Successfully synced ${result.synced} item(s)!`, { id: 'manual-ppm-sync' });
      }
      await updateOutboxCount();
    } catch (err: any) {
      toast.error(`Sync error: ${err?.message || 'Unknown error'}`, { id: 'manual-ppm-sync' });
    } finally {
      setIsSyncing(false);
    }
  }, [updateOutboxCount]);
  
  const categories = [
    { id: 'ELECTRICAL_PANEL', step: 1, name: 'Electrical Panel', icon: <Zap className="w-4 h-4" />, count: 12 },
    { id: 'BOOSTER_PUMPS', step: 2, name: 'Booster Pumps', icon: <Settings className="w-4 h-4" />, count: 4 },
    { id: 'SP', step: 3, name: 'Swimming Pool & WB', icon: <Droplet className="w-4 h-4" />, count: 6 },
    { id: 'RO', step: 4, name: 'RO Plant', icon: <Droplet className="w-4 h-4" />, count: 9 },
    { id: 'STP', step: 5, name: 'STP', icon: <Droplet className="w-4 h-4" />, count: 15 },
    { id: 'HT_YARD', step: 6, name: 'HT Yard', icon: <ShieldCheck className="w-4 h-4" />, count: 5 },
    { id: 'GENERATOR', step: 7, name: 'Generator', icon: <Settings className="w-4 h-4" />, count: 8 },
    { id: 'WTP', step: 8, name: 'WTP', icon: <Droplet className="w-4 h-4" />, count: 2 }
  ];

  const activeIndex = categories.findIndex(c => c.id === activeCategory);
  const activeCategoryObj = categories[activeIndex] || categories[0];

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
            <Settings className="w-4 h-4" /> Preventive Maintenance (PPM)
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Technical Audit Compliance
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage scheduled audits and track compliance across all facility systems.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 ${
              pendingOrFailedCount > 0
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
            title="Trigger immediate sync of all offline records"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : `Sync Now${pendingOrFailedCount > 0 ? ` (${pendingOrFailedCount})` : ''}`}
          </button>
          <button
            onClick={() => setShowDebugModal(true)}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
            title="View sync diagnostics and error tracebacks"
          >
            <Bug className="w-4 h-4 text-amber-500" /> Debug
          </button>
          <button 
            onClick={() => navigate(`/operations/ppm-audits/${activeCategory}`)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Start New Audit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Stepper Sidebar */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 px-1">
              <div>
                <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Facility Stepper
                </h2>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Step {activeIndex + 1} of {categories.length}</p>
              </div>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {Math.round(((activeIndex + 1) / categories.length) * 100)}%
              </span>
            </div>

            {/* Stepper Vertical Track */}
            <div className="relative space-y-2">
              <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800 z-0" />

              {categories.map((cat, index) => {
                const isActive = activeCategory === cat.id;
                const isPassed = index < activeIndex;
                
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id as PPMCategory)}
                    className={`w-full relative z-10 flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all text-left group ${
                      isActive
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs'
                        : isPassed
                        ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Step Badge Node */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all flex-shrink-0 ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-4 ring-emerald-100 dark:ring-emerald-950'
                          : isPassed
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}>
                        {isPassed ? (
                          <Check className="w-4 h-4 stroke-[3]" />
                        ) : (
                          <span>{cat.step}</span>
                        )}
                      </div>

                      {/* Step Name & Info */}
                      <div>
                        <div className={isActive ? 'font-black text-emerald-900 dark:text-emerald-100' : 'font-semibold'}>
                          {cat.name}
                        </div>
                        <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 block mt-0.5">
                          {cat.count} points
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isActive && <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${activeCategoryObj.name} audit runs...`}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <button className="p-2 border border-slate-200/80 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-900/40">
                {activeCategoryObj.icon}
              </div>
              <div className="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full mb-3">
                Step {activeCategoryObj.step} of 8 • {activeCategoryObj.count} Auditable Points
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No audits for {activeCategoryObj.name}</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
                Start a new technical audit to begin inspecting the system and capturing observations.
              </p>
              <button 
                onClick={() => {
                  navigate(`/operations/ppm-audits/${activeCategory}`);
                }}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Start {activeCategoryObj.name} Audit
              </button>
            </div>
          </div>
        </div>
      </div>
      <SyncDebugModal
        isOpen={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        onRefreshList={updateOutboxCount}
      />
    </div>
  );
};
