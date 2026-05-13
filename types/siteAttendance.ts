// Site Attendance types for department-level rule overrides and staff roster

/**
 * Site Department — DYNAMIC. Admin adds departments per site.
 * Each department has an auto-generated ID (slug) and a display name.
 */
export interface SiteDepartment {
  id: string;        // slug: 'facility_manager', 'security', 'hk_services', etc.
  label: string;     // display: 'Facility Manager', 'Security', 'HK Services'
  shortLabel: string; // short: 'FM', 'Sec', 'HK'
}

/**
 * Default seed departments — used as starting template for new sites.
 * Admin can add/remove/rename departments freely.
 */
export const DEFAULT_SITE_DEPARTMENTS: SiteDepartment[] = [
  { id: 'admin', label: 'Administration', shortLabel: 'Admin' },
  { id: 'electro_mechanical', label: 'Electro Mechanical', shortLabel: 'E&M' },
  { id: 'hk_services', label: 'HK Services', shortLabel: 'HK' },
  { id: 'landscaping', label: 'Landscaping', shortLabel: 'Land' },
  { id: 'security', label: 'Security', shortLabel: 'Sec' },
];

/** Generate a slug from a department name */
export function generateDeptSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 40);
}

/** Per-department rules configuration (stored as array, keyed by dept ID) */
export interface DeptRuleConfig {
  deptId: string;          // matches SiteDepartment.id
  weeklyOffDays?: number[]; // [0] = Sunday, [5] = Friday
  shiftId?: string;         // default shift from siteShifts[]
  holidayCodeType?: string; // 'H', '0.5H', 'O/H', 'O/H.5'
  leaveTypes?: string[];    // ['E/L', 'S/L', 'C/O']
  deploymentCount?: number; // contract headcount
}

/** Staff exclusion remarks — staff with these remarks are excluded from holiday duty */
export const STAFF_EXCLUSION_REMARKS = [
  'Long Leave',
  'Hold',
  'Left',
  'Terminated',
  'Resigned',
  'Expired',
  'Temp Duty',
  'Reliever',
  'Shifted From',
  'Shifted To',
] as const;

export type StaffRemark = typeof STAFF_EXCLUSION_REMARKS[number] | '';

/** Holiday code types */
export type HolidayCodeType = 'H' | '0.5H' | 'O/H' | 'O/H.5';

/** Leave types that can be enabled per department */
export type SiteLeaveType = 'E/L' | 'S/L' | 'C/O' | 'OT';

export const SITE_LEAVE_TYPES: { id: SiteLeaveType; label: string }[] = [
  { id: 'E/L', label: 'Earned Leave' },
  { id: 'S/L', label: 'Sick Leave' },
  { id: 'C/O', label: 'Comp Off' },
  { id: 'OT', label: 'Overtime' },
];

/** Site Attendance Staff record (roster entry) */
export interface SiteAttendanceStaff {
  id?: string;
  organizationId: string;
  refNo: string;
  biometricId?: string;
  doj: string; // YYYY-MM-DD
  department: string; // dynamic dept ID from siteDepartments[]
  designation: string;
  staffName: string;
  shiftId?: string;
  weeklyOffOverride?: number[]; // Per-user override of dept weekly off
  remarks?: StaffRemark;
  createdAt?: string;
  updatedAt?: string;
}

/** Manual override of an auto-computed attendance code */
export interface SiteAttendanceOverride {
  id?: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  originalCode: string;
  overrideCode: string;
  overriddenBy: string;
  reason?: string;
  createdAt?: string;
}

/** Duty summary for a single staff member (columns AN–AV) */
export interface SiteDutySummary {
  netDuties: number;      // AN
  weekOffOT: number;      // AO
  leaveCount: number;     // AQ
  absenceCount: number;   // AR
  otDuties: number;       // AS
  holidaysPayable: number; // AT
  totalPayable: number;   // AU
  finalCapped: number;    // AV
}

/** Validation alert for a staff member's monthly attendance */
export interface SiteAttendanceAlert {
  staffId: string;
  staffName: string;
  type: 'warning' | 'error';
  message: string;
}

/** Days of the week for weekly off picker */
export const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
] as const;
