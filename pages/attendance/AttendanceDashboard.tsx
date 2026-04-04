import React, { useState, useEffect, useCallback, useRef, useMemo, useId } from 'react';
import { isAdmin } from '../../utils/auth';

// This component has been extended to support manual date entry for the attendance dashboard, enforce whole
// number increments on the chart axes, and unify the report generation/download flow into a single action.
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { pdf } from '@react-pdf/renderer';
import { BasicReportDocument, MonthlyReportDocument, SiteOtReportDocument, AttendanceLogDocument, WorkHoursReportDocument, AttendanceLogDataRow, WorkHoursReportDataRow, SiteOtDataRow, MonthlyReportRow as PDFMonthlyReportRow, BasicReportDataRow } from './PDFReports';
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
    CompOffLog,
    UserHoliday,
    StaffAttendanceRules,
    FieldAttendanceViolation,
    AttendanceReportType,
    ReportEmailPayload
} from '../../types';
import ManualAttendanceModal from '../../components/attendance/ManualAttendanceModal';
import AssignLeaveModal from '../../components/attendance/AssignLeaveModal';
import AttendanceAuditReport from '../../components/attendance/AttendanceAuditReport';
import MonthlyHoursReport from '../../components/attendance/MonthlyHoursReport';
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
    eachDayOfInterval,
    differenceInHours,
    differenceInMinutes,
    isSaturday,
    isSunday,
    isSameDay,
    isWithinInterval,
    startOfDay,
    endOfDay
} from 'date-fns';
import { Loader2, Download, Users, UserCheck, UserX, UserMinus, Clock, BarChart3, TrendingUp, Calendar, FileDown, Mail, Send, Save, Filter, ChevronDown, Monitor, MapPin } from 'lucide-react';
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
    exportGenericReportToExcel,
    exportLeaveBalancesToExcel,
    MonthlyReportRow,
    GenericReportColumn,
    LeaveBalanceRow
} from '../../utils/excelExport';
import { calculateWorkingHours } from '../../utils/attendanceCalculations';
import { getFieldStaffStatus } from '../../utils/fieldStaffTracking';
import { FIXED_HOLIDAYS } from '../../utils/constants';
import LoadingScreen from '../../components/ui/LoadingScreen';
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


// --- Reusable Dashboard Components ---
const ChartContainer: React.FC<{ title: string, icon: React.ElementType, children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className="bg-card p-4 md:p-6 rounded-xl shadow-card col-span-1">
        <div className="flex items-center mb-4">
            <Icon className="h-5 w-5 mr-3 text-muted" />
            <h3 className="font-semibold text-primary-text">{title}</h3>
        </div>
        <div className="h-64 md:h-80 relative">{children}</div>
    </div>
);

const AttendanceTrendChart: React.FC<{ data: { labels: string[], present: number[], absent: number[] } }> = ({ data }) => {
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
                                backgroundColor: '#005D22',
                                borderColor: '#004218',
                                borderWidth: 1,
                                borderRadius: 4,
                            },
                            {
                                label: 'Absent',
                                data: data.absent,
                                backgroundColor: '#EF4444',
                                borderColor: '#DC2626',
                                borderWidth: 1,
                                borderRadius: 4,
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
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
                                backgroundColor: '#0F172A',
                                titleFont: { family: "'Manrope', sans-serif" },
                                bodyFont: { family: "'Manrope', sans-serif" },
                                cornerRadius: 8,
                                padding: 10,
                                displayColors: true,
                                boxPadding: 4,
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
        <div className="h-full w-full flex flex-col">
            <div className="flex-grow relative">
                <canvas ref={chartRef}></canvas>
            </div>
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
                            pointRadius: 0,
                            pointHoverRadius: 5,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
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
                                backgroundColor: '#0F172A',
                                titleFont: { family: "'Manrope', sans-serif" },
                                bodyFont: { family: "'Manrope', sans-serif" },
                                cornerRadius: 8,
                                padding: 10,
                                displayColors: true,
                                boxPadding: 4,
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
    }, [data]);

    return (
        <div className="h-full w-full flex flex-col">
            <div className="flex-grow relative">
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
    attendanceTrend: { labels: string[]; present: number[]; absent: number[] };
    productivityTrend: { labels: string[]; hours: number[] };
}



// --- Report Modal Component ---



// Extend AttendanceEvent with a locationName field for human readable addresses


const AttendanceDashboard: React.FC = () => {
    const isSmallScreen = useMediaQuery('(max-width: 639px)');
    const { user } = useAuthStore();
    const currentUserRole = user?.role;
    const { permissions } = usePermissionsStore();
    const { attendance, recurringHolidays, officeHolidays, fieldHolidays } = useSettingsStore();

    const [users, setUsers] = useState<User[]>([]);
    const usersRef = useRef<User[]>([]);
    useEffect(() => { usersRef.current = users; }, [users]);

    const [attendanceEvents, setAttendanceEvents] = useState<AttendanceEvent[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [userHolidaysPool, setUserHolidaysPool] = useState<UserHoliday[]>([]);
    // Map of userId -> FieldAttendanceViolation[] for field staff
    const [fieldViolationsMap, setFieldViolationsMap] = useState<Record<string, FieldAttendanceViolation[]>>({});
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [recentlyActiveUserIds, setRecentlyActiveUserIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [scopedSettings, setScopedSettings] = useState<any[]>([]);

    const [dateRange, setDateRange] = useState<Range>({
        startDate: startOfToday(),
        endDate: endOfToday(),
        key: 'selection'
    });

    const dateRangeArray = useMemo(() => [dateRange], [dateRange]);

    const [activeDateFilter, setActiveDateFilter] = useState('Today');
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const datePickerRef = useRef<HTMLDivElement>(null);

    // Fetch logo on mount
    useEffect(() => {
        const fetchLogo = async () => {
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
            setLogoForPdf(logoBase64);
        };
        fetchLogo();
    }, []);

    const [selectedUser, setSelectedUser] = useState<string>('all');
    const [selectedRole, setSelectedRole] = useState<string>('all');
    const [selectedSite, setSelectedSite] = useState<string>('all');
    const [selectedSociety, setSelectedSociety] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [societies, setSocieties] = useState<any[]>([]);
    
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
    const [isDownloading, setIsDownloading] = useState(false);
    const [isExportingLeaves, setIsExportingLeaves] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [reportPageSize, setReportPageSize] = useState<number>(20);


    // --- Fetch Audit Logs ---
    const fetchAuditLogs = useCallback(async () => {
        try {
            const { data: logsData, error: logsError } = await supabase
                .from('attendance_audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(reportPageSize);

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
    }, []);

    useEffect(() => {
        if (reportType === 'audit') {
            fetchAuditLogs();
        }
    }, [reportType, reportPageSize, fetchAuditLogs]);

    const canDownloadReport = user && (isAdmin(user.role) || permissions[user.role]?.includes('download_attendance_report'));
    const canViewAllAttendance = user && (isAdmin(user.role) || permissions[user.role]?.includes('view_all_attendance'));
    const isEmployeeView = !canViewAllAttendance;

    // Employee View State
    const [employeeStats, setEmployeeStats] = useState({ present: 0, absent: 0, ot: 0, compOff: 0 });
    const [employeeLogs, setEmployeeLogs] = useState<any[]>([]);

    const resolveUserRules = useCallback((userId?: string, userCategoryOverride?: 'office' | 'field' | 'site') => {
        const targetUser = userId ? users.find(u => u.id === userId) : user;
        if (!targetUser) return attendance.office;

        const officeRoles = ['admin', 'super_admin', 'hr', 'finance'];
        const userCategory = userCategoryOverride || (officeRoles.includes(targetUser.role?.toLowerCase() || '') ? 'office' : 'field');

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
        if (canDownloadReport) {
            api.getUsers().then(setUsers);
            api.getOrganizations().then(setOrganizations);
            api.getEntities().then(setSocieties);
            api.getAllScopedSettings().then(setScopedSettings);
        }
    }, [canDownloadReport]);

    // Fetch Employee Data
    useEffect(() => {
        const fetchEmployeeData = async () => {
            if (!isEmployeeView || !user || !dateRange.startDate || !dateRange.endDate) return;

            // Resolve rules once for the current viewing user
            const officeRoles = ['admin', 'super_admin', 'hr', 'hr_ops', 'finance'];
            const isOfficeRole = officeRoles.includes(user.role?.toLowerCase() || '');
            const userCategory = isOfficeRole ? 'office' : 'field'; 
            const userRules = resolveUserRules(user.id, userCategory);
            const weeklyOffDays = userRules.weeklyOffDays || [0];

            setIsLoading(true);
            try {
                // Fetch extra days before start date to handle weekend logic correctly across months
                const bufferStartDate = subDays(dateRange.startDate, 7);
                const startStr = bufferStartDate.toISOString();
                const endStr = dateRange.endDate.toISOString();

                const [events, compOffs, userHolidays, userLeaves] = await Promise.all([
                    api.getAttendanceEvents(user.id, startStr, endStr),
                    api.getCompOffLogs(user.id),
                    api.getUserHolidays(user.id),
                    api.getLeaveRequests({ userId: user.id, startDate: startStr, endDate: endStr, status: 'approved' })
                ]);
                
                const leavesData = Array.isArray(userLeaves) ? userLeaves : (userLeaves as any).data || [];
                
                // POPULATE GLOBAL STATE FOR REPORT COMPONENT
                setUserHolidaysPool(userHolidays || []);

                // Calculate Stats
                // Generate logs for extended period to ensure continuity for weekend rules
                const extendedDays = eachDayOfInterval({ start: bufferStartDate, end: dateRange.endDate });

                // 1. Generate Initial Logs (Extended)
                const logs = extendedDays.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayEvents = events.filter(e => format(new Date(e.timestamp), 'yyyy-MM-dd') === dateStr);
                    
                    // Helper for robust holiday/leave date matching
                    const matchesDate = (targetDate: any, compareDay: Date) => {
                        if (!targetDate) return false;
                        try {
                            const compareStr = format(compareDay, 'yyyy-MM-dd');
                            const compareMMDD = format(compareDay, '-MM-dd'); // Matches pool format
                            
                            if (typeof targetDate === 'string') {
                                // 1. Try exact full date match (YYYY-MM-DD)
                                if (targetDate.includes(compareStr)) return true;

                                // 2. Try partial MM-DD match (Year agnostic for selected holidays)
                                // This handles cases where pool holidays are saved as "-01-15" or even "2026-01-15" vs "2025-01-15"
                                if (targetDate.includes(compareMMDD)) return true;
                                if (targetDate.endsWith(compareMMDD)) return true;

                                // 3. Handle specific pool format starting with '-'
                                if (targetDate.startsWith('-')) {
                                    return compareStr.endsWith(targetDate);
                                }
                                
                                // 4. Fallback: Clean string splitting
                                const cleanDate = targetDate.split(' ')[0].split('T')[0];
                                return cleanDate === compareStr;
                            }
                            
                            // 5. If it's a Date object
                            if (targetDate instanceof Date) {
                                return format(targetDate, 'yyyy-MM-dd') === compareStr;
                            }
                            
                            return false;
                        } catch (e) {
                            return false;
                        }
                    };

                    let status = 'A'; // Absent
                    let checkIn = '-';
                    let checkOut = '-';
                    let dailyOT = 0;

                    // Check Holidays/Weekends
                    const dayName = format(day, 'EEEE');
                    const officeRoles = ['admin', 'super_admin', 'hr', 'hr_ops', 'finance'];
                    const isOfficeRole = officeRoles.includes(user.role?.toLowerCase() || '');
                    const userCategoryInner = isOfficeRole ? 'office' : 'field'; 
                    
                    // Already resolved above for this user
                    const weeklyOffDays = userRules.weeklyOffDays || [0];
                    const isWeekend = weeklyOffDays.includes(day.getDay());

                    // 1. Recurring
                    const isRecurringHoliday = recurringHolidays.some(rule => {
                        if (rule.day.toLowerCase() !== dayName.toLowerCase()) return false;
                        const occurrence = Math.ceil(day.getDate() / 7);
                        if (rule.n === occurrence && (rule.type || 'office') === userCategoryInner) {
                             if (userRules && userRules.floatingLeavesExpiryDate) {
                                const expiryDate = startOfDay(new Date(userRules.floatingLeavesExpiryDate));
                                if (startOfDay(day) > expiryDate) {
                                    return false;
                                }
                            }
                            return true;
                        }
                        return false;
                    });

                    // 2. Fixed
                    const isFixedHoliday = FIXED_HOLIDAYS.some(fh => {
                        const [m, d] = fh.date.split('-').map(Number);
                        return day.getMonth() === (m - 1) && day.getDate() === d;
                    });

                    // 3. Pool (Selected)
                    const isPoolHoliday = userHolidays.some(uh => {
                        const hDate = uh.holidayDate || (uh as any).holiday_date;
                        return matchesDate(hDate, day);
                    });

                    const isHoliday = isRecurringHoliday || isFixedHoliday || isPoolHoliday;

                    // 4. Approved Leave
                    const approvedLeave = leavesData.find((l: any) => 
                        isWithinInterval(day, {
                            start: startOfDay(new Date(l.startDate)),
                            end: endOfDay(new Date(l.endDate))
                        })
                    );

                    const hasActivity = dayEvents.length > 0;

                    if (isHoliday) {
                        status = hasActivity ? 'HP' : 'H';
                    } else if (approvedLeave && approvedLeave.leaveType !== 'WFH') {
                        const isHalfDay = (approvedLeave as any).dayOption === 'half' || (approvedLeave as any).day_option === 'half';
                        const prefix = isHalfDay ? '1/2' : '';
                        const leaveType = approvedLeave.leaveType?.toLowerCase();
                        if (leaveType === 'sick') status = prefix + 'S/L';
                        else if (leaveType === 'comp off' || leaveType === 'compoff' || leaveType === 'c/o') status = prefix + 'C/O';
                        else if (leaveType === 'loss of pay' || leaveType === 'lop') status = isHalfDay ? '1/2A' : 'A';
                        else status = prefix + 'E/L';
                    } else if (hasActivity || (approvedLeave && approvedLeave.leaveType === 'WFH')) {
                        const isWorkFromHome = (approvedLeave && approvedLeave.leaveType === 'WFH') || 
                                              dayEvents.some(e => e.locationName?.toLowerCase().includes('work from home'));
                        if (isWeekend) status = 'W/P';
                        else if (isWorkFromHome) status = 'W/H';
                        else status = 'P';
                    } else if (isWeekend) {
                        status = 'W/O';
                    }

                    if (hasActivity) {
                        // Sort events
                        dayEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        const checkInEvent = dayEvents.find(e => e.type === 'punch-in');
                        // Use the last check-out of the day to capture full duration
                        const checkOutEvent = [...dayEvents].reverse().find(e => e.type === 'punch-out');

                        if (checkInEvent) checkIn = format(new Date(checkInEvent.timestamp), 'hh:mm a');
                        if (checkOutEvent) {
                            checkOut = format(new Date(checkOutEvent.timestamp), 'hh:mm a');

                             // Calculate OT (based on rules)
                            if (checkInEvent) {
                                const { workingHours } = calculateWorkingHours(dayEvents);
                                const fullDayThreshold = userRules.minimumHoursFullDay || 8;
                                if (workingHours > fullDayThreshold) {
                                    dailyOT = Math.round((workingHours - fullDayThreshold) * 10) / 10;
                                }
                            }
                        }
                    }

                    return {
                        rawDate: day,
                        date: format(day, 'dd MMM, yyyy'),
                        day: dayName,
                        checkIn,
                        checkOut,
                        status,
                        ot: dailyOT
                    };
                });

                // 2. Apply Weekend Rule: If < present threshold days in the preceding week, mark Weekend Off as Absent
                logs.forEach((log, index) => {
                    const isWeeklyOff = weeklyOffDays.includes(log.rawDate.getDay());
                    if (log.status === 'W/O' && isWeeklyOff) {
                        let presentCount = 0;
                        // Look back up to 6 days
                        const lookBackLimit = Math.max(0, index - 6);
                        for (let i = index - 1; i >= lookBackLimit; i--) {
                            // Check if the status starts with 'P' or is 'W/H', 'W/P', 'HP', '0.5P' etc.
                            const s = logs[i].status;
                            if (s === 'P' || s === 'W/H' || s === 'W/P' || s === 'HP' || s === '0.5P' || s === '1/2P') {
                                presentCount++;
                            }
                        }
                        if (presentCount < (userRules.weekendPresentThreshold ?? 4)) {
                            log.status = 'A';
                        }
                    }
                });

                // 3. Filter logs for the actual requested range
                const displayLogs = logs.filter(l => l.rawDate >= dateRange.startDate!);

                // 4. Calculate Final Stats based on displayLogs
                const present = displayLogs.reduce((acc, l) => {
                    if (l.status === 'P' || l.status === 'W/H' || l.status === 'W/P' || l.status === 'H/P') return acc + 1;
                    if (l.status === '0.5P' || l.status.startsWith('1/2P')) return acc + 0.5;
                    return acc;
                }, 0);
                const absent = displayLogs.filter(l => (l.status === 'A' || l.status === '1/2A') && l.rawDate <= new Date()).length;
                const otHours = displayLogs.reduce((acc, l) => acc + l.ot, 0);

                // Comp Offs (Count earned in this period)
                const compOffCount = compOffs.filter(log => {
                    const d = new Date(log.dateEarned);
                    return d >= dateRange.startDate! && d <= dateRange.endDate! && log.status === 'earned';
                }).length;

                setEmployeeStats({ present, absent, ot: Math.round(otHours * 10) / 10, compOff: compOffCount });
                setEmployeeLogs(displayLogs.reverse()); // Newest first

            } catch (error) {
                console.error("Failed to fetch employee attendance", error);
            } finally {
                // Minimum 10 second loading time
                await new Promise(resolve => setTimeout(resolve, 10000));
                setIsLoading(false);
            }
        };

        fetchEmployeeData();
    }, [isEmployeeView, user, dateRange, recurringHolidays]);

    const fetchDashboardData = useCallback(async (startDate: Date, endDate: Date) => {
        if (isEmployeeView) return;
        setIsLoading(true);
        try {
            // Ensure we have users data
            let currentUsers = usersRef.current;
            if (currentUsers.length === 0) {
                currentUsers = await api.getUsers();
                setUsers(currentUsers);
                // Update ref immediately for this execution context
                usersRef.current = currentUsers;
            }

            // Filter out management users from attendance tracking and reports
            let activeStaff = currentUsers.filter(u => u.role !== 'management');
            
            if (selectedSite !== 'all') {
                activeStaff = activeStaff.filter(u => u.organizationId === selectedSite);
            }
            if (selectedSociety !== 'all') {
                activeStaff = activeStaff.filter(u => u.societyId === selectedSociety);
            }
            if (selectedRole !== 'all') {
                activeStaff = activeStaff.filter(u => u.role === selectedRole);
            }
            
            const activeStaffIds = new Set(activeStaff.map(u => u.id));

            // Determine query range
            const today = new Date();
            const queryStart = startDate < today ? startDate : startOfToday();
            const queryEnd = endDate > today ? endDate : endOfToday();

            const [events, recentEvents, leavesResponse, holidaysResponse] = await Promise.all([
                api.getAllAttendanceEvents(queryStart.toISOString(), queryEnd.toISOString()),
                api.getAllAttendanceEvents(subDays(new Date(), 9).toISOString(), endOfDay(new Date()).toISOString()),
                api.getLeaveRequests({ startDate: queryStart.toISOString(), endDate: queryEnd.toISOString(), status: 'approved' }),
                api.getAllUserHolidays()
            ]);

            setAttendanceEvents(events);
            // Extract the data array from the paginated response and filter out any null/undefined entries
            const leavesData = (Array.isArray(leavesResponse) ? leavesResponse : leavesResponse.data || []).filter(Boolean);
            setLeaves(leavesData);
            setUserHolidaysPool(holidaysResponse || []);

            // Fetch field violations for field staff users (for site-time-percentage status)
            const fieldRoles = ['field_staff', 'site_manager'];
            const fieldUsers = usersRef.current.filter(u => fieldRoles.includes(u.role?.toLowerCase() || ''));
            const violationsMap: Record<string, FieldAttendanceViolation[]> = {};
            await Promise.all(fieldUsers.map(async (fu) => {
                try {
                    violationsMap[fu.id] = await api.getFieldViolations(fu.id);
                } catch {
                    violationsMap[fu.id] = [];
                }
            }));
            setFieldViolationsMap(violationsMap);

            // --- Calculate "Today" Stats ---
            const todayStr = format(today, 'yyyy-MM-dd');
            const todayEvents = events.filter(e => 
                format(new Date(e.timestamp), 'yyyy-MM-dd') === todayStr && 
                activeStaffIds.has(e.userId)
            );
            const todayLeaves = leavesData.filter(l => l && l.startDate && l.endDate).filter(l => {
                const start = new Date(l.startDate);
                const end = new Date(l.endDate);
                return today >= start && today <= end && activeStaffIds.has(l.userId);
            });
            const todayWFHUserIds = new Set(todayLeaves.filter(l => l.leaveType === 'WFH').map(l => l.userId));
            const presentToday = new Set([...todayEvents.map(e => e.userId), ...Array.from(todayWFHUserIds)]).size;

            const onLeaveToday = new Set(todayLeaves.filter(l => l.leaveType !== 'WFH').map(l => l.userId)).size;

            // Use activeStaff count (excluding management) for totalEmployees
            const totalEmployees = activeStaff.length;

            // --- Calculate Inactive Status (No activity in last 10 days) ---
            const recentlyActiveIds = new Set(recentEvents.filter(e => activeStaffIds.has(e.userId)).map(e => e.userId));
            setRecentlyActiveUserIds(recentlyActiveIds);
            const inactiveCount = Math.max(0, totalEmployees - recentlyActiveIds.size);

            const absentToday = Math.max(0, totalEmployees - presentToday - onLeaveToday - inactiveCount);


            // --- Calculate Trends (for the selected dateRange only) ---
            const days = eachDayOfInterval({ start: startDate, end: endDate });
            const labels = days.map(d => format(d, 'dd MMM'));
            const presentTrend: number[] = [];
            const absentTrend: number[] = [];
            const productivityData: number[] = [];

            days.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');

                // Present
                const dayEvents = events.filter(e => 
                    format(new Date(e.timestamp), 'yyyy-MM-dd') === dateStr &&
                    activeStaffIds.has(e.userId)
                );
                
                // On Leave
                const activeLeaves = leavesData.filter(l => {
                    const start = new Date(l.startDate);
                    const end = new Date(l.endDate);
                    return day >= start && day <= end && activeStaffIds.has(l.userId);
                });
                const dayWFHUserIds = new Set(activeLeaves.filter(l => l.leaveType === 'WFH').map(l => l.userId));
                const uniqueUsersPresent = new Set([...dayEvents.map(e => e.userId), ...Array.from(dayWFHUserIds)]).size;
                const usersOnLeave = new Set(activeLeaves.filter(l => l.leaveType !== 'WFH').map(l => l.userId)).size;

                // Absent
                const absent = Math.max(0, totalEmployees - uniqueUsersPresent - usersOnLeave);

                presentTrend.push(uniqueUsersPresent);
                absentTrend.push(absent);

                // Productivity (Avg Hours)
                let totalHours = 0;
                const userEvents: Record<string, AttendanceEvent[]> = {};
                dayEvents.forEach(e => {
                    if (!userEvents[e.userId]) userEvents[e.userId] = [];
                    userEvents[e.userId].push(e);
                });

                Object.values(userEvents).forEach(ue => {
                    const { workingHours } = calculateWorkingHours(ue);
                    totalHours += workingHours;
                });

                productivityData.push(uniqueUsersPresent > 0 ? parseFloat((totalHours / uniqueUsersPresent).toFixed(1)) : 0);
            });

            setDashboardData({
                totalEmployees,
                presentToday,
                absentToday,
                onLeaveToday,
                inactiveCount,
                attendanceTrend: {
                    labels,
                    present: presentTrend,
                    absent: absentTrend
                },
                productivityTrend: {
                    labels,
                    hours: productivityData
                }
            });

        } catch (error) {
            console.error("Failed to load dashboard data", error);
        } finally {
            // No intentional delay needed in production
            setIsLoading(false);
        }
    }, [isEmployeeView, selectedSite, selectedSociety, selectedRole]);

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
    }, [dateRange, fetchDashboardData, selectedSite, selectedSociety, selectedRole]);

    const availableRoles = useMemo(() => {
        const roles = new Set(users.map(u => u.role).filter(Boolean));
        return Array.from(roles).sort();
    }, [users]);



    const handleSetDateFilter = (filter: string) => {
        setActiveDateFilter(filter);
        const today = new Date();
        let startDate = startOfToday();
        let endDate = endOfToday();

        if (filter === 'This Month') {
            startDate = startOfMonth(today);
            endDate = endOfMonth(today);
        } else if (filter === 'This Year') {
            startDate = startOfYear(today);
            endDate = endOfYear(today);
        } else if (filter === 'Last 7 Days') {
            startDate = subDays(today, 6);
        } else if (filter === 'Last 30 Days') {
            startDate = subDays(today, 29);
        }

        if (endDate > today) {
            endDate = today;
        }

        setDateRange({ startDate, endDate, key: 'selection' });
    };

    const handleCustomDateChange = (item: RangeKeyDict) => {
        setDateRange(item.selection);
        setActiveDateFilter('Custom');
        setIsDatePickerOpen(false);
    };

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

        // Filter users based on selection, and exclude management users
        let filteredUsers = users.filter(u => u.role !== 'management');

        if (selectedUser !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.id === selectedUser);
        }
        if (selectedRole !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.role === selectedRole);
        }
        if (selectedSite !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.organizationId === selectedSite);
        }
        if (selectedSociety !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.societyId === selectedSociety);
        }

        const activeInPeriodIds = new Set(attendanceEvents.map(e => e.userId));
        if (selectedStatus === 'ACTIVE_USERS') {
            filteredUsers = filteredUsers.filter(u => 
                (u as any).isActive !== false && 
                (recentlyActiveUserIds.has(u.id) || activeInPeriodIds.has(u.id))
            );
        }

        const targetUsers = filteredUsers;

        targetUsers.forEach(user => {
            days.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');

                // Find events for this user and day
                const dayEvents = attendanceEvents.filter(e =>
                    e.userId === user.id && format(new Date(e.timestamp), 'yyyy-MM-dd') === dateStr
                );

                // Check for approved leaves
                const hasApprovedLeave = leaves.filter(l => l && l.startDate && l.endDate).some(l => 
                    l.userId === user.id && 
                    l.status === 'approved' &&
                    isWithinInterval(day, { 
                        start: startOfDay(new Date(l.startDate)), 
                        end: endOfDay(new Date(l.endDate)) 
                    })
                );

                // Determine Status (Simplified logic for Basic Report)
                let status = 'A';
                let checkIn = '';
                let checkOut = '';
                let duration = '';

                // Check for holidays/weekends first
                const dayName = format(day, 'EEEE');
                const officeRoles = ['admin', 'super_admin', 'hr', 'finance'];
                const userCategory = officeRoles.includes(user.role?.toLowerCase() || '') ? 'office' : 'field';

                // RESOLVE RULES FOR THIS USER
                const userRules = resolveUserRules(user.id, userCategory);
                const weeklyOffDays = userRules.weeklyOffDays || [0];
                const isWeekend = weeklyOffDays.includes(day.getDay());

                // Check for recurring holidays
                const isRecurringHoliday = recurringHolidays.some(rule => {
                    if (rule.day.toLowerCase() !== dayName.toLowerCase()) return false;
                    const dayDate = day.getDate();
                    const occurrence = Math.ceil(dayDate / 7);
                    const ruleType = rule.type || 'office';
                    if (rule.n === occurrence && ruleType === userCategory) {
                        if (userRules && userRules.floatingLeavesExpiryDate) {
                            const expiryDate = startOfDay(new Date(userRules.floatingLeavesExpiryDate));
                            if (startOfDay(day) > expiryDate) {
                                return false;
                            }
                        }
                        return true;
                    }
                    return false;
                });

                // Check for fixed holidays
                const isFixedHoliday = FIXED_HOLIDAYS.some(fh => {
                    const [m, d] = fh.date.split('-').map(Number);
                    return day.getMonth() === (m - 1) && day.getDate() === d;
                });

                // Check for pool holidays (selected by user)
                const isPoolHoliday = userHolidaysPool.some(uh => {
                    const uhUserId = uh.userId || (uh as any).user_id;
                    const hDate = uh.holidayDate || (uh as any).holiday_date;
                    if (!uhUserId || !hDate) return false;
                    
                    // ROBUST ID MATCHING: Handle any casing or whitespace
                    const matchId1 = String(uhUserId).trim().toLowerCase();
                    const matchId2 = String(user.id).trim().toLowerCase();
                    
                    if (matchId1 !== matchId2) return false;

                    // ROBUST DATE MATCHING
                    const compareStr = format(day, 'yyyy-MM-dd');
                    const compareMMDD = format(day, '-MM-dd');
                    
                    const hDateStr = String(hDate);
                    return hDateStr.includes(compareStr) || 
                           hDateStr.endsWith(compareMMDD) || 
                           (hDateStr.startsWith('-') && compareStr.endsWith(hDateStr));
                });

                // Check for configured holidays (group based)
                const isConfiguredHoliday = (userCategory === 'field' ? fieldHolidays : officeHolidays).some(h => {
                    const hDateStr = String(h.date);
                    const compareStr = format(day, 'yyyy-MM-dd');
                    const compareMMDD = format(day, '-MM-dd');
                    return hDateStr.includes(compareStr) || 
                           hDateStr.endsWith(compareMMDD) || 
                           (hDateStr.startsWith('-') && compareStr.endsWith(hDateStr));
                });

                const isHoliday = isFixedHoliday || isPoolHoliday || isConfiguredHoliday;

                if (isHoliday) {
                    status = 'H';
                } else if (isRecurringHoliday) {
                    status = 'F/H';
                } else if (isWeekend) {
                    status = 'W/O';
                }

                if (dayEvents.length > 0) {
                    // Sort events by time
                    const sortedEvents = [...dayEvents].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                    const checkInEvent = sortedEvents.find(e => e.type === 'punch-in');
                    // Use the last check-out of the day
                    const checkOutEvent = [...sortedEvents].reverse().find(e => e.type === 'punch-out');

                    if (isRecurringHoliday) {
                        status = 'H/P';
                    } else if (isWeekend) {
                        status = 'W/P';
                    } else {
                        status = 'P';
                    }
                    
                    if (checkInEvent) {
                        checkIn = format(new Date(checkInEvent.timestamp), 'HH:mm');
                    }

                    if (checkOutEvent) {
                        checkOut = format(new Date(checkOutEvent.timestamp), 'HH:mm');
                    }

                    const { workingHours } = calculateWorkingHours(dayEvents);
                    const hours = Math.floor(workingHours);
                    const minutes = Math.round((workingHours - hours) * 60);
                    duration = `${hours}h ${minutes}m`;
                } else if (hasApprovedLeave) {
                    const approvedLeave = leaves.find(l => 
                        l.userId === user.id && 
                        l.status === 'approved' &&
                        isWithinInterval(day, { 
                            start: startOfDay(new Date(l.startDate)), 
                            end: endOfDay(new Date(l.endDate)) 
                        })
                    );
                    const isHalfDay = approvedLeave?.dayOption === 'half' || (approvedLeave as any)?.day_option === 'half';
                    const prefix = isHalfDay ? '1/2' : '';
                    const leaveType = approvedLeave?.leaveType?.toLowerCase();
                    
                    if (leaveType === 'sick') status = prefix + 'S/L';
                    else if (leaveType === 'comp off' || leaveType === 'compoff' || leaveType === 'c/o') status = prefix + 'C/O';
                    else if (leaveType === 'loss of pay' || leaveType === 'lop') status = isHalfDay ? '1/2A' : 'A';
                    else status = prefix + 'E/L';
                }

                const checkInEvent = dayEvents.find(e => e.type === 'punch-in');
                data.push({
                    userName: user.name,
                    date: dateStr,
                    status,
                    checkIn,
                    checkOut,
                    duration,
                    locationName: (checkInEvent?.locationName || 'Office')
                });
            });
        });

        // Apply status filter
        let filteredData = (selectedStatus === 'all' || selectedStatus === 'ACTIVE_USERS')
            ? data
            : data.filter(row => row.status === selectedStatus);

        // Apply record type filter
        if (selectedRecordType !== 'all') {
            filteredData = filteredData.filter(row => {
                const hasCheckIn = row.checkIn && row.checkIn !== '-' && row.checkIn !== '';
                const hasCheckOut = row.checkOut && row.checkOut !== '-' && row.checkOut !== '';

                switch (selectedRecordType) {
                    case 'complete':
                        return hasCheckIn && hasCheckOut;
                    case 'missing_checkout':
                        return hasCheckIn && !hasCheckOut;
                    case 'missing_checkin':
                        return !hasCheckIn && hasCheckOut;
                    case 'incomplete':
                        return !hasCheckIn || !hasCheckOut;
                    default:
                        return true;
                }
            });
        }

        return filteredData;
    }, [users, attendanceEvents, dateRange, selectedUser, selectedRole, selectedSite, selectedSociety, selectedStatus, selectedRecordType, recurringHolidays, leaves, userHolidaysPool, officeHolidays, fieldHolidays, recentlyActiveUserIds]);

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
        if (selectedSite !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.organizationId === selectedSite);
        }
        if (selectedSociety !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.societyId === selectedSociety);
        }

        const activeInPeriodIds = new Set(attendanceEvents.map(e => e.userId));
        if (selectedStatus === 'ACTIVE_USERS') {
            filteredUsers = filteredUsers.filter(u => 
                (u as any).isActive !== false && 
                (recentlyActiveUserIds.has(u.id) || activeInPeriodIds.has(u.id))
            );
        }

        const targetUsers = filteredUsers;
        const targetUserIds = new Set(targetUsers.map(u => u.id));

        return attendanceEvents
            .filter(e => targetUserIds.has(e.userId))
            .map(e => {
                const user = users.find(u => u.id === e.userId);
                // Priority: 1) event.locationName (stored in DB), 2) fallback to lat/lon if present
                const location = e.locationName || 
                                (e.latitude && e.longitude ? `${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}` : 'N/A');

                let displayType = e.type.replace('-', ' ');
                if (e.workType === 'field') {
                    if (e.type === 'punch-in') displayType = 'Site Check In';
                    else if (e.type === 'punch-out') displayType = 'Site Check Out';
                }

                return {
                    userName: user?.name || 'Unknown',
                    date: format(new Date(e.timestamp), 'yyyy-MM-dd'),
                    time: format(new Date(e.timestamp), 'HH:mm:ss'),
                    type: displayType,
                    locationName: location,
                    latitude: e.latitude,
                    longitude: e.longitude,
                    workType: e.workType
                };
            })
            .sort((a, b) => {
                // Newest first: Sort by date then time descending
                if (a.date !== b.date) return b.date.localeCompare(a.date);
                return b.time.localeCompare(a.time);
            });

    }, [users, attendanceEvents, dateRange, selectedUser, selectedRole, selectedSite, selectedSociety, leaves, recurringHolidays, userHolidaysPool, officeHolidays, fieldHolidays, recentlyActiveUserIds]);

    // 3. Monthly Report Data (Aggregated)
    const monthlyReportData: MonthlyReportRow[] = useMemo(() => {
        if (!dateRange.startDate || !dateRange.endDate) return [];

        const days = eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate });
        
        // Exclude management users from monthly reports
        let filteredUsers = users.filter(u => u.role !== 'management');

        if (selectedUser !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.id === selectedUser);
        }
        if (selectedRole !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.role === selectedRole);
        }
        if (selectedSite !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.organizationId === selectedSite);
        }
        if (selectedSociety !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.societyId === selectedSociety);
        }

        const activeInPeriodIds = new Set(attendanceEvents.map(e => e.userId));
        if (selectedStatus === 'ACTIVE_USERS') {
            filteredUsers = filteredUsers.filter(u => 
                (u as any).isActive !== false && 
                (recentlyActiveUserIds.has(u.id) || activeInPeriodIds.has(u.id))
            );
        }

        const targetUsers = filteredUsers;

        const rows = targetUsers.map(user => {
            const officeRoles = ['admin', 'super_admin', 'hr', 'finance'];
            const userCategory = officeRoles.includes(user.role?.toLowerCase() || '') ? 'office' : 'field';
            const userRules = resolveUserRules(user.id, userCategory);
            const weeklyOffDays = userRules.weeklyOffDays || [0];

            const statuses: string[] = [];
            let presentDays = 0;
            let absentDays = 0;
            let halfDays = 0;
            let weekOffs = 0;
            let holidays = 0;
            let weekendPresents = 0;
            let holidayPresents = 0;

            let daysPresentInWeek = 0; // Track for WO rule
            // New counters
            let sickLeaves = 0;
            let earnedLeaves = 0;
            let floatingHolidays = 0;
            let compOffs = 0;
            let lossOfPays = 0;
            let workFromHomeDays = 0;

            days.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                
                // Helper for robust holiday/leave date matching
                const matchesDate = (targetDate: any, compareDay: Date) => {
                    if (!targetDate) return false;
                    try {
                        const compareStr = format(compareDay, 'yyyy-MM-dd');
                        const compareMMDD = format(compareDay, '-MM-dd');
                        
                        // Handle multiple formats: String, Date, objects
                        const dateVal = String(targetDate).split(' ')[0].split('T')[0];

                        // 1. Exact match
                        if (dateVal === compareStr) return true;
                        
                        // 2. Partial match for year-agnostic pool holidays
                        if (dateVal.includes(compareMMDD)) return true;
                        if (dateVal.endsWith(compareMMDD)) return true;

                        // 3. Pool format starting with '-'
                        if (dateVal.startsWith('-')) {
                            return compareStr.endsWith(dateVal);
                        }

                        // 4. Fallback for any weird separator
                        const normalizedCompare = compareStr.replace(/-/g, '');
                        const normalizedTarget = dateVal.replace(/[-\/]/g, '');
                        if (normalizedTarget.includes(normalizedCompare)) return true;

                        return false;
                    } catch (e) {
                        return false;
                    }
                };

                const dayEvents = attendanceEvents.filter(e =>
                    String(e.userId) === String(user.id) && format(new Date(e.timestamp), 'yyyy-MM-dd') === dateStr
                );

                const hasActivity = dayEvents.length > 0;

                // Determine day type (Weekend, Holiday, Regular)
                const dayName = format(day, 'EEEE');
                const isWeekend = weeklyOffDays.includes(day.getDay());

                const userCategoryInner = officeRoles.includes(user.role?.toLowerCase() || '') ? 'office' : 'field';

                // 1. Check Recurring holiday (Floating Holiday)
                const isRecurringHoliday = recurringHolidays.some(rule => {
                    if (rule.day.toLowerCase() !== dayName.toLowerCase()) return false;
                    const dayDate = day.getDate();
                    const occurrence = Math.ceil(dayDate / 7);
                    const ruleType = rule.type || 'office';
                    if (rule.n === occurrence && ruleType === userCategoryInner) {
                        if (userRules && userRules.floatingLeavesExpiryDate) {
                            const expiryDate = startOfDay(new Date(userRules.floatingLeavesExpiryDate));
                            if (startOfDay(day) > expiryDate) {
                                return false;
                            }
                        }
                        return true;
                    }
                    return false;
                });

                // 2. Check FIXED holidays
                const isFixedHoliday = FIXED_HOLIDAYS.some(fh => {
                    const [m, d] = fh.date.split('-').map(Number);
                    return day.getMonth() === (m - 1) && day.getDate() === d;
                });

                // 3. Check POOL holidays (User selected)
                const isPoolHoliday = userHolidaysPool.some(uh => {
                    const uhUserId = uh.userId || (uh as any).user_id;
                    const holidayDate = uh.holidayDate || (uh as any).holiday_date;
                    if (!uhUserId || !holidayDate) return false;
                    
                    // ROBUST ID MATCHING: Use toLowerCase() and trim for UUID comparison
                    const matchId1 = String(uhUserId).trim().toLowerCase();
                    const matchId2 = String(user.id).trim().toLowerCase();
                    
                    return matchId1 === matchId2 && matchesDate(holidayDate, day);
                });

                // 4. Check Configured holidays (Admin settings)
                const isConfiguredHoliday = (userCategory === 'field' ? fieldHolidays : officeHolidays).some(h => 
                    matchesDate(h.date, day)
                );

                const isCompanyHoliday = isFixedHoliday || isPoolHoliday || isConfiguredHoliday;

                // Find approved leaves for this user on this day and get the leave type
                const approvedLeave = leaves.filter(l => l && l.startDate && l.endDate).find(l => 
                    String(l.userId) === String(user.id) && 
                    l.status === 'approved' &&
                    isWithinInterval(day, { 
                        start: startOfDay(new Date(l.startDate)), 
                        end: endOfDay(new Date(l.endDate)) 
                    })
                );

                let status = '';

                // NEW PERMANENT PRIORITY: Holiday > Approved Leave > Work Activity > Weekend > Absent
                if (isCompanyHoliday) {
                    if (hasActivity) {
                        status = 'HP';
                        holidayPresents++;
                    } else {
                        status = 'H';
                        holidays++;
                    }
                } else if (isRecurringHoliday) {
                    if (hasActivity) {
                        status = 'HP';
                        holidayPresents++;
                    } else {
                        status = 'F/H';
                        floatingHolidays++;
                    }
                } else if (approvedLeave) {
                    const isHalfDay = approvedLeave.dayOption === 'half' || (approvedLeave as any).day_option === 'half';
                    const increment = isHalfDay ? 0.5 : 1;
                    const prefix = isHalfDay ? '1/2' : '';
                    const leaveType = approvedLeave.leaveType?.toLowerCase();
                    
                    if (leaveType === 'sick') {
                        status = prefix + 'S/L';
                        sickLeaves += increment;
                    } else if (leaveType === 'comp off' || leaveType === 'comp-off' || leaveType === 'compoff' || leaveType === 'c/o') {
                        status = prefix + 'C/O';
                        compOffs++; // Usually comp-off is 1 log per half/full day as per existing logic
                    } else if (leaveType === 'floating' || leaveType === 'floating holiday') {
                        status = prefix + 'F/H';
                        floatingHolidays += increment;
                    } else if (leaveType === 'loss of pay' || leaveType === 'loss-of-pay' || leaveType === 'lop') {
                        status = isHalfDay ? '1/2A' : 'A';
                        absentDays += increment;
                        lossOfPays += increment;
                    } else {
                        status = prefix + 'E/L';
                        earnedLeaves += increment;
                    }

                    // For half-day leaves, if they worked, handle status merging (like MonthlyHoursReport)
                    if (isHalfDay && hasActivity) {
                         const { workingHours } = calculateWorkingHours(dayEvents);
                         if (workingHours >= 4) {
                             status = 'P ' + status;
                             presentDays += 0.5;
                         } else if (workingHours > 0) {
                             status = '1/2P ' + status;
                         }
                    }
                } else if (hasActivity) {
                    // Calculate worked hours
                    const sortedEvents = dayEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    const checkInEvent = sortedEvents.find(e => e.type === 'punch-in');
                    const checkOutEvent = [...sortedEvents].reverse().find(e => e.type === 'punch-out');
                    
                    const { workingHours } = calculateWorkingHours(dayEvents);
                    const workedMinutes = workingHours * 60;
                    
                    const workedHours = workedMinutes / 60;
                    const minHoursFullDay = 6;
                    const minHoursHalfDay = 3;
                    
                    const isFullDay = workedHours >= minHoursFullDay;
                    const isHalfDay = !isFullDay && workedHours >= minHoursHalfDay;
                    const isWorkFromHome = checkInEvent?.locationName?.toLowerCase().includes('work from home') ||
                                          checkOutEvent?.locationName?.toLowerCase().includes('work from home');
                    
                    if (isWeekend) {
                        status = 'WOP';
                        weekendPresents++;
                    } else if (isWorkFromHome) {
                        status = 'W/H';
                        workFromHomeDays++; 
                    } else if (userCategory === 'field' && attendance.field?.enableSiteTimeTracking) {
                        // FIELD STAFF: Use site-time-percentage logic
                        const userViolations = fieldViolationsMap[user.id] || [];
                        const dayViolation = userViolations.find(v => v.date === dateStr);
                        const fieldResult = getFieldStaffStatus(dayEvents, attendance.field, dayViolation);
                        status = fieldResult.status;

                        if (status === 'P') {
                            presentDays++;
                        } else if (status === '1/2P' || status === '0.5P') {
                            halfDays++;
                        }
                    } else {
                        if (isFullDay) {
                            status = 'P';
                            presentDays++;
                        } else if (isHalfDay) {
                            status = '0.5P';
                            halfDays++;
                        } else {
                            status = 'P'; // Treat minimal activity as P for safety if threshold not met? Or A?
                            presentDays++;
                        }
                    }

                    if (workedHours >= minHoursHalfDay) {
                        daysPresentInWeek++;
                    }
                } else if (isWeekend) {
                    const isFirstWeekend = day.getDate() <= 7;
                    if (isFirstWeekend || daysPresentInWeek >= (userRules.weekendPresentThreshold ?? 4)) {
                        status = 'W/O';
                        weekOffs++;
                    } else {
                        status = 'A';
                        absentDays++;
                    }
                    daysPresentInWeek = 0;
                } else {
                    status = 'A';
                    absentDays++;
                }
                
                statuses.push(status);
            });

            const totalPayableDays = presentDays + weekOffs + holidays + weekendPresents + holidayPresents + (halfDays * 0.5) 
                                     + sickLeaves + earnedLeaves + floatingHolidays + compOffs + workFromHomeDays;

            return {
                userName: user.name,
                statuses,
                presentDays,
                absentDays,
                halfDays,
                weekOffs,
                holidays,
                weekendPresents,
                holidayPresents,
                totalPayableDays,
                sickLeaves,
                earnedLeaves,
                floatingHolidays,
                compOffs,
                lossOfPays,
                workFromHomeDays
            };
        });

        if (selectedStatus === 'ACTIVE_USERS') {
            return rows.filter(row => {
                const workedDays = row.presentDays + row.halfDays + row.workFromHomeDays + row.weekendPresents + row.holidayPresents;
                return workedDays > 0;
            });
        }
        
        return rows.filter(row => {
            if (selectedStatus === 'all') return true;
            return row.statuses.includes(selectedStatus);
        });
    }, [users, attendanceEvents, dateRange, selectedUser, selectedRole, selectedSite, selectedSociety, selectedStatus, selectedRecordType, recurringHolidays, leaves, userHolidaysPool, officeHolidays, fieldHolidays, recentlyActiveUserIds, fieldViolationsMap]);

    // 4. Work Hours Report Data (Aggregated)
    const work_hoursReportData: WorkHoursReportDataRow[] = useMemo(() => {
        if (!dateRange.startDate || !dateRange.endDate) return [];

        let filteredUsers = users.filter(u => u.role !== 'management');
        if (selectedUser !== 'all') filteredUsers = filteredUsers.filter(u => u.id === selectedUser);
        if (selectedRole !== 'all') filteredUsers = filteredUsers.filter(u => u.role === selectedRole);
        if (selectedSite !== 'all') filteredUsers = filteredUsers.filter(u => u.organizationId === selectedSite);
        if (selectedSociety !== 'all') filteredUsers = filteredUsers.filter(u => u.societyId === selectedSociety);

        const activeInPeriodIds = new Set(attendanceEvents.map(e => e.userId));
        if (selectedStatus === 'ACTIVE_USERS') {
            filteredUsers = filteredUsers.filter(u => 
                (u as any).isActive !== false && 
                (recentlyActiveUserIds.has(u.id) || activeInPeriodIds.has(u.id))
            );
        }

        const totalDays = eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate }).length;

        return filteredUsers.map(user => {
            const userEvents = attendanceEvents.filter(e => e.userId === user.id);
            const userLeaves = leaves.filter(l => l.userId === user.id && l.status === 'approved');

            let totalWorkingHours = 0;
            let presentDays = 0;
            let otHours = 0;

            const days = eachDayOfInterval({ start: dateRange.startDate!, end: dateRange.endDate! });
            
            days.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayEvents = userEvents.filter(e => format(new Date(e.timestamp), 'yyyy-MM-dd') === dateStr);
                
                if (dayEvents.length > 0) {
                    const { workingHours } = calculateWorkingHours(dayEvents);
                    totalWorkingHours += workingHours;
                    
                    // Simple logic for present days count in summary
                    if (workingHours >= 4) presentDays += 1;
                    else if (workingHours > 0) presentDays += 0.5;

                    // OT calculation
                    const officeRoles = ['admin', 'super_admin', 'hr', 'finance'];
                    const userCategory = officeRoles.includes(user.role?.toLowerCase() || '') ? 'office' : 'field';
                    const userRules = resolveUserRules(user.id, userCategory);
                    const threshold = userRules.minimumHoursFullDay || 8;
                    if (workingHours > threshold) {
                        otHours += (workingHours - threshold);
                    }
                }
                
                // Add WFH as present
                const isWFH = userLeaves.some(l => 
                    l.leaveType === 'WFH' && 
                    isWithinInterval(day, { start: startOfDay(new Date(l.startDate)), end: endOfDay(new Date(l.endDate)) })
                );
                if (isWFH && dayEvents.length === 0) {
                    presentDays += 1;
                    totalWorkingHours += 8; // Assumed standard if no activity logged
                }
            });

            return {
                userName: user.name,
                department: user.role || 'General',
                totalDays,
                presentDays,
                totalWorkingHours,
                avgWorkingHours: presentDays > 0 ? totalWorkingHours / presentDays : 0,
                otHours
            };
        });
    }, [users, attendanceEvents, dateRange, selectedUser, selectedRole, selectedSite, selectedSociety, selectedStatus, leaves, recentlyActiveUserIds]);

    // 5. Site OT Report Data
    const site_otReportData: SiteOtDataRow[] = useMemo(() => {
        if (!dateRange.startDate || !dateRange.endDate) return [];

        let filteredUsers = users.filter(u => u.role !== 'management');
        if (selectedUser !== 'all') filteredUsers = filteredUsers.filter(u => u.id === selectedUser);
        if (selectedRole !== 'all') filteredUsers = filteredUsers.filter(u => u.role === selectedRole);
        if (selectedSite !== 'all') filteredUsers = filteredUsers.filter(u => u.organizationId === selectedSite);
        if (selectedSociety !== 'all') filteredUsers = filteredUsers.filter(u => u.societyId === selectedSociety);

        const activeInPeriodIds = new Set(attendanceEvents.map(e => e.userId));
        if (selectedStatus === 'ACTIVE_USERS') {
            filteredUsers = filteredUsers.filter(u => 
                (u as any).isActive !== false && 
                (recentlyActiveUserIds.has(u.id) || activeInPeriodIds.has(u.id))
            );
        }

        const targetUserIds = new Set(filteredUsers.map(u => u.id));
        const data: SiteOtDataRow[] = [];

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

                    data.push({
                        userName: user.name,
                        date: format(new Date(event.timestamp), 'yyyy-MM-dd'),
                        siteOtIn: format(new Date(event.timestamp), 'HH:mm'),
                        siteOtOut,
                        duration,
                        locationName: event.locationName || 'N/A'
                    });
                }
            }
        });

        return data.sort((a, b) => b.date.localeCompare(a.date));
    }, [users, attendanceEvents, dateRange, selectedUser, selectedRole, selectedSite, selectedSociety, recentlyActiveUserIds]);


    // Determine which PDF component to render
    const renderReportContent = useCallback((isPreview: boolean = false) => {
        const reportDateRange = `${format(dateRange.startDate!, 'yyyy-MM-dd')} to ${format(dateRange.endDate!, 'yyyy-MM-dd')}`;
        const orgName = selectedSite !== 'all' ? users.find(u => u.organizationId === selectedSite)?.organizationName : 'All Sites';
        const socName = selectedSociety !== 'all' ? users.find(u => u.societyId === selectedSociety)?.societyName : 'All Societies';
        const logoBase64 = logoForPdf;

        if (reportType === 'basic') return <BasicReportDocument data={basicReportData} dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} logoUrl={logoBase64} generatedBy={user?.name} />;
        if (reportType === 'log') return <AttendanceLogDocument data={attendanceLogData} dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} logoUrl={logoBase64} generatedBy={user?.name} />;
        if (reportType === 'monthly') return <MonthlyReportDocument data={monthlyReportData} dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} days={eachDayOfInterval({ start: dateRange.startDate!, end: dateRange.endDate! })} logoUrl={logoBase64} generatedBy={user?.name} />;
        if (reportType === 'work_hours') return <WorkHoursReportDocument data={work_hoursReportData} dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} logoUrl={logoBase64} generatedBy={user?.name} />;
        if (reportType === 'site_ot') return <SiteOtReportDocument data={site_otReportData} dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} logoUrl={logoBase64} generatedBy={user?.name} />;
        if (reportType === 'audit') return <AttendanceAuditReport logs={auditLogs} generatedBy={user?.name} />;
        
        return null;
    }, [reportType, basicReportData, attendanceLogData, monthlyReportData, work_hoursReportData, site_otReportData, dateRange, auditLogs, user?.name, users, selectedSite, selectedSociety]);

    const pdfContent = useMemo(() => renderReportContent(false), [renderReportContent]);
    const previewContent = useMemo(() => renderReportContent(true), [renderReportContent]);



    const handleDownloadPdf = async () => {
        setIsDownloading(true);
        try {
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
                        console.error('Logo fetch failed', e);
                    }
                 }
            }

            const generatedBy = user?.name || 'Unknown User';
            const fileName = `Attendance_Report_${reportType}_${format(new Date(), 'yyyyMMdd')}.pdf`;

            let blob;
            switch (reportType) {
                case 'basic':
                    blob = await pdf(<BasicReportDocument 
                        data={basicReportData} 
                        dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                        generatedBy={generatedBy}
                        logoUrl={logoBase64}
                    />).toBlob();
                    break;
                case 'monthly': {
                    const days = eachDayOfInterval({ start: dateRange.startDate!, end: dateRange.endDate! });
                    blob = await pdf(<MonthlyReportDocument 
                        data={monthlyReportData} 
                        dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                        generatedBy={generatedBy}
                        logoUrl={logoBase64}
                        days={days}
                    />).toBlob();
                    break;
                }
                case 'log':
                    blob = await pdf(<AttendanceLogDocument 
                        data={attendanceLogData} 
                        dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                        generatedBy={generatedBy}
                        logoUrl={logoBase64}
                    />).toBlob();
                    break;
                case 'work_hours':
                    blob = await pdf(<WorkHoursReportDocument 
                        data={work_hoursReportData} 
                        dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                        generatedBy={generatedBy}
                        logoUrl={logoBase64}
                    />).toBlob();
                    break;
                case 'site_ot':
                    blob = await pdf(<SiteOtReportDocument 
                        data={site_otReportData} 
                        dateRange={{ startDate: dateRange.startDate!, endDate: dateRange.endDate! }} 
                        generatedBy={generatedBy}
                        logoUrl={logoBase64}
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

            if (reportType === 'monthly') {
                await exportAttendanceToExcel(
                    monthlyReportData,
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
                        dataToExport = attendanceLogData.map(row => ({
                            'Employee Name': row.userName,
                            'Date': row.date,
                            'Time': row.time,
                            'Event Type': row.type,
                            'Location': row.locationName,
                            'Device': row.device || '-'
                        }));
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
                            dateTime: format(new Date(log.created_at), 'yyyy-MM-dd HH:mm'),
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
                            { header: 'Site OT In', key: 'site_otIn', width: 15 },
                            { header: 'Site OT Out', key: 'site_otOut', width: 15 },
                            { header: 'Duration', key: 'duration', width: 15 },
                            { header: 'Location', key: 'locationName', width: 30 }
                        ];
                        dataToExport = site_otReportData;
                        break;
                    case 'work_hours':
                        reportTitle = 'Monthly Work Hours Report';
                        fileNamePrefix = 'Work_Hours_Report';
                        columns = [
                            { header: 'Employee Name', key: 'userName', width: 25 },
                            { header: 'Department', key: 'department', width: 15 },
                            { header: 'Total Days', key: 'totalDays', width: 12 },
                            { header: 'Present Days', key: 'presentDays', width: 12 },
                            { header: 'Total Working Hours', key: 'totalWorkingHours', width: 18 },
                            { header: 'Avg Daily Hours', key: 'avgWorkingHours', width: 15 },
                            { header: 'OT Hours', key: 'otHours', width: 12 }
                        ];
                        dataToExport = work_hoursReportData.map(row => ({
                            ...row,
                            totalWorkingHours: row.totalWorkingHours.toFixed(2),
                            avgWorkingHours: row.avgWorkingHours.toFixed(2),
                            otHours: row.otHours.toFixed(2)
                        }));
                        break;
                    default:
                        // No specific export logic for work_hours in generic exporter yet
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
                targetUsers = targetUsers.filter(u => u.organizationId === selectedSite);
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
                        earnedTotal: balance.earnedTotal || 0,
                        earnedUsed: balance.earnedUsed || 0,
                        sickTotal: balance.sickTotal || 0,
                        sickUsed: balance.sickUsed || 0,
                        floatingTotal: balance.floatingTotal || 0,
                        floatingUsed: balance.floatingUsed || 0,
                        compOffTotal: balance.compOffTotal || 0,
                        compOffUsed: balance.compOffUsed || 0,
                        maternityTotal: balance.maternityTotal || 0,
                        maternityUsed: balance.maternityUsed || 0,
                        childCareTotal: balance.childCareTotal || 0,
                        childCareUsed: balance.childCareUsed || 0,
                        totalBalance: (balance.earnedTotal - balance.earnedUsed) + 
                                       (balance.sickTotal - balance.sickUsed) + 
                                       (balance.floatingTotal - balance.floatingUsed) + 
                                       (balance.compOffTotal - balance.compOffUsed)
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

    const handleSendEmailReport = async (payload: ReportEmailPayload) => {
        setIsSendingEmail(true);
        try {
            // Log for debugging
            console.log('Sending report email with payload:', payload);
            
            // Format report name for subject if not provided
            const reportName = reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' Report';
            
            await api.sendReportEmail({
                ...payload,
                reportType,
                filters: {
                    user: selectedUser,
                    role: selectedRole,
                    site: selectedSite,
                    society: selectedSociety,
                    status: selectedStatus,
                    dateRange: {
                        start: format(dateRange.startDate!, 'yyyy-MM-dd'),
                        end: format(dateRange.endDate!, 'yyyy-MM-dd')
                    }
                }
            });

            setToast({ message: `Report successfully sent to ${payload.to}`, type: 'success' });
            setIsMailModalOpen(false);
        } catch (error: any) {
            console.error('Mail Report Error:', error);
            setToast({ message: error.message || 'Failed to send report email', type: 'error' });
        } finally {
            setIsSendingEmail(false);
        }
    };

    if (isLoading && !dashboardData && !isEmployeeView) {
        return <LoadingScreen message="Fetching attendance data..." />;
    }

    if (isEmployeeView) {
        return (
            <div className="p-4 space-y-6 pb-24 md:bg-transparent bg-[#041b0f] flex-1 flex flex-col">
                <div className="flex flex-col gap-4">
                    <h2 className="text-2xl font-bold text-primary-text">My Attendance</h2>

                    {/* Date Filter */}
                    <div className="bg-card p-3 rounded-xl shadow-sm border border-border flex flex-wrap items-center gap-2">
                        {['Today', 'This Month', 'Last 30 Days'].map(filter => (
                            <Button
                                key={filter}
                                type="button"
                                variant={activeDateFilter === filter ? 'primary' : 'outline'}
                                onClick={() => handleSetDateFilter(filter)}
                                className={activeDateFilter === filter
                                    ? "text-white shadow-md border"
                                    : "bg-card text-primary-text border border-border hover:bg-accent-light"
                                }
                                style={activeDateFilter === filter ? { backgroundColor: '#006B3F', borderColor: '#005632' } : {}}
                            >
                                {filter}
                            </Button>
                        ))}
                        <div className="relative" ref={datePickerRef}>
                            <Button
                                type="button"
                                variant={activeDateFilter === 'Custom' ? 'primary' : 'outline'}
                                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                                className={activeDateFilter === 'Custom'
                                    ? "text-white shadow-md border"
                                    : "bg-card text-primary-text border border-border hover:bg-accent-light"
                                }
                                style={activeDateFilter === 'Custom' ? { backgroundColor: '#006B3F', borderColor: '#005632' } : {}}
                            >
                                <Calendar className="mr-2 h-4 w-4" />
                                <span>
                                    {activeDateFilter === 'Custom'
                                        ? `${format(dateRange.startDate!, 'dd MMM')} - ${format(dateRange.endDate!, 'dd MMM')}`
                                        : 'Custom'}
                                </span>
                            </Button>
                            {isDatePickerOpen && (
                                <div className="absolute top-full right-0 mt-2 z-50 bg-white dark:bg-gray-950 border border-border rounded-lg shadow-xl w-[300px] sm:w-auto overflow-hidden">
                                    <div className="text-gray-900">
                                        <DateRangePicker
                                            onChange={handleCustomDateChange}
                                            months={1}
                                            ranges={dateRangeArray}
                                            direction="horizontal"
                                            maxDate={new Date()}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
                        <div className="p-4 bg-emerald-600 text-white rounded-full mb-3 shadow-lg shadow-emerald-200 dark:shadow-none">
                            <UserCheck className="h-8 w-8" />
                        </div>
                        <p className="text-sm text-muted font-medium mb-1">Present</p>
                        <p className="text-2xl font-bold text-primary-text">{employeeStats.present}</p>
                    </div>
                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
                        <div className="p-4 bg-rose-600 text-white rounded-full mb-3 shadow-lg shadow-rose-200 dark:shadow-none">
                            <UserX className="h-8 w-8" />
                        </div>
                        <p className="text-sm text-muted font-medium mb-1">Absent</p>
                        <p className="text-2xl font-bold text-primary-text">{employeeStats.absent}</p>
                    </div>
                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
                        <div className="p-4 bg-blue-600 text-white rounded-full mb-3 shadow-lg shadow-blue-200 dark:shadow-none">
                            <Clock className="h-8 w-8" />
                        </div>
                        <p className="text-sm text-muted font-medium mb-1">Overtime</p>
                        <p className="text-2xl font-bold text-primary-text">{employeeStats.ot}h</p>
                    </div>
                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
                        <div className="p-4 bg-purple-600 text-white rounded-full mb-3 shadow-lg shadow-purple-200 dark:shadow-none">
                            <TrendingUp className="h-8 w-8" />
                        </div>
                        <p className="text-sm text-muted font-medium mb-1">Comp Offs</p>
                        <p className="text-2xl font-bold text-primary-text">{employeeStats.compOff}</p>
                    </div>
                </div>

                {/* Logs List */}
                <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                    <div className="p-4 border-b border-border font-semibold text-primary-text">Attendance Logs</div>
                    <div className="divide-y divide-border">
                        {isLoading ? (
                            <div className="p-8 text-center text-muted"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
                        ) : employeeLogs.length === 0 ? (
                            <div className="p-8 text-center text-muted">No records found for this period.</div>
                        ) : (
                            employeeLogs.map((log, idx) => (
                                <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                    <div>
                                        <p className="font-medium text-primary-text">{log.date}</p>
                                        <p className="text-xs text-muted">{log.day}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm
                                            ${log.status === 'Present' ? 'bg-emerald-500 text-white dark:bg-emerald-600' :
                                                log.status === 'Absent' ? 'bg-rose-500 text-white dark:bg-rose-600' :
                                                    log.status === 'Holiday' ? 'bg-amber-500 text-white dark:bg-amber-600' :
                                                        log.status === 'Weekend' ? 'bg-indigo-500 text-white dark:bg-indigo-600' :
                                                            'bg-gray-500 text-white dark:bg-gray-600'}`}>
                                            {log.status}
                                        </span>
                                        {(log.checkIn !== '-' || log.checkOut !== '-') && (
                                            <div className="text-xs text-muted font-medium">
                                                {log.checkIn} - {log.checkOut}
                                            </div>
                                        )}
                                        {log.ot > 0 && (
                                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">+{log.ot}h OT</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const ReportSummaryView = () => {
        let rows: any[] = [];
        if (reportType === 'basic') rows = basicReportData || [];
        else if (reportType === 'log') rows = attendanceLogData || [];
        else if (reportType === 'monthly') rows = monthlyReportData || [];
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
                                 row.status === 'P' || row.type === 'punch-in' ? 'bg-green-500/20 text-green-400' : 
                                 row.status === 'A' || row.type === 'punch-out' ? 'bg-red-500/20 text-red-400' : 
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
                             ) : (
                                 <>
                                     <div>
                                         <span className="text-gray-500 block mb-0.5">Time/Hours:</span>
                                         <div className="text-gray-300 font-medium">{row.duration || row.time || row.checkIn || '-'}</div>
                                     </div>
                                     {row.checkOut && (
                                         <div>
                                             <span className="text-gray-500 block mb-0.5">Punch Out:</span>
                                             <div className="text-gray-300 font-medium">{row.checkOut}</div>
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
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-primary-text md:text-gray-900">Attendance Dashboard</h2>
                {['admin', 'hr', 'hr_ops', 'super_admin'].includes(currentUserRole || '') && (
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <Button 
                            onClick={() => setIsManualEntryModalOpen(true)}
                            className="w-full md:w-auto bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-lg flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
                        >
                            <UserCheck className="w-5 h-5" />
                            Add Manual Entry
                        </Button>
                        <Button 
                            onClick={() => setIsAssignLeaveModalOpen(true)}
                            className="w-full md:w-auto bg-[#3b82f6] hover:bg-[#2563eb] text-white shadow-lg flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
                        >
                            <Calendar className="w-5 h-5" />
                            Assign Leave
                        </Button>
                        <Button 
                            onClick={handleExportLeaveBalances}
                            disabled={isExportingLeaves}
                            className="w-full md:w-auto bg-[#8b5cf6] hover:bg-[#7c3aed] text-white shadow-lg flex items-center justify-center gap-2 py-3 rounded-xl font-semibold disabled:opacity-50"
                        >
                            {isExportingLeaves ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <FileDown className="w-5 h-5" />
                            )}
                            Export Leave Balances
                        </Button>
                    </div>
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
            <div className="bg-transparent md:bg-white p-0 md:p-4 rounded-xl shadow-none md:shadow-sm border-none md:border md:border-gray-100 flex-1 flex flex-col gap-6">
                
                {/* Date Pills - Scrollable on mobile, with date picker outside scroll container to prevent clipping */}
                <div className="relative" ref={datePickerRef}>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
                        {['Today', 'Last 7 Days', 'This Month'].map(filter => (
                            <Button
                                key={filter}
                                type="button"
                                onClick={() => handleSetDateFilter(filter)}
                                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                                    activeDateFilter === filter
                                        ? "bg-[#22c55e] text-white shadow-md border-none"
                                        : "bg-[#0b291a] md:bg-white text-gray-300 md:text-gray-700 border border-[#1a3d2c] md:border-gray-300 hover:opacity-80"
                                }`}
                            >
                                {filter}
                            </Button>
                        ))}
                        <div className="flex-shrink-0">
                             <Button
                                type="button"
                                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                                className={`whitespace-nowrap flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                                    activeDateFilter === 'Custom'
                                        ? "bg-[#22c55e] text-white shadow-md border-none"
                                        : "bg-[#0b291a] md:bg-white text-gray-300 md:text-gray-700 border border-[#1a3d2c] md:border-gray-300 hover:opacity-80"
                                }`}
                            >
                                <Calendar className="h-4 w-4" />
                                {activeDateFilter === 'Custom'
                                    ? `${format(dateRange.startDate!, 'dd MMM')} - ${format(dateRange.endDate!, 'dd MMM')}`
                                    : 'Custom Range'}
                            </Button>
                        </div>
                    </div>
                    {isDatePickerOpen && (
                        <div className="absolute top-full right-0 mt-2 z-50 bg-[#0b291a] md:bg-card border border-[#1a3d2c] md:border-border rounded-xl shadow-xl p-2 min-w-[300px]">
                            <DateRangePicker
                                onChange={handleCustomDateChange}
                                months={1}
                                ranges={dateRangeArray}
                                direction="horizontal"
                                maxDate={new Date()}
                            />
                        </div>
                    )}
                </div>

                {/* Dropdowns Grid */}
                <div className="grid grid-cols-2 md:flex md:flex-wrap items-end gap-x-3 gap-y-4">
                    <div className="col-span-1">
                        <label htmlFor={reportTypeId} className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Report Type</label>
                        <select
                            id={reportTypeId}
                            name="reportType"
                            className="w-full md:w-auto border border-[#1a3d2c] md:border-gray-200 rounded-lg px-3 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none"
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value as any)}
                        >
                            <option value="basic">Basic Report</option>
                            <option value="log">Attendance Log</option>
                            <option value="monthly">Monthly Report</option>
                            <option value="work_hours">Work Hours Report</option>
                            <option value="site_ot">Site OT Report</option>
                            <option value="audit">Audit Log Report</option>
                        </select>
                    </div>

                    <div className="col-span-1">
                        <label htmlFor="site-select" className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Site</label>
                        <select
                            id="site-select"
                            name="site"
                            className="w-full md:w-auto border border-[#1a3d2c] md:border-gray-200 rounded-lg px-3 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none"
                            value={selectedSite}
                            onChange={(e) => {
                                setSelectedSite(e.target.value);
                                setSelectedSociety('all'); // Reset society when site changes
                                setSelectedUser('all');
                            }}
                        >
                            <option value="all">All Sites</option>
                            {organizations.map(org => (
                                <option key={org.id} value={org.id}>{org.fullName || org.shortName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="col-span-1">
                        <label htmlFor="society-select" className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Society</label>
                        <select
                            id="society-select"
                            name="society"
                            className="w-full md:w-auto border border-[#1a3d2c] md:border-gray-200 rounded-lg px-3 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none"
                            value={selectedSociety}
                            onChange={(e) => {
                                setSelectedSociety(e.target.value);
                                setSelectedUser('all');
                            }}
                        >
                            <option value="all">All Societies</option>
                            {societies
                                .filter(s => selectedSite === 'all' || s.organizationId === selectedSite)
                                .map(soc => (
                                    <option key={soc.id} value={soc.id}>{soc.name}</option>
                                ))
                            }
                        </select>
                    </div>

                    <div className="col-span-1">
                        <select
                            id={roleId}
                            name="role"
                            className="w-full md:w-auto border border-[#1a3d2c] md:border-gray-200 rounded-lg px-3 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none"
                            value={selectedRole}
                            onChange={(e) => {
                                setSelectedRole(e.target.value);
                                setSelectedUser('all');
                            }}
                        >
                            <option value="all">All Roles</option>
                            {availableRoles.map(role => (
                                <option key={role} value={role}>
                                    {role ? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-span-1">
                        <label htmlFor={employeeId} className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Employee</label>
                        <select
                            id={employeeId}
                            name="employee"
                            className="w-full md:w-auto border border-[#1a3d2c] md:border-gray-200 rounded-lg px-3 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none"
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                        >
                            <option value="all">All Employees</option>
                            {users
                                .filter(u => 
                                    (selectedRole === 'all' || u.role === selectedRole) && 
                                    (selectedSite === 'all' || u.organizationId === selectedSite) &&
                                    (selectedSociety === 'all' || u.societyId === selectedSociety)
                                )
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))
                            }
                        </select>
                    </div>

                    <div className="col-span-1">
                        <label htmlFor={statusId} className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Status</label>
                        <select
                            id={statusId}
                            name="status"
                            className="w-full md:w-auto border border-[#1a3d2c] md:border-gray-200 rounded-lg px-3 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none"
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="ACTIVE_USERS">Active Users Only</option>
                            <option value="P">Present (P)</option>
                            <option value="0.5P">Half Day (0.5P)</option>
                            <option value="A">Absent (A)</option>
                            <option value="S/L">Sick Leave (S/L)</option>
                            <option value="E/L">Earned Leave (E/L)</option>
                            <option value="F/H">Floating Holiday (F/H)</option>
                            <option value="C/O">Comp Off (C/O)</option>
                            <option value="LOP">Loss of Pay (LOP)</option>
                            <option value="W/H">Work From Home (W/H)</option>
                            <option value="W/O">Week Off (W/O)</option>
                            <option value="W/P">Week Off Present (W/P)</option>
                            <option value="H">Holiday (H)</option>
                            <option value="H/P">Holiday Present (H/P)</option>
                        </select>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <label htmlFor={recordTypeId} className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Record Type</label>
                        <select
                            id={recordTypeId}
                            name="recordType"
                            className="w-full md:w-auto border border-[#1a3d2c] md:border-gray-200 rounded-lg px-3 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none"
                            value={selectedRecordType}
                            onChange={(e) => setSelectedRecordType(e.target.value)}
                        >
                            <option value="all">All Records</option>
                            <option value="complete">Complete (Punch-in & Punch-out)</option>
                            <option value="missing_checkout">Missing Punch-out</option>
                            <option value="missing_checkin">Missing Punch-in</option>
                            <option value="incomplete">Incomplete (Any Missing)</option>
                        </select>
                    </div>

                    <div className="col-span-1">
                        <label htmlFor="pageSize-select" className="block text-xs font-medium text-gray-400 md:text-gray-500 mb-1">Show Records</label>
                        <select
                            id="pageSize-select"
                            name="pageSize"
                            className="w-full md:w-auto border border-[#1a3d2c] md:border-gray-200 rounded-lg px-3 py-2 text-sm bg-[#041b0f] md:bg-white text-white md:text-gray-900 focus:ring-2 focus:ring-[#22c55e] outline-none appearance-none"
                            value={reportPageSize}
                            onChange={(e) => setReportPageSize(Number(e.target.value))}
                        >
                            <option value={20}>20 Records</option>
                            <option value={50}>50 Records</option>
                            <option value={100}>100 Records</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="flex flex-col gap-8 md:grid md:grid-cols-2 lg:grid-cols-5 md:gap-6 bg-transparent md:bg-white p-0 md:p-4 rounded-xl">
                {[
                    { title: "Total Employees", value: dashboardData?.totalEmployees || 0, icon: Users, color: "bg-emerald-500" },
                    { title: `Present ${statDateLabel}`, value: dashboardData?.presentToday || 0, icon: UserCheck, color: "bg-[#0eb161]" },
                    { title: `Absent ${statDateLabel}`, value: dashboardData?.absentToday || 0, icon: UserX, color: "bg-[#df0637]" },
                    { title: `On Leave ${statDateLabel}`, value: dashboardData?.onLeaveToday || 0, icon: Clock, color: "bg-[#1d63ff]" },
                    { title: "Inactive (10+ Days)", value: dashboardData?.inactiveCount || 0, icon: UserMinus, color: "bg-amber-500" }
                ].map((stat, i) => (
                    <div key={i} className="flex items-center gap-6 md:bg-card md:p-6 md:rounded-2xl md:border md:border-[#1a3d2c] md:md:border-gray-100 md:shadow-sm">
                        <div className={`p-4 md:p-3 rounded-full ${stat.color} text-white shadow-xl md:shadow-none`}>
                            <stat.icon className="h-8 w-8 md:h-6 md:w-6" />
                        </div>
                        <div className="flex flex-col">
                            <p className="text-sm md:text-xs font-medium text-gray-400 md:text-gray-500 mb-1">{stat.title}</p>
                            <p className="text-4xl md:text-2xl font-bold text-white md:text-gray-900 leading-none">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#0b291a] md:bg-card p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-border shadow-sm">
                    <div className="flex items-center mb-6">
                        <BarChart3 className="h-5 w-5 mr-3 text-[#22c55e] md:text-muted" />
                        <h3 className="font-semibold text-white md:text-primary-text">Attendance Trend</h3>
                    </div>
                    <div className="h-64 md:h-80 relative">
                        {dashboardData ? <AttendanceTrendChart data={dashboardData.attendanceTrend} /> : <Loader2 className="h-6 w-6 animate-spin text-muted mx-auto mt-20" />}
                    </div>
                </div>
                <div className="bg-[#0b291a] md:bg-card p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-border shadow-sm">
                    <div className="flex items-center mb-6">
                        <TrendingUp className="h-5 w-5 mr-3 text-[#22c55e] md:text-muted" />
                        <h3 className="font-semibold text-white md:text-primary-text">Productivity Trend</h3>
                    </div>
                    <div className="h-64 md:h-80 relative">
                        {dashboardData ? <ProductivityChart data={dashboardData.productivityTrend} /> : <Loader2 className="h-6 w-6 animate-spin text-muted mx-auto mt-20" />}
                    </div>
                </div>
            </div>


            {/* Work Hours Report */}
            {reportType === 'work_hours' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <MonthlyHoursReport 
                        month={(dateRange.startDate?.getMonth() ?? new Date().getMonth()) + 1}
                        year={dateRange.startDate?.getFullYear() || new Date().getFullYear()}
                        userId={selectedUser === 'all' ? undefined : selectedUser}
                    />
                </div>
            )}

            {/* Report Preview */}
            {reportType !== 'work_hours' && (
                <div className="hidden md:block bg-[#0b291a] md:bg-white p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-gray-100 shadow-sm overflow-hidden">
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
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <Button
                                    type="button"
                                    onClick={handleDownloadPdf}
                                    disabled={isDownloading}
                                    className="bg-primary hover:bg-primary-hover text-white shadow-lg rounded-xl flex items-center justify-center gap-2 py-2.5 px-6 font-medium whitespace-nowrap"
                                >
                                    {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                    {isDownloading ? 'Generating...' : 'Download PDF'}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleDownloadExcel}
                                    disabled={isDownloading}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg rounded-xl flex items-center justify-center gap-2 py-2.5 px-6 font-medium whitespace-nowrap"
                                >
                                    {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                    {isDownloading ? 'Generating...' : 'Download Excel'}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => setIsMailModalOpen(true)}
                                    disabled={isDownloading || isSendingEmail}
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-xl flex items-center justify-center gap-2 py-2.5 px-6 font-medium whitespace-nowrap"
                                >
                                    {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                    {isSendingEmail ? 'Sending...' : 'Mail Report'}
                                </Button>
                            </div>
                        )}
                    </div>

                    {previewMode === 'summary' ? (
                        <div className="md:hidden">
                            <ReportSummaryView />
                        </div>
                    ) : null}

                    <div className={`border border-[#1a3d2c] md:border-gray-200 rounded-xl bg-[#041b0f] md:bg-gray-50 flex justify-center min-h-[300px] md:min-h-[400px] relative overflow-hidden ${previewMode === 'summary' ? 'hidden md:flex' : 'flex'}`}>
                        {isLoading && (
                            <div className="absolute inset-0 z-10 bg-[#041b0f]/50 md:bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-[#22c55e] mb-2" />
                                <p className="text-sm font-medium text-gray-300 md:text-gray-600">Updating report data...</p>
                            </div>
                        )}
                        <div className="w-full max-w-full overflow-x-auto p-4 custom-scrollbar">
                            <div className={`origin-top-left sm:origin-top ${reportType === 'basic' ? 'w-full' : 'min-w-[800px] md:min-w-[1123px] transform scale-[0.6] xs:scale-[0.7] sm:scale-[0.85] md:scale-[0.9] lg:scale-100'}`}>
                               {previewContent}
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

export default AttendanceDashboard;

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
    const [message, setMessage] = useState(`Please find attached the ${reportType.replace(/_/g, ' ')} attendance report.`);

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
                        onClick={() => onSend({ to: [email], subject, body: message, triggerType: 'manual' })}
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
