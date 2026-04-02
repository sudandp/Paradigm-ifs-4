import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import type { OnboardingData } from '@/types';
import StatusChip from '@/components/ui/StatusChip';
import Button from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, FileText, Send, RefreshCw, AlertTriangle, Loader2, CheckSquare, XSquare, Square } from 'lucide-react';
import Toast from '@/components/ui/Toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { useMediaQuery } from '@/hooks/useMediaQuery';


const VerificationChecks: React.FC<{ submission: OnboardingData; isSyncing: boolean }> = ({ submission, isSyncing }) => {
    if (submission.status !== 'verified' || !submission.portalSyncStatus) {
        return <span className="text-sm font-medium text-muted">-</span>;
    }

    if (isSyncing) {
        return <div className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Syncing...</div>;
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
        const color = isChecked ? 'text-green-600' : (isFailed ? 'text-red-600' : 'text-muted');
        const title = isChecked ? 'Verified' : (isFailed ? 'Failed' : 'Pending Verification');

        return (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`} title={title}>
                <Icon className="h-4 w-4" />
                <span>{label}</span>
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


const VerificationDashboard: React.FC = () => {
    const [submissions, setSubmissions] = useState<OnboardingData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');

    const fetchSubmissions = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getVerificationSubmissions(statusFilter === 'all' ? undefined : statusFilter);
            setSubmissions(data);
        } catch (error) {
            console.error("Failed to fetch submissions", error);
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchSubmissions();

        // REAL-TIME LISTENER
        const channel = supabase.channel('submissions-feed')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'onboarding_submissions' },
                (payload) => {
                    console.log('Real-time change received!', payload);
                    // Simple and effective way to update is to just refetch the data
                    fetchSubmissions();
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
        return submissions.filter(s =>
        (s.personal.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.personal.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.personal.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.organizationName?.toLowerCase().includes(searchTerm.toLowerCase()))
        );
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

    return (
        <div className="p-3 md:p-4 flex-1 flex flex-col">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            
            <div className="mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-0.5">Onboarding Forms</h2>
                <p className="text-gray-500 text-sm">Manage and verify employee onboarding submissions across organizations</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col">
                <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex-shrink-0">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                        <div className="bg-gray-100/80 p-1 rounded-xl w-full lg:w-auto self-start">
                            <nav className="flex space-x-1" aria-label="Tabs">
                                {filterTabs.map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setStatusFilter(tab)}
                                        className={`${statusFilter === tab
                                            ? 'bg-white text-emerald-700 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                            } whitespace-nowrap py-1.5 px-3 rounded-lg font-semibold text-[13px] capitalize transition-all duration-200 flex items-center gap-2`}
                                    >
                                        {tab}
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                            statusFilter === tab ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {counts[tab as keyof typeof counts]}
                                        </span>
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="relative w-full lg:max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Search className="h-4.5 w-4.5 text-gray-400" />
                            </div>
                            <input
                                id="onboarding-search"
                                name="onboardingSearch"
                                type="text"
                                placeholder="Search by name, ID, or site..."
                                aria-label="Search onboarding forms"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="block w-full bg-white border border-gray-200 rounded-xl py-2 pl-10 pr-4 text-[13px] placeholder-gray-400 text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                            />
                        </div>
                    </div>
                </div>

            <div className="overflow-x-auto overflow-y-hidden">
                <table className="min-w-full border-separate border-spacing-0 responsive-table">
                    <thead>
                        <tr className="bg-gray-50/50">
                            <th scope="col" className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Employee</th>
                            <th scope="col" className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Site</th>
                            {statusFilter !== 'verified' && (
                                <th scope="col" className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Status</th>
                            )}
                            <th scope="col" className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Portal Verification</th>
                            <th scope="col" className="px-5 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading ? (
                            isMobile
                                ? <tr><td colSpan={colSpan}><TableSkeleton rows={3} cols={4} isMobile /></td></tr>
                                : <TableSkeleton rows={5} cols={colSpan} />
                        ) : filteredSubmissions.length === 0 ? (
                            <tr><td colSpan={colSpan} className="text-center py-16">
                                <div className="flex flex-col items-center justify-center text-gray-400">
                                    <Search className="h-10 w-10 mb-3 opacity-20" />
                                    <p className="text-sm font-medium">No submissions found.</p>
                                    <p className="text-xs">Try adjusting your search or filters</p>
                                </div>
                            </td></tr>
                        ) : (
                            filteredSubmissions.map((s) => (
                                <tr key={s.id} className={`group hover:bg-emerald-50/30 transition-colors duration-150 ${s.requiresManualVerification ? 'bg-orange-50/50' : ''}`}>
                                    <td data-label="Employee" className="px-5 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm border-2 border-white shadow-sm flex-shrink-0">
                                                {s.personal.firstName?.[0]}{s.personal.lastName?.[0]}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold tracking-wide capitalize">
                                                        {s.personal.firstName} {s.personal.lastName}</span>
                                                    {s.requiresManualVerification && (
                                                        <span title="Manual verification required">
                                                            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm font-bold text-gray-900">{s.personal.employeeId}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td data-label="Site" className="px-5 py-3 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-700">{s.organizationName}</div>
                                    </td>
                                    {statusFilter !== 'verified' && (
                                        <td data-label="Status" className="px-5 py-3 whitespace-nowrap">
                                            <StatusChip status={s.status} />
                                        </td>
                                    )}
                                    <td data-label="Portal Verification" className="px-5 py-3 whitespace-nowrap">
                                        <VerificationChecks submission={s} isSyncing={syncingId === s.id} />
                                    </td>
                                    <td data-label="Actions" className="px-5 py-3 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button 
                                                onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)}
                                                className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200"
                                                title="View Details"
                                            >
                                                <Eye className="h-4.5 w-4.5" />
                                            </button>
                                            <button 
                                                onClick={() => navigate(`/onboarding/pdf/${s.id}`)}
                                                className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200"
                                                title="Download Forms"
                                            >
                                                <FileText className="h-4.5 w-4.5" />
                                            </button>
                                            {s.status === 'pending' && (
                                                <div className="flex items-center gap-1 border-l border-gray-100 ml-1 pl-1">
                                                    <button 
                                                        onClick={() => handleAction('approve', s.id!)}
                                                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200"
                                                        title="Verify"
                                                    >
                                                        <CheckSquare className="h-4.5 w-4.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleAction('reject', s.id!)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
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
                                                    className="ml-2 !rounded-lg border-gray-200 text-gray-600 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50"
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
            </div>
        </div>
    </div>
    );
};

export default VerificationDashboard;