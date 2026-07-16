import React, { useEffect, useState } from 'react';
import { X, Calendar, Clock, User, HeartPulse, Plane, CalendarClock, Briefcase, Download, Baby, Heart, Activity, Check, FileText, ExternalLink, MessageSquare, ShieldAlert, TrendingUp } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { getProxyUrl, getCleanFilename } from '../../utils/fileUrl';
import type { LeaveRequest, LeaveRequestStatus, AttendanceEvent } from '../../types';
import { format, startOfMonth, endOfMonth, differenceInMinutes, isSameDay } from 'date-fns';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { isAdmin } from '../../utils/auth';

interface LeaveDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: LeaveRequest | null;
}

const LeaveDetailsModal: React.FC<LeaveDetailsModalProps> = ({ isOpen, onClose, request }) => {
    const [monthlyInsights, setMonthlyInsights] = useState<{ avgHours: number; daysWorked: number } | null>(null);
    const [isLoadingInsights, setIsLoadingInsights] = useState(false);
    const [leaveBalance, setLeaveBalance] = useState<any | null>(null);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);

    const { user: currentUser } = useAuthStore();
    const isManagerOrAdmin = currentUser && (
        isAdmin(currentUser.role) || 
        ['operation_manager', 'management', 'hr', 'hr_ops', 'finance_manager', 'site_manager'].includes(currentUser.role)
    );
    const canSeeBalances = isManagerOrAdmin && request && request.userId !== currentUser.id;

    useEffect(() => {
        if (!isOpen || !request || !request.userId || !canSeeBalances) {
            setLeaveBalance(null);
            return;
        }

        const fetchBalance = async () => {
            setIsLoadingBalance(true);
            try {
                const balance = await api.getLeaveBalancesForUser(request.userId, format(new Date(), 'yyyy-MM-dd'));
                setLeaveBalance(balance);
            } catch (error) {
                console.error("Failed to fetch leave balance:", error);
            } finally {
                setIsLoadingBalance(false);
            }
        };

        fetchBalance();
    }, [isOpen, request, canSeeBalances]);

    useEffect(() => {
        if (!isOpen || !request || !request.userId || !request.startDate) {
            setMonthlyInsights(null);
            return;
        }

        const fetchInsights = async () => {
            setIsLoadingInsights(true);
            try {
                const reqDate = new Date(request.startDate.replace(/-/g, '/'));
                const start = `${format(startOfMonth(reqDate), 'yyyy-MM-dd')}T00:00:00Z`;
                const end = `${format(endOfMonth(reqDate), 'yyyy-MM-dd')}T23:59:59Z`;
                
                const events = await api.getAttendanceEvents(request.userId, start, end);
                if (!events || events.length === 0) {
                    setMonthlyInsights({ avgHours: 0, daysWorked: 0 });
                    return;
                }
                
                let totalMinutes = 0;
                let daysWorked = 0;
                const eventsByDate = events.reduce((acc, event) => {
                    const d = format(new Date(event.timestamp), 'yyyy-MM-dd');
                    if (!acc[d]) acc[d] = [];
                    acc[d].push(event);
                    return acc;
                }, {} as Record<string, any[]>);

                Object.values(eventsByDate).forEach(dayEvents => {
                    const punchIns = dayEvents.filter((e: any) => e.type === 'punch-in' || e.type === 'punch_in');
                    const punchOuts = dayEvents.filter((e: any) => e.type === 'punch-out' || e.type === 'punch_out');
                    
                    if (punchIns.length > 0 && punchOuts.length > 0) {
                        const earliestIn = punchIns.reduce((prev: any, curr: any) => new Date(curr.timestamp) < new Date(prev.timestamp) ? curr : prev);
                        const latestOut = punchOuts.reduce((prev: any, curr: any) => new Date(curr.timestamp) > new Date(prev.timestamp) ? curr : prev);
                        
                        const mins = differenceInMinutes(new Date(latestOut.timestamp), new Date(earliestIn.timestamp));
                        if (mins > 0 && mins < 24 * 60) {
                            totalMinutes += mins;
                            daysWorked++;
                        }
                    }
                });
                
                setMonthlyInsights({
                    avgHours: daysWorked > 0 ? (totalMinutes / 60) / daysWorked : 0,
                    daysWorked
                });
            } catch (error) {
                console.error("Failed to fetch insights:", error);
            } finally {
                setIsLoadingInsights(false);
            }
        };
        fetchInsights();
    }, [isOpen, request]);

    if (!isOpen || !request) return null;

    const parseSafeDate = (d: any): Date | null => {
        if (!d) return null;
        if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
        try {
            const date = typeof d === 'string' && d.includes('T') ? new Date(d) : new Date(String(d).replace(/-/g, '/'));
            return isNaN(date.getTime()) ? null : date;
        } catch {
            return null;
        }
    };

    const formatSafeDate = (date: any, formatStr: string, fallback = 'N/A') => {
        const d = parseSafeDate(date);
        if (!d) return fallback;
        try {
            return format(d, formatStr);
        } catch {
            return fallback;
        }
    };

    const getLeaveTypeDisplay = (type: string) => {
        switch (type) {
            case 'Earned': return 'Earned Leave';
            case 'Sick': return 'Sick Leave';
            case 'Floating': return 'Blue Leave';
            case 'Pink Leave': return 'Pink Leave';
            case 'Comp Off': return 'Comp Off';
            case 'Loss of Pay': return 'Loss of Pay';
            case 'Maternity': return 'Maternity Leave';
            case 'Child Care': return 'Child Care Leave';
            case 'WFH': return 'Work From Home (WFH)';
            case 'Correction': return 'Request for Correction (RC)';
            case 'Permission': return 'Request for Permission (RP)';
            default: return type;
        }
    };

    const getLeaveTypeStyles = (type: string) => {
        const lowerType = type.toLowerCase();
        if (lowerType.includes('sick')) return { bg: 'bg-red-500/10 border-red-500/20 text-red-500', icon: HeartPulse };
        if (lowerType.includes('floating')) return { bg: 'bg-blue-500/10 border-blue-500/20 text-blue-500', icon: Plane };
        if (lowerType.includes('comp')) return { bg: 'bg-amber-500/10 border-amber-500/20 text-amber-500', icon: CalendarClock };
        if (lowerType.includes('pink')) return { bg: 'bg-pink-500/10 border-pink-500/20 text-pink-500', icon: Heart };
        if (lowerType.includes('maternity') || lowerType.includes('child')) return { bg: 'bg-purple-500/10 border-purple-500/20 text-purple-500', icon: Baby };
        if (lowerType.includes('correction')) return { bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500', icon: Activity };
        if (lowerType.includes('permission')) return { bg: 'bg-teal-500/10 border-teal-500/20 text-teal-500', icon: Clock };
        return { bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500', icon: Briefcase };
    };

    const getStatusStyles = (status: LeaveRequestStatus) => {
        const styles: Record<LeaveRequestStatus, string> = {
            pending_manager_approval: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20',
            pending_hr_confirmation: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
            approved: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20',
            rejected: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
            cancelled: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20',
            withdrawn: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/5 dark:text-gray-400 dark:border-gray-500/10',
            pending_admin_correction: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
            correction_made: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
        };
        return styles[status] || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const getStatusText = (status: LeaveRequestStatus, req: LeaveRequest) => {
        let text = status.replace(/_/g, ' ');
        if ((status === 'pending_manager_approval' || status === 'pending_hr_confirmation') && req.currentApproverName) {
            return `Pending from ${req.currentApproverName}`;
        }
        if (status === 'approved' && req.approvalHistory && req.approvalHistory.length > 0) {
            const last = req.approvalHistory[req.approvalHistory.length - 1];
            if (last.approverName) return `Approved by ${last.approverName}`;
        }
        if (status === 'rejected' && req.approvalHistory && req.approvalHistory.length > 0) {
            const last = req.approvalHistory[req.approvalHistory.length - 1];
            if (last.approverName) return `Rejected by ${last.approverName}`;
        }
        return text;
    };

    const handleViewDocument = () => {
        if (request.doctorCertificate?.preview || request.doctorCertificate?.url) {
            const rawUrl = request.doctorCertificate.preview || request.doctorCertificate.url;
            const proxyUrl = getProxyUrl(rawUrl);
            const cleanName = getCleanFilename(request.doctorCertificate.name || rawUrl);
            const params = new URLSearchParams({
                url: proxyUrl,
                title: cleanName
            });
            window.open(`/#/document-viewer?${params.toString()}`, '_blank');
        }
    };

    const typeStyles = getLeaveTypeStyles(request.leaveType);
    const TypeIcon = typeStyles.icon;
    const isImageCert = request.doctorCertificate?.type?.startsWith('image/') || 
                       ['.jpg', '.jpeg', '.png', '.webp'].some(ext => request.doctorCertificate?.preview?.toLowerCase().endsWith(ext) || request.doctorCertificate?.url?.toLowerCase().endsWith(ext));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Leave Request Details"
            maxWidth="md:max-w-2xl"
            hideFooter={true}
        >
            <div className="space-y-6">
                {/* Employee / Submitter Header */}
                <div className="flex items-center justify-between pb-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        {request.userPhotoUrl ? (
                            <img src={request.userPhotoUrl} alt={request.userName} className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-500/20" />
                        ) : (
                            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-black text-sm shrink-0">
                                {request.userName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <h4 className="font-bold text-base text-primary-text">{request.userName}</h4>
                            <p className="text-xs text-muted">Applied on {formatSafeDate(request.createdAt || (request as any).created_at, 'dd MMM yyyy, hh:mm a')}</p>
                        </div>
                    </div>
                    <div>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize border ${getStatusStyles(request.status)}`}>
                            {getStatusText(request.status, request)}
                        </span>
                    </div>
                </div>

                {/* Submitter Leave Balances */}
                {canSeeBalances && (
                    isLoadingBalance ? (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="h-14 bg-white/5 animate-pulse rounded-2xl border border-white/10" />
                            <div className="h-14 bg-white/5 animate-pulse rounded-2xl border border-white/10" />
                            <div className="h-14 bg-white/5 animate-pulse rounded-2xl border border-white/10" />
                        </div>
                    ) : leaveBalance ? (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col justify-center">
                                <p className="text-[9px] uppercase font-bold tracking-wider text-emerald-500/70">Earned Leave</p>
                                <p className="text-base font-black text-emerald-500">
                                    {((leaveBalance.earnedTotal || 0) - (leaveBalance.earnedUsed || 0)).toFixed(1)} <span className="text-[10px] font-normal">Days</span>
                                </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-red-500/5 border border-red-500/10 flex flex-col justify-center">
                                <p className="text-[9px] uppercase font-bold tracking-wider text-red-500/70">Sick Leave</p>
                                <p className="text-base font-black text-red-500">
                                    {((leaveBalance.sickTotal || 0) - (leaveBalance.sickUsed || 0)).toFixed(1)} <span className="text-[10px] font-normal">Days</span>
                                </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex flex-col justify-center">
                                <p className="text-[9px] uppercase font-bold tracking-wider text-amber-500/70">Compensatory Off</p>
                                <p className="text-base font-black text-amber-500">
                                    {((leaveBalance.compOffTotal || 0) - (leaveBalance.compOffUsed || 0)).toFixed(1)} <span className="text-[10px] font-normal">Days</span>
                                </p>
                            </div>
                        </div>
                    ) : null
                )}

                {/* Core Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 dark:bg-white/[0.02] flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${typeStyles.bg}`}>
                            <TypeIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-muted">Leave Type</p>
                            <p className="text-sm font-bold text-primary-text">{getLeaveTypeDisplay(request.leaveType)}</p>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 dark:bg-white/[0.02] flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-muted">Duration</p>
                            <p className="text-sm font-bold text-primary-text">
                                {formatSafeDate(request.startDate, 'dd MMM')} - {formatSafeDate(request.endDate, 'dd MMM yyyy')}
                                <span className="ml-2 text-xs font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                    {request.dayOption === 'half' ? '0.5 Day' : `${Math.round((new Date(request.endDate.replace(/-/g, '/')).getTime() - new Date(request.startDate.replace(/-/g, '/')).getTime()) / (1024 * 60 * 60 * 24)) + 1} Days`}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Monthly Insights */}
                {monthlyInsights && (
                    <div className="space-y-2">
                        <h5 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5" /> Monthly Attendance Insights
                        </h5>
                        <div className="p-4 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/[0.02] border border-indigo-500/20 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-bold tracking-wider text-muted">Days Worked in Month</p>
                                <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                    {isLoadingInsights ? '...' : monthlyInsights.daysWorked}
                                </p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p className="text-[10px] uppercase font-bold tracking-wider text-muted">Avg Daily Hours</p>
                                <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                    {isLoadingInsights ? '...' : `${monthlyInsights.avgHours.toFixed(1)} hrs`}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reason Section */}
                <div className="space-y-2">
                    <h5 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" /> Reason for Leave
                    </h5>
                    <div className="p-4 rounded-2xl bg-white/5 dark:bg-white/[0.02] border border-white/10 text-sm text-primary-text leading-relaxed whitespace-pre-wrap italic">
                        "{request.reason}"
                    </div>
                </div>

                {/* Correction details if Correction/Permission type */}
                {request.correctionDetails && (
                    <div className="space-y-3 p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/[0.02] border border-emerald-500/20">
                        <h5 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5" /> {request.leaveType === 'Permission' ? 'Permission Information' : 'Correction Information'}
                        </h5>
                        <div className={`grid grid-cols-1 sm:grid-cols-2 ${['Permission', 'Correction'].includes(request.leaveType) && request.correctionDetails.originalLogs ? 'md:grid-cols-3' : ''} gap-4 text-sm`}>
                            <div className="space-y-1">
                                <p className="text-xs text-muted">Requested Timings</p>
                                <p className="font-bold text-primary-text">{request.leaveType === 'Permission' ? 'Start' : 'Punch In'}: <span className="text-emerald-500">{request.correctionDetails.punchIn || '--:--'}</span></p>
                                <p className="font-bold text-primary-text">{request.leaveType === 'Permission' ? 'End' : 'Punch Out'}: <span className="text-emerald-500">{request.correctionDetails.punchOut || '--:--'}</span></p>
                                {request.correctionDetails.punchIn2 && (
                                    <>
                                        <p className="font-bold text-primary-text mt-1.5">{request.leaveType === 'Permission' ? 'Start 2' : 'Punch In 2'}: <span className="text-emerald-500">{request.correctionDetails.punchIn2 || '--:--'}</span></p>
                                        <p className="font-bold text-primary-text">{request.leaveType === 'Permission' ? 'End 2' : 'Punch Out 2'}: <span className="text-emerald-500">{request.correctionDetails.punchOut2 || '--:--'}</span></p>
                                    </>
                                )}
                                {request.correctionDetails.includeBreak && (
                                    <p className="text-xs text-muted/80">Break: {request.correctionDetails.breakIn || '--'} - {request.correctionDetails.breakOut || '--'}</p>
                                )}
                                <p className="text-xs text-muted/80 mt-1">Location: {request.correctionDetails.locationName || 'N/A'}</p>
                            </div>
                            
                            {['Permission', 'Correction'].includes(request.leaveType) && request.correctionDetails.punchIn && request.correctionDetails.punchOut && (
                                <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-emerald-500/10 sm:pl-4">
                                    <p className="text-xs text-muted">{request.leaveType === 'Permission' ? 'Permission Details' : 'Correction Details'}</p>
                                    {(() => {
                                        const getMins = (t: string) => { if(!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                                        const pIn = getMins(request.correctionDetails.punchIn);
                                        const pOut = getMins(request.correctionDetails.punchOut);
                                        let diff = pOut - pIn;
                                        if (diff < 0) diff += 24 * 60;

                                        let diff2 = 0;
                                        if (request.correctionDetails.punchIn2 && request.correctionDetails.punchOut2) {
                                            const pIn2 = getMins(request.correctionDetails.punchIn2);
                                            const pOut2 = getMins(request.correctionDetails.punchOut2);
                                            diff2 = pOut2 - pIn2;
                                            if (diff2 < 0) diff2 += 24 * 60;
                                        }

                                        let breakMins = 0;
                                        if (request.leaveType === 'Correction' && request.correctionDetails.includeBreak && request.correctionDetails.breakIn && request.correctionDetails.breakOut) {
                                            const bIn = getMins(request.correctionDetails.breakIn);
                                            const bOut = getMins(request.correctionDetails.breakOut);
                                            let bDiff = bOut - bIn;
                                            if (bDiff < 0) bDiff += 24 * 60;
                                            breakMins = bDiff;
                                        }

                                        const totalDiff = Math.max(0, diff + diff2 - breakMins);
                                        const sessionHalf = request.correctionDetails.punchIn2 ? 'Both Halves' : ((pIn < 13 * 60) ? '1st Half' : '2nd Half');
                                        
                                        return (
                                            <>
                                                <p className="text-muted/80">Duration: <span className="font-bold text-primary-text">{Math.floor(totalDiff / 60)}h {totalDiff % 60}m</span></p>
                                                <p className="text-muted/80">Session: <span className="font-bold text-primary-text">{sessionHalf}</span></p>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}

                            {request.correctionDetails.originalLogs && (
                                <div className={`space-y-1 border-t sm:border-t-0 border-emerald-500/10 ${request.leaveType === 'Permission' ? 'md:border-l md:pl-4 mt-4 md:mt-0' : 'sm:border-l sm:pl-4'}`}>
                                    <p className="text-xs text-muted">Original Timings</p>
                                    <p className="text-muted/80">Punch In: <span className="font-bold text-primary-text">{request.correctionDetails.originalLogs.punchIn || '--:--'}</span></p>
                                    <p className="text-muted/80">Punch Out: <span className="font-bold text-primary-text">{request.correctionDetails.originalLogs.punchOut || '--:--'}</span></p>
                                    {(() => {
                                        const pInStr = request.correctionDetails?.originalLogs?.punchIn;
                                        const pOutStr = request.correctionDetails?.originalLogs?.punchOut;
                                        if (!pInStr || !pOutStr || pInStr === '--:--' || pOutStr === '--:--') return null;
                                        const getMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                                        const pIn = getMins(pInStr);
                                        const pOut = getMins(pOutStr);
                                        let diff = pOut - pIn;
                                        if (diff < 0) diff += 24 * 60;
                                        return <p className="text-muted/80">Duration: <span className="font-bold text-primary-text">{Math.floor(diff / 60)}h {diff % 60}m</span></p>;
                                    })()}
                                    <p className="text-xs text-muted/60 mt-1">Location: {request.correctionDetails.originalLogs.locationName || 'N/A'}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Doctor's Certificate Upload Attachment */}
                {request.doctorCertificate && (
                    <div className="space-y-2">
                        <h5 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" /> Attachment / Doctor's Certificate
                        </h5>
                        <div className="p-4 rounded-2xl bg-white/5 dark:bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="p-2.5 bg-red-500/10 rounded-xl text-red-500">
                                    <HeartPulse className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-primary-text truncate max-w-[240px]" title={request.doctorCertificate.name}>
                                        {request.doctorCertificate.name}
                                    </p>
                                    <p className="text-[10px] text-muted uppercase font-semibold">
                                        {request.doctorCertificate.type?.split('/').pop()?.toUpperCase() || 'DOCUMENT'} • {request.doctorCertificate.size > 0 ? `${(request.doctorCertificate.size / (1024 * 1024)).toFixed(2)} MB` : 'Cloud Saved'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto justify-end">
                                <Button
                                    size="sm"
                                    onClick={handleViewDocument}
                                    className="flex items-center gap-1.5 font-semibold text-xs whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" /> View Certificate
                                </Button>
                            </div>
                        </div>

                        {/* Image Preview Thumbnail */}
                        {isImageCert && (request.doctorCertificate.preview || request.doctorCertificate.url) && (
                            <div className="mt-2 flex justify-center border border-white/10 dark:border-border/50 rounded-2xl overflow-hidden bg-black/10 max-h-[220px]">
                                <img
                                    src={getProxyUrl(request.doctorCertificate.preview || request.doctorCertificate.url)}
                                    alt="Doctor Certificate Preview"
                                    className="max-w-full max-h-[220px] object-contain"
                                    onClick={handleViewDocument}
                                    style={{ cursor: 'pointer' }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Approval History Timeline */}
                {request.approvalHistory && request.approvalHistory.length > 0 && (
                    <div className="space-y-3">
                        <h5 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldAlert className="h-3.5 w-3.5" /> Approval Timeline
                        </h5>
                        <div className="relative border-l-2 border-border/60 ml-4 pl-6 space-y-4">
                            {request.approvalHistory.map((step, idx) => (
                                <div key={idx} className="relative">
                                    {/* Timeline dot */}
                                    <span className={`absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-card ${step.status === 'approved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                        <Check className="h-2.5 w-2.5" />
                                    </span>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {step.approverPhotoUrl ? (
                                                    <img src={step.approverPhotoUrl} alt={step.approverName} className="h-5 w-5 rounded-full object-cover" />
                                                ) : (
                                                    <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-[9px] font-bold">
                                                        {step.approverName.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="text-sm font-bold text-primary-text">{step.approverName}</span>
                                            </div>
                                            <span className="text-[10px] text-muted">{formatSafeDate(step.timestamp, 'dd MMM yyyy, hh:mm a')}</span>
                                        </div>
                                        <div className="text-xs text-muted flex items-center gap-1.5">
                                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${step.status === 'approved' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <span className="capitalize">{step.status}</span>
                                        </div>
                                        {step.comments && (
                                            <p className="text-xs text-muted bg-white/5 dark:bg-white/[0.01] border border-white/5 p-2 rounded-lg italic mt-1 max-w-full overflow-hidden whitespace-pre-wrap">
                                                Comment: "{step.comments}"
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Controls */}
                <div className="flex justify-end pt-4 border-t border-border/50">
                    <Button variant="secondary" onClick={onClose} className="px-6 font-semibold">
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default LeaveDetailsModal;
