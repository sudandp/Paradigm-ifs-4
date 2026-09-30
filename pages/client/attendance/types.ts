import React from 'react';
import type { DepartmentKey } from '../../../utils/departmentMapping';

export interface EmployeeRow {
  empCode: string;
  empName: string;
  department: string;
  isSmartSite?: boolean;
  originalDept?: string;
  designation: string;
  departmentOverride?: DepartmentKey;
  role?: string;
  company?: string;
  location?: string;
  inTime: string | null;
  outTime: string | null;
  isNextDayOut?: boolean;
  workingHours: string;
  shiftName?: string;
  shiftCode?: string;
  shiftTiming?: string;
  shiftType?: 'single' | 'double' | 'triple' | string;
  otHours?: string;
  status: 'Present' | 'Absent' | 'Late' | 'Half Day' | 'Not Joined Yet' | 'Discontinued / Left' | string;
  shiftCompleted?: boolean;
  duration?: number;
  isMissedPunchIn?: boolean;
  isMissedPunchOut?: boolean;
  lateMinutes: number;
  isActiveEmployee?: boolean | string;
  daysSinceLastPunch?: number;
  lifecycleStatus?: string;
  firstEverPunchDate?: string | null;
  hadPrevNightShift?: boolean;
  prevNightInPunch?: string | null;
  rawPunches?: any[];
  source?: string;
  totalDuties?: number;
  statusCode?: string;
  overtimeMinutes?: number;
}

export interface AttendanceSummary {
  date: string;
  totalEmployees: number;
  totalHeadcount?: number;
  activeTotal?: number;
  inactiveTotal?: number;
  deployedTotal?: number;
  weeklyOffCount?: number;
  present: number;
  absent: number;
  late: number;
  onTime: number;
  attendanceRate: number;
}

export interface DeviceSummary {
  online: number;
  offline: number;
  total: number;
}

export interface DepartmentStat {
  name: string;
  present: number;
  total: number;
  deployedCount?: number;
  enrolledCount?: number;
}

export interface TrendPoint {
  date: string;
  rawDate?: string;
  present: number;
  absent: number;
  attendanceRate?: number;
  rate?: number;
}

export interface SiteBreakdownItem {
  siteName?: string;
  name?: string;
  present: number;
  total: number;
  percentage?: number;
}

export interface DeptRow {
  name: string;
  present: number;
  total: number;
}

export interface DeviceRow {
  deviceId: number | string;
  serialNo: string;
  deviceName: string;
  location: string;
  lastPing: string | null;
  status: 'online' | 'offline';
}

export interface DeviceData {
  devices: DeviceRow[];
  online: number;
  offline: number;
  total: number;
  note?: string;
}

export interface AttendanceData {
  summary: AttendanceSummary;
  deviceSummary?: { online: number; offline: number; total: number };
  employees: EmployeeRow[];
  trend: TrendPoint[];
  departments: DeptRow[];
  lastUpdated: string;
  connectionStatus: 'connected' | 'error';
  errorMessage?: string;
  source?: string;
  cached?: boolean;
}
