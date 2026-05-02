import { UploadedFile } from './common';

export type AttendanceEventType = 'punch-in' | 'punch-out' | 'break-in' | 'break-out' | 'site-in' | 'site-out' | 'site-ot-in' | 'site-ot-out';

export interface AttendanceEvent {
  id: string;
  userId: string;
  timestamp: string; // ISO String
  type: AttendanceEventType;
  latitude?: number;
  longitude?: number;
  /**
   * Optional reference to the geofenced location used for this attendance event.  When
   * check‑in/out occurs within a defined geofence, locationId will be populated
   * with the corresponding location record.  When an event is recorded outside
   * all known geofences, this field may be null or undefined.
   */
  locationId?: string | null;
  /**
   * Optional human-readable location name/address stored directly with the event.
   * This is populated during check-in/out to enable fast report generation without
   * needing to resolve coordinates or join with the locations table.
   */
  locationName?: string | null;
  /**
   * Optional reference to the biometric device that recorded this event.
   * Null if recorded via mobile app.
   */
  deviceId?: string | null;
  checkoutNote?: string;
  attachmentUrl?: string | null;
  workType?: 'office' | 'field' | 'site';
  fieldReportId?: string;
  isManual?: boolean;
  createdBy?: string;
  reason?: string;
  /** True when this event belongs to an overtime (2nd+) punch cycle. */
  isOt?: boolean;
  /** Auto-detected shift ID for site staff (e.g. 'shift_a', 'shift_c'). Populated on punch-in. */
  detectedShiftId?: string;
  // Device Metadata
  batteryLevel?: number;
  deviceName?: string;
  ipAddress?: string;
  networkType?: string;
  networkProvider?: string;
  source?: string;
}

export interface RoutePoint {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: string; // ISO String
  accuracy?: number;
  speed?: number;
  heading?: number;
  // Device Metadata
  batteryLevel?: number;
  deviceName?: string;
  ipAddress?: string;
  networkType?: string;
  networkProvider?: string;
  source?: string;
}

// -----------------------------------------------------------------------------
// Geofencing Types
//
// Locations define circular geofences that staff can check in/out within.  A
// location may be shared across multiple users via the user_locations table.  Each
// location has a center coordinate and radius (meters).  createdBy denotes the
// user who created it; createdAt is an ISO timestamp.  The optional name
// property provides a friendly label for display.

export interface Location {
  id: string;
  name: string | null;
  latitude: number;
  longitude: number;
  radius: number;
  /** Optional human readable address (street, area, city). */
  address?: string | null;
  createdBy?: string | null;
  createdAt?: string;

  /**
   * Optional name of the user who created this location.  This is derived
   * on the client side by mapping createdBy to the user's name.  Not
   * stored in the database.
   */
  createdByName?: string;
}

export interface RecurringHolidayRule {
  id?: string; // Optional for new rules before saving
  type?: 'office' | 'field' | 'site' | 'admin' | 'management'; // Optional as it might be inferred
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  n: number; // 1 for 1st, 2 for 2nd, 3 for 3rd, 4 for 4th, 5 for 5th
  roleType?: string; // For database compatibility
  occurrence?: number; // For database compatibility
}

export interface StaffAttendanceRules {
  minimumHoursFullDay: number;
  minimumHoursHalfDay: number;
  annualEarnedLeaves: number;
  earnedLeavesExpiryDate?: string; // ISO or YYYY-MM-DD
  earnedLeavesValidFrom?: string; // ISO or YYYY-MM-DD
  annualSickLeaves: number;
  sickLeavesExpiryDate?: string; // ISO or YYYY-MM-DD
  sickLeavesValidFrom?: string; // ISO or YYYY-MM-DD
  monthlyFloatingLeaves: number;
  floatingLeavesExpiryDate?: string; // ISO or YYYY-MM-DD
  floatingLeavesValidFrom?: string; // ISO or YYYY-MM-DD
  floatingHolidayMonths?: number[];
  floatingHolidayYearType?: 'calendar' | 'financial';
  annualCompOffLeaves: number;
  compOffLeavesExpiryDate?: string; // ISO or YYYY-MM-DD
  compOffLeavesValidFrom?: string; // ISO or YYYY-MM-DD
  childCareLeavesExpiryDate?: string; // ISO or YYYY-MM-DD
  childCareLeavesValidFrom?: string; // ISO or YYYY-MM-DD
  enableAttendanceNotifications: boolean;
  sickLeaveCertificateThreshold: number;
  geofencingEnabled?: boolean;
  maxViolationsPerMonth?: number;
  recurringHolidays?: RecurringHolidayRule[];
  // Fixed office hours configuration
  fixedOfficeHours?: {
    checkInTime: string; // "09:00"
    checkOutTime: string; // "18:00"
    breakInTime?: string; // "13:00"
    breakOutTime?: string; // "14:00"
    siteOtInTime?: string; // "18:00"
    siteOtOutTime?: string; // "20:00"
  };
  dailyWorkingHours?: {
    min: number; // 7
    max: number; // 9
  };
  monthlyTargetHours?: number; // 216
  enableHoursBasedCalculation?: boolean;
  // Break tracking
  enableBreakTracking?: boolean;
  lunchBreakDuration?: number; // minutes, default 60
  // Holiday restrictions
  maxHolidaysPerCategory?: number; // Total limit (e.g., 10)
  adminAllocatedHolidays?: number; // Limit for admin (e.g., 5)
  employeeHolidays?: number; // Limit for employee selection (e.g., 5)
  enableCustomHolidays?: boolean; // Whether users can pick their own holidays
  enableOtToCompOffConversion?: boolean; // Convert OT to Comp Off day
  otConversionThreshold?: number; // Hours required for 1 Comp Off (e.g., 8)
  enableShortfall?: boolean; // Show shortfall card and calendar
  // Weekly off configuration
  weeklyOffDays?: number[]; // [0] for Sunday, [0,6] for Sunday and Saturday
  // Field Staff Site/Travel Tracking
  minimumSitePercentage?: number; // e.g., 75 - minimum % of time that must be on-site
  minimumSiteHours?: number; // New: Absolute minimum site hours required
  maximumTravelPercentage?: number; // e.g., 25 - maximum % of time for travel
  enableSiteTimeTracking?: boolean; // Enable site vs travel validation for field staff
  enableViolationBlocking?: boolean; // Whether violations should block the user and hold salary
  earnedLeaveAccrual?: {
    daysRequired: number; // e.g., 10
    amountEarned: number; // e.g., 0.5
  };
  enableSickLeaveAccrual?: boolean;
  fieldStaffGraceMinutes?: number;
  holidayPool?: { name: string; date: string }[];
  // Device limits configuration
  deviceLimits?: {
    web: number; // Number of allowed web devices
    android: number; // Number of allowed Android devices
    ios: number; // Number of allowed iOS devices
  };
  // Admin-configured tracking interval (minutes)
  trackingIntervalMinutes?: number;
  // Maternity & Child Care Leave
  maternityLeaveWeeks?: number; // default 26
  maternityMinTenureMonths?: number; // default 6
  childCareLeaveUnder5?: number; // default 6 days/year
  childCareLeave5to15?: number; // default 3 days/year
  enableMaternityChildCare?: boolean;
  // --- Calculation Rules (configurable from Admin UI) ---
  threeQuarterDayHours?: number;       // Hours threshold for 3/4P status (default: 75% of fullDay)
  quarterDayHours?: number;            // Hours threshold for 1/4P status (default: 2)
  weekendPresentThreshold?: number;    // Min days present in week to earn W/O (default: 3)
  enableHoursBasedFallback?: boolean;  // For field/site: if site tracking returns A but hours exist, use hours (default: true)
  // Short Permission Leaves
  enablePermission?: boolean;
  maxPermissionDurationHours?: number;
  maxPermissionsPerMonth?: number;
  // Correction Limits
  enableCorrectionLimits?: boolean;
  maxCorrectionDurationHours?: number;
  maxCorrectionsPerMonth?: number;
  // --- Shift Management (Site Staff) ---
  enableShiftManagement?: boolean;     // When true, shifts are auto-detected by punch-in time
  siteShifts?: SiteShiftDefinition[];  // Configured shift windows
}

export interface SiteShiftDefinition {
  id: string;                          // e.g. 'shift_a', 'shift_b', 'shift_c'
  name: string;                        // e.g. 'Shift A (Morning)'
  startTime: string;                   // HH:mm e.g. '07:00'
  endTime: string;                     // HH:mm e.g. '15:00'
  crossesMidnight: boolean;            // true if endTime < startTime (night shift)
  autoCheckoutBufferMinutes?: number;  // Grace period after shift end (default 30)
}

export interface UserHoliday {
  id: string;
  userId: string;
  holidayName: string;
  holidayDate: string;
  year: number;
}

export interface AttendanceSettings {
  office: StaffAttendanceRules;
  field: StaffAttendanceRules;
  site: StaffAttendanceRules;
  admin?: StaffAttendanceRules;
  management?: StaffAttendanceRules;
  missedCheckoutConfig?: {
    enabledGroups: ('office' | 'field' | 'site' | 'admin' | 'management')[];
    enabledRoles?: string[]; // Deprecated in favor of roleMapping
    roleMapping?: {
      office: string[];
      field: string[];
      site: string[];
      admin?: string[];
      management?: string[];
    };
  };
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: 'office' | 'field' | 'site' | 'admin' | 'management' | 'pool';
}

export interface AttendanceViolation {
  id: string;
  userId: string;
  violationDate: string; // ISO String
  type: string; // Legacy field
  violationType?: string; // e.g. 'LATE_PUNCH_IN', 'GEO_FENCE_VIOLATION'
  violationDetails?: any; // JSONB for expected vs actual
  severity?: 'Low' | 'Medium' | 'High';
  reason?: string;
  locationName?: string | null;
  attemptedLatitude?: number | null;
  attemptedLongitude?: number | null;
  assignedGeofenceId?: string | null;
  distanceFromGeofence?: number | null; // meters
  violationMonth: string; // 'YYYY-MM'
  adminNote?: string | null;
  createdAt: string; // ISO String
}

export interface AttendanceUnlockRequest {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string; // ISO String
  managerId?: string;
  respondedAt?: string; // ISO String
  rejectionReason?: string;
}

export interface ViolationReset {
  id: string;
  userId: string;
  resetMonth: string; // 'YYYY-MM'
  previousViolationCount: number;
  resetBy: string; // admin user id
  resetReason: string;
  createdAt: string; // ISO String
}

// Field Staff Site/Travel Violations

export interface FieldAttendanceViolation {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  
  // Time breakdown
  totalHours: number;
  siteHours: number;
  travelHours: number;
  sitePercentage: number;
  travelPercentage: number;
  siteVisits?: number;
  
  // Violation details
  violationType: 'site_time_low' | 'insufficient_hours' | string;
  violationDetails?: any; // JSONB for breakdown, expected vs actual
  severity?: 'Low' | 'Medium' | 'High';
  requiredSitePercentage: number;
  
  // Workflow
  status: 'pending' | 'acknowledged' | 'escalated';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  managerNotes?: string;
  
  // Escalation
  userReason?: string;
  escalatedTo?: string;
  escalatedAt?: string;
  escalationLevel: number; // 0=direct manager, 1=HR/Admin
  
  // Impacts
  affectsSalary: boolean;
  affectsPerformance: boolean;
  attendanceGranted: boolean; // True after acknowledgment grants (P) status
  
  createdAt: string;
  updatedAt: string;
}

export interface GeofencingSettings {
  enabled: boolean;
  maxViolationsPerMonth: number;
}

export type DailyAttendanceStatus = 'Present' | 'Half Day' | 'Absent' | 'Holiday' | 'Weekend' | 'Incomplete' | 'On Leave (Full)' | 'On Leave (Half)';

export interface DailyAttendanceRecord {
  date: string; // YYYY-MM-DD
  day: string; // 'Monday', etc.
  checkIn: string | null; // "HH:mm"
  checkOut: string | null; // "HH:mm"
  duration: string | null; // "HHh MMm"
  status: DailyAttendanceStatus;
}

// Types for Leave Management

export type LeaveType = 'Earned' | 'Sick' | 'Floating' | 'Comp Off' | 'Loss of Pay' | 'Maternity' | 'Child Care' | 'Pink Leave' | 'WFH' | 'Correction' | 'Permission';

export type LeaveRequestStatus = 'pending_manager_approval' | 'pending_hr_confirmation' | 'pending_admin_correction' | 'correction_made' | 'approved' | 'rejected' | 'cancelled' | 'withdrawn';

export interface ApprovalRecord {
  approverId: string;
  approverName: string;
  approverPhotoUrl?: string | null;
  status: 'approved' | 'rejected';
  timestamp: string;
  comments?: string;
}

export interface CompOffLog {
  id: string;
  userId: string;
  userName?: string;
  dateEarned: string; // YYYY-MM-DD
  reason: string;
  status: 'earned' | 'used' | 'expired';
  leaveRequestId?: string | null;
  grantedById?: string;
  grantedByName?: string;
}

export interface LeaveBalance {
  userId: string;
  [key: string]: any; // Broadened to allow debug and other dynamic fields
  earnedTotal: number;
  earnedUsed: number;
  earnedPending: number;
  sickTotal: number;
  sickUsed: number;
  sickPending: number;
  floatingTotal: number;
  floatingUsed: number;
  floatingPending: number;
  compOffTotal: number;
  compOffUsed: number;
  compOffPending: number;
  maternityTotal: number;
  maternityUsed: number;
  maternityPending: number;
  childCareTotal: number;
  childCareUsed: number;
  childCarePending: number;
  pinkTotal: number;
  pinkUsed: number;
  pinkPending: number;
  earnedThisMonth?: number;
  earnedPreviousMonth?: number;
  otHoursThisMonth: number;
  expiryStates?: {
    earned: boolean;
    sick: boolean;
    floating: boolean;
    compOff: boolean;
  };
  debug?: {
    staffType?: string;
    countableDays?: number;
    hasEarnedRule?: boolean;
    day17IsFloating?: boolean;
    hasSettings?: boolean;
    officeRules?: boolean;
    fieldRules?: boolean;
    earnedRule?: any;
    earnedThisMonth?: number;
    earnedPreviousMonth?: number;
    openingDate?: string;
    asOfDate?: string;
    processedLeaves?: any[];
    monthsElapsed?: number;
  };
}

export interface CorrectionDetails {
  status: 'Present' | 'Site Visit' | 'W/H';
  punchIn: string; // HH:mm
  punchOut: string; // HH:mm
  includeBreak: boolean;
  breakIn?: string;
  breakOut?: string;
  locationName: string;
  includeSiteOt?: boolean;
  siteOtIn?: string;
  siteOtOut?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  status: LeaveRequestStatus;
  dayOption?: 'full' | 'half'; // for single-day leave requests
  currentApproverId: string | null;
  currentApproverName?: string | null;
  currentApproverPhotoUrl?: string | null;
  approvalHistory: ApprovalRecord[];
  doctorCertificate?: UploadedFile | null;
  correctionDetails?: CorrectionDetails | null;
}

export interface ExtraWorkLog {
  id: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  workDate: string; // YYYY-MM-DD
  workType: 'Holiday' | 'Week Off' | 'Night Shift';
  claimType: 'OT' | 'Comp Off';
  hoursWorked?: number | null;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approverId?: string | null;
  approverName?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
}
