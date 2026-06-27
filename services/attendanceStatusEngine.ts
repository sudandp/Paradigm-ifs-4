/**
 * attendanceStatusEngine.ts — Configurable Attendance Status Engine
 * Module 3: Config-driven daily attendance status calculator
 *
 * Replaces the hardcoded logic scattered across:
 *   - get_attendance_dashboard_data() (SQL)
 *   - get_monthly_muster_data() (SQL)
 *   - MonthlyHoursReport.tsx (processEmployeeMonth)
 *   - attendanceDashboard.ts
 *
 * ALL thresholds come from StaffAttendanceRules (resolved by ruleEngine.ts).
 * NO hardcoded business logic. Every decision is traceable to a config field.
 */

import type { StaffAttendanceRules, AttendanceEvent, RecurringHolidayRule } from '../types/attendance';

// ---------------------------------------------------------------------------
// Status Code Enum
// ---------------------------------------------------------------------------

/**
 * Complete set of attendance status codes used across the system.
 * Extended beyond the original P/A/1/2P to include new engine states.
 */
export type AttendanceStatusCode =
  | 'P'           // Present (full day)
  | '1/2P'        // Half Day Present
  | '3/4P'        // Three-Quarter Day
  | '1/4P'        // Quarter Day
  | 'A'           // Absent
  | 'L'           // Leave (full day)
  | 'HL'          // Half Day Leave
  | 'H'           // Holiday (not worked)
  | 'H/P'         // Holiday Present — worked full day on a public holiday
  | '1/2H/P'      // Holiday Present half — worked half day on a public holiday
  | 'WO'          // Weekly Off (not worked)
  | 'W/P'         // Weekend Present — worked full day on weekly off
  | '1/2W/P'      // Weekend Present half — worked half day on weekly off
  | 'BL'          // Blue Leave (recurring holiday, not worked)
  | 'PL'          // Pink Leave
  | 'OT'          // Overtime (worked beyond shift threshold)
  | 'LOP'         // Loss of Pay
  | 'SH'          // Short Hours (below half-day threshold)
  | 'LATE'        // Present but punched in late
  | 'EARLY_EXIT'  // Present but punched out early
  | 'MISSED_PUNCH'// Check-in without check-out (or vice versa)
  | 'TRAVEL'      // On field travel
  | 'SITE_DUTY'   // Working at client site
  | 'WFH'         // Work From Home
  | 'INCOMPLETE'; // Today attendance not yet complete


export interface StatusLabel {
  code: AttendanceStatusCode;
  label: string;         // Full display label
  shortLabel: string;    // For muster grid
  category: 'present' | 'absent' | 'leave' | 'holiday' | 'off' | 'overtime' | 'special';
  countAsPresent: boolean;
  countAsAbsent: boolean;
  payable: boolean;
}

/** Master status definition table — config-driven labels */
export const STATUS_DEFINITIONS: Record<AttendanceStatusCode, StatusLabel> = {
  P:            { code: 'P',            label: 'Present',                 shortLabel: 'P',      category: 'present',  countAsPresent: true,  countAsAbsent: false, payable: true },
  '1/2P':       { code: '1/2P',         label: 'Half Day',                shortLabel: '1/2P',   category: 'present',  countAsPresent: true,  countAsAbsent: false, payable: true },
  '3/4P':       { code: '3/4P',         label: 'Three Quarter Day',       shortLabel: '3/4P',   category: 'present',  countAsPresent: true,  countAsAbsent: false, payable: true },
  '1/4P':       { code: '1/4P',         label: 'Quarter Day',             shortLabel: '1/4P',   category: 'present',  countAsPresent: true,  countAsAbsent: false, payable: true },
  A:            { code: 'A',            label: 'Absent',                  shortLabel: 'A',      category: 'absent',   countAsPresent: false, countAsAbsent: true,  payable: false },
  L:            { code: 'L',            label: 'On Leave',                shortLabel: 'L',      category: 'leave',    countAsPresent: false, countAsAbsent: false, payable: true },
  HL:           { code: 'HL',           label: 'Half Day Leave',          shortLabel: 'HL',     category: 'leave',    countAsPresent: false, countAsAbsent: false, payable: true },
  H:            { code: 'H',            label: 'Holiday',                 shortLabel: 'H',      category: 'holiday',  countAsPresent: false, countAsAbsent: false, payable: true },
  'H/P':        { code: 'H/P',          label: 'Holiday Present',         shortLabel: 'H/P',    category: 'overtime', countAsPresent: true,  countAsAbsent: false, payable: true },
  '1/2H/P':     { code: '1/2H/P',       label: 'Holiday Present (Half)',   shortLabel: '1/2H/P', category: 'overtime', countAsPresent: true,  countAsAbsent: false, payable: true },
  WO:           { code: 'WO',           label: 'Week Off',                shortLabel: 'WO',     category: 'off',      countAsPresent: false, countAsAbsent: false, payable: false },
  'W/P':        { code: 'W/P',          label: 'Weekend Present',         shortLabel: 'W/P',    category: 'overtime', countAsPresent: true,  countAsAbsent: false, payable: true },
  '1/2W/P':     { code: '1/2W/P',       label: 'Weekend Present (Half)',   shortLabel: '1/2W/P', category: 'overtime', countAsPresent: true,  countAsAbsent: false, payable: true },
  BL:           { code: 'BL',           label: 'Blue Leave',              shortLabel: 'BL',     category: 'holiday',  countAsPresent: false, countAsAbsent: false, payable: true },
  PL:           { code: 'PL',           label: 'Pink Leave',              shortLabel: 'PL',     category: 'holiday',  countAsPresent: false, countAsAbsent: false, payable: true },
  OT:           { code: 'OT',           label: 'Overtime',                shortLabel: 'OT',     category: 'overtime', countAsPresent: true,  countAsAbsent: false, payable: true },
  LOP:          { code: 'LOP',          label: 'Loss of Pay',             shortLabel: 'LOP',    category: 'absent',   countAsPresent: false, countAsAbsent: true,  payable: false },
  SH:           { code: 'SH',           label: 'Short Hours',             shortLabel: 'SH',     category: 'absent',   countAsPresent: false, countAsAbsent: true,  payable: false },
  LATE:         { code: 'LATE',         label: 'Late Present',            shortLabel: 'LP',     category: 'present',  countAsPresent: true,  countAsAbsent: false, payable: true },
  EARLY_EXIT:   { code: 'EARLY_EXIT',   label: 'Early Exit',              shortLabel: 'EE',     category: 'present',  countAsPresent: true,  countAsAbsent: false, payable: true },
  MISSED_PUNCH: { code: 'MISSED_PUNCH', label: 'Missed Punch',            shortLabel: 'MP',     category: 'special',  countAsPresent: false, countAsAbsent: false, payable: false },
  TRAVEL:       { code: 'TRAVEL',       label: 'Travel',                  shortLabel: 'TR',     category: 'present',  countAsPresent: true,  countAsAbsent: false, payable: true },
  SITE_DUTY:    { code: 'SITE_DUTY',    label: 'Site Duty',               shortLabel: 'SD',     category: 'present',  countAsPresent: true,  countAsAbsent: false, payable: true },
  WFH:          { code: 'WFH',          label: 'Work From Home',          shortLabel: 'WFH',    category: 'present',  countAsPresent: true,  countAsAbsent: false, payable: true },
  INCOMPLETE:   { code: 'INCOMPLETE',   label: 'Incomplete',              shortLabel: 'IC',     category: 'special',  countAsPresent: false, countAsAbsent: false, payable: false },
};


// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface DayAttendanceInput {
  date: Date;
  isToday: boolean;

  /** All attendance events for this day (pre-filtered for this user + date) */
  events: AttendanceEvent[];

  /** Leave request covering this day (if any, status=approved) */
  approvedLeave?: {
    leaveType: string;
    dayOption?: 'full' | 'half';
  } | null;

  /** Is this day a public holiday? */
  holiday?: { name: string; type: string } | null;

  /** Is this day a recurring holiday (e.g. 3rd Saturday)? */
  recurringHoliday?: RecurringHolidayRule | null;

  /** Is this day in the user's weekly off pattern? */
  isWeeklyOff?: boolean;

  /** User's weekly off day indices (from resolved rules) */
  weeklyOffDays?: number[];
}

export interface DayAttendanceResult {
  statusCode: AttendanceStatusCode;
  statusLabel: string;
  shortLabel: string;
  category: StatusLabel['category'];
  countAsPresent: boolean;
  countAsAbsent: boolean;
  payable: boolean;

  // Time data
  firstCheckIn: Date | null;
  lastCheckOut: Date | null;
  workHours: number;
  siteHours: number;
  travelHours: number;
  breakMinutes: number;

  // Flags
  isLate: boolean;
  isEarlyExit: boolean;
  isMissedPunch: boolean;
  isManual: boolean;
  isOverride: boolean;

  // Detail
  minutesLate: number;
  minutesEarlyExit: number;
  otHours: number;
  shiftDetected?: string;

  // Debug / audit
  decisionPath: string[];
}

// ---------------------------------------------------------------------------
// Core status evaluator — PURE FUNCTION (testable, no DB calls)
// ---------------------------------------------------------------------------

/**
 * Evaluates the attendance status for a single day.
 * ALL thresholds come from `rules` — no hardcoded values anywhere.
 *
 * @param input   Day attendance data (events, leaves, holidays)
 * @param rules   Resolved StaffAttendanceRules for this user
 * @returns       Complete daily attendance result
 */
export function evaluateDayAttendance(
  input: DayAttendanceInput,
  rules: StaffAttendanceRules
): DayAttendanceResult {
  const decisionPath: string[] = [];
  const { date, events, approvedLeave, holiday, recurringHoliday, isToday } = input;

  // Defaults
  let statusCode: AttendanceStatusCode = 'A';
  let workHours = 0;
  let siteHours = 0;
  let travelHours = 0;
  let breakMinutes = 0;
  let otHours = 0;
  let firstCheckIn: Date | null = null;
  let lastCheckOut: Date | null = null;
  let isLate = false;
  let isEarlyExit = false;
  let isMissedPunch = false;
  let isManual = false;
  let minutesLate = 0;
  let minutesEarlyExit = 0;
  let shiftDetected: string | undefined;

  // ---------------------------------------------------------------------------
  // Step 1: Approved Leave (highest display priority for status)
  // ---------------------------------------------------------------------------
  if (approvedLeave) {
    const lt = approvedLeave.leaveType;
    decisionPath.push(`approved-leave:${lt}`);

    if (lt === 'WFH') {
      statusCode = 'WFH';
    } else if (lt === 'Loss of Pay') {
      statusCode = 'LOP';
    } else if (approvedLeave.dayOption === 'half') {
      statusCode = 'HL';
    } else {
      statusCode = 'L';
    }

    return buildResult(statusCode, decisionPath, {
      workHours, siteHours, travelHours, breakMinutes, otHours,
      firstCheckIn, lastCheckOut, isLate, isEarlyExit, isMissedPunch,
      isManual: false, isOverride: false, minutesLate, minutesEarlyExit, shiftDetected,
    });
  }

  // ---------------------------------------------------------------------------
  // Step 2: Weekly Off
  // ---------------------------------------------------------------------------
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
  const weeklyOffDays = rules.weeklyOffDays ?? [0];

  if (weeklyOffDays.includes(dayOfWeek)) {
    decisionPath.push(`weekly-off:day=${dayOfWeek}`);

    if (events.some((e) => ['punch-in', 'check-in', 'site-in'].includes(e.type))) {
      // Worked on weekly off day — will resolve to W/P or 1/2W/P after hours are computed
      decisionPath.push('worked-on-wo:will-resolve-to-W/P');
      // Use a sentinel — resolved after hours computation in Step 10
      statusCode = 'W/P'; // placeholder, refined to 1/2W/P if half-day hours
      // Fall through to compute hours
    } else {
      statusCode = 'WO';
      return buildResult(statusCode, decisionPath, {
        workHours, siteHours, travelHours, breakMinutes, otHours,
        firstCheckIn, lastCheckOut, isLate, isEarlyExit, isMissedPunch,
        isManual: false, isOverride: false, minutesLate, minutesEarlyExit, shiftDetected,
      });
    }
  }


  // ---------------------------------------------------------------------------
  // Step 3: Recurring Holiday (e.g. 3rd Saturday)
  // ---------------------------------------------------------------------------
  if (recurringHoliday && !weeklyOffDays.includes(dayOfWeek)) {
    decisionPath.push(`recurring-holiday:${recurringHoliday.name || recurringHoliday.n + 'th ' + recurringHoliday.day}`);
    statusCode = 'BL'; // Blue Leave by default for recurring holidays
    return buildResult(statusCode, decisionPath, {
      workHours, siteHours, travelHours, breakMinutes, otHours,
      firstCheckIn, lastCheckOut, isLate, isEarlyExit, isMissedPunch,
      isManual: false, isOverride: false, minutesLate, minutesEarlyExit, shiftDetected,
    });
  }

  // ---------------------------------------------------------------------------
  // Step 4: Public Holiday
  // ---------------------------------------------------------------------------
  if (holiday) {
    decisionPath.push(`holiday:${holiday.name}`);

    if (events.some((e) => ['punch-in', 'check-in', 'site-in'].includes(e.type))) {
      // Worked on public holiday — will resolve to H/P or 1/2H/P after hours are computed
      decisionPath.push('worked-on-holiday:will-resolve-to-H/P');
      statusCode = 'H/P'; // placeholder, refined to 1/2H/P if half-day hours
      // Fall through to compute hours
    } else {
      statusCode = 'H';
      return buildResult(statusCode, decisionPath, {
        workHours, siteHours, travelHours, breakMinutes, otHours,
        firstCheckIn, lastCheckOut, isLate, isEarlyExit, isMissedPunch,
        isManual: false, isOverride: false, minutesLate, minutesEarlyExit, shiftDetected,
      });
    }
  }


  // ---------------------------------------------------------------------------
  // Step 5: Compute hours from events
  // ---------------------------------------------------------------------------
  const checkInEvents = events.filter((e) =>
    ['punch-in', 'check-in', 'Site In'].includes(e.type)
  );
  const checkOutEvents = events.filter((e) =>
    ['punch-out', 'check-out', 'Site Out'].includes(e.type)
  );
  const siteInEvents = events.filter((e) => e.type === 'site-in');
  const siteOutEvents = events.filter((e) => e.type === 'site-out');
  const breakInEvents = events.filter((e) => e.type === 'break-in');
  const breakOutEvents = events.filter((e) => e.type === 'break-out');

  const anyCheckIn = checkInEvents.length > 0;
  const anyCheckOut = checkOutEvents.length > 0;

  isManual = events.some((e) => e.isManual);

  if (anyCheckIn) {
    firstCheckIn = new Date(
      Math.min(...checkInEvents.map((e) => new Date(e.timestamp).getTime()))
    );
    shiftDetected = events.find((e) => e.detectedShiftId)?.detectedShiftId;
  }

  if (anyCheckOut) {
    lastCheckOut = new Date(
      Math.max(...checkOutEvents.map((e) => new Date(e.timestamp).getTime()))
    );
  }

  // Compute total work hours (check-in to check-out)
  if (firstCheckIn && lastCheckOut) {
    workHours = (lastCheckOut.getTime() - firstCheckIn.getTime()) / 3_600_000;
  }

  // Compute break minutes
  if (rules.enableBreakTracking && breakInEvents.length > 0) {
    for (const bi of breakInEvents) {
      const biTime = new Date(bi.timestamp).getTime();
      const matchingOut = breakOutEvents
        .filter((bo) => new Date(bo.timestamp).getTime() > biTime)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];

      if (matchingOut) {
        breakMinutes += (new Date(matchingOut.timestamp).getTime() - biTime) / 60_000;
      }
    }
  }

  // Compute site hours (site-in to site-out pairs)
  for (const si of siteInEvents) {
    const siTime = new Date(si.timestamp).getTime();
    const matchingOut = siteOutEvents
      .filter((so) => new Date(so.timestamp).getTime() > siTime)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];

    if (matchingOut) {
      siteHours += (new Date(matchingOut.timestamp).getTime() - siTime) / 3_600_000;
    }
  }

  travelHours = Math.max(0, workHours - siteHours - breakMinutes / 60);

  // ---------------------------------------------------------------------------
  // Step 6: Late check-in detection (config-driven grace period)
  // ---------------------------------------------------------------------------
  if (firstCheckIn && rules.fixedOfficeHours?.checkInTime) {
    const [h, m] = rules.fixedOfficeHours.checkInTime.split(':').map(Number);
    const scheduledIn = new Date(date);
    scheduledIn.setHours(h, m, 0, 0);
    const gracePeriod = rules.gracePeriodMinutes ?? 15;
    const lateThreshold = new Date(scheduledIn.getTime() + gracePeriod * 60_000);

    if (firstCheckIn > lateThreshold) {
      isLate = true;
      minutesLate = Math.round((firstCheckIn.getTime() - lateThreshold.getTime()) / 60_000);
      decisionPath.push(`late:${minutesLate}min`);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 7: Early exit detection
  // ---------------------------------------------------------------------------
  if (lastCheckOut && rules.fixedOfficeHours?.checkOutTime) {
    const [h, m] = rules.fixedOfficeHours.checkOutTime.split(':').map(Number);
    const scheduledOut = new Date(date);
    scheduledOut.setHours(h, m, 0, 0);

    if (lastCheckOut < scheduledOut) {
      isEarlyExit = true;
      minutesEarlyExit = Math.round(
        (scheduledOut.getTime() - lastCheckOut.getTime()) / 60_000
      );
      decisionPath.push(`early-exit:${minutesEarlyExit}min`);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 8: Missed punch detection
  // ---------------------------------------------------------------------------
  if (anyCheckIn && !anyCheckOut && !isToday) {
    isMissedPunch = true;
    decisionPath.push('missed-punch:no-checkout');
  }

  // ---------------------------------------------------------------------------
  // Step 9: OT hours
  // ---------------------------------------------------------------------------
  const maxHours = rules.dailyWorkingHours?.max ?? 9;
  if (workHours > maxHours) {
    otHours = workHours - maxHours;
    decisionPath.push(`ot:${otHours.toFixed(2)}h`);
  }

  // ---------------------------------------------------------------------------
  // Step 10: Status resolution (all thresholds from rules)
  // ---------------------------------------------------------------------------

  // Resolve sentinel placeholders set in Steps 2 and 4
  const isWorkingOnHoliday = statusCode === 'H/P';
  const isWorkingOnWO      = statusCode === 'W/P';

  if (!anyCheckIn) {
    decisionPath.push('no-events:Absent');
    statusCode = 'A';
  } else if (isMissedPunch) {
    decisionPath.push('missed-punch-status:MISSED_PUNCH');
    statusCode = 'MISSED_PUNCH';
  } else if (anyCheckIn && !anyCheckOut && isToday) {
    decisionPath.push('today-incomplete:INCOMPLETE');
    statusCode = 'INCOMPLETE';
  } else if (workHours >= (rules.minimumHoursFullDay ?? 9)) {
    if (isWorkingOnHoliday) {
      decisionPath.push(`holiday-present-full:H/P(${workHours.toFixed(2)}h)`);
      statusCode = 'H/P';
    } else if (isWorkingOnWO) {
      decisionPath.push(`weekend-present-full:W/P(${workHours.toFixed(2)}h)`);
      statusCode = 'W/P';
    } else if (isLate) {
      decisionPath.push(`full-hours-late:LATE(${workHours.toFixed(2)}h)`);
      statusCode = 'LATE';
    } else if (isEarlyExit) {
      decisionPath.push(`full-hours-early-exit:EARLY_EXIT(${workHours.toFixed(2)}h)`);
      statusCode = 'EARLY_EXIT';
    } else if (siteHours > 0 && siteInEvents.length > 0) {
      decisionPath.push(`site-duty:SITE_DUTY(${siteHours.toFixed(2)}h)`);
      statusCode = 'SITE_DUTY';
    } else {
      decisionPath.push(`full-day:P(${workHours.toFixed(2)}h>=${rules.minimumHoursFullDay}h)`);
      statusCode = 'P';
    }
  } else if (rules.threeQuarterDayHours && workHours >= rules.threeQuarterDayHours) {
    decisionPath.push(`3q-day:3/4P(${workHours.toFixed(2)}h>=${rules.threeQuarterDayHours}h)`);
    statusCode = '3/4P';
  } else if (workHours >= (rules.minimumHoursHalfDay ?? 4.5)) {
    if (isWorkingOnHoliday) {
      decisionPath.push(`holiday-present-half:1/2H/P(${workHours.toFixed(2)}h)`);
      statusCode = '1/2H/P';
    } else if (isWorkingOnWO) {
      decisionPath.push(`weekend-present-half:1/2W/P(${workHours.toFixed(2)}h)`);
      statusCode = '1/2W/P';
    } else {
      decisionPath.push(`half-day:1/2P(${workHours.toFixed(2)}h>=${rules.minimumHoursHalfDay}h)`);
      statusCode = '1/2P';
    }
  } else if (rules.quarterDayHours && workHours >= rules.quarterDayHours) {
    decisionPath.push(`qtr-day:1/4P(${workHours.toFixed(2)}h>=${rules.quarterDayHours}h)`);
    statusCode = '1/4P';
  } else if (workHours > 0) {
    decisionPath.push(`short-hours:SH(${workHours.toFixed(2)}h)`);
    statusCode = 'SH';
  } else {
    decisionPath.push('no-work-hours:Absent');

    statusCode = 'A';
  }

  return buildResult(statusCode, decisionPath, {
    workHours, siteHours, travelHours, breakMinutes, otHours,
    firstCheckIn, lastCheckOut, isLate, isEarlyExit, isMissedPunch,
    isManual, isOverride: false, minutesLate, minutesEarlyExit, shiftDetected,
  });
}

// ---------------------------------------------------------------------------
// Helper — builds the full result object from status code + computed data
// ---------------------------------------------------------------------------

function buildResult(
  statusCode: AttendanceStatusCode,
  decisionPath: string[],
  data: {
    workHours: number;
    siteHours: number;
    travelHours: number;
    breakMinutes: number;
    otHours: number;
    firstCheckIn: Date | null;
    lastCheckOut: Date | null;
    isLate: boolean;
    isEarlyExit: boolean;
    isMissedPunch: boolean;
    isManual: boolean;
    isOverride: boolean;
    minutesLate: number;
    minutesEarlyExit: number;
    shiftDetected?: string;
  }
): DayAttendanceResult {
  const def = STATUS_DEFINITIONS[statusCode];
  return {
    statusCode,
    statusLabel: def.label,
    shortLabel: def.shortLabel,
    category: def.category,
    countAsPresent: def.countAsPresent,
    countAsAbsent: def.countAsAbsent,
    payable: def.payable,
    decisionPath,
    ...data,
  };
}

// ---------------------------------------------------------------------------
// Payable days calculator — config-driven
// ---------------------------------------------------------------------------

export interface MonthlyPayableSummary {
  presentDays: number;
  halfDays: number;
  threeQuarterDays: number;
  quarterDays: number;
  absentDays: number;
  weekOffDays: number;
  holidayDays: number;
  leaveDays: number;
  lossOfPayDays: number;
  otHours: number;
  otDays: number;
  lateDays: number;
  earlyExitDays: number;
  missedPunchDays: number;
  totalPayableDays: number;
  totalWorkHours: number;
  avgWorkHours: number;
  siteHours: number;
  travelHours: number;
}

/**
 * Aggregates daily results into a monthly payable summary.
 * All counting logic is config-driven via STATUS_DEFINITIONS.
 */
export function computeMonthlyPayable(
  dailyResults: DayAttendanceResult[],
  rules: StaffAttendanceRules
): MonthlyPayableSummary {
  let presentDays = 0;
  let halfDays = 0;
  let threeQuarterDays = 0;
  let quarterDays = 0;
  let absentDays = 0;
  let weekOffDays = 0;
  let holidayDays = 0;
  let leaveDays = 0;
  let lossOfPayDays = 0;
  let otHours = 0;
  let lateDays = 0;
  let earlyExitDays = 0;
  let missedPunchDays = 0;
  let totalWorkHours = 0;
  let siteHours = 0;
  let travelHours = 0;

  for (const day of dailyResults) {
    totalWorkHours += day.workHours;
    siteHours += day.siteHours;
    travelHours += day.travelHours;
    otHours += day.otHours;

    switch (day.statusCode) {
      case 'P':
      case 'SITE_DUTY':
      case 'WFH':
        presentDays += 1;
        break;
      case 'LATE':
        presentDays += 1;
        lateDays += 1;
        break;
      case 'EARLY_EXIT':
        presentDays += 1;
        earlyExitDays += 1;
        break;
      case 'TRAVEL':
        presentDays += 1;
        break;
      case 'OT':
        presentDays += 1;
        break;
      // Compound holiday/weekend present codes — count as present (+ holiday/WO base)
      case 'H/P':
        presentDays += 1;
        holidayDays += 1; // base holiday pay
        break;
      case '1/2H/P':
        presentDays += 0.5;
        holidayDays += 1; // full holiday base pay even for half-day work
        break;
      case 'W/P':
        presentDays += 1;
        weekOffDays += 1;
        break;
      case '1/2W/P':
        presentDays += 0.5;
        weekOffDays += 1;
        break;

      case '3/4P':
        threeQuarterDays += 1;
        break;
      case '1/2P':
        halfDays += 1;
        break;
      case '1/4P':
        quarterDays += 1;
        break;
      case 'A':
      case 'SH':
        absentDays += 1;
        break;
      case 'LOP':
        lossOfPayDays += 1;
        absentDays += 1;
        break;
      case 'MISSED_PUNCH':
        missedPunchDays += 1;
        break;
      case 'WO':
        weekOffDays += 1;
        break;
      case 'H':
      case 'BL':
      case 'PL':
        holidayDays += 1;
        break;
      case 'L':
        leaveDays += 1;
        break;
      case 'HL':
        leaveDays += 0.5;
        break;
    }
  }

  // Payable days formula (configurable via rules when payroll engine is ready)
  // Current: P + 3/4*3/4P + 0.5*halfDay + 0.25*quarterDay + holidays + leaves - LOP
  const otDays = rules.enableOtToCompOffConversion && rules.otConversionThreshold
    ? Math.floor(otHours / rules.otConversionThreshold)
    : 0;

  const totalPayableDays =
    presentDays +
    threeQuarterDays * 0.75 +
    halfDays * 0.5 +
    quarterDays * 0.25 +
    holidayDays +
    leaveDays -
    lossOfPayDays;

  const avgWorkHours = totalWorkHours > 0 && dailyResults.length > 0
    ? totalWorkHours / dailyResults.length
    : 0;

  return {
    presentDays,
    halfDays,
    threeQuarterDays,
    quarterDays,
    absentDays,
    weekOffDays,
    holidayDays,
    leaveDays,
    lossOfPayDays,
    otHours,
    otDays,
    lateDays,
    earlyExitDays,
    missedPunchDays,
    totalPayableDays: Math.max(0, totalPayableDays),
    totalWorkHours,
    avgWorkHours,
    siteHours,
    travelHours,
  };
}

// ---------------------------------------------------------------------------
// Helper — check if a day is a recurring holiday for this user
// ---------------------------------------------------------------------------

export function getRecurringHoliday(
  date: Date,
  rules: StaffAttendanceRules
): RecurringHolidayRule | null {
  if (!rules.recurringHolidays || rules.recurringHolidays.length === 0) return null;

  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    date.getDay()
  ] as RecurringHolidayRule['day'];

  const dayOfMonth = date.getDate();

  for (const rh of rules.recurringHolidays) {
    if (rh.day !== dayName) continue;

    // Calculate the nth occurrence of this weekday in the month
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstOccurrenceDay = firstOfMonth.getDay();
    const daysUntilTarget =
      ((date.getDay() - firstOccurrenceDay + 7) % 7);
    const firstOccurrenceDate = 1 + daysUntilTarget;
    const occurrence = Math.ceil((dayOfMonth - firstOccurrenceDate + 1) / 7);

    if (occurrence === rh.n) return rh;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helper — determine if a day is weekly off for this user (supports patterns)
// ---------------------------------------------------------------------------

export type WeeklyOffPattern = 'fixed' | 'rotational' | 'alternate_saturday' | '2nd_4th_saturday';

export function isWeeklyOffDay(
  date: Date,
  rules: StaffAttendanceRules,
  pattern: WeeklyOffPattern = 'fixed',
  joinDate?: Date
): boolean {
  const dayOfWeek = date.getDay();
  const weeklyOffDays = rules.weeklyOffDays ?? [0];

  switch (pattern) {
    case 'fixed':
      return weeklyOffDays.includes(dayOfWeek);

    case 'alternate_saturday': {
      if (dayOfWeek !== 6) return weeklyOffDays.includes(dayOfWeek);
      // Alternate Saturday: off if 1st, 3rd (odd) week within month
      const dayOfMonth = date.getDate();
      const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const firstSaturdayOffset = (6 - firstOfMonth.getDay() + 7) % 7;
      const firstSaturdayDate = 1 + firstSaturdayOffset;
      const saturdayIndex = Math.floor((dayOfMonth - firstSaturdayDate) / 7); // 0-based
      return saturdayIndex % 2 === 0; // 0=1st, 2=3rd → off
    }

    case '2nd_4th_saturday': {
      if (dayOfWeek !== 6) return weeklyOffDays.includes(dayOfWeek);
      const dayOfMonth = date.getDate();
      const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const firstSaturdayOffset = (6 - firstOfMonth.getDay() + 7) % 7;
      const firstSaturdayDate = 1 + firstSaturdayOffset;
      const saturdayIndex = Math.floor((dayOfMonth - firstSaturdayDate) / 7); // 0-based
      return saturdayIndex === 1 || saturdayIndex === 3; // 2nd (idx=1) and 4th (idx=3)
    }

    case 'rotational': {
      // Rotational: each week, the off day rotates by 1
      // Requires joinDate to compute rotation offset
      if (!joinDate) return weeklyOffDays.includes(dayOfWeek);
      const weeksSinceJoin = Math.floor(
        (date.getTime() - joinDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      const baseOffDay = weeklyOffDays[0] ?? 0;
      const rotatedOffDay = (baseOffDay + weeksSinceJoin) % 7;
      return dayOfWeek === rotatedOffDay;
    }

    default:
      return weeklyOffDays.includes(dayOfWeek);
  }
}
