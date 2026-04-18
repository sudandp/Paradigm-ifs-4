import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { UserHoliday, Holiday } from '../../types';
import { FIXED_HOLIDAYS } from '../../utils/constants';
import Button from '../../components/ui/Button';
import LoadingScreen from '../../components/ui/LoadingScreen';


interface HolidayCalendarProps {
    adminHolidays: Holiday[];
    userSelectedHolidays: UserHoliday[];
    isLoading?: boolean;
    viewingDate: Date;
    onDateChange: (date: Date) => void;
}

const HolidayCalendar: React.FC<HolidayCalendarProps> = ({ adminHolidays, userSelectedHolidays, isLoading = false, viewingDate, onDateChange }) => {
    const currentYear = viewingDate.getFullYear();

    const daysInMonth = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(viewingDate),
            end: endOfMonth(viewingDate)
        });
    }, [viewingDate]);

    const getDayStatus = (date: Date) => {
        // 1. Check Fixed Common Holidays
        const isFixed = FIXED_HOLIDAYS.some(fh => {
            const datePart = fh.date.startsWith('-') ? fh.date : `-${fh.date}`;
            const fixedDate = new Date(`${currentYear}${datePart}`.replace(/-/g, '/'));
            return isSameDay(fixedDate, date);
        });
        if (isFixed) return 'fixed';

        // 2. Check Admin/HR Allocated Holidays
        const isAdminAllocated = adminHolidays.some(h => isSameDay(new Date(h.date), date));
        if (isAdminAllocated) return 'admin';

        // 3. Check User Selected Holidays
        const isUserSelected = userSelectedHolidays.some(h => {
             // holidayDate format in UserHoliday is likely YYYY-MM-DD
             return isSameDay(new Date(h.holidayDate), date);
        });
        if (isUserSelected) return 'user';

        return 'neutral';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'fixed': return 'bg-emerald-600 text-white border-emerald-700 shadow-sm'; // Green for Common
            case 'admin': return 'bg-amber-500 text-white border-amber-600 shadow-sm'; // Amber for Admin
            case 'user': return 'bg-violet-600 text-white border-violet-700 shadow-sm'; // Purple for User
            default: return 'bg-emerald-500/5 text-muted/40 border-emerald-500/10'; // Neutral
        }
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startDay = getDay(startOfMonth(viewingDate));



    return (
        <div className="rounded-xl w-full flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="text-sm font-semibold text-primary-text">Holidays</h3>
                <div className="flex items-center gap-1">
                    <Button variant="secondary" size="sm" className="btn-icon !p-1 h-6 w-6" onClick={() => onDateChange(subMonths(viewingDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="font-medium min-w-[80px] text-center text-xs">{format(viewingDate, 'MMMM yyyy')}</span>
                    <Button variant="secondary" size="sm" className="btn-icon !p-1 h-6 w-6" onClick={() => onDateChange(addMonths(viewingDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
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
                        return (
                            <div key={date.toISOString()} className={`h-9 rounded flex flex-col items-center justify-center ${colorClass} transition-colors group relative cursor-help border border-transparent hover:border-border/50`}>
                                <span className="text-xs font-bold">{format(date, 'd')}</span>
                                {status !== 'neutral' && (
                                    <div className="absolute bottom-[-30px] left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none transition-opacity">
                                        {status === 'fixed' ? 'Common Holiday' : status === 'admin' ? 'Admin Allocated' : 'User Selected'}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            
            <div className="mt-4 pt-3 border-t border-border/50 grid grid-cols-3 gap-x-2 gap-y-2 text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                <div className="flex items-center gap-1.5 justify-center"><div className="w-2 h-2 bg-emerald-600 rounded-full flex-shrink-0"></div> Gov</div>
                <div className="flex items-center gap-1.5 justify-center"><div className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0"></div> Admin</div>
                <div className="flex items-center gap-1.5 justify-center"><div className="w-2 h-2 bg-violet-600 rounded-full flex-shrink-0"></div> User</div>
            </div>
        </div>
    );
};

export default HolidayCalendar;
