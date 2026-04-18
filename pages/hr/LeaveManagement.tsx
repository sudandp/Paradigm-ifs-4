import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { LeaveRequest, LeaveRequestStatus, ExtraWorkLog, UserHoliday, LeaveType } from '../../types';
import { Loader2, Check, X, Plus, XCircle, User, Calendar, FilterX, ChevronLeft, ChevronRight, Info, Pencil, Download, RotateCcw, PenTool, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react';
import ManualAttendanceModal from '../../components/attendance/ManualAttendanceModal';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
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
import { exportLeaveReportToPDF, PDFReportColumn } from '../../utils/pdfExport';

const StatusChip: React.FC<{ status: LeaveRequestStatus; approverName?: string | null; approverPhotoUrl?: string | null; approvalHistory?: any[] }> = ({ status, approverName, approverPhotoUrl, approvalHistory }) => {
    const styles: Record<LeaveRequestStatus, string> = {
        pending_manager_approval: 'bg-yellow-100 text-yellow-800',
        pending_hr_confirmation: 'bg-blue-100 text-blue-800',
        approved: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
        cancelled: 'bg-gray-100 text-gray-800',
        withdrawn: 'bg-gray-100 text-gray-600',
        pending_admin_correction: 'bg-indigo-100 text-indigo-800',
        correction_made: 'bg-emerald-100 text-emerald-800',
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
    const [filter, setFilter] = useState<LeaveRequestStatus | 'all' | 'claims' | 'holiday_selection' | 'corrections'>('pending_manager_approval');
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
    const [correctionRequestId, setCorrectionRequestId] = useState<string | null>(null);
    const [userHolidays, setUserHolidays] = useState<(UserHoliday & { userName?: string })[]>([]);
    const [poolHolidays, setPoolHolidays] = useState<any[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [activePreset, setActivePreset] = useState<string>('This Month');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [actioningId, setActioningId] = useState<string | null>(null);
    const [teamIds, setTeamIds] = useState<string[]>([]);
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [isCompOffFeatureEnabled, setIsCompOffFeatureEnabled] = useState(true);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [claimToReject, setClaimToReject] = useState<ExtraWorkLog | null>(null);
    const [requestToCancel, setRequestToCancel] = useState<LeaveRequest | null>(null);
    const [finalConfirmationRole, setFinalConfirmationRole] = useState<string>('hr');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [requestToEdit, setRequestToEdit] = useState<LeaveRequest | null>(null);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [correctionView, setCorrectionView] = useState<'pending' | 'corrected' | 'logs'>('pending');
    const exportMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        handleApplyPreset('This Month');
    }, []);

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
                    setTeamIds([]); // No restriction for full access
                } else {
                    users = await api.getTeamMembers(user?.id || '');
                    setTeamIds(users.map((u: any) => u.id));
                }
                setAllUsers(users.sort((a: any, b: any) => a.name.localeCompare(b.name)));
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
                startDate: startDate || undefined,
                endDate: endDate || undefined,
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
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                page: currentPage,
                pageSize: pageSize
            };

            const [leaveRes, claimsRes, allUserHolidaysRes, settingsRes, auditLogsRes] = await Promise.all([
                filter === 'corrections' 
                    ? api.getLeaveRequests({ 
                        ...leaveFilter, 
                        status: correctionView === 'pending' ? 'pending_admin_correction' : 
                                correctionView === 'corrected' ? 'correction_made' : 
                                ['pending_admin_correction', 'correction_made']
                      })
                    : api.getLeaveRequests(leaveFilter),
                filter === 'claims' && isApprover ? api.getExtraWorkLogs(claimsFilter) : Promise.resolve({ data: [], total: 0 }),
                filter === 'holiday_selection' ? api.getAllUserHolidays() : Promise.resolve([]),
                filter === 'holiday_selection' ? api.getInitialAppData() : Promise.resolve(null),
                filter === 'corrections' ? api.getAttendanceAuditLogs(startDate || startOfMonth(new Date()).toISOString(), endDate || endOfMonth(new Date()).toISOString()) : Promise.resolve([])
            ]);

            let finalRequests = leaveRes.data;
            if (filter === 'corrections') {
                // For corrections, we use the API filtered status, so just ensure it's mapped correctly
                finalRequests = leaveRes.data;
            }

            // Map names for audit logs
            const userMap = new Map((allUsers.length > 0 ? allUsers : []).map(u => [u.id, u.name]));
            const mappedAuditLogs = auditLogsRes.map((log: any) => ({
                ...log,
                performerName: userMap.get(log.performedBy) || 'Unknown',
                targetName: userMap.get(log.targetUserId) || 'Unknown'
            }));

            setRequests(finalRequests);
            setClaims(claimsRes.data);
            setUserHolidays(allUserHolidaysRes);
            setAuditLogs(mappedAuditLogs);
            if (settingsRes) {
                setPoolHolidays(settingsRes.holidays.filter(h => h.isPoolHoliday));
            }
            setTotalItems(
                filter === 'claims' ? claimsRes.total : 
                filter === 'holiday_selection' ? allUserHolidaysRes.length : 
                leaveRes.total
            );
        } catch (error) {
            setToast({ message: 'Failed to load approval data.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [user, filter, currentPage, pageSize, selectedUserId, startDate, endDate, correctionView]);

    useEffect(() => {
        setCurrentPage(1); // Reset to page 1 when filter changes
    }, [filter, selectedUserId, startDate, endDate, correctionView]);

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
            
            // If it was a correction request, mark it as made so it moves out of pending
            if (requestToEdit.status === 'pending_admin_correction') {
                await api.markCorrectionAsMade(requestToEdit.id, user.id);
            }

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

    // Close export menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleApplyPreset = (preset: string) => {
        setActivePreset(preset);
        const today = new Date();
        let start: Date | null = null;
        let end: Date | null = new Date();

        switch (preset) {
            case 'Today':
                start = today;
                end = today;
                break;
            case 'Yesterday':
                start = subDays(today, 1);
                end = subDays(today, 1);
                break;
            case 'This Month':
                start = startOfMonth(today);
                end = endOfMonth(today);
                break;
            case 'Last Month':
                const lastMonth = subDays(startOfMonth(today), 1);
                start = startOfMonth(lastMonth);
                end = endOfMonth(lastMonth);
                break;
            case 'This Year':
                start = startOfYear(today);
                end = endOfYear(today);
                break;
            case 'All Time':
                start = null;
                end = null;
                break;
            default:
                return;
        }

        setStartDate(start ? format(start, 'yyyy-MM-dd') : '');
        setEndDate(end ? format(end, 'yyyy-MM-dd') : '');
    };

    const fetchAllForExport = async (statusFilter: LeaveRequestStatus | 'all'): Promise<LeaveRequest[]> => {
        if (!user) return [];
        const leaveFilter: any = {
            status: statusFilter !== 'all' ? statusFilter : undefined,
            userId: selectedUserId !== 'all' ? selectedUserId : undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            page: 1,
            pageSize: 10000, 
        };

        if (!['admin', 'super_admin', 'hr', 'management'].includes(user.role)) {
            const teamMembers = await api.getTeamMembers(user.id);
            const teamIds = teamMembers.map(m => m.id);
            if (selectedUserId !== 'all') {
                leaveFilter.userId = teamIds.includes(selectedUserId) ? selectedUserId : 'none';
            } else {
                leaveFilter.userIds = teamIds;
            }
        }

        const res = await api.getLeaveRequests(leaveFilter);
        return res.data;
    };

    const prepareReportData = (data: LeaveRequest[]) => {
        return data.map(req => ({
            ...req,
            startDate: format(new Date(req.startDate.replace(/-/g, '/')), 'dd MMM yyyy'),
            endDate: format(new Date(req.endDate.replace(/-/g, '/')), 'dd MMM yyyy'),
            createdAt: (req as any).createdAt ? format(new Date((req as any).createdAt), 'dd MMM yyyy HH:mm') : 'N/A',
            status: req.status.replace(/_/g, ' ').toUpperCase(),
            dayOption: req.dayOption || 'N/A'
        }));
    };

    const REPORT_COLUMNS_EXCEL: GenericReportColumn[] = [
        { header: 'Employee', key: 'userName', width: 25 },
        { header: 'Leave Type', key: 'leaveType', width: 15 },
        { header: 'Start Date', key: 'startDate', width: 15 },
        { header: 'End Date', key: 'endDate', width: 15 },
        { header: 'Option', key: 'dayOption', width: 10 },
        { header: 'Reason', key: 'reason', width: 40 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Applied On', key: 'createdAt', width: 20 },
    ];

    const REPORT_COLUMNS_PDF: PDFReportColumn[] = [
        { header: 'Employee', key: 'userName', width: 35 },
        { header: 'Leave Type', key: 'leaveType', width: 25 },
        { header: 'Start Date', key: 'startDate', width: 28 },
        { header: 'End Date', key: 'endDate', width: 28 },
        { header: 'Option', key: 'dayOption', width: 18 },
        { header: 'Reason', key: 'reason', width: 65 },
        { header: 'Status', key: 'status', width: 40 },
        { header: 'Applied On', key: 'createdAt', width: 30 },
    ];

    const getStatusLabel = (status: LeaveRequestStatus | 'all') => {
        const labels: Record<string, string> = {
            approved: 'Approved',
            rejected: 'Rejected',
            pending_manager_approval: 'Pending',
            pending_hr_confirmation: 'Pending HR',
            all: 'All',
        };
        return labels[status] || status.replace(/_/g, ' ');
    };

    const handleExportExcel = async (statusFilter: LeaveRequestStatus | 'all') => {
        setIsExporting(true);
        setIsExportMenuOpen(false);
        try {
            const data = await fetchAllForExport(statusFilter);
            if (data.length === 0) {
                setToast({ message: `No ${getStatusLabel(statusFilter).toLowerCase()} leave records found.`, type: 'error' });
                return;
            }
            const reportData = prepareReportData(data);
            await exportGenericReportToExcel(
                reportData,
                REPORT_COLUMNS_EXCEL,
                `Leave Requests — ${getStatusLabel(statusFilter)}`,
                {
                    startDate: startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1),
                    endDate: endDate ? new Date(endDate) : new Date(),
                },
                `Leave_${getStatusLabel(statusFilter).replace(/\s/g, '_')}_${getFileSuffix()}`,
                undefined,
                user?.name
            );
            setToast({ message: `${getStatusLabel(statusFilter)} leave report exported to Excel.`, type: 'success' });
        } catch (error) {
            console.error('Excel export failed:', error);
            setToast({ message: 'Failed to export Excel report.', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPDF = async (statusFilter: LeaveRequestStatus | 'all') => {
        setIsExporting(true);
        setIsExportMenuOpen(false);
        try {
            const data = await fetchAllForExport(statusFilter);
            if (data.length === 0) {
                setToast({ message: `No ${getStatusLabel(statusFilter).toLowerCase()} leave records found.`, type: 'error' });
                return;
            }
            const reportData = prepareReportData(data);
            exportLeaveReportToPDF({
                title: `Leave Requests — ${getStatusLabel(statusFilter)}`,
                subtitle: getReportSubtitle(),
                columns: REPORT_COLUMNS_PDF,
                data: reportData,
                fileName: `Leave_${getStatusLabel(statusFilter).replace(/\s/g, '_')}_Report_${getFileSuffix()}`,
                generatedBy: user?.name,
            });
            setToast({ message: `${getStatusLabel(statusFilter)} leave report exported to PDF.`, type: 'success' });
        } catch (error) {
            console.error('PDF export failed:', error);
            setToast({ message: 'Failed to export PDF report.', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    const getReportSubtitle = () => {
        if (!startDate && !endDate) return 'All Records';
        if (startDate && endDate) {
            if (startDate === endDate) return `Date: ${format(new Date(startDate), 'dd MMM yyyy')}`;
            return `Period: ${format(new Date(startDate), 'dd MMM yyyy')} - ${format(new Date(endDate), 'dd MMM yyyy')}`;
        }
        if (startDate) return `Since: ${format(new Date(startDate), 'dd MMM yyyy')}`;
        return `Until: ${format(new Date(endDate), 'dd MMM yyyy')}`;
    };

    const getFileSuffix = () => {
        if (!startDate && !endDate) return 'All_Time';
        if (startDate === endDate) return format(new Date(startDate), 'yyyyMMdd');
        return `${format(new Date(startDate.replace(/-/g, '/')), 'yyyyMMdd')}_to_${format(new Date(endDate.replace(/-/g, '/')), 'yyyyMMdd')}`;
    };

    const handleExportReport = async () => {
        await handleExportExcel(filter === 'claims' || filter === 'holiday_selection' ? 'all' : filter as LeaveRequestStatus | 'all');
    };

    type ExportStatusOption = { label: string; value: LeaveRequestStatus | 'all'; color: string; icon: string };
    const EXPORT_STATUS_OPTIONS: ExportStatusOption[] = [
        { label: 'Approved Leaves', value: 'approved', color: '#16a34a', icon: '✓' },
        { label: 'Rejected Leaves', value: 'rejected', color: '#dc2626', icon: '✗' },
        { label: 'Pending Leaves', value: 'pending_manager_approval', color: '#d97706', icon: '⏳' },
        { label: 'Corrections Applied', value: 'correction_made', color: '#10b981', icon: '🛠️' },
        { label: 'All Leaves', value: 'all', color: '#475569', icon: '📋' },
    ];

    const filterTabs: Array<LeaveRequestStatus | 'all' | 'claims' | 'holiday_selection' | 'corrections'> = ['pending_manager_approval', 'claims', 'pending_hr_confirmation', 'holiday_selection', 'corrections', 'approved', 'rejected', 'all']
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
        const isGlobalHR = ['admin', 'super_admin', 'hr'].includes(user.role);
        
        // A manager has "full control" if the request belongs to their team member
        const isTeamMember = teamIds.includes(request.userId);
        const isManagerWithControl = ['operation_manager', 'site_manager'].includes(user.role) && isTeamMember;
        
        const isAuthorizedToManage = isGlobalHR || isManagerWithControl;
        const isMyTurn = request.currentApproverId === user.id || isSuperAdmin || (isManagerWithControl && (request.status === 'pending_manager_approval' || request.status === 'pending_hr_confirmation'));

        if (isSuperAdmin || isAuthorizedToManage || isMyTurn) {
            return (
                <div className="flex gap-2">
                    {/* Approval Actions */}
                    {(isMyTurn || isAuthorizedToManage) && (
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
                    {isAuthorizedToManage && !['rejected', 'cancelled', 'withdrawn'].includes(request.status) && (
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
                    {request.status === 'approved' && isAuthorizedToManage && (
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

                    {/* Correct Action (Admin Correction Required) */}
                    {request.status === 'pending_admin_correction' && isAuthorizedToManage && (
                        <Button 
                            size="sm" 
                            variant="icon" 
                            onClick={() => { setCorrectionRequestId(request.id); setIsManualEntryModalOpen(true); }} 
                            disabled={actioningId === request.id} 
                            title="Manually Correct Attendance" 
                            aria-label="Perform manual correction"
                        >
                            <PenTool className="h-4 w-4 text-indigo-600" />
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

            <ManualAttendanceModal
                isOpen={isManualEntryModalOpen}
                onClose={() => { setIsManualEntryModalOpen(false); setCorrectionRequestId(null); }}
                onSuccess={() => { fetchData(); setIsManualEntryModalOpen(false); setCorrectionRequestId(null); }}
                users={allUsers}
                currentUserRole={user?.role || ''}
                currentUserId={user?.id || ''}
                correctionRequestId={correctionRequestId || undefined}
            />

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
                <div className="flex flex-col lg:flex-row gap-5 items-end flex-wrap lg:flex-nowrap">
                    <div className="w-full lg:w-64">
                        <label htmlFor="filter-employee" className="block text-xs font-bold text-muted uppercase mb-2 ml-1 tracking-wider">Filter by Employee</label>
                        <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                            <select 
                                id="filter-employee"
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
                                <ChevronDown className="h-4 w-4 text-muted" />
                            </div>
                        </div>
                    </div>

                    <div className="w-full lg:w-48">
                        <label className="block text-xs font-bold text-muted uppercase mb-2 ml-1 tracking-wider">Quick Filters</label>
                        <div className="relative">
                            <FilterX className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                            <select 
                                value={activePreset}
                                onChange={(e) => handleApplyPreset(e.target.value)}
                                className="w-full !pl-10 pr-10 h-11 rounded-xl bg-page border border-border text-primary-text focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none text-sm font-medium"
                            >
                                {['All Time', 'Today', 'Yesterday', 'This Month', 'Last Month', 'This Year'].map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ChevronDown className="h-4 w-4 text-muted" />
                            </div>
                        </div>
                    </div>

                    <div className="w-full lg:w-44">
                        <label htmlFor="filter-start-date" className="block text-xs font-bold text-muted uppercase mb-2 ml-1 tracking-wider">Start Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                            <input 
                                id="filter-start-date"
                                type="date"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setActivePreset('Custom'); }}
                                className="w-full !pl-10 pr-4 h-11 rounded-xl bg-page border border-border text-primary-text focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                            />
                        </div>
                    </div>

                    <div className="w-full lg:w-44">
                        <label htmlFor="filter-end-date" className="block text-xs font-bold text-muted uppercase mb-2 ml-1 tracking-wider">End Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                            <input 
                                id="filter-end-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setActivePreset('Custom'); }}
                                className="w-full !pl-10 pr-4 h-11 rounded-xl bg-page border border-border text-primary-text focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 w-full lg:w-auto">
                        <Button 
                            variant="secondary" 
                            onClick={() => { setSelectedUserId('all'); setStartDate(''); setEndDate(''); setActivePreset('All Time'); }}
                            className="h-11 px-5 rounded-xl flex-1 lg:flex-none font-semibold border-border bg-page hover:bg-page/80"
                            disabled={selectedUserId === 'all' && !startDate && !endDate}
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

                    {/* Export Dropdown */}
                    <div className="relative w-full lg:w-auto" ref={exportMenuRef}>
                        <Button
                            variant="secondary"
                            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                            className="h-11 w-full lg:w-auto px-5 rounded-xl font-semibold border border-border bg-page hover:bg-page/80 transition-all"
                            disabled={isExporting}
                        >
                            {isExporting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            Export Report
                            <ChevronDown className={`h-4 w-4 ml-2 transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                        </Button>

                        {isExportMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-card rounded-xl border border-border shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="px-4 py-3 border-b border-border bg-page/50">
                                    <p className="text-xs font-bold text-muted uppercase tracking-wider">Export Leave Report</p>
                                </div>
                                <div className="p-2">
                                    {EXPORT_STATUS_OPTIONS.map(opt => (
                                        <div key={opt.value} className="mb-1 last:mb-0">
                                            <div className="flex items-center gap-2 px-3 py-2">
                                                <span className="text-sm" style={{ color: opt.color }}>{opt.icon}</span>
                                                <span className="text-sm font-medium text-primary-text flex-1">{opt.label}</span>
                                                <button
                                                    onClick={() => handleExportPDF(opt.value)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                                                    title={`Export ${opt.label} as PDF`}
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                    PDF
                                                </button>
                                                <button
                                                    onClick={() => handleExportExcel(opt.value)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                                    title={`Export ${opt.label} as Excel`}
                                                >
                                                    <FileSpreadsheet className="h-3.5 w-3.5" />
                                                    Excel
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="px-4 py-2 border-t border-border bg-page/30">
                                    <p className="text-[10px] text-muted">Exports all matching records, not just the current page.</p>
                                </div>
                            </div>
                        )}
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

            {filter === 'corrections' ? (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex p-1 bg-page border border-border rounded-xl w-fit">
                            <button
                                onClick={() => setCorrectionView('pending')}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${correctionView === 'pending' ? 'bg-white text-emerald-700 shadow-sm' : 'text-muted hover:text-primary-text'}`}
                            >
                                Pending Corrections
                            </button>
                            <button
                                onClick={() => setCorrectionView('corrected')}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${correctionView === 'corrected' ? 'bg-white text-emerald-700 shadow-sm' : 'text-muted hover:text-primary-text'}`}
                            >
                                Corrected History
                            </button>
                            <button
                                onClick={() => setCorrectionView('logs')}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${correctionView === 'logs' ? 'bg-white text-emerald-700 shadow-sm' : 'text-muted hover:text-primary-text'}`}
                            >
                                Audit Logs
                            </button>
                        </div>
                        <div className="text-xs text-muted font-medium bg-page px-3 py-1.5 rounded-lg border border-border">
                            {correctionView === 'pending' ? `${requests.length} pending corrections` : 
                             correctionView === 'corrected' ? `${requests.length} corrected requests` : 
                             `${auditLogs.length} historical logs`}
                        </div>
                    </div>

                    {correctionView !== 'logs' ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full responsive-table">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Employee</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Type</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Dates</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Reason</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border md:bg-card md:divide-y-0">
                                    {requests.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-muted">No pending correction requests found.</td></tr>
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
                                                <td data-label="Reason" className="px-4 py-3 text-muted whitespace-normal break-words max-w-sm">{req.reason}</td>
                                                <td data-label="Status" className="px-4 py-3"><StatusChip status={req.status} approverName={req.currentApproverName} approverPhotoUrl={req.currentApproverPhotoUrl} approvalHistory={req.approvalHistory} /></td>
                                                <td data-label="Actions" className="px-4 py-3">
                                                    <div className="flex md:justify-start justify-end gap-2">
                                                        {actioningId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ActionButtons request={req} />}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full responsive-table">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Date & Time</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Performed By</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Target Employee</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border md:bg-card md:divide-y-0 text-sm">
                                    {auditLogs.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center py-10 text-muted">No correction logs found for this period.</td></tr>
                                    ) : (
                                        auditLogs.map((log) => (
                                            <tr key={log.id}>
                                                <td data-label="Date & Time" className="px-4 py-3 text-muted whitespace-nowrap">
                                                    {format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm')}
                                                </td>
                                                <td data-label="Performed By" className="px-4 py-3 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[10px] shrink-0 font-bold uppercase">
                                                            {log.performerName?.charAt(0) || 'A'}
                                                        </div>
                                                        <span className="truncate max-w-[120px]">{log.performerName || 'Admin'}</span>
                                                    </div>
                                                </td>
                                                <td data-label="Target Employee" className="px-4 py-3 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-[10px] shrink-0 font-bold uppercase">
                                                            {log.targetName?.charAt(0) || 'U'}
                                                        </div>
                                                        <span className="truncate max-w-[120px]">{log.targetName || 'User'}</span>
                                                    </div>
                                                </td>
                                                <td data-label="Details" className="px-4 py-3">
                                                    <div className="flex flex-col gap-1 text-[11px]">
                                                        {log.details?.date && (
                                                            <span className="font-semibold text-primary-text flex items-center gap-1">
                                                                <Calendar className="h-3 w-3 text-emerald-600" /> {log.details.date}
                                                            </span>
                                                        )}
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                            {log.details?.status && (
                                                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[9px] font-bold border border-gray-200 uppercase">
                                                                    {log.details.status}
                                                                </span>
                                                            )}
                                                            <div className="text-muted leading-tight">
                                                                {log.details?.checkIn && log.details?.checkIn !== 'N/A' && `In: ${log.details.checkIn} `}
                                                                {log.details?.checkOut && log.details?.checkOut !== 'N/A' && `Out: ${log.details.checkOut}`}
                                                            </div>
                                                        </div>
                                                        {log.details?.reason && (
                                                            <span className="italic text-muted line-clamp-1" title={log.details.reason}>
                                                                "{log.details.reason}"
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : filter === 'claims' ? (
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