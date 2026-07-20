import React, { useState, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { CompOffLog, LeaveRequest, AttendanceEvent, UserHoliday } from '../../types';
import { FIXED_HOLIDAYS, HOLIDAY_SELECTION_POOL } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getStaffCategory, calculateWorkingHours, isBangaloreLocation } from '../../utils/attendanceCalculations';
import { buildAttendanceDayKeyByEventId } from '../../utils/attendanceDayGrouping';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';


interface CompOffCalendarProps {
    logs: CompOffLog[];
    leaveRequests?: LeaveRequest[];
    userHolidays?: UserHoliday[];
    isLoading?: boolean;
    viewingDate: Date;
    onDateChange: (date: Date) => void;
    events: AttendanceEvent[];
}

const CompOffCalendar: React.FC<CompOffCalendarProps> = ({ 
    logs, 
    leaveRequests = [], 
    userHolidays = [], 
    isLoading = false, 
    viewingDate, 
    onDateChange,
    events
}) => {
    const { user } = useAuthStore();
    const { officeHolidays, fieldHolidays, recurringHolidays, attendance } = useSettingsStore();

    // Group events by day key for accurate work hour calculations
    const eventsByDay = useMemo(() => {
        const dayKeyMap = buildAttendanceDayKeyByEventId(events || []);
        const grouped: Record<string, AttendanceEvent[]> = {};
        (events || []).forEach(e => {
            const key = dayKeyMap[e.id];
            if (key) {
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(e);
            }
        });
        return grouped;
    }, [events]);

    // Determine which holidays to use based on user role
    const holidays = useMemo(() => {
        if (user?.role === 'field_staff') return fieldHolidays;
        return officeHolidays;
    }, [user, fieldHolidays, officeHolidays]);

    // Fetch attendance events for the current month
    // No internal fetching needed as events are passed via props

    const daysInMonth = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(viewingDate),
            end: endOfMonth(viewingDate)
        });
    }, [viewingDate]);

    const getDayStatus = (date: Date) => {
        const currentYear = date.getFullYear();
        const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.societyId, { missedCheckoutConfig: attendance?.missedCheckoutConfig });
        const userRules = (attendance as any)?.[staffCategory];
        const halfThreshold = userRules?.minimumHoursHalfDay || 4;
        const fullThreshold = userRules?.minimumHoursFullDay || userRules?.dailyWorkingHours?.min || 8;
        const dateStr = format(date, 'yyyy-MM-dd');

        // 1. Check for taken comp-offs from leave requests
        const isTaken = leaveRequests.some(request => {
            if (request.leaveType !== 'Comp Off' || request.status !== 'approved') return false;
            const start = new Date(request.startDate.replace(/-/g, '/'));
            const end = new Date(request.endDate.replace(/-/g, '/'));
            return date >= start && date <= end;
        });

        if (isTaken) return 'taken';

        // 2. Check for earned comp-offs from CompOffLog entries
        const hasCompOffLog = logs.some(log => {
            const logDate = new Date(log.dateEarned.replace(/-/g, '/'));
            return isSameDay(logDate, date);
        });

        if (hasCompOffLog) {
            // Technically a log might be a manual 0.5 addition, but we don't have that info in the log trivially here without amounts. Assume 'earned' full for now unless we know otherwise.
            return 'earned'; 
        }

        // 3. Check for earned comp-offs from attendance (worked on holiday/Sunday)
        const dayEvents = eventsByDay[dateStr] || [];
        const hasCheckIn = dayEvents.some(e => 
            e.type.toLowerCase().includes('check') || e.type.toLowerCase().includes('in')
        );

        if (hasCheckIn) {
            // Check if it's a Sunday (weekly off)
            const isSunday = getDay(date) === 0;

            // Check for FIXED holidays (like Republic Day on 26th)
            const isFixedHoliday = FIXED_HOLIDAYS.some(fh => {
                const [m, d] = fh.date.split('-').map(Number);
                const fixedDate = new Date(currentYear, m - 1, d);
                return isSameDay(fixedDate, date);
            });

            // Check for Pool holidays
            // Only consider it a holiday if the user has selected it
            const isPoolHoliday = userHolidays.some(uh => {
                // uh.holidayDate is stored as "YYYY-MM-DD" in the database
                const [y, m, d] = uh.holidayDate.split('-').map(Number);
                const poolDate = new Date(y, m - 1, d);
                return isSameDay(poolDate, date);
            });

            // Check for configured holidays
            const isConfiguredHoliday = holidays.some(h => {
                const [y, m, d] = h.date.split('-').map(Number);
                return isSameDay(new Date(y, m - 1, d), date);
            });

            // Check for recurring holidays (like 3rd Saturday for male Bangalore employees)
            const isFemale = ['female', 'ladies'].includes((user?.gender || '').toLowerCase());
            const isMale = !isFemale;
            const userLocationStr = user?.location || user?.locationName || user?.organizationName || user?.societyName || '';
            const isBangaloreStaff = isBangaloreLocation(userLocationStr) && (staffCategory === 'office' || staffCategory === 'field');

            const isFloatingHolidayValid = (dateToCheck: string) => {
                if (!userRules) return false;
                if (userRules.floatingHolidayMonths && userRules.floatingHolidayMonths.length > 0) {
                    const monthIdx = new Date(dateToCheck.replace(/-/g, '/')).getMonth();
                    return userRules.floatingHolidayMonths.includes(monthIdx);
                }
                if (userRules.floatingLeavesValidFrom && dateToCheck < userRules.floatingLeavesValidFrom) return false;
                if (userRules.floatingLeavesExpiryDate && dateToCheck > userRules.floatingLeavesExpiryDate) return false;
                return true;
            };

            const dayName = format(date, 'EEEE');
            const isRecurringHoliday = (recurringHolidays || []).some(rh => {
                 const rhType = rh.type || rh.roleType;
                 const rhN = typeof rh.n !== 'undefined' ? rh.n : rh.occurrence;
                 
                 if (rhType && rhType !== staffCategory) return false;
                 if (rh.day !== dayName) return false;
                 
                 if (rh.day === 'Saturday' && rhN === 3) {
                     if (!isBangaloreStaff) return false;
                     if (!isMale) return false;
                     if (!isFloatingHolidayValid(dateStr)) return false;
                 }
                 
                 if (rhN === 0) return true; 
                 const nth = Math.ceil(date.getDate() / 7);
                 return rhN === nth;
            }) || (isBangaloreStaff && isMale && dayName === 'Saturday' && Math.ceil(date.getDate() / 7) === 3 && isFloatingHolidayValid(dateStr));

            // If worked on any type of holiday/Sunday, it's earned comp-off
            if (isSunday || isFixedHoliday || isPoolHoliday || isConfiguredHoliday || isRecurringHoliday) {
                // Check if there is an approved attendance correction request for that day
                const hasCorrection = leaveRequests.some(l => {
                    const lType = String(l.leaveType || (l as any).type || '').toLowerCase();
                    const lStatus = String(l.status || '').toLowerCase();
                    return lType.includes('correction') && 
                           (lStatus === 'approved' || lStatus === 'correction_made') && 
                           l.startDate === dateStr;
                });

                const { workingHours } = calculateWorkingHours(dayEvents, date);
                if (hasCorrection || workingHours >= fullThreshold) {
                    return 'earned';
                } else if (workingHours >= halfThreshold) {
                    return 'earned-half';
                }
            }
        }

        return 'neutral';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'earned': return 'bg-emerald-500 text-white border-emerald-600 shadow-sm'; // Green for Earned
            case 'earned-half': return 'bg-emerald-300 text-emerald-900 border-emerald-400 shadow-sm'; // Lighter green for Half
            case 'taken': return 'bg-red-500 text-white border-red-600 shadow-sm'; // Red for Taken
            default: return 'bg-gray-50 text-gray-400 border-gray-100'; // Neutral
        }
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startDay = getDay(startOfMonth(viewingDate)); // 0-6

    const loading = isLoading;



    return (
        <div className="bg-card p-4 rounded-xl shadow-card border border-border w-full flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="text-sm font-semibold text-primary-text">Comp Off</h3>
                <div className="flex items-center gap-1">
                    <Button variant="secondary" size="sm" className="btn-icon !p-1 h-6 w-6" onClick={() => onDateChange(subMonths(viewingDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="font-medium min-w-[80px] text-center text-xs">{format(viewingDate, 'MMMM yyyy')}</span>
                    <Button variant="secondary" size="sm" className="btn-icon !p-1 h-6 w-6" onClick={() => onDateChange(addMonths(viewingDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
            </div>

            {loading ? (
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
                        return (
                            <div key={date.toISOString()} className={`h-9 rounded flex flex-col items-center justify-center ${colorClass} transition-colors border border-transparent hover:border-border/50`} title={status === 'earned-half' ? 'Half Day Earned' : status === 'earned' ? 'Full Day Earned' : undefined}>
                                <span className="text-xs font-bold">{format(date, 'd')}</span>
                            </div>
                        );
                    })}
                </div>
            )}
            
            <div className="mt-4 pt-3 border-t border-border/50 grid grid-cols-3 gap-x-2 gap-y-2 text-[10px] text-muted-foreground uppercase font-bold tracking-tight leading-tight">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0"></div> Earned (Full)</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-300 rounded-full flex-shrink-0"></div> Earned (Half)</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div> Taken</div>
            </div>
        </div>
    );
};

export default CompOffCalendar;

