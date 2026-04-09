import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import type { LeaveBalance, LeaveRequest, LeaveType, LeaveRequestStatus, UploadedFile, CompOffLog, AttendanceEvent, UserHoliday, AttendanceSettings, StaffAttendanceRules, RecurringHolidayRule } from '../../types';
import { Loader2, Plus, ArrowLeft, AlertTriangle, Briefcase, HeartPulse, Plane, CalendarClock, Clock, Edit, Trash2, XCircle, Search, Calendar, Settings, Check, Baby, Heart, Calculator } from 'lucide-react';
import { HOLIDAY_SELECTION_POOL, FIXED_HOLIDAYS } from '../../utils/constants';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import Select from '../../components/ui/Select';
import { useForm, Controller, SubmitHandler, Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { format, differenceInCalendarDays, isSameDay, startOfMonth, endOfMonth, differenceInMinutes, getDay, startOfYear, endOfYear } from 'date-fns';
import { calculateWorkingHours, getStaffCategory } from '../../utils/attendanceCalculations';
import DatePicker from '../../components/ui/DatePicker';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useSettingsStore } from '../../store/settingsStore';
import UploadDocument from '../../components/UploadDocument';
import AttendanceCalendar from './AttendanceCalendar';
import CompOffCalendar from './CompOffCalendar';
import OTCalendar from './OTCalendar';
import YearlyAttendanceChart from './YearlyAttendanceChart';
import EmployeeLog from './EmployeeLog';
import Modal from '../../components/ui/Modal';
import HolidayCalendar from './HolidayCalendar';
import ShortfallCalendar from './ShortfallCalendar';
import LoadingScreen from '../../components/ui/LoadingScreen';

// --- Reusable Components ---

const LeaveBalanceCard: React.FC<{ title: string; value: string; icon: React.ElementType; isExpired?: boolean; description?: string; isLoading?: boolean }> = ({ title, value, icon: Icon, isExpired, description, isLoading }) => (
    <div className={`bg-card p-3 md:p-4 rounded-xl flex flex-col lg:flex-row items-center lg:items-center gap-2 md:gap-4 border text-center lg:text-left w-full h-full justify-center lg:justify-start ${isExpired ? 'border-amber-500/50 bg-amber-500/5' : 'border-border'}`}>
        <div className={`${isExpired ? 'bg-amber-100' : 'bg-accent-light'} p-2 md:p-3 rounded-full flex-shrink-0`}>
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

const LeaveStatusChip: React.FC<{ status: LeaveRequestStatus }> = ({ status }) => {
    const statusClasses: Record<LeaveRequestStatus, string> = {
        pending_manager_approval: 'leave-status-chip--pending_manager_approval',
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
    const { user } = useAuthStore();
    const [balanceDataState, setBalance] = useState<LeaveBalance | null>(null);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [compOffLogs, setCompOffLogs] = useState<CompOffLog[]>([]);
    const [events, setEvents] = useState<AttendanceEvent[]>([]);
    const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings | null>(null);
    const [recurringHolidays, setRecurringHolidays] = useState<RecurringHolidayRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCompOffHistoryDisabled, setIsCompOffHistoryDisabled] = useState(false);
    const [filter, setFilter] = useState<LeaveRequestStatus | 'all'>('all');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [actioningRequestId, setActioningRequestId] = useState<string | null>(null);
    const isMobile = useMediaQuery('(max-width: 767px)');
    const navigate = useNavigate();
    const [calculatedOTHours, setCalculatedOTHours] = useState<number>(0);
    const [calculatedShortfallMins, setCalculatedShortfallMins] = useState<number>(0);

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
        setIsLoading(true);
        setError(null);
        
        try {
            const dateStr = format(viewingDate, 'yyyy-MM-dd');
            const startStr = startOfMonth(viewingDate).toISOString();
            const endStr = endOfMonth(viewingDate).toISOString();

            const startOfYearStr = startOfYear(viewingDate).toISOString();
            const endOfYearStr = endOfYear(viewingDate).toISOString();

            // Fetch base data points
            const [balanceData, requestsData, compOffData, eventsData, settings, recurringData, selections, yearlyEvents, yearlyRequests] = await Promise.all([
                api.getLeaveBalancesForUser(user.id, dateStr),
                api.getLeaveRequests({
                    userId: user.id,
                    status: filter === 'all' ? undefined : filter
                }).then(res => res.data),
                api.getCompOffLogs(user.id).catch(() => []),
                api.getAttendanceEvents(user.id, startStr, endStr),
                api.getAttendanceSettings(),
                api.getRecurringHolidays(),
                api.getUserHolidays(user.id).catch(() => []),
                api.getAttendanceEvents(user.id, startOfYearStr, endOfYearStr),
                api.getLeaveRequests({
                    userId: user.id,
                    status: 'approved',
                    startDate: startOfYearStr,
                    endDate: endOfYearStr
                }).then(res => res.data)
            ]);

            setBalance(balanceData);
            setRequests(requestsData);
            setCompOffLogs(compOffData);
            setEvents(eventsData);
            setAttendanceSettings(settings);
            setRecurringHolidays(recurringData);
            setUserHolidays(selections);
            setYearlyData({
                events: yearlyEvents,
                userHolidays: selections,
                leaves: yearlyRequests
            });
            
            // Refetch current user profile to get latest persistent OT fields (bank, monthly)
            // This ensures we have the most up-to-date role and balance information
            const freshUser = await supabase
                .from('users')
                .select('*, role:roles(display_name)')
                .eq('id', user.id)
                .single();

            let currentUserData = user;
            if (freshUser.data) {
                const data = freshUser.data;
                const roleData = data.role;
                const rawRoleName = (Array.isArray(roleData) ? roleData[0]?.display_name : (roleData as any)?.display_name) || data.role_id;
                const normalizedRole = typeof rawRoleName === 'string' ? rawRoleName.toLowerCase().replace(/\s+/g, '_') : rawRoleName;
                
                currentUserData = {
                    ...api.toCamelCase(data),
                    role: normalizedRole,
                    roleId: data.role_id
                };
                
                // Update store asynchronously to avoid interrupting current calculation
                setTimeout(() => {
                    useAuthStore.getState().updateUserProfile(currentUserData);
                }, 0);
            }

            // Map User Role to Staff Category (office, field, site)
            const staffCategory = getStaffCategory(currentUserData.roleId || currentUserData.role || '', currentUserData.organizationId, settings);

            const userRules = settings[staffCategory];
            const shiftThreshold = userRules?.dailyWorkingHours?.max || 8;
            setThreshold(shiftThreshold);

            // Group events by day and calculate OT using normalized logic
            const dayLogs: Record<string, AttendanceEvent[]> = {};
            eventsData.forEach(e => {
                const d = format(new Date(e.timestamp), 'yyyy-MM-dd');
                if (!dayLogs[d]) dayLogs[d] = [];
                dayLogs[d].push(e);
            });

            let totalOTHours = 0;
            let totalShortfallMinutes = 0;
            const targetHours = 8;

            Object.entries(dayLogs).forEach(([dateStr, dayEvents]) => {
                const date = new Date(dateStr);
                const { workingHours } = calculateWorkingHours(dayEvents);
                
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
            setIsHolidaySelectionEnabled(userRules?.enableCustomHolidays ?? true);
            setActiveHolidayPool(userRules?.holidayPool || HOLIDAY_SELECTION_POOL);
            setIsOtConversionEnabled(userRules?.enableOtToCompOffConversion || false);
            setIsShortfallEnabled(userRules?.enableShortfall || false);

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
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, user?.role, filter, viewingDate]);

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

    if (isLoading) {
        return <LoadingScreen message="Establishing secure uplink..." />;
    }



    const formatTabName = (tab: string) => tab.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const filterTabs: Array<LeaveRequestStatus | 'all'> = ['all', 'pending_manager_approval', 'pending_hr_confirmation', 'approved', 'rejected'];
    const isFemale = user?.gender?.toLowerCase() === 'female';

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
            isExpired: balanceDataState.expiryStates?.sick
        },
        ...(isFemale ? [
            { 
                title: 'Pink Leave', 
                value: `${parseFloat((balanceDataState.pinkTotal - balanceDataState.pinkUsed - (balanceDataState.pinkPending || 0)).toFixed(0))} / ${balanceDataState.pinkTotal}`,
                description: `1 day per month (mandatory, non-carry forward). Available: ${parseFloat((balanceDataState.pinkTotal - balanceDataState.pinkUsed - (balanceDataState.pinkPending || 0)).toFixed(0))}d.${(balanceDataState.pinkPending || 0) > 0 ? ` (Pending: ${balanceDataState.pinkPending}d)` : ''}`,
                icon: Heart,
                isExpired: false
            },
            {
                title: 'Child Care Leave',
                value: `${parseFloat((balanceDataState.childCareTotal - balanceDataState.childCareUsed - (balanceDataState.childCarePending || 0)).toFixed(0))} / ${parseFloat(balanceDataState.childCareTotal.toFixed(0))}`,
                description: `Available: ${parseFloat((balanceDataState.childCareTotal - balanceDataState.childCareUsed - (balanceDataState.childCarePending || 0)).toFixed(0))} days for child care.${(balanceDataState.childCarePending || 0) > 0 ? ` (Pending: ${balanceDataState.childCarePending}d)` : ''}`,
                icon: Baby, 
            }
        ] : [
            { 
                title: '3rd Saturday Leave', 
                value: `${parseFloat((balanceDataState.floatingTotal - balanceDataState.floatingUsed - (balanceDataState.floatingPending || 0)).toFixed(1))} / ${parseFloat(balanceDataState.floatingTotal.toFixed(1))}`, 
                description: `Total: ${parseFloat(balanceDataState.floatingTotal.toFixed(1))}d. Available: ${parseFloat((balanceDataState.floatingTotal - balanceDataState.floatingUsed - (balanceDataState.floatingPending || 0)).toFixed(1))}d.${(balanceDataState.floatingPending || 0) > 0 ? ` (Pending: ${balanceDataState.floatingPending}d)` : ''}`,
                icon: Plane,
                isExpired: balanceDataState.expiryStates?.floating
            }
        ]),
        { 
            title: 'Compensatory Off', 
            value: `${parseFloat((balanceDataState.compOffTotal - balanceDataState.compOffUsed - (balanceDataState.compOffPending || 0)).toFixed(1))} / ${parseFloat(balanceDataState.compOffTotal.toFixed(1))}`, 
            description: `Total: ${parseFloat(balanceDataState.compOffTotal.toFixed(1))}d. Available: ${parseFloat((balanceDataState.compOffTotal - balanceDataState.compOffUsed - (balanceDataState.compOffPending || 0)).toFixed(1))}d.${(balanceDataState.compOffPending || 0) > 0 ? ` (Pending: ${balanceDataState.compOffPending}d)` : ''}`,
            icon: CalendarClock,
            isExpired: balanceDataState.expiryStates?.compOff
        },
        {
            title: 'Monthly Pay Days',
            value: monthlyPaydays !== null ? `${monthlyPaydays}` : '-',
            description: `Total payable days tracked for ${format(viewingDate, 'MMMM yyyy')}.`,
            icon: Calculator,
            isExpired: false
        },
        ...(isShortfallEnabled ? [{
            title: 'Monthly Shortfall',
            value: formatPreciseHours(calculatedShortfallMins / 60),
            description: `8h Shortfall = 1 Day Deduction. Est. Loss: ${(calculatedShortfallMins / (8 * 60)).toFixed(1)} Days.`,
            icon: Clock,
            isExpired: false
        }] : [])
    ].filter(card => !card.isExpired) : [
        { title: 'Earned Leave', value: '0 / 0', icon: Briefcase, isLoading: true },
        { title: 'Sick Leave', value: '0 / 0', icon: HeartPulse, isLoading: true },
        { title: '3rd Saturday Leave', value: '0 / 0', icon: Plane, isLoading: true },
        ...(isFemale ? [{ title: 'Pink Leave', value: '0 / 0', icon: Heart, isLoading: true }] : []),
        { title: 'Compensatory Off', value: '0 / 0', icon: CalendarClock, isLoading: true },
        { title: 'Monthly Pay Days', value: '-', icon: Calculator, isLoading: true },
    ];

    // Maternity card (only for female users with non-zero balances)
    const maternityCards = (balanceDataState && isFemale) ? [
        ...(balanceDataState.maternityTotal > 0 ? [{
            title: 'Maternity Leave',
            value: `${parseFloat((balanceDataState.maternityTotal - balanceDataState.maternityUsed - (balanceDataState.maternityPending || 0)).toFixed(0))} / ${parseFloat(balanceDataState.maternityTotal.toFixed(0))} days`,
            description: `${Math.round(balanceDataState.maternityTotal / 7)} weeks total. Available: ${parseFloat((balanceDataState.maternityTotal - balanceDataState.maternityUsed - (balanceDataState.maternityPending || 0)).toFixed(0))} days.${(balanceDataState.maternityPending || 0) > 0 ? ` (Pending: ${balanceDataState.maternityPending}d)` : ''}`,
            icon: Baby,
        }] : []),
    ] : [];

    return (
        <div className="p-4 space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <div className="flex justify-between items-center">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-bold text-primary-text">My Leave Requests</h2>
                </div>
                {!isMobile && (
                    <div className="flex gap-2">
                        <Button onClick={handleNewRequest}><Plus className="mr-2 h-4" /> New Request</Button>
                    </div>
                )}
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


            {/* Holiday Selection Section */}
            {isHolidaySelectionEnabled && (
                isMobile ? (
                    /* Mobile: Premium Dark Theme */
                    <div className="bg-[#0f291e]/80 backdrop-blur-md rounded-2xl border border-white/5 p-5 shadow-xl relative overflow-hidden group mb-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                        <div className="flex flex-col gap-4 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-emerald-500/20 rounded-xl">
                                    <Calendar className="h-6 w-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Holiday Selection</h3>
                                    <p className="text-emerald-100/60 text-xs text-left">Pick 6 holidays from the company list</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-3 w-full">
                                <div className="px-3 py-1 bg-black/40 rounded-full border border-white/10">
                                    <span className={`text-sm font-bold ${userHolidays.length === 6 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {userHolidays.length} / 6 Selected
                                    </span>
                                </div>
                                <Button onClick={() => navigate('/leaves/holiday-selection')} className="w-full justify-center">
                                    {userHolidays.length > 0 ? 'Update Selection' : 'Select Holidays'}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Desktop: Integrated Light Theme */
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="p-3 bg-emerald-50 rounded-xl">
                                <Calendar className="h-7 w-7 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Holiday Selection</h3>
                                <p className="text-gray-500 text-sm">Pick 6 holidays from the company list to complete your allowance.</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col items-end mr-2">
                                <span className={`text-sm font-bold ${userHolidays.length === 6 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {userHolidays.length} / 6 Selected
                                </span>
                                <div className="w-32 h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-500 ${userHolidays.length === 6 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                        style={{ width: `${(userHolidays.length / 6) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            
                            <Button onClick={() => navigate('/leaves/holiday-selection')} className="px-8 py-2.5">
                                {userHolidays.length > 0 ? 'Update Selection' : 'Select Holidays'}
                            </Button>
                        </div>
                    </div>
                )
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
                {isOtConversionEnabled && (
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

            {isMobile && (
                <div className="my-4 w-full">
                    <Button onClick={handleNewRequest} size="lg" className="w-full justify-center text-lg">
                        <Plus className="mr-2 h-5" /> New Request
                    </Button>
                </div>
            )}

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
                                    const LeaveIcon = req.leaveType === 'Sick' ? HeartPulse : 
                                                     req.leaveType === 'Floating' ? Plane : 
                                                     req.leaveType === 'Comp Off' ? CalendarClock : Briefcase;
                                    
                                    return (
                                        <tr key={req.id} className="leave-row-card group border-b border-border/40 last:border-0">
                                            <td data-label="Type" className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-accent-light rounded-lg text-accent-dark group-hover:bg-white transition-colors">
                                                        <LeaveIcon className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-primary-text text-sm">
                                                            {req.leaveType === 'Floating' ? '3rd Saturday Leave' : req.leaveType}
                                                        </p>
                                                        {req.dayOption === 'half' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">Half Day</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-label="Dates" className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-primary-text">
                                                        {format(new Date(req.startDate.replace(/-/g, '/')), 'dd MMM')} - {format(new Date(req.endDate.replace(/-/g, '/')), 'dd MMM')}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                                                        {differenceInCalendarDays(new Date(req.endDate.replace(/-/g, '/')), new Date(req.startDate.replace(/-/g, '/'))) + 1} Days
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
                                                {req.status === 'pending_manager_approval' ? (
                                                    <div className="flex justify-end gap-1">
                                                        {actioningRequestId === req.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-accent" />
                                                        ) : (
                                                            <>
                                                                <button onClick={() => handleEditRequest(req.id)} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-full transition-colors" title="Edit Request">
                                                                    <Edit className="h-4 w-4" />
                                                                </button>
                                                                <button onClick={() => handleCancelRequest(req.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors" title="Cancel Request">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-muted italic font-medium">Finalized</span>
                                                )}
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
        </div>
    );
};

export default LeaveDashboard;