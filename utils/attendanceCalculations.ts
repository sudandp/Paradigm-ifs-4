// Attendance calculation utilities for hours-based attendance tracking

import { differenceInMinutes, parseISO, isSameDay } from 'date-fns';
import type { AttendanceEvent, DailyAttendanceStatus } from '../types';

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
  events: AttendanceEvent[]
): { 
  totalHours: number; 
  breakHours: number; 
  workingHours: number; 
  firstBreakIn: string | null;
  lastBreakIn: string | null; 
  lastBreakOut: string | null 
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
  let isPunchedIn = false;
  let isOnBreak = false;
  let lastEventTime: Date | null = null;

  // 2. Process intervals between events
  sortedEvents.forEach(event => {
    const eventTime = new Date(event.timestamp);
    
    if (lastEventTime) {
      const elapsed = differenceInMinutes(eventTime, lastEventTime);
      
      // Accumulate logic based on PREVIOUS state during this interval
      if (isPunchedIn && !isOnBreak) {
        netWorkMinutes += elapsed;
      }
      if (isOnBreak) {
        totalBreakMinutes += elapsed;
      }
      if (isPunchedIn) {
        grossWorkMinutes += elapsed;
      }
    }

    // 3. Update state for the NEXT interval
    switch (event.type) {
      case 'punch-in':
        isPunchedIn = true;
        break;
      case 'punch-out':
        isPunchedIn = false;
        break;
      case 'break-in':
        isOnBreak = true;
        if (!firstBreakIn) firstBreakIn = event.timestamp;
        lastBreakIn = event.timestamp;
        lastBreakOut = null;
        break;
      case 'break-out':
        isOnBreak = false;
        lastBreakOut = event.timestamp;
        break;
    }
    
    lastEventTime = eventTime;
  });

  // 4. Handle ongoing session (from last event to 'now')
  const now = new Date();
  if (lastEventTime && isSameDay(now, lastEventTime)) {
    const elapsed = differenceInMinutes(now, lastEventTime);
    if (isPunchedIn && !isOnBreak) {
      netWorkMinutes += elapsed;
    }
    if (isOnBreak) {
      totalBreakMinutes += elapsed;
    }
    if (isPunchedIn) {
      grossWorkMinutes += elapsed;
    }
  }

  return { 
    totalHours: grossWorkMinutes / 60, 
    breakHours: totalBreakMinutes / 60, 
    workingHours: netWorkMinutes / 60,
    firstBreakIn,
    lastBreakIn,
    lastBreakOut
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
export function processDailyEvents(events: AttendanceEvent[]): {
  checkIn: string | null;
  checkOut: string | null;
  firstBreakIn: string | null;
  lastBreakIn: string | null;
  breakOut: string | null;
  totalHours: number;
  breakHours: number;
  workingHours: number;
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
    };
  }

  // Sort events chronologically
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  const firstCheckIn = sortedEvents.find(e => e.type === 'punch-in');
  const lastCheckOut = [...sortedEvents].reverse().find(e => e.type === 'punch-out');
  
  const result = calculateWorkingHours(events);
  
  return {
    checkIn: firstCheckIn?.timestamp || null,
    checkOut: lastCheckOut?.timestamp || null,
    firstBreakIn: result.firstBreakIn,
    lastBreakIn: result.lastBreakIn,
    breakOut: result.lastBreakOut,
    totalHours: result.totalHours,
    breakHours: result.breakHours,
    workingHours: result.workingHours,
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
  const mapping = settings?.missedCheckoutConfig?.roleMapping || {
    office: ['admin', 'hr', 'finance', 'developer', 'hr_ops', 'management', 'back_office_staff', 'operation_manager'],
    field: ['field_staff', 'field_officer', 'technical_reliever'],
    site: ['site_manager', 'security_guard', 'supervisor']
  };

  if (mapping.field?.includes(roleId)) return 'field';
  
  // If the user's role is specifically mapped to site, or they are assigned to a real physical society
  // (ignoring 'null' and 'head_office' suffix which imply corporate mapping)
  if (mapping.site?.includes(roleId) || (societyId && !societyId.endsWith('_head_office'))) return 'site';
  
  return 'office';
}

// Force Vite HMR
