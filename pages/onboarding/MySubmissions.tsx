import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import type { OnboardingData } from '@/types';
import StatusChip from '@/components/ui/StatusChip';
import Toast from '@/components/ui/Toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { useAuthStore } from '@/store/authStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { 
    Search, ArrowLeft, UserPlus, X, AlertTriangle, 
    Play, FileText, Calendar, RefreshCw,
    UserCheck, Eye, Edit2, Trash2, CheckCircle2,
    MapPin, Briefcase, Bot, Sparkles, XCircle, CheckSquare, XSquare, Square
} from 'lucide-react';

type StatusFilter = 'all' | 'rejected' | 'draft' | 'pending' | 'verified';

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

interface DocumentVerificationBadgesProps {
    submission: OnboardingData;
    onToggleDoc?: (docType: string) => void;
    hideLabels?: boolean;
}

const getDocValue = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object') return (val.url || val.preview || val.name || '').trim();
    return String(val).trim();
};

const DocumentVerificationBadges: React.FC<DocumentVerificationBadgesProps> = ({ submission, onToggleDoc, hideLabels }) => {
    const personal = (submission.personal as any) || {};
    const documents = (submission as any)?.documents || {};
    const bank = (submission.bank as any) || {};
    const uan = (submission.uan as any) || {};
    const address = (submission.address as any) || {};

    // 1. PAN Verification Status
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
    const isPanVerified = (hasPanNumber || hasPanDoc) && !isExplicitlyPanFailed && (isExplicitlyPanVerified || hasPanNumber);

    // 2. Aadhaar Verification Status
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
    const isAadhaarVerified = (hasAadhaarNumber || hasAadhaarDoc) && !isExplicitlyAadhaarFailed && (isExplicitlyAadhaarVerified || hasAadhaarNumber);

    // 3. UAN Verification Status
    const isUanApplicable = Boolean(uan.hasPreviousPf);
    const hasUanNumber = Boolean(getDocValue(uan.uanNumber));
    const hasUanDoc = Boolean(uan.document || uan.salarySlip);
    const isExplicitlyUanVerified = uan.verifiedStatus?.uanNumber === true;
    const isExplicitlyUanFailed = uan.verifiedStatus?.uanNumber === false;
    const isUanVerified = isUanApplicable ? (
        (hasUanNumber || hasUanDoc) && !isExplicitlyUanFailed && (isExplicitlyUanVerified || hasUanNumber)
    ) : null;

    // 4. Bank Account Verification Status
    const hasBankAcc = Boolean(getDocValue(bank.accountNumber));
    const hasBankIfsc = Boolean(getDocValue(bank.ifscCode));
    const isExplicitlyBankVerified = bank.verifiedStatus?.accountNumber === true;
    const isExplicitlyBankFailed = bank.verifiedStatus?.accountNumber === false;
    const isBankVerified = hasBankAcc && hasBankIfsc && !isExplicitlyBankFailed && (isExplicitlyBankVerified || (hasBankAcc && hasBankIfsc));

    // 5. Address Verification Status
    const hasPresentAddr = Boolean(getDocValue(address.present?.line1));
    const hasPermanentAddr = Boolean(address.sameAsPresent || getDocValue(address.permanent?.line1));
    const isExplicitlyAddrVerified = address.present?.verifiedStatus?.line1 === true;
    const isExplicitlyAddrFailed = address.present?.verifiedStatus?.line1 === false;
    const isAddressVerified = hasPresentAddr && hasPermanentAddr && !isExplicitlyAddrFailed && (isExplicitlyAddrVerified || (hasPresentAddr && hasPermanentAddr));

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
        <div className={`flex items-center ${hideLabels ? 'gap-1.5 justify-center' : 'gap-2 flex-wrap'}`}>
            {docList.map(doc => {
                if (doc.applicable === false) {
                    return (
                        <span 
                            key={doc.key} 
                            className={`inline-flex items-center justify-center gap-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200 ${
                                hideLabels ? 'w-6 h-6 p-0' : 'px-2 py-0.5'
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
                            hideLabels ? 'w-6 h-6 p-0' : 'px-2 py-0.5'
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

export const MySubmissions: React.FC = () => {
    const [submissions, setSubmissions] = useState<OnboardingData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [usersMap, setUsersMap] = useState<Record<string, { name: string; photo?: string | null; role?: string; email?: string }>>({});
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');

    const activeUser = useAuthStore(state => state.user);

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
        }).catch(err => console.warn('[MySubmissions] Failed to fetch users map:', err));
    }, []);

    const fetchSubmissions = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getVerificationSubmissions();
            setSubmissions(data || []);
        } catch (error) {
            console.error('[MySubmissions] Error loading submissions:', error);
            setToast({ message: 'Failed to load your submissions.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    // Filter submissions strictly to the current active user's submitted forms
    const userSubmissions = useMemo(() => {
        if (!activeUser) return submissions;

        const uid = activeUser.id;
        const uName = (activeUser.name || (activeUser as any).full_name || '').trim().toLowerCase();
        const uEmail = (activeUser.email || '').trim().toLowerCase();

        return submissions.filter(s => {
            const sCreatedUserId = (s as any).created_user_id || (s as any).createdUserId || '';
            const sUserId = (s as any).user_id || (s as any).userId || '';
            const sCreatedByName = ((s as any).created_by_name || (s as any).createdByName || (s as any).createdBy || (s as any).created_by || (s as any).submitted_by || (s as any).submittedBy || (s.personal as any)?.createdBy || '').trim().toLowerCase();
            const sEmail = (s.personal?.email || '').trim().toLowerCase();

            // Match by User UUID
            if (uid && (sCreatedUserId === uid || sUserId === uid)) {
                return true;
            }

            // Match by Name
            if (uName && sCreatedByName && (sCreatedByName === uName || sCreatedByName.includes(uName) || uName.includes(sCreatedByName))) {
                return true;
            }

            // Match by Email
            if (uEmail && sEmail && sEmail === uEmail) {
                return true;
            }

            return false;
        });
    }, [submissions, activeUser]);

    // Tab counts
    const counts = useMemo(() => {
        return {
            all: userSubmissions.length,
            rejected: userSubmissions.filter(s => s.status === 'rejected').length,
            draft: userSubmissions.filter(s => s.status === 'draft').length,
            pending: userSubmissions.filter(s => s.status === 'pending').length,
            verified: userSubmissions.filter(s => s.status === 'verified').length,
        };
    }, [userSubmissions]);

    // Filter by tab status and search keyword
    const filteredSubmissions = useMemo(() => {
        return userSubmissions
            .filter(s => {
                if (statusFilter === 'all') return true;
                return s.status === statusFilter;
            })
            .filter(s => {
                if (!searchTerm.trim()) return true;
                const query = searchTerm.toLowerCase();
                const fullName = `${s.personal?.firstName || ''} ${s.personal?.lastName || ''}`.toLowerCase();
                const mobile = (s.personal?.mobile || '').toLowerCase();
                const site = (s.organization?.site || s.organization?.organizationName || (s as any).organizationName || '').toLowerCase();
                const empId = (s.personal?.employeeId || (s as any).employeeId || (s as any).employee_id || '').toLowerCase();
                return fullName.includes(query) || mobile.includes(query) || site.includes(query) || empId.includes(query);
            });
    }, [userSubmissions, statusFilter, searchTerm]);

    const getEmployeePhoto = useCallback((s: OnboardingData): string | null => {
        const p = s.personal as any;
        if (!p) return null;
        if (typeof p.photo === 'string' && p.photo.trim() !== '') return p.photo;
        if (typeof p.photoUrl === 'string' && p.photoUrl.trim() !== '') return p.photoUrl;
        if (typeof p.photo_url === 'string' && p.photo_url.trim() !== '') return p.photo_url;
        if (typeof p.profilePhoto === 'string' && p.profilePhoto.trim() !== '') return p.profilePhoto;
        if (typeof p.profile_photo === 'string' && p.profile_photo.trim() !== '') return p.profile_photo;
        if (p.photo && typeof p.photo === 'object') {
            const url = p.photo.url || p.photo.preview || p.photo.dataUrl;
            if (url && typeof url === 'string') return url;
        }
        if (p.profilePhoto && typeof p.profilePhoto === 'object') {
            const url = p.profilePhoto.url || p.profilePhoto.preview || p.profilePhoto.dataUrl;
            if (url && typeof url === 'string') return url;
        }
        return null;
    }, []);

    const getCreatorInfo = useCallback((s: OnboardingData) => {
        const explicitName = (s as any).created_by_name || (s as any).createdByName || (s as any).createdBy || (s as any).created_by || (s as any).submitted_by || (s as any).submittedBy || (s.personal as any)?.createdBy || (s.personal as any)?.created_by;
        const explicitPhoto = (s as any).created_by_photo || (s as any).createdByPhoto || null;
        const explicitRole = (s as any).created_by_role || (s as any).createdByRole || '';

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
        } else if (activeUser?.name) {
            name = activeUser.name;
            photo = (activeUser as any).photoUrl || null;
            role = activeUser.role || '';
        } else {
            name = 'HR Staff';
            photo = null;
            role = '';
        }

        const initials = name
            ? name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
            : 'HR';

        return { name, photo, initials, role };
    }, [usersMap, activeUser]);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this submission?')) return;
        try {
            await api.deleteOnboardingSubmission(id);
            setToast({ message: 'Submission deleted successfully.', type: 'success' });
            setSubmissions(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error('[MySubmissions] Delete error:', error);
            setToast({ message: 'Failed to delete submission.', type: 'error' });
        }
    };

    const handleToggleDocVerification = async (submissionId: string, docKey: string) => {
        const sub = submissions.find(s => s.id === submissionId);
        if (!sub) return;

        const currentVerifiedStatus = sub.personal?.verifiedStatus || {};
        let currentVal = false;

        switch (docKey) {
            case 'pan':
                currentVal = Boolean(currentVerifiedStatus.panCard);
                break;
            case 'aadhaar':
                currentVal = Boolean(currentVerifiedStatus.idProofNumber || sub.personal?.isQrVerified);
                break;
            case 'uan':
                currentVal = Boolean(sub.uan?.verifiedStatus?.uanNumber);
                break;
            case 'bank':
                currentVal = Boolean(sub.bank?.verifiedStatus?.accountNumber);
                break;
            case 'address':
                currentVal = Boolean(sub.address?.present?.verifiedStatus?.line1);
                break;
            default:
                return;
        }

        const nextVal = !currentVal;
        let updatedSub: OnboardingData = { ...sub };

        // Optimistic UI update
        setSubmissions(prev => prev.map(s => {
            if (s.id !== submissionId) return s;
            const updated = { ...s };
            if (docKey === 'pan') {
                updated.personal = {
                    ...updated.personal,
                    verifiedStatus: { ...updated.personal?.verifiedStatus, panCard: nextVal }
                };
            } else if (docKey === 'aadhaar') {
                updated.personal = {
                    ...updated.personal,
                    isQrVerified: nextVal,
                    verifiedStatus: { ...updated.personal?.verifiedStatus, idProofNumber: nextVal }
                };
            } else if (docKey === 'uan') {
                updated.uan = {
                    ...updated.uan,
                    verifiedStatus: { ...updated.uan?.verifiedStatus, uanNumber: nextVal }
                };
            } else if (docKey === 'bank') {
                updated.bank = {
                    ...updated.bank,
                    verifiedStatus: { ...updated.bank?.verifiedStatus, accountNumber: nextVal }
                };
            } else if (docKey === 'address') {
                updated.address = {
                    ...updated.address,
                    present: {
                        ...updated.address?.present,
                        verifiedStatus: { ...updated.address?.present?.verifiedStatus, line1: nextVal }
                    }
                };
            }
            updatedSub = updated;
            return updated;
        }));

        try {
            const { error } = await supabase
                .from('onboarding_submissions')
                .update({
                    personal: updatedSub.personal,
                    address: updatedSub.address,
                    bank: updatedSub.bank,
                    uan: updatedSub.uan,
                    updated_at: new Date().toISOString()
                })
                .eq('id', submissionId);

            if (error) throw error;

            setToast({ 
                message: `${docKey.toUpperCase()} verification status updated.`, 
                type: 'success' 
            });
        } catch (err) {
            console.error('[MySubmissions] Toggle doc verification failed:', err);
            setToast({ message: 'Failed to update document verification.', type: 'error' });
            fetchSubmissions();
        }
    };

    const handleStartNew = () => {
        navigate('/onboarding/select-organization');
    };

    const colSpan = statusFilter !== 'verified' ? 8 : 7;

    return (
        <div className="min-h-full flex flex-col bg-slate-50 dark:bg-[#041b0f] text-slate-800 dark:text-white transition-colors duration-200">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Top Bar Header */}
            <div className="bg-white dark:bg-[#062415] border-b border-slate-200 dark:border-[#1f3d2b] px-4 py-4 md:px-8 shadow-xs flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate(-1)} 
                        aria-label="Go back" 
                        className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                    >
                        <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                My Submissions
                            </h1>
                            <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700/50">
                                {userSubmissions.length} Total
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Manage, review, and verify employee onboarding applications submitted by you
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={fetchSubmissions}
                        disabled={isLoading}
                        title="Refresh submissions"
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-all active:scale-95"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
                    </button>

                    <button
                        onClick={handleStartNew}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs md:text-sm shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                    >
                        <UserPlus className="h-4 w-4" />
                        <span>New Enrollment</span>
                    </button>
                </div>
            </div>

            <div className="px-4 py-6 md:px-8 space-y-6">
                {/* 5 Stats Cards Grid in 1 Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                    {/* TOTAL */}
                    <div 
                        onClick={() => setStatusFilter('all')}
                        className={`bg-white dark:bg-[#062415] p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between ${
                            statusFilter === 'all' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200 dark:border-white/5'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Total</span>
                            <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                                <UserCheck className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="mt-3">
                            <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{counts.all}</span>
                        </div>
                    </div>

                    {/* DRAFTS */}
                    <div 
                        onClick={() => setStatusFilter('draft')}
                        className={`bg-white dark:bg-[#062415] p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between ${
                            statusFilter === 'draft' ? 'ring-2 ring-slate-700 border-slate-700' : 'border-slate-200 dark:border-white/5'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Drafts</span>
                            <span className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                <Edit2 className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between">
                            <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{counts.draft}</span>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">In Progress</span>
                        </div>
                    </div>

                    {/* PENDING */}
                    <div 
                        onClick={() => setStatusFilter('pending')}
                        className={`bg-white dark:bg-[#062415] p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between ${
                            statusFilter === 'pending' ? 'ring-2 ring-amber-500 border-amber-500' : 'border-slate-200 dark:border-white/5'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending</span>
                            <span className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between">
                            <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{counts.pending}</span>
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">Action Needed</span>
                        </div>
                    </div>

                    {/* VERIFIED */}
                    <div 
                        onClick={() => setStatusFilter('verified')}
                        className={`bg-white dark:bg-[#062415] p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between ${
                            statusFilter === 'verified' ? 'ring-2 ring-teal-500 border-teal-500' : 'border-slate-200 dark:border-white/5'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Verified</span>
                            <span className="p-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                                <CheckCircle2 className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="mt-3">
                            <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{counts.verified}</span>
                        </div>
                    </div>

                    {/* REJECTED */}
                    <div 
                        onClick={() => setStatusFilter('rejected')}
                        className={`bg-white dark:bg-[#062415] p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between ${
                            statusFilter === 'rejected' ? 'ring-2 ring-rose-500 border-rose-500' : 'border-slate-200 dark:border-white/5'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Rejected</span>
                            <span className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                                <XCircle className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between">
                            <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{counts.rejected}</span>
                            {counts.rejected > 0 && (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md animate-pulse">
                                    Needs Fix
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Table Container Card */}
                <div className="bg-white dark:bg-[#062415] rounded-2xl border border-slate-200 dark:border-[#1f3d2b] shadow-xs overflow-hidden">
                    {/* Header Filter Bar */}
                    <div className="p-4 border-b border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-black/10">
                        {/* Status Tabs */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar flex-shrink-0">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    statusFilter === 'all'
                                        ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                                        : 'bg-white dark:bg-[#122e1e] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                                }`}
                            >
                                <span>All</span>
                                <span className="text-[11px] opacity-80">{counts.all}</span>
                            </button>

                            <button
                                onClick={() => setStatusFilter('draft')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    statusFilter === 'draft'
                                        ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xs'
                                        : 'bg-white dark:bg-[#122e1e] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                                }`}
                            >
                                <span>Draft</span>
                                <span className="text-[11px] opacity-80">{counts.draft}</span>
                            </button>

                            <button
                                onClick={() => setStatusFilter('pending')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    statusFilter === 'pending'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'bg-white dark:bg-[#122e1e] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                                }`}
                            >
                                <span>Pending</span>
                                <span className="text-[11px] opacity-80">{counts.pending}</span>
                            </button>

                            <button
                                onClick={() => setStatusFilter('verified')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    statusFilter === 'verified'
                                        ? 'bg-teal-600 text-white shadow-xs'
                                        : 'bg-white dark:bg-[#122e1e] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                                }`}
                            >
                                <span>Verified</span>
                                <span className="text-[11px] opacity-80">{counts.verified}</span>
                            </button>

                            {counts.rejected > 0 && (
                                <button
                                    onClick={() => setStatusFilter('rejected')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                        statusFilter === 'rejected'
                                            ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                                            : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                                    }`}
                                >
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    <span>Rejected</span>
                                    <span className="px-1.5 py-0.2 bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 rounded-full text-[10px]">
                                        {counts.rejected}
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name, ID, or site..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#062415] border border-slate-200 dark:border-[#1f3d2b] rounded-xl text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table or Responsive View */}
                    <div className="overflow-x-auto">
                        {isMobile ? (
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {isLoading ? (
                                    <div className="p-4"><TableSkeleton rows={4} cols={colSpan} /></div>
                                ) : filteredSubmissions.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400">
                                        <Search className="h-10 w-10 mx-auto mb-2 text-emerald-600 opacity-40" />
                                        <p className="font-semibold text-slate-700 dark:text-slate-300">No submissions found</p>
                                    </div>
                                ) : (
                                    filteredSubmissions.map(s => {
                                        const empPhoto = getEmployeePhoto(s);
                                        const displayName = [s.personal?.firstName, s.personal?.lastName].filter(Boolean).join(' ') || (s.personal?.mobile ? `Draft (${s.personal.mobile})` : 'Draft Applicant');
                                        const isDraft = s.status === 'draft';
                                        const isRejected = s.status === 'rejected';
                                        const rejectionReason = s.rejectionReason || (s as any).rejection_reason || (s.personal as any)?.rejectionReason || 'Profile Photo Mismatch';

                                        return (
                                            <div key={s.id} className="p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {empPhoto ? (
                                                            <img src={empPhoto} alt={displayName} className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-2xs" />
                                                        ) : (
                                                            <div className="h-10 w-10 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                                                                {displayName.slice(0, 2).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-slate-900 dark:text-white capitalize">{displayName}</div>
                                                            <div className="text-xs text-slate-500">{s.personal?.employeeId || 'ID: Pending'}</div>
                                                        </div>
                                                    </div>
                                                    <StatusChip status={s.status} />
                                                </div>

                                                {isRejected && (
                                                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-xs text-rose-800 font-medium">
                                                        ⚠ {rejectionReason}
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                                                    <span>{s.organizationName || s.organization?.organizationName || '-'}</span>
                                                    <span>{formatCreatedDate(s.createdAt || s.enrollmentDate)}</span>
                                                </div>

                                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                                                    <button 
                                                        onClick={() => navigate(`/onboarding/add/review?id=${s.id}`)}
                                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                                                    >
                                                        View
                                                    </button>
                                                    {isRejected ? (
                                                        <button 
                                                            onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
                                                        >
                                                            Fix Details
                                                        </button>
                                                    ) : isDraft ? (
                                                        <button 
                                                            onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold"
                                                        >
                                                            Resume
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                            className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold"
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            <table className="w-full min-w-[1260px] border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-slate-50/90 border-b border-slate-200">
                                        <th scope="col" className="px-4 py-3 text-center align-middle border-b border-slate-200 w-[220px]">
                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">Employee</span>
                                                <span className="text-[9.5px] font-medium text-slate-400 whitespace-nowrap">Name & ID</span>
                                            </div>
                                        </th>
                                        <th scope="col" className="px-3 py-3 text-center align-middle border-b border-slate-200 w-[170px]">
                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">Site Location</span>
                                                <span className="text-[9.5px] font-medium text-slate-400 whitespace-nowrap">Assigned Unit</span>
                                            </div>
                                        </th>
                                        {statusFilter !== 'verified' && (
                                            <th scope="col" className="px-3 py-3 text-center align-middle border-b border-slate-200 w-[170px]">
                                                <div className="flex flex-col items-center justify-center gap-0.5">
                                                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">Status</span>
                                                    <span className="text-[9.5px] font-medium text-slate-400 whitespace-nowrap">Current State</span>
                                                </div>
                                            </th>
                                        )}
                                        <th scope="col" className="px-3 py-3 text-center align-middle border-b border-slate-200 w-[160px]">
                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">Designation</span>
                                                <span className="text-[9.5px] font-medium text-slate-400 whitespace-nowrap">Job Role</span>
                                            </div>
                                        </th>
                                        <th scope="col" className="px-3 py-3 text-center align-middle border-b border-slate-200 w-[180px] min-w-[180px]">
                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">Verified Documents</span>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className="w-6 h-5 flex items-center justify-center text-[9px] font-bold text-blue-600 bg-blue-50/80 rounded border border-blue-200/80" title="PAN">PAN</span>
                                                    <span className="w-6 h-5 flex items-center justify-center text-[9px] font-bold text-emerald-600 bg-emerald-50/80 rounded border border-emerald-200/80" title="Aadhaar">AAD</span>
                                                    <span className="w-6 h-5 flex items-center justify-center text-[9px] font-bold text-amber-600 bg-amber-50/80 rounded border border-amber-200/80" title="UAN">UAN</span>
                                                    <span className="w-6 h-5 flex items-center justify-center text-[9px] font-bold text-indigo-600 bg-indigo-50/80 rounded border border-indigo-200/80" title="Bank">BNK</span>
                                                    <span className="w-6 h-5 flex items-center justify-center text-[9px] font-bold text-teal-600 bg-teal-50/80 rounded border border-teal-200/80" title="Address">ADR</span>
                                                </div>
                                            </div>
                                        </th>
                                        <th scope="col" className="px-3 py-3 text-center align-middle border-b border-slate-200 w-[190px] min-w-[190px]">
                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">Verified / Rejected By</span>
                                                <span className="text-[9.5px] font-medium text-slate-400 whitespace-nowrap">Reviewer & Date</span>
                                            </div>
                                        </th>
                                        <th scope="col" className="px-3 py-3 text-center align-middle border-b border-slate-200 w-[200px]">
                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">Created By / Date</span>
                                                <span className="text-[9.5px] font-medium text-slate-400 whitespace-nowrap">Submission Info</span>
                                            </div>
                                        </th>
                                        <th scope="col" className="sticky right-0 bg-slate-50/95 backdrop-blur-xs z-20 px-3 py-3 text-center align-middle border-b border-slate-200 shadow-[-6px_0_10px_-2px_rgba(0,0,0,0.06)] w-[190px] min-w-[190px]">
                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">Actions</span>
                                                <span className="text-[9.5px] font-medium text-slate-400 whitespace-nowrap">Review & Manage</span>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {isLoading ? (
                                        <TableSkeleton rows={5} cols={colSpan} />
                                    ) : filteredSubmissions.length === 0 ? (
                                        <tr><td colSpan={colSpan} className="text-center py-16">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <Search className="h-10 w-10 mb-3 opacity-30 text-emerald-600" />
                                                <p className="text-sm font-semibold text-slate-700">
                                                    No onboarding submissions found
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Try adjusting your search terms or filter tabs
                                                </p>
                                            </div>
                                        </td></tr>
                                    ) : (
                                        filteredSubmissions.map((s) => {
                                            const empDisplayName = [s.personal?.firstName, s.personal?.lastName].filter(Boolean).join(' ') || (s.personal?.mobile ? `Draft (${s.personal.mobile})` : (s.personal?.employeeId ? `Draft (${s.personal.employeeId})` : 'Draft Applicant'));
                                            const empInitials = ((s.personal?.firstName?.[0] || '') + (s.personal?.lastName?.[0] || '')) || 'DR';
                                            const empPhoto = getEmployeePhoto(s);
                                            const isDraft = s.status === 'draft';
                                            const currentRejectionReason = s.rejectionReason || (s as any).rejection_reason || s.personal?.rejectionReason || 'Profile Photo Mismatch';
                                            const currentRejectedBy = s.rejectedBy || (s as any).rejected_by || s.personal?.rejectedBy || 'HR Admin';
                                            const currentRejectedAt = s.rejectedAt || (s as any).rejected_at || s.personal?.rejectedAt;

                                            return (
                                            <tr key={s.id} className={`group hover:bg-emerald-50/40 transition-colors duration-150 ${s.requiresManualVerification ? 'bg-amber-50/60' : isDraft ? 'bg-slate-50/30' : s.status === 'rejected' ? 'bg-rose-50/20' : ''}`}>
                                                {/* Employee */}
                                                <td className="px-4 py-3.5 whitespace-nowrap align-middle">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="relative h-9 w-9 flex-shrink-0 flex items-center justify-center">
                                                            {empPhoto ? (
                                                                <img 
                                                                    src={empPhoto} 
                                                                    alt={empDisplayName} 
                                                                    className="h-9 w-9 rounded-full object-cover border-2 border-white shadow-2xs"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        const fb = e.currentTarget.parentElement?.querySelector('.emp-fallback') as HTMLElement;
                                                                        if (fb) fb.style.display = 'flex';
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <div 
                                                                className={`emp-fallback h-9 w-9 rounded-full ${isDraft ? 'bg-slate-700' : s.status === 'rejected' ? 'bg-gradient-to-br from-rose-500 to-rose-700' : 'bg-gradient-to-br from-emerald-500 to-teal-700'} text-white font-black text-xs items-center justify-center shadow-2xs border-2 border-white uppercase ${empPhoto ? 'hidden' : 'flex'}`}
                                                            >
                                                                {empInitials}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col justify-center">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-bold text-slate-900 hover:text-emerald-700 transition-colors capitalize">
                                                                    {empDisplayName}
                                                                </span>
                                                                {s.requiresManualVerification && (
                                                                    <span title="Manual verification required">
                                                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="font-mono text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                                                                    {s.personal?.employeeId || 'ID: Pending'}
                                                                </span>
                                                                <SyncStatusBadge pending={(s as any).pending} failed={(s as any).failed} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Site */}
                                                <td className="px-3 py-3.5 whitespace-nowrap align-middle text-center">
                                                    <div className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-700">
                                                        <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                                        <span>{s.organizationName || s.organization?.organizationName || '-'}</span>
                                                    </div>
                                                </td>

                                                {/* Status */}
                                                {statusFilter !== 'verified' && (
                                                    <td className="px-3 py-3.5 whitespace-nowrap align-middle text-center">
                                                        <div className="flex flex-col gap-1 items-center justify-center">
                                                            <StatusChip status={s.status} />
                                                            {s.status === 'rejected' && (
                                                                <div 
                                                                    className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-rose-800 bg-rose-50 border border-rose-200/90 px-2 py-0.5 rounded-md shadow-2xs max-w-[170px]" 
                                                                    title={currentRejectionReason}
                                                                >
                                                                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                                                    <span className="truncate">{currentRejectionReason}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}

                                                {/* Designation */}
                                                <td className="px-3 py-3.5 whitespace-nowrap align-middle text-center">
                                                    <div className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-700">
                                                        <Briefcase className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                                        <span>{s.organization?.designation || '-'}</span>
                                                    </div>
                                                </td>

                                                {/* Verified Documents */}
                                                <td className="px-3 py-3.5 whitespace-nowrap text-center align-middle">
                                                    <div className="flex items-center justify-center">
                                                        <DocumentVerificationBadges submission={s} onToggleDoc={(key) => handleToggleDocVerification(s.id!, key)} hideLabels />
                                                    </div>
                                                </td>

                                                {/* Approved / Rejected By */}
                                                <td className="px-3 py-3.5 whitespace-nowrap align-middle text-center">
                                                    {s.status === 'verified' ? (
                                                        s.verificationMode === 'auto' || s.verifiedBy === 'Paradigm AI Agent' ? (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-2xs flex-shrink-0 border border-violet-300">
                                                                    <Bot className="h-3.5 w-3.5 text-white" />
                                                                </div>
                                                                <div className="flex flex-col text-left">
                                                                    <span className="text-xs font-bold text-violet-950 flex items-center gap-1">
                                                                        Verified by AI Agent
                                                                        <Sparkles className="h-2.5 w-2.5 text-amber-500 fill-amber-400 flex-shrink-0" />
                                                                    </span>
                                                                    {s.verifiedAt && (
                                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                                            {formatCreatedDate(s.verifiedAt)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-2">
                                                                {s.verifiedByPhoto ? (
                                                                    <img src={s.verifiedByPhoto} alt={s.verifiedBy || 'HR'} className="h-7 w-7 rounded-full object-cover border-2 border-emerald-500 shadow-2xs flex-shrink-0" />
                                                                ) : (
                                                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black text-[10px] flex items-center justify-center shadow-2xs border border-emerald-400 flex-shrink-0 uppercase">
                                                                        {s.verifiedBy ? s.verifiedBy.split(' ').map(n => n[0]).join('').slice(0, 2) : 'HR'}
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col text-left">
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
                                                    ) : s.status === 'rejected' ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="h-7 w-7 rounded-full bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center flex-shrink-0">
                                                                <XCircle className="h-4 w-4 text-rose-600" />
                                                            </div>
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-xs font-bold text-rose-950">
                                                                    Rejected by {currentRejectedBy}
                                                                </span>
                                                                {currentRejectedAt && (
                                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                                        {formatCreatedDate(currentRejectedAt)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">—</span>
                                                    )}
                                                </td>

                                                {/* Created By / Date */}
                                                <td className="px-3 py-3.5 whitespace-nowrap align-middle text-center">
                                                    {(() => {
                                                        const creator = getCreatorInfo(s);
                                                        return (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <div className="relative h-7 w-7 flex-shrink-0 flex items-center justify-center">
                                                                    {creator.photo ? (
                                                                        <img 
                                                                            src={creator.photo} 
                                                                            alt={creator.name} 
                                                                            className="h-7 w-7 rounded-full object-cover border border-slate-300 shadow-2xs" 
                                                                            onError={(e) => {
                                                                                e.currentTarget.style.display = 'none';
                                                                                const fb = e.currentTarget.parentElement?.querySelector('.creator-fallback') as HTMLElement;
                                                                                if (fb) fb.style.display = 'flex';
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <div 
                                                                        className={`creator-fallback h-7 w-7 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white font-black text-[10px] items-center justify-center shadow-2xs border border-slate-400 uppercase ${creator.photo ? 'hidden' : 'flex'}`}
                                                                    >
                                                                        {creator.initials}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col justify-center text-left">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs font-bold text-slate-800 capitalize leading-tight">
                                                                            {creator.name}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-[10.5px] text-slate-500 font-medium mt-0.5">
                                                                        <Calendar className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                                                        <span>{formatCreatedDate(s.createdAt || s.created_at || s.enrollmentDate)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Sticky Actions Column - 2-Row Layout */}
                                                <td className={`sticky right-0 z-10 px-3 py-2 whitespace-nowrap text-center shadow-[-6px_0_10px_-2px_rgba(0,0,0,0.06)] border-b border-slate-100 align-middle ${
                                                    s.requiresManualVerification ? 'bg-amber-50 group-hover:bg-amber-100/70' : isDraft ? 'bg-slate-50 group-hover:bg-slate-100/70' : 'bg-white group-hover:bg-emerald-50/70'
                                                }`}>
                                                    <div className="flex flex-col items-center justify-center gap-1.5 min-w-[155px]">
                                                        {/* 1st Row: Utility Icons */}
                                                        <div className="flex items-center justify-center gap-1 bg-slate-50/90 p-0.5 rounded-lg border border-slate-200/60 shadow-2xs">
                                                            <button 
                                                                onClick={() => navigate(`/onboarding/add/review?id=${s.id}`)}
                                                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-emerald-700 bg-white hover:bg-emerald-50 rounded-md transition-all duration-200 border border-slate-200/50 hover:border-emerald-200 shrink-0"
                                                                title="View Summary Details"
                                                            >
                                                                <Eye className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-blue-700 bg-white hover:bg-blue-50 rounded-md transition-all duration-200 border border-slate-200/50 hover:border-blue-200 shrink-0"
                                                                title="Edit Application"
                                                            >
                                                                <Edit2 className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => navigate(`/onboarding/pdf/${s.id}`)}
                                                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-teal-700 bg-white hover:bg-teal-50 rounded-md transition-all duration-200 border border-slate-200/50 hover:border-teal-200 shrink-0"
                                                                title="Download Official Forms"
                                                            >
                                                                <FileText className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(s.id!)}
                                                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-rose-700 bg-white hover:bg-rose-50 rounded-md transition-all duration-200 border border-slate-200/50 hover:border-rose-200 shrink-0"
                                                                title="Delete Application"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>

                                                        {/* 2nd Row: Contextual Action */}
                                                        <div className="flex items-center justify-center gap-1.5 w-full">
                                                            {isDraft && (
                                                                <button 
                                                                    onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                                    className="h-6 px-3 bg-slate-900 hover:bg-black text-white rounded-md text-[11px] font-bold shadow-xs transition-all duration-200 flex items-center justify-center gap-1 w-full max-w-[130px]"
                                                                    title="Resume Incomplete Enrollment"
                                                                >
                                                                    <Play className="h-2.5 w-2.5 fill-current" /> Resume
                                                                </button>
                                                            )}

                                                            {s.status === 'rejected' && (
                                                                <button 
                                                                    onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                                    className="h-6 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold shadow-xs transition-all duration-200 flex items-center justify-center gap-1 w-full max-w-[140px]"
                                                                    title="Update Rejected Details"
                                                                >
                                                                    <Edit2 className="h-2.5 w-2.5" /> Fix Details
                                                                </button>
                                                            )}

                                                            {s.status === 'pending' && (
                                                                <button 
                                                                    onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                                    className="h-6 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-md text-[11px] font-bold transition-all duration-200 flex items-center justify-center gap-1 w-full max-w-[130px]"
                                                                    title="Edit Details"
                                                                >
                                                                    <Edit2 className="h-2.5 w-2.5" /> Edit Form
                                                                </button>
                                                            )}

                                                            {s.status === 'verified' && (
                                                                <span className="text-[11px] font-semibold text-emerald-600 flex items-center justify-center gap-1">
                                                                    <CheckSquare className="h-3 w-3" /> Verified
                                                                </span>
                                                            )}
                                                        </div>
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
            </div>
        </div>
    );
};

export default MySubmissions;