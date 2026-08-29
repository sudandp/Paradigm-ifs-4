import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/services/api';
import type { OnboardingData } from '@/types';
import StatusChip from '@/components/ui/StatusChip';
import Button from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, FileText, Send, RefreshCw, AlertTriangle, Loader2, CheckSquare, XSquare, Square } from 'lucide-react';
import Toast from '@/components/ui/Toast';
import { useAuthStore } from '@/store/authStore';
import { triggerEnterpriseHandshake } from '@/services/enterpriseHandshake';
import { RejectReasonModal } from '@/components/onboarding/RejectReasonModal';
import hotToast from 'react-hot-toast';


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
    const [deployingId, setDeployingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [rejectModalSubmission, setRejectModalSubmission] = useState<OnboardingData | null>(null);
    const [isRejecting, setIsRejecting] = useState(false);
    const { user } = useAuthStore();
    const navigate = useNavigate();

    const fetchSubmissions = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const isSuperAdmin = ['admin', 'super_admin'].includes(user.role);
            const data = await api.getVerificationSubmissions(
                statusFilter === 'all' ? undefined : statusFilter,
                undefined,
                isSuperAdmin ? undefined : user.id
            );
            setSubmissions(data);
        } catch (error) {
            console.error("Failed to fetch submissions", error);
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter, user]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    const filteredSubmissions = useMemo(() => {
        return submissions.filter(s => {
            const siteName = s.organizationName || s.organization?.organizationName || '';
            return (
                s.personal.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.personal.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.personal.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                siteName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        });
    }, [submissions, searchTerm]);

    const handleConfirmReject = async (reason: string) => {
        if (!rejectModalSubmission || !rejectModalSubmission.id) return;
        const id = rejectModalSubmission.id;
        setIsRejecting(true);

        setSubmissions(prev => prev.map(s => s.id === id ? { 
            ...s, 
            status: 'rejected',
            rejectionReason: reason,
            rejection_reason: reason
        } : s));

        try {
            await api.requestChanges(id, reason);
            hotToast.success(`❌ Rejected: ${reason}. Submitter has been alerted!`);
            setRejectModalSubmission(null);
        } catch (error) {
            console.error(`Failed to reject submission`, error);
            hotToast.error('Failed to reject submission.');
        } finally {
            setIsRejecting(false);
        }
    };

    const handleDeploy = async (submission: OnboardingData) => {
        if (!submission.id) return;
        setDeployingId(submission.id);
        try {
            await api.verifySubmission(submission.id); // Mark as verified first

            const result = await triggerEnterpriseHandshake(submission.id, {
                site: submission.organizationName || submission.organization?.organizationName,
                shift: 'General'
            });

            if (result.overallSuccess) {
                setToast({ message: 'Deployed successfully! 5-part handshake complete.', type: 'success' });
                setSubmissions(prev => prev.map(s => s.id === submission.id ? { ...s, status: 'deployed' as any, portalSyncStatus: 'synced' } : s));
            } else {
                setToast({ message: 'Deployment partial failure. Check logs.', type: 'error' });
                // Still mark as verified
                setSubmissions(prev => prev.map(s => s.id === submission.id ? { ...s, status: 'verified', portalSyncStatus: 'pending_sync' } : s));
            }
        } catch (error) {
            console.error('Deployment failed:', error);
            setToast({ message: 'Deployment failed.', type: 'error' });
        } finally {
            setDeployingId(null);
        }
    };

    const handleSync = async (id: string) => {
        setSyncingId(id);
        try {
            const updatedSubmission = await api.syncPortals(id);
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

    return (
        <div className="p-4 md:p-6 bg-page min-h-screen">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-primary-text">Verification Dashboard</h2>
                    <p className="text-muted">Review and verify onboarding submissions</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center my-6 gap-4">
                <div className="w-full sm:w-auto border-b border-border">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        {['all', 'pending', 'verified', 'rejected'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setStatusFilter(tab)}
                                className={`${statusFilter === tab
                                    ? 'border-emerald-500 text-emerald-700'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm capitalize transition-colors duration-200`}
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="relative w-full sm:w-auto sm:max-w-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by name, ID, or site..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="block w-full !pl-10 pr-3 py-2 border border-border rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-accent focus:border-accent sm:text-sm"
                    />
                </div>
            </div>

            <div className="overflow-x-auto bg-card rounded-xl shadow-card border border-border">
                <table className="min-w-full responsive-table">
                    <thead className="bg-page">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Employee</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Site</th>
                            {statusFilter !== 'verified' && (
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                            )}
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Designation</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={5} className="text-center py-10 text-muted">Loading submissions...</td></tr>
                        ) : filteredSubmissions.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-10 text-muted">No submissions found.</td></tr>
                        ) : (
                            filteredSubmissions.map((s) => (
                                <tr key={s.id}>
                                    <td data-label="Employee" className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            {s.requiresManualVerification && (
                                                <span title="Manual verification required">
                                                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                                                </span>
                                            )}
                                            <div>
                                                <div className="text-sm font-medium text-primary-text">{s.personal.firstName} {s.personal.lastName}</div>
                                                <div className="text-sm text-muted">{s.personal.employeeId}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td data-label="Site" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-text">{s.organizationName || s.organization?.organizationName || '-'}</td>
                                    {statusFilter !== 'verified' && (
                                        <td data-label="Status" className="px-6 py-4 whitespace-nowrap">
                                            <StatusChip status={s.status} />
                                            {s.status === 'rejected' && (
                                                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md shadow-2xs max-w-[180px]" title={s.rejectionReason || (s as any).rejection_reason || s.personal?.rejectionReason || 'Profile Photo Mismatch'}>
                                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                                    <span className="truncate">{s.rejectionReason || (s as any).rejection_reason || s.personal?.rejectionReason || 'Profile Photo Mismatch'}</span>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                    <td data-label="Designation" className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-primary-text">{s.organization?.designation || '-'}</div>
                                        {s.status === 'verified' && (
                                            <div className="mt-1">
                                                <VerificationChecks submission={s} isSyncing={syncingId === s.id} />
                                            </div>
                                        )}
                                    </td>
                                    <td data-label="Actions" className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center gap-2">
                                            <Button variant="icon" size="sm" onClick={() => navigate(`/onboarding/add/personal?id=${s.id}`)} title="View Details" aria-label={`View details for ${s.personal.firstName}`}><Eye className="h-4 w-4" /></Button>
                                            <Button variant="icon" size="sm" onClick={() => navigate(`/onboarding/pdf/${s.id}`)} title="Download Forms" aria-label={`Download forms for ${s.personal.firstName}`}><FileText className="h-4 w-4" /></Button>
                                            {s.status === 'pending' && (
                                                <>
                                                    <Button variant="outline" size="sm" onClick={() => handleDeploy(s)} isLoading={deployingId === s.id} title="Approve & Deploy" aria-label={`Approve and deploy ${s.personal.firstName}`}>
                                                        {deployingId !== s.id && <CheckSquare className="h-4 w-4 mr-1 text-green-600" />}
                                                        Approve & Deploy
                                                    </Button>
                                                    <Button variant="icon" size="sm" onClick={() => setRejectModalSubmission(s)} title="Request Changes / Reject" aria-label={`Reject ${s.personal.firstName}`}><XSquare className="h-4 w-4 text-red-600" /></Button>
                                                </>
                                            )}
                                            {s.status === 'verified' && (s.portalSyncStatus === 'pending_sync' || s.portalSyncStatus === 'failed') && (
                                                <Button variant="outline" size="sm" onClick={() => handleSync(s.id!)} isLoading={syncingId === s.id} title="Push data to government portals">
                                                    {syncingId !== s.id && <Send className="h-4 w-4 mr-1" />}
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

            <RejectReasonModal
                isOpen={!!rejectModalSubmission}
                submission={rejectModalSubmission}
                onClose={() => setRejectModalSubmission(null)}
                onConfirm={handleConfirmReject}
                isSubmitting={isRejecting}
            />
        </div>
    );
};

export default VerificationDashboard;