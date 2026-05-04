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

    // Determine which holidays to use based on user role
    const holidays = useMemo(() => {
        const { officeHolidays, fieldHolidays } = useSettingsStore.getState();
        const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.organizationId, settings);
        if (staffCategory === 'field') return fieldHolidays;
        return officeHolidays;
    }, [user, settings]);

    const recurringRules = useMemo(() => {
        const roleType = getStaffCategory(user?.roleId || user?.role || '', user?.organizationId, settings);
        const isMale = (user?.gender || '').toLowerCase() === 'male';
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
        const staffCategory = getStaffCategory(user.roleId || user.role || '', user.organizationId, settings);
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
        const statusMap = new Map<string, { status: string; holidayName: string; presenceVal: number; isSiteOtPresent: boolean }>();
        if (!settings || !user) return statusMap;

        const staffCategory = getStaffCategory(user.roleId || user.role || '', user.organizationId, settings);
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
            const visuallyActiveCurr = (daysActiveInWeek >= threshold);

            if (isDetailedPresent) {
                // If worked on a Sunday or Holiday, set a special status
                if (isCompanyHoliday) {
                    finalStatus = 'holiday-present';
                } else if (isSunday || (isRecurringHoliday && !isFloatingExpired)) {
                    finalStatus = 'weekend-present';
                } else {
                    finalStatus = 'present';
                }
            } else if (foundLeave) {
                finalStatus = 'leave';
            } else if (isRecurringHoliday && !isFloatingExpired) {
                // Always show FLOAT color — it's a designated Blue Leave day regardless of threshold
                finalStatus = 'floating-holiday';
            } else if (isCompanyHoliday) {
                // Always show HOLIDAY color — it's a designated company holiday
                finalStatus = 'company-holiday';
            } else if (isSunday) {
                finalStatus = visuallyActiveCurr ? 'sunday' : 'neutral';
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

            statusMap.set(dateStr, { status: finalStatus, holidayName, presenceVal, isSiteOtPresent });
        });

        return statusMap;
    }, [currentDate, events, leaveRequests, userHolidays, holidays, recurringHolidayDates, settings, user]);

    const getDayStatus = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return dayStatusMap.get(dateStr) || { status: 'neutral', holidayName: '', presenceVal: 0, isSiteOtPresent: false };
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
            if (!isBefore(startOfDay(date), today)) return; 

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
                    const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.organizationId, settings);
                    const shiftThreshold = (settings as any)?.[staffCategory]?.dailyWorkingHours?.max || 8;

                    const relevantLeave = leaveRequests?.find(req => {
                        if (req.status !== 'approved' && req.status !== 'correction_made' && req.status !== 'pending_hr_confirmation') return false;
                        const start = startOfDay(new Date(req.startDate.replace(/-/g, '/')));
                        const end = endOfDay(new Date(req.endDate.replace(/-/g, '/')));
                        return date >= start && date <= end;
                    });

                    if (relevantLeave && relevantLeave.leaveType === 'Correction') {
                        normalPay = 1;
                    } else if (relevantLeave && relevantLeave.dayOption === 'half') {
                        normalPay = 1; 
                    } else {
                        normalPay = (workingHours >= shiftThreshold) ? 1 : 0.5;
                    }
                } else {
                    normalPay = 1;
                }
            } else if (status === 'leave') {
                const leaveReq = leaveRequests?.find(req => {
                    return date >= startOfDay(new Date(req.startDate.replace(/-/g, '/'))) && date <= endOfDay(new Date(req.endDate.replace(/-/g, '/')));
                });
                
                if (leaveReq && leaveReq.leaveType === 'Correction' && leaveReq.status === 'correction_made') {
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

            count += normalPay + (isSiteOt ? 1 : 0);
        });
        return { monthlyPaydaysCount: count, monthlySiteOtCount: otCount };
    }, [daysInMonth, dayStatusMap, events, settings, user, leaveRequests]);

    useEffect(() => {
        if (onMonthPaydaysChange) {
            onMonthPaydaysChange(monthlyPaydaysCount);
        }
        if (onSiteOtDaysChange) {
            onSiteOtDaysChange(monthlySiteOtCount);
        }
    }, [monthlyPaydaysCount, monthlySiteOtCount, onMonthPaydaysChange, onSiteOtDaysChange]);


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
                        const colorClass = getStatusColor(status);
                        
                        const isToday = isSameDay(date, startOfDay(new Date()));
                        const isPast = isAfter(startOfDay(new Date()), startOfDay(date));
                        
                        let overlayText: string | null = null;
                        let customStyle: React.CSSProperties = {};

                        if (status === 'present' || status === 'holiday-present' || status === 'weekend-present') {
                            const dateKey = format(date, 'yyyy-MM-dd');
                            const dayKeyMap = buildAttendanceDayKeyByEventId(events);
                            const dayEvents = events.filter(e => dayKeyMap[e.id] === dateKey);
                            const { workingHours } = calculateWorkingHours(dayEvents, date);
                            const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.organizationId, settings);
                            const shiftThreshold = (settings as any)?.[staffCategory]?.dailyWorkingHours?.max || 8;
                            
                            const relevantLeave = leaveRequests?.find(req => {
                                if (req.status !== 'approved' && req.status !== 'correction_made' && req.status !== 'pending_hr_confirmation') return false;
                                const start = startOfDay(new Date(req.startDate.replace(/-/g, '/')));
                                const end = endOfDay(new Date(req.endDate.replace(/-/g, '/')));
                                return date >= start && date <= end;
                            });

                            if (relevantLeave && relevantLeave.leaveType === 'Correction') {
                                overlayText = 'P';
                                customStyle = {
                                    background: '#10b981', // Solid green for correction
                                    borderColor: 'transparent'
                                };
                            } else if (relevantLeave && relevantLeave.dayOption === 'half') {
                                overlayText = status === 'holiday-present' ? 'H/0.5P' : status === 'weekend-present' ? 'W.O/0.5P' : '0.5P';
                                const leftColor = status === 'holiday-present' ? '#38bdf8' : status === 'weekend-present' ? '#fda4af' : '#10b981';
                                customStyle = {
                                    background: `linear-gradient(135deg, ${leftColor} 50%, #2563eb 50%)`, // Half Holiday/Sunday / Half Blue
                                    borderColor: 'transparent'
                                };
                            } else if (workingHours >= shiftThreshold) {
                                overlayText = status === 'holiday-present' ? 'H/P' : status === 'weekend-present' ? 'W.O/P' : 'P';
                                if (status === 'holiday-present' || status === 'weekend-present') {
                                    const leftColor = status === 'holiday-present' ? '#38bdf8' : '#fda4af'; // sky-400 or rose-300
                                    customStyle = {
                                        background: `linear-gradient(135deg, ${leftColor} 50%, #10b981 50%)`, // Split with green
                                        borderColor: 'transparent'
                                    };
                                }
                            } else {
                                overlayText = status === 'holiday-present' ? 'H/0.5P' : status === 'weekend-present' ? 'W.O/0.5P' : '0.5P';
                                const leftColor = status === 'holiday-present' ? '#38bdf8' : status === 'weekend-present' ? '#fda4af' : '#10b981';
                                customStyle = {
                                    background: `linear-gradient(135deg, ${leftColor} 50%, #ef4444 50%)`, // Split with red (#ef4444)
                                    borderColor: 'transparent' // Hide the border
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
                                if (request.leaveType === 'Correction') {
                                    overlayText = 'P';
                                    customStyle = {
                                        background: '#10b981', // Solid green for correction
                                        borderColor: 'transparent'
                                    };
                                } else if (request.dayOption === 'half') {
                                    overlayText = '0.5P';
                                    customStyle = {
                                        background: 'linear-gradient(135deg, #10b981 50%, #2563eb 50%)', // Half Green / Half Blue
                                        borderColor: 'transparent'
                                    };
                                } else {
                                    switch (request.leaveType) {
                                        case 'Earned': overlayText = 'EL'; break;
                                        case 'Sick': overlayText = 'SL'; break;
                                        case 'Comp Off': overlayText = 'CO'; break;
                                        case 'Floating': overlayText = 'FH'; break;
                                        case 'Maternity': overlayText = 'ML'; break;
                                        case 'Child Care': overlayText = 'CCL'; break;
                                        case 'Loss of Pay': overlayText = 'LOP'; break;
                                        default: overlayText = 'WH'; break;
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
            
            <div className="mt-4 pt-3 border-t border-border/50 grid grid-cols-3 gap-x-2 gap-y-2 text-[10px] text-muted-foreground uppercase font-bold tracking-tight leading-tight">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0"></div> Present</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #10b981 50%, #ef4444 50%)' }}></div> Half Day</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div> Absent</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-rose-300 rounded-full flex-shrink-0"></div> W.O</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-sky-400 rounded-full flex-shrink-0"></div> Holiday</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0"></div> Float</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-violet-600 rounded-full flex-shrink-0"></div> C.O</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div> WH</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-amber-400 rounded-full border border-white/20 shadow-sm flex-shrink-0"></div> Site OT</div>
            </div>
        </div>
    );
};

export default AttendanceCalendar;
