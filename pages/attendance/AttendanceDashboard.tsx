import React, { useState, useEffect, useCallback, useRef, useMemo, useId } from 'react';
import { isAdmin } from '../../utils/auth';

// This component has been extended to support manual date entry for the attendance dashboard, enforce whole
// number increments on the chart axes, and unify the report generation/download flow into a single action.
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { fetchTodayMetrics, fetchAttendanceSummary, fetchTopPerformers, buildChartDatasets, TodayMetrics, DaySummary, TopPerformer } from '../../services/attendanceDashboard';

import { fetchKioskDevices, type KioskDevice } from '../../services/gateApi';
import { pdf } from '@react-pdf/renderer';
import { BasicReportDocument, MonthlyReportDocument, MonthlyMatrixReportDocument, SiteOtReportDocument, AttendanceLogDocument, WorkHoursReportDocument, AuditLogDocument, AttendanceLogDataRow, WorkHoursReportDataRow, SiteOtDataRow, AuditLogDataRow, MonthlyReportRow as PDFMonthlyReportRow, BasicReportDataRow, LeaveBalanceTrackerDocument } from './PDFReports';
import { buildAttendanceDayKeyByEventId } from '../../utils/attendanceDayGrouping';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import type {
    AttendanceEvent,
    DailyAttendanceRecord,
    DailyAttendanceStatus,
    User,
    LeaveRequest,
    AttendanceSettings,
    OnboardingData,
    Organization,
    OrganizationGroup,
    CompOffLog,
    UserHoliday,
    Role,
    StaffAttendanceRules,
    FieldAttendanceViolation,
    AttendanceReportType,
    ReportEmailPayload
} from '../../types';
import ManualAttendanceModal from '../../components/attendance/ManualAttendanceModal';
import AssignLeaveModal from '../../components/attendance/AssignLeaveModal';
import AttendanceAuditReport from '../../components/attendance/AttendanceAuditReport';
import MonthlyHoursReport, { type EmployeeMonthlyData } from '../../components/attendance/MonthlyHoursReport';
import { BasicReportView, AttendanceLogView, MonthlyStatusView, SiteOtReportView, WorkHoursReportView, LeaveBalanceTrackerView } from '../../components/attendance/ReportHTMLViews';
import { calculateStatsForDateRange } from '../../utils/attendanceCalculations';
import {
    format,
    getDaysInMonth,
    addDays,
    startOfToday,
    endOfToday,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
    subDays,
    subMonths,
    startOfWeek,
    isAfter,
    isBefore,
    eachDayOfInterval,
    eachMonthOfInterval,
    differenceInHours,
    differenceInMinutes,
    isSaturday,
    isSunday,
    isSameDay,
    isWithinInterval,
    startOfDay,
    endOfDay
} from 'date-fns';
import { Loader2, Download, Users, UserCheck, UserX, UserMinus, Clock, BarChart3, TrendingUp, Calendar, FileDown, Mail, Send, Save, Filter, ChevronDown, Monitor, MapPin, Lock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
// Removed incorrect store imports
// Import reverse geocode utility to convert lat/lon into human addresses for logs
import { reverseGeocode } from '../../utils/locationUtils';
import { DateRangePicker, type Range, type RangeKeyDict } from 'react-date-range';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import DatePicker from '../../components/ui/DatePicker';
import Toast from '../../components/ui/Toast';
import Input from '../../components/ui/Input';
import StatCard from '../../components/ui/StatCard';
import Logo from '../../components/ui/Logo';
import { pdfLogoLocalPath } from '../../components/ui/logoData';
import { useSettingsStore } from '../../store/settingsStore';
import { useThemeStore } from '../../store/themeStore';
import { useLogoStore } from '../../store/logoStore';
import {
    exportAttendanceToExcel,
    exportMonthlyMatrixToExcel,
    exportGenericReportToExcel,
    exportLeaveBalancesToExcel,
    MonthlyReportRow,
    GenericReportColumn,
    LeaveBalanceRow
} from '../../utils/excelExport';
import { calculateWorkingHours, processDailyEvents, evaluateAttendanceStatus, getStaffCategory, isLateCheckIn } from '../../utils/attendanceCalculations';
import { getFieldStaffStatus } from '../../utils/fieldStaffTracking';
import { FIXED_HOLIDAYS } from '../../utils/constants';
import { exportToCsv } from '../../utils/fastExport';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { autoLockPreviousMonth } from '../../utils/autoLockService';
import {
    Chart,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    DoughnutController,
    ArcElement,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';

// Register the necessary components for Chart.js to work in a tree-shaken environment
Chart.register(
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    DoughnutController,
    ArcElement,
    Tooltip,
    Legend,
    Filler
);

const resolveUserLocation = (user: User, orgStructure: OrganizationGroup[]) => {
    if (user.location || user.locationName) return user.location || user.locationName;
    if (!user.societyId || orgStructure.length === 0) return '';

    for (const group of orgStructure) {
        for (const company of group.companies) {
            if (company.id === user.societyId) {
                return company.location || '';
            }
        }
    }
    return '';
};


// --- Reusable Dashboard Components ---
const BarChartSkeleton: React.FC = () => (
    <div className="h-64 md:h-[320px] w-full flex flex-col justify-between pt-4 animate-pulse mt-4">
        <div className="flex-1 flex items-end justify-around px-4 pb-4 border-b border-slate-100 dark:border-[#1a3d2c]">
            {[
                { p: 70, a: 30 },
                { p: 80, a: 20 },
                { p: 75, a: 25 },
                { p: 85, a: 15 }
            ].map((group, i) => (
                <div key={i} className="flex items-end gap-2.5 w-16 justify-center">
                    {/* Present Column Skeleton */}
                    <div className="w-6 bg-slate-200 dark:bg-emerald-900/35 rounded-t" style={{ height: `${group.p}%` }}></div>
                    {/* Absent Column Skeleton */}
                    <div className="w-6 bg-slate-100 dark:bg-emerald-950/15 rounded-t" style={{ height: `${group.a}%` }}></div>
                </div>
            ))}
        </div>
        <div className="flex justify-between items-center px-4 pt-3">
            <div className="h-3 w-12 bg-slate-100 dark:bg-[#123621] rounded"></div>
            <div className="h-3 w-12 bg-slate-100 dark:bg-[#123621] rounded"></div>
            <div className="h-3 w-12 bg-slate-100 dark:bg-[#123621] rounded"></div>
            <div className="h-3 w-12 bg-slate-100 dark:bg-[#123621] rounded"></div>
        </div>
    </div>
);

const LineChartSkeleton: React.FC = () => (
    <div className="h-64 md:h-[320px] w-full flex flex-col justify-between pt-4 animate-pulse">
        <div className="flex-1 relative border-b border-slate-100 dark:border-[#1a3d2c]">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path 
                    d="M 0 60 Q 25 20, 50 35 T 100 10 L 100 100 L 0 100 Z" 
                    className="fill-slate-100/70 dark:fill-emerald-950/20"
                />
                <path 
                    d="M 0 60 Q 25 20, 50 35 T 100 10" 
                    fill="none" 
                    className="stroke-slate-200 dark:stroke-emerald-900/30"
                    strokeWidth="2"
                />
            </svg>
        </div>
        <div className="flex justify-between items-center px-4 pt-3">
            <div className="h-3 w-12 bg-slate-100 dark:bg-[#123621] rounded"></div>
            <div className="h-3 w-12 bg-slate-100 dark:bg-[#123621] rounded"></div>
            <div className="h-3 w-12 bg-slate-100 dark:bg-[#123621] rounded"></div>
        </div>
    </div>
);

const ReportTableSkeleton: React.FC = () => (
    <div className="w-full space-y-4 p-4 animate-pulse">
        <div className="h-10 bg-slate-100 dark:bg-emerald-950/25 rounded-lg flex items-center px-4 justify-between">
            <div className="h-4 w-32 bg-slate-200 dark:bg-emerald-900/30 rounded"></div>
            <div className="h-4 w-20 bg-slate-200 dark:bg-emerald-900/30 rounded"></div>
            <div className="h-4 w-24 bg-slate-200 dark:bg-emerald-900/30 rounded"></div>
            <div className="h-4 w-16 bg-slate-200 dark:bg-emerald-900/30 rounded"></div>
        </div>
        {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 border-b border-slate-100 dark:border-[#1a3d2c] flex items-center px-4 justify-between">
                <div className="h-4 w-40 bg-slate-100 dark:bg-[#123621]/40 rounded"></div>
                <div className="h-4 w-16 bg-slate-100 dark:bg-[#123621]/40 rounded"></div>
                <div className="h-4 w-20 bg-slate-100 dark:bg-[#123621]/40 rounded"></div>
                <div className="h-4 w-12 bg-slate-100 dark:bg-[#123621]/40 rounded"></div>
            </div>
        ))}
    </div>
);

const ChartContainer: React.FC<{ title: string, icon: React.ElementType, children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className="bg-card p-4 md:p-6 rounded-xl shadow-card col-span-1">
        <div className="flex items-center mb-4">
            <Icon className="h-5 w-5 mr-3 text-muted" />
            <h3 className="font-semibold text-primary-text">{title}</h3>
        </div>
        <div className="h-64 md:h-80 relative">{children}</div>
    </div>
);

const AttendanceTrendChart: React.FC<{ data: { labels: string[], present: number[], absent: number[], wfh?: number[], onLeave?: number[] } }> = ({ data }) => {
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
                                backgroundColor: '#006B3F',
                                borderColor: '#005632',
                                borderWidth: 1,
                                borderRadius: 4,
                                categoryPercentage: 0.85,
                                barPercentage: 0.9,
                            },
                            {
                                label: 'WFH',
                                data: data.wfh || [],
                                backgroundColor: '#3B82F6',
                                borderColor: '#2563EB',
                                borderWidth: 1,
                                borderRadius: 4,
                                categoryPercentage: 0.85,
                                barPercentage: 0.9,
                            },
                            {
                                label: 'On Leave',
                                data: data.onLeave || [],
                                backgroundColor: '#F59E0B',
                                borderColor: '#D97706',
                                borderWidth: 1,
                                borderRadius: 4,
                                categoryPercentage: 0.85,
                                barPercentage: 0.9,
                            },
                            {
                                label: 'Absent',
                                data: data.absent,
                                backgroundColor: '#EF4444',
                                borderColor: '#DC2626',
                                borderWidth: 1,
                                borderRadius: 4,
                                categoryPercentage: 0.85,
                                barPercentage: 0.9,
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index' as const,
                            intersect: false,
                            axis: 'x' as const,
                        },
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } },
                            x: {
                                grid: { display: false },
                                ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: true,
                                    maxTicksLimit: 7,
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'bottom',
                                align: 'center',
                                labels: {
                                    usePointStyle: true,
                                    pointStyle: 'rectRounded',
                                    boxWidth: 12,
                                    padding: 20,
                                    font: {
                                        family: "'Manrope', sans-serif",
                                        size: 12,
                                    }
                                }
                            },
                            tooltip: {
                                mode: 'index' as const,
                                intersect: false,
                                backgroundColor: '#0F172A',
                                titleFont: { family: "'Manrope', sans-serif", weight: 'bold' as const },
                                bodyFont: { family: "'Manrope', sans-serif" },
                                cornerRadius: 8,
                                padding: 12,
                                displayColors: true,
                                boxPadding: 4,
                                callbacks: {
                                    title: (items: any[]) => {
                                        // Use dataIndex to pull the correct label from chart data
                                        // This avoids any mismatch from Chart.js internal label resolution
                                        if (items.length > 0) {
                                            const idx = items[0].dataIndex;
                                            return items[0].chart.data.labels?.[idx] as string ?? '';
                                        }
                                        return '';
                                    },
                                    label: (ctx: any) => {
                                        const label = ctx.dataset.label ?? '';
                                        const value = ctx.parsed.y ?? 0;
                                        return ` ${label}: ${value} employees`;
                                    }
                                }
                            }
                        }
                    },
                    plugins: [{
                        id: 'correctHoverIndex',
                        beforeEvent(chart: any, args: any) {
                            const event = args.event;
                            if (event.type !== 'mousemove' && event.type !== 'click') return;
                            
                            const xScale = chart.scales.x;
                            if (!xScale) return;
                            
                            // For category scales, use getValueForPixel to find the correct index
                            // based on the cursor's x position within the chart area
                            const mouseX = event.x;
                            if (mouseX < xScale.left || mouseX > xScale.right) return;
                            
                            const rawIdx = xScale.getValueForPixel(mouseX);
                            if (rawIdx == null) return;
                            
                            const idx = Math.max(0, Math.min(chart.data.labels.length - 1, Math.round(rawIdx)));
                            
                            // Store the correct index for tooltip use
                            (chart as any)._correctHoverIndex = idx;
                        },
                        beforeTooltipDraw(chart: any, args: any) {
                            const tooltip = args.tooltip;
                            if (!tooltip || tooltip.dataPoints?.length === 0) return;
                            
                            const correctIdx = (chart as any)._correctHoverIndex;
                            if (correctIdx == null) return;
                            
                            // If the tooltip's detected index doesn't match the correct one,
                            // update all tooltip data points to use the correct index
                            const currentIdx = tooltip.dataPoints[0]?.dataIndex;
                            if (currentIdx !== correctIdx) {
                                tooltip.title = [chart.data.labels[correctIdx]];
                                tooltip.dataPoints.forEach((dp: any, i: number) => {
                                    dp.dataIndex = correctIdx;
                                    dp.label = chart.data.labels[correctIdx];
                                    dp.parsed.y = chart.data.datasets[i]?.data[correctIdx] ?? 0;
                                    dp.formattedValue = String(dp.parsed.y);
                                    dp.raw = dp.parsed.y;
                                });
                                // Re-run label callbacks with corrected data
                                const callbacks = chart.options.plugins?.tooltip?.callbacks;
                                if (callbacks?.label) {
                                    tooltip.body = tooltip.dataPoints.map((dp: any) => ({
                                        before: [],
                                        lines: [callbacks.label(dp)],
                                        after: [],
                                    }));
                                }
                            }
                        }
                    }]
                });
            }
        }
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(data)]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <canvas ref={chartRef}></canvas>
        </div>
    );
};

const DepartmentAttendanceChart: React.FC<{ data: { labels: string[], values: number[] } }> = ({ data }) => {
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
                        datasets: [{
                            label: 'Present Employees',
                            data: data.values,
                            backgroundColor: '#10b981',
                            borderRadius: 4,
                            barPercentage: 0.6,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(128,128,128,0.1)' },
                                ticks: { stepSize: 1, precision: 0 }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { maxRotation: 45, minRotation: 0 }
                            }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: '#0F172A',
                                titleFont: { family: "'Manrope', sans-serif" },
                                bodyFont: { family: "'Manrope', sans-serif" },
                                cornerRadius: 8,
                                padding: 12,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(data)]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <canvas ref={chartRef}></canvas>
        </div>
    );
};

const ProductivityChart: React.FC<{ data: { labels: string[], hours: number[] } }> = ({ data }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        if (chartRef.current) {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                gradient.addColorStop(0, 'rgba(0, 93, 34, 0.4)');
                gradient.addColorStop(1, 'rgba(0, 93, 34, 0)');
                const isSingleDay = data.labels.length === 1;
                chartInstance.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            label: 'Average Hours Worked',
                            data: data.hours,
                            borderColor: '#005D22',
                            backgroundColor: gradient,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: '#005D22',
                            pointRadius: isSingleDay ? 6 : 0,
                            pointHoverRadius: 5,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index' as const,
                            intersect: false,
                            axis: 'x' as const,
                        },
                        scales: {
                            // Use whole-number tick steps on the y-axis so average hours are easy to read.  If
                            // fractional hours are returned they will be rounded when rendered.
                            y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(128,128,128,0.1)' },
                                ticks: {
                                    stepSize: 1,
                                    precision: 0,
                                    callback: (value: any) => {
                                        const num = typeof value === 'string' ? parseFloat(value) : (value as number);
                                        return Math.round(num);
                                    },
                                },
                            },
                            x: {
                                offset: false,
                                grid: { display: false },
                                ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: true,
                                    maxTicksLimit: 7,
                                },
                            },
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'bottom',
                                align: 'center',
                                labels: {
                                    usePointStyle: true,
                                    pointStyle: 'rectRounded',
                                    boxWidth: 12,
                                    padding: 20,
                                    font: {
                                        family: "'Manrope', sans-serif",
                                        size: 12,
                                    },
                                },
                            },
                            tooltip: {
                                mode: 'index' as const,
                                intersect: false,
                                backgroundColor: '#0F172A',
                                titleFont: { family: "'Manrope', sans-serif", weight: 'bold' as const },
                                bodyFont: { family: "'Manrope', sans-serif" },
                                cornerRadius: 8,
                                padding: 12,
                                displayColors: true,
                                boxPadding: 4,
                                callbacks: {
                                    title: (items: any[]) => items[0]?.label ?? '',
                                    label: (ctx: any) => {
                                        const value = ctx.parsed.y ?? 0;
                                        return ` Average Hours Worked: ${value}h`;
                                    }
                                }
                            },
                        },
                    }
                });
            }
        }
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(data)]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <canvas ref={chartRef}></canvas>
        </div>
    );
};
    
const RoleDistributionChart: React.FC<{ data: { labels: string[], values: number[] } }> = ({ data }) => {
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
                    type: 'doughnut',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            data: data.values,
                            backgroundColor: [
                                '#1d63ff', '#0eb161', '#f59e0b', '#df0637', '#8b5cf6', '#0ea5e9'
                            ],
                            borderWidth: 2,
                            borderColor: '#ffffff',
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    usePointStyle: true,
                                    padding: 20,
                                    font: { family: "'Inter', sans-serif", size: 12 }
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                titleFont: { size: 13, family: "'Inter', sans-serif" },
                                bodyFont: { size: 13, family: "'Inter', sans-serif" },
                                padding: 12,
                                cornerRadius: 8,
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
        <div className="w-full h-full flex flex-col pt-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-[15px] font-bold text-gray-800">Attendance by Role</h3>
            </div>
            <div className="flex-grow relative min-h-[200px]">
                <canvas ref={chartRef}></canvas>
            </div>
        </div>
    );
};




interface DashboardData {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    onLeaveToday: number;
    inactiveCount: number;
    attendanceTrend: { labels: string[]; present: number[]; absent: number[]; wfh: number[]; onLeave: number[] };
    productivityTrend: { labels: string[]; hours: number[] };
    lateArrivalsToday: number;
    pendingLeavesToday: number;
    approvedLeavesToday: number;
    roleDistribution?: { labels: string[]; values: number[] };
    departmentDistribution?: { labels: string[]; values: number[] };
    topPerformers?: { name: string; role: string; value: string }[];
}




// --- Sub-components ---

interface MailReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (payload: ReportEmailPayload) => void;
    isSending: boolean;
    reportType: AttendanceReportType;
    currentUserEmail: string;
}

const MailReportModal: React.FC<MailReportModalProps> = ({ isOpen, onClose, onSend, isSending, reportType, currentUserEmail }) => {
    const [email, setEmail] = useState(currentUserEmail);
    const [subject, setSubject] = useState(`${reportType.replace(/_/g, ' ').toUpperCase()} Attendance Report`);
    const [message, setMessage] = useState(
        reportType === 'monthly' 
        ? `Dear Management,\n\nThis is the consolidated attendance summary for the period of April 2026. It covers overall employee presence across all active members of the staff.\n\nPlease review the detailed monthly attendance grid below for any discrepancies.`
        : `Please find attached the ${reportType.replace(/_/g, ' ')} attendance report.`
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0b291a] w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-[#1a3d2c] overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 dark:border-[#1a3d2c]">
                    <div className="flex items-center gap-3 text-primary-text mb-1">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                            <Mail className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-bold">Mail Report</h3>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">The current report will be generated and sent as a PDF attachment.</p>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Recipient's Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter email address"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#1a3d2c] bg-gray-50 dark:bg-[#041b0f] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Subject</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#1a3d2c] bg-gray-50 dark:bg-[#041b0f] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Additional Message (Optional)</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#1a3d2c] bg-gray-50 dark:bg-[#041b0f] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                        />
                    </div>
                </div>

                <div className="p-6 bg-gray-50 dark:bg-[#041b0f]/50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a3d2c] transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={isSending || !email}
                        onClick={() => onSend({ to: [email], subject, html: message, triggerType: 'manual' })}
                        className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Sending...</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-5 h-5" />
                                <span>Send Report</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DashboardStatCard: React.FC<{
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    label: string;
    value: string | number;
    color: string;
    suffix?: string;
    trend?: string;
}> = ({ icon: Icon, label, value, color, suffix, trend }) => {
    return (
        <div className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 bg-[#182a20] md:bg-white rounded-3xl border border-[#2a4536] md:border-border p-4 md:p-5 shadow-sm md:shadow-sm">
            {/* Background Decorative Icon */}
            <div className="absolute top-0 right-0 p-3 transition-opacity opacity-[0.05] md:opacity-[0.05] group-hover:opacity-[0.08] max-md:opacity-[0.03] pointer-events-none">
                <Icon className="w-16 h-16 md:w-20 md:h-20 text-white md:text-gray-400" />
            </div>
            
            {/* Card Content */}
            <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
                {/* Icon Container with subtle background tint */}
                <div 
                    className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-inner animate-fade-in" 
                    style={{ backgroundColor: `${color}15` }}
                >
                    <Icon className="w-5 h-5 md:w-6 md:h-6" style={{ color }} />
                </div>
                
                {/* Labels and Value */}
                <div className="min-w-0">
                    <p className="text-[9px] md:text-xs font-black md:font-bold uppercase tracking-widest truncate text-gray-400 md:text-muted max-md:text-white/40">
                        {label}
                    </p>
                    <p className="text-lg md:text-2xl font-black mt-0.5 text-white md:text-primary-text max-md:text-white">
                        {value}
                        {suffix && (
                            <span className="text-[10px] md:text-sm font-bold ml-1 md:ml-1.5 text-gray-400 md:text-muted max-md:text-white/30">
                                {suffix}
                            </span>
                        )}
                    </p>
                </div>
            </div>
            
            {/* Trend Indicator */}
            {trend && (
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
                    <p className="text-[8px] md:text-[10px] font-black md:font-bold uppercase tracking-tighter text-gray-400 md:text-muted max-md:text-white/20">
                        {trend}
                    </p>
                </div>
            )}
        </div>
    );
};


const TodayMetricsRow = ({ data, loading }: { data: TodayMetrics | null, loading: boolean }) => {
    if (loading || !data) return (
        <>
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 w-full bg-[#0b291a] md:bg-gray-100 animate-pulse rounded-xl"></div>)}
        </>
    );
    return (
        <>
            <DashboardStatCard icon={UserCheck} label="Total Present" value={data.present_today} color="#10b981" suffix="Employees" />
            <DashboardStatCard icon={UserX} label="Total Absent" value={data.absent_today} color="#df0637" suffix="Employees" />
            <DashboardStatCard icon={Clock} label="Late Arrivals" value={data.late_arrivals_today} color="#f59e0b" suffix="Employees" />
            <DashboardStatCard icon={Users} label="Pending Leaves" value={data.pending_leaves} color="#3b82f6" suffix="Pending" />
        </>
    );
};

const AttendanceCharts = ({ data, loading }: { data: ReturnType<typeof buildChartDatasets> | null, loading: boolean }) => {
    if (loading || !data) return <BarChartSkeleton />;
    return (
        <div className="h-64 md:h-[320px] relative mt-4">
            <AttendanceTrendChart data={{ 
                labels: data.labels, 
                present: data.presentTrend, 
                absent: data.absentTrend,
                wfh: (data as any).wfhTrend,
                onLeave: (data as any).onLeaveTrend
            }} />
        </div>
    );
};

const TopPerformersList = ({ data, loading }: { data: TopPerformer[], loading: boolean }) => {
    if (loading) return <div className="h-[260px] bg-[#0b291a] md:bg-gray-100 animate-pulse rounded-xl"></div>;
    return (
        <div className="flex flex-col gap-4 overflow-y-auto h-full pr-2">
            <h3 className="text-sm font-semibold text-white md:text-gray-900 sticky top-0 bg-[#0b291a] md:bg-white pb-2 z-10">Top Performers</h3>
            {data.map(p => (
                <div key={p.user_id} className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-white md:text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.role_name}</div>
                    </div>
                    <div className="text-sm font-bold text-[#22c55e]">{p.total_hours.toFixed(1)}h</div>
                </div>
            ))}
        </div>
    );
};

const AttendanceDashboard: React.FC = () => {
    const isSmallScreen = useMediaQuery('(max-width: 639px)');
    const { user } = useAuthStore();
    const currentUserRole = user?.role;
    const { permissions } = usePermissionsStore();    const isOfficeUser = (role?: string) => getStaffCategory(role, undefined, { attendance }) === 'office';

    const { attendance, recurringHolidays, officeHolidays, fieldHolidays, siteHolidays } = useSettingsStore();

    const [users, setUsers] = useState<User[]>([]);
    const usersRef = useRef<User[]>([]);
    useEffect(() => { usersRef.current = users; }, [users]);

    const [attendanceEvents, setAttendanceEvents] = useState<AttendanceEvent[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [userHolidaysPool, setUserHolidaysPool] = useState<UserHoliday[]>([]);
    // Map of userId -> FieldAttendanceViolation[] for field staff
    const [fieldViolationsMap, setFieldViolationsMap] = useState<Record<string, FieldAttendanceViolation[]>>({});
    const [allRoles, setAllRoles] = useState<Role[]>([]);
        const [todayMetrics,  setTodayMetrics]  = useState<TodayMetrics | null>(null);
    const [chartDatasets, setChartDatasets] = useState<ReturnType<typeof buildChartDatasets> | null>(null);
    const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);

    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [recentlyActiveUserIds, setRecentlyActiveUserIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isReportLoading, setIsReportLoading] = useState(false);
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
    const [scopedSettings, setScopedSettings] = useState<any[]>([]);
    const [exportedMonthlyData, setExportedMonthlyData] = useState<EmployeeMonthlyData[]>([]);
    const [monthlyDataMap, setMonthlyDataMap] = useState<Record<string, EmployeeMonthlyData[]>>({});
    const [kioskDevices, setKioskDevices] = useState<KioskDevice[]>([]);

    const [dateRange, setDateRange] = useState<Range>({
        startDate: startOfToday(),
        endDate: endOfToday(),
        key: 'selection'
    });

    const dateRangeArray = useMemo(() => [dateRange], [dateRange]);

    const [activeDateFilter, setActiveDateFilter] = useState('Today');
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const datePickerRef = useRef<HTMLDivElement>(null);

    const currentLogo = useLogoStore(state => state.currentLogo);

    // Fetch logo on mount or when currentLogo changes
    useEffect(() => {
        const fetchLogo = async () => {
            let logoBase64 = '';

            if (currentLogo && currentLogo.startsWith('data:image')) {
                logoBase64 = currentLogo;
            } else {
                 const logoUrl = (currentLogo && (currentLogo.startsWith('http') || currentLogo.startsWith('/'))) ? currentLogo : pdfLogoLocalPath;
                 if (logoUrl) {
                    try {
                        const response = await fetch(logoUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            logoBase64 = await new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.readAsDataURL(blob);
                            });
                        }
                    } catch (e) {
                         console.error("Logo fetch failed", e);
                    }
                 }
            }
            setLogoForPdf(logoBase64);
        };
        fetchLogo();
    }, [currentLogo]);

    const [selectedUser, setSelectedUser] = useState<string>('all');
    const [selectedRole, setSelectedRole] = useState<string>('all');
    const [selectedCompany, setSelectedCompany] = useState<string>('all');
    const [selectedSite, setSelectedSite] = useState<string>('all');
    const [selectedLocation, setSelectedLocation] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [societies, setSocieties] = useState<any[]>([]);
    const [orgStructure, setOrgStructure] = useState<OrganizationGroup[]>([]);
    

    
    // Leave Balance Tracker States
    const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
    const [isFetchingLeaveBalances, setIsFetchingLeaveBalances] = useState(false);

    // Manual Entry State
    const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
    const [isAssignLeaveModalOpen, setIsAssignLeaveModalOpen] = useState(false);
    const [isMailModalOpen, setIsMailModalOpen] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [previewMode, setPreviewMode] = useState<'summary' | 'full'>('summary');
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [selectedRecordType, setSelectedRecordType] = useState<string>('all');
    const [reportType, setReportType] = useState<AttendanceReportType>('basic');
    const [logoForPdf, setLogoForPdf] = useState<string>('');
    const [accessRequests, setAccessRequests] = useState<any[]>([]);
    const [isFetchingRequests, setIsFetchingRequests] = useState(false);
    const [unlockedReports, setUnlockedReports] = useState<Record<string, number>>({});
    const [passcodeInput, setPasscodeInput] = useState('');
    const [passcodeError, setPasscodeError] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [isExportingLeaves, setIsExportingLeaves] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [reportPageSize, setReportPageSize] = useState<number>(20);

    // Background Auto-locking check for immediately previous month
    useEffect(() => {
        const checkAndLockPreviousMonth = async () => {
            if (!user || user.role !== 'admin') return;

            // Date math to get the previous month
            const today = new Date();
            let prevMonth = today.getMonth(); // 0-indexed month of today is the 1-indexed value of previous month (e.g. June (5) -> May (5) which is 5th month).
            let prevYear = today.getFullYear();
            if (prevMonth === 0) { // January -> December of last year
                prevMonth = 12;
                prevYear -= 1;
            }

            const sessionKey = `autolock_checked_${prevYear}_${prevMonth}`;
            if (sessionStorage.getItem(sessionKey)) return;

            try {
                // Check if already locked
                const isLocked = await api.isMonthLocked(prevYear, prevMonth);
                if (!isLocked) {
                    setToast({
                        message: `Locking previous month (${format(new Date(prevYear, prevMonth - 1, 1), 'MMMM yyyy')}) in the background...`,
                        type: 'success'
                    });

                    const result = await autoLockPreviousMonth(prevYear, prevMonth, user);
                    
                    if (result.success) {
                        let msg = `Successfully locked ${format(new Date(prevYear, prevMonth - 1, 1), 'MMMM yyyy')}. Frozen ${result.lockedCount} records.`;
                        if (result.warnings && result.warnings.length > 0) {
                            msg += ` Warnings for: ${result.warnings.join(', ')}`;
                        }
                        setToast({ message: msg, type: 'success' });
                    } else {
                        setToast({ message: `Auto-lock failed: ${result.message}`, type: 'error' });
                    }
                }
                sessionStorage.setItem(sessionKey, 'true');
            } catch (err: any) {
                console.error('[AutoLock Dashboard] Background month lock check failed:', err);
                sessionStorage.setItem(sessionKey, 'true'); // still mark to avoid infinite looping in error state
            }
        };

        checkAndLockPreviousMonth();
    }, [user]);

    const generateDeterministicPasscode = (id: string): string => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            const char = id.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0;
        }
        const code = Math.abs(hash) % 1000000;
        return code.toString().padStart(6, '0');
    };

    const extractPasscode = (comments?: string): string => {
        if (!comments) return '';
        const match = comments.match(/Passcode:\s*(\d{6})/i);
        return match ? match[1] : '';
    };

    const fetchAccessRequests = useCallback(async () => {
        if (!user || user.role !== 'hr_ops') return;
        setIsFetchingRequests(true);
        try {
            const { data, error } = await supabase
                .from('ops_approval_requests')
                .select('*')
                .eq('requested_by', user.id)
                .eq('module_name', 'ReportAccess')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setAccessRequests(data || []);

            // Auto-lock reports if the admin revoked (Rejected) the latest request
            if (data) {
                const saved = localStorage.getItem(`report_unlocked_${user.id}`);
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        const reportUuids: Record<string, string> = {
                            basic: '00000000-0000-0000-0000-000000000000',
                            monthly: '44444444-4444-4444-4444-444444444444',
                            leave_balance: '55555555-5555-5555-5555-555555555555',
                            site_ot: '66666666-6666-6666-6666-666666666666',
                            work_hours: '11111111-1111-1111-1111-111111111111',
                            log: '22222222-2222-2222-2222-222222222222',
                            audit: '33333333-3333-3333-3333-333333333333'
                        };
                        let changed = false;
                        Object.keys(parsed).forEach(type => {
                            const targetUuid = reportUuids[type];
                            const latestRequest = data.find((r: any) => r.record_id === targetUuid);
                            if (latestRequest && latestRequest.status !== 'Approved') {
                                delete parsed[type];
                                changed = true;
                            }
                        });
                        if (changed) {
                            setUnlockedReports(parsed);
                            localStorage.setItem(`report_unlocked_${user.id}`, JSON.stringify(parsed));
                        }
                    } catch (e) {
                        console.error('Error auto-locking:', e);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch access requests:', err);
        } finally {
            setIsFetchingRequests(false);
        }
    }, [user]);

    useEffect(() => {
        if (user && user.role === 'hr_ops') {
            fetchAccessRequests();

            const channel = supabase.channel('access-requests-dashboard')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'ops_approval_requests', filter: `requested_by=eq.${user.id}` },
                    () => {
                        fetchAccessRequests();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [user, fetchAccessRequests]);

    useEffect(() => {
        if (!user?.id) return;
        try {
            const saved = localStorage.getItem(`report_unlocked_${user.id}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                const now = Date.now();
                const valid: Record<string, number> = {};
                let changed = false;
                Object.keys(parsed).forEach(k => {
                    if (now - parsed[k] < 2 * 60 * 60 * 1000) {
                        valid[k] = parsed[k];
                    } else {
                        changed = true;
                    }
                });
                setUnlockedReports(valid);
                if (changed) {
                    localStorage.setItem(`report_unlocked_${user.id}`, JSON.stringify(valid));
                }
            }
        } catch (e) {
            console.error('Failed to load unlocked reports:', e);
        }
    }, [user?.id]);

    const notifyAdminsOfRequest = async (reportName: string) => {
        try {
            const { data: admins, error: adminError } = await supabase
                .from('users')
                .select('id')
                .in('role_id', ['admin', 'super_admin']);
            
            if (adminError) throw adminError;
            if (!admins || admins.length === 0) return;

            const adminIds = admins.map(a => a.id);
            const message = `${user?.name || 'User'} requested passcode for ${reportName}`;
            const link = '/enterprise/approvals';

            const notificationRecords = adminIds.map(adminId => ({
                user_id: adminId,
                message,
                type: 'approval_request',
                link_to: link,
                severity: 'High',
                metadata: {
                    employeeName: user?.name,
                    employeePhoto: user?.photoUrl,
                    employeeId: user?.id,
                    link
                }
            }));

            const { error: insertError } = await supabase
                .from('notifications')
                .insert(notificationRecords);
            
            if (insertError) throw insertError;

            await supabase.functions.invoke('send-notification', {
                body: {
                    userIds: adminIds,
                    title: 'Report Passcode Request',
                    message,
                    data: {
                        link,
                        employeeId: user?.id
                    }
                }
            });
        } catch (err) {
            console.error('Failed to notify admins of passcode request:', err);
        }
    };

    const handleRequestAccess = async (type: string) => {
        if (!user?.id) return;
        setIsFetchingRequests(true);
        try {
            const reportUuids: Record<string, string> = {
                basic: '00000000-0000-0000-0000-000000000000',
                monthly: '44444444-4444-4444-4444-444444444444',
                leave_balance: '55555555-5555-5555-5555-555555555555',
                site_ot: '66666666-6666-6666-6666-666666666666',
                work_hours: '11111111-1111-1111-1111-111111111111',
                log: '22222222-2222-2222-2222-222222222222',
                audit: '33333333-3333-3333-3333-333333333333'
            };
            const reportNames: Record<string, string> = {
                basic: 'Basic Report',
                monthly: 'Monthly Summary',
                leave_balance: 'Leave Balance Tracker',
                site_ot: 'Site OT Report',
                work_hours: 'Work Hours Report',
                log: 'Attendance Logs',
                audit: 'Audit Logs'
            };

            const { error } = await supabase
                .from('ops_approval_requests')
                .insert({
                    module_name: 'ReportAccess',
                    record_id: reportUuids[type],
                    title: `Access Request: ${reportNames[type]} for ${user.name}`,
                    required_role: 'admin',
                    requested_by: user.id,
                    approval_stage: 1,
                    status: 'Pending'
                });
            if (error) throw error;
            
            // Notify all admins of the new request
            await notifyAdminsOfRequest(reportNames[type]);
            
            setToast({ message: 'Passcode request submitted successfully to admin.', type: 'success' });
            await fetchAccessRequests();
        } catch (err: any) {
            console.error('Request access failed:', err);
            setToast({ message: err.message || 'Failed to submit request.', type: 'error' });
        } finally {
            setIsFetchingRequests(false);
        }
    };

    const handleUnlockReport = (type: string, correctCode: string) => {
        if (passcodeInput.trim() === correctCode) {
            const now = Date.now();
            const updated = { ...unlockedReports, [type]: now };
            setUnlockedReports(updated);
            if (user?.id) {
                localStorage.setItem(`report_unlocked_${user.id}`, JSON.stringify(updated));
            }
            setPasscodeInput('');
            setPasscodeError('');
            setToast({ message: 'Report unlocked successfully! Access valid for 2 hours.', type: 'success' });
        } else {
            setPasscodeError('Invalid passcode. Please request correct code or try again.');
        }
    };

    const getReportLabel = (val: string, name: string) => {
        if (user?.role === 'hr_ops') {
            let diffDays = 0;
            if (pendingDateRange.startDate && pendingDateRange.endDate) {
                const diffMs = Math.abs(pendingDateRange.endDate.getTime() - pendingDateRange.startDate.getTime());
                diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            }
            if (diffDays <= 5) return name;

            const isUnlocked = unlockedReports[val] && (Date.now() - unlockedReports[val] < 2 * 60 * 60 * 1000);
            return `${isUnlocked ? '🔓' : '🔒'} ${name}`;
        }
        return name;
    };

    const renderLockPanel = () => {
        const reportUuids: Record<string, string> = {
            basic: '00000000-0000-0000-0000-000000000000',
            monthly: '44444444-4444-4444-4444-444444444444',
            leave_balance: '55555555-5555-5555-5555-555555555555',
            site_ot: '66666666-6666-6666-6666-666666666666',
            work_hours: '11111111-1111-1111-1111-111111111111',
            log: '22222222-2222-2222-2222-222222222222',
            audit: '33333333-3333-3333-3333-333333333333'
        };
        const reportNames: Record<string, string> = {
            basic: 'Basic Report',
            monthly: 'Monthly Summary',
            leave_balance: 'Leave Balance Tracker',
            site_ot: 'Site OT Report',
            work_hours: 'Work Hours Report',
            log: 'Attendance Logs',
            audit: 'Audit Logs'
        };

        const targetUuid = reportUuids[reportType];
        const latestRequest = accessRequests.find(r => r.record_id === targetUuid);
        
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center min-h-[350px] bg-white border border-gray-200 rounded-2xl shadow-sm max-w-lg mx-auto my-8 relative overflow-hidden">
                <div className="p-4 bg-emerald-50 text-[#22c55e] rounded-full border border-emerald-100 mb-6">
                    {latestRequest?.status === 'Approved' ? (
                        <CheckCircle2 className="h-12 w-12 text-[#22c55e]" />
                    ) : latestRequest?.status === 'Pending' ? (
                        <Clock className="h-12 w-12 text-amber-500 animate-pulse" />
                    ) : latestRequest?.status === 'Rejected' ? (
                        <AlertCircle className="h-12 w-12 text-red-500" />
                    ) : (
                        <Lock className="h-12 w-12 text-[#22c55e]" />
                    )}
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2 uppercase tracking-wide">
                    {reportNames[reportType]} is Locked
                </h3>
                
                <p className="text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
                    This report contains sensitive operational metrics. You must request a temporary passcode from the administrator to view this data.
                </p>

                {isFetchingRequests ? (
                    <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Checking request status...
                    </div>
                ) : !latestRequest ? (
                    <button
                        type="button"
                        onClick={() => handleRequestAccess(reportType)}
                        className="px-8 py-3 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold flex items-center gap-2 shadow-sm hover:shadow-emerald-500/10 transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                        Request Passcode
                    </button>
                ) : latestRequest.status === 'Pending' ? (
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl font-semibold text-sm">
                            <Clock className="h-4 w-4 animate-spin" /> Pending Admin Approval
                        </div>
                        <p className="text-xs text-gray-400">
                            Submitted on {new Date(latestRequest.created_at).toLocaleString('en-IN')}. Please wait or notify your admin.
                        </p>
                        <button
                            type="button"
                            onClick={fetchAccessRequests}
                            className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mx-auto hover:underline hover:text-[#16a34a]"
                        >
                            <RefreshCw className="h-3 w-3" /> Refresh Status
                        </button>
                    </div>
                ) : latestRequest.status === 'Approved' ? (
                    <div className="w-full space-y-6">
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                            <p className="text-sm text-emerald-800 font-bold mb-1 flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Request Approved
                            </p>
                            <p className="text-xs text-emerald-600 font-medium">
                                Check your notifications or messages for the passcode.
                            </p>
                        </div>

                        <div className="space-y-3 max-w-sm mx-auto">
                            <input
                                type="text"
                                maxLength={6}
                                placeholder="Enter 6-digit passcode"
                                value={passcodeInput}
                                onChange={e => {
                                    setPasscodeInput(e.target.value);
                                    setPasscodeError('');
                                }}
                                className="w-full text-center py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-lg font-mono font-bold tracking-widest focus:ring-2 focus:ring-[#22c55e] outline-none"
                            />
                            {passcodeError && (
                                <p className="text-xs text-red-500 font-semibold">{passcodeError}</p>
                            )}
                            <button
                                type="button"
                                onClick={() => handleUnlockReport(reportType, extractPasscode(latestRequest.comments) || generateDeterministicPasscode(latestRequest.id))}
                                className="w-full py-3 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold shadow-sm hover:shadow-emerald-500/10 transition-all hover:scale-[1.01] active:scale-[0.99]"
                            >
                                Unlock Report
                            </button>
                        </div>
                    </div>
                ) : latestRequest.status === 'Rejected' ? (
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl font-semibold text-sm">
                            Request Rejected
                        </div>
                        {latestRequest.comments && (
                            <p className="text-xs text-gray-400 italic">
                                "{latestRequest.comments}"
                            </p>
                        )}
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => handleRequestAccess(reportType)}
                                className="px-6 py-2.5 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold shadow-sm transition-all active:scale-[0.99]"
                            >
                                Submit New Request
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    };

    // --- Pending Filter States (to implement Apply button logic) ---
    const [pendingDateRange, setPendingDateRange] = useState<Range>(dateRange);
    const [pendingActiveDateFilter, setPendingActiveDateFilter] = useState(activeDateFilter);
    const [pendingReportType, setPendingReportType] = useState<AttendanceReportType>(reportType);
    const [pendingSelectedCompany, setPendingSelectedCompany] = useState(selectedCompany);
    const [pendingSelectedSite, setPendingSelectedSite] = useState(selectedSite);
    const [pendingSelectedRole, setPendingSelectedRole] = useState(selectedRole);
    const [pendingSelectedUser, setPendingSelectedUser] = useState(selectedUser);
    const [pendingSelectedLocation, setPendingSelectedLocation] = useState(selectedLocation);
    const [pendingSelectedStatus, setPendingSelectedStatus] = useState(selectedStatus);
    const [pendingSelectedRecordType, setPendingSelectedRecordType] = useState(selectedRecordType);
    const [pendingReportPageSize, setPendingReportPageSize] = useState(reportPageSize);
    const [isFiltersDirty, setIsFiltersDirty] = useState(false);

    // Dynamic lists derived from users (only show companies/sites that have users)
    const activeOrganizations = useMemo(() => {
        const comps: any[] = [];
        orgStructure.forEach(g => {
            if (g.companies) comps.push(...g.companies);
        });
        
        let filteredComps = comps;
        if (pendingSelectedLocation !== 'all') {
            filteredComps = comps.filter(c => c.location && c.location.toLowerCase() === pendingSelectedLocation.toLowerCase());
        }
        
        if (isAdmin(user?.role) || user?.role?.toLowerCase().replace(/_/g, ' ') === 'hr ops') {
            return filteredComps.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }
        
        const companyIds = new Set(users.map(u => u.societyId).filter(Boolean));
        return filteredComps
            .filter(c => companyIds.has(c.id))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [users, orgStructure, user, pendingSelectedLocation]);

    const activeSocieties = useMemo(() => {
        const ents: any[] = [];
        orgStructure.forEach(g => {
            if (g.companies) {
                g.companies.forEach((c: any) => {
                    if (c.entities) ents.push(...c.entities);
                });
            }
        });
        
        let filteredEnts = ents;
        if (pendingSelectedLocation !== 'all') {
            const companyIdsInLocation = new Set(
                activeOrganizations.map(o => o.id)
            );
            filteredEnts = ents.filter(e => companyIdsInLocation.has(e.companyId));
        }
        
        if (isAdmin(user?.role) || user?.role?.toLowerCase().replace(/_/g, ' ') === 'hr ops') {
            return filteredEnts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }
        
        const siteIds = new Set<string>();
        users.forEach(u => {
            if (u.organizationId) {
                u.organizationId.split(',').forEach(id => siteIds.add(id.trim()));
            }
        });
        return filteredEnts
            .filter(e => siteIds.has(e.id))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [users, orgStructure, user, pendingSelectedLocation, activeOrganizations]);
    
    const activeLocations = useMemo(() => {
        const locations = new Set<string>();
        orgStructure.forEach(g => {
            if (g.companies) {
                g.companies.forEach((c: any) => {
                    if (c.location) locations.add(c.location);
                });
            }
        });
        users.forEach(u => {
            const loc = resolveUserLocation(u, orgStructure);
            if (loc) locations.add(loc);
        });
        return Array.from(locations).filter(Boolean).sort();
    }, [orgStructure, users]);

    const resolvedFilters = useMemo(() => ({
        company: selectedCompany !== 'all' ? (activeOrganizations.find(org => org.id === selectedCompany)?.name || selectedCompany) : undefined,
        location: selectedLocation !== 'all' ? selectedLocation : undefined,
        site: selectedSite !== 'all' ? (activeSocieties.find(s => s.id === selectedSite)?.name || selectedSite) : undefined,
        role: selectedRole !== 'all' ? selectedRole : undefined,
    }), [selectedCompany, selectedLocation, selectedSite, selectedRole, activeOrganizations, activeSocieties]);

    // Watch for changes in pending filters vs applied filters
    useEffect(() => {
        const isDirty = 
            pendingSelectedCompany !== selectedCompany ||
            pendingSelectedSite !== selectedSite ||
            pendingSelectedRole !== selectedRole ||
            pendingSelectedUser !== selectedUser ||
            pendingSelectedLocation !== selectedLocation ||
            pendingSelectedStatus !== selectedStatus ||
            pendingSelectedRecordType !== selectedRecordType ||
            pendingReportType !== reportType ||
            pendingReportPageSize !== reportPageSize ||
            pendingDateRange.startDate?.getTime() !== dateRange.startDate?.getTime() ||
            pendingDateRange.endDate?.getTime() !== dateRange.endDate?.getTime();
            
        setIsFiltersDirty(isDirty);
    }, [
        pendingSelectedCompany, selectedCompany,
        pendingSelectedSite, selectedSite,
        pendingSelectedRole, selectedRole,
        pendingSelectedUser, selectedUser,
        pendingSelectedStatus, selectedStatus,
        pendingSelectedRecordType, selectedRecordType,
        pendingReportType, reportType,
        pendingReportPageSize, reportPageSize,
        pendingDateRange, dateRange
    ]);

    const handleApplyFilters = () => {
        setDateRange(pendingDateRange);
        setActiveDateFilter(pendingActiveDateFilter);
        setReportType(pendingReportType);
        setSelectedCompany(pendingSelectedCompany);
        setSelectedSite(pendingSelectedSite);
        setSelectedLocation(pendingSelectedLocation);
        setSelectedRole(pendingSelectedRole);
        setSelectedUser(pendingSelectedUser);
        setSelectedStatus(pendingSelectedStatus);
        setSelectedRecordType(pendingSelectedRecordType);
        setReportPageSize(pendingReportPageSize);
        
        setIsFiltersDirty(false);
        setIsDatePickerOpen(false);
        setToast({ message: 'Filters applied successfully', type: 'success' });
    };


    // --- Fetch Audit Logs ---
    const fetchAuditLogs = useCallback(async () => {
        if (!dateRange.startDate || !dateRange.endDate) return;

        try {
            let query = supabase
                .from('attendance_audit_logs')
                .select('*')
                .order('created_at', { ascending: false });

            query = query.gte('created_at', startOfDay(dateRange.startDate).toISOString());
            query = query.lte('created_at', endOfDay(dateRange.endDate).toISOString());

            const { data: logsData, error: logsError } = await query.limit(reportPageSize);

            if (logsError) throw logsError;

            // Fetch users for mapping names
            const userIds = new Set<string>();
            logsData?.forEach((log: any) => {
                if (log.performed_by) userIds.add(log.performed_by);
                if (log.target_user_id) userIds.add(log.target_user_id);
            });

            if (userIds.size > 0) {
                 const { data: usersData } = await supabase
                    .from('users')
                    .select('id, name, photo_url')
                    .in('id', Array.from(userIds));
                
                const userMap = new Map<string, { name: string; photoUrl?: string }>();
                usersData?.forEach((u: any) => userMap.set(u.id, { name: u.name, photoUrl: u.photo_url }));

                const formattedLogs = logsData.map((log: any) => ({
                    ...log,
                    performer_name: userMap.get(log.performed_by)?.name || 'Unknown',
                    performer_photo: userMap.get(log.performed_by)?.photoUrl || null,
                    target_name: userMap.get(log.target_user_id)?.name || 'Unknown',
                    target_photo: userMap.get(log.target_user_id)?.photoUrl || null
                }));
                setAuditLogs(formattedLogs);
            } else {
                setAuditLogs(logsData || []);
            }
        } catch (error) {
            console.error("Error fetching audit logs", error);
        }
    }, [dateRange.startDate, dateRange.endDate, reportPageSize]);

    useEffect(() => {
        if (reportType === 'audit') {
            fetchAuditLogs();
        }
    }, [reportType, reportPageSize, fetchAuditLogs, dateRange.startDate, dateRange.endDate]);

    let appliedDiffDays = 0;
    if (dateRange.startDate && dateRange.endDate) {
        const diffMs = Math.abs(dateRange.endDate.getTime() - dateRange.startDate.getTime());
        appliedDiffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
    
    const isReportLocked = user?.role === 'hr_ops' && 
                           appliedDiffDays > 5 &&
                           (!unlockedReports[reportType] || Date.now() - unlockedReports[reportType] >= 2 * 60 * 60 * 1000);

    const canDownloadReport = user && (isAdmin(user.role) || permissions[user.role]?.includes('download_attendance_report')) && !isReportLocked;
    const canViewAllAttendance = user && (isAdmin(user.role) || permissions[user.role]?.includes('view_all_attendance'));
    
    // Reporting Manager logic
    const [isReportingManager, setIsReportingManager] = useState(false);
    const isClientOrManagerView = user?.role === 'client' || user?.role === 'manager';
    const isEmployeeView = !canViewAllAttendance && !isReportingManager && !isClientOrManagerView;

    // Check if user is a reporting manager
    useEffect(() => {
        const checkManagerStatus = async () => {
            if (!user) return;
            if (isAdmin(user.role)) {
                setIsReportingManager(true);
                return;
            }
            try {
                const team = await api.getTeamMembers(user.id);
                if (team && team.length > 0) {
                    setIsReportingManager(true);
                }
            } catch (err) {
                console.warn("Failed to check reporting manager status", err);
            }
        };
        checkManagerStatus();
    }, [user]);

    // Employee View State
    const [employeeStats, setEmployeeStats] = useState({ present: 0, absent: 0, ot: 0, compOff: 0, elBalance: 0, woBalance: 0 });
    const [employeeLogs, setEmployeeLogs] = useState<any[]>([]);

    const resolveUserRules = useCallback((userId?: string, userCategoryOverride?: 'office' | 'field' | 'site') => {
        const targetUser = userId ? users.find(u => u.id === userId) : user;
        if (!targetUser) return attendance.office;

        const userCategory = userCategoryOverride || (isOfficeUser(targetUser.role) ? 'office' : 'field');

        // Priority order: Entity > Company > Location > Global
        
        // 1. Entity (Site)
        const entitySetting = scopedSettings.find(s => s.scope_type === 'entity' && s.scope_id === targetUser.organizationId);
        if (entitySetting) return entitySetting.settings[userCategory] || attendance[userCategory];

        // 2. Society (Company)
        const org = organizations.find(o => o.id === targetUser.organizationId);
        const companyId = org?.parentId;
        if (companyId) {
            const companySetting = scopedSettings.find(s => s.scope_type === 'company' && s.scope_id === companyId);
            if (companySetting) return companySetting.settings[userCategory] || attendance[userCategory];
        }

        // 3. Location
        if (targetUser.location) {
            const locationSetting = scopedSettings.find(s => s.scope_type === 'location' && s.scope_id === targetUser.location);
            if (locationSetting) return locationSetting.settings[userCategory] || attendance[userCategory];
        }

        // 4. Global Fallback
        return attendance[userCategory];
    }, [scopedSettings, organizations, attendance, users, user]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
                setIsDatePickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (canDownloadReport || isReportingManager) {
            const loadInitialData = async () => {
                try {
                    let initialUsers = [];
                    if (isAdmin(user?.role) || user?.role?.toLowerCase().replace(/_/g, ' ') === 'hr ops') {
                        initialUsers = await api.getUsers();
                    } else if (user) {
                        // Managers see their team, normal users see themselves
                        initialUsers = await api.getTeamMembers(user.id);
                        const self = await api.getUserById(user.id);
                        if (self && !initialUsers.find(u => u.id === self.id)) {
                            initialUsers.push(self);
                        }
                    }
                    
                    setUsers(initialUsers);
                    usersRef.current = initialUsers;
                    
                    if (isAdmin(user?.role) || user?.role?.toLowerCase().replace(/_/g, ' ') === 'hr ops') {
                        api.getOrganizations().then(setOrganizations);
                        api.getEntities().then(setSocieties);
                        api.getOrganizationStructure().then(setOrgStructure);
                    }
                    api.getAllScopedSettings().then(setScopedSettings);
                } catch (error) {
                    console.error("Failed to load initial users", error);
                }
            };
            loadInitialData();
        }
    }, [canDownloadReport, isReportingManager, user]);

    // Fetch Employee Data
    useEffect(() => {
        const fetchEmployeeData = async () => {
            if (!isEmployeeView || !user || !dateRange.startDate || !dateRange.endDate) return;

            // Resolve rules once for the current viewing user
            const isOfficeRole = isOfficeUser(user.role);
            const userCategory = isOfficeRole ? 'office' : 'field'; 
            const userRules = resolveUserRules(user.id, userCategory);
            const weeklyOffDays = userRules.weeklyOffDays || [0];

            const startTime = Date.now();
            setIsLoading(true);
            try {
                // Fetch extra days before start date to handle weekend logic correctly across months
                // Start buffer at the Monday at least 15 days before to ensure two full blocks for calculation
                const bufferStartDate = startOfWeek(subDays(dateRange.startDate, 15), { weekStartsOn: 1 });
                const startStr = bufferStartDate.toISOString();
                // Add 36-hour lookahead to capture night shift completions
                const endStr = new Date(dateRange.endDate.getTime() + 36 * 60 * 60 * 1000).toISOString();

                const [events, compOffs, userHolidays, userLeaves, siteSpecificHolidays, leaveBalances] = await Promise.all([
                    api.getAttendanceEvents(user.id, startStr, endStr),
                    api.getCompOffLogs(user.id),
                    api.getUserHolidays(user.id),
                    api.getLeaveRequests({ 
                        userId: user.id, 
                        startDate: startStr, 
                        endDate: endStr, 
                        status: ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'] 
                    }),
                    user.organizationId ? api.getSiteSpecificHolidays(user.organizationId) : Promise.resolve([]),
                    api.getLeaveBalances(user.id, dateRange.endDate.getFullYear(), dateRange.endDate.getMonth() + 1)
                ]);
                
                const leavesData = Array.isArray(userLeaves) ? userLeaves : (userLeaves as any).data || [];
                
                // POPULATE GLOBAL STATE FOR REPORT COMPONENT
                setUserHolidaysPool(userHolidays || []);

                // Calculate Stats
                // Generate logs for extended period to ensure continuity for weekend rules
                const extendedDays = eachDayOfInterval({ start: bufferStartDate, end: dateRange.endDate });

                // 1. Generate Logs using Unified Logic
                let daysPresentInWeek = 0;
                let daysActiveInWeek = 0;
                let daysPresentInPreviousWeek = 0; // True evaluation strictly from DB buffer events
                
                // Pre-compute session-aware day grouping ONCE (not per-day)
                const employeeDayKeyMap = buildAttendanceDayKeyByEventId(events);
                const employeeEventsByDate = new Map<string, AttendanceEvent[]>();
                events.forEach(e => {
                    const key = employeeDayKeyMap[e.id];
                    if (!key) return;
                    if (!employeeEventsByDate.has(key)) employeeEventsByDate.set(key, []);
                    employeeEventsByDate.get(key)!.push(e);
                });

                // Track week presence for the buffer period as well
                const logs = extendedDays.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayOfWeek = day.getDay();
                    
                    // Reset weekly presence counter on Monday (1)
                    if (dayOfWeek === 1) {
                        daysPresentInPreviousWeek = daysActiveInWeek;
                        daysPresentInWeek = 0;
                        daysActiveInWeek = 0;
                    }
                    
                    const isActiveInPreviousWeek = daysPresentInPreviousWeek >= (userRules?.weekendPresentThreshold ?? 3);

                    // Use pre-computed session-aware grouping
                    const dayEvents = employeeEventsByDate.get(dateStr) || [];
                    const { workingHours } = calculateWorkingHours(dayEvents, day);
                    let fStatus = '';
                    const uCat = userCategory as string;
                    if ((uCat === 'field' || uCat === 'site') && userRules?.enableSiteTimeTracking) {
                        const fRes = getFieldStaffStatus(dayEvents, userRules, undefined, user.role, day);
                        fStatus = fRes.status;
                    }

                    // Centralized status determination logic
                    const statusRaw = evaluateAttendanceStatus({
                        day,
                        userId: user.id,
                        userCategory: userCategory as any,
                        userRole: user.role, // In this context (single user), role is likely already resolved or it's the current user's role
                        userRules: userRules,
                        dayEvents,
                        officeHolidays,
                        fieldHolidays,
                        siteHolidays: siteSpecificHolidays.length > 0 ? siteSpecificHolidays : siteHolidays,
                        recurringHolidays,
                        userHolidaysPool: userHolidays || [],
                        leaves: leavesData,
                        daysPresentInWeek,
                        isActiveInPreviousWeek,
                        workingHours,
                        fieldStatus: fStatus,
                        // BL/PL location rule: only Bangalore office/field staff get Blue/Pink Leave codes
                        userLocation: user.location || user.locationName || user.organizationName || user.societyName
                    });

                    // Track presence for threshold-based rules (like Weekend Off eligibility)
                    const isPresence = statusRaw.includes('P') || statusRaw === 'Present' || statusRaw === 'Half Day' || statusRaw === 'H' || statusRaw.includes('CO');
                    const isApprovedLeave = (statusRaw.includes('L') && !statusRaw.includes('LOP')) || statusRaw.includes('CO');
                    
                    if (isPresence || isApprovedLeave) {
                        const val = (statusRaw.includes('1/2') ? 0.5 : 1);
                        daysActiveInWeek += val;
                        if (isPresence) {
                            daysPresentInWeek += val;
                        }
                    }

                    // Map specific utility codes to dashboard display format (e.g., 'H/P' -> 'HP')
                    const status = statusRaw.replace('/', '');

                    let checkIn = '-';
                    let checkOut = '-';
                    let dailyOT = 0;

                    if (dayEvents.length > 0) {
                        dayEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        const cin = dayEvents.find(e => e.type === 'punch-in');
                        const cout = [...dayEvents].reverse().find(e => e.type === 'punch-out');
                        if (cin) checkIn = format(new Date(cin.timestamp), 'hh:mm a');
                        if (cout) checkOut = format(new Date(cout.timestamp), 'hh:mm a');

                        const { workingHours } = calculateWorkingHours(dayEvents, day);
                        const fullDayThreshold = userRules.minimumHoursFullDay || 8;
                        if (workingHours > fullDayThreshold) {
                            dailyOT = Math.round((workingHours - fullDayThreshold) * 10) / 10;
                        }
                    }

                    return {
                        rawDate: day,
                        date: format(day, 'dd MMM, yyyy'),
                        day: format(day, 'EEEE'),
                        checkIn,
                        checkOut,
                        status,
                        ot: dailyOT
                    };
                });

                // 3. Filter logs for the actual requested range
                const displayLogs = logs.filter(l => l.rawDate >= dateRange.startDate!);

                // 4. Calculate Final Stats based on displayLogs
                const present = displayLogs.reduce((acc, l) => {
                    if (l.status === 'P' || l.status === 'W/H' || l.status === 'W/P' || l.status === 'H/P' || l.status === '0.5P' || l.status === 'BL/P' || l.status === 'PL/P') return acc + 1;
                    if (l.status.startsWith('0.5P')) return acc + 0.5;
                    return acc;
                }, 0);
                const absent = displayLogs.filter(l => (l.status === 'A' || l.status === '1/2A') && l.rawDate <= new Date()).length;
                const otHours = displayLogs.reduce((acc, l) => acc + l.ot, 0);

                // Comp Offs (Count earned in this period)
                const compOffCount = compOffs.filter(log => {
                    const d = new Date(log.dateEarned);
                    return d >= dateRange.startDate! && d <= dateRange.endDate! && log.status === 'earned';
                }).length;

                setEmployeeStats({ 
                    present, 
                    absent, 
                    ot: Math.round(otHours * 10) / 10, 
                    compOff: compOffCount,
                    elBalance: leaveBalances ? leaveBalances.el_closing : 0,
                    woBalance: leaveBalances ? leaveBalances.wo_closing : 0
                });
                setEmployeeLogs(displayLogs.reverse()); // Newest first

            } catch (error) {
                console.error("Failed to fetch employee attendance", error);
            } finally {
                const duration = Date.now() - startTime;
                const minDelay = 800;
                if (duration < minDelay) {
                    setTimeout(() => setIsLoading(false), minDelay - duration);
                } else {
                    setIsLoading(false);
                }
            }
        };

        fetchEmployeeData();
    }, [isEmployeeView, user, dateRange, recurringHolidays]);

    const fetchDashboardData = useCallback((startDate: Date, endDate: Date) => {
        const loadData = async () => {
            const startTime = Date.now();
            setIsLoading(true);
            try {
                // Ensure we have users data
                let currentUsers = usersRef.current;
                if (currentUsers.length === 0) {
                    if (isAdmin(user?.role) || user?.role?.toLowerCase().replace(/_/g, ' ') === 'hr ops') {
                        currentUsers = await api.getUsers();
                    } else if (user) {
                        currentUsers = await api.getTeamMembers(user.id);
                        const self = await api.getUserById(user.id);
                        if (self && !currentUsers.find(u => u.id === self.id)) {
                            currentUsers.push(self);
                        }
                    }
                    setUsers(currentUsers);
                    usersRef.current = currentUsers;
                }

                let activeStaff = currentUsers.filter(u => u.role !== 'management');
                if (isClientOrManagerView && user?.organizationId) {
                    const managerOrgs = user.organizationId.split(',').map(s => s.trim());
                    activeStaff = activeStaff.filter(u => {
                        if (!u.organizationId) return false;
                        const userOrgs = u.organizationId.split(',').map(s => s.trim());
                        return managerOrgs.some(org => userOrgs.includes(org));
                    });
                }
                
                if (selectedCompany !== 'all') activeStaff = activeStaff.filter(u => u.societyId === selectedCompany);
                if (selectedSite !== 'all') activeStaff = activeStaff.filter(u => u.organizationId && u.organizationId.split(',').map(s => s.trim()).includes(selectedSite));
                if (selectedLocation !== 'all') activeStaff = activeStaff.filter(u => resolveUserLocation(u, orgStructure).toLowerCase() === selectedLocation.toLowerCase());
                if (selectedRole !== 'all') activeStaff = activeStaff.filter(u => u.role === selectedRole);
                if (selectedUser !== 'all') activeStaff = activeStaff.filter(u => u.id === selectedUser);
                
                const activeStaffIds = new Set(activeStaff.map(u => u.id));
                const today = new Date();
                const queryStart = subDays(startDate, 3);
                // Leave fetch needs a wider window: cross-month leaves (e.g. starting in prior month)
                // must not be silently dropped. Use 45-day lookback for leaves only.
                const leaveQueryStart = subDays(startDate, 45);
                // Add 36-hour lookahead to capture night shift completions
                const queryEnd = new Date(endDate.getTime() + 36 * 60 * 60 * 1000);

                const [events, allLeavesResponse, holidaysResponse, rolesResponse, kioskDevicesResponse] = await Promise.all([
                    api.getAllAttendanceEvents(queryStart.toISOString(), queryEnd.toISOString()),
                    api.getLeaveRequests({ 
                        startDate: leaveQueryStart.toISOString(), 
                        endDate: queryEnd.toISOString()
                    }),
                    api.getAllUserHolidays(),
                    api.getRoles(),
                    fetchKioskDevices().catch(() => [])
                ]);

                setAttendanceEvents(events);
                setKioskDevices(kioskDevicesResponse || []);
                const allLeaves = (Array.isArray(allLeavesResponse) ? allLeavesResponse : allLeavesResponse.data || []).filter(Boolean);
                const leavesData = allLeaves.filter(l => ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(String(l.status).toLowerCase()));
                setLeaves(leavesData);
                setUserHolidaysPool(holidaysResponse || []);
                setAllRoles(rolesResponse || []);

                if (reportType === 'leave_balance') {
                    setIsFetchingLeaveBalances(true);
                    try {
                        const balances = await Promise.all(
                            activeStaff.map(async (u) => {
                                const bal = await api.getLeaveBalancesForUser(u.id, format(endDate, 'yyyy-MM-dd'));
                                return {
                                    userId: u.id,
                                    userName: u.name,
                                    department: u.department || 'N/A',
                                    role: u.role || 'N/A',
                                    balances: bal
                                };
                            })
                        );
                        setLeaveBalances(balances);
                    } catch (err) {
                        console.error('Error fetching bulk leave balances:', err);
                    } finally {
                        setIsFetchingLeaveBalances(false);
                    }
                }

                // Optimize lookups: Group events by session-aware business day
                const dayKeyMap = buildAttendanceDayKeyByEventId(events);
                const eventsByDate = new Map<string, AttendanceEvent[]>();
                events.forEach(e => {
                    const d = dayKeyMap[e.id];
                    if (!d) return;
                    if (!eventsByDate.has(d)) eventsByDate.set(d, []);
                    eventsByDate.get(d)!.push(e);
                });

                const fieldUsers = activeStaff.filter(u => !isOfficeUser(u.role));
                const violationsMap: Record<string, FieldAttendanceViolation[]> = {};
                if (fieldUsers.length > 0) {
                    try {
                        const allViolations = await api.getBatchFieldViolations(fieldUsers.map(u => u.id));
                        allViolations.forEach(v => {
                            const userIdKey = String(v.userId).toLowerCase();
                            if (!violationsMap[userIdKey]) violationsMap[userIdKey] = [];
                            violationsMap[userIdKey].push(v);
                        });
                    } catch (error) {
                        console.error('Error fetching batch violations:', error);
                    }
                    fieldUsers.forEach(fu => {
                        const idKey = String(fu.id).toLowerCase();
                        if (!violationsMap[idKey]) violationsMap[idKey] = [];
                    });
                }
                setFieldViolationsMap(violationsMap);

                const thirtyDaysAgo = subDays(new Date(), 30);
                const recentlyActiveIds = new Set(
                    events.filter(e => {
                        const t = new Date(e.timestamp);
                        return t >= thirtyDaysAgo && activeStaffIds.has(e.userId);
                    }).map(e => e.userId)
                );
                setRecentlyActiveUserIds(recentlyActiveIds);
                const inactiveCount = Math.max(0, activeStaff.length - recentlyActiveIds.size);

                const days = eachDayOfInterval({ start: startDate, end: endDate });
                const isRangeLong = days.length > 1;
                
                let chartDays = days;
                if (days.length === 1) {
                    chartDays = eachDayOfInterval({ start: subDays(days[0], 2), end: days[0] });
                }
                
                let totalPresentForRange = 0;
                let totalOnLeaveForRange = 0;
                let totalAbsentForRange = 0;

                const labels = chartDays.map(d => format(d, 'dd MMM'));
                const presentTrend: number[] = [];
                const absentTrend: number[] = [];
                const wfhTrend: number[] = [];
                const onLeaveTrend: number[] = [];
                const productivityTrend: number[] = [];

                const todayDateStr = format(today, 'yyyy-MM-dd');
                // For today's bar: only start showing absent after 11 AM IST.
                // Before that, the day is still early and many employees haven't punched in yet —
                // counting them as absent would inflate the bar with false data.
                const todayAbsentCutoffHour = 11;
                const showTodayAbsent = today.getHours() >= todayAbsentCutoffHour;

                chartDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isToday = dateStr === todayDateStr;
                    const rawDayEvents = eventsByDate.get(dateStr) || [];
                    const dayEvents = rawDayEvents.filter(e => activeStaffIds.has(e.userId));
                    
                    const dayLeaves = leavesData.filter(l => {
                        const start = startOfDay(new Date(l.startDate));
                        const end = endOfDay(new Date(l.endDate));
                        return day >= start && day <= end && activeStaffIds.has(l.userId);
                    });

                    let presentCount = 0;
                    let wfhCount = 0;
                    let leaveCount = 0;
                    let absentCount = 0;

                    activeStaff.forEach(user => {
                        const userId = String(user.id);
                        const userEvents = dayEvents.filter(e => e.userId === userId);
                        
                        const isSundayCheck = day.getDay() === 0;
                        
                        // Resolve user category for holiday check
                        let resolvedRole = user.role;
                        if (user.role && user.role.length > 20 && allRoles.length > 0) {
                            const roleObj = allRoles.find(r => r.id === user.role);
                            if (roleObj) {
                                resolvedRole = roleObj.displayName.toLowerCase().replace(/\s+/g, '_');
                            }
                        }
                        const userCategory = getStaffCategory(resolvedRole || user.role);

                        const isConfiguredHoliday = (userCategory === 'field' ? fieldHolidays : officeHolidays).some(h => {
                            const hVal = String(h.date).split(' ')[0].split('T')[0];
                            return hVal === dateStr;
                        });

                        const hasApprovedLeave = dayLeaves.some(l => l.userId === userId && l.leaveType !== 'WFH');
                        const hasWFH = dayLeaves.some(l => l.userId === userId && l.leaveType === 'WFH');
                        const hasActivity = userEvents.length > 0;

                        if (hasActivity) {
                            presentCount++;
                        } else if (hasWFH) {
                            wfhCount++;
                        } else if (hasApprovedLeave) {
                            leaveCount++;
                        } else if (isConfiguredHoliday || isSundayCheck) {
                            // Holiday / Week Off - not absent!
                        } else {
                            absentCount++;
                        }
                    });

                    const absent = isToday && !showTodayAbsent ? 0 : absentCount;

                    totalPresentForRange += presentCount + wfhCount;
                    totalOnLeaveForRange += leaveCount;
                    totalAbsentForRange += absent;

                    presentTrend.push(presentCount);
                    wfhTrend.push(wfhCount);
                    onLeaveTrend.push(leaveCount);
                    absentTrend.push(absent);
                });

                chartDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const rawDayEvents = eventsByDate.get(dateStr) || [];
                    const dayEvents = rawDayEvents.filter(e => activeStaffIds.has(e.userId));
                    
                    const dayLeaves = leavesData.filter(l => {
                        const start = startOfDay(new Date(l.startDate));
                        const end = endOfDay(new Date(l.endDate));
                        return day >= start && day <= end && activeStaffIds.has(l.userId);
                    });

                    const dayWFHUserIds = new Set(dayLeaves.filter(l => l.leaveType === 'WFH').map(l => l.userId));
                    const uniqueUsersPresent = new Set([...dayEvents.map(e => e.userId), ...Array.from(dayWFHUserIds)]).size;

                    let totalHours = 0;
                    const userEvents: Record<string, AttendanceEvent[]> = {};
                    dayEvents.forEach(e => {
                        if (!userEvents[e.userId]) userEvents[e.userId] = [];
                        userEvents[e.userId].push(e);
                    });
                    Object.values(userEvents).forEach(ue => {
                        const { workingHours } = processDailyEvents(ue, day);
                        totalHours += workingHours;
                    });
                    productivityTrend.push(uniqueUsersPresent > 0 ? parseFloat((totalHours / uniqueUsersPresent).toFixed(1)) : 0);
                });

                const avgPresent = Math.round(totalPresentForRange / days.length);
                const avgOnLeave = Math.round(totalOnLeaveForRange / days.length);
                const avgAbsent = Math.round(totalAbsentForRange / days.length);

                const todayStr = format(today, 'yyyy-MM-dd');
                const rawTodayEvents = eventsByDate.get(todayStr) || [];
                const todayEvents = rawTodayEvents.filter(e => activeStaffIds.has(e.userId));
                
                const todayLeaves = leavesData.filter(l => {
                    const dStart = startOfDay(new Date(l.startDate));
                    const dEnd = endOfDay(new Date(l.endDate));
                    return today >= dStart && today <= dEnd && activeStaffIds.has(l.userId);
                });
                const presentToday = new Set([...todayEvents.map(e => e.userId), ...Array.from(todayLeaves.filter(l => l.leaveType === 'WFH').map(l => l.userId))]).size;
                const onLeaveToday = new Set(todayLeaves.filter(l => l.leaveType !== 'WFH').map(l => l.userId)).size;


                // --- Client/Manager Metrics Calculation ---
                let lateArrivalsToday = 0;
                let roleDistribution: { labels: string[], values: number[] } | undefined;
                let departmentDistribution: { labels: string[], values: number[] } | undefined;
                let topPerformers: { name: string, role: string, value: string }[] | undefined;
                let pendingLeavesToday = 0;
                let approvedLeavesToday = 0;

                if (isClientOrManagerView) {
                    // Late Arrivals
                    const userTodayEvents: Record<string, AttendanceEvent[]> = {};
                    todayEvents.forEach(e => {
                        if (!userTodayEvents[e.userId]) userTodayEvents[e.userId] = [];
                        userTodayEvents[e.userId].push(e);
                    });
                    Object.values(userTodayEvents).forEach(ue => {
                        const punchIns = ue.filter(e => e.type === 'punch-in' || e.type === 'site-in');
                        if (punchIns.length > 0) {
                            punchIns.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                            const firstPunchIn = punchIns[0];
                            const { isLate } = isLateCheckIn(new Date(firstPunchIn.timestamp).toISOString(), '09:30');
                            if (isLate) lateArrivalsToday++;
                        }
                    });

                    // Leaves logic (for the selected date range)
                    const rangeLeaves = allLeaves.filter(l => {
                        const dStart = new Date(l.startDate);
                        const dEnd = new Date(l.endDate);
                        return dStart <= endDate && dEnd >= startDate && activeStaffIds.has(l.userId);
                    });
                    pendingLeavesToday = rangeLeaves.filter(l => String(l.status).toLowerCase() === 'pending').length;
                    approvedLeavesToday = rangeLeaves.filter(l => ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(String(l.status).toLowerCase())).length;

                    // Role Distribution (Donut Chart) for today's present users
                    const roleCounts: Record<string, number> = {};
                    const deptCounts: Record<string, number> = {};
                    const presentUsers = new Set([...todayEvents.map(e => e.userId), ...Array.from(todayLeaves.filter(l => l.leaveType === 'WFH').map(l => l.userId))]);
                    presentUsers.forEach(uid => {
                        const u = activeStaff.find(st => st.id === uid);
                        if (u) {
                            let rName = u.role ? u.role.replace(/_/g, ' ') : 'Unknown';
                            if (u.role && u.role.length > 20 && rolesResponse) {
                                const rObj = rolesResponse.find(r => r.id === u.role);
                                if (rObj) rName = rObj.displayName.replace(/_/g, ' ');
                            }
                            roleCounts[rName] = (roleCounts[rName] || 0) + 1;
                            
                            let dName = (u as any).department || rName || 'Unknown';
                            dName = dName.replace(/_/g, ' ');
                            deptCounts[dName] = (deptCounts[dName] || 0) + 1;
                        }
                    });
                    const labelsDist = Object.keys(roleCounts).map(k => k.charAt(0).toUpperCase() + k.slice(1));
                    const valuesDist = Object.values(roleCounts);
                    roleDistribution = { labels: labelsDist, values: valuesDist };

                    const deptLabels = Object.keys(deptCounts).map(k => k.charAt(0).toUpperCase() + k.slice(1));
                    const deptValues = Object.values(deptCounts);
                    departmentDistribution = { labels: deptLabels, values: deptValues };

                    // Top Performers (Total hours worked in range)
                    const userTotalHours: Record<string, number> = {};
                    days.forEach(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayEvts = eventsByDate.get(dateStr) || [];
                        const uEvts: Record<string, AttendanceEvent[]> = {};
                        dayEvts.filter(e => activeStaffIds.has(e.userId)).forEach(e => {
                            if (!uEvts[e.userId]) uEvts[e.userId] = [];
                            uEvts[e.userId].push(e);
                        });
                        Object.entries(uEvts).forEach(([uid, ue]) => {
                            const { workingHours } = calculateWorkingHours(ue, day);
                            userTotalHours[uid] = (userTotalHours[uid] || 0) + workingHours;
                        });
                    });
                    topPerformers = Object.entries(userTotalHours)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 4)
                        .map(([uid, hrs]) => {
                            const u = activeStaff.find(st => st.id === uid);
                            let rName = u?.role ? u.role.replace(/_/g, ' ') : 'Staff';
                            if (u?.role && u.role.length > 20 && rolesResponse) {
                                const rObj = rolesResponse.find(r => r.id === u.role);
                                if (rObj) rName = rObj.displayName.replace(/_/g, ' ');
                            }
                            return {
                                name: u ? u.name : 'Unknown User',
                                role: rName,
                                value: `${hrs.toFixed(1)}h`
                            };
                        });
                }

                // Calculate today's metrics client-side to respect all filters (Company, Site, Location, Role, Employee)
                
                const todayLeavesAll = allLeaves.filter(l => {
                    const dStart = startOfDay(new Date(l.startDate));
                    const dEnd = endOfDay(new Date(l.endDate));
                    return today >= dStart && today <= dEnd && activeStaffIds.has(l.userId);
                });

                const todayPunchesUserIds = new Set(todayEvents.filter(e => e.type === 'punch-in').map(e => e.userId));
                const wfhTodayUserIds = new Set(
                    todayLeavesAll
                        .filter(l => ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(String(l.status).toLowerCase()))
                        .filter(l => {
                            const lType = String(l.leaveType || '').toLowerCase();
                            return lType.includes('work from home') || lType === 'wfh' || lType === 'w/h';
                        })
                        .map(l => l.userId)
                );
                const leaveTodayUserIds = new Set(
                    todayLeavesAll
                        .filter(l => ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(String(l.status).toLowerCase()))
                        .filter(l => {
                            const lType = String(l.leaveType || '').toLowerCase();
                            return !(lType.includes('work from home') || lType === 'wfh' || lType === 'w/h');
                        })
                        .map(l => l.userId)
                );

                const present_today = new Set([...todayPunchesUserIds, ...wfhTodayUserIds]).size;
                const on_leave_today = leaveTodayUserIds.size;
                const wfh_today = wfhTodayUserIds.size;
                
                // Count late arrivals (first punch after 09:30)
                const userFirstPunch: Record<string, Date> = {};
                todayEvents.filter(e => e.type === 'punch-in').forEach(e => {
                    const ts = new Date(e.timestamp);
                    if (!userFirstPunch[e.userId] || ts < userFirstPunch[e.userId]) {
                        userFirstPunch[e.userId] = ts;
                    }
                });
                let late_arrivals_today = 0;
                Object.values(userFirstPunch).forEach(ts => {
                    const hrs = ts.getHours();
                    const mins = ts.getMinutes();
                    if (hrs > 9 || (hrs === 9 && mins > 30)) {
                        late_arrivals_today++;
                    }
                });

                const pending_leaves = todayLeavesAll.filter(l => String(l.status).toLowerCase() === 'pending').length;
                const approved_leaves = todayLeavesAll.filter(l => ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(String(l.status).toLowerCase())).length;

                const absent_today = Math.max(0, activeStaff.length - present_today - on_leave_today);

                setTodayMetrics({
                    present_today,
                    absent_today,
                    wfh_today,
                    on_leave_today,
                    late_arrivals_today,
                    pending_leaves,
                    approved_leaves,
                    total_active_staff: activeStaff.length
                });

                setDashboardData({
                    totalEmployees: activeStaff.length,
                    presentToday: isRangeLong ? avgPresent : presentToday,
                    absentToday: isRangeLong ? avgAbsent : Math.max(0, activeStaff.length - presentToday - onLeaveToday - inactiveCount),
                    onLeaveToday: isRangeLong ? avgOnLeave : onLeaveToday,
                    inactiveCount,
                    attendanceTrend: { 
                        labels, 
                        present: presentTrend, 
                        absent: absentTrend,
                        wfh: wfhTrend,
                        onLeave: onLeaveTrend
                    },
                    productivityTrend: { labels: labels, hours: productivityTrend },
                    lateArrivalsToday,
                    pendingLeavesToday,
                    approvedLeavesToday,
                    roleDistribution,
                    departmentDistribution,
                    topPerformers
                });
            } catch (error) {
                console.error("Failed to load dashboard data", error);
                setDashboardData({
                    totalEmployees: 0,
                    presentToday: 0,
                    absentToday: 0,
                    onLeaveToday: 0,
                    inactiveCount: 0,
                    attendanceTrend: { labels: [], present: [], absent: [], wfh: [], onLeave: [] },
                    productivityTrend: { labels: [], hours: [] },
                    lateArrivalsToday: 0,
                    pendingLeavesToday: 0,
                    approvedLeavesToday: 0,
                });
            } finally {
                const duration = Date.now() - startTime;
                const minDelay = 800;
                if (duration < minDelay) {
                    setTimeout(() => setIsLoading(false), minDelay - duration);
                } else {
                    setIsLoading(false);
                }
            }
        };
        loadData();
    }, [user, selectedCompany, selectedSite, selectedLocation, selectedRole, selectedUser, users, reportType]);

    
    // Phase 1 — KPI cards (loads in ~100ms)
    useEffect(() => {
        fetchTodayMetrics(
            selectedCompany !== 'all' ? selectedCompany : undefined,
            selectedSite    !== 'all' ? [selectedSite]  : undefined,
        )
        .then(setTodayMetrics)
        .catch(err => {
            console.error(err);
            setTodayMetrics({
                present_today: 0,
                absent_today: 0,
                wfh_today: 0,
                on_leave_today: 0,
                late_arrivals_today: 0,
                pending_leaves: 0,
                approved_leaves: 0,
                total_active_staff: 0
            });
        });
    }, [selectedCompany, selectedSite]);

    // Phase 2 — Chart trends (loads in ~200-400ms)
    useEffect(() => {
        if (!dateRange.startDate || !dateRange.endDate) return;
        // If single day is selected (like Today), fetch 3 days for the trend chart
        const isSingleDay = isSameDay(dateRange.startDate, dateRange.endDate);
        const chartStart = isSingleDay ? subDays(dateRange.startDate, 2) : dateRange.startDate;
        
        fetchAttendanceSummary(
            chartStart,
            dateRange.endDate,
            selectedCompany !== 'all' ? selectedCompany : undefined,
            selectedSite    !== 'all' ? [selectedSite]  : undefined,
        )
        .then(rows => setChartDatasets(buildChartDatasets(rows)))
        .catch(err => {
            console.error(err);
            setChartDatasets({
                labels: [],
                presentTrend: [],
                absentTrend: [],
                wfhTrend: [],
                onLeaveTrend: [],
                productivityTrend: [],
                totalActiveStaff: 0
            });
        });
    }, [dateRange, selectedCompany, selectedSite]);

    // Monitor initial queries to complete the splash screen loading phase
    useEffect(() => {
        if (todayMetrics && chartDatasets && dashboardData && !isInitialLoadComplete) {
            setIsInitialLoadComplete(true);
        }
    }, [todayMetrics, chartDatasets, dashboardData, isInitialLoadComplete]);

    // Phase 3 — Top Performers (loads last)
    useEffect(() => {
        if (!dateRange.startDate || !dateRange.endDate) return;
        fetchTopPerformers(
            dateRange.startDate,
            dateRange.endDate,
            selectedCompany !== 'all' ? selectedCompany : undefined,
            selectedSite    !== 'all' ? [selectedSite]  : undefined,
        )
        .then(setTopPerformers)
        .catch(console.error);
    }, [dateRange, selectedCompany, selectedSite]);

    const reportTypeId = useId();
    const employeeId = useId();
    const roleId = useId();
    const statusId = useId();
    const recordTypeId = useId();
    const startDateId = useId();
    const endDateId = useId();

    useEffect(() => {
        if (dateRange.startDate && dateRange.endDate) {
            fetchDashboardData(dateRange.startDate, dateRange.endDate);
        }
    }, [dateRange, fetchDashboardData, selectedCompany, selectedSite, selectedLocation, selectedRole, selectedUser, users]);

    const availableRoles = useMemo(() => {
        const roles = new Set(users.map(u => u.role).filter(Boolean));
        return Array.from(roles).sort();
    }, [users]);

    const handleSetDateFilter = (filter: string) => {
        setPendingActiveDateFilter(filter);
        setActiveDateFilter(filter);
        const today = new Date();
        let startDate = startOfDay(today);
        let endDate = endOfDay(today);

        if (filter === 'Today') {
            startDate = startOfDay(today);
            endDate = endOfDay(today);
        } else if (filter === 'Yesterday') {
            const yesterday = subDays(today, 1);
            startDate = startOfDay(yesterday);
            endDate = endOfDay(yesterday);
        } else if (filter === 'Last 3 Days') {
            startDate = startOfDay(subDays(today, 2));
            endDate = endOfDay(today);
        } else if (filter === 'Last 7 Days') {
            startDate = startOfDay(subDays(today, 6));
            endDate = endOfDay(today);
        } else if (filter === 'Last 30 Days') {
            startDate = startOfDay(subDays(today, 29));
            endDate = endOfDay(today);
        } else if (filter === 'This Month') {
            startDate = startOfMonth(today);
            endDate = endOfDay(today); // Standard for 'This Month' is up to today
        } else if (filter === 'Last Month') {
            const lastMonth = subMonths(today, 1);
            startDate = startOfMonth(lastMonth);
            endDate = endOfMonth(lastMonth);
        } else if (filter === 'Last 3 Months') {
            startDate = startOfMonth(subMonths(today, 2));
            endDate = endOfDay(today);
        } else if (filter === 'Last 6 Months') {
            startDate = startOfMonth(subMonths(today, 5));
            endDate = endOfToday();
        } else if (filter === 'This Year') {
            startDate = startOfYear(today);
            endDate = endOfDay(today);
        }

        // Cap to today for future-reaching ranges
        if (endDate > today) {
            endDate = endOfDay(today);
        }

        setPendingDateRange({ startDate, endDate, key: 'selection' });
        setDateRange({ startDate, endDate, key: 'selection' });
    };

    const handleCustomDateChange = (item: RangeKeyDict) => {
        const { selection } = item;
        setPendingDateRange(selection);
        setPendingActiveDateFilter('Custom');
        
        // Automatically close the selector only after a full range (start and end) has been picked.
        // If startDate and endDate are different, it indicates the second click of a range selection.
        if (selection.startDate && selection.endDate && selection.startDate.getTime() !== selection.endDate.getTime()) {
            setIsDatePickerOpen(false);
            setDateRange(selection);
            setActiveDateFilter('Custom');
        }
    };

    // Use memoized array for DateRangePicker
    const pendingDateRangeArray = useMemo(() => [pendingDateRange], [pendingDateRange]);

    const statDateLabel = useMemo(() => {
        const endDate = dateRange.endDate!;
        const today = new Date();
        if (format(endDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return "Today";
        return `on ${format(endDate, 'MMM d')}`;
    }, [dateRange]);

    // --- Report Data Generation Logic ---

    // 1. Basic Report Data
    const basicReportData: BasicReportDataRow[] = useMemo(() => {
        if (!dateRange.startDate || !dateRange.endDate) return [];

        const data: BasicReportDataRow[] = [];
        const days = eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate });

        // Filter users based on selection, and exclude management users unless specifically requested
        let filteredUsers = users;

        if (selectedUser === 'all' && selectedRole !== 'management') {
            filteredUsers = filteredUsers.filter(u => u.role !== 'management');
        }

        if (selectedUser !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.id === selectedUser);
        }
        if (selectedRole !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.role === selectedRole);
        }
        if (selectedCompany !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.societyId === selectedCompany);
        }
        if (selectedSite !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.organizationId && u.organizationId.split(',').map(s => s.trim()).includes(selectedSite));
        }
        if (selectedLocation !== 'all') {
            filteredUsers = filteredUsers.filter(u => resolveUserLocation(u, orgStructure).toLowerCase() === selectedLocation.toLowerCase());
        }

        const activeInPeriodIds = new Set(attendanceEvents.map(e => String(e.userId).toLowerCase()));
        if (selectedStatus === 'ACTIVE_USERS') {
            filteredUsers = filteredUsers.filter(u => 
                (u as any).isActive !== false && 
                activeInPeriodIds.has(String(u.id).toLowerCase())
            );
        }

        const targetUsers = filteredUsers;

        // PRE-INDEX: Group events by userId and session-anchored business day for O(1) lookup
        const dayKeyMapGlobal = buildAttendanceDayKeyByEventId(attendanceEvents);
        const eventsByUserAndDate = new Map<string, Map<string, AttendanceEvent[]>>();
        attendanceEvents.forEach(e => {
            const userId = String(e.userId);
            const dateStr = dayKeyMapGlobal[e.id];
            if (!eventsByUserAndDate.has(userId)) {
                eventsByUserAndDate.set(userId, new Map());
            }
            const userMap = eventsByUserAndDate.get(userId)!;
            if (!userMap.has(dateStr)) {
                userMap.set(dateStr, []);
            }
            userMap.get(dateStr)!.push(e);
        });

        // PRE-INDEX: Group approved leaves by userId
        const approvedLeavesByUser = new Map<string, LeaveRequest[]>();
        leaves.forEach(l => {
            const lStatus = String(l?.status || '').toLowerCase();
            const isValidStatus = ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(lStatus);
            if (l && isValidStatus && l.userId) {
                const userId = String(l.userId);
                if (!approvedLeavesByUser.has(userId)) {
                    approvedLeavesByUser.set(userId, []);
                }
                approvedLeavesByUser.get(userId)!.push(l);
            }
        });

        const dayInfos = days.map(day => ({
            day,
            dateStr: format(day, 'yyyy-MM-dd'),
            displayDate: format(day, 'dd MMM yyyy'),
            dayName: format(day, 'EEEE'),
            dayOfMonth: day.getDate(),
            dayOfWeek: day.getDay()
        }));

        const rulesCache = new Map<string, StaffAttendanceRules>();
        const getRules = (userId: string, category: string) => {
            if (!rulesCache.has(userId)) {
                rulesCache.set(userId, resolveUserRules(userId, category as any));
            }
            return rulesCache.get(userId)!;
        };

        targetUsers.forEach(user => {
            const userId = String(user.id);
            const userEventsMap = eventsByUserAndDate.get(userId);
            const userLeaves = approvedLeavesByUser.get(userId) || [];
            
            // Resolve role name if it's a UUID
            let resolvedRole = user.role;
            if (user.role && user.role.length > 20 && allRoles.length > 0) {
                const roleObj = allRoles.find(r => r.id === user.role);
                if (roleObj) {
                    resolvedRole = roleObj.displayName.toLowerCase().replace(/\s+/g, '_');
                }
            }

            const userCategory = getStaffCategory(resolvedRole || user.role);
            const userRules = getRules(userId, userCategory);
            const weeklyOffDays = userRules.weeklyOffDays || [0];

            // Track days present in rolling week for W/O threshold.
            let daysPresentInWeek = 0;
            let daysActiveInWeek = 0;
            let daysPresentInPreviousWeek = 0; 

            if (dateRange.startDate) {
                const bufferStart = startOfWeek(subDays(dateRange.startDate, 15), { weekStartsOn: 1 });
                let checkDate = bufferStart;
                while (isBefore(checkDate, dateRange.startDate)) {
                    if (checkDate.getDay() === 1) {
                        daysPresentInPreviousWeek = daysActiveInWeek;
                        daysPresentInWeek = 0;
                        daysActiveInWeek = 0;
                    }

                    const dateStrStr = format(checkDate, 'yyyy-MM-dd');
                    const checkDayName = format(checkDate, 'EEEE');
                    const isConfiguredHolidayCheck = (userCategory === 'field' ? fieldHolidays : officeHolidays).some(h => {
                        const hVal = String(h.date).split(' ')[0].split('T')[0];
                        return hVal === dateStrStr;
                    });
                    const hasApprovedLeaveCheck = userLeaves.some(l => 
                        isWithinInterval(checkDate, { start: startOfDay(new Date(l.startDate)), end: endOfDay(new Date(l.endDate)) }) &&
                        !['loss of pay', 'loss-of-pay', 'lop'].includes((l.leaveType || '').toLowerCase())
                    );
                    const prevDayEvents = userEventsMap?.get(dateStrStr) || [];
                    const hasActivityCheck = prevDayEvents.length > 0;

                    if (hasActivityCheck || hasApprovedLeaveCheck || isConfiguredHolidayCheck) {
                        daysActiveInWeek++;
                        // Only physical presence, holidays, or WFH count towards Sunday W/O
                        const isWFHOrCompOff = userLeaves.some(l => 
                            isWithinInterval(checkDate, { start: startOfDay(new Date(l.startDate)), end: endOfDay(new Date(l.endDate)) }) &&
                            (String(l.leaveType || '').toLowerCase().includes('work from home') || 
                             String(l.leaveType || '').toLowerCase() === 'wfh' ||
                             String(l.leaveType || '').toLowerCase().includes('comp') ||
                             String(l.leaveType || '').toLowerCase() === 'c/o' ||
                             String(l.leaveType || '').toLowerCase() === 'co')
                        );
                        if (hasActivityCheck || isConfiguredHolidayCheck || isWFHOrCompOff) {
                            daysPresentInWeek++;
                        }
                    }
                    checkDate = addDays(checkDate, 1);
                }
            }

            dayInfos.forEach(({ day, dateStr, displayDate, dayName, dayOfMonth, dayOfWeek }) => {
                if (dayOfWeek === 1) {
                    daysPresentInPreviousWeek = daysActiveInWeek;
                    daysPresentInWeek = 0;
                    daysActiveInWeek = 0;
                }

                // O(1) Lookup instead of O(L) filter
                const dayEvents = userEventsMap?.get(dateStr) || [];

                // Faster lookup for leaves
                const approvedLeave = userLeaves.find(l => 
                    isWithinInterval(day, { 
                        start: startOfDay(new Date(l.startDate)), 
                        end: endOfDay(new Date(l.endDate)) 
                    })
                );
                const hasApprovedLeave = !!approvedLeave;

                let checkIn = '-';
                let checkOut = '-';
                let duration = '-';
                const rowExtra: any = {};

                const { workingHours } = calculateWorkingHours(dayEvents, day);
                let fStatus = '';
                const uCatCheck = userCategory as string;
                if ((uCatCheck === 'field' || uCatCheck === 'site') && userRules?.enableSiteTimeTracking) {
                    const fRes = getFieldStaffStatus(dayEvents, userRules, undefined, user.role, day);
                    fStatus = fRes.status;
                }

                // Use centralized logic for status determination
                const isActiveInPreviousWeek = daysPresentInPreviousWeek >= (userRules?.weekendPresentThreshold ?? 3);
                const status = evaluateAttendanceStatus({
                    day,
                    userId,
                    userCategory: userCategory as any,
                    userRole: resolvedRole || user.role,
                    userRules,
                    dayEvents,
                    officeHolidays,
                    fieldHolidays,
                    siteHolidays,
                    recurringHolidays,
                    userHolidaysPool,
                    leaves,
                    daysPresentInWeek,
                    isActiveInPreviousWeek,
                    workingHours,
                    fieldStatus: fStatus,
                    // BL/PL location rule: only Bangalore office/field staff get Blue/Pink Leave codes
                    userLocation: user.location || user.locationName || user.organizationName || user.societyName
                });

                const isPresence = status.includes('P') || status === 'Present' || status === 'Half Day' || status === 'H' || status === 'W/H' || status.includes('CO');
                const isApprovedLeave = (status.includes('L') && !status.includes('LOP')) || status === 'W/H' || status.includes('C/C') || status === 'RP' || status === 'RC' || status.includes('RP') || status.includes('RC') || status.includes('CO');
                
                if (isPresence || isApprovedLeave) {
                    const val = (status.includes('1/2') ? 0.5 : 1);
                    daysActiveInWeek += val;
                    if (isPresence) {
                        daysPresentInWeek += val;
                    }
                }

                if (dayEvents.length > 0) {
                    const sortedEvents = [...dayEvents].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    
                    // Smarter In/Out: Use punch-in/out or site-in/out if present, otherwise earliest/latest activity
                    const punchIn = sortedEvents.find(e => e.type === 'punch-in' || e.type === 'site-in');
                    const punchOut = [...sortedEvents].reverse().find(e => e.type === 'punch-out' || e.type === 'site-out');
                    const earliest = sortedEvents[0];
                    const latest = sortedEvents[sortedEvents.length - 1];

                    // Detect auto-checkout (punched out by AI/System)
                    const isAutoCheckout = !!(punchOut && (
                        punchOut.locationName === 'Auto Check-out' || 
                        (punchOut as any).reason?.includes('Auto-checkout') ||
                        punchOut.source === 'auto_system' ||
                        punchOut.checkoutNote?.includes('Auto punch-out')
                    ));

                    checkIn = format(new Date(punchIn?.timestamp || earliest.timestamp), 'HH:mm');
                    // Only show checkout if it's a real checkout event OR if it's the last event of a completed session
                    // For active night shifts, we might want to show '-' for checkout if not yet punched out
                    if (punchOut) {
                        checkOut = format(new Date(punchOut.timestamp), 'HH:mm');
                    } else if (!isSameDay(day, new Date())) {
                        // If it's a past day and we have activity, show the last activity as checkout
                        checkOut = format(new Date(latest.timestamp), 'HH:mm');
                    }

                    // Extra fields for Basic Report (Matches BasicReportDataRow type)
                    const bIn = sortedEvents.find(e => e.type === 'break-in');
                    const bOut = [...sortedEvents].reverse().find(e => e.type === 'break-out');
                    const otIn = sortedEvents.find(e => e.type === 'site-ot-in');
                    const otOut = [...sortedEvents].reverse().find(e => e.type === 'site-ot-out');

                    const breakInStr = bIn ? format(new Date(bIn.timestamp), 'HH:mm') : '-';
                    const breakOutStr = bOut ? format(new Date(bOut.timestamp), 'HH:mm') : '-';
                    const siteOtInStr = otIn ? format(new Date(otIn.timestamp), 'HH:mm') : '-';
                    const siteOtOutStr = otOut ? format(new Date(otOut.timestamp), 'HH:mm') : '-';

                    const { totalHours } = calculateWorkingHours(dayEvents, day);
                    const hours = Math.floor(totalHours);
                    const minutes = Math.round((totalHours - hours) * 60);
                    duration = `${hours}h ${minutes}m`;

                    // Assign to local variables for push
                    (rowExtra as any).breakIn = breakInStr;
                    (rowExtra as any).breakOut = breakOutStr;
                    (rowExtra as any).siteOtIn = siteOtInStr;
                    (rowExtra as any).siteOtOut = siteOtOutStr;
                    (rowExtra as any).isAutoCheckout = isAutoCheckout;
                }

                data.push({ 
                    userName: user.name, 
                    date: displayDate, 
                    status, 
                    checkIn, 
                    checkOut, 
                    duration, 
                    breakIn: rowExtra.breakIn || '-',
                    breakOut: rowExtra.breakOut || '-',
                    siteOtIn: rowExtra.siteOtIn || '-',
                    siteOtOut: rowExtra.siteOtOut || '-',
                    locationName: (dayEvents.find(e => e.type === 'punch-in')?.locationName || 'Office'),
                    isAutoCheckout: rowExtra.isAutoCheckout || false,
                    department: (user as any).department || (user as any).role || 'Staff'
                });
            });
        });

        let filteredData = (selectedStatus === 'all' || selectedStatus === 'ACTIVE_USERS') ? data : data.filter(row => row.status === selectedStatus);
        if (selectedRecordType !== 'all') {
            filteredData = filteredData.filter(row => {
                const hasCheckIn = row.checkIn && row.checkIn !== '-' && row.checkIn !== '';
                const hasCheckOut = row.checkOut && row.checkOut !== '-' && row.checkOut !== '';
                switch (selectedRecordType) {
                    case 'complete': return hasCheckIn && hasCheckOut;
                    case 'missing_checkout': return hasCheckIn && !hasCheckOut;
                    case 'missing_checkin': return !hasCheckIn && hasCheckOut;
                    case 'incomplete': return !hasCheckIn || !hasCheckOut;
                    case 'auto_checkout': return row.isAutoCheckout === true;
                    default: return true;
                }
            });
        }
        return filteredData;
    }, [users, attendanceEvents, dateRange, selectedUser, selectedRole, selectedCompany, selectedSite, selectedLocation, selectedStatus, selectedRecordType, recurringHolidays, leaves, userHolidaysPool, officeHolidays, fieldHolidays, siteHolidays, orgStructure]);

    // 2. Attendance Log Data (Raw Events)
    const attendanceLogData: AttendanceLogDataRow[] = useMemo(() => {
        if (!dateRange.startDate || !dateRange.endDate) return [];

        // Exclude management users from logs
        let filteredUsers = users.filter(u => u.role !== 'management');

        if (selectedUser !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.id === selectedUser);
        }
        if (selectedRole !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.role === selectedRole);
        }
        if (selectedCompany !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.societyId === selectedCompany);
        }
        if (selectedSite !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.organizationId && u.organizationId.split(',').map(s => s.trim()).includes(selectedSite));
        }
        if (selectedLocation !== 'all') {
            filteredUsers = filteredUsers.filter(u => resolveUserLocation(u, orgStructure).toLowerCase() === selectedLocation.toLowerCase());
        }

        const activeInPeriodIds = new Set(attendanceEvents.map(e => String(e.userId).toLowerCase()));
        if (selectedStatus === 'ACTIVE_USERS') {
            filteredUsers = filteredUsers.filter(u => 
                (u as any).isActive !== false && 
                activeInPeriodIds.has(String(u.id).toLowerCase())
            );
        }

        const targetUsers = filteredUsers;
        const targetUserIds = new Set(targetUsers.map(u => u.id));

        // PRE-INDEX: Users Map for O(1) lookup
        const usersMap = new Map(users.map(u => [u.id, u]));
        const kioskDeviceMap = new Map(kioskDevices.map(d => [d.id, d.deviceModel || d.deviceName]));
        const kioskLocationMap = new Map(kioskDevices.filter(d => d.locationId).map(d => [d.locationId, d.deviceModel || d.deviceName]));
        const dayKeyMapLogs = buildAttendanceDayKeyByEventId(attendanceEvents);
        const startStr = format(dateRange.startDate, 'yyyy-MM-dd');
        const endStr = format(dateRange.endDate, 'yyyy-MM-dd');

        const filteredEvents = attendanceEvents.filter(e => {
            if (!targetUserIds.has(e.userId)) return false;
            const sessionDateStr = dayKeyMapLogs[e.id];
            return sessionDateStr && sessionDateStr >= startStr && sessionDateStr <= endStr;
        });

        const eventsByUserLog = new Map<string, typeof filteredEvents>();
        filteredEvents.forEach(e => {
            if (!eventsByUserLog.has(e.userId)) eventsByUserLog.set(e.userId, []);
            eventsByUserLog.get(e.userId)!.push(e);
        });

        const processedLogEvents: typeof filteredEvents = [];

        eventsByUserLog.forEach((userEvents, userId) => {
            // Sort chronologically for sequence logic
            userEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            const processedUserEvents = userEvents.map(e => {
                let displayType = e.type;
                const wType = String(e.workType).toLowerCase();
                if (displayType === 'punch-in' && (wType === 'field' || wType === 'site')) {
                    displayType = 'site-in';
                } else if (displayType === 'punch-out' && (wType === 'field' || wType === 'site')) {
                    displayType = 'site-out';
                }
                return { ...e, displayType };
            });

            // Second pass lookahead
            for (let i = 0; i < processedUserEvents.length; i++) {
                if (processedUserEvents[i].displayType === 'punch-in') {
                    let nextActiveEvent = null;
                    for (let j = i + 1; j < processedUserEvents.length; j++) {
                        if (processedUserEvents[j].displayType !== 'live-location') {
                            nextActiveEvent = processedUserEvents[j];
                            break;
                        }
                    }
                    if (nextActiveEvent && nextActiveEvent.displayType === 'site-out') {
                        processedUserEvents[i].displayType = 'site-in';
                    }
                }
            }

            processedLogEvents.push(...processedUserEvents);
        });

        return processedLogEvents.map(e => {
            const user = usersMap.get(e.userId) as any;
            const location = e.locationName || 
                            (e.latitude && e.longitude ? `${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}` : 'N/A');

            let finalType = (e as any).displayType.replace('-', ' ');
            if (finalType === 'site in') finalType = 'Site Check In';
            if (finalType === 'site out') finalType = 'Site Check Out';
            if (finalType === 'punch in') finalType = 'Punch In';
            if (finalType === 'punch out') {
                if (e.source === 'auto_system' || e.checkoutNote?.includes('Auto punch-out') || e.locationName === 'Auto Check-out' || (e as any).reason?.includes('Auto-checkout')) {
                    finalType = 'AP , Auto Punched out';
                } else {
                    finalType = 'Punch Out';
                }
            }

            // Use session-anchored date for night shifts
            const sessionDateStr = dayKeyMapLogs[e.id];
            const displayDate = sessionDateStr ? format(new Date(sessionDateStr.replace(/-/g, '/')), 'dd MMM yyyy') : '-';

            return {
                userName: user?.name || 'Unknown',
                date: displayDate,
                time: format(new Date(e.timestamp), 'HH:mm:ss'),
                type: finalType,
                locationName: location,
                latitude: e.latitude,
                longitude: e.longitude,
                workType: e.workType,
                device: e.deviceId && kioskDeviceMap.has(e.deviceId) 
                    ? kioskDeviceMap.get(e.deviceId) 
                    : (e.source === 'gate-kiosk' && e.locationId && kioskLocationMap.has(e.locationId))
                        ? kioskLocationMap.get(e.locationId)
                        : (e.deviceName || (e as any).device || '-'),
                isCached: e.isCached,
                cachedAt: (e as any).cachedAt,
                isAutoCheckout: e.locationName === 'Auto Check-out' || (e as any).reason?.includes('Auto-checkout')
            };
        }).sort((a, b) => {
            // Newest first: Sort by date then time descending
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return b.time.localeCompare(a.time);
        });

    }, [users, attendanceEvents, dateRange, selectedUser, selectedRole, selectedCompany, selectedSite, selectedLocation, selectedStatus, kioskDevices, orgStructure]);

    // 3. Monthly Report Data (Aggregated)
    // Legacy monthlyReportData removed - now handled by unified MonthlyHoursReport component

    // 4. Work Hours Report Data (Aggregated)
    // Legacy work_hoursReportData removed - now handled by unified MonthlyHoursReport component

    // 5. Site OT Report Data
    const site_otReportData: SiteOtDataRow[] = useMemo(() => {
        if (!dateRange.startDate || !dateRange.endDate) return [];

        let filteredUsers = users.filter(u => u.role !== 'management');
        if (selectedUser !== 'all') filteredUsers = filteredUsers.filter(u => u.id === selectedUser);
        if (selectedRole !== 'all') filteredUsers = filteredUsers.filter(u => u.role === selectedRole);
        if (selectedCompany !== 'all') filteredUsers = filteredUsers.filter(u => u.societyId === selectedCompany);
        if (selectedSite !== 'all') filteredUsers = filteredUsers.filter(u => u.organizationId && u.organizationId.split(',').map(s => s.trim()).includes(selectedSite));
        if (selectedLocation !== 'all') filteredUsers = filteredUsers.filter(u => resolveUserLocation(u, orgStructure).toLowerCase() === selectedLocation.toLowerCase());

        const activeInPeriodIds = new Set(attendanceEvents.map(e => String(e.userId).toLowerCase()));
        if (selectedStatus === 'ACTIVE_USERS') {
            filteredUsers = filteredUsers.filter(u => 
                (u as any).isActive !== false && 
                activeInPeriodIds.has(String(u.id).toLowerCase())
            );
        }

        const targetUserIds = new Set(filteredUsers.map(u => u.id));
        const data: SiteOtDataRow[] = [];
        const startStr = format(dateRange.startDate, 'yyyy-MM-dd');
        const endStr = format(dateRange.endDate, 'yyyy-MM-dd');

        filteredUsers.forEach(user => {
            const userEvents = attendanceEvents.filter(e => 
                e.userId === user.id && 
                (e.type === 'site-ot-in' || e.type === 'site-ot-out')
            ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Process sessions
            for (let i = 0; i < userEvents.length; i++) {
                const event = userEvents[i];
                if (event.type === 'site-ot-in') {
                    const nextEvent = userEvents[i + 1];
                    let siteOtOut: string | null = null;
                    let duration: string | null = null;
                    
                    if (nextEvent && nextEvent.type === 'site-ot-out') {
                        siteOtOut = format(new Date(nextEvent.timestamp), 'HH:mm');
                        const diffInMins = differenceInMinutes(new Date(nextEvent.timestamp), new Date(event.timestamp));
                        const hours = Math.floor(diffInMins / 60);
                        const mins = diffInMins % 60;
                        duration = `${hours}h ${mins}m`;
                        i++; // Skip the next event
                    }

                    const eventDateStr = format(new Date(event.timestamp), 'yyyy-MM-dd');
                    if (eventDateStr >= startStr && eventDateStr <= endStr) {
                        data.push({
                            userName: user.name,
                            date: eventDateStr,
                            siteOtIn: format(new Date(event.timestamp), 'HH:mm'),
                            siteOtOut,
                            duration,
                            locationName: event.locationName || 'N/A'
                        });
                    }
                }
            }
        });

        return data.sort((a, b) => b.date.localeCompare(a.date));
    }, [users, attendanceEvents, dateRange, selectedUser, selectedRole, selectedCompany, selectedSite, selectedLocation, selectedStatus, orgStructure]);


    // Helper to map high-precision monthly data to the simple status grid format
    const mapToMonthlyReportRow = (emp: any): MonthlyReportRow => ({
        userName: emp.employeeName || emp.userName || 'Unknown',
        statuses: emp.statuses || [],
        presentDays: emp.presentDays || 0,
        halfDays: emp.halfDays || 0,
        absentDays: emp.absentDays || 0,
        weekOffs: emp.weekOffs || 0,
        holidays: emp.holidays || 0,
        weekendPresents: emp.weekendPresents || 0,
        holidayPresents: emp.holidayPresents || 0,
        totalPayableDays: emp.totalPayableDays || 0,
        sickLeaves: emp.sickLeaves || 0,
        earnedLeaves: emp.earnedLeaves || 0,
        floatingHolidays: emp.floatingHolidays || 0,
        compOffs: emp.compOffs || 0,
        lossOfPays: emp.lossOfPays || 0,
        workFromHomeDays: emp.workFromHomeDays || 0,
        overtimeDays: emp.overtimeDays || 0
    });

    // Determine which PDF component to render
        const renderReportContent = useCallback((isPreview: boolean = false) => {
        const reportDateRange = `${format(dateRange.startDate!, 'yyyy-MM-dd')} to ${format(dateRange.endDate!, 'yyyy-MM-dd')}`;
        const orgName = selectedSite !== 'all' 
            ? (() => {
                const matchedUser = users.find(u => u.organizationId && u.organizationId.split(',').map(s => s.trim()).includes(selectedSite));
                if (!matchedUser) return 'All Sites';
                const ids = (matchedUser.organizationId || '').split(',').map(s => s.trim());
                const names = (matchedUser.organizationName || '').split(',').map(s => s.trim());
                const idx = ids.indexOf(selectedSite);
                return idx !== -1 && names[idx] ? names[idx] : (matchedUser.organizationName || 'All Sites');
              })()
            : 'All Sites';
        const socName = selectedCompany !== 'all' ? users.find(u => u.societyId === selectedCompany)?.societyName : 'All Companies';
        const logoBase64 = logoForPdf;
        const currentLogoUrl = useLogoStore.getState().currentLogo;
        const fallbackLogoUrl = logoBase64 || currentLogoUrl || pdfLogoLocalPath;
        const dr = { startDate: dateRange.startDate!, endDate: dateRange.endDate! };

        // Identify target user for report attribution
        const targetUserObj = selectedUser !== 'all' ? users.find(u => u.id === selectedUser) : undefined;
        const targetUserName = targetUserObj ? targetUserObj.name : (isPreview ? 'ALL EMPLOYEES' : undefined);
        const targetUserRole = targetUserObj ? targetUserObj.role : undefined;

        // For web preview: use standard HTML components (safe for DOM rendering)
        if (isPreview) {
            if (reportType === 'basic') return <BasicReportView data={basicReportData} dateRange={dr} logoUrl={fallbackLogoUrl} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={resolvedFilters} />;
            if (reportType === 'monthly' || reportType === 'work_hours') {
                const isWorkHours = reportType === 'work_hours';
                const monthsInRange = dateRange.startDate && dateRange.endDate 
                    ? eachMonthOfInterval({ start: dateRange.startDate, end: dateRange.endDate })
                    : [new Date()];

                return (
                    <div className="space-y-12">
                        {/* Hidden Data Loaders for each month in range - Only for Monthly Matrix Report */}
                        {reportType === 'monthly' && (
                            <div className="hidden">
                                {monthsInRange.map(m => (
                                    <MonthlyHoursReport 
                                        key={`loader-${format(m, 'yyyy-MM')}`}
                                        month={m.getMonth() + 1} 
                                        year={m.getFullYear()} 
                                        userId={selectedUser === 'all' ? undefined : selectedUser} 
                                        scopedSettings={scopedSettings}
                                        selectedStatus={selectedStatus}
                                        selectedRecordType={selectedRecordType}
                                        selectedSite={selectedSite}
                                        selectedLocation={selectedLocation}
                                        selectedCompany={selectedCompany}
                                        selectedRole={selectedRole}
                                        users={users}
                                        onDataLoaded={(data) => {
                                            const monthKey = format(m, 'yyyy-MM');
                                            setMonthlyDataMap(prev => ({...prev, [monthKey]: data}));
                                            // Also set the first month to legacy state for backward compat if needed
                                            if (monthsInRange[0] && m.getTime() === monthsInRange[0].getTime()) {
                                                setExportedMonthlyData(data);
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {!isWorkHours && monthsInRange.map(m => {
                            const monthKey = format(m, 'yyyy-MM');
                            const monthData = monthlyDataMap[monthKey] || [];
                            const monthStart = startOfMonth(m);
                            const monthEnd = endOfMonth(m);
                            const today = startOfDay(new Date());
                            // Ensure we don't show future dates in the grid
                            const maxDisplayDate = isBefore(monthEnd, today) ? monthEnd : today;
                            
                            // Adjust display range to match actual month days within global range, but never past today
                            const displayStart = isAfter(monthStart, dateRange.startDate!) ? monthStart : dateRange.startDate!;
                            const displayEnd = isBefore(maxDisplayDate, dateRange.endDate!) ? maxDisplayDate : dateRange.endDate!;
                            
                            return (
                                <div key={`view-${monthKey}`} className="space-y-4">
                                    <div className="flex items-center gap-4 px-2">
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
                                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">
                                            {format(m, 'MMMM yyyy')}
                                        </h3>
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
                                    </div>
                                    
                                    {monthData.length > 0 ? (
                                        <MonthlyStatusView 
                                            data={monthData.map(mapToMonthlyReportRow)} 
                                            dateRange={{ startDate: displayStart, endDate: displayEnd }} 
                                            logoUrl={fallbackLogoUrl} 
                                            generatedBy={user?.name}
                                            generatedByRole={user?.role}
                                            targetUserName={targetUserName}
                                            targetUserRole={targetUserRole}
                                            days={eachDayOfInterval({ start: displayStart, end: displayEnd })}
                                            filters={resolvedFilters}
                                        />
                                    ) : (
                                        <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                                            <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mb-3" />
                                            <p className="text-xs font-medium uppercase tracking-wider">Loading {format(m, 'MMMM')} data...</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {isWorkHours && (
                            <div className="space-y-8">
                                {monthsInRange.map(m => (
                                    <div key={`work-hours-${format(m, 'yyyy-MM')}`}>
                                        <MonthlyHoursReport 
                                            month={m.getMonth() + 1} 
                                            year={m.getFullYear()} 
                                            userId={selectedUser === 'all' ? undefined : selectedUser} 
                                            scopedSettings={scopedSettings}
                                            hideHeader={false}
                                            selectedStatus={selectedStatus}
                                            selectedRecordType={selectedRecordType}
                                            selectedSite={selectedSite}
                                            selectedLocation={selectedLocation}
                                            selectedCompany={selectedCompany}
                                            selectedRole={selectedRole}
                                            users={users}
                                            onDataLoaded={(data) => {
                                                if (monthsInRange[0] && m.getTime() === monthsInRange[0].getTime()) {
                                                    setExportedMonthlyData(data);
                                                }
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            }
            if (reportType === 'site_ot') return <SiteOtReportView data={site_otReportData} dateRange={dr} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={resolvedFilters} />;
            if (reportType === 'log') return <AttendanceLogView data={attendanceLogData} dateRange={dr} logoUrl={fallbackLogoUrl} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={resolvedFilters} />;
            if (reportType === 'audit') return <AttendanceAuditReport logs={auditLogs} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={resolvedFilters} />;
            if (reportType === 'leave_balance') return <LeaveBalanceTrackerView data={leaveBalances} dateRange={dr} logoUrl={fallbackLogoUrl} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={resolvedFilters} />;
            return null;
        }

        // For PDF generation: use react-pdf Document components (NOT safe for DOM rendering)
        if (reportType === 'basic') return <BasicReportDocument data={basicReportData} dateRange={dr} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={resolvedFilters} />;
        if (reportType === 'log') return <AttendanceLogDocument data={attendanceLogData} dateRange={dr} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={resolvedFilters} />;
        if (reportType === 'monthly') {
            const mappedMap = Object.fromEntries(
                Object.entries(monthlyDataMap).map(([k, v]) => [k, v.map(mapToMonthlyReportRow)])
            );
            return <MonthlyMatrixReportDocument 
                monthlyData={mappedMap} 
                globalDateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                logoUrl={logoBase64} 
                generatedBy={user?.name} 
                generatedByRole={user?.role}
                filters={resolvedFilters}
            />;
        }
        if (reportType === 'work_hours') return <MonthlyReportDocument data={exportedMonthlyData} dateRange={dr} days={eachDayOfInterval({ start: dateRange.startDate!, end: dateRange.endDate! })} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={resolvedFilters} />;
        if (reportType === 'site_ot') return <SiteOtReportDocument data={site_otReportData} dateRange={dr} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={resolvedFilters} />;
        if (reportType === 'audit') {
            const mappedAuditLogs: AuditLogDataRow[] = auditLogs.map(log => ({
                dateTime: format(new Date(log.created_at), 'dd MMM yyyy, HH:mm'),
                action: log.action,
                performer_name: log.performer_name || 'N/A',
                target_name: log.target_name || 'N/A',
                detailsStr: JSON.stringify(log.details)
            }));
            return <AuditLogDocument data={mappedAuditLogs} dateRange={dr} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={resolvedFilters} />;
        }
        if (reportType === 'leave_balance') return <LeaveBalanceTrackerDocument data={leaveBalances} dateRange={dr} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} filters={resolvedFilters} />;
        
        return null;
    }, [reportType, basicReportData, attendanceLogData, site_otReportData, dateRange, auditLogs, user?.name, users, selectedCompany, selectedSite, selectedLocation, selectedStatus, selectedRole, scopedSettings, exportedMonthlyData, leaveBalances]);

    const pdfContent = useMemo(() => renderReportContent(false), [renderReportContent]);
    const previewContent = useMemo(() => renderReportContent(true), [renderReportContent]);



    const handleDownloadPdf = async () => {
        setIsDownloading(true);
        try {
            const logoBase64 = logoForPdf;

            const generatedBy = user?.name || 'Unknown User';
            const generatedByRole = user?.role || undefined;
            const targetUserObj = selectedUser !== 'all' ? users.find(u => u.id === selectedUser) : undefined;
            const targetUserName = targetUserObj ? targetUserObj.name : undefined;
            const targetUserRole = targetUserObj ? targetUserObj.role : undefined;
            const fileName = `Attendance_Report_${reportType}_${format(new Date(), 'yyyyMMdd')}.pdf`;

            let blob;
            switch (reportType) {
                case 'basic':
                    blob = await pdf(<BasicReportDocument 
                        data={basicReportData} 
                        dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                        generatedBy={generatedBy}
                        generatedByRole={generatedByRole}
                        targetUserName={targetUserName}
                        targetUserRole={targetUserRole}
                        logoUrl={logoBase64}
                        filters={resolvedFilters}
                    />).toBlob();
                    break;
                case 'monthly': {
                    const mappedMap = Object.fromEntries(
                        Object.entries(monthlyDataMap).map(([k, v]) => [k, v.map(mapToMonthlyReportRow)])
                    );
                    blob = await pdf(<MonthlyMatrixReportDocument 
                        monthlyData={mappedMap} 
                        globalDateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                        generatedBy={generatedBy}
                        generatedByRole={generatedByRole}
                        targetUserName={targetUserName}
                        targetUserRole={targetUserRole}
                        logoUrl={logoBase64}
                        filters={resolvedFilters}
                    />).toBlob();
                    break;
                }
                case 'work_hours': {
                    const days = eachDayOfInterval({ start: dateRange.startDate!, end: dateRange.endDate! });
                    blob = await pdf(<MonthlyReportDocument 
                        data={exportedMonthlyData} 
                        dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                        generatedBy={generatedBy}
                        generatedByRole={generatedByRole}
                        targetUserName={targetUserName}
                        targetUserRole={targetUserRole}
                        logoUrl={logoBase64}
                        days={days}
                        filters={resolvedFilters}
                    />).toBlob();
                    break;
                }
                case 'log':
                    blob = await pdf(<AttendanceLogDocument 
                        data={attendanceLogData} 
                        dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                        generatedBy={generatedBy}
                        generatedByRole={generatedByRole}
                        targetUserName={targetUserName}
                        targetUserRole={targetUserRole}
                        logoUrl={logoBase64}
                        filters={resolvedFilters}
                    />).toBlob();
                    break;
                case 'site_ot':
                    blob = await pdf(<SiteOtReportDocument 
                        data={site_otReportData} 
                        dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                        generatedBy={generatedBy}
                        generatedByRole={generatedByRole}
                        targetUserName={targetUserName}
                        targetUserRole={targetUserRole}
                        logoUrl={logoBase64}
                        filters={resolvedFilters}
                    />).toBlob();
                    break;
                case 'audit': {
                    const auditLogData = auditLogs.map(log => ({
                        dateTime: format(new Date(log.created_at), 'dd MMM yyyy HH:mm'),
                        action: log.action,
                        performer_name: log.performer_name,
                        target_name: log.target_name,
                        detailsStr: JSON.stringify(log.details).substring(0, 100) + (JSON.stringify(log.details).length > 100 ? '...' : '')
                    }));
                    blob = await pdf(<AuditLogDocument 
                        data={auditLogData} 
                        dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                        generatedBy={generatedBy}
                        generatedByRole={generatedByRole}
                        targetUserName={targetUserName}
                        targetUserRole={targetUserRole}
                        logoUrl={logoBase64}
                        filters={resolvedFilters}
                    />).toBlob();
                    break;
                }
                case 'leave_balance':
                    blob = await pdf(<LeaveBalanceTrackerDocument 
                        data={leaveBalances} 
                        dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                        generatedBy={generatedBy}
                        generatedByRole={generatedByRole}
                        targetUserName={targetUserName}
                        targetUserRole={targetUserRole}
                        logoUrl={logoBase64}
                        filters={resolvedFilters}
                    />).toBlob();
                    break;
                default:
                    setToast({ message: 'This report type is not yet supported in PDF format.', type: 'error' });
                    setIsDownloading(false);
                    return;
            }

            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                link.click();
                URL.revokeObjectURL(url);
                setToast({ message: 'PDF downloaded successfully!', type: 'success' });
            }

        } catch (error) {
            console.error('PDF Download failed', error);
            setToast({ message: 'Failed to download PDF.', type: 'error' });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadExcel = async () => {
        setIsDownloading(true);
        try {
            const logoBase64 = logoForPdf;

            if (reportType === 'monthly') {
                const mappedMap = Object.fromEntries(
                    Object.entries(monthlyDataMap).map(([k, v]) => [k, v.map(mapToMonthlyReportRow)])
                );
                await exportMonthlyMatrixToExcel(
                    mappedMap,
                    { startDate: dateRange.startDate!, endDate: dateRange.endDate! },
                    logoBase64,
                    user?.name || 'Unknown User'
                );
            } else if (reportType === 'work_hours') {
                await exportAttendanceToExcel(
                    exportedMonthlyData,
                    { startDate: dateRange.startDate!, endDate: dateRange.endDate! },
                    logoBase64,
                    user?.name || 'Unknown User'
                );
            } else {
                let columns: GenericReportColumn[] = [];
                let dataToExport: any[] = [];
                let reportTitle = '';
                let fileNamePrefix = '';

                switch (reportType) {
                    case 'basic':
                        reportTitle = 'Basic Attendance Report';
                        fileNamePrefix = 'Attendance_Report';
                        columns = [
                            { header: 'Employee Name', key: 'userName', width: 25 },
                            { header: 'Date', key: 'date', width: 15 },
                            { header: 'Status', key: 'status', width: 15 },
                            { header: 'Punch In', key: 'checkIn', width: 15 },
                            { header: 'Punch Out', key: 'checkOut', width: 15 },
                            { header: 'Location', key: 'locationName', width: 25 },
                            { header: 'Hours', key: 'duration', width: 15 }
                        ];
                        dataToExport = basicReportData;
                        break;
                    case 'log':
                        reportTitle = 'Attendance Log';
                        fileNamePrefix = 'Attendance_Log';
                        columns = [
                            { header: 'User', key: 'userName', width: 25 },
                            { header: 'Date', key: 'date', width: 15 },
                            { header: 'Time', key: 'time', width: 15 },
                            { header: 'Event', key: 'type', width: 15 },
                            { header: 'Location', key: 'locationName', width: 30 },
                            { header: 'Device', key: 'device', width: 15 }
                        ];
                        dataToExport = attendanceLogData;
                        break;
                    case 'audit':
                        reportTitle = 'Audit Log Report';
                        fileNamePrefix = 'Audit_Log';
                        columns = [
                            { header: 'Date & Time', key: 'dateTime', width: 20 },
                            { header: 'Action', key: 'action', width: 20 },
                            { header: 'Performed By', key: 'performer_name', width: 25 },
                            { header: 'Target Employee', key: 'target_name', width: 25 },
                            { header: 'Details', key: 'detailsStr', width: 50 },
                        ];
                        dataToExport = auditLogs.map(log => ({
                            dateTime: format(new Date(log.created_at), 'dd MMM yyyy HH:mm'),
                            action: log.action,
                            performer_name: log.performer_name,
                            target_name: log.target_name,
                            detailsStr: JSON.stringify(log.details)
                        }));
                        break;
                    case 'site_ot':
                        reportTitle = 'Site OT Report';
                        fileNamePrefix = 'Site_OT_Report';
                        columns = [
                            { header: 'Employee Name', key: 'userName', width: 25 },
                            { header: 'Date', key: 'date', width: 15 },
                            { header: 'Site OT In', key: 'siteOtIn', width: 15 },
                            { header: 'Site OT Out', key: 'siteOtOut', width: 15 },
                            { header: 'Duration', key: 'duration', width: 15 },
                            { header: 'Location', key: 'locationName', width: 30 }
                        ];
                        dataToExport = site_otReportData;
                        break;
                    case 'leave_balance':
                        reportTitle = 'Leave Balance Tracker';
                        fileNamePrefix = 'Leave_Balance_Tracker';
                        columns = [
                            { header: 'Employee Name', key: 'userName', width: 25 },
                            { header: 'Role/Dept', key: 'roleDept', width: 20 },
                            { header: 'EL Earned', key: 'elEarned', width: 12 },
                            { header: 'EL Balance', key: 'elBalance', width: 12 },
                            { header: 'SL Earned', key: 'slEarned', width: 12 },
                            { header: 'SL Balance', key: 'slBalance', width: 12 },
                            { header: 'CO Earned', key: 'coEarned', width: 12 },
                            { header: 'CO Balance', key: 'coBalance', width: 12 },
                            { header: 'FH Earned', key: 'fhEarned', width: 12 },
                            { header: 'FH Balance', key: 'fhBalance', width: 12 },
                            { header: 'PL Earned', key: 'plEarned', width: 12 },
                            { header: 'PL Balance', key: 'plBalance', width: 12 },
                            { header: 'CC Earned', key: 'ccEarned', width: 12 },
                            { header: 'CC Balance', key: 'ccBalance', width: 12 },
                            { header: 'ML Earned', key: 'mlEarned', width: 12 },
                            { header: 'ML Balance', key: 'mlBalance', width: 12 },
                        ];
                        dataToExport = leaveBalances.map(row => {
                            const b = row.balances || {};
                            return {
                                userName: row.userName,
                                roleDept: String(row.role || row.department || 'Staff').replace(/_/g, ' '),
                                elEarned: (b.earnedTotal || 0).toFixed(1),
                                elBalance: ((b.earnedTotal || 0) - (b.earnedUsed || 0) - (b.earnedPending || 0)).toFixed(1),
                                slEarned: (b.sickTotal || 0).toFixed(1),
                                slBalance: ((b.sickTotal || 0) - (b.sickUsed || 0) - (b.sickPending || 0)).toFixed(1),
                                coEarned: (b.compOffTotal || 0).toFixed(1),
                                coBalance: ((b.compOffTotal || 0) - (b.compOffUsed || 0) - (b.compOffPending || 0)).toFixed(1),
                                fhEarned: (b.floatingTotal || 0).toFixed(1),
                                fhBalance: ((b.floatingTotal || 0) - (b.floatingUsed || 0) - (b.floatingPending || 0)).toFixed(1),
                                plEarned: (b.pinkTotal || 0).toFixed(1),
                                plBalance: ((b.pinkTotal || 0) - (b.pinkUsed || 0) - (b.pinkPending || 0)).toFixed(1),
                                ccEarned: (b.childCareTotal || 0).toFixed(1),
                                ccBalance: ((b.childCareTotal || 0) - (b.childCareUsed || 0) - (b.childCarePending || 0)).toFixed(1),
                                mlEarned: (b.maternityTotal || 0).toFixed(1),
                                mlBalance: ((b.maternityTotal || 0) - (b.maternityUsed || 0) - (b.maternityPending || 0)).toFixed(1),
                            };
                        });
                        break;
                    default:
                        break;
                }

                await exportGenericReportToExcel(
                    dataToExport,
                    columns,
                    reportTitle,
                    { startDate: dateRange.startDate!, endDate: dateRange.endDate! },
                    fileNamePrefix,
                    logoBase64,
                    user?.name || 'Unknown User'
                );
            }
            setToast({ message: 'Excel report downloaded successfully.', type: 'success' });
        } catch (error) {
            console.error("Excel Download failed:", error);
            setToast({ message: 'Failed to generate Excel report.', type: 'error' });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadCsv = async () => {
        setIsDownloading(true);
        try {
            let dataToExport: any[] = [];
            let headers: { [key: string]: string } = {};
            const fileName = `Attendance_Report_${reportType}_${format(new Date(), 'yyyyMMdd')}.csv`;

            switch (reportType) {
                case 'basic':
                    headers = { userName: 'Employee Name', date: 'Date', status: 'Status', checkIn: 'Punch In', checkOut: 'Punch Out', locationName: 'Location', duration: 'Hours' };
                    dataToExport = basicReportData;
                    break;
                case 'monthly': {
                    const monthsInRange = eachMonthOfInterval({ start: dateRange.startDate!, end: dateRange.endDate! });
                    
                    // Build custom CSV string to include the PARADIGM SERVICES header
                    let csvContent = '\uFEFF';
                    
                    monthsInRange.forEach((m, idx) => {
                        const monthKey = format(m, 'yyyy-MM');
                        const monthData = monthlyDataMap[monthKey] || [];
                        const monthStart = startOfMonth(m);
                        const monthEnd = endOfMonth(m);
                        const displayStart = isAfter(monthStart, dateRange.startDate!) ? monthStart : dateRange.startDate!;
                        const displayEnd = isBefore(monthEnd, dateRange.endDate!) ? monthEnd : dateRange.endDate!;
                        const daysInMonth = eachDayOfInterval({ start: displayStart, end: displayEnd });

                        if (idx > 0) csvContent += `\n\n`; // Spacer between months

                        // Metadata Header matching preview
                        csvContent += `"PARADIGM SERVICES",,,,,,,,,,,,,,,,"MONTHLY ATTENDANCE REPORT"\n`;
                        csvContent += `,,,,,,,,,,,,,,,,,"Billing Cycle: ${format(m, 'MMMM yyyy')}"\n`;
                        csvContent += `,,,,,,,,,,,,,,,,,"Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}"\n`;
                        
                        const targetUserObj = selectedUser !== 'all' ? users.find(u => u.id === selectedUser) : undefined;
                        if (targetUserObj) {
                            csvContent += `,,,,,,,,,,,,,,,,,"Report for: ${targetUserObj.name}"\n`;
                            csvContent += `,,,,,,,,,,,,,,,,,"Target Role: ${targetUserObj.role.replace(/_/g, ' ')}"\n`;
                        }

                        if (user?.name) csvContent += `,,,,,,,,,,,,,,,,,"By: ${user.name}"\n`;
                        if (user?.role) csvContent += `,,,,,,,,,,,,,,,,,"Role: ${user.role.replace(/_/g, ' ')}"\n`;
                        csvContent += `\n`; // Empty row
                        
                        // Column Headers
                        const headerRow = [`"Employee Name"`];
                        daysInMonth.forEach(d => headerRow.push(`"${format(d, 'd')}"`));
                        headerRow.push(`"P"`, `"0.5P"`, `"OT"`, `"C/O"`, `"E/L"`, `"S/L"`, `"F/H"`, `"A"`, `"W/O"`, `"H"`, `"Pay"`);
                        csvContent += headerRow.join(',') + '\n';
                        
                        // Data Rows
                        monthData.forEach(emp => {
                            const recalculatedEmp = {
                                ...emp,
                                ...calculateStatsForDateRange(emp.statuses || [], daysInMonth)
                            };
                            const rowData = [`"${String(recalculatedEmp.employeeName || recalculatedEmp.userName || 'Unknown').replace(/"/g, '""')}"`];
                            const statuses = recalculatedEmp.statuses || [];
                            daysInMonth.forEach((d) => {
                                rowData.push(`"${String(statuses[d.getDate() - 1] || '-').replace(/"/g, '""')}"`);
                            });
                            rowData.push(
                                `"${recalculatedEmp.presentDays || 0}"`,
                                `"${recalculatedEmp.halfDays || 0}"`,
                                `"${recalculatedEmp.overtimeDays || 0}"`,
                                `"${recalculatedEmp.compOffs || 0}"`,
                                `"${recalculatedEmp.earnedLeaves || 0}"`,
                                `"${recalculatedEmp.sickLeaves || 0}"`,
                                `"${recalculatedEmp.floatingHolidays || 0}"`,
                                `"${recalculatedEmp.absentDays || 0}"`,
                                `"${recalculatedEmp.weekOffs || 0}"`,
                                `"${recalculatedEmp.holidays || 0}"`,
                                `"${recalculatedEmp.totalPayableDays || 0}"`
                            );
                            csvContent += rowData.join(',') + '\n';
                        });
                    });
                    
                    // Download custom CSV directly
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.setAttribute('href', url);
                    link.setAttribute('download', fileName);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    setToast({ message: 'CSV report downloaded successfully.', type: 'success' });
                    setIsDownloading(false);
                    return; // Exit here since we handled downloading manually for monthly
                }
                case 'work_hours':
                    // Map complex monthly data to a flat CSV structure
                    headers = { 
                        userName: 'Employee Name', 
                        role: 'Role',
                        totalNetWorkDuration: 'Net Work (Hrs)', 
                        totalOT: 'Total OT (Hrs)', 
                        presentDays: 'Present', 
                        absentDays: 'Absent', 
                        weekOffs: 'Week Offs', 
                        holidays: 'Holidays',
                        totalPayableDays: 'Payable Days' 
                    };
                    dataToExport = exportedMonthlyData.map(d => ({
                        ...d,
                        totalNetWorkDuration: d.totalNetWorkDuration?.toFixed(2),
                        totalOT: d.totalOT?.toFixed(2)
                    }));
                    break;
                case 'log':
                    headers = { userName: 'User', date: 'Date', time: 'Time', type: 'Event', locationName: 'Location', device: 'Device' };
                    dataToExport = attendanceLogData;
                    break;
                case 'audit':
                    headers = { created_at: 'Date', action: 'Action', performer_name: 'By', target_name: 'Target' };
                    dataToExport = auditLogs;
                    break;
                case 'site_ot':
                    headers = { userName: 'Employee', date: 'Date', siteOtIn: 'In', siteOtOut: 'Out', duration: 'Duration' };
                    dataToExport = site_otReportData;
                    break;
                case 'leave_balance':
                    headers = {
                        userName: 'Employee Name',
                        roleDept: 'Role/Dept',
                        elEarned: 'EL Earned',
                        elBalance: 'EL Balance',
                        slEarned: 'SL Earned',
                        slBalance: 'SL Balance',
                        coEarned: 'CO Earned',
                        coBalance: 'CO Balance',
                        fhEarned: 'FH Earned',
                        fhBalance: 'FH Balance',
                        plEarned: 'PL Earned',
                        plBalance: 'PL Balance',
                        ccEarned: 'CC Earned',
                        ccBalance: 'CC Balance',
                        mlEarned: 'ML Earned',
                        mlBalance: 'ML Balance',
                    };
                    dataToExport = leaveBalances.map(row => {
                        const b = row.balances || {};
                        return {
                            userName: row.userName,
                            roleDept: String(row.role || row.department || 'Staff').replace(/_/g, ' '),
                            elEarned: (b.earnedTotal || 0).toFixed(1),
                            elBalance: ((b.earnedTotal || 0) - (b.earnedUsed || 0) - (b.earnedPending || 0)).toFixed(1),
                            slEarned: (b.sickTotal || 0).toFixed(1),
                            slBalance: ((b.sickTotal || 0) - (b.sickUsed || 0) - (b.sickPending || 0)).toFixed(1),
                            coEarned: (b.compOffTotal || 0).toFixed(1),
                            coBalance: ((b.compOffTotal || 0) - (b.compOffUsed || 0) - (b.compOffPending || 0)).toFixed(1),
                            fhEarned: (b.floatingTotal || 0).toFixed(1),
                            fhBalance: ((b.floatingTotal || 0) - (b.floatingUsed || 0) - (b.floatingPending || 0)).toFixed(1),
                            plEarned: (b.pinkTotal || 0).toFixed(1),
                            plBalance: ((b.pinkTotal || 0) - (b.pinkUsed || 0) - (b.pinkPending || 0)).toFixed(1),
                            ccEarned: (b.childCareTotal || 0).toFixed(1),
                            ccBalance: ((b.childCareTotal || 0) - (b.childCareUsed || 0) - (b.childCarePending || 0)).toFixed(1),
                            mlEarned: (b.maternityTotal || 0).toFixed(1),
                            mlBalance: ((b.maternityTotal || 0) - (b.maternityUsed || 0) - (b.maternityPending || 0)).toFixed(1),
                        };
                    });
                    break;
            }

            if (dataToExport.length > 0) {
                exportToCsv(fileName, dataToExport, headers);
                setToast({ message: 'CSV report downloaded successfully.', type: 'success' });
            } else {
                setToast({ message: 'No data to export.', type: 'error' });
            }
        } catch (error) {
            console.error("CSV Download failed:", error);
            setToast({ message: 'Failed to generate CSV report.', type: 'error' });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleExportLeaveBalances = async () => {
        setIsExportingLeaves(true);
        try {
            // Determine users to export
            let targetUsers = users;
            if (selectedUser !== 'all') {
                targetUsers = users.filter(u => u.id === selectedUser);
            }
            if (selectedRole !== 'all') {
                targetUsers = targetUsers.filter(u => u.role === selectedRole);
            }
            if (selectedSite !== 'all') {
                targetUsers = targetUsers.filter(u => u.organizationId && u.organizationId.split(',').map(s => s.trim()).includes(selectedSite));
            }

            if (selectedStatus === 'ACTIVE_USERS') {
                const activeInPeriodIds = new Set(attendanceEvents.map(e => e.userId));
                targetUsers = targetUsers.filter(u => 
                    (u as any).isActive !== false && 
                    (recentlyActiveUserIds.has(u.id) || activeInPeriodIds.has(u.id))
                );
            }

            // Exclude management if needed (usually reports exclude them)
            targetUsers = targetUsers.filter(u => u.role !== 'management' && u.role !== 'super_admin');

            if (targetUsers.length === 0) {
                setToast({ message: 'No users found with current filters.', type: 'error' });
                setIsExportingLeaves(false);
                return;
            }

            // Fetch balances for all target users
            const balancePromises = targetUsers.map(async (u) => {
                try {
                    const balance = await api.getLeaveBalancesForUser(u.id);
                    return {
                        userName: u.name,
                        earnedTotal: Number((balance.earnedTotal || 0).toFixed(2)),
                        earnedUsed: Number((balance.earnedUsed || 0).toFixed(2)),
                        earnedThisMonth: Number((balance.earnedThisMonth || 0).toFixed(2)),
                        earnedPreviousMonth: Number((balance.earnedPreviousMonth || 0).toFixed(2)),
                        sickTotal: Number((balance.sickTotal || 0).toFixed(2)),
                        sickUsed: Number((balance.sickUsed || 0).toFixed(2)),
                        floatingTotal: Number((balance.floatingTotal || 0).toFixed(2)),
                        floatingUsed: Number((balance.floatingUsed || 0).toFixed(2)),
                        compOffTotal: Number((balance.compOffTotal || 0).toFixed(2)),
                        compOffUsed: Number((balance.compOffUsed || 0).toFixed(2)),
                        maternityTotal: Number((balance.maternityTotal || 0).toFixed(2)),
                        maternityUsed: Number((balance.maternityUsed || 0).toFixed(2)),
                        childCareTotal: Number((balance.childCareTotal || 0).toFixed(2)),
                        childCareUsed: Number((balance.childCareUsed || 0).toFixed(2)),
                        totalBalance: Number(((balance.earnedTotal - balance.earnedUsed) + 
                                       (balance.sickTotal - balance.sickUsed) + 
                                       (balance.floatingTotal - balance.floatingUsed) + 
                                       (balance.compOffTotal - balance.compOffUsed)).toFixed(2))
                    } as LeaveBalanceRow;
                } catch (e) {
                    console.error(`Failed to fetch balance for ${u.name}`, e);
                    return null;
                }
            });

            const balances = (await Promise.all(balancePromises)).filter(b => b !== null) as LeaveBalanceRow[];

            const logo = useLogoStore.getState().currentLogo;
            let logoBase64 = '';

            if (logo && logo.startsWith('data:image')) {
                logoBase64 = logo;
            } else {
                 const logoUrl = (logo && (logo.startsWith('http') || logo.startsWith('/'))) ? logo : pdfLogoLocalPath;
                 if (logoUrl) {
                    try {
                        const response = await fetch(logoUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            logoBase64 = await new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.readAsDataURL(blob);
                            });
                        }
                    } catch (e) {
                         console.error("Logo fetch failed", e);
                    }
                 }
            }

            await exportLeaveBalancesToExcel(
                balances,
                logoBase64,
                user?.name || 'Unknown User'
            );

            // Record Audit Log
            try {
                await supabase.from('attendance_audit_logs').insert([{
                    action: 'LEAVE_BALANCES_EXPORTED',
                    performed_by: user?.id,
                    details: {
                        exportedBy: user?.name,
                        userCount: balances.length,
                        filters: {
                            selectedUser,
                            selectedRole,
                            selectedSite
                        }
                    }
                }]);
            } catch (auditErr) {
                console.error('Failed to record audit log:', auditErr);
            }

            setToast({ message: 'Leave balances exported successfully.', type: 'success' });
        } catch (error) {
            console.error("Leave Export failed:", error);
            setToast({ message: 'Failed to export leave balances.', type: 'error' });
        } finally {
            setIsExportingLeaves(false);
        }
    };
    
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleSendEmailReport = async (payload: ReportEmailPayload) => {
        setIsSendingEmail(true);
        try {
            // Log for debugging
            console.log('Sending report email with payload:', payload);
            
            // Format report name for subject if not provided
            const reportName = reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' Report';
            
            // Generate PDF for attachment
            let pdfBlob: Blob | undefined;
            try {
                const generatedBy = user?.name || 'Paradigm System';
                const generatedByRole = user?.role || undefined;
                const targetUserObj = selectedUser !== 'all' ? users.find(u => u.id === selectedUser) : undefined;
                const targetUserName = targetUserObj ? targetUserObj.name : undefined;
                const targetUserRole = targetUserObj ? targetUserObj.role : undefined;
                const logoBase64 = ''; // You might want to pass the actual logo here if available
                
                switch (reportType) {
                    case 'basic':
                        pdfBlob = await pdf(<BasicReportDocument 
                            data={basicReportData} 
                            dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                            generatedBy={generatedBy}
                        generatedByRole={generatedByRole}
                        targetUserName={targetUserName}
                        targetUserRole={targetUserRole}
                            logoUrl={logoBase64}
                            filters={resolvedFilters}
                        />).toBlob();
                        break;
                    case 'monthly':
                    case 'work_hours': {
                        const days = eachDayOfInterval({ start: dateRange.startDate!, end: dateRange.endDate! });
                        pdfBlob = await pdf(<MonthlyReportDocument 
                            data={exportedMonthlyData} 
                            dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                            generatedBy={generatedBy}
                        generatedByRole={generatedByRole}
                        targetUserName={targetUserName}
                        targetUserRole={targetUserRole}
                            logoUrl={logoBase64}
                            days={days}
                            filters={resolvedFilters}
                        />).toBlob();
                        break;
                    }
                    case 'log':
                        pdfBlob = await pdf(<AttendanceLogDocument 
                            data={attendanceLogData} 
                            dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                            generatedBy={generatedBy}
                        generatedByRole={generatedByRole}
                        targetUserName={targetUserName}
                        targetUserRole={targetUserRole}
                            logoUrl={logoBase64}
                            filters={resolvedFilters}
                        />).toBlob();
                        break;
                    case 'site_ot':
                        pdfBlob = await pdf(<SiteOtReportDocument 
                            data={site_otReportData} 
                            dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                            generatedBy={generatedBy}
                        generatedByRole={generatedByRole}
                        targetUserName={targetUserName}
                        targetUserRole={targetUserRole}
                            logoUrl={logoBase64}
                            filters={resolvedFilters}
                        />).toBlob();
                        break;
                    case 'audit': {
                        const auditData = auditLogs.map(log => ({
                            dateTime: format(new Date(log.created_at), 'dd MMM yyyy HH:mm'),
                            action: log.action,
                            performer_name: log.performer_name,
                            target_name: log.target_name,
                            detailsStr: JSON.stringify(log.details).substring(0, 100) + (JSON.stringify(log.details).length > 100 ? '...' : '')
                        }));
                        pdfBlob = await pdf(<AuditLogDocument 
                            data={auditData} 
                            dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                            generatedBy={generatedBy}
                        generatedByRole={generatedByRole}
                        targetUserName={targetUserName}
                        targetUserRole={targetUserRole}
                            logoUrl={logoBase64}
                            filters={resolvedFilters}
                        />).toBlob();
                        break;
                    }
                    case 'leave_balance':
                        pdfBlob = await pdf(<LeaveBalanceTrackerDocument 
                            data={leaveBalances} 
                            dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                            generatedBy={generatedBy}
                            generatedByRole={generatedByRole}
                            targetUserName={targetUserName}
                            targetUserRole={targetUserRole}
                            logoUrl={logoBase64}
                            filters={resolvedFilters}
                        />).toBlob();
                        break;
                }
            } catch (pdfErr) {
                console.warn('PDF Attachment Generation failed, sending email without attachment:', pdfErr);
            }

            const attachments = [];
            if (pdfBlob) {
                const base64Content = await blobToBase64(pdfBlob);
                attachments.push({
                    filename: `${reportName}_${format(new Date(), 'dd_MMM_yyyy')}.pdf`,
                    content: base64Content,
                    contentType: 'application/pdf'
                });
            }
            
            await api.sendReportEmail({
                ...payload,
                reportType,
                attachments,
                filters: {
                    user: selectedUser,
                    role: selectedRole,
                    site: selectedSite,
                    company: selectedCompany,
                    status: selectedStatus,
                    dateRange: {
                        start: format(dateRange.startDate!, 'yyyy-MM-dd'),
                        end: format(dateRange.endDate!, 'yyyy-MM-dd')
                    }
                }
            });

            const recipientText = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
            setToast({ message: `Report successfully sent to ${recipientText}`, type: 'success' });
            setIsMailModalOpen(false);
        } catch (error: any) {
            console.error('Mail Report Error:', error);
            setToast({ message: error.message || 'Failed to send report email', type: 'error' });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const advancedAnalyticsData = useMemo(() => {
        if (users.length === 0) {
            return {
                performanceLabels: [],
                performanceValues: [],
                activeCount: 0,
                inactiveCount: 0,
            };
        }

        const roleHours: Record<string, { totalHours: number; count: number }> = {};
        
        const userEventsMap = new Map<string, Map<string, AttendanceEvent[]>>();
        attendanceEvents.forEach(e => {
            const userId = String(e.userId);
            const dateStr = format(new Date(e.timestamp), 'yyyy-MM-dd');
            if (!userEventsMap.has(userId)) userEventsMap.set(userId, new Map());
            const dateMap = userEventsMap.get(userId)!;
            if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
            dateMap.get(dateStr)!.push(e);
        });

        users.forEach(user => {
            const userId = String(user.id);
            const userDays = userEventsMap.get(userId);
            if (!userDays) return;

            let resolvedRole = user.role || 'Other';
            if (resolvedRole.length > 20 && allRoles.length > 0) {
                const roleObj = allRoles.find(r => r.id === resolvedRole);
                if (roleObj) resolvedRole = roleObj.displayName;
            }
            resolvedRole = resolvedRole.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            if (!roleHours[resolvedRole]) {
                roleHours[resolvedRole] = { totalHours: 0, count: 0 };
            }

            userDays.forEach((eventsList, dateStr) => {
                const { workingHours } = processDailyEvents(eventsList, new Date(dateStr));
                if (workingHours > 0) {
                    roleHours[resolvedRole].totalHours += workingHours;
                    roleHours[resolvedRole].count += 1;
                }
            });
        });

        const sortedRoles = Object.keys(roleHours)
            .map(role => ({
                role,
                avgHours: roleHours[role].count > 0 
                    ? parseFloat((roleHours[role].totalHours / roleHours[role].count).toFixed(1))
                    : 0
            }))
            .filter(item => item.avgHours > 0)
            .sort((a, b) => b.avgHours - a.avgHours);

        const performanceLabels = sortedRoles.map(item => item.role);
        const performanceValues = sortedRoles.map(item => item.avgHours);

        const activeCount = users.filter(u => (u as any).isActive !== false).length;
        const inactiveCount = users.filter(u => (u as any).isActive === false).length;

        return {
            performanceLabels,
            performanceValues,
            activeCount,
            inactiveCount
        };
    }, [users, attendanceEvents, allRoles]);

    if (!isInitialLoadComplete || !user) {
        return <LoadingScreen message="Fetching attendance data..." />;
    }

    // Keep dashboard mounted during updates to prevent Chart.js remount flashing.
    // Full screen loading spinner is only used on initial load.

    const ReportSummaryView = () => {
        let rows: any[] = [];
        if (reportType === 'basic') rows = basicReportData || [];
        else if (reportType === 'log') rows = attendanceLogData || [];
        else if (reportType === 'monthly' || reportType === 'work_hours') rows = exportedMonthlyData || [];
        else if (reportType === 'audit') rows = auditLogs || [];
        else if (reportType === 'site_ot') rows = site_otReportData || [];

        if (!rows || rows.length === 0) return <div className="text-center py-10 text-gray-400">No report data available</div>;

        return (
            <div className="space-y-4 pt-4">
                {rows.slice(0, reportPageSize).map((row, i) => (
                    <div key={i} className="bg-[#041b0f] p-4 rounded-xl border border-[#1a3d2c]">
                        <div className="flex justify-between items-start mb-3">
                             <div className="font-bold text-white">{row.userName || 'Unknown'}</div>
                             <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                 row.status === 'P' || row.type === 'punch-in' ? 'bg-emerald-500/20 text-emerald-400' : 
                                 row.status === 'A' || row.type === 'punch-out' ? 'bg-rose-500/20 text-rose-400' : 
                                 row.status === 'W/H' ? 'bg-teal-500/20 text-teal-400' :
                                 row.status === 'W/P' || row.status === 'BL/P' || row.status === 'PL/P' ? 'bg-blue-500/20 text-blue-400' :
                                 'bg-blue-500/20 text-blue-400'
                             }`}>
                                 {row.status || row.displayType || (row.type === 'punch-in' ? 'In' : row.type === 'punch-out' ? 'Out' : 'Log')}
                             </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                             <div>
                                 <span className="text-gray-500 block mb-0.5">Date:</span>
                                 <div className="text-gray-300 font-medium">
                                     {row.date ? format(new Date(String(row.date).replace(/-/g, '/')), 'dd MMM yyyy') : '-'}
                                 </div>
                             </div>
                             {reportType === 'monthly' ? (
                                 <>
                                     <div>
                                         <span className="text-gray-500 block mb-0.5">Present:</span>
                                         <div className="text-gray-300 font-medium">{row.presentDays || 0}d</div>
                                     </div>
                                     <div>
                                         <span className="text-gray-500 block mb-0.5">Absent:</span>
                                         <div className="text-gray-300 font-medium">{row.absentDays || 0}d</div>
                                     </div>
                                     <div>
                                         <span className="text-gray-500 block mb-0.5">Payable:</span>
                                         <div className="text-gray-300 font-medium">{row.totalPayableDays || 0}d</div>
                                     </div>
                                 </>
                             ) : reportType === 'site_ot' ? (
                                 <>
                                     <div>
                                         <span className="text-gray-500 block mb-0.5">Site OT In:</span>
                                         <div className="text-gray-300 font-medium">{row.site_otIn || '-'}</div>
                                     </div>
                                     <div>
                                         <span className="text-gray-500 block mb-0.5">Site OT Out:</span>
                                         <div className="text-gray-300 font-medium">{row.site_otOut || '-'}</div>
                                     </div>
                                     <div>
                                         <span className="text-gray-500 block mb-0.5">Duration:</span>
                                         <div className="text-gray-300 font-medium">{row.duration || '-'}</div>
                                     </div>
                                     <div className="col-span-2">
                                         <span className="text-gray-500 block mb-0.5">Location:</span>
                                         <div className="text-gray-300 font-medium truncate">{row.locationName}</div>
                                     </div>
                                 </>
                             ) : reportType === 'work_hours' ? (
                                 <>
                                     <div>
                                         <span className="text-gray-500 block mb-0.5">Total Days:</span>
                                         <div className="text-gray-300 font-medium">{row.totalDays || 0}d</div>
                                     </div>
                                     <div>
                                         <span className="text-gray-500 block mb-0.5">Present:</span>
                                         <div className="text-gray-300 font-medium">{row.presentDays || 0}d</div>
                                     </div>
                                     <div>
                                         <span className="text-gray-500 block mb-0.5">Working Hrs:</span>
                                         <div className="text-gray-300 font-medium">{Number(row.totalWorkingHours || 0).toFixed(2)}h</div>
                                     </div>
                                     <div>
                                         <span className="text-gray-500 block mb-0.5">OT Hrs:</span>
                                         <div className="text-gray-300 font-medium">{Number(row.otHours || 0).toFixed(2)}h</div>
                                     </div>
                                 </>
                             ) : (
                                 <>
                                     <div>
                                         <span className="text-gray-500 block mb-0.5">Time/Hours:</span>
                                         <div className="text-gray-300 font-medium flex items-center">
                                             {row.duration || row.time || row.checkIn || '-'}
                                             {row.isAutoCheckout && !row.checkOut && (
                                                 <span className="ml-1.5 px-1.5 py-0.5 text-[8px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 flex items-center" title="Punched out by AI System">
                                                     🤖 AI
                                                 </span>
                                             )}
                                         </div>
                                     </div>
                                     {row.checkOut && (
                                         <div>
                                             <span className="text-gray-500 block mb-0.5">Punch Out:</span>
                                             <div className="text-gray-300 font-medium flex items-center">
                                                 {row.checkOut}
                                                 {row.isAutoCheckout && (
                                                     <span className="ml-1.5 px-1.5 py-0.5 text-[8px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 flex items-center" title="Punched out by AI System">
                                                         🤖 AI
                                                     </span>
                                                 )}
                                             </div>
                                         </div>
                                     )}
                                     {row.locationName && (
                                         <div className="col-span-2">
                                             <span className="text-gray-500 block mb-0.5">Location:</span>
                                             <div className="text-gray-300 font-medium truncate">{row.locationName}</div>
                                         </div>
                                     )}
                                 </>
                             )}
                        </div>
                    </div>
                ))}
                {rows.length > reportPageSize && (
                    <div className="text-center text-xs text-gray-500 italic py-2">
                        Showing first {reportPageSize} rows in summary. Download CSV/Excel for full data.
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen p-4 space-y-6 md:bg-transparent bg-[#041b0f]">
            <style>{`
                @keyframes reportFadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-report-fade-in {
                    animation: reportFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-primary-text md:text-gray-900">
                    {isEmployeeView ? 'My Attendance' : 'Attendance Dashboard'}
                </h2>
                {(isAdmin(user?.role) || user?.role?.toLowerCase().replace(/_/g, ' ') === 'hr ops') && (
                    <>
                        {/* Mobile Action Buttons (Grid - Premium Dark Theme) */}
                        <div className="grid grid-cols-3 gap-3 w-full md:hidden mt-2">
                            <button
                                onClick={() => setIsManualEntryModalOpen(true)}
                                className="flex flex-col items-center justify-center gap-2.5 py-4 px-2 rounded-2xl bg-gradient-to-br from-[#123621] to-[#082012] border border-[#1d4d31] shadow-[0_4px_12px_rgba(0,0,0,0.3)] active:scale-[0.97] transition-all"
                            >
                                <div className="p-2.5 rounded-full bg-[#22c55e]/20 text-[#22c55e] shadow-[inset_0_0_8px_rgba(34,197,94,0.3)]">
                                    <UserCheck className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-semibold text-gray-300 text-center leading-[1.2] tracking-wide">Manual<br/>Entry</span>
                            </button>
                            <button
                                onClick={() => setIsAssignLeaveModalOpen(true)}
                                className="flex flex-col items-center justify-center gap-2.5 py-4 px-2 rounded-2xl bg-gradient-to-br from-[#12314a] to-[#071c2b] border border-[#1c4b70] shadow-[0_4px_12px_rgba(0,0,0,0.3)] active:scale-[0.97] transition-all"
                            >
                                <div className="p-2.5 rounded-full bg-[#3b82f6]/20 text-[#3b82f6] shadow-[inset_0_0_8px_rgba(59,130,246,0.3)]">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <span className="text-[11px] font-semibold text-gray-300 text-center leading-[1.2] tracking-wide">Assign<br/>Leave</span>
                            </button>
                            <button
                                onClick={handleExportLeaveBalances}
                                disabled={isExportingLeaves}
                                className="flex flex-col items-center justify-center gap-2.5 py-4 px-2 rounded-2xl bg-gradient-to-br from-[#2f1b4c] to-[#190d2e] border border-[#482875] shadow-[0_4px_12px_rgba(0,0,0,0.3)] active:scale-[0.97] transition-all disabled:opacity-50"
                            >
                                <div className="p-2.5 rounded-full bg-[#8b5cf6]/20 text-[#8b5cf6] shadow-[inset_0_0_8px_rgba(139,92,246,0.3)]">
                                    {isExportingLeaves ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
                                </div>
                                <span className="text-[11px] font-semibold text-gray-300 text-center leading-[1.2] tracking-wide">Export<br/>Balances</span>
                            </button>
                        </div>
                        
                        {/* Desktop Action Buttons */}
                        <div className="hidden md:flex flex-row gap-3 w-auto">
                            <button 
                                onClick={() => setIsManualEntryModalOpen(true)}
                                className="bg-white hover:bg-[#006b3f] text-gray-700 hover:text-white border border-gray-300 hover:border-[#005632] shadow-sm flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-semibold transition-all active:scale-[0.98]"
                            >
                                <UserCheck className="w-5 h-5" />
                                Add Manual Entry
                            </button>
                            <button 
                                onClick={() => setIsAssignLeaveModalOpen(true)}
                                className="bg-white hover:bg-[#006b3f] text-gray-700 hover:text-white border border-gray-300 hover:border-[#005632] shadow-sm flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-semibold transition-all active:scale-[0.98]"
                            >
                                <Calendar className="w-5 h-5" />
                                Assign Leave
                            </button>
                            <button 
                                onClick={handleExportLeaveBalances}
                                disabled={isExportingLeaves}
                                className="bg-white hover:bg-[#006b3f] text-gray-700 hover:text-white border border-gray-300 hover:border-[#005632] shadow-sm flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {isExportingLeaves ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <FileDown className="w-5 h-5" />
                                )}
                                Export Leave Balances
                            </button>
                        </div>
                    </>
                )}
            </div>

            <ManualAttendanceModal 
                isOpen={isManualEntryModalOpen}
                onClose={() => setIsManualEntryModalOpen(false)}
                onSuccess={() => {
                    setToast({ message: 'Manual entry added successfully', type: 'success' });
                    // Refresh data
                    if (dateRange.startDate && dateRange.endDate) {
                        fetchDashboardData(dateRange.startDate, dateRange.endDate);
                    }
                    if (reportType === 'audit') {
                         fetchAuditLogs();
                    }
                }}
                users={users}
                currentUserRole={currentUserRole || ''}
                currentUserId={user?.id || ''}
            />

            <AssignLeaveModal 
                isOpen={isAssignLeaveModalOpen}
                onClose={() => setIsAssignLeaveModalOpen(false)}
                onSuccess={() => {
                    setToast({ message: 'Leave assigned successfully', type: 'success' });
                    // No need to refresh attendance dashboard data here as it won't show the leave until it's approved
                    // but we can refresh to be safe if there are approved leaves in view
                    if (dateRange.startDate && dateRange.endDate) {
                        fetchDashboardData(dateRange.startDate, dateRange.endDate);
                    }
                }}
                users={users}
                currentUserId={user?.id || ''}
            />

            {/* Filters Section */}
            <div className="hidden md:flex bg-transparent md:bg-white p-0 md:p-4 rounded-xl shadow-none md:shadow-sm border-none md:border md:border-gray-100 flex-1 flex-col gap-6">
                
                {/* Date Pills - Scrollable on mobile, with date picker outside scroll container to prevent clipping */}
                <div className="relative" ref={datePickerRef}>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
                        {['Today', 'Yesterday', 'Last 3 Days', 'Last 7 Days', 'This Month', 'Last Month', 'Last 3 Months'].map(filter => (
                            <button
                                key={filter}
                                type="button"
                                onClick={() => handleSetDateFilter(filter)}
                                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                                    pendingActiveDateFilter === filter
                                        ? "bg-[#006b3f] text-white shadow-md border border-[#005632]"
                                        : "bg-[#0b291a] md:bg-white text-gray-300 md:text-gray-700 border border-[#1a3d2c] md:border-gray-300 hover:opacity-80"
                                }`}
                            >
                                {filter}
                            </button>
                        ))}
                        <div className="flex-shrink-0">
                             <button
                                type="button"
                                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                                className={`whitespace-nowrap flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                                    pendingActiveDateFilter === 'Custom'
                                        ? "bg-[#006b3f] text-white shadow-md border border-[#005632]"
                                        : "bg-[#0b291a] md:bg-white text-gray-300 md:text-gray-700 border border-[#1a3d2c] md:border-gray-300 hover:opacity-80"
                                }`}
                            >
                                <Calendar className="h-4 w-4" />
                                {pendingActiveDateFilter === 'Custom'
                                    ? `${format(pendingDateRange.startDate!, 'dd MMM')} - ${format(pendingDateRange.endDate!, 'dd MMM')}`
                                    : 'Custom Range'}
                            </button>
                        </div>
                    </div>
                    {isDatePickerOpen && (
                        <div className="absolute top-full right-0 mt-2 z-50 bg-[#0b291a] md:bg-card border border-[#1a3d2c] md:border-border rounded-xl shadow-xl p-2 min-w-[300px]">
                            <DateRangePicker
                                onChange={handleCustomDateChange}
                                months={isSmallScreen ? 1 : 2}
                                ranges={pendingDateRangeArray}
                                direction="horizontal"
                                maxDate={addDays(new Date(), 1)} // Allow selecting today even if timezone is tricky
                                shownDate={pendingDateRange.startDate || new Date()}
                                moveRangeOnFirstSelection={false}
                            />
                        </div>
                    )}
                </div>

                {/* Dropdowns Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:flex xl:flex-wrap items-end gap-x-3 gap-y-4">
                    <div className="col-span-1">
                        <label htmlFor={reportTypeId} className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Report Type</label>
                        <div className="relative">
                            <select
                                id={reportTypeId}
                                name="reportType"
                                className="w-full border border-[#1a3d2c] md:border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all"
                                value={pendingReportType}
                                onChange={async (e) => {
                                    const val = e.target.value as any;
                                    setPendingReportType(val);
                                    setReportType(val);
                                    setIsReportLoading(true);
                                    if (val === 'audit') {
                                        await fetchAuditLogs();
                                    }
                                    setTimeout(() => {
                                        setIsReportLoading(false);
                                    }, 800);
                                }}
                            >
                                <option value="basic">{getReportLabel('basic', 'Basic Report')}</option>
                                <option value="monthly">{getReportLabel('monthly', 'Monthly Summary')}</option>
                                <option value="work_hours">{getReportLabel('work_hours', 'Work Hours Report')}</option>
                                <option value="leave_balance">{getReportLabel('leave_balance', 'Leave Balance Tracker')}</option>
                                {canViewAllAttendance && (
                                    <>
                                        <option value="site_ot">{getReportLabel('site_ot', 'Site OT Report')}</option>
                                        <option value="log">{getReportLabel('log', 'Attendance Logs')}</option>
                                        <option value="audit">{getReportLabel('audit', 'Audit Logs')}</option>
                                    </>
                                )}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <Filter className="h-3.5 w-3.5 opacity-50" />
                            </div>
                        </div>
                    </div>

                    {!isEmployeeView && (isAdmin(user?.role) || user?.role?.toLowerCase().replace(/_/g, ' ') === 'hr ops') && (
                        <>
                            <div className="col-span-1">
                                <label className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Location</label>
                                <div className="relative">
                                    <select
                                        className="w-full border border-[#1a3d2c] md:border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all"
                                        value={pendingSelectedLocation}
                                        onChange={(e) => {
                                            setPendingSelectedLocation(e.target.value);
                                            setPendingSelectedCompany('all');
                                            setPendingSelectedSite('all');
                                            setPendingSelectedUser('all');
                                        }}
                                    >
                                        <option value="all">All Locations</option>
                                        {activeLocations.map(loc => (
                                            <option key={loc} value={loc}>{loc}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <Filter className="h-3.5 w-3.5 opacity-50" />
                                    </div>
                                </div>
                            </div>

                            <div className="col-span-1">
                                <label className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Company</label>
                                <div className="relative">
                                    <select
                                        className="w-full border border-[#1a3d2c] md:border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all"
                                        value={pendingSelectedCompany}
                                        onChange={(e) => {
                                            setPendingSelectedCompany(e.target.value);
                                            setPendingSelectedSite('all');
                                            setPendingSelectedUser('all');
                                        }}
                                    >
                                        <option value="all">All Companies</option>
                                        {activeOrganizations.map(org => (
                                            <option key={org.id} value={org.id}>{org.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <Filter className="h-3.5 w-3.5 opacity-50" />
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Site</label>
                                <div className="relative">
                                    <select
                                        className="w-full border border-[#1a3d2c] md:border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all"
                                        value={pendingSelectedSite}
                                        onChange={(e) => {
                                            setPendingSelectedSite(e.target.value);
                                            setPendingSelectedUser('all');
                                        }}
                                    >
                                        <option value="all">All Sites</option>
                                        {activeSocieties
                                            .filter(s => pendingSelectedCompany === 'all' || s.companyId === pendingSelectedCompany)
                                            .map(soc => (
                                                <option key={soc.id} value={soc.id}>{soc.name}</option>
                                            ))
                                        }
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <Filter className="h-3.5 w-3.5 opacity-50" />
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Role</label>
                                <div className="relative">
                                    <select
                                        id={roleId}
                                        name="role"
                                        className="w-full border border-[#1a3d2c] md:border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all"
                                        value={pendingSelectedRole}
                                        onChange={(e) => {
                                            setPendingSelectedRole(e.target.value);
                                            setPendingSelectedUser('all');
                                        }}
                                    >
                                        <option value="all">All Roles</option>
                                        {availableRoles.map(role => (
                                            <option key={role} value={role}>
                                                {role ? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <Filter className="h-3.5 w-3.5 opacity-50" />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {(isAdmin(user?.role) || isReportingManager || user?.role?.toLowerCase().replace(/_/g, ' ') === 'hr ops') && (
                        <div className="col-span-1">
                            <label htmlFor={employeeId} className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Employee</label>
                            <div className="relative">
                                <select
                                    id={employeeId}
                                    name="employee"
                                    className="w-full border border-[#1a3d2c] md:border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all"
                                    value={pendingSelectedUser}
                                    onChange={(e) => setPendingSelectedUser(e.target.value)}
                                >
                                    <option value="all">All Employees</option>
                                    {users
                                        .filter(u => 
                                            (pendingSelectedRole === 'all' || u.role === pendingSelectedRole) && 
                                            (pendingSelectedCompany === 'all' || u.societyId === pendingSelectedCompany) &&
                                            (pendingSelectedSite === 'all' || (u.organizationId && u.organizationId.split(',').map(s => s.trim()).includes(pendingSelectedSite))) &&
                                            (pendingSelectedLocation === 'all' || resolveUserLocation(u, orgStructure).toLowerCase() === pendingSelectedLocation.toLowerCase())
                                        )
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))
                                    }
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                    <Filter className="h-3.5 w-3.5 opacity-50" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="col-span-1">
                        <label htmlFor={statusId} className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Status</label>
                        <div className="relative">
                            <select
                                id={statusId}
                                name="status"
                                className="w-full border border-[#1a3d2c] md:border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all"
                                value={pendingSelectedStatus}
                                onChange={(e) => setPendingSelectedStatus(e.target.value)}
                            >
                                <option value="all">All Status</option>
                                <option value="ACTIVE_USERS">Active Users Only</option>
                                <optgroup label="── Attendance ──">
                                    <option value="P">P — Present</option>
                                    <option value="0.5P">0.5P — Half Day</option>
                                    <option value="0.75P">0.75P — Three-Quarter Day</option>
                                    <option value="0.25P">0.25P — Quarter Day</option>
                                    <option value="A">A — Absent</option>
                                    <option value="LOP">LOP — Loss of Pay</option>
                                </optgroup>
                                <optgroup label="── Offs &amp; Holidays ──">
                                    <option value="W/O">W/O — Weekly Off</option>
                                    <option value="H">H — Public Holiday</option>
                                    <option value="H/P">H/P — Holiday Present</option>
                                    <option value="W/P">W/P — Weekend Present</option>
                                    <option value="W/H">W/H — Work From Home</option>
                                    <option value="BL">BL — Blue Leave (3rd Sat)</option>
                                    <option value="PL">PL — Pink Leave (Female)</option>
                                </optgroup>
                                <optgroup label="── Leave Types ──">
                                    <option value="SL">SL — Sick Leave</option>
                                    <option value="EL">EL — Earned Leave</option>
                                    <option value="CL">CL — Casual Leave</option>
                                    <option value="C/O">C/O — Comp Off</option>
                                    <option value="ML">ML — Maternity Leave</option>
                                    <option value="CC">CC — Child Care Leave</option>
                                </optgroup>
                                <optgroup label="── Requests ──">
                                    <option value="RP">RP — Request Permission</option>
                                    <option value="RC">RC — Request Correction</option>
                                </optgroup>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <Filter className="h-3.5 w-3.5 opacity-50" />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <label htmlFor={recordTypeId} className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Record Type</label>
                        <div className="relative">
                            <select
                                id={recordTypeId}
                                name="recordType"
                                className="w-full border border-[#1a3d2c] md:border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all"
                                value={pendingSelectedRecordType}
                                onChange={(e) => setPendingSelectedRecordType(e.target.value)}
                            >
                                <option value="all">All Records</option>
                                <option value="complete">Complete (Punch-in & Punch-out)</option>
                                <option value="missing_checkout">Missing Punch-out</option>
                                <option value="missing_checkin">Missing Punch-in</option>
                                <option value="incomplete">Incomplete (Any Missing)</option>
                                <option value="auto_checkout">Auto Punch-out</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <Filter className="h-3.5 w-3.5 opacity-50" />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-1">
                        <label htmlFor="pageSize-select" className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Show Records</label>
                        <div className="relative">
                            <select
                                id="pageSize-select"
                                name="pageSize"
                                className="w-full border border-[#1a3d2c] md:border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none transition-all"
                                value={pendingReportPageSize}
                                onChange={(e) => setPendingReportPageSize(Number(e.target.value))}
                            >
                                <option value={20}>20 Records</option>
                                <option value={50}>50 Records</option>
                                <option value={100}>100 Records</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <Filter className="h-3.5 w-3.5 opacity-50" />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-2 md:col-span-1 xl:ml-auto">
                        <button
                            onClick={handleApplyFilters}
                            className={`w-full md:w-auto md:min-w-[180px] shadow-sm flex items-center justify-center gap-2 py-3 px-8 rounded-xl font-semibold text-sm md:text-base transition-all duration-300 border ${
                                isFiltersDirty 
                                    ? "bg-rose-600 hover:bg-rose-700 text-white border-none animate-pulse" 
                                    : "bg-[#006b3f] hover:bg-[#005632] text-white border-[#005632]"
                            }`}
                        >
                            <Filter className="w-5 h-5" />
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>

            
            {/* Stats Summary */}
            <div className={`grid grid-cols-2 gap-3 md:gap-6 ${isEmployeeView ? 'lg:grid-cols-6' : 'lg:grid-cols-4'} bg-transparent p-0 rounded-none`}>
                {isEmployeeView ? (
                    // Personal Stats for Normal Users
                    [
                        { title: "Present", value: employeeStats.present, icon: UserCheck, color: "#10b981" },
                        { title: "Absent", value: employeeStats.absent, icon: UserX, color: "#df0637" },
                        { title: "Overtime", value: `${employeeStats.ot}h`, icon: Clock, color: "#1d63ff" },
                        { title: "Comp Offs", value: employeeStats.compOff, icon: TrendingUp, color: "#8b5cf6" },
                        { title: "Leave Bal.", value: employeeStats.elBalance.toFixed(1), icon: TrendingUp, color: "#f59e0b" },
                        { title: "WO Bal.", value: employeeStats.woBalance.toFixed(1), icon: TrendingUp, color: "#0d9488" }
                    ].map((stat, i) => (
                        <DashboardStatCard
                            key={i}
                            icon={stat.icon}
                            label={stat.title}
                            value={stat.value}
                            color={stat.color}
                        />
                    ))
                ) : (
                    <TodayMetricsRow data={todayMetrics} loading={!todayMetrics} />
                )}
            </div>

            {/* Charts Section */}
            {isClientOrManagerView ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-[#0b291a] md:bg-white p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-bold text-white md:text-gray-900">Weekly Attendance Trends</h3>
                            <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#1d63ff]"></div> Present</div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-100"></div> Absent</div>
                            </div>
                        </div>
                        <AttendanceCharts data={chartDatasets} loading={isLoading || !chartDatasets} />
                    </div>
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="bg-[#0b291a] md:bg-white p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-gray-100 shadow-sm h-[260px]">
                            <TopPerformersList data={topPerformers} loading={isLoading || topPerformers.length === 0} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#0b291a] md:bg-card p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-border shadow-sm">
                        <div className="flex items-center mb-6">
                            <BarChart3 className="h-5 w-5 mr-3 text-[#22c55e] md:text-muted" />
                            <h3 className="font-semibold text-white md:text-primary-text">Attendance Trend</h3>
                        </div>
                        <AttendanceCharts data={chartDatasets} loading={isLoading || !chartDatasets} />
                    </div>
                    <div className="bg-[#0b291a] md:bg-card p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-border shadow-sm">
                        <div className="flex items-center mb-6">
                            <TrendingUp className="h-5 w-5 mr-3 text-[#22c55e] md:text-muted" />
                            <h3 className="font-semibold text-white md:text-primary-text">Productivity Trend</h3>
                        </div>
                        <div className="h-64 md:h-[320px] relative">
                            {isLoading || !dashboardData?.productivityTrend ? (
                                <LineChartSkeleton />
                            ) : (
                                <ProductivityChart data={dashboardData.productivityTrend} />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Advanced Analytics Section */}
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isClientOrManagerView ? 'lg:grid-cols-3' : ''} gap-6 mt-6`}>
                {/* Department Attendance (Present Count) */}
                {isClientOrManagerView && (
                    <div className="bg-[#0b291a] md:bg-card p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-border shadow-sm">
                        <div className="flex items-center mb-6">
                            <Users className="h-5 w-5 mr-3 text-[#22c55e] md:text-muted" />
                            <h3 className="font-semibold text-white md:text-primary-text">Department Attendance (Present)</h3>
                        </div>
                        <div className="h-64 relative">
                            {isLoading || !dashboardData?.departmentDistribution ? (
                                <BarChartSkeleton />
                            ) : (
                                <DepartmentAttendanceChart data={dashboardData.departmentDistribution} />
                            )}
                        </div>
                    </div>
                )}
                
                {/* Department Performance */}
                <div className="bg-[#0b291a] md:bg-card p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-border shadow-sm lg:col-span-1">
                    <div className="flex items-center mb-6">
                        <TrendingUp className="h-5 w-5 mr-3 text-[#22c55e] md:text-muted" />
                        <h3 className="font-semibold text-white md:text-primary-text">Department Performance (Avg Working Hours)</h3>
                    </div>
                    {isLoading ? (
                        <BarChartSkeleton />
                    ) : (
                        <DepartmentPerformanceChart 
                            labels={advancedAnalyticsData.performanceLabels} 
                            values={advancedAnalyticsData.performanceValues} 
                        />
                    )}
                </div>

                {/* Staff Retention / Attrition Ratio */}
                <div className="bg-[#0b291a] md:bg-card p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-border shadow-sm lg:col-span-1">
                    <div className="flex items-center mb-6">
                        <BarChart3 className="h-5 w-5 mr-3 text-[#22c55e] md:text-muted" />
                        <h3 className="font-semibold text-white md:text-primary-text">Staff Retention & Attrition Ratio</h3>
                    </div>
                    {isLoading || !dashboardData ? (
                        <LineChartSkeleton />
                    ) : (
                        <AttritionRatioChart 
                            active={dashboardData.totalEmployees - dashboardData.inactiveCount} 
                            inactive={dashboardData.inactiveCount} 
                        />
                    )}
                </div>
            </div>

            {/* Report Preview Section */}
            <div className="block bg-[#0b291a] md:bg-white p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-gray-100 shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-bold text-white md:text-gray-900">Report Preview</h2>
                        <div className="md:hidden flex bg-[#041b0f] p-1 rounded-lg border border-[#1a3d2c]">
                            <button 
                                onClick={() => setPreviewMode('summary')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${previewMode === 'summary' ? 'bg-[#22c55e] text-white' : 'text-gray-400'}`}
                            >
                                Summary
                            </button>
                            <button 
                                onClick={() => setPreviewMode('full')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${previewMode === 'full' ? 'bg-[#22c55e] text-white' : 'text-gray-400'}`}
                            >
                                Full Layout
                            </button>
                        </div>
                    </div>
                    {canDownloadReport && (
                    <>
                        {/* Mobile Grid View */}
                        <div className="grid grid-cols-2 gap-3 w-full md:hidden mt-2">
                            <button
                                type="button"
                                onClick={handleDownloadPdf}
                                disabled={isDownloading}
                                className="flex flex-col items-center justify-center gap-2 py-3.5 px-2 rounded-2xl bg-gradient-to-br from-[#123621] to-[#082012] border border-[#1d4d31] shadow-[0_4px_12px_rgba(0,0,0,0.3)] active:scale-[0.97] transition-all"
                            >
                                <div className="p-2.5 rounded-full bg-[#22c55e]/20 text-[#22c55e] shadow-[inset_0_0_8px_rgba(34,197,94,0.3)]">
                                    {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
                                </div>
                                <span className="text-[11px] font-semibold text-gray-300 text-center leading-[1.2] tracking-wide">Download<br/>PDF</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadExcel}
                                disabled={isDownloading}
                                className="flex flex-col items-center justify-center gap-2 py-3.5 px-2 rounded-2xl bg-gradient-to-br from-[#12314a] to-[#071c2b] border border-[#1c4b70] shadow-[0_4px_12px_rgba(0,0,0,0.3)] active:scale-[0.97] transition-all"
                            >
                                <div className="p-2.5 rounded-full bg-[#3b82f6]/20 text-[#3b82f6] shadow-[inset_0_0_8px_rgba(59,130,246,0.3)]">
                                    {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
                                </div>
                                <span className="text-[11px] font-semibold text-gray-300 text-center leading-[1.2] tracking-wide">Download<br/>Excel</span>
                            </button>
                            {isAdmin(user?.role) && (
                                <button
                                    type="button"
                                    onClick={() => setIsMailModalOpen(true)}
                                    disabled={isDownloading || isSendingEmail}
                                    className="flex flex-col items-center justify-center gap-2 py-3.5 px-2 rounded-2xl bg-gradient-to-br from-[#2f1b4c] to-[#190d2e] border border-[#482875] shadow-[0_4px_12px_rgba(0,0,0,0.3)] active:scale-[0.97] transition-all"
                                >
                                    <div className="p-2.5 rounded-full bg-[#8b5cf6]/20 text-[#8b5cf6] shadow-[inset_0_0_8px_rgba(139,92,246,0.3)]">
                                        {isSendingEmail ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                                    </div>
                                    <span className="text-[11px] font-semibold text-gray-300 text-center leading-[1.2] tracking-wide">Mail<br/>Report</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleDownloadCsv}
                                disabled={isDownloading}
                                className="flex flex-col items-center justify-center gap-2 py-3.5 px-2 rounded-2xl bg-gradient-to-br from-[#292929] to-[#141414] border border-[#404040] shadow-[0_4px_12px_rgba(0,0,0,0.3)] active:scale-[0.97] transition-all"
                            >
                                <div className="p-2.5 rounded-full bg-[#a3a3a3]/20 text-[#a3a3a3] shadow-[inset_0_0_8px_rgba(163,163,163,0.3)]">
                                    {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
                                </div>
                                <span className="text-[11px] font-semibold text-gray-300 text-center leading-[1.2] tracking-wide">Download<br/>CSV</span>
                            </button>
                        </div>
                        
                        {/* Desktop Flex View */}
                        <div className="hidden md:flex flex-row gap-2 w-auto">
                            <button
                                type="button"
                                onClick={handleDownloadPdf}
                                disabled={isDownloading}
                                className="bg-white hover:bg-[#006b3f] text-gray-700 hover:text-white border border-gray-300 hover:border-[#005632] shadow-sm rounded-xl flex items-center justify-center gap-2 py-2.5 px-6 font-semibold whitespace-nowrap transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                {isDownloading ? 'Generating...' : 'Download PDF'}
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadExcel}
                                disabled={isDownloading}
                                className="bg-white hover:bg-[#006b3f] text-gray-700 hover:text-white border border-gray-300 hover:border-[#005632] shadow-sm rounded-xl flex items-center justify-center gap-2 py-2.5 px-6 font-semibold whitespace-nowrap transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                {isDownloading ? 'Generating...' : 'Download Excel'}
                            </button>
                            {isAdmin(user?.role) && (
                                <button
                                    type="button"
                                    onClick={() => setIsMailModalOpen(true)}
                                    disabled={isDownloading || isSendingEmail}
                                    className="bg-white hover:bg-[#006b3f] text-gray-700 hover:text-white border border-gray-300 hover:border-[#005632] shadow-sm rounded-xl flex items-center justify-center gap-2 py-2.5 px-6 font-semibold whitespace-nowrap transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                    {isSendingEmail ? 'Sending...' : 'Mail Report'}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleDownloadCsv}
                                disabled={isDownloading}
                                className="bg-white hover:bg-[#006b3f] text-gray-700 hover:text-white border border-gray-300 hover:border-[#005632] shadow-sm rounded-xl flex items-center justify-center gap-2 py-2.5 px-6 font-semibold whitespace-nowrap transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                {isDownloading ? 'Generating...' : 'Download CSV'}
                            </button>
                        </div>
                    </>
                    )}
                </div>

                {isLoading || isReportLoading ? (
                    <div className="w-full bg-[#041b0f] md:bg-gray-50 border border-[#1a3d2c] md:border-gray-200 rounded-xl min-h-[300px] md:min-h-[400px] flex items-center justify-center">
                        <ReportTableSkeleton />
                    </div>
                ) : isReportLocked ? (
                    renderLockPanel()
                ) : (
                    <>
                        {previewMode === 'summary' ? (
                            <div className="md:hidden animate-report-fade-in">
                                <ReportSummaryView />
                            </div>
                        ) : null}

                        <div className={`border border-[#1a3d2c] md:border-gray-200 rounded-xl bg-[#041b0f] md:bg-gray-50 flex justify-center min-h-[300px] md:min-h-[400px] relative overflow-hidden ${previewMode === 'summary' ? 'hidden md:flex' : 'flex'}`}>
                            <div className="w-full max-w-full overflow-x-auto p-2 md:p-4 custom-scrollbar">
                                <div className="min-w-[850px] md:min-w-full w-full animate-report-fade-in">
                                    {previewContent}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {isMailModalOpen && (
                <MailReportModal
                    isOpen={isMailModalOpen}
                    onClose={() => setIsMailModalOpen(false)}
                    onSend={handleSendEmailReport}
                    isSending={isSendingEmail}
                    reportType={reportType}
                    currentUserEmail={user?.email || ''}
                />
            )}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onDismiss={() => setToast(null)}
                />
            )}
        </div>
    );
};

const DepartmentPerformanceChart: React.FC<{ labels: string[]; values: number[] }> = ({ labels, values }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const instanceRef = useRef<Chart | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        if (instanceRef.current) instanceRef.current.destroy();

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        if (labels.length === 0) {
            instanceRef.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['No Data'],
                    datasets: [{ data: [0], backgroundColor: ['#e2e8f0'] }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { display: false }, x: { display: false } },
                    plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }
            });
            return;
        }

        instanceRef.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.slice(0, 7),
                datasets: [{
                    label: 'Avg Hours Worked / Day',
                    data: values.slice(0, 7),
                    backgroundColor: '#10B981',
                    borderRadius: 6,
                    maxBarThickness: 35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(128, 128, 128, 0.08)' },
                        title: {
                            display: true,
                            text: 'Hours',
                            font: { family: "'Manrope', sans-serif", size: 10, weight: 'bold' }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 10,
                        cornerRadius: 6
                    }
                }
            }
        });

        return () => { instanceRef.current?.destroy(); };
    }, [labels, values]);

    return (
        <div className="h-64 md:h-[320px] relative w-full">
            <canvas ref={canvasRef}></canvas>
        </div>
    );
};

const AttritionRatioChart: React.FC<{ active: number; inactive: number }> = ({ active, inactive }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const instanceRef = useRef<Chart | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        if (instanceRef.current) instanceRef.current.destroy();

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const total = active + inactive;
        if (total === 0) {
            instanceRef.current = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['No Data'],
                    datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }
            });
            return;
        }

        instanceRef.current = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Active Staff', 'Inactive Staff (Last 30d)'],
                datasets: [{
                    data: [active, inactive],
                    backgroundColor: ['#10B981', '#EF4444'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 15,
                            font: { family: "'Manrope', sans-serif", size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 10,
                        cornerRadius: 6
                    }
                }
            }
        });

        return () => { instanceRef.current?.destroy(); };
    }, [active, inactive]);

    const total = active + inactive;
    const rate = total > 0 ? Math.round((inactive / total) * 100) : 0;

    return (
        <div className="h-64 md:h-[320px] relative w-full flex items-center justify-center">
            <canvas ref={canvasRef}></canvas>
            <div className="absolute flex flex-col items-center justify-center translate-y-[-15px]">
                <span className="text-2xl font-black text-gray-900 md:text-gray-800">{rate}%</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Turnover Rate</span>
            </div>
        </div>
    );
};

export default AttendanceDashboard;

