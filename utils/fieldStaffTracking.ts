import { differenceInMinutes, parseISO } from 'date-fns';
import type { AttendanceEvent, StaffAttendanceRules, FieldAttendanceViolation } from '../types';

export interface SiteTravelBreakdown {
  totalHours: number;
  siteHours: number;
  travelHours: number;
  sitePercentage: number;
  travelPercentage: number;
  siteVisits: number;
}

export function calculateSiteTravelTime(events: AttendanceEvent[]): SiteTravelBreakdown {
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let totalSiteMinutes = 0;
  let totalTravelMinutes = 0;
  let totalBreakMinutes = 0;
  let siteVisits = 0;

  // State Trackers
  let isDayActive = false;
  let isAtSite = false;
  let isOnBreak = false;
  let lastEventTime: Date | null = null;

  sortedEvents.forEach(event => {
    const eventTime = new Date(event.timestamp);

    if (lastEventTime) {
      const elapsed = differenceInMinutes(eventTime, lastEventTime);

      if (isOnBreak) {
        totalBreakMinutes += elapsed;
      } else if (isAtSite) {
        totalSiteMinutes += elapsed;
      } else if (isDayActive) {
        totalTravelMinutes += elapsed;
      }
    }

    // Update state for next interval
    switch (event.type) {
      case 'punch-in':
        if (event.workType === 'field') {
          isAtSite = true;
          siteVisits++;
        } else {
          isDayActive = true;
        }
        break;
      case 'punch-out':
        if (event.workType === 'field') {
          isAtSite = false;
        } else {
          isDayActive = false;
          isAtSite = false; // Punching out of day also ends site visit
        }
        break;
      case 'site-ot-in':
        isAtSite = true;
        siteVisits++;
        break;
      case 'site-ot-out':
        isAtSite = false;
        break;
      case 'break-in':
        isOnBreak = true;
        break;
      case 'break-out':
        isOnBreak = false;
        break;
    }

    lastEventTime = eventTime;
  });

  // Handle ongoing session if it's the current day
  const now = new Date();
  if (lastEventTime && isSameDay(now, lastEventTime)) {
    const elapsed = differenceInMinutes(now, lastEventTime);
    if (isOnBreak) {
      totalBreakMinutes += elapsed;
    } else if (isAtSite) {
      totalSiteMinutes += elapsed;
    } else if (isDayActive) {
      totalTravelMinutes += elapsed;
    }
  }

  const totalHours = (totalSiteMinutes + totalTravelMinutes + totalBreakMinutes) / 60;
  const siteHours = totalSiteMinutes / 60;
  const travelHours = totalTravelMinutes / 60;
  const totalActiveMinutes = totalSiteMinutes + totalTravelMinutes;

  return {
    totalHours,
    siteHours,
    travelHours,
    sitePercentage: totalActiveMinutes > 0 ? (totalSiteMinutes / totalActiveMinutes) * 100 : 0,
    travelPercentage: totalActiveMinutes > 0 ? (totalTravelMinutes / totalActiveMinutes) * 100 : 0,
    siteVisits,
  };
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Validate field staff attendance against site percentage rules
 */
export function validateFieldStaffAttendance(
  breakdown: SiteTravelBreakdown,
  rules: {
    minimumSitePercentage: number;
    minimumSiteHours?: number;
    minimumHoursFullDay: number;
    minimumHoursHalfDay: number;
  }
): {
  isValid: boolean;
  violations: string[];
  status: 'P' | '1/2P' | 'A';
} {
  const violations: string[] = [];
  
  // Check site percentage
  if (breakdown.sitePercentage < rules.minimumSitePercentage) {
    violations.push('site_time_low');
  }

  // Check absolute site hours (if rule is set)
  if (rules.minimumSiteHours && breakdown.siteHours < rules.minimumSiteHours) {
    if (!violations.includes('site_time_low')) {
      violations.push('site_time_low'); // Reuse site_time_low or add a new violation type if needed
    }
  }
  
  // Check total hours
  let status: 'P' | '1/2P' | 'A' = 'A';
  if (breakdown.totalHours >= rules.minimumHoursFullDay) {
    status = 'P';
  } else if (breakdown.totalHours >= rules.minimumHoursHalfDay) {
    status = '1/2P';
    if (!violations.includes('insufficient_hours')) {
      violations.push('insufficient_hours');
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    status,
  };
}

/**
 * Consolidated field staff attendance status determination.
 *
 * Uses site-time-percentage logic:
 *  - P  → site % >= minimumSitePercentage (default 75%)
 *  - P  → violation exists but manager acknowledged it (attendanceGranted = true)
 *  - 1/2P → worked but site % below threshold and no acknowledgment
 *  - A  → no activity
 *
 * @param events All attendance events for the day
 * @param rules  Field staff attendance rules from settings
 * @param violation Optional existing field violation record for the day
 */
export function getFieldStaffStatus(
  events: AttendanceEvent[],
  rules: StaffAttendanceRules,
  violation?: Pick<FieldAttendanceViolation, 'attendanceGranted' | 'status'> | null,
): {
  status: 'P' | '1/2P' | 'A';
  breakdown: SiteTravelBreakdown;
  hasViolation: boolean;
  grantedByManager: boolean;
} {
  const breakdown = calculateSiteTravelTime(events);
  const minSite = rules.minimumSitePercentage ?? 75;

  // No activity
  if (breakdown.totalHours === 0) {
    return { status: 'A', breakdown, hasViolation: false, grantedByManager: false };
  }

  // Site time meets the threshold → Present
  if (breakdown.sitePercentage >= minSite) {
    return { status: 'P', breakdown, hasViolation: false, grantedByManager: false };
  }

  // Below threshold — check if manager acknowledged the violation
  const grantedByManager = !!(violation && violation.attendanceGranted === true);
  if (grantedByManager) {
    return { status: 'P', breakdown, hasViolation: true, grantedByManager: true };
  }

  // Below threshold, no acknowledgment → half day
  return { status: '1/2P', breakdown, hasViolation: true, grantedByManager: false };
}
