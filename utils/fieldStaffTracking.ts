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

/**
 * Calculate site vs travel time from check-in/out events
 * 
 * Logic:
 * - Site time = Sum of (checkout - checkin) for each location
 * - Travel time = Sum of (next_checkin - previous_checkout)
 * 
 * @param events All check-in/check-out events for a day
 * @returns Breakdown of site vs travel time
 */
export function calculateSiteTravelTime(events: AttendanceEvent[]): SiteTravelBreakdown {
  // Filter only check-in and check-out events, sort by time
  const checkEvents = events
    .filter(e => e.type === 'punch-in' || e.type === 'punch-out')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let totalSiteMinutes = 0;
  let totalTravelMinutes = 0;
  let siteVisits = 0;
  let lastCheckout: Date | null = null;
  let lastCheckin: Date | null = null;

  for (const event of checkEvents) {
    const eventTime = new Date(event.timestamp);

    if (event.type === 'punch-in') {
      // If there was a previous checkout, calculate travel time
      if (lastCheckout) {
        const travelMinutes = differenceInMinutes(eventTime, lastCheckout);
        totalTravelMinutes += Math.max(0, travelMinutes);
      }
      lastCheckin = eventTime;
      siteVisits++;
    } else if (event.type === 'punch-out') {
      // If there was a matching checkin, calculate site time
      if (lastCheckin) {
        const siteMinutes = differenceInMinutes(eventTime, lastCheckin);
        totalSiteMinutes += Math.max(0, siteMinutes);
        lastCheckin = null; // Reset checkin
      }
      lastCheckout = eventTime;
    }
  }

  const totalMinutes = totalSiteMinutes + totalTravelMinutes;
  const totalHours = totalMinutes / 60;
  const siteHours = totalSiteMinutes / 60;
  const travelHours = totalTravelMinutes / 60;

  return {
    totalHours,
    siteHours,
    travelHours,
    sitePercentage: totalMinutes > 0 ? (totalSiteMinutes / totalMinutes) * 100 : 0,
    travelPercentage: totalMinutes > 0 ? (totalTravelMinutes / totalMinutes) * 100 : 0,
    siteVisits,
  };
}

/**
 * Validate field staff attendance against site percentage rules
 */
export function validateFieldStaffAttendance(
  breakdown: SiteTravelBreakdown,
  rules: {
    minimumSitePercentage: number;
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
