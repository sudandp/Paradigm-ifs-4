import { isSameDay, isAfter, isBefore, differenceInDays, format, parseISO } from 'date-fns';
import { AttendanceEvent } from '../types';
import { getShiftDurationHours } from './shiftDetection';

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
  // When NH Billing Config is NA, holidays are NOT separately paid,
  // so they should NOT be deducted from billable duties.
  // Only deduct NFH when Actuals or Double (holidays are independently payable).
  const nfhDeduction = config.nhBillingConfig === 'NA' ? 0 : config.nfhPerAnnum;
  const billableDutiesInYear = 365 - ((365 / 7) * config.weeklyOffsPerWeek) - config.earnedLeavesPerAnnum - nfhDeduction;
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
 * 
 * NA:      Not worked = 0, Worked half = 0.5, Worked full = 1   (duty pay only, no base holiday pay)
 * Actuals: Not worked = 1, Worked half = 1 + 0.5 = 1.5, Worked full = 1 + 1 = 2   (base + actual work)
 * Double:  Not worked = 1, Worked half = 1 + 2*(0.5) = 2, Worked full = 1 + 2*(1) = 3  (base + double work)
 * 
 * holidaysInPeriod = total holidays (worked + not-worked)
 * countHP = holidays where employee worked full day
 * countHalfHP = holidays where employee worked half day
 * notWorkedHolidays = holidaysInPeriod - countHP - countHalfHP
 */
export function calculateNHAddition(
  config: 'NA' | 'Actuals' | 'Double',
  holidaysInPeriod: number,
  countHalfHP: number,
  countHP: number
): number {
  const notWorked = holidaysInPeriod - countHP - countHalfHP;

  if (config === 'NA') {
    // NA: No pay for non-worked holidays, only duty value for worked ones
    // Not worked = 0, Half = 0.5, Full = 1
    return (countHalfHP * 0.5) + countHP;
  }
  if (config === 'Actuals') {
    // Actuals: Base pay (1) for every holiday + actual work on top
    // Not worked = 1, Half = 1 + 0.5, Full = 1 + 1
    return (notWorked * 1) + (countHalfHP * 1.5) + (countHP * 2);
  }
  if (config === 'Double') {
    // Double: Base pay (1) for every holiday + 2x work on top
    // Not worked = 1, Half = 1 + 2*0.5 = 2, Full = 1 + 2*1 = 3
    return (notWorked * 1) + (countHalfHP * 2) + (countHP * 3);
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
  attendanceMarks: string[], // Array of daily marks 'P', '0.5P', 'W/O', 'EL', 'H/P', '0.5H/P', etc.
  holidaysInPeriod: number,
  elOpeningBalance: number,
  woOpeningBalance: number,
  manualAdjustments: ManualAdjustment[] = []
) {
  const daysPresent = attendanceMarks.filter(m => m === 'P').length + (attendanceMarks.filter(m => m === '0.5P').length * 0.5);
  const daysAbsent = attendanceMarks.filter(m => !m || m === 'A' || m === '0').length;
  const daysElAvailed = attendanceMarks.filter(m => m === 'EL').length;
  const countHp = attendanceMarks.filter(m => m === 'H/P').length;
  const countHalfHp = attendanceMarks.filter(m => m === '0.5H/P').length;

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
 * Uses shift-based attendance but layers H/P, 0.5H/P, W/O, and EL.
 */
export function evaluateSiteStaffStatus(params: any): string {
  const { 
    day, userId, user_id, dayEvents, siteHolidays, leaves, userRules, workingHours, fieldStatus,
    daysPresentInWeek, isActiveInPreviousWeek, resolvedShift
  } = params;
  const targetUserId = userId || user_id;

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
    
    const lUserId = l.userId || l.user_id;
    if (targetUserId && String(lUserId) !== String(targetUserId)) return false;

    const lStatus = String(l.status || l.leaveStatus || '').toLowerCase();
    if (!['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(lStatus)) return false;

    const normalize = (d: any) => typeof d === 'string' ? d.substring(0, 10) : format(new Date(d), 'yyyy-MM-dd');
    return dateStr >= normalize(lStartDate) && dateStr <= normalize(lEndDate);
  });

  // 3. Determine Base Work Status (Shift-based or Hours-based)
  // Site staff inherently use Shift-Based calculation, which we simulate via hours if shift isn't explicitly resolved here
  let full = userRules?.minimumHoursFullDay || userRules?.dailyWorkingHours?.min || 8;
  let threeQuarterHrs = userRules?.threeQuarterDayHours ?? (full * 0.75);
  let halfDayHrs = userRules?.minimumHoursHalfDay ?? 4;
  let quarterDayHrs = userRules?.quarterDayHours ?? 2;

  const graceHours = (userRules?.gracePeriodMinutes ?? 15) / 60;

  if (resolvedShift && userRules?.enableShiftManagement === true) {
    const shiftHours = getShiftDurationHours(resolvedShift);
    full = Math.max(0, shiftHours - graceHours);
    threeQuarterHrs = shiftHours * 0.75;
    halfDayHrs = shiftHours * 0.5;
    quarterDayHrs = shiftHours * 0.25;
  } else if (userRules?.enableShiftManagement === true) {
    full = Math.max(0, full - graceHours);
  }

  // Credit Permission/Correction hours if correctionDetails are present
  const isApprovedPermission = approvedLeave && String(approvedLeave.leaveType || '').toLowerCase().includes('permission');
  const isApprovedCorrection = approvedLeave && String(approvedLeave.leaveType || '').toLowerCase().includes('correction');
  let effectiveWorkingHours = workingHours || 0;

  if ((isApprovedPermission || isApprovedCorrection) && approvedLeave?.correctionDetails) {
    const getMinutes = (timeStr: string) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    const inMins = getMinutes(approvedLeave.correctionDetails.punchIn);
    const outMins = getMinutes(approvedLeave.correctionDetails.punchOut);
    let diffMins = outMins - inMins;
    if (diffMins < 0) diffMins += 24 * 60;
    if (approvedLeave.correctionDetails.includeBreak && approvedLeave.correctionDetails.breakIn && approvedLeave.correctionDetails.breakOut) {
      const bIn = getMinutes(approvedLeave.correctionDetails.breakIn);
      const bOut = getMinutes(approvedLeave.correctionDetails.breakOut);
      let bDiff = bOut - bIn;
      if (bDiff < 0) bDiff += 24 * 60;
      diffMins -= bDiff;
    }
    effectiveWorkingHours = Math.max(0, diffMins / 60);
  }
  
  let baseWorkStatus = 'A';
  const hasPunchIn = dayEvents.some((e: any) => e.type === 'punch-in');
  const hasPunchOut = dayEvents.some((e: any) => e.type === 'punch-out');

  if (fieldStatus && fieldStatus !== 'A') {
    baseWorkStatus = fieldStatus;
  } else if (effectiveWorkingHours > 0) {
    if (effectiveWorkingHours >= full) baseWorkStatus = 'P';
    else if (effectiveWorkingHours >= threeQuarterHrs) baseWorkStatus = '0.75P';
    else if (effectiveWorkingHours >= halfDayHrs) baseWorkStatus = '0.5P';
    else if (effectiveWorkingHours >= quarterDayHrs) baseWorkStatus = '0.25P';
    else baseWorkStatus = 'A';
  } else if (hasPunchIn && hasPunchOut) {
    baseWorkStatus = 'P'; // Fallback if no hours but complete punch
  }

  // 4. Layer Site Staff Specific Marks
  const dayOfWeek = day.getDay();
  const weeklyOffDays = userRules?.weeklyOffDays || [0];
  const isWeeklyOffDay = weeklyOffDays.includes(dayOfWeek);

  const isFullDayLeave = approvedLeave && approvedLeave.dayOption !== 'half' && approvedLeave.day_option !== 'half';
  const lType = approvedLeave ? String(approvedLeave.leaveType || approvedLeave.type || '').toLowerCase() : '';
  const isCorrectionOrPermission = approvedLeave && (
    lType.includes('correction') || 
    lType.includes('permission') || 
    String(approvedLeave.status || '').toLowerCase() === 'correction_made'
  );

  // NEW RULE: Approved full-day leaves take priority over physical presence, so if they applied for leave and it is approved, assign the leave-based notation.
  if (approvedLeave && isFullDayLeave && !isCorrectionOrPermission) {
    if (lType.includes('earned') || lType === 'e/l' || lType === 'el') {
       return 'EL';
    }
    if (lType.includes('sick') || lType === 's/l' || lType === 'sl') {
       return 'SL';
    }
    if (lType.includes('casual') || lType === 'c/l' || lType === 'cl') {
       return 'CL';
    }
    if (lType.includes('comp') || lType === 'c/o' || lType === 'co') {
       return 'CO';
    }
    if (lType.includes('floating') || lType === 'f/h' || lType === 'fh') {
       return 'FH';
    }
    if (lType.includes('pink')) {
       return 'PL';
    }
    if (lType.includes('maternity')) return 'ML';
    if (lType.includes('child care')) return 'CCL';
    return 'EL';
  }

  // CRITICAL: If employee actually worked (baseWorkStatus !== 'A'), their physical
  // presence takes priority over an approved full-day leave. The leave may have been
  // approved but the employee showed up and worked — credit their attendance.
  if (baseWorkStatus && baseWorkStatus !== 'A') {
    if (isHoliday) {
      // Overtime Rule: Only one H/P or 0.5H/P per day. 
      return baseWorkStatus === 'P' ? 'H/P' : '0.5H/P';
    }
    if (isWeeklyOffDay) {
      // Worked on weekly off -> W/P or W/0.5P
      return baseWorkStatus === 'P' ? 'W/P' : 'W/0.5P';
    }
    return baseWorkStatus;
  }

  // If not working, check for Leaves or Weekly Offs
  if (approvedLeave) {
    const lType = String(approvedLeave.leaveType || approvedLeave.type || '').toLowerCase();
    const isHalf = approvedLeave.dayOption === 'half' || approvedLeave.day_option === 'half';
    const prefix = isHalf ? '0.5' : '';
    
    if (lType.includes('permission')) {
      // Permission request not meeting full hours — show RP
      return prefix + 'RP';
    }
    if (lType.includes('correction')) {
      // Correction request not meeting full hours — show RC
      return prefix + 'RC';
    }
    if (lType.includes('earned') || lType === 'e/l' || lType === 'el') {
       return prefix + 'EL';
    }
    if (lType.includes('sick') || lType === 's/l' || lType === 'sl') {
       return prefix + 'SL';
    }
    if (lType.includes('casual') || lType === 'c/l' || lType === 'cl') {
       return prefix + 'CL';
    }
    if (lType.includes('comp') || lType === 'c/o' || lType === 'co') {
       return prefix + 'CO';
    }
    if (lType.includes('floating') || lType === 'f/h' || lType === 'fh') {
       return prefix + 'FH';
    }
    if (lType.includes('pink')) {
       return prefix + 'PL';
    }
    if (lType.includes('maternity')) return prefix + 'ML';
    if (lType.includes('child care')) return prefix + 'CCL';
    // Default leave mark if specific match not found
    return prefix + 'EL';
  }

  // Weekly Off logic
  if (isWeeklyOffDay) {
    const threshold = userRules?.weekendPresentThreshold ?? 3;
    const meetsThreshold = (daysPresentInWeek ?? 0) >= threshold;
    return meetsThreshold ? 'W/O' : 'A';
  }

  // Non-working Holiday logic (if it is a holiday but they didn't work)
  if (isHoliday) {
    return 'H'; // Or 0.5H if it's a half-day holiday
  }

  // Default to Absent
  return 'A';
}
