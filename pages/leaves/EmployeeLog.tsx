import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import type { AttendanceEvent } from '../../types';
import { Loader2, MapPin, Clock, Calendar, ChevronLeft, ChevronRight, Trash2, AlertTriangle, Home } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { processDailyEvents } from '../../utils/attendanceCalculations';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { reverseGeocode, resolveLocationName, resolveLocationNameSync, findRegisteredSiteDistance } from '../../utils/locationUtils';
import { buildAttendanceDayKeyByEventId } from '../../utils/attendanceDayGrouping';
import { isAdmin } from '../../utils/auth';

const AddressResolver: React.FC<{ lat?: number; lng?: number; fallback?: string | null; userLocations?: any[] }> = ({ lat, lng, fallback, userLocations }) => {
    const { user } = useAuthStore();
    const syncName = resolveLocationNameSync(lat, lng, fallback, user, userLocations);
    const initialText = syncName || (fallback && !/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(fallback.trim()) 
        ? fallback 
        : (lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : null));

    const [resolvedAddress, setResolvedAddress] = useState<string | null>(initialText);

    useEffect(() => {
        let isMounted = true;
        const resolve = async () => {
            try {
                const name = await resolveLocationName(lat, lng, fallback, user, userLocations);
                if (isMounted && name) {
                    setResolvedAddress(name);
                }
            } catch (err) {
                if (isMounted) {
                    setResolvedAddress(syncName || fallback || (lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : null));
                }
            }
        };
        resolve();
        return () => { isMounted = false; };
    }, [lat, lng, fallback, user, userLocations, syncName]);

    // Show clean address by default when loading without flicker or placeholder text
    return <span>{resolvedAddress || syncName || fallback || (lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : '')}</span>;
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
    const [userLocations, setUserLocations] = useState<any[]>([]);

    useEffect(() => {
        if (!user?.id) return;
        Promise.all([
            api.getUserLocations(user.id).catch(() => []),
            api.getLocations().catch(() => [])
        ]).then(([userLocs, allLocs]) => {
            const combined = [...(userLocs || []), ...(allLocs || [])];
            const unique = combined.filter((loc, index, self) => 
                index === self.findIndex(l => l.id === loc.id || (l.latitude === loc.latitude && l.longitude === loc.longitude))
            );
            setUserLocations(unique);
        });
    }, [user?.id]);

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
        fetchAttendanceEvents();

        const handleResume = () => {
            console.log('[EmployeeLog] App resumed from background — refreshing log events...');
            fetchAttendanceEvents();
        };

        window.addEventListener('app-resumed-refresh', handleResume);
        const handleVis = () => {
            if (document.visibilityState === 'visible') handleResume();
        };
        document.addEventListener('visibilitychange', handleVis);

        return () => {
            window.removeEventListener('app-resumed-refresh', handleResume);
            document.removeEventListener('visibilitychange', handleVis);
        };
    }, [user, selectedRange, selectedDate, isCheckedIn, dailyPunchCount]);

    // Update internal events if initialEvents changes (e.g. parent refetch).
    // ONLY apply when viewing the current month in month-range mode.
    // In day/week mode, each range triggers its own fresh fetch — applying
    // the parent's month-level snapshot here would clobber the fresh data
    // (e.g. auto punch-outs added after the parent's last fetch would disappear).
    useEffect(() => {
        const isCurrentMonth = isSameDay(startOfMonth(selectedDate), startOfMonth(new Date()));
        if (initialEvents.length > 0 && selectedRange === 'month' && isCurrentMonth) {
            setEvents(initialEvents);
            setIsLoading(false);
        }
    }, [initialEvents, selectedRange, selectedDate]);

    // Deduplicate any repeated events that occur within 2 minutes of each other with identical type
    const deduplicatedEvents = useMemo(() => {
        if (!events || events.length === 0) return [];
        const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const result: AttendanceEvent[] = [];

        for (const ev of sorted) {
            const evTime = new Date(ev.timestamp).getTime();
            const isDuplicate = result.some(existing => {
                if (existing.type !== ev.type) return false;
                const existingTime = new Date(existing.timestamp).getTime();
                const diffSec = Math.abs(evTime - existingTime) / 1000;
                return diffSec <= 120;
            });

            if (!isDuplicate) {
                result.push(ev);
            }
        }
        return result;
    }, [events]);

    const groupedByDate = useMemo(() => {
        const groups: Record<string, GroupedAttendance> = {};
        const dayKeyById = buildAttendanceDayKeyByEventId(deduplicatedEvents);

        deduplicatedEvents.forEach((event) => {
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
    }, [deduplicatedEvents, selectedRange, selectedDate]);

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

    const getDateRangeText = () => {
        switch (selectedRange) {
            case 'day':
                return format(selectedDate, 'dd MMM, yyyy');
            case 'week': {
                const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
                const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
                return `${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM, yyyy')}`;
            }
            case 'month':
                return format(selectedDate, 'MMMM yyyy');
        }
    };

    if (!user) return null;

    return (
        <div className="border-0 shadow-none md:bg-card md:p-6 md:rounded-xl md:shadow-card w-full">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-50 max-md:bg-indigo-950/60 rounded-lg">
                        <Clock className="w-5 h-5 text-indigo-600 max-md:text-indigo-400" />
                    </div>
                    <h2 className="text-base font-semibold text-slate-800 max-md:text-white">Employee Log</h2>
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
            <div className="mb-6 space-y-3">
                {/* Range Selector */}
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                    <button
                        onClick={() => handleRangeChange('day')}
                        className={`flex-1 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${selectedRange === 'day'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                    >
                        Day
                    </button>
                    <button
                        onClick={() => handleRangeChange('week')}
                        className={`flex-1 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${selectedRange === 'week'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                    >
                        Week
                    </button>
                    <button
                        onClick={() => handleRangeChange('month')}
                        className={`flex-1 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${selectedRange === 'month'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                    >
                        Month
                    </button>
                </div>

                {/* Date Navigator */}
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-2xs">
                    <button
                        onClick={() => handleDateChange('prev')}
                        className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center justify-center text-slate-700 dark:text-slate-300 cursor-pointer"
                        title="Previous"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white">
                        <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>{getDateRangeText()}</span>
                    </div>
                    <button
                        onClick={() => handleDateChange('next')}
                        className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center justify-center text-slate-700 dark:text-slate-300 cursor-pointer"
                        title="Next"
                    >
                        <ChevronRight className="h-4 w-4" />
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
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden"
                        >
                            {/* Date Header */}
                            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-4 py-3 flex justify-between items-center text-white shadow-sm">
                                <div className="flex items-center gap-2.5">
                                    <Calendar className="h-4 w-4 text-emerald-100" />
                                    <div className="font-bold leading-tight flex flex-col">
                                        <span className="text-sm font-extrabold">{format(new Date(group.date), 'EEEE, d')}</span>
                                        <span className="text-xs text-emerald-100 font-semibold">{format(new Date(group.date), 'MMMM yyyy')}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="bg-white/20 border border-white/30 text-white px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
                                        <span className="text-[11px] font-medium text-emerald-100">Work:</span> 
                                        <span className="text-xs font-extrabold">{Math.floor(Math.round(group.totalWorkMinutes) / 60)}h {Math.round(group.totalWorkMinutes) % 60}m</span>
                                    </div>
                                    <div className="bg-black/25 border border-white/20 text-white px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
                                        <span className="text-[11px] font-medium text-slate-200">Break:</span> 
                                        <span className="text-xs font-extrabold">{Math.floor(Math.round(group.totalBreakMinutes) / 60)}h {Math.round(group.totalBreakMinutes) % 60}m</span>
                                    </div>
                                </div>
                            </div>

                             {/* Events List */}
                            <div className="p-3.5 md:p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
                                {(() => {
                                    const sortedEvents = [...group.events].sort(
                                        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                                    );

                                    return sortedEvents.map((event, index) => {
                                        const distInfo = findRegisteredSiteDistance(
                                            event.latitude,
                                            event.longitude,
                                            sortedEvents,
                                            userLocations,
                                            user
                                        );

                                        // Calculate duration for breaks and work sessions
                                        let durationBadge: { text: string; bgClass: string; textClass: string } | null = null;
                                        if (event.type === 'break-out') {
                                            const prevBreakIn = sortedEvents
                                                .slice(0, index)
                                                .reverse()
                                                .find(e => e.type === 'break-in');
                                            if (prevBreakIn) {
                                                const diffMins = Math.max(
                                                    1,
                                                    Math.round(
                                                        (new Date(event.timestamp).getTime() -
                                                            new Date(prevBreakIn.timestamp).getTime()) /
                                                            60000
                                                    )
                                                );
                                                const hrs = Math.floor(diffMins / 60);
                                                const mins = diffMins % 60;
                                                const durText = hrs > 0 ? `${hrs}h ${mins}m break` : `${mins}m break`;
                                                durationBadge = {
                                                    text: durText,
                                                    bgClass: 'bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60',
                                                    textClass: 'text-amber-900 dark:text-amber-200'
                                                };
                                            }
                                        } else if (
                                            event.type === 'punch-out' ||
                                            event.type === 'site-out' ||
                                            event.type === 'site-ot-out'
                                        ) {
                                            const prevIn = sortedEvents
                                                .slice(0, index)
                                                .reverse()
                                                .find(
                                                    e =>
                                                        e.type === 'punch-in' ||
                                                        e.type === 'site-in' ||
                                                        e.type === 'site-ot-in'
                                                );
                                            if (prevIn) {
                                                const diffMins = Math.max(
                                                    1,
                                                    Math.round(
                                                        (new Date(event.timestamp).getTime() -
                                                            new Date(prevIn.timestamp).getTime()) /
                                                            60000
                                                    )
                                                );
                                                const hrs = Math.floor(diffMins / 60);
                                                const mins = diffMins % 60;
                                                const durText = hrs > 0 ? `${hrs}h ${mins}m worked` : `${mins}m worked`;
                                                durationBadge = {
                                                    text: durText,
                                                    bgClass: 'bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60',
                                                    textClass: 'text-emerald-900 dark:text-emerald-200'
                                                };
                                            }
                                        }

                                        return (
                                        <div
                                            key={`${event.timestamp}-${index}`}
                                            className={`p-3.5 rounded-xl border-l-4 shadow-xs transition-all ${
                                                (event.type === 'punch-in' || event.type === 'site-ot-in') ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-500 border border-emerald-200/60 dark:border-emerald-800/40' :
                                                (event.type === 'punch-out' || event.type === 'site-ot-out') ? 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-500 border border-rose-200/60 dark:border-rose-800/40' :
                                                event.type === 'break-in' ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-500 border border-amber-200/60 dark:border-amber-800/40' :
                                                event.type.includes('site-ot') ? 'bg-indigo-50/90 dark:bg-indigo-950/30 border-indigo-500 border border-indigo-200/60 dark:border-indigo-800/40' :
                                                'bg-sky-50/90 dark:bg-sky-950/30 border-sky-500 border border-sky-200/60 dark:border-sky-800/40'
                                            }`}
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">

                                                {/* Row 1 (Mobile) / Col 1 (Desktop): Punch In & Time */}
                                                <div className="flex items-center justify-between md:justify-start gap-3 flex-shrink-0 md:w-[200px]">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`p-2 rounded-xl flex-shrink-0 shadow-2xs ${
                                                                (event.type === 'punch-in' || event.type === 'site-ot-in') ? 'bg-emerald-600 text-white' :
                                                                (event.type === 'punch-out' || event.type === 'site-ot-out') ? 'bg-rose-600 text-white' :
                                                                event.type === 'break-in' ? 'bg-amber-500 text-white' :
                                                                event.type.includes('site-ot') ? 'bg-indigo-600 text-white' :
                                                                'bg-sky-600 text-white'
                                                            }`}
                                                        >
                                                            <Clock className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <div className={`font-extrabold capitalize text-sm ${
                                                                (event.type === 'punch-in' || event.type === 'site-ot-in') ? 'text-emerald-950 dark:text-emerald-200' :
                                                                (event.type === 'punch-out' || event.type === 'site-ot-out') ? 'text-rose-950 dark:text-rose-200' :
                                                                event.type === 'break-in' ? 'text-amber-950 dark:text-amber-200' :
                                                                event.type.includes('site-ot') ? 'text-indigo-950 dark:text-indigo-200' :
                                                                'text-sky-950 dark:text-sky-200'
                                                            }`}>
                                                                {event.type === 'punch-in' ? (event.workType === 'field' ? 'Site Check In' : 'Punch In') :
                                                                 event.type === 'punch-out' ? (event.workType === 'field' ? 'Site Check Out' : 'Punch Out') :
                                                                 event.type === 'site-ot-in' ? 'Site OT In' :
                                                                 event.type === 'site-ot-out' ? 'Site OT Out' :
                                                                 event.type.replace('-', ' ')}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                                <span className={`text-xs font-bold ${
                                                                    (event.type === 'punch-in' || event.type === 'site-ot-in') ? 'text-emerald-800 dark:text-emerald-300' :
                                                                    (event.type === 'punch-out' || event.type === 'site-ot-out') ? 'text-rose-800 dark:text-rose-300' :
                                                                    event.type === 'break-in' ? 'text-amber-800 dark:text-amber-300' :
                                                                    event.type.includes('site-ot') ? 'text-indigo-800 dark:text-indigo-300' :
                                                                    'text-sky-800 dark:text-sky-300'
                                                                }`}>
                                                                    {format(new Date(event.timestamp), 'hh:mm a')}
                                                                </span>
                                                                {durationBadge && (
                                                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${durationBadge.bgClass} ${durationBadge.textClass}`}>
                                                                        ⏱ {durationBadge.text}
                                                                    </span>
                                                                )}
                                                                {event.source === 'cctv' && (
                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                                                                        📹 CCTV Verified
                                                                    </span>
                                                                )}
                                                                {event.source === 'biometric' && (
                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800 flex items-center gap-1">
                                                                        🔐 Biometric
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {(event.checkoutNote || event.source === 'auto_system') && (
                                                                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 italic mt-1 max-w-[200px] leading-tight">
                                                                    Note: "{
                                                                        event.source === 'auto_system' || (event.checkoutNote && event.checkoutNote.toLowerCase().includes('auto punch-out'))
                                                                            ? 'User was working - Auto punched out by AI as per work hour policy'
                                                                            : event.checkoutNote ? event.checkoutNote.replace(/\[SessionDate:\s*[^\]]+\]/g, '').trim() : ''
                                                                    }"
                                                                </div>
                                                             )}
                                                        </div>
                                                    </div>

                                                    {canDelete && (
                                                        <button
                                                            onClick={() => handleDeleteEvent(event.id)}
                                                            disabled={deletingEventId === event.id}
                                                            title="Delete this record"
                                                            className="md:hidden flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                                                        >
                                                            {deletingEventId === event.id
                                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                : <Trash2 className="h-4 w-4" />}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Row 2 (Mobile) / Col 2 (Desktop): Centered Distance Badge */}
                                                <div className="flex-1 flex items-center justify-center my-1 md:my-0">
                                                    {distInfo.isUnregistered && (
                                                         <div className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950/70 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700/80 shadow-2xs w-fit max-w-full">
                                                             {distInfo.isHome ? (
                                                                 <Home className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                                                             ) : (
                                                                 <AlertTriangle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                                                             )}
                                                             <div className="flex flex-col text-center md:text-left">
                                                                 <span className="text-xs font-extrabold text-amber-950 dark:text-amber-200 leading-tight">
                                                                     {distInfo.distanceKm} km · ~{distInfo.durationMin} min drive
                                                                 </span>
                                                                 <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 leading-tight">
                                                                     from {distInfo.targetSiteName || 'registered location'}
                                                                 </span>
                                                             </div>
                                                         </div>
                                                     )}
                                                    {event.source === 'auto_system' && (
                                                        <div className="flex items-center gap-1.5 bg-rose-100 dark:bg-rose-950/70 px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 w-fit max-w-full">
                                                            <Clock className="h-3.5 w-3.5 text-rose-700 dark:text-rose-400 flex-shrink-0" />
                                                            <span className="text-xs text-rose-950 dark:text-rose-200 font-bold">
                                                                Auto punched out by AI (Work hour policy)
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Row 3 (Mobile) / Col 3 (Desktop): Full Address Tag */}
                                                <div className="flex items-center gap-2 justify-start md:justify-end flex-shrink-0 md:w-[220px]">
                                                    {(() => {
                                                        const hasCoords = event.latitude && event.longitude;
                                                        const hasLocationText = !!event.locationName;
                                                        const isAutoOut = event.source === 'auto_system' && (event.type === 'punch-out' || event.type === 'site-ot-out');
                                                        const displayLocation = hasCoords || hasLocationText || isAutoOut;
                                                        const isCoordLoc = !!(event.locationName && /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(event.locationName.trim()));
                                                        const isFakeHome = distInfo.isUnregistered && !!(event.locationName && event.locationName.toLowerCase().includes('home'));
                                                        const cleanLocationName = (isCoordLoc || isFakeHome) ? undefined : event.locationName;

                                                        const shiftPunchInEvent = group.events.find(e => 
                                                            (e.type === 'punch-in' || e.type === 'site-in') && 
                                                            e.locationName && 
                                                            !/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(e.locationName.trim()) &&
                                                            !e.locationName.toLowerCase().includes('home')
                                                        );
                                                        const shiftSiteName = shiftPunchInEvent?.locationName || (distInfo.isHome ? (user?.name ? `${user.name} Home` : 'Home Location') : (distInfo.targetSiteName && distInfo.distanceKm <= 2.5 ? `Near by (${distInfo.targetSiteName})` : undefined));

                                                        const locationFallback = cleanLocationName || shiftSiteName || (isAutoOut ? 'Auto Check-out' : undefined);

                                                        return displayLocation ? (
                                                            <div className="flex items-start gap-1.5 bg-white/95 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs w-full md:max-w-[210px]">
                                                                <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                                                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight break-words">
                                                                    {hasCoords ? (
                                                                        <AddressResolver
                                                                            lat={event.latitude!}
                                                                            lng={event.longitude!}
                                                                            fallback={locationFallback}
                                                                            userLocations={userLocations}
                                                                        />
                                                                    ) : (
                                                                        locationFallback
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => handleDeleteEvent(event.id)}
                                                            disabled={deletingEventId === event.id}
                                                            title="Delete this record"
                                                            className="hidden md:block flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                                                        >
                                                            {deletingEventId === event.id
                                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                : <Trash2 className="h-4 w-4" />}
                                                        </button>
                                                    )}
                                                </div>

                                            </div>
                                        </div>
                                        );
                                    });
                                })()}
                            </div>

                            {/* Summary Footer */}
                            <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Punches:</span>
                                        <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                                            {group.events.filter(e => e.type === 'punch-in' && e.workType !== 'field').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Punch Outs:</span>
                                        <span className="font-extrabold text-rose-700 dark:text-rose-400">
                                            {group.events.filter(e => e.type === 'punch-out' && e.workType !== 'field').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Site Check Ins:</span>
                                        <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                                            {group.events.filter(e => (e.type === 'punch-in' && e.workType === 'field') || e.type === 'site-in').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Site Check Outs:</span>
                                        <span className="font-extrabold text-rose-700 dark:text-rose-400">
                                            {group.events.filter(e => (e.type === 'punch-out' && e.workType === 'field') || e.type === 'site-out').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Site OT In:</span>
                                        <span className="font-extrabold text-indigo-700 dark:text-indigo-400">
                                            {group.events.filter(e => e.type === 'site-ot-in').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Site OT Out:</span>
                                        <span className="font-extrabold text-indigo-700 dark:text-indigo-400">
                                            {group.events.filter(e => e.type === 'site-ot-out').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Breaks In:</span>
                                        <span className="font-extrabold text-amber-700 dark:text-amber-400">
                                            {group.events.filter(e => e.type === 'break-in').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Breaks Out:</span>
                                        <span className="font-extrabold text-sky-700 dark:text-sky-400">
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
