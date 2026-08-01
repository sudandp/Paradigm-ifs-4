import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import type { OnboardingData } from '@/types';
import StatusChip from '@/components/ui/StatusChip';
import Button from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, FileText, Send, RefreshCw, AlertTriangle, Loader2, CheckSquare, XSquare, Square, Edit2, Trash2, Bug, Play, RotateCcw, X, CheckCircle2 } from 'lucide-react';
import Toast from '@/components/ui/Toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { syncEngine } from '@/services/offline/syncEngine';
import * as outbox from '@/services/offline/outbox';
import { getDb } from '@/services/offline/db';
import hotToast from 'react-hot-toast';

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

interface SyncDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshList: () => void;
}

const SyncDebugModal: React.FC<SyncDebugModalProps> = ({ isOpen, onClose, onRefreshList }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadOutbox = useCallback(async () => {
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
      hotToast.success('Item reset to pending for retry');
      loadOutbox();
    } catch (err: any) {
      hotToast.error('Failed to reset item: ' + err?.message);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Remove this item from offline queue?')) return;
    try {
      const db = await getDb();
      await db.delete('outbox', id);
      hotToast.success('Removed outbox item');
      loadOutbox();
      onRefreshList();
    } catch (err: any) {
      hotToast.error('Failed to remove item: ' + err?.message);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    hotToast.loading('Running manual sync...', { id: 'modal-sync' });
    try {
      const res = await syncEngine.drain();
      hotToast.success(`Sync finished: ${res.synced} synced, ${res.failed} failed`, { id: 'modal-sync' });
      await loadOutbox();
      await onRefreshList();
    } catch (err: any) {
      hotToast.error('Sync failed: ' + err?.message, { id: 'modal-sync' });
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
              <h3 className="font-bold text-lg">Onboarding Sync Diagnostics</h3>
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


const VerificationChecks: React.FC<{ submission: OnboardingData; isSyncing: boolean }> = ({ submission, isSyncing }) => {
    if (submission.status !== 'verified' || !submission.portalSyncStatus) {
        return <span className="text-sm font-medium text-gray-500 md:text-muted">-</span>;
    }

    if (isSyncing) {
        return <div className="flex items-center gap-2 text-sm text-gray-400 md:text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Syncing...</div>;
    }

    const isUanApplicable = submission.uan?.hasPreviousPf;

    const checks = [
        { label: 'Aadhaar', verified: submission.personal?.verifiedStatus?.idProofNumber },
        { label: 'Bank', verified: submission.bank?.verifiedStatus?.accountNumber },
        ...(isUanApplicable ? [{ label: 'UAN', verified: submission.uan?.verifiedStatus?.uanNumber }] : [])
    ];

    const hasSyncedOrFailed = submission.portalSyncStatus === 'synced' || submission.portalSyncStatus === 'failed';

    const CheckItem: React.FC<{ label: string, status: boolean | null | undefined }> = ({ label, status }) => {
        const isChecked = hasSyncedOrFailed && status === true;
        const isFailed = hasSyncedOrFailed && status === false;

        const Icon = isChecked ? CheckSquare : (isFailed ? XSquare : Square);
        const color = isChecked ? 'text-[#22c55e] md:text-green-600' : (isFailed ? 'text-red-500 md:text-red-600' : 'text-gray-500 md:text-muted');
        const title = isChecked ? 'Verified' : (isFailed ? 'Failed' : 'Pending Verification');

        return (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`} title={title}>
                <Icon className="h-4 w-4" />
                <span className="text-gray-300 md:text-current">{label}</span>
            </div>
        );
    };

    return (
        <div className="flex flex-row gap-3 items-center">
            {checks.map(check => (
                <CheckItem key={check.label} label={check.label} status={check.verified} />
            ))}
        </div>
    );
};


import { useAuthStore } from '@/store/authStore';
import { usePermissionsStore } from '@/store/permissionsStore';
import { isAdmin } from '@/utils/auth';
import { ShieldAlert } from 'lucide-react';

const VerificationDashboard: React.FC = () => {
    const { user } = useAuthStore();
    const { permissions } = usePermissionsStore();

    const hasAccess = useMemo(() => {
        if (!user) return false;
        if (isAdmin(user.role)) return true;
        const roleId = user.roleId?.toLowerCase() || '';
        const roleName = user.role?.toLowerCase() || '';
        const roleNameUnderscore = roleName.replace(/\s+/g, '_');
        const roleNameHyphen = roleName.replace(/\s+/g, '-');
        const directPerms = (user as any).permissions || [];

        const userPerms = permissions[user.roleId] || 
               permissions[roleId] || 
               permissions[user.role] || 
               permissions[roleName] || 
               permissions[roleNameUnderscore] || 
               permissions[roleNameHyphen] || 
               [];
        const combined = [...new Set([...userPerms, ...directPerms])];
        return combined.includes('view_all_submissions');
    }, [user, permissions]);

    const [submissions, setSubmissions] = useState<OnboardingData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');

    const [pendingOrFailedCount, setPendingOrFailedCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showDebugModal, setShowDebugModal] = useState(false);

    const updateOutboxCount = useCallback(async () => {
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

    const fetchSubmissions = useCallback(async (showSkeleton = false) => {
        if (showSkeleton) setIsLoading(true);
        try {
            const data = await api.getVerificationSubmissions(statusFilter === 'all' ? undefined : statusFilter);
            setSubmissions(data);
        } catch (error) {
            console.error("Failed to fetch submissions", error);
        } finally {
            if (showSkeleton) setIsLoading(false);
        }
    }, [statusFilter]);

    const handleManualSync = useCallback(async () => {
      setIsSyncing(true);
      try {
        const allOutbox = await outbox.getAll();
        if (allOutbox.length === 0) {
          hotToast.success('All onboarding submissions are synced!');
          setIsSyncing(false);
          return;
        }
        hotToast.loading(`Syncing ${allOutbox.length} offline item(s)...`, { id: 'manual-onboarding-sync' });
        const result = await syncEngine.drain();
        const remainingFailed = await outbox.getFailed();

        if (remainingFailed.length > 0) {
          hotToast.error(`Sync finished: ${result.synced} synced, ${remainingFailed.length} failed. Opening diagnostics...`, {
            id: 'manual-onboarding-sync',
            duration: 5000,
          });
          setShowDebugModal(true);
        } else {
          hotToast.success(`✅ Successfully synced ${result.synced} item(s)!`, { id: 'manual-onboarding-sync' });
        }
        await fetchSubmissions(false);
        await updateOutboxCount();
      } catch (err: any) {
        hotToast.error(`Sync error: ${err?.message || 'Unknown error'}`, { id: 'manual-onboarding-sync' });
      } finally {
        setIsSyncing(false);
      }
    }, [fetchSubmissions, updateOutboxCount]);

    useEffect(() => {
        fetchSubmissions(true);

        // REAL-TIME LISTENER
        const channel = supabase.channel('submissions-feed')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'onboarding_submissions' },
                (payload) => {
                    console.log('Real-time change received!', payload);
                    // Background refresh without flashing skeleton
                    fetchSubmissions(false);
                }
            )
            .subscribe();

        // Cleanup function to remove the subscription when the component unmounts
        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchSubmissions]);

    const filteredSubmissions = useMemo(() => {
        if (!submissions) return [];
        return submissions.filter(s => {
            const siteName = s.organizationName || s.organization?.organizationName || '';
            return (
                s.personal.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.personal.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.personal.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                siteName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        });
    }, [submissions, searchTerm]);

    const handleAction = async (action: 'approve' | 'reject', id: string) => {
        // Optimistic update for UI responsiveness
        setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: action === 'approve' ? 'verified' : 'rejected', portalSyncStatus: action === 'approve' ? 'pending_sync' : undefined } : s));

        try {
            if (action === 'approve') {
                await api.verifySubmission(id);
            } else {
                await api.requestChanges(id, 'Changes requested by admin.');
            }
        } catch (error) {
            console.error(`Failed to ${action} submission`, error);
            // On error, the real-time listener will revert the UI automatically by re-fetching
        }
    };

    const handleSync = async (id: string) => {
        setSyncingId(id);
        try {
            // The sync function now returns the updated submission
            const updatedSubmission = await api.syncPortals(id);
            // We can update the state directly, but the real-time listener will also catch this
            setSubmissions(prev => prev.map(s => s.id === id ? updatedSubmission : s));
            if (updatedSubmission.portalSyncStatus === 'synced') {
                setToast({ message: 'Portals synced successfully!', type: 'success' });
            } else {
                setToast({ message: 'Portal sync failed. Check details.', type: 'error' });
            }
        } catch (error) {
            setToast({ message: 'An error occurred during sync.', type: 'error' });
        } finally {
            setSyncingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this submission? This action cannot be undone.")) return;
        try {
            await api.deleteOnboardingSubmission(id);
            setToast({ message: 'Submission deleted successfully!', type: 'success' });
            fetchSubmissions(false);
        } catch (error) {
            console.error("Failed to delete submission", error);
            setToast({ message: 'Failed to delete submission.', type: 'error' });
        }
    };

    const filterTabs = ['all', 'pending', 'verified', 'rejected'];
    const colSpan = statusFilter === 'verified' ? 4 : 5;

    // Calculate counts for each status
    const counts = useMemo(() => {
        return {
            all: submissions.length,
            pending: submissions.filter(s => s.status === 'pending').length,
            verified: submissions.filter(s => s.status === 'verified').length,
            rejected: submissions.filter(s => s.status === 'rejected').length
        };
    }, [submissions]);

    if (!hasAccess) {
        return (
            <div className="p-8 flex-1 flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mb-4 border border-rose-200 shadow-sm">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Access Restricted</h2>
                <p className="text-slate-500 max-w-md mt-2 text-sm">
                    You do not have permission to view Onboarding Forms & Submissions. Please request the <strong className="text-slate-700 font-bold">View All Submissions</strong> permission from your administrator.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-6 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                    Return to Home
                </button>
            </div>
        );
    }

    return (
        <div className="p-3 md:p-4 flex-1 flex flex-col bg-[#041b0f] md:bg-transparent min-h-screen md:min-h-0">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            <div className="mb-4 flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white md:text-gray-900 tracking-tight mb-0.5">Onboarding Forms</h2>
                    <p className="text-gray-400 md:text-gray-500 text-sm">Manage and verify employee onboarding submissions across organizations</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 ${
                        pendingOrFailedCount > 0
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-200'
                      }`}
                      title="Trigger immediate sync of all offline records"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing...' : `Sync Now${pendingOrFailedCount > 0 ? ` (${pendingOrFailedCount})` : ''}`}
                    </button>
                    <button
                      onClick={() => setShowDebugModal(true)}
                      className="px-3.5 py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-gray-200"
                      title="View sync diagnostics and error tracebacks"
                    >
                      <Bug className="w-4 h-4 text-amber-500" /> Debug
                    </button>
                </div>
            </div>

            <div className="bg-gradient-to-br from-[#0c2a1b] to-[#06180f] md:bg-none md:bg-white rounded-[16px] md:rounded-xl shadow-sm border border-[#1d422f] md:border-gray-100 overflow-hidden flex-1 flex flex-col">
                <div className="p-4 border-b border-[#1d422f] md:border-gray-100 bg-[#0b291a]/50 md:bg-gray-50/30 flex-shrink-0">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                        <div className="bg-[#041b0f] md:bg-gray-100/80 p-1 rounded-[12px] md:rounded-xl w-full lg:w-auto self-start border border-[#1d422f] md:border-0">
                            <nav className="flex space-x-1" aria-label="Tabs">
                                {filterTabs.map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setStatusFilter(tab)}
                                        className={`${statusFilter === tab
                                            ? 'bg-[#22c55e]/20 md:bg-white text-[#22c55e] md:text-emerald-700 shadow-sm border border-[#22c55e]/30 md:border-transparent'
                                            : 'text-gray-400 md:text-gray-500 hover:text-gray-200 md:hover:text-gray-700 hover:bg-[#1d422f] md:hover:bg-gray-200/50 border border-transparent'
                                            } whitespace-nowrap py-1.5 px-3 rounded-[10px] md:rounded-lg font-semibold text-[13px] capitalize transition-all duration-200 flex items-center gap-2`}
                                    >
                                        {tab}
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                            statusFilter === tab ? 'bg-[#22c55e]/30 text-emerald-300 md:bg-emerald-50 md:text-emerald-700' : 'bg-[#1d422f] text-gray-400 md:bg-gray-200 md:text-gray-600'
                                        }`}>
                                            {counts[tab as keyof typeof counts]}
                                        </span>
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="relative w-full lg:max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Search className="h-4.5 w-4.5 text-gray-500 md:text-gray-400" />
                            </div>
                            <input
                                id="onboarding-search"
                                name="onboardingSearch"
                                type="text"
                                placeholder="Search by name, ID, or site..."
                                aria-label="Search onboarding forms"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="block w-full bg-[#041b0f] md:bg-white border border-[#1d422f] md:border-gray-200 rounded-[12px] md:rounded-xl py-2 pl-10 pr-4 text-[13px] placeholder-gray-500 md:placeholder-gray-400 text-white md:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#22c55e]/40 md:focus:ring-emerald-500/20 focus:border-[#22c55e] md:focus:border-emerald-500 transition-all shadow-sm"
                            />
                        </div>
                    </div>
                </div>

            <div className="overflow-x-auto overflow-y-hidden pb-16 md:pb-0">
                {isMobile ? (
                    <div className="flex flex-col gap-3 px-1 mt-2">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-40 bg-gradient-to-br from-[#0c2a1b] to-[#06180f] rounded-[20px] border border-[#1d422f] animate-pulse"></div>
                            ))
                        ) : filteredSubmissions.length === 0 ? (
                            <div className="text-center py-16 bg-[#0c2a1b]/30 rounded-[20px] border border-[#1d422f]/50">
                                <div className="flex flex-col items-center justify-center text-gray-500">
                                    <Search className="h-10 w-10 mb-3 opacity-30 text-[#22c55e]" />
                                    <p className="text-sm font-medium text-gray-300">No submissions found.</p>
                                    <p className="text-xs text-gray-500 mt-1">Try adjusting your search or filters</p>
                                </div>
                            </div>
                        ) : (
                            filteredSubmissions.map((s) => (
                                <div key={s.id} className={`bg-gradient-to-br from-[#0c2a1b] to-[#081e13] border ${s.requiresManualVerification ? 'border-orange-500/50' : 'border-[#1d422f]/80'} rounded-[20px] p-4 shadow-lg shadow-black/20 flex flex-col gap-3 relative overflow-hidden transition-all duration-300`}>
                                    {s.requiresManualVerification && (
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-orange-400 to-orange-600"></div>
                                    )}
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="h-11 w-11 rounded-[14px] bg-gradient-to-br from-[#123824] to-[#0a2014] flex items-center justify-center text-[#22c55e] font-bold text-sm border border-[#1d422f] shadow-inner">
                                                {s.personal.firstName?.[0]}{s.personal.lastName?.[0]}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[15px] font-bold tracking-wide capitalize text-white">
                                                        {s.personal.firstName} {s.personal.lastName}
                                                    </span>
                                                    {s.requiresManualVerification && (
                                                        <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                                                    )}
                                                </div>
                                                <div className="text-xs font-medium text-gray-400 mt-0.5">{s.personal.employeeId}</div>
                                            </div>
                                        </div>
                                        {statusFilter !== 'verified' && (
                                            <StatusChip status={s.status} />
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-col gap-2.5 bg-black/20 rounded-[14px] p-3 border border-[#1d422f]/30 mt-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Designation</span>
                                            <span className="text-xs text-gray-200 font-medium">{s.organization?.designation || '-'}</span>
                                        </div>
                                        <div className="w-full h-px bg-[#1d422f]/30"></div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Site Location</span>
                                            <span className="text-xs text-gray-200 font-medium">{s.organizationName || s.organization?.organizationName || '-'}</span>
                                        </div>
                                        {s.status === 'verified' && (
                                            <>
                                                <div className="w-full h-px bg-[#1d422f]/30"></div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Verifications</span>
                                                    <VerificationChecks submission={s} isSyncing={syncingId === s.id} />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-2 mt-1 pt-3 border-t border-[#1d422f]/40">
                                        <button 
                                            onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                            className="px-4 py-2.5 text-gray-300 hover:text-white bg-[#123824] hover:bg-[#1a4a30] rounded-[12px] text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border border-[#1d422f]"
                                            title="View Details"
                                        >
                                            <Eye className="h-3.5 w-3.5" /> View
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                            className="px-4 py-2.5 text-gray-300 hover:text-white bg-[#123824] hover:bg-[#1a4a30] rounded-[12px] text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border border-[#1d422f]"
                                            title="Edit Submission"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" /> Edit
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(s.id!)}
                                            className="px-4 py-2.5 text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-[12px] text-xs font-bold transition-all duration-200 border border-red-400/30 flex items-center gap-1.5"
                                            title="Delete Submission"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" /> Delete
                                        </button>
                                        
                                        {s.status === 'pending' && (
                                            <>
                                                <button 
                                                    onClick={() => handleAction('approve', s.id!)}
                                                    className="px-4 py-2.5 text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/20 rounded-[12px] text-xs font-bold transition-all duration-200 border border-[#22c55e]/30 flex items-center gap-1.5"
                                                >
                                                    <CheckSquare className="h-3.5 w-3.5" /> Approve
                                                </button>
                                                <button 
                                                    onClick={() => handleAction('reject', s.id!)}
                                                    className="px-4 py-2.5 text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-[12px] text-xs font-bold transition-all duration-200 border border-red-400/30 flex items-center gap-1.5"
                                                >
                                                    <XSquare className="h-3.5 w-3.5" /> Reject
                                                </button>
                                            </>
                                        )}
                                        {s.status === 'verified' && (s.portalSyncStatus === 'pending_sync' || s.portalSyncStatus === 'failed') && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleSync(s.id!)} 
                                                isLoading={syncingId === s.id}
                                                className="!rounded-[12px] border-[#22c55e]/30 text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/20 h-[34px]"
                                            >
                                                {syncingId !== s.id && <Send className="h-3.5 w-3.5 mr-1.5" />}
                                                Sync
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <table className="min-w-full border-separate border-spacing-0 responsive-table">
                        <thead>
                            <tr className="bg-[#0b291a]/50 md:bg-gray-50/50">
                                <th scope="col" className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 md:text-gray-500 uppercase tracking-wider border-b border-[#1d422f] md:border-gray-100">Employee</th>
                                <th scope="col" className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 md:text-gray-500 uppercase tracking-wider border-b border-[#1d422f] md:border-gray-100">Site</th>
                                {statusFilter !== 'verified' && (
                                    <th scope="col" className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 md:text-gray-500 uppercase tracking-wider border-b border-[#1d422f] md:border-gray-100">Status</th>
                                )}
                                <th scope="col" className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 md:text-gray-500 uppercase tracking-wider border-b border-[#1d422f] md:border-gray-100">Designation</th>
                                <th scope="col" className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 md:text-gray-500 uppercase tracking-wider border-b border-[#1d422f] md:border-gray-100">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1d422f] md:divide-gray-50">
                            {isLoading ? (
                                <TableSkeleton rows={5} cols={colSpan} />
                            ) : filteredSubmissions.length === 0 ? (
                                <tr><td colSpan={colSpan} className="text-center py-16">
                                    <div className="flex flex-col items-center justify-center text-gray-500 md:text-gray-400">
                                        <Search className="h-10 w-10 mb-3 opacity-30 md:opacity-20" />
                                        <p className="text-sm font-medium text-gray-300 md:text-gray-400">No submissions found.</p>
                                        <p className="text-xs text-gray-500 md:text-gray-400">Try adjusting your search or filters</p>
                                    </div>
                                </td></tr>
                            ) : (
                                filteredSubmissions.map((s) => (
                                    <tr key={s.id} className={`group hover:bg-[#1d422f]/40 md:hover:bg-emerald-50/30 transition-colors duration-150 ${s.requiresManualVerification ? 'bg-orange-900/20 md:bg-orange-50/50' : ''}`}>
                                        <td data-label="Employee" className="px-5 py-3 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-[#1d422f] md:bg-emerald-100 flex items-center justify-center text-[#22c55e] md:text-emerald-700 font-bold text-sm border-2 border-[#0b291a] md:border-white shadow-sm flex-shrink-0">
                                                    {s.personal.firstName?.[0]}{s.personal.lastName?.[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold tracking-wide capitalize text-white md:text-gray-900">
                                                            {s.personal.firstName} {s.personal.lastName}</span>
                                                        {s.requiresManualVerification && (
                                                            <span title="Manual verification required">
                                                                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                                                            </span>
                                                        )}
                                                    </div>
                                                     <div className="text-sm font-bold text-gray-400 md:text-gray-900 flex items-center gap-2">
                                                        <span>{s.personal.employeeId}</span>
                                                        <SyncStatusBadge pending={(s as any).pending} failed={(s as any).failed} />
                                                     </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Site" className="px-5 py-3 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-300 md:text-gray-700">{s.organizationName || s.organization?.organizationName || '-'}</div>
                                        </td>
                                        {statusFilter !== 'verified' && (
                                            <td data-label="Status" className="px-5 py-3 whitespace-nowrap">
                                                <StatusChip status={s.status} />
                                            </td>
                                        )}
                                        <td data-label="Designation" className="px-5 py-3 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-300 md:text-gray-700">{s.organization?.designation || '-'}</div>
                                            {s.status === 'verified' && (
                                                <div className="mt-1">
                                                    <VerificationChecks submission={s} isSyncing={syncingId === s.id} />
                                                </div>
                                            )}
                                        </td>
                                        <td data-label="Actions" className="px-5 py-3 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button 
                                                    onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                    className="p-2 text-gray-400 hover:text-[#22c55e] md:hover:text-emerald-600 hover:bg-[#1d422f] md:hover:bg-emerald-50 rounded-lg transition-all duration-200"
                                                    title="View Details"
                                                >
                                                    <Eye className="h-4.5 w-4.5" />
                                                </button>
                                                <button 
                                                    onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                    className="p-2 text-gray-400 hover:text-[#22c55e] md:hover:text-emerald-600 hover:bg-[#1d422f] md:hover:bg-emerald-50 rounded-lg transition-all duration-200"
                                                    title="Edit Submission"
                                                >
                                                    <Edit2 className="h-4.5 w-4.5" />
                                                </button>
                                                <button 
                                                    onClick={() => navigate(`/onboarding/pdf/${s.id}`)}
                                                    className="p-2 text-gray-400 hover:text-[#22c55e] md:hover:text-emerald-600 hover:bg-[#1d422f] md:hover:bg-emerald-50 rounded-lg transition-all duration-200"
                                                    title="Download Forms"
                                                >
                                                    <FileText className="h-4.5 w-4.5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(s.id!)}
                                                    className="p-2 text-gray-400 hover:text-red-500 md:hover:text-red-600 hover:bg-[#1d422f] md:hover:bg-red-50 rounded-lg transition-all duration-200"
                                                    title="Delete Submission"
                                                >
                                                    <Trash2 className="h-4.5 w-4.5" />
                                                </button>
                                                {s.status === 'pending' && (
                                                    <div className="flex items-center gap-1 border-l border-[#1d422f] md:border-gray-100 ml-1 pl-1">
                                                        <button 
                                                            onClick={() => handleAction('approve', s.id!)}
                                                            className="p-2 text-gray-400 hover:text-green-500 md:hover:text-green-600 hover:bg-[#1d422f] md:hover:bg-green-50 rounded-lg transition-all duration-200"
                                                            title="Verify"
                                                        >
                                                            <CheckSquare className="h-4.5 w-4.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleAction('reject', s.id!)}
                                                            className="p-2 text-gray-400 hover:text-red-500 md:hover:text-red-600 hover:bg-[#1d422f] md:hover:bg-red-50 rounded-lg transition-all duration-200"
                                                            title="Request Changes"
                                                        >
                                                            <XSquare className="h-4.5 w-4.5" />
                                                        </button>
                                                    </div>
                                                )}
                                                {s.status === 'verified' && (s.portalSyncStatus === 'pending_sync' || s.portalSyncStatus === 'failed') && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => handleSync(s.id!)} 
                                                        isLoading={syncingId === s.id}
                                                        className="ml-2 !rounded-lg border-[#1d422f] md:border-gray-200 text-gray-300 md:text-gray-600 hover:text-[#22c55e] md:hover:text-emerald-700 hover:border-[#22c55e]/50 md:hover:border-emerald-200 hover:bg-[#1d422f] md:hover:bg-emerald-50"
                                                    >
                                                        {syncingId !== s.id && <Send className="h-3.5 w-3.5 mr-1.5" />}
                                                        Sync Portals
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
            </div>
            <SyncDebugModal
              isOpen={showDebugModal}
              onClose={() => setShowDebugModal(false)}
              onRefreshList={() => fetchSubmissions(false)}
            />
        </div>
    );
};

export default VerificationDashboard;