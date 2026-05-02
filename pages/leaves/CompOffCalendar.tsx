import React, { useState, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { CompOffLog, LeaveRequest, AttendanceEvent, UserHoliday } from '../../types';
import { FIXED_HOLIDAYS, HOLIDAY_SELECTION_POOL } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getStaffCategory } from '../../utils/attendanceCalculations';
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
        const staffCategory = getStaffCategory(user?.roleId || user?.role || '', user?.organizationId, { missedCheckoutConfig: attendance?.missedCheckoutConfig });
        const activePool = (attendance as any)?.[staffCategory]?.holidayPool || HOLIDAY_SELECTION_POOL;

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

        if (hasCompOffLog) return 'earned';

        // 3. Check for earned comp-offs from attendance (worked on holiday/Sunday)
        const hasCheckIn = events.some(e => 
            isSameDay(new Date(e.timestamp), date) && 
            (e.type.toLowerCase().includes('check') || e.type.toLowerCase().includes('in'))
        );

        if (hasCheckIn) {
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

            // If worked on any type of holiday, it's earned comp-off
            if (isFixedHoliday || isPoolHoliday || isConfiguredHoliday) {
                return 'earned';
            }
        }

        return 'neutral';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'earned': return 'bg-emerald-500 text-white border-emerald-600 shadow-sm'; // Green for Earned
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
                            <div key={date.toISOString()} className={`h-9 rounded flex flex-col items-center justify-center ${colorClass} transition-colors border border-transparent hover:border-border/50`}>
                                <span className="text-xs font-bold">{format(date, 'd')}</span>
                            </div>
                        );
                    })}
                </div>
            )}
            
            <div className="mt-4 pt-3 border-t border-border/50 grid grid-cols-2 gap-x-2 gap-y-2 text-[10px] text-muted-foreground uppercase font-bold tracking-tight leading-tight">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0"></div> Earned</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div> Taken</div>
            </div>
        </div>
    );
};

export default CompOffCalendar;

