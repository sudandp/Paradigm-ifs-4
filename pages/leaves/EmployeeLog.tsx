import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import type { AttendanceEvent } from '../../types';
import { Loader2, MapPin, Clock, Calendar } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { processDailyEvents } from '../../utils/attendanceCalculations';
import LoadingScreen from '../../components/ui/LoadingScreen';


type TimeRange = 'day' | 'week' | 'month';

interface GroupedAttendance {
    date: string;
    events: AttendanceEvent[];
    checkIns: AttendanceEvent[];
    checkOuts: AttendanceEvent[];
    totalWorkMinutes: number;
    totalBreakMinutes: number;
}

interface EmployeeLogProps {
    initialEvents?: AttendanceEvent[];
}

const EmployeeLog: React.FC<EmployeeLogProps> = ({ initialEvents = [] }) => {
    const { user } = useAuthStore();
    const [events, setEvents] = useState<AttendanceEvent[]>(initialEvents);
    const [isLoading, setIsLoading] = useState(initialEvents.length === 0);
    const [selectedRange, setSelectedRange] = useState<TimeRange>('day');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const isMobile = useMediaQuery('(max-width: 767px)');

    const fetchAttendanceEvents = async () => {
        if (!user) return;
        
        let startDate: Date;
        let endDate: Date;

        switch (selectedRange) {
            case 'day':
                startDate = startOfDay(selectedDate);
                endDate = endOfDay(selectedDate);
                break;
            case 'week':
                startDate = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
                endDate = endOfWeek(selectedDate, { weekStartsOn: 1 });
                break;
            case 'month':
                startDate = startOfMonth(selectedDate);
                endDate = endOfMonth(selectedDate);
                break;
        }

        // If it's the current month and we just mounted with initialEvents, skipping first fetch
        // as the parent already provided the data for the current month.
        if (initialEvents.length > 0 && selectedRange === 'month' && isSameDay(startDate, startOfMonth(new Date()))) {
            setEvents(initialEvents);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const data = await api.getAttendanceEvents(
                user.id,
                startDate.toISOString(),
                endDate.toISOString()
            );
            setEvents(data);
        } catch (error) {
            console.error('Failed to fetch attendance events:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Only fetch if we don't have events or if range/date changed
        // Exception: on first mount, if initialEvents is provided for current month, we already handled it
        fetchAttendanceEvents();
    }, [user, selectedRange, selectedDate]);

    // Update internal events if initialEvents changes (e.g. parent refetch)
    useEffect(() => {
        if (initialEvents.length > 0) {
            setEvents(initialEvents);
            setIsLoading(false);
        }
    }, [initialEvents]);

    const groupedByDate = useMemo(() => {
        const groups: Record<string, GroupedAttendance> = {};

        events.forEach((event) => {
            const dateKey = format(new Date(event.timestamp), 'yyyy-MM-dd');
            if (!groups[dateKey]) {
                groups[dateKey] = {
                    date: dateKey,
                    events: [],
                    checkIns: [],
                    checkOuts: [],
                    totalWorkMinutes: 0,
                    totalBreakMinutes: 0
                };
            }
            groups[dateKey].events.push(event);
            if (event.type === 'punch-in') {
                groups[dateKey].checkIns.push(event);
            } else if (event.type === 'punch-out') {
                groups[dateKey].checkOuts.push(event);
            }
        });

        // Calculate total worked time and break time for each day
        Object.values(groups).forEach((group) => {
            const { totalHours, breakHours } = processDailyEvents(group.events);
            // processDailyEvents returns hours, convert to minutes for display formatting
            group.totalWorkMinutes = (totalHours * 60) - (breakHours * 60);
            group.totalBreakMinutes = breakHours * 60;
        });

        return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
    }, [events]);

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    const handleRangeChange = (range: TimeRange) => {
        setSelectedRange(range);
    };

    const handleDateChange = (direction: 'prev' | 'next') => {
        const newDate = new Date(selectedDate);
        switch (selectedRange) {
            case 'day':
                newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
                break;
            case 'week':
                newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
                break;
            case 'month':
                newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
                break;
        }
        setSelectedDate(newDate);
    };

    const getDateRangeText = () => {
        switch (selectedRange) {
            case 'day':
                return format(selectedDate, 'dd MMM, yyyy');
            case 'week':
                const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
                const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
                return `${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM, yyyy')}`;
            case 'month':
                return format(selectedDate, 'MMMM yyyy');
        }
    };

    if (!user) return null;



    return (
        <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card w-full">
            <div className="flex items-center gap-3 mb-5">
                <div className="p-1.5 bg-indigo-50 rounded-lg">
                    <Clock className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900">Employee Log</h3>
            </div>

            {/* Filter Controls */}
            <div className="mb-6 space-y-4">
                {/* Range Selector */}
                <div className="flex gap-2">
                    <button
                        onClick={() => handleRangeChange('day')}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${selectedRange === 'day'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Day
                    </button>
                    <button
                        onClick={() => handleRangeChange('week')}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${selectedRange === 'week'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Week
                    </button>
                    <button
                        onClick={() => handleRangeChange('month')}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${selectedRange === 'month'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Month
                    </button>
                </div>

                {/* Date Navigator */}
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <button
                        onClick={() => handleDateChange('prev')}
                        className="px-3 py-1 bg-white rounded-md shadow-sm hover:bg-gray-100 transition-colors"
                    >
                        ←
                    </button>
                    <div className="flex items-center gap-2 font-semibold text-gray-900">
                        <Calendar className="h-4 w-4" />
                        <span>{getDateRangeText()}</span>
                    </div>
                    <button
                        onClick={() => handleDateChange('next')}
                        className="px-3 py-1 bg-white rounded-md shadow-sm hover:bg-gray-100 transition-colors"
                    >
                        →
                    </button>
                </div>
            </div>

            {/* Attendance Log */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    </div>
                ) : groupedByDate.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="font-medium">No attendance records found</p>
                        <p className="text-sm mt-1">Check-in to start tracking your attendance</p>
                    </div>
                ) : (
                    groupedByDate.map((group) => (
                        <div
                            key={group.date}
                            className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 overflow-hidden"
                        >
                            {/* Date Header */}
                            <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 flex justify-between items-center">
                                <div className="flex items-center gap-2 text-white">
                                    <Calendar className="h-4 w-4" />
                                    <span className="font-semibold">
                                        {format(new Date(group.date), 'EEEE, dd MMMM yyyy')}
                                    </span>
                                </div>
                                <div className="flex gap-3">
                                    <div className="text-white text-xs font-medium bg-emerald-500/20 border border-emerald-400/30 px-2 py-1 rounded-md flex items-center gap-1">
                                        <span className="opacity-75">Work:</span> {formatDuration(group.totalWorkMinutes)}
                                    </div>
                                    <div className="text-white text-xs font-medium bg-amber-500/20 border border-amber-400/30 px-2 py-1 rounded-md flex items-center gap-1">
                                        <span className="opacity-75">Break:</span> {formatDuration(group.totalBreakMinutes)}
                                    </div>
                                </div>
                            </div>

                            {/* Events List */}
                            <div className="p-4 space-y-3">
                                {group.events
                                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                                    .map((event, index) => (
                                        <div
                                            key={`${event.timestamp}-${index}`}
                                            className={`p-3 rounded-lg border-l-4 ${
                                                event.type === 'punch-in' ? 'bg-emerald-50 border-emerald-500' :
                                                event.type === 'punch-out' ? 'bg-rose-50 border-rose-500' :
                                                event.type === 'break-in' ? 'bg-amber-50 border-amber-500' :
                                                'bg-sky-50 border-sky-500'
                                            }`}
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`p-2 rounded-lg ${
                                                            event.type === 'punch-in' ? 'bg-emerald-100 text-emerald-700' :
                                                            event.type === 'punch-out' ? 'bg-rose-100 text-rose-700' :
                                                            event.type === 'break-in' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-sky-100 text-sky-700'
                                                        }`}
                                                    >
                                                        <Clock className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <div className={`font-semibold capitalize ${
                                                            event.type === 'punch-in' ? 'text-emerald-900' :
                                                            event.type === 'punch-out' ? 'text-rose-900' :
                                                            event.type === 'break-in' ? 'text-amber-900' :
                                                            'text-sky-900'
                                                        }`}>
                                                            {event.type === 'punch-in' ? (event.workType === 'field' ? 'Check In' : 'Punch In') :
                                                             event.type === 'punch-out' ? (event.workType === 'field' ? 'Check Out' : 'Punch Out') :
                                                             event.type.replace('-', ' ')}
                                                        </div>
                                                        <div className={`text-sm font-medium ${
                                                            event.type === 'punch-in' ? 'text-emerald-700' :
                                                            event.type === 'punch-out' ? 'text-rose-700' :
                                                            event.type === 'break-in' ? 'text-amber-700' :
                                                            'text-sky-700'
                                                        }`}>
                                                            {format(new Date(event.timestamp), 'hh:mm a')}
                                                        </div>
                                                    </div>
                                                </div>
                                                {(event.locationName || (event.latitude && event.longitude)) && (
                                                    <div className="flex items-start gap-2 text-sm bg-white max-md:bg-[#041b0f] px-3 py-1.5 rounded-lg border border-gray-200 max-md:border-white/10 max-w-md">
                                                        <MapPin className="h-4 w-4 text-indigo-400 max-md:text-emerald-400 md:text-indigo-600 flex-shrink-0 mt-0.5" />
                                                        <span className="text-xs break-words text-gray-700 max-md:text-gray-200">
                                                            {event.locationName || `${event.latitude?.toFixed(4)}, ${event.longitude?.toFixed(4)}`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>

                            {/* Summary Footer */}
                            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                                    <div className="flex items-center">
                                        <span className="text-gray-500">Punch Ins:</span>
                                        <span className="ml-1 font-bold text-emerald-600">{group.checkIns.length}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="text-gray-500">Punch Outs:</span>
                                        <span className="ml-1 font-bold text-rose-600">{group.checkOuts.length}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="text-gray-500">Breaks In:</span>
                                        <span className="ml-1 font-bold text-amber-600">
                                            {group.events.filter(e => e.type === 'break-in').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="text-gray-500">Breaks Out:</span>
                                        <span className="ml-1 font-bold text-sky-600">
                                            {group.events.filter(e => e.type === 'break-out').length}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default EmployeeLog;
