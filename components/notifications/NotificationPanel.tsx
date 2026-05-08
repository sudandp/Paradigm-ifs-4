import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../store/notificationStore';
import { 
    Bell, 
    UserPlus, 
    AlertTriangle, 
    ClipboardCheck, 
    Shield, 
    Info, 
    Sun, 
    Check, 
    Inbox,
    Clock,
    X,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    UserX,
    Trash2,
    MessageSquare
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import type { Notification, NotificationType, AttendanceUnlockRequest, LeaveRequest, ExtraWorkLog, SiteFinanceRecord, SiteInvoiceRecord } from '../../types';
import Button from '../ui/Button';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { CheckCircle, XCircle, Calendar, FileText, MapPin, IndianRupee } from 'lucide-react';
import { ProfilePlaceholder } from '../ui/ProfilePlaceholder';
import { calculateAllEmployeeScores, type EmployeeScoreWithUser } from '../../services/employeeScoring';

const NotificationIcon: React.FC<{ type: NotificationType; size?: string }> = ({ type, size = "h-5 w-5" }) => {
    const iconMap: Record<NotificationType, React.ElementType> = {
        task_assigned: UserPlus,
        task_escalated: AlertTriangle,
        provisional_site_reminder: ClipboardCheck,
        security: Shield,
        info: Info,
        warning: AlertTriangle,
        greeting: Sun,
        approval_request: ClipboardCheck,
        emergency_broadcast: AlertTriangle,
        emergency: AlertTriangle,
        direct_ping: MessageSquare,
    };

    const bgMap: Record<NotificationType, string> = {
        task_assigned: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        task_escalated: 'bg-amber-50 text-amber-600 border-amber-100',
        provisional_site_reminder: 'bg-purple-50 text-purple-600 border-purple-100',
        security: 'bg-rose-50 text-rose-600 border-rose-100',
        info: 'bg-sky-50 text-sky-600 border-sky-100',
        warning: 'bg-amber-50 text-amber-600 border-amber-100',
        greeting: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        approval_request: 'bg-orange-50 text-orange-600 border-orange-100 shadow-[0_0_10px_rgba(249,115,22,0.1)]',
        emergency_broadcast: 'bg-red-50 text-red-600 border-red-100 shadow-[0_0_10px_rgba(239,68,68,0.2)]',
        emergency: 'bg-red-50 text-red-600 border-red-100 shadow-[0_0_10px_rgba(239,68,68,0.2)]',
        direct_ping: 'bg-blue-50 text-blue-600 border-blue-100',
    };

    const Icon = iconMap[type] || Bell;
    const styleClasses = bgMap[type] || 'bg-gray-50 text-gray-500 border-gray-100';
    
    return (
        <div className={`flex-shrink-0 p-2 rounded-xl border ${styleClasses} transition-colors group-hover:scale-110 duration-300`}>
            <Icon className={size} />
        </div>
    );
};

export const NotificationPanel: React.FC<{ isOpen: boolean; onClose: () => void; isMobile?: boolean }> = ({ isOpen, onClose, isMobile = false }) => {
    const { user } = useAuthStore();
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(20);
    const [unlockRequests, setUnlockRequests] = React.useState<AttendanceUnlockRequest[]>([]);
    const [leaveRequests, setLeaveRequests] = React.useState<LeaveRequest[]>([]);
    const [extraWorkClaims, setExtraWorkClaims] = React.useState<ExtraWorkLog[]>([]);
    const [financeRequests, setFinanceRequests] = React.useState<SiteFinanceRecord[]>([]);
    const [invoiceAlerts, setInvoiceAlerts] = React.useState<SiteInvoiceRecord[]>([]);
    
    const [expandedSections, setExpandedSections] = React.useState({
        unlocks: false,
        leaves: false,
        claims: false,
        finance: false,
        invoices: false,
        general: false,
        violations: false,
        inactive: false,
        team: false
    });
    const [expandedDetails, setExpandedDetails] = React.useState<Record<string, boolean>>({});

    const [inactiveEmployees, setInactiveEmployees] = React.useState<EmployeeScoreWithUser[]>([]);

    const isManagerRole = useMemo(() => {
        if (!user) return false;
        const role = (user.role || '').toLowerCase();
        const managerRoles = [
            'admin', 'super_admin', 'developer', 'management', 
            'hr', 'hr_ops', 'finance_manager', 'operation_manager', 
            'site_manager', 'director', 'business_developer'
        ];
        return managerRoles.includes(role) || role.includes('manager');
    }, [user]);

    const isHRRole = useMemo(() => {
        if (!user) return false;
        const role = (user.role || '').toLowerCase();
        return ['hr', 'hr_ops'].includes(role);
    }, [user]);

    const toggleSection = (section: 'unlocks' | 'leaves' | 'claims' | 'finance' | 'invoices' | 'general' | 'violations' | 'inactive' | 'team') => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const toggleDetails = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getSeverityStyles = (severity?: string) => {
        switch (severity) {
            case 'High': return {
                bg: isMobile ? 'bg-red-950/40' : 'bg-red-50',
                border: isMobile ? 'border-red-500/40' : 'border-red-100',
                text: isMobile ? 'text-red-400' : 'text-red-700',
                badge: isMobile ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
            };
            case 'Medium': return {
                bg: isMobile ? 'bg-orange-950/40' : 'bg-orange-50',
                border: isMobile ? 'border-orange-500/40' : 'border-orange-100',
                text: isMobile ? 'text-orange-400' : 'text-orange-700',
                badge: isMobile ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-700'
            };
            case 'Low': return {
                bg: isMobile ? 'bg-yellow-950/40' : 'bg-yellow-50',
                border: isMobile ? 'border-yellow-500/40' : 'border-yellow-100',
                text: isMobile ? 'text-yellow-400' : 'text-yellow-700',
                badge: isMobile ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-700'
            };
            default: return {
                bg: isMobile ? 'bg-gray-900/40' : 'bg-gray-50',
                border: isMobile ? 'border-gray-500/40' : 'border-gray-100',
                text: isMobile ? 'text-gray-400' : 'text-gray-700',
                badge: isMobile ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-700'
            };
        }
    };

    const extractEmployeeName = (message: string) => {
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}/i;
        const userMatch = message.match(/(?:URGENT:\s*)?.*?for user\s+(.*?)\s+on/i);
        if (userMatch) {
            const nameCandidate = userMatch[1].trim();
            if (!uuidRegex.test(nameCandidate)) return nameCandidate;
        }
        if (message.includes('has')) {
            const part = message.split('has')[0].trim();
            const nameCandidate = part.replace(/^URGENT:\s*/i, '').trim();
            const isViolationType = ['LESS WORKED AT SITE', 'INSUFFICIENT WORK HOURS', 'ATTENDANCE VIOLATION'].some(t => nameCandidate.toUpperCase().includes(t));
            if (nameCandidate.length < 50 && !uuidRegex.test(nameCandidate) && !isViolationType) return nameCandidate;
        }
        const words = message.replace(/^URGENT:\s*/i, '').split(' ');
        const firstWord = words[0];
        const blacklistedNames = ['FIELD', 'ATTENDANCE', 'VIOLATION', 'SYSTEM', 'SECURITY', 'URGENT', 'NEW', 'TASK', 'DEVICE', 'LESS', 'INSUFFICIENT'];
        if (uuidRegex.test(firstWord) || blacklistedNames.includes(firstWord.toUpperCase().replace(':', ''))) return 'Employee';
        return firstWord;
    };

    const cleanMessage = (message: string) => {
        const cleaned = message.replace(/^URGENT:\s*/i, '');
        if (cleaned.toLowerCase().includes('for user') && cleaned.toLowerCase().includes('escalated')) {
            const typePart = cleaned.split(/for user/i)[0].trim();
            return `${typePart} escalated to HR Operation & Admin`;
        }
        if (cleaned.toLowerCase().includes('for user') && cleaned.toLowerCase().includes('on')) {
            return cleaned.split(/for user/i)[0].trim();
        }
        if (cleaned.includes('has')) {
            const parts = cleaned.split('has');
            const namePart = parts[0].trim();
            if (namePart.length < 50) return `has ${parts.slice(1).join('has').trim()}`;
        }
        return cleaned;
    };

    const [isActionLoading, setIsActionLoading] = React.useState<string | null>(null);
    const { totalUnreadCount } = useNotificationStore();
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    const fetchPendingApprovals = React.useCallback(async () => {
        if (!user || user.role === 'field_staff' || user.role === 'unverified') return;
        try {
            const role = (user.role || '').toLowerCase();
            const isSuperAdmin = ['admin', 'super_admin', 'developer', 'management', 'director', 'operation_manager'].includes(role);
            const isHR = ['hr', 'hr_ops'].includes(role);

            console.log('[Approvals] Fetching for role:', role, '| isSuperAdmin:', isSuperAdmin, '| isHR:', isHR, '| userId:', user.id);

            let leavesPromise;
            if (isSuperAdmin) {
                leavesPromise = Promise.all([
                    api.getLeaveRequests({ status: 'pending_manager_approval' }),
                    api.getLeaveRequests({ status: 'pending_hr_confirmation' })
                ]).then(([res1, res2]) => ({ data: [...res1.data, ...res2.data] }));
            } else if (isHR) {
                leavesPromise = Promise.all([
                    api.getLeaveRequests({ status: 'pending_manager_approval', forApproverId: user.id }),
                    api.getLeaveRequests({ status: 'pending_hr_confirmation' })
                ]).then(([res1, res2]) => ({ data: [...res1.data, ...res2.data] }));
            } else {
                leavesPromise = api.getLeaveRequests({ 
                    status: 'pending_manager_approval',
                    forApproverId: user.id 
                });
            }

            const financeManagerId = user.id;

            const [unlocksResult, leavesResult, claimsResult, financeResult, invoicesResult] = await Promise.allSettled([
                api.getAttendanceUnlockRequests(isSuperAdmin ? undefined : user.id),
                leavesPromise,
                api.getExtraWorkLogs({ 
                    status: 'Pending', 
                    managerId: isSuperAdmin ? undefined : user.id 
                }),
                api.getPendingFinanceRecords(financeManagerId),
                api.getSiteInvoiceRecords(financeManagerId)
            ]);

            if (unlocksResult.status === 'fulfilled') setUnlockRequests(unlocksResult.value.filter(r => r.userId !== user.id));
            if (leavesResult.status === 'fulfilled') setLeaveRequests(leavesResult.value.data.filter((r: any) => r.userId !== user.id));
            if (claimsResult.status === 'fulfilled') setExtraWorkClaims(claimsResult.value.data.filter((c: any) => c.userId !== user.id));
            if (financeResult.status === 'fulfilled') setFinanceRequests(financeResult.value.filter(f => f.createdBy !== user.id));
            if (invoicesResult.status === 'fulfilled') {
                const today = new Date().toISOString().split('T')[0];
                setInvoiceAlerts((invoicesResult.value || []).filter(inv => 
                    !inv.invoiceSentDate && inv.invoiceSharingTentativeDate && inv.invoiceSharingTentativeDate <= today
                ));
            }

            if (isSuperAdmin || isHR) {
                const allScores = await calculateAllEmployeeScores();
                setInactiveEmployees(allScores.filter(e => e.scores.performanceScore === 0 && e.scores.attendanceScore === 0 && e.scores.responseScore === 0));
            } else {
                setInactiveEmployees([]);
            }
        } catch (err) {
            console.error('Error fetching pending approvals:', err);
        }
    }, [user]);

    const [isLateCheckDone, setIsLateCheckDone] = React.useState(false);

    React.useEffect(() => {
        if (isOpen && user && isManagerRole && !isLateCheckDone) {
            api.checkForLateReporting(user.id).then(() => {
                setIsLateCheckDone(true);
            });
        }
    }, [isOpen, user, isManagerRole, isLateCheckDone]);

    React.useEffect(() => {
        if (isOpen) {
            fetchPendingApprovals();
        }
    }, [isOpen, fetchPendingApprovals, totalUnreadCount]);

    const handleRespondToUnlock = async (requestId: string, status: 'approved' | 'rejected') => {
        setIsActionLoading(requestId);
        try {
            await api.respondToUnlockRequest(requestId, status);
            setUnlockRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (err) {
            console.error('Error responding to request:', err);
        } finally {
            setIsActionLoading(null);
            // Refresh counts to update badge
            useNotificationStore.getState().fetchNotifications();
        }
    };

    const handleRespondToLeave = async (requestId: string, action: 'approve' | 'reject' | 'confirm') => {
        setIsActionLoading(requestId);
        try {
            if (action === 'approve') await api.approveLeaveRequest(requestId, user!.id);
            else if (action === 'reject') await api.rejectLeaveRequest(requestId, user!.id);
            else if (action === 'confirm') await api.confirmLeaveByHR(requestId, user!.id);
            setLeaveRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (err) {
            console.error('Error responding to leave request:', err);
        } finally {
            setIsActionLoading(null);
            // Refresh counts to update badge
            useNotificationStore.getState().fetchNotifications();
        }
    };

    const handleRespondToClaim = async (claimId: string, action: 'approve' | 'reject') => {
        setIsActionLoading(claimId);
        try {
            if (action === 'approve') await api.approveExtraWorkClaim(claimId, user!.id);
            else if (action === 'reject') await api.rejectExtraWorkClaim(claimId, user!.id, 'Rejected from notifications');
            setExtraWorkClaims(prev => prev.filter(c => c.id !== claimId));
        } catch (err) {
            console.error('Error responding to claim:', err);
        } finally {
            setIsActionLoading(null);
            // Refresh counts to update badge
            useNotificationStore.getState().fetchNotifications();
        }
    };

    const handleRespondToFinance = async (recordId: string, action: 'approved' | 'rejected') => {
        setIsActionLoading(recordId);
        try {
            await api.respondToFinanceRecord(recordId, action);
            setFinanceRequests(prev => prev.filter(r => r.id !== recordId));
        } catch (err) {
            console.error('Error responding to finance record:', err);
        } finally {
            setIsActionLoading(null);
            // Refresh counts to update badge
            useNotificationStore.getState().fetchNotifications();
        }
    };

    const handleRemoveInactiveEmployee = async (emp: EmployeeScoreWithUser) => {
        if (!confirm(`Are you sure you want to remove ${emp.userName} from the system? This action cannot be undone.`)) return;
        setIsActionLoading(emp.userId);
        try {
            await api.deleteUser(emp.userId);
            setInactiveEmployees(prev => prev.filter(e => e.userId !== emp.userId));
        } catch (err) {
            console.error('Error removing user:', err);
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleDenyInactive = (emp: EmployeeScoreWithUser) => {
        setInactiveEmployees(prev => prev.filter(e => e.userId !== emp.userId));
    };

    React.useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentPage]);

    const handleNotificationClick = (notification: Notification) => {
        markAsRead(notification.id);
        if (notification.linkTo) navigate(notification.linkTo);
        if (window.innerWidth < 768) onClose();
    };

    const groupedNotifications = useMemo(() => {
        const groups: { title: string; items: Notification[] }[] = [
            { title: 'Today', items: [] },
            { title: 'Yesterday', items: [] },
            { title: 'Earlier', items: [] }
        ];

        const startIndex = (currentPage - 1) * pageSize;
        const filteredNotifs = notifications.filter(notif => {
            if (notif.isRead) return false;
            
            // For managers, we filter out items that have their own dedicated sections
            if (isManagerRole) {
                if (notif.type === 'security') return false;
                if (notif.message.includes('Field attendance violation')) return false;
                
                let meta = notif.metadata as any;
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch(e) { meta = {}; }
                }
                const isTeamEvent = meta?.isTeamActivity || meta?.is_team_activity || 
                                    (notif.type !== 'direct_ping' && notif.type !== 'approval_request' && (
                                    notif.message.includes('punched in') || 
                                    notif.message.includes('punched out') || 
                                    notif.message.includes('checked in') || 
                                    notif.message.includes('checked out') || 
                                    notif.message.toLowerCase().includes('break')));
                return !isTeamEvent;
            }
            
            // For non-managers, show all unread notifications in Recent Updates
            return true;
        });
        const pagedNotifs = filteredNotifs.slice(startIndex, startIndex + pageSize);

        pagedNotifs.forEach(notif => {
            const date = parseISO(notif.createdAt);
            if (isToday(date)) groups[0].items.push(notif);
            else if (isYesterday(date)) groups[1].items.push(notif);
            else groups[2].items.push(notif);
        });

        return groups.filter(g => g.items.length > 0);
    }, [notifications, currentPage, pageSize]);

    const securityViolations = useMemo(() => {
        if (isHRRole) return [];
        return notifications.filter(n => (!n.isRead) && (n.type === 'security' || n.message.includes('Field attendance violation')));
    }, [notifications, isHRRole]);

    const teamActivityNotifications = useMemo(() => {
        return notifications.filter(n => {
            if (n.isRead) return false;
            let meta = n.metadata as any;
            if (typeof meta === 'string') {
                try { meta = JSON.parse(meta); } catch(e) { meta = {}; }
            }
            return !n.isRead && (meta?.isTeamActivity || meta?.is_team_activity || 
                   n.message.includes('punched in') || 
                   n.message.includes('punched out') || 
                                n.message.includes('checked in') || 
                                n.message.includes('checked out') || 
                   n.message.toLowerCase().includes('break'));
        });
    }, [notifications]);

    const filteredNotifCount = notifications.filter(notif => {
        if (notif.isRead) return false;
        if (isManagerRole) {
            if (notif.type === 'security') return false;
            if (notif.message.includes('Field attendance violation')) return false;
            
            let meta = notif.metadata as any;
            if (typeof meta === 'string') {
                try { meta = JSON.parse(meta); } catch(e) { meta = {}; }
            }
            const isTeamEvent = meta?.isTeamActivity || meta?.is_team_activity || 
                                (notif.type !== 'direct_ping' && notif.type !== 'approval_request' && (
                                notif.message.includes('punched in') || 
                                notif.message.includes('punched out') || 
                                notif.message.includes('checked in') || 
                                notif.message.includes('checked out') || 
                                notif.message.toLowerCase().includes('break')));
            return !isTeamEvent;
        }
        return true;
    }).length;
    const totalPages = Math.ceil(filteredNotifCount / pageSize);

    const pendingCount = isManagerRole 
        ? (unlockRequests.length + leaveRequests.length + extraWorkClaims.length + financeRequests.length + inactiveEmployees.length + securityViolations.length + invoiceAlerts.length + teamActivityNotifications.length) 
        : (securityViolations.length + invoiceAlerts.length);

    if (!isOpen) return null;

    return (
        <div className={`h-full w-full flex flex-col animate-slide-in-right ${isMobile ? 'bg-[#0A3D2E] pt-5' : 'bg-white'}`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 pt-6 pb-5 border-b ${isMobile ? 'bg-[#0A3D2E] border-white/10' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center gap-3">
                    <h4 className={`font-bold text-xl ${isMobile ? 'text-white' : 'text-gray-900'}`}>Notifications</h4>
                    {unreadCount > 0 && (
                        <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                            isMobile 
                            ? 'bg-accent text-[#041b0f] shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                            : 'bg-accent/10 text-accent border border-accent/20'
                        }`}>
                            {unreadCount} New
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={() => markAllAsRead()}
                            className={`text-xs font-bold px-2 py-1 rounded-lg transition-colors ${isMobile ? 'text-accent hover:bg-white/5' : 'text-accent hover:bg-accent/5'}`}
                        >
                            Mark all read
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-xl transition-all ${isMobile ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-muted hover:text-primary-text hover:bg-page'}`}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div 
                ref={scrollContainerRef}
                className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? 'bg-[#0A3D2E]' : 'bg-white'}`}
            >
                {/* Pending Approvals Section */}
                {(pendingCount > 0) && (
                    <div className={`border-b ${isMobile ? 'border-white/10 bg-gradient-to-b from-white/5 to-transparent' : 'border-gray-100 bg-amber-50/30'}`}>
                        <div className="px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${isMobile ? 'bg-amber-500/20 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-amber-100 text-amber-700'}`}>
                                    <Clock className="w-3.5 h-3.5" />
                                </div>
                                <h5 className={`text-[11px] font-black uppercase tracking-widest ${isMobile ? 'text-white/90' : 'text-amber-900'}`}>
                                    {isManagerRole ? 'Pending Approvals' : 'Important Alerts'}
                                </h5>
                            </div>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isMobile ? 'bg-white/10 text-white border border-white/5' : 'bg-amber-100 text-amber-700'}`}>
                                {pendingCount}
                            </span>
                        </div>

                        <div className="px-4 pb-4 space-y-3">
                            {/* Security Violations (Violations found in Notification table) */}
                            {securityViolations.length > 0 && (
                                <div className={`group rounded-2xl overflow-hidden transition-all duration-300 border ${isMobile ? 'border-red-500/30 bg-red-500/5' : 'border-red-100 bg-red-50/10 hover:shadow-md'}`}>
                                    <button 
                                        onClick={() => toggleSection('violations')}
                                        className="w-full p-3 flex items-center justify-between bg-transparent"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl flex items-center justify-center ${isMobile ? 'bg-red-500/20 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-red-100 text-red-600'}`}>
                                                <Shield className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-xs font-bold ${isMobile ? 'text-white' : 'text-gray-900'}`}>Security Violations</p>
                                                <p className={`text-[10px] ${isMobile ? 'text-red-400' : 'text-red-500'}`}>Urgent Attention Need</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full text-[10px] font-bold ${isMobile ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-red-100 text-red-700'}`}>
                                                {securityViolations.length}
                                            </span>
                                            {expandedSections.violations ? <ChevronUp className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} /> : <ChevronDown className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} />}
                                        </div>
                                    </button>

                                    {expandedSections.violations && (
                                        <div className={`p-3 space-y-3 border-t ${isMobile ? 'border-red-500/10' : 'border-red-100'}`}>
                                            <div className="flex items-center justify-between px-1 py-1">
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                                                    <span className={`text-[10px] font-black uppercase tracking-wider ${isMobile ? 'text-red-400' : 'text-red-700'}`}>
                                                        Priority Warning: Attendance Violations
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        securityViolations.forEach(n => markAsRead(n.id));
                                                    }}
                                                    className={`text-[9px] font-bold px-2 py-1 rounded-lg transition-colors ${isMobile ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                                                >
                                                    Mark All Read
                                                </button>
                                            </div>
                                            {securityViolations.map(notif => {
                                                const sevStyles = getSeverityStyles(notif.severity);
                                                let metadata = notif.metadata || {};
                                                if (typeof metadata === 'string') {
                                                    try { metadata = JSON.parse(metadata); } catch(e) { metadata = {}; }
                                                }
                                                const isExpanded = expandedDetails[notif.id];
                                                
                                                return (
                                                    <div 
                                                        key={notif.id} 
                                                        onClick={() => handleNotificationClick(notif)}
                                                        className={`rounded-xl overflow-hidden border cursor-pointer transition-all hover:scale-[1.01] ${sevStyles.bg} ${sevStyles.border} shadow-sm group/card`}
                                                    >
                                                        <div className="p-3">
                                                            <div className="flex items-start gap-3">
                                                                <div className={`p-2 rounded-lg ${sevStyles.badge}`}>
                                                                    <Shield className="w-4 h-4" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className={`text-[10px] font-black uppercase tracking-tight ${sevStyles.text}`}>
                                                                            {metadata.violationType?.replace(/_/g, ' ') || 'Attendance Violation'}
                                                                        </span>
                                                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${sevStyles.badge}`}>
                                                                            {notif.severity || 'Medium'}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <div className={`overflow-hidden rounded-lg flex-shrink-0 w-8 h-8 ${isMobile ? 'bg-white/10' : 'bg-gray-100'}`}>
                                                                            <ProfilePlaceholder 
                                                                                className="w-8 h-8"
                                                                                photoUrl={metadata.employeePhoto}
                                                                                seed={metadata.employeeId}
                                                                            />
                                                                        </div>
                                                                        <p className={`text-xs font-bold truncate ${isMobile ? 'text-white' : 'text-gray-900'}`}>
                                                                            {metadata.employeeName && !/[0-9a-f]{8}-[0-9a-f]{4}/i.test(metadata.employeeName) ? metadata.employeeName : extractEmployeeName(notif.message)}
                                                                        </p>
                                                                    </div>
                                                                    
                                                                    <p className={`text-[11px] leading-relaxed mb-3 ${isMobile ? 'text-white/70' : 'text-gray-600'}`}>
                                                                        {cleanMessage(notif.message)}
                                                                    </p>
                                                                    
                                                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                                                        <div className={`rounded-lg p-2 ${isMobile ? 'bg-black/20' : 'bg-white/50 border border-white/20'}`}>
                                                                            <p className={`text-[8px] uppercase font-bold mb-0.5 ${isMobile ? 'text-white/40' : 'text-gray-400'}`}>Violation Date</p>
                                                                            <p className={`text-[10px] font-bold ${isMobile ? 'text-white/80' : 'text-gray-700'}`}>
                                                                                {metadata.date ? format(parseISO(metadata.date), 'dd MMM yyyy') : format(parseISO(notif.createdAt), 'dd MMM yyyy')}
                                                                            </p>
                                                                        </div>
                                                                        <div className={`rounded-lg p-2 ${isMobile ? 'bg-black/20' : 'bg-white/50 border border-white/20'}`}>
                                                                            <p className={`text-[8px] uppercase font-bold mb-0.5 ${isMobile ? 'text-white/40' : 'text-gray-400'}`}>Escalated To</p>
                                                                            <p className={`text-[10px] font-bold ${isMobile ? 'text-white/80' : 'text-gray-700'}`}>
                                                                                HR Operation & Admin
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <Button 
                                                                            size="sm" 
                                                                            variant="outline"
                                                                            className={`flex-1 h-7 text-[9px] uppercase font-bold py-0 ${isMobile ? 'border-white/20 text-white hover:bg-white/5' : 'border-gray-200 text-gray-600'}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                markAsRead(notif.id);
                                                                            }}
                                                                        >
                                                                            <Check className="w-3 h-3 mr-1" /> Mark Resolved
                                                                        </Button>
                                                                        {metadata.details && (
                                                                            <button 
                                                                                onClick={(e) => toggleDetails(notif.id, e)}
                                                                                className={`text-[9px] font-bold h-7 px-2 flex items-center gap-1 transition-colors ${sevStyles.text} hover:underline`}
                                                                            >
                                                                                {isExpanded ? 'Hide Details' : 'View Details'}
                                                                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {isExpanded && metadata.details && (
                                                                        <div className="mb-3">
                                                                            <div className={`p-2 rounded-lg text-[9px] font-mono whitespace-pre overflow-x-auto ${isMobile ? 'bg-black/40 text-green-400/80' : 'bg-gray-900 text-green-400'}`}>
                                                                                {JSON.stringify(metadata.details, null, 2)}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    <div className="flex items-center justify-between mt-1 pt-2 border-t border-white/5">
                                                                        <span className={`text-[9px] flex items-center gap-1 ${isMobile ? 'text-white/40' : 'text-gray-400'}`}>
                                                                            <Clock className="h-2.5 w-2.5" />
                                                                            {formatDistanceToNow(parseISO(notif.createdAt), { addSuffix: true })}
                                                                        </span>
                                                                        <div className="flex items-center gap-2">
                                                                            {notif.isRead && <span className="text-[8px] font-bold text-green-500 flex items-center gap-0.5"><Check className="w-2 h-2" /> Resolved</span>}
                                                                            {!notif.isRead && <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)] ${
                                                                                notif.severity === 'High' ? 'bg-red-500 animate-pulse' : 
                                                                                notif.severity === 'Medium' ? 'bg-orange-500' : 'bg-yellow-500'
                                                                            }`} />}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Team Activity Section */}
                            {teamActivityNotifications.length > 0 && (
                                <div className={`group rounded-2xl overflow-hidden transition-all duration-300 border ${isMobile ? 'border-sky-500/30 bg-sky-500/5' : 'border-sky-100 bg-sky-50/10 hover:shadow-md'}`}>
                                    <button 
                                        onClick={() => toggleSection('team')}
                                        className="w-full p-3 flex items-center justify-between bg-transparent"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl flex items-center justify-center ${isMobile ? 'bg-sky-500/20 text-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.2)]' : 'bg-sky-100 text-sky-600'}`}>
                                                <UserPlus className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-xs font-bold ${isMobile ? 'text-white' : 'text-gray-900'}`}>Team Activity</p>
                                                <p className={`text-[10px] ${isMobile ? 'text-sky-400' : 'text-sky-500'}`}>Track member status</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full text-[10px] font-bold ${isMobile ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.4)]' : 'bg-sky-100 text-sky-700'}`}>
                                                {teamActivityNotifications.length}
                                            </span>
                                            {expandedSections.team ? <ChevronUp className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} /> : <ChevronDown className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} />}
                                        </div>
                                    </button>

                                    {expandedSections.team && (
                                        <div className={`p-3 space-y-2 border-t ${isMobile ? 'border-sky-500/10' : 'border-sky-100'}`}>
                                            {teamActivityNotifications.map(notif => {
                                                let metadata = notif.metadata as any || {};
                                                if (typeof metadata === 'string') {
                                                    try { metadata = JSON.parse(metadata); } catch(e) { metadata = {}; }
                                                }
                                                const isLateReport = metadata.isLateReport;
                                                
                                                return (
                                                    <div 
                                                        key={notif.id} 
                                                        onClick={() => handleNotificationClick(notif)}
                                                        className={`rounded-xl p-3 border cursor-pointer transition-all hover:scale-[1.01] ${
                                                            isLateReport 
                                                            ? isMobile ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'
                                                            : isMobile ? 'bg-white/5 border-white/5' : 'bg-white border-sky-100'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <ProfilePlaceholder 
                                                                className="w-8 h-8 rounded-lg flex-shrink-0"
                                                                photoUrl={metadata.employeePhoto}
                                                                seed={metadata.employeeId}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between mb-0.5">
                                                                    <p className={`text-xs font-bold truncate ${isMobile ? 'text-white' : 'text-gray-900'}`}>
                                                                        {metadata.employeeName || 'Team Member'}
                                                                    </p>
                                                                    <span className={`text-[9px] ${isMobile ? 'text-white/40' : 'text-gray-400'}`}>
                                                                        {formatDistanceToNow(parseISO(notif.createdAt), { addSuffix: true })}
                                                                    </span>
                                                                </div>
                                                                <p className={`text-[11px] ${
                                                                    isLateReport 
                                                                    ? isMobile ? 'text-red-400 font-bold' : 'text-red-600 font-bold'
                                                                    : isMobile ? 'text-white/70' : 'text-gray-600'
                                                                }`}>
                                                                    {notif.message}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Attendance Unlock Requests */}
                            {unlockRequests.length > 0 && (
                                <div className={`group rounded-2xl overflow-hidden transition-all duration-300 border ${isMobile ? 'border-white/10 bg-transparent' : 'border-emerald-100 bg-white hover:shadow-md'}`}>
                                    <button 
                                        onClick={() => toggleSection('unlocks')}
                                        className="w-full p-3 flex items-center justify-between bg-transparent"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl flex items-center justify-center ${isMobile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-xs font-bold ${isMobile ? 'text-white' : 'text-gray-900'}`}>Punch In Requests</p>
                                                <p className={`text-[10px] ${isMobile ? 'text-white/50' : 'text-gray-500'}`}>Approvals needed</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full text-[10px] font-bold ${isMobile ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {unlockRequests.length}
                                            </span>
                                            {expandedSections.unlocks ? <ChevronUp className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} /> : <ChevronDown className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} />}
                                        </div>
                                    </button>
                                    
                                    {expandedSections.unlocks && (
                                        <div className={`p-3 space-y-3 border-t ${isMobile ? 'border-white/5' : 'border-emerald-100/50'}`}>
                                            <div className="flex items-center gap-2 px-1 py-1">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                                <span className={`text-[10px] font-black uppercase tracking-wider ${isMobile ? 'text-amber-400' : 'text-amber-700'}`}>
                                                    Attention: Approval Required
                                                </span>
                                            </div>
                                            {unlockRequests.map(req => (
                                                <div key={req.id} className={`rounded-xl p-3 border ${isMobile ? 'bg-black/20 border-white/5' : 'bg-emerald-50/30 border-emerald-100'}`}>
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isMobile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                                                            <UserPlus className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <p className={`text-xs font-bold truncate ${isMobile ? 'text-white' : 'text-gray-900'}`}>{req.userName}</p>
                                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20`}>Unlock</span>
                                                            </div>
                                                            <p className={`text-[9px] ${isMobile ? 'text-white/50' : 'text-emerald-700/60'}`}>{formatDistanceToNow(parseISO(req.requestedAt), { addSuffix: true })}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`rounded-lg p-2.5 border mb-3 ${isMobile ? 'bg-black/20 border-white/5' : 'bg-white border-emerald-100/50'}`}>
                                                        <p className={`text-[11px] italic leading-relaxed ${isMobile ? 'text-white/70' : 'text-gray-700'}`}>"{req.reason}"</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            disabled={isActionLoading === req.id}
                                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 border-none text-[9px] uppercase font-bold h-8 shadow-lg shadow-emerald-900/20"
                                                            onClick={() => handleRespondToUnlock(req.id, 'approved')}
                                                        >
                                                            <CheckCircle className="w-3 h-3 mr-1" /> Approve
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline"
                                                            disabled={isActionLoading === req.id}
                                                            className={`flex-1 text-[9px] uppercase font-bold h-8 ${isMobile ? 'border-white/10 text-white hover:bg-white/5' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                                                            onClick={() => handleRespondToUnlock(req.id, 'rejected')}
                                                        >
                                                            <XCircle className="w-3 h-3 mr-1" /> Reject
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Leave Requests */}
                            {leaveRequests.length > 0 && (
                                <div className={`group rounded-2xl overflow-hidden transition-all duration-300 border ${isMobile ? 'border-white/10 bg-transparent' : 'border-orange-100 bg-white hover:shadow-md'}`}>
                                    <button 
                                        onClick={() => toggleSection('leaves')}
                                        className="w-full p-3 flex items-center justify-between bg-transparent"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl flex items-center justify-center ${isMobile ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-xs font-bold ${isMobile ? 'text-white' : 'text-gray-900'}`}>Leave Requests</p>
                                                <p className={`text-[10px] ${isMobile ? 'text-white/50' : 'text-gray-500'}`}>Approvals needed</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full text-[10px] font-bold ${isMobile ? 'bg-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 'bg-orange-100 text-orange-700'}`}>
                                                {leaveRequests.length}
                                            </span>
                                            {expandedSections.leaves ? <ChevronUp className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} /> : <ChevronDown className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} />}
                                        </div>
                                    </button>
                                    
                                    {expandedSections.leaves && (
                                        <div className={`p-3 space-y-3 border-t ${isMobile ? 'border-white/5' : 'border-orange-100/50'}`}>
                                            <div className="flex items-center gap-2 px-1 py-1">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                                <span className={`text-[10px] font-black uppercase tracking-wider ${isMobile ? 'text-amber-400' : 'text-amber-700'}`}>
                                                    Attention: Leave Verification
                                                </span>
                                            </div>
                                            {leaveRequests.map(req => (
                                                <div key={req.id} className={`rounded-xl p-3 border ${isMobile ? 'bg-black/20 border-white/5' : 'bg-orange-50/30 border-orange-100'}`}>
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center font-bold text-orange-700 overflow-hidden relative text-xs">
                                                            {req.userName.charAt(0)}
                                                            <Calendar className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <p className={`text-xs font-bold truncate ${isMobile ? 'text-white' : 'text-gray-900'}`}>{req.userName}</p>
                                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20`}>{req.leaveType}</span>
                                                            </div>
                                                            <p className={`text-[9px] ${isMobile ? 'text-white/50' : 'text-orange-700/60'}`}>
                                                                {format(parseISO(req.startDate), 'dd MMM')} - {format(parseISO(req.endDate), 'dd MMM')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className={`rounded-lg p-2.5 border mb-3 ${isMobile ? 'bg-black/20 border-white/5' : 'bg-white border-orange-100/50'}`}>
                                                        <p className={`text-[11px] italic leading-relaxed ${isMobile ? 'text-white/70' : 'text-gray-700'}`}>"{req.reason}"</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            disabled={isActionLoading === req.id}
                                                            className="flex-1 bg-orange-600 hover:bg-orange-700 border-none text-[9px] uppercase font-bold h-8 shadow-lg shadow-orange-900/20"
                                                            onClick={() => handleRespondToLeave(req.id, req.status === 'pending_hr_confirmation' ? 'confirm' : 'approve')}
                                                        >
                                                            <CheckCircle className="w-3 h-3 mr-1" /> {req.status === 'pending_hr_confirmation' ? 'Confirm' : 'Approve'}
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline"
                                                            disabled={isActionLoading === req.id}
                                                            className={`flex-1 text-[9px] uppercase font-bold h-8 ${isMobile ? 'border-white/10 text-white hover:bg-white/5' : 'border-orange-200 text-orange-700 hover:bg-orange-50'}`}
                                                            onClick={() => handleRespondToLeave(req.id, 'reject')}
                                                        >
                                                            <XCircle className="w-3 h-3 mr-1" /> Reject
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Extra Work Claims */}
                            {extraWorkClaims.length > 0 && (
                                <div className={`group rounded-2xl overflow-hidden transition-all duration-300 border ${isMobile ? 'border-white/10 bg-transparent' : 'border-blue-100 bg-white hover:shadow-md'}`}>
                                    <button 
                                        onClick={() => toggleSection('claims')}
                                        className="w-full p-3 flex items-center justify-between bg-transparent"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl flex items-center justify-center ${isMobile ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-xs font-bold ${isMobile ? 'text-white' : 'text-gray-900'}`}>Extra Work Claims</p>
                                                <p className={`text-[10px] ${isMobile ? 'text-white/50' : 'text-gray-500'}`}>Review claims</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full text-[10px] font-bold ${isMobile ? 'bg-blue-500 text-black shadow-[0_0_10px_rgba(59,130,246,0.4)]' : 'bg-blue-100 text-blue-700'}`}>
                                                {extraWorkClaims.length}
                                            </span>
                                            {expandedSections.claims ? <ChevronUp className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} /> : <ChevronDown className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} />}
                                        </div>
                                    </button>
                                    
                                    {expandedSections.claims && (
                                        <div className={`p-3 space-y-3 border-t ${isMobile ? 'border-white/5' : 'border-blue-100/50'}`}>
                                            <div className="flex items-center gap-2 px-1 py-1">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                                <span className={`text-[10px] font-black uppercase tracking-wider ${isMobile ? 'text-amber-400' : 'text-amber-700'}`}>
                                                    Attention: Extra Work Review
                                                </span>
                                            </div>
                                            {extraWorkClaims.map(claim => (
                                                <div key={claim.id} className={`rounded-xl p-3 border ${isMobile ? 'bg-black/20 border-white/5' : 'bg-blue-50/30 border-blue-100'}`}>
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center font-bold text-blue-700 overflow-hidden relative text-xs">
                                                            {claim.userName.charAt(0)}
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <p className={`text-xs font-bold truncate ${isMobile ? 'text-white' : 'text-gray-900'}`}>{claim.userName}</p>
                                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20`}>{claim.claimType}</span>
                                                            </div>
                                                            <p className={`text-[9px] ${isMobile ? 'text-white/50' : 'text-blue-700/60'}`}>{format(parseISO(claim.workDate), 'dd MMM yyyy')}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`rounded-lg p-2.5 border mb-3 ${isMobile ? 'bg-black/20 border-white/5' : 'bg-white border-blue-100/50'}`}>
                                                        <p className={`text-[11px] italic leading-relaxed ${isMobile ? 'text-white/70' : 'text-gray-700'}`}>"{claim.reason}"</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            disabled={isActionLoading === claim.id}
                                                            className="flex-1 bg-blue-600 hover:bg-blue-700 border-none text-[9px] uppercase font-bold h-8 shadow-lg shadow-blue-900/20"
                                                            onClick={() => handleRespondToClaim(claim.id, 'approve')}
                                                        >
                                                            <CheckCircle className="w-3 h-3 mr-1" /> Approve
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline"
                                                            disabled={isActionLoading === claim.id}
                                                            className={`flex-1 text-[9px] uppercase font-bold h-8 ${isMobile ? 'border-white/10 text-white hover:bg-white/5' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                                                            onClick={() => handleRespondToClaim(claim.id, 'reject')}
                                                        >
                                                            <XCircle className="w-3 h-3 mr-1" /> Reject
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Invoice Alerts */}
                            {invoiceAlerts.length > 0 && (
                                <div className={`group rounded-2xl overflow-hidden transition-all duration-300 border ${isMobile ? 'border-white/10 bg-transparent' : 'border-amber-100 bg-white hover:shadow-md'}`}>
                                    <button 
                                        onClick={() => toggleSection('invoices')}
                                        className="w-full p-3 flex items-center justify-between bg-transparent"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl flex items-center justify-center ${isMobile ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                                                <IndianRupee className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-xs font-bold ${isMobile ? 'text-white' : 'text-gray-900'}`}>Invoice Alerts</p>
                                                <p className={`text-[10px] ${isMobile ? 'text-white/50' : 'text-gray-500'}`}>Due for sharing</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full text-[10px] font-bold ${isMobile ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'bg-amber-100 text-amber-700'}`}>
                                                {invoiceAlerts.length}
                                            </span>
                                            {expandedSections.invoices ? <ChevronUp className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} /> : <ChevronDown className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} />}
                                        </div>
                                    </button>
                                    
                                    {expandedSections.invoices && (
                                        <div className={`p-3 space-y-3 border-t ${isMobile ? 'border-white/5' : 'border-amber-100/50'}`}>
                                            <div className="flex items-center gap-2 px-1 py-1">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                                <span className={`text-[10px] font-black uppercase tracking-wider ${isMobile ? 'text-amber-400' : 'text-amber-700'}`}>
                                                    Warning: Invoices Due for Sharing
                                                </span>
                                            </div>
                                            {invoiceAlerts.map(inv => (
                                                <div key={inv.id} className={`rounded-xl p-3 border ${isMobile ? 'bg-black/20 border-white/5' : 'bg-amber-50/30 border-amber-100'}`}>
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center font-bold text-amber-700 overflow-hidden relative text-xs">
                                                            {inv.siteName.charAt(0)}
                                                            <IndianRupee className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <p className={`text-xs font-bold truncate ${isMobile ? 'text-white' : 'text-gray-900'}`}>{inv.siteName}</p>
                                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20`}>Due</span>
                                                            </div>
                                                            <p className={`text-[9px] ${isMobile ? 'text-white/50' : 'text-amber-700/60'}`}>
                                                                Tentative: {inv.invoiceSharingTentativeDate ? format(parseISO(inv.invoiceSharingTentativeDate), 'dd MMM yyyy') : 'N/A'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button 
                                                        size="sm" 
                                                        className="w-full bg-amber-600 hover:bg-amber-700 border-none text-[9px] uppercase font-bold h-8 shadow-lg shadow-amber-900/20"
                                                        onClick={() => {
                                                            navigate('/finance?tab=attendance');
                                                            onClose();
                                                        }}
                                                    >
                                                        View Tracker
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Finance Requests */}
                            {financeRequests.length > 0 && (
                                <div className={`group rounded-2xl overflow-hidden transition-all duration-300 border ${isMobile ? 'border-white/10 bg-transparent' : 'border-rose-100 bg-white hover:shadow-md'}`}>
                                    <button 
                                        onClick={() => toggleSection('finance')}
                                        className="w-full p-3 flex items-center justify-between bg-transparent"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl flex items-center justify-center ${isMobile ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-600'}`}>
                                                <IndianRupee className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-xs font-bold ${isMobile ? 'text-white' : 'text-gray-900'}`}>Tracker Updates</p>
                                                <p className={`text-[10px] ${isMobile ? 'text-white/50' : 'text-gray-500'}`}>Review updates</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full text-[10px] font-bold ${isMobile ? 'bg-rose-500 text-black shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'bg-rose-100 text-rose-700'}`}>
                                                {financeRequests.length}
                                            </span>
                                            {expandedSections.finance ? <ChevronUp className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} /> : <ChevronDown className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} />}
                                        </div>
                                    </button>
                                    
                                    {expandedSections.finance && (
                                        <div className={`p-3 space-y-3 border-t ${isMobile ? 'border-white/5' : 'border-rose-100/50'}`}>
                                            <div className="flex items-center gap-2 px-1 py-1">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                                <span className={`text-[10px] font-black uppercase tracking-wider ${isMobile ? 'text-amber-400' : 'text-amber-700'}`}>
                                                    Attention: Tracker Approval Required
                                                </span>
                                            </div>
                                            {financeRequests.map(req => (
                                                <div key={req.id} className={`rounded-xl p-3 border ${isMobile ? 'bg-black/20 border-white/5' : 'bg-rose-50/30 border-rose-100'}`}>
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center font-bold text-rose-700 overflow-hidden relative text-xs">
                                                            {req.createdByName?.charAt(0) || 'F'}
                                                            <IndianRupee className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <p className={`text-xs font-bold truncate ${isMobile ? 'text-white' : 'text-gray-900'}`}>{req.createdByName}</p>
                                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20`}>Tracker</span>
                                                            </div>
                                                            <div className="flex items-center justify-between mt-0.5">
                                                                <p className={`text-[9px] ${isMobile ? 'text-white/50' : 'text-rose-700/60'}`}>
                                                                    {req.createdByRole ? (
                                                                        <span className="uppercase tracking-tighter mr-2">{req.createdByRole.replace('_', ' ')}</span>
                                                                    ) : null}
                                                                    {req.createdAt && format(parseISO(req.createdAt), 'dd MMM, hh:mm a')}
                                                                </p>
                                                                <span className="text-[10px] font-bold text-gray-900">
                                                                    ₹{(req.totalBilledAmount || (req.billedAmount + req.billedManagementFee)).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className={`rounded-lg p-2.5 border mb-3 ${isMobile ? 'bg-black/20 border-white/5' : 'bg-white border-rose-100/50'}`}>
                                                      <p className={`text-[11px] font-bold ${isMobile ? 'text-white/90' : 'text-gray-900'}`}>{req.siteName}</p>
                                                      <p className={`text-[10px] italic leading-relaxed ${isMobile ? 'text-white/70' : 'text-gray-600'}`}>{req.remarks || 'No remarks provided'}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            disabled={isActionLoading === req.id}
                                                            className="flex-1 bg-rose-600 hover:bg-rose-700 border-none text-[9px] uppercase font-bold h-8 shadow-lg shadow-rose-900/20"
                                                            onClick={() => handleRespondToFinance(req.id, 'approved')}
                                                        >
                                                            <CheckCircle className="w-3 h-3 mr-1" /> Approve
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline"
                                                            disabled={isActionLoading === req.id}
                                                            className={`flex-1 text-[9px] uppercase font-bold h-8 ${isMobile ? 'border-white/10 text-white hover:bg-white/5' : 'border-rose-200 text-rose-700 hover:bg-rose-50'}`}
                                                            onClick={() => handleRespondToFinance(req.id, 'rejected')}
                                                        >
                                                            <XCircle className="w-3 h-3 mr-1" /> Reject
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Inactive Employees */}
                            {inactiveEmployees.length > 0 && (
                                <div className={`group rounded-2xl overflow-hidden transition-all duration-300 border ${isMobile ? 'border-red-500/30 bg-red-500/5' : 'border-red-200 bg-white hover:shadow-md'}`}>
                                    <button 
                                        onClick={() => toggleSection('inactive')}
                                        className="w-full p-3 flex items-center justify-between bg-transparent"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl flex items-center justify-center ${isMobile ? 'bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-red-100 text-red-600'}`}>
                                                <UserX className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-xs font-bold ${isMobile ? 'text-white' : 'text-gray-900'}`}>Inactive Employees</p>
                                                <p className={`text-[10px] ${isMobile ? 'text-red-400' : 'text-red-500'}`}>Zero activity - may have left</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full text-[10px] font-bold ${isMobile ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-red-100 text-red-700'}`}>
                                                {inactiveEmployees.length}
                                            </span>
                                            {expandedSections.inactive ? <ChevronUp className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} /> : <ChevronDown className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} />}
                                        </div>
                                    </button>

                                    {expandedSections.inactive && (
                                        <div className={`p-3 space-y-3 border-t ${isMobile ? 'border-red-500/10' : 'border-red-100'}`}>
                                            <div className="flex items-center gap-2 px-1 py-1">
                                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                                                <span className={`text-[10px] font-black uppercase tracking-wider ${isMobile ? 'text-red-400' : 'text-red-700'}`}>
                                                    All scores are zero — review for removal
                                                </span>
                                            </div>
                                            {inactiveEmployees.map(emp => (
                                                <div key={emp.userId} className={`rounded-xl p-3 border ${isMobile ? 'bg-black/20 border-white/5' : 'bg-red-50/30 border-red-100'}`}>
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <ProfilePlaceholder photoUrl={emp.userPhotoUrl} seed={emp.userId} className="w-8 h-8 rounded-lg" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <p className={`text-xs font-bold truncate ${isMobile ? 'text-white' : 'text-gray-900'}`}>{emp.userName}</p>
                                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20`}>Inactive</span>
                                                            </div>
                                                            <p className={`text-[9px] ${isMobile ? 'text-white/50' : 'text-red-700/60'}`}>
                                                                {emp.userRole.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className={`rounded-lg p-2.5 border mb-3 ${isMobile ? 'bg-black/20 border-white/5' : 'bg-white border-red-100/50'}`}>
                                                        <p className={`text-[11px] leading-relaxed ${isMobile ? 'text-white/70' : 'text-gray-600'}`}>
                                                            Performance: <strong>0</strong> · Attendance: <strong>0</strong> · Response: <strong>0</strong>
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            disabled={isActionLoading === emp.userId}
                                                            className="flex-1 bg-red-600 hover:bg-red-700 border-none text-[9px] uppercase font-bold h-8 shadow-lg shadow-red-900/20"
                                                            onClick={() => handleRemoveInactiveEmployee(emp)}
                                                        >
                                                            <Trash2 className="w-3 h-3 mr-1" /> Approve Removal
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline"
                                                            className={`flex-1 text-[9px] uppercase font-bold h-8 ${isMobile ? 'border-white/10 text-white hover:bg-white/5' : 'border-red-200 text-red-700 hover:bg-red-50'}`}
                                                            onClick={() => handleDenyInactive(emp)}
                                                        >
                                                            <XCircle className="w-3 h-3 mr-1" /> Deny
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                )}

                {/* General Notifications Toggle Header */}
                <div className={`border-b border-t mt-4 px-6 py-4 flex items-center justify-between cursor-pointer ${isMobile ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-gray-50'}`}
                    onClick={() => toggleSection('general')}
                >
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isMobile ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-700'}`}>
                            <Bell className="w-3.5 h-3.5" />
                        </div>
                        <h5 className={`text-[11px] font-black uppercase tracking-widest ${isMobile ? 'text-white/90' : 'text-sky-900'}`}>
                            Recent Updates
                        </h5>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isMobile ? 'bg-white/10 text-white' : 'bg-sky-100 text-sky-700'}`}>
                            {filteredNotifCount}
                        </span>
                        {expandedSections.general ? <ChevronUp className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} /> : <ChevronDown className={`w-4 h-4 ${isMobile ? 'text-white/50' : 'text-gray-400'}`} />}
                    </div>
                </div>

                {expandedSections.general && (
                    <>
                        {groupedNotifications.length > 0 ? (
                            <div className={`divide-y pt-2 ${isMobile ? 'divide-white/5' : 'divide-gray-50'}`}>
                                {groupedNotifications.map((group) => (
                                    <div key={group.title} className="pb-4">
                                        <div className={`px-6 py-3 ${isMobile ? 'bg-white/5' : 'bg-gray-50/50'}`}>
                                            <h5 className={`text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 ${isMobile ? 'text-white/50' : 'text-muted/60'}`}>
                                                <div className="w-1 h-3 bg-accent/40 rounded-full" />
                                                {group.title}
                                            </h5>
                                        </div>
                                        
                                        <div className={`divide-y ${isMobile ? 'divide-white/5' : 'divide-gray-50'}`}>
                                            {group.items.map((notif) => (
                                                <div
                                                    key={notif.id}
                                                    onClick={() => handleNotificationClick(notif)}
                                                    className={`group relative flex items-start gap-4 px-6 py-4 cursor-pointer transition-all duration-300 ${
                                                        !notif.isRead
                                                        ? isMobile ? 'bg-white/5 hover:bg-white/10' : 'bg-accent/5 hover:bg-accent/10'
                                                        : isMobile ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {!notif.isRead && (
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-10 bg-accent rounded-r-full" />
                                                    )}
                                                    
                                                    <NotificationIcon type={notif.type} size="h-4 w-4" />
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm leading-relaxed mb-1.5 ${
                                                            !notif.isRead 
                                                            ? isMobile ? 'text-white font-semibold' : 'text-gray-900 font-semibold' 
                                                            : isMobile ? 'text-white/70 font-normal' : 'text-gray-600 font-normal'
                                                        }`}>
                                                            {notif.message}
                                                        </p>
                                                        <span className={`text-[11px] flex items-center gap-1 ${isMobile ? 'text-white/50' : 'text-muted'}`}>
                                                            <Clock className="h-3 w-3" />
                                                            {formatDistanceToNow(parseISO(notif.createdAt), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                    
                                                    <button 
                                                        className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all ${isMobile ? 'text-white/50 hover:text-white' : 'text-muted hover:text-accent'}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            markAsRead(notif.id);
                                                        }}
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-24 text-center px-10">
                                <div className="relative mb-6">
                                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center rotate-6 ${isMobile ? 'bg-white/5' : 'bg-gray-50'}`}>
                                        <Inbox className={`h-10 w-10 ${isMobile ? 'text-white/10' : 'text-gray-200'}`} />
                                    </div>
                                    <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl shadow-lg border flex items-center justify-center -rotate-6 ${isMobile ? 'bg-[#0A3D2E] border-white/10' : 'bg-white border-gray-100'}`}>
                                        <Check className="h-5 w-5 text-accent" />
                                    </div>
                                </div>
                                <h5 className={`font-bold text-lg mb-2 ${isMobile ? 'text-white' : 'text-gray-900'}`}>No notifications</h5>
                                <p className={`text-sm ${isMobile ? 'text-white/40' : 'text-gray-400'}`}>You're all caught up!</p>
                            </div>
                        )}
                    </>
                )}
            </div>
            
            {/* Footer */}
            {notifications.length > 0 && (
                <div className={`px-6 py-6 border-t ${isMobile ? 'bg-[#0A3D2E] border-white/10' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex flex-col gap-6">
                        {/* Redesigned Centered Layout */}
                        <div className="flex flex-col items-center gap-8">
                            
                            {/* Page Size Selector */}
                            <div className="flex flex-col items-center gap-3 w-full">
                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isMobile ? 'text-white/40' : 'text-muted/60'}`}>
                                    Items per page
                                </span>
                                <div className="flex items-center justify-center gap-2 flex-wrap">
                                    {[5, 10, 15, 20, 50].map(size => (
                                        <button
                                            key={size}
                                            onClick={() => {
                                                setPageSize(size);
                                                setCurrentPage(1);
                                            }}
                                            className={`min-w-[48px] h-10 px-3 rounded-2xl text-xs font-bold transition-all duration-300 border ${
                                                pageSize === size
                                                ? 'bg-accent text-white border-accent shadow-[0_4px_12px_rgba(34,197,94,0.3)]' 
                                                : isMobile
                                                    ? 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-accent hover:text-accent'
                                            }`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Navigation Controls */}
                            {totalPages > 1 && (
                                <div className="flex flex-col items-center gap-3 w-full">
                                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isMobile ? 'text-white/40' : 'text-muted/60'}`}>
                                        Navigation
                                    </span>
                                    <div className="flex items-center justify-center gap-6">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className={`!p-2 h-10 w-10 !rounded-xl ${isMobile ? 'bg-white/5 text-white border-white/10 hover:bg-white/10 disabled:opacity-20' : 'bg-white border-gray-100 disabled:opacity-40'}`}
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                        </Button>
                                        
                                        <div className={`flex items-baseline gap-2 ${isMobile ? 'text-white' : 'text-gray-900'}`}>
                                            <span className="text-lg font-black tracking-wider">{currentPage}</span>
                                            <span className="text-[10px] font-bold text-muted/40 uppercase">of</span>
                                            <span className="text-lg font-black tracking-wider">{totalPages}</span>
                                        </div>
                                        
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className={`!p-2 h-10 w-10 !rounded-xl ${isMobile ? 'bg-white/5 text-white border-white/10 hover:bg-white/10 disabled:opacity-20' : 'bg-white border-gray-100 disabled:opacity-40'}`}
                                        >
                                            <ChevronRight className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Action Button */}
                            <div className="w-full pt-2">
                                <Button 
                                    className={`w-full py-4 rounded-2xl text-sm font-black uppercase tracking-[0.15em] shadow-lg transition-all duration-300 active:scale-[0.98] ${
                                        isMobile 
                                        ? 'bg-accent text-[#041b0f] hover:bg-accent/90 shadow-accent/20' 
                                        : 'bg-accent text-white hover:bg-accent-dark shadow-accent/10'
                                    }`}
                                >
                                    All Notifications
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
