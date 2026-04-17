import { differenceInMinutes, parseISO } from 'date-fns';
import type { AttendanceEvent, StaffAttendanceRules, FieldAttendanceViolation } from '../types';

export interface SiteTravelBreakdown {
  totalHours: number;
  siteHours: number;
  travelHours: number;
  sitePercentage: number;
  travelPercentage: number;
  siteVisits: number;
  siteMinutes: number;
  travelMinutes: number;
  totalActiveMinutes: number;
}

export function calculateSiteTravelTime(
  events: AttendanceEvent[], 
  graceMinutes: number = 0, 
  userRole?: string,
  processingDate?: Date
): SiteTravelBreakdown {
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let totalSiteMinutes = 0;
  let totalTravelMinutes = 0;
  let totalBreakMinutes = 0;
  let siteVisits = 0;

  // Track intervals for grace period logic
  const intervals: { duration: number; type: 'site' | 'travel' | 'break' }[] = [];

  // State Trackers
  let isDayActive = false;
  let isAtSite = false;
  let isOnBreak = false;
  let lastEventTime: Date | null = null;

  sortedEvents.forEach(event => {
    const eventTime = new Date(event.timestamp);

    if (lastEventTime) {
      const elapsed = differenceInMinutes(eventTime, lastEventTime);
      
      let type: 'site' | 'travel' | 'break' = 'travel';
      if (isOnBreak) {
        totalBreakMinutes += elapsed;
        type = 'break';
      } else if (isAtSite) {
        totalSiteMinutes += elapsed;
        type = 'site';
      } else if (isDayActive) {
        totalTravelMinutes += elapsed;
        type = 'travel';
      }

      if (elapsed > 0) {
        intervals.push({ duration: elapsed, type });
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
          isAtSite = false;
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
  const isToday = !processingDate || (
    now.getFullYear() === processingDate.getFullYear() &&
    now.getMonth() === processingDate.getMonth() &&
    now.getDate() === processingDate.getDate()
  );

  if (lastEventTime && isToday) {
    const elapsed = differenceInMinutes(now, lastEventTime);
    if (elapsed > 0) {
      if (isOnBreak) totalBreakMinutes += elapsed;
      else if (isAtSite) totalSiteMinutes += elapsed;
      else if (isDayActive) totalTravelMinutes += elapsed;
    }
  }

  // --- APPLY GRACE PERIOD FOR ALL TRACKED STAFF ---
  // Logic: First interval after login and last interval before logout count as site time if <= graceMinutes.
  if (graceMinutes > 0 && intervals.length > 0) {
    // 1. First interval (Login to 1st Site In)
    const firstTravel = intervals.find(i => i.type === 'travel');
    if (firstTravel && firstTravel.duration <= graceMinutes) {
      totalTravelMinutes -= firstTravel.duration;
      totalSiteMinutes += firstTravel.duration;
      firstTravel.type = 'site'; // Mark as site for consistency if we ever check intervals again
    }

    // 2. Last interval (Last Site Out to Logout)
    const lastTravel = [...intervals].reverse().find(i => i.type === 'travel');
    if (lastTravel && lastTravel.duration <= graceMinutes && lastTravel !== firstTravel) {
      totalTravelMinutes -= lastTravel.duration;
      totalSiteMinutes += lastTravel.duration;
      lastTravel.type = 'site';
    }
  }

  const siteHours = totalSiteMinutes / 60;
  const travelHours = totalTravelMinutes / 60;
  const totalActiveMinutes = totalSiteMinutes + totalTravelMinutes;

  return {
    totalHours: (totalSiteMinutes + totalTravelMinutes + totalBreakMinutes) / 60,
    siteHours,
    travelHours,
    siteMinutes: totalSiteMinutes,
    travelMinutes: totalTravelMinutes,
    totalActiveMinutes,
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
  status: 'P' | '3/4P' | '1/2P' | '1/4P' | 'A';
} {
  const violations: string[] = [];
  const target = rules.minimumSitePercentage;
  
  // Check site percentage
  if (breakdown.sitePercentage < target) {
    violations.push('site_time_low');
  }

  // Check absolute site hours (if rule is set)
  if (rules.minimumSiteHours && breakdown.siteHours < rules.minimumSiteHours) {
    if (!violations.includes('site_time_low')) {
      violations.push('site_time_low');
    }
  }
  
  // Determine graduated status based on tiers
  // 1. Check total hours first (must meet at least half day requirement)
  if (breakdown.totalHours < rules.minimumHoursHalfDay) {
    return { isValid: false, violations, status: 'A' };
  }

  // 2. Determine tiered status based on absolute site hours vs target site hours
  // This ensures that short days (e.g. 4 hours) are correctly capped at 1/2P even with 100% site usage.
  const fullDayTargetHours = rules.minimumHoursFullDay || 8;
  const targetSiteMinutes = fullDayTargetHours * 60 * (target / 100);
  
  let status: 'P' | '3/4P' | '1/2P' | '1/4P' | 'A' = 'A';
  
  if (targetSiteMinutes > 0) {
    const siteRatio = breakdown.siteMinutes / targetSiteMinutes;
    
    if (siteRatio >= 0.98) { // Small buffer for "P" (e.g. 5h 55m counts as 6h)
      status = 'P';
    } else if (siteRatio >= 0.75) {
      status = '3/4P';
    } else if (siteRatio >= 0.50) {
      status = '1/2P';
    } else if (siteRatio > 0) {
      status = '1/4P';
    }
  } else {
    // Fallback to total hours if no site target is configured
    if (breakdown.totalHours >= fullDayTargetHours - 0.25) status = 'P';
    else if (breakdown.totalHours >= rules.minimumHoursHalfDay) status = '1/2P';
  }

  return {
    isValid: violations.length === 0,
    violations,
    status
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
  violation?: FieldAttendanceViolation,
  userRole?: string,
  processingDate?: Date
): {
  status: 'P' | '3/4P' | '1/2P' | '1/4P' | 'A';
  breakdown: SiteTravelBreakdown;
  hasViolation: boolean;
  grantedByManager: boolean;
} {
  const graceMinutes = rules.fieldStaffGraceMinutes ?? 15;
  const breakdown = calculateSiteTravelTime(events, graceMinutes, userRole, processingDate);
  const minSite = rules.minimumSitePercentage ?? 75;

  // No activity
  if (breakdown.totalHours === 0) {
    return { status: 'A', breakdown, hasViolation: false, grantedByManager: false };
  }

  const validation = validateFieldStaffAttendance(breakdown, {
    minimumSitePercentage: minSite,
    minimumSiteHours: rules.minimumSiteHours,
    minimumHoursFullDay: rules.minimumHoursFullDay,
    minimumHoursHalfDay: rules.minimumHoursHalfDay,
  });

  // If status is P directly, excellent
  if (validation.status === 'P') {
    return { status: 'P', breakdown, hasViolation: false, grantedByManager: false };
  }

  // Below threshold — check if manager acknowledged the violation
  const grantedByManager = !!(violation && violation.attendanceGranted === true);
  if (grantedByManager) {
    // If manager grants, it becomes full P
    return { status: 'P', breakdown, hasViolation: true, grantedByManager: true };
  }

  // Use the tiered status from validation
  return { status: validation.status, breakdown, hasViolation: true, grantedByManager: false };
}
