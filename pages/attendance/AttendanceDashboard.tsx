import React, { useState, useEffect, useCallback, useRef, useMemo, useId } from 'react';
import { isAdmin } from '../../utils/auth';

// This component has been extended to support manual date entry for the attendance dashboard, enforce whole
// number increments on the chart axes, and unify the report generation/download flow into a single action.
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { fetchKioskDevices, type KioskDevice } from '../../services/gateApi';
import { pdf } from '@react-pdf/renderer';
import { BasicReportDocument, MonthlyReportDocument, MonthlyMatrixReportDocument, SiteOtReportDocument, AttendanceLogDocument, WorkHoursReportDocument, AuditLogDocument, AttendanceLogDataRow, WorkHoursReportDataRow, SiteOtDataRow, AuditLogDataRow, MonthlyReportRow as PDFMonthlyReportRow, BasicReportDataRow } from './PDFReports';
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
import { BasicReportView, AttendanceLogView, MonthlyStatusView, SiteOtReportView, WorkHoursReportView } from '../../components/attendance/ReportHTMLViews';
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
    exportMonthlyMatrixToExcel,
    exportGenericReportToExcel,
    exportLeaveBalancesToExcel,
    MonthlyReportRow,
    GenericReportColumn,
    LeaveBalanceRow
} from '../../utils/excelExport';
import { calculateWorkingHours, evaluateAttendanceStatus, getStaffCategory } from '../../utils/attendanceCalculations';
import { getFieldStaffStatus } from '../../utils/fieldStaffTracking';
import { FIXED_HOLIDAYS } from '../../utils/constants';
import { exportToCsv } from '../../utils/fastExport';
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
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [recentlyActiveUserIds, setRecentlyActiveUserIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
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
    
    // Dynamic lists derived from users (only show companies/sites that have users)
    const activeOrganizations = useMemo(() => {
        const comps: any[] = [];
        orgStructure.forEach(g => {
            if (g.companies) comps.push(...g.companies);
        });
        
        if (isAdmin(user?.role) || user?.role?.toLowerCase().replace(/_/g, ' ') === 'hr ops') return comps.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        const companyIds = new Set(users.map(u => u.societyId).filter(Boolean));
        return comps
            .filter(c => companyIds.has(c.id))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [users, orgStructure, user]);

    const activeSocieties = useMemo(() => {
        const ents: any[] = [];
        orgStructure.forEach(g => {
            if (g.companies) {
                g.companies.forEach((c: any) => {
                    if (c.entities) ents.push(...c.entities);
                });
            }
        });
        
        if (isAdmin(user?.role) || user?.role?.toLowerCase().replace(/_/g, ' ') === 'hr ops') return ents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        const siteIds = new Set(users.map(u => u.organizationId).filter(Boolean));
        return ents
            .filter(e => siteIds.has(e.id))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [users, orgStructure, user]);
    
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
            if (u.location) locations.add(u.location);
            if (u.locationName) locations.add(u.locationName);
        });
        return Array.from(locations).filter(Boolean).sort();
    }, [orgStructure, users]);
    
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

    const canDownloadReport = user && (isAdmin(user.role) || permissions[user.role]?.includes('download_attendance_report'));
    const canViewAllAttendance = user && (isAdmin(user.role) || permissions[user.role]?.includes('view_all_attendance'));
    
    // Reporting Manager logic
    const [isReportingManager, setIsReportingManager] = useState(false);
    const isEmployeeView = !canViewAllAttendance && !isReportingManager;

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
    const [employeeStats, setEmployeeStats] = useState({ present: 0, absent: 0, ot: 0, compOff: 0 });
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

            setIsLoading(true);
            try {
                // Fetch extra days before start date to handle weekend logic correctly across months
                // Start buffer at the Monday at least 15 days before to ensure two full blocks for calculation
                const bufferStartDate = startOfWeek(subDays(dateRange.startDate, 15), { weekStartsOn: 1 });
                const startStr = bufferStartDate.toISOString();
                // Add 12-hour lookahead to capture night shift completions
                const endStr = new Date(dateRange.endDate.getTime() + 12 * 60 * 60 * 1000).toISOString();

                const [events, compOffs, userHolidays, userLeaves] = await Promise.all([
                    api.getAttendanceEvents(user.id, startStr, endStr),
                    api.getCompOffLogs(user.id),
                    api.getUserHolidays(user.id),
                    api.getLeaveRequests({ 
                        userId: user.id, 
                        startDate: startStr, 
                        endDate: endStr, 
                        status: ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'] 
                    })
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
                        siteHolidays,
                        recurringHolidays,
                        userHolidaysPool: userHolidays || [],
                        leaves: leavesData,
                        daysPresentInWeek,
                        isActiveInPreviousWeek,
                        workingHours,
                        fieldStatus: fStatus
                    });

                    // Track presence for threshold-based rules (like Weekend Off eligibility)
                    const isPresence = statusRaw.includes('P') || statusRaw === 'Present' || statusRaw === 'Half Day' || statusRaw === 'H';
                    const isApprovedLeave = statusRaw.includes('L') && !statusRaw.includes('LOP');
                    
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
                    if (l.status === 'P' || l.status === 'W/H' || l.status === 'W/P' || l.status === 'H/P' || l.status === '0.5P') return acc + 1;
                    if (l.status.startsWith('1/2P')) return acc + 0.5;
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
                setIsLoading(false);
            }
        };

        fetchEmployeeData();
    }, [isEmployeeView, user, dateRange, recurringHolidays]);

    const fetchDashboardData = useCallback((startDate: Date, endDate: Date) => {
        const loadData = async () => {
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
                if (selectedCompany !== 'all') activeStaff = activeStaff.filter(u => u.societyId === selectedCompany);
                if (selectedSite !== 'all') activeStaff = activeStaff.filter(u => u.organizationId === selectedSite);
                if (selectedLocation !== 'all') activeStaff = activeStaff.filter(u => (u.location || u.locationName || '').toLowerCase() === selectedLocation.toLowerCase());
                if (selectedRole !== 'all') activeStaff = activeStaff.filter(u => u.role === selectedRole);
                
                const activeStaffIds = new Set(activeStaff.map(u => u.id));
                const today = new Date();
                const queryStart = isBefore(subDays(startDate, 15), subDays(new Date(), 30)) ? subDays(startDate, 15) : subDays(new Date(), 30);
                // Add 12-hour lookahead to capture night shift completions
                const queryEnd = new Date(endDate.getTime() + 12 * 60 * 60 * 1000);

                const [events, leavesResponse, holidaysResponse, rolesResponse, kioskDevicesResponse] = await Promise.all([
                    api.getAllAttendanceEvents(queryStart.toISOString(), queryEnd.toISOString()),
                    api.getLeaveRequests({ 
                        startDate: queryStart.toISOString(), 
                        endDate: queryEnd.toISOString(), 
                        status: ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'] 
                    }),
                    api.getAllUserHolidays(),
                    api.getRoles(),
                    fetchKioskDevices().catch(() => [])
                ]);

                setAttendanceEvents(events);
                setKioskDevices(kioskDevicesResponse || []);
                const leavesData = (Array.isArray(leavesResponse) ? leavesResponse : leavesResponse.data || []).filter(Boolean);
                setLeaves(leavesData);
                setUserHolidaysPool(holidaysResponse || []);
                setAllRoles(rolesResponse || []);

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

                const days = eachDayOfInterval({ start: startDate, end: endDate });
                const isRangeLong = days.length > 1;
                
                let totalPresentForRange = 0;
                let totalOnLeaveForRange = 0;
                let totalAbsentForRange = 0;

                const labels = days.map(d => format(d, 'dd MMM'));
                const presentTrend: number[] = [];
                const absentTrend: number[] = [];
                const productivityTrend: number[] = [];

                days.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const rawDayEvents = eventsByDate.get(dateStr) || [];
                    const dayEvents = rawDayEvents.filter(e => activeStaffIds.has(e.userId));
                    
                    const dayLeaves = leavesData.filter(l => {
                        const start = new Date(l.startDate);
                        const end = new Date(l.endDate);
                        return day >= start && day <= end && activeStaffIds.has(l.userId);
                    });

                    const dayWFHUserIds = new Set(dayLeaves.filter(l => l.leaveType === 'WFH').map(l => l.userId));
                    const uniqueUsersPresent = new Set([...dayEvents.map(e => e.userId), ...Array.from(dayWFHUserIds)]).size;
                    const usersOnLeave = new Set(dayLeaves.filter(l => l.leaveType !== 'WFH').map(l => l.userId)).size;
                    const absent = Math.max(0, activeStaff.length - uniqueUsersPresent - usersOnLeave);

                    totalPresentForRange += uniqueUsersPresent;
                    totalOnLeaveForRange += usersOnLeave;
                    totalAbsentForRange += absent;
                    presentTrend.push(uniqueUsersPresent);
                    absentTrend.push(absent);

                    let totalHours = 0;
                    const userEvents: Record<string, AttendanceEvent[]> = {};
                    dayEvents.forEach(e => {
                        if (!userEvents[e.userId]) userEvents[e.userId] = [];
                        userEvents[e.userId].push(e);
                    });
                    Object.values(userEvents).forEach(ue => {
                        const { workingHours } = calculateWorkingHours(ue, day);
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
                    const dStart = new Date(l.startDate);
                    const dEnd = new Date(l.endDate);
                    return today >= dStart && today <= dEnd && activeStaffIds.has(l.userId);
                });
                const presentToday = new Set([...todayEvents.map(e => e.userId), ...Array.from(todayLeaves.filter(l => l.leaveType === 'WFH').map(l => l.userId))]).size;
                const onLeaveToday = new Set(todayLeaves.filter(l => l.leaveType !== 'WFH').map(l => l.userId)).size;

                const thirtyDaysAgo = subDays(new Date(), 30);
                const recentlyActiveIds = new Set(
                    events.filter(e => {
                        const t = new Date(e.timestamp);
                        return t >= thirtyDaysAgo && activeStaffIds.has(e.userId);
                    }).map(e => e.userId)
                );
                setRecentlyActiveUserIds(recentlyActiveIds);
                const inactiveCount = Math.max(0, activeStaff.length - recentlyActiveIds.size);

                setDashboardData({
                    totalEmployees: activeStaff.length,
                    presentToday: isRangeLong ? avgPresent : presentToday,
                    absentToday: isRangeLong ? avgAbsent : Math.max(0, activeStaff.length - presentToday - onLeaveToday - inactiveCount),
                    onLeaveToday: isRangeLong ? avgOnLeave : onLeaveToday,
                    inactiveCount,
                    attendanceTrend: { labels, present: presentTrend, absent: absentTrend },
                    productivityTrend: { labels, hours: productivityTrend }
                });
            } catch (error) {
                console.error("Failed to load dashboard data", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [user, selectedCompany, selectedSite, selectedLocation, selectedRole, users]);

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
    }, [dateRange, fetchDashboardData, selectedCompany, selectedSite, selectedLocation, selectedRole, users]);

    const availableRoles = useMemo(() => {
        const roles = new Set(users.map(u => u.role).filter(Boolean));
        return Array.from(roles).sort();
    }, [users]);



    const handleSetDateFilter = (filter: string) => {
        setPendingActiveDateFilter(filter);
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
    };

    const handleCustomDateChange = (item: RangeKeyDict) => {
        const { selection } = item;
        setPendingDateRange(selection);
        setPendingActiveDateFilter('Custom');
        
        // Automatically close the selector only after a full range (start and end) has been picked.
        // If startDate and endDate are different, it indicates the second click of a range selection.
        if (selection.startDate && selection.endDate && selection.startDate.getTime() !== selection.endDate.getTime()) {
            setIsDatePickerOpen(false);
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

        // Filter users based on selection, and exclude management users
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
            filteredUsers = filteredUsers.filter(u => u.organizationId === selectedSite);
        }
        if (selectedLocation !== 'all') {
            filteredUsers = filteredUsers.filter(u => (u.location || u.locationName || '').toLowerCase() === selectedLocation.toLowerCase());
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
                        const isWFH = userLeaves.some(l => 
                            isWithinInterval(checkDate, { start: startOfDay(new Date(l.startDate)), end: endOfDay(new Date(l.endDate)) }) &&
                            (String(l.leaveType || '').toLowerCase().includes('work from home') || String(l.leaveType || '').toLowerCase() === 'wfh')
                        );
                        if (hasActivityCheck || isConfiguredHolidayCheck || isWFH) {
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
                    fieldStatus: fStatus
                });

                const isPresence = status.includes('P') || status === 'Present' || status === 'Half Day' || status === 'H' || status === 'W/H';
                const isApprovedLeave = (status.includes('L') && !status.includes('LOP')) || status === 'W/H' || status.includes('C/C') || status.includes('P/M');
                
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
                    default: return true;
                }
            });
        }
        return filteredData;
    }, [users, attendanceEvents, dateRange, selectedUser, selectedRole, selectedCompany, selectedSite, selectedLocation, selectedStatus, selectedRecordType, recurringHolidays, leaves, userHolidaysPool, officeHolidays, fieldHolidays, siteHolidays]);

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
            filteredUsers = filteredUsers.filter(u => u.organizationId === selectedSite);
        }
        if (selectedLocation !== 'all') {
            filteredUsers = filteredUsers.filter(u => (u.location || u.locationName || '').toLowerCase() === selectedLocation.toLowerCase());
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

        return attendanceEvents
            .filter(e => {
                if (!targetUserIds.has(e.userId)) return false;
                const sessionDateStr = dayKeyMapLogs[e.id];
                return sessionDateStr && sessionDateStr >= startStr && sessionDateStr <= endStr;
            })
            .map(e => {
                const user = usersMap.get(e.userId) as any;
                // Priority: 1) event.locationName (stored in DB), 2) fallback to lat/lon if present
                const location = e.locationName || 
                                (e.latitude && e.longitude ? `${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}` : 'N/A');

                let displayType = e.type.replace('-', ' ');
                if (e.workType === 'field') {
                    if (e.type === 'punch-in') displayType = 'Site Check In';
                    else if (e.type === 'punch-out') displayType = 'Site Check Out';
                }

                // Use session-anchored date for night shifts
                const sessionDateStr = dayKeyMapLogs[e.id];
                const displayDate = sessionDateStr ? format(new Date(sessionDateStr.replace(/-/g, '/')), 'dd MMM yyyy') : '-';

                return {
                    userName: user?.name || 'Unknown',
                    date: displayDate,
                    time: format(new Date(e.timestamp), 'HH:mm:ss'),
                    type: displayType,
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
                    cachedAt: (e as any).cachedAt
                };
            })
            .sort((a, b) => {
                // Newest first: Sort by date then time descending
                if (a.date !== b.date) return b.date.localeCompare(a.date);
                return b.time.localeCompare(a.time);
            });

    }, [users, attendanceEvents, dateRange, selectedUser, selectedRole, selectedCompany, selectedSite, selectedLocation, selectedStatus, kioskDevices]);

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
        if (selectedSite !== 'all') filteredUsers = filteredUsers.filter(u => u.organizationId === selectedSite);
        if (selectedLocation !== 'all') filteredUsers = filteredUsers.filter(u => (u.location || u.locationName || '').toLowerCase() === selectedLocation.toLowerCase());

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
    }, [users, attendanceEvents, dateRange, selectedUser, selectedRole, selectedCompany, selectedSite, selectedLocation, selectedStatus]);


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
        const orgName = selectedSite !== 'all' ? users.find(u => u.organizationId === selectedSite)?.organizationName : 'All Sites';
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
            if (reportType === 'basic') return <BasicReportView data={basicReportData} dateRange={dr} logoUrl={fallbackLogoUrl} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} />;
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
                                            selectedSite={selectedSite}
                                            selectedLocation={selectedLocation}
                                            selectedCompany={selectedCompany}
                                            selectedRole={selectedRole}
                                            users={users}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            }
            if (reportType === 'site_ot') return <SiteOtReportView data={site_otReportData} dateRange={dr} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} />;
            if (reportType === 'log') return <AttendanceLogView data={attendanceLogData} dateRange={dr} logoUrl={fallbackLogoUrl} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} />;
            if (reportType === 'audit') return <AttendanceAuditReport logs={auditLogs} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} />;
            return null;
        }

        // For PDF generation: use react-pdf Document components (NOT safe for DOM rendering)
        if (reportType === 'basic') return <BasicReportDocument data={basicReportData} dateRange={dr} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} />;
        if (reportType === 'log') return <AttendanceLogDocument data={attendanceLogData} dateRange={dr} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} />;
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
            />;
        }
        if (reportType === 'work_hours') return <MonthlyReportDocument data={exportedMonthlyData} dateRange={dr} days={eachDayOfInterval({ start: dateRange.startDate!, end: dateRange.endDate! })} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} />;
        if (reportType === 'site_ot') return <SiteOtReportDocument data={site_otReportData} dateRange={dr} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} />;
        if (reportType === 'audit') {
            const mappedAuditLogs: AuditLogDataRow[] = auditLogs.map(log => ({
                dateTime: format(new Date(log.created_at), 'dd MMM yyyy, HH:mm'),
                action: log.action,
                performer_name: log.performer_name || 'N/A',
                target_name: log.target_name || 'N/A',
                detailsStr: JSON.stringify(log.details)
            }));
            return <AuditLogDocument data={mappedAuditLogs} dateRange={dr} logoUrl={logoBase64} generatedBy={user?.name} generatedByRole={user?.role} targetUserName={targetUserName} targetUserRole={targetUserRole} />;
        }
        
        return null;
    }, [reportType, basicReportData, attendanceLogData, site_otReportData, dateRange, auditLogs, user?.name, users, selectedCompany, selectedSite, selectedLocation, selectedStatus, selectedRole, scopedSettings, exportedMonthlyData]);

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
                    />).toBlob();
                    break;
                }
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
            let fileName = `Attendance_Report_${reportType}_${format(new Date(), 'yyyyMMdd')}.csv`;

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
                        let headerRow = [`"Employee Name"`];
                        daysInMonth.forEach(d => headerRow.push(`"${format(d, 'd')}"`));
                        headerRow.push(`"P"`, `"1/2P"`, `"OT"`, `"C/O"`, `"E/L"`, `"S/L"`, `"F/H"`, `"A"`, `"W/O"`, `"H"`, `"Pay"`);
                        csvContent += headerRow.join(',') + '\n';
                        
                        // Data Rows
                        monthData.forEach(emp => {
                            let rowData = [`"${String(emp.employeeName || emp.userName || 'Unknown').replace(/"/g, '""')}"`];
                            const statuses = emp.statuses || [];
                            daysInMonth.forEach((_, i) => {
                                rowData.push(`"${String(statuses[i] || '-').replace(/"/g, '""')}"`);
                            });
                            rowData.push(
                                `"${emp.presentDays || 0}"`,
                                `"${emp.halfDays || 0}"`,
                                `"${emp.overtimeDays || 0}"`,
                                `"${emp.compOffs || 0}"`,
                                `"${emp.earnedLeaves || 0}"`,
                                `"${emp.sickLeaves || 0}"`,
                                `"${emp.floatingHolidays || 0}"`,
                                `"${emp.absentDays || 0}"`,
                                `"${emp.weekOffs || 0}"`,
                                `"${emp.holidays || 0}"`,
                                `"${emp.totalPayableDays || 0}"`
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
                        />).toBlob();
                        break;
                    }
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

    if (isLoading && !dashboardData) {
        return <LoadingScreen message="Fetching attendance data..." />;
    }

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
                                 row.status === 'W/P' ? 'bg-blue-500/20 text-blue-400' :
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
                <h2 className="text-2xl font-bold text-primary-text md:text-gray-900">
                    {isEmployeeView ? 'My Attendance' : 'Attendance Dashboard'}
                </h2>
                {(isAdmin(user?.role) || user?.role?.toLowerCase().replace(/_/g, ' ') === 'hr ops') && (
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
                        {['Today', 'Yesterday', 'Last 7 Days', 'This Month', 'Last Month', 'Last 3 Months'].map(filter => (
                            <Button
                                key={filter}
                                type="button"
                                onClick={() => handleSetDateFilter(filter)}
                                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                                    pendingActiveDateFilter === filter
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
                                    pendingActiveDateFilter === 'Custom'
                                        ? "bg-[#22c55e] text-white shadow-md border-none"
                                        : "bg-[#0b291a] md:bg-white text-gray-300 md:text-gray-700 border border-[#1a3d2c] md:border-gray-300 hover:opacity-80"
                                }`}
                            >
                                <Calendar className="h-4 w-4" />
                                {pendingActiveDateFilter === 'Custom'
                                    ? `${format(pendingDateRange.startDate!, 'dd MMM')} - ${format(pendingDateRange.endDate!, 'dd MMM')}`
                                    : 'Custom Range'}
                            </Button>
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
                                onChange={(e) => setPendingReportType(e.target.value as any)}
                            >
                                <option value="basic">Basic Report</option>
                                <option value="monthly">Monthly Summary</option>
                                <option value="work_hours">Work Hours Report</option>
                                {(isAdmin(user?.role) || user?.role?.toLowerCase().replace(/_/g, ' ') === 'hr ops') && (
                                    <option value="site_ot">Site OT Report</option>
                                )}
                                {isAdmin(user?.role) && (
                                    <>
                                        <option value="log">Attendance Logs</option>
                                        <option value="audit">Audit Logs</option>
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
                                            (pendingSelectedSite === 'all' || u.organizationId === pendingSelectedSite) &&
                                            (pendingSelectedLocation === 'all' || (u.location || u.locationName || '').toLowerCase() === pendingSelectedLocation.toLowerCase())
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
                                <option value="P">Present (P)</option>
                                <option value="0.5P">Half Day (0.5P)</option>
                                <option value="A">Absent (A)</option>
                                <option value="S/L">Sick Leave (S/L)</option>
                                <option value="E/L">Earned Leave (E/L)</option>
                                <option value="F/H">Floating Holiday (F/H)</option>
                                <option value="C/O">Comp Off (C/O)</option>
                                <option value="M/L">Maternity Leave (M/L)</option>
                                <option value="C/C">Child Care Leave (C/C)</option>
                                <option value="P/L">Pink Leave (P/L)</option>
                                <option value="P/M">Permission (P/M)</option>
                                <option value="LOP">Loss of Pay (LOP)</option>
                                <option value="W/H">Work From Home (W/H)</option>
                                <option value="W/O">Week Off (W/O)</option>
                                <option value="W/P">Week Off Present (W/P)</option>
                                <option value="H">Holiday (H)</option>
                                <option value="H/P">Holiday Present (H/P)</option>
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
                        <Button
                            onClick={handleApplyFilters}
                            className={`w-full text-white shadow-lg flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all duration-300 ${
                                isFiltersDirty 
                                    ? "bg-rose-600 hover:bg-rose-700 animate-pulse" 
                                    : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                        >
                            <Filter className="w-4 h-4" />
                            Apply Filters
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="flex flex-col gap-8 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-6 bg-transparent md:bg-white p-0 md:p-4 rounded-xl">
                {isEmployeeView ? (
                    // Personal Stats for Normal Users
                    [
                        { title: "Present", value: employeeStats.present, icon: UserCheck, color: "bg-emerald-500" },
                        { title: "Absent", value: employeeStats.absent, icon: UserX, color: "bg-[#df0637]" },
                        { title: "Overtime", value: `${employeeStats.ot}h`, icon: Clock, color: "bg-[#1d63ff]" },
                        { title: "Comp Offs", value: employeeStats.compOff, icon: TrendingUp, color: "bg-purple-600" }
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
                    ))
                ) : (
                    // Organizational Stats for Admins/Managers
                    [
                        { title: "Total Employees", value: dashboardData?.totalEmployees || 0, icon: Users, color: "bg-emerald-500" },
                        { title: `Present ${statDateLabel}`, value: dashboardData?.presentToday || 0, icon: UserCheck, color: "bg-[#0eb161]" },
                        { title: `Absent ${statDateLabel}`, value: dashboardData?.absentToday || 0, icon: UserX, color: "bg-[#df0637]" },
                        { title: `On Leave ${statDateLabel}`, value: dashboardData?.onLeaveToday || 0, icon: Clock, color: "bg-[#1d63ff]" }
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
                    ))
                )}
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


            {/* Report Preview Section */}
            <div className="bg-[#0b291a] md:bg-white p-4 md:p-6 rounded-2xl border border-[#1a3d2c] md:border-gray-100 shadow-sm overflow-hidden">
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
                        {isAdmin(user?.role) && (
                            <Button
                                type="button"
                                onClick={() => setIsMailModalOpen(true)}
                                disabled={isDownloading || isSendingEmail}
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-xl flex items-center justify-center gap-2 py-2.5 px-6 font-medium whitespace-nowrap"
                            >
                                {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                {isSendingEmail ? 'Sending...' : 'Mail Report'}
                            </Button>
                        )}
                        <Button
                            type="button"
                            onClick={handleDownloadCsv}
                            disabled={isDownloading}
                            className="bg-gray-700 hover:bg-gray-800 text-white shadow-lg rounded-xl flex items-center justify-center gap-2 py-2.5 px-6 font-medium whitespace-nowrap"
                        >
                            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                            {isDownloading ? 'Generating...' : 'Download CSV'}
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
                        <div className="w-full">
                                {previewContent}
                        </div>
                    </div>
                </div>
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

export default AttendanceDashboard;

