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

/** Admin-configured shift rule from Policy Studio */
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
  targetRole?: string;
}

/** Admin-configured Double Duty & Shift Combination Rule (e.g. A+B, B+C, A+C) */
export interface ShiftCombinationRule {
  id: string;
  name: string;
  combinationCode: string; // 'A+B' | 'B+C' | 'A+C' | custom
  firstShiftCode: string;  // e.g. 'A'
  secondShiftCode: string; // e.g. 'B'
  minSpanHours: number;    // e.g. 14
  multiplier: number;      // e.g. 2.0
  targetRole: string;      // e.g. 'Site Staffs (MEP/Technical)'
  siteName?: string;       // e.g. 'All Sites' or specific client site
  anchorTo: 'current_day' | 'day_1_in_date';
  description?: string;
  isActive: boolean;
}

export const DEFAULT_SHIFT_COMBINATIONS: ShiftCombinationRule[] = [
  {
    id: 'combo-ab',
    name: 'Morning + Afternoon Double Duty (A+B)',
    combinationCode: 'A+B',
    firstShiftCode: 'A',
    secondShiftCode: 'B',
    minSpanHours: 14,
    multiplier: 2.0,
    targetRole: 'Site Staffs (MEP/Technical)',
    siteName: 'All Sites',
    anchorTo: 'current_day',
    description: 'Punches in morning Shift A (06:00-08:30) and leaves after 22:00 (>= 14 hours total).',
    isActive: true,
  },
  {
    id: 'combo-bc',
    name: 'Afternoon + Night Double Duty (B+C)',
    combinationCode: 'B+C',
    firstShiftCode: 'B',
    secondShiftCode: 'C',
    minSpanHours: 14,
    multiplier: 2.0,
    targetRole: 'Site Staffs (MEP/Technical)',
    siteName: 'All Sites',
    anchorTo: 'day_1_in_date',
    description: 'Punches in afternoon Shift B (13:30-15:30) and works overnight into next morning (>= 14 hours total). Credited to Day 1.',
    isActive: true,
  },
  {
    id: 'combo-ac',
    name: 'Morning + Night Split Double Duty (A+C)',
    combinationCode: 'A+C',
    firstShiftCode: 'A',
    secondShiftCode: 'C',
    minSpanHours: 14,
    multiplier: 2.0,
    targetRole: 'Site Staffs (MEP/Technical)',
    siteName: 'All Sites',
    anchorTo: 'day_1_in_date',
    description: 'Completes morning Shift A, takes an inter-shift rest break, and returns for emergency Night Shift C. Credited to Day 1.',
    isActive: true,
  },
];

export const DEFAULT_SHIFT_RULES: ShiftRuleConfig[] = [
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
    targetRole: 'Site Staffs (MEP/Technical)',
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
    targetRole: 'Site Staffs (MEP/Technical)',
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
    targetRole: 'Site Staffs (MEP/Technical)',
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
    targetRole: 'All Roles (Site Staffs)',
  },
  {
    id: 'rule-hk-m',
    groupName: 'HK Morning Shift',
    shiftCode: 'HK-M',
    startTimeSlots: '06:30, 07:00, 07:30',
    displayTiming: '07:00 AM - 04:00 PM',
    expectedHours: 9,
    minCompletedHours: 8,
    siteName: 'All Sites',
    targetRole: 'Housekeeping',
  },
  {
    id: 'rule-hk-gen',
    groupName: 'HK General Shift',
    shiftCode: 'HK-GEN',
    startTimeSlots: '07:45, 08:00, 08:30',
    displayTiming: '08:00 AM - 05:00 PM',
    expectedHours: 9,
    minCompletedHours: 8,
    siteName: 'All Sites',
    targetRole: 'Housekeeping',
  },
  {
    id: 'rule-garden',
    groupName: 'Garden Shift Group',
    shiftCode: 'GAR',
    startTimeSlots: '07:45, 08:00, 08:30, 09:00',
    displayTiming: '08:00 AM - 05:00 PM',
    expectedHours: 9,
    minCompletedHours: 8,
    siteName: 'All Sites',
    targetRole: 'Garden / Landscaping',
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
    codePrefix: '32',
    targetRole: 'Security Staff (12h)',
  },
  {
    id: 'rule-night12',
    groupName: 'Security Night Duty (12h)',
    shiftCode: 'NIGHT-12',
    startTimeSlots: '19:45, 20:00, 20:30',
    displayTiming: '08:00 PM - 08:00 AM',
    expectedHours: 12,
    minCompletedHours: 11,
    siteName: 'All Sites',
    codePrefix: '32',
    targetRole: 'Security Staff (12h)',
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MISSED PUNCH POLICY
 * ─────────────────────────────────────────────────────────────────────────────
 * Controls when a missing OUT punch is declared "Missed" vs shown as "Pending"
 * (in-shift / still working).
 *
 * Rule: If a day is Present (employee has punched IN) and the current local
 * time has NOT yet crossed the shift's expected end time, show the OUT punch
 * as PENDING ("In Shift") instead of immediately declaring it as MISSED.
 * Only after the shift end time passes is the missing OUT punch declared MISSED.
 *
 * Admin can update this per shift code in Policy Studio.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface MissedPunchShiftPolicy {
  /** Shift code this rule applies to, e.g. 'GEN', 'A', 'B', 'C', 'DAY-12', 'NIGHT-12' */
  shiftCode: string;
  /**
   * Expected shift end time in "HH:MM" 24h format.
   * Until this time passes (on the same calendar day), a missing OUT punch
   * is considered PENDING ("In Shift"), NOT missed.
   * For overnight shifts (e.g. NIGHT-12 or C shift), use the next-morning exit time.
   */
  shiftEndTime: string;
  /**
   * For overnight shifts that end the next calendar day, set this true.
   * The engine will add 24h (1440 mins) to the end time before comparing.
   */
  isOvernight?: boolean;
}

export interface MissedPunchPolicy {
  /** Enable/disable the "wait until shift end" rule globally */
  enabled: boolean;
  /** Per-shift rules. Falls back to globalShiftEndTime if no match found. */
  shiftRules: MissedPunchShiftPolicy[];
  /**
   * Global fallback: time after which ANY missing OUT punch is declared Missed.
   * Default: "19:30" (7:30 PM) — covers most general shifts.
   */
  globalShiftEndTime: string;
}

/** Default policy — matches the standard shift schedule at Brigade Cornerstone Utopia */
export const DEFAULT_MISSED_PUNCH_POLICY: MissedPunchPolicy = {
  enabled: true,
  globalShiftEndTime: '19:30',
  shiftRules: [
    { shiftCode: 'A',       shiftEndTime: '16:00' },
    { shiftCode: 'B',       shiftEndTime: '22:30' },
    { shiftCode: 'C',       shiftEndTime: '07:30', isOvernight: true },
    { shiftCode: 'GEN',     shiftEndTime: '20:30' },
    { shiftCode: 'GS',      shiftEndTime: '20:30' },
    { shiftCode: 'HK-M',    shiftEndTime: '17:00' },
    { shiftCode: 'HK-GEN',  shiftEndTime: '18:00' },
    { shiftCode: 'GAR',     shiftEndTime: '17:30' },
    { shiftCode: 'DAY-12',  shiftEndTime: '20:30' },
    { shiftCode: 'NIGHT-12',shiftEndTime: '08:30', isOvernight: true },
  ],
};

