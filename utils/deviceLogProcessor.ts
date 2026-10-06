/**
 * Device Log Processor — Paradigm FMS
 *
 * Converts raw biometric punch records (biometric_device_logs) into
 * fully-resolved daily attendance records (ProcessedAttendanceRecord)
 * using the 7 Prioritized Scenario Rules.
 *
 * 7 PRIORITIZED SCENARIO RULES:
 *   R1 & R6: Night C-Shift Overnight Stitching (20:00–23:59 In -> 00:00–09:30 Out next morning consumed)
 *   R2     : Double Shift Detection (A+B, B+C -> 2 full duties, combined OT)
 *   R3     : Timing Conflict Resolution (A+C overlap -> primary duty + OT)
 *   R4     : Dynamic Roster Weekly Off (Overrides default Sunday with staff schedule)
 *   R5     : Work on Weekly Off (W/P -> Valid duty credit, not wiped or marked absent)
 *   R7     : Absent vs. Missed Punch (0 punches = Absent; 1 unanchored punch = Missed Punch)
 */

import type { SiteShiftDefinition } from '../types/attendance';
import type { SiteHoliday } from '../services/attendanceRosterService';
import { detectShift, getShiftDurationHours, timeToMinutes } from './shiftDetection';
import { isWeeklyOff } from './weeklyOffUtils';

// ── Shared Types ─────────────────────────────────────────────────────────────

/** Raw punch as returned by api.getBiometricDeviceLogs() */
export interface DevicePunchLog {
  id?: string;
  downloadDate?: string;
  userId: string;       // emp_code
  empCode?: string;     // alias
  logDate: string;      // ISO timestamp of the punch
  deviceName?: string;
  serialNo?: string;
  attState?: string;    // 'Check In' | 'Check Out' | '' | 'in' | 'out'
  direction?: string;   // 'in' | 'out'
  verifyMode?: string;
  gps?: string;
  attPhoto?: string;
}

/** Per-employee configuration required by the processor */
export interface EmployeeProcessingConfig {
  empCode: string;
  staffName?: string;
  department?: string;
  designation?: string;
  /** Primary weekly off day numbers (0=Sun … 6=Sat) */
  weeklyOffDays: number[];
  /** Optional secondary weekly off day numbers (e.g. Manohar: Sun + Wed) */
  weeklyOffDays2?: number[];
  /** Pre-assigned shift id; if null the shift is auto-detected */
  assignedShiftId?: string | null;
  /** Whether this employee record is inactive (no longer employed) */
  isInactive?: boolean;
  /** Employee's site id — used for holiday and shift lookup */
  siteId?: string;
}

/** Final output record written to public.processed_attendance */
export interface ProcessedAttendanceRecord {
  empCode: string;
  empName?: string;
  department?: string;
  designation?: string;
  attendanceDate: string;            // 'YYYY-MM-DD'
  inTime: string | null;             // 'HH:mm' 24h
  outTime: string | null;            // 'HH:mm' 24h
  grossMins: number;
  netMins: number;
  otMins: number;
  lateMinutes: number;
  earlyExitMins: number;
  workingHours?: string;
  status: 'P' | 'A' | 'W/O' | 'W/P' | 'H' | 'Late' | 'Missed Punch' | '–' | 'Pending';
  statusCode?: string;
  shiftId: string | null;
  shiftName: string;
  shiftType?: 'single' | 'double' | 'split';
  totalDuties?: number;              // 1.0 (standard), 2.0 (double), 0.5 (half)
  shiftCompleted?: boolean;
  isWeeklyOff?: boolean;
  isNightShift?: boolean;
  isNextDayOut?: boolean;
  ruleApplied?: string;              // 'R1-C_BRIDGE', 'R2-DOUBLE_AB', 'R2-DOUBLE_BC', 'R3-CONFLICT_RES', 'R4-ROSTER_WO', 'R5-WP', 'R7-ABSENT', 'MISSED_PUNCH'
  rawPunchCount?: number;
  remarks?: string;
  siteId: string | null;
  source: 'device_log' | 'manual' | 'mssql';
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function hhmToMins(hhmm: string): number {
  return timeToMinutes(hhmm);
}

function formatMinsToHM(mins: number): string {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

interface NormalizedPunch {
  id: string;
  time: Date;
  dateStr: string;     // YYYY-MM-DD
  hhmm: string;
  hour: number;
  mins: number;
  deviceName: string;
}

// ── Main Processor Engine ────────────────────────────────────────────────────

/**
 * Process raw biometric punches into daily attendance records using 7 Scenario Rules.
 */
export function processDeviceLogs(
  logs: DevicePunchLog[],
  employees: EmployeeProcessingConfig[],
  shiftDefs: SiteShiftDefinition[] = [],
  siteHolidays: SiteHoliday[] = [],
  graceMinutes: number = 15,
  breakDeductionMins: number = 30,
): ProcessedAttendanceRecord[] {

  const empMap: Map<string, EmployeeProcessingConfig> = new Map(
    employees.map(e => [e.empCode, e])
  );
  const shiftById: Map<string, SiteShiftDefinition> = new Map(
    shiftDefs.map(s => [s.id, s])
  );
  const holidayDateSet: Set<string> = new Set(
    siteHolidays.map(h => h.date?.slice(0, 10)).filter(Boolean) as string[]
  );

  // 1. Normalize and clean punches by employee
  const punchesByEmp: Map<string, NormalizedPunch[]> = new Map();

  for (const log of logs) {
    const emp = String(log.userId || log.empCode || '').trim();
    if (!emp) continue;

    const punchDate = new Date(log.logDate);
    if (isNaN(punchDate.getTime())) continue;

    if (!punchesByEmp.has(emp)) {
      punchesByEmp.set(emp, []);
    }

    punchesByEmp.get(emp)!.push({
      id: log.id || `${emp}_${punchDate.getTime()}`,
      time: punchDate,
      dateStr: toDateString(punchDate),
      hhmm: toHHMM(punchDate),
      hour: punchDate.getHours(),
      mins: punchDate.getMinutes(),
      deviceName: log.deviceName || 'Device',
    });
  }

  // Ensure all configured employees exist in processing list even if 0 punches
  for (const emp of employees) {
    if (!punchesByEmp.has(emp.empCode)) {
      punchesByEmp.set(emp.empCode, []);
    }
  }

  const results: ProcessedAttendanceRecord[] = [];

  // 2. Process each employee independently across their timeline
  for (const [empCode, empPunches] of punchesByEmp) {
    const empConf = empMap.get(empCode);
    const siteId = empConf?.siteId ?? null;

    // Sort chronologically
    empPunches.sort((a, b) => a.time.getTime() - b.time.getTime());

    // Debounce rapid multi-punches (< 60 seconds)
    const debouncedPunches: NormalizedPunch[] = [];
    for (const p of empPunches) {
      const last = debouncedPunches[debouncedPunches.length - 1];
      if (!last || (p.time.getTime() - last.time.getTime()) >= 60000) {
        debouncedPunches.push(p);
      }
    }

    // Determine the calendar date span
    const dateSet = new Set<string>();
    for (const p of debouncedPunches) {
      dateSet.add(p.dateStr);
    }

    const sortedDates = Array.from(dateSet).sort();
    if (sortedDates.length === 0) {
      // No punches at all for this employee — nothing to process
      continue;
    }

    // Index punches by date
    const punchesByDate = new Map<string, NormalizedPunch[]>();
    for (const p of debouncedPunches) {
      if (!punchesByDate.has(p.dateStr)) punchesByDate.set(p.dateStr, []);
      punchesByDate.get(p.dateStr)!.push(p);
    }

    // Track punches consumed by night-shift cross-day stitching (R1 / R6)
    const consumedPunchIds = new Set<string>();

    // Iterate through all active dates
    for (let i = 0; i < sortedDates.length; i++) {
      const curDateStr = sortedDates[i];
      const curDateObj = new Date(`${curDateStr}T00:00:00`);
      const nextDateStr = toDateString(addDays(curDateObj, 1));

      // Available punches for today (excluding consumed ones)
      const allTodayPunches = (punchesByDate.get(curDateStr) || [])
        .filter(p => !consumedPunchIds.has(p.id));

      // Next day early morning punches (00:00 to 09:30) for crossover stitching
      const nextDayMorningPunches = (punchesByDate.get(nextDateStr) || [])
        .filter(p => !consumedPunchIds.has(p.id) && (p.hour < 9 || (p.hour === 9 && p.mins <= 30)));

      // Employee configuration checks
      const isInactive = empConf?.isInactive ?? false;
      const isHoliday  = holidayDateSet.has(curDateStr);
      const isWO = empConf
        ? (isWeeklyOff(curDateObj, empConf.weeklyOffDays) || (empConf.weeklyOffDays2 ? isWeeklyOff(curDateObj, empConf.weeklyOffDays2) : false))
        : false;

      // Handle inactive employee
      if (isInactive) {
        results.push({
          empCode,
          empName: empConf?.staffName,
          department: empConf?.department,
          designation: empConf?.designation,
          attendanceDate: curDateStr,
          inTime: null, outTime: null,
          grossMins: 0, netMins: 0, otMins: 0,
          lateMinutes: 0, earlyExitMins: 0,
          status: '–', statusCode: '–',
          shiftId: null, shiftName: 'NS',
          shiftType: 'single', totalDuties: 0,
          siteId, source: 'device_log',
          ruleApplied: 'INACTIVE',
        });
        continue;
      }

      // If zero punches left on this date
      if (allTodayPunches.length === 0) {
        if (isWO) {
          results.push({
            empCode,
            empName: empConf?.staffName,
            department: empConf?.department,
            designation: empConf?.designation,
            attendanceDate: curDateStr,
            inTime: null, outTime: null,
            grossMins: 0, netMins: 0, otMins: 0,
            lateMinutes: 0, earlyExitMins: 0,
            status: 'W/O', statusCode: 'WO',
            shiftId: null, shiftName: 'WO',
            shiftType: 'single', totalDuties: 0,
            isWeeklyOff: true,
            siteId, source: 'device_log',
            ruleApplied: 'R4-ROSTER_WO',
          });
        } else if (isHoliday) {
          results.push({
            empCode,
            empName: empConf?.staffName,
            department: empConf?.department,
            designation: empConf?.designation,
            attendanceDate: curDateStr,
            inTime: null, outTime: null,
            grossMins: 0, netMins: 0, otMins: 0,
            lateMinutes: 0, earlyExitMins: 0,
            status: 'H', statusCode: 'H',
            shiftId: null, shiftName: 'HOL',
            shiftType: 'single', totalDuties: 0,
            siteId, source: 'device_log',
            ruleApplied: 'HOLIDAY',
          });
        } else {
          results.push({
            empCode,
            empName: empConf?.staffName,
            department: empConf?.department,
            designation: empConf?.designation,
            attendanceDate: curDateStr,
            inTime: null, outTime: null,
            grossMins: 0, netMins: 0, otMins: 0,
            lateMinutes: 0, earlyExitMins: 0,
            status: 'A', statusCode: 'A',
            shiftId: null, shiftName: '',
            shiftType: 'single', totalDuties: 0,
            siteId, source: 'device_log',
            ruleApplied: 'R7-ABSENT',
          });
        }
        continue;
      }

      // ── Apply Scenario Rules R1–R7 ──────────────────────────────────────────

      const firstPunch = allTodayPunches[0];
      const lastPunch  = allTodayPunches[allTodayPunches.length - 1];

      // Evening punch check (potential night C-shift IN)
      const eveningPunch = allTodayPunches.find(p => p.hour >= 19);
      const morningPunches = allTodayPunches.filter(p => p.hour < 12);
      const afternoonPunches = allTodayPunches.filter(p => p.hour >= 12 && p.hour < 17);

      const desigStr = (empConf?.designation || '').toLowerCase();
      const deptStr = (empConf?.department || '').toLowerCase();
      const isGeneralNoDouble = 
        desigStr.includes('other') ||
        desigStr.includes('pest') ||
        desigStr.includes('garden') ||
        desigStr.includes('gardener') ||
        desigStr.includes('housekeeping') ||
        desigStr.includes('hk') ||
        desigStr.includes('cleaner') ||
        desigStr.includes('sweeper') ||
        desigStr.includes('pantry') ||
        desigStr.includes('helper') ||
        desigStr.includes('admin') ||
        deptStr.includes('other') ||
        deptStr.includes('pest') ||
        deptStr.includes('garden') ||
        deptStr.includes('housekeeping') ||
        deptStr.includes('hk') ||
        deptStr.includes('admin');

      let effectiveIn: NormalizedPunch | null = null;
      let effectiveOut: NormalizedPunch | null = null;
      let isNextDayOut = false;
      let isNightShift = false;
      let shiftType: 'single' | 'double' | 'split' = 'single';
      let totalDuties = 1.0;
      let ruleApplied = 'STANDARD';
      let remarks = '';

      // ── RULE 2/3: Multi-Shift / Double Shift Detection ──────────────────────
      // General shift, Housekeeping, Garden, and Other staff NEVER get double shift
      // Case 2a: A + C Shift (Morning In < 11:00, Evening In >= 19:00, Next Morning Out)
      if (!isGeneralNoDouble && morningPunches.length > 0 && eveningPunch && nextDayMorningPunches.length > 0) {
        effectiveIn = morningPunches[0];
        const nextMorningOut = nextDayMorningPunches[nextDayMorningPunches.length - 1];
        effectiveOut = nextMorningOut;
        consumedPunchIds.add(nextMorningOut.id);

        isNextDayOut = true;
        isNightShift = true;
        shiftType = 'double';
        totalDuties = 2.0;
        ruleApplied = 'R3-CONFLICT_RES';
        remarks = 'Double Shift (A + C Shift combination stitched across midnight)';
      }
      // Case 2b: B + C Shift (Afternoon In 12:00–16:30, Evening In >= 19:00, Next Morning Out)
      else if (!isGeneralNoDouble && afternoonPunches.length > 0 && eveningPunch && nextDayMorningPunches.length > 0) {
        effectiveIn = afternoonPunches[0];
        const nextMorningOut = nextDayMorningPunches[nextDayMorningPunches.length - 1];
        effectiveOut = nextMorningOut;
        consumedPunchIds.add(nextMorningOut.id);

        isNextDayOut = true;
        isNightShift = true;
        shiftType = 'double';
        totalDuties = 2.0;
        ruleApplied = 'R2-DOUBLE_BC';
        remarks = 'Double Shift (B + C Shift combination stitched across midnight)';
      }
      // Case 2c: A + B Shift (Morning In < 11:00, Evening Out >= 20:00, elapsed >= 14 hours)
      else if (!isGeneralNoDouble && firstPunch.hour < 11 && lastPunch.hour >= 20 && (lastPunch.time.getTime() - firstPunch.time.getTime()) >= 14 * 3600000) {
        effectiveIn = firstPunch;
        effectiveOut = lastPunch;
        shiftType = 'double';
        totalDuties = 2.0;
        ruleApplied = 'R2-DOUBLE_AB';
        remarks = 'Double Shift (A + B Shift combination completed same day)';
      }
      // ── RULE 1 & 6: Night C-Shift Overnight Stitching ──────────────────────
      else if (!isGeneralNoDouble && eveningPunch && (eveningPunch === lastPunch || lastPunch.hour >= 18 || (morningPunches.length === 0 && afternoonPunches.length === 0))) {
        effectiveIn = eveningPunch;
        if (nextDayMorningPunches.length > 0) {
          // Next morning punch is the OUT punch
          const nextMorningOut = nextDayMorningPunches[nextDayMorningPunches.length - 1];
          effectiveOut = nextMorningOut;
          consumedPunchIds.add(nextMorningOut.id);

          isNextDayOut = true;
          isNightShift = true;
          ruleApplied = 'R1-C_BRIDGE';
          remarks = 'C-Shift overnight stitched (crosses midnight)';
        } else {
          // Edge Case 1: Night punch with NO next morning out
          effectiveOut = null;
          isNightShift = true;
          ruleApplied = 'MISSED_OUT_PUNCH';
          remarks = 'Night C-shift missing morning exit punch (requires supervisor regularization)';
        }
      }
      // ── Standard Same-Day Shift ─────────────────────────────────────────────
      else if (allTodayPunches.length >= 2) {
        effectiveIn = firstPunch;
        effectiveOut = lastPunch;
        ruleApplied = 'STANDARD';
      }
      // Single punch only
      else if (allTodayPunches.length === 1) {
        effectiveIn = firstPunch;
        effectiveOut = null;
        ruleApplied = 'MISSED_PUNCH';
        remarks = 'Single punch recorded without exit';
      }

      // ── Shift and Metric Calculations ──────────────────────────────────────
      let shift: SiteShiftDefinition | null = null;
      if (empConf?.assignedShiftId && shiftById.has(empConf.assignedShiftId)) {
        shift = shiftById.get(empConf.assignedShiftId)!;
      } else if (effectiveIn) {
        shift = detectShift(effectiveIn.time, shiftDefs);
      }

      const shiftDurationHours = shift ? getShiftDurationHours(shift) : (shiftType === 'double' ? 16 : 9);
      const shiftStartMins     = shift ? hhmToMins(shift.startTime) : 9 * 60;
      const shiftEndMins       = shift ? hhmToMins(shift.endTime)   : 18 * 60;

      let grossMins = 0;
      let netMins = 0;
      let otMins = 0;
      let lateMins = 0;
      let earlyExitMins = 0;
      let shiftCompleted = false;

      if (effectiveIn && effectiveOut) {
        let diffMs = effectiveOut.time.getTime() - effectiveIn.time.getTime();
        if (diffMs > 0) {
          grossMins = Math.floor(diffMs / 60000);
          const breakMins = shiftType === 'double' ? 60 : (grossMins >= 60 ? breakDeductionMins : 0);
          netMins = Math.max(0, grossMins - breakMins);

          // OT Calculation: Double shifts start OT after 16 hours (as confirmed by user)
          const expectedThreshold = (shiftType === 'double' ? 16 : shiftDurationHours) * 60;
          otMins = Math.max(0, netMins - expectedThreshold);

          if (netMins >= (shiftType === 'double' ? 11 * 60 : 6 * 60)) {
            shiftCompleted = true;
          }
        }
      }

      if (effectiveIn && !isNightShift) {
        const inMins = effectiveIn.hour * 60 + effectiveIn.mins;
        lateMins = Math.max(0, inMins - (shiftStartMins + graceMinutes));
      }

      if (effectiveOut && !isNextDayOut) {
        const outMins = effectiveOut.hour * 60 + effectiveOut.mins;
        earlyExitMins = Math.max(0, shiftEndMins - outMins);
      }

      // ── Status Resolution (Rules R4, R5, R7) ───────────────────────────────
      let status: ProcessedAttendanceRecord['status'] = 'P';
      let statusCode = 'P';

      if (!effectiveOut && effectiveIn) {
        status = 'Missed Punch';
        statusCode = 'MP';
        totalDuties = 0.5;
      } else if (isWO) {
        // RULE 5: Work on Weekly Off (W/P)
        if (netMins >= 180 || shiftCompleted) {
          status = 'W/P';
          statusCode = 'WP';
          ruleApplied = 'R5-WP';
          remarks = remarks ? `${remarks} | Worked on Weekly Off` : 'Worked on Weekly Off';
        } else {
          // RULE 4: Roster W/O
          status = 'W/O';
          statusCode = 'WO';
          totalDuties = 0;
          ruleApplied = 'R4-ROSTER_WO';
        }
      } else if (lateMins > 0) {
        status = 'Late';
        statusCode = 'P';
      }

      results.push({
        empCode,
        empName: empConf?.staffName,
        department: empConf?.department,
        designation: empConf?.designation,
        attendanceDate: curDateStr,
        inTime: effectiveIn ? effectiveIn.hhmm : null,
        outTime: effectiveOut ? effectiveOut.hhmm : null,
        grossMins,
        netMins,
        otMins,
        lateMinutes: lateMins,
        earlyExitMins,
        workingHours: formatMinsToHM(netMins),
        status,
        statusCode,
        shiftId: shift?.id ?? null,
        shiftName: shift?.name ?? (isNightShift ? 'Shift C (Night)' : (shiftType === 'double' ? 'Double Shift' : 'General')),
        shiftType,
        totalDuties,
        shiftCompleted,
        isWeeklyOff: isWO,
        isNightShift,
        isNextDayOut,
        ruleApplied,
        rawPunchCount: allTodayPunches.length,
        remarks: remarks || undefined,
        siteId,
        source: 'device_log',
      });
    }
  }

  return results.sort((a, b) =>
    a.attendanceDate.localeCompare(b.attendanceDate) ||
    a.empCode.localeCompare(b.empCode)
  );
}

// ── Summary Helper ────────────────────────────────────────────────────────────

export interface ProcessingSummary {
  total:       number;
  present:     number;
  absent:      number;
  weeklyOff:   number;
  weeklyOffWorked: number;
  missedPunch: number;
  doubleShifts: number;
  holiday:     number;
  late:        number;
  totalNetH:   number;
  totalOtH:    number;
  totalDuties: number;
}

export function summariseProcessedRecords(records: ProcessedAttendanceRecord[]): ProcessingSummary {
  const out: ProcessingSummary = {
    total: 0,
    present: 0,
    absent: 0,
    weeklyOff: 0,
    weeklyOffWorked: 0,
    missedPunch: 0,
    doubleShifts: 0,
    holiday: 0,
    late: 0,
    totalNetH: 0,
    totalOtH: 0,
    totalDuties: 0,
  };

  for (const r of records) {
    out.total++;
    if (r.status === 'P') out.present++;
    if (r.status === 'Late') { out.present++; out.late++; }
    if (r.status === 'W/P') { out.present++; out.weeklyOffWorked++; }
    if (r.status === 'A') out.absent++;
    if (r.status === 'W/O') out.weeklyOff++;
    if (r.status === 'H') out.holiday++;
    if (r.status === 'Missed Punch') out.missedPunch++;
    if (r.shiftType === 'double') out.doubleShifts++;

    out.totalNetH  += r.netMins / 60;
    out.totalOtH   += r.otMins  / 60;
    out.totalDuties += (r.totalDuties ?? 1.0);
  }

  out.totalNetH  = Math.round(out.totalNetH * 10) / 10;
  out.totalOtH   = Math.round(out.totalOtH  * 10) / 10;
  out.totalDuties = Math.round(out.totalDuties * 10) / 10;
  return out;
}
