import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import type { LeaveBalance, LeaveRequest, LeaveType, LeaveRequestStatus, UploadedFile, CompOffLog, AttendanceEvent, UserHoliday, AttendanceSettings, StaffAttendanceRules, RecurringHolidayRule, UserChild, RoutePoint } from '../../types';
import { Loader2, Plus, ArrowLeft, AlertTriangle, Briefcase, HeartPulse, Plane, CalendarClock, Clock, Edit, Trash2, XCircle, Search, Calendar, Settings, Check, Baby, Heart, Calculator, MapPin, Upload, Footprints, Eye, Info } from 'lucide-react';
import { HOLIDAY_SELECTION_POOL, FIXED_HOLIDAYS } from '../../utils/constants';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Select from '../../components/ui/Select';
import { useForm, Controller, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { format, differenceInCalendarDays, isSameDay, startOfMonth, endOfMonth, differenceInMinutes, getDay, startOfYear, endOfYear, startOfWeek, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { calculateWorkingHours, getStaffCategory, isTechnicalRole, calculateDailyTravelKm, calculateDailyPathTravelKm } from '../../utils/attendanceCalculations';

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

const LeaveBalanceCard: React.FC<{ title: string; value: string; icon: React.ElementType; isExpired?: boolean; description?: string; isLoading?: boolean; onViewDetails?: () => void; infoMessage?: string }> = ({ title, value, icon: Icon, isExpired, description, isLoading, onViewDetails, infoMessage }) => {
    const isMobileCard = useMediaQuery('(max-width: 767px)');
    return (
    <div className={`relative p-3 md:p-4 rounded-xl flex flex-col lg:flex-row items-center lg:items-center gap-2 md:gap-4 border text-center lg:text-left w-full h-full justify-center lg:justify-start ${
        isExpired
            ? 'border-amber-500/50 bg-amber-500/5'
            : isMobileCard
                ? 'bg-transparent border-transparent'
                : 'bg-card border-border'
    }`}>
        {onViewDetails && !isLoading && (
            <button 
                onClick={onViewDetails} 
                className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-black/5 text-muted-foreground hover:text-primary transition-colors z-10"
                title="View Timeline"
            >
                <Eye className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
            </button>
        )}
        <div className={`${isExpired ? 'bg-amber-100' : isMobileCard ? 'bg-white/10' : 'bg-accent-light'} p-2 md:p-3 rounded-full flex-shrink-0`}>
            {isLoading ? (
                <div className="h-5 w-5 md:h-6 md:w-6 animate-pulse bg-gray-200 rounded-full" />
            ) : (
                <Icon className={`h-5 w-5 md:h-6 md:w-6 ${isExpired ? 'text-amber-600' : 'text-accent-dark'}`} />
            )}
        </div>
        <div className="flex-1 w-full text-center lg:text-left flex flex-col items-center lg:items-start">
            <div className="flex items-center justify-center lg:justify-start gap-2">
                <p className="text-xs md:text-sm text-muted font-medium">{title}</p>
                {isExpired && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase">Expired</span>}
                {infoMessage && (
                    <div className="relative group/info flex items-center">
                        <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover/info:opacity-100 transition-opacity z-50 pointer-events-none w-48 text-[10px] bg-card text-primary-text p-2 rounded shadow-xl border border-border text-center">
                            {infoMessage}
                            <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-border" />
                            <div className="absolute -bottom-[4px] left-1/2 -translate-x-1/2 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-card" />
                        </div>
                    </div>
                )}
            </div>
            {isLoading ? (
                <div className="h-7 md:h-8 w-24 bg-gray-100 animate-pulse rounded mt-1 mx-auto lg:mx-0" />
            ) : (
                <p className={`text-lg md:text-2xl font-bold ${isExpired ? 'text-amber-600' : 'text-primary-text'}`}>{value}</p>
            )}
            {description && !isLoading && <p className="text-[9px] md:text-xs text-muted-foreground mt-1 text-center lg:text-left">{description}</p>}
            {isLoading && <div className="h-3 w-32 bg-gray-50 animate-pulse rounded mt-2 mx-auto lg:mx-0" />}
        </div>
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
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [actioningRequestId, setActioningRequestId] = useState<string | null>(null);
    const isMobile = useMediaQuery('(max-width: 767px)');
    const navigate = useNavigate();
    const [calculatedOTHours, setCalculatedOTHours] = useState<number>(0);
    const [calculatedShortfallMins, setCalculatedShortfallMins] = useState<number>(0);
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

    const fetchData = useCallback(async () => {
        if (!user) return;
        // ── Industry standard: set loading TRUE first, before clearing any state ──
        // This prevents the flash of empty/zero values that appear while data is wiped
        // but the loading spinner hasn't appeared yet.
        setIsLoading(true);
        setError(null);
        setBalance(null);
        setMonthlyPaydays(null);
        setSnapshotData(null);
        setEvents([]);
        setDailyActivityRecords([]);
        setSiteOtDays(0);
        setMonthlyTravelKm(0);
        setMonthlyTravelDuration(0);
        setMonthlySteps(0);
        
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
                api.getAttendanceEvents(user.id, startStr, endStr),
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

            setBalance(balanceData);
            setRequests(requestsData);
            setCompOffLogs(compOffData);
            setEvents(eventsData);
            setAttendanceSettings(settings);
            setRecurringHolidays(recurringData);
            setUserHolidays(selections);
            setUserChildren(userChildrenData as UserChild[]);
            setYearlyData({
                events: yearlyEvents,
                userHolidays: selections,
                leaves: yearlyRequests
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
            const staffCategory = getStaffCategory(currentUserData.roleId || currentUserData.role || '', currentUserData.societyId, settings);

            const userRules = settings[staffCategory];
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
                    // Accumulate steps from punch-out events (all staff types)
                    let daySteps = (dayEvents as AttendanceEvent[])
                        .filter(e => (e.type === 'punch-out' || e.type === 'site-ot-out' || e.type === 'site-out') && (e.steps ?? 0) > 0)
                        .reduce((sum, e) => sum + (e.steps || 0), 0);
                        
                    // Deduct fake steps generated by phone pedometer during vehicle travel
                    let vDist = travelRes.vehicleDistance;
                    if (!vDist && travelRes.distance > 3) {
                        // Fallback: If no telemetry is available to calculate speed (or average speed was too low due to missing points),
                        // but total distance is large, assume most travel beyond a 3km walking baseline was done via vehicle.
                        vDist = travelRes.distance - 3;
                    }
                    
                    if (vDist && vDist > 0) {
                        const fakeSteps = Math.floor((vDist * 1000) / 0.75);
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
                }

                const { workingHours } = calculateWorkingHours(dayEvents, date);
                
                // OT
                if (workingHours > shiftThreshold) {
                    totalOTHours += (workingHours - shiftThreshold);
                }

                // Shortfall - Skip Sundays
                if (getDay(date) !== 0 && workingHours < targetHours) {
                    totalShortfallMinutes += (targetHours * 60) - (workingHours * 60);
                }
            });

            setCalculatedOTHours(parseFloat(totalOTHours.toFixed(1)));
            setCalculatedShortfallMins(totalShortfallMinutes);
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
        const isValid = isFloatingHolidayValidForViewingDate();
        if (!isValid) return { total: 0, used: 0, pending: 0 };
        
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
        const isPast = thirdSaturday && startOfDay(thirdSaturday) <= startOfDay(today);
        
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
                    let amount = req.dayOption === 'half' ? 0.5 : (differenceInCalendarDays(new Date(req.endDate.replace(/-/g, '/')), reqStart) + 1);
                    if (req.status === 'approved' || req.status === 'correction_made') used += amount;
                    if (req.status === 'pending_manager_approval' || req.status === 'pending_hr_confirmation') pending += amount;
                }
            }
        });

        // Auto-deduct if the 3rd Saturday has passed AND employee was ABSENT (did NOT punch in).
        // Business Rule:
        //   - Worked on 3rd Saturday  → Blue Leave NOT consumed → 1/1 (still available)
        //   - Absent on 3rd Saturday  → Blue Leave consumed     → 0/1
        //   - Before 3rd Saturday     → isPast=false, no change → 1/1 (entitlement pending)
        //   - Approved leave filed    → handled by loop above (used already ≥ 1)
        if (isPast && used === 0 && thirdSaturday) {
            const thirdSatStr = format(thirdSaturday, 'yyyy-MM-dd');
            const workedOn3rdSat = events.some(e => {
                const eDate = format(new Date(e.timestamp), 'yyyy-MM-dd');
                const eventType = e.type as string;
                return eDate === thirdSatStr && (
                    eventType === 'punch-in' || eventType === 'check-in' ||
                    eventType === 'punch_in' || eventType === 'checkin'
                );
            });
            if (!workedOn3rdSat) {
                // Employee was absent on 3rd Saturday — leave is consumed
                used = 1;
            }
            // If they worked, blue leave remains available (1/1) — they may earn Comp Off instead
        }

        if (used > total) used = total;
        
        return { total, used, pending };
    };

    const staffCategory = user ? getStaffCategory(user.roleId || user.role || '', user.societyId || user.organizationId, attendanceSettings) : 'office';
    const blueLeaveStatus = getBlueLeaveStatusForViewingDate();

    const balanceCards = balanceDataState ? [
        { 
            title: 'Earned Leave', 
            value: `${parseFloat((balanceDataState.earnedTotal - balanceDataState.earnedUsed - (balanceDataState.earnedPending || 0)).toFixed(1))} / ${parseFloat(balanceDataState.earnedTotal.toFixed(1))}`, 
            description: `Total: ${parseFloat(balanceDataState.earnedTotal.toFixed(1))}d. Available: ${parseFloat((balanceDataState.earnedTotal - balanceDataState.earnedUsed - (balanceDataState.earnedPending || 0)).toFixed(1))}d.${(balanceDataState.earnedPending || 0) > 0 ? ` (Pending: ${balanceDataState.earnedPending}d)` : ''}`,
            icon: Briefcase,
            isExpired: balanceDataState.expiryStates?.earned
        },
        { 
            title: 'Sick Leave', 
            value: `${parseFloat((balanceDataState.sickTotal - balanceDataState.sickUsed - (balanceDataState.sickPending || 0)).toFixed(1))} / ${parseFloat(balanceDataState.sickTotal.toFixed(1))}`, 
            description: `Total: ${parseFloat(balanceDataState.sickTotal.toFixed(1))}d. Available: ${parseFloat((balanceDataState.sickTotal - balanceDataState.sickUsed - (balanceDataState.sickPending || 0)).toFixed(1))}d.${(balanceDataState.sickPending || 0) > 0 ? ` (Pending: ${balanceDataState.sickPending}d)` : ''}`,
            icon: HeartPulse,
            isExpired: balanceDataState.expiryStates?.sick,
            isHidden: true
        },
        { 
            title: 'Blue Leave', 
            value: `${parseFloat((blueLeaveStatus.total - blueLeaveStatus.used - blueLeaveStatus.pending).toFixed(1))} / ${parseFloat(blueLeaveStatus.total.toFixed(1))}`, 
            description: `Total: ${parseFloat(blueLeaveStatus.total.toFixed(1))}d. Available: ${parseFloat((blueLeaveStatus.total - blueLeaveStatus.used - blueLeaveStatus.pending).toFixed(1))}d.${blueLeaveStatus.pending > 0 ? ` (Pending: ${blueLeaveStatus.pending}d)` : ''}`,
            icon: Plane,
            isExpired: !isFloatingHolidayValidForViewingDate(),
            isHidden: isFemale
        },
        ...(isFemale ? [
            { 
                title: 'Pink Leave', 
                value: `${parseFloat((balanceDataState.pinkTotal - balanceDataState.pinkUsed - (balanceDataState.pinkPending || 0)).toFixed(1))} / ${balanceDataState.pinkTotal}`,
                description: `1 day per month (mandatory, non-carry forward). Available: ${parseFloat((balanceDataState.pinkTotal - balanceDataState.pinkUsed - (balanceDataState.pinkPending || 0)).toFixed(1))}d.${(balanceDataState.pinkPending || 0) > 0 ? ` (Pending: ${balanceDataState.pinkPending}d)` : ''}`,
                icon: Heart,
                isExpired: false
            },
            ...(userChildren.length > 0 ? [{
                title: 'Child Care Leave',
                value: `${parseFloat((balanceDataState.childCareTotal - balanceDataState.childCareUsed - (balanceDataState.childCarePending || 0)).toFixed(1))} / ${parseFloat(balanceDataState.childCareTotal.toFixed(1))}`,
                description: `Available: ${parseFloat((balanceDataState.childCareTotal - balanceDataState.childCareUsed - (balanceDataState.childCarePending || 0)).toFixed(1))} days for child care.${(balanceDataState.childCarePending || 0) > 0 ? ` (Pending: ${balanceDataState.childCarePending}d)` : ''}`,
                icon: Baby, 
            }] : [])
        ] : []),
        { 
            title: 'Compensatory Off', 
            value: `${parseFloat((balanceDataState.compOffTotal - balanceDataState.compOffUsed - (balanceDataState.compOffPending || 0)).toFixed(1))} / ${parseFloat(balanceDataState.compOffTotal.toFixed(1))}`, 
            description: `Total: ${parseFloat(balanceDataState.compOffTotal.toFixed(1))}d. Available: ${parseFloat((balanceDataState.compOffTotal - balanceDataState.compOffUsed - (balanceDataState.compOffPending || 0)).toFixed(1))}d.${(balanceDataState.compOffPending || 0) > 0 ? ` (Pending: ${balanceDataState.compOffPending}d)` : ''}`,
            icon: CalendarClock,
            isExpired: balanceDataState.expiryStates?.compOff,
            infoMessage: "As per policy, it's restricted for only 4 max limit, even if you have earned more."
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
        ...(isTechnicalRole(user?.role) ? [{
            title: 'Site OT Days',
            value: snapshotData?.summary?.overtimeDays !== undefined 
                ? `${snapshotData.summary.overtimeDays}`
                : `${siteOtDays || (balanceDataState?.siteOtDaysThisMonth || 0)}`,
            description: `Total Site OT shifts performed in ${format(viewingDate, 'MMMM yyyy')}.`,
            icon: Clock,
            isExpired: false
        }] : []),
        ...(isShortfallEnabled ? [{
            title: 'Monthly Shortfall',
            value: formatPreciseHours(calculatedShortfallMins / 60),
            description: `8h Shortfall = 1 Day Deduction. Est. Loss: ${(calculatedShortfallMins / (8 * 60)).toFixed(1)} Days.`,
            icon: Clock,
            isExpired: false
        }] : [])
    ].filter(card => !card.isExpired && !card.isHidden) : [
        { title: 'Earned Leave', value: '0 / 0', icon: Briefcase, isLoading: true },
        { title: 'Blue Leave', value: '0 / 0', icon: Plane, isLoading: true },
        ...(isFemale ? [{ title: 'Pink Leave', value: '0 / 0', icon: Heart, isLoading: true }] : []),
        { title: 'Compensatory Off', value: '0 / 0', icon: CalendarClock, isLoading: true },
        { title: 'Monthly Pay Days', value: '-', icon: Calculator, isLoading: true },
        { title: 'Monthly Travel KM', value: '-', icon: MapPin, isLoading: true }
    ];

    // Maternity card (hidden for all users as requested)
    const maternityCards = [] as any[];

    return (
        <div
            className="p-4 space-y-6"
            style={{
                opacity: isContentVisible ? 1 : 0,
                transform: isContentVisible ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1), transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <div className="flex justify-between items-center">
                <h2 className="text-xl md:text-2xl font-bold text-primary-text leading-none">
                    My Leave Requests
                </h2>
                <div className="flex items-center gap-3">
                    {isHolidaySelectionEnabled && (
                        isMobile ? (
                            <button 
                                onClick={() => navigate('/leaves/holiday-selection')}
                                className="relative overflow-hidden bg-gradient-to-b from-[#008f53] to-[#004d2e] border border-[#00a862]/30 text-white font-bold text-[11px] h-8 rounded-full flex items-center gap-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_3px_8px_rgba(0,77,46,0.4)] px-3.5 hover:brightness-110 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_12px_rgba(0,77,46,0.5)] active:translate-y-[2px] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.4),0_1px_2px_rgba(0,77,46,0.2)] transition-all before:absolute before:top-0 before:left-0 before:right-0 before:h-[45%] before:bg-gradient-to-b before:from-white/20 before:to-transparent"
                            >
                                <Calendar className="w-3.5 h-3.5 text-[#00ff9d] relative z-10" />
                                <span className="relative z-10">Holiday</span>
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
                            className="relative overflow-hidden bg-gradient-to-b from-[#008f53] to-[#004d2e] border border-[#00a862]/30 text-white font-bold text-[11px] h-8 rounded-full flex items-center gap-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_3px_8px_rgba(0,77,46,0.4)] px-3.5 hover:brightness-110 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_12px_rgba(0,77,46,0.5)] active:translate-y-[2px] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.4),0_1px_2px_rgba(0,77,46,0.2)] transition-all before:absolute before:top-0 before:left-0 before:right-0 before:h-[45%] before:bg-gradient-to-b before:from-white/20 before:to-transparent"
                        >
                            <Plus className="w-3.5 h-3.5 text-[#00ff9d] stroke-[3] relative z-10" />
                            <span className="relative z-10">Request</span>
                        </button>
                    ) : (
                        <Button onClick={handleNewRequest}>
                            <Plus className="mr-2 h-4" /> New Request
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                {balanceCards.map(b => <div key={b.title} className="w-full h-full flex"><LeaveBalanceCard {...b} /></div>)}
                {/* Show Overtime card only if OT conversion is enabled for the user's role */}
                {isOtConversionEnabled && (
                    <div className="relative group w-full h-full flex">
                        <LeaveBalanceCard 
                            title="Monthly OT Hours" 
                            value={formatPreciseHours(calculatedOTHours || user?.monthlyOtHours || 0)} 
                            description={`Calculated from hours exceeding ${threshold}h daily.`}
                            icon={Clock} 
                            isLoading={isLoading}
                        />
                        {/* Position tooltip below or above so it doesn't overlap text, and use solid bg-card */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                            <div className="bg-card text-primary-text text-[10px] p-3 rounded-lg shadow-xl border border-border w-56 relative text-center lg:text-left">
                                {/* Small triangle arrow at the top */}
                                <div className="absolute -top-2 left-1/2 -translate-x-1/2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-border" />
                                <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-card" />
                                
                                <p className="font-bold border-b border-border mb-1.5 pb-1">OT Accumulation</p>
                                <p className="mb-1">Current Bank: <span className="text-accent-dark font-bold text-[11px]">
                                    {formatPreciseHours(user?.otHoursBank || 0)}
                                </span></p>
                                <p className="text-muted-foreground italic leading-tight">Every 8h of accumulated OT is automatically converted to 1 Comp Off.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Maternity & Child Care Cards */}
            {maternityCards.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                    {maternityCards.map(b => <div key={b.title} className="w-full h-full flex"><LeaveBalanceCard {...b} /></div>)}
                </div>
            )}






            {/* Attendance Calendar Section - Grid layout matching summary cards for uniform sizing */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <AttendanceCalendar 
                    leaveRequests={requests} 
                    userHolidays={userHolidays} 
                    currentDate={viewingDate}
                    setCurrentDate={setViewingDate}
                    events={events}
                    settings={attendanceSettings}
                    recurringHolidays={recurringHolidays}
                    isLoading={isLoading}
                    onMonthPaydaysChange={setMonthlyPaydays}
                    onSiteOtDaysChange={setSiteOtDays}
                />
                <CompOffCalendar 
                    logs={compOffLogs} 
                    leaveRequests={requests} 
                    userHolidays={userHolidays} 
                    isLoading={isLoading} 
                    viewingDate={viewingDate}
                    onDateChange={setViewingDate}
                    events={events}
                />
                <HolidayCalendar 
                    adminHolidays={adminHolidays} 
                    userSelectedHolidays={userHolidays} 
                    isLoading={isLoading} 
                    viewingDate={viewingDate}
                    onDateChange={setViewingDate}
                />
                <YearlyAttendanceChart 
                    data={yearlyData}
                    isLoading={isLoading}
                />
                {(isOtConversionEnabled || isTechnicalRole(user?.role)) && (
                    <OTCalendar 
                        viewingDate={viewingDate}
                        onDateChange={setViewingDate}
                        events={events}
                        settings={attendanceSettings}
                        isLoading={isLoading}
                    />
                )}
                {isShortfallEnabled && (
                    <ShortfallCalendar 
                        viewingDate={viewingDate}
                        onDateChange={setViewingDate}
                        events={events}
                        settings={attendanceSettings}
                        isLoading={isLoading}
                    />
                )}
            </div>



            <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card w-full md:w-full">
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
                            ) : requests.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-10 text-muted text-lg">No requests found.</td></tr>
                            ) : (
                                requests.map(req => {
                                    const lType = String(req.leaveType || (req as any).leave_type || '').toLowerCase();
                                    const LeaveIcon = lType.includes('sick') ? HeartPulse : 
                                                     lType.includes('floating') ? Plane : 
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
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-label="Dates" className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-primary-text">
                                                        {format(new Date(req.startDate.replace(/-/g, '/')), 'dd MMM')} - {format(new Date(req.endDate.replace(/-/g, '/')), 'dd MMM')}
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
                                                                    <button onClick={() => navigate(`/leaves/edit/${req.id}`)} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-full transition-colors" title="Edit Request">
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

            {/* Employee Attendance Log */}
            <EmployeeLog initialEvents={events} />

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