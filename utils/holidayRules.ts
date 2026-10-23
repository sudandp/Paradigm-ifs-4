import { FIXED_HOLIDAYS } from './constants';
import type { User } from '../types';

export interface FixedHolidaySundayCheck {
  name: string;
  dateStr: string;
  isSunday: boolean;
  dayOfWeek: number;
}

export interface HolidayAllotmentResult {
  year: number;
  poolCap: number; // 5 or 6 (or higher if multiple fixed fall on Sunday)
  sundayFixedHolidays: FixedHolidaySundayCheck[];
  activeMonths: number;
  eligibleHolidays: number;
  joiningDateStr: string | null;
  leftDateStr: string | null;
  isExistingStaff: boolean;
  reason: string;
  formulaBadge?: string;
  bracketText?: string;
}

/**
 * Checks all fixed/mandatory holidays for a given year and identifies which fall on a Sunday.
 */
export function getFixedHolidaysSundayStatus(year: number): FixedHolidaySundayCheck[] {
  return FIXED_HOLIDAYS.map(h => {
    // h.date is in format 'MM-DD', e.g. '01-26'
    const cleanDate = h.date.replace(/^-/, '');
    const [monthStr, dayStr] = cleanDate.split('-');
    const month = parseInt(monthStr, 10) - 1; // 0-indexed
    const day = parseInt(dayStr, 10);
    const dateObj = new Date(year, month, day);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday

    return {
      name: h.name,
      dateStr: `${year}-${cleanDate}`,
      isSunday: dayOfWeek === 0,
      dayOfWeek,
    };
  });
}

/**
 * Calculates the annual pool capacity for optional holidays in a given year.
 * Baseline is 5 optional holidays.
 * Each fixed holiday that falls on Sunday adds 1 extra optional holiday to the pool.
 * Example:
 *   - 2026: Karnataka Rajyotsava (Nov 1) is Sunday -> Pool Cap = 6
 *   - 2028: No fixed holidays on Sunday -> Pool Cap = 5
 */
export function getAnnualOptionalPoolCap(year: number): {
  poolCap: number;
  sundayFixedHolidays: FixedHolidaySundayCheck[];
} {
  const statusList = getFixedHolidaysSundayStatus(year);
  const sundayCount = statusList.filter(s => s.isSunday).length;
  const basePool = 5;
  const poolCap = basePool + sundayCount;
  return { poolCap, sundayFixedHolidays: statusList.filter(s => s.isSunday) };
}

/**
 * Safely parses any date format (ISO strings, YYYY-MM-DD, DD-MM-YYYY, timestamps, Date instances).
 */
export function parseFlexibleDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(val).trim();
  if (!s) return null;

  // Handle ISO string with T (e.g. 2026-04-15T08:56:10.014908+00:00)
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }

  // Handle YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Handle DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(s.replace(/-/g, '/'));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Calculates active months of service in a calendar year based on joining and exit dates.
 */
export function calculateActiveMonthsInYear(
  joiningDateStr?: string | null,
  leftDateStr?: string | null,
  targetYear: number = new Date().getFullYear()
): { activeMonths: number; isExistingStaff: boolean; joiningMonth: number | null } {
  const yearStart = new Date(targetYear, 0, 1);
  const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);

  // If no joining date provided, assume existing staff (active all 12 months)
  if (!joiningDateStr) {
    return { activeMonths: 12, isExistingStaff: true, joiningMonth: null };
  }

  const joinDate = parseFlexibleDate(joiningDateStr);
  if (!joinDate) {
    return { activeMonths: 12, isExistingStaff: true, joiningMonth: null };
  }

  // Employee joined in a future year
  if (joinDate > yearEnd) {
    return { activeMonths: 0, isExistingStaff: false, joiningMonth: null };
  }

  // Employee joined prior to this calendar year
  const isExistingStaff = joinDate < yearStart;

  // Compute start month index (0 to 11) for this year
  let startMonthIndex = 0;
  let joiningMonth: number | null = null;

  if (!isExistingStaff) {
    startMonthIndex = joinDate.getMonth(); // 0 for Jan, 1 for Feb, 3 for Apr
    joiningMonth = startMonthIndex + 1; // 1-indexed (1 = Jan, 4 = Apr)
  }

  // Compute end month index (0 to 11)
  let endMonthIndex = 11; // Dec
  if (leftDateStr) {
    const leftDate = parseFlexibleDate(leftDateStr);
    if (leftDate && leftDate <= yearEnd) {
      if (leftDate < yearStart) {
        return { activeMonths: 0, isExistingStaff, joiningMonth };
      }
      endMonthIndex = leftDate.getMonth();
    }
  }

  // Handle case where leftDate is before joinDate (e.g. left in Sep, but DB created_at record was added in Oct)
  if (endMonthIndex < startMonthIndex) {
    startMonthIndex = 0;
  }

  // Active months calculation (inclusive of active months in the calendar year)
  const activeMonths = Math.max(0, endMonthIndex - startMonthIndex + 1);

  return {
    activeMonths: Math.min(12, activeMonths),
    isExistingStaff,
    joiningMonth,
  };
}

/**
 * Computes eligible optional holidays for a user in a target year using the pro-rata policy.
 * 
 * Rules:
 * When Pool Cap is 6 (6/12 = 1 holiday every 2 months):
 *   >= 12 months -> 6
 *   >= 10 months -> 5
 *   >= 8 months  -> 4
 *   >= 6 months  -> 3
 *   >= 4 months  -> 2
 *   >= 2 months  -> 1
 *   < 2 months   -> 0
 * 
 * When Pool Cap is 5 (5/12 per month):
 *   >= 11 months (Jan, Feb joiners) -> 5
 *   >= 10 months (March joiners)    -> 4
 *   >= 8 months  (April, May)       -> 3
 *   >= 6 months  (June, July)       -> 2
 *   >= 4 months  (August, Sept)     -> 1
 *   < 4 months   (Oct, Nov, Dec)    -> 0
 */
export function calculateEligibleOptionalHolidays(
  user: Partial<User> | null | undefined,
  targetYear: number = new Date().getFullYear()
): HolidayAllotmentResult {
  const { poolCap, sundayFixedHolidays } = getAnnualOptionalPoolCap(targetYear);

  const rawJoining = user?.joiningDate || (user as any)?.joining_date || user?.createdAt || (user as any)?.created_at || null;
  const rawLeft = (user as any)?.leftDate || (user as any)?.exitDate || (user as any)?.relievingDate || (user as any)?.exit_date || (user as any)?.left_date || (user as any)?.relieving_date || (user as any)?.resignation_date || (user as any)?.last_working_day || null;

  const { activeMonths, isExistingStaff, joiningMonth } = calculateActiveMonthsInYear(rawJoining, rawLeft, targetYear);

  let eligibleHolidays = 0;
  let bracketText = '';

  if (poolCap >= 6) {
    if (activeMonths >= 12) { eligibleHolidays = 6; bracketText = '≥ 12 mos tenure (6/12)'; }
    else if (activeMonths >= 10) { eligibleHolidays = 5; bracketText = '≥ 10 mos tenure (5/12)'; }
    else if (activeMonths >= 8) { eligibleHolidays = 4; bracketText = '≥ 8 mos tenure (4/12)'; }
    else if (activeMonths >= 6) { eligibleHolidays = 3; bracketText = '≥ 6 mos tenure (3/12)'; }
    else if (activeMonths >= 4) { eligibleHolidays = 2; bracketText = '≥ 4 mos tenure (2/12)'; }
    else if (activeMonths >= 2) { eligibleHolidays = 1; bracketText = '≥ 2 mos tenure (1/12)'; }
    else { eligibleHolidays = 0; bracketText = '< 2 mos tenure (0/12)'; }
  } else {
    // Pool cap is 5 (5/12 rule)
    if (activeMonths >= 11) { eligibleHolidays = 5; bracketText = '≥ 11 mos tenure (5/12)'; }
    else if (activeMonths >= 10) { eligibleHolidays = 4; bracketText = '≥ 10 mos tenure (4/12)'; }
    else if (activeMonths >= 8) { eligibleHolidays = 3; bracketText = '≥ 8 mos tenure (3/12)'; }
    else if (activeMonths >= 6) { eligibleHolidays = 2; bracketText = '≥ 6 mos tenure (2/12)'; }
    else if (activeMonths >= 4) { eligibleHolidays = 1; bracketText = '≥ 4 mos tenure (1/12)'; }
    else { eligibleHolidays = 0; bracketText = '< 4 mos tenure (0/12)'; }
  }

  // Ensure eligible holidays does not exceed the year's pool cap
  eligibleHolidays = Math.min(poolCap, eligibleHolidays);

  const formulaBadge = poolCap >= 6 ? '6/12 Policy (1 per 2 mos)' : '5/12 Policy (5/yr)';

  let reason = '';
  if (rawLeft) {
    reason = `Exited staff (${activeMonths} active months in ${targetYear}). Entitled to ${eligibleHolidays} optional holidays out of ${poolCap}.`;
  } else if (isExistingStaff) {
    reason = `Full-year employee (12 months active in ${targetYear}) entitled to all ${poolCap} optional holidays.`;
  } else if (rawJoining) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const jMonthName = joiningMonth ? monthNames[joiningMonth - 1] : '';
    reason = `Joined in ${jMonthName || 'mid-year'} (${activeMonths} active months remaining in ${targetYear}). Entitled to ${eligibleHolidays} optional holidays out of ${poolCap}.`;
  } else {
    reason = `Standard allocation of ${eligibleHolidays} holidays.`;
  }

  return {
    year: targetYear,
    poolCap,
    sundayFixedHolidays,
    activeMonths,
    eligibleHolidays,
    joiningDateStr: rawJoining,
    leftDateStr: rawLeft,
    isExistingStaff,
    reason,
    formulaBadge,
    bracketText,
  };
}
