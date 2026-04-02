import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isAfter, startOfDay, differenceInMinutes } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { calculateWorkingHours, getStaffCategory } from '../../utils/attendanceCalculations';
import { api } from '../../services/api';
import type { AttendanceEvent, AttendanceSettings } from '../../types';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';


interface OTCalendarProps {
    viewingDate: Date;
    onDateChange: (date: Date) => void;
    events: AttendanceEvent[];
    settings: AttendanceSettings | null;
    isLoading?: boolean;
}

const OTCalendar: React.FC<OTCalendarProps> = ({ viewingDate, onDateChange, events, settings, isLoading = false }) => {
    const { user } = useAuthStore();
    const [threshold, setThreshold] = useState(8);

    useEffect(() => {
        if (!settings || !user) return;
        
        // Calculate threshold using new unified config-based logic
        const staffCategory = getStaffCategory(user.roleId || user.role, user.organizationId, settings);

        const rules = settings[staffCategory];
        const shiftMax = rules?.dailyWorkingHours?.max || 8;
        setThreshold(shiftMax);
    }, [user, settings]);

    // No internal fetching needed as events are passed via props

    const daysInMonth = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(viewingDate),
            end: endOfMonth(viewingDate)
        });
    }, [viewingDate]);

    /** Calculate hours-based OT (working > threshold in a day, subtracting breaks) */
    const getDailyOT = (date: Date) => {
        const dayEvents = events.filter(e => isSameDay(new Date(e.timestamp), date));

        if (dayEvents.length === 0) return { hoursOT: 0, hasOtPunch: false };

        const { workingHours } = calculateWorkingHours(dayEvents);
        const hasOtPunch = dayEvents.some(e => e.type === 'punch-in' && e.isOt);

        const otMinutes = Math.max(0, (workingHours * 60) - (threshold * 60));
        
        return { 
            hoursOT: Math.floor(otMinutes / 60), 
            minutesOT: Math.round(otMinutes % 60), 
            hasOtPunch 
        };
    };

    const formatOT = (h: number, m: number) => {
        if (h === 0 && m === 0) return '';
        const mm = m.toString().padStart(2, '0');
        const hh = h.toString().padStart(2, '0');
        return `${hh}:${mm}`;
    };

    // Calculate monthly summary from events to ensure UI consistency
    const monthlySummary = useMemo(() => {
        let totalMins = 0;
        const processedDays = new Set<string>();

        events.forEach(event => {
            const dateStr = format(new Date(event.timestamp), 'yyyy-MM-dd');
            if (!processedDays.has(dateStr)) {
                const { hoursOT, minutesOT } = getDailyOT(new Date(event.timestamp));
                totalMins += (hoursOT * 60) + minutesOT;
                processedDays.add(dateStr);
            }
        });

        return {
            h: Math.floor(totalMins / 60),
            m: totalMins % 60,
            totalMins
        };
    }, [events, threshold]);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startDay = getDay(startOfMonth(viewingDate));



    return (
        <div className="bg-card p-3 rounded-xl shadow-card border border-border w-full md:max-w-[260px] flex flex-col h-full">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h3 className="text-xs font-semibold text-primary-text">Overtime</h3>
                <div className="flex items-center gap-1">
                    <Button variant="secondary" size="sm" className="btn-icon !p-0.5 h-5 w-5" onClick={() => onDateChange(subMonths(viewingDate, 1))}><ChevronLeft className="h-3 w-3" /></Button>
                    <span className="font-medium min-w-[70px] text-center text-[10px]">{format(viewingDate, 'MMM yyyy')}</span>
                    <Button variant="secondary" size="sm" className="btn-icon !p-0.5 h-5 w-5" onClick={() => onDateChange(addMonths(viewingDate, 1))}><ChevronRight className="h-3 w-3" /></Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted" /></div>
            ) : (
                <div className="grid grid-cols-7 gap-0.5 flex-1">
                    {weekDays.map(d => (
                        <div key={d} className="text-center text-[8px] font-bold text-muted uppercase tracking-wider py-0.5">{d}</div>
                    ))}
                    {Array.from({ length: startDay }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-7" />
                    ))}
                    {daysInMonth.map(date => {
                        const { hoursOT, minutesOT, hasOtPunch } = getDailyOT(date);
                        const hasHoursOT = hoursOT + minutesOT > 0;

                        const bgClass = hasOtPunch 
                            ? 'bg-orange-600 text-white border-orange-700 shadow-sm'
                            : hasHoursOT 
                                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                                : 'bg-gray-50 text-gray-400 border-gray-100';

                        return (
                            <div key={date.toISOString()} className={`h-7 rounded flex flex-col items-center justify-center transition-colors ${bgClass}`}>
                                <span className="text-[10px] font-bold">{format(date, 'd')}</span>
                                {hoursOT + minutesOT > 0 && (
                                    <span className="text-[8px] font-bold">
                                        {formatOT(hoursOT, minutesOT)}
                                    </span>
                                )}
                                {hasOtPunch && !hasHoursOT && <span className="text-[7px] font-bold">OT</span>}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between flex-shrink-0">
                <span className="text-[10px] text-muted font-medium">Monthly Total</span>
                <span className="text-xs font-bold text-primary-text">{monthlySummary.h}h {monthlySummary.m}m</span>
            </div>
        </div>
    );
};

export default OTCalendar;
