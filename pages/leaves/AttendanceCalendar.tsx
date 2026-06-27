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


interface AttendanceCalendarProps {
    leaveRequests?: LeaveRequest[];
    userHolidays?: UserHoliday[];
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    events: AttendanceEvent[];
    settings: AttendanceSettings | null;
    recurringHolidays: RecurringHolidayRule[];
    isLoading?: boolean;
    onMonthPaydaysChange?: (payDays: number) => void;
    onSiteOtDaysChange?: (otDays: number) => void;
}

const getLeaveAbbreviation = (leaveType?: string): string => {
    const type = String(leaveType || '').toLowerCase().trim();
    if (type.includes('earned') || type === 'el') return 'EL';
    if (type.includes('sick') || type === 'sl') return 'SL';
    if (type.includes('comp') || type === 'co') return 'CO';
    if (type.includes('floating') || type === 'fh') return 'FH';
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
    onMonthPaydaysChange,
    onSiteOtDaysChange
}) => {
    const { user } = useAuthStore();
    const isFemale = ['female', 'ladies'].includes((user?.gender || '').toLowerCase());
    const isMale = !isFemale;

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
        if (!settings || !user) return statusMap;

        const staffCategory = getStaffCategory(user.roleId || user.role || '', user.societyId, settings);
        const threshold = (settings as any)?.[staffCategory]?.weekendPresentThreshold ?? 2;
        
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

            if (dayOfWeek === 1) {
                daysPresentInPreviousWeek = daysActiveInWeek;
                daysPresentInWeek = 0;
                daysActiveInWeek = 0;
            }

            const dayEvents = eventsByGroup[dateStr] || [];
            const hasCheckIn = dayEvents.some(e => ['punch-in', 'site-in', 'check-in'].includes(e.type.toLowerCase()));
            const hasCheckOut = dayEvents.some(e => ['punch-out', 'site-out', 'check-out'].includes(e.type.toLowerCase()));
            const hasOtPunchIn = dayEvents.some(e => e.type === 'site-ot-in');
            const hasOtPunchOut = dayEvents.some(e => e.type === 'site-ot-out');
            
            const isToday = isSameDay(day, startOfDay(new Date()));
            const isPast = isAfter(startOfDay(new Date()), startOfDay(day));
            
            // Normal Duty Status
            const isDetailedPresent = (hasCheckIn && hasCheckOut) || (hasCheckIn && isToday);
            // Site OT Status
            const isSiteOtPresent = hasOtPunchIn && (hasOtPunchOut || isToday);

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

            let finalStatus = 'neutral';
            let presenceVal = 0;

            // Remove future assumptions - strictly follow activity threshold
            const visuallyActivePrev = (daysPresentInPreviousWeek >= threshold);
            const visuallyActiveCurr = (daysPresentInWeek >= threshold);

            if (isCompanyHoliday) {
                finalStatus = isDetailedPresent ? 'holiday-present' : 'company-holiday';
            } else if (isRecurringHoliday && !isFloatingExpired) {
                finalStatus = isDetailedPresent ? 'weekend-present' : 'floating-holiday';
            } else if (foundLeave && foundLeave.dayOption !== 'half' && (foundLeave as any).day_option !== 'half') {
                // Full-day approved/active leave takes priority over any presence/attendance logs
                finalStatus = 'leave';
            } else if (isDetailedPresent) {
                if (isSunday) {
                    finalStatus = 'weekend-present';
                } else {
                    finalStatus = 'present';
                }
            } else if (foundLeave) {
                finalStatus = 'leave';
            } else if (isSunday) {
                finalStatus = visuallyActiveCurr ? 'sunday' : (isPast ? 'absent' : 'neutral');
            } else if (isPast) {
                finalStatus = 'absent';
            }

            // Update Counters
            const isPresenceForThreshold = ['present', 'holiday-present', 'weekend-present'].includes(finalStatus) || (isCompanyHoliday && !isPast);
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
    }, [currentDate, events, leaveRequests, userHolidays, holidays, recurringHolidayDates, settings, user]);

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

                    if (isCorrection) {
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
    }, [daysInMonth, dayStatusMap, events, settings, user, leaveRequests]);

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
                <h3 className="text-sm font-semibold text-primary-text">Attendance</h3>
                <div className="flex items-center gap-1">
                    <Button variant="secondary" size="sm" className="btn-icon !p-1 h-6 w-6" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="font-medium min-w-[80px] text-center text-xs">{format(currentDate, 'MMMM yyyy')}</span>
                    <Button variant="secondary" size="sm" className="btn-icon !p-1 h-6 w-6" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
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

                        if (status === 'present' || status === 'holiday-present' || status === 'weekend-present') {
                            const dateKey = format(date, 'yyyy-MM-dd');
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

                            if (isCorrection) {
                                overlayText = 'P';
                                customStyle = {
                                    background: '#10b981', // Solid green for correction
                                    borderColor: 'transparent'
                                };
                            } else if (relevantLeave && relevantLeave.dayOption === 'half') {
                                const leaveCode = getLeaveAbbreviation(relevantLeave.leaveType || (relevantLeave as any).leave_type);
                                overlayText = status === 'holiday-present' 
                                    ? `H/0.5P+0.5 ${leaveCode}` 
                                    : status === 'weekend-present' 
                                        ? `W/0.5P+0.5 ${leaveCode}` 
                                        : `0.5P+0.5 ${leaveCode}`;
                                const leftColor = status === 'holiday-present' ? '#38bdf8' : status === 'weekend-present' ? '#fda4af' : '#10b981';
                                const isPink = String(relevantLeave.leaveType || '').toLowerCase().includes('pink');
                                const rightColor = isPink ? '#ec4899' : '#2563eb';
                                customStyle = {
                                    background: `linear-gradient(135deg, ${leftColor} 50%, ${rightColor} 50%)`, // Half Holiday/Sunday / Half Blue or Pink
                                    borderColor: 'transparent'
                                };
                            } else if (workingHours >= shiftThreshold) {
                                if (status === 'holiday-present') {
                                    overlayText = (isPoolHoliday && !isFemale) ? 'BL/P' : 'H/P';
                                } else if (status === 'weekend-present') {
                                    overlayText = holidayName === 'Blue Leave' ? 'BL/P' : (holidayName === 'Pink Leave' ? 'PL/P' : 'W/P');
                                } else {
                                    overlayText = 'P';
                                }
                                if (status === 'holiday-present' || status === 'weekend-present') {
                                    let leftColor = '#38bdf8'; // sky-400
                                    if (status === 'holiday-present') {
                                        leftColor = (isPoolHoliday && !isFemale) ? '#1d4ed8' : '#38bdf8';
                                    } else if (status === 'weekend-present') {
                                        leftColor = holidayName === 'Blue Leave' ? '#1d4ed8' : (holidayName === 'Pink Leave' ? '#ec4899' : '#fda4af');
                                    }
                                    customStyle = {
                                        background: `linear-gradient(135deg, ${leftColor} 50%, #10b981 50%)`, // Split with green
                                        borderColor: 'transparent'
                                    };
                                }
                            } else {
                                const threeQuarterHrs = (settings as any)?.[staffCategory]?.threeQuarterDayHours ?? (shiftThreshold * 0.75);
                                const halfDayHrs = (settings as any)?.[staffCategory]?.minimumHoursHalfDay ?? (shiftThreshold * 0.5);
                                const quarterDayHrs = (settings as any)?.[staffCategory]?.quarterDayHours ?? (shiftThreshold * 0.25);
                                
                                let fractionText = '0.5P';
                                let greenPercentage = 50;
                                
                                if (workingHours >= threeQuarterHrs) {
                                    fractionText = '0.75P';
                                    greenPercentage = 75;
                                } else if (workingHours >= halfDayHrs) {
                                    fractionText = '0.5P';
                                    greenPercentage = 50;
                                } else if (workingHours >= quarterDayHrs) {
                                    fractionText = '0.25P';
                                    greenPercentage = 25;
                                }

                                const prefix = holidayName === 'Blue Leave' ? 'BL' : (holidayName === 'Pink Leave' ? 'PL' : 'W');
                                overlayText = status === 'holiday-present' ? `${(isPoolHoliday && !isFemale) ? 'BL' : 'H'}/${fractionText}` : status === 'weekend-present' ? `${prefix}/${fractionText}` : fractionText;
                                let leftColor = '#10b981';
                                if (status === 'holiday-present') {
                                    leftColor = (isPoolHoliday && !isFemale) ? '#1d4ed8' : '#38bdf8';
                                } else if (status === 'weekend-present') {
                                    leftColor = holidayName === 'Blue Leave' ? '#1d4ed8' : (holidayName === 'Pink Leave' ? '#ec4899' : '#fda4af');
                                }
                                customStyle = {
                                    background: `linear-gradient(135deg, ${leftColor} ${greenPercentage}%, #ef4444 ${greenPercentage}%)`,
                                    borderColor: 'transparent'
                                };
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
                                if (lType.includes('correction')) {
                                    overlayText = 'RC';
                                    customStyle = {
                                        background: '#10b981', // Solid green for correction
                                        borderColor: 'transparent'
                                    };
                                } else if (lType.includes('permission')) {
                                    overlayText = 'RP';
                                    customStyle = {
                                        background: '#2563eb', // Solid blue for permission
                                        borderColor: 'transparent'
                                    };
                                } else if (request.dayOption === 'half') {
                                    const leaveCode = getLeaveAbbreviation(request.leaveType || (request as any).leave_type);
                                    overlayText = `0.5 A + 0.5 ${leaveCode}`;
                                    const isPink = String(request.leaveType || '').toLowerCase().includes('pink');
                                    const rightColor = isPink ? '#ec4899' : '#2563eb';
                                    customStyle = {
                                        background: `linear-gradient(135deg, #ef4444 50%, ${rightColor} 50%)`, // Half Red (Absent) / Half Blue or Pink
                                        borderColor: 'transparent'
                                    };
                                } else {
                                    const code = getLeaveAbbreviation(request.leaveType || (request as any).leave_type);
                                    overlayText = code;
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
                            <div key={date.toISOString()} style={customStyle} className={`h-9 rounded flex flex-col items-center justify-center ${colorClass} transition-colors border border-transparent hover:border-border/50 group relative cursor-help`}>
                                <span className={`font-bold leading-none ${overlayText ? 'text-[11px] mb-[2px]' : 'text-xs'}`}>
                                    {format(date, 'd')}
                                </span>
                                 {overlayText && (
                                    <span className={`text-[9px] font-black leading-none text-white drop-shadow-md`}>
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
                                {holidayName && (
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
                                const threeQtr = (settings as any)?.[staffCategory]?.threeQuarterDayHours ?? shiftThreshold * 0.75;
                                const halfHrs  = (settings as any)?.[staffCategory]?.minimumHoursHalfDay  ?? shiftThreshold * 0.5;
                                const qtrHrs   = (settings as any)?.[staffCategory]?.quarterDayHours      ?? shiftThreshold * 0.25;
                                if (workingHours >= threeQtr) usedCodes.add('0.75P');
                                else if (workingHours >= halfHrs) usedCodes.add('0.5P');
                                else if (workingHours >= qtrHrs) usedCodes.add('0.25P');
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
                            usedCodes.add(code);
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
