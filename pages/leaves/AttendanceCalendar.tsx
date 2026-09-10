import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isAfter, isBefore, startOfDay, endOfDay, startOfWeek, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getStaffCategory, calculateWorkingHours } from '../../utils/attendanceCalculations';
import { api } from '../../services/api';
import type { AttendanceEvent, UserHoliday, LeaveRequest, AttendanceSettings, RecurringHolidayRule } from '../../types';
import { FIXED_HOLIDAYS, HOLIDAY_SELECTION_POOL } from '../../utils/constants';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { buildAttendanceDayKeyByEventId } from '../../utils/attendanceDayGrouping';
import { useMediaQuery } from '../../hooks/useMediaQuery';


interface AttendanceCalendarProps {
    leaveRequests?: LeaveRequest[];
    userHolidays?: UserHoliday[];
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    events: AttendanceEvent[];
    settings: AttendanceSettings | null;
    recurringHolidays: RecurringHolidayRule[];
    isLoading?: boolean;
    earliestAttendanceDate?: Date | null;
    onMonthPaydaysChange?: (payDays: number) => void;
    onSiteOtDaysChange?: (otDays: number) => void;
    isMobile?: boolean;
}

const getLeaveAbbreviation = (leaveType?: string): string => {
    const type = String(leaveType || '').toLowerCase().trim();
    if (type.includes('earned') || type === 'el') return 'EL';
    if (type.includes('sick') || type === 'sl') return 'SL';
    if (type.includes('comp') || type === 'co') return 'CO';
    if (type.includes('floating') || type === 'fh' || type.includes('blue leave') || type === 'blue' || type === 'bl') return 'CO';
    if (type.includes('maternity') || type === 'ml') return 'ML';
    if (type.includes('child care') || type === 'ccl') return 'CCL';
    if (type.includes('loss') || type.includes('lop')) return 'LOP';
    if (type.includes('wfh') || type === 'wh') return 'WH';
    if (type.includes('permission') || type === 'rp') return 'RP';
    if (type.includes('pink') || type === 'pl') return 'PL';
    return 'WH';
};

const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ 
    leaveRequests = [], 
    userHolidays = [], 
    currentDate, 
    setCurrentDate,
    events,
    settings,
    recurringHolidays,
    isLoading = false,
    earliestAttendanceDate,
    onMonthPaydaysChange,
    onSiteOtDaysChange,
    isMobile: isMobileProp
}) => {
    const isMobileQuery = useMediaQuery('(max-width: 767px)');
    const isMobile = isMobileProp ?? isMobileQuery;
    const { user } = useAuthStore();
    const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
    const [, setTick] = useState(0);

    // Live-update calendar every minute so today's hour-by-hour progress refreshes automatically
    useEffect(() => {
        const timer = setInterval(() => {
            setTick(t => t + 1);
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    const isFemale = ['female', 'ladies'].includes((user?.gender || '').toLowerCase());
    const isMale = !isFemale;

    const employmentStartDate = useMemo(() => {
        if (earliestAttendanceDate) return startOfDay(earliestAttendanceDate);
        if (!user) return null;
        const rawJoining = user.joiningDate || (user as any).joining_date;
        if (rawJoining) return startOfDay(new Date(String(rawJoining).replace(/-/g, '/')));
        if (events && events.length > 0) {
            const punchDates = events
                .filter(e => e && e.timestamp)
                .map(e => startOfDay(new Date(e.timestamp)).getTime());
            if (punchDates.length > 0) {
                return startOfDay(new Date(Math.min(...punchDates)));
            }
        }
        return null;
    }, [user, events, earliestAttendanceDate]);

    const isMonthBeforeJoining = useMemo(() => {
        if (!employmentStartDate) return false;
        return endOfMonth(currentDate) < employmentStartDate;
    }, [employmentStartDate, currentDate]);

    // Determine which holidays to use based on user role
    const holidays = useMemo(() => {
        const { officeHolidays, fieldHolidays } = useSettingsStore.getState();
        const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.societyId, settings);
        if (staffCategory === 'field') return fieldHolidays;
        return officeHolidays;
    }, [user, settings]);

    const recurringRules = useMemo(() => {
        const roleType = getStaffCategory(user?.roleId || user?.role || '', user?.societyId, settings);
        const isFemale = ['female', 'ladies'].includes((user?.gender || '').toLowerCase());
        const isMale = !isFemale;
        return recurringHolidays.filter(rule => {
            const ruleRoleType = rule.roleType || rule.type || 'office';
            if (ruleRoleType !== roleType) return false;
            
            // 3rd Saturday holiday applies ONLY to users EXPLICITLY marked as MALE (per HR policy)
            const ruleDay = String(rule.day || '').toLowerCase();
            const ruleOccurrence = Number(rule.occurrence || rule.n || 0);
            if (ruleDay === 'saturday' && ruleOccurrence === 3) {
                if (user?.roleId !== 'admin' && user?.role !== 'admin' && !isMale) return false;
            }
            return true;
        });
    }, [user, recurringHolidays, settings]);



    const isFloatingHolidayValid = (dateStr: string) => {
        if (!settings || !user) return false;
        const staffCategory = getStaffCategory(user.roleId || user.role || '', user.societyId, settings);
        const categorySettings = (settings as any)?.[staffCategory];
        if (!categorySettings) return false;

        // PRIORITY 1: If floatingHolidayMonths array is set → it is the SOLE gate.
        if (categorySettings.floatingHolidayMonths && categorySettings.floatingHolidayMonths.length > 0) {
            const monthIdx = new Date(dateStr.replace(/-/g, '/')).getMonth();
            return categorySettings.floatingHolidayMonths.includes(monthIdx);
        }

        // PRIORITY 2 (fallback): No month array → use validFrom/validTill against the specific date.
        const validFrom = categorySettings.floatingLeavesValidFrom;
        const validTill = categorySettings.floatingLeavesExpiryDate;
        if (validFrom && dateStr < validFrom) return false;
        if (validTill && dateStr > validTill) return false;
        return true;
    };

    const recurringHolidayDates = useMemo(() => {
        const dates: Date[] = [];
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        const days = eachDayOfInterval({ start, end });

        recurringRules.forEach(rule => {
            let count = 0;
            for (const day of days) {
                if (format(day, 'EEEE').toLowerCase() === rule.day.toLowerCase()) {
                    count++;
                    const ruleOccurrence = Number(rule.occurrence || rule.n || 0);
                    if (count === ruleOccurrence) {
                        // Check if this recurring holiday is expired (e.g. 3rd Saturday after Feb 1st)
                        const dateStr = format(day, 'yyyy-MM-dd');
                        if (String(rule.day).toLowerCase() === 'saturday' && !isFloatingHolidayValid(dateStr)) {
                            // Expired - do not add to holiday dates
                        } else {
                            dates.push(day);
                        }
                        break; // Found the specific occurrence
                    }
                }
            }
        });
        return dates;
    }, [currentDate, recurringRules, settings, user]);



    // No internal fetching needed as data is passed via props

    const daysInMonth = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(currentDate),
            end: endOfMonth(currentDate)
        });
    }, [currentDate]);

    // PRE-CALCULATE STATUS MAP FOR THE MONTH (WITH BUFFER)
    const dayStatusMap = useMemo(() => {
        const statusMap = new Map<string, { status: string; holidayName: string; presenceVal: number; isSiteOtPresent: boolean; isPoolHoliday: boolean }>();
        // If user is not available we cannot compute any meaningful status
        if (!user) return statusMap;

        // Use settings if available; fall back to safe defaults so the calendar
        // renders Sundays/presence/holidays even while settings are still loading
        const effectiveSettings = settings ?? {};
        const staffCategory = getStaffCategory(user.roleId || user.role || '', user.societyId, effectiveSettings);
        const threshold = (effectiveSettings as any)?.[staffCategory]?.weekendPresentThreshold ?? 2;
        
        // Start buffer to seed counters
        const bufferStart = startOfWeek(subDays(startOfMonth(currentDate), 15), { weekStartsOn: 1 });
        const intervalDays = eachDayOfInterval({ start: bufferStart, end: endOfMonth(currentDate) });

        let daysPresentInWeek = 0;
        let daysActiveInWeek = 0;
        let daysPresentInPreviousWeek = 0;

        const dayKeyMap = buildAttendanceDayKeyByEventId(events);
        const eventsByGroup: Record<string, AttendanceEvent[]> = {};
        events.forEach(e => {
            const key = dayKeyMap[e.id];
            if (!eventsByGroup[key]) eventsByGroup[key] = [];
            eventsByGroup[key].push(e);
        });

        intervalDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayOfWeek = day.getDay();

            const isBeforeEmployment = employmentStartDate ? isBefore(startOfDay(day), employmentStartDate) : false;

            if (dayOfWeek === 1) {
                daysPresentInPreviousWeek = daysActiveInWeek;
                daysPresentInWeek = 0;
                daysActiveInWeek = 0;
            }

            if (isBeforeEmployment) {
                statusMap.set(dateStr, { 
                    status: 'neutral', 
                    holidayName: '', 
                    presenceVal: 0, 
                    isSiteOtPresent: false, 
                    isPoolHoliday: false 
                });
                return;
            }

            const dayEvents = eventsByGroup[dateStr] || [];
            const { workingHours } = calculateWorkingHours(dayEvents, day);
            const hasCheckIn = dayEvents.some(e => ['punch-in', 'site-in', 'check-in', 'check_in'].includes(e.type?.toLowerCase())) || workingHours > 0;
            const hasCheckOut = dayEvents.some(e => ['punch-out', 'site-out', 'check-out', 'check_out'].includes(e.type?.toLowerCase()));
            const hasOtPunchIn = dayEvents.some(e => e.type === 'site-ot-in');
            const hasOtPunchOut = dayEvents.some(e => e.type === 'site-ot-out');
            
            const isToday = isSameDay(day, startOfDay(new Date()));
            const isPast = isAfter(startOfDay(new Date()), startOfDay(day));
            
            // Normal Duty Status
            const isDetailedPresent = (hasCheckIn && hasCheckOut) || (hasCheckIn && isToday) || (workingHours && workingHours > 0);
            // Site OT Status
            const isSiteOtPresent = !!dayEvents.find(e => e.type === 'site-ot-in');

            const isRecurringHoliday = recurringHolidayDates.some(d => isSameDay(d, day));
            const isFloatingExpired = !isFloatingHolidayValid(dateStr);

            const foundConfigured = holidays.find(h => {
                const [y, m, d] = h.date.split('-').map(Number);
                return isSameDay(new Date(y, m - 1, d), day);
            });
            const foundFixed = FIXED_HOLIDAYS.find(fh => {
                const [m, d] = fh.date.split('-').map(Number);
                return isSameDay(new Date(day.getFullYear(), m - 1, d), day);
            });
            const foundPool = (userHolidays || []).find(uh => {
                const uhDate = uh.holidayDate || (uh as any).holiday_date;
                if (!uhDate) return false;
                const [y, m, d] = String(uhDate).substring(0, 10).split('-').map(Number);
                return isSameDay(new Date(y, m - 1, d), day);
            });

            const isCompanyHoliday = !!foundConfigured || !!foundFixed || !!foundPool;
            const isSunday = dayOfWeek === 0;
            const holidayName = foundConfigured?.name || foundFixed?.name || foundPool?.holidayName || (isRecurringHoliday && !isFloatingExpired ? 'Blue Leave' : isSunday ? 'Sunday' : '');

            const foundLeave = leaveRequests.find(req => {
                if (req.status !== 'approved' && req.status !== 'pending_hr_confirmation' && req.status !== 'correction_made') return false;
                return day >= startOfDay(new Date(req.startDate.replace(/-/g, '/'))) && day <= endOfDay(new Date(req.endDate.replace(/-/g, '/')));
            });

            const isActiveInPreviousWeek = daysPresentInPreviousWeek >= threshold;
            const meetsThreshold = daysPresentInWeek >= threshold;
            const isCompOff = !!(foundLeave && (
                String(foundLeave.leaveType || '').toLowerCase().includes('comp') ||
                String(foundLeave.leaveType || '').toLowerCase().includes('floating') ||
                String(foundLeave.leaveType || '').toLowerCase().includes('blue leave') ||
                String(foundLeave.leaveType || '').toLowerCase() === 'c/o' ||
                String(foundLeave.leaveType || '').toLowerCase() === 'co'
            ));

            let finalStatus = 'neutral';
            const presenceVal = 0;

            // Remove future assumptions - strictly follow activity threshold
            const visuallyActivePrev = (daysPresentInPreviousWeek >= threshold);
            const visuallyActiveCurr = (daysPresentInWeek >= threshold);

            if (isCompanyHoliday) {
                finalStatus = isDetailedPresent ? 'holiday-present' : 'company-holiday';
            } else if (isRecurringHoliday && !isFloatingExpired) {
                finalStatus = isDetailedPresent ? 'weekend-present' : 'floating-holiday';
            } else if (foundLeave && foundLeave.dayOption !== 'half' && (foundLeave as any).day_option !== 'half') {
                // Full-day approved/active leave takes priority over any presence/attendance logs
                const lType = String(foundLeave.leaveType || (foundLeave as any).leave_type || '').toLowerCase();
                const isPermission = lType.includes('permission');
                
                if (isPermission && (isDetailedPresent || (workingHours && workingHours > 0))) {
                    if (isSunday) {
                        finalStatus = 'weekend-present';
                    } else {
                        finalStatus = 'present';
                    }
                } else {
                    finalStatus = 'leave';
                }
            } else if (isDetailedPresent) {
                if (isSunday) {
                    finalStatus = 'weekend-present';
                } else {
                    finalStatus = 'present';
                }
            } else if (foundLeave) {
                finalStatus = 'leave';
            } else if (isSunday) {
                finalStatus = isBeforeEmployment ? 'neutral' : 'sunday';
            } else if (isPast) {
                finalStatus = isBeforeEmployment ? 'neutral' : 'absent';
            }

            // Update Counters
            const isPresenceForThreshold = ['present', 'holiday-present', 'weekend-present'].includes(finalStatus) || (isCompanyHoliday && !isPast) || isCompOff;
            const isLeaveForActivity = finalStatus === 'leave' && !['loss of pay', 'lop'].includes((foundLeave?.leaveType || '').toLowerCase());
            
            if (isPresenceForThreshold || isLeaveForActivity) {
                const val = (foundLeave?.dayOption === 'half' || finalStatus === '0.5P') ? 0.5 : 1; 
                // Note: AttendanceCalendar simplified present check (isDetailedPresent)
                // If it's a holiday, it counts as 1.
                const inc = (isDetailedPresent && dayEvents.length > 0) ? 1 : 1; // Simplify to 1 for calendar threshold
                
                daysActiveInWeek += inc;
                if (isPresenceForThreshold) {
                    daysPresentInWeek += inc;
                }
            }

            statusMap.set(dateStr, { 
                status: finalStatus, 
                holidayName, 
                presenceVal, 
                isSiteOtPresent,
                isPoolHoliday: !!foundPool
            });
        });

        return statusMap;
    }, [currentDate, events, leaveRequests, userHolidays, holidays, recurringHolidayDates, settings, user, employmentStartDate]);

    // All notation definitions — dot color matches actual calendar cell color
    const ALL_NOTATIONS: { code: string; label: string; dot: string }[] = [
        { code: 'P',     label: 'Present',        dot: 'bg-emerald-500'   },
        { code: '0.5P',  label: 'Half Day',        dot: 'bg-gradient-to-br from-emerald-500 to-red-500' },
        { code: '0.75P', label: 'Three-Qtr Day',  dot: 'bg-emerald-400'   },
        { code: '0.25P', label: 'Quarter Day',     dot: 'bg-blue-400'      },
        { code: 'A',     label: 'Absent',          dot: 'bg-red-500'       },
        { code: 'LOP',   label: 'Loss of Pay',     dot: 'bg-red-500'       },
        { code: 'W/O',   label: 'W.O',             dot: 'bg-rose-300'      },
        { code: 'H',     label: 'Holiday',         dot: 'bg-sky-400'       },
        { code: 'H/P',   label: 'Holiday Present', dot: 'bg-gradient-to-br from-sky-400 to-emerald-500' },
        { code: 'W/P',   label: 'W/O Present',     dot: 'bg-gradient-to-br from-rose-300 to-emerald-500' },
        { code: 'BL/P',  label: 'BL Present',      dot: 'bg-gradient-to-br from-blue-700 to-emerald-500' },
        { code: 'PL/P',  label: 'PL Present',      dot: 'bg-gradient-to-br from-pink-500 to-emerald-500' },
        { code: 'WH',    label: 'WH',              dot: 'bg-blue-600'      },
        { code: 'FH',    label: 'Float',           dot: 'bg-amber-500'     },
        { code: 'BL',    label: 'Blue Leave',      dot: 'bg-blue-700'      },
        { code: 'PL',    label: 'PL',              dot: 'bg-gradient-to-br from-pink-500 to-rose-500' },
        { code: 'SL',    label: 'Sick Leave',      dot: 'bg-blue-600'      },
        { code: 'EL',    label: 'Earned Leave',    dot: 'bg-blue-600'      },
        { code: 'CL',    label: 'Casual Leave',    dot: 'bg-blue-600'      },
        { code: 'CO',    label: 'C.O',             dot: 'bg-violet-600'    },
        { code: 'ML',    label: 'Maternity',       dot: 'bg-blue-600'      },
        { code: 'CCL',   label: 'Child Care',      dot: 'bg-blue-600'      },
        { code: 'OT',    label: 'Site OT',         dot: 'bg-amber-400'     },
        { code: 'RP',    label: 'Permission',      dot: 'bg-blue-600'      },
        { code: 'RC',    label: 'Correction',      dot: 'bg-emerald-500'   },
    ];

    const getDayStatus = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return dayStatusMap.get(dateStr) || { status: 'neutral', holidayName: '', presenceVal: 0, isSiteOtPresent: false, isPoolHoliday: false };
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'present': return 'bg-emerald-500 text-white border-emerald-600 shadow-sm'; // Vibrant Green
            case 'absent': return 'bg-red-500 text-white border-red-600 shadow-sm'; // Red for Absent
            case 'sunday': return 'bg-rose-300 text-gray-800 border-rose-400 shadow-sm'; // Rose Pink for Sunday
            case 'company-holiday': return 'bg-sky-400 text-white border-sky-500 shadow-sm'; // Sky Blue for Company Holiday
            case 'floating-holiday': return 'bg-amber-500 text-white border-amber-600 shadow-sm'; // Vibrant Amber
            case 'holiday-present': return 'bg-sky-400 text-white border-sky-500 shadow-sm'; // Holiday color, will be overlaid with gradient
            case 'weekend-present': return 'bg-rose-300 text-gray-800 border-rose-400 shadow-sm'; // Sunday color, will be overlaid with gradient
            case 'leave': return 'bg-blue-600 text-white border-blue-700 shadow-sm'; // Blue for Leave
            default: return 'bg-gray-50 text-gray-400 border-gray-100'; // Neutral
        }
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startDay = getDay(startOfMonth(currentDate)); // 0-6

    // Calculate Payable days and Site OT days for the current month view
    const { monthlyPaydaysCount, monthlySiteOtCount } = useMemo(() => {
        let count = 0;
        let otCount = 0;
        const today = startOfDay(new Date());

        daysInMonth.forEach(date => {
            if (isAfter(startOfDay(date), today)) return; // skip future dates only; today IS counted
            if (employmentStartDate && isBefore(startOfDay(date), employmentStartDate)) return; // skip pre-employment dates

            const dateKey = format(date, 'yyyy-MM-dd');
            const dayKeyMap = buildAttendanceDayKeyByEventId(events);
            const dayEvents = events.filter(e => dayKeyMap[e.id] === dateKey);
            
            // Normal Duty Check
            const res = getDayStatus(date);
            const status = res.status;
            
            let normalPay = 0;
            if (['present', 'holiday-present', 'weekend-present', 'floating-holiday', 'company-holiday', 'sunday'].includes(status)) {
                if (status === 'present') {
                    const { workingHours } = calculateWorkingHours(dayEvents, date);
                    const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.societyId, settings);
                    const shiftThreshold = (settings as any)?.[staffCategory]?.dailyWorkingHours?.max || 8;

                    const relevantLeave = leaveRequests?.find(req => {
                        const lStatus = String(req.status || "").toLowerCase();
                        if (lStatus !== 'approved' && lStatus !== 'correction_made' && lStatus !== 'pending_hr_confirmation') return false;
                        const start = startOfDay(new Date(req.startDate.replace(/-/g, '/')));
                        const end = endOfDay(new Date(req.endDate.replace(/-/g, '/')));
                        return date >= start && date <= end;
                    });
                    const isCorrection = relevantLeave && String(relevantLeave.leaveType || (relevantLeave as any).type || "").toLowerCase().includes('correction');
                    const isPermission = relevantLeave && String(relevantLeave.leaveType || (relevantLeave as any).leave_type || "").toLowerCase().includes('permission');

                    if (isCorrection) {
                        normalPay = 1;
                    } else if (isPermission) {
                        normalPay = 1;
                    } else if (relevantLeave && relevantLeave.dayOption === 'half') {
                        normalPay = 1; 
                    } else {
                        const threeQuarterHrs = (settings as any)?.[staffCategory]?.threeQuarterDayHours ?? (shiftThreshold * 0.75);
                        const halfDayHrs = (settings as any)?.[staffCategory]?.minimumHoursHalfDay ?? (shiftThreshold * 0.5);
                        const quarterDayHrs = (settings as any)?.[staffCategory]?.quarterDayHours ?? (shiftThreshold * 0.25);
                        
                        if (workingHours >= shiftThreshold) normalPay = 1;
                        else if (workingHours >= threeQuarterHrs) normalPay = 0.75;
                        else if (workingHours >= halfDayHrs) normalPay = 0.5;
                        else if (workingHours >= quarterDayHrs) normalPay = 0.25;
                        else normalPay = 0; // no qualifying hours → no pay
                    }
                } else if (status === 'holiday-present' || status === 'weekend-present') {
                    normalPay = 1.5;
                } else {
                    normalPay = 1;
                }
            } else if (status === 'leave') {
                const leaveReq = leaveRequests?.find(req => {
                    // Only count approved or corrected leaves — never pending/rejected
                    const lStatus = String(req.status || '').toLowerCase();
                    if (lStatus !== 'approved' && lStatus !== 'correction_made' && lStatus !== 'pending_hr_confirmation') return false;
                    return date >= startOfDay(new Date(req.startDate.replace(/-/g, '/'))) && date <= endOfDay(new Date(req.endDate.replace(/-/g, '/')));
                });
                
                const isCorrectionReq = leaveReq && String(leaveReq.leaveType || (leaveReq as any).type || "").toLowerCase().includes('correction');
                if (isCorrectionReq && leaveReq?.status === 'correction_made') {
                    normalPay = 1;
                } else if (leaveReq && leaveReq.leaveType !== 'Loss of Pay') {
                    normalPay = (leaveReq.dayOption === 'half') ? 0.5 : 1;
                    if (leaveReq.dayOption === 'half') {
                        const hasWork = dayEvents.some(e => ['punch-in', 'site-in', 'check-in'].includes(e.type.toLowerCase()));
                        if (hasWork) normalPay += 0.5;
                    }
                }
            }

            // Site OT Check
            const hasOtIn = dayEvents.some(e => e.type === 'site-ot-in');
            const hasOtOut = dayEvents.some(e => e.type === 'site-ot-out');
            const isToday = isSameDay(date, startOfDay(new Date()));
            const isSiteOt = hasOtIn && (hasOtOut || isToday);
            
            if (isSiteOt) {
                otCount += 1;
            }

            count += normalPay; // Site OT is tracked separately — does NOT add to payable days
        });
        return { monthlyPaydaysCount: count, monthlySiteOtCount: otCount };
    }, [daysInMonth, dayStatusMap, events, settings, user, leaveRequests, employmentStartDate]);

    useEffect(() => {
        if (onMonthPaydaysChange) {
            const cappedPay = Math.min(daysInMonth.length, monthlyPaydaysCount);
            onMonthPaydaysChange(cappedPay);
        }
        if (onSiteOtDaysChange) {
            onSiteOtDaysChange(monthlySiteOtCount);
        }
    }, [monthlyPaydaysCount, monthlySiteOtCount, onMonthPaydaysChange, onSiteOtDaysChange, daysInMonth]);


    return (
        <div className="bg-card p-4 rounded-xl shadow-card border border-border w-full flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-primary-text">Attendance</h3>
                    {isMonthBeforeJoining && (
                        <span className="text-[10px] font-medium text-muted bg-gray-100 dark:bg-gray-800 border border-border px-1.5 py-0.5 rounded">
                            Pre-Joining
                        </span>
                    )}
                </div>
                {isMobile ? (
                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                            className="h-7 w-7 rounded-full bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] flex items-center justify-center shadow-[0_2px_8px_rgba(68,214,44,0.3)] active:scale-95 transition-all cursor-pointer"
                            aria-label="Previous month"
                        >
                            <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
                        </button>
                        <span className="font-bold min-w-[80px] text-center text-xs text-white">{format(currentDate, 'MMMM yyyy')}</span>
                        <button 
                            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                            className="h-7 w-7 rounded-full bg-[#44D62C] hover:bg-[#39E722] text-[#0A1809] flex items-center justify-center shadow-[0_2px_8px_rgba(68,214,44,0.3)] active:scale-95 transition-all cursor-pointer"
                            aria-label="Next month"
                        >
                            <ChevronRight className="h-4 w-4 stroke-[2.5]" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-1">
                        <Button variant="secondary" size="sm" className="btn-icon !p-1 h-6 w-6" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="font-medium min-w-[80px] text-center text-xs">{format(currentDate, 'MMMM yyyy')}</span>
                        <Button variant="secondary" size="sm" className="btn-icon !p-1 h-6 w-6" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
            ) : (
                <div className="grid grid-cols-7 gap-1 flex-1">
                    {weekDays.map(d => (
                        <div key={d} className="text-center text-[10px] font-bold text-muted uppercase tracking-wider py-1">{d}</div>
                    ))}
                    {Array.from({ length: startDay }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-9" />
                    ))}
                    {daysInMonth.map(date => {
                        const holidayInfo = getDayStatus(date);
                        const status = typeof holidayInfo === 'string' ? holidayInfo : holidayInfo.status;
                        const holidayName = typeof holidayInfo === 'string' ? '' : holidayInfo.holidayName;
                        const isSiteOtPresent = typeof holidayInfo === 'string' ? false : holidayInfo.isSiteOtPresent;
                        const isPoolHoliday = typeof holidayInfo === 'string' ? false : holidayInfo.isPoolHoliday;
                        const colorClass = getStatusColor(status);
                        
                        const isToday = isSameDay(date, startOfDay(new Date()));
                        const isPast = isAfter(startOfDay(new Date()), startOfDay(date));
                        
                        // Check for pending Correction / Permission request on this day
                        const dateKey = format(date, 'yyyy-MM-dd');
                        const hasPendingCorrOrPerm = leaveRequests?.some(req => {
                            const lStatus = String(req.status || '').toLowerCase();
                            const lType = String(req.leaveType || (req as any).leave_type || '');
                            const isPending = ['pending_manager_approval', 'pending_hr_confirmation', 'pending_admin_correction'].includes(lStatus);
                            const isCorrOrPerm = lType === 'Correction' || lType === 'Permission';
                            if (!isPending || !isCorrOrPerm) return false;
                            const start = startOfDay(new Date(req.startDate.replace(/-/g, '/')));
                            const end = endOfDay(new Date(req.endDate.replace(/-/g, '/')));
                            return date >= start && date <= end;
                        }) ?? false;
                        
                        let overlayText: string | null = null;
                        let customStyle: React.CSSProperties = {};
                        let splitOverlay: React.ReactNode = null;
                        let cellTooltip: string | null = null;
                        const isSelected = selectedDayKey === dateKey;

                        if (status === 'present' || status === 'holiday-present' || status === 'weekend-present') {
                            const dayKeyMap = buildAttendanceDayKeyByEventId(events);
                            const dayEvents = events.filter(e => dayKeyMap[e.id] === dateKey);
                            const { workingHours } = calculateWorkingHours(dayEvents, date);
                            const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.societyId, settings);
                            const shiftThreshold = (settings as any)?.[staffCategory]?.dailyWorkingHours?.max || 8;
                            
                            const relevantLeave = leaveRequests?.find(req => {
                                const lStatus = String(req.status || "").toLowerCase();
                                const lType = String(req.leaveType || (req as any).type || "").toLowerCase();
                                if (lStatus !== 'approved' && lStatus !== 'correction_made' && lStatus !== 'pending_hr_confirmation') return false;
                                const start = startOfDay(new Date(req.startDate.replace(/-/g, '/')));
                                const end = endOfDay(new Date(req.endDate.replace(/-/g, '/')));
                                return date >= start && date <= end;
                            });

                            const isCorrection = relevantLeave && String(relevantLeave.leaveType || (relevantLeave as any).type || "").toLowerCase().includes('correction');
                            const isPermission = relevantLeave && String(relevantLeave.leaveType || (relevantLeave as any).leave_type || '').toLowerCase().includes('permission');

                            if (relevantLeave && relevantLeave.dayOption === 'half') {
                                let leaveCode = getLeaveAbbreviation(relevantLeave.leaveType || (relevantLeave as any).leave_type);
                                if (isCorrection) {
                                    const reason = (relevantLeave.reason || (relevantLeave as any).reason || "").toLowerCase();
                                    if (reason.includes('e/l') || reason.includes('el') || reason.includes('earned')) leaveCode = 'EL';
                                    else if (reason.includes('s/l') || reason.includes('sl') || reason.includes('sick')) leaveCode = 'SL';
                                    else if (reason.includes('c/l') || reason.includes('cl') || reason.includes('casual')) leaveCode = 'CL';
                                    else if (reason.includes('c/o') || reason.includes('co') || reason.includes('comp')) leaveCode = 'CO';
                                    else if (reason.includes('lop') || reason.includes('loss')) leaveCode = 'LOP';
                                    else leaveCode = '';
                                    
                                    overlayText = leaveCode ? (isSelected ? `0.5P+0.5${leaveCode}` : `P+${leaveCode}`) : '0.5P';
                                    cellTooltip = leaveCode ? `0.5 Present + 0.5 ${leaveCode}` : '0.5 Present';
                                } else {
                                    overlayText = status === 'holiday-present' 
                                        ? (isSelected ? `H/0.5P+0.5 ${leaveCode}` : `H/P+${leaveCode}`)
                                        : status === 'weekend-present' 
                                            ? (isSelected ? `W/0.5P+0.5 ${leaveCode}` : `W/P+${leaveCode}`) 
                                            : (isSelected ? `0.5P+0.5 ${leaveCode}` : `P+${leaveCode}`);
                                    cellTooltip = `0.5 Present + 0.5 ${leaveCode}`;
                                }
                                const leftColor = status === 'holiday-present' ? '#38bdf8' : status === 'weekend-present' ? '#fda4af' : '#10b981';
                                const rightColor = (leaveCode === 'PL' || leaveCode === 'Pink') ? '#ec4899' : '#2563eb';
                                customStyle = {
                                    background: leftColor,
                                    borderColor: 'transparent'
                                };
                                splitOverlay = (
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                        <polygon points="0,100 100,100 100,0" fill={leaveCode ? rightColor : leftColor} />
                                    </svg>
                                );
                            } else if (isPermission) {
                                if (workingHours >= shiftThreshold) {
                                    overlayText = 'P';
                                    cellTooltip = 'Present (P)';
                                    customStyle = {
                                        background: '#10b981',
                                        borderColor: 'transparent'
                                    };
                                } else if (workingHours > 0) {
                                    let permMins = 0;
                                    if (relevantLeave?.correctionDetails?.permissionMinutes) {
                                        permMins = Number(relevantLeave.correctionDetails.permissionMinutes);
                                    } else if (relevantLeave?.correctionDetails?.punchIn && relevantLeave?.correctionDetails?.punchOut) {
                                        const toMins = (t: string) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                                        let diff = toMins(relevantLeave.correctionDetails.punchOut) - toMins(relevantLeave.correctionDetails.punchIn);
                                        if (diff < 0) diff += 24 * 60;
                                        permMins = diff;
                                    } else {
                                        permMins = Math.max(0, Math.round((shiftThreshold - workingHours) * 60));
                                    }

                                    const rawWorkedFraction = workingHours / shiftThreshold;
                                    const workedFraction = Math.min(0.99, Math.max(0.01, Math.round(rawWorkedFraction * 100) / 100));
                                    let permFraction = permMins > 0 
                                        ? Math.round((permMins / (shiftThreshold * 60)) * 100) / 100 
                                        : Math.max(0, Math.round((1 - workedFraction) * 100) / 100);

                                    if (workedFraction + permFraction > 1.0) {
                                        permFraction = Math.max(0.01, Math.round((1 - workedFraction) * 100) / 100);
                                    }

                                    const totalFraction = workedFraction + permFraction;
                                    const blueRatio = totalFraction > 0 ? permFraction / totalFraction : 0.03;

                                    // By default show clean P+RP for perfect box alignment; show exact fraction on user tap
                                    overlayText = isSelected ? `${workedFraction}P+${permFraction}RP` : 'P+RP';
                                    cellTooltip = `${workedFraction}P (${workingHours.toFixed(1)}h worked) + ${permFraction}RP (${permMins}m permission)`;

                                    // Use clean vector polygon to avoid CSS gradient wrap/bleeding artifacts on box edges
                                    if (blueRatio <= 0.5) {
                                        customStyle = {
                                            background: '#10b981',
                                            borderColor: 'transparent'
                                        };
                                        const side = Math.min(100, Math.max(5, Math.round(Math.sqrt(2 * blueRatio) * 1000) / 10));
                                        splitOverlay = (
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <polygon points={`${100 - side},100 100,100 100,${100 - side}`} fill="#2563eb" />
                                            </svg>
                                        );
                                    } else {
                                        customStyle = {
                                            background: '#2563eb',
                                            borderColor: 'transparent'
                                        };
                                        const greenRatio = 1 - blueRatio;
                                        const side = Math.min(100, Math.max(5, Math.round(Math.sqrt(2 * greenRatio) * 1000) / 10));
                                        splitOverlay = (
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <polygon points={`0,0 ${side},0 0,${side}`} fill="#10b981" />
                                            </svg>
                                        );
                                    }
                                } else {
                                    overlayText = 'RP';
                                    cellTooltip = 'Permission (RP)';
                                    customStyle = {
                                        background: '#2563eb',
                                        borderColor: 'transparent'
                                    };
                                }
                            } else if (isCorrection) {
                                overlayText = 'P';
                                customStyle = {
                                    background: '#10b981', // Solid green for correction
                                    borderColor: 'transparent'
                                };
                            } else if (workingHours >= shiftThreshold) {
                                if (status === 'holiday-present') {
                                    overlayText = 'H/P';
                                } else if (status === 'weekend-present') {
                                    overlayText = holidayName === 'Blue Leave' ? 'BL/P' : (holidayName === 'Pink Leave' ? 'PL/P' : 'W/P');
                                } else {
                                    overlayText = 'P';
                                }
                                if (status === 'holiday-present' || status === 'weekend-present') {
                                    let leftColor = '#38bdf8'; // sky-400
                                    if (status === 'holiday-present') {
                                        leftColor = '#38bdf8';
                                    } else if (status === 'weekend-present') {
                                        leftColor = holidayName === 'Blue Leave' ? '#1d4ed8' : (holidayName === 'Pink Leave' ? '#ec4899' : '#fda4af');
                                    }
                                    customStyle = {
                                        background: leftColor,
                                        borderColor: 'transparent'
                                    };
                                    splitOverlay = (
                                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                            <polygon points="0,100 100,100 100,0" fill="#10b981" />
                                        </svg>
                                    );
                                }
                            } else {
                                const fullThreshold = staffCategory === 'field' ? 6 : shiftThreshold;
                                const halfThreshold = staffCategory === 'field' ? 3 : (shiftThreshold * 0.5);
                                const isHalf = workingHours >= halfThreshold;
                                const prefix = holidayName === 'Blue Leave' ? 'BL' : (holidayName === 'Pink Leave' ? 'PL' : 'W');
                                
                                if (isToday) {
                                    // Live Green & Red split based on hours worked today (e.g. 4 hrs = half green / half red)
                                    const shiftHours = fullThreshold || 8;
                                    const rawWorkedFraction = workingHours / shiftHours;
                                    const workedFraction = Math.min(0.99, Math.max(0.00, Math.round(rawWorkedFraction * 100) / 100));
                                    const greenPercentage = Math.round(workedFraction * 100);
                                    const redPercentage = 100 - greenPercentage;

                                    if (status === 'holiday-present') {
                                        const side = Math.min(100, Math.max(5, Math.round(Math.sqrt(2 * (greenPercentage / 100)) * 1000) / 10));
                                        customStyle = { background: '#38bdf8', borderColor: 'transparent' };
                                        splitOverlay = (
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <polygon points={`0,0 ${side},0 0,${side}`} fill="#10b981" />
                                            </svg>
                                        );
                                        overlayText = `${workedFraction.toFixed(2)}H/P`;
                                    } else if (status === 'weekend-present') {
                                        const baseBg = holidayName === 'Blue Leave' ? '#1d4ed8' : (holidayName === 'Pink Leave' ? '#ec4899' : '#fda4af');
                                        const side = Math.min(100, Math.max(5, Math.round(Math.sqrt(2 * (greenPercentage / 100)) * 1000) / 10));
                                        customStyle = { background: baseBg, borderColor: 'transparent' };
                                        splitOverlay = (
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <polygon points={`0,0 ${side},0 0,${side}`} fill="#10b981" />
                                            </svg>
                                        );
                                        overlayText = `${workedFraction.toFixed(2)}${prefix}/P`;
                                    } else if (greenPercentage <= 0) {
                                        customStyle = { background: '#ef4444', borderColor: 'transparent' };
                                        overlayText = '0.00P';
                                        splitOverlay = null;
                                    } else if (redPercentage <= 50) {
                                        // Green >= 50%: Base is Green (#10b981), Red (#ef4444) fills the remaining bottom-right corner
                                        customStyle = { background: '#10b981', borderColor: 'transparent' };
                                        const side = Math.min(100, Math.max(5, Math.round(Math.sqrt(2 * (redPercentage / 100)) * 1000) / 10));
                                        splitOverlay = (
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <polygon points={`${100 - side},100 100,100 100,${100 - side}`} fill="#ef4444" />
                                            </svg>
                                        );
                                        overlayText = isSelected 
                                            ? `${workedFraction.toFixed(2)}P+${(1 - workedFraction).toFixed(2)}A`
                                            : (workedFraction === 0.5 ? '0.5P' : (workedFraction === 0.75 ? '0.75P' : `${workedFraction.toFixed(2)}P`));
                                    } else {
                                        // Green < 50%: Base is Red (#ef4444), Green (#10b981) fills the worked top-left corner
                                        customStyle = { background: '#ef4444', borderColor: 'transparent' };
                                        const side = Math.min(100, Math.max(5, Math.round(Math.sqrt(2 * (greenPercentage / 100)) * 1000) / 10));
                                        splitOverlay = (
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <polygon points={`0,0 ${side},0 0,${side}`} fill="#10b981" />
                                            </svg>
                                        );
                                        overlayText = isSelected 
                                            ? `${workedFraction.toFixed(2)}P+${(1 - workedFraction).toFixed(2)}A`
                                            : (workedFraction === 0.25 ? '0.25P' : `${workedFraction.toFixed(2)}P`);
                                    }
                                    cellTooltip = `${workingHours.toFixed(1)}h worked (${greenPercentage}%) + ${(Math.max(0, shiftHours - workingHours)).toFixed(1)}h remaining (${redPercentage}%) - Shift in Progress`;
                                } else {
                                    if (status === 'holiday-present') {
                                        overlayText = isHalf ? '0.5H/P' : 'H';
                                    } else if (status === 'weekend-present') {
                                        overlayText = isHalf ? `0.5${prefix}/P` : prefix;
                                    } else {
                                        overlayText = isHalf ? '0.5P' : 'A';
                                    }
                                    const fractionValue = isHalf ? 0.5 : 0;
                                    const greenPercentage = isHalf ? 50 : 0;
                                    let leftColor = '#10b981';
                                    if (status === 'holiday-present') {
                                        leftColor = '#38bdf8';
                                    } else if (status === 'weekend-present') {
                                        leftColor = holidayName === 'Blue Leave' ? '#1d4ed8' : (holidayName === 'Pink Leave' ? '#ec4899' : '#fda4af');
                                    }
                                    
                                    const redPercentage = 100 - greenPercentage;
                                    if (redPercentage <= 50) {
                                        customStyle = { background: leftColor, borderColor: 'transparent' };
                                        const side = Math.min(100, Math.max(5, Math.round(Math.sqrt(2 * (redPercentage / 100)) * 1000) / 10));
                                        splitOverlay = (
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <polygon points={`${100 - side},100 100,100 100,${100 - side}`} fill="#ef4444" />
                                            </svg>
                                        );
                                    } else {
                                        customStyle = { background: '#ef4444', borderColor: 'transparent' };
                                        const side = Math.min(100, Math.max(5, Math.round(Math.sqrt(2 * (greenPercentage / 100)) * 1000) / 10));
                                        splitOverlay = (
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <polygon points={`0,0 ${side},0 0,${side}`} fill={leftColor} />
                                            </svg>
                                        );
                                    }
                                }
                            }
                        } else if (status === 'company-holiday' || status === 'floating-holiday' || status === 'sunday') {
                            overlayText = status === 'sunday' ? null : 'H';
                        } else if (status === 'leave') {
                            const request = leaveRequests?.find(req => {
                                if (req.status !== 'approved' && req.status !== 'pending_hr_confirmation' && req.status !== 'correction_made') return false;
                                const start = startOfDay(new Date(req.startDate.replace(/-/g, '/')));
                                const end = endOfDay(new Date(req.endDate.replace(/-/g, '/')));
                                return date >= start && date <= end;
                            });
                            if (request) {
                                const lType = String(request.leaveType || (request as any).type || "").toLowerCase();
                                if (request.dayOption === 'half') {
                                    let leaveCode = getLeaveAbbreviation(request.leaveType || (request as any).leave_type);
                                    if (lType.includes('correction')) {
                                        const reason = (request.reason || (request as any).reason || "").toLowerCase();
                                        if (reason.includes('e/l') || reason.includes('el') || reason.includes('earned')) leaveCode = 'EL';
                                        else if (reason.includes('s/l') || reason.includes('sl') || reason.includes('sick')) leaveCode = 'SL';
                                        else if (reason.includes('c/l') || reason.includes('cl') || reason.includes('casual')) leaveCode = 'CL';
                                        else if (reason.includes('c/o') || reason.includes('co') || reason.includes('comp')) leaveCode = 'CO';
                                        else if (reason.includes('lop') || reason.includes('loss')) leaveCode = 'LOP';
                                        else leaveCode = '';
                                        
                                        overlayText = leaveCode ? (isSelected ? `0.5P+0.5${leaveCode}` : `P+${leaveCode}`) : '0.5P';
                                        cellTooltip = leaveCode ? `0.5 Present + 0.5 ${leaveCode}` : '0.5 Present';
                                        const rightColor = (leaveCode === 'PL' || leaveCode === 'Pink') ? '#ec4899' : '#2563eb';
                                        customStyle = {
                                            background: '#10b981',
                                            borderColor: 'transparent'
                                        };
                                        splitOverlay = (
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <polygon points="0,100 100,100 100,0" fill={leaveCode ? rightColor : '#10b981'} />
                                            </svg>
                                        );
                                    } else {
                                        overlayText = isSelected ? `0.5A+0.5${leaveCode}` : `A+${leaveCode}`;
                                        cellTooltip = `0.5 Absent + 0.5 ${leaveCode}`;
                                        const isPink = String(request.leaveType || '').toLowerCase().includes('pink');
                                        const rightColor = isPink ? '#ec4899' : '#2563eb';
                                        customStyle = {
                                            background: '#ef4444',
                                            borderColor: 'transparent'
                                        };
                                        splitOverlay = (
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <polygon points="0,100 100,100 100,0" fill={rightColor} />
                                            </svg>
                                        );
                                    }
                                } else if (lType.includes('correction')) {
                                    overlayText = 'RC';
                                    cellTooltip = 'Correction (RC)';
                                    customStyle = {
                                        background: '#10b981', // Solid green for correction
                                        borderColor: 'transparent'
                                    };
                                } else if (lType.includes('permission')) {
                                    overlayText = 'RP';
                                    cellTooltip = 'Permission (RP)';
                                    customStyle = {
                                        background: '#2563eb', // Solid blue for permission
                                        borderColor: 'transparent'
                                    };
                                } else {
                                    const code = getLeaveAbbreviation(request.leaveType || (request as any).leave_type);
                                    overlayText = code;
                                    cellTooltip = request.leaveType || code;
                                    if (code === 'PL') {
                                        customStyle = {
                                            background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', // Premium pink gradient
                                            borderColor: 'transparent'
                                        };
                                    }
                                }
                            } else {
                                overlayText = 'WH';
                            }
                        } else if (status === 'absent') {
                            overlayText = 'A';
                        }

                        return (
                            <div 
                                key={date.toISOString()} 
                                style={customStyle} 
                                onClick={() => setSelectedDayKey(prev => prev === dateKey ? null : dateKey)}
                                title={cellTooltip || holidayName || undefined}
                                className={`h-9 rounded flex flex-col items-center justify-center ${colorClass} transition-all border ${isSelected ? 'border-amber-400 ring-2 ring-amber-400/70 shadow-md z-30' : (isToday && status === 'neutral' ? 'ring-2 ring-emerald-500/60 border-emerald-500' : 'border-transparent hover:border-border/50')} group relative cursor-pointer select-none overflow-hidden`}
                            >
                                {splitOverlay}
                                <span className={`font-bold leading-none ${overlayText ? 'text-[11px] mb-[1px]' : 'text-xs'} ${isToday ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]' : ''} relative z-10`}>
                                    {format(date, 'd')}
                                </span>
                                 {overlayText && (
                                    <span className={`font-black leading-none text-white drop-shadow-md tracking-tighter text-center whitespace-nowrap ${overlayText.length > 8 ? 'text-[6px] px-0.5' : overlayText.length > 5 ? 'text-[7px]' : 'text-[9px]'} relative z-10`}>
                                        {overlayText}
                                    </span>
                                )}
                                {isSiteOtPresent && (
                                    <div className="absolute top-[2px] right-[2px] w-[11px] h-[11px] bg-amber-400 rounded-full border border-white shadow-sm flex items-center justify-center overflow-hidden z-20" title="Site OT Performed">
                                        <span className="text-[6px] text-white font-black leading-none">OT</span>
                                    </div>
                                )}
                                {/* Pending Correction/Permission indicator — animated orange dot */}
                                {hasPendingCorrOrPerm && !isSiteOtPresent && (
                                    <div
                                        className="absolute top-[2px] right-[2px] w-[8px] h-[8px] bg-orange-400 rounded-full border border-white shadow-sm z-20 animate-pulse"
                                        title="Correction/Permission request pending approval"
                                        aria-label="Pending correction or permission"
                                    />
                                )}
                                {/* Selected Floating breakdown popover on user tap */}
                                {isSelected && cellTooltip && (
                                    <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 bg-gray-950 text-white text-[9px] font-bold py-1 px-2.5 rounded shadow-xl border border-emerald-500/50 whitespace-nowrap z-50 pointer-events-none flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
                                        <span>{cellTooltip}</span>
                                        <div className="w-1.5 h-1.5 bg-gray-950 border-r border-b border-emerald-500/50 rotate-45 -mb-1.5 mt-0.5" />
                                    </div>
                                )}
                                {holidayName && !isSelected && (
                                    <div className="absolute bottom-[-35px] left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity shadow-lg">
                                        {holidayName}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            
            <div className="mt-4 pt-3 border-t border-border/50">
                {(() => {
                    // Collect all overlay codes used this month
                    const usedCodes = new Set<string>();
                    const monthStart = startOfMonth(currentDate);
                    const monthEnd = endOfMonth(currentDate);
                    eachDayOfInterval({ start: monthStart, end: monthEnd }).forEach(date => {
                        const info = dayStatusMap.get(format(date, 'yyyy-MM-dd'));
                        if (!info || info.status === 'neutral') return;
                        const s = info.status;
                        // Mirror the overlay logic
                        if (s === 'absent') { usedCodes.add('A'); return; }
                        if (s === 'company-holiday' || s === 'floating-holiday') { usedCodes.add('H'); return; }
                        if (s === 'sunday') return;
                        if (s === 'present' || s === 'holiday-present' || s === 'weekend-present') {
                            const dateKey = format(date, 'yyyy-MM-dd');
                            const dayKeyMap = buildAttendanceDayKeyByEventId(events);
                            const dayEvts = events.filter(e => dayKeyMap[e.id] === dateKey);
                            const { workingHours } = calculateWorkingHours(dayEvts, date);
                            const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.societyId, settings);
                            const shiftThreshold = (settings as any)?.[staffCategory]?.dailyWorkingHours?.max || 8;
                            const relevantLeave = leaveRequests?.find(req => {
                                const lStatus = String(req.status || '').toLowerCase();
                                if (lStatus !== 'approved' && lStatus !== 'correction_made' && lStatus !== 'pending_hr_confirmation') return false;
                                const start = startOfDay(new Date(req.startDate.replace(/-/g, '/')));
                                const end = endOfDay(new Date(req.endDate.replace(/-/g, '/')));
                                return date >= start && date <= end;
                            });
                            const isCorrection = relevantLeave && String(relevantLeave.leaveType || '').toLowerCase().includes('correction');
                            if (isCorrection) { usedCodes.add('P'); return; }
                            const isPermission = relevantLeave && String(relevantLeave.leaveType || '').toLowerCase().includes('permission');
                            if (isPermission) {
                                usedCodes.add('P');
                                usedCodes.add('RP');
                                return;
                            }
                            if (relevantLeave?.dayOption === 'half') {
                                usedCodes.add('0.5P');
                                const code = getLeaveAbbreviation(relevantLeave.leaveType || (relevantLeave as any).leave_type);
                                usedCodes.add(code);
                                return;
                            }
                            if (workingHours >= shiftThreshold) {
                                  if (s === 'holiday-present') usedCodes.add('H/P');
                                  else if (s === 'weekend-present') {
                                      const code = info.holidayName === 'Blue Leave' ? 'BL/P' : (info.holidayName === 'Pink Leave' ? 'PL/P' : 'W/P');
                                      usedCodes.add(code);
                                  }
                                  else usedCodes.add('P');
                            } else {
                                  const halfHrs = staffCategory === 'field' ? 3 : ((settings as any)?.[staffCategory]?.minimumHoursHalfDay ?? shiftThreshold * 0.5);
                                  if (workingHours >= halfHrs) usedCodes.add('0.5P');
                                  else usedCodes.add('A');
                             }
                            return;
                        }
                        if (s === 'leave') {
                            const req = leaveRequests?.find(r => {
                                if (r.status !== 'approved' && r.status !== 'pending_hr_confirmation' && r.status !== 'correction_made') return false;
                                const start = startOfDay(new Date(r.startDate.replace(/-/g, '/')));
                                const end = endOfDay(new Date(r.endDate.replace(/-/g, '/')));
                                return date >= start && date <= end;
                            });
                            if (!req) { usedCodes.add('WH'); return; }
                            const lType = String(req.leaveType || '').toLowerCase();
                            if (lType.includes('correction')) { usedCodes.add('RC'); return; }
                            if (lType.includes('permission')) { usedCodes.add('RP'); return; }
                            if (req.dayOption === 'half') {
                                usedCodes.add('0.5P');
                                const code = getLeaveAbbreviation(req.leaveType || (req as any).leave_type);
                                usedCodes.add(code);
                                return;
                            }
                            const code = getLeaveAbbreviation(req.leaveType || (req as any).leave_type);
                            if (code && !usedCodes.has(code)) {
                                usedCodes.add(code);
                            }
                        }
                    });

                    // Also add OT if any site OT days
                    const hasSiteOt = Array.from(dayStatusMap.values()).some(v => v.isSiteOtPresent);
                    if (hasSiteOt) usedCodes.add('OT');

                    // Show pending RC/RP legend entry if any exist this month
                    const hasPendingThisMonth = leaveRequests?.some(req => {
                        const lStatus = String(req.status || '').toLowerCase();
                        const lType = String(req.leaveType || (req as any).leave_type || '');
                        return ['pending_manager_approval', 'pending_hr_confirmation', 'pending_admin_correction'].includes(lStatus)
                            && (lType === 'Correction' || lType === 'Permission');
                    }) ?? false;
                    if (hasPendingThisMonth) usedCodes.add('PENDING_RC');

                    const activeNotations = ALL_NOTATIONS.filter(n => usedCodes.has(n.code));
                    if (activeNotations.length === 0) return null;

                    return (
                        <>
                            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">Notations</p>
                            <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
                                {activeNotations.map(({ code, label, dot }) => (
                                    <div key={code} className="flex items-center gap-1.5">
                                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight leading-none">{label}</span>
                                    </div>
                                ))}
                                {/* Pending indicator legend — shown separately */}
                                {hasPendingThisMonth && (
                                    <div className="flex items-center gap-1.5 col-span-3">
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-orange-400 animate-pulse" />
                                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-tight leading-none">Pending Correction/Permission</span>
                                    </div>
                                )}
                            </div>
                        </>
                    );
                })()}
            </div>
        </div>
    );
};

export default AttendanceCalendar;
