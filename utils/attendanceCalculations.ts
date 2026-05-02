// Attendance calculation utilities for hours-based attendance tracking

import { differenceInMinutes, parseISO, isSameDay, format, startOfDay, isAfter, subDays } from 'date-fns';
import type { AttendanceEvent, DailyAttendanceStatus } from '../types';
import { getFieldStaffStatus } from './fieldStaffTracking';
import { FIXED_HOLIDAYS } from './constants';

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
      // 16 hours is the maximum continuous valid interval between events
      const MAX_INTERVAL_MINUTES = 16 * 60;
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

  const MAX_SESSION_HOURS = 16;
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
  
  // Discard previous day's COMPLETED shifts.
  // The 16-hour lookback can pull in yesterday's completed day shift.
  // We find the last explicit punch-out that occurred before today's midnight
  // and discard all events up to and including it.
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
         // If we have a punch-out that closes a shift which started BEFORE today,
         // or if we somehow missed the punch-in (null) but it's a punch-out before today.
         if ((lastPunchInTime && lastPunchInTime < startOfTargetDay) || (!lastPunchInTime && eventTime < startOfTargetDay)) {
             cutoffIndex = i;
         }
     }
  }
  
  const relevantEvents = cutoffIndex >= 0 ? sortedEvents.slice(cutoffIndex + 1) : sortedEvents;

  const firstCheckIn = relevantEvents.find(e => e.type === 'punch-in' || e.type === 'site-ot-in');
  const lastCheckOut = [...relevantEvents].reverse().find(e => e.type === 'punch-out' || e.type === 'site-ot-out');
  
  const result = calculateWorkingHours(relevantEvents, processingDate);
  
  const dailyPunchCount = relevantEvents.filter(e => e.type === 'punch-in' && (!e.workType || e.workType === 'office')).length;

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
  const mapping = settings?.missedCheckoutConfig?.roleMapping || settings?.roleMapping || {
    office: ['admin', 'hr', 'finance', 'developer', 'hr_ops', 'management', 'back_office_staff'],
    field: ['field_staff', 'field_officer', 'technical_reliever', 'supervisor', 'site_supervisor', 'operation_manager', 'operations_manager'],
    site: ['site_manager', 'security_guard']
  };

  // RULE: Explicit role mapping ALWAYS takes priority over society-based classification.
  // This ensures Admin/HR/Management stay as office staff even if assigned to a society.
  if (mapping.office?.includes(roleId)) return 'office';
  if (mapping.field?.includes(roleId) || isTechnicalRole(roleId)) return 'field';
  if (mapping.site?.includes(roleId)) return 'site';
  
  // FALLBACK: If role not in any explicit mapping, use society-based classification
  if (societyId && !societyId.endsWith('_head_office')) return 'site';
  
  return 'office';
}


/**
 * Evaluate attendance status for a specific day based on rules and events.
 * Uniformly applies the 3-day presence threshold to all holiday types (H, F/H, W/O).
 */
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
}) {
  const { 
    day, userId, userCategory, userRole, userRules, dayEvents, 
    officeHolidays, fieldHolidays, siteHolidays, 
    recurringHolidays, userHolidaysPool, leaves, 
    daysPresentInWeek,
    isActiveInPreviousWeek,
    workingHours,
    fieldStatus
  } = params;

  const dateStr = format(day, 'yyyy-MM-dd');
  const dayName = format(day, 'EEEE');
  const dayOfWeek = day.getDay();
  const dayOfMonth = day.getDate();
  const threshold = (userRules as any)?.weekendPresentThreshold ?? 3;

  // 1. Initial State
  let status: string = 'A';
  let isHoliday = false;
  let isRecurringHoliday = false;
  let isWeekend = false;

  // 2. Resolve Holiday Statuses
  const weeklyOffDays = userRules?.weeklyOffDays || [0]; // Default Sunday
  isWeekend = weeklyOffDays.includes(dayOfWeek);

  // Floating/Recurring Holiday
  isRecurringHoliday = (recurringHolidays || []).some(rule => {
      if (!rule || rule.day.toLowerCase() !== dayName.toLowerCase()) return false;
      const occurrence = Math.ceil(dayOfMonth / 7);
      const ruleType = rule.type || 'office';
      
      // Check for floating leave expiry if defined in rules
      if (userRules?.floatingLeavesExpiryDate) {
          try {
              const expiryDate = new Date(userRules.floatingLeavesExpiryDate);
              if (isAfter(day, expiryDate)) return false;
          } catch (e) { /* ignore invalid dates */ }
      }
      
      return rule.n === occurrence && ruleType === userCategory;
  });

  // Configured Holidays (Manual additions)
  const categoryHolidays = userCategory === 'field' ? fieldHolidays : (userCategory === 'site' ? siteHolidays : officeHolidays);
  let isConfiguredHoliday = (categoryHolidays || []).some(h => {
      const hDateStr = String(h.date);
      // STRICT MATCH: Only allow annual recurrence if date starts with '-'
      if (hDateStr.startsWith('-')) {
          const compareMMDD = format(day, '-MM-dd');
          return dateStr.endsWith(hDateStr) || hDateStr.endsWith(compareMMDD);
      }
      // Otherwise must match full YYYY-MM-DD
      return hDateStr.includes(dateStr);
  });

  // Pool Holidays
  let isPoolHoliday = userHolidaysPool.some(uh => {
      try {
          const uhUserId = String(uh.userId || (uh as any).user_id || '').trim().toLowerCase();
          const targetUserId = String(userId).trim().toLowerCase();
          if (uhUserId !== targetUserId) return false;
          const uhDateRaw = String(uh.holidayDate || (uh as any).holiday_date || '').trim();
          const targetDateRaw = String(dateStr).trim();
          if (!uhDateRaw || !targetDateRaw) return false;
          
          // STRICT MATCH for pool holidays - only match exact date
          // unless it is specifically meant to be annual (starts with -)
          if (uhDateRaw.startsWith('-')) {
              const mmdd = format(day, '-MM-dd');
              return uhDateRaw.endsWith(mmdd);
          }

          // Exact year-month-day match
          const d1 = uhDateRaw.replace(/[^0-9]/g, '');
          const d2 = targetDateRaw.replace(/[^0-9]/g, '');
          if (d1.substring(0, 8) === d2.substring(0, 8)) return true;
          return false;
      } catch (e) { return false; }
  });

  // Fixed Holidays (National/Fixed dates)
  const isFixedHoliday = (FIXED_HOLIDAYS || []).some(h => {
      const compareMMDD = format(day, 'MM-dd');
      return h.date === compareMMDD;
  });

  isHoliday = isConfiguredHoliday || isPoolHoliday || isRecurringHoliday || isFixedHoliday;

  // 3. Resolve Leaves
  const approvedLeave = leaves?.find(l => {
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

  // Helper to determine leave code (EL, SL, etc.)
  const getLeaveCode = (l: any) => {
      const isHalf = l.dayOption === 'half' || (l as any).day_option === 'half';
      const prefix = isHalf ? '1/2' : '';
      const lType = String(l.leaveType || l.type || '').toLowerCase();
      
      // Handle Correction Status mapping
      if (lType.includes('correction')) {
          const cStatus = l.correctionStatus || (l.correctionDetails?.status) || '';
          if (cStatus === 'W/H') return 'WFH';
          return 'P';
      }

      if (lType.includes('work from home') || lType === 'wfh' || lType === 'w/h') return 'W/H';
      if (lType.includes('sick') || lType === 's/l' || lType === 'sl') return prefix + 'SL';
      if (lType.includes('comp' ) || lType === 'c/o' || lType === 'co') return prefix + 'CO';
      if (lType.includes('casual') || lType === 'c/l' || lType === 'cl') return prefix + 'CL';
      if (lType.includes('loss') || lType.includes('lop')) return prefix + 'LOP';
      return prefix + 'EL';
  };

  // 4. Status Determination logic
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
  const full = userRules?.minimumHoursFullDay || userRules?.dailyWorkingHours?.min || 8;
  const threeQuarterHrs = userRules?.threeQuarterDayHours ?? (full * 0.75);
  const halfDayHrs = userRules?.minimumHoursHalfDay ?? 4;
  const quarterDayHrs = userRules?.quarterDayHours ?? 2;
  const hoursBasedFallback = userRules?.enableHoursBasedFallback !== false; // default true

  const resolveHoursStatus = (hrs: number): string => {
      if (hrs >= full) return 'P';
      if (hrs >= threeQuarterHrs) return '3/4P';
      if (hrs >= halfDayHrs) return '1/2P';
      if (hrs >= quarterDayHrs) return '1/4P';
      return 'A';
  };

  let workStatus = '';
  if (hasActivity || (workingHours !== undefined && workingHours > 0)) {
      if (userCategory === 'office') {
          workStatus = resolveHoursStatus(workingHours || 0);
      } else {
          // Field/Site: trust real presence statuses from site tracking.
          // If site tracking returns 'A' but employee has real hours AND
          // hours-based fallback is enabled, evaluate on hours instead.
          if (fieldStatus && fieldStatus !== 'A') {
              workStatus = fieldStatus;
          } else if (hoursBasedFallback && workingHours !== undefined && workingHours > 0) {
              workStatus = resolveHoursStatus(workingHours);
          } else {
              workStatus = hasPunchIn && (hasPunchOut || isToday || isWeekend || isHoliday) ? 'P' : 'A';
          }
      }
  }

  const isCorrection = approvedLeave && (
      String(approvedLeave.leaveType || (approvedLeave as any).type || '').toLowerCase().includes('correction') ||
      String(approvedLeave.status || (approvedLeave as any).leaveStatus || '').toLowerCase() === 'correction_made'
  );

  // B. Handle Combinations or pure status
  if (workStatus && workStatus !== 'A') {
      const lType = String(approvedLeave?.leaveType || (approvedLeave as any)?.type || '').toLowerCase();
      const isWFH = lType.includes('work from home') || lType === 'wfh' || lType === 'w/h';

      if (isCorrection) {
          const code = getLeaveCode(approvedLeave);
          if (code === 'P' || code === 'Present') {
              if (isWFH) status = 'W/H';
              else if (isHoliday) status = 'H/P';
              else if (isWeekend) status = 'W/P';
              else status = 'P';
          } else {
              status = code;
          }
      } else {
          // If work is partial and there's a 1/2 day leave, combine them
          const isPartialWork = workStatus !== 'P';
          const isHalfDayLeave = approvedLeave && (approvedLeave.dayOption === 'half' || (approvedLeave as any).day_option === 'half');
          
          if (isPartialWork && isHalfDayLeave) {
              const code = getLeaveCode(approvedLeave).replace('1/2', ''); 
              status = `0.5P+0.5 ${code}`;
          } else {
              if (isWFH) status = 'W/H';
              // Priority 2: Explicit Holidays - credit H/P for ANY work on a holiday
              else if (isHoliday) status = 'H/P';
              // Priority 3: Weekend Work - credit W/P for ANY work on a weekend
              else if (isWeekend) status = 'W/P';
              else status = workStatus;
          }
      }
  } else if (approvedLeave) {
      const lStatus = String(approvedLeave.status || (approvedLeave as any).leaveStatus || '').toLowerCase();
      const lType = String(approvedLeave.leaveType || (approvedLeave as any).type || '').toLowerCase();
      
      // Manual corrections and Earned Comp Offs should bypass the eligibility rule
      const isCorrection = lStatus === 'correction_made' || lType.includes('correction');
      const isCompOff = lType.includes('comp') || lType === 'c/o' || lType === 'co';
      
      // Approved leaves (Earned, Sick, etc.) are generally paid regardless of the previous week's activity threshold
      // unless specifically marked as Loss of Pay.
      status = getLeaveCode(approvedLeave);
  } else {
      if (isHoliday) {
          status = (isEligible || isFixedHoliday) ? 'H' : 'A';
      } else if (isWeekend && isEligible) {
          status = 'W/O';
      } else {
          status = 'A';
      }
  }

  return status;
}

// Force Vite HMR
