import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import { api } from '../../services/api';
import { getStaffCategory } from '../../utils/attendanceCalculations';
import { calculatePerDayRate } from '../../utils/siteStaffCalculations';
import { format, subDays, startOfToday, endOfToday, eachDayOfInterval, isSameDay, startOfMonth } from 'date-fns';
import { 
    Users, UserCheck, UserX, Clock, Calendar, BarChart3, 
    TrendingUp, TrendingDown, IndianRupee, AlertTriangle, ShieldAlert,
    ChevronRight, Eye, RefreshCw, FileText, CheckCircle2, Ban
} from 'lucide-react';
import { isAdmin } from '../../utils/auth';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import LoadingScreen from '../../components/ui/LoadingScreen';
import Toast from '../../components/ui/Toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
    Chart,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    DoughnutController,
    ArcElement,
    Tooltip,
    Legend,
} from 'chart.js';

Chart.register(
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    DoughnutController,
    ArcElement,
    Tooltip,
    Legend
);

// --- Custom Reusable Trend Chart ---
const AttendanceTrendChart: React.FC<{ data: { labels: string[], present: number[], absent: number[] }, isMobile?: boolean }> = ({ data, isMobile }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        if (chartRef.current) {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                chartInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: data.labels,
                        datasets: [
                            {
                                label: 'Present',
                                data: data.present,
                                backgroundColor: '#006B3F', // Paradigm Emerald
                                borderColor: '#005632',
                                borderWidth: 1,
                                borderRadius: 2,
                            },
                            {
                                label: 'Absent',
                                data: data.absent,
                                backgroundColor: '#EF4444',
                                borderColor: '#DC2626',
                                borderWidth: 1,
                                borderRadius: 2,
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { 
                                beginAtZero: true, 
                                grid: { color: isMobile ? 'rgba(255,255,255,0.05)' : 'rgba(128,128,128,0.1)' },
                                ticks: {
                                    stepSize: 1,
                                    precision: 0,
                                    color: isMobile ? 'rgba(255,255,255,0.6)' : undefined
                                }
                            },
                            x: {
                                grid: { display: false },
                                ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: true,
                                    maxTicksLimit: 7,
                                    color: isMobile ? 'rgba(255,255,255,0.6)' : undefined
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'bottom',
                                labels: {
                                    usePointStyle: true,
                                    boxWidth: 8,
                                    padding: 15,
                                    color: isMobile ? 'rgba(255,255,255,0.8)' : undefined,
                                    font: { family: "'Inter', sans-serif", size: 12 }
                                }
                            },
                            tooltip: {
                                backgroundColor: '#0F172A',
                                cornerRadius: 4,
                                padding: 8,
                                displayColors: true,
                            }
                        }
                    }
                });
            }
        }
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [data]);

    return (
        <div className="h-64 relative w-full">
            <canvas ref={chartRef}></canvas>
        </div>
    );
};

// --- Premium Designation Breakdown Chart (Multi-Ring + Legend) ---
const DESIGNATION_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Emerald / Green
    '#F59E0B', // Amber / Orange
    '#EF4444', // Red
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#006B3F', // Paradigm Emerald
    '#6B7280', // Gray
];

const DesignationBreakdownChart: React.FC<{ data: { labels: string[], values: number[] }, isMobile?: boolean }> = ({ data, isMobile }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    const total = data.values.reduce((a, b) => a + b, 0);
    const isEmpty = total === 0 || (data.labels.length === 1 && data.labels[0] === 'No Present Staff');

    // Sort entries by value descending so largest department is outermost ring
    const sortedEntries = useMemo(() => {
        const raw = data.labels.map((label, i) => ({
            label,
            value: data.values[i] || 0,
            pct: total > 0 ? Math.round(((data.values[i] || 0) / total) * 100) : 0,
            color: DESIGNATION_COLORS[i % DESIGNATION_COLORS.length],
        }));
        return [...raw].sort((a, b) => b.value - a.value);
    }, [data, total]);

    // Limit to at most 4 concentric rings; merge the rest into "Others"
    const displayEntries = useMemo(() => {
        if (isEmpty) return [];
        const maxRings = 4;
        if (sortedEntries.length <= maxRings) return sortedEntries;

        const top = sortedEntries.slice(0, maxRings - 1);
        const remainder = sortedEntries.slice(maxRings - 1);
        const remainderValue = remainder.reduce((sum, e) => sum + e.value, 0);
        const remainderPct = total > 0 ? Math.round((remainderValue / total) * 100) : 0;

        return [
            ...top,
            { label: 'Others', value: remainderValue, pct: remainderPct, color: '#94A3B8' }
        ];
    }, [sortedEntries, isEmpty, total]);

    useEffect(() => {
        if (!chartRef.current) return;
        if (chartInstance.current) chartInstance.current.destroy();

        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;

        if (isEmpty) {
            // Empty state: single grey ring
            chartInstance.current = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: [isMobile ? '#2a4536' : '#e2e8f0'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
            });
            return () => { chartInstance.current?.destroy(); };
        }

        // Build datasets — outermost ring = index 0 (largest department)
        const datasets = displayEntries.map((entry) => ({
            label: entry.label,
            data: [entry.value, total - entry.value],
            backgroundColor: [entry.color, isMobile ? 'rgba(255,255,255,0.05)' : '#f1f5f9'],
            borderColor: isMobile ? '#182a20' : '#ffffff',
            borderWidth: 3,
            borderRadius: 2,
            hoverOffset: 0,
        }));

        chartInstance.current = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Active', 'Remaining'], datasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '40%',
                animation: { animateRotate: true, duration: 900, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: '#1e293b',
                        titleFont: { family: "'Inter', sans-serif", size: 12, weight: 'bold' },
                        bodyFont: { family: "'Inter', sans-serif", size: 11 },
                        padding: 10,
                        cornerRadius: 8,
                        filter: (item) => item.dataIndex === 0,
                        callbacks: {
                            title: (items) => displayEntries[items[0].datasetIndex]?.label || '',
                            label: (item) => {
                                const val = item.raw as number;
                                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                return ` ${val} staff (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });

        return () => { chartInstance.current?.destroy(); };
    }, [displayEntries, isEmpty, total, isMobile]);

    return (
        <div className="flex items-center gap-6 w-full" data-lpignore="true" data-form-type="other" data-autofill="false">
            {/* Multi-Ring Radial Chart */}
            <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }} data-lpignore="true" data-form-type="other" data-autofill="false">
                <canvas ref={chartRef} width={160} height={160} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" data-lpignore="true" data-form-type="other" data-autofill="false">
                    <span className={`text-[26px] font-bold leading-none ${isMobile ? 'text-white' : 'text-slate-800'}`}>{isEmpty ? 0 : total}</span>
                </div>
            </div>

            {/* Right Legend */}
            <div className="flex-1 min-w-0 space-y-2.5">
                {isEmpty ? (
                    <p className={`text-xs italic ${isMobile ? 'text-white/40' : 'text-slate-400'}`}>No present staff today</p>
                ) : (
                    displayEntries.map((entry) => (
                        <div key={entry.label} className="flex items-center gap-2">
                            <span className="flex-shrink-0 h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className={`text-[13px] font-medium ${isMobile ? 'text-white/60' : 'text-slate-700'}`}>
                                {entry.label}:
                            </span>
                            <span className={`text-[13px] font-bold ${isMobile ? 'text-white' : 'text-slate-900'}`}>{entry.pct}%</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};



// --- Main Client Dashboard Component ---
const ClientDashboard: React.FC = () => {
    const { user } = useAuthStore();
    const { permissions } = usePermissionsStore();
    const isMobile = useMediaQuery('(max-width: 767px)');

    const canSelectOrg = user && (isAdmin(user.role) || ['management', 'hr', 'operation_manager'].includes(user.role));
    // Site selection configuration
    const [sites, setSites] = useState<any[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>(canSelectOrg ? 'all' : user?.organizationId);

    // Date range configurations — default: 1st of current month → today
    const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

    // States for statistics and charts
    const [isLoading, setIsLoading] = useState(true);
    const [siteUsers, setSiteUsers] = useState<any[]>([]);
    const [attendanceEvents, setAttendanceEvents] = useState<any[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
    const [approvedLeavesCount, setApprovedLeavesCount] = useState<number>(0);
    const [siteStaffConfigs, setSiteStaffConfigs] = useState<any[]>([]);
    const [siteHolidays, setSiteHolidays] = useState<any[]>([]);

    const activeSiteName = useMemo(() => {
        if (!selectedSiteId || selectedSiteId === 'all') return 'All Sites';
        const found = sites.find(s => s.id === selectedSiteId);
        return found ? found.name : user?.organizationName || 'N/A';
    }, [sites, selectedSiteId, user]);

    // Check if a role belongs to office or administrative group
    const isOfficeRole = (roleName?: string) => {
        const cat = getStaffCategory(roleName || '', undefined, {
            roleMapping: {
                office: ['admin', 'hr', 'finance', 'developer', 'hr_ops', 'management', 'back_office_staff', 'accountant'],
                field: ['field_staff', 'field_officer', 'technical_reliever', 'supervisor', 'site_supervisor', 'operation_manager'],
                site: ['site_manager', 'security_guard']
            }
        });
        return cat === 'office';
    };

    // Load initial sites if authorized
    useEffect(() => {
        if (canSelectOrg) {
            api.getEntities()
                .then(ents => {
                    setSites(ents);
                    if (ents.length > 0 && !selectedSiteId) {
                        setSelectedSiteId('all');
                    }
                })
                .catch(err => console.error('Failed to load sites', err));
        }
    }, [canSelectOrg]);

    // Fetch site dashboard data
    const fetchDashboardData = async () => {
        if (!selectedSiteId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            // Check maximum historical date range limit of 30 days
            const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 30) {
                setToast({
                    message: "Historical date range restricted to a maximum of 30 days to optimize load performance.",
                    type: "warning"
                });
                // Reset end date to start date + 30 days
                const clampedEndDate = new Date(startDate);
                clampedEndDate.setDate(startDate.getDate() + 30);
                setEndDate(clampedEndDate);
                return;
            }

            const startStr = format(startDate, 'yyyy-MM-dd') + 'T00:00:00.000Z';
            const endStr = format(endDate, 'yyyy-MM-dd') + 'T23:59:59.999Z';

            // Query components
            const [
                usersList, 
                eventsList, 
                leavesList, 
                billingConfigs, 
                holidaysList
            ] = await Promise.all([
                api.getUsers({ fetchAll: true }),
                api.getAllAttendanceEvents(startStr, endStr),
                api.getLeaveRequests({ status: ['pending_manager_approval', 'pending_hr_confirmation', 'approved'] }),
                api.getAllSiteStaffConfigs(),
                api.getSiteSpecificHolidays && selectedSiteId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedSiteId)
                    ? api.getSiteSpecificHolidays(selectedSiteId) 
                    : Promise.resolve([])
            ]);

            // Filter users to selected site and exclude admin/office roles
            const selectedSiteIds = selectedSiteId === 'all' ? [] : (selectedSiteId || '').split(',').map(s => s.trim());
            const filteredSiteUsers = (usersList || []).filter((u: any) => {
                if (isOfficeRole(u.role)) return false;
                if (selectedSiteId === 'all') return true;
                if (!u.organizationId) return false;
                const userSiteIds = u.organizationId.split(',').map((s: string) => s.trim());
                return selectedSiteIds.some(id => userSiteIds.includes(id));
            });
            setSiteUsers(filteredSiteUsers);

            const siteUserIds = new Set(filteredSiteUsers.map((u: any) => u.id));

            // Filter events to site staff
            const filteredEvents = (eventsList || []).filter((e: any) => siteUserIds.has(e.userId));
            setAttendanceEvents(filteredEvents);

            const normalizedLeaves = (Array.isArray(leavesList) ? leavesList : (leavesList as any)?.data || []).filter(Boolean);
            
            // Filter pending leaves (awaiting manager or HR approval)
            const filteredPendingLeaves = normalizedLeaves.filter((l: any) => 
                siteUserIds.has(l.userId) && 
                (l.status === 'pending_manager_approval' || l.status === 'pending_hr_confirmation')
            );
            setLeaveRequests(filteredPendingLeaves);

            // Compute dynamic approved leaves count in the current date range
            const countApproved = normalizedLeaves.filter((l: any) => {
                if (!siteUserIds.has(l.userId)) return false;
                if (l.status !== 'approved') return false;
                
                const start = l.startDate || l.start_date;
                const end = l.endDate || l.end_date;
                if (!start || !end) return false;
                
                const lStart = new Date(start);
                const lEnd = new Date(end);
                
                // Normalise the dashboard date range
                const rangeStart = new Date(startDate);
                rangeStart.setHours(0, 0, 0, 0);
                const rangeEnd = new Date(endDate);
                rangeEnd.setHours(23, 59, 59, 999);
                
                return lStart <= rangeEnd && lEnd >= rangeStart;
            }).length;
            setApprovedLeavesCount(countApproved);

            // Set billing configurations
            setSiteStaffConfigs(billingConfigs || []);
            setSiteHolidays(holidaysList || []);

        } catch (error) {
            console.error("Failed to load client dashboard metrics:", error);
            setToast({ message: "Failed to fetch metrics. Please try again.", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [selectedSiteId, startDate, endDate]);

    // Handle single-date calculations (Today)
    const todayMetrics = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todayEvents = attendanceEvents.filter(e => {
            const datePart = e.timestamp ? e.timestamp.substring(0, 10) : '';
            return datePart === todayStr;
        });

        // Unique users present today
        const presentUserIds = new Set(
            todayEvents.filter(e => e.type === 'punch-in' || e.type === 'site-in').map(e => e.userId)
        );

        const presentCount = presentUserIds.size;
        const totalCount = siteUsers.length;
        const absentCount = Math.max(0, totalCount - presentCount);

        // Late arrivals today (punch in after 09:30 AM as standard check-in deadline)
        let lateArrivalsToday = 0;
        const userPunchIns: Record<string, any[]> = {};
        todayEvents.forEach(e => {
            if (e.type === 'punch-in' || e.type === 'site-in') {
                if (!userPunchIns[e.userId]) userPunchIns[e.userId] = [];
                userPunchIns[e.userId].push(e);
            }
        });

        Object.values(userPunchIns).forEach(punches => {
            punches.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const firstPunch = punches[0];
            const timeStr = firstPunch.timestamp?.substring(11, 16); // "HH:mm"
            if (timeStr && timeStr > '09:30') {
                lateArrivalsToday++;
            }
        });

        return {
            present: presentCount,
            absent: absentCount,
            late: lateArrivalsToday,
            total: totalCount
        };
    }, [siteUsers, attendanceEvents]);

    // Weekly Trends and Graph calculations
    const weeklyData = useMemo(() => {
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const labels = days.map(d => format(d, 'dd MMM'));
        
        const present: number[] = [];
        const absent: number[] = [];

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayEvents = attendanceEvents.filter(e => e.timestamp?.substring(0, 10) === dateStr);
            const presentIds = new Set(
                dayEvents.filter(e => e.type === 'punch-in' || e.type === 'site-in').map(e => e.userId)
            );
            
            const presentCount = presentIds.size;
            const absentCount = Math.max(0, siteUsers.length - presentCount);

            present.push(presentCount);
            absent.push(absentCount);
        });

        return { labels, present, absent };
    }, [startDate, endDate, attendanceEvents, siteUsers]);

    // Site-wise Attendance Trend — compare first half vs second half of selected range
    const siteTrendData = useMemo(() => {
        if (!sites.length || selectedSiteId !== 'all') return [];

        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const midIdx = Math.floor(days.length / 2);
        const firstHalf = days.slice(0, midIdx || 1).map(d => format(d, 'yyyy-MM-dd'));
        const secondHalf = days.slice(midIdx).map(d => format(d, 'yyyy-MM-dd'));

        return sites.map(site => {
            // Get all users assigned to this site
            const siteUserIds = new Set(
                (siteUsers as any[]).filter(u => {
                    if (!u.organizationId) return false;
                    return u.organizationId.split(',').map((s: string) => s.trim()).includes(site.id);
                }).map(u => u.id)
            );

            if (siteUserIds.size === 0) return null;

            const countPresent = (dates: string[]) => {
                const presentIds = new Set<string>();
                attendanceEvents.forEach((e: any) => {
                    const d = e.timestamp?.substring(0, 10);
                    if (dates.includes(d) && siteUserIds.has(e.userId) && (e.type === 'punch-in' || e.type === 'site-in')) {
                        presentIds.add(e.userId);
                    }
                });
                return presentIds.size;
            };

            const firstCount = countPresent(firstHalf);
            const secondCount = countPresent(secondHalf);
            const pctChange = firstCount === 0
                ? (secondCount > 0 ? 100 : 0)
                : Math.round(((secondCount - firstCount) / firstCount) * 100);

            return { name: site.name, count: secondCount, pctChange };
        }).filter(Boolean) as { name: string; count: number; pctChange: number }[];
    }, [sites, selectedSiteId, startDate, endDate, attendanceEvents, siteUsers]);

    // Role / Designation distribution for today's present staff
    const designationBreakdown = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todayEvents = attendanceEvents.filter(e => e.timestamp?.substring(0, 10) === todayStr);
        const presentUserIds = new Set(
            todayEvents.filter(e => e.type === 'punch-in' || e.type === 'site-in').map(e => e.userId)
        );

        const counts: Record<string, number> = {};
        presentUserIds.forEach(uid => {
            const userObj = siteUsers.find(u => u.id === uid);
            if (userObj) {
                // Use designation first, then role (formatted), then fallback to 'Staff'
                const rawRole = userObj.designation || userObj.role || 'Staff';
                // Format role slug to readable label e.g. "security_guard" → "Security Guard"
                const label = rawRole
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c: string) => c.toUpperCase());
                counts[label] = (counts[label] || 0) + 1;
            }
        });

        // Sort by count descending so the largest segments come first
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const labels = sorted.map(([k]) => k);
        const values = sorted.map(([, v]) => v);

        return {
            labels: labels.length > 0 ? labels : ['No Present Staff'],
            values: values.length > 0 ? values : [0]
        };
    }, [attendanceEvents, siteUsers]);

    // Billing & Financial calculations
    const billingSummary = useMemo(() => {
        let totalCost = 0;
        let totalDuties = 0;
        let configuredUsersCount = 0;

        const days = eachDayOfInterval({ start: startDate, end: endDate });

        siteUsers.forEach(u => {
            const config = siteStaffConfigs.find(c => c.userId === u.id);
            if (!config) return;

            configuredUsersCount++;
            const perDayRate = config.perDayBillingRate || calculatePerDayRate(config).perDayBillingRate || 0;

            // Compute duties for this user in the date range
            let userDuties = 0;
            days.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isUserPresent = attendanceEvents.some(e => 
                    e.userId === u.id && 
                    e.timestamp?.substring(0, 10) === dateStr &&
                    (e.type === 'punch-in' || e.type === 'site-in')
                );

                if (isUserPresent) {
                    const isHoliday = siteHolidays.some(h => h.date === dateStr);
                    if (isHoliday && config.nhBillingConfig === 'Double') {
                        userDuties += 2;
                    } else if (isHoliday && config.nhBillingConfig === 'Actuals') {
                        userDuties += 1.5;
                    } else {
                        userDuties += 1;
                    }
                }
            });

            totalDuties += userDuties;
            totalCost += userDuties * perDayRate;
        });

        const isRatesConfigured = configuredUsersCount > 0 || siteUsers.length === 0;

        return {
            totalCost,
            totalDuties,
            configuredUsersCount,
            isRatesConfigured
        };
    }, [siteUsers, siteStaffConfigs, attendanceEvents, siteHolidays, startDate, endDate]);

    return (
        <div className={`p-4 md:p-6 min-h-screen ${isMobile ? 'bg-[#041b0f] text-white pb-24' : 'bg-slate-50 text-slate-800'}`}>
            {toast && (
                <Toast 
                    message={toast.message} 
                    type={toast.type === 'error' ? 'error' : 'success'} 
                    onDismiss={() => setToast(null)} 
                />
            )}

            {/* Dashboard Header Bar */}
            <div className={`flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6 shadow-sm ${isMobile ? 'bg-[#182a20] border border-[#2a4536] p-5 rounded-3xl mt-4' : 'bg-white p-5 border-l-4 border-l-[#006B3F] border-y border-r border-slate-100 rounded-2xl'}`}>
                <div>
                    <h2 className={`text-xl font-extrabold tracking-tight uppercase ${isMobile ? 'text-white' : 'text-slate-900'}`}>
                        Client Control Center
                    </h2>
                    <p className={`text-sm mt-1 ${isMobile ? 'text-white/60' : 'text-slate-500'}`}>
                        Site: <span className={`font-bold ${isMobile ? 'text-[#69ab82]' : 'text-[#006B3F]'}`}>{activeSiteName}</span>
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Site Selector Dropdown for Admins/Managers */}
                    {canSelectOrg && (
                        <div className="w-full sm:w-56">
                            <Select 
                                label="" 
                                id="client-site-selector" 
                                value={selectedSiteId} 
                                onChange={e => setSelectedSiteId(e.target.value)}
                                className={`!rounded-xl ${isMobile ? '!bg-[#091c13] !border-[#2a4536] !text-white focus:!border-[#00a859]' : '!border-slate-200 focus:!border-[#006B3F]'}`}
                            >
                                <option value="all">All Sites</option>
                                {sites.map(site => (
                                    <option key={site.id} value={site.id} className={isMobile ? 'bg-[#091c13] text-white' : ''}>{site.name}</option>
                                ))}
                            </Select>
                        </div>
                    )}

                    {/* Date Pickers (Clamped to 30 days max) */}
                    <div className={`flex items-center gap-2 p-2 rounded-xl transition-all ${isMobile ? 'bg-[#091c13] text-white border border-[#2a4536]' : 'border border-slate-200 bg-slate-50 hover:bg-white focus-within:bg-white focus-within:border-[#006B3F] focus-within:ring-2 focus-within:ring-[#006B3F]/10'}`}>
                        <Calendar className={`h-4 w-4 ${isMobile ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <input 
                            type="date" 
                            className={`bg-transparent text-sm font-medium focus:outline-none cursor-pointer w-full ${isMobile ? 'text-white font-bold' : 'text-slate-700'}`}
                            value={format(startDate, 'yyyy-MM-dd')}
                            onChange={e => setStartDate(new Date(e.target.value))}
                        />
                        <span className={`text-xs font-semibold ${isMobile ? 'text-emerald-400' : 'text-slate-400'}`}>to</span>
                        <input 
                            type="date" 
                            className={`bg-transparent text-sm font-medium focus:outline-none cursor-pointer w-full ${isMobile ? 'text-white font-bold' : 'text-slate-700'}`}
                            value={format(endDate, 'yyyy-MM-dd')}
                            onChange={e => setEndDate(new Date(e.target.value))}
                        />
                    </div>

                    <button 
                        onClick={fetchDashboardData}
                        className={isMobile ? 'w-full py-2.5 bg-[#091c13] border border-[#2a4536] text-[#00a859] rounded-xl flex justify-center items-center active:scale-95 transition-transform' : 'p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 active:scale-95 transition-all shadow-sm'}
                        title="Reload Dashboard"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Card 1: Total Present */}
                <div className={`${isMobile ? 'bg-[#182a20] border border-[#2a4536] rounded-3xl p-5' : 'bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-[120px] hover:shadow-md hover:-translate-y-1 transition-all duration-300'}`}>
                    <div className="flex items-center gap-3">
                        <div className={isMobile ? 'p-2 bg-[#091c13] border border-[#2a4536] rounded-2xl text-emerald-400' : 'p-2 bg-emerald-100/50 rounded-lg text-emerald-500'}>
                            <CheckCircle2 className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5 stroke-[2.5]'}`} />
                        </div>
                        <h3 className={`font-bold ${isMobile ? 'text-[15px] text-[#69ab82]' : 'text-[15px] text-slate-800'}`}>Total Present</h3>
                    </div>
                    <div className={`flex items-end justify-between ${isMobile ? 'mt-4' : 'mt-auto'}`}>
                        <div className="flex items-baseline gap-1.5">
                            <span className={`font-extrabold leading-none ${isMobile ? 'text-2xl text-white' : 'text-3xl text-slate-900'}`}>{todayMetrics.present}</span>
                            <span className={`font-semibold ${isMobile ? 'text-[13px] text-white/40' : 'text-[13px] text-slate-500'}`}>Employees</span>
                        </div>
                        <div className={isMobile ? 'px-2 py-1 bg-[#2a4536] text-[#69ab82] text-[11px] font-bold rounded-md' : 'px-2 py-1 bg-emerald-100/50 text-emerald-600 text-[11px] font-bold rounded-md'}>
                            +{todayMetrics.total > 0 ? Math.round((todayMetrics.present / todayMetrics.total) * 100) : 0}%
                        </div>
                    </div>
                </div>

                {/* Card 2: Total Absent */}
                <div className={`${isMobile ? 'bg-[#182a20] border border-[#2a4536] rounded-3xl p-5' : 'bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-[120px] hover:shadow-md hover:-translate-y-1 transition-all duration-300'}`}>
                    <div className="flex items-center gap-3">
                        <div className={isMobile ? 'p-2 bg-[#091c13] border border-[#2a4536] rounded-2xl text-rose-400' : 'p-2 bg-rose-100/50 rounded-lg text-rose-500'}>
                            <Ban className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5 stroke-[2.5]'}`} />
                        </div>
                        <h3 className={`font-bold ${isMobile ? 'text-[15px] text-[#e07575]' : 'text-[15px] text-slate-800'}`}>Total Absent</h3>
                    </div>
                    <div className={`flex items-end justify-between ${isMobile ? 'mt-4' : 'mt-auto'}`}>
                        <div className="flex items-baseline gap-1.5">
                            <span className={`font-extrabold leading-none ${isMobile ? 'text-2xl text-white' : 'text-3xl text-slate-900'}`}>{todayMetrics.absent}</span>
                            <span className={`font-semibold ${isMobile ? 'text-[13px] text-white/40' : 'text-[13px] text-slate-500'}`}>Employees</span>
                        </div>
                        <div className={isMobile ? 'px-2 py-1 bg-[#422222] text-[#e07575] text-[11px] font-bold rounded-md' : 'px-2 py-1 bg-rose-100/50 text-rose-600 text-[11px] font-bold rounded-md'}>
                            -{todayMetrics.total > 0 ? Math.round((todayMetrics.absent / todayMetrics.total) * 100) : 0}%
                        </div>
                    </div>
                </div>

                {/* Card 3: Late Arrivals */}
                <div className={`${isMobile ? 'bg-[#182a20] border border-[#2a4536] rounded-3xl p-5' : 'bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-[120px] hover:shadow-md hover:-translate-y-1 transition-all duration-300'}`}>
                    <div className="flex items-center gap-3">
                        <div className={isMobile ? 'p-2 bg-[#091c13] border border-[#2a4536] rounded-2xl text-amber-400' : 'p-2 bg-amber-100/50 rounded-lg text-amber-500'}>
                            <Clock className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5 stroke-[2.5]'}`} />
                        </div>
                        <h3 className={`font-bold ${isMobile ? 'text-[15px] text-[#c59c5d]' : 'text-[15px] text-slate-800'}`}>Late Arrivals</h3>
                    </div>
                    <div className={`flex items-end justify-between ${isMobile ? 'mt-4' : 'mt-auto'}`}>
                        <div className="flex items-baseline gap-1.5">
                            <span className={`font-extrabold leading-none ${isMobile ? 'text-2xl text-white' : 'text-3xl text-slate-900'}`}>{todayMetrics.late}</span>
                            <span className={`font-semibold ${isMobile ? 'text-[13px] text-white/40' : 'text-[13px] text-slate-500'}`}>Employees</span>
                        </div>
                        <div className={isMobile ? 'px-2 py-1 bg-[#3a2c16] text-[#c59c5d] text-[11px] font-bold rounded-md' : 'px-2 py-1 bg-amber-100/50 text-amber-600 text-[11px] font-bold rounded-md'}>
                            +{todayMetrics.total > 0 ? Math.round((todayMetrics.late / todayMetrics.total) * 100) : 0}%
                        </div>
                    </div>
                </div>

                {/* Card 4: Leave Requests */}
                <div className={`${isMobile ? 'bg-[#182a20] border border-[#2a4536] rounded-3xl p-5' : 'bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-[120px] hover:shadow-md hover:-translate-y-1 transition-all duration-300'}`}>
                    <div className="flex items-center gap-3">
                        <div className={isMobile ? 'p-2 bg-[#091c13] border border-[#2a4536] rounded-2xl text-blue-400' : 'p-2 bg-blue-100/50 rounded-lg text-blue-500'}>
                            <Users className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5 stroke-[2.5]'}`} />
                        </div>
                        <h3 className={`font-bold ${isMobile ? 'text-[15px] text-[#6b8cba]' : 'text-[15px] text-slate-800'}`}>Leave Requests</h3>
                    </div>
                    <div className={`flex items-end justify-between ${isMobile ? 'mt-4' : 'mt-auto'}`}>
                        <div className="flex items-baseline gap-1.5">
                            <span className={`font-extrabold leading-none ${isMobile ? 'text-2xl text-white' : 'text-3xl text-slate-900'}`}>{leaveRequests.length}</span>
                            <span className={`font-semibold ${isMobile ? 'text-[13px] text-white/40' : 'text-[13px] text-slate-500'}`}>Pending</span>
                        </div>
                        <div className={isMobile ? 'w-[1px] h-6 bg-[#2a4536] mx-2' : 'w-[1px] h-6 bg-slate-200 mx-2'}></div>
                        <div className="flex items-baseline gap-1.5">
                            <span className={`font-extrabold leading-none ${isMobile ? 'text-xl text-white' : 'text-xl text-slate-900'}`}>{approvedLeavesCount}</span>
                            <span className={`font-semibold ${isMobile ? 'text-[13px] text-white/40' : 'text-[13px] text-slate-500'}`}>Approved</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Asymmetrical Layout Content */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left Column - Trend Charts & Financials (3/5 Width) */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Weekly Trend Chart */}
                    <div className={`${isMobile ? 'bg-[#182a20] border border-[#2a4536] p-5 rounded-3xl' : 'bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300'}`}>
                        <div className={`flex items-center gap-2 border-b pb-3 mb-4 ${isMobile ? 'border-[#2a4536]' : 'border-slate-100'}`}>
                            <BarChart3 className={`h-5 w-5 ${isMobile ? 'text-emerald-400' : 'text-[#006B3F]'}`} />
                            <h3 className={`text-sm font-bold uppercase tracking-wider ${isMobile ? 'text-white' : 'text-slate-900'}`}>
                                Attendance Trend
                            </h3>
                        </div>
                        <AttendanceTrendChart data={weeklyData} isMobile={isMobile} />
                    </div>

                    {/* Costing & Billing Summary */}
                    <div className={`${isMobile ? 'bg-[#182a20] border border-[#2a4536] p-5 rounded-3xl' : 'bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300'}`}>
                        <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isMobile ? 'border-[#2a4536]' : 'border-slate-100'}`}>
                            <div className="flex items-center gap-2">
                                <IndianRupee className={`h-5 w-5 ${isMobile ? 'text-emerald-400' : 'text-[#006B3F]'}`} />
                                <h3 className={`text-sm font-bold uppercase tracking-wider ${isMobile ? 'text-white' : 'text-slate-900'}`}>
                                    Billing & Financial Summary
                                </h3>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isMobile ? 'bg-[#2a4536] text-emerald-400 border border-[#2a4536]' : 'bg-emerald-50 text-[#006B3F] border border-emerald-100'}`}>
                                Active Period
                            </span>
                        </div>

                        {!billingSummary.isRatesConfigured ? (
                            <div className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border ${isMobile ? 'bg-amber-950/20 border-amber-800/40' : 'bg-amber-50/50 border-amber-100'}`}>
                                <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                                <h4 className={`text-sm font-bold ${isMobile ? 'text-amber-300' : 'text-amber-900'}`}>Rates Not Configured</h4>
                                <p className={`text-xs mt-1 max-w-sm ${isMobile ? 'text-amber-200/80' : 'text-amber-700'}`}>
                                    CTC rates and billing constants are not configured for staff at this site. 
                                    Contact your administrator to set up site billing.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className={`p-4 border rounded-xl transition-colors ${isMobile ? 'bg-[#091c13] border-[#2a4536]' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'}`}>
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${isMobile ? 'text-white/60' : 'text-slate-500'}`}>Estimated Subtotal</p>
                                        <p className={`text-2xl font-extrabold mt-1 ${isMobile ? 'text-white' : 'text-slate-900'}`}>
                                            ₹{billingSummary.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div className={`p-4 border rounded-xl transition-colors ${isMobile ? 'bg-[#091c13] border-[#2a4536]' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'}`}>
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${isMobile ? 'text-white/60' : 'text-slate-500'}`}>Billable Duties</p>
                                        <p className={`text-2xl font-extrabold mt-1 ${isMobile ? 'text-white' : 'text-slate-900'}`}>
                                            {billingSummary.totalDuties.toFixed(1)}
                                        </p>
                                    </div>
                                    <div className={`p-4 border rounded-xl transition-colors ${isMobile ? 'bg-[#091c13] border-[#2a4536]' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'}`}>
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${isMobile ? 'text-white/60' : 'text-slate-500'}`}>Configured Staff</p>
                                        <p className={`text-2xl font-extrabold mt-1 ${isMobile ? 'text-white' : 'text-slate-900'}`}>
                                            {billingSummary.configuredUsersCount} / {siteUsers.length}
                                        </p>
                                    </div>
                                </div>

                                <div className={`border rounded-xl overflow-hidden shadow-sm ${isMobile ? 'border-[#2a4536]' : 'border-slate-100'}`}>
                                    <div className={`p-3.5 text-xs font-extrabold uppercase tracking-wider border-b ${isMobile ? 'bg-[#091c13] border-[#2a4536] text-white' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                                        Staff Cost Breakdown
                                    </div>
                                    <div className="divide-y divide-slate-100 overflow-x-auto">
                                        <table className="min-w-full text-left text-xs">
                                            <thead>
                                                <tr className={`border-b ${isMobile ? 'bg-[#091c13]/50 border-[#2a4536]' : 'bg-slate-50/70 border-slate-100'}`}>
                                                    <th className={`p-3 font-semibold ${isMobile ? 'text-white/60' : 'text-slate-600'}`}>Employee</th>
                                                    <th className={`p-3 font-semibold text-right ${isMobile ? 'text-white/60' : 'text-slate-600'}`}>Daily Rate</th>
                                                    <th className={`p-3 font-semibold text-right ${isMobile ? 'text-white/60' : 'text-slate-600'}`}>Duties</th>
                                                    <th className={`p-3 font-semibold text-right ${isMobile ? 'text-white/60' : 'text-slate-600'}`}>Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className={`divide-y ${isMobile ? 'divide-[#2a4536]' : 'divide-slate-100'}`}>
                                                {siteUsers.map(u => {
                                                    const config = siteStaffConfigs.find(c => c.userId === u.id);
                                                    if (!config) {
                                                        return (
                                                            <tr key={u.id} className={isMobile ? 'hover:bg-[#1a3225]/20 bg-amber-950/5' : 'hover:bg-slate-50/50 bg-amber-50/5'}>
                                                                <td className="p-3">
                                                                    <p className={`font-bold ${isMobile ? 'text-white' : 'text-slate-950'}`}>{u.name}</p>
                                                                    <p className={`text-[10px] ${isMobile ? 'text-white/40' : 'text-slate-500'}`}>{u.designation || 'Staff'}</p>
                                                                </td>
                                                                <td colSpan={3} className={`p-3 text-right font-medium italic ${isMobile ? 'text-amber-400' : 'text-amber-600'}`}>
                                                                    Rates Not Configured
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    const perDayRate = config.perDayBillingRate || calculatePerDayRate(config).perDayBillingRate || 0;
                                                    let userDuties = 0;
                                                    
                                                    eachDayOfInterval({ start: startDate, end: endDate }).forEach(day => {
                                                        const dateStr = format(day, 'yyyy-MM-dd');
                                                        const isUserPresent = attendanceEvents.some(e => 
                                                            e.userId === u.id && 
                                                            e.timestamp?.substring(0, 10) === dateStr &&
                                                            (e.type === 'punch-in' || e.type === 'site-in')
                                                        );

                                                        if (isUserPresent) {
                                                            const isHoliday = siteHolidays.some(h => h.date === dateStr);
                                                            if (isHoliday && config.nhBillingConfig === 'Double') {
                                                                userDuties += 2;
                                                            } else if (isHoliday && config.nhBillingConfig === 'Actuals') {
                                                                userDuties += 1.5;
                                                            } else {
                                                                userDuties += 1;
                                                            }
                                                        }
                                                    });

                                                    return (
                                                        <tr key={u.id} className={`transition-colors ${isMobile ? 'hover:bg-[#1a3225]/20' : 'hover:bg-slate-50/50'}`}>
                                                            <td className="p-3">
                                                                <p className={`font-bold ${isMobile ? 'text-white' : 'text-slate-900'}`}>{u.name}</p>
                                                                <p className={`text-[10px] ${isMobile ? 'text-white/40' : 'text-slate-500'}`}>{u.designation || 'Staff'}</p>
                                                            </td>
                                                            <td className={`p-3 text-right ${isMobile ? 'text-white/80' : 'text-slate-700'}`}>
                                                                ₹{perDayRate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className={`p-3 text-right ${isMobile ? 'text-white/80' : 'text-slate-700'}`}>
                                                                {userDuties.toFixed(1)}
                                                            </td>
                                                            <td className={`p-3 text-right font-bold ${isMobile ? 'text-emerald-400' : 'text-slate-900'}`}>
                                                                ₹{(userDuties * perDayRate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Designation Breakdown & Pending Leaves (2/5 Width) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Present Roles Breakdown */}
                    <div className={`${isMobile ? 'bg-[#182a20] border border-[#2a4536] p-5 rounded-3xl' : 'bg-white p-6 border border-slate-100 shadow-sm rounded-2xl'}`}>
                        <div className="pb-4 mb-4">
                            <h3 className={`text-[15px] font-bold ${isMobile ? 'text-white' : 'text-slate-800'}`}>
                                Attendance by Department
                            </h3>
                        </div>
                        <div className="flex items-center justify-center min-h-[140px]">
                            <DesignationBreakdownChart data={designationBreakdown} isMobile={isMobile} />
                        </div>
                    </div>

                    {/* Site Attendance Trend — visible only when "All Sites" selected */}
                    {selectedSiteId === 'all' && siteTrendData.length > 0 && (
                        <div className={`${isMobile ? 'bg-[#182a20] border border-[#2a4536] p-5 rounded-3xl' : 'bg-white p-6 border border-slate-100 shadow-sm rounded-2xl hover:shadow-md transition-all duration-300'}`}>
                            <div className="pb-4 mb-4">
                                <h3 className={`text-[15px] font-bold ${isMobile ? 'text-white' : 'text-slate-800'}`}>
                                    Top Performers by Location
                                </h3>
                            </div>
                            <div className="space-y-4">
                                {siteTrendData
                                    .sort((a, b) => b.pctChange - a.pctChange)
                                    .slice(0, 8)
                                    .map((site) => {
                                        const isUp = site.pctChange >= 0;
                                        return (
                                            <div key={site.name} className="flex items-center justify-between">
                                                {/* Site name */}
                                                <span className={`text-[13px] font-bold truncate mr-2 ${isMobile ? 'text-white/80' : 'text-slate-700'}`}>
                                                    {site.name}
                                                </span>
                                                
                                                <div className="flex items-center gap-3 ml-auto shrink-0">
                                                    {/* Trend icon (Dynamically Green/Red based on up/down) */}
                                                    {isUp
                                                        ? <TrendingUp className="h-5 w-5 text-emerald-400 stroke-[2.5]" />
                                                        : <TrendingDown className="h-5 w-5 text-rose-400 stroke-[2.5]" />
                                                    }
                                                    {/* Percentage */}
                                                    <span className={`text-[13px] font-bold w-16 text-right ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {isUp ? '+' : ''}{site.pctChange.toFixed(2)}%
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    )}

                    {/* View-Only Pending Leaves List */}
                    <div className={`${isMobile ? 'bg-[#182a20] border border-[#2a4536] p-5 rounded-3xl' : 'bg-white p-6 border border-slate-100 shadow-sm rounded-2xl hover:shadow-md transition-all duration-300'}`}>
                        <div className={`flex items-center gap-2 border-b pb-3 mb-4 ${isMobile ? 'border-[#2a4536]' : 'border-slate-100'}`}>
                            <Calendar className={`h-5 w-5 ${isMobile ? 'text-emerald-400' : 'text-[#006B3F]'}`} />
                            <h3 className={`text-sm font-bold uppercase tracking-wider ${isMobile ? 'text-white' : 'text-slate-900'}`}>
                                Pending Leave Requests
                            </h3>
                        </div>

                        {leaveRequests.length === 0 ? (
                            <div className={`p-8 text-center text-xs border border-dashed rounded-xl ${isMobile ? 'text-white/40 border-[#2a4536] bg-[#091c13]/30' : 'text-slate-500 bg-slate-50/50 border-slate-200'}`}>
                                No pending leave requests found for this site.
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {leaveRequests.map(leave => {
                                    const userObj = siteUsers.find(u => u.id === leave.userId);
                                    return (
                                        <div 
                                            key={leave.id} 
                                            className={`p-3.5 border transition-all text-xs rounded-xl ${isMobile ? 'border-[#2a4536] bg-[#091c13]/30 hover:bg-[#091c13]/50' : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm'}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className={`font-bold ${isMobile ? 'text-white' : 'text-slate-900'}`}>{leave.userName || userObj?.name || 'Unknown User'}</p>
                                                    <p className={`text-[10px] mt-0.5 ${isMobile ? 'text-white/40' : 'text-slate-500'}`}>
                                                        Role: {userObj?.designation || 'Staff'}
                                                    </p>
                                                </div>
                                                <span className={`px-2 py-0.5 border rounded-full text-[9px] uppercase font-bold tracking-wider ${isMobile ? 'bg-[#2a4536]/40 text-emerald-300 border-emerald-500/20' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                    {leave.leaveType}
                                                </span>
                                            </div>
                                            <div className={`flex items-center gap-2 mt-2 pt-2 border-t text-[11px] ${isMobile ? 'border-[#2a4536]/40 text-white/50' : 'border-slate-100 text-slate-500'}`}>
                                                <span className="font-medium">
                                                    {leave.startDate} to {leave.endDate}
                                                </span>
                                            </div>
                                            {leave.reason && (
                                                <p className={`mt-1.5 text-[10px] border rounded-lg italic p-2 ${isMobile ? 'text-white/80 bg-[#091c13]/55 border-[#2a4536]/40' : 'text-slate-600 bg-white border-slate-100'}`}>
                                                    "{leave.reason}"
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientDashboard;
