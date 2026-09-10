import React, { useState, useEffect, useMemo, useRef } from 'react';
import { startOfYear, endOfYear, format, getMonth, eachDayOfInterval, getDay, isSameDay, startOfMonth, endOfMonth, subDays, startOfDay, isBefore } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { useSettingsStore } from '../../store/settingsStore';
import type { AttendanceEvent, UserHoliday, LeaveRequest } from '../../types';
import { FIXED_HOLIDAYS } from '../../utils/constants';
import { Loader2, BarChart2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    Chart,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
} from 'chart.js';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Button from '../../components/ui/Button';
import { useMediaQuery } from '../../hooks/useMediaQuery';

Chart.register(
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface YearlyAttendanceChartProps {
    data?: {
        events: AttendanceEvent[];
        userHolidays: UserHoliday[];
        leaves: LeaveRequest[];
    } | null;
    isLoading?: boolean;
    onTotalPaydaysChange?: (total: number, year: number) => void;
    isMobile?: boolean;
    selectedMonth?: number;
    viewingYear?: number;
    onMonthSelect?: (monthIndex: number) => void;
}

const YearlyAttendanceChart: React.FC<YearlyAttendanceChartProps> = ({ 
    data, 
    isLoading: isLoadingProp, 
    onTotalPaydaysChange, 
    isMobile: isMobileProp,
    selectedMonth,
    viewingYear,
    onMonthSelect
}) => {
    const isMobileQuery = useMediaQuery('(max-width: 767px)');
    const isMobileEffective = isMobileProp ?? isMobileQuery;
    const { user } = useAuthStore();
    const { recurringHolidays, attendance, fieldHolidays, officeHolidays } = useSettingsStore();
    const [events, setEvents] = useState<AttendanceEvent[]>([]);
    const [userHolidays, setUserHolidays] = useState<string[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentYear, setCurrentYear] = useState(viewingYear ?? new Date().getFullYear());

    useEffect(() => {
        if (typeof viewingYear === 'number' && viewingYear !== currentYear) {
            setCurrentYear(viewingYear);
        }
    }, [viewingYear, currentYear]);
    
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        if (data) {
            setEvents(data.events);
            setUserHolidays(data.userHolidays.map(h => h.holidayName));
            setLeaves(data.leaves);
            setIsLoading(false);
        } else if (isLoadingProp) {
            setIsLoading(true);
        }
    }, [data, isLoadingProp]);

    // Internal fallback for year changes (if data not provided for new year)
    useEffect(() => {
        const fetchData = async () => {
            if (!user || data) return; // Skip if data is passed from parent (Dashboard)
            setIsLoading(true);
            try {
                const start = startOfYear(new Date(currentYear, 0, 1)).toISOString();
                const end = endOfYear(new Date(currentYear, 0, 1)).toISOString();
                
                const [attendanceData, holData, leaveData] = await Promise.all([
                    api.getAttendanceEvents(user.id, start, end),
                    api.getUserHolidays(user.id),
                    api.getLeaveRequests({
                        userId: user.id,
                        status: 'approved',
                        startDate: start,
                        endDate: end
                    })
                ]);
                
                setEvents(attendanceData);
                setUserHolidays((holData as UserHoliday[]).map(h => h.holidayName));
                setLeaves(leaveData.data);
            } catch (error) {
                console.error("Failed to fetch yearly chart data", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user, currentYear]);

    const stats = useMemo(() => {
        const monthlyWorked = Array(12).fill(0);
        const monthlyLeaves = Array(12).fill(0);
        const monthlyHolidays = Array(12).fill(0);
        const monthlySundays = Array(12).fill(0);
        const monthlySiteOt = Array(12).fill(0);

        const workedDaysSet = new Set<string>();
        const siteOtDaysSet = new Set<string>();
        events.forEach(e => {
            if (e.type.toLowerCase().includes('punch-in')) {
                workedDaysSet.add(format(new Date(e.timestamp), 'yyyy-MM-dd'));
            }
            if (e.type.toLowerCase() === 'site-ot-in') {
                siteOtDaysSet.add(format(new Date(e.timestamp), 'yyyy-MM-dd'));
            }
        });

        // Map leaves to days
        const leaveDaysSet = new Set<string>();
        leaves.forEach(leave => {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            const daysInLeave = eachDayOfInterval({ start, end });
            daysInLeave.forEach(d => leaveDaysSet.add(format(d, 'yyyy-MM-dd')));
        });

        const activeRecurringRules = recurringHolidays.filter(rule => 
            (rule.type || 'office') === (user?.role === 'field_staff' ? 'field' : 'office')
        );

        const allowedFloating = (user?.role === 'field_staff'
            ? attendance?.field?.monthlyFloatingLeaves
            : attendance?.office?.monthlyFloatingLeaves) ?? 0;

        const configHolidays = user?.role === 'field_staff' ? fieldHolidays : officeHolidays;
        const expiryDateStr = user?.role === 'field_staff'
            ? attendance?.field?.floatingLeavesExpiryDate
            : attendance?.office?.floatingLeavesExpiryDate;
        const expiryDate = expiryDateStr ? startOfDay(new Date(expiryDateStr)) : null;

        const rawJoining = user?.joiningDate || (user as any)?.joining_date || user?.createdAt || (user as any)?.created_at;
        let employmentStartDate: Date | null = rawJoining ? startOfDay(new Date(String(rawJoining).replace(/-/g, '/'))) : null;
        if (events && events.length > 0) {
            const punchDates = events
                .filter(e => e && e.timestamp)
                .map(e => startOfDay(new Date(e.timestamp)).getTime());
            if (punchDates.length > 0) {
                const earliestPunchMs = Math.min(...punchDates);
                const earliestPunchDate = new Date(earliestPunchMs);
                if (!employmentStartDate || earliestPunchDate < employmentStartDate) {
                    employmentStartDate = earliestPunchDate;
                }
            }
        }

        for (let m = 0; m < 12; m++) {
            const start = startOfMonth(new Date(currentYear, m, 1));
            const end = endOfMonth(new Date(currentYear, m, 1));
            const daysInMonth = eachDayOfInterval({ start, end });

            let floatingCount = 0;
            let monthWorkedCount = 0;
            let monthLeaveCount = 0;
            let monthHolidayCount = 0;
            let monthSundayCount = 0;
            let monthSiteOtCount = 0;

            daysInMonth.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isBeforeEmployment = employmentStartDate ? isBefore(startOfDay(day), employmentStartDate) : false;
                
                if (siteOtDaysSet.has(dateStr)) {
                    monthSiteOtCount++;
                }
                
                // 1. Worked (Highest priority)
                if (workedDaysSet.has(dateStr)) {
                    monthWorkedCount++;
                    return;
                }

                if (isBeforeEmployment) {
                    return;
                }

                // 2. Approved Leaves
                if (leaveDaysSet.has(dateStr)) {
                    monthLeaveCount++;
                    return;
                }

                // 3. Holidays
                const isConfigured = configHolidays.some(h => isSameDay(new Date(h.date), day));
                const isFixed = FIXED_HOLIDAYS.some(h => h.date === format(day, 'MM-dd'));
                const matchingFixed = FIXED_HOLIDAYS.find(h => h.date === format(day, 'MM-dd'));
                const isUserSelected = matchingFixed ? userHolidays.includes(matchingFixed.name) : false;
                
                let isRecurring = false;
                const isFemale = ['female', 'ladies'].includes((user?.gender || '').toLowerCase());
                if (!isFemale && floatingCount < allowedFloating) {
                    for (const rule of activeRecurringRules) {
                        // Check expiry
                        if (expiryDate && startOfDay(day) > expiryDate) continue;

                        if (format(day, 'EEEE').toLowerCase() === rule.day.toLowerCase()) {
                            const prevDaysInMonth = eachDayOfInterval({ start, end: day });
                            const occurrence = prevDaysInMonth.filter(d => format(d, 'EEEE').toLowerCase() === rule.day.toLowerCase()).length;
                            if (occurrence === rule.n) {
                                isRecurring = true;
                                break;
                            }
                        }
                    }
                }

                if (isConfigured || isFixed || isUserSelected || isRecurring) {
                    monthHolidayCount++;
                    if (isRecurring) floatingCount++;
                    return;
                }

                // 4. Week Offs (Sundays)
                if (getDay(day) === 0) {
                    let presentInWeek = 0;
                    // Look back 6 days (Mon-Sat)
                    // If we are at the start of the year, we might need to fetch data from previous year
                    // but for simplicity in this chart, we check the current events array which is already fetched for the year.
                    // However, we need to handle the first week of Jan specifically.
                    
                    const weekDays = eachDayOfInterval({ 
                        start: subDays(day, 6), 
                        end: subDays(day, 1) 
                    });

                    weekDays.forEach(wd => {
                        const wdStr = format(wd, 'yyyy-MM-dd');
                        if (workedDaysSet.has(wdStr)) {
                            presentInWeek++;
                        }
                    });

                    if (presentInWeek >= 4) {
                        monthSundayCount++;
                    }
                    return;
                }
            });

            monthlyWorked[m] = monthWorkedCount;
            monthlyLeaves[m] = monthLeaveCount;
            monthlyHolidays[m] = monthHolidayCount;
            monthlySundays[m] = monthSundayCount;
            monthlySiteOt[m] = monthSiteOtCount;
        }

        return { monthlyWorked, monthlyLeaves, monthlyHolidays, monthlySundays, monthlySiteOt };
    }, [events, userHolidays, leaves, recurringHolidays, attendance, user, currentYear, fieldHolidays, officeHolidays]);



    const activeMonthIdx = (viewingYear === currentYear && typeof selectedMonth === 'number') ? selectedMonth : -1;

    useEffect(() => {
        if (!chartRef.current || isLoading) return;

        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;

        const newData = [
            stats.monthlyWorked,
            stats.monthlyLeaves,
            stats.monthlyHolidays,
            stats.monthlySundays,
            stats.monthlySiteOt,
        ];

        // ── Update in-place if chart already exists (no destroy → no flicker) ──
        if (chartInstance.current) {
            chartInstance.current.data.datasets.forEach((ds, i) => {
                ds.data = newData[i];
                if (isMobileEffective) {
                    const mobileColors = ['#44D62C', '#38bdf8', '#10b981', '#f59e0b', '#f97316'];
                    ds.backgroundColor = mobileColors[i];
                } else {
                    const webColors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ea580c'];
                    ds.backgroundColor = webColors[i];
                }
                (ds as any).borderWidth = (c: any) => c.dataIndex === activeMonthIdx ? 2 : 0;
                (ds as any).borderColor = (c: any) => c.dataIndex === activeMonthIdx ? (isMobileEffective ? '#44D62C' : '#312e81') : 'transparent';
            });
            if (chartInstance.current.options.scales?.x?.ticks) {
                (chartInstance.current.options.scales.x.ticks as any).color = (c: any) => 
                    c.index === activeMonthIdx 
                        ? (isMobileEffective ? '#44D62C' : '#4f46e5') 
                        : (isMobileEffective ? '#7D967B' : '#64748b');
                (chartInstance.current.options.scales.x.ticks as any).font = (c: any) => ({
                    size: c.index === activeMonthIdx ? 11 : 10,
                    weight: c.index === activeMonthIdx ? 700 : 500
                });
            }
            chartInstance.current.update('none'); // 'none' = instant, no animation
            return;
        }

        // First mount: create the chart with animations disabled
        chartInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: MONTHS,
                datasets: [
                    {
                        label: 'WORKED',
                        data: stats.monthlyWorked,
                        backgroundColor: isMobileEffective ? '#44D62C' : '#6366f1',
                        borderColor: ((c: any) => c.dataIndex === activeMonthIdx ? (isMobileEffective ? '#44D62C' : '#312e81') : 'transparent') as any,
                        borderWidth: ((c: any) => c.dataIndex === activeMonthIdx ? 2 : 0) as any,
                        stack: 'payable',
                        borderRadius: 4,
                    },
                    {
                        label: 'WH',
                        data: stats.monthlyLeaves,
                        backgroundColor: isMobileEffective ? '#38bdf8' : '#8b5cf6',
                        borderColor: ((c: any) => c.dataIndex === activeMonthIdx ? (isMobileEffective ? '#44D62C' : '#312e81') : 'transparent') as any,
                        borderWidth: ((c: any) => c.dataIndex === activeMonthIdx ? 2 : 0) as any,
                        stack: 'payable',
                        borderRadius: 4,
                    },
                    {
                        label: 'HOLIDAYS',
                        data: stats.monthlyHolidays,
                        backgroundColor: '#10b981',
                        borderColor: ((c: any) => c.dataIndex === activeMonthIdx ? (isMobileEffective ? '#44D62C' : '#312e81') : 'transparent') as any,
                        borderWidth: ((c: any) => c.dataIndex === activeMonthIdx ? 2 : 0) as any,
                        stack: 'payable',
                        borderRadius: 4,
                    },
                    {
                        label: 'WEEK OFFS',
                        data: stats.monthlySundays,
                        backgroundColor: '#f59e0b',
                        borderColor: ((c: any) => c.dataIndex === activeMonthIdx ? (isMobileEffective ? '#44D62C' : '#312e81') : 'transparent') as any,
                        borderWidth: ((c: any) => c.dataIndex === activeMonthIdx ? 2 : 0) as any,
                        stack: 'payable',
                        borderRadius: 4,
                    },
                    {
                        label: 'SITE OT',
                        data: stats.monthlySiteOt,
                        backgroundColor: isMobileEffective ? '#f97316' : '#ea580c',
                        borderColor: ((c: any) => c.dataIndex === activeMonthIdx ? (isMobileEffective ? '#44D62C' : '#312e81') : 'transparent') as any,
                        borderWidth: ((c: any) => c.dataIndex === activeMonthIdx ? 2 : 0) as any,
                        stack: 'siteot',
                        borderRadius: 4,
                    }
                ]
            },
            options: {
                // ── No animations — prevents the bar-grow flicker on every render ──
                animation: false,
                responsive: true,
                maintainAspectRatio: false,
                onClick: (_evt, elements) => {
                    if (elements && elements.length > 0 && onMonthSelect) {
                        const idx = elements[0].index;
                        if (typeof idx === 'number' && idx >= 0 && idx < 12) {
                            onMonthSelect(idx);
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            boxWidth: 8,
                            padding: 10,
                            font: { size: 10, weight: 700 },
                            color: isMobileEffective ? '#d1d5db' : '#334155',
                        }
                    },
                    tooltip: {
                        backgroundColor: isMobileEffective ? '#101710' : '#1e293b',
                        borderColor: isMobileEffective ? '#2B3E2A' : '#334155',
                        borderWidth: isMobileEffective ? 1 : 0,
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            footer: (items) => {
                                const total = items.reduce((sum, item) => sum + (item.raw as number), 0);
                                return `Total Paydays: ${total} days`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        max: 31,
                        ticks: { 
                            stepSize: 5, 
                            font: { size: 10 },
                            color: isMobileEffective ? '#7D967B' : '#64748b'
                        },
                        grid: { 
                            color: isMobileEffective ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.05)' 
                        }
                    },
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { 
                            font: ((c: any) => ({
                                size: c.index === activeMonthIdx ? 11 : 10,
                                weight: c.index === activeMonthIdx ? 700 : 500
                            })) as any, 
                            color: ((c: any) => c.index === activeMonthIdx 
                                ? (isMobileEffective ? '#44D62C' : '#4f46e5') 
                                : (isMobileEffective ? '#7D967B' : '#64748b')) as any
                        }
                    }
                }
            }
        });
        // No cleanup returned here — cleanup is handled by the unmount-only effect below
    }, [stats, isLoading, isMobileEffective, activeMonthIdx, onMonthSelect]);

    // Unmount-only cleanup — runs ONLY when component leaves the DOM, not on re-renders
    useEffect(() => {
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
        };
    }, []);

    const changeYear = (delta: number) => {
        setCurrentYear(prev => prev + delta);
    };

    const totalPayable = stats.monthlyWorked.reduce((a, b) => a + b, 0) + 
                       stats.monthlyLeaves.reduce((a, b) => a + b, 0) + 
                       stats.monthlyHolidays.reduce((a, b) => a + b, 0) + 
                       stats.monthlySundays.reduce((a, b) => a + b, 0);

    useEffect(() => {
        if (onTotalPaydaysChange && typeof totalPayable === 'number') {
            onTotalPaydaysChange(totalPayable, currentYear);
        }
    }, [totalPayable, currentYear, onTotalPaydaysChange]);



    return (
        <div className={`w-full flex flex-col h-full ${
            isMobileEffective 
                ? 'bg-[#092c19] border border-[#134426] rounded-2xl p-4 shadow-none' 
                : 'bg-card p-4 rounded-xl shadow-card border border-border'
        }`}>
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-xl flex items-center justify-center ${
                        isMobileEffective ? 'bg-[#091c13] border border-[#2a4536]' : 'bg-indigo-50 rounded-lg'
                    }`}>
                        <BarChart2 className={`h-4 w-4 ${isMobileEffective ? 'text-[#22c55e]' : 'text-indigo-600'}`} />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <h3 className={`text-sm font-bold ${isMobileEffective ? 'text-white' : 'text-primary-text'}`}>
                            Yearly Attendance
                        </h3>
                        {activeMonthIdx >= 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isMobileEffective 
                                    ? 'bg-[#134426] text-[#44D62C] border border-[#2a4536]' 
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}>
                                {MONTHS[activeMonthIdx]}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className={`btn-icon !p-1 h-6 w-6 ${
                            isMobileEffective 
                                ? '!bg-[#091c13] !border-[#2a4536] text-white hover:bg-[#1a3225]' 
                                : ''
                        }`} 
                        onClick={() => changeYear(-1)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className={`text-xs font-bold min-w-[40px] text-center ${
                        isMobileEffective ? 'text-white' : 'text-gray-700'
                    }`}>
                        {currentYear}
                    </span>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className={`btn-icon !p-1 h-6 w-6 ${
                            isMobileEffective 
                                ? '!bg-[#091c13] !border-[#2a4536] text-white hover:bg-[#1a3225]' 
                                : ''
                        }`} 
                        onClick={() => changeYear(1)} 
                        disabled={currentYear >= new Date().getFullYear()}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 relative min-h-[300px] md:min-h-[280px]">
                {isLoading ? (
                    <div className={`absolute inset-0 flex items-center justify-center z-10 ${
                        isMobileEffective ? 'bg-[#092c19]/70 backdrop-blur-xs' : 'bg-white/50'
                    }`}>
                        <Loader2 className={`h-5 w-5 animate-spin ${isMobileEffective ? 'text-[#22c55e]' : 'text-indigo-600'}`} />
                    </div>
                ) : null}
                <canvas ref={chartRef}></canvas>
            </div>
            
            {isMobileEffective ? (
                <div className="mt-auto pt-2 flex flex-col text-xs">
                    {/* Row 1: Total Paydays */}
                    <div className="flex justify-between items-center py-2.5 border-t border-[#134426]">
                        <span className="font-semibold text-white/90 text-xs">Total Paydays:</span>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-xs px-2.5 py-1 rounded-full bg-[#0d2c18] border border-[#1b5e32] text-[#22c55e]">
                                {totalPayable} days
                            </span>
                        </div>
                    </div>

                    {/* Row 2: Breakdown */}
                    <div className="flex justify-between items-center py-2 border-t border-[#134426]/70 text-[11px]">
                        <span className="font-medium text-[#7D967B]">Breakdown:</span>
                        <div className="text-right">
                            <span className="font-medium text-white/70" title="Worked + Leaves + Holidays + Week Offs">
                                (W: {stats.monthlyWorked.reduce((a, b) => a + b, 0)} + 
                                 WH: {stats.monthlyLeaves.reduce((a, b) => a + b, 0)} + 
                                 H: {stats.monthlyHolidays.reduce((a, b) => a + b, 0)} + 
                                 WO: {stats.monthlySundays.reduce((a, b) => a + b, 0)})
                            </span>
                            <span className="text-[#7D967B] ml-1.5 font-medium">
                                • Avg: {(totalPayable / (currentYear < new Date().getFullYear() ? 12 : new Date().getMonth() + 1)).toFixed(1)}/mo
                            </span>
                        </div>
                    </div>

                    {/* Row 3: Site OT Days */}
                    <div className="flex justify-between items-center py-2.5 border-t border-[#134426]">
                        <span className="font-semibold text-white/90 text-xs">Site OT Days:</span>
                        <span className="font-bold text-xs px-2.5 py-1 rounded-full bg-orange-950/40 border border-orange-800/50 text-orange-400">
                            {stats.monthlySiteOt.reduce((a, b) => a + b, 0)} days
                        </span>
                    </div>
                </div>
            ) : (
                <div className="mt-auto pt-3 border-t border-border/50 flex flex-col gap-1 text-[10px] text-muted">
                    <div className="flex justify-between items-center text-xs">
                        <span className="font-medium text-gray-600">Total Paydays:</span>
                        <span className="font-bold text-indigo-600 text-sm">{totalPayable} days</span>
                    </div>
                    <div className="flex justify-between items-center opacity-80 text-[10px]">
                        <span title="Worked + Leaves + Holidays + Week Offs">
                            (W: {stats.monthlyWorked.reduce((a, b) => a + b, 0)} + 
                             WH: {stats.monthlyLeaves.reduce((a, b) => a + b, 0)} + 
                             H: {stats.monthlyHolidays.reduce((a, b) => a + b, 0)} + 
                             WO: {stats.monthlySundays.reduce((a, b) => a + b, 0)})
                        </span>
                        <span>Avg: {(totalPayable / (currentYear < new Date().getFullYear() ? 12 : new Date().getMonth() + 1)).toFixed(1)}/mo</span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-1 border-t border-border/30 pt-1">
                        <span className="font-medium text-gray-600">Site OT Days:</span>
                        <span className="font-bold text-orange-600 text-sm">{stats.monthlySiteOt.reduce((a, b) => a + b, 0)} days</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default YearlyAttendanceChart;

