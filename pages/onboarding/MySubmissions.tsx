import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { OnboardingData } from '../../types';
import { 
    Search, ArrowLeft, UserPlus, X, AlertTriangle, 
    Edit3, Play, FileText, Building, Calendar, RefreshCw,
    ShieldAlert, UserCheck
} from 'lucide-react';
import Toast from '../../components/ui/Toast';
import StatusChip from '../../components/ui/StatusChip';
import CardListSkeleton from '../../components/skeletons/CardListSkeleton';
import { useAuthStore } from '../../store/authStore';

type StatusFilter = 'all' | 'rejected' | 'draft' | 'pending' | 'verified';

export const MySubmissions: React.FC = () => {
    const [submissions, setSubmissions] = useState<OnboardingData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const navigate = useNavigate();
    const searchInputRef = useRef<HTMLInputElement>(null);

    const activeUser = useAuthStore(state => state.user);

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

    const getCandidatePhoto = (s: OnboardingData): string | null => {
        const p = s.personal as any;
        if (!p) return null;
        if (typeof p.photo === 'string' && p.photo.trim() !== '') return p.photo;
        if (typeof p.photo === 'object' && p.photo?.url) return p.photo.url;
        if (typeof p.photo === 'object' && p.photo?.preview) return p.photo.preview;
        if (typeof p.photoUrl === 'string' && p.photoUrl.trim() !== '') return p.photoUrl;
        if (typeof p.profilePhoto === 'string' && p.profilePhoto.trim() !== '') return p.profilePhoto;
        return null;
    };

    const handleEditSubmission = (s: OnboardingData) => {
        navigate(`/onboarding/add/personal?id=${s.id}`);
    };

    const handleStartNew = () => {
        navigate('/onboarding/select-organization');
    };

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
                                {userSubmissions.length} Forms
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Forms created & submitted by <span className="font-semibold text-emerald-600 dark:text-emerald-400">{activeUser?.name || 'You'}</span>
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

            {/* Filter Tabs & Search */}
            <div className="px-4 py-4 md:px-8 space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* Status Pill Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-shrink-0">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                statusFilter === 'all'
                                    ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                                    : 'bg-white dark:bg-[#122e1e] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                        >
                            <span>All</span>
                            <span className="text-[11px] opacity-80">({counts.all})</span>
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
                                <span>Rejected (Update Required)</span>
                                <span className="px-1.5 py-0.2 bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 rounded-full text-[10px]">
                                    {counts.rejected}
                                </span>
                            </button>
                        )}

                        <button
                            onClick={() => setStatusFilter('draft')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                statusFilter === 'draft'
                                    ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xs'
                                    : 'bg-white dark:bg-[#122e1e] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                        >
                            <span>Drafts</span>
                            <span className="text-[11px] opacity-80">({counts.draft})</span>
                        </button>

                        <button
                            onClick={() => setStatusFilter('pending')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                statusFilter === 'pending'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'bg-white dark:bg-[#122e1e] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                        >
                            <span>Pending Verification</span>
                            <span className="text-[11px] opacity-80">({counts.pending})</span>
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
                            <span className="text-[11px] opacity-80">({counts.verified})</span>
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search candidate, mobile, site..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#062415] border border-slate-200 dark:border-[#1f3d2b] rounded-xl text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

                {/* Submissions List */}
                {isLoading ? (
                    <div className="pt-4">
                        <CardListSkeleton count={4} />
                    </div>
                ) : filteredSubmissions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredSubmissions.map((s) => {
                            const empPhoto = getCandidatePhoto(s);
                            const displayName = [s.personal?.firstName, s.personal?.lastName].filter(Boolean).join(' ') || 
                                (s.personal?.mobile ? `Draft (${s.personal.mobile})` : (s.personal?.employeeId ? `Draft (${s.personal.employeeId})` : 'Draft Applicant'));
                            const initials = ((s.personal?.firstName?.[0] || '') + (s.personal?.lastName?.[0] || '')) || 'DR';
                            const isRejected = s.status === 'rejected';
                            const isDraft = s.status === 'draft';
                            const isVerified = s.status === 'verified';
                            const rejectionReason = s.rejectionReason || (s as any).rejection_reason || (s.personal as any)?.rejectionReason || 'Profile Photo / Document Mismatch';
                            const rejectedBy = s.rejectedBy || (s as any).rejected_by || (s.personal as any)?.rejectedBy || 'HR Admin';
                            const siteName = s.organization?.site || s.organization?.organizationName || (s as any).organizationName || 'Site Not Assigned';
                            const designation = s.organization?.designation || (s as any).designation || 'Staff / Guard';
                            const createdDate = s.createdAt || (s as any).created_at || s.enrollmentDate;

                            return (
                                <div 
                                    key={s.id} 
                                    className={`relative bg-white dark:bg-[#062415] rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                                        isRejected 
                                            ? 'border-rose-400 dark:border-rose-700/80 bg-rose-50/20 dark:bg-rose-950/20 ring-1 ring-rose-400/50' 
                                            : isDraft
                                            ? 'border-slate-300 dark:border-slate-700/80'
                                            : isVerified
                                            ? 'border-emerald-300 dark:border-emerald-800/80'
                                            : 'border-amber-300 dark:border-amber-800/80'
                                    }`}
                                >
                                    {/* Card Header & Candidate Details */}
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="relative h-12 w-12 flex-shrink-0 flex items-center justify-center">
                                                    {empPhoto ? (
                                                        <img 
                                                            src={empPhoto} 
                                                            alt={displayName} 
                                                            className="h-12 w-12 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-2xs"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                const fb = e.currentTarget.parentElement?.querySelector('.sub-emp-fallback') as HTMLElement;
                                                                if (fb) fb.style.display = 'flex';
                                                            }}
                                                        />
                                                    ) : null}
                                                    <div 
                                                        className={`sub-emp-fallback h-12 w-12 rounded-full ${
                                                            isDraft ? 'bg-slate-700' : isRejected ? 'bg-rose-600' : 'bg-emerald-600'
                                                        } text-white font-black text-sm items-center justify-center shadow-2xs border-2 border-white dark:border-slate-800 uppercase ${empPhoto ? 'hidden' : 'flex'}`}
                                                    >
                                                        {initials}
                                                    </div>
                                                </div>

                                                <div>
                                                    <h3 className="font-bold text-sm text-slate-900 dark:text-white capitalize leading-tight">
                                                        {displayName}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                                                        <span>{s.personal?.mobile || 'No Mobile'}</span>
                                                        {s.personal?.employeeId && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{s.personal.employeeId}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <StatusChip status={s.status} />
                                        </div>

                                        {/* Site & Designation */}
                                        <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-2.5 border border-slate-100 dark:border-white/5 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-1.5">
                                                <Building className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                                <span className="truncate font-medium">{siteName}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                <span className="truncate font-semibold uppercase">{designation}</span>
                                                {createdDate && (
                                                    <span className="flex items-center gap-1 flex-shrink-0">
                                                        <Calendar className="h-3 w-3 text-slate-400" />
                                                        <span>{new Date(createdDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Rejection Alert Box */}
                                        {isRejected && (
                                            <div className="bg-rose-100/90 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl p-3 text-xs space-y-1 animate-pulse-subtle">
                                                <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-200">
                                                    <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                                                    <span>Rejection Reason:</span>
                                                </div>
                                                <p className="text-rose-700 dark:text-rose-300 font-medium pl-5">
                                                    {rejectionReason}
                                                </p>
                                                <p className="text-[10px] text-rose-600 dark:text-rose-400/80 pl-5">
                                                    Rejected by: {rejectedBy}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="bg-slate-50/80 dark:bg-black/30 border-t border-slate-100 dark:border-white/5 p-3 flex items-center justify-between gap-2">
                                        {isRejected ? (
                                            <button
                                                onClick={() => handleEditSubmission(s)}
                                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md shadow-rose-600/20 transition-all active:scale-95"
                                            >
                                                <Edit3 className="h-4 w-4" />
                                                <span>Update & Fix Rejected Details</span>
                                            </button>
                                        ) : isDraft ? (
                                            <button
                                                onClick={() => handleEditSubmission(s)}
                                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-900 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
                                            >
                                                <Play className="h-4 w-4" />
                                                <span>Resume Draft</span>
                                            </button>
                                        ) : (
                                            <div className="w-full flex items-center justify-between gap-2">
                                                <button
                                                    onClick={() => handleEditSubmission(s)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-[#122e1e] hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl font-semibold text-xs text-slate-700 dark:text-slate-200 transition-all"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                                                    <span>View / Edit</span>
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/onboarding/pdf/${s.id}`)}
                                                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/50 rounded-xl font-semibold text-xs text-emerald-700 dark:text-emerald-300 transition-all"
                                                    title="View Onboarding Booklet / Dossier"
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                    <span>Dossier</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#062415] rounded-3xl border border-slate-200 dark:border-[#1f3d2b] p-12 text-center max-w-lg mx-auto mt-8 space-y-4">
                        <div className="h-16 w-16 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                            <UserCheck className="h-8 w-8 text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                No {statusFilter !== 'all' ? statusFilter : ''} submissions found
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {searchTerm
                                    ? `No submissions match "${searchTerm}".`
                                    : `You have not created any ${statusFilter !== 'all' ? statusFilter : ''} onboarding forms yet.`}
                            </p>
                        </div>
                        <button
                            onClick={handleStartNew}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                        >
                            <UserPlus className="h-4 w-4" />
                            <span>Start New Enrollment</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MySubmissions;