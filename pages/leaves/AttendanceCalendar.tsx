import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isAfter, startOfDay, endOfDay, startOfWeek, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getStaffCategory, calculateWorkingHours } from '../../utils/attendanceCalculations';
import { api } from '../../services/api';
import type { AttendanceEvent, UserHoliday, LeaveRequest, AttendanceSettings, RecurringHolidayRule } from '../../types';
import { FIXED_HOLIDAYS, HOLIDAY_SELECTION_POOL } from '../../utils/constants';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';


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
    onMonthPaydaysChange
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
            if ((rule.type || 'office') !== roleType) return false;
            // 3rd Saturday holiday applies ONLY to users EXPLICITLY marked as MALE (per HR policy)
            if (rule.day === 'Saturday' && !isMale) return false;
            return true;
        });
    }, [user, recurringHolidays, settings]);



    const recurringHolidayDates = useMemo(() => {
        const dates: Date[] = [];
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        const days = eachDayOfInterval({ start, end });
        
        const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.organizationId, settings);
        const categorySettings = (settings as any)?.[staffCategory];
        const expiryDate = categorySettings?.floating_leaves_expiry_date || categorySettings?.floatingLeavesExpiryDate;

        recurringRules.forEach(rule => {
            let count = 0;
            for (const day of days) {
                if (format(day, 'EEEE').toLowerCase() === rule.day.toLowerCase()) {
                    count++;
                    if (count === rule.n) {
                        // Check if this recurring holiday is expired (e.g. 3rd Saturday after Feb 1st)
                        const dateStr = format(day, 'yyyy-MM-dd');
                        if (rule.day === 'Saturday' && expiryDate && dateStr > expiryDate) {
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
        const statusMap = new Map<string, { status: string; holidayName: string; presenceVal: number }>();
        if (!settings || !user) return statusMap;

        const staffCategory = getStaffCategory(user.roleId || user.role || '', user.organizationId, settings);
        const threshold = (settings as any)?.[staffCategory]?.weekendPresentThreshold ?? 3;
        
        // Start buffer to seed counters
        const bufferStart = startOfWeek(subDays(startOfMonth(currentDate), 15), { weekStartsOn: 1 });
        const intervalDays = eachDayOfInterval({ start: bufferStart, end: endOfMonth(currentDate) });

        let daysPresentInWeek = 0;
        let daysActiveInWeek = 0;
        let daysPresentInPreviousWeek = 0;

        intervalDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayOfWeek = day.getDay();

            if (dayOfWeek === 1) {
                daysPresentInPreviousWeek = daysActiveInWeek;
                daysPresentInWeek = 0;
                daysActiveInWeek = 0;
            }

            const dayEvents = events.filter(e => isSameDay(new Date(e.timestamp), day));
            const hasCheckIn = dayEvents.some(e => e.type.toLowerCase().includes('check') || e.type.toLowerCase().includes('in'));
            const hasCheckOut = dayEvents.some(e => e.type.toLowerCase().includes('out'));
            const isToday = isSameDay(day, startOfDay(new Date()));
            const isPast = isAfter(startOfDay(new Date()), startOfDay(day));
            const isDetailedPresent = (hasCheckIn && hasCheckOut) || (hasCheckIn && isToday);

            const isRecurringHoliday = recurringHolidayDates.some(d => isSameDay(d, day));
            const floatingExpiryDate = (settings as any)?.[staffCategory]?.floatingLeavesExpiryDate;
            const isFloatingExpired = floatingExpiryDate && dateStr > floatingExpiryDate;

            const foundConfigured = holidays.find(h => {
                const [y, m, d] = h.date.split('-').map(Number);
                return isSameDay(new Date(y, m - 1, d), day);
            });
            const foundFixed = FIXED_HOLIDAYS.find(fh => {
                const [m, d] = fh.date.split('-').map(Number);
                return isSameDay(new Date(day.getFullYear(), m - 1, d), day);
            });
            const foundPool = userHolidays.find(uh => {
                const [y, m, d] = uh.holidayDate.split('-').map(Number);
                return isSameDay(new Date(y, m - 1, d), day);
            });

            const isCompanyHoliday = !!foundConfigured || !!foundFixed || !!foundPool;
            const isSunday = dayOfWeek === 0;
            const holidayName = foundConfigured?.name || foundFixed?.name || foundPool?.holidayName || (isRecurringHoliday && !isFloatingExpired ? '3rd Saturday' : isSunday ? 'Sunday' : '');

            const foundLeave = leaveRequests.find(req => {
                if (req.status !== 'approved' && req.status !== 'pending_hr_confirmation' && req.status !== 'correction_made') return false;
                return day >= startOfDay(new Date(req.startDate)) && day <= endOfDay(new Date(req.endDate));
            });

            const isActiveInPreviousWeek = daysPresentInPreviousWeek >= threshold;
            const meetsThreshold = daysPresentInWeek >= threshold;

            let finalStatus = 'neutral';
            let presenceVal = 0;

            if (isDetailedPresent) {
                if (isSunday || isCompanyHoliday || (isRecurringHoliday && !isFloatingExpired)) {
                    finalStatus = 'holiday-present';
                } else {
                    finalStatus = 'present';
                }
            } else if (foundLeave) {
                finalStatus = 'leave';
            } else if (isRecurringHoliday && !isFloatingExpired) {
                finalStatus = isActiveInPreviousWeek ? 'floating-holiday' : (isPast ? 'absent' : 'neutral');
            } else if (isCompanyHoliday) {
                finalStatus = isActiveInPreviousWeek ? 'company-holiday' : (isPast ? 'absent' : 'neutral');
            } else if (isSunday) {
                finalStatus = meetsThreshold ? 'sunday' : (isPast ? 'absent' : 'neutral');
            } else if (isPast) {
                finalStatus = 'absent';
            }

            // Update Counters
            const isPresenceForThreshold = ['present', 'holiday-present'].includes(finalStatus) || (isCompanyHoliday && !isPast);
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

            statusMap.set(dateStr, { status: finalStatus, holidayName, presenceVal });
        });

        return statusMap;
    }, [currentDate, events, leaveRequests, userHolidays, holidays, recurringHolidayDates, settings, user]);

    const getDayStatus = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return dayStatusMap.get(dateStr) || { status: 'neutral', holidayName: '' };
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'present': return 'bg-emerald-500 text-white border-emerald-600 shadow-sm'; // Vibrant Green
            case 'absent': return 'bg-red-500 text-white border-red-600 shadow-sm'; // Red for Absent
            case 'sunday': return 'bg-rose-300 text-gray-800 border-rose-400 shadow-sm'; // Rose Pink for Sunday
            case 'company-holiday': return 'bg-sky-400 text-white border-sky-500 shadow-sm'; // Sky Blue for Company Holiday
            case 'floating-holiday': return 'bg-amber-500 text-white border-amber-600 shadow-sm'; // Vibrant Amber
            case 'holiday-present': return 'bg-violet-600 text-white border-violet-700 shadow-sm'; // Vibrant Purple (Comp Off)
            case 'leave': return 'bg-blue-600 text-white border-blue-700 shadow-sm'; // Blue for Leave
            default: return 'bg-gray-50 text-gray-400 border-gray-100'; // Neutral
        }
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startDay = getDay(startOfMonth(currentDate)); // 0-6

    // Calculate Payable days for the current month view
    const monthlyPaydaysCount = useMemo(() => {
        let count = 0;
        const today = startOfDay(new Date());

        daysInMonth.forEach(date => {
            if (isAfter(startOfDay(date), today)) return;

            const res = getDayStatus(date);
            const status = res.status;
            
            if (['present', 'holiday-present', 'floating-holiday', 'company-holiday', 'sunday'].includes(status)) {
                // For 'present', we should still check if it's a half day in actual events
                if (status === 'present') {
                    const dayEvents = events.filter(e => isSameDay(new Date(e.timestamp), date));
                    const { workingHours } = calculateWorkingHours(dayEvents, date);
                    const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.organizationId, settings);
                    const shiftThreshold = (settings as any)?.[staffCategory]?.dailyWorkingHours?.max || 8;
                    count += (workingHours >= shiftThreshold) ? 1 : 0.5;
                } else {
                    count += 1;
                }
            } else if (status === 'leave') {
                const dateStr = format(date, 'yyyy-MM-dd');
                const leaveReq = leaveRequests?.find(req => {
                    return date >= startOfDay(new Date(req.startDate)) && date <= endOfDay(new Date(req.endDate));
                });
                
                if (leaveReq && leaveReq.leaveType !== 'Loss of Pay') {
                    count += (leaveReq.dayOption === 'half') ? 0.5 : 1;
                    // If half day leave, check if they worked the other half
                    if (leaveReq.dayOption === 'half') {
                        const dayEvents = events.filter(e => isSameDay(new Date(e.timestamp), date));
                        if (dayEvents.length > 0) count += 0.5;
                    }
                }
            }
        });
        return count;
    }, [daysInMonth, dayStatusMap, events, settings, user, leaveRequests]);

    useEffect(() => {
        if (onMonthPaydaysChange) {
            onMonthPaydaysChange(monthlyPaydaysCount);
        }
    }, [monthlyPaydaysCount, onMonthPaydaysChange]);


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
                        const colorClass = getStatusColor(status);
                        
                        const isToday = isSameDay(date, startOfDay(new Date()));
                        const isPast = isAfter(startOfDay(new Date()), startOfDay(date));
                        
                        let overlayText: string | null = null;
                        let customStyle: React.CSSProperties = {};

                        if (status === 'present' || status === 'holiday-present') {
                            const dayEvents = events.filter(e => isSameDay(new Date(e.timestamp), date));
                            const { workingHours } = calculateWorkingHours(dayEvents, date);
                            const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.organizationId, settings);
                            const shiftThreshold = (settings as any)?.[staffCategory]?.dailyWorkingHours?.max || 8;
                            
                            if (workingHours >= shiftThreshold) {
                                overlayText = 'P';
                            } else {
                                overlayText = '0.5P';
                                const baseColor = status === 'holiday-present' ? '#7c3aed' : '#10b981'; // violet-600 or emerald-500
                                customStyle = {
                                    background: `linear-gradient(135deg, ${baseColor} 50%, #ef4444 50%)`, // Split with red (#ef4444)
                                    borderColor: 'transparent' // Hide the border
                                };
                            }
                        } else if (status === 'company-holiday' || status === 'floating-holiday' || status === 'sunday') {
                            overlayText = status === 'sunday' ? null : 'H';
                        } else if (status === 'leave') {
                            const request = leaveRequests?.find(req => {
                                if (req.status !== 'approved' && req.status !== 'pending_hr_confirmation') return false;
                                const start = startOfDay(new Date(req.startDate.replace(/-/g, '/')));
                                const end = endOfDay(new Date(req.endDate.replace(/-/g, '/')));
                                return date >= start && date <= end;
                            });
                            if (request) {
                                if (request.dayOption === 'half') {
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
                                        default: overlayText = 'L'; break;
                                    }
                                }
                            } else {
                                overlayText = 'L';
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
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div> Leave</div>
            </div>
        </div>
    );
};

export default AttendanceCalendar;
