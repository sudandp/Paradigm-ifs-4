import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    const [yearlyData, setYearlyData] = useState<{
        events: AttendanceEvent[];
        userHolidays: UserHoliday[];
        leaves: LeaveRequest[];
    } | null>(null);

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
                    
                    // User requested 1.5 EL for every month completed.
                    // Sequence: 1.5, 3.0, 4.5, 6.0, 7.5...
                    if (!catRules.earnedLeaveAccrual || catRules.earnedLeaveAccrual.amountEarned !== 1.5) {
                        catRules.earnedLeaveAccrual = { daysRequired: 30, amountEarned: 1.5 };
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
    const [siteOtDays, setSiteOtDays] = useState(0);
    const [monthlyTravelKm, setMonthlyTravelKm] = useState<number>(0);
    const [monthlyTravelDuration, setMonthlyTravelDuration] = useState<number>(0);
    const [monthlySteps, setMonthlySteps] = useState<number>(0);
    const [dailyActivityRecords, setDailyActivityRecords] = useState<{dateStr: string, travelKm: number, travelDuration: number, steps: number, startTime: string | null, endTime: string | null, startLocation: string | null, endLocation: string | null}[]>([]);
    const [snapshotData, setSnapshotData] = useState<any | null>(null);
    const currentYear = viewingDate.getFullYear();

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

    const fetchData = useCallback(async (isSilent = false) => {
        if (!user) return;
        // Only trigger full page loading state if we don't have any balance data yet
        if (!isSilent && !balanceDataState) {
            setIsLoading(true);
        }
        setError(null);
        // Stale-while-revalidate: Do NOT clear existing balance, events, or paydays to null/empty
        // This ensures the user never sees empty skeleton flashes while data is refreshing.
        
        const dateStr = format(viewingDate, 'yyyy-MM-dd');
        const startOfMonthDate = startOfMonth(viewingDate);
        // Expand range to catch night shifts at the start and end of the month
        const startStr = new Date(startOfWeek(subDays(startOfMonthDate, 15), { weekStartsOn: 1 }).getTime() - 12 * 60 * 60 * 1000).toISOString();
        const endStr = new Date(endOfMonth(viewingDate).getTime() + 36 * 60 * 60 * 1000).toISOString();

        // ── Performance timer ──
        const t0 = performance.now();
        let tFetchStart = 0;
        let tFetchEnd = 0;

        try {
            const startOfYearStr = startOfYear(viewingDate).toISOString();
            const endOfYearStr = endOfYear(viewingDate).toISOString();

            // Fetch base data points
            tFetchStart = performance.now();
            const [balanceData, requestsData, compOffData, eventsData, settings, recurringData, selections, yearlyEvents, yearlyRequests, userChildrenData, routePointsData, snapshotDataRes] = await Promise.all([
                // Use the selected calendar month for balance calculation
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
            tFetchEnd = performance.now();

            const fallbackSettings = useSettingsStore.getState().attendance || {};
            const effectiveSettings = (settings && Object.keys(settings).length > 0) ? settings : fallbackSettings;

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
                    const dayRoutePoints = (routePointsData || []).filter((p: RoutePoint) => isSameDay(new Date(p.timestamp), date));
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
                        // We previously deducted fake steps aggressively here, but phone pedometers
                        // usually don't register full walking steps while driving. 
                        // To avoid wiping out legitimate steps, we cap the deduction.
                        // Assume a much lower rate of false steps while driving, e.g., 0.1 steps per meter.
                        const fakeSteps = Math.floor(vDist * 100);
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
            setDailyActivityRecords(dailyRecords.sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime()));
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
            fetchData();
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
            fetchData();
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
        return explicitMins + totalEarlyDepartureMins;
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

        const totalUsedMins = explicitMins + edMins;
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
        return earlyDepartureDeductionsList.map(ed => {
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
                reason: `Early Departure Auto-Deduction (Worked ${ed.formattedWorked} → Corrected: ${ed.formattedCorrectedWorked})`,
                status: 'approved',
                createdAt: `${ed.dateStr}T${ed.punchOutTime || '17:00'}:00.000Z`,
                correctionDetails: {
                    punchIn: ed.punchOutTime,
                    punchOut: ed.permissionEndTime,
                    permissionMinutes: ed.earlyMins,
                    reason: `Leaving work early (${ed.permissionTimeRange}) automatically deducted from monthly permission pool.`
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
            value: `${parseFloat((balanceDataState.earnedTotal - balanceDataState.earnedUsed - (balanceDataState.earnedPending || 0)).toFixed(1))} / ${parseFloat(balanceDataState.earnedTotal.toFixed(1))}`, 
            description: `Total: ${parseFloat(balanceDataState.earnedTotal.toFixed(1))}d. Available: ${parseFloat((balanceDataState.earnedTotal - balanceDataState.earnedUsed - (balanceDataState.earnedPending || 0)).toFixed(1))}d.${(balanceDataState.earnedPending || 0) > 0 ? ` (Pending: ${balanceDataState.earnedPending}d)` : ''}`,
            icon: Briefcase,
            isExpired: balanceDataState.expiryStates?.earned,
            isHidden: isProbation,
            infoMessage: "Earned Leave can only be taken after it is accrued. Cannot be taken in advance."
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
            value: `${parseFloat((balanceDataState.compOffTotal - balanceDataState.compOffUsed - (balanceDataState.compOffPending || 0)).toFixed(1))} / 4`, 
            description: `Max Capacity: 4d. Available: ${parseFloat((balanceDataState.compOffTotal - balanceDataState.compOffUsed - (balanceDataState.compOffPending || 0)).toFixed(1))}d.${(balanceDataState.compOffPending || 0) > 0 ? ` (Pending: ${balanceDataState.compOffPending}d)` : ''}`,
            icon: CalendarClock,
            isExpired: balanceDataState.expiryStates?.compOff,
            isHidden: isTechnicalRole(user?.role) || isProbation,
            infoMessage: "As per policy, it's restricted for only 4 max limit, even if you have earned more."
        },
        {
            title: 'Permission Pool',
            value: `${Math.floor(totalPermissionMinsUsed / 60)}h ${totalPermissionMinsUsed % 60}m / 3h`,
            description: `Used: ${Math.floor(totalPermissionMinsUsed / 60)}h ${totalPermissionMinsUsed % 60}m. Remaining: ${Math.max(0, Math.floor((180 - totalPermissionMinsUsed) / 60))}h ${Math.max(0, (180 - totalPermissionMinsUsed) % 60)}m.${totalEarlyDepartureMins > 0 ? ` (Includes ${totalEarlyDepartureMins}m early departure auto-deductions)` : ''}`,
            icon: Clock,
            isExpired: false,
            infoMessage: "Monthly 3-hour permission pool. Early departures (punching out before shift completion) are automatically deducted from this pool."
        },
        {
            title: 'Monthly Pay Days',
            value: monthlyPaydays !== null
                ? `${monthlyPaydays}`
                : (snapshotData?.summary?.totalPayableDays !== undefined ? `${snapshotData.summary.totalPayableDays}` : '-'),
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
            value: monthlyPaydays !== null ? `${monthlyPaydays}` : '-',
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
                            Early Departure Permission Auto-Deductions Active
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
                                    <span>Worked {ed.formattedWorked} → <strong className="text-emerald-700 dark:text-emerald-300">Corrected: {ed.formattedCorrectedWorked}</strong></span>
                                    <span className="opacity-60">•</span>
                                    <span className="font-black text-amber-700 dark:text-amber-300">-{ed.earlyMins}m permission deducted</span>
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
                    leaveRequests={[...requests, ...autoEarlyDepartureRequests]} 
                    userHolidays={userHolidays} 
                    currentDate={viewingDate}
                    setCurrentDate={setViewingDate}
                    events={events}
                    settings={attendanceSettings || useSettingsStore.getState().attendance}
                    recurringHolidays={recurringHolidays}
                    isLoading={isLoading}
                    onMonthPaydaysChange={setMonthlyPaydays}
                    onSiteOtDaysChange={setSiteOtDays}
                    isMobile={isMobile}
                />
                {!isTechnicalRole(user?.role) && (
                    <CompOffCalendar 
                        logs={compOffLogs} 
                        leaveRequests={[...requests, ...autoEarlyDepartureRequests]} 
                        userHolidays={userHolidays} 
                        isLoading={isLoading} 
                        viewingDate={viewingDate}
                        onDateChange={setViewingDate}
                        events={events}
                        isMobile={isMobile}
                    />
                )}
                <HolidayCalendar 
                    adminHolidays={adminHolidays} 
                    userSelectedHolidays={userHolidays} 
                    isLoading={isLoading} 
                    viewingDate={viewingDate}
                    onDateChange={setViewingDate}
                    isMobile={isMobile}
                />
                <YearlyAttendanceChart 
                    data={yearlyData}
                    isLoading={isLoading}
                    isMobile={isMobile}
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