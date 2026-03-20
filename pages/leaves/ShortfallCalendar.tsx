import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isSunday } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { calculateWorkingHours } from '../../utils/attendanceCalculations';
import type { AttendanceEvent, AttendanceSettings } from '../../types';
import Button from '../../components/ui/Button';

interface ShortfallCalendarProps {
    viewingDate: Date;
    onDateChange: (date: Date) => void;
    events: AttendanceEvent[];
    settings: AttendanceSettings | null;
    isLoading?: boolean;
}

const ShortfallCalendar: React.FC<ShortfallCalendarProps> = ({ viewingDate, onDateChange, events, settings, isLoading = false }) => {
    const { user } = useAuthStore();
    const targetHours = 8; // User specified 8h target for shortfall

    const daysInMonth = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(viewingDate),
            end: endOfMonth(viewingDate)
        });
    }, [viewingDate]);

    const getDailyShortfall = (date: Date) => {
        // Skip Sundays as they don't have shortfall
        if (isSunday(date)) return { shortfallMinutes: 0 };

        const dayEvents = events.filter(e => isSameDay(new Date(e.timestamp), date));
        if (dayEvents.length === 0) return { shortfallMinutes: 0 };

        const { workingHours } = calculateWorkingHours(dayEvents);
        
        // Only calculate shortfall if they actually worked something (standard logic)
        // or as per user request: if they worked less than 8h.
        const shortfallMins = Math.max(0, (targetHours * 60) - (workingHours * 60));
        
        return { 
            shortfallMinutes: shortfallMins,
            h: Math.floor(shortfallMins / 60),
            m: Math.round(shortfallMins % 60)
        };
    };

    const formatShortfall = (h: number, m: number) => {
        if (h === 0 && m === 0) return '';
        const mm = m.toString().padStart(2, '0');
        const hh = h.toString().padStart(2, '0');
        return `${hh}:${mm}`;
    };

    const monthlySummary = useMemo(() => {
        let totalMins = 0;
        const processedDays = new Set<string>();

        events.forEach(event => {
            const dateStr = format(new Date(event.timestamp), 'yyyy-MM-dd');
            if (!processedDays.has(dateStr)) {
                const { shortfallMinutes } = getDailyShortfall(new Date(event.timestamp));
                totalMins += (shortfallMinutes || 0);
                processedDays.add(dateStr);
            }
        });

        return {
            h: Math.floor(totalMins / 60),
            m: totalMins % 60,
            estimatedDeduction: (totalMins / (8 * 60)).toFixed(1)
        };
    }, [events, viewingDate]);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startDay = getDay(startOfMonth(viewingDate));

    return (
        <div className="bg-card p-5 rounded-xl shadow-card border border-border w-full md:max-w-[350px] flex flex-col min-h-[460px]">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-primary-text">Shortfall Tracker</h3>
                    <div className="group relative">
                        <AlertCircle className="h-4 w-4 text-muted cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            Shortfall based on 8h net work goal. 8h total shortfall = 1 day salary deduction.
                        </div>
                    </div>
                </div>
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
                        const { shortfallMinutes, h, m } = getDailyShortfall(date);
                        const hasShortfall = (shortfallMinutes || 0) > 0;

                        const bgClass = hasShortfall 
                            ? 'bg-red-50 text-red-600 border-red-100'
                            : 'bg-gray-50 text-gray-400 border-gray-100';

                        return (
                            <div key={date.toISOString()} className={`aspect-square rounded border flex flex-col items-center justify-center transition-colors ${bgClass}`}>
                                <span className="text-xs font-bold">{format(date, 'd')}</span>
                                {hasShortfall && (
                                    <span className="text-[9px] font-bold mt-0.5">
                                        -{formatShortfall(h!, m!)}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="mt-6 pt-4 border-t border-border space-y-2 flex-shrink-0">
                <div className="flex items-center justify-between text-red-600">
                    <span className="text-xs font-medium">Monthly Shortfall</span>
                    <span className="text-sm font-bold">{monthlySummary.h}h {monthlySummary.m}m</span>
                </div>
                <div className="flex items-center justify-between text-muted text-[10px]">
                    <span>Est. Salary Deduction</span>
                    <span className="font-bold">{monthlySummary.estimatedDeduction} Days</span>
                </div>
            </div>
        </div>
    );
};

export default ShortfallCalendar;
