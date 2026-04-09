import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isAfter, startOfDay, endOfDay } from 'date-fns';
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
        return recurringHolidays.filter(rule => (rule.type || 'office') === roleType);
    }, [user, recurringHolidays, settings]);

    // Debug logs
    useEffect(() => {
        console.log('Active Recurring Rules:', recurringRules);
    }, [recurringRules]);

    const recurringHolidayDates = useMemo(() => {
        const dates: Date[] = [];
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        const days = eachDayOfInterval({ start, end });

        // Get the allowed number of floating holidays per month from settings
        const allowedFloatingHolidays = (user?.role === 'field_staff'
            ? settings?.field?.monthlyFloatingLeaves
            : settings?.office?.monthlyFloatingLeaves) ?? 0;

        let foundHolidays = 0;

        recurringRules.forEach(rule => {
            // If we've already found enough holidays for this month, stop.
            // Note: This logic assumes we want to prioritize rules in the order they are defined.
            // If 'allowedFloatingHolidays' is 0, no recurring holidays will be shown.
            if (foundHolidays >= allowedFloatingHolidays) return;

            let count = 0;
            for (const day of days) {
                if (format(day, 'EEEE').toLowerCase() === rule.day.toLowerCase()) {
                    count++;
                    if (count === rule.n) {
                        dates.push(day);
                        foundHolidays++;
                        break; // Found the specific occurrence (e.g. 3rd Saturday)
                    }
                }
            }
        });
        return dates;
    }, [currentDate, recurringRules, settings, user]);

    useEffect(() => {
        console.log("Calculated Recurring Holiday Dates:", recurringHolidayDates);
    }, [recurringHolidayDates]);

    // No internal fetching needed as data is passed via props

    const daysInMonth = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(currentDate),
            end: endOfMonth(currentDate)
        });
    }, [currentDate]);

    const getDayStatus = (date: Date) => {
        const currentYear = date.getFullYear();
        const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.organizationId, settings);
        const activePool = (settings as any)?.[staffCategory]?.holidayPool || HOLIDAY_SELECTION_POOL;
        
        // Check for attendance (present)
        const hasCheckIn = events.some(e => isSameDay(new Date(e.timestamp), date) && (e.type.toLowerCase().includes('check') || e.type.toLowerCase().includes('in')));

        // Check for configured recurring holiday (Floating Holiday)
        const isRecurringHoliday = recurringHolidayDates.some(d => isSameDay(d, date));
        
        // Expiry Check for Floating Holiday
        const floatingExpiryDate = (settings as any)?.[staffCategory]?.floatingLeavesExpiryDate;
        const isFloatingExpired = floatingExpiryDate && format(date, 'yyyy-MM-dd') > floatingExpiryDate;

        // Check for general expiry (if all allocation rules are expired, hide highlights)
        const dateStr = format(date, 'yyyy-MM-dd');
        const earnedExpiry = (settings as any)?.[staffCategory]?.earnedLeavesExpiryDate;
        const sickExpiry = (settings as any)?.[staffCategory]?.sickLeavesExpiryDate;
        const compOffExpiry = (settings as any)?.[staffCategory]?.compOffLeavesExpiryDate;
        
        const isEarnedExpired = earnedExpiry && dateStr > earnedExpiry;
        const isSickExpired = sickExpiry && dateStr > sickExpiry;
        const isCompOffExpired = compOffExpiry && dateStr > compOffExpiry;
        
        // Check for specific date holiday from admin settings (Company Holiday)
        const isConfiguredHoliday = holidays.some(h => {
            const [y, m, d] = h.date.split('-').map(Number);
            return isSameDay(new Date(y, m - 1, d), date);
        });

        // Check for FIXED holidays (like Republic Day on 26th)
        const isFixedHoliday = FIXED_HOLIDAYS.some(fh => {
            const [m, d] = fh.date.split('-').map(Number);
            const fixedDate = new Date(currentYear, m - 1, d);
            return isSameDay(fixedDate, date);
        });

        const isPoolHoliday = userHolidays.some(uh => {
            const [y, m, d] = uh.holidayDate.split('-').map(Number);
            const poolDate = new Date(y, m - 1, d);
            return isSameDay(poolDate, date);
        });

        // Combine all company holiday sources
        const isCompanyHoliday = isConfiguredHoliday || isFixedHoliday || isPoolHoliday;

        // Check if it's a Sunday (weekly off)
        const isSunday = getDay(date) === 0;

        // Define if all holiday-related rules are expired
        // If everything is expired, we shouldn't show "fixed" highlights that imply an active allocation period.
        const isAllocationExpired = isFloatingExpired && isEarnedExpired && isSickExpired && isCompOffExpired;

        // Check for Approved Leave
        const isApprovedLeave = leaveRequests.some(req => {
            if (req.status !== 'approved' && req.status !== 'pending_hr_confirmation') return false;
            const start = new Date(req.startDate);
            const end = new Date(req.endDate);
            // Check intersection (inclusive)
            return date >= startOfDay(start) && date <= endOfDay(end);
        });

        // Priority Logic:
        // 1. If it's a valid holiday (active recurring, company holiday, or Sunday) AND the user checked in -> Holiday Present (comp-off earned)
        const validRecurringHoliday = isRecurringHoliday && !isFloatingExpired;

        if ((validRecurringHoliday || isCompanyHoliday || isSunday) && hasCheckIn) {
            return 'holiday-present';
        }

        // 2. Approved Leave
        if (isApprovedLeave) return 'leave';

        // 3. If it's not a holiday but has check-in -> Present
        if (hasCheckIn) return 'present';

        // 4. If allocation is expired, everything else is neutral
        if (isAllocationExpired) return 'neutral';

        // 5. If it's a holiday and NO check-in -> Holiday (or Floating Holiday)
        if (isRecurringHoliday && !isFloatingExpired) return 'floating-holiday'; // Yellow
        if (isConfiguredHoliday || isFixedHoliday || isPoolHoliday) return 'company-holiday'; // Blue
        if (isSunday) return 'sunday'; // Sunday as weekly off

        // 6. Check for absent (past date, no check-in, not holiday)
        const isPast = isAfter(startOfDay(new Date()), startOfDay(date)); // date < today
        if (isPast) return 'absent';

        return 'neutral';
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
            // Exclude future days from accrued real-time pay calculation
            if (isAfter(startOfDay(date), today)) {
                return;
            }

            const status = getDayStatus(date);
            
            if (['present', 'holiday-present'].includes(status)) {
                // Determine if this was a half-day or full-day
                const dayEvents = events.filter(e => isSameDay(new Date(e.timestamp), date));
                const { workingHours } = calculateWorkingHours(dayEvents);
                const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.organizationId, settings);
                const shiftThreshold = (settings as any)?.[staffCategory]?.dailyWorkingHours?.max || 8;
                
                if (workingHours >= shiftThreshold) {
                    count += 1;
                } else if (workingHours > 0) {
                    count += 0.5;
                }
            } else if (['floating-holiday', 'company-holiday', 'sunday'].includes(status)) {
                count += 1;
            } else if (status === 'leave') {
                const leaveReq = leaveRequests?.find(req => {
                    if (req.status !== 'approved' && req.status !== 'pending_hr_confirmation') return false;
                    const start = startOfDay(new Date(req.startDate));
                    const end = endOfDay(new Date(req.endDate));
                    return date >= start && date <= end;
                });
                
                const isHalfDay = leaveReq?.dayOption === 'half';
                
                if (isHalfDay) {
                    // 0.5 for the leave part (if not LOP)
                    if (leaveReq.leaveType !== 'Loss of Pay') {
                        count += 0.5;
                    }
                    // 0.5 for the worked part (if they checked in)
                    const dayEvents = events.filter(e => isSameDay(new Date(e.timestamp), date));
                    if (dayEvents.length > 0) {
                        count += 0.5;
                    }
                } else if (!leaveReq || leaveReq.leaveType !== 'Loss of Pay') {
                    count += 1;
                }
            }
        });
        return count;
    }, [daysInMonth, getDayStatus, events, settings, user]);

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
                        const status = getDayStatus(date);
                        const colorClass = getStatusColor(status);
                        
                        let overlayText = null;
                        let customStyle: React.CSSProperties = {};

                        if (status === 'present' || status === 'holiday-present') {
                            const dayEvents = events.filter(e => isSameDay(new Date(e.timestamp), date));
                            const { workingHours } = calculateWorkingHours(dayEvents);
                            const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.organizationId, settings);
                            const shiftThreshold = (settings as any)?.[staffCategory]?.dailyWorkingHours?.max || 8;
                            
                            if (workingHours >= shiftThreshold) {
                                overlayText = 'P';
                            } else {
                                overlayText = '0.5P';
                                const baseColor = status === 'holiday-present' ? '#7c3aed' : '#10b981'; // violet-600 or emerald-500
                                customStyle = {
                                    background: `linear-gradient(135deg, ${baseColor} 50%, #ef4444 50%)`, // Split with red (#ef4444)
                                    borderColor: 'transparent' // Hide the border so it doesn't wrap green around the red half
                                };
                            }
                        } else if (status === 'company-holiday' || status === 'floating-holiday') {
                            overlayText = 'H';
                        } else if (status === 'leave') {
                            const request = leaveRequests?.find(req => {
                                if (req.status !== 'approved' && req.status !== 'pending_hr_confirmation') return false;
                                const start = startOfDay(new Date(req.startDate.replace(/-/g, '/')));
                                const end = endOfDay(new Date(req.endDate.replace(/-/g, '/')));
                                return date >= start && date <= end;
                            });
                            if (request) {
                                // If it's a half-day leave, show as 0.5P with the half-day gradient
                                if (request.dayOption === 'half') {
                                    overlayText = '0.5P';
                                    customStyle = {
                                        background: 'linear-gradient(135deg, #10b981 50%, #2563eb 50%)', // Half Green (#10b981) / Half Blue (#2563eb)
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
                            <div key={date.toISOString()} style={customStyle} className={`h-9 rounded flex flex-col items-center justify-center ${colorClass} transition-colors border border-transparent hover:border-border/50`}>
                                <span className={`font-bold leading-none ${overlayText ? 'text-[11px] mb-[2px]' : 'text-xs'}`}>
                                    {format(date, 'd')}
                                </span>
                                {overlayText && (
                                    <span className={`text-[9px] font-black leading-none text-white drop-shadow-md`}>
                                        {overlayText}
                                    </span>
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
