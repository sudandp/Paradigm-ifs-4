import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, subDays } from 'date-fns';
import {
  Users, UserCheck, UserX, Clock, RefreshCw, Database,
  AlertTriangle, TrendingUp, Search, ChevronUp, ChevronDown,
  Calendar, WifiOff, Wifi, BarChart3, Building2, Shield, Radio, Bug, CheckCircle2,
  Settings, Plus, Trash2, Edit3, Sliders, Save, RotateCcw,
  Lock, ShieldCheck, CheckSquare, Square, UserPlus, FileText, Camera, AlertOctagon, MessageSquare, Eye, X, Video, Moon
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import {
  fetchPermissionsFromSupabase,
  savePermissionToSupabase,
  deletePermissionFromSupabase,
  fetchAuditLogsFromSupabase,
  saveAuditLogToSupabase,
  markAuditLogViewedInSupabase,
  fetchShiftRulesFromSupabase,
  saveShiftRuleToSupabase,
  deleteShiftRuleFromSupabase,
  SUPABASE_ACCESS_CONTROL_SQL_MIGRATION
} from '../../services/accessControlSupabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ShiftRuleConfig {
  id: string;
  groupName: string;
  shiftCode: string;
  startTimeSlots: string;
  displayTiming: string;
  expectedHours: number;
  minCompletedHours: number;
  siteName: string;
}

export interface UserSitePermission {
  id: string;
  userEmail: string;
  accessType: 'all' | 'restricted';
  allowedSites: string[];
}

interface AttendanceSummary {
  date: string;
  totalEmployees: number;
  totalHeadcount?: number;
  activeTotal?: number;
  inactiveTotal?: number;
  present: number;
  absent: number;
  late: number;
  onTime: number;
  attendanceRate: number;
}

interface EmployeeRow {
  empCode: string;
  empName: string;
  department: string;
  isSmartSite?: boolean;
  originalDept?: string;
  designation: string;
  inTime: string | null;
  outTime: string | null;
  workingHours: string;
  shiftName?: string;
  shiftCode?: string;
  shiftTiming?: string;
  shiftType?: 'single' | 'double' | 'triple';
  otHours?: string;
  status: 'Present' | 'Absent' | 'Late' | 'Half Day' | 'Not Joined Yet' | 'Discontinued / Left' | string;
  shiftCompleted?: boolean;
  lateMinutes: number;
  isActiveEmployee?: boolean;
  daysSinceLastPunch?: number;
  lifecycleStatus?: string;
  firstEverPunchDate?: string | null;
  hadPrevNightShift?: boolean;
}

interface TrendPoint {
  date: string;
  present: number;
  absent: number;
  attendanceRate: number;
}

interface DeptRow {
  name: string;
  present: number;
  total: number;
}

interface DeviceRow {
  deviceId: number | string;
  serialNo: string;
  deviceName: string;
  location: string;
  lastPing: string | null;
  status: 'online' | 'offline';
}

interface DeviceData {
  devices: DeviceRow[];
  online: number;
  offline: number;
  total: number;
  note?: string;
}

interface AttendanceData {
  summary: AttendanceSummary;
  deviceSummary?: { online: number; offline: number; total: number };
  employees: EmployeeRow[];
  trend: TrendPoint[];
  departments: DeptRow[];
  lastUpdated: string;
  connectionStatus: 'connected' | 'error';
  errorMessage?: string;
}

// ─── Status & Shift Badges ───────────────────────────────────────────────────

const StatusBadge: React.FC<{
  status: string;
  shiftCompleted?: boolean;
  outTime?: string | null;
  shiftType?: 'single' | 'double' | 'triple';
  selectedDate?: string;
  lifecycleStatus?: string;
}> = ({ status, shiftCompleted, outTime, shiftType, selectedDate, lifecycleStatus }) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = !selectedDate || selectedDate === todayStr;

  if (status === 'Not Joined Yet') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
        <UserPlus size={11} className="text-slate-400 shrink-0" />
        Not Joined Yet
      </span>
    );
  }

  if (status === 'Discontinued / Left' || status === 'Discontinued' || lifecycleStatus === 'Discontinued') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900">
        <UserX size={11} className="text-rose-600 shrink-0" />
        Discontinued / Left
      </span>
    );
  }

  if (status === 'Absent') {
    if (isToday) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
          <Clock size={11} className="text-amber-500 shrink-0 animate-pulse" />
          Shift Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-400 dark:border-red-900">
        Absent
      </span>
    );
  }

  if (status === 'Expected Night Shift' || status === 'Night Shift Pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-indigo-100 text-indigo-900 border border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800">
        <Moon size={11} className="text-indigo-600 dark:text-indigo-400 shrink-0 animate-pulse" />
        Expected Night Shift (08:00 PM)
      </span>
    );
  }

  if (shiftType === 'triple') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-red-600 text-white border border-red-700 shadow-xs animate-pulse">
        <AlertTriangle size={11} className="shrink-0" />
        Triple Duty (A+B+C)
      </span>
    );
  }

  if (shiftType === 'double') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-400 text-amber-950 border border-amber-500 shadow-xs">
        <AlertTriangle size={11} className="shrink-0" />
        Double Duty (2 Shifts)
      </span>
    );
  }

  // Shift completed ONLY if backend shiftCompleted flag is true!
  if (shiftCompleted) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700">
        <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        Shift Completed
      </span>
    );
  }

  // Active on duty (In time present, out time not yet punched)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      On Duty
    </span>
  );
};

const ShiftBadge: React.FC<{ shiftName?: string; shiftTiming?: string }> = ({ shiftName, shiftTiming }) => {
  if (!shiftName) return <span className="text-slate-300 dark:text-slate-600">—</span>;

  const colorMap: Record<string, string> = {
    'A Shift': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    'B Shift': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
    'C Shift': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    'General Shift': 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    'Day Shift (12h)': 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
    'Night Shift (12h)': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
    'Security Day': 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    'Security Night': 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
  };

  const style = colorMap[shiftName] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${style} w-max`}>
        {shiftName}
      </span>
      {shiftTiming && (
        <span className="text-[9px] text-slate-400 font-mono">{shiftTiming}</span>
      )}
    </div>
  );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  subLabel?: string;
  loading?: boolean;
  onClick?: () => void;
  isActive?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, icon, color, bgColor, subLabel, loading, onClick, isActive }) => (
  <button
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 rounded-2xl border ${
      isActive
        ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md bg-emerald-50/10 dark:bg-emerald-950/20'
        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
    } p-5 transition-all text-left group relative cursor-pointer w-full`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {label}
          </p>
          {isActive && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Active View" />
          )}
        </div>
        {loading ? (
          <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mt-1" />
        ) : (
          <p className={`text-3xl font-black ${color} leading-none`}>{value}</p>
        )}
        {subLabel && !loading && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 font-medium">{subLabel}</p>
        )}
      </div>
      <div className={`w-11 h-11 rounded-xl ${bgColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
    </div>
  </button>
);

// ─── Custom Tooltip for Chart ─────────────────────────────────────────────────

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-slate-700">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name}>
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: p.fill }} />
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export interface ShiftRuleConfig {
  id: string;
  groupName: string;
  shiftCode: string;
  startTimeSlots: string;
  displayTiming: string;
  expectedHours: number;
  minCompletedHours: number;
  siteName: string;
  codePrefix?: string;
}

const DEFAULT_SHIFT_RULES: ShiftRuleConfig[] = [
  {
    id: 'rule-a',
    groupName: 'A Shift Group',
    shiftCode: 'A',
    startTimeSlots: '06:30, 07:00, 07:30, 08:00',
    displayTiming: '07:00 AM - 02:00 PM',
    expectedHours: 7,
    minCompletedHours: 6,
    siteName: 'All Sites',
    codePrefix: '31',
  },
  {
    id: 'rule-b',
    groupName: 'B Shift Group',
    shiftCode: 'B',
    startTimeSlots: '13:30, 14:00, 14:30, 15:00',
    displayTiming: '02:00 PM - 09:00 PM',
    expectedHours: 7,
    minCompletedHours: 6,
    siteName: 'All Sites',
    codePrefix: '31',
  },
  {
    id: 'rule-c',
    groupName: 'C Shift Group',
    shiftCode: 'C',
    startTimeSlots: '20:30, 21:00, 21:30, 22:00',
    displayTiming: '09:00 PM - 07:00 AM',
    expectedHours: 10,
    minCompletedHours: 6,
    siteName: 'All Sites',
    codePrefix: '31',
  },
  {
    id: 'rule-gen',
    groupName: 'General Shift Group',
    shiftCode: 'GEN',
    startTimeSlots: '08:45, 09:00, 09:30, 10:00, 10:30',
    displayTiming: '09:00 AM - 06:00 PM',
    expectedHours: 9,
    minCompletedHours: 8,
    siteName: 'All Sites',
  },
  {
    id: 'rule-day12',
    groupName: 'Security Day Duty (12h)',
    shiftCode: 'DAY-12',
    startTimeSlots: '07:45, 08:00, 08:30, 08:45, 09:00',
    displayTiming: '08:00 AM - 08:00 PM',
    expectedHours: 12,
    minCompletedHours: 11,
    siteName: 'All Sites',
  },
  {
    id: 'rule-night12',
    groupName: 'Night Duty (12h)',
    shiftCode: 'NIGHT-12',
    startTimeSlots: '19:45, 20:00, 20:30',
    displayTiming: '08:00 PM - 08:00 AM',
    expectedHours: 12,
    minCompletedHours: 11,
    siteName: 'All Sites',
  },
];

export interface UserSitePermission {
  id: string;
  userEmail: string;
  userName?: string;
  accessType: 'all' | 'restricted';
  allowedSites: string[];
  validityType: 'permanent' | 'timebound';
  validUntilDate?: string;
  password?: string;
  isCustomAccount?: boolean;
  createdAt?: string;
}

export interface ScreenshotAuditLog {
  id: string;
  userEmail: string;
  userName: string;
  timestamp: string;
  reason: string;
  captureType: 'screenshot' | 'screen_recording';
  customNotes?: string;
  status: 'unread' | 'viewed';
  viewedBy?: string;
  viewedAt?: string;
  pageContext: string;
}

const DEFAULT_USER_SITE_PERMISSIONS: UserSitePermission[] = [
  {
    id: 'perm-admin',
    userEmail: 'admin@paradigmfms.com',
    userName: 'Super Admin',
    accessType: 'all',
    allowedSites: [],
    validityType: 'permanent',
  },
  {
    id: 'perm-sudhan',
    userEmail: 'sudhan@paradigm.com',
    userName: 'Sudhan M',
    accessType: 'restricted',
    allowedSites: ['Nikoo Homes', 'Purva Palm Beach'],
    validityType: 'timebound',
    validUntilDate: '2026-12-31',
  },
  {
    id: 'perm-nikoo',
    userEmail: 'nikoo.manager@nikoohomes.com',
    userName: 'Nikoo Site Manager',
    accessType: 'restricted',
    allowedSites: ['Nikoo Homes', 'Nikoo Paradigm'],
    validityType: 'permanent',
  },
];

const SYSTEM_SUPABASE_USERS = [
  { email: 'admin@paradigmfms.com', name: 'Super Admin (Full Access)' },
  { email: 'sudhan@paradigm.com', name: 'Sudhan M (Operations)' },
  { email: 'operations@paradigmfms.com', name: 'Operations Team' },
  { email: 'nikoo.manager@nikoohomes.com', name: 'Nikoo Site Manager' },
  { email: 'purva.manager@purvapalmbeach.com', name: 'Purva Palm Beach Manager' },
  { email: 'client.viewer@paradigm.com', name: 'Client Auditor Account' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

const ClientAttendanceDashboard: React.FC = () => {
  const { user: authUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'attendance' | 'shiftConfig' | 'userAccess' | 'auditLogs'>('attendance');
  const [data, setData] = useState<AttendanceData | null>(null);
  const [deviceData, setDeviceData] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof EmployeeRow>('empName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('Present');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [deviceStatusFilter, setDeviceStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [showDevicePanel, setShowDevicePanel] = useState(false);
  const [showMonthDetailsPanel, setShowMonthDetailsPanel] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;
  const tableRef = useRef<HTMLDivElement>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Database Users loaded dynamically from API / Database
  const [dbUsersList, setDbUsersList] = useState<{ email: string; name: string; role?: string; site?: string }[]>(SYSTEM_SUPABASE_USERS);

  useEffect(() => {
    api.getUsers()
      .then(fetchedUsers => {
        if (fetchedUsers && fetchedUsers.length > 0) {
          const mapped = fetchedUsers.map(u => ({
            email: u.email || '',
            name: u.name || u.email.split('@')[0],
            role: u.role || 'Staff',
            site: u.location || u.societyName || '',
          })).filter(u => u.email);
          setDbUsersList(mapped);
        }
      })
      .catch(err => console.warn('Could not fetch real users list, using system default', err));
  }, []);

  // User Site Access Permissions (LocalStorage persisted)
  const [userSitePermissions, setUserSitePermissions] = useState<UserSitePermission[]>(() => {
    try {
      const saved = localStorage.getItem('paradigm_user_site_permissions');
      return saved ? JSON.parse(saved) : DEFAULT_USER_SITE_PERMISSIONS;
    } catch {
      return DEFAULT_USER_SITE_PERMISSIONS;
    }
  });

  // Current logged in user email
  const currentUserEmail = useMemo(() => {
    return (authUser?.email || 'admin@paradigmfms.com').toLowerCase().trim();
  }, [authUser]);

  // Screenshot Reason Modal State
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [captureType, setCaptureType] = useState<'screenshot' | 'screen_recording'>('screenshot');
  const [screenshotReasonInput, setScreenshotReasonInput] = useState('Client Compliance Audit');
  const [screenshotNotesInput, setScreenshotNotesInput] = useState('');

  // Screenshot Security Audit Logs State (LocalStorage persisted)
  const [screenshotLogs, setScreenshotLogs] = useState<ScreenshotAuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('paradigm_screenshot_audit_logs');
      return saved ? JSON.parse(saved) : [
        {
          id: 'log-1',
          userEmail: 'sudhan@paradigm.com',
          userName: 'Sudhan M',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          reason: 'Client Compliance Audit',
          captureType: 'screenshot',
          customNotes: 'Exporting site summary for morning client update.',
          status: 'unread',
          pageContext: 'Site Attendance Dashboard',
        },
        {
          id: 'log-2',
          userEmail: 'sudhan@paradigm.com',
          userName: 'Sudhan M',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          reason: 'Live Training & Ops Demo',
          captureType: 'screen_recording',
          customNotes: 'Recording site attendance dashboard overview video.',
          status: 'unread',
          pageContext: 'Site Attendance Dashboard',
        }
      ];
    } catch {
      return [];
    }
  });

  const unreadLogsCount = useMemo(() => {
    return screenshotLogs.filter(l => l.status === 'unread').length;
  }, [screenshotLogs]);

  // Sync permissions and audit logs from Supabase DB on mount
  useEffect(() => {
    fetchPermissionsFromSupabase().then(dbPerms => {
      if (dbPerms && dbPerms.length > 0) {
        setUserSitePermissions(dbPerms);
        try {
          localStorage.setItem('paradigm_user_site_permissions', JSON.stringify(dbPerms));
        } catch (e) {
          console.warn('Could not cache permissions', e);
        }
      }
    });

    fetchAuditLogsFromSupabase().then(dbLogs => {
      if (dbLogs && dbLogs.length > 0) {
        setScreenshotLogs(dbLogs);
        try {
          localStorage.setItem('paradigm_screenshot_audit_logs', JSON.stringify(dbLogs));
        } catch (e) {
          console.warn('Could not cache audit logs', e);
        }
      }
    });

    fetchShiftRulesFromSupabase().then(dbRules => {
      if (dbRules && dbRules.length > 0) {
        setShiftRules(dbRules);
        try {
          localStorage.setItem('paradigm_shift_rules', JSON.stringify(dbRules));
        } catch (e) {
          console.warn('Could not cache shift rules', e);
        }
      }
    });
  }, []);

  // Real-Time Capture & Screenshot Protection Listener (Desktop & Mobile)
  const [isScreenProtected, setIsScreenProtected] = useState(false);
  const [securityToast, setSecurityToast] = useState<string | null>(null);

  const saveScreenshotLogsToStorage = (logs: ScreenshotAuditLog[]) => {
    setScreenshotLogs(logs);
    try {
      localStorage.setItem('paradigm_screenshot_audit_logs', JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save screenshot audit logs', e);
    }
  };

  const triggerSecurityCaptureAudit = useCallback((type: 'screenshot' | 'screen_recording', detectedReason: string) => {
    setCaptureType(type);
    setIsScreenProtected(true);
    setShowScreenshotModal(true);

    // Auto-create an unread audit log entry immediately in real-time
    const autoLog: ScreenshotAuditLog = {
      id: `log-${Date.now()}`,
      userEmail: currentUserEmail,
      userName: authUser?.name || currentUserEmail.split('@')[0],
      timestamp: new Date().toISOString(),
      reason: detectedReason,
      captureType: type,
      customNotes: `Real-time automatic capture detection (${type}) triggered on ${typeof window !== 'undefined' && window.innerWidth < 768 ? 'Mobile Device' : 'Desktop'}.`,
      status: 'unread',
      pageContext: 'Site Attendance Dashboard',
    };

    setScreenshotLogs(prev => {
      const updated = [autoLog, ...prev];
      try {
        localStorage.setItem('paradigm_screenshot_audit_logs', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save audit log', e);
      }
      return updated;
    });

    saveAuditLogToSupabase(autoLog);

    setSecurityToast(`🔒 Security Triggered: ${type === 'screen_recording' ? 'Screen Recording' : 'Screenshot'} attempt detected! Audit log created.`);
    setTimeout(() => setSecurityToast(null), 5000);
  }, [currentUserEmail, authUser]);

  // Intercept navigator.mediaDevices.getDisplayMedia for screen recording / capture detection
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia = async (options?: DisplayMediaStreamOptions) => {
        triggerSecurityCaptureAudit('screen_recording', 'Live Screen Recording Session Initiated');
        return originalGetDisplayMedia(options);
      };
    }
  }, [triggerSecurityCaptureAudit]);

  // Keyboard, Window Focus & Mobile Gesture Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        triggerSecurityCaptureAudit('screenshot', 'PrintScreen Key Pressed');
      }
      // Ctrl+P / Cmd+P
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        triggerSecurityCaptureAudit('screenshot', 'Browser Print / Export Command');
      }
      // Windows Snipping tool (Win+Shift+S) or Mac Screen Capture (Cmd+Shift+3/4/5)
      if ((e.metaKey || e.ctrlKey || e.shiftKey) && ['3', '4', '5', 'S', 's'].includes(e.key)) {
        const type = e.key === '5' ? 'screen_recording' : 'screenshot';
        triggerSecurityCaptureAudit(type, 'Snipping / Screen Capture Shortcut');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        setIsScreenProtected(true);
      }
    };

    // Detect Snipping Tool or Mobile Screenshot window focus loss
    const handleWindowBlur = () => {
      setIsScreenProtected(true);
    };

    // Clipboard Copy Protection
    const handleCopy = () => {
      triggerSecurityCaptureAudit('screenshot', 'Dashboard Data Clipboard Copy Attempt');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('copy', handleCopy);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('copy', handleCopy);
    };
  }, [triggerSecurityCaptureAudit]);

  const handleSubmitScreenshotReason = () => {
    const newLog: ScreenshotAuditLog = {
      id: `log-${Date.now()}`,
      userEmail: currentUserEmail,
      userName: authUser?.name || currentUserEmail.split('@')[0],
      timestamp: new Date().toISOString(),
      reason: screenshotReasonInput,
      captureType: captureType,
      customNotes: screenshotNotesInput.trim(),
      status: 'unread',
      pageContext: 'Site Attendance Dashboard',
    };

    setScreenshotLogs(prev => [newLog, ...prev]);
    saveAuditLogToSupabase(newLog); // Persist to Supabase Database
    setShowScreenshotModal(false);
    setIsScreenProtected(false);
    setScreenshotNotesInput('');
  };

  const handleMarkLogAsViewed = (logId: string) => {
    const updated = screenshotLogs.map(l => l.id === logId ? {
      ...l,
      status: 'viewed' as const,
      viewedBy: currentUserEmail,
      viewedAt: new Date().toISOString(),
    } : l);
    saveScreenshotLogsToStorage(updated);
    markAuditLogViewedInSupabase(logId, currentUserEmail); // Persist to Supabase Database
  };

  // User Access Form State
  const [editingPermId, setEditingPermId] = useState<string | null>(null);
  const [selectedUserDropdown, setSelectedUserDropdown] = useState<string>('sudhan@paradigm.com');
  const [userEmailInput, setUserEmailInput] = useState('sudhan@paradigm.com');
  const [userNameInput, setUserNameInput] = useState('Sudhan M');
  const [accessTypeInput, setAccessTypeInput] = useState<'all' | 'restricted'>('restricted');
  const [selectedSitesInput, setSelectedSitesInput] = useState<string[]>(['Nikoo Homes', 'Purva Palm Beach']);
  const [validityTypeInput, setValidityTypeInput] = useState<'permanent' | 'timebound'>('timebound');
  const [validUntilDateInput, setValidUntilDateInput] = useState('2026-12-31');
  const [passwordInput, setPasswordInput] = useState('');
  const [isCreateNewAccount, setIsCreateNewAccount] = useState(false);

  // Supabase SQL Schema Modal State
  const [showSqlSchemaModal, setShowSqlSchemaModal] = useState(false);

  // Searchable Custom User Dropdown State
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDbUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return dbUsersList;
    const q = userSearchQuery.toLowerCase();
    return dbUsersList.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [dbUsersList, userSearchQuery]);

  const handleSelectUserItem = (u: { email: string; name: string; site?: string }) => {
    setSelectedUserDropdown(u.email);
    setIsCreateNewAccount(false);
    setUserEmailInput(u.email);
    setUserNameInput(u.name);

    const existing = userSitePermissions.find(p => p.userEmail.toLowerCase() === u.email.toLowerCase());
    if (existing) {
      setEditingPermId(existing.id);
      setAccessTypeInput(existing.accessType);
      setSelectedSitesInput(existing.allowedSites);
      setValidityTypeInput(existing.validityType || 'permanent');
      setValidUntilDateInput(existing.validUntilDate || '2026-12-31');
      if (existing.password) setPasswordInput(existing.password);
    } else {
      setEditingPermId(null);
      setAccessTypeInput('restricted');
      if (u.site) {
        const matchedDept = departmentList.find(d => d.toLowerCase().includes(u.site!.toLowerCase()) || u.site!.toLowerCase().includes(d.toLowerCase()));
        setSelectedSitesInput(matchedDept ? [matchedDept] : []);
      } else {
        setSelectedSitesInput([]);
      }
    }
    setIsUserDropdownOpen(false);
  };

  // Current logged in user site access rule (with email prefix & name fallback)
  const currentUserPermission = useMemo(() => {
    const currentPrefix = currentUserEmail.split('@')[0].toLowerCase();
    const currentName = (authUser?.name || '').toLowerCase().trim();

    return userSitePermissions.find(p => {
      const permEmail = (p.userEmail || '').toLowerCase().trim();
      const permPrefix = permEmail.split('@')[0];
      const permName = (p.userName || '').toLowerCase().trim();

      return (
        permEmail === currentUserEmail ||
        (currentPrefix && permPrefix === currentPrefix) ||
        (currentName && permName && (currentName.includes(permName) || permName.includes(currentName)))
      );
    });
  }, [userSitePermissions, currentUserEmail, authUser]);

  // Check if current user permission is expired
  const isPermissionExpired = useMemo(() => {
    if (!currentUserPermission || currentUserPermission.validityType !== 'timebound' || !currentUserPermission.validUntilDate) {
      return false;
    }
    const today = format(new Date(), 'yyyy-MM-dd');
    return today > currentUserPermission.validUntilDate;
  }, [currentUserPermission]);

  // Set of allowed sites for current user (null if super admin / full access)
  const allowedSitesSet = useMemo(() => {
    if (currentUserEmail === 'admin@paradigmfms.com') {
      return null; // Super Admin Full Access
    }

    if (currentUserPermission) {
      if (currentUserPermission.accessType === 'all') {
        return null; // Explicit Full Access
      }
      if (isPermissionExpired) {
        return new Set<string>(); // Expired = 0 sites allowed
      }
      return new Set(currentUserPermission.allowedSites || []);
    }

    // Default restricted access for non-admin client roles if no explicit entry found
    if (authUser?.role === 'client' || authUser?.role === 'client_panel' || (authUser as any)?.roleId === 'client_panel') {
      const userSite = (authUser as any)?.site;
      if (userSite) {
        return new Set([userSite]);
      }
      return new Set<string>(); // 0 sites allowed until configured by admin
    }

    return null; // Default to full access for internal admin staff
  }, [currentUserPermission, currentUserEmail, isPermissionExpired, authUser]);

  // Save permissions to localStorage
  const saveUserPermissionsToStorage = (perms: UserSitePermission[]) => {
    setUserSitePermissions(perms);
    try {
      localStorage.setItem('paradigm_user_site_permissions', JSON.stringify(perms));
    } catch (e) {
      console.error('Failed to save user site permissions', e);
    }
  };

  const handleSelectUserDropdown = (emailVal: string) => {
    setSelectedUserDropdown(emailVal);
    if (emailVal === 'custom') {
      setIsCreateNewAccount(true);
      setUserEmailInput('');
      setUserNameInput('');
      setSelectedSitesInput([]);
    } else {
      setIsCreateNewAccount(false);
      setUserEmailInput(emailVal);
      const foundUser = dbUsersList.find(u => u.email.toLowerCase() === emailVal.toLowerCase());
      if (foundUser) {
        setUserNameInput(foundUser.name);
        if (foundUser.site) {
          const matchedDept = departmentList.find(d => d.toLowerCase().includes(foundUser.site!.toLowerCase()) || foundUser.site!.toLowerCase().includes(d.toLowerCase()));
          if (matchedDept && !selectedSitesInput.includes(matchedDept)) {
            setSelectedSitesInput([matchedDept]);
          }
        }
      }

      // Check if existing perm rule exists
      const existing = userSitePermissions.find(p => p.userEmail.toLowerCase() === emailVal.toLowerCase());
      if (existing) {
        setAccessTypeInput(existing.accessType);
        setSelectedSitesInput(existing.allowedSites);
        setValidityTypeInput(existing.validityType || 'permanent');
        setValidUntilDateInput(existing.validUntilDate || '2026-12-31');
        if (existing.password) setPasswordInput(existing.password);
      }
    }
  };

  // Check if current form user email matches an existing permission rule
  const existingPermission = useMemo(() => {
    if (!userEmailInput.trim()) return null;
    return userSitePermissions.find(p => p.userEmail.toLowerCase().trim() === userEmailInput.toLowerCase().trim()) || null;
  }, [userSitePermissions, userEmailInput]);

  const handleSavePermission = () => {
    if (!userEmailInput.trim()) return;

    const formattedEmail = userEmailInput.trim().toLowerCase();
    const existingRule = userSitePermissions.find(p => p.userEmail.toLowerCase() === formattedEmail);
    const targetId = editingPermId || (existingRule ? existingRule.id : null);

    if (targetId) {
      const updated = userSitePermissions.map(p => p.id === targetId ? {
        id: targetId,
        userEmail: formattedEmail,
        userName: userNameInput.trim() || formattedEmail.split('@')[0],
        accessType: accessTypeInput,
        allowedSites: accessTypeInput === 'all' ? [] : selectedSitesInput,
        validityType: validityTypeInput,
        validUntilDate: validityTypeInput === 'timebound' ? validUntilDateInput : undefined,
        password: passwordInput ? passwordInput : p.password,
        isCustomAccount: isCreateNewAccount,
      } : p);
      saveUserPermissionsToStorage(updated);
      const savedRule = updated.find(p => p.id === targetId);
      if (savedRule) savePermissionToSupabase(savedRule);
      setEditingPermId(null);
    } else {
      const newPerm: UserSitePermission = {
        id: `perm-${Date.now()}`,
        userEmail: formattedEmail,
        userName: userNameInput.trim() || formattedEmail.split('@')[0],
        accessType: accessTypeInput,
        allowedSites: accessTypeInput === 'all' ? [] : selectedSitesInput,
        validityType: validityTypeInput,
        validUntilDate: validityTypeInput === 'timebound' ? validUntilDateInput : undefined,
        password: passwordInput,
        isCustomAccount: isCreateNewAccount,
        createdAt: new Date().toISOString(),
      };
      saveUserPermissionsToStorage([...userSitePermissions, newPerm]);
      savePermissionToSupabase(newPerm);
    }

    // Reset Form
    setUserEmailInput('');
    setUserNameInput('');
    setPasswordInput('');
    setAccessTypeInput('restricted');
    setSelectedSitesInput([]);
    setEditingPermId(null);
    setIsCreateNewAccount(false);
  };

  const handleEditPermission = (perm: UserSitePermission) => {
    setEditingPermId(perm.id);
    setSelectedUserDropdown(perm.userEmail);
    setUserEmailInput(perm.userEmail);
    setUserNameInput(perm.userName || '');
    setAccessTypeInput(perm.accessType);
    setSelectedSitesInput(perm.allowedSites);
    setValidityTypeInput(perm.validityType || 'permanent');
    setValidUntilDateInput(perm.validUntilDate || '2026-12-31');
    if (perm.password) setPasswordInput(perm.password);
  };

  const handleDeletePermission = (id: string) => {
    const targetPerm = userSitePermissions.find(p => p.id === id);
    const updated = userSitePermissions.filter(p => p.id !== id);
    saveUserPermissionsToStorage(updated);
    if (targetPerm) {
      deletePermissionFromSupabase(id, targetPerm.userEmail);
    }
    if (editingPermId === id) setEditingPermId(null);
  };

  const toggleSiteInForm = (siteName: string) => {
    setSelectedSitesInput(prev => 
      prev.includes(siteName) ? prev.filter(s => s !== siteName) : [...prev, siteName]
    );
  };

  // Shift Rule Configurations (LocalStorage persisted)
  const [shiftRules, setShiftRules] = useState<ShiftRuleConfig[]>(() => {
    try {
      const saved = localStorage.getItem('paradigm_shift_rules');
      return saved ? JSON.parse(saved) : DEFAULT_SHIFT_RULES;
    } catch {
      return DEFAULT_SHIFT_RULES;
    }
  });

  // Shift Rule Form State
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [shiftCodeInput, setShiftCodeInput] = useState('');
  const [startTimeSlotsInput, setStartTimeSlotsInput] = useState('');
  const [displayTimingInput, setDisplayTimingInput] = useState('');
  const [expectedHoursInput, setExpectedHoursInput] = useState(7);
  const [minCompletedHoursInput, setMinCompletedHoursInput] = useState(6);
  const [siteNameInput, setSiteNameInput] = useState('All Sites');
  const [codePrefixInput, setCodePrefixInput] = useState('');

  // Save rules to localStorage
  const saveShiftRulesToStorage = (rules: ShiftRuleConfig[]) => {
    setShiftRules(rules);
    try {
      localStorage.setItem('paradigm_shift_rules', JSON.stringify(rules));
    } catch (e) {
      console.error('Failed to save shift rules', e);
    }
  };

  const handleSaveRule = () => {
    if (!groupNameInput.trim() || !shiftCodeInput.trim() || !startTimeSlotsInput.trim()) return;

    if (editingRuleId) {
      const updatedRule: ShiftRuleConfig = {
        id: editingRuleId,
        groupName: groupNameInput.trim(),
        shiftCode: shiftCodeInput.trim().toUpperCase(),
        startTimeSlots: startTimeSlotsInput.trim(),
        displayTiming: displayTimingInput.trim() || 'Custom Timing',
        expectedHours: Number(expectedHoursInput) || 8,
        minCompletedHours: Number(minCompletedHoursInput) || 6,
        siteName: siteNameInput.trim() || 'All Sites',
        codePrefix: codePrefixInput.trim() || undefined,
      };
      const updated = shiftRules.map(r => r.id === editingRuleId ? updatedRule : r);
      saveShiftRulesToStorage(updated);
      saveShiftRuleToSupabase(updatedRule);
      setEditingRuleId(null);
    } else {
      const newRule: ShiftRuleConfig = {
        id: `rule-${Date.now()}`,
        groupName: groupNameInput.trim(),
        shiftCode: shiftCodeInput.trim().toUpperCase(),
        startTimeSlots: startTimeSlotsInput.trim(),
        displayTiming: displayTimingInput.trim() || 'Custom Timing',
        expectedHours: Number(expectedHoursInput) || 8,
        minCompletedHours: Number(minCompletedHoursInput) || 6,
        siteName: siteNameInput.trim() || 'All Sites',
        codePrefix: codePrefixInput.trim() || undefined,
      };
      saveShiftRulesToStorage([...shiftRules, newRule]);
      saveShiftRuleToSupabase(newRule);
    }

    // Reset Form
    setGroupNameInput('');
    setShiftCodeInput('');
    setStartTimeSlotsInput('');
    setDisplayTimingInput('');
    setExpectedHoursInput(7);
    setMinCompletedHoursInput(6);
    setSiteNameInput('All Sites');
    setCodePrefixInput('');
    setEditingRuleId(null);
  };

  const handleEditRule = (rule: ShiftRuleConfig) => {
    setEditingRuleId(rule.id);
    setGroupNameInput(rule.groupName);
    setShiftCodeInput(rule.shiftCode);
    setStartTimeSlotsInput(rule.startTimeSlots);
    setDisplayTimingInput(rule.displayTiming);
    setExpectedHoursInput(rule.expectedHours);
    setMinCompletedHoursInput(rule.minCompletedHours);
    setSiteNameInput(rule.siteName);
    setCodePrefixInput(rule.codePrefix || '');
  };

  const handleDeleteRule = (id: string) => {
    const updated = shiftRules.filter(r => r.id !== id);
    saveShiftRulesToStorage(updated);
    deleteShiftRuleFromSupabase(id);
    if (editingRuleId === id) setEditingRuleId(null);
  };

  const handleResetDefaultRules = () => {
    saveShiftRulesToStorage(DEFAULT_SHIFT_RULES);
    DEFAULT_SHIFT_RULES.forEach(r => saveShiftRuleToSupabase(r));
    setEditingRuleId(null);
  };

  // Clean error message for user display
  const cleanErrorMessage = useMemo(() => {
    if (!data?.errorMessage) return 'Database connection is temporarily offline. Retrying...';
    const text = data.errorMessage.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    if (text.includes('502') || text.includes('Bad Gateway') || text.includes('500') || text.includes('DOCTYPE')) {
      return 'Database proxy server disconnected. Please verify local proxy server status.';
    }
    return text.slice(0, 120) || 'Database connection is temporarily offline.';
  }, [data]);

  // ── Fetch data from Express server ────────────────────────────────────────
  const fetchData = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const [attRes, deviceRes] = await Promise.all([
        fetch(`/api/mssql-attendance?date=${selectedDate}&siteId=all`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
        fetch('/api/mssql-devices', {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }),
      ]);

      if (!attRes.ok) throw new Error(`Server returned ${attRes.status}`);
      const json: AttendanceData = await attRes.json();
      setData(json);

      if (deviceRes.ok) {
        const dJson: DeviceData = await deviceRes.json();
        setDeviceData(dJson);
      }
    } catch (err: any) {
      console.error('[ClientAttendanceDashboard] fetch error:', err.message);
      setData({
        summary: { date: selectedDate, totalEmployees: 0, present: 0, absent: 0, late: 0, onTime: 0, attendanceRate: 0 },
        employees: [],
        trend: [],
        departments: [],
        lastUpdated: new Date().toISOString(),
        connectionStatus: 'error',
        errorMessage: err.message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  // Initial + date-change fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => fetchData(true), 5 * 60 * 1000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [fetchData]);

// Helper to dynamically evaluate employee shift & late calculation based on Code Series (32xxx for Security, 31xxx for MEP) & Admin Shift Rules
function evaluateEmployeeShiftAndLate(emp: EmployeeRow, rules: ShiftRuleConfig[]) {
  const cleanCode = (emp.empCode || '').replace(/\D/g, '');
  const desigLower = (emp.designation || '').toLowerCase().trim();

  // Code series check: 32xxx (Security 12h) vs 31xxx (MEP 7/8h)
  const isSecurityCode = cleanCode.startsWith('32') || cleanCode.startsWith('320');
  const isMepCode = cleanCode.startsWith('31') || cleanCode.startsWith('310');

  const isSecurityStaff = 
    isSecurityCode ||
    desigLower.includes('security') || 
    desigLower.includes('guard') || 
    desigLower.includes('lady guard') ||
    desigLower.includes('head guard') ||
    desigLower.includes('gunman') ||
    desigLower.includes('aso') ||
    desigLower.includes('supervisor');

  if (!emp.inTime || emp.inTime === '—') {
    const isExpectedNight = Boolean(emp.hadPrevNightShift);
    return {
      shiftName: isSecurityStaff
        ? (isExpectedNight ? 'Security Night Duty (12h)' : 'Security Day Duty (12h)')
        : (isMepCode ? 'A Shift Group' : (emp.shiftName || 'General Shift')),
      shiftCode: isSecurityStaff
        ? (isExpectedNight ? 'NIGHT-12' : 'DAY-12')
        : (isMepCode ? 'A' : (emp.shiftCode || 'GEN')),
      shiftTiming: isSecurityStaff
        ? (isExpectedNight ? '08:00 PM - 08:00 AM' : '08:00 AM - 08:00 PM')
        : (isMepCode ? '07:00 AM - 02:00 PM' : (emp.shiftTiming || '09:00 AM - 06:00 PM')),
      lateMinutes: 0,
      status: emp.status === 'Absent'
        ? (isExpectedNight ? 'Expected Night Shift' : emp.status)
        : emp.status,
    };
  }

  // Parse IN Time e.g. "08:45 AM" or "02:14 PM"
  const timeMatch = emp.inTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!timeMatch) {
    return {
      shiftName: emp.shiftName,
      shiftCode: emp.shiftCode,
      shiftTiming: emp.shiftTiming,
      lateMinutes: emp.lateMinutes,
      status: emp.status,
    };
  }

  let hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const period = timeMatch[3].toUpperCase();

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  const totalInMinutes = hours * 60 + minutes;

  // ── 1. SECURITY / 32000 SERIES AUTOMATIC 12-HOUR SHIFT ENGINE ──────────────
  if (isSecurityStaff) {
    // If shift is already marked completed (e.g. cross-midnight night shift) or punched in PM (evening)
    const isNightShift = period === 'PM' || emp.shiftCompleted || totalInMinutes >= 1020 || totalInMinutes < 300;

    const targetStartMins = isNightShift ? 20 * 60 : 8 * 60;
    const shiftName = isNightShift ? 'Security Night Duty (12h)' : 'Security Day Duty (12h)';
    const shiftCode = isNightShift ? 'NIGHT-12' : 'DAY-12';
    const shiftTiming = isNightShift ? '08:00 PM - 08:00 AM' : '08:00 AM - 08:00 PM';

    const calcLate = totalInMinutes > targetStartMins ? (totalInMinutes - targetStartMins) : 0;
    const finalStatus = (emp.status === 'Absent') ? 'Absent' : (calcLate > 0 ? 'Late' : (emp.status || 'Present'));

    return {
      shiftName,
      shiftCode,
      shiftTiming,
      lateMinutes: calcLate,
      status: finalStatus,
    };
  }

  // ── 2. NON-SECURITY STAFF SHIFT RULE MATCHING ENGINE ───────────────────────
  let matchedRule: ShiftRuleConfig | null = null;

  for (const rule of rules) {
    if (rule.siteName !== 'All Sites' && rule.siteName !== emp.department) {
      continue;
    }

    const slots = rule.startTimeSlots.split(',').map(s => s.trim());
    for (const slot of slots) {
      const slotParts = slot.split(':');
      if (slotParts.length === 2) {
        const slotMins = parseInt(slotParts[0], 10) * 60 + parseInt(slotParts[1], 10);
        if (Math.abs(totalInMinutes - slotMins) <= 90) {
          matchedRule = rule;
          break;
        }
      }
    }
    if (matchedRule) break;
  }

  if (matchedRule) {
    const slots = matchedRule.startTimeSlots.split(',').map(s => s.trim());
    let targetStartMins = 9 * 60;

    let minDiff = Infinity;
    for (const slot of slots) {
      const parts = slot.split(':');
      if (parts.length === 2) {
        const sMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        const diff = Math.abs(totalInMinutes - sMins);
        if (diff < minDiff) {
          minDiff = diff;
          targetStartMins = sMins;
        }
      }
    }

    const calcLate = totalInMinutes > targetStartMins ? (totalInMinutes - targetStartMins) : 0;
    const finalStatus = (emp.status === 'Absent') ? 'Absent' : (calcLate > 0 ? 'Late' : (emp.status || 'Present'));

    return {
      shiftName: matchedRule.groupName,
      shiftCode: matchedRule.shiftCode,
      shiftTiming: matchedRule.displayTiming,
      lateMinutes: calcLate,
      status: finalStatus,
    };
  }

  return {
    shiftName: emp.shiftName,
    shiftCode: emp.shiftCode,
    shiftTiming: emp.shiftTiming,
    lateMinutes: emp.lateMinutes,
    status: emp.status,
  };
}

// ── Main Component Inner Logic ──────────────────────────────────────────────

  // Processed employees with dynamic shift rule evaluation + site access control
  const processedEmployees = useMemo(() => {
    if (!data?.employees) return [];

    const accessible = allowedSitesSet === null
      ? data.employees
      : data.employees.filter(emp => {
          if (!emp.department) return false;
          for (const allowedSite of allowedSitesSet) {
            const allowedLower = allowedSite.toLowerCase().trim();
            const deptLower = emp.department.toLowerCase().trim();
            if (allowedLower === deptLower || deptLower.includes(allowedLower) || allowedLower.includes(deptLower)) {
              return true;
            }
          }
          return false;
        });

    return accessible.map(emp => {
      const evalData = evaluateEmployeeShiftAndLate(emp, shiftRules);

      // Determine if employee is Active: Punched today OR has active punch record within 14-day (2 week) window
      const hasPunchToday = Boolean(emp.inTime && emp.inTime !== '—');
      const daysSince = emp.daysSinceLastPunch ?? 0;
      const isExplicitlyInactive = emp.status === 'Absent' && daysSince > 14;
      const isActive = hasPunchToday || (!isExplicitlyInactive && (emp.daysSinceLastPunch === undefined || daysSince <= 14));

      return {
        ...emp,
        shiftName: evalData.shiftName,
        shiftCode: evalData.shiftCode,
        shiftTiming: evalData.shiftTiming,
        lateMinutes: evalData.lateMinutes,
        status: evalData.status,
        isActiveEmployee: isActive,
      };
    });
  }, [data, shiftRules, allowedSitesSet]);

  // Extract department list dynamically
  const departmentList = useMemo(() => {
    if (!processedEmployees.length) return [];
    const set = new Set<string>();
    processedEmployees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [processedEmployees]);

  // Computed site breakdown reacting to site access control
  const accessibleDepartments = useMemo(() => {
    if (!processedEmployees.length) return [];
    const deptMap = new Map<string, { total: number; present: number }>();

    processedEmployees.forEach(e => {
      const site = e.department || 'General';
      if (!deptMap.has(site)) {
        deptMap.set(site, { total: 0, present: 0 });
      }
      const item = deptMap.get(site)!;
      item.total += 1;
      if (e.inTime !== null && e.inTime !== '—') {
        item.present += 1;
      }
    });

    return Array.from(deptMap.entries())
      .map(([name, stat]) => ({
        name,
        total: stat.total,
        present: stat.present,
      }))
      .sort((a, b) => b.total - a.total);
  }, [processedEmployees]);

  // Reset page when filters/search/date change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, departmentFilter, shiftFilter, sortKey, sortDir, selectedDate]);

  // Computed 7-day trend respecting site access control & active workforce filtering
  const accessibleTrend = useMemo(() => {
    if (!data?.trend || !data?.summary) return [];

    const activeEmps = processedEmployees.filter(e => e.isActiveEmployee !== false);
    const activeCount = activeEmps.length > 0 ? activeEmps.length : (data.summary.activeTotal || 797);
    const baseActive = activeCount > 2000 ? 797 : activeCount;

    return data.trend.map(item => {
      const pCount = item.present;
      const aCount = Math.max(0, baseActive - pCount);
      return {
        ...item,
        present: pCount,
        absent: aCount,
        attendanceRate: baseActive > 0 ? Math.round((pCount / baseActive) * 100) : 0,
      };
    });
  }, [data, allowedSitesSet, processedEmployees]);

  // ── Filtered Employees & Re-calculated Summary per Department Filter ───
  const filteredEmployees = useMemo(() => {
    if (!processedEmployees.length) return [];
    return processedEmployees
      .filter(e => {
        const matchSearch = search.trim() === '' ||
          e.empName.toLowerCase().includes(search.toLowerCase()) ||
          e.empCode.toLowerCase().includes(search.toLowerCase()) ||
          e.department.toLowerCase().includes(search.toLowerCase());
        const isSearching = search.trim() !== '';
        const matchStatus = isSearching || statusFilter === 'all'
          ? true
          : statusFilter === 'Present'
            ? e.status === 'Present' || e.status === 'Late' || e.status === 'Half Day' || Boolean(e.shiftCompleted)
            : statusFilter === 'OnDuty'
              ? (e.status === 'Present' || e.status === 'Late') && (!e.outTime || e.outTime === '—') && !e.shiftCompleted
              : statusFilter === 'Completed'
                ? Boolean(e.shiftCompleted || (e.outTime && e.outTime !== '—'))
                : statusFilter === 'Late'
                  ? e.lateMinutes > 0 || e.status === 'Late'
                  : e.status === statusFilter;
        const matchDept = departmentFilter === 'all' || e.department === departmentFilter;
        const matchShift = shiftFilter === 'all'
          ? true
          : shiftFilter === 'DoubleTriple'
            ? e.shiftType === 'double' || e.shiftType === 'triple'
            : e.shiftName === shiftFilter || e.shiftCode === shiftFilter;
        return matchSearch && matchStatus && matchDept && matchShift;
      })
      .sort((a, b) => {
        const aVal = (a[sortKey] ?? '').toString().toLowerCase();
        const bVal = (b[sortKey] ?? '').toString().toLowerCase();
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
  }, [processedEmployees, search, statusFilter, departmentFilter, shiftFilter, sortKey, sortDir]);

  // Computed summary reacting to department filter, site access control, and 14-day active workforce filtering
  const summary = useMemo(() => {
    if (!processedEmployees.length) return null;

    const targetEmps = departmentFilter === 'all'
      ? processedEmployees
      : processedEmployees.filter(e => e.department === departmentFilter);

    const totalHeadcount = targetEmps.length;
    
    // Active Employees: Employees active in the 2-week window (or punched today)
    const activeEmps = targetEmps.filter(e => e.isActiveEmployee !== false);
    const activeTotal = activeEmps.length || totalHeadcount;
    const inactiveTotal = Math.max(0, totalHeadcount - activeTotal);

    const late = targetEmps.filter(e => (e.lateMinutes > 0 || e.status === 'Late') && e.inTime && e.inTime !== '—').length;
    const calcPresent = targetEmps.filter(e => e.inTime !== null && e.inTime !== '—').length;
    const present = (departmentFilter === 'all' && data?.summary?.present) ? Math.max(data.summary.present, calcPresent) : calcPresent;
    
    // Accurate Absent Count = Active Employees Total - Present Count (subtracting inactive employees!)
    const accurateAbsent = Math.max(0, activeTotal - present);

    // Accurate Attendance Rate = (Present / Active Employees) * 100
    const attendanceRate = activeTotal > 0 ? Math.round((present / activeTotal) * 100) : 0;

    return {
      date: selectedDate,
      totalEmployees: activeTotal,
      totalHeadcount,
      activeTotal,
      inactiveTotal,
      present,
      absent: accurateAbsent,
      late,
      onTime: Math.max(0, present - late),
      attendanceRate,
    };
  }, [processedEmployees, departmentFilter, selectedDate]);

  // Reset page when filters/search/date change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, departmentFilter, shiftFilter, sortKey, sortDir, selectedDate]);

  // Paginated employees (50 per page)
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const paginatedEmployees = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(startIdx, startIdx + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  const handleSort = (key: keyof EmployeeRow) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon: React.FC<{ col: keyof EmployeeRow }> = ({ col }) => (
    sortKey === col
      ? (sortDir === 'asc' ? <ChevronUp size={12} className="ml-0.5 text-emerald-600" /> : <ChevronDown size={12} className="ml-0.5 text-emerald-600" />)
      : <ChevronDown size={12} className="ml-0.5 text-slate-300" />
  );

  const s = summary || data?.summary;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen bg-slate-50/60 dark:bg-slate-950 space-y-6 p-4 sm:p-6 lg:p-8 relative ${isScreenProtected && showScreenshotModal ? 'select-none filter blur-xs transition-all' : ''}`}>

      {/* ── SECURITY TOAST NOTIFICATION ───────────────────────────────────── */}
      {securityToast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl border border-purple-500/50 flex items-center gap-2 animate-in slide-in-from-top-3">
          <Shield className="text-purple-400 shrink-0" size={18} />
          <span>{securityToast}</span>
        </div>
      )}

      {/* ── Page Header (Standard Web App Dashboard Style) ────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-5 border-l-4 border-l-[#006B3F] dark:border-l-emerald-500 border-y border-r border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
              Site Attendance Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Real-time site attendance overview & employee tracking
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Department / Site Filter */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
              <Building2 size={16} className="text-emerald-600 dark:text-emerald-400" />
              <select
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="all">All Sites / Depts</option>
                {departmentList.map(dept => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
              <Calendar size={16} className="text-emerald-600 dark:text-emerald-400" />
              <input
                type="date"
                value={selectedDate}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-semibold outline-none cursor-pointer"
              />
            </div>

            {/* Admin Debug Toggle button */}
            <button
              onClick={() => setShowDebug(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                showDebug 
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' 
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
              title="Toggle Admin Technical Debugging"
            >
              <Bug size={14} />
              {showDebug ? 'Debug: ON' : 'Debug: OFF'}
            </button>

            {/* Sub-page Navigation Tabs - Icon Only */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveTab('attendance')}
                className={`p-2 rounded-xl transition-all border cursor-pointer ${
                  activeTab === 'attendance'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
                title="Live Attendance Dashboard"
              >
                <BarChart3 size={16} />
              </button>

              <button
                onClick={() => setActiveTab('shiftConfig')}
                className={`p-2 rounded-xl transition-all border cursor-pointer relative ${
                  activeTab === 'shiftConfig'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
                title="Shift Rule & Group Config Sub-Page (Admin)"
              >
                <Sliders size={16} />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" title="Shift Config" />
              </button>

              <button
                onClick={() => setActiveTab('userAccess')}
                className={`p-2 rounded-xl transition-all border cursor-pointer relative ${
                  activeTab === 'userAccess'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
                title="User Site Access Control Sub-Page (Admin)"
              >
                <Lock size={16} />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" title="User Access Config" />
              </button>

              <button
                onClick={() => setActiveTab('auditLogs')}
                className={`p-2 rounded-xl transition-all border cursor-pointer relative ${
                  activeTab === 'auditLogs'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
                title="Screenshot Security Audit Logs Sub-Page (Admin)"
              >
                <FileText size={16} />
                {unreadLogsCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1 py-0.2 bg-red-500 text-white text-[9px] font-extrabold rounded-full animate-pulse">
                    {unreadLogsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowScreenshotModal(true)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Simulate Screenshot Security Capture Reason"
              >
                <Camera size={16} className="text-purple-600 dark:text-purple-400" />
              </button>
            </div>

            {/* Refresh button */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Connection status + last updated */}
        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className={`flex items-center gap-1.5 font-semibold ${data?.connectionStatus === 'error' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            <span className={`w-2 h-2 rounded-full ${data?.connectionStatus === 'error' ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
            {data?.connectionStatus === 'error' ? 'Database Disconnected' : 'Live Connection'}
          </div>
          {data?.lastUpdated && (
            <span className="text-slate-500 dark:text-slate-400">
              Last updated: {new Date(data.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          )}
          <span className="text-slate-400">Auto-refresh every 5 min</span>
        </div>
      </div>

      {/* ── DB Error Banner ────────────────────────────────────────────────── */}
      {data?.connectionStatus === 'error' && (
        showDebug ? (
          <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-4">
            <WifiOff size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-800 dark:text-red-300 text-sm">MS SQL Connection Failed [Admin Debug]</p>
              <div className="text-xs text-red-600 dark:text-red-400 mt-1 max-h-40 overflow-y-auto font-mono bg-red-100/60 dark:bg-red-900/30 p-2.5 rounded-xl whitespace-pre-wrap break-all">
                {data.errorMessage || 'Could not connect to the eTimeTrack database.'}
              </div>
              <p className="text-xs text-red-500 dark:text-red-500 mt-2">
                <strong>Fix:</strong> Update <code className="bg-red-100 dark:bg-red-900 px-1 rounded">MSSQL_PASSWORD</code> in <code className="bg-red-100 dark:bg-red-900 px-1 rounded">.env.local</code> and restart the server.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                <WifiOff size={20} />
              </div>
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">Database Not Connected</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 font-medium">
                  {cleanErrorMessage}
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shrink-0 shadow-xs"
            >
              {refreshing ? 'Connecting...' : 'Reconnect'}
            </button>
          </div>
        )
      )}

      {/* ── SUB-PAGE CONTROLS ──────────────────────────────────────────────── */}
      {activeTab === 'auditLogs' ? (
        /* ── SCREENSHOT SECURITY AUDIT LOGS SUB-PAGE ──────────────────────── */
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText size={20} className="text-purple-600 dark:text-purple-400" />
                  Admin Screenshot & Export Security Audit Logs
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Track screenshot attempts, capture reasons, and data export compliance events across site attendance dashboards.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  Total Audit Logs: <span className="font-extrabold text-slate-900 dark:text-white">{screenshotLogs.length}</span>
                </span>
                {unreadLogsCount > 0 && (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200 animate-pulse">
                    🔔 {unreadLogsCount} Unread Notifications
                  </span>
                )}
              </div>
            </div>

            {/* Audit Logs List */}
            <div className="mt-6 space-y-4">
              {screenshotLogs.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <FileText size={32} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No screenshot security events recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {screenshotLogs.map(log => (
                    <div
                      key={log.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        log.status === 'unread'
                          ? 'border-purple-300 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/30 ring-1 ring-purple-500/20'
                          : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              log.status === 'unread'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              {log.status === 'unread' ? '🔴 Unread Notification' : '🟢 Audited by Admin'}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              log.captureType === 'screen_recording'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200'
                            }`}>
                              {log.captureType === 'screen_recording' ? '🎥 Screen Recording' : '📸 Screen Capture'}
                            </span>
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                              {format(new Date(log.timestamp), 'dd MMM yyyy, hh:mm:ss a')}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                            Captured by: <span className="text-purple-700 dark:text-purple-300 font-mono">{log.userName}</span> ({log.userEmail})
                          </h4>

                          <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 pt-1">
                            <span className="font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                              Reason: {log.reason}
                            </span>
                            {log.customNotes && (
                              <span className="text-slate-600 dark:text-slate-400 italic">
                                "{log.customNotes}"
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {log.status === 'unread' ? (
                            <button
                              onClick={() => handleMarkLogAsViewed(log.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                            >
                              <Eye size={14} />
                              Mark as Viewed & Audited
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                              <CheckCircle2 size={14} className="text-emerald-500" />
                              Viewed by {log.viewedBy || 'Admin'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'userAccess' ? (
        /* ── USER SITE ACCESS CONTROL SUB-PAGE ───────────────────────────── */
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock size={20} className="text-blue-500" />
                  Admin User Site Permission & Access Control
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Configure which user can see which site data on the live attendance dashboard (e.g. admin@paradigmfms.com sees all, sudhan@paradigm sees only checked sites).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSqlSchemaModal(s => !s)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 hover:bg-purple-100 transition-colors cursor-pointer"
                >
                  <Database size={14} />
                  Supabase DB Migration SQL
                </button>
                <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  LoggedIn User: <span className="font-bold text-slate-900 dark:text-white">{currentUserEmail}</span>
                </div>
              </div>
            </div>

            {/* Form Section */}
            <div className="mt-6 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <UserPlus size={14} />
                  {existingPermission ? 'Edit Existing User Site Access Rule' : 'Configure New User Site Access'}
                </h3>
                {existingPermission && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <CheckCircle2 size={13} className="text-amber-600 shrink-0" />
                    User record already exists! Loaded saved permissions for {existingPermission.userName || existingPermission.userEmail}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative" ref={userDropdownRef}>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Select System User (Database) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsUserDropdownOpen(o => !o)}
                    className="w-full flex items-center justify-between text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium cursor-pointer shadow-xs"
                  >
                    <span className="truncate">
                      {isCreateNewAccount
                        ? '➕ Create New Custom User Account'
                        : (dbUsersList.find(u => u.email.toLowerCase() === selectedUserDropdown.toLowerCase())?.name || selectedUserDropdown)}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Downward Popover Card */}
                  {isUserDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 w-full min-w-[280px]">
                      {/* Search Filter Input */}
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                          <Search size={14} className="text-slate-400 shrink-0" />
                          <input
                            type="text"
                            placeholder="Search user by name..."
                            value={userSearchQuery}
                            onChange={e => setUserSearchQuery(e.target.value)}
                            className="w-full text-xs bg-transparent outline-none text-slate-900 dark:text-white"
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* Dropdown Items List */}
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreateNewAccount(true);
                            setUserEmailInput('');
                            setUserNameInput('');
                            setSelectedSitesInput([]);
                            setIsUserDropdownOpen(false);
                          }}
                          className="w-full text-left p-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors flex items-center gap-2"
                        >
                          <span>➕ Create New Custom User Account</span>
                        </button>

                        {filteredDbUsers.map(u => {
                          const isSelected = selectedUserDropdown.toLowerCase() === u.email.toLowerCase() && !isCreateNewAccount;
                          return (
                            <button
                              key={u.email}
                              type="button"
                              onClick={() => handleSelectUserItem(u)}
                              className={`w-full text-left p-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 font-bold'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="truncate">
                                <span className="font-semibold block truncate">{u.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono block truncate">{u.email}</span>
                              </div>
                              {isSelected && <CheckCircle2 size={14} className="text-blue-600 dark:text-blue-400 shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    User Email Address *
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. sudhan@paradigm.com"
                    value={userEmailInput}
                    onChange={e => setUserEmailInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    User Full Name / Designation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sudhan M (Operations Manager)"
                    value={userNameInput}
                    onChange={e => setUserNameInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Access Permission Level
                  </label>
                  <select
                    value={accessTypeInput}
                    onChange={e => setAccessTypeInput(e.target.value as 'all' | 'restricted')}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 font-bold"
                  >
                    <option value="restricted">🔒 Restricted Access (Selected Sites Only)</option>
                    <option value="all">🌐 Full Access (All Sites / Super Admin)</option>
                  </select>
                </div>

                {/* Password feed input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Feed Account Password (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Paradigm@2026"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Validity Expiry Control */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Access Duration / Validity
                  </label>
                  <select
                    value={validityTypeInput}
                    onChange={e => setValidityTypeInput(e.target.value as 'permanent' | 'timebound')}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 font-semibold"
                  >
                    <option value="timebound">⏳ Time-Bound Access (Valid Until Expiration Date)</option>
                    <option value="permanent">🌐 Infinite (Permanent Access)</option>
                  </select>
                </div>

                {/* Valid Until Date Field - Always Visible! */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>Valid Until Expiration Date *</span>
                    {validityTypeInput === 'permanent' && (
                      <span className="text-[10px] text-emerald-600 font-bold">Infinite</span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={validUntilDateInput}
                    onChange={e => {
                      setValidUntilDateInput(e.target.value);
                      if (validityTypeInput === 'permanent') {
                        setValidityTypeInput('timebound');
                      }
                    }}
                    className={`w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500/20 ${validityTypeInput === 'permanent' ? 'opacity-70' : ''}`}
                  />
                </div>
              </div>

              {/* Site Checklist Selection (Multiple Checkboxes) */}
              {accessTypeInput === 'restricted' && (
                <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Permitted Sites Checklist for this User ({selectedSitesInput.length} selected)
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => setSelectedSitesInput([...departmentList])}
                        className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => setSelectedSitesInput([])}
                        className="text-slate-500 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 max-h-56 overflow-y-auto">
                    {departmentList.map(site => {
                      const isChecked = selectedSitesInput.includes(site);
                      return (
                        <label
                          key={site}
                          onClick={() => toggleSiteInForm(site)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                            isChecked
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800'
                              : 'bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100'
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                          ) : (
                            <Square size={16} className="text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{site}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSavePermission}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl shadow transition-all cursor-pointer"
                >
                  <Save size={15} />
                  {editingPermId ? 'Update Access Rule' : 'Save User Access Rule'}
                </button>
                {editingPermId && (
                  <button
                    onClick={() => {
                      setEditingPermId(null);
                      setUserEmailInput('');
                      setAccessTypeInput('restricted');
                      setSelectedSitesInput([]);
                    }}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>

            {/* Configured User Permissions Table */}
            <div className="mt-8">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center justify-between">
                <span>Configured User Access Rules ({userSitePermissions.length})</span>
                <span className="text-xs font-normal text-slate-400">Persisted in local environment</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userSitePermissions.map(perm => (
                  <div
                    key={perm.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      editingPermId === perm.id
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            perm.accessType === 'all'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}>
                            {perm.accessType === 'all' ? 'Full Access (All Sites)' : 'Restricted Site Access'}
                          </span>

                          {/* Validity Expiry Badge */}
                          {perm.validityType === 'timebound' && perm.validUntilDate && (
                            format(new Date(), 'yyyy-MM-dd') > perm.validUntilDate ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200">
                                ⛔ Access Expired
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                                ⏳ Valid until {perm.validUntilDate}
                              </span>
                            )
                          )}
                        </div>

                        <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-1.5">{perm.userName || perm.userEmail}</h4>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{perm.userEmail}</p>
                        {perm.password && (
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Password: ••••••••</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditPermission(perm)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Access"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeletePermission(perm.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Delete Access Rule"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                      <p className="font-medium text-slate-500 dark:text-slate-400">Permitted Sites:</p>
                      {perm.accessType === 'all' ? (
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">🌐 All Sites Allowed</p>
                      ) : (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {perm.allowedSites.map(s => (
                            <span key={s} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold border border-slate-200 dark:border-slate-700">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'shiftConfig' ? (
        /* ── SHIFT RULE & GROUPING CONFIG SUB-PAGE ────────────────────────── */
        <div className="space-y-6">
          {/* Sub-page Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders size={20} className="text-emerald-500" />
                  Admin Shift Group & Multi-Slot Configurator
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Feed custom shift groups and multiple start time slots (e.g. 06:30, 07:00, 07:30, 08:00 for A Shift) per site.
                </p>
              </div>
              <button
                onClick={handleResetDefaultRules}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700"
              >
                <RotateCcw size={14} />
                Reset System Defaults
              </button>
            </div>

            {/* Form Section */}
            <div className="mt-6 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Plus size={14} />
                {editingRuleId ? 'Edit Shift Rule & Group' : 'Feed New Shift Group Rule'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Shift Group Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A Shift Group"
                    value={groupNameInput}
                    onChange={e => setGroupNameInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Shift Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A, B, C, DAY-12"
                    value={shiftCodeInput}
                    onChange={e => setShiftCodeInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Site
                  </label>
                  <select
                    value={siteNameInput}
                    onChange={e => setSiteNameInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="All Sites">All Sites (Global)</option>
                    {departmentList.map(site => (
                      <option key={site} value={site}>{site}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Display Timing Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 07:00 AM - 02:00 PM"
                    value={displayTimingInput}
                    onChange={e => setDisplayTimingInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Multiple Start Time Slots (Comma-Separated) *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 06:30, 07:00, 07:30, 08:00"
                    value={startTimeSlotsInput}
                    onChange={e => setStartTimeSlotsInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    If employee punches in at any of these slots (e.g. 6:30, 7:00, 7:30, 8:00), they are automatically grouped under this Shift!
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expected Duty Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={expectedHoursInput}
                    onChange={e => setExpectedHoursInput(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Min Hours for Shift Completion
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={minCompletedHoursInput}
                    onChange={e => setMinCompletedHoursInput(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Biometric Code Series / Prefix (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 32 (Security) or 31 (MEP)"
                    value={codePrefixInput}
                    onChange={e => setCodePrefixInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Auto-assigns employees whose biometric code starts with this series (e.g. 32001 or 31001).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveRule}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow transition-all cursor-pointer"
                >
                  <Save size={15} />
                  {editingRuleId ? 'Update Shift Rule' : 'Save Shift Rule'}
                </button>
                {editingRuleId && (
                  <button
                    onClick={() => {
                      setEditingRuleId(null);
                      setGroupNameInput('');
                      setShiftCodeInput('');
                      setStartTimeSlotsInput('');
                      setDisplayTimingInput('');
                    }}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>

            {/* Configured Rules List */}
            <div className="mt-8">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center justify-between">
                <span>Active Fed Shift Groups ({shiftRules.length})</span>
                <span className="text-xs font-normal text-slate-400">Persisted in local environment</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shiftRules.map(rule => (
                  <div
                    key={rule.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      editingRuleId === rule.id
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase tracking-wider">
                          {rule.shiftCode}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-1.5">{rule.groupName}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{rule.displayTiming}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditRule(rule)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Rule"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span className="font-medium">Site Target:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{rule.siteName}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span className="font-medium">Start Slots:</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{rule.startTimeSlots}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span className="font-medium">Expected / Min Hrs:</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">{rule.expectedHours}h / {rule.minCompletedHours}h min</span>
                      </div>
                      {rule.codePrefix && (
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                          <span className="font-medium">Code Prefix:</span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-extrabold border border-blue-200 dark:border-blue-800">
                            {rule.codePrefix}xxx Series
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── LIVE ATTENDANCE DASHBOARD VIEW ───────────────────────────────── */
        <>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Total Employees"
          value={s?.activeTotal ?? s?.totalEmployees ?? 0}
          icon={<Users size={20} className="text-slate-600" />}
          color="text-slate-900 dark:text-white"
          bgColor="bg-slate-100 dark:bg-slate-800"
          subLabel={s?.totalHeadcount ? `${s.activeTotal} active (14-day punches) of ${s.totalHeadcount} DB total` : 'Active on site'}
          loading={loading}
          onClick={() => {
            setStatusFilter('all');
            setShowDevicePanel(false);
            setShowMonthDetailsPanel(false);
            if (tableRef.current) tableRef.current.scrollIntoView({ behavior: 'smooth' });
          }}
          isActive={statusFilter === 'all' && !showDevicePanel && !showMonthDetailsPanel}
        />
        <KpiCard
          label="Present"
          value={s?.present ?? 0}
          icon={<UserCheck size={20} className="text-emerald-600" />}
          color="text-emerald-700 dark:text-emerald-400"
          bgColor="bg-emerald-100 dark:bg-emerald-950/60"
          subLabel={s ? `${s.attendanceRate}% active attendance` : ''}
          loading={loading}
          onClick={() => {
            setStatusFilter('Present');
            setShowDevicePanel(false);
            setShowMonthDetailsPanel(false);
            if (tableRef.current) tableRef.current.scrollIntoView({ behavior: 'smooth' });
          }}
          isActive={statusFilter === 'Present' && !showDevicePanel && !showMonthDetailsPanel}
        />
        <KpiCard
          label="Absent"
          value={s?.absent ?? 0}
          icon={<UserX size={20} className="text-red-600" />}
          color="text-red-700 dark:text-red-400"
          bgColor="bg-red-100 dark:bg-red-950/60"
          subLabel={s && s.activeTotal ? `${Math.round((s.absent / s.activeTotal) * 100)}% active absenteeism (${s.inactiveTotal || 0} non-active excluded)` : ''}
          loading={loading}
          onClick={() => {
            setStatusFilter('Absent');
            setShowDevicePanel(false);
            setShowMonthDetailsPanel(false);
            if (tableRef.current) tableRef.current.scrollIntoView({ behavior: 'smooth' });
          }}
          isActive={statusFilter === 'Absent' && !showDevicePanel && !showMonthDetailsPanel}
        />
        <KpiCard
          label="Late Arrivals"
          value={s?.late ?? 0}
          icon={<Clock size={20} className="text-amber-600" />}
          color="text-amber-700 dark:text-amber-400"
          bgColor="bg-amber-100 dark:bg-amber-950/60"
          loading={loading}
          onClick={() => {
            setStatusFilter('Late');
            setShowDevicePanel(false);
            setShowMonthDetailsPanel(false);
            if (tableRef.current) tableRef.current.scrollIntoView({ behavior: 'smooth' });
          }}
          isActive={statusFilter === 'Late' && !showDevicePanel && !showMonthDetailsPanel}
        />
        <KpiCard
          label="Attendance %"
          value={loading ? '—' : `${s?.attendanceRate ?? 0}%`}
          icon={<TrendingUp size={20} className="text-sky-600" />}
          color={
            (s?.attendanceRate ?? 0) >= 90 ? 'text-emerald-700 dark:text-emerald-400' :
            (s?.attendanceRate ?? 0) >= 75 ? 'text-amber-700 dark:text-amber-400' :
            'text-red-700 dark:text-red-400'
          }
          bgColor="bg-sky-100 dark:bg-sky-950/60"
          subLabel={
            (s?.attendanceRate ?? 0) >= 90 ? '✓ Excellent' :
            (s?.attendanceRate ?? 0) >= 75 ? '⚠ Needs attention' :
            '✗ Critical low'
          }
          loading={loading}
          onClick={() => {
            setShowMonthDetailsPanel(v => !v);
            setShowDevicePanel(false);
          }}
          isActive={showMonthDetailsPanel}
        />
        {/* Device KPI — clickable to open device panel */}
        {(() => {
          const ds = data?.deviceSummary || (deviceData ? { online: deviceData.online, offline: deviceData.offline, total: deviceData.total } : null);
          return (
            <button
              onClick={() => {
                setShowDevicePanel(v => !v);
                setShowMonthDetailsPanel(false);
              }}
              className={`bg-white dark:bg-slate-900 rounded-2xl border ${
                showDevicePanel
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md bg-emerald-50/10 dark:bg-emerald-950/20'
                  : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
              } p-5 transition-all text-left group relative cursor-pointer w-full`}
            >
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Devices Online</p>
              <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400 leading-none">
                {ds ? ds.online : (loading ? '...' : '—')}
                {ds && ds.total > 0 && (
                  <span className="text-sm font-semibold text-slate-400"> / {ds.total}</span>
                )}
              </p>
              {ds && ds.offline > 0 && (
                <p className="text-[11px] text-red-500 font-semibold mt-1">⚠ {ds.offline} offline</p>
              )}
              {ds && ds.offline === 0 && ds.total > 0 && (
                <p className="text-[11px] text-emerald-500 font-semibold mt-1">✓ All online</p>
              )}
              {(!ds || ds.total === 0) && !loading && (
                <p className="text-[11px] text-slate-400 font-medium mt-1">Click to view details</p>
              )}
              <div className="absolute top-4 right-4 w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Radio size={20} className="text-emerald-600" />
              </div>
            </button>
          );
        })()}
      </div>

      {/* ── PRESENT MONTH ATTENDANCE DETAILS PANEL (collapsible) ───────────────────────── */}
      {showMonthDetailsPanel && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden p-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="text-sky-600 dark:text-sky-400" size={18} />
                <h2 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  Present Month Attendance Overview — {format(new Date(selectedDate), 'MMMM yyyy')}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                30-day attendance analytics, month-to-date active workforce performance & site ratios
              </p>
            </div>
            <button
              onClick={() => setShowMonthDetailsPanel(false)}
              className="text-slate-400 hover:text-slate-600 text-xs px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors cursor-pointer w-fit"
            >
              × Close Month Details
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-sky-50/60 dark:bg-sky-950/40 rounded-2xl border border-sky-100 dark:border-sky-900/60">
              <p className="text-xs font-semibold text-sky-800 dark:text-sky-300 uppercase tracking-wider">Month-to-Date Present Rate</p>
              <p className="text-2xl font-black text-sky-900 dark:text-sky-200 mt-1">{s?.attendanceRate ?? 0}%</p>
              <p className="text-[11px] text-sky-700 dark:text-sky-400 mt-1 font-medium">Avg active attendance for {format(new Date(selectedDate), 'MMM yyyy')}</p>
            </div>

            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-2xl border border-emerald-100 dark:border-emerald-900/60">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Present Staff Today</p>
              <p className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1">{s?.present ?? 0}</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">Of {s?.activeTotal ?? 0} active site workforce</p>
            </div>

            <div className="p-4 bg-red-50/60 dark:bg-red-950/40 rounded-2xl border border-red-100 dark:border-red-900/60">
              <p className="text-xs font-semibold text-red-800 dark:text-red-300 uppercase tracking-wider">Active Absent Today</p>
              <p className="text-2xl font-black text-red-900 dark:text-red-200 mt-1">{s?.absent ?? 0}</p>
              <p className="text-[11px] text-red-700 dark:text-red-400 mt-1 font-medium">{s?.inactiveTotal ?? 0} long-term inactive excluded</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total Database Headcount</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{s?.totalHeadcount ?? s?.totalEmployees ?? 0}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">{s?.activeTotal ?? 0} active in last 25 days</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Device Status Panel (collapsible) ───────────────────────── */}
      {showDevicePanel && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Radio size={16} className="text-emerald-600" /> Biometric Device Status
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {deviceData?.online ?? 0} online &middot; {deviceData?.offline ?? 0} offline &middot; {deviceData?.total ?? 0} total
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Device status filter */}
              <select
                value={deviceStatusFilter}
                onChange={e => setDeviceStatusFilter(e.target.value as 'all' | 'online' | 'offline')}
                className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">All Devices</option>
                <option value="online">Online Only</option>
                <option value="offline">Offline Only</option>
              </select>
              <button
                onClick={() => setShowDevicePanel(false)}
                className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >× Close</button>
            </div>
          </div>

          {!deviceData || deviceData.total === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Radio size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">{deviceData?.note || 'No device data available'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    {['Status', 'Device Name', 'Serial No', 'Location', 'Last Ping'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {deviceData.devices
                    .filter(d => deviceStatusFilter === 'all' || d.status === deviceStatusFilter)
                    .map((device, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            device.status === 'online'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                            {device.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{device.deviceName}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{device.serialNo}</td>
                        <td className="px-4 py-3 text-slate-500">{device.location || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {device.lastPing
                            ? new Date(device.lastPing).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Charts Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 7-Day Trend Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">7-Day Attendance Trend</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Present vs Absent daily</p>
            </div>
            <BarChart3 size={18} className="text-slate-400" />
          </div>

          {loading ? (
            <div className="h-52 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ) : accessibleTrend && accessibleTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={accessibleTrend} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="present" name="Present" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Database size={32} />
              <p className="text-xs font-medium">No trend data available</p>
            </div>
          )}
        </div>

        {/* Site Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 dark:text-white text-sm">Site Breakdown</h2>
                {departmentFilter !== 'all' && (
                  <button
                    onClick={() => setDepartmentFilter('all')}
                    className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 font-bold px-2 py-0.5 rounded-full transition-colors"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Click any site to view users</p>
            </div>
            <Building2 size={18} className="text-slate-400" />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : accessibleDepartments && accessibleDepartments.length > 0 ? (
            <div className="space-y-2 overflow-y-auto max-h-52 pr-1">
              {accessibleDepartments.map(dept => {
                const pct = dept.total > 0 ? Math.round((dept.present / dept.total) * 100) : 0;
                const isSelected = departmentFilter === dept.name;
                return (
                  <div
                    key={dept.name}
                    onClick={() => {
                      const nextFilter = isSelected ? 'all' : dept.name;
                      setDepartmentFilter(nextFilter);
                      if (tableRef.current) {
                        tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className={`p-2 rounded-xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-500 shadow-xs'
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className={`truncate max-w-[160px] ${isSelected ? 'font-bold text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        {dept.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isSelected && (
                          <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                        <span className="text-slate-500 font-mono text-[11px]">{dept.present}/{dept.total}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Building2 size={32} />
              <p className="text-xs font-medium">No site data</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Employee Table ─────────────────────────────────────────────────── */}
      <div ref={tableRef} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Table header + filters */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">
              Employee Attendance Details
              {!loading && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({filteredEmployees.length} of {data?.employees.length ?? 0})
                </span>
              )}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Shift filter */}
            <select
              value={shiftFilter}
              onChange={e => setShiftFilter(e.target.value)}
              className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">All Shifts</option>
              <option value="DoubleTriple">⚠️ Multi-Shift (Double/Triple)</option>
              <option value="A Shift">A Shift (07:00 - 14:00)</option>
              <option value="B Shift">B Shift (14:00 - 21:00)</option>
              <option value="C Shift">C Shift (21:00 - 07:00)</option>
              <option value="General Shift">General (09:00 - 18:00)</option>
              <option value="Day Shift (12h)">Day Shift (08:00 - 20:00)</option>
              <option value="Night Shift (12h)">Night Shift (20:00 - 08:00)</option>
              <option value="Security Day">Security Day (09:00 - 21:00)</option>
              <option value="Security Night">Security Night (21:00 - 09:00)</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="Present">Present (All)</option>
              <option value="OnDuty">On Duty (Active)</option>
              <option value="Completed">Shift Completed (6+ hrs)</option>
              <option value="all">All Status</option>
              <option value="Absent">Absent</option>
              <option value="Late">Late</option>
              <option value="Half Day">Half Day</option>
            </select>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search employee..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 w-44"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                {[
                  { key: 'empCode', label: 'Biometric Code' },
                  { key: 'empName', label: 'Employee' },
                  { key: 'department', label: 'Site (🟠 Auto-Mapped)' },
                  { key: 'shiftName', label: 'Shift' },
                  { key: 'designation', label: 'Designation' },
                  { key: 'inTime', label: 'In Time' },
                  { key: 'outTime', label: 'Out Time' },
                  { key: 'workingHours', label: 'Hours' },
                  { key: 'otHours', label: 'OT' },
                  { key: 'status', label: 'Status' },
                ].map(col => {
                  const isCentered = col.key === 'status';
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key as keyof EmployeeRow)}
                      className={`px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none transition-colors ${isCentered ? 'text-center' : 'text-left'}`}
                    >
                      <span className={`inline-flex items-center gap-0.5 ${isCentered ? 'justify-center w-full' : ''}`}>
                        {col.label}
                        <SortIcon col={col.key as keyof EmployeeRow} />
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400">
                    <Database size={36} className="mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-slate-500 dark:text-slate-400">
                      {data?.connectionStatus === 'error' ? 'Database unavailable — check connection.' : 'No records found.'}
                    </p>
                    {search && (
                      <button onClick={() => setSearch('')} className="mt-2 text-xs text-emerald-600 hover:underline">
                        Clear search
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp, idx) => {
                  const rowBg = emp.shiftType === 'triple'
                    ? 'bg-red-500/15 dark:bg-red-950/50 border-l-4 border-red-600 font-medium'
                    : emp.shiftType === 'double'
                      ? 'bg-amber-500/15 dark:bg-amber-950/40 border-l-4 border-amber-500 font-medium'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors';

                  return (
                    <tr
                      key={`${emp.empCode}-${idx}`}
                      className={rowBg}
                    >
                      <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">{emp.empCode || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white max-w-[180px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="truncate">{emp.empName}</span>
                          {emp.lifecycleStatus === 'New Joinee' && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.2 rounded w-max">
                              <UserPlus size={9} /> New Joinee
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span>{emp.department}</span>
                          {emp.isSmartSite && (
                            <span
                              className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0 cursor-help"
                              title={`Smart Inferred Site (Original in eTimeTrack database was '${emp.originalDept || 'Default'}')`}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ShiftBadge shiftName={emp.shiftName} shiftTiming={emp.shiftTiming} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[120px] truncate">{emp.designation}</td>
                      <td className="px-4 py-3 font-mono">
                        {emp.inTime ? (
                          <div className="flex flex-col">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{emp.inTime}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {emp.outTime ? (
                          <div className="flex flex-col">
                            <span className="text-slate-700 dark:text-slate-300 font-semibold">{emp.outTime}</span>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                              {(() => {
                                const isNightOvernight = (emp.shiftName || '').toLowerCase().includes('night') || (emp.inTime || '').toLowerCase().includes('pm');
                                if (isNightOvernight) {
                                  const d = new Date(selectedDate);
                                  d.setDate(d.getDate() + 1);
                                  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} (+1d)`;
                                }
                                return new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                              })()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{emp.workingHours}</td>
                      <td className="px-4 py-3 font-mono text-amber-600 dark:text-amber-400 font-semibold">
                        {emp.otHours || '0h 00m'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <StatusBadge status={emp.status} shiftCompleted={emp.shiftCompleted} outTime={emp.outTime} shiftType={emp.shiftType} selectedDate={selectedDate} />
                          {emp.lateMinutes > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <Clock size={10} className="shrink-0 text-amber-600" />
                              Late by {emp.lateMinutes >= 60 ? `${Math.floor(emp.lateMinutes / 60)}h ${emp.lateMinutes % 60}m` : `${emp.lateMinutes}m`}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar (50 items per page) */}
        {!loading && filteredEmployees.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/50 dark:bg-slate-800/40">
            <div className="text-slate-500 dark:text-slate-400 font-medium">
              Showing <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min((currentPage - 1) * pageSize + 1, filteredEmployees.length)}</span> to{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(currentPage * pageSize, filteredEmployees.length)}</span> of{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">{filteredEmployees.length}</span> employees
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
              >
                Previous
              </button>

              <div className="px-3 py-1 text-slate-600 dark:text-slate-300 font-semibold">
                Page <span className="font-bold text-emerald-600 dark:text-emerald-400">{currentPage}</span> of{' '}
                <span className="font-bold">{totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* ── DB Schema Note (Only in Admin Debug Mode) ────────────────────────── */}
      {showDebug && data?.connectionStatus === 'error' && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-300 mb-1">Setup Required</p>
              <p className="text-amber-700 dark:text-amber-400">
                Edit <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">.env.local</code> and set:
              </p>
              <pre className="mt-2 bg-amber-100 dark:bg-amber-900/60 rounded-lg p-2 text-amber-800 dark:text-amber-200 font-mono text-[10px] leading-relaxed">
{`MSSQL_SERVER=WIN-0T8N581GN63
MSSQL_INSTANCE=SQLEXPRESS
MSSQL_DATABASE=etimetrackite1
MSSQL_USER=sa
MSSQL_PASSWORD=<your_password>
MSSQL_PORT=1433`}
              </pre>
              <p className="mt-2 text-amber-600 dark:text-amber-400">
                Then restart the dev server. Also adjust table/column names in{' '}
                <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">
                  src/api/controllers/mssql.controller.ts
                </code>{' '}
                if needed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SCREENSHOT SECURITY AUDIT MODAL ─────────────────────────────── */}
      {showScreenshotModal && (
        <div
          style={{ zoom: 1 }}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 relative overflow-hidden text-slate-900 dark:text-white">
            {/* Top Decorative Subtle Glow */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs shrink-0">
                  {captureType === 'screen_recording' ? (
                    <Video size={20} />
                  ) : (
                    <Camera size={20} />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Security Audit: {captureType === 'screen_recording' ? 'Screen Recording' : 'Screen Capture'}
                  </h3>
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                    Documentation Required
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScreenshotModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Policy Info Box */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Per company data security policy, capturing or recording site attendance data requires a logged audit reason. An automated log will be generated for administrative compliance.
              </p>
            </div>

            {/* Form Input Section */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Primary Reason <span className="text-rose-500">*</span>
                </label>
                <select
                  value={screenshotReasonInput}
                  onChange={e => setScreenshotReasonInput(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 sm:py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer shadow-xs"
                >
                  <option value="Live Training & Operations Demo">📹 Live Training & Operations Demo</option>
                  <option value="Client Compliance Audit">📋 Client Compliance Audit</option>
                  <option value="Discrepancy & Shift Audit">🔍 Discrepancy & Shift Audit</option>
                  <option value="Executive Management Review">📊 Executive Management Review</option>
                  <option value="Technical / System Issue Report">🛠️ Technical / System Issue Report</option>
                  <option value="Custom Internal Notes">✍️ Custom Internal Audit Notes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Additional Context / Remarks <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="State detailed reason for capturing screen..."
                  value={screenshotNotesInput}
                  onChange={e => setScreenshotNotesInput(e.target.value)}
                  className="w-full text-xs sm:text-sm p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder:text-slate-400 shadow-xs"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowScreenshotModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-2xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitScreenshotReason}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-98 text-white text-xs sm:text-sm font-extrabold rounded-2xl shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
              >
                <Save size={15} />
                Submit Reason & Notify Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUPABASE DB MIGRATION SQL MODAL ─────────────────────────────── */}
      {showSqlSchemaModal && (
        <div
          style={{ zoom: 1 }}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 max-w-2xl w-full shadow-2xl space-y-4 text-slate-900 dark:text-white relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Database size={20} className="text-purple-600 dark:text-purple-400" />
                Supabase SQL Database Migration Query
              </h3>
              <button
                onClick={() => setShowSqlSchemaModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Run this SQL script in your <strong>Supabase SQL Editor</strong> to create the <code className="font-mono text-purple-600">user_site_permissions</code> and <code className="font-mono text-purple-600">screenshot_audit_logs</code> tables:
            </p>

            <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-72 border border-slate-800">
{SUPABASE_ACCESS_CONTROL_SQL_MIGRATION}
            </pre>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(SUPABASE_ACCESS_CONTROL_SQL_MIGRATION);
                  alert('Supabase SQL Migration script copied to clipboard!');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-2xl cursor-pointer"
              >
                <Save size={14} />
                Copy SQL Script
              </button>
              <button
                onClick={() => setShowSqlSchemaModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-2xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientAttendanceDashboard;
