/**
 * Device Log Processor — Paradigm FMS
 *
 * Converts raw biometric punch records (biometric_device_logs) into
 * fully-resolved daily attendance records (ProcessedAttendanceRecord).
 *
 * Pipeline:
 *   1. Group raw punches by empCode + attendance date
 *   2. Resolve night-shift punch anchoring
 *   3. Pair first In-punch with last Out-punch
 *   4. Auto-detect or assign shift
 *   5. Apply day-type overrides (W/O → H → Active check)
 *   6. Calculate gross / net / OT / late / early-exit metrics
 *   7. Determine final status
 */

import type { SiteShiftDefinition } from '../types/attendance';
import type { SiteHoliday } from '../services/attendanceRosterService';
import { detectShift, getShiftDurationHours, timeToMinutes } from './shiftDetection';
import { isWeeklyOff } from './weeklyOffUtils';

// ── Shared types ──────────────────────────────────────────────────────────────

/** Raw punch as returned by api.getBiometricDeviceLogs() */
export interface DevicePunchLog {
  id: string;
  downloadDate: string;
  userId: string;       // emp_code
  logDate: string;      // ISO timestamp of the punch
  deviceName: string;
  serialNo: string;
  attState: string;     // 'Check In' | 'Check Out' | '' | 'Check In/Out'
  verifyMode: string;
  gps?: string;
  attPhoto?: string;
}

/** Per-employee configuration required by the processor */
export interface EmployeeProcessingConfig {
  empCode: string;
  /** Day numbers (0=Sun … 6=Sat) that are weekly off for this employee */
  weeklyOffDays: number[];
  /** Pre-assigned shift id; if null the shift is auto-detected */
  assignedShiftId?: string | null;
  /** Whether this employee record is inactive (no longer employed) */
  isInactive?: boolean;
  /** Employee's site id — used for holiday lookup */
  siteId?: string;
}

/** Final output record written to public.processed_attendance */
export interface ProcessedAttendanceRecord {
  empCode: string;
  attendanceDate: string;            // 'YYYY-MM-DD'
  inTime: string | null;             // 'HH:mm' 24h
  outTime: string | null;            // 'HH:mm' 24h
  grossMins: number;
  netMins: number;
  otMins: number;
  lateMinutes: number;
  earlyExitMins: number;
  status: 'P' | 'A' | 'W/O' | 'H' | 'Late' | '–' | 'Pending';
  shiftId: string | null;
  shiftName: string;
  siteId: string | null;
  source: 'device_log' | 'manual' | 'mssql';
}

// ── Internals ─────────────────────────────────────────────────────────────────

/** Convert a JS Date to 'HH:mm' (24-hour, zero-padded) */
function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Convert 'HH:mm' string to minutes since midnight */
function hhmToMins(hhmm: string): number {
  return timeToMinutes(hhmm);
}

/** Determine a punch's direction from the attState string */
function punchDirection(attState: string): 'in' | 'out' | 'unknown' {
  const s = (attState || '').toLowerCase();
  if (s.includes('in') && !s.includes('out')) return 'in';
  if (s.includes('out')) return 'out';
  return 'unknown';
}

/**
 * Resolve the "attendance date" for a punch.
 * Night-shift rule: if this is an Out-punch that falls between 00:00–07:00,
 * it may belong to the PREVIOUS calendar day's shift.
 * We anchor it to the previous day when the hour is < 7.
 */
function resolveAttendanceDate(punchDate: Date, direction: 'in' | 'out' | 'unknown'): string {
  const d = new Date(punchDate);
  if (direction === 'out' && d.getHours() < 7) {
    d.setDate(d.getDate() - 1);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Process raw biometric punches into daily attendance records.
 *
 * @param logs         Raw punch logs from Supabase / MSSQL bridge
 * @param employees    Per-employee config (weekly-off, shift, site)
 * @param shiftDefs    Available shift definitions for the site(s)
 * @param siteHolidays Holiday list keyed by site
 * @param graceMinutes Late-mark grace period in minutes (default 15)
 * @param breakDeductionMins  Standard break deduction in minutes (default 30)
 * @returns            Array of processed records, one per employee per date
 */
export function processDeviceLogs(
  logs: DevicePunchLog[],
  employees: EmployeeProcessingConfig[],
  shiftDefs: SiteShiftDefinition[],
  siteHolidays: SiteHoliday[],
  graceMinutes: number = 15,
  breakDeductionMins: number = 30,
): ProcessedAttendanceRecord[] {

  // Build quick lookups
  const empMap: Map<string, EmployeeProcessingConfig> = new Map(
    employees.map(e => [e.empCode, e])
  );
  const shiftById: Map<string, SiteShiftDefinition> = new Map(
    shiftDefs.map(s => [s.id, s])
  );
  // Holiday set: 'YYYY-MM-DD' → true
  const holidayDateSet: Set<string> = new Set(
    siteHolidays.map(h => h.date?.slice(0, 10)).filter(Boolean) as string[]
  );

  // ── Step 1: Group punches by empCode + resolved attendance date ───────────
  type DayPunches = {
    inPunches:  Date[];
    outPunches: Date[];
    allPunches: Date[];
  };
  const grouped: Map<string, DayPunches> = new Map();

  for (const log of logs) {
    const punchTime = new Date(log.logDate);
    if (isNaN(punchTime.getTime())) continue;

    const dir = punchDirection(log.attState);
    const dateKey = resolveAttendanceDate(punchTime, dir);
    const key = `${log.userId}::${dateKey}`;

    if (!grouped.has(key)) {
      grouped.set(key, { inPunches: [], outPunches: [], allPunches: [] });
    }
    const bucket = grouped.get(key)!;
    bucket.allPunches.push(punchTime);

    if (dir === 'in') {
      bucket.inPunches.push(punchTime);
    } else if (dir === 'out') {
      bucket.outPunches.push(punchTime);
    } else {
      // Unknown direction: treat first half as In, rest as Out
      // For now we just add to allPunches for fallback logic
    }
  }

  // ── Step 2–7: Resolve each grouped day into a ProcessedAttendanceRecord ──
  const results: ProcessedAttendanceRecord[] = [];

  for (const [key, bucket] of grouped) {
    const [empCode, attendanceDate] = key.split('::');
    const empConf = empMap.get(empCode);
    const siteId = empConf?.siteId ?? null;

    // Determine In / Out timestamps
    bucket.inPunches.sort((a, b) => a.getTime() - b.getTime());
    bucket.outPunches.sort((a, b) => a.getTime() - b.getTime());
    bucket.allPunches.sort((a, b) => a.getTime() - b.getTime());

    // first In-punch (or first overall punch)
    const firstIn: Date | undefined =
      bucket.inPunches[0] ?? bucket.allPunches[0];

    // last Out-punch (or last overall punch when no explicit Out)
    const lastOut: Date | undefined =
      bucket.outPunches.length > 0
        ? bucket.outPunches[bucket.outPunches.length - 1]
        : (bucket.allPunches.length > 1 ? bucket.allPunches[bucket.allPunches.length - 1] : undefined);

    const inTime  = firstIn ? toHHMM(firstIn) : null;
    const outTime = lastOut && lastOut !== firstIn ? toHHMM(lastOut) : null;

    // ── Step 3: Shift detection ──────────────────────────────────────────
    let shift: SiteShiftDefinition | null = null;

    if (empConf?.assignedShiftId && shiftById.has(empConf.assignedShiftId)) {
      shift = shiftById.get(empConf.assignedShiftId)!;
    } else if (firstIn) {
      shift = detectShift(firstIn, shiftDefs);
    }

    const shiftDurationHours = shift ? getShiftDurationHours(shift) : 9; // default 9h
    const shiftStartMins     = shift ? hhmToMins(shift.startTime) : 9 * 60;
    const shiftEndMins       = shift ? hhmToMins(shift.endTime)   : 18 * 60;

    // ── Step 4: Day-type overrides ───────────────────────────────────────
    const dateObj = new Date(`${attendanceDate}T00:00:00`);

    const isWO      = empConf ? isWeeklyOff(dateObj, empConf.weeklyOffDays) : false;
    const isHoliday = holidayDateSet.has(attendanceDate);
    const isInactive = empConf?.isInactive ?? false;

    if (isInactive) {
      results.push({
        empCode, attendanceDate,
        inTime: null, outTime: null,
        grossMins: 0, netMins: 0, otMins: 0,
        lateMinutes: 0, earlyExitMins: 0,
        status: '–',
        shiftId: shift?.id ?? null, shiftName: shift?.name ?? 'NS',
        siteId, source: 'device_log',
      });
      continue;
    }

    if (isWO) {
      results.push({
        empCode, attendanceDate,
        inTime: null, outTime: null,
        grossMins: 0, netMins: 0, otMins: 0,
        lateMinutes: 0, earlyExitMins: 0,
        status: 'W/O',
        shiftId: null, shiftName: 'NS',
        siteId, source: 'device_log',
      });
      continue;
    }

    if (isHoliday) {
      results.push({
        empCode, attendanceDate,
        inTime: null, outTime: null,
        grossMins: 0, netMins: 0, otMins: 0,
        lateMinutes: 0, earlyExitMins: 0,
        status: 'H',
        shiftId: null, shiftName: 'HOL',
        siteId, source: 'device_log',
      });
      continue;
    }

    // ── Step 5: Calculate metrics ────────────────────────────────────────
    // Need at least an In-punch to be considered Present
    if (!firstIn || !inTime) {
      results.push({
        empCode, attendanceDate,
        inTime: null, outTime: null,
        grossMins: 0, netMins: 0, otMins: 0,
        lateMinutes: 0, earlyExitMins: 0,
        status: 'A',
        shiftId: shift?.id ?? null, shiftName: shift?.name ?? '',
        siteId, source: 'device_log',
      });
      continue;
    }

    const inMins  = hhmToMins(inTime);
    let   outMins = outTime ? hhmToMins(outTime) : null;

    // Handle night-shift: out-punch before in-punch in minutes → add 24h
    let grossMins = 0;
    if (outMins !== null) {
      grossMins = outMins - inMins;
      if (grossMins < 0) grossMins += 24 * 60;   // night-shift crosses midnight
    }

    // Net = Gross − break deduction (only if shift is long enough)
    const netMins = outMins !== null
      ? Math.max(0, grossMins - (grossMins >= 60 ? breakDeductionMins : 0))
      : 0;

    // OT = net worked − expected shift hours (only if > 0)
    const otMins = Math.max(0, netMins - shiftDurationHours * 60);

    // Late = in-time is more than graceMinutes after shift start
    const lateMins = Math.max(0, inMins - (shiftStartMins + graceMinutes));

    // Early exit = out before shift end (only if there is an out-punch)
    const earlyExitMins = outMins !== null
      ? Math.max(0, shiftEndMins - outMins)
      : 0;

    // ── Step 6: Final status ──────────────────────────────────────────────
    let status: ProcessedAttendanceRecord['status'] = 'P';
    if (lateMins > 0) status = 'Late';

    results.push({
      empCode,
      attendanceDate,
      inTime,
      outTime,
      grossMins,
      netMins,
      otMins,
      lateMinutes: lateMins,
      earlyExitMins,
      status,
      shiftId:   shift?.id   ?? null,
      shiftName: shift?.name ?? (shiftDefs[0]?.name ?? 'General'),
      siteId,
      source: 'device_log',
    });
  }

  return results.sort((a, b) =>
    a.attendanceDate.localeCompare(b.attendanceDate) ||
    a.empCode.localeCompare(b.empCode)
  );
}

// ── Formatting helpers (used in UI) ──────────────────────────────────────────

/** Format minutes as "Xh YYm" */
export function formatMinsToHM(mins: number): string {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Summarise an array of processed records into aggregate counts */
export interface ProcessingSummary {
  total:      number;
  present:    number;
  absent:     number;
  weeklyOff:  number;
  holiday:    number;
  late:       number;
  totalNetH:  number;   // total net working hours
  totalOtH:   number;   // total OT hours
}

export function summariseProcessedRecords(records: ProcessedAttendanceRecord[]): ProcessingSummary {
  const out: ProcessingSummary = { total: 0, present: 0, absent: 0, weeklyOff: 0, holiday: 0, late: 0, totalNetH: 0, totalOtH: 0 };
  for (const r of records) {
    out.total++;
    if (r.status === 'P')    out.present++;
    if (r.status === 'Late') { out.present++; out.late++; }
    if (r.status === 'A')    out.absent++;
    if (r.status === 'W/O')  out.weeklyOff++;
    if (r.status === 'H')    out.holiday++;
    out.totalNetH += r.netMins / 60;
    out.totalOtH  += r.otMins  / 60;
  }
  out.totalNetH = Math.round(out.totalNetH * 10) / 10;
  out.totalOtH  = Math.round(out.totalOtH  * 10) / 10;
  return out;
}
