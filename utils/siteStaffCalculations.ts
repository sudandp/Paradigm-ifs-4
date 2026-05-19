import { isSameDay, isAfter, isBefore, differenceInDays, format, parseISO } from 'date-fns';
import { AttendanceEvent } from '../types';

export interface SiteStaffConfig {
  userId: string;
  ctcPerMonth: number;
  weeklyOffsPerWeek: number; // 0, 0.5, 1, 2
  earnedLeavesPerAnnum: number; // 0, 18
  nfhPerAnnum: number; // 0, 10, 12
  nhBillingConfig: 'NA' | 'Actuals' | 'Double';
  nhSalaryConfig: 'NA' | 'Actuals' | 'Double';
  shift: string; // A, B, C, D, E
  shiftHours: number; // 8, 10, 12
  perDayBillingRate?: number;
  rateEffectiveDate?: string;
  perAnnumRate?: number;
  billableDutiesInYear?: number;
}

export interface ManualAdjustment {
  adjusted_by: string;
  adjusted_at: string;
  reason: string;
  delta: number;
  type: string;
}

/**
 * Ensures a date is within the 21st to 20th billing period.
 */
export function isInBillingPeriod(date: Date, periodStart: Date, periodEnd: Date): boolean {
  return (isSameDay(date, periodStart) || isAfter(date, periodStart)) &&
         (isSameDay(date, periodEnd) || isBefore(date, periodEnd));
}

/**
 * 4A. Per Day Billing Rate (calculate once at contract start, store in employee record)
 */
export function calculatePerDayRate(config: SiteStaffConfig): {
  perAnnumRate: number;
  billableDutiesInYear: number;
  perDayBillingRate: number;
} {
  const perAnnumRate = config.ctcPerMonth * 12;
  const billableDutiesInYear = 365 - ((365 / 7) * config.weeklyOffsPerWeek) - config.earnedLeavesPerAnnum - config.nfhPerAnnum;
  const perDayBillingRate = perAnnumRate / billableDutiesInYear;

  return { perAnnumRate, billableDutiesInYear, perDayBillingRate };
}

/**
 * 3A. Weekly Off (WO) Balance
 */
export function accrueWOBalance(daysPresentInPeriod: number, openingBalance: number) {
  const earned = daysPresentInPeriod * (1 / 6);
  const allotted = Math.floor(openingBalance + earned);
  const closing = (openingBalance + earned) - allotted;

  return {
    earned,
    allotted,
    closing
  };
}

/**
 * 3B. Earned Leave (EL) Balance
 */
export function accrueELBalance(
  daysPresentInPeriod: number,
  woAllotted: number,
  holidaysInPeriod: number,
  openingBalance: number,
  availedInPeriod: number,
  earnedLeavesPerAnnum: number
) {
  if (earnedLeavesPerAnnum === 0) {
    return { earned: 0, availed: 0, closing: openingBalance };
  }

  const qualifyingDays = daysPresentInPeriod + woAllotted + holidaysInPeriod;
  const earned = qualifyingDays * 0.05;
  const closing = (openingBalance + earned) - availedInPeriod;

  return { earned, availed: availedInPeriod, closing };
}

/**
 * 4B & 4C. Holiday (NH) Billing & Salary Logic
 */
export function calculateNHAddition(
  config: 'NA' | 'Actuals' | 'Double',
  holidaysInPeriod: number,
  countHalfHP: number,
  countHP: number
): number {
  if (config === 'NA') {
    return (countHalfHP / 2) + countHP;
  }
  if (config === 'Actuals') {
    return holidaysInPeriod + (countHalfHP * 0.5) + countHP;
  }
  if (config === 'Double') {
    return holidaysInPeriod + countHalfHP + (countHP * 2);
  }
  return 0;
}

/**
 * 5. Monthly Output Record
 */
export function generateMonthlyOutput(
  employeeId: string,
  billingPeriodStart: string,
  billingPeriodEnd: string,
  config: SiteStaffConfig,
  attendanceMarks: string[], // Array of daily marks 'P', '1/2P', 'WO', 'EL', 'HP', '1/2HP', etc.
  holidaysInPeriod: number,
  elOpeningBalance: number,
  woOpeningBalance: number,
  manualAdjustments: ManualAdjustment[] = []
) {
  const daysPresent = attendanceMarks.filter(m => m === 'P').length + (attendanceMarks.filter(m => m === '1/2P').length * 0.5);
  const daysAbsent = attendanceMarks.filter(m => !m || m === 'A' || m === '0').length;
  const daysElAvailed = attendanceMarks.filter(m => m === 'EL').length;
  const countHp = attendanceMarks.filter(m => m === 'HP').length;
  const countHalfHp = attendanceMarks.filter(m => m === '1/2HP').length;

  const woAccrual = accrueWOBalance(daysPresent, woOpeningBalance);
  const elAccrual = accrueELBalance(daysPresent, woAccrual.allotted, holidaysInPeriod, elOpeningBalance, daysElAvailed, config.earnedLeavesPerAnnum);

  const nhBillingAddition = calculateNHAddition(config.nhBillingConfig, holidaysInPeriod, countHalfHp, countHp);
  const nhSalaryAddition = calculateNHAddition(config.nhSalaryConfig, holidaysInPeriod, countHalfHp, countHp);

  const billableDaysCount = daysPresent + nhBillingAddition;
  const workdaysForDisbursement = daysPresent + woAccrual.allotted + daysElAvailed + nhSalaryAddition;
  const perDayRate = config.perDayBillingRate || calculatePerDayRate(config).perDayBillingRate;

  // Apply manual adjustments to billable days
  let finalBillableDays = billableDaysCount;
  manualAdjustments.forEach(adj => {
    if (adj.type === 'billable_days') finalBillableDays += adj.delta;
  });

  return {
    employee_id: employeeId,
    billing_period_start: billingPeriodStart,
    billing_period_end: billingPeriodEnd,

    attendance_summary: {
      days_present: daysPresent,
      days_absent: daysAbsent,
      days_el_availed: daysElAvailed,
      days_wo_allotted: woAccrual.allotted,
      holidays_in_period: holidaysInPeriod,
      count_hp: countHp,
      count_half_hp: countHalfHp,
      nh_billing_addition: nhBillingAddition,
      nh_salary_addition: nhSalaryAddition
    },

    billing: {
      per_day_rate: Number(perDayRate.toFixed(2)),
      billable_days_count: finalBillableDays,
      invoice_subtotal: Number((finalBillableDays * perDayRate).toFixed(2)),
      billing_type: 'Per Present'
    },

    salary: {
      workdays_for_disbursement: workdaysForDisbursement,
      salary_payable: Number((config.ctcPerMonth / 30 * workdaysForDisbursement).toFixed(2)) // Approximate fallback if not fixed CTC
    },

    el_balance: {
      opening: elOpeningBalance,
      earned: elAccrual.earned,
      availed: elAccrual.availed,
      closing: elAccrual.closing
    },

    wo_balance: {
      opening: woOpeningBalance,
      earned: woAccrual.earned,
      allotted: woAccrual.allotted,
      closing: woAccrual.closing
    },

    manual_adjustments: manualAdjustments
  };
}

/**
 * Evaluates the attendance status specifically for Site Staff.
 * Uses shift-based attendance but layers HP, 1/2HP, WO, and EL.
 */
export function evaluateSiteStaffStatus(params: any): string {
  const { 
    day, dayEvents, siteHolidays, leaves, userRules, workingHours, fieldStatus
  } = params;

  // 1. Check if the day is a Holiday in the Duty Day Master (siteHolidays)
  const dateStr = format(day, 'yyyy-MM-dd');
  const isHoliday = (siteHolidays || []).some((h: any) => {
    if (!h || !h.date) return false;
    const hDateStr = String(h.date);
    if (hDateStr.startsWith('-')) {
      const compareMMDD = format(day, '-MM-dd');
      return dateStr.endsWith(hDateStr) || hDateStr.endsWith(compareMMDD);
    }
    return hDateStr.includes(dateStr);
  });

  // 2. Check Leaves
  const approvedLeave = (leaves || []).find((l: any) => {
    const lStartDate = l.startDate || l.date || l.leave_date;
    const lEndDate = l.endDate || l.date || l.leave_date;
    if (!lStartDate || !lEndDate) return false;
    const lStatus = String(l.status || l.leaveStatus || '').toLowerCase();
    if (!['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(lStatus)) return false;

    const normalize = (d: any) => typeof d === 'string' ? d.substring(0, 10) : format(new Date(d), 'yyyy-MM-dd');
    return dateStr >= normalize(lStartDate) && dateStr <= normalize(lEndDate);
  });

  // 3. Determine Base Work Status (Shift-based or Hours-based)
  // Site staff inherently use Shift-Based calculation, which we simulate via hours if shift isn't explicitly resolved here
  const full = userRules?.minimumHoursFullDay || userRules?.dailyWorkingHours?.min || 8;
  const halfDayHrs = userRules?.minimumHoursHalfDay ?? 4;
  
  let baseWorkStatus = 'A';
  const hasPunchIn = dayEvents.some((e: any) => e.type === 'punch-in');
  const hasPunchOut = dayEvents.some((e: any) => e.type === 'punch-out');

  if (fieldStatus && fieldStatus !== 'A') {
    baseWorkStatus = fieldStatus;
  } else if (workingHours !== undefined && workingHours > 0) {
    if (workingHours >= full) baseWorkStatus = 'P';
    else if (workingHours >= halfDayHrs) baseWorkStatus = '1/2P';
    else baseWorkStatus = 'A';
  } else if (hasPunchIn && hasPunchOut) {
    baseWorkStatus = 'P'; // Fallback if no hours but complete punch
  }

  // 4. Layer Site Staff Specific Marks
  if (baseWorkStatus === 'P' || baseWorkStatus === '1/2P') {
    if (isHoliday) {
      // Overtime Rule: Only one HP or 1/2HP per day. 
      // This function evaluates a single day's primary shift. Overtime shifts would be handled by a separate aggregator, 
      // but for the daily mark, we return HP or 1/2HP.
      return baseWorkStatus === 'P' ? 'HP' : '1/2HP';
    }
    return baseWorkStatus;
  }

  // If not working, check for Leaves or Weekly Offs
  if (approvedLeave) {
    const lType = String(approvedLeave.leaveType || approvedLeave.type || '').toLowerCase();
    const isHalf = approvedLeave.dayOption === 'half' || approvedLeave.day_option === 'half';
    
    // For Site Staff, 'EL' is the standard paid leave mark
    if (lType.includes('earned') || lType === 'e/l' || lType === 'el') {
       // Note: Consumption validation (Opening Balance > 0) is enforced during leave approval and monthly processing.
       return isHalf ? '1/2EL' : 'EL'; // Though standard rules specify EL
    }
    if (lType.includes('comp') || lType === 'c/o') {
      return 'WO'; // Comp off converts to a Weekly Off consumption in some setups, or keep as WO
    }
    // Any other leave type defaults to EL or specific type if needed, but rules say 'EL' is availed
    return 'EL';
  }

  // Weekly Off logic
  // "A WO mark is only valid if WO_Opening_Balance > 0."
  // Since this is evaluated daily, if they didn't work, and it's their scheduled weekly off day, we mark it WO.
  // The monthly aggregator will cap the actual allotted WO based on balance.
  const dayOfWeek = day.getDay();
  const weeklyOffDays = userRules?.weeklyOffDays || [0];
  if (weeklyOffDays.includes(dayOfWeek)) {
    return 'WO';
  }

  // Default to Absent
  return 'A';
}
