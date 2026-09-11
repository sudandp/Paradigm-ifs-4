import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import type { LeaveBalance, LeaveRequest, LeaveType, LeaveRequestStatus, UploadedFile, CompOffLog, AttendanceEvent, UserHoliday, AttendanceSettings, StaffAttendanceRules, RecurringHolidayRule, UserChild, RoutePoint } from '../../types';
import { Loader2, Plus, ArrowLeft, AlertTriangle, Briefcase, HeartPulse, Plane, CalendarClock, Clock, Edit, Trash2, XCircle, Search, Calendar, Settings, Check, Baby, Heart, Calculator, MapPin, Upload, Footprints, Eye, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { HOLIDAY_SELECTION_POOL, FIXED_HOLIDAYS } from '../../utils/constants';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Select from '../../components/ui/Select';
import { useForm, Controller, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { format, differenceInCalendarDays, isSameDay, startOfMonth, endOfMonth, differenceInMinutes, getDay, startOfYear, endOfYear, startOfWeek, subDays, eachDayOfInterval, startOfDay, subMonths, addMonths } from 'date-fns';
import { calculateWorkingHours, getStaffCategory, isTechnicalRole, calculateDailyTravelKm, calculateDailyPathTravelKm, getEarlyDepartureDeductions } from '../../utils/attendanceCalculations';
import { parsePermissionDurationFromReason } from '../../utils/monthlyReportCalculations';

const formatDuration = (mins: number): string => {
  if (!mins || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
};
import DatePicker from '../../components/ui/DatePicker';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useSettingsStore } from '../../store/settingsStore';
import UploadDocument from '../../components/UploadDocument';
import AttendanceCalendar from './AttendanceCalendar';
import CompOffCalendar from './CompOffCalendar';
import OTCalendar from './OTCalendar';
import YearlyAttendanceChart from './YearlyAttendanceChart';
import EmployeeLog from './EmployeeLog';
import { buildAttendanceDayKeyByEventId } from '../../utils/attendanceDayGrouping';
import Modal from '../../components/ui/Modal';
import HolidayCalendar from './HolidayCalendar';
import ShortfallCalendar from './ShortfallCalendar';
import LoadingScreen from '../../components/ui/LoadingScreen';
import LeaveDetailsModal from '../../components/modals/LeaveDetailsModal';

// --- Reusable Components ---

const LeaveBalanceCard: React.FC<{ 
    title: string; 
    value: string; 
    icon: React.ElementType; 
    isExpired?: boolean; 
    description?: string; 
    isLoading?: boolean; 
    onViewDetails?: () => void; 
    infoMessage?: string;
    isFeatured?: boolean;
}> = ({ title, value, icon: Icon, isExpired, description, isLoading, onViewDetails, infoMessage, isFeatured }) => {
    const [showInfo, setShowInfo] = useState(false);
    
    return (
    <div className={`relative p-3.5 md:p-4 rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md w-full h-full flex flex-col justify-between ${
        isExpired
            ? 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-950/20'
            : 'bg-white dark:bg-[#092c19] border-slate-200/80 dark:border-[#134426] hover:border-slate-300 dark:hover:border-[#44D62C]/40'
    }`}>
        {/* Actions (View Timeline Eye & Info Modal) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
            {infoMessage && (
                <div className="relative flex items-center">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowInfo(true);
                        }}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:text-white/50 dark:hover:text-[#44D62C] transition-colors"
                        title={`${title} Info`}
                    >
                        <Info className="w-3.5 h-3.5" />
                    </button>
                    <Modal isOpen={showInfo} onClose={() => setShowInfo(false)} title={`${title} Info`}>
                        <div className="p-5 text-sm text-slate-800 dark:text-white/90 leading-relaxed">
                            {infoMessage}
                        </div>
                    </Modal>
                </div>
            )}
            {onViewDetails && !isLoading && (
                <button 
                    type="button"
                    onClick={onViewDetails} 
                    className="p-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/20 transition-colors"
                    title="View Timeline"
                >
                    <Eye className="w-3.5 h-3.5" />
                </button>
            )}
        </div>

        {isFeatured ? (
            /* Featured layout on mobile (Full-width row) / Standard horizontal on desktop */
            <div className="flex flex-row items-center justify-between gap-3 w-full h-full pr-2">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl flex-shrink-0 border ${
                        isExpired 
                            ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400' 
                            : 'bg-emerald-50 dark:bg-[#041b0f] border-emerald-100 dark:border-[#134426] text-emerald-600 dark:text-[#44D62C]'
                    }`}>
                        {isLoading ? (
                            <div className="h-5 w-5 md:h-6 md:w-6 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-full" />
                        ) : (
                            <Icon className="h-5 w-5 md:h-6 md:w-6" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-xs md:text-sm font-bold text-slate-500 dark:text-white/70 uppercase tracking-wider">{title}</span>
                            {isExpired && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase">Expired</span>}
                        </div>
                        {description && !isLoading && (
                            <p className="text-[10px] md:text-xs text-slate-500 dark:text-[#a3c4b1] mt-0.5 leading-snug line-clamp-1">{description}</p>
                        )}
                    </div>
                </div>
                <div className="flex-shrink-0">
                    {isLoading ? (
                        <div className="h-7 md:h-8 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
                    ) : (
                        <div className={`text-2xl md:text-3xl font-black ${isExpired ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                            {value}
                        </div>
                    )}
                </div>
            </div>
        ) : (
            /* Standard Grid Card: Vertical on Mobile, Horizontal on Desktop */
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 md:gap-4 w-full h-full text-left">
                <div className={`p-2.5 rounded-xl flex-shrink-0 border ${
                    isExpired 
                        ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400' 
                        : 'bg-emerald-50 dark:bg-[#041b0f] border-emerald-100 dark:border-[#134426] text-emerald-600 dark:text-[#44D62C]'
                }`}>
                    {isLoading ? (
                        <div className="h-5 w-5 md:h-6 md:w-6 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-full" />
                    ) : (
                        <Icon className="h-5 w-5 md:h-6 md:w-6" />
                    )}
                </div>
                <div className="flex-1 w-full min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs md:text-sm font-bold text-slate-500 dark:text-white/70 uppercase tracking-wider truncate">{title}</span>
                        {isExpired && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase">Expired</span>}
                    </div>
                    {isLoading ? (
                        <div className="h-6 md:h-7 w-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded mt-1" />
                    ) : (
                        <div className={`text-xl md:text-2xl font-black mt-0.5 ${isExpired ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                            {value}
                        </div>
                    )}
                    {description && !isLoading && (
                        <p className="text-[10px] md:text-xs text-slate-500 dark:text-[#a3c4b1] mt-1 leading-snug line-clamp-2">
                            {description}
                        </p>
                    )}
                </div>
            </div>
        )}
    </div>
    );
};


const LeaveStatusChip: React.FC<{ status: LeaveRequestStatus }> = ({ status }) => {
    const statusClasses: Record<LeaveRequestStatus, string> = {
        pending_manager_approval: 'leave-status-chip--pending_manager_approval',
        pending_rm2_approval: 'leave-status-chip--pending_rm2_approval',
        pending_hr_confirmation: 'leave-status-chip--pending_hr_confirmation',
        pending_admin_correction: 'leave-status-chip--pending_admin_correction',
        correction_made: 'leave-status-chip--correction_made',
        approved: 'leave-status-chip--approved',
        rejected: 'leave-status-chip--rejected',
        cancelled: 'leave-status-chip--cancelled',
        withdrawn: 'leave-status-chip--withdrawn'
    };
    const text = status.replace(/_/g, ' ');
    return <span className={`leave-status-chip ${statusClasses[status]}`}>{text}</span>;
};


// --- Leave Request Form ---
type LeaveRequestFormData = {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
    dayOption?: 'full' | 'half';
    doctorCertificate?: UploadedFile | null;
};

const getLeaveValidationSchema = (threshold: number) => yup.object({
    leaveType: yup.string<LeaveType>().oneOf(['Earned', 'Sick', 'Floating', 'Comp Off', 'Maternity', 'Child Care']).required('Leave type is required'),
    startDate: yup.string().required('Start date is required'),
    endDate: yup.string().required('End date is required')
        .test('is-after-start', 'End date must be on or after start date', function (value) {
            // FIX: Cast `this.parent.startDate` to string to prevent a runtime error.
            // In Yup, `this.parent` is of type `any` or `unknown`, so properties accessed on it are not type-safe.
            const { startDate } = this.parent as { startDate?: string };
            if (!startDate || !value) return true;
            return new Date(value.replace(/-/g, '/')) >= new Date(startDate.replace(/-/g, '/'));
        }),
    reason: yup.string().required('A reason for the leave is required').min(10, 'Please provide a more detailed reason.'),
    dayOption: yup.string().oneOf(['full', 'half']).optional(),
    doctorCertificate: yup.mixed<UploadedFile | null>().when(['leaveType', 'startDate', 'endDate'], {
        is: (leaveType: string, startDate: string, endDate: string) => {
            if (leaveType !== 'Sick' || !startDate || !endDate) return false;
            const duration = differenceInCalendarDays(new Date(endDate.replace(/-/g, '/')), new Date(startDate.replace(/-/g, '/'))) + 1;
            return duration > threshold;
        },
        then: schema => schema.required(`A doctor's certificate is required for sick leave longer than ${threshold} days.`),
        otherwise: schema => schema.nullable().optional(),
    })
});



// --- Main Dashboard ---
const LeaveDashboard: React.FC = () => {
    const { user, isCheckedIn, dailyPunchCount } = useAuthStore();
    const isProbation = useMemo(() => {
        if (!user) return false;
        const joinDateStr = user.joiningDate || user.createdAt;
        if (!joinDateStr) return false;
        
        const joinDate = new Date(joinDateStr.split('T')[0].replace(/-/g, '/'));
        const probationEnd = new Date(joinDate);
        probationEnd.setMonth(probationEnd.getMonth() + 3);
        
        const now = new Date();
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return todayMidnight < probationEnd;
    }, [user]);

    const [balanceDataState, setBalance] = useState<LeaveBalance | null>(null);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [compOffLogs, setCompOffLogs] = useState<CompOffLog[]>([]);
    const [events, setEvents] = useState<AttendanceEvent[]>([]);
    const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings | null>(null);
    const [recurringHolidays, setRecurringHolidays] = useState<RecurringHolidayRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isContentVisible, setIsContentVisible] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCompOffHistoryDisabled, setIsCompOffHistoryDisabled] = useState(false);
    const [filter, setFilter] = useState<LeaveRequestStatus | 'all'>('all');
    const [dateScope, setDateScope] = useState<'month' | 'all'>('month');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [actioningRequestId, setActioningRequestId] = useState<string | null>(null);
    const isMobile = useMediaQuery('(max-width: 767px)');
    const navigate = useNavigate();
    const [calculatedOTHours, setCalculatedOTHours] = useState<number>(0);
    const [calculatedShortfallMins, setCalculatedShortfallMins] = useState<number>(0);
    const [calculatedSiteOtDays, setCalculatedSiteOtDays] = useState<number>(0);
    const [calculatedBreakdownVisits, setCalculatedBreakdownVisits] = useState<number>(0);
    const [userChildren, setUserChildren] = useState<UserChild[]>([]);
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    // Holiday Selection State
    const [userHolidays, setUserHolidays] = useState<UserHoliday[]>([]);
    const [isHolidaySelectionEnabled, setIsHolidaySelectionEnabled] = useState(false);
    const [activeHolidayPool, setActiveHolidayPool] = useState<{ name: string; date: string }[]>([]);
    const [isOtConversionEnabled, setIsOtConversionEnabled] = useState(false);
    const [isShortfallEnabled, setIsShortfallEnabled] = useState(false);
    const [showEarnedLeaveModal, setShowEarnedLeaveModal] = useState(false);
    const [showCompOffModal, setShowCompOffModal] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [showBlueLeaveModal, setShowBlueLeaveModal] = useState(false);
    const [elModalTab, setElModalTab] = useState<'earned' | 'used' | 'balance'>('used');
    const [compModalTab, setCompModalTab] = useState<'earned' | 'used' | 'balance'>('earned');
    const [yearlyData, setYearlyData] = useState<{
        events: AttendanceEvent[];
        userHolidays: UserHoliday[];
        leaves: LeaveRequest[];
    } | null>(null);

    const earliestRecordDate = useMemo(() => {
        if (!user) return null;
        const rawJoining = user.joiningDate || (user as any).joining_date;
        if (rawJoining) return startOfDay(new Date(String(rawJoining).replace(/-/g, '/')));
        
        const timestamps: number[] = [];
        (yearlyData?.events || []).forEach(e => {
            if (e && e.timestamp) timestamps.push(new Date(e.timestamp).getTime());
        });
        (events || []).forEach(e => {
            if (e && e.timestamp) timestamps.push(new Date(e.timestamp).getTime());
        });
        (requests || []).forEach(r => {
            if (r && r.startDate) timestamps.push(new Date(r.startDate.replace(/-/g, '/')).getTime());
        });
        if (timestamps.length > 0) {
            return startOfDay(new Date(Math.min(...timestamps)));
        }
        return null;
    }, [user, yearlyData?.events, events, requests]);

    // Emergency Self-Healing for Attendance Rules
    useEffect(() => {
        const repairSettings = async () => {
            try {
                const settings = await api.getAttendanceSettings();
                let needsUpdate = false;
                
                ['office', 'field', 'site'].forEach((cat) => {
                    const typedCat = cat as keyof AttendanceSettings;
                    // Safely cast to StaffAttendanceRules for the self-healing logic
                    const catRules = settings[typedCat] as StaffAttendanceRules;
                    
                    if (!catRules) {
                        (settings as any)[typedCat] = {};
                        needsUpdate = true;
                        return;
                    }
                    
                    // Earned Leave Accrual rule: 0.5 EL per 10 days (or 1.5 per 30 days)
                    if (!catRules.earnedLeaveAccrual) {
                        catRules.earnedLeaveAccrual = { daysRequired: 10, amountEarned: 0.5 };
                        needsUpdate = true;
                    }
                    
                    if (catRules.enableSickLeaveAccrual === undefined) {
                        catRules.enableSickLeaveAccrual = true;
                        needsUpdate = true;
                    }

                    // Fallback for missing recurring holidays in JSON
                    if (!catRules.recurringHolidays || catRules.recurringHolidays.length === 0) {
                        if (cat === 'office' || cat === 'site') {
                            catRules.recurringHolidays = [{ day: 'Saturday', n: 3, type: cat as any }];
                            needsUpdate = true;
                        }
                    }

                    // Enable custom holidays by default if not explicitly set to false
                    if (catRules.enableCustomHolidays === undefined) {
                        catRules.enableCustomHolidays = true;
                        needsUpdate = true;
                    }

                    // Enforce 2-day activity rule for Week Offs
                    if (catRules.weekendPresentThreshold !== 2) {
                        catRules.weekendPresentThreshold = 2;
                        needsUpdate = true;
                    }
                });

                if (needsUpdate) {
                    await api.saveAttendanceSettings(settings);
                    console.log("Self-healing: Updated attendance rules for all categories.");
                    // Refresh the page once to apply new rules
                    window.location.reload();
                }
            } catch (err) {
                console.error("Self-healing failed:", err);
            }
        };

        if (user && (user.role?.toLowerCase().includes('admin') || user.role?.toLowerCase().includes('hr'))) {
            repairSettings();
        }
    }, [user]);

    const [viewingDate, setViewingDate] = useState(new Date());
    const [threshold, setThreshold] = useState(8);
    const [monthlyPaydays, setMonthlyPaydays] = useState<number | null>(null);
    const [monthlyPaydaysMap, setMonthlyPaydaysMap] = useState<Record<string, number>>({});
    const [siteOtDays, setSiteOtDays] = useState(0);
    const [monthlyTravelKm, setMonthlyTravelKm] = useState<number>(0);
    const [monthlyTravelDuration, setMonthlyTravelDuration] = useState<number>(0);
    const [monthlySteps, setMonthlySteps] = useState<number>(0);
    const [dailyActivityRecords, setDailyActivityRecords] = useState<{dateStr: string, travelKm: number, travelDuration: number, steps: number, startTime: string | null, endTime: string | null, startLocation: string | null, endLocation: string | null}[]>([]);
    const [snapshotData, setSnapshotData] = useState<any | null>(null);
    const [isCalendarLoading, setIsCalendarLoading] = useState(false);
    const fetchSeqRef = useRef(0);
    const currentYear = viewingDate.getFullYear();

    // In-memory Year Data Bundle Cache to make month navigation instantaneous (0ms) like Yearly Attendance
    const yearBundleCacheRef = useRef<Map<number, {
        yearlyEvents: AttendanceEvent[];
        yearlyRequests: LeaveRequest[];
        selections: UserHoliday[];
        compOffData: CompOffLog[];
        settings: any;
        recurringData: any[];
        userChildrenData: UserChild[];
    }>>(new Map());

    // In-memory Month Stats Cache (travel, duration, footsteps, snapshots)
    const monthStatsCacheRef = useRef<Map<string, {
        snapshotData: any;
        monthlyTravelKm: number;
        monthlyTravelDuration: number;
        monthlySteps: number;
        dailyRecords: any[];
    }>>(new Map());

    const handleMonthPaydaysChange = useCallback((count: number) => {
        const key = format(viewingDate, 'yyyy-MM');
        setMonthlyPaydaysMap(prev => (prev[key] === count ? prev : { ...prev, [key]: count }));
        setMonthlyPaydays(count);
    }, [viewingDate]);

    // Synchronous derivation of active month events & requests from year bundle cache
    // Prevents state-tearing where switching months temporarily renders absent/wrong data
    const activeMonthEvents = useMemo(() => {
        const targetYear = viewingDate.getFullYear();
        const cached = yearBundleCacheRef.current.get(targetYear);
        const sourceEvents = cached?.yearlyEvents || yearlyData?.events;
        
        if (sourceEvents && sourceEvents.length > 0) {
            const startOfMonthDate = startOfMonth(viewingDate);
            const dateStartMs = new Date(startOfWeek(subDays(startOfMonthDate, 15), { weekStartsOn: 1 }).getTime() - 12 * 60 * 60 * 1000).getTime();
            const dateEndMs = new Date(endOfMonth(viewingDate).getTime() + 36 * 60 * 60 * 1000).getTime();

            return sourceEvents.filter(e => {
                if (!e || !e.timestamp) return false;
                const t = new Date(e.timestamp).getTime();
                return t >= dateStartMs && t <= dateEndMs;
            });
        }
        return events;
    }, [viewingDate, yearlyData?.events, events]);

    const activeRequests = useMemo(() => {
        const targetYear = viewingDate.getFullYear();
        const cached = yearBundleCacheRef.current.get(targetYear);
        return cached?.yearlyRequests || yearlyData?.leaves || requests;
    }, [viewingDate, yearlyData?.leaves, requests]);

    // Approver user profile cache (name, profile photo) for audit display
    const [approverUsersMap, setApproverUsersMap] = useState<Record<string, { name: string; photoUrl: string | null }>>({});

    useEffect(() => {
        const allLeaves = [
            ...(yearlyData?.leaves || []),
            ...(requests || []),
            ...(activeRequests || [])
        ];
        if (allLeaves.length === 0) return;

        const idsToFetch = new Set<string>();
        allLeaves.forEach(l => {
            if (!l) return;
            const historyList = (l.approvalHistory || (l as any).approval_history || []) as any[];
            historyList.forEach(h => {
                const id = h?.approverId || h?.approver_id;
                if (id && !approverUsersMap[id]) {
                    idsToFetch.add(id);
                }
            });
            if (l.currentApproverId && !approverUsersMap[l.currentApproverId]) {
                idsToFetch.add(l.currentApproverId);
            }
        });

        if (idsToFetch.size === 0) return;

        let isMounted = true;
        (async () => {
            try {
                const { data } = await supabase
                    .from('users')
                    .select('id, name, photo_url')
                    .in('id', Array.from(idsToFetch));
                if (data && isMounted) {
                    const newMap: Record<string, { name: string; photoUrl: string | null }> = {};
                    data.forEach((u: any) => {
                        newMap[u.id] = { name: u.name, photoUrl: u.photo_url };
                    });
                    setApproverUsersMap(prev => ({ ...prev, ...newMap }));
                }
            } catch (err) {
                console.warn('Could not fetch approver profiles:', err);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [yearlyData?.leaves, requests, activeRequests]);

    const getLeaveApprovalInfo = useCallback((l: LeaveRequest) => {
        const historyList = (l.approvalHistory || (l as any).approval_history || []) as any[];
        
        // Pick the approved/correction step if present, otherwise the latest history step
        const approvedEntry = [...historyList].reverse().find(h => h && (h.status === 'approved' || h.status === 'correction_made')) 
            || historyList[historyList.length - 1];

        const approverId = approvedEntry?.approverId || approvedEntry?.approver_id || l.currentApproverId || '';
        const userFromMap = approverId ? approverUsersMap[approverId] : null;

        let approverName = approvedEntry?.approverName || approvedEntry?.approver_name || l.currentApproverName || userFromMap?.name || '';
        const approverPhoto = approvedEntry?.approverPhotoUrl || approvedEntry?.approver_photo_url || l.currentApproverPhotoUrl || userFromMap?.photoUrl || null;
        
        if (!approverName || approverName.toLowerCase() === 'approver') {
            if (userFromMap?.name) {
                approverName = userFromMap.name;
            } else if (l.status === 'approved' || l.status === 'correction_made') {
                approverName = 'Authorized Approver';
            }
        }

        let approvedDateStr = '';
        const rawTimestamp = approvedEntry?.timestamp || approvedEntry?.created_at || (l as any).updated_at || (l as any).updatedAt;
        if (rawTimestamp) {
            try {
                approvedDateStr = format(new Date(rawTimestamp), 'dd MMM yyyy');
            } catch {
                approvedDateStr = '';
            }
        }

        return {
            approverId,
            approverName: approverName || 'Approver',
            approverPhoto,
            approvedDateStr,
            status: l.status,
        };
    }, [approverUsersMap]);

    const activeUserHolidays = useMemo(() => {
        const targetYear = viewingDate.getFullYear();
        const cached = yearBundleCacheRef.current.get(targetYear);
        return cached?.selections || userHolidays;
    }, [viewingDate, userHolidays]);

    const activeCompOffLogs = useMemo(() => {
        const targetYear = viewingDate.getFullYear();
        const cached = yearBundleCacheRef.current.get(targetYear);
        return cached?.compOffData || compOffLogs;
    }, [viewingDate, compOffLogs]);

    const formatPreciseHours = (hours: number) => {
        const totalMinutes = Math.round((hours || 0) * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h}h ${m}m`;
    };

    const { officeHolidays, fieldHolidays } = useSettingsStore();

    const adminHolidays = useMemo(() => {
        if (!user) return [];
        // Map user role to admin holiday list
        if (user.role === 'field_staff') return fieldHolidays;
        return officeHolidays;
    }, [user, fieldHolidays, officeHolidays]);

    // ── Earned Leave Accrual Breakup (Monthly + 10-day Milestones) ──
    const earnedLeaveBreakup = useMemo(() => {
        if (!user) return { monthly: [], milestones: [], qualifyingDaysTotal: 0, totalAccrued: 0, currentCycleDays: 0, openingBalance: 0 };

        const allLeaves = (yearlyData?.leaves?.length ? yearlyData.leaves : requests) || [];
        const allEvents = (yearlyData?.events?.length ? yearlyData.events : events) || [];
        const allUserHolidays = activeUserHolidays || [];

        // Attended punch dates
        const attendedDates = new Set<string>();
        allEvents.forEach(e => {
            if (!e || !e.timestamp) return;
            const t = (e.type || '').toLowerCase();
            if (['punch-in', 'site-in', 'check-in', 'site-ot-in', 'punch_in', 'site_in', 'checkin'].includes(t)) {
                attendedDates.add(format(new Date(e.timestamp), 'yyyy-MM-dd'));
            }
        });

        // Holiday dates
        const holidayDates = new Set<string>();
        (adminHolidays || []).forEach((h: any) => {
            if (h && h.date) holidayDates.add(String(h.date).split('T')[0]);
        });
        FIXED_HOLIDAYS.forEach(fh => {
            holidayDates.add(`${viewingDate.getFullYear()}-${fh.date}`);
        });
        allUserHolidays.forEach((uh: any) => {
            const hDate = uh.holidayDate || uh.holiday_date;
            if (hDate) holidayDates.add(String(hDate).split('T')[0]);
        });

        const rawOpeningDate = user.earnedLeaveOpeningDate || (user as any).earned_leave_opening_date || `${viewingDate.getFullYear()}-01-01`;
        const openingBalance = Number(user.earnedLeaveOpeningBalance || (user as any).earned_leave_opening_balance || 0);

        const startDate = startOfDay(new Date(String(rawOpeningDate).replace(/-/g, '/')));
        const today = startOfDay(new Date());
        const isPastMonth = endOfMonth(viewingDate) < today;
        const endDate = isPastMonth ? endOfMonth(viewingDate) : today;

        let totalQualifying = 0;
        let weekWorkDays = 0;

        const milestones: {
            milestoneNumber: number;
            dateReached: string;
            qualifyingDays: number;
            credit: number;
            cumulativeAccrued: number;
        }[] = [];

        const monthlyMap: Record<string, {
            monthKey: string;
            monthName: string;
            workedDays: number;
            holidays: number;
            sundays: number;
            paidLeaves: number;
            qualifyingDays: number;
            accrued: number;
            cumulativeAccrued: number;
        }> = {};

        const cur = new Date(startDate);
        while (cur <= endDate) {
            const dStr = format(cur, 'yyyy-MM-dd');
            const mKey = format(cur, 'yyyy-MM');
            const dow = cur.getDay();

            if (!monthlyMap[mKey]) {
                monthlyMap[mKey] = {
                    monthKey: mKey,
                    monthName: format(cur, 'MMMM yyyy'),
                    workedDays: 0,
                    holidays: 0,
                    sundays: 0,
                    paidLeaves: 0,
                    qualifyingDays: 0,
                    accrued: 0,
                    cumulativeAccrued: 0
                };
            }

            const hasPunch = attendedDates.has(dStr);
            const dayLeave = allLeaves.find(l => {
                const s = (l.status || '').toLowerCase();
                if (s !== 'approved' && s !== 'correction_made') return false;
                return dStr >= l.startDate && dStr <= l.endDate;
            });
            const lType = dayLeave ? (dayLeave.leaveType || (dayLeave as any).leave_type || '').toLowerCase() : '';
            const isHoliday = holidayDates.has(dStr);

            let isQualifying = false;
            if (hasPunch || lType.includes('wfh')) {
                isQualifying = true;
                weekWorkDays++;
                monthlyMap[mKey].workedDays++;
            } else if (isHoliday) {
                isQualifying = true;
                weekWorkDays++;
                monthlyMap[mKey].holidays++;
            } else if (lType.includes('comp') || lType.includes('earned') || lType.includes('sick') || lType.includes('floating')) {
                isQualifying = true;
                weekWorkDays++;
                monthlyMap[mKey].paidLeaves++;
            } else if (dow === 0) {
                if (weekWorkDays >= 4) {
                    isQualifying = true;
                    monthlyMap[mKey].sundays++;
                }
            }

            if (isQualifying) {
                totalQualifying++;
                monthlyMap[mKey].qualifyingDays++;

                if (totalQualifying % 10 === 0) {
                    const milestoneAccrued = Math.round((openingBalance + (totalQualifying * 0.05)) * 10) / 10;
                    milestones.push({
                        milestoneNumber: totalQualifying / 10,
                        dateReached: dStr,
                        qualifyingDays: totalQualifying,
                        credit: 0.5,
                        cumulativeAccrued: milestoneAccrued
                    });
                }
            }

            if (dow === 0) {
                weekWorkDays = 0;
            }

            cur.setDate(cur.getDate() + 1);
        }

        let cumAccrued = openingBalance;
        const monthlyList = Object.values(monthlyMap).map(m => {
            const accrued = Math.round(m.qualifyingDays * 0.05 * 10) / 10;
            cumAccrued = Math.round((cumAccrued + accrued) * 10) / 10;
            return {
                ...m,
                accrued,
                cumulativeAccrued: cumAccrued
            };
        });

        const totalAccrued = balanceDataState?.earnedTotal ?? (Math.round((openingBalance + (totalQualifying * 0.05)) * 10) / 10);

        return {
            monthly: monthlyList,
            milestones,
            qualifyingDaysTotal: totalQualifying,
            totalAccrued,
            currentCycleDays: totalQualifying % 10,
            openingBalance
        };
    }, [user, yearlyData?.leaves, requests, yearlyData?.events, events, activeUserHolidays, adminHolidays, viewingDate, balanceDataState]);

    // ── Earned Leave Chronological Balance Passbook Ledger ──
    const earnedLeaveLedger = useMemo(() => {
        if (!user) return [];
        const openingBalance = Number(user.earnedLeaveOpeningBalance || (user as any).earned_leave_opening_balance || 0);
        const openingDate = user.earnedLeaveOpeningDate || (user as any).earned_leave_opening_date || `${viewingDate.getFullYear()}-01-01`;

        type LedgerEntry = {
            id: string;
            date: string;
            type: 'credit' | 'debit' | 'opening';
            description: string;
            amount: number;
            runningBalance: number;
            details?: string;
            approverName?: string;
            approverPhoto?: string | null;
            approvedDateStr?: string;
            reason?: string;
        };

        const entries: Omit<LedgerEntry, 'runningBalance'>[] = [];

        if (openingBalance > 0) {
            entries.push({
                id: 'opening-bal',
                date: openingDate,
                type: 'opening',
                description: 'Opening Earned Leave Balance',
                amount: openingBalance,
                details: 'Carried forward from previous cycle'
            });
        }

        // Add monthly accruals
        earnedLeaveBreakup.monthly.forEach((m) => {
            if (m.accrued > 0) {
                const [yearNum, monthNum] = m.monthKey.split('-').map(Number);
                const monthEndDate = endOfMonth(new Date(yearNum, monthNum - 1, 1));
                const entryDate = monthEndDate > new Date() ? format(new Date(), 'yyyy-MM-dd') : format(monthEndDate, 'yyyy-MM-dd');
                
                entries.push({
                    id: `monthly-accrual-${m.monthKey}`,
                    date: entryDate,
                    type: 'credit',
                    description: `${m.monthName} Accrual`,
                    amount: m.accrued,
                    details: `Earned from ${m.qualifyingDays} qualifying days (${m.workedDays} worked, ${m.holidays} holidays, ${m.sundays} Sun, ${m.paidLeaves} leaves)`
                });
            }
        });

        // Add leaves taken (debits)
        const allLeaves = (yearlyData?.leaves?.length ? yearlyData.leaves : requests) || [];
        const elLeaves = allLeaves
            .filter(l => {
                const type = (l.leaveType || (l as any).leave_type || '').toLowerCase();
                const status = (l.status || '').toLowerCase();
                return type.includes('earned') && (status === 'approved' || status === 'correction_made');
            });

        elLeaves.forEach((l, idx) => {
            let days = l.dayOption === 'half' ? 0.5 : 1;
            if (l.startDate !== l.endDate && l.dayOption !== 'half') {
                days = differenceInCalendarDays(new Date(l.endDate.replace(/-/g, '/')), new Date(l.startDate.replace(/-/g, '/'))) + 1;
            }
            const { approverName, approverPhoto, approvedDateStr } = getLeaveApprovalInfo(l);
            const isSingle = l.startDate === l.endDate;
            const dateDisplay = isSingle
                ? format(new Date(l.startDate.replace(/-/g, '/')), 'dd MMM yyyy')
                : `${format(new Date(l.startDate.replace(/-/g, '/')), 'dd MMM')} - ${format(new Date(l.endDate.replace(/-/g, '/')), 'dd MMM yyyy')}`;

            entries.push({
                id: l.id || `el-taken-${idx}`,
                date: l.startDate,
                type: 'debit',
                description: `Earned Leave Taken (${dateDisplay})`,
                amount: days,
                details: l.reason || 'Approved leave deduction',
                approverName,
                approverPhoto,
                approvedDateStr,
                reason: l.reason
            });
        });

        // Sort chronologically
        entries.sort((a, b) => {
            const cmp = new Date(a.date.replace(/-/g, '/')).getTime() - new Date(b.date.replace(/-/g, '/')).getTime();
            if (cmp !== 0) return cmp;
            if (a.type === 'credit' && b.type === 'debit') return -1;
            if (a.type === 'debit' && b.type === 'credit') return 1;
            return 0;
        });

        // Compute running balance
        let balance = 0;
        const result: LedgerEntry[] = entries.map(e => {
            if (e.type === 'opening') {
                balance = e.amount;
            } else if (e.type === 'credit') {
                balance = Math.round((balance + e.amount) * 10) / 10;
            } else if (e.type === 'debit') {
                balance = Math.round((balance - e.amount) * 10) / 10;
            }
            return {
                ...e,
                runningBalance: balance
            };
        });

        return result;
    }, [user, viewingDate, earnedLeaveBreakup, yearlyData?.leaves, requests, getLeaveApprovalInfo]);

    // ── Compensatory Off Earned Breakup (Attendance on Sundays/Holidays + Grants) ──
    const compOffEarnedBreakup = useMemo(() => {
        if (!user) return [];
        const openingBalance = Number(user.compOffOpeningBalance || (user as any).comp_off_opening_balance || 0);
        const openingDate = user.compOffOpeningDate || (user as any).comp_off_opening_date || `${viewingDate.getFullYear()}-01-01`;

        type CompOffEarnedItem = {
            id: string;
            date: string;
            credit: number;
            source: string;
            details: string;
            status: string;
            type: 'opening' | 'attendance' | 'manual' | 'correction';
            hoursWorked?: number;
            punchCount?: number;
        };

        const list: CompOffEarnedItem[] = [];

        // 1. Opening Balance
        if (openingBalance > 0) {
            list.push({
                id: 'comp-opening-bal',
                date: openingDate,
                credit: openingBalance,
                source: 'Opening Balance Carry Forward',
                details: 'Carried forward from previous cycle / opening record',
                status: 'Credited',
                type: 'opening'
            });
        }

        const allLeaves = (yearlyData?.leaves?.length ? yearlyData.leaves : requests) || [];
        const allEvents = (yearlyData?.events?.length ? yearlyData.events : events) || [];
        const targetYear = viewingDate.getFullYear();

        // 2. Day key grouping for attendance events
        const dayKeyMap = buildAttendanceDayKeyByEventId(allEvents);
        const eventsByDay: Record<string, AttendanceEvent[]> = {};
        allEvents.forEach(e => {
            if (!e || !e.id) return;
            const key = dayKeyMap[e.id];
            if (key) {
                if (!eventsByDay[key]) eventsByDay[key] = [];
                eventsByDay[key].push(e);
            }
        });

        // 3. Holidays Map (dateStr -> holiday name)
        const holidayMap = new Map<string, string>();
        (adminHolidays || []).forEach((h: any) => {
            if (h && h.date) {
                const dStr = String(h.date).split('T')[0];
                holidayMap.set(dStr, h.name || 'Company Holiday');
            }
        });
        FIXED_HOLIDAYS.forEach(fh => {
            holidayMap.set(`${targetYear}-${fh.date}`, fh.name);
        });
        (activeUserHolidays || []).forEach((uh: any) => {
            const hDate = uh.holidayDate || uh.holiday_date;
            if (hDate) {
                const dStr = String(hDate).split('T')[0];
                holidayMap.set(dStr, uh.name || 'Selected Elective Holiday');
            }
        });

        // 4. Staff Category & Rules
        const roleData = user.role;
        const roleName = (Array.isArray(roleData) ? roleData[0]?.display_name : (roleData as any)?.display_name) || user.role;
        const roleId = user.role || (typeof roleName === 'string' ? roleName.toLowerCase().replace(/\s+/g, '_') : roleName);
        const staffType = getStaffCategory(roleId, user.societyId || (user as any).society_id, attendanceSettings);
        const rules = (attendanceSettings as any)?.[staffType] || (attendanceSettings as any)?.office;

        const weeklyOffDays: number[] = rules?.weeklyOffDays || [0]; // Sunday = 0
        const fullThreshold = rules?.minimumHoursFullDay || rules?.dailyWorkingHours?.min || 8;
        const halfThreshold = rules?.minimumHoursHalfDay || 4;

        const isFemale = ['female', 'ladies'].includes((user.gender || (user as any).gender || '').toLowerCase());
        const isMale = !isFemale;
        const userLocationStr = user.location || (user as any).location_name || (user as any).organization_name || (user as any).society_name || 'Bangalore';
        const isBangaloreStaff = (userLocationStr.toLowerCase().includes('bangalore') || userLocationStr.toLowerCase().includes('bengaluru') || !user.location) && (staffType === 'office' || staffType === 'field');

        // All work dates
        const workDatesSet = new Set<string>();
        Object.keys(eventsByDay).forEach(key => workDatesSet.add(key));
        allLeaves.forEach(l => {
            const lType = String(l.leaveType || (l as any).leave_type || (l as any).type || '').toLowerCase();
            const lStatus = String(l.status || '').toLowerCase();
            if (lType.includes('correction') && (lStatus === 'approved' || lStatus === 'correction_made')) {
                workDatesSet.add(l.startDate);
            }
        });

        // 5. Evaluate each work date in targetYear
        workDatesSet.forEach(dateStr => {
            if (!dateStr.startsWith(String(targetYear))) return;
            const curDate = new Date(dateStr.replace(/-/g, '/'));
            const dow = curDate.getDay();
            const dayName = format(curDate, 'EEEE');
            const isWeeklyOff = weeklyOffDays.includes(dow);
            const holidayName = holidayMap.get(dateStr);

            // Helper for floating holiday validity (Months without floating holidays will be normal working days)
            const isFloatingHolidayValid = (dateToCheck: string) => {
                const fMonths = rules?.floatingHolidayMonths || (rules as any)?.floating_holiday_months;
                if (fMonths && fMonths.length > 0) {
                    const monthIdx = new Date(dateToCheck.replace(/-/g, '/')).getMonth();
                    return fMonths.includes(monthIdx);
                }
                const vFrom = rules?.floatingLeavesValidFrom || (rules as any)?.floating_leaves_valid_from;
                const vTill = rules?.floatingLeavesExpiryDate || (rules as any)?.floating_leaves_expiry_date;
                if (vFrom && dateToCheck < vFrom) return false;
                if (vTill && dateToCheck > vTill) return false;
                return true;
            };

            // Check recurring holiday
            const isRecurringHoliday = (recurringHolidays || []).some(rh => {
                const rhType = rh.type || rh.roleType;
                const rhN = typeof rh.n !== 'undefined' ? rh.n : rh.occurrence;
                const is3rdSat = rh.day === 'Saturday' && rhN === 3;
                if (rhType && rhType !== staffType && !is3rdSat) return false;
                if (rh.day !== dayName) return false;
                if (is3rdSat) {
                    if (!isBangaloreStaff || !isMale) return false;
                    if (!isFloatingHolidayValid(dateStr)) return false;
                }
                if (rhN === 0) return true;
                const nth = Math.ceil(curDate.getDate() / 7);
                return rhN === nth;
            }) || (isBangaloreStaff && isMale && dayName === 'Saturday' && Math.ceil(curDate.getDate() / 7) === 3 && isFloatingHolidayValid(dateStr));

            if (isWeeklyOff || !!holidayName || isRecurringHoliday) {
                // Priority 1: Approved Comp Off Corrections
                const hasCorrection = allLeaves.some(l => {
                    const lType = String(l.leaveType || (l as any).leave_type || (l as any).type || '').toLowerCase();
                    const lStatus = String(l.status || '').toLowerCase();
                    const isCompCorrection = lType.includes('comp') || (lType.includes('correction') && String(l.reason || '').toLowerCase().includes('comp'));
                    return isCompCorrection && (lStatus === 'approved' || lStatus === 'correction_made') && l.startDate === dateStr;
                });

                const dayEvents = eventsByDay[dateStr] || [];
                const { workingHours } = calculateWorkingHours(dayEvents, curDate);
                const hasPunch = dayEvents.some(e => ['punch-in', 'site-in', 'check-in', 'site-ot-in'].includes(String(e.type || '').toLowerCase()));

                let credit = 0;
                let reasonPrefix = '';

                if (hasCorrection) {
                    credit = 1.0;
                    reasonPrefix = 'Approved Attendance Correction';
                } else if (workingHours >= fullThreshold) {
                    credit = 1.0;
                    reasonPrefix = `Full Day (${formatPreciseHours(workingHours)} worked)`;
                } else if (workingHours >= halfThreshold) {
                    credit = 0.5;
                    reasonPrefix = `Half Day (${formatPreciseHours(workingHours)} worked)`;
                } else if (hasPunch) {
                    credit = 0.5;
                    reasonPrefix = `Attendance Recorded (${formatPreciseHours(workingHours)})`;
                }

                if (credit > 0) {
                    const occasion = isWeeklyOff
                        ? `${dayName} (Weekly Off)`
                        : (holidayName ? holidayName : (isRecurringHoliday ? '3rd Saturday (Blue Leave)' : 'Holiday'));

                    list.push({
                        id: `comp-att-${dateStr}`,
                        date: dateStr,
                        credit,
                        source: occasion,
                        details: `${reasonPrefix} • ${dayEvents.length} biometric punch${dayEvents.length === 1 ? '' : 'es'}`,
                        status: 'Earned',
                        type: hasCorrection ? 'correction' : 'attendance',
                        hoursWorked: workingHours,
                        punchCount: dayEvents.length
                    });
                }
            }
        });

        // 6. Manual Grants (deduplicated)
        (activeCompOffLogs || []).forEach((log: any, idx) => {
            if (log.status !== 'earned') return;
            const earnedDate = log.date_earned || log.dateEarned || log.created_at || log.createdAt;
            const dateStr = earnedDate ? String(earnedDate).split('T')[0] : '';
            if (dateStr && workDatesSet.has(dateStr)) return; // deduplicate
            const amt = typeof log.amount === 'number' ? log.amount : (log.day_option === 'half' ? 0.5 : 1);
            list.push({
                id: log.id || `comp-log-${idx}`,
                date: dateStr || `${targetYear}-01-01`,
                credit: amt,
                source: 'HR / Admin Comp Off Grant',
                details: log.reason || 'Manually granted compensatory off credit',
                status: log.status || 'Earned',
                type: 'manual'
            });
        });

        // Sort descending by date (latest first)
        list.sort((a, b) => new Date(b.date.replace(/-/g, '/')).getTime() - new Date(a.date.replace(/-/g, '/')).getTime());
        return list;
    }, [user, viewingDate, yearlyData?.events, events, yearlyData?.leaves, requests, adminHolidays, activeUserHolidays, activeCompOffLogs, recurringHolidays, attendanceSettings]);

    // ── Compensatory Off Chronological Balance Passbook Ledger ──
    const compOffLedger = useMemo(() => {
        if (!user) return [];
        const openingBalance = Number(user.compOffOpeningBalance || (user as any).comp_off_opening_balance || 0);
        const openingDate = user.compOffOpeningDate || (user as any).comp_off_opening_date || `${viewingDate.getFullYear()}-01-01`;

        type CompLedgerEntry = {
            id: string;
            date: string;
            type: 'credit' | 'debit' | 'opening';
            description: string;
            amount: number;
            runningBalance: number;
            rawBalance?: number;
            details?: string;
            approverName?: string;
            approverPhoto?: string | null;
            approvedDateStr?: string;
            reason?: string;
            isCapped?: boolean;
        };

        const entries: Omit<CompLedgerEntry, 'runningBalance'>[] = [];

        if (openingBalance > 0) {
            entries.push({
                id: 'comp-opening-bal',
                date: openingDate,
                type: 'opening',
                description: 'Opening Comp Off Balance',
                amount: openingBalance,
                details: 'Carried forward from previous cycle'
            });
        }

        // Add Comp Off credits from compOffEarnedBreakup (both dynamic attendance and manual grants)
        compOffEarnedBreakup.forEach((item, idx) => {
            if (item.type === 'opening') return; // Opening is already handled above
            entries.push({
                id: item.id || `comp-credit-${idx}`,
                date: item.date,
                type: 'credit',
                description: `Earned: ${item.source}`,
                amount: item.credit,
                details: item.details,
                reason: item.source
            });
        });

        // Add Comp Off leaves taken (debits)
        const allLeaves = (yearlyData?.leaves?.length ? yearlyData.leaves : requests) || [];
        const coLeaves = allLeaves
            .filter(l => {
                const type = (l.leaveType || (l as any).leave_type || '').toLowerCase();
                const status = (l.status || '').toLowerCase();
                return type.includes('comp') && (status === 'approved' || status === 'correction_made');
            });

        coLeaves.forEach((l, idx) => {
            let days = l.dayOption === 'half' ? 0.5 : 1;
            if (l.startDate !== l.endDate && l.dayOption !== 'half') {
                days = differenceInCalendarDays(new Date(l.endDate.replace(/-/g, '/')), new Date(l.startDate.replace(/-/g, '/'))) + 1;
            }
            const { approverName, approverPhoto, approvedDateStr } = getLeaveApprovalInfo(l);
            const isSingle = l.startDate === l.endDate;
            const dateDisplay = isSingle
                ? format(new Date(l.startDate.replace(/-/g, '/')), 'dd MMM yyyy')
                : `${format(new Date(l.startDate.replace(/-/g, '/')), 'dd MMM')} - ${format(new Date(l.endDate.replace(/-/g, '/')), 'dd MMM yyyy')}`;

            entries.push({
                id: l.id || `co-taken-${idx}`,
                date: l.startDate,
                type: 'debit',
                description: `Compensatory Off Taken (${dateDisplay})`,
                amount: days,
                details: l.reason || 'Applied compensatory leave',
                approverName,
                approverPhoto,
                approvedDateStr,
                reason: l.reason
            });
        });

        // Sort chronologically
        entries.sort((a, b) => {
            const cmp = new Date(a.date.replace(/-/g, '/')).getTime() - new Date(b.date.replace(/-/g, '/')).getTime();
            if (cmp !== 0) return cmp;
            if (a.type === 'credit' && b.type === 'debit') return -1;
            if (a.type === 'debit' && b.type === 'credit') return 1;
            return 0;
        });

        // Compute running balance with 4.0d cap
        let balance = 0;
        const result: CompLedgerEntry[] = entries.map(e => {
            let wasCapped = false;
            let rawBal = balance;
            if (e.type === 'opening') {
                balance = Math.min(4.0, e.amount);
                rawBal = e.amount;
            } else if (e.type === 'credit') {
                rawBal = Math.round((balance + e.amount) * 10) / 10;
                if (rawBal > 4.0) {
                    wasCapped = true;
                    balance = 4.0;
                } else {
                    balance = rawBal;
                }
            } else if (e.type === 'debit') {
                rawBal = Math.round((balance - e.amount) * 10) / 10;
                balance = Math.max(0, rawBal);
            }
            return {
                ...e,
                runningBalance: balance,
                rawBalance: rawBal,
                isCapped: wasCapped
            };
        });

        return result;
    }, [user, viewingDate, compOffEarnedBreakup, yearlyData?.leaves, requests, getLeaveApprovalInfo]);

    const fetchData = useCallback(async (isSilent = false, forceRefresh = false) => {
        if (!user) return;
        const seq = ++fetchSeqRef.current;
        
        const targetYear = viewingDate.getFullYear();
        const cachedBundle = (!forceRefresh) ? yearBundleCacheRef.current.get(targetYear) : null;
        
        const dateStr = format(viewingDate, 'yyyy-MM-dd');
        const startOfMonthDate = startOfMonth(viewingDate);
        // Expand range to catch night shifts at the start and end of the month
        const startStr = new Date(startOfWeek(subDays(startOfMonthDate, 15), { weekStartsOn: 1 }).getTime() - 12 * 60 * 60 * 1000).toISOString();
        const endStr = new Date(endOfMonth(viewingDate).getTime() + 36 * 60 * 60 * 1000).toISOString();

        if (cachedBundle) {
            // ── Cache HIT: Immediately populate all calendars from cache (0ms latency, zero spinners!) ──
            const dateStartMs = new Date(startOfWeek(subDays(startOfMonthDate, 15), { weekStartsOn: 1 }).getTime() - 12 * 60 * 60 * 1000).getTime();
            const dateEndMs = new Date(endOfMonth(viewingDate).getTime() + 36 * 60 * 60 * 1000).getTime();
            
            const immediateMonthEvents = cachedBundle.yearlyEvents.filter(e => {
                if (!e || !e.timestamp) return false;
                const t = new Date(e.timestamp).getTime();
                return t >= dateStartMs && t <= dateEndMs;
            });

            setEvents(immediateMonthEvents);
            setYearlyData({
                events: cachedBundle.yearlyEvents,
                userHolidays: cachedBundle.selections,
                leaves: cachedBundle.yearlyRequests
            });
            setAttendanceSettings(cachedBundle.settings);
            setRecurringHolidays(cachedBundle.recurringData);
            setUserHolidays(cachedBundle.selections);
            setUserChildren(cachedBundle.userChildrenData);
            setCompOffLogs(cachedBundle.compOffData);
            setIsCalendarLoading(false);

            // Restore cached month stats (travel, footsteps, snapshot) if available
            const cachedMonthStats = monthStatsCacheRef.current.get(format(viewingDate, 'yyyy-MM'));
            if (cachedMonthStats) {
                setSnapshotData(cachedMonthStats.snapshotData);
                setMonthlyTravelKm(cachedMonthStats.monthlyTravelKm);
                setMonthlyTravelDuration(cachedMonthStats.monthlyTravelDuration);
                setMonthlySteps(cachedMonthStats.monthlySteps);
                setDailyActivityRecords(cachedMonthStats.dailyRecords);
            }
        } else {
            // ── Cache MISS: Show loading spinner only when we don't have this year cached yet ──
            setIsCalendarLoading(true);
            if (!isSilent && !balanceDataState) {
                setIsLoading(true);
            }
        }
        setError(null);
        // Stale-while-revalidate: Do NOT clear existing balance, events, or paydays to null/empty
        // This ensures the user never sees empty skeleton flashes while data is refreshing.

        // ── Performance timer ──
        const t0 = performance.now();
        let tFetchStart = 0;
        let tFetchEnd = 0;

        try {
            const startOfYearStr = startOfYear(viewingDate).toISOString();
            const endOfYearStr = endOfYear(viewingDate).toISOString();

            tFetchStart = performance.now();
            let balanceData: any = null;
            let requestsData: any[] = [];
            let compOffData: any[] = [];
            let eventsData: AttendanceEvent[] = [];
            let effectiveSettings: any = null;
            let recurringData: any[] = [];
            let selections: any[] = [];
            let yearlyEvents: AttendanceEvent[] = [];
            let yearlyRequests: LeaveRequest[] = [];
            let userChildrenData: any[] = [];
            let routePointsData: RoutePoint[] = [];
            let snapshotDataRes: any = null;

            if (cachedBundle) {
                // Background delta fetch: only fetch month-specific items
                const [balRes, reqRes, evRes, rpRes, snapRes] = await Promise.all([
                    api.getLeaveBalancesForUser(user.id, format(endOfMonth(viewingDate), 'yyyy-MM-dd')).catch(err => { console.warn('Leave balance fetch failed (offline?):', err.message); return null; }),
                    api.getLeaveRequests({
                        userId: user.id,
                        status: filter === 'all' ? undefined : filter
                    }).then(res => res.data).catch(() => []),
                    api.getAttendanceEvents(user.id, startStr, endStr).catch(err => { console.warn('Attendance events fetch failed (offline?):', err.message); return []; }),
                    api.getRoutePoints(user.id, startStr, endStr).catch(() => [] as RoutePoint[]),
                    api.getMonthSnapshot(user.id, viewingDate.getFullYear(), viewingDate.getMonth() + 1).catch(() => null)
                ]);

                balanceData = balRes;
                requestsData = reqRes;
                eventsData = evRes;
                routePointsData = rpRes;
                snapshotDataRes = snapRes;

                // Merge latest month events into cached yearly events
                if (eventsData && eventsData.length > 0) {
                    const existingIds = new Set(cachedBundle.yearlyEvents.map(e => e.id));
                    let hasNew = false;
                    eventsData.forEach(e => {
                        if (!existingIds.has(e.id)) {
                            cachedBundle.yearlyEvents.push(e);
                            existingIds.add(e.id);
                            hasNew = true;
                        }
                    });
                    if (hasNew) {
                        cachedBundle.yearlyEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        setYearlyData({
                            events: [...cachedBundle.yearlyEvents],
                            userHolidays: cachedBundle.selections,
                            leaves: cachedBundle.yearlyRequests
                        });
                    }
                }
                yearlyEvents = cachedBundle.yearlyEvents;
                yearlyRequests = cachedBundle.yearlyRequests;
                compOffData = cachedBundle.compOffData;
                effectiveSettings = cachedBundle.settings;
                recurringData = cachedBundle.recurringData;
                selections = cachedBundle.selections;
                userChildrenData = cachedBundle.userChildrenData;
            } else {
                // Full Year Bundle Fetch (Cache MISS)
                const [balRes, reqRes, compRes, evRes, setRes, recRes, selRes, yEvRes, yReqRes, uChildRes, rpRes, snapRes] = await Promise.all([
                    api.getLeaveBalancesForUser(user.id, format(endOfMonth(viewingDate), 'yyyy-MM-dd')).catch(err => { console.warn('Leave balance fetch failed (offline?):', err.message); return null; }),
                    api.getLeaveRequests({
                        userId: user.id,
                        status: filter === 'all' ? undefined : filter
                    }).then(res => res.data).catch(() => []),
                    api.getCompOffLogs(user.id).catch(() => []),
                    api.getAttendanceEvents(user.id, startStr, endStr).catch(err => { console.warn('Attendance events fetch failed (offline?):', err.message); return []; }),
                    api.getAttendanceSettings().catch(err => { console.warn('Attendance settings fetch failed (offline?):', err.message); return null; }),
                    api.getRecurringHolidays().catch(() => []),
                    api.getUserHolidays(user.id).catch(() => []),
                    api.getAttendanceEvents(user.id, startOfYearStr, endOfYearStr).catch(() => []),
                    api.getLeaveRequests({
                        userId: user.id,
                        status: 'approved',
                        startDate: startOfYearStr,
                        endDate: endOfYearStr
                    }).then(res => res.data).catch(() => []),
                    api.getUserChildren(user.id).catch(() => []),
                    api.getRoutePoints(user.id, startStr, endStr).catch(() => [] as RoutePoint[]),
                    api.getMonthSnapshot(user.id, viewingDate.getFullYear(), viewingDate.getMonth() + 1).catch(() => null)
                ]);

                balanceData = balRes;
                requestsData = reqRes;
                compOffData = compRes;
                eventsData = evRes;
                const fallbackSettings = useSettingsStore.getState().attendance || {};
                effectiveSettings = (setRes && Object.keys(setRes).length > 0) ? setRes : fallbackSettings;
                recurringData = recRes;
                selections = selRes;
                yearlyEvents = yEvRes || [];
                yearlyRequests = yReqRes || [];
                userChildrenData = (uChildRes as UserChild[]) || [];
                routePointsData = rpRes;
                snapshotDataRes = snapRes;

                // Store into cache
                yearBundleCacheRef.current.set(targetYear, {
                    yearlyEvents: yearlyEvents || [],
                    yearlyRequests: yearlyRequests || [],
                    selections: selections || [],
                    compOffData: compOffData || [],
                    settings: effectiveSettings,
                    recurringData: recurringData || [],
                    userChildrenData: (userChildrenData as UserChild[]) || []
                });
            }
            tFetchEnd = performance.now();

            if (seq !== fetchSeqRef.current) {
                // A newer month fetch has already started; discard this stale response
                return;
            }

            if (balanceData) {
                setBalance(balanceData);
            } else {
                // Generate safe fallback balance from user profile so cards are never stuck loading
                const fallbackBal: LeaveBalance = {
                    userId: user.id,
                    earnedTotal: Number(user.earnedLeaveOpeningBalance || 0),
                    earnedUsed: 0,
                    earnedPending: 0,
                    sickTotal: Number(user.sickLeaveOpeningBalance || 0),
                    sickUsed: 0,
                    sickPending: 0,
                    floatingTotal: Number(user.floatingLeaveOpeningBalance || 1),
                    floatingUsed: 0,
                    floatingPending: 0,
                    compOffTotal: Number(user.compOffOpeningBalance || 0),
                    compOffUsed: 0,
                    compOffPending: 0,
                    pinkTotal: 1,
                    pinkUsed: 0,
                    pinkPending: 0,
                    childCareTotal: Number(user.childCareLeaveOpeningBalance || 0),
                    childCareUsed: 0,
                    childCarePending: 0,
                    maternityTotal: 0,
                    maternityUsed: 0,
                    maternityPending: 0,
                    paternityTotal: 0,
                    paternityUsed: 0,
                    paternityPending: 0,
                    otHoursThisMonth: 0,
                    expiryStates: {
                        earned: false,
                        sick: false,
                        floating: false,
                        compOff: false
                    }
                };
                setBalance(prev => prev || fallbackBal);
            }

            setRequests(requestsData || []);
            setCompOffLogs(compOffData || []);
            setEvents(eventsData || []);
            setAttendanceSettings(effectiveSettings);
            setRecurringHolidays(recurringData || []);
            setUserHolidays(selections || []);
            setUserChildren((userChildrenData as UserChild[]) || []);
            setYearlyData({
                events: yearlyEvents || [],
                userHolidays: selections || [],
                leaves: yearlyRequests || []
            });
            
            if (snapshotDataRes) {
                const summary = snapshotDataRes.summary || {};
                
                if (summary.totalTravelDistance === undefined || summary.totalTravelDistance === null) {
                    let calculatedTravelKm = 0;
                    if (Array.isArray(snapshotDataRes.dailyData)) {
                        calculatedTravelKm = (snapshotDataRes.dailyData as any[]).reduce(
                            (sum: number, day: any) => sum + (day.travelDistance || 0),
                            0
                        );
                    } else if (snapshotDataRes.dailyData) {
                        calculatedTravelKm = (Object.values(snapshotDataRes.dailyData) as any[]).reduce(
                            (sum: number, day: any) => sum + (day.travelDistance || 0),
                            0
                        );
                    }
                    summary.totalTravelDistance = calculatedTravelKm;
                }
                
                if (summary.totalTravelDuration === undefined || summary.totalTravelDuration === null) {
                    let calculatedTravelDuration = 0;
                    if (Array.isArray(snapshotDataRes.dailyData)) {
                        calculatedTravelDuration = (snapshotDataRes.dailyData as any[]).reduce(
                            (sum: number, day: any) => sum + (day.travelDuration || 0),
                            0
                        );
                    } else if (snapshotDataRes.dailyData) {
                        calculatedTravelDuration = (Object.values(snapshotDataRes.dailyData) as any[]).reduce(
                            (sum: number, day: any) => sum + (day.travelDuration || 0),
                            0
                        );
                    }
                    summary.totalTravelDuration = calculatedTravelDuration;
                }
                
                if (summary.totalPayableDays === undefined || summary.totalPayableDays === null) {
                    summary.totalPayableDays = summary.present ?? 0;
                }
                
                if (summary.totalSteps === undefined || summary.totalSteps === null) {
                    let calculatedSteps = 0;
                    if (Array.isArray(snapshotDataRes.dailyData)) {
                        calculatedSteps = (snapshotDataRes.dailyData as any[]).reduce(
                            (sum: number, day: any) => sum + (day.totalSteps || 0),
                            0
                        );
                    } else if (snapshotDataRes.dailyData) {
                        calculatedSteps = (Object.values(snapshotDataRes.dailyData) as any[]).reduce(
                            (sum: number, day: any) => sum + (day.totalSteps || 0),
                            0
                        );
                    }
                    summary.totalSteps = calculatedSteps;
                }
                
                snapshotDataRes.summary = summary;
                setSnapshotData(snapshotDataRes);
            } else {
                setSnapshotData(null);
            }
            
            // Refetch current user profile to get latest persistent OT fields (bank, monthly)
            // This ensures we have the most up-to-date role and balance information
            const freshUser = await supabase
                .from('users')
                .select('*, role:roles(display_name), companies!users_society_id_fkey(location)')
                .eq('id', user.id)
                .single();

            let currentUserData = user;
            if (freshUser.data) {
                const data = freshUser.data;
                const roleData = data.role;
                const rawRoleName = (Array.isArray(roleData) ? roleData[0]?.display_name : (roleData as any)?.display_name) || data.role_id;
                const normalizedRole = typeof rawRoleName === 'string' ? rawRoleName.toLowerCase().replace(/\s+/g, '_') : rawRoleName;
                
                let resolvedLocation = '';
                if (data.companies) {
                    resolvedLocation = Array.isArray(data.companies) ? data.companies[0]?.location : (data.companies as any)?.location;
                }
                currentUserData = {
                    ...api.toCamelCase(data),
                    role: normalizedRole,
                    roleId: data.role_id,
                    location: resolvedLocation || data.location
                };
                
                // Update store asynchronously to avoid interrupting current calculation
                setTimeout(() => {
                    useAuthStore.getState().updateUserProfile(currentUserData);
                }, 0);
            }

            // Map User Role to Staff Category (office, field, site)
            const staffCategory = getStaffCategory(currentUserData.roleId || currentUserData.role || '', currentUserData.societyId, effectiveSettings);

            const userRules = effectiveSettings[staffCategory] || {};
            const shiftThreshold = userRules?.dailyWorkingHours?.max || 8;
            setThreshold(shiftThreshold);

            // Group events by "Business Day" using normalized logic
            const dayKeyMap = buildAttendanceDayKeyByEventId(eventsData);
            const dayLogs: Record<string, AttendanceEvent[]> = {};
            eventsData.forEach(e => {
                const key = dayKeyMap[e.id];
                if (!dayLogs[key]) dayLogs[key] = [];
                dayLogs[key].push(e);
            });

            let totalOTHours = 0;
            let totalShortfallMinutes = 0;
            let totalTravelKm = 0;
            let totalTravelDurationMins = 0;
            let totalMonthlySteps = 0;
            let siteOtCount = 0;
            let breakdownCount = 0;
            const targetHours = 8;

            const viewMonthStart = startOfMonth(viewingDate);
            const viewMonthEnd = endOfMonth(viewingDate);
            
            const dailyRecords: any[] = [];

            Object.entries(dayLogs).forEach(([dateStr, dayEvents]) => {
                const date = new Date(dateStr);
                
                if (date >= viewMonthStart && date <= viewMonthEnd) {
                    const dayRoutePoints = (routePointsData || []).filter((p: RoutePoint) => {
                        if (!p.timestamp) return false;
                        const pDate = new Date(p.timestamp);
                        return isSameDay(pDate, date) || format(pDate, 'yyyy-MM-dd') === dateStr;
                    });
                    const travelRes = calculateDailyPathTravelKm(dayEvents, dayRoutePoints);
                    totalTravelKm += travelRes.distance;
                    totalTravelDurationMins += travelRes.duration;
                    // The phone pedometer is a cumulative counter (like a total odometer).
                    // The LAST (or highest) step value recorded during the day is the best
                    // estimate of total steps walked, regardless of which event type it came from.
                    // We take the max across ALL event types to handle null punch-out steps.
                    const allStepValues = (dayEvents as AttendanceEvent[])
                        .map(e => e.steps ?? 0)
                        .filter(s => s > 0);
                    let daySteps = allStepValues.length > 0 ? Math.max(...allStepValues) : 0;
                        
                    // Deduct fake steps generated by phone pedometer during vehicle travel
                    let vDist = travelRes.vehicleDistance;
                    if (!vDist && travelRes.distance > 3) {
                        // Fallback: If no telemetry is available to calculate speed (or average speed was too low due to missing points),
                        // but total distance is large, assume most travel beyond a 3km walking baseline was done via vehicle.
                        vDist = travelRes.distance - 3;
                    }
                    
                    if (vDist && vDist > 0) {
                        // Phone pedometers usually don't register full walking steps while driving. 
                        // To avoid wiping out legitimate steps, cap the deduction to at most 20% of recorded steps.
                        const fakeSteps = Math.min(Math.floor(daySteps * 0.20), Math.floor(vDist * 25));
                        daySteps = Math.max(0, daySteps - fakeSteps);
                    }
                    
                    totalMonthlySteps += daySteps;
                    
                    const sortedEvents = [...dayEvents].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    let startTime = null;
                    let endTime = null;
                    let startLocation = null;
                    let endLocation = null;
                    
                    if (sortedEvents.length > 0) {
                        startTime = sortedEvents[0].timestamp;
                        startLocation = sortedEvents[0].locationName || 'Unknown Location';
                        endTime = sortedEvents[sortedEvents.length - 1].timestamp;
                        endLocation = sortedEvents[sortedEvents.length - 1].locationName || 'Unknown Location';
                    }
                    
                    dailyRecords.push({
                        dateStr,
                        travelKm: travelRes.distance,
                        travelDuration: travelRes.duration,
                        steps: daySteps,
                        startTime,
                        endTime,
                        startLocation,
                        endLocation
                    });

                    const { workingHours } = calculateWorkingHours(dayEvents, date);
                    
                    // OT
                    if (workingHours > shiftThreshold) {
                        totalOTHours += (workingHours - shiftThreshold);
                    }

                    // Shortfall - Skip Sundays
                    if (getDay(date) !== 0 && workingHours < targetHours) {
                        totalShortfallMinutes += (targetHours * 60) - (workingHours * 60);
                    }

                    // Site OT & Breakdown Visits
                    const inEvent = dayEvents.find(e => e.type === 'site-ot-in');
                    if (inEvent) {
                        const outEvent = eventsData.find(e => e.type === 'site-ot-out' && new Date(e.timestamp) > new Date(inEvent.timestamp));
                        let mins = 0;
                        if (outEvent) {
                            mins = Math.max(0, differenceInMinutes(new Date(outEvent.timestamp), new Date(inEvent.timestamp)));
                        } else if (isSameDay(date, new Date())) {
                            mins = Math.max(0, differenceInMinutes(new Date(), new Date(inEvent.timestamp)));
                        }
                        if (mins > 0 && mins <= 5 * 60) {
                            breakdownCount += 1;
                        } else if (mins > 5 * 60) {
                            siteOtCount += 1;
                        }
                    }
                }
            });

            setCalculatedOTHours(parseFloat(totalOTHours.toFixed(1)));
            setCalculatedShortfallMins(totalShortfallMinutes);
            setCalculatedSiteOtDays(siteOtCount);
            setCalculatedBreakdownVisits(breakdownCount);
            setMonthlyTravelKm(Number(totalTravelKm.toFixed(2)));
            setMonthlyTravelDuration(totalTravelDurationMins);
            setMonthlySteps(totalMonthlySteps);
            // If snapshotData contains dailyData, synchronize dailyActivityRecords with snapshot values
            if (snapshotDataRes?.dailyData && Array.isArray(snapshotDataRes.dailyData) && snapshotDataRes.dailyData.length > 0) {
                const yearMonthPrefix = format(viewingDate, 'yyyy-MM');
                const snapMap = new Map<string, any>();
                snapshotDataRes.dailyData.forEach((sd: any) => {
                    const dayNum = typeof sd.date === 'number' ? String(sd.date).padStart(2, '0') : String(sd.date || '').padStart(2, '0');
                    snapMap.set(`${yearMonthPrefix}-${dayNum}`, sd);
                });

                dailyRecords.forEach(r => {
                    const snapRow = snapMap.get(r.dateStr);
                    if (snapRow) {
                        if (snapRow.travelDistance !== undefined && snapRow.travelDistance > 0) {
                            r.travelKm = snapRow.travelDistance;
                        }
                        if (snapRow.totalSteps !== undefined && snapRow.totalSteps > 0) {
                            r.steps = snapRow.totalSteps;
                        }
                    }
                });
            }

            const currentSortedRecords = dailyRecords.sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());
            setDailyActivityRecords(currentSortedRecords);
            monthStatsCacheRef.current.set(format(viewingDate, 'yyyy-MM'), {
                snapshotData: snapshotDataRes,
                monthlyTravelKm: Number(totalTravelKm.toFixed(2)),
                monthlyTravelDuration: totalTravelDurationMins,
                monthlySteps: totalMonthlySteps,
                dailyRecords: currentSortedRecords
            });
            setActiveHolidayPool(userRules?.holidayPool || HOLIDAY_SELECTION_POOL);
            setIsOtConversionEnabled(userRules?.enableOtToCompOffConversion || false);
            setIsShortfallEnabled(userRules?.enableShortfall || false);
            setIsHolidaySelectionEnabled(userRules?.enableCustomHolidays || false);

            // ── ALL state is now set ── unlock the dashboard in the same React batch
            setIsLoading(false);

        } catch (err: any) {
            console.error('Error fetching dashboard data:', err);
            let message = 'Failed to load leave data.';
            if (err && typeof err.message === 'string') {
                if (err.message.includes('relation "leave_requests" does not exist')) {
                    message = 'Database setup error: The "leave_requests" table is missing.';
                } else {
                    message = err.message;
                }
            }
            setError(message);
            setToast({ message, type: 'error' });
            // Also unlock on error so the page doesn’t stay stuck on loader
            setIsLoading(false);
        } finally {
            // Performance log only — no state changes here
            const tTotal = performance.now() - t0;
            const tFetch   = tFetchEnd - tFetchStart;
            const tProcess = tFetchEnd > 0 ? tTotal - tFetch : null;

            console.groupCollapsed(
                `%c⏱ LeaveDashboard Load  %c${tTotal.toFixed(0)} ms total`,
                'color:#888; font-weight:normal',
                `color:${tTotal < 1500 ? '#22c55e' : tTotal < 3000 ? '#f59e0b' : '#ef4444'}; font-weight:bold`
            );
            if (tFetchEnd > 0)     console.log(`  📡 API fetch (Promise.all): ${tFetch.toFixed(0)} ms`);
            if (tProcess !== null) console.log(`  ⚙️  Post-processing:         ${tProcess.toFixed(0)} ms`);
            console.log(`  🕐 Total load time:         ${tTotal.toFixed(0)} ms`);
            console.groupEnd();
            if (seq === fetchSeqRef.current) {
                setIsCalendarLoading(false);
            }
        }
    }, [user?.id, user?.role, filter, viewingDate, isCheckedIn, dailyPunchCount]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Refresh when app resumes from background on native Android/iOS
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        let listenerHandle: any = null;
        CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                console.log('[LeaveDashboard] App resumed from background - refreshing data silently');
                fetchData(true);
            }
        }).then(h => {
            listenerHandle = h;
        }).catch(err => {
            console.warn('Failed to register appStateChange listener:', err);
        });

        return () => {
            if (listenerHandle?.remove) {
                listenerHandle.remove();
            }
        };
    }, [fetchData]);


    const handleNewRequest = () => {
        navigate('/leaves/apply');
    };
    
    const handleEditRequest = (id: string) => {
        navigate(`/leaves/apply?edit=${id}`);
    };

    const handleCancelRequest = async (id: string) => {
        if (!window.confirm('Are you sure you want to withdraw this leave request?')) return;
        
        setActioningRequestId(id);
        try {
            await api.withdrawLeaveRequest(id, user!.id);
            setToast({ message: 'Leave request withdrawn successfully.', type: 'success' });
            fetchData(false, true);
        } catch (error) {
            setToast({ message: 'Failed to withdraw leave request.', type: 'error' });
        } finally {
            setActioningRequestId(null);
        }
    };

    const handleDeleteRequest = async (id: string) => {
        if (!window.confirm('Are you sure you want to permanently delete this record? This action cannot be undone.')) return;
        
        setActioningRequestId(id);
        try {
            await api.deleteLeaveRequest(id);
            setToast({ message: 'Record deleted successfully.', type: 'success' });
            fetchData(false, true);
        } catch (error) {
            setToast({ message: 'Failed to delete record.', type: 'error' });
        } finally {
            setActioningRequestId(null);
        }
    };

    // Early departure permission deductions calculation for viewing month (MUST BE BEFORE EARLY RETURN FOR REACT HOOK RULES)
    const staffCategoryForEarlyDep = user ? getStaffCategory(user.roleId || user.role || '', user.societyId || user.organizationId, attendanceSettings) : 'office';
    const userRulesForEarlyDep = attendanceSettings ? attendanceSettings[staffCategoryForEarlyDep] : null;

    const viewingMonthStr = format(startOfMonth(viewingDate), 'yyyy-MM');

    const earlyDepartureDeductionsList = useMemo(() => {
        if (!events || events.length === 0) return [];
        const targetShiftMins = (userRulesForEarlyDep?.minimumHoursFullDay || 8) * 60;
        return getEarlyDepartureDeductions(events, targetShiftMins, requests, yearlyData?.leaves || [], viewingMonthStr);
    }, [events, userRulesForEarlyDep, requests, yearlyData, viewingMonthStr]);

    const totalEarlyDepartureMins = useMemo(() => {
        return earlyDepartureDeductionsList.reduce((sum, ed) => sum + ed.earlyMins, 0);
    }, [earlyDepartureDeductionsList]);

    const totalPermissionMinsUsed = useMemo(() => {
        let explicitMins = 0;
        const monthStartStr = format(startOfMonth(viewingDate), 'yyyy-MM');
        requests.forEach(r => {
            if (r.leaveType === 'Permission' && (r.status === 'approved' || r.status === 'correction_made') && r.startDate.startsWith(monthStartStr)) {
                const toMins = (t: string) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                if (r.correctionDetails?.punchIn && r.correctionDetails?.punchOut) {
                    let p1 = toMins(r.correctionDetails.punchOut) - toMins(r.correctionDetails.punchIn);
                    if (p1 < 0) p1 += 24 * 60;
                    explicitMins += Math.max(0, p1);
                } else if (r.correctionDetails?.permissionMinutes) {
                    explicitMins += Number(r.correctionDetails.permissionMinutes);
                }
            }
        });
        // Strict 3-hour (180 mins) monthly pool limit
        return Math.min(180, explicitMins + totalEarlyDepartureMins);
    }, [requests, viewingDate, totalEarlyDepartureMins]);

    const getMonthlyPermissionSummary = useCallback((reqDateStr: string) => {
        if (!reqDateStr) return { usedMins: 0, remainingMins: 180, formattedRemaining: '3h 00m', formattedUsed: '0h 00m' };
        
        const monthKey = reqDateStr.substring(0, 7);
        
        let explicitMins = 0;
        requests.forEach(r => {
            const rMonthKey = r.startDate ? r.startDate.substring(0, 7) : '';
            const rType = String(r.leaveType || (r as any).leave_type || '').toLowerCase();
            if (rMonthKey === monthKey && rType.includes('permission') && ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(String(r.status || '').toLowerCase())) {
                const toMins = (t: string) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                if (r.correctionDetails?.punchIn && r.correctionDetails?.punchOut) {
                    let p1 = toMins(r.correctionDetails.punchOut) - toMins(r.correctionDetails.punchIn);
                    if (p1 < 0) p1 += 24 * 60;
                    explicitMins += Math.max(0, p1);
                } else if (r.correctionDetails?.permissionMinutes) {
                    explicitMins += Number(r.correctionDetails.permissionMinutes);
                } else if (r.reason) {
                    explicitMins += parsePermissionDurationFromReason(r.reason);
                }
            }
        });

        const staffCat = user ? getStaffCategory(user.roleId || user.role || '', user.societyId || user.organizationId, attendanceSettings) : 'office';
        const uRules = attendanceSettings ? attendanceSettings[staffCat] : null;
        const targetShiftMins = (uRules?.minimumHoursFullDay || 8) * 60;
        const earlyDeps = getEarlyDepartureDeductions(events || [], targetShiftMins, requests, yearlyData?.leaves || [], monthKey);
        const edMins = earlyDeps.reduce((sum, ed) => sum + ed.earlyMins, 0);

        // Strict 3h (180 mins) monthly limit
        const totalUsedMins = Math.min(180, explicitMins + edMins);
        const monthlyLimitMins = 180;
        const remainingMins = Math.max(0, monthlyLimitMins - totalUsedMins);

        const formatMins = (m: number) => {
            const hrs = Math.floor(m / 60);
            const mins = m % 60;
            return `${hrs}h ${String(mins).padStart(2, '0')}m`;
        };

        return {
            usedMins: totalUsedMins,
            remainingMins,
            formattedRemaining: formatMins(remainingMins),
            formattedUsed: formatMins(totalUsedMins),
            limitFormatted: '3h 00m'
        };
    }, [requests, user, attendanceSettings, events, yearlyData]);

    const autoEarlyDepartureRequests: LeaveRequest[] = useMemo(() => {
        return earlyDepartureDeductionsList
            .filter(ed => ed.earlyMins > 0)
            .map(ed => {
                const hasExisting = requests.some(r => {
                    const rType = String(r.leaveType || (r as any).leave_type || '').toLowerCase();
                    return r.startDate === ed.dateStr && rType.includes('permission');
                });
                if (hasExisting) return null;

                const userName = user?.name || (user as any)?.fullName || 'Self';
                return {
                    id: `early-dep-${ed.dateStr}`,
                    userId: user?.id || '',
                    userName,
                    userRole: user?.role || '',
                    leaveType: 'Request for Permission (RP)',
                    startDate: ed.dateStr,
                    endDate: ed.dateStr,
                    dayOption: 'full',
                    reason: `Early Departure Deduction (${ed.formattedWorked} worked • -${ed.earlyMins}m from 3h pool)`,
                    status: 'approved',
                    createdAt: `${ed.dateStr}T${ed.punchOutTime || '17:00'}:00.000Z`,
                    correctionDetails: {
                        punchIn: ed.punchOutTime,
                        punchOut: ed.permissionEndTime,
                        permissionMinutes: ed.earlyMins,
                        reason: `Leaving work early (${ed.permissionTimeRange}) deducted from monthly permission pool.`
                    },
                    isAutoDeducted: true
                } as unknown as LeaveRequest;
            }).filter(Boolean) as LeaveRequest[];
    }, [earlyDepartureDeductionsList, requests, user]);

    const allDisplayRequests = useMemo(() => {
        const combined = [...requests, ...autoEarlyDepartureRequests];
        combined.sort((a, b) => new Date(b.startDate.replace(/-/g, '/')).getTime() - new Date(a.startDate.replace(/-/g, '/')).getTime());
        
        let filtered = combined;
        if (dateScope === 'month') {
            const mStart = format(startOfMonth(viewingDate), 'yyyy-MM-dd');
            const mEnd = format(endOfMonth(viewingDate), 'yyyy-MM-dd');
            filtered = filtered.filter(r => {
                const sDate = r.startDate || '';
                const eDate = r.endDate || r.startDate || '';
                return sDate <= mEnd && eDate >= mStart;
            });
        }

        if (filter === 'all') return filtered;
        return filtered.filter(r => r.status === filter);
    }, [requests, autoEarlyDepartureRequests, filter, dateScope, viewingDate]);

    // ── Smooth fade-in: double-rAF guarantees the opacity:0 frame is painted
    // before we flip to opacity:1, so CSS transition always fires cleanly.
    useEffect(() => {
        if (!isLoading) {
            setIsContentVisible(false);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setIsContentVisible(true));
            });
        }
    }, [isLoading]);

    // Hard guard — content never renders while fetching, so no blank flash possible
    if (isLoading) {
        return <LoadingScreen message="Establishing secure uplink..." />;
    }



    const formatTabName = (tab: string) => tab.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const filterTabs: Array<LeaveRequestStatus | 'all'> = ['all', 'pending_manager_approval', 'pending_hr_confirmation', 'approved', 'rejected'];
    const isFemale = ['female', 'ladies'].includes((user?.gender || '').toLowerCase());
    const isMale = !isFemale;

    const isFloatingHolidayValidForViewingDate = () => {
        if (!attendanceSettings || !user) return false;
        const staffCategory = getStaffCategory(user.roleId || user.role || '', user.societyId, attendanceSettings);
        const categorySettings = (attendanceSettings as any)?.[staffCategory];
        if (!categorySettings) return false;

        // PRIORITY 1: If floatingHolidayMonths array is set → it is the SOLE gate.
        if (categorySettings.floatingHolidayMonths && categorySettings.floatingHolidayMonths.length > 0) {
            const monthIdx = viewingDate.getMonth();
            return categorySettings.floatingHolidayMonths.includes(monthIdx);
        }

        // PRIORITY 2 (fallback): No month array → use validFrom/validTill.
        const viewingDateStr = format(viewingDate, 'yyyy-MM-dd');
        const validFrom = categorySettings.floatingLeavesValidFrom;
        const validTill = categorySettings.floatingLeavesExpiryDate;
        if (validFrom && viewingDateStr < validFrom) return false;
        if (validTill && viewingDateStr > validTill) return false;
        return true;
    };

    const getBlueLeaveStatusForViewingDate = () => {
        const rawJoining = user?.joiningDate || (user as any)?.joining_date || user?.createdAt || (user as any)?.created_at;
        let employmentStartDate: Date | null = rawJoining ? startOfDay(new Date(String(rawJoining).replace(/-/g, '/'))) : null;
        if (events && events.length > 0) {
            const punchDates = events
                .filter(e => e && e.timestamp)
                .map(e => startOfDay(new Date(e.timestamp)).getTime());
            if (punchDates.length > 0) {
                const earliestPunchMs = Math.min(...punchDates);
                const earliestPunchDate = new Date(earliestPunchMs);
                if (!employmentStartDate || earliestPunchDate < employmentStartDate) {
                    employmentStartDate = earliestPunchDate;
                }
            }
        }
        if (employmentStartDate && endOfMonth(viewingDate) < employmentStartDate) {
            return { total: 0, used: 0, pending: 0, available: 0, description: 'Not applicable (Before joining date)' };
        }

        const isValid = isFloatingHolidayValidForViewingDate();
        if (!isValid) return { total: 0, used: 0, pending: 0, available: 0, description: 'Not applicable for this period' };
        
        let total = 1;
        if (attendanceSettings && user) {
             const staffCategory = getStaffCategory(user.roleId || user.role || '', user.societyId, attendanceSettings);
             const categorySettings = (attendanceSettings as any)?.[staffCategory];
             if (categorySettings && categorySettings.monthlyFloatingLeaves !== undefined) {
                 total = categorySettings.monthlyFloatingLeaves;
             }
        }

        let used = 0;
        let pending = 0;

        const monthStart = startOfMonth(viewingDate);
        const monthEnd = endOfMonth(viewingDate);
        
        let thirdSaturday: Date | null = null;
        const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        let count = 0;
        for (const day of daysInMonth) {
            if (day.getDay() === 6) { 
                count++;
                if (count === 3) {
                    thirdSaturday = day;
                    break;
                }
            }
        }

        const today = new Date();
        const thirdSatPassed = thirdSaturday && startOfDay(thirdSaturday) <= startOfDay(today);
        const isPastMonth = endOfMonth(viewingDate) < startOfDay(today);
        
        const allRelevantLeaves = [...(yearlyData?.leaves || []), ...requests].filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);

        allRelevantLeaves.forEach(req => {
            let type = (req.leaveType || '').toLowerCase();
            const reqStart = new Date(req.startDate.replace(/-/g, '/'));
            const is3rdSat = reqStart.getDay() === 6 && Math.ceil(reqStart.getDate() / 7) === 3;
            if (is3rdSat && isMale && (type.includes('sick') || type === 'sl' || type === 's/l')) {
                type = 'floating';
            }
            if (type.includes('floating') || type === 'fh' || type === 'blue leave' || type === 'blue') {
                if (reqStart >= monthStart && reqStart <= monthEnd) {
                    const amount = req.dayOption === 'half' ? 0.5 : (differenceInCalendarDays(new Date(req.endDate.replace(/-/g, '/')), reqStart) + 1);
                    if (req.status === 'approved' || req.status === 'correction_made') used += amount;
                    if (req.status === 'pending_manager_approval' || req.status === 'pending_hr_confirmation') pending += amount;
                }
            }
        });

        let workedOn3rdSat = false;
        if (thirdSaturday) {
            const thirdSatStr = format(thirdSaturday, 'yyyy-MM-dd');
            workedOn3rdSat = events.some(e => {
                const eDate = format(new Date(e.timestamp), 'yyyy-MM-dd');
                const eventType = String(e.type || '').toLowerCase();
                return eDate === thirdSatStr && (
                    eventType === 'punch-in' || eventType === 'check-in' ||
                    eventType === 'punch_in' || eventType === 'checkin' ||
                    eventType === 'site-in' || eventType === 'site_in'
                );
            });
            // Also check approved Blue Leave Work requests or corrections
            if (!workedOn3rdSat) {
                workedOn3rdSat = allRelevantLeaves.some(req => {
                    const reqType = (req.leaveType || '').toLowerCase();
                    const reqDate = req.startDate;
                    return reqDate === thirdSatStr && 
                           (req.status === 'approved' || req.status === 'correction_made') && 
                           (reqType.includes('blue leave work') || reqType.includes('correction') || reqType.includes('comp'));
                });
            }
        }

        // Business Rules:
        // 1. Before 3rd Saturday (in current/future month): Employee has NOT worked on 3rd Saturday yet -> 0/1 (0 available).
        // 2. On / After 3rd Saturday:
        //    - Worked on 3rd Saturday -> 1/1 earned. If user took Blue Leave in same month -> deduct used/pending.
        //    - Absent on 3rd Saturday -> 0/1 (consumed as holiday).
        // 3. Month Expiration: Blue Leave cannot be carried forward. If viewing a past month and it was unused, it is expired.
        let available = 0;
        let description = '';

        if (!thirdSatPassed) {
            // Before 3rd Saturday: Cannot be taken in advance, 0 available
            available = 0;
            used = total;
            description = `Total: ${total}d. Available: 0d (Accrues after working on 3rd Sat)`;
        } else if (workedOn3rdSat) {
            // Worked on 3rd Saturday: 1 earned
            available = Math.max(0, total - used - pending);
            if (isPastMonth) {
                description = `Total: ${total}d. Expired at month end.`;
            } else {
                description = `Total: ${total}d. Available: ${available}d (Expires ${format(monthEnd, 'MMM dd')})${pending > 0 ? ` (Pending: ${pending}d)` : ''}`;
            }
        } else {
            // Absent on 3rd Saturday: Consumed as holiday -> 0 available
            used = total;
            available = 0;
            description = `Total: ${total}d. Available: 0d (Taken as 3rd Sat holiday)`;
        }

        if (used > total) used = total;
        
        return { total, used, pending, available, description };
    };

    const staffCategory = user ? getStaffCategory(user.roleId || user.role || '', user.societyId || user.organizationId, attendanceSettings) : 'office';
    const userRulesForDisplay = attendanceSettings ? attendanceSettings[staffCategory] : null;
    const blueLeaveStatus = getBlueLeaveStatusForViewingDate();

    const balanceCards = balanceDataState ? [
        { 
            title: 'Earned Leave', 
            value: `${(balanceDataState.earnedTotal - balanceDataState.earnedUsed - (balanceDataState.earnedPending || 0)).toFixed(1)} / ${balanceDataState.earnedTotal.toFixed(1)}`, 
            description: `Total: ${balanceDataState.earnedTotal.toFixed(1)}d. Available: ${(balanceDataState.earnedTotal - balanceDataState.earnedUsed - (balanceDataState.earnedPending || 0)).toFixed(1)}d.${(balanceDataState.earnedPending || 0) > 0 ? ` (Pending: ${balanceDataState.earnedPending}d)` : ''}`,
            icon: Briefcase,
            isExpired: balanceDataState.expiryStates?.earned,
            isHidden: isProbation,
            onViewDetails: () => setShowEarnedLeaveModal(true),
            infoMessage: "Earned Leave accrues daily at 0.05 days per qualifying day (10 days = 0.5d, 30 days = 1.5d). Cannot be taken in advance."
        },
        { 
            title: 'Sick Leave', 
            value: `${parseFloat((balanceDataState.sickTotal - balanceDataState.sickUsed - (balanceDataState.sickPending || 0)).toFixed(1))} / ${parseFloat(balanceDataState.sickTotal.toFixed(1))}`, 
            description: `Total: ${parseFloat(balanceDataState.sickTotal.toFixed(1))}d. Available: ${parseFloat((balanceDataState.sickTotal - balanceDataState.sickUsed - (balanceDataState.sickPending || 0)).toFixed(1))}d.${(balanceDataState.sickPending || 0) > 0 ? ` (Pending: ${balanceDataState.sickPending}d)` : ''}`,
            icon: HeartPulse,
            isExpired: balanceDataState.expiryStates?.sick,
            isHidden: true,
            infoMessage: "Sick Leave requires a doctor's certificate if taken for more than the allowed threshold. Cannot be taken in advance."
        },
        { 
            title: 'Blue Leave', 
            value: `${parseFloat(blueLeaveStatus.available.toFixed(1))} / ${parseFloat(blueLeaveStatus.total.toFixed(1))}`, 
            description: blueLeaveStatus.description,
            icon: Plane,
            isExpired: !isFloatingHolidayValidForViewingDate(),
            isHidden: isFemale,
            onViewDetails: () => setShowBlueLeaveModal(true),
            infoMessage: "Blue Leave cannot be taken in advance. Available only in the same month after you work on the 3rd Saturday. Expires at month end."
        },
        ...(isFemale ? [
            { 
                title: 'Pink Leave', 
                value: `${parseFloat((balanceDataState.pinkTotal - balanceDataState.pinkUsed - (balanceDataState.pinkPending || 0)).toFixed(1))} / ${balanceDataState.pinkTotal}`,
                description: `1 day per month (mandatory, non-carry forward). Available: ${parseFloat((balanceDataState.pinkTotal - balanceDataState.pinkUsed - (balanceDataState.pinkPending || 0)).toFixed(1))}d.${(balanceDataState.pinkPending || 0) > 0 ? ` (Pending: ${balanceDataState.pinkPending}d)` : ''}`,
                icon: Heart,
                isExpired: false,
                infoMessage: "1 day per month (mandatory, non-carry forward). Cannot be taken in advance."
            },
            ...(userChildren.length > 0 ? [{
                title: 'Child Care Leave',
                value: `${parseFloat((balanceDataState.childCareTotal - balanceDataState.childCareUsed - (balanceDataState.childCarePending || 0)).toFixed(1))} / ${parseFloat(balanceDataState.childCareTotal.toFixed(1))}`,
                description: `Available: ${parseFloat((balanceDataState.childCareTotal - balanceDataState.childCareUsed - (balanceDataState.childCarePending || 0)).toFixed(1))} days for child care.${(balanceDataState.childCarePending || 0) > 0 ? ` (Pending: ${balanceDataState.childCarePending}d)` : ''}`,
                icon: Baby,
                isHidden: isProbation,
                infoMessage: "Subject to approval and relevant age limits for the child. Cannot be taken in advance."
            }] : [])
        ] : []),
        { 
            title: 'Compensatory Off', 
            value: `${((balanceDataState.compOffTotal - balanceDataState.compOffUsed - (balanceDataState.compOffPending || 0))).toFixed(1)} / 4`, 
            description: `Max Capacity: 4d. Available: ${((balanceDataState.compOffTotal - balanceDataState.compOffUsed - (balanceDataState.compOffPending || 0))).toFixed(1)}d.${(balanceDataState.compOffPending || 0) > 0 ? ` (Pending: ${balanceDataState.compOffPending}d)` : ''}`,
            icon: CalendarClock,
            isExpired: balanceDataState.expiryStates?.compOff,
            isHidden: isTechnicalRole(user?.role) || isProbation,
            onViewDetails: () => setShowCompOffModal(true),
            infoMessage: "As per policy, it's restricted for only 4 max limit, even if you have earned more."
        },
        {
            title: 'Permission Pool',
            value: `${Math.floor(totalPermissionMinsUsed / 60)}h ${String(totalPermissionMinsUsed % 60).padStart(2, '0')}m / 3h`,
            description: `Used: ${Math.floor(totalPermissionMinsUsed / 60)}h ${String(totalPermissionMinsUsed % 60).padStart(2, '0')}m. Remaining: ${Math.max(0, Math.floor((180 - totalPermissionMinsUsed) / 60))}h ${String(Math.max(0, (180 - totalPermissionMinsUsed) % 60)).padStart(2, '0')}m.${totalEarlyDepartureMins > 0 ? ` (Includes ${totalEarlyDepartureMins}m early departure auto-deductions)` : ''}`,
            icon: Clock,
            isExpired: false,
            onViewDetails: () => setShowPermissionModal(true),
            infoMessage: "Monthly 3-hour permission pool. Early departures (punching out before shift completion) are automatically deducted from this pool."
        },
        {
            title: 'Monthly Pay Days',
            value: (() => {
                const key = format(viewingDate, 'yyyy-MM');
                if (monthlyPaydaysMap[key] !== undefined) return `${monthlyPaydaysMap[key]}`;
                if (monthlyPaydays !== null) return `${monthlyPaydays}`;
                return snapshotData?.summary?.totalPayableDays !== undefined ? `${snapshotData.summary.totalPayableDays}` : '-';
            })(),
            description: `Total payable days tracked for ${format(viewingDate, 'MMMM yyyy')}.`,
            icon: Calculator,
            isExpired: false
        },
        {
            title: 'Monthly Travel KM',
            value: `${(snapshotData?.summary?.totalTravelDistance !== undefined 
                ? snapshotData.summary.totalTravelDistance 
                : monthlyTravelKm).toFixed(2)} KM`,
            description: `Cumulative site-to-site travel for ${format(viewingDate, 'MMMM yyyy')}.${(snapshotData?.summary?.totalTravelDuration !== undefined ? snapshotData.summary.totalTravelDuration : monthlyTravelDuration) > 0 ? ` Duration: ${formatDuration(snapshotData?.summary?.totalTravelDuration !== undefined ? snapshotData.summary.totalTravelDuration : monthlyTravelDuration)}` : ''}`,
            icon: MapPin,
            isExpired: false,
            onViewDetails: () => navigate('/leaves/activity-timeline', { state: { records: dailyActivityRecords, type: 'travel', userId: user?.id } })
        },
        {
            title: 'Monthly Footsteps',
            value: `${(snapshotData?.summary?.totalSteps !== undefined
                ? snapshotData.summary.totalSteps
                : monthlySteps).toLocaleString()} steps`,
            description: `Total footsteps tracked for ${format(viewingDate, 'MMMM yyyy')}.`,
            icon: Footprints,
            isExpired: false,
            onViewDetails: () => navigate('/leaves/activity-timeline', { state: { records: dailyActivityRecords, type: 'steps', userId: user?.id } })
        },
        ...(isTechnicalRole(user?.role) ? [
            {
                title: 'Site Duty Days',
                value: `${calculatedSiteOtDays}`,
                description: `Total Site Duty shifts (>5 hrs) performed in ${format(viewingDate, 'MMMM yyyy')}.`,
                icon: Clock,
                isExpired: false
            },
            {
                title: 'Breakdown Visits',
                value: `${calculatedBreakdownVisits}`,
                description: `Total Breakdown visits (1-5 hrs) performed in ${format(viewingDate, 'MMMM yyyy')}.`,
                icon: Clock,
                isExpired: false
            }
        ] : []),
        ...(isShortfallEnabled ? [{
            title: 'Monthly Shortfall',
            value: formatPreciseHours(calculatedShortfallMins / 60),
            description: `8h Shortfall = 1 Day Deduction. Est. Loss: ${(calculatedShortfallMins / (8 * 60)).toFixed(1)} Days.`,
            icon: Clock,
            isExpired: false
        }] : [])
    ].filter(card => !card.isExpired && !card.isHidden) : [
        ...(!isProbation ? [{ title: 'Earned Leave', value: `${Number(user?.earnedLeaveOpeningBalance || 0)} / ${Number(user?.earnedLeaveOpeningBalance || 0)}`, icon: Briefcase, isLoading: false }] : []),
        ...(!isFemale ? [{ title: 'Blue Leave', value: '1 / 1', icon: Plane, isLoading: false }] : []),
        ...(isFemale ? [{ title: 'Pink Leave', value: '1 / 1', icon: Heart, isLoading: false }] : []),
        ...(isTechnicalRole(user?.role) || isProbation ? [] : [{ title: 'Compensatory Off', value: `${Number(user?.compOffOpeningBalance || 0)} / 4`, icon: CalendarClock, isLoading: false }]),
        {
            title: 'Monthly Pay Days',
            value: (() => {
                const key = format(viewingDate, 'yyyy-MM');
                if (monthlyPaydaysMap[key] !== undefined) return `${monthlyPaydaysMap[key]}`;
                return monthlyPaydays !== null ? `${monthlyPaydays}` : '-';
            })(),
            icon: Calculator,
            isLoading: false
        },
        {
            title: 'Monthly Travel KM',
            value: `${monthlyTravelKm.toFixed(2)} KM`,
            icon: MapPin,
            isLoading: false
        }
    ];

    // Maternity card (hidden for all users as requested)
    const maternityCards = [] as any[];

    return (
        <div
            className={`p-4 space-y-6 ${isMobile ? 'pb-36' : ''}`}
            style={{
                opacity: isContentVisible ? 1 : 0,
                transform: isContentVisible ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1), transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            {/* Mobile Top Back Bar */}
            {isMobile && (
                <div className="flex items-center gap-3 mb-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (window.history.state?.idx > 0) {
                                navigate(-1);
                            } else {
                                navigate('/mobile-home');
                            }
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-black text-xs shadow-[0_2px_8px_rgba(68,214,44,0.3)] active:scale-95 transition-all cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Back</span>
                    </button>
                    <div className="h-[1px] flex-1 bg-[#134426]" />
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#44D62C] bg-[#092c19] px-2.5 py-1 rounded-lg border border-[#134426]">
                        Leaves & Attendance
                    </span>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button 
                        onClick={() => fetchData()}
                        className="px-3 py-1 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Early Departure Notification Banner */}
            {earlyDepartureDeductionsList.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                        <h4 className="font-bold text-sm text-amber-800 dark:text-amber-200 mb-1 flex items-center gap-2">
                            Early Departure Permission Auto-Deductions (3h Max Pool Limit)
                        </h4>
                        <p className="opacity-90 mb-1.5">
                            Leaving work before completing your full required daily shift automatically deducts time from your 3-hour monthly permission pool:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {earlyDepartureDeductionsList.map(ed => (
                                <span key={ed.dateStr} className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700/50 px-2.5 py-1 rounded-lg text-amber-900 dark:text-amber-200 font-semibold">
                                    <span>{format(new Date(ed.dateStr.replace(/-/g, '/')), 'dd MMM yyyy')}</span>
                                    <span className="opacity-60">•</span>
                                    <span>{ed.permissionTimeRange}</span>
                                    <span className="opacity-60">•</span>
                                    <span>Worked {ed.formattedWorked}</span>
                                    <span className="opacity-60">•</span>
                                    {ed.earlyMins > 0 ? (
                                        <span className="font-black text-amber-700 dark:text-amber-300">-{ed.earlyMins}m permission deducted</span>
                                    ) : (
                                        <span className="font-bold text-slate-500 dark:text-slate-400 italic">0m deducted (3h Pool Limit Reached)</span>
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center">
                <h2 className="text-xl md:text-2xl font-bold text-primary-text leading-none">
                    My Leave Requests
                </h2>
                <div className="flex items-center gap-3">
                    {isHolidaySelectionEnabled && (
                        isMobile ? (
                            <button 
                                onClick={() => navigate('/leaves/holiday-selection')}
                                className="bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-bold text-[11px] h-8 rounded-full flex items-center gap-1.5 px-3.5 shadow-[0_2px_10px_rgba(68,214,44,0.35)] active:scale-95 transition-all"
                            >
                                <Calendar className="w-3.5 h-3.5 text-[#0A1809]" strokeWidth={2.5} />
                                <span>Holiday</span>
                            </button>
                        ) : (
                            <Button onClick={() => navigate('/leaves/holiday-selection')} variant="secondary">
                                <Calendar className="mr-2 h-4" /> Holiday
                            </Button>
                        )
                    )}
                    {isMobile ? (
                        <button 
                            onClick={handleNewRequest}
                            className="bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] font-bold text-[11px] h-8 rounded-full flex items-center gap-1.5 px-3.5 shadow-[0_2px_10px_rgba(68,214,44,0.35)] active:scale-95 transition-all"
                        >
                            <Plus className="w-3.5 h-3.5 text-[#0A1809]" strokeWidth={2.5} />
                            <span>Request</span>
                        </button>
                    ) : (
                        <Button onClick={handleNewRequest}>
                            <Plus className="mr-2 h-4" /> New Request
                        </Button>
                    )}
                </div>
            </div>

            {(() => {
                const totalCardsCount = balanceCards.length + (isOtConversionEnabled ? 1 : 0);
                const isOdd = totalCardsCount % 2 !== 0;
                // If odd, give Monthly Pay Days full-width on mobile (col-span-2) so the grid remains balanced
                const hasMonthlyPayDays = balanceCards.some(b => b.title === 'Monthly Pay Days');

                return (
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
                        {balanceCards.map((b, idx) => {
                            const isFeaturedCard = isOdd && (
                                hasMonthlyPayDays 
                                    ? b.title === 'Monthly Pay Days' 
                                    : idx === balanceCards.length - 1
                            );

                            return (
                                <div 
                                    key={b.title} 
                                    className={`w-full h-full flex ${isFeaturedCard ? 'col-span-2 lg:col-span-1' : 'col-span-1'}`}
                                >
                                    <LeaveBalanceCard {...b} isFeatured={isFeaturedCard} />
                                </div>
                            );
                        })}
                        {/* Show Overtime card only if OT conversion is enabled for the user's role */}
                        {isOtConversionEnabled && (
                            <div className="relative group w-full h-full flex col-span-1">
                                <LeaveBalanceCard 
                                    title="Monthly OT Hours" 
                                    value={formatPreciseHours(calculatedOTHours || user?.monthlyOtHours || 0)} 
                                    description={`Calculated from hours exceeding ${threshold}h daily.`}
                                    icon={Clock} 
                                    isLoading={isLoading}
                                />
                                {/* Position tooltip below or above so it doesn't overlap text, and use solid bg-card */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                    <div className="bg-white dark:bg-[#092c19] text-slate-800 dark:text-white text-[10px] p-3 rounded-lg shadow-xl border border-slate-200 dark:border-[#134426] w-56 relative text-center lg:text-left">
                                        {/* Small triangle arrow at the top */}
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-slate-200 dark:border-b-[#134426]" />
                                        <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-white dark:border-b-[#092c19]" />
                                        
                                        <p className="font-bold border-b border-slate-200 dark:border-[#134426] mb-1.5 pb-1">OT Accumulation</p>
                                        <p className="mb-1">Current Bank: <span className="text-emerald-600 dark:text-[#44D62C] font-bold text-[11px]">
                                            {formatPreciseHours(user?.otHoursBank || 0)}
                                        </span></p>
                                        <p className="text-slate-500 dark:text-[#a3c4b1] italic leading-tight">Every 8h of accumulated OT is automatically converted to 1 Comp Off.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Maternity & Child Care Cards */}
            {maternityCards.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                    {maternityCards.map(b => <div key={b.title} className="w-full h-full flex"><LeaveBalanceCard {...b} /></div>)}
                </div>
            )}






            {/* Attendance Calendar Section - Grid layout matching summary cards for uniform sizing */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <AttendanceCalendar 
                    leaveRequests={[...activeRequests, ...autoEarlyDepartureRequests]} 
                    userHolidays={activeUserHolidays} 
                    currentDate={viewingDate}
                    setCurrentDate={setViewingDate}
                    events={activeMonthEvents}
                    settings={attendanceSettings || useSettingsStore.getState().attendance}
                    recurringHolidays={recurringHolidays}
                    isLoading={isLoading || isCalendarLoading}
                    earliestAttendanceDate={earliestRecordDate}
                    onMonthPaydaysChange={handleMonthPaydaysChange}
                    onSiteOtDaysChange={setSiteOtDays}
                    isMobile={isMobile}
                />
                {!isTechnicalRole(user?.role) && (
                    <CompOffCalendar 
                        logs={activeCompOffLogs} 
                        leaveRequests={[...activeRequests, ...autoEarlyDepartureRequests]} 
                        userHolidays={activeUserHolidays} 
                        isLoading={isLoading || isCalendarLoading} 
                        viewingDate={viewingDate}
                        onDateChange={setViewingDate}
                        events={activeMonthEvents}
                        isMobile={isMobile}
                    />
                )}
                <HolidayCalendar 
                    adminHolidays={adminHolidays} 
                    userSelectedHolidays={activeUserHolidays} 
                    isLoading={isLoading || isCalendarLoading} 
                    viewingDate={viewingDate}
                    onDateChange={setViewingDate}
                    isMobile={isMobile}
                />
                <YearlyAttendanceChart 
                    data={yearlyData}
                    isLoading={isLoading}
                    isMobile={isMobile}
                    selectedMonth={viewingDate.getMonth()}
                    viewingYear={viewingDate.getFullYear()}
                    onMonthSelect={(monthIdx) => {
                        setViewingDate(new Date(viewingDate.getFullYear(), monthIdx, 1));
                    }}
                />
                {(isOtConversionEnabled || isTechnicalRole(user?.role)) && (
                    <OTCalendar 
                        viewingDate={viewingDate}
                        onDateChange={setViewingDate}
                        events={events}
                        settings={attendanceSettings || useSettingsStore.getState().attendance}
                        isLoading={isLoading}
                    />
                )}
                {isShortfallEnabled && (
                    <ShortfallCalendar 
                        viewingDate={viewingDate}
                        onDateChange={setViewingDate}
                        events={events}
                        settings={attendanceSettings || useSettingsStore.getState().attendance}
                        isLoading={isLoading}
                    />
                )}
            </div>



            <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card w-full md:w-full">
                {/* Table Header & Month Scope Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                        <h3 className="text-base md:text-lg font-bold text-primary-text">
                            {dateScope === 'month' ? `Leave Requests for ${format(viewingDate, 'MMMM yyyy')}` : 'All Requests & Logs (Full History)'}
                        </h3>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                            {allDisplayRequests.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {dateScope === 'month' && (
                            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 border border-border/50">
                                <button
                                    type="button"
                                    onClick={() => setViewingDate(subMonths(viewingDate, 1))}
                                    className="p-1 hover:bg-white dark:hover:bg-gray-700 rounded text-muted-foreground hover:text-primary-text transition-colors"
                                    title="Previous Month"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs font-semibold px-2 text-primary-text">
                                    {format(viewingDate, 'MMM yyyy')}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setViewingDate(addMonths(viewingDate, 1))}
                                    className="p-1 hover:bg-white dark:hover:bg-gray-700 rounded text-muted-foreground hover:text-primary-text transition-colors"
                                    title="Next Month"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

                        <div className="flex items-center bg-gray-100 dark:bg-gray-800/80 p-0.5 rounded-lg border border-border/40 text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => setDateScope('month')}
                                className={`px-2.5 py-1 rounded-md transition-all ${
                                    dateScope === 'month'
                                        ? 'bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                                        : 'text-muted-foreground hover:text-primary-text'
                                }`}
                            >
                                {format(viewingDate, 'MMMM')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setDateScope('all')}
                                className={`px-2.5 py-1 rounded-md transition-all ${
                                    dateScope === 'all'
                                        ? 'bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                                        : 'text-muted-foreground hover:text-primary-text'
                                }`}
                            >
                                All History
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="w-full sm:w-auto border-b border-border relative overflow-x-auto">
                        <nav className="flex space-x-8 px-1" aria-label="Tabs">
                            {filterTabs.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setFilter(tab)}
                                    className={`whitespace-nowrap font-semibold text-sm py-4 border-b-2 transition-all duration-200 relative
                                    ${filter === tab
                                            ? 'text-accent-dark border-accent'
                                            : 'text-muted border-transparent hover:text-accent-dark hover:border-accent/30'
                                        }`}
                                >
                                    {formatTabName(tab)}
                                    {filter === tab && (
                                        <div className="tab-active-indicator w-full" />
                                    )}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full responsive-table">
                        <thead>
                            <tr className="border-b border-border/50">
                                <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Dates</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border md:bg-card md:divide-y-0">
                            {isLoading ? (
                                <tr><td colSpan={5} className="text-center py-10 text-muted">Loading...</td></tr>
                            ) : allDisplayRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-muted">
                                        <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                                        <p className="font-semibold text-base text-primary-text mb-1">
                                            {dateScope === 'month' 
                                                ? `No leave requests found for ${format(viewingDate, 'MMMM yyyy')}`
                                                : 'No leave requests found.'}
                                        </p>
                                        <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-3">
                                            {dateScope === 'month'
                                                ? `There are no leave or permission requests recorded in ${format(viewingDate, 'MMMM yyyy')}.`
                                                : 'Your submitted leave requests will appear here.'}
                                        </p>
                                        {dateScope === 'month' && (
                                            <button
                                                type="button"
                                                onClick={() => setDateScope('all')}
                                                className="inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                                            >
                                                View all request history ({requests.length})
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                allDisplayRequests.map(req => {
                                    const lType = String(req.leaveType || (req as any).leave_type || '').toLowerCase();
                                    const LeaveIcon = lType.includes('sick') ? HeartPulse : 
                                                     lType.includes('floating') ? Plane : 
                                                     lType.includes('permission') ? Clock : 
                                                     lType.includes('comp') ? CalendarClock : Briefcase;

                                    // Row display helpers
                                    const now = new Date();
                                    
                                    return (
                                        <tr key={req.id} className="leave-row-card group border-b border-border/40 last:border-0">
                                            <td data-label="Type" className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-accent-light rounded-lg text-accent-dark group-hover:bg-white transition-colors">
                                                        <LeaveIcon className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-primary-text text-sm">
                                                            {lType.includes('floating') ? 'Blue Leave' : 
                                                             lType.includes('permission') ? 'Request for Permission (RP)' : 
                                                             lType.includes('correction') ? 'Request for Correction (RC)' : 
                                                             req.leaveType}
                                                        </p>
                                                        {req.dayOption === 'half' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">Half Day</span>}
                                                        {['correction', 'permission'].some(t => lType.includes(t)) && req.correctionDetails && (
                                                            <div className="text-[11px] text-muted-foreground mt-1 font-semibold space-y-0.5 leading-none">
                                                                <div>Requested: <span className="text-emerald-600 font-bold">{req.correctionDetails.punchIn || '--:--'} - {req.correctionDetails.punchOut || '--:--'}</span></div>
                                                                {req.correctionDetails.punchIn2 && (
                                                                    <div>2nd Half: <span className="text-emerald-600 font-bold">{req.correctionDetails.punchIn2} - {req.correctionDetails.punchOut2}</span></div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {lType.includes('permission') && (() => {
                                                            const summary = getMonthlyPermissionSummary(req.startDate);
                                                            return (
                                                                <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-md px-2 py-1 mt-1.5 inline-block shadow-2xs">
                                                                    Remaining Available this month: <strong className="font-extrabold text-emerald-800">{summary.formattedRemaining}</strong>
                                                                    <span className="block text-[9px] text-gray-500 font-medium mt-0.5">(Used {summary.formattedUsed} / 3h 00m)</span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-label="Dates" className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-primary-text">
                                                        {format(new Date(req.startDate.replace(/-/g, '/')), dateScope === 'all' ? 'dd MMM yyyy' : 'dd MMM')}
                                                        {req.endDate && req.endDate !== req.startDate ? ` - ${format(new Date(req.endDate.replace(/-/g, '/')), dateScope === 'all' ? 'dd MMM yyyy' : 'dd MMM')}` : ''}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                                                        {req.dayOption === 'half' ? '0.5' : differenceInCalendarDays(new Date(req.endDate.replace(/-/g, '/')), new Date(req.startDate.replace(/-/g, '/'))) + 1} Days
                                                    </span>
                                                </div>
                                            </td>
                                            <td data-label="Reason" className="px-6 py-4">
                                                <p className="text-sm text-muted-foreground max-w-[200px] truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all duration-300" title={req.reason}>
                                                    {req.reason}
                                                </p>
                                            </td>
                                            <td data-label="Status" className="px-6 py-4">
                                                <LeaveStatusChip status={req.status} />
                                                {lType.includes('correction') && req.status === 'correction_made' && (
                                                    <div className="text-[10px] text-emerald-600 font-semibold mt-1.5 leading-tight">
                                                        Auto-approved by Paradigm AI<br/>
                                                        (Used {
                                                            requests.filter(r => 
                                                                String(r.leaveType).toLowerCase().includes('correction') &&
                                                                new Date(r.startDate.replace(/-/g, '/')).getMonth() === new Date(req.startDate.replace(/-/g, '/')).getMonth() &&
                                                                new Date(r.startDate.replace(/-/g, '/')).getFullYear() === new Date(req.startDate.replace(/-/g, '/')).getFullYear() &&
                                                                ['approved', 'correction_made', 'pending_manager_approval'].includes(r.status)
                                                            ).length
                                                        } / {userRulesForDisplay?.maxCorrectionsPerMonth || 3} this month)
                                                    </div>
                                                )}
                                                {lType.includes('permission') && (() => {
                                                    const summary = getMonthlyPermissionSummary(req.startDate);
                                                    return (
                                                        <div className="text-[10px] text-emerald-700 font-bold mt-1.5 leading-tight bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 inline-block">
                                                            Available: {summary.formattedRemaining}
                                                        </div>
                                                    );
                                                })()}
                                                {(req as any).isAutoDeducted && (
                                                    <div className="text-[10px] text-emerald-600 font-semibold mt-1 leading-tight">
                                                        Auto-adjusted from Early Departure
                                                    </div>
                                                )}
                                            </td>
                                            <td data-label="Actions" className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1 flex-wrap items-center">
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedLeaveRequest(req);
                                                            setIsDetailsModalOpen(true);
                                                        }} 
                                                        className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-full transition-colors" 
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    {['pending_manager_approval', 'rejected', 'cancelled', 'withdrawn'].includes(req.status) ? (
                                                        <>
                                                            {actioningRequestId === req.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => navigate(`/leaves/apply?edit=${req.id}`)} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-full transition-colors" title="Edit Request">
                                                                        <Edit className="h-4 w-4" />
                                                                    </button>
                                                                    {req.status === 'pending_manager_approval' ? (
                                                                        <button onClick={() => handleCancelRequest(req.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors" title="Withdraw Request">
                                                                            <XCircle className="h-4 w-4" />
                                                                        </button>
                                                                    ) : (
                                                                        <button onClick={() => handleDeleteRequest(req.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors" title="Delete Record">
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-[10px] text-muted italic font-medium">Finalized</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {!isTechnicalRole(user?.role) && (
                <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card w-full md:w-full">
                    <h3 className="text-lg font-semibold mb-4 text-primary-text">Compensatory Off Tracker</h3>
                    {isCompOffHistoryDisabled ? (
                    <div className="text-center py-10 text-muted bg-page rounded-lg">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                        <p className="font-semibold">Feature Unavailable</p>
                        <p className="text-sm">The Compensatory Off feature is disabled because the required 'comp_off_logs' table is missing in the database.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full responsive-table">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Date Earned</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Reason for Comp-Off</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Granted By</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border md:bg-card md:divide-y-0">
                                {isLoading ? (
                                    <tr><td colSpan={4} className="text-center py-10 text-muted">Loading...</td></tr>
                                ) : compOffLogs.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-10 text-muted text-lg">No comp-off history found.</td></tr>
                                ) : (
                                    compOffLogs.map(log => (
                                        <tr key={log.id}>
                                            <td data-label="Date Earned" className="px-4 py-3 font-medium">{format(new Date(log.dateEarned.replace(/-/g, '/')), 'dd MMM, yyyy')}</td>
                                            <td data-label="Reason" className="px-4 py-3 text-muted">{log.reason}</td>
                                            <td data-label="Granted By" className="px-4 py-3 text-muted">{log.grantedByName || '-'}</td>
                                            <td data-label="Status" className="px-4 py-3">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${log.status === 'earned' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-800'}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            )}

            {/* Employee Attendance Log */}
            <EmployeeLog initialEvents={events} isMobile={isMobile} />

            {/* Earned Leave Tracker Modal */}
            <Modal
                isOpen={showEarnedLeaveModal}
                onClose={() => setShowEarnedLeaveModal(false)}
                title="Earned Leave (EL) Tracker"
                maxWidth="md:max-w-3xl lg:max-w-4xl"
                footer={
                    <div className="flex justify-end">
                        <Button
                            onClick={() => setShowEarnedLeaveModal(false)}
                            variant="secondary"
                        >
                            Close
                        </Button>
                    </div>
                }
            >
                <div className="space-y-5 text-slate-800 dark:text-slate-100">
                    {/* Top KPI Cards (Interactive Buttons with Eye Icons) */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => setElModalTab('earned')}
                            className={`p-3 sm:p-3.5 rounded-xl text-center transition-all relative group cursor-pointer ${
                                elModalTab === 'earned'
                                    ? 'bg-emerald-100 dark:bg-emerald-900/40 border-2 border-emerald-500 shadow-sm'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 hover:border-emerald-400'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                    Total Accrued
                                </span>
                                <Eye className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${elModalTab === 'earned' ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`} />
                            </div>
                            <span className="text-lg sm:text-xl md:text-2xl font-black text-emerald-900 dark:text-emerald-100 block">
                                {((balanceDataState?.earnedTotal || 0)).toFixed(1)}d
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                                View Break Up
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setElModalTab('used')}
                            className={`p-3 sm:p-3.5 rounded-xl text-center transition-all relative group cursor-pointer ${
                                elModalTab === 'used'
                                    ? 'bg-rose-100 dark:bg-rose-900/40 border-2 border-rose-500 shadow-sm'
                                    : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 hover:border-rose-400'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                                    Total Used
                                </span>
                                <Eye className={`w-3.5 h-3.5 text-rose-600 dark:text-rose-400 ${elModalTab === 'used' ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`} />
                            </div>
                            <span className="text-lg sm:text-xl md:text-2xl font-black text-rose-900 dark:text-rose-100 block">
                                {((balanceDataState?.earnedUsed || 0)).toFixed(1)}d
                            </span>
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold block mt-0.5">
                                View Leaves Taken
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setElModalTab('balance')}
                            className={`p-3 sm:p-3.5 rounded-xl text-center transition-all relative group cursor-pointer ${
                                elModalTab === 'balance'
                                    ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500 shadow-sm'
                                    : 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 hover:border-blue-400'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                    Available Net
                                </span>
                                <Eye className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ${elModalTab === 'balance' ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`} />
                            </div>
                            <span className="text-lg sm:text-xl md:text-2xl font-black text-blue-900 dark:text-blue-100 block">
                                {(((balanceDataState?.earnedTotal || 0) - (balanceDataState?.earnedUsed || 0) - (balanceDataState?.earnedPending || 0))).toFixed(1)}d
                            </span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold block mt-0.5">
                                View Balance Ledger
                            </span>
                        </button>
                    </div>

                    {/* Segmented Tab Pill Selector */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#041b0f] rounded-xl border border-slate-200 dark:border-[#134426]">
                        <button
                            type="button"
                            onClick={() => setElModalTab('earned')}
                            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                elModalTab === 'earned'
                                    ? 'bg-white dark:bg-[#134426] text-emerald-700 dark:text-[#44D62C] shadow-xs'
                                    : 'text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Earned Break Up ({((balanceDataState?.earnedTotal || 0)).toFixed(1)}d)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setElModalTab('used')}
                            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                elModalTab === 'used'
                                    ? 'bg-white dark:bg-[#134426] text-rose-700 dark:text-rose-400 shadow-xs'
                                    : 'text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Used Break Up ({((balanceDataState?.earnedUsed || 0)).toFixed(1)}d)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setElModalTab('balance')}
                            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                elModalTab === 'balance'
                                    ? 'bg-white dark:bg-[#134426] text-blue-700 dark:text-blue-400 shadow-xs'
                                    : 'text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Balance Tracker ({(((balanceDataState?.earnedTotal || 0) - (balanceDataState?.earnedUsed || 0) - (balanceDataState?.earnedPending || 0))).toFixed(1)}d)</span>
                        </button>
                    </div>

                    {/* TAB 1: EARNED BREAK UP */}
                    {elModalTab === 'earned' && (
                        <div className="space-y-4">
                            {/* Accrual Policy Banner */}
                            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#041b0f] border border-slate-200 dark:border-[#134426] space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="w-4 h-4 text-[#44D62C] flex-shrink-0" />
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                            Accrual Policy Engine
                                        </span>
                                    </div>
                                    <span className="text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#44D62C]/20 text-[#44D62C] border border-[#44D62C]/30 w-fit">
                                        0.05 EL / Day (0.5d / 10 Days)
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-white/80 leading-relaxed">
                                    Employees earn <strong>0.05 days</strong> of Earned Leave daily for every <strong>qualifying working day</strong> (10 qualifying days = 0.5 days, 30 days = 1.5 days). 
                                    Working 6 days in a week qualifies the weekly off Sunday. Approved holidays, compensatory offs, and paid leaves are also counted.
                                </p>

                                {/* 10-day Progress Bar */}
                                {(() => {
                                    const qualifyingDays = earnedLeaveBreakup.qualifyingDaysTotal || 0;
                                    const cycleCount = earnedLeaveBreakup.currentCycleDays || (qualifyingDays % 10);
                                    const daysRemaining = qualifyingDays > 0 ? 10 - cycleCount : 10;
                                    const milestonesReached = Math.floor(qualifyingDays / 10);
                                    return (
                                        <div className="space-y-1.5 pt-1">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[11px] font-semibold text-slate-500 dark:text-white/70 gap-0.5">
                                                <span>Qualifying Service: <strong className="text-slate-900 dark:text-white">{qualifyingDays} days</strong> ({milestonesReached} milestones reached)</span>
                                                <span>Current 10-day cycle: <strong className="text-emerald-600 dark:text-[#44D62C]">{cycleCount} / 10 days</strong></span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-[#092c19] h-2.5 rounded-full overflow-hidden border border-slate-300 dark:border-[#134426]">
                                                <div 
                                                    className="bg-[#44D62C] h-full rounded-full transition-all duration-300"
                                                    style={{ width: `${(cycleCount / 10) * 100}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-white/60 italic text-right">
                                                {daysRemaining === 10 ? 'Milestone reached (+0.5d accrued)!' : `${daysRemaining} more qualifying days until next full 0.5d milestone`}
                                            </p>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Monthly Accrual Breakdown */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                        Monthly Accrual Break Up ({earnedLeaveBreakup.totalAccrued.toFixed(1)}d Total)
                                    </h4>
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-white/60">
                                        {earnedLeaveBreakup.monthly.length} months tracked
                                    </span>
                                </div>

                                {earnedLeaveBreakup.monthly.length > 0 ? (
                                    <>
                                        {/* Desktop Table View */}
                                        <div className="hidden sm:block border border-slate-200 dark:border-[#134426] rounded-xl overflow-x-auto shadow-2xs">
                                            <table className="w-full text-left text-xs border-collapse min-w-[620px]">
                                                <thead>
                                                    <tr className="bg-slate-100/80 dark:bg-[#041b0f] text-slate-600 dark:text-white/80 font-bold border-b border-slate-200 dark:border-[#134426]">
                                                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                        <th className="py-2.5 px-3 whitespace-nowrap">Month</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Worked</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Holidays</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Sundays</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Leaves</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap font-bold">Qualifying</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap font-bold text-emerald-600 dark:text-[#44D62C]">Accrued</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Cumulative</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-[#134426]/60">
                                                    {earnedLeaveBreakup.monthly.map((m, idx) => (
                                                        <tr key={m.monthKey} className="hover:bg-slate-50/80 dark:hover:bg-[#041b0f]/60 transition-colors">
                                                            <td className="py-2 px-3 text-slate-400 font-mono text-[11px] text-center">{idx + 1}</td>
                                                            <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{m.monthName}</td>
                                                            <td className="py-2 px-3 text-center text-slate-600 dark:text-white/70">{m.workedDays}d</td>
                                                            <td className="py-2 px-3 text-center text-slate-600 dark:text-white/70">{m.holidays}d</td>
                                                            <td className="py-2 px-3 text-center text-slate-600 dark:text-white/70">{m.sundays}d</td>
                                                            <td className="py-2 px-3 text-center text-slate-600 dark:text-white/70">{m.paidLeaves}d</td>
                                                            <td className="py-2 px-3 text-center font-bold text-slate-800 dark:text-white">{m.qualifyingDays}d</td>
                                                            <td className="py-2 px-3 text-center font-bold text-emerald-600 dark:text-[#44D62C]">+{m.accrued.toFixed(1)}d</td>
                                                            <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-white/80">{m.cumulativeAccrued.toFixed(1)}d</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="bg-slate-100/90 dark:bg-[#041b0f] font-bold border-t-2 border-slate-200 dark:border-[#134426]">
                                                        <td colSpan={6} className="py-2.5 px-3 text-right text-slate-700 dark:text-white">Total Qualifying Service:</td>
                                                        <td className="py-2.5 px-3 text-center text-slate-900 dark:text-white">{earnedLeaveBreakup.qualifyingDaysTotal}d</td>
                                                        <td className="py-2.5 px-3 text-center text-emerald-600 dark:text-[#44D62C]">+{earnedLeaveBreakup.totalAccrued.toFixed(1)}d</td>
                                                        <td className="py-2.5 px-3 text-center text-slate-900 dark:text-white">{earnedLeaveBreakup.totalAccrued.toFixed(1)}d</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>

                                        {/* Mobile Cards View */}
                                        <div className="sm:hidden space-y-2.5">
                                            {earnedLeaveBreakup.monthly.map((m, idx) => (
                                                <div key={m.monthKey} className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#041b0f]/60 border border-slate-200 dark:border-[#134426] space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#134426] text-slate-600 dark:text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                                {m.monthName}
                                                            </span>
                                                        </div>
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex-shrink-0">
                                                            +{m.accrued.toFixed(1)}d Earned
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-slate-200/60 dark:border-[#134426]/60">
                                                        <span className="text-slate-500 dark:text-white/60 text-[11px]">
                                                            Qualifying: <strong className="text-slate-900 dark:text-white font-bold">{m.qualifyingDays} days</strong>
                                                        </span>
                                                        <span className="text-slate-500 dark:text-white/60 text-[11px] text-right">
                                                            Cumulative: <strong className="text-slate-800 dark:text-white font-bold">{m.cumulativeAccrued.toFixed(1)}d</strong>
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 dark:text-white/60 flex items-center justify-between gap-1 pt-1">
                                                        <span>Worked: {m.workedDays}d</span>
                                                        <span>Holidays: {m.holidays}d</span>
                                                        <span>Sundays: {m.sundays}d</span>
                                                        <span>Leaves: {m.paidLeaves}d</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                                        No accrual history recorded yet.
                                    </div>
                                )}
                            </div>

                            {/* 10-day Milestones Reached */}
                            {earnedLeaveBreakup.milestones.length > 0 && (
                                <div className="space-y-2.5 pt-2">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                        10-Day Qualifying Milestones Reached ({earnedLeaveBreakup.milestones.length} Milestones)
                                    </h4>
                                    <div className="border border-slate-200 dark:border-[#134426] rounded-xl overflow-x-auto shadow-2xs max-h-52 overflow-y-auto">
                                        <table className="w-full text-left text-xs border-collapse min-w-[480px]">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-slate-100/90 dark:bg-[#041b0f] text-slate-600 dark:text-white/80 font-bold border-b border-slate-200 dark:border-[#134426]">
                                                    <th className="py-2 px-3 w-20 text-center">Milestone</th>
                                                    <th className="py-2 px-3 whitespace-nowrap">Date Reached</th>
                                                    <th className="py-2 px-3 text-center whitespace-nowrap">Qualifying Days</th>
                                                    <th className="py-2 px-3 text-center whitespace-nowrap font-bold text-emerald-600 dark:text-[#44D62C]">Credit</th>
                                                    <th className="py-2 px-3 text-center whitespace-nowrap">Cumulative Accrued</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-[#134426]/60">
                                                {earnedLeaveBreakup.milestones.map((ms) => (
                                                    <tr key={ms.milestoneNumber} className="hover:bg-slate-50/80 dark:hover:bg-[#041b0f]/60 transition-colors">
                                                        <td className="py-1.5 px-3 font-mono font-bold text-center text-slate-700 dark:text-white">#{ms.milestoneNumber}</td>
                                                        <td className="py-1.5 px-3 whitespace-nowrap text-slate-800 dark:text-white">{format(new Date(ms.dateReached.replace(/-/g, '/')), 'dd MMM yyyy')}</td>
                                                        <td className="py-1.5 px-3 text-center font-bold text-slate-700 dark:text-white/80">{ms.qualifyingDays} days</td>
                                                        <td className="py-1.5 px-3 text-center font-bold text-emerald-600 dark:text-[#44D62C]">+{ms.credit.toFixed(1)}d</td>
                                                        <td className="py-1.5 px-3 text-center font-bold text-slate-900 dark:text-white">{ms.cumulativeAccrued.toFixed(1)}d</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: USED BREAK UP */}
                    {elModalTab === 'used' && (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                    Earned Leaves Taken This Year ({((balanceDataState?.earnedUsed || 0)).toFixed(1)}d Total)
                                </h4>
                                <span className="text-[11px] font-bold text-slate-500 dark:text-white/60">
                                    {(() => {
                                        const allLeaves = yearlyData?.leaves?.length ? yearlyData.leaves : requests;
                                        const count = (allLeaves || []).filter(l => {
                                            const type = (l.leaveType || (l as any).leave_type || '').toLowerCase();
                                            const status = (l.status || '').toLowerCase();
                                            return type.includes('earned') && (status === 'approved' || status === 'correction_made');
                                        }).length;
                                        return `${count} request${count !== 1 ? 's' : ''}`;
                                    })()}
                                </span>
                            </div>

                            {(() => {
                                const allLeaves = yearlyData?.leaves?.length ? yearlyData.leaves : requests;
                                const elLeaves = (allLeaves || [])
                                    .filter(l => {
                                        const type = (l.leaveType || (l as any).leave_type || '').toLowerCase();
                                        const status = (l.status || '').toLowerCase();
                                        return type.includes('earned') && (status === 'approved' || status === 'correction_made');
                                    })
                                    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

                                if (elLeaves.length === 0) {
                                    return (
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                                            No Earned Leaves taken in this calendar year.
                                        </div>
                                    );
                                }

                                let cumDays = 0;
                                return (
                                    <>
                                        {/* Desktop / Tablet Table View (>= sm: 640px) */}
                                        <div className="hidden sm:block border border-slate-200 dark:border-[#134426] rounded-xl overflow-x-auto shadow-2xs">
                                            <table className="w-full text-left text-xs border-collapse min-w-[660px]">
                                                <thead>
                                                    <tr className="bg-slate-100/80 dark:bg-[#041b0f] text-slate-600 dark:text-white/80 font-bold border-b border-slate-200 dark:border-[#134426]">
                                                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                        <th className="py-2.5 px-3 whitespace-nowrap">Dates</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Days</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Cumulative</th>
                                                        <th className="py-2.5 px-3">Reason</th>
                                                        <th className="py-2.5 px-3 whitespace-nowrap">Approved By</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-[#134426]/60">
                                                    {elLeaves.map((l, idx) => {
                                                        let days = l.dayOption === 'half' ? 0.5 : 1;
                                                        if (l.startDate !== l.endDate && l.dayOption !== 'half') {
                                                            days = differenceInCalendarDays(new Date(l.endDate.replace(/-/g, '/')), new Date(l.startDate.replace(/-/g, '/'))) + 1;
                                                        }
                                                        cumDays += days;
                                                        const isSingle = l.startDate === l.endDate;
                                                        const dateDisplay = isSingle
                                                            ? format(new Date(l.startDate.replace(/-/g, '/')), 'dd MMM yyyy')
                                                            : `${format(new Date(l.startDate.replace(/-/g, '/')), 'dd MMM')} - ${format(new Date(l.endDate.replace(/-/g, '/')), 'dd MMM yyyy')}`;
                                                        const { approverName, approverPhoto, approvedDateStr } = getLeaveApprovalInfo(l);

                                                        return (
                                                            <tr key={l.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-[#041b0f]/60 transition-colors">
                                                                <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] text-center">{idx + 1}</td>
                                                                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{dateDisplay}</td>
                                                                <td className="py-2.5 px-3 text-center font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">-{days}d</td>
                                                                <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-white/80 whitespace-nowrap">{cumDays}d</td>
                                                                <td className="py-2.5 px-3 text-slate-600 dark:text-white/70 max-w-[200px] break-words" title={l.reason}>{l.reason || '-'}</td>
                                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                                    <div className="flex items-center gap-2.5">
                                                                        {approverPhoto ? (
                                                                            <img 
                                                                                src={approverPhoto} 
                                                                                alt={approverName} 
                                                                                className="w-7 h-7 rounded-full object-cover border border-emerald-300 dark:border-[#134426] shadow-2xs flex-shrink-0"
                                                                                onError={(e) => {
                                                                                    (e.target as HTMLElement).style.display = 'none';
                                                                                    const fallback = (e.target as HTMLElement).nextElementSibling;
                                                                                    if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                                                                                }}
                                                                            />
                                                                        ) : null}
                                                                        <div className={`w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center border border-emerald-300 dark:border-[#134426] shadow-2xs flex-shrink-0 ${approverPhoto ? 'hidden' : ''}`}>
                                                                            {(approverName || 'A').charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="font-semibold text-slate-900 dark:text-white text-xs">
                                                                                {approverName}
                                                                            </span>
                                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-white/60">
                                                                                <span className="text-emerald-600 dark:text-[#44D62C] font-bold">APPROVED</span>
                                                                                {approvedDateStr && (
                                                                                    <>
                                                                                        <span>•</span>
                                                                                        <span>{approvedDateStr}</span>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile Card List View (< sm: 640px) */}
                                        <div className="sm:hidden space-y-3">
                                            {(() => {
                                                let mobileCum = 0;
                                                return elLeaves.map((l, idx) => {
                                                    let days = l.dayOption === 'half' ? 0.5 : 1;
                                                    if (l.startDate !== l.endDate && l.dayOption !== 'half') {
                                                        days = differenceInCalendarDays(new Date(l.endDate.replace(/-/g, '/')), new Date(l.startDate.replace(/-/g, '/'))) + 1;
                                                    }
                                                    mobileCum += days;
                                                    const isSingle = l.startDate === l.endDate;
                                                    const dateDisplay = isSingle
                                                        ? format(new Date(l.startDate.replace(/-/g, '/')), 'dd MMM yyyy')
                                                        : `${format(new Date(l.startDate.replace(/-/g, '/')), 'dd MMM')} - ${format(new Date(l.endDate.replace(/-/g, '/')), 'dd MMM yyyy')}`;
                                                    const { approverName, approverPhoto, approvedDateStr } = getLeaveApprovalInfo(l);

                                                    return (
                                                        <div key={l.id || idx} className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#041b0f]/60 border border-slate-200 dark:border-[#134426] space-y-2.5">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#134426] text-slate-600 dark:text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                                                        {idx + 1}
                                                                    </span>
                                                                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                                        {dateDisplay}
                                                                    </span>
                                                                </div>
                                                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex-shrink-0">
                                                                    Approved
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 dark:border-[#134426]/60">
                                                                <span className="text-slate-500 dark:text-white/60 text-[11px]">
                                                                    Deducted: <strong className="text-rose-600 dark:text-rose-400 font-bold">-{days}d</strong>
                                                                </span>
                                                                <span className="text-slate-500 dark:text-white/60 text-[11px]">
                                                                    Cumulative: <strong className="text-slate-700 dark:text-white/90 font-bold">{mobileCum}d</strong>
                                                                </span>
                                                            </div>
                                                            {l.reason && (
                                                                <p className="text-[11px] text-slate-600 dark:text-white/70 bg-white dark:bg-black/20 p-2 rounded-lg border border-slate-200/50 dark:border-white/5 leading-relaxed">
                                                                    {l.reason}
                                                                </p>
                                                            )}
                                                            {/* Approver info footer */}
                                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-[#134426]/60 text-xs">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    {approverPhoto ? (
                                                                        <img 
                                                                            src={approverPhoto} 
                                                                            alt={approverName} 
                                                                            className="w-6 h-6 rounded-full object-cover border border-emerald-300 dark:border-[#134426] flex-shrink-0"
                                                                            onError={(e) => {
                                                                                (e.target as HTMLElement).style.display = 'none';
                                                                                const fallback = (e.target as HTMLElement).nextElementSibling;
                                                                                if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <div className={`w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center border border-emerald-300 dark:border-[#134426] flex-shrink-0 ${approverPhoto ? 'hidden' : ''}`}>
                                                                        {(approverName || 'A').charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-[11px] font-semibold text-slate-800 dark:text-white/90 truncate">
                                                                            Approved by <strong className="font-bold text-slate-900 dark:text-white">{approverName}</strong>
                                                                        </span>
                                                                        {approvedDateStr && (
                                                                            <span className="text-[10px] text-slate-500 dark:text-white/60">
                                                                                {approvedDateStr}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* TAB 3: BALANCE TRACKER (PASSBOOK / LEDGER) */}
                    {elModalTab === 'balance' && (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                    Chronological Earned Leave Balance Ledger
                                </h4>
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-[#44D62C]">
                                    Current Available: {(((balanceDataState?.earnedTotal || 0) - (balanceDataState?.earnedUsed || 0) - (balanceDataState?.earnedPending || 0))).toFixed(1)}d
                                </span>
                            </div>

                            {earnedLeaveLedger.length > 0 ? (
                                <>
                                    {/* Desktop Table */}
                                    <div className="hidden sm:block border border-slate-200 dark:border-[#134426] rounded-xl overflow-x-auto shadow-2xs">
                                        <table className="w-full text-left text-xs border-collapse min-w-[680px]">
                                            <thead>
                                                <tr className="bg-slate-100/80 dark:bg-[#041b0f] text-slate-600 dark:text-white/80 font-bold border-b border-slate-200 dark:border-[#134426]">
                                                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                    <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                                                    <th className="py-2.5 px-3 whitespace-nowrap">Transaction</th>
                                                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Type</th>
                                                    <th className="py-2.5 px-3 text-center whitespace-nowrap font-bold">Change</th>
                                                    <th className="py-2.5 px-3 text-center whitespace-nowrap font-bold text-blue-600 dark:text-blue-400">Balance</th>
                                                    <th className="py-2.5 px-3 whitespace-nowrap">Authorized / Source</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-[#134426]/60">
                                                {earnedLeaveLedger.map((entry, idx) => (
                                                    <tr key={entry.id} className="hover:bg-slate-50/80 dark:hover:bg-[#041b0f]/60 transition-colors">
                                                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px] text-center">{idx + 1}</td>
                                                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                            {format(new Date(entry.date.replace(/-/g, '/')), 'dd MMM yyyy')}
                                                        </td>
                                                        <td className="py-2 px-3 max-w-[220px]">
                                                            <div className="font-semibold text-slate-900 dark:text-white truncate">{entry.description}</div>
                                                            {entry.details && (
                                                                <div className="text-[10px] text-slate-500 dark:text-white/60 truncate">{entry.details}</div>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 text-center whitespace-nowrap">
                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                                entry.type === 'credit'
                                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                    : entry.type === 'debit'
                                                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                                            }`}>
                                                                {entry.type === 'credit' ? 'Credit (+)' : entry.type === 'debit' ? 'Debit (-)' : 'Opening'}
                                                            </span>
                                                        </td>
                                                        <td className={`py-2 px-3 text-center font-bold whitespace-nowrap ${
                                                            entry.type === 'credit'
                                                                ? 'text-emerald-600 dark:text-[#44D62C]'
                                                                : entry.type === 'debit'
                                                                ? 'text-rose-600 dark:text-rose-400'
                                                                : 'text-blue-600 dark:text-blue-400'
                                                        }`}>
                                                            {entry.type === 'credit' ? `+${entry.amount.toFixed(1)}d` : entry.type === 'debit' ? `-${entry.amount.toFixed(1)}d` : `${entry.amount.toFixed(1)}d`}
                                                        </td>
                                                        <td className="py-2 px-3 text-center font-black text-slate-900 dark:text-white whitespace-nowrap">
                                                            {entry.runningBalance.toFixed(1)}d
                                                        </td>
                                                        <td className="py-2 px-3 whitespace-nowrap text-slate-600 dark:text-white/70">
                                                            {entry.approverName ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    {entry.approverPhoto && (
                                                                        <img src={entry.approverPhoto} alt={entry.approverName} className="w-5 h-5 rounded-full object-cover" />
                                                                    )}
                                                                    <span className="font-semibold text-slate-800 dark:text-white">{entry.approverName}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-500 dark:text-white/50 italic">HR Policy Engine</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Cards */}
                                    <div className="sm:hidden space-y-2.5">
                                        {earnedLeaveLedger.map((entry, idx) => (
                                            <div key={entry.id} className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#041b0f]/60 border border-slate-200 dark:border-[#134426] space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#134426] text-slate-600 dark:text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                                            {idx + 1}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                            {format(new Date(entry.date.replace(/-/g, '/')), 'dd MMM yyyy')}
                                                        </span>
                                                    </div>
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        entry.type === 'credit'
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                            : entry.type === 'debit'
                                                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                                    }`}>
                                                        {entry.type === 'credit' ? `+${entry.amount.toFixed(1)}d Credit` : entry.type === 'debit' ? `-${entry.amount.toFixed(1)}d Debit` : `${entry.amount.toFixed(1)}d Opening`}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-800 dark:text-white font-semibold">
                                                    {entry.description}
                                                </div>
                                                {entry.details && (
                                                    <div className="text-[11px] text-slate-500 dark:text-white/60">
                                                        {entry.details}
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 dark:border-[#134426]/60">
                                                    <span className="text-slate-500 dark:text-white/60 text-[11px]">
                                                        {entry.approverName ? `Approved by ${entry.approverName}` : 'Auto-Accrual'}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                                                        Net Balance: <strong className="text-blue-600 dark:text-blue-400 text-xs font-black">{entry.runningBalance.toFixed(1)}d</strong>
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                                    No ledger entries found.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Compensatory Off (CO) Tracker Modal */}
            <Modal
                isOpen={showCompOffModal}
                onClose={() => setShowCompOffModal(false)}
                title="Compensatory Off (CO) Tracker"
                maxWidth="md:max-w-3xl lg:max-w-4xl"
                footer={
                    <div className="flex justify-end">
                        <Button
                            onClick={() => setShowCompOffModal(false)}
                            variant="secondary"
                        >
                            Close
                        </Button>
                    </div>
                }
            >
                <div className="space-y-5 text-slate-800 dark:text-slate-100">
                    {/* Top KPI Cards (Interactive Buttons with Eye Icons) */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => setCompModalTab('earned')}
                            className={`p-3 sm:p-3.5 rounded-xl text-center transition-all relative group cursor-pointer ${
                                compModalTab === 'earned'
                                    ? 'bg-emerald-100 dark:bg-emerald-900/40 border-2 border-emerald-500 shadow-sm'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 hover:border-emerald-400'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                    Total Earned
                                </span>
                                <Eye className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${compModalTab === 'earned' ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`} />
                            </div>
                            <span className="text-lg sm:text-xl md:text-2xl font-black text-emerald-900 dark:text-emerald-100 block">
                                {((balanceDataState?.compOffTotal || 0)).toFixed(1)}d
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                                View Credits & Grants
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setCompModalTab('used')}
                            className={`p-3 sm:p-3.5 rounded-xl text-center transition-all relative group cursor-pointer ${
                                compModalTab === 'used'
                                    ? 'bg-rose-100 dark:bg-rose-900/40 border-2 border-rose-500 shadow-sm'
                                    : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 hover:border-rose-400'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                                    Total Used
                                </span>
                                <Eye className={`w-3.5 h-3.5 text-rose-600 dark:text-rose-400 ${compModalTab === 'used' ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`} />
                            </div>
                            <span className="text-lg sm:text-xl md:text-2xl font-black text-rose-900 dark:text-rose-100 block">
                                {((balanceDataState?.compOffUsed || 0)).toFixed(1)}d
                            </span>
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold block mt-0.5">
                                View Leaves Taken
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setCompModalTab('balance')}
                            className={`p-3 sm:p-3.5 rounded-xl text-center transition-all relative group cursor-pointer ${
                                compModalTab === 'balance'
                                    ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500 shadow-sm'
                                    : 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 hover:border-blue-400'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                    Available Net
                                </span>
                                <Eye className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ${compModalTab === 'balance' ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`} />
                            </div>
                            <span className="text-lg sm:text-xl md:text-2xl font-black text-blue-900 dark:text-blue-100 block">
                                {(((balanceDataState?.compOffTotal || 0) - (balanceDataState?.compOffUsed || 0) - (balanceDataState?.compOffPending || 0))).toFixed(1)}d
                            </span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold block mt-0.5">
                                View Balance Ledger
                            </span>
                        </button>
                    </div>

                    {/* Segmented Tab Pill Selector */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#041b0f] rounded-xl border border-slate-200 dark:border-[#134426]">
                        <button
                            type="button"
                            onClick={() => setCompModalTab('earned')}
                            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                compModalTab === 'earned'
                                    ? 'bg-white dark:bg-[#134426] text-emerald-700 dark:text-[#44D62C] shadow-xs'
                                    : 'text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Earned Break Up ({((balanceDataState?.compOffTotal || 0)).toFixed(1)}d)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCompModalTab('used')}
                            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                compModalTab === 'used'
                                    ? 'bg-white dark:bg-[#134426] text-rose-700 dark:text-rose-400 shadow-xs'
                                    : 'text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Used Break Up ({((balanceDataState?.compOffUsed || 0)).toFixed(1)}d)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCompModalTab('balance')}
                            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                compModalTab === 'balance'
                                    ? 'bg-white dark:bg-[#134426] text-blue-700 dark:text-blue-400 shadow-xs'
                                    : 'text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Balance Tracker ({(((balanceDataState?.compOffTotal || 0) - (balanceDataState?.compOffUsed || 0) - (balanceDataState?.compOffPending || 0))).toFixed(1)}d)</span>
                        </button>
                    </div>

                    {/* TAB 1: EARNED BREAK UP (GRANTS & SOURCES) */}
                    {compModalTab === 'earned' && (
                        <div className="space-y-4">
                            {/* Policy & Max 4-day Capacity Banner */}
                            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#041b0f] border border-slate-200 dark:border-[#134426] space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <CalendarClock className="w-4 h-4 text-[#44D62C] flex-shrink-0" />
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                            Comp Off Policy & Capacity
                                        </span>
                                    </div>
                                    <span className="text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#44D62C]/20 text-[#44D62C] border border-[#44D62C]/30 w-fit">
                                        Max Capacity: 4.0 Days
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-white/80 leading-relaxed">
                                    Compensatory Off is earned by working on scheduled Weekly Offs (Sundays) or approved Company Holidays. As per company policy, accumulated Compensatory Off is capped at a maximum of <strong>4.0 days</strong> at any time.
                                </p>

                                {/* Capacity Bar */}
                                {(() => {
                                    const availableCompOff = Math.max(0, (balanceDataState?.compOffTotal || 0) - (balanceDataState?.compOffUsed || 0) - (balanceDataState?.compOffPending || 0));
                                    const capPercent = Math.min(100, (availableCompOff / 4) * 100);
                                    return (
                                        <div className="space-y-1.5 pt-1">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[11px] font-semibold text-slate-500 dark:text-white/70 gap-0.5">
                                                <span>Current Pool: <strong className="text-slate-900 dark:text-white">{availableCompOff.toFixed(1)} days</strong></span>
                                                <span>Capacity Used: <strong className="text-emerald-600 dark:text-[#44D62C]">{capPercent.toFixed(0)}%</strong> (Max 4d)</span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-[#092c19] h-2.5 rounded-full overflow-hidden border border-slate-300 dark:border-[#134426]">
                                                <div 
                                                    className="bg-[#44D62C] h-full rounded-full transition-all duration-300"
                                                    style={{ width: `${capPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Comp Off Credits / Sources */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                        Comp Off Credits & Grants ({compOffEarnedBreakup.length} {compOffEarnedBreakup.length === 1 ? 'entry' : 'entries'})
                                    </h4>
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-[#44D62C]">
                                        Total Earned: {((balanceDataState?.compOffTotal || 0)).toFixed(1)}d
                                    </span>
                                </div>
                                {compOffEarnedBreakup.length > 0 ? (
                                    <>
                                        <div className="hidden sm:block border border-slate-200 dark:border-[#134426] rounded-xl overflow-x-auto shadow-2xs">
                                            <table className="w-full text-left text-xs border-collapse min-w-[540px]">
                                                <thead>
                                                    <tr className="bg-slate-100/80 dark:bg-[#041b0f] text-slate-600 dark:text-white/80 font-bold border-b border-slate-200 dark:border-[#134426]">
                                                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                        <th className="py-2.5 px-3 whitespace-nowrap">Date Earned</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap font-bold text-emerald-600 dark:text-[#44D62C]">Credit</th>
                                                        <th className="py-2.5 px-3">Occasion / Source</th>
                                                        <th className="py-2.5 px-3">Attendance & Hours</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-[#134426]/60">
                                                    {compOffEarnedBreakup.map((item, idx) => (
                                                        <tr key={item.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-[#041b0f]/60 transition-colors">
                                                            <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] text-center">{idx + 1}</td>
                                                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                                <div>{format(new Date(item.date.replace(/-/g, '/')), 'dd MMM yyyy')}</div>
                                                                <span className="text-[10px] text-slate-400 dark:text-white/50 font-normal">
                                                                    {format(new Date(item.date.replace(/-/g, '/')), 'EEEE')}
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-[#44D62C] whitespace-nowrap">+{item.credit.toFixed(1)}d</td>
                                                            <td className="py-2.5 px-3 text-slate-800 dark:text-white font-medium">
                                                                {item.source}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-slate-500 dark:text-white/60 text-[11px]">
                                                                {item.details}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                                    {item.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="sm:hidden space-y-2.5">
                                            {compOffEarnedBreakup.map((item, idx) => (
                                                <div key={item.id || idx} className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#041b0f]/60 border border-slate-200 dark:border-[#134426] space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#134426] text-slate-600 dark:text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                                                {idx + 1}
                                                            </span>
                                                            <div>
                                                                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                                                                    {format(new Date(item.date.replace(/-/g, '/')), 'dd MMM yyyy')}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 dark:text-white/50">
                                                                    {format(new Date(item.date.replace(/-/g, '/')), 'EEEE')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-emerald-600 dark:text-[#44D62C]">
                                                                +{item.credit.toFixed(1)}d
                                                            </span>
                                                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex-shrink-0">
                                                                {item.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="pt-1.5 border-t border-slate-200/60 dark:border-[#134426]/60">
                                                        <div className="text-xs font-semibold text-slate-800 dark:text-white">
                                                            {item.source}
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 dark:text-white/60 mt-0.5">
                                                            {item.details}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                                        Comp Offs are dynamically accrued when attendance punches are detected on official Weekly Offs (Sundays) or Company Holidays.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: USED BREAK UP */}
                    {compModalTab === 'used' && (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                    Applied Comp Off Leaves Taken ({((balanceDataState?.compOffUsed || 0)).toFixed(1)}d Total)
                                </h4>
                                <span className="text-[11px] font-bold text-slate-500 dark:text-white/60">
                                    {(() => {
                                        const allLeaves = yearlyData?.leaves?.length ? yearlyData.leaves : requests;
                                        const count = (allLeaves || []).filter(l => {
                                            const type = (l.leaveType || (l as any).leave_type || '').toLowerCase();
                                            const status = (l.status || '').toLowerCase();
                                            return type.includes('comp') && (status === 'approved' || status === 'correction_made' || status.includes('pending'));
                                        }).length;
                                        return `${count} request${count !== 1 ? 's' : ''}`;
                                    })()}
                                </span>
                            </div>

                            {(() => {
                                const allLeaves = yearlyData?.leaves?.length ? yearlyData.leaves : requests;
                                const compLeaves = (allLeaves || [])
                                    .filter(l => {
                                        const type = (l.leaveType || (l as any).leave_type || '').toLowerCase();
                                        const status = (l.status || '').toLowerCase();
                                        return type.includes('comp') && (status === 'approved' || status === 'correction_made' || status.includes('pending'));
                                    })
                                    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

                                if (compLeaves.length === 0) {
                                    return (
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                                            No Compensatory Off leaves applied or taken in this calendar year.
                                        </div>
                                    );
                                }

                                let cumDays = 0;
                                return (
                                    <>
                                        <div className="hidden sm:block border border-slate-200 dark:border-[#134426] rounded-xl overflow-x-auto shadow-2xs">
                                            <table className="w-full text-left text-xs border-collapse min-w-[660px]">
                                                <thead>
                                                    <tr className="bg-slate-100/80 dark:bg-[#041b0f] text-slate-600 dark:text-white/80 font-bold border-b border-slate-200 dark:border-[#134426]">
                                                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                        <th className="py-2.5 px-3 whitespace-nowrap">Dates</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Days</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Cumulative</th>
                                                        <th className="py-2.5 px-3">Reason</th>
                                                        <th className="py-2.5 px-3 whitespace-nowrap">Approved By</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-[#134426]/60">
                                                    {compLeaves.map((l, idx) => {
                                                        let days = l.dayOption === 'half' ? 0.5 : 1;
                                                        if (l.startDate !== l.endDate && l.dayOption !== 'half') {
                                                            days = differenceInCalendarDays(new Date(l.endDate.replace(/-/g, '/')), new Date(l.startDate.replace(/-/g, '/'))) + 1;
                                                        }
                                                        cumDays += days;
                                                        const isSingle = l.startDate === l.endDate;
                                                        const dateDisplay = isSingle
                                                            ? format(new Date(l.startDate.replace(/-/g, '/')), 'dd MMM yyyy')
                                                            : `${format(new Date(l.startDate.replace(/-/g, '/')), 'dd MMM')} - ${format(new Date(l.endDate.replace(/-/g, '/')), 'dd MMM yyyy')}`;
                                                        const { approverName, approverPhoto, approvedDateStr } = getLeaveApprovalInfo(l);

                                                        return (
                                                            <tr key={l.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-[#041b0f]/60 transition-colors">
                                                                <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] text-center">{idx + 1}</td>
                                                                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{dateDisplay}</td>
                                                                <td className="py-2.5 px-3 text-center font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">-{days}d</td>
                                                                <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-white/80 whitespace-nowrap">{cumDays}d</td>
                                                                <td className="py-2.5 px-3 text-slate-600 dark:text-white/70 max-w-[200px] break-words" title={l.reason}>{l.reason || '-'}</td>
                                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                                    <div className="flex items-center gap-2.5">
                                                                        {approverPhoto ? (
                                                                            <img 
                                                                                src={approverPhoto} 
                                                                                alt={approverName} 
                                                                                className="w-7 h-7 rounded-full object-cover border border-emerald-300 dark:border-[#134426] shadow-2xs flex-shrink-0"
                                                                                onError={(e) => {
                                                                                    (e.target as HTMLElement).style.display = 'none';
                                                                                    const fallback = (e.target as HTMLElement).nextElementSibling;
                                                                                    if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                                                                                }}
                                                                            />
                                                                        ) : null}
                                                                        <div 
                                                                            className={`w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] flex items-center justify-center border border-emerald-300 dark:border-[#134426] flex-shrink-0 ${approverPhoto ? 'hidden' : ''}`}
                                                                        >
                                                                            {(approverName || 'A').charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px]" title={approverName}>
                                                                                {approverName}
                                                                            </span>
                                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                                <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                                                    l.status === 'approved' || l.status === 'correction_made'
                                                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                                                }`}>
                                                                                    {l.status}
                                                                                </span>
                                                                                {approvedDateStr && (
                                                                                    <span className="text-[10px] text-slate-500 dark:text-white/60 whitespace-nowrap">
                                                                                        • {approvedDateStr}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="sm:hidden space-y-3">
                                            {(() => {
                                                let mobileCum = 0;
                                                return compLeaves.map((l, idx) => {
                                                    let days = l.dayOption === 'half' ? 0.5 : 1;
                                                    if (l.startDate !== l.endDate && l.dayOption !== 'half') {
                                                        days = differenceInCalendarDays(new Date(l.endDate.replace(/-/g, '/')), new Date(l.startDate.replace(/-/g, '/'))) + 1;
                                                    }
                                                    mobileCum += days;
                                                    const isSingle = l.startDate === l.endDate;
                                                    const dateDisplay = isSingle
                                                        ? format(new Date(l.startDate.replace(/-/g, '/')), 'dd MMM yyyy')
                                                        : `${format(new Date(l.startDate.replace(/-/g, '/')), 'dd MMM')} - ${format(new Date(l.endDate.replace(/-/g, '/')), 'dd MMM yyyy')}`;
                                                    const { approverName, approverPhoto, approvedDateStr } = getLeaveApprovalInfo(l);

                                                    return (
                                                        <div key={l.id || idx} className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#041b0f]/60 border border-slate-200 dark:border-[#134426] space-y-2.5">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#134426] text-slate-600 dark:text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                                                        {idx + 1}
                                                                    </span>
                                                                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                                        {dateDisplay}
                                                                    </span>
                                                                </div>
                                                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                                                                    l.status === 'approved' || l.status === 'correction_made'
                                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                                }`}>
                                                                    {l.status}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 dark:border-[#134426]/60">
                                                                <span className="text-slate-500 dark:text-white/60 text-[11px]">
                                                                    Deducted: <strong className="text-rose-600 dark:text-rose-400 font-bold">-{days}d</strong>
                                                                </span>
                                                                <span className="text-slate-500 dark:text-white/60 text-[11px]">
                                                                    Cumulative: <strong className="text-slate-700 dark:text-white/90 font-bold">{mobileCum}d</strong>
                                                                </span>
                                                            </div>
                                                            {l.reason && (
                                                                <p className="text-[11px] text-slate-600 dark:text-white/70 bg-white dark:bg-black/20 p-2 rounded-lg border border-slate-200/50 dark:border-white/5 leading-relaxed">
                                                                    {l.reason}
                                                                </p>
                                                            )}
                                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-[#134426]/60 text-xs">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    {approverPhoto ? (
                                                                        <img 
                                                                            src={approverPhoto} 
                                                                            alt={approverName} 
                                                                            className="w-6 h-6 rounded-full object-cover border border-emerald-300 dark:border-[#134426] flex-shrink-0"
                                                                            onError={(e) => {
                                                                                (e.target as HTMLElement).style.display = 'none';
                                                                                const fallback = (e.target as HTMLElement).nextElementSibling;
                                                                                if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <div className={`w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center border border-emerald-300 dark:border-[#134426] flex-shrink-0 ${approverPhoto ? 'hidden' : ''}`}>
                                                                        {(approverName || 'A').charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-[11px] font-semibold text-slate-800 dark:text-white/90 truncate">
                                                                            Approved by <strong className="font-bold text-slate-900 dark:text-white">{approverName}</strong>
                                                                        </span>
                                                                        {approvedDateStr && (
                                                                            <span className="text-[10px] text-slate-500 dark:text-white/60">
                                                                                {approvedDateStr}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* TAB 3: BALANCE TRACKER (PASSBOOK / LEDGER) */}
                    {compModalTab === 'balance' && (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                    Chronological Comp Off Balance Ledger (Capped at 4.0d)
                                </h4>
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-[#44D62C]">
                                    Current Available: {(((balanceDataState?.compOffTotal || 0) - (balanceDataState?.compOffUsed || 0) - (balanceDataState?.compOffPending || 0))).toFixed(1)}d / 4
                                </span>
                            </div>

                            {compOffLedger.length > 0 ? (
                                <>
                                    <div className="hidden sm:block border border-slate-200 dark:border-[#134426] rounded-xl overflow-x-auto shadow-2xs">
                                        <table className="w-full text-left text-xs border-collapse min-w-[680px]">
                                            <thead>
                                                <tr className="bg-slate-100/80 dark:bg-[#041b0f] text-slate-600 dark:text-white/80 font-bold border-b border-slate-200 dark:border-[#134426]">
                                                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                    <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                                                    <th className="py-2.5 px-3 whitespace-nowrap">Transaction</th>
                                                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Type</th>
                                                    <th className="py-2.5 px-3 text-center whitespace-nowrap font-bold">Change</th>
                                                    <th className="py-2.5 px-3 text-center whitespace-nowrap font-bold text-blue-600 dark:text-blue-400">Balance</th>
                                                    <th className="py-2.5 px-3 whitespace-nowrap">Status / Source</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-[#134426]/60">
                                                {compOffLedger.map((entry, idx) => (
                                                    <tr key={entry.id} className="hover:bg-slate-50/80 dark:hover:bg-[#041b0f]/60 transition-colors">
                                                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px] text-center">{idx + 1}</td>
                                                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                            {format(new Date(entry.date.replace(/-/g, '/')), 'dd MMM yyyy')}
                                                        </td>
                                                        <td className="py-2 px-3 max-w-[220px]">
                                                            <div className="font-semibold text-slate-900 dark:text-white truncate">{entry.description}</div>
                                                            {entry.details && (
                                                                <div className="text-[10px] text-slate-500 dark:text-white/60 truncate">{entry.details}</div>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 text-center whitespace-nowrap">
                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                                entry.type === 'credit'
                                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                    : entry.type === 'debit'
                                                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                                            }`}>
                                                                {entry.type === 'credit' ? 'Credit (+)' : entry.type === 'debit' ? 'Debit (-)' : 'Opening'}
                                                            </span>
                                                        </td>
                                                        <td className={`py-2 px-3 text-center font-bold whitespace-nowrap ${
                                                            entry.type === 'credit'
                                                                ? 'text-emerald-600 dark:text-[#44D62C]'
                                                                : entry.type === 'debit'
                                                                ? 'text-rose-600 dark:text-rose-400'
                                                                : 'text-blue-600 dark:text-blue-400'
                                                        }`}>
                                                            {entry.type === 'credit' ? `+${entry.amount.toFixed(1)}d` : entry.type === 'debit' ? `-${entry.amount.toFixed(1)}d` : `${entry.amount.toFixed(1)}d`}
                                                        </td>
                                                        <td className="py-2 px-3 text-center font-black text-slate-900 dark:text-white whitespace-nowrap">
                                                            <span>{entry.runningBalance.toFixed(1)}d</span>
                                                            {entry.isCapped && (
                                                                <span className="ml-1 text-[9px] text-amber-500 font-bold block">(Capped 4d)</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 whitespace-nowrap text-slate-600 dark:text-white/70">
                                                            {entry.approverName ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    {entry.approverPhoto && (
                                                                        <img src={entry.approverPhoto} alt={entry.approverName} className="w-5 h-5 rounded-full object-cover" />
                                                                    )}
                                                                    <span className="font-semibold text-slate-800 dark:text-white">{entry.approverName}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-500 dark:text-white/50 italic">Holiday / Sunday Punch</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="sm:hidden space-y-2.5">
                                        {compOffLedger.map((entry, idx) => (
                                            <div key={entry.id} className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#041b0f]/60 border border-slate-200 dark:border-[#134426] space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#134426] text-slate-600 dark:text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                                            {idx + 1}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                            {format(new Date(entry.date.replace(/-/g, '/')), 'dd MMM yyyy')}
                                                        </span>
                                                    </div>
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        entry.type === 'credit'
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                            : entry.type === 'debit'
                                                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                                    }`}>
                                                        {entry.type === 'credit' ? `+${entry.amount.toFixed(1)}d Credit` : entry.type === 'debit' ? `-${entry.amount.toFixed(1)}d Debit` : `${entry.amount.toFixed(1)}d Opening`}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-800 dark:text-white font-semibold">
                                                    {entry.description}
                                                </div>
                                                {entry.details && (
                                                    <div className="text-[11px] text-slate-500 dark:text-white/60">
                                                        {entry.details}
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 dark:border-[#134426]/60">
                                                    <span className="text-slate-500 dark:text-white/60 text-[11px]">
                                                        {entry.approverName ? `Approved by ${entry.approverName}` : 'Biometric Work Grant'}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                                                        Pool: <strong className="text-blue-600 dark:text-blue-400 text-xs font-black">{entry.runningBalance.toFixed(1)}d / 4</strong>
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                                    No Comp Off ledger entries recorded.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>
            {/* Permission Pool Tracker Modal */}
            <Modal
                isOpen={showPermissionModal}
                onClose={() => setShowPermissionModal(false)}
                title={`Permission Pool Tracker - ${format(viewingDate, 'MMMM yyyy')}`}
                maxWidth="md:max-w-3xl lg:max-w-4xl"
                footer={
                    <div className="flex justify-end">
                        <Button
                            onClick={() => setShowPermissionModal(false)}
                            variant="secondary"
                        >
                            Close
                        </Button>
                    </div>
                }
            >
                <div className="space-y-5 text-slate-800 dark:text-slate-100">
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-center">
                            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-1">
                                Monthly Pool
                            </span>
                            <span className="text-lg sm:text-xl md:text-2xl font-black text-emerald-900 dark:text-emerald-100">
                                3h 00m
                            </span>
                        </div>
                        <div className="p-3 sm:p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-center">
                            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 block mb-1">
                                Total Used
                            </span>
                            <span className="text-lg sm:text-xl md:text-2xl font-black text-rose-900 dark:text-rose-100">
                                {Math.floor(totalPermissionMinsUsed / 60)}h {String(totalPermissionMinsUsed % 60).padStart(2, '0')}m
                            </span>
                        </div>
                        <div className="p-3 sm:p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 text-center">
                            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block mb-1">
                                Remaining
                            </span>
                            <span className="text-lg sm:text-xl md:text-2xl font-black text-blue-900 dark:text-blue-100">
                                {Math.max(0, Math.floor((180 - totalPermissionMinsUsed) / 60))}h {String(Math.max(0, (180 - totalPermissionMinsUsed) % 60)).padStart(2, '0')}m
                            </span>
                        </div>
                    </div>

                    {/* Policy & Usage Progress Bar */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#041b0f] border border-slate-200 dark:border-[#134426] space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-[#44D62C] flex-shrink-0" />
                                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                    Permission Pool Policy
                                </span>
                            </div>
                            <span className="text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#44D62C]/20 text-[#44D62C] border border-[#44D62C]/30 w-fit">
                                3 Hours / Month (180m)
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-white/80 leading-relaxed">
                            Every employee is allocated a monthly pool of <strong>3 hours (180 minutes)</strong> for personal permission requests. Any <strong>early departures</strong> (leaving work before completing daily required shift hours) are automatically deducted from this pool.
                        </p>

                        {/* Progress Bar */}
                        <div className="space-y-1.5 pt-1">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[11px] font-semibold text-slate-500 dark:text-white/70 gap-0.5">
                                <span>Used: <strong className="text-slate-900 dark:text-white">{totalPermissionMinsUsed} mins</strong></span>
                                <span>Remaining: <strong className="text-emerald-600 dark:text-[#44D62C]">{Math.max(0, 180 - totalPermissionMinsUsed)} mins</strong></span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-[#092c19] h-2.5 rounded-full overflow-hidden border border-slate-300 dark:border-[#134426]">
                                <div 
                                    className={`h-full rounded-full transition-all duration-300 ${
                                        totalPermissionMinsUsed > 180 ? 'bg-rose-500' : 'bg-[#44D62C]'
                                    }`}
                                    style={{ width: `${Math.min(100, (totalPermissionMinsUsed / 180) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Applied Permission Requests */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                Applied Permission Requests ({format(viewingDate, 'MMMM yyyy')})
                            </h4>
                            <span className="text-[11px] font-bold text-slate-500 dark:text-white/60">
                                {(() => {
                                    const mKey = format(startOfMonth(viewingDate), 'yyyy-MM');
                                    const count = requests.filter(r => {
                                        const type = (r.leaveType || '').toLowerCase();
                                        return type.includes('permission') && r.startDate.startsWith(mKey);
                                    }).length;
                                    return `${count} request${count !== 1 ? 's' : ''}`;
                                })()}
                            </span>
                        </div>

                        {(() => {
                            const mKey = format(startOfMonth(viewingDate), 'yyyy-MM');
                            const permRequests = requests
                                .filter(r => {
                                    const type = (r.leaveType || '').toLowerCase();
                                    return type.includes('permission') && r.startDate.startsWith(mKey);
                                })
                                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

                            if (permRequests.length === 0) {
                                return (
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                                        No permission requests submitted for this month.
                                    </div>
                                );
                            }

                            return (
                                <>
                                    {/* Desktop & Tablet Table View */}
                                    <div className="hidden sm:block border border-slate-200 dark:border-[#134426] rounded-xl overflow-x-auto shadow-2xs">
                                        <table className="w-full text-left text-xs border-collapse min-w-[660px]">
                                            <thead>
                                                <tr className="bg-slate-100/80 dark:bg-[#041b0f] text-slate-600 dark:text-white/80 font-bold border-b border-slate-200 dark:border-[#134426]">
                                                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                    <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                                                    <th className="py-2.5 px-3 whitespace-nowrap">Timing / Session</th>
                                                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Duration</th>
                                                    <th className="py-2.5 px-3">Reason</th>
                                                    <th className="py-2.5 px-3 whitespace-nowrap">Approved By</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-[#134426]/60">
                                                {permRequests.map((r, idx) => {
                                                    const timing = (r.correctionDetails?.punchIn && r.correctionDetails?.punchOut)
                                                        ? `${r.correctionDetails.punchIn} - ${r.correctionDetails.punchOut}`
                                                        : (r.dayOption || 'Standard');
                                                    const mins = r.correctionDetails?.permissionMinutes || 120;
                                                    const { approverName, approverPhoto, approvedDateStr } = getLeaveApprovalInfo(r);

                                                    return (
                                                        <tr key={r.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-[#041b0f]/60 transition-colors">
                                                            <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] text-center">{idx + 1}</td>
                                                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                                {format(new Date(r.startDate.replace(/-/g, '/')), 'dd MMM yyyy')}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-slate-600 dark:text-white/80 whitespace-nowrap">{timing}</td>
                                                            <td className="py-2.5 px-3 text-center font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">-{mins}m</td>
                                                            <td className="py-2.5 px-3 text-slate-600 dark:text-white/70 max-w-[200px] break-words" title={r.reason}>{r.reason || '-'}</td>
                                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                                <div className="flex items-center gap-2.5">
                                                                    {approverPhoto ? (
                                                                        <img 
                                                                            src={approverPhoto} 
                                                                            alt={approverName} 
                                                                            className="w-7 h-7 rounded-full object-cover border border-emerald-300 dark:border-[#134426] shadow-2xs flex-shrink-0"
                                                                            onError={(e) => {
                                                                                (e.target as HTMLElement).style.display = 'none';
                                                                                const fallback = (e.target as HTMLElement).nextElementSibling;
                                                                                if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <div 
                                                                        className={`w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] flex items-center justify-center border border-emerald-300 dark:border-[#134426] flex-shrink-0 ${approverPhoto ? 'hidden' : ''}`}
                                                                    >
                                                                        {(approverName || 'A').charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px]" title={approverName}>
                                                                            {approverName}
                                                                        </span>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                                                r.status === 'approved' || r.status === 'correction_made'
                                                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                                            }`}>
                                                                                {r.status}
                                                                            </span>
                                                                            {approvedDateStr && (
                                                                                <span className="text-[10px] text-slate-500 dark:text-white/60 whitespace-nowrap">
                                                                                    • {approvedDateStr}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Card List */}
                                    <div className="sm:hidden space-y-2.5">
                                        {permRequests.map((r, idx) => {
                                            const timing = (r.correctionDetails?.punchIn && r.correctionDetails?.punchOut)
                                                ? `${r.correctionDetails.punchIn} - ${r.correctionDetails.punchOut}`
                                                : (r.dayOption || 'Standard');
                                            const mins = r.correctionDetails?.permissionMinutes || 120;
                                            const { approverName, approverPhoto, approvedDateStr } = getLeaveApprovalInfo(r);

                                            return (
                                                <div key={r.id || idx} className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#041b0f]/60 border border-slate-200 dark:border-[#134426] space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#134426] text-slate-600 dark:text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                                {format(new Date(r.startDate.replace(/-/g, '/')), 'dd MMM yyyy')}
                                                            </span>
                                                        </div>
                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                                                            r.status === 'approved' || r.status === 'correction_made'
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                        }`}>
                                                            {r.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 dark:border-[#134426]/60">
                                                        <span className="text-slate-500 dark:text-white/60 text-[11px]">
                                                            Slot: <strong className="text-slate-800 dark:text-white">{timing}</strong>
                                                        </span>
                                                        <span className="text-slate-500 dark:text-white/60 text-[11px]">
                                                            Duration: <strong className="text-rose-600 dark:text-rose-400 font-bold">-{mins}m</strong>
                                                        </span>
                                                    </div>
                                                    {r.reason && (
                                                        <p className="text-[11px] text-slate-600 dark:text-white/70 bg-white dark:bg-black/20 p-2 rounded-lg border border-slate-200/50 dark:border-white/5 leading-relaxed">
                                                            {r.reason}
                                                        </p>
                                                    )}
                                                    {/* Approver info footer */}
                                                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-[#134426]/60 text-xs">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {approverPhoto ? (
                                                                <img 
                                                                    src={approverPhoto} 
                                                                    alt={approverName} 
                                                                    className="w-6 h-6 rounded-full object-cover border border-emerald-300 dark:border-[#134426] flex-shrink-0"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLElement).style.display = 'none';
                                                                        const fallback = (e.target as HTMLElement).nextElementSibling;
                                                                        if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <div className={`w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center border border-emerald-300 dark:border-[#134426] flex-shrink-0 ${approverPhoto ? 'hidden' : ''}`}>
                                                                {(approverName || 'A').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[11px] font-semibold text-slate-800 dark:text-white/90 truncate">
                                                                    Approved by <strong className="font-bold text-slate-900 dark:text-white">{approverName}</strong>
                                                                </span>
                                                                {approvedDateStr && (
                                                                    <span className="text-[10px] text-slate-500 dark:text-white/60">
                                                                        {approvedDateStr}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Early Departure Auto-Deductions */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                Early Departure Auto-Deductions ({format(viewingDate, 'MMMM yyyy')})
                            </h4>
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                Total: -{totalEarlyDepartureMins}m deducted
                            </span>
                        </div>

                        {earlyDepartureDeductionsList.length > 0 ? (
                            <>
                                <div className="hidden sm:block border border-slate-200 dark:border-[#134426] rounded-xl overflow-x-auto shadow-2xs">
                                    <table className="w-full text-left text-xs border-collapse min-w-[540px]">
                                        <thead>
                                            <tr className="bg-slate-100/80 dark:bg-[#041b0f] text-slate-600 dark:text-white/80 font-bold border-b border-slate-200 dark:border-[#134426]">
                                                <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                                                <th className="py-2.5 px-3 whitespace-nowrap">Worked Duration</th>
                                                <th className="py-2.5 px-3 whitespace-nowrap">Deduction Window</th>
                                                <th className="py-2.5 px-3 text-center whitespace-nowrap">Auto-Deducted</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-[#134426]/60">
                                            {earlyDepartureDeductionsList.map((ed, idx) => (
                                                <tr key={ed.dateStr || idx} className="hover:bg-slate-50/80 dark:hover:bg-[#041b0f]/60 transition-colors">
                                                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] text-center">{idx + 1}</td>
                                                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                        {format(new Date(ed.dateStr.replace(/-/g, '/')), 'dd MMM yyyy')}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-slate-600 dark:text-white/80 whitespace-nowrap">
                                                        {ed.formattedWorked} (Expected 8h)
                                                    </td>
                                                    <td className="py-2.5 px-3 text-slate-600 dark:text-white/80 whitespace-nowrap">
                                                        {ed.permissionTimeRange}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center font-bold whitespace-nowrap">
                                                        {ed.earlyMins > 0 ? (
                                                            <span className="text-amber-600 dark:text-amber-400">-{ed.earlyMins}m</span>
                                                        ) : (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold">0m (3h Limit Reached)</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="sm:hidden space-y-2.5">
                                    {earlyDepartureDeductionsList.map((ed, idx) => (
                                        <div key={ed.dateStr || idx} className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#041b0f]/60 border border-slate-200 dark:border-[#134426] space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#134426] text-slate-600 dark:text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                        {format(new Date(ed.dateStr.replace(/-/g, '/')), 'dd MMM yyyy')}
                                                    </span>
                                                </div>
                                                {ed.earlyMins > 0 ? (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex-shrink-0">
                                                        -{ed.earlyMins}m
                                                    </span>
                                                ) : (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 flex-shrink-0">
                                                        0m (Limit Reached)
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs space-y-1 pt-1.5 border-t border-slate-200/60 dark:border-[#134426]/60 text-[11px] text-slate-500 dark:text-white/60">
                                                <div>Worked: <strong className="text-slate-800 dark:text-white">{ed.formattedWorked}</strong> (Expected 8h)</div>
                                                <div>Window: <strong className="text-slate-800 dark:text-white">{ed.permissionTimeRange}</strong></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                                No early departure auto-deductions recorded for this month.
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Blue Leave (Floating) Tracker Modal */}
            <Modal
                isOpen={showBlueLeaveModal}
                onClose={() => setShowBlueLeaveModal(false)}
                title={`Blue Leave (Floating) Tracker - ${format(viewingDate, 'MMMM yyyy')}`}
                maxWidth="md:max-w-3xl lg:max-w-4xl"
                footer={
                    <div className="flex justify-end">
                        <Button
                            onClick={() => setShowBlueLeaveModal(false)}
                            variant="secondary"
                        >
                            Close
                        </Button>
                    </div>
                }
            >
                {(() => {
                    const monthStart = startOfMonth(viewingDate);
                    const monthEnd = endOfMonth(viewingDate);
                    let thirdSaturday: Date | null = null;
                    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
                    let satCount = 0;
                    for (const day of daysInMonth) {
                        if (day.getDay() === 6) {
                            satCount++;
                            if (satCount === 3) {
                                thirdSaturday = day;
                                break;
                            }
                        }
                    }
                    const today = new Date();
                    const thirdSatPassed = thirdSaturday && startOfDay(thirdSaturday) <= startOfDay(today);
                    const isPastMonth = monthEnd < startOfDay(today);

                    let workedOn3rdSat = false;
                    if (thirdSaturday) {
                        const thirdSatStr = format(thirdSaturday, 'yyyy-MM-dd');
                        workedOn3rdSat = events.some(e => {
                            const eDate = format(new Date(e.timestamp), 'yyyy-MM-dd');
                            const eventType = String(e.type || '').toLowerCase();
                            return eDate === thirdSatStr && (
                                eventType === 'punch-in' || eventType === 'check-in' ||
                                eventType === 'punch_in' || eventType === 'checkin' ||
                                eventType === 'site-in' || eventType === 'site_in'
                            );
                        });
                        if (!workedOn3rdSat) {
                            const allRelevantLeaves = [...(yearlyData?.leaves || []), ...requests].filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);
                            workedOn3rdSat = allRelevantLeaves.some(req => {
                                const reqType = (req.leaveType || '').toLowerCase();
                                const reqDate = req.startDate;
                                return reqDate === thirdSatStr && 
                                       (req.status === 'approved' || req.status === 'correction_made') && 
                                       (reqType.includes('blue leave work') || reqType.includes('correction') || reqType.includes('comp'));
                            });
                        }
                    }

                    // Find all applied blue/floating leaves for this viewing month
                    const allLeaves = yearlyData?.leaves?.length ? yearlyData.leaves : requests;
                    const blueLeavesThisMonth = (allLeaves || []).filter(req => {
                        let type = (req.leaveType || (req as any).leave_type || '').toLowerCase();
                        const reqStart = new Date(req.startDate.replace(/-/g, '/'));
                        const is3rdSat = reqStart.getDay() === 6 && Math.ceil(reqStart.getDate() / 7) === 3;
                        if (is3rdSat && isMale && (type.includes('sick') || type === 'sl' || type === 's/l')) {
                            type = 'floating';
                        }
                        if (type.includes('floating') || type === 'fh' || type === 'blue leave' || type === 'blue') {
                            return reqStart >= monthStart && reqStart <= monthEnd;
                        }
                        return false;
                    });

                    return (
                        <div className="space-y-5 text-slate-800 dark:text-slate-100">
                            {/* Top KPI Cards */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-center">
                                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-1">
                                        Monthly Grant
                                    </span>
                                    <span className="text-lg sm:text-xl md:text-2xl font-black text-emerald-900 dark:text-emerald-100">
                                        {blueLeaveStatus.total.toFixed(1)}d
                                    </span>
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                                        1 Day / Month
                                    </span>
                                </div>

                                <div className="p-3 sm:p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-center">
                                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 block mb-1">
                                        Consumed
                                    </span>
                                    <span className="text-lg sm:text-xl md:text-2xl font-black text-rose-900 dark:text-rose-100">
                                        {blueLeaveStatus.used.toFixed(1)}d
                                    </span>
                                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold block mt-0.5">
                                        {blueLeaveStatus.available === 0 && !workedOn3rdSat && thirdSatPassed ? 'Taken as 3rd Sat' : 'Used This Month'}
                                    </span>
                                </div>

                                <div className="p-3 sm:p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 text-center">
                                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block mb-1">
                                        Available Net
                                    </span>
                                    <span className="text-lg sm:text-xl md:text-2xl font-black text-blue-900 dark:text-blue-100">
                                        {blueLeaveStatus.available.toFixed(1)}d
                                    </span>
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold block mt-0.5">
                                        {blueLeaveStatus.available > 0 ? `Expires ${format(monthEnd, 'dd MMM')}` : (isPastMonth ? 'Expired at Month End' : 'Locked (Work 3rd Sat)')}
                                    </span>
                                </div>
                            </div>

                            {/* 3rd Saturday Status Banner */}
                            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#041b0f] border border-slate-200 dark:border-[#134426] space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-[#44D62C] flex-shrink-0" />
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                            3rd Saturday Work Status ({format(viewingDate, 'MMMM yyyy')})
                                        </span>
                                    </div>
                                    {thirdSaturday && (
                                        <span className={`text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-md border w-fit ${
                                            !thirdSatPassed
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                                                : workedOn3rdSat
                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-[#134426] dark:text-[#44D62C] border-emerald-300 dark:border-[#44D62C]/40'
                                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                        }`}>
                                            {!thirdSatPassed
                                                ? 'Upcoming (Accrues upon working)'
                                                : workedOn3rdSat
                                                    ? 'Worked & Accrued (+1.0d)'
                                                    : 'Taken as Holiday (0d Available)'}
                                        </span>
                                    )}
                                </div>

                                <div className="text-xs text-slate-600 dark:text-white/80 space-y-2">
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="font-semibold text-slate-500 dark:text-white/60">3rd Saturday Date:</span>
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            {thirdSaturday ? format(thirdSaturday, 'EEEE, dd MMMM yyyy') : 'Not applicable'}
                                        </span>
                                    </div>
                                    <p className="leading-relaxed">
                                        {!thirdSatPassed ? (
                                            <>The 3rd Saturday of {format(viewingDate, 'MMMM yyyy')} has not yet occurred. Under company policy, employees must <strong>physically work and punch in</strong> on the 3rd Saturday to earn 1.0 day of Blue Leave. It cannot be taken in advance.</>
                                        ) : workedOn3rdSat ? (
                                            <>Attendance records confirm you <strong>worked on the 3rd Saturday</strong> ({thirdSaturday ? format(thirdSaturday, 'dd MMM') : ''}). Your 1.0 day Blue Leave was unlocked and is available to use until <strong>{format(monthEnd, 'dd MMM yyyy')}</strong>.</>
                                        ) : (
                                            <>You did not work on the 3rd Saturday ({thirdSaturday ? format(thirdSaturday, 'dd MMM') : ''}) or took it as a holiday. As per policy, the 1-day floating allowance is consumed as the holiday itself, so <strong>0 days are available</strong> to take elsewhere.</>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Blue Leave Policy Rules */}
                            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#041b0f] border border-slate-200 dark:border-[#134426] space-y-2">
                                <div className="flex items-center gap-2">
                                    <Info className="w-4 h-4 text-[#44D62C] flex-shrink-0" />
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                        Blue Leave Policy Guidelines
                                    </span>
                                </div>
                                <ul className="text-xs text-slate-600 dark:text-white/80 space-y-1.5 list-disc pl-4 leading-relaxed">
                                    <li><strong>Eligibility:</strong> Applicable for male employees at the Bangalore office.</li>
                                    <li><strong>Earning Condition:</strong> 1.0 day is earned only after working on the 3rd Saturday of the calendar month.</li>
                                    <li><strong>Monthly Validity:</strong> Must be consumed within the same calendar month. <strong>Strictly non-cumulative</strong> and does not carry forward to the next month.</li>
                                    <li><strong>No Advance Leave:</strong> Cannot be applied or availed prior to working on the 3rd Saturday.</li>
                                </ul>
                            </div>

                            {/* Applied Blue Leaves This Month */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                                        Blue Leave Applications ({format(viewingDate, 'MMMM yyyy')})
                                    </h4>
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-white/70">
                                        {blueLeavesThisMonth.length} request{blueLeavesThisMonth.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                {blueLeavesThisMonth.length > 0 ? (
                                    <>
                                        <div className="hidden sm:block border border-slate-200 dark:border-[#134426] rounded-xl overflow-x-auto shadow-2xs">
                                            <table className="w-full text-left text-xs border-collapse min-w-[560px]">
                                                <thead>
                                                    <tr className="bg-slate-100/80 dark:bg-[#041b0f] text-slate-600 dark:text-white/80 font-bold border-b border-slate-200 dark:border-[#134426]">
                                                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                        <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                                                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Duration</th>
                                                        <th className="py-2.5 px-3">Reason</th>
                                                        <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                                                        <th className="py-2.5 px-3 whitespace-nowrap">Approved By</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-[#134426]/60">
                                                    {blueLeavesThisMonth.map((req, idx) => {
                                                        const { approverName, approverPhoto, approvedDateStr } = getLeaveApprovalInfo(req);
                                                        const isHalf = req.dayOption === 'half';
                                                        const days = isHalf ? 0.5 : (differenceInCalendarDays(new Date(req.endDate.replace(/-/g, '/')), new Date(req.startDate.replace(/-/g, '/'))) + 1);

                                                        return (
                                                            <tr key={req.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-[#041b0f]/60 transition-colors">
                                                                <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] text-center">{idx + 1}</td>
                                                                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                                    {format(new Date(req.startDate.replace(/-/g, '/')), 'dd MMM yyyy')}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                                                    -{days}d
                                                                </td>
                                                                <td className="py-2.5 px-3 text-slate-600 dark:text-white/70 max-w-[200px] break-words" title={req.reason}>
                                                                    {req.reason || '-'}
                                                                </td>
                                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                                        req.status === 'approved' || req.status === 'correction_made'
                                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                                    }`}>
                                                                        {req.status}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                                    <div className="flex items-center gap-2">
                                                                        {approverPhoto ? (
                                                                            <img 
                                                                                src={approverPhoto} 
                                                                                alt={approverName} 
                                                                                className="w-6 h-6 rounded-full object-cover border border-emerald-300 dark:border-[#134426] flex-shrink-0"
                                                                                onError={(e) => {
                                                                                    (e.target as HTMLElement).style.display = 'none';
                                                                                    const fallback = (e.target as HTMLElement).nextElementSibling;
                                                                                    if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                                                                                }}
                                                                            />
                                                                        ) : null}
                                                                        <div className={`w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center border border-emerald-300 dark:border-[#134426] flex-shrink-0 ${approverPhoto ? 'hidden' : ''}`}>
                                                                            {(approverName || 'A').charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                                                {approverName}
                                                                            </span>
                                                                            {approvedDateStr && (
                                                                                <span className="text-[10px] text-slate-500 dark:text-white/60">
                                                                                    {approvedDateStr}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="sm:hidden space-y-2.5">
                                            {blueLeavesThisMonth.map((req, idx) => {
                                                const { approverName, approverPhoto, approvedDateStr } = getLeaveApprovalInfo(req);
                                                const isHalf = req.dayOption === 'half';
                                                const days = isHalf ? 0.5 : (differenceInCalendarDays(new Date(req.endDate.replace(/-/g, '/')), new Date(req.startDate.replace(/-/g, '/'))) + 1);

                                                return (
                                                    <div key={req.id || idx} className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#041b0f]/60 border border-slate-200 dark:border-[#134426] space-y-2">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#134426] text-slate-600 dark:text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                                                    {idx + 1}
                                                                </span>
                                                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                                    {format(new Date(req.startDate.replace(/-/g, '/')), 'dd MMM yyyy')}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                                                                    -{days}d
                                                                </span>
                                                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                                    req.status === 'approved' || req.status === 'correction_made'
                                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                                }`}>
                                                                    {req.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {req.reason && (
                                                            <p className="text-[11px] text-slate-600 dark:text-white/70 bg-white dark:bg-black/20 p-2 rounded-lg border border-slate-200/50 dark:border-white/5">
                                                                {req.reason}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 dark:border-[#134426]/60 text-slate-500 dark:text-white/60 text-[11px]">
                                                            <span>Approver: <strong className="text-slate-900 dark:text-white">{approverName}</strong></span>
                                                            {approvedDateStr && <span>{approvedDateStr}</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 text-center">
                                        No Blue / Floating Leave requests applied for {format(viewingDate, 'MMMM yyyy')}.
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </Modal>


            {/* Leave Details Modal */}
            <LeaveDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => {
                    setIsDetailsModalOpen(false);
                    setSelectedLeaveRequest(null);
                }}
                request={selectedLeaveRequest}
            />
        </div>
    );
};

export default LeaveDashboard;