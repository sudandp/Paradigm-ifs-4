import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Plus, FileSpreadsheet, FileText, Zap, Layers, AlertTriangle, 
  CheckCircle2, Activity, Cpu, ShieldCheck, Search, 
  ArrowUpRight, Sparkles, Save, ChevronDown, Check, Trash2,
  RefreshCw, Bug, Play, RotateCcw, X, History, User,
  FolderOpen, Copy, Eye, EyeOff, Calendar, QrCode, Tag
} from 'lucide-react';
import { HTAuditHeader, HTEquipmentInstance, HTAuditResponse, HTSnagItem, HTEquipmentModuleType, HTAuditLogEntry } from '../../types/htYard';
import { useAuthStore } from '../../store/authStore';
import { HT_YARD_FIELD_SPECS } from '../../config/htYardFieldSpecs';
import { HTAuditFormEngine } from '../../components/ht-yard/HTAuditFormEngine';
import { HTFeederRepeater } from '../../components/ht-yard/HTFeederRepeater';
import { HTEarthPitRegister } from '../../components/ht-yard/HTEarthPitRegister';
import { HTSnagListManager } from '../../components/ht-yard/HTSnagListManager';
import { HTAssetQrPrintModal } from '../../components/ht-yard/HTAssetQrPrintModal';
import { HTPpmCalendarView } from '../../components/ht-yard/HTPpmCalendarView';
import { htAssetQrService } from '../../services/htAssetQrService';
import { htYardExporter } from '../../services/htYardExporter';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import { syncEngine } from '../../services/offline/syncEngine';
import * as outbox from '../../services/offline/outbox';
import { getDb } from '../../services/offline/db';
import Button from '../../components/ui/Button';

// ─── Sync Status Badge ────────────────────────────────────────────────────────

const SyncStatusBadge: React.FC<{ pending?: boolean; failed?: boolean }> = ({ pending, failed }) => {
  if (failed) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
        Sync Failed
      </span>
    );
  }
  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Not Synced
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
      <CheckCircle2 size={10} className="text-emerald-600" />
      Synced
    </span>
  );
};

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
              <h3 className="font-bold text-lg">Site Audit Sync Diagnostics</h3>
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

// ─── Audit Drafts & Saved Inspections Modal ──────────────────────────────────

interface AuditDraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allAudits: any[];
  activeAuditId?: string;
  onSelectAudit: (audit: any) => void;
  onDeleteAudit: (auditId: string, siteName: string) => void;
  onDuplicateAudit: (audit: any) => void;
  onRefreshList: () => void;
  onStartNewAudit: () => void;
  onSeedDemoDrafts: () => void;
  currentUserName?: string;
  isRefreshing?: boolean;
}

const AuditDraftsModal: React.FC<AuditDraftsModalProps> = ({
  isOpen,
  onClose,
  allAudits,
  activeAuditId,
  onSelectAudit,
  onDeleteAudit,
  onDuplicateAudit,
  onRefreshList,
  onStartNewAudit,
  onSeedDemoDrafts,
  currentUserName,
  isRefreshing
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'DRAFTS' | 'OTHERS' | 'SYNCED' | 'OFFLINE'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentNameLower = (currentUserName || 'Sudhan M').toLowerCase();

  const filteredAudits = allAudits.filter((item) => {
    const siteName = (item.activeAudit?.siteName || '').toLowerCase();
    const refNum = (item.activeAudit?.referenceNumber || '').toLowerCase();
    const auditor = (item.activeAudit?.auditorName || '').toLowerCase();
    const division = (item.activeAudit?.clientDivision || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();

    const matchesSearch = !q || siteName.includes(q) || refNum.includes(q) || auditor.includes(q) || division.includes(q);
    if (!matchesSearch) return false;

    // Date Range (From Date -> To Date)
    const rawDate = item.activeAudit?.auditDate || (item.activeAudit?.createdAt ? item.activeAudit.createdAt.split('T')[0] : '');
    if (fromDate && rawDate && rawDate < fromDate) {
      return false;
    }
    if (toDate && rawDate && rawDate > toDate) {
      return false;
    }

    if (filterTab === 'DRAFTS') {
      return item.activeAudit?.status === 'Draft' || !item.activeAudit?.status;
    }
    if (filterTab === 'OTHERS') {
      return auditor && !auditor.includes(currentNameLower);
    }
    if (filterTab === 'SYNCED') {
      return !item.activeAudit?.pending && !item.activeAudit?.failed;
    }
    if (filterTab === 'OFFLINE') {
      return item.activeAudit?.pending || item.activeAudit?.failed;
    }
    return true;
  });

  const draftsCount = allAudits.filter(a => a.activeAudit?.status === 'Draft' || !a.activeAudit?.status).length;
  const othersCount = allAudits.filter(a => {
    const aud = (a.activeAudit?.auditorName || '').toLowerCase();
    return aud && !aud.includes(currentNameLower);
  }).length;
  const offlineCount = allAudits.filter(a => a.activeAudit?.pending || a.activeAudit?.failed).length;

  // Preset Date Helper
  const applyDatePreset = (preset: 'all' | 'today' | 'last7' | 'thisMonth') => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setFromDate(d.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(todayStr);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
              <FolderOpen size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg sm:text-xl tracking-tight">Site Audit Drafts Hub</h3>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                  {allAudits.length} Records
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Inspect, resume, and manage drafts created across all engineers and substations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar & Search */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Site Name, Auditor, Division, or Reference #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshList}
              disabled={isRefreshing}
              className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
              title="Fetch fresh drafts from cloud"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onStartNewAudit();
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0"
            >
              <Plus size={14} />
              <span>New Audit</span>
            </button>
          </div>
        </div>

        {/* Date to Date Filter Bar */}
        <div className="px-4 py-2 bg-white dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar size={13} className="text-emerald-600" />
              Date Range:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors flex items-center gap-0.5"
              >
                <X size={12} /> Clear Dates
              </button>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={() => applyDatePreset('all')}
              className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${!fromDate && !toDate ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              All Time
            </button>
            <button
              onClick={() => applyDatePreset('today')}
              className="px-2 py-0.5 rounded-md font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => applyDatePreset('last7')}
              className="px-2 py-0.5 rounded-md font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => applyDatePreset('thisMonth')}
              className="px-2 py-0.5 rounded-md font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              This Month
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 bg-slate-100/70 dark:bg-slate-800/30 border-b border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { key: 'ALL', label: `All (${allAudits.length})` },
            { key: 'DRAFTS', label: `Drafts (${draftsCount})` },
            { key: 'OTHERS', label: `Other Engineers (${othersCount})` },
            { key: 'SYNCED', label: 'Synced Cloud' },
            { key: 'OFFLINE', label: `Offline (${offlineCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key as any)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                filterTab === tab.key
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Draft List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5">
          {filteredAudits.length === 0 ? (
            <div className="text-center py-14 px-4">
              <FolderOpen size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
              <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-base">No Matching Drafts Found</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery || filterTab !== 'ALL'
                  ? 'Try clearing the search query or changing filter tab.'
                  : 'No saved drafts exist in database or local storage yet.'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={onSeedDemoDrafts}
                  className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Sparkles size={14} /> Load Demo Multi-User Drafts
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onStartNewAudit();
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Plus size={14} /> Start Fresh Audit
                </button>
              </div>
            </div>
          ) : (
            filteredAudits.map((item) => {
              const audit = item.activeAudit || {};
              const isSelected = audit.id === activeAuditId;
              const isOtherUser = audit.auditorName && !audit.auditorName.toLowerCase().includes(currentNameLower);
              const responsesCount = Object.keys(item.responses || {}).length;
              const equipmentList = item.equipmentInstances || [];
              const snagsList = item.snagItems || [];
              const isExpanded = expandedDraftId === audit.id;

              return (
                <div
                  key={audit.id || Math.random()}
                  className={`rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs hover:shadow-xs'
                  }`}
                >
                  {/* Card Main Row */}
                  <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                          {audit.siteName || 'Unnamed Substation'}
                        </h4>
                        
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                          audit.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          audit.status === 'Under_Review' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                          audit.status === 'Submitted' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {audit.status || 'Draft'}
                        </span>

                        {isOtherUser && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900 flex items-center gap-1">
                            <User size={10} /> Other Engineer's Draft
                          </span>
                        )}

                        <SyncStatusBadge pending={audit.pending} failed={audit.failed} />

                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white flex items-center gap-1">
                            <Check size={10} /> Active in Workspace
                          </span>
                        )}
                      </div>

                      {/* Sub row info */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{audit.referenceNumber}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User size={12} className="text-slate-400" />
                          <strong className={isOtherUser ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}>
                            {audit.auditorName || 'Field Engineer'}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>{audit.clientDivision || 'BESCOM Division'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {audit.auditDate}
                        </span>
                      </div>

                      {/* Unsaved Snapshot Metrics */}
                      <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 border border-slate-200/50 dark:border-slate-700/50">
                          <Cpu size={12} className="text-emerald-600" />
                          <strong>{equipmentList.length}</strong> Equipment Units
                        </span>
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 border border-slate-200/50 dark:border-slate-700/50">
                          <Activity size={12} className="text-blue-600" />
                          <strong>{responsesCount}</strong> Checklist Inputs
                        </span>
                        <span className={`px-2.5 py-1 rounded-xl font-semibold flex items-center gap-1.5 border ${
                          snagsList.length > 0
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'
                            : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/50'
                        }`}>
                          <AlertTriangle size={12} className={snagsList.length > 0 ? 'text-amber-500' : 'text-slate-400'} />
                          <strong>{snagsList.length}</strong> Snags Logged
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => setExpandedDraftId(isExpanded ? null : audit.id)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        title="Preview unsaved observations and equipment instances"
                      >
                        {isExpanded ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{isExpanded ? 'Hide Details' : 'Preview'}</span>
                      </button>

                      <button
                        onClick={() => onDuplicateAudit(item)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all"
                        title="Duplicate as new draft"
                      >
                        <Copy size={14} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAudit(audit.id, audit.siteName);
                        }}
                        className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl transition-all"
                        title="Delete draft"
                      >
                        <Trash2 size={14} />
                      </button>

                      <button
                        onClick={() => {
                          onSelectAudit(item);
                          onClose();
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-1.5"
                      >
                        <span>{isSelected ? 'Open Active' : 'Resume Audit'}</span>
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Inspection Preview Drawer */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-slate-50/90 dark:bg-slate-800/40 border-t border-slate-200/70 dark:border-slate-800 rounded-b-2xl space-y-3.5 animate-in slide-in-from-top-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Equipment Fleet List */}
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Configured Equipment Fleet ({equipmentList.length})
                          </span>
                          {equipmentList.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No equipment units added yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {equipmentList.map((inst: any) => (
                                <span
                                  key={inst.id}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1"
                                >
                                  <Cpu size={11} className="text-emerald-600" />
                                  {inst.instanceName} ({inst.moduleType})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Snags / Defects Logged */}
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Recorded Snags ({snagsList.length})
                          </span>
                          {snagsList.length === 0 ? (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">No snags or defects logged in this session.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                              {snagsList.map((snag: any) => (
                                <div key={snag.id} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                  <span className="line-clamp-1">{snag.snagPoint || snag.description || 'Defect noted'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong>{filteredAudits.length}</strong> of <strong>{allAudits.length}</strong> total site audit drafts
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            Close Hub
          </button>
        </div>
      </div>
    </div>
  );
};

export const HTYardAuditDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedAuditId = searchParams.get('auditId');
  const currentUser = useAuthStore(state => state.user);

  const [activeAudit, setActiveAudit] = useState<HTAuditHeader | null>(null);
  const [equipmentInstances, setEquipmentInstances] = useState<HTEquipmentInstance[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string>('site_common');
  const [responses, setResponses] = useState<Record<string, HTAuditResponse>>({});
  const [snagItems, setSnagItems] = useState<HTSnagItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allAudits, setAllAudits] = useState<any[]>([]);
  const [showSiteDropdown, setShowSiteDropdown] = useState<boolean>(false);
  
  // View Switcher & QR Print Center State
  const [activeDashboardView, setActiveDashboardView] = useState<'AUDIT_EXECUTION' | 'PPM_CALENDAR'>('AUDIT_EXECUTION');
  const [showQrPrintModal, setShowQrPrintModal] = useState<boolean>(false);

  // ─── Change Audit Logging State ──────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<HTAuditLogEntry[]>([]);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [logActionFilter, setLogActionFilter] = useState<string>('ALL');

  const addAuditLog = React.useCallback((entry: { actionType: 'CREATE' | 'EDIT' | 'DELETE' | 'DUPLICATE' | 'SAVE'; target: string; details: string; userName?: string; userRole?: string }) => {
    const newLog: HTAuditLogEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ', ' + new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
      userName: entry.userName || currentUser?.name || 'Sudhan M',
      userRole: entry.userRole || currentUser?.role || 'Admin',
      actionType: entry.actionType,
      target: entry.target,
      details: entry.details,
    };
    setAuditLogs(prev => [newLog, ...prev]);

    // Also persist to global audit logs store for central Audit Change Log view
    try {
      const globalLog = {
        ...newLog,
        moduleType: 'SITE_AUDIT',
        siteName: entry.target,
        auditId: 'ht-global'
      };
      const raw = localStorage.getItem('paradigm_ht_audit_global_logs');
      const existing = raw ? JSON.parse(raw) : [];
      localStorage.setItem('paradigm_ht_audit_global_logs', JSON.stringify([globalLog, ...existing]));
    } catch (e) {
      console.warn('[HTYardAuditDashboard] Failed to save global audit log:', e);
    }
  }, [currentUser]);
  
  // Modal for new audit
  const [showNewAuditModal, setShowNewAuditModal] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newClientDivision, setNewClientDivision] = useState('');

  // Modal for delete audit
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [auditToDelete, setAuditToDelete] = useState<{ id: string; siteName: string } | null>(null);

  // Modal for drafts hub
  const [showDraftsModal, setShowDraftsModal] = useState<boolean>(false);
  const [isRefreshingDrafts, setIsRefreshingDrafts] = useState<boolean>(false);

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

  const loadAudits = async () => {
    try {
      const list = await api.getAllHTYardAudits();
      setAllAudits(list);
      if (list && list.length > 0) {
        let selected = list[0];
        if (selectedAuditId) {
          const found = list.find((a: any) => a.activeAudit?.id === selectedAuditId);
          if (found) selected = found;
        } else {
          const todayStr = new Date().toISOString().split('T')[0];
          const todayAudit = list.find((a: any) => a.activeAudit?.auditDate === todayStr);
          if (todayAudit) selected = todayAudit;
        }
        setActiveAudit(selected.activeAudit);
        setEquipmentInstances(selected.equipmentInstances || []);
        setResponses(selected.responses || {});
        setSnagItems(selected.snagItems || []);
        setAuditLogs(selected.activeAudit?.auditLogs || []);
      }
    } catch (err) {
      console.warn('[HTYardAudit] Error loading audits:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshDrafts = async () => {
    setIsRefreshingDrafts(true);
    toast.loading('Fetching latest cloud & local drafts...', { id: 'refresh-drafts' });
    try {
      await loadAudits();
      toast.success('Drafts list updated successfully!', { id: 'refresh-drafts' });
    } catch (err: any) {
      toast.error('Failed to refresh drafts: ' + (err?.message || 'Error'), { id: 'refresh-drafts' });
    } finally {
      setIsRefreshingDrafts(false);
    }
  };

  const handleDuplicateAuditDraft = async (draftToClone: any) => {
    const origSite = draftToClone.activeAudit?.siteName || 'Site Audit';
    const clonedSiteName = `${origSite} (Copy)`;
    const newAuditId = `audit-${Date.now()}`;
    const newHeader: HTAuditHeader = {
      ...draftToClone.activeAudit,
      id: newAuditId,
      siteName: clonedSiteName,
      referenceNumber: `HT-AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      auditDate: new Date().toISOString().split('T')[0],
      status: 'Draft',
      auditorName: currentUser?.name || 'Sudhan M',
      auditLogs: []
    };
    const clonedInstances = (draftToClone.equipmentInstances || []).map((inst: any) => ({
      ...inst,
      id: `inst-${inst.moduleType.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      auditId: newAuditId
    }));

    const clonedData = {
      activeAudit: newHeader,
      equipmentInstances: clonedInstances,
      responses: { ...(draftToClone.responses || {}) },
      snagItems: (draftToClone.snagItems || []).map((s: any) => ({ ...s, id: `snag-${Date.now()}-${Math.floor(Math.random() * 1000)}` }))
    };

    setActiveAudit(newHeader);
    setEquipmentInstances(clonedInstances);
    setResponses(clonedData.responses);
    setSnagItems(clonedData.snagItems);
    setAuditLogs([]);
    setActiveInstanceId('site_common');
    setShowDraftsModal(false);

    addAuditLog({
      actionType: 'DUPLICATE',
      target: clonedSiteName,
      details: `Cloned audit draft from "${origSite}"`
    });

    await api.saveHTYardAudit(clonedData);
    await loadAudits();
    toast.success(`Created duplicate draft: "${clonedSiteName}"`);
  };

  const handleSeedDemoDrafts = async () => {
    toast.loading('Loading sample multi-user drafts...', { id: 'seed-drafts' });
    try {
      const demoAudit1: HTAuditHeader = {
        id: `audit-demo-whitefield`,
        siteName: 'Whitefield Tech Substation HT Yard',
        referenceNumber: 'HT-AUD-7391',
        auditDate: new Date().toISOString().split('T')[0],
        clientDivision: 'BESCOM East Zone - Tech Corridor',
        status: 'Draft',
        auditorName: 'Ananya Sharma (Senior Auditor)',
        duplicatedStages: {},
        auditLogs: [
          {
            id: 'log-seed-1',
            timestamp: new Date().toLocaleTimeString() + ', ' + new Date().toLocaleDateString(),
            userName: 'Ananya Sharma',
            userRole: 'Senior Auditor',
            actionType: 'CREATE',
            target: 'Whitefield Tech Substation',
            details: 'Initiated take-over audit for 11kV Substation yard'
          }
        ]
      };
      const demoInstances1: HTEquipmentInstance[] = [
        { id: 'inst-rmu-wf', auditId: demoAudit1.id, moduleType: 'RMU', instanceName: 'RMU 1 (Ring Main Unit)', instanceNumber: 1, feederWayCount: 5 },
        { id: 'inst-tr-wf', auditId: demoAudit1.id, moduleType: 'Transformer', instanceName: 'Transformer 1 (1500 kVA)', instanceNumber: 1, feederWayCount: 4 },
        { id: 'inst-ltk-wf', auditId: demoAudit1.id, moduleType: 'LT_Kiosk', instanceName: 'LT Kiosk 1', instanceNumber: 1, feederWayCount: 4 }
      ];
      const demoResponses1: Record<string, HTAuditResponse> = {
        'site_common_perimeter_fencing': {
          auditId: demoAudit1.id,
          equipmentInstanceId: 'site_common',
          moduleType: 'HT_Yard_Common',
          sectionKey: 'statutory_compliance',
          itemNumber: 1,
          fieldKey: 'perimeter_fencing',
          fieldLabel: 'Perimeter Fencing & Boundary Wall',
          responseValue: 'Satisfactory',
          remarks: 'Barbed wire secure, clean boundary',
          photoUrls: []
        },
        'site_common_danger_board': {
          auditId: demoAudit1.id,
          equipmentInstanceId: 'site_common',
          moduleType: 'HT_Yard_Common',
          sectionKey: 'statutory_compliance',
          itemNumber: 2,
          fieldKey: 'danger_board',
          fieldLabel: 'Statutory Caution / Danger Board',
          responseValue: 'Satisfactory',
          remarks: 'Standard statutory board posted',
          photoUrls: []
        },
        'inst-rmu-wf_rmu_gas_pressure': {
          auditId: demoAudit1.id,
          equipmentInstanceId: 'inst-rmu-wf',
          moduleType: 'RMU',
          sectionKey: 'technical_specifications',
          itemNumber: 1,
          fieldKey: 'rmu_gas_pressure',
          fieldLabel: 'SF6 Gas Pressure Indicator',
          responseValue: 'Satisfactory',
          remarks: 'SF6 pressure normal at 2.4 bar',
          photoUrls: []
        }
      };
      const demoSnags1: HTSnagItem[] = [
        {
          id: 'snag-demo-1',
          auditId: demoAudit1.id,
          equipmentInstanceId: 'inst-tr-wf',
          itemNumber: 1,
          snagPoint: 'Minor oil seepage observed near conservator drain valve',
          actionSuggested: 'Replace rubber gasket during scheduled weekend maintenance',
          status: 'Open',
          targetDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]
        }
      ];

      const demoAudit2: HTAuditHeader = {
        id: `audit-demo-ecity`,
        siteName: 'Electronic City Phase 2 Substation',
        referenceNumber: 'HT-AUD-5182',
        auditDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        clientDivision: 'BESCOM South Division',
        status: 'Draft',
        auditorName: 'Rajesh Kumar (Field Engineer)',
        duplicatedStages: {},
        auditLogs: [
          {
            id: 'log-seed-2',
            timestamp: new Date().toLocaleTimeString() + ', ' + new Date().toLocaleDateString(),
            userName: 'Rajesh Kumar',
            userRole: 'Field Engineer',
            actionType: 'CREATE',
            target: 'Electronic City Phase 2',
            details: 'Created draft inspection for 33kV switchgear & RMU units'
          }
        ]
      };
      const demoInstances2: HTEquipmentInstance[] = [
        { id: 'inst-rmu-ec', auditId: demoAudit2.id, moduleType: 'RMU', instanceName: 'RMU Incomer 1', instanceNumber: 1, feederWayCount: 4 },
        { id: 'inst-vcb-ec', auditId: demoAudit2.id, moduleType: 'VCB', instanceName: 'VCB Panel 1', instanceNumber: 1, feederWayCount: 3 }
      ];
      const demoResponses2: Record<string, HTAuditResponse> = {
        'site_common_earth_pit_count': {
          auditId: demoAudit2.id,
          equipmentInstanceId: 'site_common',
          moduleType: 'HT_Yard_Common',
          sectionKey: 'earth_pit_log',
          itemNumber: 1,
          fieldKey: 'earth_pit_count',
          fieldLabel: 'Earth Pit Interconnection',
          responseValue: 'Satisfactory',
          remarks: '6 earth pits verified and connected',
          photoUrls: []
        }
      };

      await api.saveHTYardAudit({ activeAudit: demoAudit1, equipmentInstances: demoInstances1, responses: demoResponses1, snagItems: demoSnags1 });
      await api.saveHTYardAudit({ activeAudit: demoAudit2, equipmentInstances: demoInstances2, responses: demoResponses2, snagItems: [] });
      await loadAudits();
      toast.success('Sample multi-user drafts generated successfully!', { id: 'seed-drafts' });
    } catch (err: any) {
      toast.error('Failed to seed drafts: ' + (err?.message || 'Error'), { id: 'seed-drafts' });
    }
  };

  const handleManualSync = React.useCallback(async () => {
    setIsSyncing(true);
    try {
      const allOutbox = await outbox.getAll();
      if (allOutbox.length === 0) {
        toast.success('All Site Audits are already synced to cloud!');
        setIsSyncing(false);
        return;
      }
      toast.loading(`Syncing ${allOutbox.length} offline item(s)...`, { id: 'manual-ht-sync' });
      const result = await syncEngine.drain();
      const remainingFailed = await outbox.getFailed();

      if (remainingFailed.length > 0) {
        toast.error(`Sync finished: ${result.synced} synced, ${remainingFailed.length} failed. Opening diagnostics...`, {
          id: 'manual-ht-sync',
          duration: 5000,
        });
        setShowDebugModal(true);
      } else {
        toast.success(`✅ Successfully synced ${result.synced} item(s)!`, { id: 'manual-ht-sync' });
      }
      await loadAudits();
      await updateOutboxCount();
    } catch (err: any) {
      toast.error(`Sync error: ${err?.message || 'Unknown error'}`, { id: 'manual-ht-sync' });
    } finally {
      setIsSyncing(false);
    }
  }, [loadAudits, updateOutboxCount]);

  // Load saved audit list on mount
  useEffect(() => {
    loadAudits();
  }, []);

  const handleSelectAudit = (item: any) => {
    setActiveAudit(item.activeAudit);
    setEquipmentInstances(item.equipmentInstances || []);
    setResponses(item.responses || {});
    setSnagItems(item.snagItems || []);
    setAuditLogs(item.activeAudit?.auditLogs || []);
    setActiveInstanceId('site_common');
    setShowSiteDropdown(false);
    setShowDraftsModal(false);
    toast.success(`Switched to ${item.activeAudit.siteName}`);
  };

  const handleDeleteAuditClick = (auditId: string, siteName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAuditToDelete({ id: auditId, siteName });
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteAudit = async () => {
    if (!auditToDelete) return;
    const targetId = auditToDelete.id;
    toast.loading('Deleting audit...', { id: 'delete-ht-audit' });
    try {
      addAuditLog({ actionType: 'DELETE', target: auditToDelete.siteName, details: `Deleted audit session for "${auditToDelete.siteName}"` });
      await api.deleteHTYardAudit(targetId);
      const updatedList = allAudits.filter(a => a.activeAudit?.id !== targetId);
      setAllAudits(updatedList);

      if (activeAudit?.id === targetId) {
        if (updatedList.length > 0) {
          const next = updatedList[0];
          setActiveAudit(next.activeAudit);
          setEquipmentInstances(next.equipmentInstances || []);
          setResponses(next.responses || {});
          setSnagItems(next.snagItems || []);
        } else {
          setActiveAudit(null);
          setEquipmentInstances([]);
          setResponses({});
          setSnagItems([]);
        }
      }
      setShowDeleteModal(false);
      setAuditToDelete(null);
      toast.success('Site Audit deleted successfully!', { id: 'delete-ht-audit' });
    } catch (err) {
      toast.error('Failed to delete audit.', { id: 'delete-ht-audit' });
    }
  };

  const handleDuplicatedStagesChange = React.useCallback((updatedStages: Record<string, { id: string; label: string }[]>) => {
    if (!activeAudit) return;
    const updatedHeader = { ...activeAudit, duplicatedStages: updatedStages };
    setActiveAudit(updatedHeader);
    api.saveHTYardAudit({
      activeAudit: updatedHeader,
      equipmentInstances,
      responses,
      snagItems
    });
  }, [activeAudit, equipmentInstances, responses, snagItems]);

  const handleSaveAuditToDatabase = async () => {
    if (!activeAudit) return;
    toast.loading('Saving audit data to database...', { id: 'save-ht-audit' });
    try {
      const updatedAudit = { ...activeAudit, auditLogs };
      await api.saveHTYardAudit({
        activeAudit: updatedAudit,
        equipmentInstances,
        responses,
        snagItems
      });
      addAuditLog({ actionType: 'SAVE', target: activeAudit.siteName, details: `Saved audit data to database successfully` });
      toast.success('HT Yard audit saved to database successfully!', { id: 'save-ht-audit' });
    } catch (err) {
      toast.error('Failed to save audit to database.', { id: 'save-ht-audit' });
    }
  };

  const handleCreateNewAudit = (siteName: string, division: string) => {
    const trimmedSite = (siteName || 'Prestige Tech Park HT Yard').trim();

    // Check if an audit with the same site name already exists (case-insensitive)
    const existingAudit = allAudits.find(
      (a) => a.activeAudit?.siteName?.trim().toLowerCase() === trimmedSite.toLowerCase()
    );

    if (existingAudit) {
      toast.error(`An audit for "${existingAudit.activeAudit.siteName}" already exists! Switched to existing audit.`, { id: 'dup-audit-error', duration: 4000 });
      handleSelectAudit(existingAudit);
      setShowNewAuditModal(false);
      return;
    }

    const auditId = `audit-${Date.now()}`;
    const newAudit: HTAuditHeader = {
      id: auditId,
      siteName: trimmedSite,
      referenceNumber: `HT-AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      auditDate: new Date().toISOString().split('T')[0],
      clientDivision: division.trim() || 'BESCOM East Division',
      status: 'Draft',
      auditorName: currentUser?.name || 'Sudhan M',
      auditLogs: []
    };

    const defaultInstances: HTEquipmentInstance[] = [
      { id: `inst-rmu-1`, auditId, moduleType: 'RMU', instanceName: 'RMU 1', instanceNumber: 1, feederWayCount: 5 },
      { id: `inst-tr-1`, auditId, moduleType: 'Transformer', instanceName: 'Transformer 1', instanceNumber: 1, feederWayCount: 4 },
      { id: `inst-ltk-1`, auditId, moduleType: 'LT_Kiosk', instanceName: 'LT Kiosk 1', instanceNumber: 1, feederWayCount: 4 }
    ];

    const initialAuditData = {
      activeAudit: newAudit,
      equipmentInstances: defaultInstances,
      responses: {},
      snagItems: []
    };

    setActiveAudit(newAudit);
    setEquipmentInstances(defaultInstances);
    setResponses({});
    setSnagItems([]);
    setAuditLogs([]);
    setActiveInstanceId('site_common');
    setShowNewAuditModal(false);
    addAuditLog({ actionType: 'CREATE', target: trimmedSite, details: `Created new HT Yard audit draft for "${trimmedSite}"` });
    api.saveHTYardAudit(initialAuditData).then(() => {
      loadAudits();
    });
    toast.success('Started and saved new HT Yard audit session');
  };

  const addEquipmentInstance = (moduleType: HTEquipmentModuleType) => {
    if (!activeAudit) return;
    const sameTypeCount = equipmentInstances.filter(e => e.moduleType === moduleType).length;
    const newInst: HTEquipmentInstance = {
      id: `inst-${moduleType.toLowerCase()}-${Date.now()}`,
      auditId: activeAudit.id,
      moduleType,
      instanceName: `${moduleType.replace('_', ' ')} ${sameTypeCount + 1}`,
      instanceNumber: sameTypeCount + 1,
      feederWayCount: 4
    };
    setEquipmentInstances([...equipmentInstances, newInst]);
    setActiveInstanceId(newInst.id);
    addAuditLog({ actionType: 'CREATE', target: moduleType, details: `Added new equipment unit "${newInst.instanceName}"` });
    toast.success(`Added ${newInst.instanceName}`);
  };

  const handleResponseChange = (key: string, val: Partial<HTAuditResponse>) => {
    setResponses((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...val } as HTAuditResponse
    }));
  };

  const handleExportExcel = () => {
    if (!activeAudit) return;
    htYardExporter.exportToExcel(activeAudit, equipmentInstances, responses, snagItems);
    toast.success('Exporting multi-sheet Excel workbook...');
  };

  const handleExportPDF = () => {
    if (!activeAudit) return;
    htYardExporter.exportToPDF(activeAudit, equipmentInstances, responses, snagItems);
    toast.success('Exporting PDF inspection report...');
  };

  const activeInstance = equipmentInstances.find(i => i.id === activeInstanceId);
  const activeSpec = activeInstance ? HT_YARD_FIELD_SPECS[activeInstance.moduleType] : null;

  // Stats calculation
  const totalResponses = Object.keys(responses).length;
  const openSnagsCount = snagItems.filter(s => s.status !== 'Closed').length;
  const totalEquipmentCount = equipmentInstances.length;

  // Asset QR Tags calculation strictly from real equipment instances
  const currentAssetTags = equipmentInstances.map(inst => {
    return htAssetQrService.buildAssetTagData(
      inst.id,
      inst.instanceName || (inst as any).name || `${inst.moduleType} Unit`,
      inst.moduleType,
      inst.metadata?.manufacturer || (inst as any).manufacturer || 'OEM Standard',
      inst.metadata?.modelNumber || (inst as any).modelNumber || `${inst.moduleType}-Standard`,
      '11 kV / 415 V',
      '630 A / 500 kVA',
      activeAudit?.siteName || 'Main Substation Yard',
      inst.metadata?.serialNumber || (inst as any).serialNumber,
      2024,
      1,
      activeAudit?.auditDate
    );
  });

  const activeAssetTag = currentAssetTags.find(t => t.assetId === activeInstanceId) || currentAssetTags[0] || htAssetQrService.buildAssetTagData(
    activeAudit?.id || 'AUDIT-DEFAULT',
    activeAudit?.siteName || 'Substation Yard',
    'RMU',
    'OEM Standard',
    'Standard Model',
    '11 kV',
    '630 A',
    activeAudit?.siteName || 'Main Substation Yard'
  );

  // Loading Spinner while checking database / local storage
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin text-emerald-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Loading HT Yard Audit</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Retrieving inspection data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty State when no active audit exists
  if (!activeAudit) {
    return (
      <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-4 sm:p-6 pb-32 md:pb-6 flex flex-col items-center justify-center relative overflow-hidden">
        
        <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-900/40 [mask-image:linear-gradient(0deg,transparent,black)] pointer-events-none" />
        
        <div className="relative z-10 max-w-xl w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-10 text-center shadow-xl shadow-slate-200/20 dark:shadow-none space-y-6">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-2xl flex items-center justify-center mx-auto transform rotate-3 shadow-xs">
            <Zap className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
              Start or Resume a Site Audit
            </h1>
            
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
              Create a new HT Yard Take-Over inspection or browse previously created drafts and unsaved inspection sessions from all engineers.
            </p>
          </div>
          
          {/* Main Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setShowNewAuditModal(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" /> Start Fresh Audit
            </button>

            <button
              onClick={() => setShowDraftsModal(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <FolderOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>View Saved Drafts</span>
              {allAudits.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold">
                  {allAudits.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick Preview of Recent Drafts if any exist */}
          {allAudits.length > 0 ? (
            <div className="pt-5 border-t border-slate-100 dark:border-slate-800 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Recent Saved Audits & Drafts
                </span>
                <button
                  onClick={() => setShowDraftsModal(true)}
                  className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  View All ({allAudits.length}) <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {allAudits.slice(0, 3).map((item) => (
                  <div
                    key={item.activeAudit?.id || Math.random()}
                    onClick={() => handleSelectAudit(item)}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 border border-slate-200/70 dark:border-slate-800 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors">
                          {item.activeAudit?.siteName}
                        </h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                          {item.activeAudit?.status || 'Draft'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>{item.activeAudit?.referenceNumber}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User size={11} className="text-slate-400" />
                          {item.activeAudit?.auditorName || 'Field Engineer'}
                        </span>
                        <span>•</span>
                        <span>{item.equipmentInstances?.length || 0} Units</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1">
                        Resume <ArrowUpRight size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2">
              <button
                onClick={handleSeedDemoDrafts}
                className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1.5 py-1"
              >
                <Sparkles size={14} /> Load Sample Multi-User Drafts for Demo
              </button>
            </div>
          )}
        </div>

        {/* New Audit Modal */}
        {showNewAuditModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-600" /> Start New HT Yard Audit
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Site / Substation Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Prestige Tech Park HT Yard"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Client / BESCOM Division
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BESCOM East Division"
                    value={newClientDivision}
                    onChange={(e) => setNewClientDivision(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setShowNewAuditModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCreateNewAudit(newSiteName, newClientDivision)}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all"
                >
                  Create Audit Draft
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Drafts Hub Modal */}
        <AuditDraftsModal
          isOpen={showDraftsModal}
          onClose={() => setShowDraftsModal(false)}
          allAudits={allAudits}
          activeAuditId={activeAudit ? (activeAudit as any).id : undefined}
          onSelectAudit={handleSelectAudit}
          onDeleteAudit={handleDeleteAuditClick}
          onDuplicateAudit={handleDuplicateAuditDraft}
          onRefreshList={handleRefreshDrafts}
          onStartNewAudit={() => setShowNewAuditModal(true)}
          onSeedDemoDrafts={handleSeedDemoDrafts}
          currentUserName={currentUser?.name || 'Sudhan M'}
          isRefreshing={isRefreshingDrafts}
        />

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Site Audit?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you sure you want to delete the audit for <strong className="text-slate-800 dark:text-slate-200">"{auditToDelete?.siteName}"</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setAuditToDelete(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteAudit}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Audit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 pb-32 md:pb-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
            <Zap className="w-4 h-4" /> HT Yard / Site Take-Over Audit
          </div>
          <div className="relative inline-block">
            <button
              onClick={() => setShowSiteDropdown(!showSiteDropdown)}
              className="flex items-center gap-2 group text-left focus:outline-hidden"
            >
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight group-hover:text-emerald-600 transition-colors">
                {activeAudit?.siteName || 'Site Audit'}
              </h1>
              <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950 text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 transition-all">
                <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showSiteDropdown ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Dropdown Menu */}
            {showSiteDropdown && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-2 space-y-1">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Site Audit</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {allAudits.length} Audits
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1 py-1">
                  {allAudits.map((item) => {
                    const isToday = item.activeAudit?.auditDate === new Date().toISOString().split('T')[0];
                    const isSelected = item.activeAudit?.id === activeAudit?.id;
                    return (
                      <div
                        key={item.activeAudit?.id || Math.random()}
                        onClick={() => handleSelectAudit(item)}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {item.activeAudit?.siteName}
                            </span>
                            {isToday && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                                Today
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                            <span className="font-mono">{item.activeAudit?.referenceNumber}</span>
                            <span>•</span>
                            <span>{item.activeAudit?.auditDate}</span>
                            <SyncStatusBadge pending={item.activeAudit?.pending} failed={item.activeAudit?.failed} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-1" />}
                          <button
                            onClick={(e) => handleDeleteAuditClick(item.activeAudit?.id, item.activeAudit?.siteName, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                            title="Delete Audit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setShowSiteDropdown(false);
                      setShowDraftsModal(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4 text-emerald-600" /> View All Drafts & Audits ({allAudits.length})
                  </button>
                  <button
                    onClick={() => {
                      setShowSiteDropdown(false);
                      setShowNewAuditModal(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Start Another New Audit
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Ref: <strong className="font-mono text-slate-700 dark:text-slate-300">{activeAudit?.referenceNumber}</strong></span>
            <span>•</span>
            <span>Date: <strong className="text-slate-700 dark:text-slate-300">{activeAudit?.auditDate}</strong></span>
            <span>•</span>
            <span>Division: <strong className="text-slate-700 dark:text-slate-300">{activeAudit?.clientDivision}</strong></span>
          </p>
        </div>

        {/* Top CTA Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowDraftsModal(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-2xs"
            title="Browse all drafts, other users' drafts, and unsaved sessions"
          >
            <FolderOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Drafts ({allAudits.length})</span>
          </button>
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
            onClick={handleSaveAuditToDatabase}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Audit
          </button>
          <button
            onClick={() => setShowNewAuditModal(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-700"
          >
            <Plus className="w-4 h-4 text-slate-600 dark:text-slate-400" /> New Audit
          </button>
          <button
            onClick={() => activeAudit && handleDeleteAuditClick(activeAudit.id, activeAudit.siteName)}
            className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-rose-200/80 dark:border-rose-800"
            title="Delete Active Audit"
          >
            <Trash2 className="w-4 h-4 text-rose-600" /> Delete Audit
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-emerald-200/80 dark:border-emerald-800"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> Export PDF Report
          </button>
        </div>
      </div>

      {/* ─── ASSET QR TAGS METADATA ─── */}
      {(() => {
        return null;
      })()}

      {/* ─── PRIMARY VIEW SWITCHER: Audit Execution vs PPM Maintenance Calendar ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveDashboardView('AUDIT_EXECUTION')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeDashboardView === 'AUDIT_EXECUTION'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" /> ⚡ Site Audit & Equipment Cards
          </button>
          <button
            type="button"
            onClick={() => setActiveDashboardView('PPM_CALENDAR')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeDashboardView === 'PPM_CALENDAR'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" /> 🗓️ PPM Maintenance Calendar & Checklists
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowQrPrintModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <QrCode className="w-4 h-4" /> 🏷️ Generate & Print Asset QR Tags ({equipmentInstances.length || 3})
        </button>
      </div>

      {/* RENDER PPM CALENDAR IF ACTIVE */}
      {activeDashboardView === 'PPM_CALENDAR' ? (
        <HTPpmCalendarView />
      ) : (
        <>
          {/* Metric Stat Cards (Matching CRM Pipeline Top Bar) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Equipment Fleet */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Equipment Units</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalEquipmentCount} <span className="text-xs font-normal text-slate-500">instances</span></div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 inline-block">RMU, Transformer, Kiosk</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                <Cpu className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2: Field Checklist Inputs */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Checked Items</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalResponses} <span className="text-xs font-normal text-slate-500">recorded</span></div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 inline-block">Field observations logged</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                <Activity className="w-6 h-6" />
              </div>
            </div>

            {/* Card 3: Open Snag Defects */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Open Snags</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{openSnagsCount} <span className="text-xs font-normal text-slate-500">defects</span></div>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 inline-block">Requires action plan</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            {/* Card 4: Audit Status */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Audit State</span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{activeAudit?.status || 'Draft'}</div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 inline-block">Ready for review</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

      {/* Equipment Navigation Toolbar (Matching CRM Tab Filters) */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 max-w-full">
          <button
            onClick={() => setActiveInstanceId('site_common')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeInstanceId === 'site_common'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Yard Common & HIRA
          </button>

          {equipmentInstances.map((inst) => (
            <button
              key={inst.id}
              onClick={() => setActiveInstanceId(inst.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeInstanceId === inst.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" /> {inst.instanceName}
            </button>
          ))}
        </div>

        {/* Add Equipment Dropdown Button */}
        <div className="relative group ml-auto">
          <button className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all">
            <Plus className="w-4 h-4" /> Add Equipment Unit
          </button>
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl hidden group-hover:block z-30 p-1.5 space-y-1">
            {(['RMU', 'Transformer', 'LT_Kiosk', 'VCB', 'Switchgear', 'HT_Panel', 'Meter_Cubicle', 'CSS'] as HTEquipmentModuleType[]).map((type) => (
              <button
                key={type}
                onClick={() => addEquipmentInstance(type)}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-between"
              >
                <span>+ Add {type.replace('_', ' ')}</span>
                <span className="text-[10px] text-slate-400 font-mono">Unit</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Workspace Section */}
      {activeInstanceId === 'site_common' ? (
        <div className="space-y-6">
          <HTAuditFormEngine
            spec={HT_YARD_FIELD_SPECS.HT_Yard_Common}
            equipmentInstanceId="site_common"
            responses={responses}
            onChangeResponse={handleResponseChange}
            onLogAction={addAuditLog}
            duplicatedStages={activeAudit?.duplicatedStages}
            onDuplicatedStagesChange={handleDuplicatedStagesChange}
            customStages={[
              {
                key: 'earth_pit_log',
                title: 'Earth Pit Inspection Log',
                subtitle: 'Auto-calculated based on units',
                content: (
                  <HTEarthPitRegister
                    equipmentInstances={equipmentInstances}
                    responses={responses}
                    onChangeResponse={handleResponseChange}
                  />
                )
              },
              {
                key: 'snag_list',
                title: 'Snag & Punch List',
                subtitle: 'Site-wide defect log',
                content: (
                  <HTSnagListManager
                    snagItems={snagItems}
                    onChange={setSnagItems}
                  />
                )
              }
            ]}
          />
        </div>
      ) : activeInstance && activeSpec ? (
        <div className="space-y-6">
          <HTAuditFormEngine
            spec={activeSpec}
            equipmentInstanceId={activeInstance.id}
            responses={responses}
            onChangeResponse={handleResponseChange}
            onLogAction={addAuditLog}
            duplicatedStages={activeAudit?.duplicatedStages}
            onDuplicatedStagesChange={handleDuplicatedStagesChange}
            customStages={[
              ...((activeInstance.moduleType === 'RMU' || activeInstance.moduleType === 'VCB' || activeInstance.moduleType === 'LT_Kiosk')
                ? [
                    {
                      key: 'feeder_sections',
                      title: 'Feeder & Section Blocks',
                      subtitle: `${activeInstance.feederWayCount || 4} Ways Configured`,
                      content: (
                        <HTFeederRepeater
                          moduleType={activeInstance.moduleType}
                          feederCount={activeInstance.feederWayCount || 4}
                          equipmentInstanceId={activeInstance.id}
                          responses={responses}
                          onChangeResponse={handleResponseChange}
                        />
                      )
                    }
                  ]
                : []),
              {
                key: 'snag_list',
                title: 'Snag & Punch List',
                subtitle: `${activeInstance.instanceName} defect log`,
                content: (
                  <HTSnagListManager
                    snagItems={snagItems.filter(s => s.equipmentInstanceId === activeInstance.id)}
                    onChange={(updatedInstanceSnags) => {
                      const otherSnags = snagItems.filter(s => s.equipmentInstanceId !== activeInstance.id);
                      const tagged = updatedInstanceSnags.map(s => ({ ...s, equipmentInstanceId: activeInstance.id }));
                      setSnagItems([...otherSnags, ...tagged]);
                    }}
                    equipmentInstanceName={activeInstance.instanceName}
                  />
                )
              }
            ]}
          />
        </div>
      ) : null}
      </>
      )}

      {/* New Audit Modal */}
      {showNewAuditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-600" /> Start New HT Yard Audit
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Site / Substation Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prestige Tech Park HT Yard"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border ${
                    newSiteName.trim() && allAudits.some(a => a.activeAudit?.siteName?.trim().toLowerCase() === newSiteName.trim().toLowerCase())
                      ? 'border-amber-400 dark:border-amber-600 focus:ring-amber-500/20'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-600'
                  } dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2`}
                />
                {newSiteName.trim() && allAudits.some(a => a.activeAudit?.siteName?.trim().toLowerCase() === newSiteName.trim().toLowerCase()) && (
                  <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> An audit for "{newSiteName.trim()}" already exists. Proceeding will switch to the existing audit.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Client / BESCOM Division
                </label>
                <input
                  type="text"
                  placeholder="e.g. BESCOM East Division"
                  value={newClientDivision}
                  onChange={(e) => setNewClientDivision(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowNewAuditModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreateNewAudit(newSiteName, newClientDivision)}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all ${
                  newSiteName.trim() && allAudits.some(a => a.activeAudit?.siteName?.trim().toLowerCase() === newSiteName.trim().toLowerCase())
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {newSiteName.trim() && allAudits.some(a => a.activeAudit?.siteName?.trim().toLowerCase() === newSiteName.trim().toLowerCase())
                  ? 'Switch to Existing Audit'
                  : 'Create Audit Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Site Audit?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete the audit for <strong className="text-slate-800 dark:text-slate-200">"{auditToDelete?.siteName}"</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setAuditToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteAudit}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Audit
              </button>
            </div>
          </div>
        </div>
      )}
      <SyncDebugModal
        isOpen={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        onRefreshList={loadAudits}
      />
      <AuditDraftsModal
        isOpen={showDraftsModal}
        onClose={() => setShowDraftsModal(false)}
        allAudits={allAudits}
        activeAuditId={activeAudit ? activeAudit.id : undefined}
        onSelectAudit={handleSelectAudit}
        onDeleteAudit={handleDeleteAuditClick}
        onDuplicateAudit={handleDuplicateAuditDraft}
        onRefreshList={handleRefreshDrafts}
        onStartNewAudit={() => setShowNewAuditModal(true)}
        onSeedDemoDrafts={handleSeedDemoDrafts}
        currentUserName={currentUser?.name || 'Sudhan M'}
        isRefreshing={isRefreshingDrafts}
      />

      {/* ─── Audit Log Details Modal ────────────────────────────────────────── */}
      {showLogModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight">Audit Activity & Change Log</h3>
                  <p className="text-xs text-slate-300">Detailed track log of user actions (Add, Edit, Delete, Duplicate)</p>
                </div>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Filters */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by user, target or action..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold overflow-x-auto pb-1 sm:pb-0">
                {['ALL', 'CREATE', 'EDIT', 'DELETE', 'DUPLICATE', 'SAVE'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setLogActionFilter(type)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase transition-all ${
                      logActionFilter === type
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Log List */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {(() => {
                const filtered = auditLogs.filter(log => {
                  const matchesFilter = logActionFilter === 'ALL' || log.actionType === logActionFilter;
                  const query = logSearchQuery.toLowerCase();
                  const matchesSearch = !query ||
                    log.userName.toLowerCase().includes(query) ||
                    log.userRole.toLowerCase().includes(query) ||
                    log.target.toLowerCase().includes(query) ||
                    log.details.toLowerCase().includes(query);
                  return matchesFilter && matchesSearch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400">
                      <History size={40} className="mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                      <p className="font-bold text-slate-600 dark:text-slate-400 text-sm">No activity logs found</p>
                      <p className="text-xs mt-1">Actions performed (add, edit, delete, duplicate) will automatically record here.</p>
                    </div>
                  );
                }

                return filtered.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs hover:shadow-xs transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                          log.actionType === 'CREATE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          log.actionType === 'EDIT' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                          log.actionType === 'DELETE' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                          log.actionType === 'DUPLICATE' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {log.actionType}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {log.target}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-medium text-slate-400">
                        {log.timestamp}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {log.details}
                    </p>

                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-slate-400" />
                        <span className="font-bold text-slate-800 dark:text-slate-200">{log.userName}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400">
                          {log.userRole}
                        </span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Total recorded: <strong>{auditLogs.length} entries</strong></span>
              <button
                onClick={() => setShowLogModal(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-90 transition-opacity"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Asset QR Tag & Sticker Print Modal ─── */}
      <HTAssetQrPrintModal
        isOpen={showQrPrintModal}
        onClose={() => setShowQrPrintModal(false)}
        assetTag={activeAssetTag}
        allAssetTags={currentAssetTags}
      />
    </div>
  );
};
