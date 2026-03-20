import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { UserChild } from '../../types';
import { Check, X, Eye, Loader2, Baby, User, Calendar, FilterX, Download } from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { exportGenericReportToExcel, GenericReportColumn } from '../../utils/excelExport';

const FamilyVerification: React.FC = () => {
    const { user } = useAuthStore();
    const [children, setChildren] = useState<(UserChild & { userName: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [actioningId, setActioningId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getAllChildrenRecords();
            setChildren(data);
        } catch (error: any) {
            console.error('Failed to fetch children records:', error);
            setToast({ message: `Failed to load children records: ${error.message || 'Unknown error'}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleVerify = async (childId: string, status: 'approved' | 'rejected') => {
        if (!user) return;
        if (!window.confirm(`Are you sure you want to ${status} this record?`)) return;

        setActioningId(childId);
        try {
            await api.verifyChild(childId, status, user.id);
            setToast({ message: `Record ${status} successfully.`, type: 'success' });
            fetchData();
        } catch (error) {
            setToast({ message: `Failed to ${status} record.`, type: 'error' });
        } finally {
            setActioningId(null);
        }
    };

    const handleExport = async () => {
        if (children.length === 0) {
            setToast({ message: 'No data to export.', type: 'error' });
            return;
        }

        const columns: GenericReportColumn[] = [
            { header: 'Employee Name', key: 'userName', width: 25 },
            { header: 'Child Name', key: 'childName', width: 20 },
            { header: 'Date of Birth', key: 'dateOfBirth', width: 15 },
            { header: 'Status', key: 'verificationStatus', width: 15 },
            { header: 'Added On', key: 'createdAt', width: 20 },
        ];

        const reportData = children.map(c => ({
            ...c,
            dateOfBirth: format(new Date(c.dateOfBirth.replace(/-/g, '/')), 'dd MMM yyyy'),
            createdAt: format(new Date(c.createdAt), 'dd MMM yyyy HH:mm'),
            verificationStatus: c.verificationStatus.toUpperCase()
        }));

        try {
            await exportGenericReportToExcel(
                reportData, 
                columns, 
                'Family Details Verification', 
                { 
                    startDate: new Date(new Date().getFullYear(), 0, 1), 
                    endDate: new Date() 
                }, 
                'Family_Verification', 
                undefined, 
                user?.name
            );
            setToast({ message: 'Report exported successfully.', type: 'success' });
        } catch (err) {
            setToast({ message: 'Failed to export report.', type: 'error' });
        }
    };

    const filteredChildren = children.filter(c => statusFilter === 'all' || c.verificationStatus === statusFilter);

    if (isLoading) return <LoadingScreen message="Loading family records..." />;

    return (
        <div className="p-4 border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-lg">
                        <Baby className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-primary-text">Family Verification</h2>
                        <p className="text-sm text-muted">Verify children details for Pink Leave and Child Care Leave eligibility.</p>
                    </div>
                </div>
                <Button variant="secondary" onClick={handleExport} disabled={children.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Export
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
                {(['pending', 'approved', 'rejected', 'all'] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                            statusFilter === status 
                                ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' 
                                : 'bg-page border-border text-muted hover:border-emerald-500/50'
                        }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)} ({children.filter(c => status === 'all' || c.verificationStatus === status).length})
                    </button>
                ))}
            </div>

            <div className="overflow-x-auto bg-page rounded-2xl border border-border shadow-sm">
                <table className="min-w-full responsive-table">
                    <thead>
                        <tr className="bg-card">
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider border-b border-border">Employee</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider border-b border-border">Child Name</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider border-b border-border">Date of Birth</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider border-b border-border">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider border-b border-border">Certificate</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider border-b border-border text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredChildren.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted italic">
                                        <FilterX className="h-10 w-10 opacity-20" />
                                        <p>No records found matching this filter.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredChildren.map(child => (
                                <tr key={child.id} className="hover:bg-card/50 transition-colors">
                                    <td data-label="Employee" className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-xs uppercase">
                                                {child.userName.charAt(0)}
                                            </div>
                                            <span className="font-semibold text-primary-text">{child.userName}</span>
                                        </div>
                                    </td>
                                    <td data-label="Child Name" className="px-6 py-4 text-primary-text font-medium">{child.childName}</td>
                                    <td data-label="DOB" className="px-6 py-4 text-muted">
                                        {format(new Date(child.dateOfBirth.replace(/-/g, '/')), 'dd MMM, yyyy')}
                                    </td>
                                    <td data-label="Status" className="px-6 py-4">
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-tighter ${
                                            child.verificationStatus === 'approved' ? 'bg-green-100 text-green-700' :
                                            child.verificationStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                                            'bg-yellow-100 text-yellow-700 animate-pulse'
                                        }`}>
                                            {child.verificationStatus}
                                        </span>
                                    </td>
                                    <td data-label="Certificate" className="px-6 py-4">
                                        {child.birthCertificateUrl ? (
                                            <a 
                                                href={child.birthCertificateUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold text-sm transition-colors group"
                                            >
                                                <Eye className="h-4 w-4 transition-transform group-hover:scale-110" />
                                                View
                                            </a>
                                        ) : (
                                            <span className="text-muted text-xs italic">No file</span>
                                        )}
                                    </td>
                                    <td data-label="Actions" className="px-6 py-4 text-right">
                                        {actioningId === child.id ? (
                                            <Loader2 className="h-5 w-5 animate-spin ml-auto text-emerald-500" />
                                        ) : (
                                            <div className="flex justify-end gap-2">
                                                {child.verificationStatus !== 'approved' && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="icon" 
                                                        className="bg-green-50 hover:bg-green-100 transition-colors"
                                                        onClick={() => handleVerify(child.id, 'approved')}
                                                        title="Approve"
                                                    >
                                                        <Check className="h-4 w-4 text-green-600" />
                                                    </Button>
                                                )}
                                                {child.verificationStatus !== 'rejected' && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="icon" 
                                                        className="bg-red-50 hover:bg-red-100 transition-colors"
                                                        onClick={() => handleVerify(child.id, 'rejected')}
                                                        title="Reject"
                                                    >
                                                        <X className="h-4 w-4 text-red-600" />
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FamilyVerification;
