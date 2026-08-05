/**
 * attendanceRuleEngine.ts
 * 
 * Centralized Attendance & Payroll/Overtime Calculation Rule Engine
 */

export interface PunchRecord {
  empCode: string;
  empName: string;
  department: string; // MS SQL Department -> App Site Name
  designation?: string;
  inTimeRaw?: string | Date | null;
  outTimeRaw?: string | Date | null;
  rawStatus?: string;
}

export interface RuleEngineConfig {
  shiftStartTime: string; // e.g. "09:00"
  shiftEndTime: string;   // e.g. "18:00"
  standardShiftMinutes: number; // e.g. 540 (9 hours including break) or 480 (8 hours)
  gracePeriodMinutes: number;   // e.g. 15 mins (late if > 09:15)
  halfDayThresholdMinutes: number; // e.g. 240 (4 hours)
  minOtThresholdMinutes: number;   // e.g. 30 mins over standard shift to count OT
}

export const DEFAULT_RULE_CONFIG: RuleEngineConfig = {
  shiftStartTime: '09:00',
  shiftEndTime: '18:00',
  standardShiftMinutes: 540, // 9 hours total
  gracePeriodMinutes: 15,
  halfDayThresholdMinutes: 240, // 4 hours
  minOtThresholdMinutes: 30,
};

export interface ProcessedAttendance {
  empCode: string;
  empName: string;
  site: string; // Mapped from MS SQL Department
  designation: string;
  inTime: string | null;
  outTime: string | null;
  workingHours: string;
  durationMinutes: number;
  otHours: string;
  otMinutes: number;
  status: 'Present' | 'Absent' | 'Late' | 'Half Day';
  lateMinutes: number;
}

/**
 * Calculates working hours, late arrival, attendance status, and overtime.
 */
export function processAttendanceRecord(
  record: PunchRecord,
  config: RuleEngineConfig = DEFAULT_RULE_CONFIG
): ProcessedAttendance {
  const empCode = record.empCode || 'N/A';
  const empName = record.empName || 'Unknown';
  const site = record.department || 'Default Site';
  const designation = record.designation || 'Staff';

  const inDate = record.inTimeRaw ? new Date(record.inTimeRaw) : null;
  const outDate = record.outTimeRaw ? new Date(record.outTimeRaw) : null;

  // Validate dates
  const hasValidIn = inDate && !isNaN(inDate.getTime());
  const hasValidOut = outDate && !isNaN(outDate.getTime());

  if (!hasValidIn) {
    return {
      empCode,
      empName,
      site,
      designation,
      inTime: null,
      outTime: null,
      workingHours: '—',
      durationMinutes: 0,
      otHours: '0h 00m',
      otMinutes: 0,
      status: 'Absent',
      lateMinutes: 0,
    };
  }

  // Format In / Out time strings
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const inTimeStr = formatTime(inDate);
  const outTimeStr = hasValidOut ? formatTime(outDate) : null;

  // Compute duration
  let durationMinutes = 0;
  if (hasValidIn && hasValidOut) {
    const diffMs = outDate.getTime() - inDate.getTime();
    if (diffMs > 0) {
      durationMinutes = Math.floor(diffMs / 60000);
    }
  }

  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const workingHoursStr = durationMinutes > 0 ? `${hours}h ${String(mins).padStart(2, '0')}m` : '—';

  // Compute Late Minutes (Based on shift start time e.g. 09:00 + grace period)
  const [targetH, targetM] = config.shiftStartTime.split(':').map(Number);
  const shiftStartToday = new Date(inDate);
  shiftStartToday.setHours(targetH, targetM, 0, 0);

  let lateMinutes = 0;
  const inTimeMs = inDate.getTime();
  const shiftStartMs = shiftStartToday.getTime();

  if (inTimeMs > shiftStartMs) {
    const totalLateDiff = Math.floor((inTimeMs - shiftStartMs) / 60000);
    if (totalLateDiff > config.gracePeriodMinutes) {
      lateMinutes = totalLateDiff;
    }
  }

  // Compute Overtime (OT)
  let otMinutes = 0;
  if (durationMinutes > config.standardShiftMinutes) {
    const excess = durationMinutes - config.standardShiftMinutes;
    if (excess >= config.minOtThresholdMinutes) {
      otMinutes = excess;
    }
  }
  const otH = Math.floor(otMinutes / 60);
  const otM = otMinutes % 60;
  const otHoursStr = otMinutes > 0 ? `${otH}h ${String(otM).padStart(2, '0')}m` : '0h 00m';

  // Determine Status
  let status: ProcessedAttendance['status'] = 'Present';
  if (durationMinutes > 0 && durationMinutes < config.halfDayThresholdMinutes) {
    status = 'Half Day';
  } else if (lateMinutes > 0) {
    status = 'Late';
  }

  return {
    empCode,
    empName,
    site,
    designation,
    inTime: inTimeStr,
    outTime: outTimeStr,
    workingHours: workingHoursStr,
    durationMinutes,
    otHours: otHoursStr,
    otMinutes,
    status,
    lateMinutes,
  };
}
