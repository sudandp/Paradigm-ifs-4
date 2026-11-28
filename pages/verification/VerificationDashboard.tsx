import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getFullName } from '../../utils/personName';
import {
    getDocValue, DocumentVerificationBadges, CompactDocSummary, RowActionsMenu, prettyText, type RowMenuItem,
} from '@/components/onboarding/submissionTableParts';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import type { OnboardingData } from '../../types';
import StatusChip from '@/components/ui/StatusChip';
import Button from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, FileText, Send, RefreshCw, AlertTriangle, Loader2, CheckSquare, XSquare, Square, Edit2, Trash2, Bug, Play, RotateCcw, X, CheckCircle2, Users, Clock, XCircle, MapPin, Briefcase, Calendar, Bot, Sparkles, UserCheck, Building2, ArrowLeft, MoreHorizontal } from 'lucide-react';
import Toast from '@/components/ui/Toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { syncEngine } from '@/services/offline/syncEngine';
import * as outbox from '@/services/offline/outbox';
import { getDb } from '@/services/offline/db';
import hotToast from 'react-hot-toast';
import { RejectReasonModal } from '@/components/onboarding/RejectReasonModal';
import { ApproveSubmissionModal } from '@/components/onboarding/ApproveSubmissionModal';
import { isSouthWallEmployee } from '@/services/pifsCompliancePdfService';
import { OnboardingExportButton } from '@/components/onboarding/OnboardingExportButton';
import { exportGenericReportToExcel, GenericReportColumn } from '@/utils/excelExport';

// PERF: keep the last fetched list in memory so revisiting this page in the same
// session renders instantly while a fresh copy loads in the background.
let lastSubmissionsCache: OnboardingData[] | null = null;

const UNASSIGNED_DEPT = '__unassigned__';
const getSubmissionDepartment = (s: OnboardingData): string => {
    const raw = ((s.organization as any)?.department || (s as any).department || '').toString().trim();
    return raw || UNASSIGNED_DEPT;
};
const formatDepartmentLabel = (key: string): string => {
    if (key === UNASSIGNED_DEPT) return 'Unassigned';
    return key
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map(w => (w.length <= 3 && w === w.toUpperCase()) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
};

// ── Period filter (defaults to the current month) ──
type PeriodFilter = 'this_month' | 'last_month' | 'last_3_months' | 'all' | `month:${string}`;
const getSubmissionDate = (s: OnboardingData): Date | null => {
    const raw = s.createdAt || s.created_at || s.enrollmentDate;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
};
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};
const matchesPeriod = (s: OnboardingData, period: PeriodFilter): boolean => {
    if (period === 'all') return true;
    const d = getSubmissionDate(s);
    if (!d) return false;
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'this_month') return d >= thisMonthStart;
    if (period === 'last_month') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d >= start && d < thisMonthStart;
    }
    if (period === 'last_3_months') return d >= new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return monthKey(d) === period.slice('month:'.length);
};
const getSubmissionSite = (s: OnboardingData) =>
    (s.organizationName || s.organization?.organizationName || (s.organization as any)?.site || '').toString().trim();
const getSubmissionDesignation = (s: OnboardingData) =>
    (s.organization?.designation || (s as any).designation || '').toString().trim();

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
    if (!submission) return false;
    const personal = (submission.personal as any) || {};
    const documents = (submission as any)?.documents || {};
    const bank = (submission.bank as any) || {};
    const uan = (submission.uan as any) || {};
    const address = (submission.address as any) || {};

    // 1. PAN Verification
    const hasPanNumber = Boolean(
        getDocValue(personal.panCard) ||
        getDocValue(personal.panNumber) ||
        (personal.idProofType === 'PAN' && getDocValue(personal.idProofNumber)) ||
        documents.panCard
    );
    const hasPanDoc = Boolean(
        (personal.idProofType === 'PAN' && (personal.idProofFront || personal.idProofBack)) ||
        documents.panCard
    );
    const isExplicitlyPanVerified = personal.verifiedStatus?.panCard === true || 
        personal.verifiedStatus?.panNumber === true || 
        (personal.idProofType === 'PAN' && personal.verifiedStatus?.idProofNumber === true);
    const isExplicitlyPanFailed = personal.verifiedStatus?.panCard === false || 
        personal.verifiedStatus?.panNumber === false || 
        (personal.idProofType === 'PAN' && personal.verifiedStatus?.idProofNumber === false);
    const isPanVerified = !isExplicitlyPanFailed && (isExplicitlyPanVerified || (hasPanNumber && (hasPanDoc || personal.panCard)));

    // 2. Aadhaar Verification
    const hasAadhaarNumber = Boolean(
        getDocValue(personal.aadhaarNumber) ||
        (personal.idProofType === 'Aadhaar' && getDocValue(personal.idProofNumber)) ||
        documents.aadhaarNumber
    );
    const hasAadhaarDoc = Boolean(
        (personal.idProofType === 'Aadhaar' && (personal.idProofFront || personal.idProofBack)) ||
        documents.aadhaarFront ||
        documents.aadhaarBack
    );
    const isExplicitlyAadhaarVerified = personal.isQrVerified === true || 
        personal.verifiedStatus?.aadhaarNumber === true || 
        (personal.idProofType === 'Aadhaar' && personal.verifiedStatus?.idProofNumber === true);
    const isExplicitlyAadhaarFailed = personal.verifiedStatus?.aadhaarNumber === false || 
        (personal.idProofType === 'Aadhaar' && personal.verifiedStatus?.idProofNumber === false);
    const isAadhaarVerified = !isExplicitlyAadhaarFailed && ((hasAadhaarNumber || hasAadhaarDoc) && (isExplicitlyAadhaarVerified || (hasAadhaarNumber && hasAadhaarDoc)));

    // 3. UAN Verification
    const isUanApplicable = Boolean(uan.hasPreviousPf);
    const hasUanNumber = Boolean(getDocValue(uan.uanNumber));
    const hasUanDoc = Boolean(uan.document || uan.salarySlip);
    const isExplicitlyUanVerified = uan.verifiedStatus?.uanNumber === true;
    const isExplicitlyUanFailed = uan.verifiedStatus?.uanNumber === false;
    const isUanVerified = !isUanApplicable || (!isExplicitlyUanFailed && (isExplicitlyUanVerified || (hasUanNumber && (hasUanDoc || hasUanNumber))));

    // 4. Bank Verification
    const hasBankAcc = Boolean(getDocValue(bank.accountNumber));
    const hasBankIfsc = Boolean(getDocValue(bank.ifscCode));
    const isExplicitlyBankVerified = bank.verifiedStatus?.accountNumber === true;
    const isExplicitlyBankFailed = bank.verifiedStatus?.accountNumber === false;
    const isBankVerified = hasBankAcc && hasBankIfsc && !isExplicitlyBankFailed && (isExplicitlyBankVerified || (hasBankAcc && hasBankIfsc));

    // 5. Address Verification
    const hasPresentAddr = Boolean(getDocValue(address.present?.line1));
    const hasPermanentAddr = Boolean(address.sameAsPresent || getDocValue(address.permanent?.line1));
    const isExplicitlyAddrVerified = address.present?.verifiedStatus?.line1 === true;
    const isExplicitlyAddrFailed = address.present?.verifiedStatus?.line1 === false;
    const isAddressVerified = hasPresentAddr && hasPermanentAddr && !isExplicitlyAddrFailed && (isExplicitlyAddrVerified || (hasPresentAddr && hasPermanentAddr));

    return Boolean(isPanVerified && isAadhaarVerified && isUanVerified && isBankVerified && isAddressVerified);
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
        const roleNameUnderscore = roleName.replace(/[\s-]+/g, '_');
        const roleNameHyphen = roleName.replace(/[\s_]+/g, '-');
        
        // HR, HR Ops, HR Onboarding, Admin, Management, Director always have verification dashboard access
        const allowedRoles = [
            'admin', 'super_admin', 'hr', 'hr_ops', 'hr_operations', 'hr_operation', 
            'hr_onboarding', 'management', 'director', 'operations_head', 'general_manager', 'developer'
        ];
        if (allowedRoles.includes(roleId) || allowedRoles.includes(roleName) || allowedRoles.includes(roleNameUnderscore)) {
            return true;
        }

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

    const isSouthWallUser = useMemo(() => {
        if (!user) return false;
        const lastCompany = useAuthStore.getState().lastCompany || '';
        const raw = (user.societyName || user.organizationName || (user as any).companyName || (user as any).company_name || (user as any).companyId || (user as any).company_id || user.department || lastCompany || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        return raw.includes('south wall') || raw.includes('southwall') || raw.includes('south-wall') || email.includes('southwall') || email.includes('south-wall');
    }, [user]);

    const isGlobalHROrOps = useMemo(() => {
        if (!user) return false;
        if (isAdmin(user.role)) return true;
        const roleId = (user.roleId || '').toLowerCase().trim();
        const roleName = (user.role || '').toLowerCase().trim();
        const roleNormalized = roleName.replace(/[\s-_]+/g, '_');

        // HR Ops, HR Onboarding, Operations Head, Director, Management, Super Admin, Developer always have global multi-company view
        const globalRoles = [
            'admin', 'super_admin', 'developer',
            'hr_ops', 'hr_operations', 'hr_operation', 'hr_onboarding', 'operations_head',
            'director', 'management', 'general_manager'
        ];
        if (globalRoles.includes(roleId) || globalRoles.includes(roleNormalized)) {
            return true;
        }

        // Global HR check (if role is HR / HR Manager without specific SouthWall binding)
        if ((roleId === 'hr' || roleNormalized === 'hr' || roleNormalized === 'hr_manager' || roleNormalized === 'hr_head') && !isSouthWallUser) {
            return true;
        }

        return false;
    }, [user, isSouthWallUser]);

    const isSubmissionForSouthWall = useCallback((s: OnboardingData): boolean => {
        if (!s) return false;
        if (isSouthWallEmployee(s)) return true;
        const orgObj = (s.organization as any) || {};
        const orgName = (s.organizationName || orgObj.organizationName || (s as any).organization_name || '').toLowerCase();
        const site = (orgObj.site || orgObj.location || (s as any).site || '').toLowerCase();
        const compName = (orgObj.companyName || orgObj.company_name || orgObj.companyId || orgObj.company_id || (s as any).companyName || (s as any).company_name || (s as any).company_id || '').toLowerCase();
        const societyName = (orgObj.societyName || orgObj.societyId || (s as any).societyName || (s as any).society_name || '').toLowerCase();
        const dept = (orgObj.department || (s as any).department || '').toLowerCase();
        const createdBy = ((s as any).createdBy || (s as any).created_by || '').toLowerCase();
        const email = (s.personal?.email || '').toLowerCase();
        const orgId = (s.organizationId || (s as any).organization_id || orgObj.organizationId || '').toLowerCase();

        const des = (orgObj.designation || (s as any).designation || '').toLowerCase();

        // Facility / MEP technical staff (plumber, electrician, technician) belong to Paradigm Services
        const isFacilityOrTechnical = 
            des.includes('plumber') || des.includes('electrician') || des.includes('technician') ||
            des.includes('carpenter') || des.includes('painter') || des.includes('stp') || des.includes('wtp') ||
            des.includes('facility') || dept.includes('plumb') || dept.includes('elect') || dept.includes('stp_wtp') ||
            dept.includes('multi_technician') || dept.includes('hk_services');

        if (isFacilityOrTechnical && !compName.includes('south') && !compName.includes('swllp') && compName !== 'comp_1774527590821') {
            return false;
        }

        // SouthWall explicit company and operating company tokens
        const southWallKeywords = ['south wall', 'southwall', 'south-wall', 'swllp', 'comp_1774527590821'];
        const matchesKeyword = southWallKeywords.some(kw => 
            orgName.includes(kw) || site.includes(kw) || compName.includes(kw) || societyName.includes(kw) || dept.includes(kw) || createdBy.includes(kw) || email.includes(kw) || orgId.includes(kw)
        );
        if (matchesKeyword) return true;

        // SouthWall associated known sites/entities
        const southWallSites = [
            'gk_ispat', 'gk ispat', 'iskcon', 'habitat_aura', 'habitat aura', 'keshav_setlur', 'keshav setlur',
            'nikoo_homes', 'nikoo homes', 'brigade_jacaranda', 'brigade jacaranda', 'brigade_laburnum', 'brigade laburnum',
            'dsr_eden_greens', 'dsr eden greens', 'global_edifice_infra', 'global edifice', 'habitat_eden_heights', 'eden heights',
            'icon_sanctury', 'icon sanctuary', 'nadathur_fame_india', 'nadathur', 'paliwal_ttn', 'paliwal', 'purva_sunshine',
            'purva sunshine', 'raja_ritz_avenue', 'raja ritz', 'serene_brigade', 'shriram_smrithi', 'shriram smrithi',
            'shriram_spurthi', 'shriram spurthi', 'sjr_spencer', 'sjr spencer', 'snn_spiritua', 'snn spiritua',
            'uber verdant', 'uber_verdant', 'birla alokya', 'birla_alokya', 'birla',
            'brigade cornerstone utopia', 'brigade_cornerstone_utopia', 'cornerstone utopia', 'utopia',
            'bcu serene', 'bcu'
        ];
        const matchesSite = southWallSites.some(st => 
            orgName.includes(st) || site.includes(st) || orgId.includes(st)
        );
        if (matchesSite) return true;

        if (user?.id && ((s as any).userId === user.id || (s as any).user_id === user.id || (s as any).created_user_id === user.id)) {
            return true;
        }

        return false;
    }, [user]);

    const getDisplayEmployeeId = useCallback((s: OnboardingData): string => {
        let rawId = s?.personal?.employeeId || (s as any)?.employee_id || (s as any)?.employeeId || '';
        if (rawId) {
            if (isSubmissionForSouthWall(s) && rawId.startsWith('PARA-')) {
                rawId = 'SW-' + rawId.slice(5);
            } else if (!isSubmissionForSouthWall(s) && rawId.startsWith('SW-')) {
                rawId = 'PARA-' + rawId.slice(3);
            }
        }
        return rawId || 'ID: Pending';
    }, [isSubmissionForSouthWall]);

    const [companyFilter, setCompanyFilter] = useState<'all' | 'southwall' | 'paradigm'>('all');

    const [submissions, setSubmissions] = useState<OnboardingData[]>(() => lastSubmissionsCache || []);
    const [isLoading, setIsLoading] = useState(() => !lastSubmissionsCache);
    const [departmentFilter, setDepartmentFilter] = useState<string>('all');
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('this_month');
    const [siteFilter, setSiteFilter] = useState<string>('all');
    const [designationFilter, setDesignationFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');

    const [pendingOrFailedCount, setPendingOrFailedCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showDebugModal, setShowDebugModal] = useState(false);
    const [rejectModalSubmission, setRejectModalSubmission] = useState<OnboardingData | null>(null);
    const [isRejecting, setIsRejecting] = useState(false);
    const [approveModalSubmission, setApproveModalSubmission] = useState<OnboardingData | null>(null);
    const [isApproving, setIsApproving] = useState(false);

    // Cache of users for resolving creator names & photos
    const [usersMap, setUsersMap] = useState<Record<string, { name: string; photo?: string | null; role?: string; email?: string }>>({});

    useEffect(() => {
        api.getUsers({ fetchAll: true }).then((usersList: any) => {
            const raw = Array.isArray(usersList) ? usersList : (usersList?.data || []);
            const map: Record<string, { name: string; photo?: string | null; role?: string; email?: string }> = {};
            raw.forEach((u: any) => {
                if (u) {
                    const resolvedName = u.name || u.fullName || u.full_name || u.displayName || u.display_name || u.email?.split('@')[0] || 'User';
                    const resolvedPhoto = u.photoUrl || u.photo_url || u.avatarUrl || u.avatar_url || u.profilePhoto || u.profile_photo || u.picture || u.avatar || null;
                    const resolvedRole = u.role || (u.roles as any)?.display_name || (u.role as any)?.displayName || u.roleId || u.role_id || '';
                    const resolvedEmail = u.email || '';

                    const entry = {
                        name: resolvedName,
                        photo: resolvedPhoto,
                        role: resolvedRole,
                        email: resolvedEmail
                    };

                    if (u.id) map[u.id] = entry;
                    if (resolvedEmail) map[resolvedEmail.toLowerCase().trim()] = entry;
                    if (resolvedName) map[resolvedName.toLowerCase().trim()] = entry;
                }
            });
            setUsersMap(map);
        }).catch(err => console.warn('[VerificationDashboard] Failed to fetch users map:', err));
    }, []);

    const getCreatorInfo = useCallback((s: OnboardingData) => {
        // 1. Check explicit creator name stored when created
        const explicitName = (s as any).created_by_name || (s as any).createdByName || (s as any).createdBy || (s as any).created_by || (s as any).submitted_by || (s as any).submittedBy || (s.personal as any)?.createdBy || (s.personal as any)?.created_by;
        const explicitPhoto = (s as any).created_by_photo || (s as any).createdByPhoto || null;
        const explicitRole = (s as any).created_by_role || (s as any).createdByRole || '';

        // 2. Creator ID lookup in users map
        const creatorId = (s as any).created_user_id || (s as any).createdUserId || (s as any).user_id || (s as any).userId || '';
        const creatorFromMap = (creatorId ? usersMap[creatorId] : null)
            || (explicitName ? usersMap[String(explicitName).toLowerCase().trim()] : null);

        let name = '';
        let photo: string | null = null;
        let role = '';

        if (creatorFromMap) {
            name = creatorFromMap.name;
            photo = creatorFromMap.photo || explicitPhoto || null;
            role = creatorFromMap.role || explicitRole || '';
        } else if (explicitName && typeof explicitName === 'string' && explicitName.trim() !== '') {
            name = explicitName;
            photo = explicitPhoto || null;
            role = explicitRole || '';
        } else if (s.organization?.reportingManager && usersMap[s.organization.reportingManager.toLowerCase().trim()]) {
            const mgr = usersMap[s.organization.reportingManager.toLowerCase().trim()];
            name = mgr.name;
            photo = mgr.photo || null;
            role = mgr.role || '';
        } else {
            name = 'HR Staff';
            photo = null;
            role = '';
        }

        const initials = name
            ? name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
            : 'HR';

        return { name, photo, initials, role };
    }, [usersMap]);

    const getEmployeePhoto = useCallback((s: OnboardingData): string | null => {
        const p = s.personal as any;
        if (!p) return null;

        // 1. Direct string URL or base64
        if (typeof p.photo === 'string' && p.photo.trim() !== '') return p.photo;
        if (typeof p.photoUrl === 'string' && p.photoUrl.trim() !== '') return p.photoUrl;
        if (typeof p.photo_url === 'string' && p.photo_url.trim() !== '') return p.photo_url;
        if (typeof p.profilePhoto === 'string' && p.profilePhoto.trim() !== '') return p.profilePhoto;
        if (typeof p.profile_photo === 'string' && p.profile_photo.trim() !== '') return p.profile_photo;

        // 2. UploadedFile object with preview / url / dataUrl
        if (p.photo && typeof p.photo === 'object') {
            const url = p.photo.url || p.photo.preview || p.photo.dataUrl;
            if (url && typeof url === 'string') return url;
        }
        if (p.profilePhoto && typeof p.profilePhoto === 'object') {
            const url = p.profilePhoto.url || p.profilePhoto.preview || p.profilePhoto.dataUrl;
            if (url && typeof url === 'string') return url;
        }

        // 3. Fallback to documents photo if available
        const docs = (s as any).documents;
        if (docs) {
            const docPhoto = docs.photo || docs.passportPhoto || docs.profilePhoto || docs.passport_photo || docs.profile_photo;
            if (typeof docPhoto === 'string' && docPhoto.trim() !== '') return docPhoto;
            if (docPhoto && typeof docPhoto === 'object') {
                const url = docPhoto.url || docPhoto.preview || docPhoto.dataUrl;
                if (url && typeof url === 'string') return url;
            }
        }

        return null;
    }, []);

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
            // Always fetch ALL submissions so the stats KPI cards show correct
            // totals across every status. Client-side filtering (statusFilter)
            // is applied in companyScopedSubmissions / filteredSubmissions below.
            const data = await api.getVerificationSubmissions(undefined);
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
            lastSubmissionsCache = data;
            setSubmissions(data);
        } catch (error) {
            console.error("Failed to fetch submissions", error);
        } finally {
            if (showSkeleton) setIsLoading(false);
        }
    }, []);

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
        const remainingOutbox = await outbox.getAll();
        const remainingFailed = remainingOutbox.filter(i => i.status === 'failed');
        const remainingPending = remainingOutbox.filter(i => i.status === 'pending' || i.status === 'syncing');

        if (remainingFailed.length > 0) {
          hotToast.error(`Sync finished: ${result.synced} synced, ${remainingFailed.length} failed. Opening diagnostics...`, {
            id: 'manual-onboarding-sync',
            duration: 5000,
          });
          setShowDebugModal(true);
        } else if (remainingPending.length > 0 && result.synced === 0) {
          hotToast.error(`Sync attempted: 0 synced, ${remainingPending.length} still queued. Check connection or view Debug.`, {
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
        // Only show the skeleton when we have nothing cached to display yet.
        fetchSubmissions(!lastSubmissionsCache);

        // Debounce real-time refreshes: a burst of changes (e.g. bulk auto-verify)
        // should trigger one refetch, not one per row.
        let refreshTimer: ReturnType<typeof setTimeout> | null = null;
        const scheduleRefresh = () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => fetchSubmissions(false), 1500);
        };

        // REAL-TIME LISTENER
        const channel = supabase.channel('submissions-feed')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'onboarding_submissions' },
                (payload) => {
                    console.log('Real-time change received!', payload);
                    // Background refresh without flashing skeleton
                    scheduleRefresh();
                }
            )
            .subscribe();

        // Cleanup function to remove the subscription when the component unmounts
        return () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            supabase.removeChannel(channel);
        };
    }, [fetchSubmissions]);

    // Months that actually have data (newest first) — drives the period dropdown.
    const availableMonths = useMemo(() => {
        const set = new Set<string>();
        submissions.forEach(s => { const d = getSubmissionDate(s); if (d) set.add(monthKey(d)); });
        return [...set].sort().reverse();
    }, [submissions]);

    const periodScopedSubmissions = useMemo(
        () => submissions.filter(s => matchesPeriod(s, periodFilter)),
        [submissions, periodFilter]
    );

    // Site / designation options come from the data in the selected period.
    const siteOptions = useMemo(() => {
        const set = new Set<string>();
        periodScopedSubmissions.forEach(s => { const v = getSubmissionSite(s); if (v) set.add(v); });
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [periodScopedSubmissions]);
    const designationOptions = useMemo(() => {
        const set = new Set<string>();
        periodScopedSubmissions.forEach(s => { const v = getSubmissionDesignation(s); if (v) set.add(v); });
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [periodScopedSubmissions]);

    useEffect(() => {
        if (siteFilter !== 'all' && !siteOptions.includes(siteFilter)) setSiteFilter('all');
    }, [siteOptions, siteFilter]);
    useEffect(() => {
        if (designationFilter !== 'all' && !designationOptions.includes(designationFilter)) setDesignationFilter('all');
    }, [designationOptions, designationFilter]);

    const baseFilteredSubmissions = useMemo(() => periodScopedSubmissions.filter(s =>
        (siteFilter === 'all' || getSubmissionSite(s) === siteFilter) &&
        (designationFilter === 'all' || getSubmissionDesignation(s) === designationFilter)
    ), [periodScopedSubmissions, siteFilter, designationFilter]);

    const hasActiveDataFilters = periodFilter !== 'this_month' || siteFilter !== 'all' || designationFilter !== 'all';

    // Filter submissions by company scope
    const companyScopedSubmissions = useMemo(() => {
        const base = baseFilteredSubmissions;
        if (companyFilter === 'southwall') {
            return base.filter(s => isSubmissionForSouthWall(s));
        }
        if (companyFilter === 'paradigm') {
            return base.filter(s => !isSubmissionForSouthWall(s));
        }
        if (companyFilter === 'all') {
            return base;
        }
        if (!isGlobalHROrOps && isSouthWallUser) {
            return base.filter(s => isSubmissionForSouthWall(s));
        }
        return base;
    }, [baseFilteredSubmissions, companyFilter, isGlobalHROrOps, isSouthWallUser, isSubmissionForSouthWall]);

    // Department cards: per-department counts within the selected company.
    const departmentStats = useMemo(() => {
        const map = new Map<string, { key: string; label: string; total: number; draft: number; pending: number; verified: number; rejected: number }>();
        companyScopedSubmissions.forEach(s => {
            const key = getSubmissionDepartment(s);
            let entry = map.get(key);
            if (!entry) {
                entry = { key, label: formatDepartmentLabel(key), total: 0, draft: 0, pending: 0, verified: 0, rejected: 0 };
                map.set(key, entry);
            }
            entry.total++;
            if (s.status === 'draft') entry.draft++;
            else if (s.status === 'pending') entry.pending++;
            else if (s.status === 'verified') entry.verified++;
            else if (s.status === 'rejected') entry.rejected++;
        });
        return [...map.values()].sort((a, b) =>
            a.key === UNASSIGNED_DEPT ? 1 : b.key === UNASSIGNED_DEPT ? -1 : b.total - a.total || a.label.localeCompare(b.label)
        );
    }, [companyScopedSubmissions]);

    const allDepartmentsCard = useMemo(() => ({
        key: 'all',
        label: 'All Departments',
        total: companyScopedSubmissions.length,
        draft: companyScopedSubmissions.filter(s => s.status === 'draft').length,
        pending: companyScopedSubmissions.filter(s => s.status === 'pending').length,
        verified: companyScopedSubmissions.filter(s => s.status === 'verified').length,
        rejected: companyScopedSubmissions.filter(s => s.status === 'rejected').length,
    }), [companyScopedSubmissions]);

    // Reset the department selection if it no longer exists for the chosen company.
    useEffect(() => {
        if (departmentFilter !== 'all' && !departmentStats.some(d => d.key === departmentFilter)) {
            setDepartmentFilter('all');
        }
    }, [departmentStats, departmentFilter]);

    const departmentScopedSubmissions = useMemo(() => {
        if (departmentFilter === 'all') return companyScopedSubmissions;
        return companyScopedSubmissions.filter(s => getSubmissionDepartment(s) === departmentFilter);
    }, [companyScopedSubmissions, departmentFilter]);

    const filteredSubmissions = useMemo(() => {
        if (!departmentScopedSubmissions) return [];
        return departmentScopedSubmissions.filter(s => {
            // 1. Status tab filter (client-side, since we now fetch all)
            if (statusFilter !== 'all' && s.status !== statusFilter) return false;
            // 2. Search filter
            const siteName = s.organizationName || s.organization?.organizationName || '';
            const query = searchTerm.toLowerCase().trim();
            if (!query) return true;
            const first = s.personal?.firstName?.toLowerCase() || '';
            const last = s.personal?.lastName?.toLowerCase() || '';
            const empId = getDisplayEmployeeId(s).toLowerCase();
            const mobile = s.personal?.mobile?.toLowerCase() || '';
            
            return (
                first.includes(query) ||
                last.includes(query) ||
                empId.includes(query) ||
                mobile.includes(query) ||
                siteName.toLowerCase().includes(query)
            );
        });
    }, [departmentScopedSubmissions, searchTerm, statusFilter]);

    // Excel export of the currently filtered list (gated by passcode approval in OnboardingExportButton).
    const handleExportExcel = useCallback(async () => {
        const fmt = (v?: string | null) => {
            if (!v) return '-';
            const d = new Date(v);
            return isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        };
        const columns: GenericReportColumn[] = [
            { header: 'Employee ID', key: 'employeeId', width: 16 },
            { header: 'Employee Name', key: 'name', width: 26 },
            { header: 'Mobile', key: 'mobile', width: 14 },
            { header: 'Company', key: 'company', width: 12 },
            { header: 'Department', key: 'department', width: 22 },
            { header: 'Site', key: 'site', width: 28 },
            { header: 'Designation', key: 'designation', width: 24 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Submitted On', key: 'submittedOn', width: 20 },
            { header: 'Created By', key: 'createdBy', width: 22 },
            { header: 'Verified / Rejected By', key: 'reviewedBy', width: 22 },
            { header: 'Verified / Rejected On', key: 'reviewedOn', width: 20 },
            { header: 'Rejection Reason', key: 'rejectionReason', width: 30 },
        ];
        const rows = filteredSubmissions.map(s => {
            const anyS = s as any;
            const creatorId = anyS.createdUserId || anyS.created_user_id || anyS.userId || anyS.user_id;
            return {
                employeeId: getDisplayEmployeeId(s),
                name: `${getFullName(s.personal)}`.trim() || '-',
                mobile: s.personal?.mobile || '-',
                company: isSubmissionForSouthWall(s) ? 'SouthWall' : 'Paradigm',
                department: formatDepartmentLabel(getSubmissionDepartment(s)),
                site: getSubmissionSite(s) || '-',
                designation: getSubmissionDesignation(s) || '-',
                status: (s.status || '').toUpperCase(),
                submittedOn: fmt(s.createdAt || s.created_at || s.enrollmentDate),
                createdBy: anyS.createdByName || (creatorId && usersMap[creatorId]?.name) || '-',
                reviewedBy: s.status === 'rejected' ? (anyS.rejectedBy || '-') : s.status === 'verified' ? (s.verifiedBy || '-') : '-',
                reviewedOn: s.status === 'rejected' ? fmt(anyS.rejectedAt) : s.status === 'verified' ? fmt(anyS.verifiedAt) : '-',
                rejectionReason: s.status === 'rejected' ? (anyS.rejectionReason || '-') : '-',
            };
        });
        if (rows.length === 0) {
            hotToast.error('No records to export for the selected filters.');
            return false;
        }
        const dates = filteredSubmissions.map(getSubmissionDate).filter((d): d is Date => !!d);
        const startDate = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date();
        const endDate = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
        try {
            await exportGenericReportToExcel(rows, columns, 'Onboarding Submissions', { startDate, endDate }, 'Onboarding_Submissions', undefined, user?.name);
            hotToast.success(`Exported ${rows.length} record(s).`);
            return true;
        } catch (err) {
            console.error('Onboarding export failed:', err);
            hotToast.error('Failed to export Excel.');
            return false;
        }
    }, [filteredSubmissions, getDisplayEmployeeId, isSubmissionForSouthWall, usersMap, user?.name]);

    const handleApprove = (idOrSubmission: string | OnboardingData) => {
        if (typeof idOrSubmission === 'string') {
            const sub = submissions.find(s => s.id === idOrSubmission);
            if (sub) {
                setApproveModalSubmission(sub);
            } else {
                handleConfirmApprove(idOrSubmission);
            }
        } else {
            setApproveModalSubmission(idOrSubmission);
        }
    };

    const handleConfirmApprove = async (id: string, esignUrl?: string) => {
        const verifierName = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || user?.email?.split('@')[0] || 'HR Admin';
        const verifierPhoto = (user as any)?.user_metadata?.avatar_url || (user as any)?.user_metadata?.picture || null;
        const verifiedAt = new Date().toISOString();

        setIsApproving(true);
        // Optimistic update for UI responsiveness
        setSubmissions(prev => prev.map(s => s.id === id ? { 
            ...s, 
            status: 'verified', 
            portalSyncStatus: 'pending_sync',
            verificationMode: 'manual',
            verifiedBy: verifierName,
            verifiedByPhoto: verifierPhoto,
            verifiedAt: verifiedAt,
            esignDocUrl: esignUrl || s.esignDocUrl,
            esign_document_url: esignUrl || s.esign_document_url,
            esignSignedAt: esignUrl ? verifiedAt : s.esignSignedAt,
            esign_signed_at: esignUrl ? verifiedAt : s.esign_signed_at,
        } : s));

        try {
            await api.verifySubmission(id, 'manual');
            hotToast.success('Submission verified & approved successfully!');
            setApproveModalSubmission(null);
        } catch (error) {
            console.error('Failed to approve submission', error);
            hotToast.error('Failed to approve submission.');
        } finally {
            setIsApproving(false);
        }
    };

    const handleOpenRejectModal = (submission: OnboardingData) => {
        setRejectModalSubmission(submission);
    };

    const handleConfirmReject = async (reason: string) => {
        if (!rejectModalSubmission || !rejectModalSubmission.id) return;
        const id = rejectModalSubmission.id;
        const verifierName = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || user?.email?.split('@')[0] || 'HR Admin';
        const rejectedAt = new Date().toISOString();

        setIsRejecting(true);
        // Optimistic update
        setSubmissions(prev => prev.map(s => s.id === id ? { 
            ...s, 
            status: 'rejected',
            rejectionReason: reason,
            rejection_reason: reason,
            rejectedBy: verifierName,
            rejected_by: verifierName,
            rejectedAt: rejectedAt,
            rejected_at: rejectedAt,
        } : s));

        try {
            await api.requestChanges(id, reason);
            hotToast.success(`❌ Rejected: ${reason}. Submitter has been alerted!`, { duration: 4500 });
            setRejectModalSubmission(null);
        } catch (error) {
            console.error('Failed to reject submission', error);
            hotToast.error('Failed to reject submission.');
        } finally {
            setIsRejecting(false);
        }
    };

    const handleSync = async (id: string) => {
        const sub = submissions.find(s => s.id === id);
        const fcuSt = (sub as any)?.fcuStatus || (sub as any)?.fcu_status;
        if (fcuSt !== 'verified') {
            setToast({ message: 'Complete and verify FCU (Field Check Unit) before portal sync.', type: 'warning' });
            return;
        }

        setSyncingId(id);
        try {
            // The sync function now returns the updated submission
            const updatedSubmission = await api.syncPortals(id);
            // Merge-update: spread the existing record first so nested objects
            // (personal, bank, uan, etc.) are preserved if the edge-function
            // returns only a partial payload.
            setSubmissions(prev => prev.map(s =>
                s.id === id ? { ...s, ...updatedSubmission } : s
            ));
            if (updatedSubmission.portalSyncStatus === 'synced') {
                setToast({ message: 'Portals synced successfully!', type: 'success' });
            } else {
                setToast({ message: 'Portal sync failed. Check details.', type: 'error' });
            }
        } catch (error: any) {
            console.error('Sync failed:', error);
            setToast({ message: error?.message || 'An error occurred during sync.', type: 'error' });
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

    const colSpan = 6;

    // Calculate counts for each status based on companyScopedSubmissions
    const counts = useMemo(() => {
        return {
            all: departmentScopedSubmissions.length,
            draft: departmentScopedSubmissions.filter(s => s.status === 'draft').length,
            pending: departmentScopedSubmissions.filter(s => s.status === 'pending').length,
            verified: departmentScopedSubmissions.filter(s => s.status === 'verified').length,
            rejected: departmentScopedSubmissions.filter(s => s.status === 'rejected').length
        };
    }, [departmentScopedSubmissions]);

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
        <div className="p-3 md:p-6 bg-slate-50/50 dark:bg-[#041b0f] min-h-full space-y-5 pb-24">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            {/* Mobile Top Back Bar */}
            {isMobile && (
                <div className="flex items-center gap-3 mb-1">
                    <button
                        type="button"
                        onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/mobile-home?category=Employee+Onboarding')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#065f46] hover:bg-[#044e3b] text-white border border-emerald-500/40 font-bold text-xs shadow-[0_2px_8px_rgba(6,95,70,0.4)] active:scale-95 transition-all cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Back</span>
                    </button>
                    <div className="h-[1px] flex-1 bg-[#134426]" />
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white bg-[#065f46] px-2.5 py-1 rounded-lg border border-emerald-500/40 shadow-[0_2px_8px_rgba(6,95,70,0.35)]">
                        ONBOARDING
                    </span>
                </div>
            )}

            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Onboarding Forms</h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-[#092c19] text-emerald-800 dark:text-[#44D62C] border border-emerald-200 dark:border-[#134426]">
                            {companyScopedSubmissions.length} Total
                        </span>
                        {isSouthWallUser && !isGlobalHROrOps && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                <Building2 className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                                SouthWall Security
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 dark:text-white/60 text-sm mt-0.5">
                        {isSouthWallUser && !isGlobalHROrOps
                            ? 'Showing SouthWall employee onboarding applications & records'
                            : 'Manage, review, and verify employee onboarding applications across sites'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => navigate('/onboarding/submissions')}
                      className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-[#092c19] dark:hover:bg-[#134426] text-emerald-800 dark:text-[#44D62C] rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border border-emerald-200 dark:border-[#134426] shadow-xs cursor-pointer"
                      title="View only submissions created by you"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-[#44D62C]" /> My Submissions
                    </button>
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all duration-200 flex items-center gap-2 border cursor-pointer ${
                        pendingOrFailedCount > 0
                          ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-500 shadow-amber-500/20'
                          : 'bg-white hover:bg-slate-100 dark:bg-[#092c19] dark:hover:bg-[#134426] text-slate-700 dark:text-white border-slate-200 dark:border-[#134426]'
                      }`}
                      title="Trigger immediate sync of all offline records"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing...' : `Sync Now${pendingOrFailedCount > 0 ? ` (${pendingOrFailedCount})` : ''}`}
                    </button>
                    <button
                      onClick={() => setShowDebugModal(true)}
                      className="px-3.5 py-2.5 bg-white hover:bg-slate-100 dark:bg-[#092c19] dark:hover:bg-[#134426] text-slate-700 dark:text-amber-400 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border border-slate-200 dark:border-[#134426] shadow-xs cursor-pointer"
                      title="View sync diagnostics and error tracebacks"
                    >
                      <Bug className="w-3.5 h-3.5 text-amber-500" /> Debug
                    </button>
                    <OnboardingExportButton
                        onExport={handleExportExcel}
                        rowCount={filteredSubmissions.length}
                        filtersLabel={[
                            periodFilter === 'this_month' ? 'This Month' : periodFilter === 'last_month' ? 'Last Month' : periodFilter === 'last_3_months' ? 'Last 3 Months' : periodFilter === 'all' ? 'All Time' : monthLabel(periodFilter.slice('month:'.length)),
                            companyFilter !== 'all' ? (companyFilter === 'southwall' ? 'SouthWall' : 'Paradigm') : null,
                            departmentFilter !== 'all' ? formatDepartmentLabel(departmentFilter) : null,
                            siteFilter !== 'all' ? siteFilter : null,
                            designationFilter !== 'all' ? designationFilter : null,
                            statusFilter !== 'all' ? statusFilter : null,
                        ].filter(Boolean).join(' · ')}
                    />
                </div>
            </div>

            {/* Filters: company → period → site → designation, then department chips */}
            <div className="bg-white dark:bg-[#092c19] rounded-2xl border border-slate-200/80 dark:border-[#134426] shadow-xs">
                <div className="flex flex-wrap items-center gap-2 p-3">
                    <div className="flex items-center bg-slate-50 dark:bg-[#041b0f] p-1 rounded-xl border border-slate-200 dark:border-[#134426]">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-white/50 px-2 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-[#44D62C]" />
                            Company:
                        </span>
                        <button
                            type="button"
                            onClick={() => setCompanyFilter('all')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                companyFilter === 'all'
                                    ? 'bg-emerald-600 dark:bg-[#065f46] text-white shadow-xs border border-transparent dark:border-white/10'
                                    : 'text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#134426]/50'
                            }`}
                        >
                            All ({baseFilteredSubmissions.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setCompanyFilter('southwall')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                companyFilter === 'southwall'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#134426]/50'
                            }`}
                        >
                            SouthWall ({baseFilteredSubmissions.filter(s => isSubmissionForSouthWall(s)).length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setCompanyFilter('paradigm')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                companyFilter === 'paradigm'
                                    ? 'bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#134426]/50'
                            }`}
                        >
                            Paradigm ({baseFilteredSubmissions.filter(s => !isSubmissionForSouthWall(s)).length})
                        </button>
                    </div>
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-[#44D62C] ml-2" />
                <select
                    value={periodFilter}
                    onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-[#134426] bg-slate-50 dark:bg-[#041b0f] text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    title="Submission period"
                >
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="last_3_months">Last 3 Months</option>
                    <option value="all">All Time</option>
                    {availableMonths.length > 0 && (
                        <optgroup label="Specific month">
                            {availableMonths.map(m => <option key={m} value={`month:${m}`}>{monthLabel(m)}</option>)}
                        </optgroup>
                    )}
                </select>
                <MapPin className="w-4 h-4 text-slate-400 ml-2" />
                <select
                    value={siteFilter}
                    onChange={(e) => setSiteFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-[#134426] bg-slate-50 dark:bg-[#041b0f] text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[220px]"
                    title="Site"
                >
                    <option value="all">All Sites ({siteOptions.length})</option>
                    {siteOptions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <Briefcase className="w-4 h-4 text-slate-400 ml-2" />
                <select
                    value={designationFilter}
                    onChange={(e) => setDesignationFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-[#134426] bg-slate-50 dark:bg-[#041b0f] text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[220px]"
                    title="Designation"
                >
                    <option value="all">All Designations ({designationOptions.length})</option>
                    {designationOptions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                {hasActiveDataFilters && (
                    <button
                        onClick={() => { setPeriodFilter('this_month'); setSiteFilter('all'); setDesignationFilter('all'); }}
                        className="ml-1 text-xs font-semibold text-emerald-700 dark:text-[#44D62C] hover:underline cursor-pointer"
                    >
                        Reset
                    </button>
                )}
                </div>
                {departmentStats.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-t border-slate-100 dark:border-[#134426]">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider mr-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-[#44D62C]" /> Department
                        </span>
                        {[allDepartmentsCard, ...departmentStats].map(d => {
                            const selected = departmentFilter === d.key;
                            return (
                                <button
                                    key={d.key}
                                    onClick={() => setDepartmentFilter(selected && d.key !== 'all' ? 'all' : d.key)}
                                    title={`${d.label}: ${d.draft} draft · ${d.pending} pending · ${d.verified} verified · ${d.rejected} rejected`}
                                    className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                                        selected
                                            ? 'bg-emerald-600 dark:bg-[#065f46] text-white border-emerald-600 dark:border-white/10 shadow-xs'
                                            : 'bg-white dark:bg-[#041b0f] text-slate-700 dark:text-white/80 border-slate-200 dark:border-[#134426] hover:border-emerald-400'
                                    }`}
                                >
                                    {d.pending > 0 && (
                                        <span className={`w-1.5 h-1.5 rounded-full ${selected ? 'bg-amber-300' : 'bg-amber-500'}`} />
                                    )}
                                    {d.label}
                                    <span className={`min-w-[22px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        selected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-[#092c19] text-slate-600 dark:text-white/70'
                                    }`}>{d.total}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div 
                    onClick={() => setStatusFilter('all')}
                    className={`col-span-2 sm:col-span-1 cursor-pointer bg-white dark:bg-[#092c19] px-4 py-3 rounded-xl border transition-all duration-200 shadow-xs hover:shadow-md ${
                        statusFilter === 'all' 
                            ? 'border-emerald-500 dark:border-[#44D62C] ring-2 ring-emerald-500/20 dark:ring-[#44D62C]/20' 
                            : 'border-slate-200/80 dark:border-[#134426] hover:border-slate-300 dark:hover:border-[#44D62C]/40'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold text-slate-500 dark:text-white/60 uppercase tracking-wider">Total</span>
                            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{counts.all}</div>
                        </div>
                        <div className="p-2 bg-emerald-50 dark:bg-[#041b0f] rounded-xl text-emerald-600 dark:text-[#44D62C] border border-emerald-100 dark:border-[#134426]">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                <div 
                    onClick={() => setStatusFilter('draft')}
                    className={`cursor-pointer bg-white dark:bg-[#092c19] px-4 py-3 rounded-xl border transition-all duration-200 shadow-xs hover:shadow-md ${
                        statusFilter === 'draft' 
                            ? 'border-slate-600 dark:border-slate-400 ring-2 ring-slate-600/20' 
                            : 'border-slate-200/80 dark:border-[#134426] hover:border-slate-300 dark:hover:border-[#44D62C]/40'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-white/60 uppercase tracking-wider">Drafts</span>
                        <div className="p-2 bg-slate-100 dark:bg-[#041b0f] rounded-xl text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#134426]">
                            <Edit2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-xl font-black text-slate-900 dark:text-white">{counts.draft}</span>
                        {counts.draft > 0 && (
                            <span className="text-[10px] font-bold text-slate-700 dark:text-white/80 bg-slate-100 dark:bg-[#041b0f] border border-slate-200 dark:border-[#134426] px-2 py-0.5 rounded-full">In Progress</span>
                        )}
                    </div>
                </div>

                <div 
                    onClick={() => setStatusFilter('pending')}
                    className={`cursor-pointer bg-white dark:bg-[#092c19] px-4 py-3 rounded-xl border transition-all duration-200 shadow-xs hover:shadow-md ${
                        statusFilter === 'pending' 
                            ? 'border-amber-500 dark:border-amber-400 ring-2 ring-amber-500/20 dark:ring-amber-400/20' 
                            : 'border-slate-200/80 dark:border-[#134426] hover:border-slate-300 dark:hover:border-[#44D62C]/40'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-white/60 uppercase tracking-wider">Pending</span>
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-xl font-black text-slate-900 dark:text-white">{counts.pending}</span>
                        {counts.pending > 0 && (
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800/80 px-2 py-0.5 rounded-full animate-pulse">Action Needed</span>
                        )}
                    </div>
                </div>

                <div 
                    onClick={() => setStatusFilter('verified')}
                    className={`cursor-pointer bg-white dark:bg-[#092c19] px-4 py-3 rounded-xl border transition-all duration-200 shadow-xs hover:shadow-md ${
                        statusFilter === 'verified' 
                            ? 'border-teal-500 dark:border-[#44D62C] ring-2 ring-teal-500/20 dark:ring-[#44D62C]/20' 
                            : 'border-slate-200/80 dark:border-[#134426] hover:border-slate-300 dark:hover:border-[#44D62C]/40'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-white/60 uppercase tracking-wider">Verified</span>
                        <div className="p-2 bg-teal-50 dark:bg-emerald-950/60 rounded-xl text-teal-600 dark:text-[#44D62C] border border-teal-200 dark:border-emerald-800/60">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white mt-2">{counts.verified}</div>
                </div>

                <div 
                    onClick={() => setStatusFilter('rejected')}
                    className={`cursor-pointer bg-white dark:bg-[#092c19] px-4 py-3 rounded-xl border transition-all duration-200 shadow-xs hover:shadow-md ${
                        statusFilter === 'rejected' 
                            ? 'border-rose-500 dark:border-rose-400 ring-2 ring-rose-500/20 dark:ring-rose-400/20' 
                            : 'border-slate-200/80 dark:border-[#134426] hover:border-slate-300 dark:hover:border-[#44D62C]/40'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-white/60 uppercase tracking-wider">Rejected</span>
                        <div className="p-2 bg-rose-50 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                            <XCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white mt-2">{counts.rejected}</div>
                </div>
            </div>

            {/* Main Table Card */}
            <div className="bg-white dark:bg-[#092c19] rounded-2xl shadow-sm border border-slate-200/80 dark:border-[#134426] overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-[#134426] bg-slate-50/50 dark:bg-[#092c19] flex-shrink-0">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                        <div className="text-sm text-slate-600 dark:text-white/70 self-start lg:self-center">
                            Showing <b className="text-slate-900 dark:text-white">{filteredSubmissions.length}</b>
                            {statusFilter !== 'all' && <span className="capitalize"> {statusFilter}</span>} record{filteredSubmissions.length === 1 ? '' : 's'}
                            {statusFilter !== 'all' && (
                                <button onClick={() => setStatusFilter('all')} className="ml-2 text-xs font-semibold text-emerald-700 dark:text-[#44D62C] hover:underline cursor-pointer">Clear status</button>
                            )}
                        </div>
                        <div className="relative w-full lg:max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-slate-400 dark:text-white/40" />
                            </div>
                            <input
                                id="onboarding-search"
                                name="onboardingSearch"
                                type="text"
                                placeholder="Search by name, ID, or site..."
                                aria-label="Search onboarding forms"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="block w-full bg-white dark:bg-[#041b0f] border border-slate-200 dark:border-[#134426] rounded-xl py-2 pl-10 pr-4 text-xs placeholder-slate-400 dark:placeholder-white/40 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:focus:border-[#44D62C] transition-all shadow-xs"
                            />
                        </div>
                    </div>
                </div>

            <div className="overflow-x-auto pb-6 md:pb-2">
                {isMobile ? (
                    <div className="flex flex-col gap-3 px-1 mt-2">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-40 bg-slate-100 dark:bg-[#092c19] rounded-2xl border border-slate-200 dark:border-[#134426] animate-pulse"></div>
                            ))
                        ) : filteredSubmissions.length === 0 ? (
                            <div className="text-center py-16 bg-slate-50/50 dark:bg-[#092c19] rounded-2xl border border-slate-200/80 dark:border-[#134426]">
                                <div className="flex flex-col items-center justify-center text-slate-400 dark:text-white/40">
                                    <Search className="h-10 w-10 mb-3 opacity-30 text-emerald-600 dark:text-[#44D62C]" />
                                    <p className="text-sm font-semibold text-slate-700 dark:text-white">
                                        {companyFilter === 'southwall' 
                                            ? 'No SouthWall onboarding submissions found' 
                                            : companyFilter === 'paradigm' 
                                                ? 'No Paradigm onboarding submissions found' 
                                                : 'No submissions found'}
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-white/50 mt-1">
                                        {submissions.length > 0 && companyFilter !== 'all' 
                                            ? `There are ${submissions.length} submission(s) in other company views.` 
                                            : 'Try adjusting your search or filters'}
                                    </p>
                                    {submissions.length > 0 && companyFilter !== 'all' && (
                                        <button
                                            type="button"
                                            onClick={() => setCompanyFilter('all')}
                                            className="mt-3 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-[#041b0f] dark:hover:bg-[#134426] text-emerald-700 dark:text-[#44D62C] border border-emerald-200 dark:border-[#134426] rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                        >
                                            View All Submissions ({submissions.length})
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            filteredSubmissions.map((s) => {
                                const displayEmpId = getDisplayEmployeeId(s);
                                const empDisplayName = getFullName(s.personal) || (s.personal?.mobile ? `Draft (${s.personal.mobile})` : (displayEmpId !== 'ID: Pending' ? `Draft (${displayEmpId})` : 'Draft Applicant'));
                                const empInitials = ((s.personal?.firstName?.[0] || '') + (s.personal?.lastName?.[0] || '')) || 'DR';
                                const empPhoto = getEmployeePhoto(s);
                                const isDraft = s.status === 'draft';

                                return (
                                <div key={s.id} className={`bg-white dark:bg-[#092c19] border ${s.requiresManualVerification ? 'border-amber-300 dark:border-amber-500/60 bg-amber-50/30 dark:bg-amber-950/20' : isDraft ? 'border-slate-300 dark:border-[#134426] bg-slate-50/30 dark:bg-[#092c19]' : 'border-slate-200/80 dark:border-[#134426]'} rounded-2xl p-4 shadow-xs flex flex-col gap-3 relative overflow-hidden transition-all duration-300 hover:shadow-md`}>
                                    {s.requiresManualVerification && (
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
                                    )}
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-11 w-11 flex-shrink-0 flex items-center justify-center">
                                                {empPhoto ? (
                                                    <img 
                                                        src={empPhoto} 
                                                        alt={empDisplayName} 
                                                        className="h-11 w-11 rounded-full object-cover border-2 border-slate-200 dark:border-[#134426] shadow-2xs"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            const fb = e.currentTarget.parentElement?.querySelector('.emp-fallback-m') as HTMLElement;
                                                            if (fb) fb.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div 
                                                    className={`emp-fallback-m h-11 w-11 rounded-full ${isDraft ? 'bg-slate-700 dark:bg-[#041b0f] dark:text-white/60' : 'bg-gradient-to-br from-emerald-500 to-teal-700'} text-white items-center justify-center font-black text-sm shadow-2xs border-2 border-white dark:border-[#134426] uppercase ${empPhoto ? 'hidden' : 'flex'}`}
                                                >
                                                    {empInitials}
                                                </div>
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                                                        {empDisplayName}
                                                    </span>
                                                    {s.requiresManualVerification && (
                                                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                    )}
                                                </div>
                                                <div className="font-mono text-xs text-slate-500 dark:text-white/50 mt-0.5">{displayEmpId}</div>
                                            </div>
                                        </div>
                                        {statusFilter !== 'verified' && (
                                            <div>
                                                <StatusChip status={s.status} />
                                                {s.status === 'rejected' && (
                                                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-1 rounded-md shadow-2xs" title={s.rejectionReason || (s as any).rejection_reason || s.personal?.rejectionReason || 'Profile Photo Mismatch'}>
                                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                                        <span className="truncate max-w-[180px]">
                                                            {s.rejectionReason || (s as any).rejection_reason || s.personal?.rejectionReason || 'Profile Photo Mismatch'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-col gap-2.5 bg-slate-50/80 dark:bg-[#041b0f] rounded-xl p-3 border border-slate-200/60 dark:border-[#134426] mt-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-slate-500 dark:text-white/50 font-bold uppercase tracking-wider">Designation</span>
                                            <span className="text-xs text-slate-800 dark:text-white font-semibold">{s.organization?.designation || '-'}</span>
                                        </div>
                                        <div className="w-full h-px bg-slate-200/60 dark:bg-[#134426]"></div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-slate-500 dark:text-white/50 font-bold uppercase tracking-wider">Site Location</span>
                                            <span className="text-xs text-slate-800 dark:text-white font-semibold">{s.organizationName || s.organization?.organizationName || '-'}</span>
                                        </div>
                                        <div className="w-full h-px bg-slate-200/60 dark:bg-[#134426]"></div>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[11px] text-slate-500 dark:text-white/50 font-bold uppercase tracking-wider">Verified Documents</span>
                                            <DocumentVerificationBadges submission={s} onToggleDoc={(key) => handleToggleDocVerification(s.id!, key)} />
                                        </div>
                                        <div className="w-full h-px bg-slate-200/60 dark:bg-[#134426]"></div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-slate-500 dark:text-white/50 font-bold uppercase tracking-wider">Created By</span>
                                            {(() => {
                                                const creator = getCreatorInfo(s);
                                                return (
                                                    <div className="flex items-center gap-1.5">
                                                        {creator.photo ? (
                                                            <img src={creator.photo} alt={creator.name} className="h-5 w-5 rounded-full object-cover border border-slate-300 dark:border-[#134426]" />
                                                        ) : (
                                                            <div className="h-5 w-5 rounded-full bg-slate-700 dark:bg-[#092c19] text-white dark:text-[#44D62C] font-black text-[8.5px] flex items-center justify-center uppercase border border-transparent dark:border-[#134426]">
                                                                {creator.initials}
                                                            </div>
                                                        )}
                                                        <span className="text-xs text-slate-800 dark:text-white font-bold capitalize">{creator.name}</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div className="w-full h-px bg-slate-200/60 dark:bg-[#134426]"></div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-slate-500 dark:text-white/50 font-bold uppercase tracking-wider">Created Date/Time</span>
                                            <span className="text-xs text-slate-800 dark:text-white font-semibold">{formatCreatedDate(s.createdAt || s.created_at || s.enrollmentDate)}</span>
                                        </div>
                                        {s.status === 'verified' && (
                                            <>
                                                <div className="w-full h-px bg-slate-200/60 dark:bg-[#134426]"></div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-slate-500 dark:text-white/50 font-bold uppercase tracking-wider">Approved By</span>
                                                    {s.verificationMode === 'auto' || s.verifiedBy === 'Paradigm AI Agent' ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-800 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 px-2 py-0.5 rounded-md border border-violet-200 dark:border-violet-800">
                                                            <Bot className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
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
                                                            <span className="text-xs font-bold text-slate-800 dark:text-white">{s.verifiedBy || 'HR Admin'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="w-full h-px bg-slate-200/60 dark:bg-[#134426]"></div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-slate-500 dark:text-white/50 font-bold uppercase tracking-wider">FCU Status</span>
                                                    {(() => {
                                                        const fcuSt = (s as any).fcuStatus || (s as any).fcu_status;
                                                        if (fcuSt === 'verified') {
                                                            return (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                    <CheckCircle2 size={10} className="text-emerald-600 dark:text-emerald-400" /> Verified
                                                                </span>
                                                            );
                                                        }
                                                        if (fcuSt === 'failed') {
                                                            return (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 dark:bg-rose-950/60 text-red-700 dark:text-rose-300 border border-red-200 dark:border-rose-800">
                                                                    <XCircle size={10} className="text-red-600 dark:text-rose-400" /> Failed
                                                                </span>
                                                            );
                                                        }
                                                        if (fcuSt === 'pending') {
                                                            return (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                        <Clock size={10} className="text-amber-600 dark:text-amber-400 animate-pulse" /> Pending
                                                                    </span>
                                                                    <button
                                                                        onClick={() => s.id && api.updateFcuStatus(s.id, 'verified').then(() => fetchSubmissions())}
                                                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer"
                                                                    >
                                                                        Done
                                                                    </button>
                                                                    <button
                                                                        onClick={() => s.id && api.updateFcuStatus(s.id, 'failed', 'FCU failed').then(() => fetchSubmissions())}
                                                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 dark:bg-rose-950/60 text-red-700 dark:text-rose-300 border border-red-200 dark:border-rose-800 hover:bg-red-100 cursor-pointer"
                                                                    >
                                                                        Fail
                                                                    </button>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <button
                                                                onClick={() => s.id && api.acknowledgeOnboardingVerification(s.id).then(() => fetchSubmissions())}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 dark:bg-[#041b0f] text-slate-600 dark:text-white/70 border border-slate-200 dark:border-[#134426] hover:bg-teal-50 dark:hover:bg-[#134426] hover:text-teal-700 dark:hover:text-[#44D62C] cursor-pointer"
                                                            >
                                                                <Play size={9} /> Start FCU
                                                            </button>
                                                        );
                                                    })()}
                                                </div>
                                            </>
                                        )}
                                        {s.status === 'rejected' && (
                                            <>
                                                <div className="w-full h-px bg-slate-200/60 dark:bg-[#134426]"></div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-slate-500 dark:text-white/50 font-bold uppercase tracking-wider">Rejected By</span>
                                                    <span className="text-xs font-bold text-rose-900 dark:text-rose-300">{s.rejectedBy || (s as any).rejected_by || s.personal?.rejectedBy || 'HR Admin'}</span>
                                                </div>
                                                <div className="w-full h-px bg-slate-200/60 dark:bg-[#134426]"></div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">Rejection Reason</span>
                                                    <span className="text-xs font-extrabold text-rose-700 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                                                        {s.rejectionReason || (s as any).rejection_reason || s.personal?.rejectionReason || 'Profile Photo Mismatch'}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-2 mt-1 pt-3 border-t border-slate-100 dark:border-[#134426] flex-wrap">
                                        {isDraft && (
                                            <button 
                                                onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                className="px-3 py-1.5 text-white bg-slate-800 dark:bg-[#041b0f] hover:bg-slate-900 dark:hover:bg-[#134426] border border-transparent dark:border-[#134426] rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 shadow-xs cursor-pointer"
                                                title="Resume Incomplete Enrollment"
                                            >
                                                <Play className="h-3 w-3 fill-current text-emerald-400" /> Resume
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => navigate(`/onboarding/add/review?id=${s.id}`)}
                                            className="px-3 py-1.5 text-slate-600 dark:text-white hover:text-emerald-700 dark:hover:text-[#44D62C] bg-slate-100 dark:bg-[#041b0f] hover:bg-emerald-50 dark:hover:bg-[#134426] rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1 border border-slate-200 dark:border-[#134426] cursor-pointer"
                                            title="View Details"
                                        >
                                            <Eye className="h-3.5 w-3.5 text-slate-500 dark:text-[#44D62C]" /> View
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                            className="px-3 py-1.5 text-slate-600 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 bg-slate-100 dark:bg-[#041b0f] hover:bg-blue-50 dark:hover:bg-[#134426] rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1 border border-slate-200 dark:border-[#134426] cursor-pointer"
                                            title="Edit Submission"
                                        >
                                            <Edit2 className="h-3.5 w-3.5 text-slate-500 dark:text-blue-400" /> Edit
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/onboarding/pdf/${s.id}`)}
                                            className="px-3 py-1.5 text-slate-600 dark:text-white hover:text-teal-700 dark:hover:text-teal-400 bg-slate-100 dark:bg-[#041b0f] hover:bg-teal-50 dark:hover:bg-[#134426] rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1 border border-slate-200 dark:border-[#134426] cursor-pointer"
                                            title="Download Forms"
                                        >
                                            <FileText className="h-3.5 w-3.5 text-slate-500 dark:text-teal-400" /> Forms
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(s.id!)}
                                            className="px-3 py-1.5 text-slate-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 bg-slate-100 dark:bg-[#041b0f] hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl text-xs font-bold transition-all duration-200 border border-slate-200 dark:border-[#134426] flex items-center gap-1 cursor-pointer"
                                            title="Delete Submission"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 text-rose-500" /> Delete
                                        </button>
                                        
                                        {s.status === 'pending' && (
                                            <>
                                                <button 
                                                    onClick={() => handleApprove(s.id!)}
                                                    className="px-3.5 py-1.5 text-white bg-[#065f46] hover:bg-[#044e39] rounded-xl text-xs font-bold transition-all duration-200 shadow-xs flex items-center gap-1 border border-white/10 cursor-pointer"
                                                >
                                                    <CheckSquare className="h-3.5 w-3.5 stroke-[2.5]" /> Approve
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenRejectModal(s)}
                                                    className="px-3.5 py-1.5 text-rose-400 bg-[#041b0f] hover:bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs font-black transition-all duration-200 flex items-center gap-1 cursor-pointer"
                                                >
                                                    <XSquare className="h-3.5 w-3.5" /> Reject
                                                </button>
                                            </>
                                        )}
                                        {s.status === 'rejected' && (
                                            <>
                                                <button 
                                                    onClick={() => handleOpenRejectModal(s)}
                                                    className="px-3 py-1.5 text-rose-400 bg-[#041b0f] hover:bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1 cursor-pointer"
                                                    title="Update Rejection Reason"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" /> Reason
                                                </button>
                                                <button 
                                                    onClick={() => handleApprove(s.id!)}
                                                    className="px-3.5 py-1.5 text-white bg-[#065f46] hover:bg-[#044e39] rounded-xl text-xs font-bold transition-all duration-200 shadow-xs flex items-center gap-1 border border-white/10 cursor-pointer"
                                                    title="Approve Submission"
                                                >
                                                    <CheckSquare className="h-3.5 w-3.5 stroke-[2.5]" /> Approve
                                                </button>
                                            </>
                                        )}
                                        {s.status === 'verified' && (
                                            (() => {
                                                const fcuSt = (s as any).fcuStatus || (s as any).fcu_status;
                                                const isFcuDone = fcuSt === 'verified';
                                                if (s.portalSyncStatus === 'synced') {
                                                    return (
                                                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                                                            <CheckSquare className="h-3.5 w-3.5" /> Synced
                                                        </span>
                                                    );
                                                }
                                                if (!isFcuDone) {
                                                    return (
                                                        <button
                                                            onClick={() => setToast({ message: 'Complete and verify FCU before portal sync.', type: 'warning' })}
                                                            className="px-2.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all flex items-center gap-1"
                                                        >
                                                            <Clock className="w-3 h-3 text-amber-600" /> FCU Required
                                                        </button>
                                                    );
                                                }
                                                return (
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
                                                );
                                            })()
                                        )}
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <table className="w-full min-w-[980px] border-separate border-spacing-0 table-fixed">
                        <colgroup>
                            <col className="w-[24%]" />
                            <col className="w-[20%]" />
                            <col className="w-[22%]" />
                            <col className="w-[10%]" />
                            <col className="w-[12%]" />
                            <col className="w-[172px]" />
                        </colgroup>
                        <thead>
                            <tr className="bg-slate-50/80 dark:bg-[#041b0f]">
                                {['Employee', 'Site & Role', 'Status', 'Documents', 'Created'].map(h => (
                                    <th key={h} scope="col" className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider border-b border-slate-200 dark:border-[#134426] whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                                <th scope="col" className="sticky right-0 z-20 bg-slate-50 dark:bg-[#041b0f] px-4 py-2.5 text-right text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider border-b border-slate-200 dark:border-[#134426]">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <TableSkeleton rows={6} cols={colSpan} />
                            ) : filteredSubmissions.length === 0 ? (
                                <tr><td colSpan={colSpan} className="text-center py-16">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <Search className="h-10 w-10 mb-3 opacity-30 text-emerald-600" />
                                        <p className="text-sm font-semibold text-slate-700 dark:text-white/80">No onboarding submissions match these filters</p>
                                        <p className="text-xs text-slate-400 mt-1">Try another month, company, department or status.</p>
                                        {(hasActiveDataFilters || companyFilter !== 'all' || departmentFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPeriodFilter('all'); setSiteFilter('all'); setDesignationFilter('all');
                                                    setCompanyFilter('all'); setDepartmentFilter('all'); setStatusFilter('all'); setSearchTerm('');
                                                }}
                                                className="mt-3 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                            >
                                                Clear all filters
                                            </button>
                                        )}
                                    </div>
                                </td></tr>
                            ) : (
                                filteredSubmissions.map((s) => {
                                    const displayEmpId = getDisplayEmployeeId(s);
                                    const empDisplayName = getFullName(s.personal) || (s.personal?.mobile ? `Draft (${s.personal.mobile})` : (displayEmpId !== 'ID: Pending' ? `Draft (${displayEmpId})` : 'Draft Applicant'));
                                    const empInitials = ((s.personal?.firstName?.[0] || '') + (s.personal?.lastName?.[0] || '')) || 'DR';
                                    const empPhoto = getEmployeePhoto(s);
                                    const isDraft = s.status === 'draft';
                                    const currentRejectionReason = s.rejectionReason || (s as any).rejection_reason || s.personal?.rejectionReason || 'Profile Photo Mismatch';
                                    const currentRejectedBy = s.rejectedBy || (s as any).rejected_by || s.personal?.rejectedBy || 'HR Admin';
                                    const currentRejectedAt = s.rejectedAt || (s as any).rejected_at || s.personal?.rejectedAt;
                                    const isAiVerified = s.verificationMode === 'auto' || s.verifiedBy === 'Paradigm AI Agent';
                                    const fcuSt: string | null = (s as any).fcuStatus || (s as any).fcu_status || null;
                                    const creator = getCreatorInfo(s);
                                    const site = prettyText(s.organizationName || s.organization?.organizationName) || '—';
                                    const designation = prettyText(s.organization?.designation) || '—';
                                    const accent = s.requiresManualVerification
                                        ? 'border-l-amber-400'
                                        : s.status === 'pending' ? 'border-l-amber-300'
                                        : s.status === 'rejected' ? 'border-l-rose-400'
                                        : s.status === 'verified' ? 'border-l-emerald-400'
                                        : 'border-l-slate-200';
                                    const cell = 'px-4 py-2.5 align-middle border-b border-slate-100 dark:border-[#134426] bg-white dark:bg-[#092c19] group-hover:bg-slate-50/80 dark:group-hover:bg-[#0c3a21] transition-colors';

                                    const menuItems: RowMenuItem[] = [
                                        { label: 'View details', icon: Eye, onClick: () => navigate(`/onboarding/add/review?id=${s.id}`) },
                                        { label: 'Edit application', icon: Edit2, onClick: () => navigate(`/onboarding/add/personal?id=${s.id}`) },
                                        { label: 'Download forms', icon: FileText, onClick: () => navigate(`/onboarding/pdf/${s.id}`) },
                                        ...(s.status === 'rejected' ? [{ label: 'Update rejection reason', icon: Edit2, onClick: () => handleOpenRejectModal(s) }] : []),
                                        ...(s.status === 'verified' && fcuSt === 'pending' ? [{ label: 'Mark FCU failed', icon: XCircle, onClick: () => { if (s.id) api.updateFcuStatus(s.id, 'failed', 'FCU verification failed').then(() => fetchSubmissions()); } }] : []),
                                        { label: 'Delete application', icon: Trash2, onClick: () => handleDelete(s.id!), danger: true },
                                    ];

                                    const btn = 'h-7 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap';
                                    let primary: React.ReactNode = null;
                                    if (isDraft) {
                                        primary = (
                                            <button onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)} className={`${btn} bg-white dark:bg-[#041b0f] text-slate-800 dark:text-white border border-slate-300 dark:border-[#134426] hover:bg-slate-50`} title="Resume incomplete enrollment">
                                                <Play className="h-3 w-3 fill-current" /> Resume
                                            </button>
                                        );
                                    } else if (s.status === 'pending') {
                                        primary = (
                                            <>
                                                <button onClick={() => handleOpenRejectModal(s)} className={`${btn} px-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40`} title="Reject & request changes">
                                                    Reject
                                                </button>
                                                <button onClick={() => handleApprove(s.id!)} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs`} title="Verify & approve">
                                                    <CheckSquare className="h-3 w-3" /> Approve
                                                </button>
                                            </>
                                        );
                                    } else if (s.status === 'rejected') {
                                        primary = (
                                            <button onClick={() => handleApprove(s.id!)} className={`${btn} bg-white dark:bg-[#041b0f] text-emerald-700 dark:text-[#44D62C] border border-emerald-300 dark:border-[#134426] hover:bg-emerald-50`} title="Approve after correction">
                                                <CheckSquare className="h-3 w-3" /> Approve
                                            </button>
                                        );
                                    } else if (s.status === 'verified') {
                                        if (s.portalSyncStatus === 'synced') {
                                            primary = (
                                                <span className="h-7 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-[#44D62C]">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Synced
                                                </span>
                                            );
                                        } else if (fcuSt === 'verified') {
                                            primary = (
                                                <button onClick={() => handleSync(s.id!)} disabled={syncingId === s.id} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-60`} title="Sync to portals">
                                                    {syncingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Sync
                                                </button>
                                            );
                                        } else if (fcuSt === 'pending') {
                                            primary = (
                                                <button onClick={() => { if (s.id) api.updateFcuStatus(s.id, 'verified').then(() => fetchSubmissions()); }} className={`${btn} bg-teal-600 hover:bg-teal-700 text-white shadow-xs`} title="Mark field check (FCU) as verified">
                                                    <CheckCircle2 className="h-3 w-3" /> FCU Done
                                                </button>
                                            );
                                        } else if (fcuSt === 'failed') {
                                            primary = (
                                                <span className="h-7 inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                                                    <XCircle className="h-3.5 w-3.5" /> FCU Failed
                                                </span>
                                            );
                                        } else {
                                            primary = (
                                                <button onClick={() => { if (s.id) api.acknowledgeOnboardingVerification(s.id).then(() => fetchSubmissions()); }} className={`${btn} bg-white dark:bg-[#041b0f] text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-[#134426] hover:bg-teal-50`} title="Start field check (FCU)">
                                                    <Play className="h-3 w-3" /> Start FCU
                                                </button>
                                            );
                                        }
                                    }

                                    return (
                                    <tr key={s.id} className="group">
                                        {/* Employee */}
                                        <td className={`${cell} border-l-[3px] ${accent}`}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="relative h-9 w-9 flex-shrink-0">
                                                    {empPhoto ? (
                                                        <img
                                                            src={empPhoto}
                                                            alt={empDisplayName}
                                                            className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                const fb = e.currentTarget.parentElement?.querySelector('.emp-fallback') as HTMLElement;
                                                                if (fb) fb.style.display = 'flex';
                                                            }}
                                                        />
                                                    ) : null}
                                                    <div className={`emp-fallback h-9 w-9 rounded-full bg-slate-100 dark:bg-[#134426] text-slate-600 dark:text-white font-bold text-xs items-center justify-center uppercase ${empPhoto ? 'hidden' : 'flex'}`}>
                                                        {empInitials}
                                                    </div>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/onboarding/add/review?id=${s.id}`)}
                                                            className="text-[13px] font-semibold text-slate-900 dark:text-white hover:text-emerald-700 truncate cursor-pointer text-left"
                                                            title={empDisplayName}
                                                        >
                                                            {prettyText(empDisplayName)}
                                                        </button>
                                                        {s.requiresManualVerification && (
                                                            <span title="Manual verification required" className="shrink-0">
                                                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="font-mono text-[11px] text-slate-500 dark:text-white/50">{displayEmpId}</span>
                                                        {((s as any).pending || (s as any).failed) && (
                                                            <SyncStatusBadge pending={(s as any).pending} failed={(s as any).failed} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Site & Role */}
                                        <td className={cell}>
                                            <div className="min-w-0">
                                                <div className="text-[13px] font-medium text-slate-800 dark:text-white/90 truncate" title={site}>{site}</div>
                                                <div className="text-xs text-slate-500 dark:text-white/50 truncate mt-0.5" title={designation}>{designation}</div>
                                            </div>
                                        </td>

                                        {/* Status (+ reviewer / reason / FCU) */}
                                        <td className={cell}>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <StatusChip status={s.status} />
                                                {s.status === 'verified' && fcuSt && (
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                        fcuSt === 'verified' ? 'bg-emerald-50 text-emerald-700' : fcuSt === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                                                    }`}>
                                                        FCU {fcuSt === 'verified' ? '✓' : fcuSt === 'failed' ? 'failed' : 'pending'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 text-[11px] text-slate-500 dark:text-white/50 truncate">
                                                {s.status === 'verified' ? (
                                                    isAiVerified ? (
                                                        <span className="inline-flex items-center gap-1" title="Verified automatically by Paradigm AI Agent">
                                                            <Bot className="h-3 w-3 text-violet-600" /> AI Agent{s.verifiedAt ? ` · ${formatCreatedDate(s.verifiedAt)}` : ''}
                                                        </span>
                                                    ) : (
                                                        <span title={`Verified by ${s.verifiedBy || 'HR Admin'}`}>
                                                            by <span className="font-semibold text-slate-700 dark:text-white/80 capitalize">{s.verifiedBy || 'HR Admin'}</span>{s.verifiedAt ? ` · ${formatCreatedDate(s.verifiedAt)}` : ''}
                                                        </span>
                                                    )
                                                ) : s.status === 'rejected' ? (
                                                    <span title={`${currentRejectionReason} — rejected by ${currentRejectedBy}`}>
                                                        <span className="font-semibold text-rose-700 dark:text-rose-300">{currentRejectionReason}</span>
                                                        {' · '}{currentRejectedBy}{currentRejectedAt ? ` · ${formatCreatedDate(currentRejectedAt)}` : ''}
                                                    </span>
                                                ) : s.status === 'pending' ? (
                                                    'Awaiting review'
                                                ) : (
                                                    'In progress'
                                                )}
                                            </div>
                                        </td>

                                        {/* Documents */}
                                        <td className={cell}>
                                            <CompactDocSummary submission={s} onToggleDoc={(key) => handleToggleDocVerification(s.id!, key)} />
                                        </td>

                                        {/* Created */}
                                        <td className={cell}>
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium text-slate-700 dark:text-white/80 truncate capitalize" title={creator.name}>{creator.name}</div>
                                                <div className="text-[11px] text-slate-500 dark:text-white/50 mt-0.5 whitespace-nowrap">{formatCreatedDate(s.createdAt || s.created_at || s.enrollmentDate)}</div>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className={`${cell} sticky right-0 z-10`}>
                                            <div className="flex items-center justify-end gap-1.5">
                                                {primary}
                                                <RowActionsMenu items={menuItems} />
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
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
            <RejectReasonModal
              isOpen={!!rejectModalSubmission}
              submission={rejectModalSubmission}
              onClose={() => setRejectModalSubmission(null)}
              onConfirm={handleConfirmReject}
              isSubmitting={isRejecting}
            />
            <ApproveSubmissionModal
              isOpen={!!approveModalSubmission}
              submission={approveModalSubmission}
              onClose={() => setApproveModalSubmission(null)}
              onConfirmApprove={handleConfirmApprove}
              isApproving={isApproving}
            />
        </div>
    );
};

export default VerificationDashboard;