// Site Attendance Duty Calculations — Pure functions for columns AN through AV

import type { SiteDutySummary } from '../types/siteAttendance';

/**
 * Column AN — Net Duties
 * Count of working days (P variants, leave variants) minus non-duty codes
 */
export function calcNetDuties(dailyCodes: string[]): number {
  let total = 0;
  for (const code of dailyCodes) {
    if (!code) continue;
    const c = code.toUpperCase();

    // Full duty codes
    if (c === 'P' || c === 'H/P' || c === '0.5H') {
      total += 1;
    }
    // Half-duty codes
    else if (c === '0.5P' || c === '1/2P' || c === 'W/0.5P') {
      total += 0.5;
    }
    // Three-quarter day
    else if (c === '3/4P') {
      total += 0.75;
    }
    // Quarter day
    else if (c === '1/4P') {
      total += 0.25;
    }
    // Skip non-duty codes: A, W/O, H, W/P (counted separately), C/O, E/L, S/L, O/H, O/H.5
  }
  return total;
}

/**
 * Column AO — Week-Off OT Duties
 * For each 7-day window: if worked >2 days AND had W/O or W/P → count W/P as OT
 */
export function calcWeekOffDuties(dailyCodes: string[]): number {
  let ot = 0;
  // Process in 7-day windows
  for (let i = 0; i < dailyCodes.length; i += 7) {
    const week = dailyCodes.slice(i, i + 7);
    const workedDays = week.filter(c => {
      if (!c) return false;
      const u = c.toUpperCase();
      return u.includes('P') && u !== 'W/P' && u !== 'W/0.5P';
    }).length;

    const wpCount = week.filter(c => c && c.toUpperCase() === 'W/P').length;
    const wpHalfCount = week.filter(c => c && c.toUpperCase() === 'W/0.5P').length;

    if (workedDays >= 2) {
      ot += wpCount;
      ot += wpHalfCount * 0.5;
    }
  }
  return ot;
}

/**
 * Column AQ — Leave Count
 * Count of leave codes: C/O, E/L, S/L (and half variants)
 */
export function calcLeaveCount(dailyCodes: string[]): number {
  let total = 0;
  for (const code of dailyCodes) {
    if (!code) continue;
    const c = code.toUpperCase();
    if (c === 'C/O' || c === 'E/L' || c === 'S/L' || c === 'C/L') {
      total += 1;
    } else if (c.startsWith('1/2') && (c.includes('E/L') || c.includes('S/L') || c.includes('C/O'))) {
      total += 0.5;
    }
  }
  return total;
}

/**
 * Column AR — Absence Count
 */
export function calcAbsenceCount(dailyCodes: string[]): number {
  return dailyCodes.filter(c => c && c.toUpperCase() === 'A').length;
}

/**
 * Column AS — OT Duties (from working on weekly offs)
 * W/P = 1 OT, W/0.5P = 0.5 OT
 */
export function calcOTDuties(dailyCodes: string[]): number {
  let total = 0;
  for (const code of dailyCodes) {
    if (!code) continue;
    const c = code.toUpperCase();
    if (c === 'W/P') total += 1;
    else if (c === 'W/0.5P') total += 0.5;
  }
  return total;
}

/**
 * Column AT — Holidays Payable
 * O/H = 1, O/H.5 = 0.5, 0.5H = 1
 * Returns 0 if staff has exclusion remarks or site holiday toggle is OFF
 */
export function calcHolidaysPayable(
  dailyCodes: string[],
  isExcluded: boolean,
  holidayToggle: boolean
): number {
  if (isExcluded || !holidayToggle) return 0;

  let total = 0;
  for (const code of dailyCodes) {
    if (!code) continue;
    const c = code.toUpperCase();
    if (c === 'O/H' || c === '0.5H') total += 1;
    else if (c === 'O/H.5') total += 0.5;
    else if (c === 'H') total += 1;
  }
  return total;
}

/**
 * Column AU — Total Payable
 */
export function calcTotalPayable(
  netDuties: number,
  weekOffOT: number,
  leaveCount: number,
  otDuties: number,
  holidaysPayable: number
): number {
  return netDuties + weekOffOT + leaveCount + otDuties + holidaysPayable;
}

/**
 * Column AV — Final Capped
 * Security Officers/Executives: cap at daysInMonth if total exceeds it
 */
export function calcFinalCapped(
  totalPayable: number,
  designation: string,
  daysInMonth: number
): number {
  const d = (designation || '').toLowerCase();
  const shouldCap = d.includes('security') || d.includes('officer') || d.includes('executive');
  if (shouldCap && totalPayable > daysInMonth) {
    return daysInMonth;
  }
  return totalPayable;
}

/**
 * Barrel function — calculate all duty columns from daily codes
 */
export function calculateAllDuties(params: {
  dailyCodes: string[];
  designation: string;
  isExcluded: boolean;
  daysInMonth: number;
  holidayToggle: boolean;
}): SiteDutySummary {
  const { dailyCodes, designation, isExcluded, daysInMonth, holidayToggle } = params;

  const netDuties = calcNetDuties(dailyCodes);
  const weekOffOT = calcWeekOffDuties(dailyCodes);
  const leaveCount = calcLeaveCount(dailyCodes);
  const absenceCount = calcAbsenceCount(dailyCodes);
  const otDuties = calcOTDuties(dailyCodes);
  const holidaysPayable = calcHolidaysPayable(dailyCodes, isExcluded, holidayToggle);
  const totalPayable = calcTotalPayable(netDuties, weekOffOT, leaveCount, otDuties, holidaysPayable);
  const finalCapped = calcFinalCapped(totalPayable, designation, daysInMonth);

  return {
    netDuties,
    weekOffOT,
    leaveCount,
    absenceCount,
    otDuties,
    holidaysPayable,
    totalPayable,
    finalCapped,
  };
}

/**
 * Generate validation alerts for a staff member's monthly summary
 */
export function validateDutySummary(
  staffId: string,
  staffName: string,
  dailyCodes: string[],
  summary: SiteDutySummary
): { type: 'warning' | 'error'; message: string }[] {
  const alerts: { type: 'warning' | 'error'; message: string }[] = [];

  const woCount = dailyCodes.filter(c => c && c.toUpperCase() === 'W/O').length;
  if (woCount > 5) {
    alerts.push({ type: 'warning', message: `${staffName}: W/O count is ${woCount} (exceeds 5)` });
  }

  if (summary.totalPayable > 35) {
    alerts.push({ type: 'error', message: `${staffName}: Total payable is ${summary.totalPayable} (exceeds 35)` });
  }

  if (summary.absenceCount > 10) {
    alerts.push({ type: 'warning', message: `${staffName}: ${summary.absenceCount} absences this month` });
  }

  return alerts;
}
