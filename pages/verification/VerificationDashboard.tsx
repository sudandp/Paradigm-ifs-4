import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import type { OnboardingData } from '@/types';
import StatusChip from '@/components/ui/StatusChip';
import Button from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, FileText, Send, RefreshCw, AlertTriangle, Loader2, CheckSquare, XSquare, Square, Edit2, Trash2, Bug, Play, RotateCcw, X, CheckCircle2, Users, Clock, XCircle, MapPin, Briefcase, Calendar, Bot, Sparkles, UserCheck } from 'lucide-react';
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


export const checkIsAllDocsVerified = (submission: OnboardingData): boolean => {
    const isPanVerified = Boolean(
        submission.personal?.verifiedStatus?.panCard ||
        (submission.personal?.idProofType === 'PAN' && submission.personal?.verifiedStatus?.idProofNumber) ||
        submission.personal?.panCard ||
        (submission.personal?.idProofType === 'PAN' && submission.personal?.idProofNumber)
    );

    const isAadhaarVerified = Boolean(
        submission.personal?.isQrVerified ||
        (submission.personal?.idProofType === 'Aadhaar' && submission.personal?.verifiedStatus?.idProofNumber) ||
        (submission.personal?.idProofFront && submission.personal?.idProofBack) ||
        (submission.personal?.idProofType === 'Aadhaar' && submission.personal?.idProofNumber)
    );

    const isUanApplicable = submission.uan?.hasPreviousPf;
    const isUanVerified = !isUanApplicable || Boolean(
        submission.uan?.verifiedStatus?.uanNumber ||
        submission.uan?.uanNumber ||
        submission.uan?.document ||
        submission.uan?.salarySlip
    );

    const isBankVerified = Boolean(
        submission.bank?.verifiedStatus?.accountNumber ||
        (submission.bank?.accountNumber && (submission.bank?.bankProof || submission.bank?.ifscCode))
    );

    const isAddressVerified = Boolean(
        (submission.address?.present?.verifiedStatus?.line1 || submission.address?.present?.line1) &&
        (submission.address?.permanent?.verifiedStatus?.line1 || submission.address?.permanent?.line1 || submission.address?.sameAsPresent)
    );

    return isPanVerified && isAadhaarVerified && isUanVerified && isBankVerified && isAddressVerified;
};

interface DocumentVerificationBadgesProps {
    submission: OnboardingData;
    onToggleDoc?: (docType: string) => void;
    hideLabels?: boolean;
}

const DocumentVerificationBadges: React.FC<DocumentVerificationBadgesProps> = ({ submission, onToggleDoc, hideLabels }) => {
    // 1. PAN Verification Status
    const isPanVerified = Boolean(
        submission.personal?.verifiedStatus?.panCard ||
        (submission.personal?.idProofType === 'PAN' && submission.personal?.verifiedStatus?.idProofNumber) ||
        submission.personal?.panCard ||
        (submission.personal?.idProofType === 'PAN' && submission.personal?.idProofNumber)
    );

    // 2. Aadhaar Verification Status
    const isAadhaarVerified = Boolean(
        submission.personal?.isQrVerified ||
        (submission.personal?.idProofType === 'Aadhaar' && submission.personal?.verifiedStatus?.idProofNumber) ||
        (submission.personal?.idProofFront && submission.personal?.idProofBack) ||
        (submission.personal?.idProofType === 'Aadhaar' && submission.personal?.idProofNumber)
    );

    // 3. UAN Verification Status
    const isUanApplicable = submission.uan?.hasPreviousPf;
    const isUanVerified = isUanApplicable ? Boolean(
        submission.uan?.verifiedStatus?.uanNumber ||
        submission.uan?.uanNumber ||
        submission.uan?.document ||
        submission.uan?.salarySlip
    ) : null;

    // 4. Bank Account Verification Status
    const isBankVerified = Boolean(
        submission.bank?.verifiedStatus?.accountNumber ||
        (submission.bank?.accountNumber && (submission.bank?.bankProof || submission.bank?.ifscCode))
    );

    // 5. Address Verification Status
    const isAddressVerified = Boolean(
        (submission.address?.present?.verifiedStatus?.line1 || submission.address?.present?.line1) &&
        (submission.address?.permanent?.verifiedStatus?.line1 || submission.address?.permanent?.line1 || submission.address?.sameAsPresent)
    );

    const docList = [
        { 
            key: 'pan', 
            label: 'PAN', 
            verified: isPanVerified,
            activeColor: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
            iconColor: 'text-blue-600'
        },
        { 
            key: 'aadhaar', 
            label: 'Aadhaar', 
            verified: isAadhaarVerified,
            activeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
            iconColor: 'text-emerald-600'
        },
        { 
            key: 'uan', 
            label: 'UAN', 
            verified: isUanVerified, 
            applicable: isUanApplicable,
            activeColor: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
            iconColor: 'text-amber-600'
        },
        { 
            key: 'bank', 
            label: 'Bank', 
            verified: isBankVerified,
            activeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
            iconColor: 'text-indigo-600'
        },
        { 
            key: 'address', 
            label: 'Address', 
            verified: isAddressVerified,
            activeColor: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
            iconColor: 'text-teal-600'
        },
    ];

    return (
        <div className={`flex items-center gap-2 ${hideLabels ? 'justify-center' : 'flex-wrap'}`}>
            {docList.map(doc => {
                if (doc.applicable === false) {
                    return (
                        <span 
                            key={doc.key} 
                            className={`inline-flex items-center justify-center gap-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200 ${
                                hideLabels ? 'w-7 h-7 p-0' : 'px-2 py-0.5'
                            }`}
                            title={`${doc.label}: Not Applicable`}
                        >
                            <Square className="w-3.5 h-3.5 text-slate-300" />
                            {!hideLabels && <span>{doc.label} (N/A)</span>}
                        </span>
                    );
                }
                const isVerified = doc.verified === true;
                return (
                    <button
                        key={doc.key}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleDoc?.(doc.key);
                        }}
                        className={`inline-flex items-center justify-center gap-1 rounded-md text-[10px] font-bold transition-all duration-150 shadow-2xs ${
                            hideLabels ? 'w-7 h-7 p-0' : 'px-2 py-0.5'
                        } ${
                            isVerified 
                                ? doc.activeColor 
                                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        }`}
                        title={`${doc.label}: ${isVerified ? 'Verified (Click to toggle)' : 'Not Verified (Click to toggle)'}`}
                    >
                        {isVerified ? (
                            <CheckSquare className={`w-3.5 h-3.5 ${doc.iconColor} flex-shrink-0`} />
                        ) : (
                            <XSquare className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                        )}
                        {!hideLabels && <span>{doc.label}</span>}
                    </button>
                );
            })}
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

const formatCreatedDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch {
        return dateStr;
    }
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
            for (const s of data) {
                const isAutoAiFlow = s.submissionMode === 'auto_ai' || (s.submissionMode !== 'manual' && !s.requiresManualVerification);
                if (s.status === 'pending' && isAutoAiFlow && checkIsAllDocsVerified(s) && s.id) {
                    s.status = 'verified';
                    s.portalSyncStatus = 'pending_sync';
                    s.verificationMode = 'auto';
                    s.verifiedBy = 'Paradigm AI Agent';
                    s.verifiedAt = new Date().toISOString();
                    api.verifySubmission(s.id, 'auto').catch(() => {});
                }
            }
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
        const verifierName = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || user?.email?.split('@')[0] || 'HR Admin';
        const verifierPhoto = (user as any)?.user_metadata?.avatar_url || (user as any)?.user_metadata?.picture || null;

        // Optimistic update for UI responsiveness
        setSubmissions(prev => prev.map(s => s.id === id ? { 
            ...s, 
            status: action === 'approve' ? 'verified' : 'rejected', 
            portalSyncStatus: action === 'approve' ? 'pending_sync' : undefined,
            verificationMode: action === 'approve' ? 'manual' : s.verificationMode,
            verifiedBy: action === 'approve' ? verifierName : s.verifiedBy,
            verifiedByPhoto: action === 'approve' ? verifierPhoto : s.verifiedByPhoto,
            verifiedAt: action === 'approve' ? new Date().toISOString() : s.verifiedAt
        } : s));

        try {
            if (action === 'approve') {
                await api.verifySubmission(id, 'manual');
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

    const handleToggleDocVerification = async (submissionId: string, docKey: string) => {
        const target = submissions.find(s => s.id === submissionId);
        if (!target) return;

        const updated = { ...target };
        if (docKey === 'pan') {
            const current = Boolean(updated.personal?.verifiedStatus?.panCard || (updated.personal?.idProofType === 'PAN' && updated.personal?.verifiedStatus?.idProofNumber));
            updated.personal = {
                ...updated.personal,
                verifiedStatus: {
                    ...updated.personal?.verifiedStatus,
                    panCard: !current,
                    idProofNumber: updated.personal?.idProofType === 'PAN' ? !current : updated.personal?.verifiedStatus?.idProofNumber
                }
            };
        } else if (docKey === 'aadhaar') {
            const current = Boolean(updated.personal?.isQrVerified || (updated.personal?.idProofType === 'Aadhaar' && updated.personal?.verifiedStatus?.idProofNumber));
            updated.personal = {
                ...updated.personal,
                verifiedStatus: {
                    ...updated.personal?.verifiedStatus,
                    idProofNumber: !current
                },
                isQrVerified: !current
            };
        } else if (docKey === 'uan') {
            const current = Boolean(updated.uan?.verifiedStatus?.uanNumber);
            updated.uan = {
                ...updated.uan,
                verifiedStatus: {
                    ...updated.uan?.verifiedStatus,
                    uanNumber: !current
                }
            };
        } else if (docKey === 'bank') {
            const current = Boolean(updated.bank?.verifiedStatus?.accountNumber);
            updated.bank = {
                ...updated.bank,
                verifiedStatus: {
                    ...updated.bank?.verifiedStatus,
                    accountNumber: !current,
                    accountHolderName: !current,
                    ifscCode: !current
                }
            };
        } else if (docKey === 'address') {
            const current = Boolean(updated.address?.present?.verifiedStatus?.line1);
            updated.address = {
                ...updated.address,
                present: {
                    ...updated.address?.present,
                    verifiedStatus: {
                        ...updated.address?.present?.verifiedStatus,
                        line1: !current,
                        city: !current,
                        state: !current,
                        pincode: !current
                    }
                },
                permanent: {
                    ...updated.address?.permanent,
                    verifiedStatus: {
                        ...updated.address?.permanent?.verifiedStatus,
                        line1: !current,
                        city: !current,
                        state: !current,
                        pincode: !current
                    }
                }
            };
        }

        const isAutoAiFlow = updated.submissionMode === 'auto_ai' || (updated.submissionMode !== 'manual' && !updated.requiresManualVerification);
        const isAllVerifiedNow = checkIsAllDocsVerified(updated);
        if (isAllVerifiedNow && isAutoAiFlow && updated.status !== 'verified') {
            updated.status = 'verified';
            updated.portalSyncStatus = 'pending_sync';
            updated.verificationMode = 'auto';
            updated.verifiedBy = 'Paradigm AI Agent';
            updated.verifiedAt = new Date().toISOString();
            hotToast.success(`🎉 All documents verified by AI! Moved ${updated.personal?.firstName || 'employee'} to Verified category.`);
            api.verifySubmission(submissionId, 'auto').catch(err => console.warn('[AutoVerify] error:', err));
        } else {
            hotToast.success(`Updated ${docKey.toUpperCase()} verification status`);
        }

        setSubmissions(prev => prev.map(s => s.id === submissionId ? updated : s));

        try {
            const { error } = await supabase
                .from('onboarding_submissions')
                .update({
                    personal: updated.personal,
                    address: updated.address,
                    bank: updated.bank,
                    uan: updated.uan,
                    status: updated.status,
                    portal_sync_status: updated.portalSyncStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', submissionId);
            if (error) console.warn('[VerificationDashboard] Supabase doc update error:', error);
        } catch (e) {
            console.warn('[VerificationDashboard] Doc update catch:', e);
        }
    };

    const filterTabs = ['all', 'pending', 'verified', 'rejected'];
    const colSpan = statusFilter === 'verified' ? 7 : 8;

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
        <div className="p-3 md:p-6 flex-1 flex flex-col bg-slate-50/50 min-h-screen md:min-h-0 space-y-5">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Onboarding Forms</h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {submissions.length} Total
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm mt-0.5">Manage, review, and verify employee onboarding applications across sites</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all duration-200 flex items-center gap-2 border ${
                        pendingOrFailedCount > 0
                          ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-500 shadow-amber-500/20'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                      title="Trigger immediate sync of all offline records"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing...' : `Sync Now${pendingOrFailedCount > 0 ? ` (${pendingOrFailedCount})` : ''}`}
                    </button>
                    <button
                      onClick={() => setShowDebugModal(true)}
                      className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 shadow-xs"
                      title="View sync diagnostics and error tracebacks"
                    >
                      <Bug className="w-3.5 h-3.5 text-amber-500" /> Debug
                    </button>
                </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div 
                    onClick={() => setStatusFilter('all')}
                    className={`cursor-pointer bg-white p-4 rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md ${
                        statusFilter === 'all' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Submissions</span>
                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-2">{counts.all}</div>
                </div>

                <div 
                    onClick={() => setStatusFilter('pending')}
                    className={`cursor-pointer bg-white p-4 rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md ${
                        statusFilter === 'pending' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Review</span>
                        <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-slate-900">{counts.pending}</span>
                        {counts.pending > 0 && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full animate-pulse">Action Needed</span>
                        )}
                    </div>
                </div>

                <div 
                    onClick={() => setStatusFilter('verified')}
                    className={`cursor-pointer bg-white p-4 rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md ${
                        statusFilter === 'verified' ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Verified</span>
                        <div className="p-2 bg-teal-50 rounded-xl text-teal-600">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-2">{counts.verified}</div>
                </div>

                <div 
                    onClick={() => setStatusFilter('rejected')}
                    className={`cursor-pointer bg-white p-4 rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md ${
                        statusFilter === 'rejected' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rejected</span>
                        <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                            <XCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-2">{counts.rejected}</div>
                </div>
            </div>

            {/* Main Table Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex-1 flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                        <div className="bg-slate-200/60 p-1 rounded-xl w-full lg:w-auto self-start">
                            <nav className="flex space-x-1" aria-label="Tabs">
                                {filterTabs.map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setStatusFilter(tab)}
                                        className={`${statusFilter === tab
                                            ? 'bg-white text-emerald-800 shadow-xs font-bold'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/40'
                                            } whitespace-nowrap py-1.5 px-3.5 rounded-lg text-xs capitalize transition-all duration-200 flex items-center gap-2`}
                                    >
                                        {tab}
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            statusFilter === tab ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-300/60 text-slate-600'
                                        }`}>
                                            {counts[tab as keyof typeof counts]}
                                        </span>
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="relative w-full lg:max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-slate-400" />
                            </div>
                            <input
                                id="onboarding-search"
                                name="onboardingSearch"
                                type="text"
                                placeholder="Search by name, ID, or site..."
                                aria-label="Search onboarding forms"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="block w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
                            />
                        </div>
                    </div>
                </div>

            <div className="overflow-x-auto overflow-y-hidden pb-16 md:pb-0">
                {isMobile ? (
                    <div className="flex flex-col gap-3 px-1 mt-2">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-40 bg-slate-100 rounded-2xl border border-slate-200 animate-pulse"></div>
                            ))
                        ) : filteredSubmissions.length === 0 ? (
                            <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-slate-200/80">
                                <div className="flex flex-col items-center justify-center text-slate-400">
                                    <Search className="h-10 w-10 mb-3 opacity-30 text-emerald-600" />
                                    <p className="text-sm font-semibold text-slate-600">No submissions found</p>
                                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
                                </div>
                            </div>
                        ) : (
                            filteredSubmissions.map((s) => (
                                <div key={s.id} className={`bg-white border ${s.requiresManualVerification ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200/80'} rounded-2xl p-4 shadow-xs flex flex-col gap-3 relative overflow-hidden transition-all duration-300 hover:shadow-md`}>
                                    {s.requiresManualVerification && (
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
                                    )}
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black text-sm shadow-xs border-2 border-white">
                                                {s.personal.firstName?.[0]}{s.personal.lastName?.[0]}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-900 capitalize">
                                                        {s.personal.firstName} {s.personal.lastName}
                                                    </span>
                                                    {s.requiresManualVerification && (
                                                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                    )}
                                                </div>
                                                <div className="font-mono text-xs text-slate-500 mt-0.5">{s.personal.employeeId}</div>
                                            </div>
                                        </div>
                                        {statusFilter !== 'verified' && (
                                            <StatusChip status={s.status} />
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-col gap-2.5 bg-slate-50/80 rounded-xl p-3 border border-slate-200/60 mt-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Designation</span>
                                            <span className="text-xs text-slate-800 font-semibold">{s.organization?.designation || '-'}</span>
                                        </div>
                                        <div className="w-full h-px bg-slate-200/60"></div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Site Location</span>
                                            <span className="text-xs text-slate-800 font-semibold">{s.organizationName || s.organization?.organizationName || '-'}</span>
                                        </div>
                                        <div className="w-full h-px bg-slate-200/60"></div>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Verified Documents</span>
                                            <DocumentVerificationBadges submission={s} onToggleDoc={(key) => handleToggleDocVerification(s.id!, key)} />
                                        </div>
                                        <div className="w-full h-px bg-slate-200/60"></div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Created Date/Time</span>
                                            <span className="text-xs text-slate-800 font-semibold">{formatCreatedDate(s.createdAt || s.created_at || s.enrollmentDate)}</span>
                                        </div>
                                        {s.status === 'verified' && (
                                            <>
                                                <div className="w-full h-px bg-slate-200/60"></div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Approved By</span>
                                                    {s.verificationMode === 'auto' || s.verifiedBy === 'Paradigm AI Agent' ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-800 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200">
                                                            <Bot className="h-3.5 w-3.5 text-violet-600" />
                                                            Verified by Paradigm AI Agent
                                                        </span>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            {s.verifiedByPhoto ? (
                                                                <img src={s.verifiedByPhoto} alt={s.verifiedBy || 'HR'} className="h-5 w-5 rounded-full object-cover border border-emerald-500" />
                                                            ) : (
                                                                <div className="h-5 w-5 rounded-full bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-center">
                                                                    {s.verifiedBy ? s.verifiedBy.split(' ').map(n => n[0]).join('').slice(0, 2) : 'HR'}
                                                                </div>
                                                            )}
                                                            <span className="text-xs font-bold text-slate-800">{s.verifiedBy || 'HR Admin'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-2 mt-1 pt-3 border-t border-slate-100 flex-wrap">
                                        <button 
                                            onClick={() => navigate(`/onboarding/add/review?id=${s.id}`)}
                                            className="px-3 py-1.5 text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1 border border-slate-200 hover:border-emerald-200"
                                            title="View Details"
                                        >
                                            <Eye className="h-3.5 w-3.5" /> View
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                            className="px-3 py-1.5 text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1 border border-slate-200 hover:border-blue-200"
                                            title="Edit Submission"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" /> Edit
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/onboarding/pdf/${s.id}`)}
                                            className="px-3 py-1.5 text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1 border border-slate-200 hover:border-teal-200"
                                            title="Download Forms"
                                        >
                                            <FileText className="h-3.5 w-3.5" /> Forms
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(s.id!)}
                                            className="px-3 py-1.5 text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all duration-200 border border-slate-200 hover:border-rose-200 flex items-center gap-1"
                                            title="Delete Submission"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" /> Delete
                                        </button>
                                        
                                        {s.status === 'pending' && (
                                            <>
                                                <button 
                                                    onClick={() => handleAction('approve', s.id!)}
                                                    className="px-3 py-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-bold transition-all duration-200 shadow-xs flex items-center gap-1"
                                                >
                                                    <CheckSquare className="h-3.5 w-3.5" /> Approve
                                                </button>
                                                <button 
                                                    onClick={() => handleAction('reject', s.id!)}
                                                    className="px-3 py-1.5 text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1"
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
                                                className="!rounded-lg border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 h-8 text-xs font-bold"
                                            >
                                                {syncingId !== s.id && <Send className="h-3.5 w-3.5 mr-1" />}
                                                Sync
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <table className="min-w-full border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">Employee</th>
                                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">Site Location</th>
                                {statusFilter !== 'verified' && (
                                    <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">Status</th>
                                )}
                                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">Designation</th>
                                <th scope="col" className="px-5 py-3 text-center border-b border-slate-200/80">
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Verified Documents</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">PAN</span>
                                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">AADHAAR</span>
                                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">UAN</span>
                                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs">BANK</span>
                                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-teal-50 text-teal-700 border border-teal-200/80 shadow-2xs">ADDRESS</span>
                                        </div>
                                    </div>
                                </th>
                                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">Approved By</th>
                                <th scope="col" className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">Created Date/Time</th>
                                <th scope="col" className="px-5 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {isLoading ? (
                                <TableSkeleton rows={5} cols={colSpan} />
                            ) : filteredSubmissions.length === 0 ? (
                                <tr><td colSpan={colSpan} className="text-center py-16">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <Search className="h-10 w-10 mb-3 opacity-30 text-emerald-600" />
                                        <p className="text-sm font-semibold text-slate-600">No onboarding submissions found</p>
                                        <p className="text-xs text-slate-400 mt-1">Try adjusting your search terms or filter tabs</p>
                                    </div>
                                </td></tr>
                            ) : (
                                filteredSubmissions.map((s) => (
                                    <tr key={s.id} className={`group hover:bg-emerald-50/40 transition-colors duration-150 ${s.requiresManualVerification ? 'bg-amber-50/60' : ''}`}>
                                        {/* Employee */}
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black text-xs flex items-center justify-center shadow-xs border-2 border-white flex-shrink-0">
                                                    {s.personal.firstName?.[0]}{s.personal.lastName?.[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm font-bold text-slate-900 hover:text-emerald-700 transition-colors capitalize">
                                                            {s.personal.firstName} {s.personal.lastName}
                                                        </span>
                                                        {s.requiresManualVerification && (
                                                            <span title="Manual verification required">
                                                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                                                            {s.personal.employeeId}
                                                        </span>
                                                        <SyncStatusBadge pending={(s as any).pending} failed={(s as any).failed} />
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Site */}
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                                <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                                <span>{s.organizationName || s.organization?.organizationName || '-'}</span>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        {statusFilter !== 'verified' && (
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <StatusChip status={s.status} />
                                            </td>
                                        )}

                                        {/* Designation */}
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                                <Briefcase className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                                <span>{s.organization?.designation || '-'}</span>
                                            </div>
                                        </td>

                                        {/* Verified Documents */}
                                        <td className="px-5 py-3.5 whitespace-nowrap text-center">
                                            <DocumentVerificationBadges submission={s} onToggleDoc={(key) => handleToggleDocVerification(s.id!, key)} hideLabels />
                                        </td>

                                        {/* Approved By */}
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                            {s.status === 'verified' ? (
                                                s.verificationMode === 'auto' || s.verifiedBy === 'Paradigm AI Agent' ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-2xs flex-shrink-0 border border-violet-300">
                                                            <Bot className="h-4 w-4 text-white" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-violet-950 flex items-center gap-1">
                                                                Verified by Paradigm AI Agent
                                                                <Sparkles className="h-3 w-3 text-amber-500 fill-amber-400 flex-shrink-0" />
                                                            </span>
                                                            {s.verifiedAt && (
                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                    {formatCreatedDate(s.verifiedAt)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        {s.verifiedByPhoto ? (
                                                            <img src={s.verifiedByPhoto} alt={s.verifiedBy || 'HR'} className="h-7 w-7 rounded-full object-cover border-2 border-emerald-500 shadow-2xs flex-shrink-0" />
                                                        ) : (
                                                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black text-xs flex items-center justify-center shadow-2xs border border-emerald-400 flex-shrink-0 uppercase">
                                                                {s.verifiedBy ? s.verifiedBy.split(' ').map(n => n[0]).join('').slice(0, 2) : 'HR'}
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs font-bold text-slate-800 capitalize">
                                                                    {s.verifiedBy || 'HR Admin'}
                                                                </span>
                                                                <UserCheck className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                                                            </div>
                                                            {s.verifiedAt && (
                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                    {formatCreatedDate(s.verifiedAt)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            ) : (
                                                <span className="text-[11px] text-slate-400 italic">—</span>
                                            )}
                                        </td>

                                        {/* Created Date/Time */}
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                                <span>{formatCreatedDate(s.createdAt || s.created_at || s.enrollmentDate)}</span>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-5 py-3.5 whitespace-nowrap text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button 
                                                    onClick={() => navigate(`/onboarding/add/review?id=${s.id}`)}
                                                    className="p-2 text-slate-500 hover:text-emerald-700 bg-slate-100/80 hover:bg-emerald-50 rounded-lg transition-all duration-200 border border-slate-200/60 hover:border-emerald-200"
                                                    title="View Summary Details"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                <button 
                                                    onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                    className="p-2 text-slate-500 hover:text-blue-700 bg-slate-100/80 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-slate-200/60 hover:border-blue-200"
                                                    title="Edit Application"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button 
                                                    onClick={() => navigate(`/onboarding/pdf/${s.id}`)}
                                                    className="p-2 text-slate-500 hover:text-teal-700 bg-slate-100/80 hover:bg-teal-50 rounded-lg transition-all duration-200 border border-slate-200/60 hover:border-teal-200"
                                                    title="Download Official Forms"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(s.id!)}
                                                    className="p-2 text-slate-500 hover:text-rose-700 bg-slate-100/80 hover:bg-rose-50 rounded-lg transition-all duration-200 border border-slate-200/60 hover:border-rose-200"
                                                    title="Delete Application"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>

                                                {s.status === 'pending' && (
                                                    <div className="flex items-center gap-1 border-l border-slate-200 ml-1 pl-1.5">
                                                        <button 
                                                            onClick={() => handleAction('approve', s.id!)}
                                                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all duration-200 flex items-center gap-1"
                                                            title="Verify & Approve"
                                                        >
                                                            <CheckSquare className="h-3.5 w-3.5" /> Approve
                                                        </button>
                                                        <button 
                                                            onClick={() => handleAction('reject', s.id!)}
                                                            className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1"
                                                            title="Reject & Request Changes"
                                                        >
                                                            <XSquare className="h-3.5 w-3.5" /> Reject
                                                        </button>
                                                    </div>
                                                )}

                                                {s.status === 'verified' && (s.portalSyncStatus === 'pending_sync' || s.portalSyncStatus === 'failed') && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => handleSync(s.id!)} 
                                                        isLoading={syncingId === s.id}
                                                        className="ml-1.5 !rounded-lg border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 h-8 text-xs font-bold"
                                                    >
                                                        {syncingId !== s.id && <Send className="h-3.5 w-3.5 mr-1" />}
                                                        Sync
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