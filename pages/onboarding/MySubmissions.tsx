import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { subscribeOutbox } from '@/services/offline/outbox';
import type { OnboardingData } from '../../types';
import StatusChip from '@/components/ui/StatusChip';
import Toast from '@/components/ui/Toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { useAuthStore } from '@/store/authStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
    getDocValue, DocumentVerificationBadges, CompactDocSummary, RowActionsMenu, prettyText, type RowMenuItem,
} from '@/components/onboarding/submissionTableParts';
import { 
    Search, ArrowLeft, UserPlus, X, AlertTriangle, 
    Play, FileText, Calendar, RefreshCw,
    UserCheck, Eye, Edit2, Trash2, CheckCircle2,
    MapPin, Briefcase, Bot, Sparkles, XCircle, CheckSquare, XSquare, Square
} from 'lucide-react';

type StatusFilter = 'all' | 'rejected' | 'draft' | 'pending' | 'verified';

const SyncStatusBadge: React.FC<{ pending?: boolean; failed?: boolean; syncStatus?: string }> = ({ pending, failed, syncStatus }) => {
    if (syncStatus === 'syncing') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                <RefreshCw size={10} className="animate-spin text-blue-600" />
                Syncing…
            </span>
        );
    }
    if (syncStatus === 'conflict') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
                <AlertTriangle size={10} className="text-purple-600" />
                Conflict
            </span>
        );
    }
    if (failed || syncStatus === 'failed') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                Sync Failed
            </span>
        );
    }
    if (pending || syncStatus === 'pending') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Queued Offline
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

        const unsub = subscribeOutbox((event) => {
            if (event.type === 'synced' || event.type === 'drained' || event.type === 'enqueued' || event.type === 'failed') {
                fetchSubmissions();
            }
        });

        return () => unsub();
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

    const colSpan = 6;

    return (
        <div className="min-h-full flex flex-col bg-slate-50 dark:bg-[#041b0f] text-slate-800 dark:text-white transition-colors duration-200">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Top Bar Header */}
            {isMobile ? (
                <div className="p-4 pb-0 space-y-4">
                    {/* Mobile Back Bar */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                if (window.history.state && window.history.state.idx > 0) {
                                    navigate(-1);
                                } else {
                                    navigate('/mobile-home?category=Employee+Onboarding');
                                }
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#065f46] hover:bg-[#044e3b] text-white border border-emerald-500/40 font-bold text-xs shadow-[0_2px_8px_rgba(6,95,70,0.4)] active:scale-95 transition-all cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Back</span>
                        </button>
                        <div className="h-[1px] flex-1 bg-[#134426]" />
                        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#44D62C] bg-[#092c19] px-2.5 py-1 rounded-lg border border-[#134426]">
                            My Submissions
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-black text-white tracking-tight">
                                    My Submissions
                                </h1>
                                <span className="bg-[#44D62C]/15 text-[#44D62C] text-xs font-black px-2.5 py-0.5 rounded-full border border-[#44D62C]/30">
                                    {userSubmissions.length} Total
                                </span>
                            </div>
                            <p className="text-xs text-white/50 mt-0.5">
                                Manage and verify employee onboarding applications
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchSubmissions}
                                disabled={isLoading}
                                className="p-2.5 rounded-xl border border-[#134426] bg-[#092c19] text-white hover:bg-[#134426] active:scale-95 transition-all cursor-pointer"
                                title="Refresh submissions"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#44D62C]' : ''}`} />
                            </button>
                            <button
                                onClick={handleStartNew}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#065f46] hover:bg-[#044e39] text-white rounded-xl font-bold text-xs shadow-[0_2px_8px_rgba(6,95,70,0.3)] border border-white/10 active:scale-95 transition-all cursor-pointer"
                            >
                                <UserPlus className="h-4 w-4 stroke-[2.5]" />
                                <span>New</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
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
            )}

            <div className={`px-4 py-6 md:px-8 space-y-6 ${isMobile ? 'pb-36' : ''}`}>
                {/* 5 Stats Cards Grid in 1 Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                    {/* TOTAL */}
                    <div 
                        onClick={() => setStatusFilter('all')}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                            statusFilter === 'all' 
                                ? (isMobile ? 'bg-[#092c19] border-[#44D62C] ring-1 ring-[#44D62C]/50 shadow-[0_0_12px_rgba(68,214,44,0.2)]' : 'ring-2 ring-emerald-500 border-emerald-500 bg-white dark:bg-[#062415]')
                                : (isMobile ? 'bg-[#092c19] border-[#134426]' : 'bg-white dark:bg-[#062415] border-slate-200 dark:border-white/5')
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-white/60">Total</span>
                            <span className={`p-1.5 rounded-xl ${isMobile ? 'bg-[#041b0f] text-[#44D62C] border border-[#134426]' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'}`}>
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
                        className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                            statusFilter === 'draft' 
                                ? (isMobile ? 'bg-[#092c19] border-[#44D62C] ring-1 ring-[#44D62C]/50 shadow-[0_0_12px_rgba(68,214,44,0.2)]' : 'ring-2 ring-slate-700 border-slate-700 bg-white dark:bg-[#062415]')
                                : (isMobile ? 'bg-[#092c19] border-[#134426]' : 'bg-white dark:bg-[#062415] border-slate-200 dark:border-white/5')
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-white/60">Drafts</span>
                            <span className={`p-1.5 rounded-xl ${isMobile ? 'bg-[#041b0f] text-sky-400 border border-[#134426]' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                <Edit2 className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between">
                            <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{counts.draft}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isMobile ? 'text-white/70 bg-[#041b0f] border border-[#134426]' : 'text-slate-500 bg-slate-100 dark:bg-slate-800'}`}>In Progress</span>
                        </div>
                    </div>

                    {/* PENDING */}
                    <div 
                        onClick={() => setStatusFilter('pending')}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                            statusFilter === 'pending' 
                                ? (isMobile ? 'bg-[#092c19] border-[#ff7a00] ring-1 ring-[#ff7a00]/50 shadow-[0_0_12px_rgba(255,122,0,0.2)]' : 'ring-2 ring-amber-500 border-amber-500 bg-white dark:bg-[#062415]')
                                : (isMobile ? 'bg-[#092c19] border-[#134426]' : 'bg-white dark:bg-[#062415] border-slate-200 dark:border-white/5')
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-white/60">Pending</span>
                            <span className={`p-1.5 rounded-xl ${isMobile ? 'bg-[#041b0f] text-[#ff7a00] border border-[#134426]' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'}`}>
                                <AlertTriangle className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between">
                            <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{counts.pending}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isMobile ? 'text-[#ff7a00] bg-[#ff7a00]/10 border border-[#ff7a00]/30' : 'text-amber-700 bg-amber-50 border border-amber-200'}`}>Action Needed</span>
                        </div>
                    </div>

                    {/* VERIFIED */}
                    <div 
                        onClick={() => setStatusFilter('verified')}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                            statusFilter === 'verified' 
                                ? (isMobile ? 'bg-[#092c19] border-[#44D62C] ring-1 ring-[#44D62C]/50 shadow-[0_0_12px_rgba(68,214,44,0.2)]' : 'ring-2 ring-teal-500 border-teal-500 bg-white dark:bg-[#062415]')
                                : (isMobile ? 'bg-[#092c19] border-[#134426]' : 'bg-white dark:bg-[#062415] border-slate-200 dark:border-white/5')
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-white/60">Verified</span>
                            <span className={`p-1.5 rounded-xl ${isMobile ? 'bg-[#041b0f] text-[#44D62C] border border-[#134426]' : 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400'}`}>
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
                        className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                            statusFilter === 'rejected' 
                                ? (isMobile ? 'bg-[#092c19] border-rose-500 ring-1 ring-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.2)]' : 'ring-2 ring-rose-500 border-rose-500 bg-white dark:bg-[#062415]')
                                : (isMobile ? 'bg-[#092c19] border-[#134426]' : 'bg-white dark:bg-[#062415] border-slate-200 dark:border-white/5')
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-white/60">Rejected</span>
                            <span className={`p-1.5 rounded-xl ${isMobile ? 'bg-[#041b0f] text-rose-400 border border-[#134426]' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'}`}>
                                <XCircle className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between">
                            <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{counts.rejected}</span>
                            {counts.rejected > 0 && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isMobile ? 'text-rose-300 bg-rose-950/60 border border-rose-800/60' : 'text-rose-700 bg-rose-50 border border-rose-200 animate-pulse'}`}>
                                    Needs Fix
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Table Container Card */}
                <div className={isMobile ? "space-y-3" : "bg-white dark:bg-[#062415] rounded-2xl border border-slate-200 dark:border-[#1f3d2b] shadow-xs overflow-hidden"}>
                    {/* Header Filter Bar */}
                    <div className={isMobile ? "bg-[#092c19] p-3.5 rounded-2xl border border-[#134426] space-y-3" : "p-4 border-b border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-black/10"}>
                        {/* Desktop: result summary (status cards above act as the filter) */}
                        {!isMobile && (
                            <div className="text-sm text-slate-600 dark:text-white/70">
                                Showing <b className="text-slate-900 dark:text-white">{filteredSubmissions.length}</b>
                                {statusFilter !== 'all' && <span className="capitalize"> {statusFilter}</span>} record{filteredSubmissions.length === 1 ? '' : 's'}
                                {statusFilter !== 'all' && (
                                    <button onClick={() => setStatusFilter('all')} className="ml-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">Clear status</button>
                                )}
                            </div>
                        )}
                        {/* Status Tabs (mobile) */}
                        {isMobile && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar flex-shrink-0">
                            {[
                                { key: 'all', label: 'All', count: counts.all },
                                { key: 'draft', label: 'Draft', count: counts.draft },
                                { key: 'pending', label: 'Pending', count: counts.pending },
                                { key: 'verified', label: 'Verified', count: counts.verified },
                                ...(counts.rejected > 0 ? [{ key: 'rejected', label: 'Rejected', count: counts.rejected }] : [])
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setStatusFilter(tab.key as any)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                        statusFilter === tab.key
                                            ? (isMobile ? 'bg-[#065f46] text-white shadow-[0_2px_8px_rgba(6,95,70,0.3)] border border-white/10' : 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs')
                                            : (isMobile ? 'bg-[#041b0f] border border-[#134426] text-white/70 hover:text-white' : 'bg-white dark:bg-[#122e1e] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400')
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    <span className="text-[11px] opacity-80">{tab.count}</span>
                                </button>
                            ))}
                        </div>
                        )}

                        {/* Search Input */}
                        <div className="relative w-full sm:w-80">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isMobile ? 'text-[#44D62C]/70' : 'text-slate-400'}`} />
                            <input
                                type="text"
                                placeholder="Search by name, ID, or site..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className={isMobile 
                                    ? "w-full pl-9 pr-8 py-2.5 bg-[#041b0f] border border-[#134426] rounded-xl text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-[#44D62C] shadow-inner"
                                    : "w-full pl-9 pr-8 py-2 bg-white dark:bg-[#062415] border border-slate-200 dark:border-[#1f3d2b] rounded-xl text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                                }
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white cursor-pointer"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table or Responsive View */}
                    <div className={isMobile ? "space-y-3" : "overflow-x-auto"}>
                        {isMobile ? (
                            <div className="space-y-3">
                                {isLoading ? (
                                    <div className="p-4"><TableSkeleton rows={4} cols={colSpan} isMobile={true} /></div>
                                ) : filteredSubmissions.length === 0 ? (
                                    <div className="p-12 text-center text-white/50 bg-[#092c19] border border-[#134426] rounded-2xl">
                                        <Search className="h-10 w-10 mx-auto mb-2 text-[#44D62C] opacity-40" />
                                        <p className="font-bold text-white text-sm">No submissions found</p>
                                    </div>
                                ) : (
                                    filteredSubmissions.map(s => {
                                        const empPhoto = getEmployeePhoto(s);
                                        const displayName = [s.personal?.firstName, s.personal?.lastName].filter(Boolean).join(' ') || (s.personal?.mobile ? `Draft (${s.personal.mobile})` : 'Draft Applicant');
                                        const isDraft = s.status === 'draft';
                                        const isRejected = s.status === 'rejected';
                                        const rejectionReason = s.rejectionReason || (s as any).rejection_reason || (s.personal as any)?.rejectionReason || 'Profile Photo Mismatch';

                                        return (
                                            <div key={s.id} className="p-4 space-y-3 bg-[#092c19] border border-[#134426] rounded-2xl shadow-sm hover:border-[#44D62C]/40 transition-all">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {empPhoto ? (
                                                            <img src={empPhoto} alt={displayName} className="h-11 w-11 rounded-full object-cover border-2 border-[#134426] shadow-sm" />
                                                        ) : (
                                                            <div className="h-11 w-11 rounded-full bg-[#041b0f] border border-[#134426] text-[#44D62C] font-black text-xs flex items-center justify-center">
                                                                {displayName.slice(0, 2).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="font-black text-white capitalize text-sm">{displayName}</div>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-xs text-white/50 font-medium">{s.personal?.employeeId || 'ID: Pending'}</span>
                                                                <SyncStatusBadge pending={(s as any).pending} failed={(s as any).failed} syncStatus={(s as any).syncStatus} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <StatusChip status={s.status} />
                                                </div>

                                                {isRejected && (
                                                    <div className="bg-rose-950/60 border border-rose-800/60 rounded-xl p-2.5 text-xs text-rose-200 font-medium">
                                                        ⚠ {rejectionReason}
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between text-xs text-white/60 bg-[#041b0f] px-3 py-2 rounded-xl border border-[#134426]">
                                                    <span className="font-semibold text-white/80">{s.organizationName || s.organization?.organizationName || '-'}</span>
                                                    <span>{formatCreatedDate(s.createdAt || s.enrollmentDate)}</span>
                                                </div>

                                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#134426]">
                                                    <button 
                                                        onClick={() => navigate(`/onboarding/add/review?id=${s.id}`)}
                                                        className="px-3.5 py-1.5 bg-[#041b0f] hover:bg-[#134426] text-white border border-[#134426] rounded-xl text-xs font-bold transition-all cursor-pointer"
                                                    >
                                                        View
                                                    </button>
                                                    {isRejected ? (
                                                        <button 
                                                            onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
                                                        >
                                                            Fix Details
                                                        </button>
                                                    ) : isDraft ? (
                                                        <button 
                                                            onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                            className="px-3.5 py-1.5 bg-[#065f46] hover:bg-[#044e39] text-white rounded-xl text-xs font-bold shadow-[0_2px_8px_rgba(6,95,70,0.3)] border border-white/10 active:scale-95 transition-all cursor-pointer"
                                                        >
                                                            Resume
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                            className="px-3.5 py-1.5 bg-[#041b0f] hover:bg-[#134426] text-[#44D62C] border border-[#134426] rounded-xl text-xs font-bold transition-all cursor-pointer"
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
                            <table className="w-full min-w-[920px] border-separate border-spacing-0 table-fixed">
                                <colgroup>
                                    <col className="w-[26%]" />
                                    <col className="w-[22%]" />
                                    <col className="w-[24%]" />
                                    <col className="w-[11%]" />
                                    <col className="w-[11%]" />
                                    <col className="w-[160px]" />
                                </colgroup>
                                <thead>
                                    <tr className="bg-slate-50/80 dark:bg-black/10">
                                        {['Employee', 'Site & Role', 'Status', 'Documents', 'Submitted'].map(h => (
                                            <th key={h} scope="col" className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider border-b border-slate-200 dark:border-white/5 whitespace-nowrap">
                                                {h}
                                            </th>
                                        ))}
                                        <th scope="col" className="sticky right-0 z-20 bg-slate-50 dark:bg-[#062415] px-4 py-2.5 text-right text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider border-b border-slate-200 dark:border-white/5">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <TableSkeleton rows={5} cols={colSpan} />
                                    ) : filteredSubmissions.length === 0 ? (
                                        <tr><td colSpan={colSpan} className="text-center py-16">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <Search className="h-10 w-10 mb-3 opacity-30 text-emerald-600" />
                                                <p className="text-sm font-semibold text-slate-700 dark:text-white/80">No submissions found</p>
                                                <p className="text-xs text-slate-400 mt-1">Try another status or search term.</p>
                                                {(statusFilter !== 'all' || searchTerm) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setStatusFilter('all'); setSearchTerm(''); }}
                                                        className="mt-3 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                                    >
                                                        Clear filters
                                                    </button>
                                                )}
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
                                            const isAiVerified = s.verificationMode === 'auto' || s.verifiedBy === 'Paradigm AI Agent';
                                            const site = prettyText(s.organizationName || s.organization?.organizationName) || '—';
                                            const designation = prettyText(s.organization?.designation) || '—';
                                            const syncStatus = (s as any).syncStatus;
                                            const hasSyncIssue = (s as any).pending || (s as any).failed || (syncStatus && syncStatus !== 'synced');
                                            const accent = s.requiresManualVerification
                                                ? 'border-l-amber-400'
                                                : s.status === 'pending' ? 'border-l-amber-300'
                                                : s.status === 'rejected' ? 'border-l-rose-400'
                                                : s.status === 'verified' ? 'border-l-emerald-400'
                                                : 'border-l-slate-200';
                                            const cell = 'px-4 py-2.5 align-middle border-b border-slate-100 dark:border-white/5 bg-white dark:bg-[#062415] group-hover:bg-slate-50/80 dark:group-hover:bg-[#0a2e1b] transition-colors';
                                            const btn = 'h-7 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap';

                                            const menuItems: RowMenuItem[] = [
                                                { label: 'View details', icon: Eye, onClick: () => navigate(`/onboarding/add/review?id=${s.id}`) },
                                                { label: 'Edit application', icon: Edit2, onClick: () => navigate(`/onboarding/add/personal?id=${s.id}`) },
                                                { label: 'Download forms', icon: FileText, onClick: () => navigate(`/onboarding/pdf/${s.id}`) },
                                                { label: 'Delete application', icon: Trash2, onClick: () => handleDelete(s.id!), danger: true },
                                            ];

                                            let primary: React.ReactNode = null;
                                            if (isDraft) {
                                                primary = (
                                                    <button onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)} className={`${btn} bg-white dark:bg-[#041b0f] text-slate-800 dark:text-white border border-slate-300 dark:border-[#134426] hover:bg-slate-50`} title="Resume incomplete enrollment">
                                                        <Play className="h-3 w-3 fill-current" /> Resume
                                                    </button>
                                                );
                                            } else if (s.status === 'rejected') {
                                                primary = (
                                                    <button onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)} className={`${btn} bg-rose-600 hover:bg-rose-700 text-white shadow-xs`} title="Update rejected details">
                                                        <Edit2 className="h-3 w-3" /> Fix Details
                                                    </button>
                                                );
                                            } else if (s.status === 'pending') {
                                                primary = (
                                                    <button onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)} className={`${btn} bg-white dark:bg-[#041b0f] text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-50`} title="Edit details while awaiting review">
                                                        <Edit2 className="h-3 w-3" /> Edit Form
                                                    </button>
                                                );
                                            } else if (s.status === 'verified') {
                                                primary = (
                                                    <span className="h-7 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                                        <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                                                    </span>
                                                );
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
                                                                <span className="font-mono text-[11px] text-slate-500 dark:text-white/50">{s.personal?.employeeId || 'ID pending'}</span>
                                                                {hasSyncIssue && (
                                                                    <SyncStatusBadge pending={(s as any).pending} failed={(s as any).failed} syncStatus={syncStatus} />
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

                                                {/* Status (+ reviewer / reason) */}
                                                <td className={cell}>
                                                    <StatusChip status={s.status} />
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
                                                            'Awaiting HR review'
                                                        ) : (
                                                            'In progress — not submitted yet'
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Documents */}
                                                <td className={cell}>
                                                    <CompactDocSummary submission={s} onToggleDoc={(key) => handleToggleDocVerification(s.id!, key)} />
                                                </td>

                                                {/* Submitted */}
                                                <td className={cell}>
                                                    <div className="text-xs text-slate-600 dark:text-white/70 whitespace-nowrap">
                                                        {formatCreatedDate(s.createdAt || s.created_at || s.enrollmentDate)}
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
            </div>
        </div>
    );
};

export default MySubmissions;