import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isAfter, startOfDay, differenceInMinutes } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { calculateWorkingHours } from '../../utils/attendanceCalculations';
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
        
        // Calculate threshold
        let staffCategory: keyof AttendanceSettings = 'field';
        const userRole = user.role.toLowerCase();
        if ([
            'admin', 'hr', 'finance', 'developer', 'management', 'office_staff', 
            'back_office_staff', 'bd', 'operation_manager', 'field_staff',
            'finance_manager', 'hr_ops', 'business developer', 'unverified',
            'operation manager', 'field staff', 'finance manager', 'hr ops'
        ].includes(userRole)) {
            staffCategory = 'office';
        } else if (['site_manager', 'site_supervisor', 'site manager', 'site supervisor'].includes(userRole)) {
            staffCategory = 'site';
        }

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
        <div className="bg-card p-5 rounded-xl shadow-card border border-border w-full md:max-w-[350px] flex flex-col min-h-[460px]">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
                <h3 className="text-sm font-semibold text-primary-text">OT Calendar</h3>
                <div className="flex items-center gap-1">
                    <Button variant="secondary" size="sm" className="btn-icon !p-1 h-6 w-6" onClick={() => onDateChange(subMonths(viewingDate, 1))}><ChevronLeft className="h-3 w-3" /></Button>
                    <span className="font-medium min-w-[80px] text-center text-sm">{format(viewingDate, 'MMMM yyyy')}</span>
                    <Button variant="secondary" size="sm" className="btn-icon !p-1 h-6 w-6" onClick={() => onDateChange(addMonths(viewingDate, 1))}><ChevronRight className="h-3 w-3" /></Button>
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
                        <div key={`empty-${i}`} className="aspect-square" />
                    ))}
                    {daysInMonth.map(date => {
                        const { hoursOT, minutesOT, hasOtPunch } = getDailyOT(date);
                        const hasHoursOT = hoursOT + minutesOT > 0;

                        // Color: orange for OT punch cycles, blue for hours-based OT, both = orange
                        const bgClass = hasOtPunch 
                            ? 'bg-orange-600 text-white border-orange-700 shadow-sm'
                            : hasHoursOT 
                                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                                : 'bg-gray-50 text-gray-400 border-gray-100';

                        return (
                            <div key={date.toISOString()} className={`aspect-square rounded border flex flex-col items-center justify-center transition-colors ${bgClass}`}>
                                <span className="text-xs font-bold">{format(date, 'd')}</span>
                                {hoursOT + minutesOT > 0 && (
                                    <span className="text-[10px] font-bold mt-1">
                                        {formatOT(hoursOT, minutesOT)}
                                    </span>
                                )}
                                {hasOtPunch && !hasHoursOT && <span className="text-[9px] font-bold">OT</span>}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between flex-shrink-0">
                <span className="text-xs text-muted font-medium">Monthly Total</span>
                <span className="text-sm font-bold text-primary-text">{monthlySummary.h}h {monthlySummary.m}m</span>
            </div>
        </div>
    );
};

export default OTCalendar;
