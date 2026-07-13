import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import type { AttendanceEvent } from '../../types';
import { Loader2, MapPin, Clock, Calendar, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { processDailyEvents } from '../../utils/attendanceCalculations';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { reverseGeocode } from '../../utils/locationUtils';
import { buildAttendanceDayKeyByEventId } from '../../utils/attendanceDayGrouping';
import { isAdmin } from '../../utils/auth';

const AddressResolver: React.FC<{ lat: number; lng: number; fallback?: string | null }> = ({ lat, lng, fallback }) => {
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const resolve = async () => {
            if (!lat || !lng) {
                setResolvedAddress(fallback || null);
                return;
            }
            try {
                setLoading(true);
                const address = await reverseGeocode(lat, lng);
                setResolvedAddress(address);
            } catch (err) {
                setResolvedAddress(fallback || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            } finally {
                setLoading(false);
            }
        };
        resolve();
    }, [lat, lng, fallback]);

    if (loading) return <span className="animate-pulse text-indigo-400 font-medium">Resolving address...</span>;
    return <span>{resolvedAddress || fallback || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</span>;
};

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
    const { user, isCheckedIn, dailyPunchCount } = useAuthStore();
    const [events, setEvents] = useState<AttendanceEvent[]>(initialEvents);
    const [isLoading, setIsLoading] = useState(initialEvents.length === 0);
    const [selectedRange, setSelectedRange] = useState<TimeRange>('day');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
    const canDelete = user && isAdmin(user.role);

    const fetchAttendanceEvents = async () => {
        if (!user) return;
        
        let startDate: Date;
        let endDate: Date;

        switch (selectedRange) {
            case 'day':
                // Expand 12 hours back to catch night shift starts, 36 hours forward to catch ends
                startDate = new Date(startOfDay(selectedDate).getTime() - 12 * 60 * 60 * 1000);
                endDate = new Date(endOfDay(selectedDate).getTime() + 36 * 60 * 60 * 1000);
                break;
            case 'week':
                // Expand 12 hours back to catch night shift starts, 36 hours forward for the week range
                startDate = new Date(startOfWeek(selectedDate, { weekStartsOn: 1 }).getTime() - 12 * 60 * 60 * 1000);
                endDate = new Date(endOfWeek(selectedDate, { weekStartsOn: 1 }).getTime() + 36 * 60 * 60 * 1000);
                break;
            case 'month':
                // Expand 12 hours back to catch night shift starts, 36 hours forward for the month range
                startDate = new Date(startOfMonth(selectedDate).getTime() - 12 * 60 * 60 * 1000);
                endDate = new Date(endOfMonth(selectedDate).getTime() + 36 * 60 * 60 * 1000);
                break;
        }

        // If it's the current month and we just mounted with initialEvents, skipping first fetch
        // as the parent already provided the data for the current month.
        if (initialEvents.length > 0 && selectedRange === 'month' && isSameDay(startDate, startOfMonth(new Date()))) {
            setEvents(initialEvents);
            setIsLoading(false);
            return;
        }

        // ── Cache-first: render cached data instantly while live fetch runs ──
        const cacheKey = `attendance_${user.id}_${startDate.toISOString().split('T')[0]}`;
        try {
            const cachedEventsStr = localStorage.getItem(cacheKey);
            const cachedEvents = cachedEventsStr ? JSON.parse(cachedEventsStr) : null;
            if (cachedEvents && Array.isArray(cachedEvents) && cachedEvents.length > 0) {
                setEvents(cachedEvents);
                setIsLoading(false);
            }
        } catch (cacheErr) {
            // Cache miss is fine — we'll fetch live data below
        }

        // Only show loading spinner if no cached data is available
        if (events.length === 0 && initialEvents.length === 0) {
            setIsLoading(true);
        }

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
    }, [user, selectedRange, selectedDate, isCheckedIn, dailyPunchCount]);

    // Update internal events if initialEvents changes (e.g. parent refetch)
    useEffect(() => {
        if (initialEvents.length > 0) {
            setEvents(initialEvents);
            setIsLoading(false);
        }
    }, [initialEvents]);

    const groupedByDate = useMemo(() => {
        const groups: Record<string, GroupedAttendance> = {};
        const dayKeyById = buildAttendanceDayKeyByEventId(events);

        events.forEach((event) => {
            const dateKey = dayKeyById[event.id] || format(new Date(event.timestamp), 'yyyy-MM-dd');
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
            const { totalHours, breakHours } = processDailyEvents(group.events, new Date(group.date));
            // processDailyEvents returns hours, convert to minutes for display formatting
            group.totalWorkMinutes = (totalHours * 60) - (breakHours * 60);
            group.totalBreakMinutes = breakHours * 60;
        });

        // Filter groups to only show those that fall within the selected range's BUSINESS day(s)
        const finalGroups = Object.values(groups).filter(group => {
            const groupDate = new Date(group.date);
            let filterStart: Date;
            let filterEnd: Date;

            switch (selectedRange) {
                case 'day':
                    filterStart = startOfDay(selectedDate);
                    filterEnd = endOfDay(selectedDate);
                    break;
                case 'week':
                    filterStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
                    filterEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
                    break;
                case 'month':
                    filterStart = startOfMonth(selectedDate);
                    filterEnd = endOfMonth(selectedDate);
                    break;
                default:
                    return true;
            }

            // A group is included if its start date is within the selected range
            return groupDate >= filterStart && groupDate <= filterEnd;
        });

        return finalGroups.sort((a, b) => b.date.localeCompare(a.date));
    }, [events, selectedRange, selectedDate]);

    const formatDuration = (minutes: number) => {
        const roundedMins = Math.round(minutes);
        const hours = Math.floor(roundedMins / 60);
        const mins = roundedMins % 60;
        return `${hours}h ${mins}m`;
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (!window.confirm('Delete this attendance record? This cannot be undone.')) return;
        setDeletingEventId(eventId);
        try {
            await api.deleteAttendanceEvent(eventId);
            setEvents(prev => prev.filter(e => e.id !== eventId));
        } catch (err) {
            alert('Failed to delete record. Please try again.');
        } finally {
            setDeletingEventId(null);
        }
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

    const monthlyMissedPunches = useMemo(() => {
        let count = 0;
        groupedByDate.forEach(group => {
            group.events.forEach(e => {
                if (e.checkoutNote && e.checkoutNote.includes('user clicked for punch out with out applying correction this is the record of punch out')) {
                    count++;
                }
            });
        });
        return count;
    }, [groupedByDate]);

    return (
        <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card w-full">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-50 rounded-lg">
                        <Clock className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h2 className="text-base font-semibold text-slate-800">Employee Log</h2>
                </div>
                {selectedRange === 'month' && monthlyMissedPunches > 0 && (
                    <div className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5 border border-rose-100">
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                        </span>
                        Auto-closed missed punches this month: {monthlyMissedPunches}
                    </div>
                )}
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
                        className="p-1.5 bg-white rounded-md shadow-sm hover:bg-gray-100 transition-colors flex items-center justify-center border border-gray-200"
                    >
                        <ChevronLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <div className="flex items-center gap-2 font-semibold text-gray-900">
                        <Calendar className="h-4 w-4" />
                        <span>{getDateRangeText()}</span>
                    </div>
                    <button
                        onClick={() => handleDateChange('next')}
                        className="p-1.5 bg-white rounded-md shadow-sm hover:bg-gray-100 transition-colors flex items-center justify-center border border-gray-200"
                    >
                        <ChevronRight className="h-5 w-5 text-gray-600" />
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
                            <div className="bg-[#5a54f9] px-3 md:px-4 py-3 flex justify-between items-center">
                                <div className="flex items-center gap-2.5 text-white">
                                    <Calendar className="h-4 w-4 opacity-75" />
                                    <div className="font-bold leading-[1.15] flex flex-col">
                                        <span className="text-[13px]">{format(new Date(group.date), 'EEEE, d')}</span>
                                        <span className="text-[13px]">{format(new Date(group.date), 'MMMM yyyy')}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="text-white bg-white/10 px-2 py-1 rounded-lg flex items-center gap-1.5 justify-center shadow-sm">
                                        <span className="opacity-90 text-[11px] font-medium tracking-wide">Work:</span> 
                                        <div className="flex flex-col leading-[1.1] text-[11px] font-bold text-right">
                                            <span>{Math.floor(Math.round(group.totalWorkMinutes) / 60)}h</span>
                                            <span>{Math.round(group.totalWorkMinutes) % 60}m</span>
                                        </div>
                                    </div>
                                    <div className="text-white bg-black/10 px-2 py-1 rounded-lg flex items-center gap-1.5 justify-center shadow-sm">
                                        <span className="opacity-80 text-[11px] font-medium tracking-wide">Break:</span> 
                                        <div className="flex flex-col leading-[1.1] text-[11px] font-bold text-right">
                                            <span>{Math.floor(Math.round(group.totalBreakMinutes) / 60)}h</span>
                                            <span>{Math.round(group.totalBreakMinutes) % 60}m</span>
                                        </div>
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
                                                (event.type === 'punch-in' || event.type === 'site-ot-in') ? 'bg-emerald-50 border-emerald-500' :
                                                (event.type === 'punch-out' || event.type === 'site-ot-out') ? 'bg-rose-50 border-rose-500' :
                                                event.type === 'break-in' ? 'bg-amber-50 border-amber-500' :
                                                event.type.includes('site-ot') ? 'bg-indigo-50 border-indigo-500' :
                                                'bg-sky-50 border-sky-500'
                                            }`}
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`p-2 rounded-lg ${
                                                            (event.type === 'punch-in' || event.type === 'site-ot-in') ? 'bg-emerald-100 text-emerald-700' :
                                                            (event.type === 'punch-out' || event.type === 'site-ot-out') ? 'bg-rose-100 text-rose-700' :
                                                            event.type === 'break-in' ? 'bg-amber-100 text-amber-700' :
                                                            event.type.includes('site-ot') ? 'bg-indigo-100 text-indigo-700' :
                                                            'bg-sky-100 text-sky-700'
                                                        }`}
                                                    >
                                                        <Clock className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <div className={`font-semibold capitalize ${
                                                            (event.type === 'punch-in' || event.type === 'site-ot-in') ? 'text-emerald-900' :
                                                            (event.type === 'punch-out' || event.type === 'site-ot-out') ? 'text-rose-900' :
                                                            event.type === 'break-in' ? 'text-amber-900' :
                                                            event.type.includes('site-ot') ? 'text-indigo-900' :
                                                            'text-sky-900'
                                                        }`}>
                                                            {event.type === 'punch-in' ? (event.workType === 'field' ? 'Site Check In' : 'Punch In') :
                                                             event.type === 'punch-out' ? (event.workType === 'field' ? 'Site Check Out' : 'Punch Out') :
                                                             event.type === 'site-ot-in' ? 'Site OT In' :
                                                             event.type === 'site-ot-out' ? 'Site OT Out' :
                                                             event.type.replace('-', ' ')}
                                                        </div>
                                                        <div className={`text-sm font-medium ${
                                                            (event.type === 'punch-in' || event.type === 'site-ot-in') ? 'text-emerald-700' :
                                                            (event.type === 'punch-out' || event.type === 'site-ot-out') ? 'text-rose-700' :
                                                            event.type === 'break-in' ? 'text-amber-700' :
                                                            event.type.includes('site-ot') ? 'text-indigo-700' :
                                                            'text-sky-700'
                                                        }`}>
                                                            {format(new Date(event.timestamp), 'hh:mm a')}
                                                        </div>
                                                        {event.checkoutNote && (
                                                            <div className="text-[11px] font-medium text-slate-500 italic mt-1 max-w-[280px] leading-tight">
                                                                Note: "{event.checkoutNote.replace(/\[SessionDate:\s*[^\]]+\]/g, '').trim()}"
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {(event.locationName || (event.latitude && event.longitude)) && (
                                                    <div className="flex items-start gap-2 text-sm bg-white max-md:bg-[#041b0f] px-3 py-1.5 rounded-lg border border-gray-200 max-md:border-white/10 max-w-md">
                                                        <MapPin className="h-4 w-4 text-indigo-400 max-md:text-emerald-400 md:text-indigo-600 flex-shrink-0 mt-0.5" />
                                                        <span className="text-xs break-words text-gray-700 max-md:text-gray-200">
                                                            {event.locationName ? (
                                                                event.locationName
                                                            ) : (
                                                                <AddressResolver 
                                                                    lat={event.latitude!} 
                                                                    lng={event.longitude!} 
                                                                />
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                                {event.source === 'auto_system' && (
                                                    <div className="flex items-start gap-2 text-sm bg-rose-50 max-md:bg-[#2c0e15] px-3 py-1.5 rounded-lg border border-rose-200 max-md:border-rose-900/50 max-w-md mt-2 md:mt-0">
                                                        <Clock className="h-4 w-4 text-rose-400 max-md:text-rose-500 md:text-rose-600 flex-shrink-0 mt-0.5" />
                                                        <span className="text-xs break-words text-rose-700 max-md:text-rose-300 font-medium">
                                                            Auto punched out By Paradigm AI Agent
                                                        </span>
                                                    </div>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDeleteEvent(event.id)}
                                                        disabled={deletingEventId === event.id}
                                                        title="Delete this record"
                                                        className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                                                    >
                                                        {deletingEventId === event.id
                                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                                            : <Trash2 className="h-4 w-4" />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>

                            {/* Summary Footer */}
                            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                    <div className="flex items-center">
                                        <span className="text-gray-500">Punch Ins:</span>
                                        <span className="ml-1 font-bold text-emerald-600">
                                            {group.events.filter(e => e.type === 'punch-in' && e.workType !== 'field').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="text-gray-500">Punch Outs:</span>
                                        <span className="ml-1 font-bold text-rose-600">
                                            {group.events.filter(e => e.type === 'punch-out' && e.workType !== 'field').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="text-gray-500">Site Check Ins:</span>
                                        <span className="ml-1 font-bold text-emerald-600">
                                            {group.events.filter(e => (e.type === 'punch-in' && e.workType === 'field') || e.type === 'site-in').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="text-gray-500">Site Check Outs:</span>
                                        <span className="ml-1 font-bold text-rose-600">
                                            {group.events.filter(e => (e.type === 'punch-out' && e.workType === 'field') || e.type === 'site-out').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="text-gray-500">Site OT In:</span>
                                        <span className="ml-1 font-bold text-indigo-600">
                                            {group.events.filter(e => e.type === 'site-ot-in').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="text-gray-500">Site OT Out:</span>
                                        <span className="ml-1 font-bold text-indigo-600">
                                            {group.events.filter(e => e.type === 'site-ot-out').length}
                                        </span>
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
