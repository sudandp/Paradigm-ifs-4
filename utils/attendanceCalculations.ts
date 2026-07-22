// Attendance calculation utilities for hours-based attendance tracking

import { differenceInMinutes, parseISO, isSameDay, format, startOfDay, isAfter, subDays } from 'date-fns';
import type { AttendanceEvent, DailyAttendanceStatus, RoutePoint } from '../types';
import { getFieldStaffStatus } from './fieldStaffTracking';
import { FIXED_HOLIDAYS } from './constants';
import { evaluateSiteStaffStatus } from './siteStaffCalculations';
import { calculateDistanceMeters } from './locationUtils';

/**
 * Robust check for roles that require night-shift/field-style session anchoring.
 * Includes all relievers, technicians, and maintenance staff.
 */
export function isTechnicalRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase();
  const technicalKeywords = [
    'technical',
    'technician',
    'reliever',
    'electrician',
    'plumber',
    'carpenter',
    'hvac',
    'multitech',
    'maintenance'
  ];
  return technicalKeywords.some(keyword => normalized.includes(keyword));
}

/**
 * Calculate total hours between two timestamps
 */
export function calculateDailyHours(checkIn: string, checkOut: string): number {
  const minutes = differenceInMinutes(parseISO(checkOut), parseISO(checkIn));
  return minutes / 60;
}

/**
 * Calculate working hours with multiple segments and break tracking
 * Chronological state-based accumulator for robust calculation.
 */
export function calculateWorkingHours(
  events: AttendanceEvent[],
  processingDate?: Date
): { 
  totalHours: number; 
  breakHours: number; 
  workingHours: number; 
  firstBreakIn: string | null;
  lastBreakIn: string | null; 
  lastBreakOut: string | null;
  breakIntervals: { start: string; end: string | null; duration: number }[];
} {
  // 1. Sort events chronologically to process intervals accurately
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  let netWorkMinutes = 0;
  let totalBreakMinutes = 0;
  let grossWorkMinutes = 0;
  
  let firstBreakIn: string | null = null;
  let lastBreakIn: string | null = null;
  let lastBreakOut: string | null = null;
  
  // State Trackers
  let isMainPunchedIn = false;
  let isAtSite = false;
  let isOnBreak = false;
  let lastEventTime: Date | null = null;

  let breakIntervals: { start: string; end: string | null; duration: number }[] = [];
  let activeBreakStart: string | null = null;

  // 2. Process intervals between events
  sortedEvents.forEach(event => {
    const eventTime = new Date(event.timestamp);
    
    if (lastEventTime) {
      const elapsed = differenceInMinutes(eventTime, lastEventTime);
      
      // Safely ignore excessively long anomalous intervals (e.g., missed punch outs)
      // 30 hours is the maximum continuous valid interval between events to support 24h technical shifts
      const MAX_INTERVAL_MINUTES = 30 * 60;
      let validElapsed = elapsed;
      if (elapsed > MAX_INTERVAL_MINUTES) {
        validElapsed = 0;
      }
      
      // Accumulate logic based on PREVIOUS state during this interval
      const isCurrentlyPunchedIn = isMainPunchedIn || isAtSite;
      
      if (isCurrentlyPunchedIn && !isOnBreak) {
        netWorkMinutes += validElapsed;
      }
      if (isOnBreak) {
        totalBreakMinutes += validElapsed;
      }
      if (isCurrentlyPunchedIn) {
        grossWorkMinutes += validElapsed;
      }
    }

    // 3. Update state for the NEXT interval
    switch (event.type) {
      case 'punch-in':
      case 'site-in':
        if (event.workType === 'field' || event.workType === 'site' || event.type === 'site-in') {
          isAtSite = true;
        } else {
          isMainPunchedIn = true;
        }
        break;
      case 'punch-out':
      case 'site-out':
        if (isOnBreak && activeBreakStart) {
          const duration = differenceInMinutes(eventTime, new Date(activeBreakStart)) / 60;
          breakIntervals.push({ start: activeBreakStart, end: event.timestamp, duration });
          activeBreakStart = null;
        }
        if (event.workType === 'field' || event.workType === 'site' || event.type === 'site-out') {
          isAtSite = false;
          isOnBreak = false; // Primary logout closes all active sub-sessions
        } else {
          isMainPunchedIn = false;
          isAtSite = false;
          isOnBreak = false;
        }
        break;
      case 'site-ot-in':
        isAtSite = true;
        break;
      case 'site-ot-out':
        if (isOnBreak && activeBreakStart) {
          const duration = differenceInMinutes(eventTime, new Date(activeBreakStart)) / 60;
          breakIntervals.push({ start: activeBreakStart, end: event.timestamp, duration });
          activeBreakStart = null;
        }
        isAtSite = false;
        isOnBreak = false;
        break;
      case 'break-in':
        isOnBreak = true;
        activeBreakStart = event.timestamp;
        if (!firstBreakIn) firstBreakIn = event.timestamp;
        lastBreakIn = event.timestamp;
        lastBreakOut = null;
        break;
      case 'break-out':
        if (isOnBreak && activeBreakStart) {
          const duration = differenceInMinutes(eventTime, new Date(activeBreakStart)) / 60;
          breakIntervals.push({ start: activeBreakStart, end: event.timestamp, duration });
        }
        isOnBreak = false;
        activeBreakStart = null;
        lastBreakOut = event.timestamp;
        break;
    }
    
    lastEventTime = eventTime;
  });

  // 4. Handle ongoing session (from last event to 'now')
  const now = new Date();
  
  // A session is "Active" if it's today's calendar day 
  // OR if it's an open session from yesterday (Night Shift).
  const isCalendarToday = !processingDate || isSameDay(now, processingDate);
  const isOpenNightShift = processingDate && 
                           isSameDay(subDays(now, 1), processingDate) && 
                           (isMainPunchedIn || isAtSite);
                           
  const isLiveAccumulationRequired = isCalendarToday || isOpenNightShift;

  const MAX_SESSION_HOURS = 30;
  const MAX_SESSION_MINUTES = MAX_SESSION_HOURS * 60;
  
  if (lastEventTime && isLiveAccumulationRequired) {
    const elapsed = differenceInMinutes(now, lastEventTime);
    let validElapsed = elapsed;
    if (elapsed > MAX_SESSION_MINUTES) {
      validElapsed = 0; // If they missed a punch, don't accumulate indefinitely into 'now'
    }

    const isCurrentlyPunchedIn = isMainPunchedIn || isAtSite;
    
    if (isCurrentlyPunchedIn && !isOnBreak) {
      netWorkMinutes += validElapsed;
    }
    if (isOnBreak) {
      totalBreakMinutes += validElapsed;
      if (activeBreakStart) {
        const duration = differenceInMinutes(now, new Date(activeBreakStart)) / 60;
        breakIntervals.push({ start: activeBreakStart, end: null, duration });
      }
    }
    if (isCurrentlyPunchedIn) {
      grossWorkMinutes += validElapsed;
    }
  }

  return { 
    totalHours: grossWorkMinutes / 60, 
    breakHours: totalBreakMinutes / 60, 
    workingHours: netWorkMinutes / 60,
    firstBreakIn,
    lastBreakIn,
    lastBreakOut,
    breakIntervals
  };
}


/**
 * Calculate loss of pay hours
 * @param workingHours Actual hours worked (excluding breaks)
 * @param requiredHours Required daily hours (e.g., 8)
 * @returns Hours of loss of pay (0 if no shortfall)
 */
export function calculateLossOfPay(workingHours: number, requiredHours: number): number {
  const shortfall = requiredHours - workingHours;
  return Math.max(0, shortfall);
}

/**
 * Calculate monthly target and shortfall based on working days
 * @param totalHours Actual hours worked in month
 * @param workingDays Number of days employee checked in
 * @param requiredHoursPerDay Required hours per day (default 8)
 * @returns Object with target hours, actual hours, hoursShort, and daysAbsent
 */
export function calculateMonthlyShortfall(
  totalHours: number,
  workingDays: number,
  requiredHoursPerDay: number = 8
): { targetHours: number; totalHours: number; hoursShort: number; daysAbsent: number } {
  // Monthly target is auto-calculated: working days × required hours per day
  const targetHours = workingDays * requiredHoursPerDay;
  const hoursShort = Math.max(0, targetHours - totalHours);
  const daysAbsent = Math.floor(hoursShort / requiredHoursPerDay);
  
  return { targetHours, totalHours, hoursShort, daysAbsent };
}

/**
 * Check if check-in is late
 * @param checkInTime Actual check-in time (HH:mm format or ISO string)
 * @param configuredStartTime Configured start time (HH:mm format)
 * @returns Object with isLate flag and minutesLate
 */
export function isLateCheckIn(
  checkInTime: string,
  configuredStartTime: string
): { isLate: boolean; minutesLate: number } {
  // Extract time portion if ISO string
  const checkInTimeOnly = checkInTime.includes('T') 
    ? checkInTime.split('T')[1].substring(0, 5) 
    : checkInTime;
  
  const [checkInHour, checkInMin] = checkInTimeOnly.split(':').map(Number);
  const [configHour, configMin] = configuredStartTime.split(':').map(Number);
  
  const checkInMinutes = checkInHour * 60 + checkInMin;
  const configMinutes = configHour * 60 + configMin;
  
  const minutesLate = Math.max(0, checkInMinutes - configMinutes);
  
  return {
    isLate: minutesLate > 0,
    minutesLate,
  };
}

/**
 * Check if check-out is early
 * @param checkOutTime Actual check-out time (HH:mm format or ISO string)
 * @param configuredEndTime Configured end time (HH:mm format)
 * @returns Object with isEarly flag and minutesEarly
 */
export function isEarlyCheckOut(
  checkOutTime: string,
  configuredEndTime: string
): { isEarly: boolean; minutesEarly: number } {
  const checkOutTimeOnly = checkOutTime.includes('T')
    ? checkOutTime.split('T')[1].substring(0, 5)
    : checkOutTime;
  
  const [checkOutHour, checkOutMin] = checkOutTimeOnly.split(':').map(Number);
  const [configHour, configMin] = configuredEndTime.split(':').map(Number);
  
  const checkOutMinutes = checkOutHour * 60 + checkOutMin;
  const configMinutes = configHour * 60 + configMin;
  
  const minutesEarly = Math.max(0, configMinutes - checkOutMinutes);
  
  return {
    isEarly: minutesEarly > 0,
    minutesEarly,
  };
}

/**
 * Calculate attendance status based on hours worked
 * @param workingHours Actual hours worked (excluding breaks)
 * @param minHoursFullDay Minimum hours for full day (e.g., 8)
 * @param minHoursHalfDay Minimum hours for half day (e.g., 4)
 * @returns DailyAttendanceStatus
 */
export function calculateHoursBasedStatus(
  workingHours: number,
  minHoursFullDay: number,
  minHoursHalfDay: number
): DailyAttendanceStatus {
  // User Rule: 8hrs above means P. Below 8hrs (and anything above 0) means 1/2p.
  if (workingHours >= minHoursFullDay) {
    return 'Present';
  } else if (workingHours > 0) {
    return 'Half Day';
  } else {
    return 'Absent';
  }
}

/**
 * Process daily attendance events to calculate hours
 * @param events All attendance events for a day
 * @returns Summary of the day's attendance
 */
export function processDailyEvents(events: AttendanceEvent[], processingDate?: Date): {
  checkIn: string | null;
  checkOut: string | null;
  firstBreakIn: string | null;
  lastBreakIn: string | null;
  breakOut: string | null;
  totalHours: number;
  breakHours: number;
  workingHours: number;
  dailyPunchCount: number;
  breakIntervals: { start: string; end: string | null; duration: number }[];
} {
  if (events.length === 0) {
    return {
      checkIn: null,
      checkOut: null,
      firstBreakIn: null,
      lastBreakIn: null,
      breakOut: null,
      totalHours: 0,
      breakHours: 0,
      workingHours: 0,
      dailyPunchCount: 0,
      breakIntervals: [],
    };
  }

  // Sort events chronologically
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  // Discard events prior to target day if they belong to a past date and are not part of an ongoing night shift.
  const targetDate = processingDate || new Date();
  const startOfTargetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);

  let cutoffIndex = -1;
  let lastPunchInTime: Date | null = null;

  for (let i = 0; i < sortedEvents.length; i++) {
     const e = sortedEvents[i];
     const eventTime = new Date(e.timestamp);
     
     if (e.type === 'punch-in' || e.type === 'site-ot-in' || e.type === 'site-in') {
         lastPunchInTime = eventTime;
     } else if (e.type === 'punch-out' || e.type === 'site-ot-out' || e.type === 'site-out') {
         if ((lastPunchInTime && lastPunchInTime < startOfTargetDay) || (!lastPunchInTime && eventTime < startOfTargetDay)) {
             cutoffIndex = i;
         }
     }
  }
  
  let relevantEvents = cutoffIndex >= 0 ? sortedEvents.slice(cutoffIndex + 1) : sortedEvents;

  // If all remaining events in relevantEvents started before today (i.e., yesterday's session),
  // they should only be treated as relevant if the shift is still active. If it's a past unclosed session,
  // do NOT calculate yesterday's timestamps as today's checkIn/break times!
  const hasTodayEvent = relevantEvents.some(e => new Date(e.timestamp) >= startOfTargetDay);
  if (!hasTodayEvent) {
    relevantEvents = [];
  }

  const firstCheckIn = relevantEvents.find(e => e.type === 'punch-in' || e.type === 'site-in' || e.type === 'site-ot-in');
  const lastCheckOut = [...relevantEvents].reverse().find(e => e.type === 'punch-out' || e.type === 'site-out' || e.type === 'site-ot-out');
  
  const result = calculateWorkingHours(relevantEvents, processingDate);
  
  const endOfTargetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
  const dailyPunchCount = relevantEvents.filter(e => {
    const eventTime = new Date(e.timestamp);
    return eventTime >= startOfTargetDay && eventTime <= endOfTargetDay && e.type === 'punch-in' && (!e.workType || e.workType === 'office');
  }).length;

  return {
    checkIn: firstCheckIn?.timestamp || null,
    checkOut: lastCheckOut?.timestamp || null,
    firstBreakIn: result.firstBreakIn,
    lastBreakIn: result.lastBreakIn,
    breakOut: result.lastBreakOut,
    totalHours: result.totalHours,
    breakHours: result.breakHours,
    workingHours: result.workingHours,
    dailyPunchCount,
    breakIntervals: result.breakIntervals,
  };
}


/**
 * Determine the staff category based on user's role and assigned site
 * utilizing the configurable missedCheckoutConfig.roleMapping
 */
export function getStaffCategory(
  roleId: string,
  societyId?: string | null,
  settings?: any
): 'office' | 'field' | 'site' {
  // PRIMARY: Use saved roleMapping from Admin UI → Attendance Rules → Staff Selections
  // FALLBACK: Use hardcoded defaults only if settings haven't loaded yet
  const rawMapping = settings?.missedCheckoutConfig?.roleMapping || settings?.missed_checkout_config?.role_mapping || settings?.missedCheckoutConfig?.role_mapping || settings?.missed_checkout_config?.roleMapping || settings?.roleMapping || settings?.role_mapping;
  const mapping = {
    office: rawMapping?.office || ['admin', 'hr', 'finance', 'developer', 'hr_ops', 'management', 'back_office_staff', 'accountant'],
    field: rawMapping?.field || ['field_staff', 'field_officer', 'technical_reliever', 'supervisor', 'site_supervisor', 'operation_manager', 'operations_manager', 'bd', 'business_developer'],
    site: rawMapping?.site || ['site_manager', 'security_guard']
  };

  const roleLower = String(roleId || '').toLowerCase();

  // 1. Explicit mappings from settings ALWAYS take absolute priority
  const explicitOffice = mapping.office?.some((r: string) => r.toLowerCase() === roleLower);
  const explicitField = mapping.field?.some((r: string) => r.toLowerCase() === roleLower);
  const explicitSite = mapping.site?.some((r: string) => r.toLowerCase() === roleLower);

  if (explicitOffice) return 'office';
  if (explicitField) return 'field';
  if (explicitSite) return 'site';

  // 2. Default/Fallback hardcoded rules
  const isOfficeDefault = ['admin', 'hr', 'finance', 'developer', 'hr_ops', 'management', 'super_admin', 'iot_architect'].includes(roleLower) ||
                          roleLower.includes('admin') || roleLower.includes('management');
  if (isOfficeDefault) return 'office';

  const isFieldDefault = isTechnicalRole(roleId) ||
                         ['field_staff', 'field_officer', 'technical_reliever', 'operations_manager'].includes(roleLower);
  if (isFieldDefault) return 'field';

  const isSiteDefault = ['site_manager', 'security_guard', 'supervisor'].includes(roleLower);
  if (isSiteDefault) return 'site';
  
  // 3. Fallback based on Site Assignment (societyId)
  if (societyId && !societyId.endsWith('_head_office')) {
    return 'site';
  }

  return 'office';
}


/**
 * Evaluate attendance status for a specific day based on rules and events.
 * Uniformly applies the 3-day presence threshold to all holiday types (H, F/H, W/O).
 */
/**
 * Checks if a user's location is Bangalore (handles common spellings/aliases).
 * BL (Blue Leave) and PL (Pink Leave) are Bangalore-specific benefits for
 * office and field staff only.
 */
export function isBangaloreLocation(location?: string): boolean {
  if (!location) return false;
  const loc = location.trim().toLowerCase();
  return /\b(bangalore|bengaluru|blr|bgl)\b/.test(loc) || loc.includes('bangalore') || loc.includes('bengaluru');
}

export function evaluateAttendanceStatus(params: {
  day: Date;
  userId: string;
  userCategory: 'office' | 'field' | 'site';
  userRole?: string;
  userRules: any;
  dayEvents: AttendanceEvent[];
  officeHolidays: any[];
  fieldHolidays: any[];
  siteHolidays: any[];
  recurringHolidays: any[];
  userHolidaysPool: any[];
  leaves: any[];
  daysPresentInWeek: number;
  isActiveInPreviousWeek: boolean;
  workingHours?: number;
  fieldStatus?: string;
  floatingHolidayMonths?: number[];
  userGender?: string;
  /** User's work location (city/branch). BL and PL apply only to Bangalore field/office staff. */
  userLocation?: string;
  resolvedShift?: any;
}) {
  const { 
    day, userId, userCategory, userRole, userRules, dayEvents, 
    officeHolidays, fieldHolidays, siteHolidays, 
    recurringHolidays, userHolidaysPool, leaves, 
    daysPresentInWeek,
    isActiveInPreviousWeek,
    workingHours,
    fieldStatus,
    floatingHolidayMonths,
    userGender,
    userLocation,
    resolvedShift
  } = params;

  // ── LOCATION-BASED RULE ENGINE ─────────────────────────────────────────────
  // BL (Blue Leave) and PL (Pink Leave) are Bangalore-specific recurring holidays
  // now applicable to all Bangalore staff, including technical relievers/site staff.
  const isBangaloreStaff = isBangaloreLocation(userLocation);
  // ──────────────────────────────────────────────────────────────────────────

  const dateStr = format(day, 'yyyy-MM-dd');
  const dayName = format(day, 'EEEE');
  const dayOfMonth = day.getDate();
  const dayOfWeek = day.getDay();
  const threshold = (userRules as any)?.weekendPresentThreshold ?? 3;

  // 1. Initial State
  let status: string = 'A';
  let isHoliday = false;

  let isRecurringHoliday = false;
  let recurringHolidayType: 'BL' | 'PL' | 'W/O' = 'W/O'; // BL = Blue Leave (males), PL = Pink Leave (females)
  let isWeekend = false;

  // 2. Resolve Holiday Statuses
  const weeklyOffDays = userRules?.weeklyOffDays || [0]; // Default Sunday
  isWeekend = weeklyOffDays.includes(dayOfWeek);

  // Floating/Recurring Holiday — also track whether it is a Blue Leave or Pink Leave
  let matchedRecurringRule: any = null;
  isRecurringHoliday = (recurringHolidays || []).some(rule => {
      const ruleDay = String(rule.day || '').toLowerCase();
      if (!rule || ruleDay !== dayName.toLowerCase()) return false;
      const occurrence = Math.ceil(dayOfMonth / 7);
      const ruleOccurrence = Number(rule.occurrence || rule.n || 0);
      const ruleType = rule.roleType || rule.type || 'office';

      // 3rd Saturday Blue Leave applies to gents/male employees (defaulting empty/null gender to gents/male as well)
      if (ruleDay === 'saturday' && ruleOccurrence === 3) {
          if (!isBangaloreStaff) return false;
          if ((userRole || '').toLowerCase() !== 'admin') {
              const gender = (params as any).userGender || '';
              const isFemale = ['female', 'ladies'].includes(gender.toLowerCase());
              if (isFemale) return false;
          }
      }
      // PRIORITY 1: If floatingHolidayMonths array is configured, it is the SOLE gate.
      if (floatingHolidayMonths && floatingHolidayMonths.length > 0) {
          if (!floatingHolidayMonths.includes(day.getMonth())) return false;
      } else if (userRules?.floatingHolidayMonths && userRules.floatingHolidayMonths.length > 0) {
          if (!userRules.floatingHolidayMonths.includes(day.getMonth())) return false;
      } else {
          // PRIORITY 2 (fallback): No month array configured — use validFrom/validTill dates.
          if (userRules?.floatingLeavesValidFrom) {
              try {
                  const validFrom = new Date(userRules.floatingLeavesValidFrom.replace(/-/g, '/'));
                  if (day < validFrom) return false;
              } catch (e) { /* ignore invalid dates */ }
          }
          if (userRules?.floatingLeavesExpiryDate) {
              try {
                  const expiryDate = new Date(userRules.floatingLeavesExpiryDate);
                  if (isAfter(day, expiryDate)) return false;
              } catch (e) { /* ignore invalid dates */ }
          }
      }

      let categoryMatches = ruleOccurrence === occurrence && ruleType === userCategory;
      
      // Override: 3rd Saturday Blue Leave for Bangalore applies across all categories (including site staff)
      if (isBangaloreStaff && ruleDay === 'saturday' && ruleOccurrence === 3) {
          categoryMatches = ruleOccurrence === occurrence;
      }

      if (!categoryMatches) return false;

      // ROLE WHITELIST: If the rule specifies eligibleRoles, only those roles qualify.
      // An empty or absent eligibleRoles means all roles in the category are eligible.
      const eligibleRoles: string[] = rule.eligibleRoles || [];
      if (eligibleRoles.length > 0) {
          const userRoleLower = (userRole || '').toLowerCase();
          const isRoleEligible = eligibleRoles.some(r => r.toLowerCase() === userRoleLower);
          if (!isRoleEligible) return false;
      }

      matchedRecurringRule = rule;
      return true;
  });

  // Determine whether this is a Blue Leave (BL - male 3rd Saturday) or Pink Leave (PL - female)
  // LOCATION RULE: BL/PL are Bangalore-only benefits for office & field staff.
  // For non-Bangalore or site staff, recurring holidays fall back to plain W/O.
  if (isRecurringHoliday && matchedRecurringRule) {
      if (isBangaloreStaff) {
          const gender = (params as any).userGender || '';
          const isFemale = ['female', 'ladies'].includes(gender.toLowerCase());
          const ruleLabel = String(matchedRecurringRule.name || matchedRecurringRule.label || '').toLowerCase();
          if (ruleLabel.includes('pink') || isFemale) {
              recurringHolidayType = 'PL';
          } else {
              recurringHolidayType = 'BL'; // Blue Leave for Bangalore male/gents staff
          }
      } else {
          // Non-Bangalore staff: recurring holiday is just a standard weekly-off day
          recurringHolidayType = 'W/O';
      }
  }

  if (userCategory === 'site') {
    return evaluateSiteStaffStatus({
      ...params,
      isRecurringHoliday,
      recurringHolidayType
    });
  }

  // Configured Holidays (Manual additions)
  // Permissive check: Check the user's specific category list first, but fallback to ALL lists
  // to ensure global holidays (like Good Friday) are caught even if not explicitly in every list.
  const categoryHolidays = userCategory === 'field' ? fieldHolidays : officeHolidays;
  
  const hasHolidayMatch = (list: any) => {
      if (!Array.isArray(list)) return false;
      return list.some(h => {
          if (!h || !h.date) return false;
          const hDateStr = String(h.date);
          // Handle annual recurrence (e.g. "-04-03")
          if (hDateStr.startsWith('-')) {
              const compareMMDD = format(day, '-MM-dd');
              return dateStr.endsWith(hDateStr) || hDateStr.endsWith(compareMMDD);
          }
          // Handle ISO strings or YYYY-MM-DD
          return hDateStr.includes(dateStr);
      });
  };

  let isConfiguredHoliday = hasHolidayMatch(categoryHolidays) || 
                            hasHolidayMatch(officeHolidays) || 
                            hasHolidayMatch(fieldHolidays) || 
                            hasHolidayMatch(siteHolidays);

  // Fixed Holidays
  const isFixedHoliday = FIXED_HOLIDAYS.some(fh => dateStr.endsWith('-' + fh.date));

  // Pool Holidays (User-selected holidays)
  let isPoolHoliday = false;
  if (Array.isArray(userHolidaysPool)) {
      isPoolHoliday = userHolidaysPool.some(uh => {
          try {
          const uhUserId = String(uh.userId || (uh as any).user_id || '').trim().toLowerCase();
          const targetUserId = String(userId).trim().toLowerCase();
          if (uhUserId !== targetUserId) return false;

          const uhDateRaw = String(uh.holidayDate || (uh as any).holiday_date || (uh as any).date || '').trim();
          const targetDateRaw = String(dateStr).trim();
          if (!uhDateRaw || !targetDateRaw) return false;
          
          // Match if normalized numbers match (YYYYMMDD)
          const d1 = uhDateRaw.replace(/[^0-9]/g, '');
          const d2 = targetDateRaw.replace(/[^0-9]/g, '');
          
          // Match first 8 digits (YYYYMMDD)
          if (d1.length >= 8 && d2.length >= 8 && d1.substring(0, 8) === d2.substring(0, 8)) return true;
          
          // Fallback to substring check
          return uhDateRaw.includes(targetDateRaw) || targetDateRaw.includes(uhDateRaw);
      } catch (e) { return false; }
      });
  }

  isHoliday = isConfiguredHoliday || isPoolHoliday || isRecurringHoliday || isFixedHoliday;



  // 3. Resolve Leaves
  const approvedLeavesList = leaves?.filter(l => {
      const lStartDate = l.startDate || l.date || l.leave_date;
      const lEndDate = l.endDate || l.date || l.leave_date;
      if (!lStartDate || !lEndDate) return false;
      const lUserId = l.userId || l.user_id;
      if (String(lUserId) !== String(userId)) return false;
      const lStatus = String(l.status || l.leaveStatus || '').toLowerCase();
      if (!['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(lStatus)) return false;

      // Normalize dates to YYYY-MM-DD string format to avoid timezone shifts
      const normalize = (d: any) => {
          if (!d) return '';
          if (typeof d === 'string') return d.substring(0, 10);
          return format(new Date(d), 'yyyy-MM-dd');
      };

      const startDateStr = normalize(lStartDate);
      const endDateStr = normalize(lEndDate);
      return dateStr >= startDateStr && dateStr <= endDateStr;
  });

  const approvedLeave = approvedLeavesList && approvedLeavesList.length > 0 ? approvedLeavesList[0] : undefined;
  
  const approvedPermission = approvedLeavesList?.find(l => String(l.leaveType || '').toLowerCase().includes('permission'));
  const approvedCorrection = approvedLeavesList?.find(l => String(l.leaveType || (l as any).type || '').toLowerCase().includes('correction') || String(l.status || (l as any).leaveStatus || '').toLowerCase() === 'correction_made');
  
  // Find a main leave that is not permission/correction (e.g. 0.5EL, SL, etc.)
  const approvedMainLeave = approvedLeavesList?.find(l => {
      const lType = String(l.leaveType || '').toLowerCase();
      return !lType.includes('permission') && !lType.includes('correction') && String(l.status || '').toLowerCase() !== 'correction_made';
  });

  // Helper to determine leave code (EL, SL, etc.)
  const getLeaveCode = (l: any) => {
      const isHalf = l.dayOption === 'half' || (l as any).day_option === 'half';
      const prefix = isHalf ? '0.5' : '';
      const lType = String(l.leaveType || l.type || '').toLowerCase();
      
      // Handle Correction Status mapping
      if (lType.includes('correction')) {
          const lStatus = String(l.status || l.leaveStatus || '').toLowerCase();
          const isPending = ['pending_manager_approval', 'pending_hr_confirmation', 'pending_admin_correction'].includes(lStatus);
          
          const cStatus = l.correctionStatus || (l.correctionDetails?.status) || '';
          if (cStatus === 'W/H') return 'WH';
          
          if (isPending) return 'RC';
          
          if (isHalf) {
              const parseLeaveTypeFromReason = (reason: string): string | null => {
                if (!reason) return null;
                const text = reason.toLowerCase();
                if (text.includes('e/l') || text.includes('el') || text.includes('earned')) return 'EL';
                if (text.includes('s/l') || text.includes('sl') || text.includes('sick')) return 'SL';
                if (text.includes('c/l') || text.includes('cl') || text.includes('casual')) return 'CL';
                if (text.includes('c/o') || text.includes('co') || text.includes('comp')) return 'CO';
                if (text.includes('lop') || text.includes('loss')) return 'LOP';
                return null;
              };
              const parsedLeave = parseLeaveTypeFromReason(l.reason);
              return parsedLeave ? `0.5P+0.5${parsedLeave}` : '0.5P';
          }
          return 'P';
      }

      if (lType.includes('work from home') || lType === 'wfh' || lType === 'w/h') return 'WH';
      if (lType.includes('sick') || lType === 's/l' || lType === 'sl') return prefix + 'SL';
      if (lType.includes('comp' ) || lType === 'c/o' || lType === 'co') return prefix + 'CO';
      if (lType.includes('casual') || lType === 'c/l' || lType === 'cl') return prefix + 'CL';
      if (lType.includes('floating') || lType === 'f/h' || lType === 'fh') return prefix + 'FH';
      if (lType.includes('maternity')) return prefix + 'ML';
      if (lType.includes('child care')) return prefix + 'CCL';
      if (lType.includes('pink')) return prefix + 'PL'; // Pink Leave
      if (lType.includes('blue leave work')) return prefix + 'BLW'; // Blue Leave Work
      if (lType.includes('permission')) return prefix + 'RP'; // Updated from 'P/M' to 'RP'
      if (lType.includes('loss') || lType.includes('lop')) return prefix + 'LOP';
      return prefix + 'EL';
  };

  // 4. Status Determination logic
  const isApprovedPermission = !!approvedPermission;
  const isApprovedCorrection = !!approvedCorrection;
  let effectiveWorkingHours = workingHours || 0;

  const permDetails = approvedPermission?.correctionDetails || (approvedPermission as any)?.correction_details;
  if (isApprovedPermission && permDetails) {
      const getMinutes = (timeStr: string) => {
          if (!timeStr) return 0;
          const [h, m] = timeStr.split(':').map(Number);
          return h * 60 + m;
      };
      const punchInVal = permDetails.punchIn || permDetails.punch_in;
      const punchOutVal = permDetails.punchOut || permDetails.punch_out;
      const punchIn2Val = permDetails.punchIn2 || permDetails.punch_in2;
      const punchOut2Val = permDetails.punchOut2 || permDetails.punch_out2;
      const includeBreakVal = permDetails.includeBreak !== undefined ? permDetails.includeBreak : permDetails.include_break;
      const breakInVal = permDetails.breakIn || permDetails.break_in;
      const breakOutVal = permDetails.breakOut || permDetails.break_out;

      const inMins = getMinutes(punchInVal);
      const outMins = getMinutes(punchOutVal);
      let diffMins = outMins - inMins;
      if (diffMins < 0) diffMins += 24 * 60; // wrap around
      
      if (punchIn2Val && punchOut2Val) {
          const inMins2 = getMinutes(punchIn2Val);
          const outMins2 = getMinutes(punchOut2Val);
          let diffMins2 = outMins2 - inMins2;
          if (diffMins2 < 0) diffMins2 += 24 * 60;
          diffMins += diffMins2;
      }

      if (includeBreakVal && breakInVal && breakOutVal) {
          const bIn = getMinutes(breakInVal);
          const bOut = getMinutes(breakOutVal);
          let bDiff = bOut - bIn;
          if (bDiff < 0) bDiff += 24 * 60;
          diffMins -= bDiff;
      }
      // For Permission, add the permission duration to effective hours
      effectiveWorkingHours = Math.max(0, (workingHours || 0) + (diffMins / 60));
  }
  
  const corrDetails = approvedCorrection?.correctionDetails || (approvedCorrection as any)?.correction_details;
  if (isApprovedCorrection && corrDetails) {
      const getMinutes = (timeStr: string) => {
          if (!timeStr) return 0;
          const [h, m] = timeStr.split(':').map(Number);
          return h * 60 + m;
      };
      const punchInVal = corrDetails.punchIn || corrDetails.punch_in;
      const punchOutVal = corrDetails.punchOut || corrDetails.punch_out;
      const punchIn2Val = corrDetails.punchIn2 || corrDetails.punch_in2;
      const punchOut2Val = corrDetails.punchOut2 || corrDetails.punch_out2;
      const includeBreakVal = corrDetails.includeBreak !== undefined ? corrDetails.includeBreak : corrDetails.include_break;
      const breakInVal = corrDetails.breakIn || corrDetails.break_in;
      const breakOutVal = corrDetails.breakOut || corrDetails.break_out;

      const inMins = getMinutes(punchInVal);
      const outMins = getMinutes(punchOutVal);
      let diffMins = outMins - inMins;
      if (diffMins < 0) diffMins += 24 * 60; // wrap around
      
      if (punchIn2Val && punchOut2Val) {
          const inMins2 = getMinutes(punchIn2Val);
          const outMins2 = getMinutes(punchOut2Val);
          let diffMins2 = outMins2 - inMins2;
          if (diffMins2 < 0) diffMins2 += 24 * 60;
          diffMins += diffMins2;
      }

      if (includeBreakVal && breakInVal && breakOutVal) {
          const bIn = getMinutes(breakInVal);
          const bOut = getMinutes(breakOutVal);
          let bDiff = bOut - bIn;
          if (bDiff < 0) bDiff += 24 * 60;
          diffMins -= bDiff;
      }
      effectiveWorkingHours = Math.max(0, diffMins / 60);
  }

  const isToday = isSameDay(day, new Date());
  const hasPunchIn = dayEvents.some(e => e.type === 'punch-in');
  const hasPunchOut = dayEvents.some(e => e.type === 'punch-out');
  const hasActivity = hasPunchIn || dayEvents.length > 0;

  const meetsThreshold = daysPresentInWeek >= threshold;
  // Weekend Off (Sunday) is earned by activity in the Mon-Sat period of the current week.
  // Holidays and Leaves are earned by activity in the previous Monday-Sunday week.
  const isEligible = isWeekend ? meetsThreshold : isActiveInPreviousWeek;

  // A. Determine Base Work Status based on Hours/Field Logic
  // All thresholds are now configurable from Admin UI → Attendance Rules → Calculation Rules
  const graceHours = (userRules?.gracePeriodMinutes ?? 15) / 60;
  let full = userRules?.minimumHoursFullDay || userRules?.dailyWorkingHours?.min || 8;
  const threeQuarterHrs = userRules?.threeQuarterDayHours ?? (full * 0.75);
  full = Math.max(0, full - graceHours);
  const halfDayHrs = userRules?.minimumHoursHalfDay ?? 4;
  const quarterDayHrs = userRules?.quarterDayHours ?? 2;
  const hoursBasedFallback = userRules?.enableHoursBasedFallback !== false; // default true

  const resolveHoursStatus = (hrs: number): string => {
      if (hrs >= full) return 'P';
      if (hrs <= 0) return 'A';
      const baseHrs = userRules?.minimumHoursFullDay || userRules?.dailyWorkingHours?.min || 8;
      const computed = hrs / baseHrs;
      let rounded = Math.round(computed * 100) / 100;
      if (rounded >= 1.0) rounded = 0.99;
      if (hrs > 0 && rounded === 0) rounded = 0.01;
      return `${rounded}P`;
  };

  let workStatus = '';
  if (hasActivity || (effectiveWorkingHours !== undefined && effectiveWorkingHours > 0)) {
      if (userCategory === 'office') {
          workStatus = resolveHoursStatus(effectiveWorkingHours || 0);
      } else {
          // Field/Site: trust real presence statuses from site tracking.
          // If site tracking returns 'A' but employee has real hours AND
          // hours-based fallback is enabled, evaluate on hours instead.
          if (fieldStatus && fieldStatus !== 'A') {
              workStatus = fieldStatus;
          } else if (hoursBasedFallback && effectiveWorkingHours !== undefined && effectiveWorkingHours > 0) {
              workStatus = resolveHoursStatus(effectiveWorkingHours);
          } else {
              workStatus = hasPunchIn && (hasPunchOut || isToday || isWeekend || isHoliday) ? 'P' : 'A';
          }
      }
  }

  if (isApprovedPermission) {
      const pCode = getLeaveCode(approvedPermission);
      const leaveCode = approvedMainLeave ? getLeaveCode(approvedMainLeave) : '';
      const leave_fraction = approvedMainLeave ? (leaveCode.startsWith('0.5') ? 0.5 : 1) : 0;
      const baseHrs = userRules?.minimumHoursFullDay || userRules?.dailyWorkingHours?.min || 8;
      
      // Calculate permission hours from approvedPermission
      let permHours = 0;
      const permDetails = approvedPermission?.correctionDetails || (approvedPermission as any)?.correction_details;
      if (permDetails) {
          const getMinutes = (timeStr: string) => {
              if (!timeStr) return 0;
              const [h, m] = timeStr.split(':').map(Number);
              return h * 60 + m;
          };
          const punchInVal = permDetails.punchIn || permDetails.punch_in;
          const punchOutVal = permDetails.punchOut || permDetails.punch_out;
          const includeBreakVal = permDetails.includeBreak !== undefined ? permDetails.includeBreak : permDetails.include_break;
          const breakInVal = permDetails.breakIn || permDetails.break_in;
          const breakOutVal = permDetails.breakOut || permDetails.break_out;

          const inMins = getMinutes(punchInVal);
          const outMins = getMinutes(punchOutVal);
          let diffMins = outMins - inMins;
          if (diffMins < 0) diffMins += 24 * 60; // wrap around
          
          if (includeBreakVal && breakInVal && breakOutVal) {
              const bIn = getMinutes(breakInVal);
              const bOut = getMinutes(breakOutVal);
              let bDiff = bOut - bIn;
              if (bDiff < 0) bDiff += 24 * 60;
              diffMins -= bDiff;
          }
          permHours = diffMins / 60;
      }

      const total_effective = (workingHours || 0) + permHours + (leave_fraction * baseHrs);

      if (total_effective >= full) {
          const rem_fraction = 1.0 - leave_fraction;
          if (rem_fraction > 0 && workingHours && workingHours > 0) {
              // Round worked fraction to nearest 0.05
              let worked_fraction = Math.round(((workingHours || 0) / baseHrs) * 20) / 20;
              worked_fraction = Math.min(rem_fraction, worked_fraction);
              const permission_fraction = Math.round((rem_fraction - worked_fraction) * 100) / 100;
              
              if (worked_fraction > 0 && permission_fraction > 0) {
                  return `${worked_fraction}P+${permission_fraction}RP${approvedMainLeave ? `+${leaveCode}` : ''}`;
              }
          }
          
          if (approvedMainLeave) {
              return `${pCode}+${leaveCode}`;
          }
          if (isConfiguredHoliday || isPoolHoliday || isFixedHoliday) return 'H/P';
          if (isWeekend || isRecurringHoliday) {
              if (isRecurringHoliday) {
                  return recurringHolidayType === 'BL' ? 'BL/P' : (recurringHolidayType === 'PL' ? 'PL/P' : 'W/P');
              }
              return 'W/P';
          }
          return 'P';
      } else {
          if (approvedMainLeave) {
              return `${pCode}+${leaveCode}`;
          }
          if (workStatus && workStatus !== 'A' && workStatus !== 'P') {
              return `${pCode}+${workStatus}`;
          }
          return pCode;
      }
  }

  if (isApprovedCorrection) {
      const isHalf = approvedCorrection.dayOption === 'half' || (approvedCorrection as any).day_option === 'half';
      if (isHalf) {
          return getLeaveCode(approvedCorrection);
      }

      if (effectiveWorkingHours >= full) {
          if (isConfiguredHoliday || isPoolHoliday || isFixedHoliday) return 'H/P';
          if (isWeekend || isRecurringHoliday) {
              if (isRecurringHoliday) {
                  return recurringHolidayType === 'BL' ? 'BL/P' : (recurringHolidayType === 'PL' ? 'PL/P' : 'W/P');
              }
              return 'W/P';
          }
          return 'P';
      } else {
          return getLeaveCode(approvedCorrection);
      }
  }

  const targetLeave = approvedMainLeave || approvedLeave;

  const isCorrection = targetLeave && (
      String(targetLeave.leaveType || (targetLeave as any).type || '').toLowerCase().includes('correction') ||
      String(targetLeave.status || (targetLeave as any).leaveStatus || '').toLowerCase() === 'correction_made'
  );

  const isFullDayLeave = targetLeave && targetLeave.dayOption !== 'half' && (targetLeave as any).day_option !== 'half';
  const isCorrectionOrPermission = targetLeave && (
      String(targetLeave.leaveType || '').toLowerCase().includes('correction') ||
      String(targetLeave.leaveType || '').toLowerCase().includes('permission') ||
      String(targetLeave.leaveType || '').toLowerCase().includes('blue leave work') ||
      String(targetLeave.status || '').toLowerCase() === 'correction_made'
  );

  // B. Handle Combinations or pure status
  if (targetLeave && isFullDayLeave && !isCorrectionOrPermission) {
      status = getLeaveCode(targetLeave);
  } else if (workStatus && workStatus !== 'A') {
      const lType = String(targetLeave?.leaveType || (targetLeave as any)?.type || '').toLowerCase();
      const isWFH = lType.includes('work from home') || lType === 'wfh' || lType === 'w/h';

      if (isCorrection) {
          const code = getLeaveCode(targetLeave);
          if (code === 'P' || code === 'Present') {
              if (isWFH) status = 'WH';
              else if (isConfiguredHoliday || isPoolHoliday || isFixedHoliday) status = 'H/P';
              else if (isWeekend || isRecurringHoliday) {
                  status = isRecurringHoliday ? (recurringHolidayType === 'BL' ? 'BL/P' : (recurringHolidayType === 'PL' ? 'PL/P' : 'W/P')) : 'W/P';
              }
              else status = 'P';
          } else {
              status = code;
          }
      } else {
          // If work is partial and there's a 1/2 day leave, combine them
          const isPartialWork = workStatus !== 'P';
          const isHalfDayLeave = targetLeave && (targetLeave.dayOption === 'half' || (targetLeave as any).day_option === 'half');
          
          if (isPartialWork && isHalfDayLeave) {
              const code = getLeaveCode(targetLeave).replace('1/2', '').replace('0.5', ''); 
              if (workStatus === 'A') {
                  status = `0.5 ${code}`;
              } else {
                  status = `0.5P+0.5 ${code}`;
              }
          } else {
              if (isWFH) status = 'WH';
              else if (isConfiguredHoliday || isPoolHoliday || isFixedHoliday) status = 'H/P';
              else if (isWeekend || isRecurringHoliday) {
                  status = isRecurringHoliday ? (recurringHolidayType === 'BL' ? 'BL/P' : (recurringHolidayType === 'PL' ? 'PL/P' : 'W/P')) : 'W/P';
              }
              else status = workStatus;
          }
      }
  } else if (targetLeave) {
      status = getLeaveCode(targetLeave);
  } else {
      if (isConfiguredHoliday || isPoolHoliday || isFixedHoliday) {
          status = 'H';
      } else if ((isWeekend || isRecurringHoliday) && isEligible) {
          status = isRecurringHoliday ? recurringHolidayType : 'W/O';
      } else {
          status = 'A';
      }
  }



  return status;
}

/**
 * Calculate the total travel distance in kilometers for a given set of daily events.
 * It first sums the `travelDistance` database field if present, and falls back to dynamic geodetic calculation.
 */
export function calculateDailyTravelKm(events: AttendanceEvent[]): number {
  if (!events || events.length === 0) return 0;

  // 1. Sum up saved travelDistance fields if available and positive
  let savedDistance = 0;
  let hasNonZeroSavedDistance = false;
  events.forEach(e => {
    if (e.travelDistance !== undefined && e.travelDistance !== null && e.travelDistance > 0) {
      savedDistance += e.travelDistance;
      hasNonZeroSavedDistance = true;
    }
  });

  if (hasNonZeroSavedDistance) {
    return Number(savedDistance.toFixed(2));
  }

  // 2. Fallback: calculate travel dynamically from consecutive punch coordinates (both within and between sites)
  const sorted = [...events]
      .filter(e => e.type === 'punch-in' || e.type === 'punch-out')
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  let totalDist = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (current.latitude && current.longitude && next.latitude && next.longitude) {
          const dist = calculateDistanceMeters(
              current.latitude,
              current.longitude,
              next.latitude,
              next.longitude
          ) / 1000;
          totalDist += dist;
      }
  }

  return Number(totalDist.toFixed(2));
}

/**
 * Calculate both travel distance (KM) and travel duration (minutes) for a daily path
 * by merging attendance events and telemetry route points, sorting chronologically,
 * and deduplicating coordinates within a 5-meter threshold (except events).
 * 
 * Returns: { distance: number (in KM), duration: number (in minutes) }
 */
export function calculateDailyPathTravelKm(
  events: AttendanceEvent[],
  routePoints: RoutePoint[]
): { distance: number; duration: number; vehicleDistance?: number } {
  // If telemetry routePoints is empty, fallback to the standard site-to-site check-in/out travel calculation
  if (!routePoints || routePoints.length === 0) {
    const dist = calculateDailyTravelKm(events);
    // Since we don't have telemetry, duration is not accurately measurable between events, default to 0
    return { distance: dist, duration: 0 };
  }

  // 1. Map events that have coordinate data
  const eventCoords = events
    .filter(e => e.latitude && e.longitude)
    .map(e => ({
      latitude: Number(e.latitude),
      longitude: Number(e.longitude),
      timestamp: e.timestamp,
      isEvent: true
    }));

  // 2. Map routePoints that have coordinate data
  const routeCoords = routePoints
    .filter(p => p.latitude && p.longitude)
    .map(p => ({
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      timestamp: p.timestamp,
      isEvent: false
    }));

  // 3. Combine and sort chronologically by timestamp
  const combined = [...eventCoords, ...routeCoords].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (combined.length < 2) {
    return { distance: 0, duration: 0 };
  }

  // 4. Deduplicate points: skip consecutive coordinates within 5 meters of each other (unless they are events)
  const deduped: typeof combined = [];
  for (const pt of combined) {
    if (deduped.length === 0) {
      deduped.push(pt);
    } else {
      const prev = deduped[deduped.length - 1];
      const dist = calculateDistanceMeters(prev.latitude, prev.longitude, pt.latitude, pt.longitude);
      if (dist > 5 || pt.isEvent || prev.isEvent) {
        deduped.push(pt);
      }
    }
  }

  if (deduped.length < 2) {
    return { distance: 0, duration: 0 };
  }

  // 5. Calculate cumulative distance
  let totalDist = 0;
  let vehicleDist = 0; // Distance covered at > 12 km/h
  for (let i = 0; i < deduped.length - 1; i++) {
    const distMeters = calculateDistanceMeters(
      deduped[i].latitude, deduped[i].longitude,
      deduped[i + 1].latitude, deduped[i + 1].longitude
    );
    
    const timeDiffSecs = (new Date(deduped[i + 1].timestamp).getTime() - new Date(deduped[i].timestamp).getTime()) / 1000;
    
    totalDist += distMeters;
    
    if (timeDiffSecs > 0) {
      const speedKmh = (distMeters / timeDiffSecs) * 3.6;
      if (speedKmh > 12) {
        vehicleDist += distMeters;
      }
    }
  }

  const startTime = new Date(deduped[0].timestamp).getTime();
  const endTime = new Date(deduped[deduped.length - 1].timestamp).getTime();
  const totalDurationMs = endTime - startTime;
  const durationMins = Math.max(0, Math.floor(totalDurationMs / (1000 * 60)));

  return {
    distance: Number((totalDist / 1000).toFixed(2)),
    duration: durationMins,
    vehicleDistance: Number((vehicleDist / 1000).toFixed(2))
  };
}

export interface RangeStats {
  presentDays: number;
  halfDays: number;
  overtimeDays: number;
  compOffs: number;
  earnedLeaves: number;
  sickLeaves: number;
  casualLeaves: number;
  workFromHomeDays: number;
  absentDays: number;
  weekOffs: number;
  holidays: number;
  floatingHolidays: number;
  totalPayableDays: number;
}

export function calculateStatsForDateRange(statuses: string[], days: Date[]): RangeStats {
  let presentDays = 0;
  let halfDays = 0;
  let overtimeDays = 0;
  let compOffs = 0;
  let earnedLeaves = 0;
  let sickLeaves = 0;
  let casualLeaves = 0;
  let workFromHomeDays = 0;
  let absentDays = 0;
  let weekOffs = 0;
  let holidays = 0;
  let floatingHolidays = 0;
  let totalPayableDays = 0;

  const resolvePayableValue = (s: string): number => {
    if (s.includes('+')) return s.split('+').reduce((acc, part) => acc + resolvePayableValue(part.trim()), 0);
    if (['W/P', 'WP', 'H/P', 'HP', 'BL/P', 'BLP', 'PL/P', 'PLP'].includes(s)) return 1.5; 
    if (['P', 'W/O', 'WO', 'WOP', 'H', 'SL', 'S/L', 'EL', 'E/L', 'CL', 'C/L', 'C/O', 'CO', 'W/H', 'WH', 'BL', 'F/H', 'FH', 'PL', 'P/L', 'ML', 'M/L', 'CC', 'C/C', 'CCL'].includes(s)) return 1;
    // Handle half-day leave types explicitly (e.g. '0.5SL', '0.5WH', '0.5EL', '0.5CL')
    if (s.startsWith('0.5') && (s.includes('SL') || s.includes('S/L') || s.includes('EL') || s.includes('E/L') || s.includes('CL') || s.includes('C/L') || s.includes('WH') || s.includes('W/H') || s.includes('BL') || s.includes('PL') || s.includes('ML') || s.includes('CCL') || s.includes('CO') || s.includes('C/O'))) return 0.5;
    if (s.includes('SL') || s.includes('S/L') || s.includes('EL') || s.includes('E/L') || s.includes('CL') || s.includes('C/L') || s.includes('C/O') || s.includes('CO') || s.includes('BL') || s.includes('F/H') || s.includes('FH') || s.includes('PL') || s.includes('P/L') || s.includes('ML') || s.includes('M/L') || s.includes('CCL') || s.includes('WH') || s.includes('W/H')) {
        return s.startsWith('0.5') ? 0.5 : 1;
    }
    if (['Half Day', '0.5P', '1/2P', '2/4P'].includes(s)) return 0.5;
    if (s === '3/4P' || s === '0.75P') return 0.75;
    if (s === '1/4P' || s === '0.25P') return 0.25;
    if (s.endsWith('P') && s !== 'LOP') {
      const numericVal = parseFloat(s.slice(0, -1));
      if (!isNaN(numericVal)) return numericVal;
    }
    if (s.endsWith('RP')) {
      if (s === 'RP') return 0;
      const numericVal = parseFloat(s.slice(0, -2));
      if (!isNaN(numericVal)) return numericVal;
    }
    return 0;
  };

  days.forEach((day) => {
    const s = statuses[day.getDate() - 1] || '-';
    
    // Split complex statuses to evaluate parts
    const parts = s.includes('+') ? s.split('+').map(p => p.trim()) : [s];
    
    parts.forEach(part => {
      const isHalf = part.startsWith('0.5') || part === 'Half Day' || part === '1/2P' || part === '2/4P';
      const inc = isHalf ? 0.5 : 1;

      if (part === 'P') presentDays++;
      else if (part === 'W/P' || part === 'BL/P' || part === 'PL/P') {
          presentDays++;
          if (part === 'W/P') {
              weekOffs++;
          } else {
              floatingHolidays += inc;
          }
      }
      else if (part === '3/4P' || part === '0.75P') presentDays += 0.75;
      else if (part === 'Half Day' || part === '0.5P' || part === '1/2P' || part === '2/4P') halfDays++;
      else if (part === '1/4P' || part === '0.25P') presentDays += 0.25;
      else if (part.endsWith('P') && part !== 'LOP' && !part.includes('+') && !part.includes('/')) {
        const val = parseFloat(part.slice(0, -1));
        if (!isNaN(val)) {
          if (val === 0.5) {
            halfDays++;
          } else {
            presentDays += val;
          }
        }
      }
      else if (part === 'A') absentDays++;
      else if (part === 'W/O') weekOffs++;
      else if (part === 'BL' || part === '0.5BL' || part === 'FH' || part === '0.5FH') { floatingHolidays += inc; }
      else if (part === 'PL' || part === '0.5PL') { floatingHolidays += inc; }
      else if (part === 'WOP') { weekOffs++; }
      else if (part === 'H') holidays++;
      else if (part === 'H/P') { holidays++; presentDays++; }
      else if (part.includes('SL') || part.includes('S/L')) { sickLeaves += inc; }
      else if (part.includes('EL') || part.includes('E/L')) { earnedLeaves += inc; }
      else if (part.includes('CL') || part.includes('C/L')) { casualLeaves += inc; }
      else if (part.includes('C/O') || part.includes('CO')) { compOffs += inc; }
      else if (part.includes('BL') || part.includes('F/H') || part.includes('FH')) floatingHolidays += inc;
      else if (part.includes('PL') || part.includes('P/L')) { floatingHolidays += inc; }
      else if (part.includes('LOP')) absentDays += inc;
      // WFH counts as a paid workday AND is tracked in its own bucket
      else if (part === 'W/H' || part === 'WH' || part.includes('WFH')) { workFromHomeDays += inc; presentDays += inc; }
    });

    // Payable Days
    totalPayableDays += resolvePayableValue(s);
  });

  // Calculate Overtime Days
  days.forEach((day) => {
    const s = statuses[day.getDate() - 1] || '-';
    if (s.includes('OT')) {
      overtimeDays++;
    }
  });

  return {
    presentDays,
    halfDays,
    overtimeDays,
    compOffs,
    earnedLeaves,
    sickLeaves,
    casualLeaves,
    workFromHomeDays,
    absentDays,
    weekOffs,
    holidays,
    floatingHolidays,
    totalPayableDays: Math.min(days.length, totalPayableDays)
  };
}

// Force Vite HMR



