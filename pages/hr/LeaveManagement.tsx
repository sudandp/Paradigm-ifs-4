import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { LeaveRequest, LeaveRequestStatus, ExtraWorkLog, UserHoliday, LeaveType } from '../../types';
import { Loader2, Check, X, Plus, XCircle, User, Calendar, FilterX, ChevronLeft, ChevronRight, Info, Pencil, Download, RotateCcw } from 'lucide-react';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import Select from '../../components/ui/Select';
import TableSkeleton from '../../components/skeletons/TableSkeleton';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import RejectClaimModal from '../../components/hr/RejectClaimModal';
import { isAdmin } from '../../utils/auth';
import LoadingScreen from '../../components/ui/LoadingScreen';
import EditLeaveTypeModal from '../../components/hr/EditLeaveTypeModal';
import { exportGenericReportToExcel, GenericReportColumn } from '../../utils/excelExport';

const StatusChip: React.FC<{ status: LeaveRequestStatus; approverName?: string | null; approverPhotoUrl?: string | null; approvalHistory?: any[] }> = ({ status, approverName, approverPhotoUrl, approvalHistory }) => {
    const styles: Record<LeaveRequestStatus, string> = {
        pending_manager_approval: 'bg-yellow-100 text-yellow-800',
        pending_hr_confirmation: 'bg-blue-100 text-blue-800',
        approved: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
        cancelled: 'bg-gray-100 text-gray-800',
        withdrawn: 'bg-gray-100 text-gray-600',
    };
    
    let displayText = status.replace(/_/g, ' ');
    const isPending = status === 'pending_manager_approval' || status === 'pending_hr_confirmation';
    
    let activeApproverName: string | null = null;
    let activeApproverPhotoUrl: string | null = null;
    
    // Show approver name for pending statuses
    if (isPending && approverName) {
        displayText = `Pending from ${approverName}`;
        activeApproverName = approverName;
        activeApproverPhotoUrl = approverPhotoUrl || null;
    }
    // Show who approved for approved status
    else if (status === 'approved' && approvalHistory && approvalHistory.length > 0) {
        const lastApprover = approvalHistory[approvalHistory.length - 1];
        const name = lastApprover.approverName || lastApprover.approver_name;
        if (name) {
            displayText = `Approved by ${name}`;
            activeApproverName = name;
            activeApproverPhotoUrl = lastApprover.approverPhotoUrl || null;
        }
    }
    // Show who rejected for rejected status
    else if (status === 'rejected' && approvalHistory && approvalHistory.length > 0) {
        const lastApprover = approvalHistory[approvalHistory.length - 1];
        const name = lastApprover.approverName || lastApprover.approver_name;
        if (name) {
            displayText = `Rejected by ${name}`;
            activeApproverName = name;
            activeApproverPhotoUrl = lastApprover.approverPhotoUrl || null;
        }
    }
    
    const showAvatar = !!activeApproverName;
    
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full capitalize ${styles[status]}`}>
            {showAvatar && activeApproverName && (
                activeApproverPhotoUrl ? (
                    <img src={activeApproverPhotoUrl} alt={activeApproverName} className="h-4 w-4 rounded-full object-cover shrink-0" />
                ) : (
                    <span className="h-4 w-4 rounded-full bg-white/50 flex items-center justify-center text-[9px] font-bold text-current shrink-0">
                        {activeApproverName.charAt(0).toUpperCase()}
                    </span>
                )
            )}
            <span>{displayText}</span>
        </span>
    );
};

const ClaimStatusChip: React.FC<{ status: ExtraWorkLog['status'] }> = ({ status }) => {
    const styles = {
        Pending: 'bg-yellow-100 text-yellow-800',
        Approved: 'bg-green-100 text-green-800',
        Rejected: 'bg-red-100 text-red-800',
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${styles[status]}`}>{status}</span>;
};


const LeaveManagement: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [claims, setClaims] = useState<ExtraWorkLog[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<LeaveRequestStatus | 'all' | 'claims' | 'holiday_selection'>('pending_manager_approval');
    const [allUsers, setAllUsers] = useState<{ id: string; name: string; photoUrl?: string }[]>([]);
    const [userHolidays, setUserHolidays] = useState<(UserHoliday & { userName?: string })[]>([]);
    const [poolHolidays, setPoolHolidays] = useState<any[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('all');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [actioningId, setActioningId] = useState<string | null>(null);
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [isCompOffFeatureEnabled, setIsCompOffFeatureEnabled] = useState(true);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [claimToReject, setClaimToReject] = useState<ExtraWorkLog | null>(null);
    const [requestToCancel, setRequestToCancel] = useState<LeaveRequest | null>(null);
    const [finalConfirmationRole, setFinalConfirmationRole] = useState<string>('hr');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [requestToEdit, setRequestToEdit] = useState<LeaveRequest | null>(null);

    useEffect(() => {
        const checkFeature = async () => {
            try {
                await api.checkCompOffTableExists();
                setIsCompOffFeatureEnabled(true);
            } catch (e) {
                setIsCompOffFeatureEnabled(false);
            }
        };
        const fetchSettings = async () => {
            try {
                const settings = await api.getApprovalWorkflowSettings();
                setFinalConfirmationRole(settings.finalConfirmationRole);
            } catch (e) {
                console.error('Failed to fetch approval settings:', e);
            }
        };
        const fetchUsers = async () => {
            try {
                const isFullAccess = ['admin', 'super_admin', 'hr', 'management'].includes(user?.role || '');
                let users;
                if (isFullAccess) {
                    users = await api.getUsers({ fetchAll: true });
                } else {
                    users = await api.getTeamMembers(user?.id || '');
                }
                setAllUsers(users.map(u => ({ id: u.id, name: u.name, photoUrl: u.photoUrl })).sort((a, b) => a.name.localeCompare(b.name)));
            } catch (e) {
                console.error('Failed to fetch users:', e);
            }
        };
        checkFeature();
        fetchSettings();
        fetchUsers();
    }, []);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const isApprover = ['admin', 'hr', 'operation_manager', 'site_manager', 'reporting_manager'].includes(user.role);
            
            // Determine filter based on role and current filter tab
            const leaveFilter: any = { 
                status: (filter !== 'all' && filter !== 'claims') ? filter : undefined,
                userId: selectedUserId !== 'all' ? selectedUserId : undefined,
                startDate: selectedDate || undefined,
                endDate: selectedDate || undefined,
                page: currentPage,
                pageSize: pageSize
            };

            // Admin / SuperAdmin / HR / Management see all requests.
            if (!['admin', 'super_admin', 'hr', 'management'].includes(user.role)) {
                // For managers, get their team's requests
                const teamMembers = await api.getTeamMembers(user.id);
                const teamIds = teamMembers.map(m => m.id);
                
                // If a specific user is selected, ensure they are in the team
                if (selectedUserId !== 'all') {
                    leaveFilter.userId = teamIds.includes(selectedUserId) ? selectedUserId : 'none';
                } else {
                    leaveFilter.userIds = teamIds;
                }
            }

            const claimsFilter = {
                status: isApprover ? 'Pending' : undefined,
                userId: selectedUserId !== 'all' ? selectedUserId : undefined,
                workDate: selectedDate || undefined,
                page: currentPage,
                pageSize: pageSize
            };

            const [leaveRes, claimsRes, allUserHolidaysRes, settingsRes] = await Promise.all([
                api.getLeaveRequests(leaveFilter),
                filter === 'claims' && isApprover ? api.getExtraWorkLogs(claimsFilter) : Promise.resolve({ data: [], total: 0 }),
                filter === 'holiday_selection' ? api.getAllUserHolidays() : Promise.resolve([]),
                filter === 'holiday_selection' ? api.getInitialAppData() : Promise.resolve(null)
            ]);

            setRequests(leaveRes.data);
            setClaims(claimsRes.data);
            setUserHolidays(allUserHolidaysRes);
            if (settingsRes) {
                setPoolHolidays(settingsRes.holidays.filter(h => h.isPoolHoliday));
            }
            setTotalItems(filter === 'claims' ? claimsRes.total : (filter === 'holiday_selection' ? allUserHolidaysRes.length : leaveRes.total));
        } catch (error) {
            setToast({ message: 'Failed to load approval data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [user, filter, currentPage, pageSize, selectedUserId, selectedDate]);

    useEffect(() => {
        setCurrentPage(1); // Reset to page 1 when filter changes
    }, [filter, selectedUserId, selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAction = async (id: string, action: 'approve' | 'reject' | 'confirm') => {
        if (!user) return;
        setActioningId(id);
        try {
            switch (action) {
                case 'approve':
                    await api.approveLeaveRequest(id, user.id);
                    break;
                case 'reject':
                    await api.rejectLeaveRequest(id, user.id);
                    break;
                case 'confirm':
                    await api.confirmLeaveByHR(id, user.id);
                    break;
            }
            setToast({ message: `Request actioned successfully.`, type: 'success' });
            fetchData();
        } catch (error) {
            setToast({ message: 'Failed to update request.', type: 'error' });
        } finally {
            setActioningId(null);
        }
    };

    const handleApproveClaim = async (claimId: string) => {
        if (!user) return;
        setActioningId(claimId);
        try {
            await api.approveExtraWorkClaim(claimId, user.id);
            setToast({ message: 'Claim approved successfully.', type: 'success' });
            fetchData();
        } catch (error) {
            setToast({ message: 'Failed to approve claim.', type: 'error' });
        } finally {
            setActioningId(null);
        }
    };

    const handleRejectClaim = async (reason: string) => {
        if (!user || !claimToReject) return;
        setActioningId(claimToReject.id);
        try {
            await api.rejectExtraWorkClaim(claimToReject.id, user.id, reason);
            setToast({ message: 'Claim rejected successfully.', type: 'success' });
            fetchData();
        } catch (error) {
            setToast({ message: 'Failed to reject claim.', type: 'error' });
        } finally {
            setActioningId(null);
            setIsRejectModalOpen(false);
            setClaimToReject(null);
        }
    };


    const handleUpdateLeaveType = async (newType: LeaveType) => {
        if (!user || !requestToEdit) return;
        setActioningId(requestToEdit.id);
        try {
            await api.updateLeaveType(requestToEdit.id, newType);
            setToast({ message: 'Leave type updated successfully.', type: 'success' });
            fetchData();
        } catch (error) {
            setToast({ message: 'Failed to update leave type.', type: 'error' });
        } finally {
            setActioningId(null);
            setIsEditModalOpen(false);
            setRequestToEdit(null);
        }
    };

    const handleCancelLeave = async (reason: string) => {
        if (!user || !requestToCancel) return;
        setActioningId(requestToCancel.id);
        try {
            await api.cancelApprovedLeave(requestToCancel.id, user.id, reason);
            setToast({ message: 'Leave cancelled successfully.', type: 'success' });
            fetchData();
        } catch (error) {
            setToast({ message: 'Failed to cancel leave.', type: 'error' });
        } finally {
            setActioningId(null);
            setIsCancelModalOpen(false);
            setRequestToCancel(null);
        }
    };

    const handleReconsiderLeave = async (request: LeaveRequest) => {
        if (!user) return;
        if (!window.confirm('Are you sure you want to reconsider this rejected request? It will be reset to Pending Manager Approval.')) return;
        
        setActioningId(request.id);
        try {
            await api.reconsiderLeaveRequest(request.id, user.id);
            setToast({ message: 'Request reset for reconsideration.', type: 'success' });
            fetchData();
        } catch (error) {
            setToast({ message: 'Failed to reconsider leave.', type: 'error' });
        } finally {
            setActioningId(null);
        }
    };

    const handleExportReport = async () => {
        if (requests.length === 0) {
            setToast({ message: 'No data available to export.', type: 'error' });
            return;
        }

        const columns: GenericReportColumn[] = [
            { header: 'Employee', key: 'userName', width: 25 },
            { header: 'Leave Type', key: 'leaveType', width: 15 },
            { header: 'Start Date', key: 'startDate', width: 15 },
            { header: 'End Date', key: 'endDate', width: 15 },
            { header: 'Option', key: 'dayOption', width: 10 },
            { header: 'Reason', key: 'reason', width: 40 },
            { header: 'Status', key: 'status', width: 20 },
            { header: 'Applied On', key: 'createdAt', width: 20 },
        ];

        const reportData = requests.map(req => ({
            ...req,
            startDate: format(new Date(req.startDate.replace(/-/g, '/')), 'dd MMM yyyy'),
            endDate: format(new Date(req.endDate.replace(/-/g, '/')), 'dd MMM yyyy'),
            createdAt: (req as any).createdAt ? format(new Date((req as any).createdAt), 'dd MMM yyyy HH:mm') : 'N/A',
            status: req.status.replace(/_/g, ' ').toUpperCase(),
            dayOption: req.dayOption || 'N/A'
        }));

        try {
            await exportGenericReportToExcel(
                reportData,
                columns,
                'Leave Requests Report',
                { 
                    startDate: selectedDate ? new Date(selectedDate) : new Date(new Date().getFullYear(), 0, 1), 
                    endDate: selectedDate ? new Date(selectedDate) : new Date() 
                },
                'Leave_Requests',
                undefined,
                user?.name
            );
            setToast({ message: 'Report exported successfully.', type: 'success' });
        } catch (error) {
            console.error('Export failed:', error);
            setToast({ message: 'Failed to export report.', type: 'error' });
        }
    };

    const filterTabs: Array<LeaveRequestStatus | 'all' | 'claims' | 'holiday_selection'> = ['pending_manager_approval', 'claims', 'pending_hr_confirmation', 'holiday_selection', 'approved', 'rejected', 'all']
        .filter(tab => {
            // Hide 'pending_hr_confirmation' tab if finalConfirmationRole is 'reporting_manager'
            if (tab === 'pending_hr_confirmation' && finalConfirmationRole === 'reporting_manager') {
                return false;
            }
            return true;
        }) as Array<LeaveRequestStatus | 'all' | 'claims'>;

    const ActionButtons: React.FC<{ request: LeaveRequest }> = ({ request }) => {
        if (!user) return null;

        // HR/Admin can edit leave type for any request that is not rejected/withdrawn/cancelled
        const isSuperAdmin = ['admin', 'super_admin'].includes(user.role);
        const isHRAdmin = ['admin', 'super_admin', 'hr'].includes(user.role);
        const isMyTurn = request.currentApproverId === user.id || isSuperAdmin;

        if (isSuperAdmin || isMyTurn) {
            return (
                <div className="flex gap-2">
                    {/* Approval Actions */}
                    {isMyTurn && (
                        <>
                            {request.status === 'pending_manager_approval' && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="icon" onClick={() => handleAction(request.id, 'approve')} disabled={actioningId === request.id} title="Approve" aria-label="Approve request"><Check className="h-4 w-4 text-green-600" /></Button>
                                    <Button size="sm" variant="icon" onClick={() => handleAction(request.id, 'reject')} disabled={actioningId === request.id} title="Reject" aria-label="Reject request"><X className="h-4 w-4 text-red-600" /></Button>
                                </div>
                            )}
                            {request.status === 'pending_hr_confirmation' && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="icon" onClick={() => handleAction(request.id, 'confirm')} disabled={actioningId === request.id} title="Confirm & Finalize" aria-label="Confirm and finalize request"><Check className="h-4 w-4 text-blue-600" /></Button>
                                    <Button size="sm" variant="icon" onClick={() => handleAction(request.id, 'reject')} disabled={actioningId === request.id} title="Reject" aria-label="Reject request"><X className="h-4 w-4 text-red-600" /></Button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Edit Action */}
                    {isHRAdmin && !['rejected', 'cancelled', 'withdrawn'].includes(request.status) && (
                        <Button 
                            size="sm" 
                            variant="icon" 
                            onClick={() => { setRequestToEdit(request); setIsEditModalOpen(true); }} 
                            disabled={actioningId === request.id}
                            title="Edit Leave Type"
                            aria-label="Edit leave type"
                        >
                            <Pencil className="h-4 w-4 text-primary" />
                        </Button>
                    )}

                    {/* Cancel Action */}
                    {request.status === 'approved' && (isHRAdmin || request.currentApproverId === user.id) && (
                        <Button 
                            size="sm" 
                            variant="icon" 
                            onClick={() => { setRequestToCancel(request); setIsCancelModalOpen(true); }} 
                            disabled={actioningId === request.id} 
                            title="Cancel Approved Leave" 
                            aria-label="Cancel approved leave"
                        >
                            <XCircle className="h-4 w-4 text-orange-600" />
                        </Button>
                    )}

                    {/* Reconsider Action (Rejected) */}
                    {request.status === 'rejected' && isSuperAdmin && (
                        <Button 
                            size="sm" 
                            variant="icon" 
                            onClick={() => handleReconsiderLeave(request)} 
                            disabled={actioningId === request.id} 
                            title="Reconsider Request" 
                            aria-label="Reconsider rejected request"
                        >
                            <RotateCcw className="h-4 w-4 text-primary" />
                        </Button>
                    )}
                </div>
            );
        }

        return null;
    };

    const formatTabName = (tab: string) => tab.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    if (isLoading) {
        return <LoadingScreen message="Loading approval data..." />;
    }

    return (
        <div className="p-4 border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <RejectClaimModal
                isOpen={isRejectModalOpen}
                onClose={() => { setIsRejectModalOpen(false); setClaimToReject(null); }}
                onConfirm={handleRejectClaim}
                isConfirming={!!actioningId}
            />
            
            <RejectClaimModal
                isOpen={isCancelModalOpen}
                onClose={() => { setIsCancelModalOpen(false); setRequestToCancel(null); }}
                onConfirm={handleCancelLeave}
                isConfirming={!!actioningId}
                title="Cancel Approved Leave"
                label="Reason for cancellation"
            />

            {requestToEdit && (
                <EditLeaveTypeModal
                    isOpen={isEditModalOpen}
                    onClose={() => { setIsEditModalOpen(false); setRequestToEdit(null); }}
                    onConfirm={handleUpdateLeaveType}
                    currentType={requestToEdit.leaveType}
                    isUpdating={actioningId === requestToEdit.id}
                />
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-primary-text">Leave Approval Inbox</h2>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={handleExportReport}
                        className="border border-border hover:bg-page transition-colors"
                        disabled={requests.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" /> Export Report
                    </Button>
                    {!isMobile && (
                        <Button
                            onClick={() => navigate('/hr/leave-management/grant-comp-off')}
                            disabled={!isCompOffFeatureEnabled}
                            title={!isCompOffFeatureEnabled ? "Feature disabled: 'comp_off_logs' table missing in database." : "Grant a compensatory off day"}
                            style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }}
                            className="border hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Grant Comp Off
                        </Button>
                    )}
                </div>
            </div>

            {isMobile && (
                <div className="mb-6">
                    <Button
                        onClick={() => navigate('/hr/leave-management/grant-comp-off')}
                        disabled={!isCompOffFeatureEnabled}
                        title={!isCompOffFeatureEnabled ? "Feature disabled: 'comp_off_logs' table missing in database." : "Grant a compensatory off day"}
                        style={{ backgroundColor: '#006B3F', color: '#FFFFFF', borderColor: '#005632' }}
                        className="w-full justify-center border hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Grant Comp Off
                    </Button>
                </div>
            )}

            {/* Filter Bar */}
            <div className="bg-card p-5 rounded-xl border border-border shadow-sm mb-8">
                <div className="flex flex-col lg:flex-row gap-5 items-end">
                    <div className="w-full lg:w-72">
                        <label htmlFor="filter-employee" className="block text-xs font-bold text-muted uppercase mb-2 ml-1 tracking-wider">Filter by Employee</label>
                        <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                            <select 
                                id="filter-employee"
                                name="filterEmployee"
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="w-full !pl-10 pr-10 h-11 rounded-xl bg-page border border-border text-primary-text focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none text-sm font-medium"
                            >
                                <option value="all">All Employees</option>
                                {allUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className="h-4 w-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="w-full lg:w-56">
                        <label htmlFor="filter-date" className="block text-xs font-bold text-muted uppercase mb-2 ml-1 tracking-wider">Filter by Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                            <input 
                                id="filter-date"
                                name="filterDate"
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full !pl-10 pr-4 h-11 rounded-xl bg-page border border-border text-primary-text focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 w-full lg:w-auto">
                        <Button 
                            variant="secondary" 
                            onClick={() => { setSelectedUserId('all'); setSelectedDate(''); }}
                            className="h-11 px-5 rounded-xl flex-1 lg:flex-none font-semibold border-border bg-page hover:bg-page/80"
                            disabled={selectedUserId === 'all' && !selectedDate}
                        >
                            <FilterX className="h-4 w-4 mr-2" /> Clear
                        </Button>
                        <Button 
                            onClick={fetchData}
                            className="h-11 px-6 rounded-xl flex-1 lg:flex-none font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            style={{ backgroundColor: '#10b981' }} // Emerald 500
                        >
                            <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : 'hidden'}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mb-6">
                <div className="w-full sm:w-auto md:border-b border-border">
                    <nav className="flex flex-col md:flex-row md:space-x-6 md:overflow-x-auto space-y-1 md:space-y-0" aria-label="Tabs">
                        {filterTabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setFilter(tab)}
                                className={`whitespace-nowrap font-medium text-sm rounded-lg md:rounded-none w-full md:w-auto text-left md:text-center px-4 py-3 md:px-1 md:py-3 md:bg-transparent md:border-b-2 transition-colors duration-200
                                ${filter === tab
                                        ? 'bg-emerald-50 text-emerald-700 md:border-emerald-500 md:bg-transparent'
                                        : 'text-muted hover:bg-emerald-50 hover:text-emerald-700 md:border-transparent md:hover:border-emerald-500'
                                    }`}
                            >
                                {formatTabName(tab)}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {filter === 'claims' ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full responsive-table">
                        <thead>
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Employee</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Date & Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Claim</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Reason</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border md:bg-card md:divide-y-0">
                            {claims.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 text-muted">No pending claims found.</td></tr>
                            ) : (
                                claims.map(claim => (
                                    <tr key={claim.id}>
                                        <td data-label="Employee" className="px-4 py-3 font-medium">
                                            <div className="flex items-center gap-3">
                                                {claim.userPhotoUrl ? (
                                                    <img src={claim.userPhotoUrl} alt={claim.userName} className="h-8 w-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                                                        {claim.userName.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="truncate max-w-[120px]" title={claim.userName}>{claim.userName}</span>
                                            </div>
                                        </td>
                                        <td data-label="Date & Type" className="px-4 py-3 text-muted">{format(new Date(claim.workDate), 'dd MMM, yyyy')} ({claim.workType})</td>
                                        <td data-label="Claim" className="px-4 py-3 text-muted">{claim.claimType}{claim.claimType === 'OT' ? ` (${claim.hoursWorked} hrs)` : ''}</td>
                                        <td data-label="Reason" className="px-4 py-3 text-muted whitespace-normal break-words max-w-sm">{claim.reason}</td>
                                        <td data-label="Status" className="px-4 py-3"><ClaimStatusChip status={claim.status} /></td>
                                        <td data-label="Actions" className="px-4 py-3">
                                            <div className="flex md:justify-start justify-end gap-2">
                                                <Button size="sm" variant="icon" onClick={() => handleApproveClaim(claim.id)} disabled={actioningId === claim.id} title="Approve Claim"><Check className="h-4 w-4 text-green-600" /></Button>
                                                <Button size="sm" variant="icon" onClick={() => { setClaimToReject(claim); setIsRejectModalOpen(true); }} disabled={actioningId === claim.id} title="Reject Claim"><X className="h-4 w-4 text-red-600" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            ) : filter === 'holiday_selection' ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full responsive-table">
                        <thead>
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Employee</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Selected Holidays</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border md:bg-card md:divide-y-0">
                            {allUsers.filter(u => selectedUserId === 'all' || u.id === selectedUserId).map(userItem => {
                                const selections = userHolidays.filter(h => h.userId === userItem.id);
                                const isComplete = selections.length >= 5;
                                const isPartial = selections.length > 0 && selections.length < 5;
                                
                                return (
                                    <tr key={userItem.id}>
                                        <td data-label="Employee" className="px-4 py-3 font-medium">
                                            <div className="flex items-center gap-3">
                                                {userItem.photoUrl ? (
                                                    <img src={userItem.photoUrl} alt={userItem.name} className="h-8 w-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                                                        {userItem.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="truncate max-w-[120px]" title={userItem.name}>{userItem.name}</span>
                                            </div>
                                        </td>
                                        <td data-label="Status" className="px-4 py-3">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                                isComplete ? 'bg-green-100 text-green-700' : 
                                                isPartial ? 'bg-amber-100 text-amber-700' : 
                                                'bg-gray-100 text-gray-500'
                                            }`}>
                                                {selections.length} / 5 Selected
                                            </span>
                                        </td>
                                        <td data-label="Selected Holidays" className="px-4 py-3 text-sm text-muted">
                                            {selections.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {selections.map((h, i) => (
                                                        <span key={i} className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] whitespace-nowrap">
                                                            {h.holidayName} ({format(new Date(h.holidayDate.replace(/-/g, '/')), 'dd MMM')})
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="italic text-gray-400">No holidays selected</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full responsive-table">
                        <thead>
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Employee</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Dates</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Raised On</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Reason</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border md:bg-card md:divide-y-0">
                            {requests.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 text-muted">No requests found for this filter.</td></tr>
                            ) : (
                                requests.map(req => (
                                    <tr key={req.id}>
                                        <td data-label="Employee" className="px-4 py-3 font-medium">
                                            <div className="flex items-center gap-3">
                                                {req.userPhotoUrl ? (
                                                    <img src={req.userPhotoUrl} alt={req.userName} className="h-8 w-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                                                        {req.userName.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="truncate max-w-[120px]" title={req.userName}>{req.userName}</span>
                                            </div>
                                        </td>
                                        <td data-label="Type" className="px-4 py-3 text-muted">{req.leaveType} {req.dayOption && `(${req.dayOption})`}</td>
                                        <td data-label="Dates" className="px-4 py-3 text-muted">{format(new Date(req.startDate.replace(/-/g, '/')), 'dd MMM')} - {format(new Date(req.endDate.replace(/-/g, '/')), 'dd MMM')}</td>
                                        <td data-label="Raised On" className="px-4 py-3 text-muted">{(req as any).createdAt ? format(new Date((req as any).createdAt), 'dd MMM, hh:mm a') : 'N/A'}</td>
                                        <td data-label="Reason" className="px-4 py-3 text-muted whitespace-normal break-words max-w-sm">{req.reason}</td>
                                        <td data-label="Status" className="px-4 py-3"><StatusChip status={req.status} approverName={req.currentApproverName} approverPhotoUrl={req.currentApproverPhotoUrl} approvalHistory={req.approvalHistory} /></td>
                                        <td data-label="Actions" className="px-4 py-3">
                                            <div className="flex md:justify-start justify-end">
                                                {actioningId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ActionButtons request={req} />}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && totalItems > 0 && (
                <div className="mt-8 flex flex-col md:flex-row justify-between items-center bg-card p-4 rounded-xl border border-border gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted">Show</span>
                        <select 
                            id="pageSize"
                            name="pageSize"
                            aria-label="Rows per page"
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-page border border-border text-primary-text text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-1.5 transition-all outline-none"
                        >
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span className="text-sm text-muted">per page</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-2 h-9 w-9 rounded-lg"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        
                        <div className="flex items-center gap-1 mx-2">
                            <span className="text-sm font-semibold text-primary-text">Page {currentPage}</span>
                            <span className="text-sm text-muted">of {Math.ceil(totalItems / pageSize)}</span>
                        </div>

                        <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalItems / pageSize), prev + 1))}
                            disabled={currentPage >= Math.ceil(totalItems / pageSize)}
                            className="p-2 h-9 w-9 rounded-lg"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="text-sm text-muted">
                        Total {totalItems} entries
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaveManagement;