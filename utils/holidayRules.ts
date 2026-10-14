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
 * Calculates active months of service in a calendar year based on joining and exit dates.
 */
export function calculateActiveMonthsInYear(
  joiningDateStr?: string | null,
  leftDateStr?: string | null,
  targetYear: number = new Date().getFullYear()
): { activeMonths: number; isExistingStaff: boolean; joiningMonth: number | null } {
  const yearStart = new Date(targetYear, 0, 1);
  const yearEnd = new Date(targetYear, 11, 31);

  // If no joining date provided, assume existing staff (active all 12 months)
  if (!joiningDateStr) {
    return { activeMonths: 12, isExistingStaff: true, joiningMonth: null };
  }

  const joinDate = new Date(joiningDateStr.replace(/-/g, '/'));
  if (isNaN(joinDate.getTime())) {
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
    startMonthIndex = joinDate.getMonth(); // 0 for Jan, 1 for Feb, 5 for June
    joiningMonth = startMonthIndex + 1; // 1-indexed (1 = Jan, 6 = June)
  }

  // Compute end month index (0 to 11)
  let endMonthIndex = 11; // Dec
  if (leftDateStr) {
    const leftDate = new Date(leftDateStr.replace(/-/g, '/'));
    if (!isNaN(leftDate.getTime()) && leftDate <= yearEnd) {
      if (leftDate < yearStart) {
        return { activeMonths: 0, isExistingStaff, joiningMonth };
      }
      endMonthIndex = leftDate.getMonth();
    }
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
  const rawLeft = (user as any)?.leftDate || (user as any)?.exitDate || (user as any)?.relievingDate || null;

  const { activeMonths, isExistingStaff, joiningMonth } = calculateActiveMonthsInYear(rawJoining, rawLeft, targetYear);

  let eligibleHolidays = 0;

  if (poolCap >= 6) {
    if (activeMonths >= 12) eligibleHolidays = 6;
    else if (activeMonths >= 10) eligibleHolidays = 5;
    else if (activeMonths >= 8) eligibleHolidays = 4;
    else if (activeMonths >= 6) eligibleHolidays = 3;
    else if (activeMonths >= 4) eligibleHolidays = 2;
    else if (activeMonths >= 2) eligibleHolidays = 1;
    else eligibleHolidays = 0;
  } else {
    // Pool cap is 5 (5/12 rule)
    if (activeMonths >= 11) eligibleHolidays = 5;
    else if (activeMonths >= 10) eligibleHolidays = 4;
    else if (activeMonths >= 8) eligibleHolidays = 3;
    else if (activeMonths >= 6) eligibleHolidays = 2;
    else if (activeMonths >= 4) eligibleHolidays = 1;
    else eligibleHolidays = 0;
  }

  // Ensure eligible holidays does not exceed the year's pool cap
  eligibleHolidays = Math.min(poolCap, eligibleHolidays);

  let reason = '';
  if (isExistingStaff) {
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
  };
}
