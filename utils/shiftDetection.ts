// Shift Detection Utilities for Site Staff
// Automatically determines which shift a punch-in belongs to based on time-of-day.
// No duty roster needed — shifts are inferred from the punch-in timestamp.

import type { SiteShiftDefinition } from '../types';

/**
 * Convert "HH:mm" string to minutes since midnight (0-1439)
 */
export function timeToMinutes(time: string): number {
  const parts = time.includes('.') ? time.split('.') : time.split(':');
  const [h, m] = parts.map(Number);
  return h * 60 + (m || 0);
}

export function isWithinShiftWindow(
  timeMinutes: number,
  shift: SiteShiftDefinition,
  earlyBufferMins: number = 30
): boolean {
  const start = timeToMinutes(shift.startTime);
  const bufferedStart = (start - earlyBufferMins + 1440) % 1440;
  const end = timeToMinutes(shift.endTime);

  const crosses = shift.crossesMidnight || end < start || end < bufferedStart || bufferedStart > start;

  if (crosses) {
    // night shift or wraps around midnight
    return timeMinutes >= bufferedStart || timeMinutes < end;
  }
  // normal day shift
  return timeMinutes >= bufferedStart && timeMinutes < end;
}

/**
 * Auto-detect which shift a punch-in belongs to.
 *
 * Algorithm:
 * 1. Find all shifts whose window (with 30-minute early buffer) contains the punch-in time
 * 2. If multiple matches (overlap zone, e.g. Shift A ends 15:00, Shift B starts 13:00/14:00),
 *    pick the shift whose start time is closest to the punch-in time in absolute circular minutes.
 * 3. Returns null if no shift matches
 */
export function detectShift(
  punchInTimestamp: string | Date,
  shifts: SiteShiftDefinition[]
): SiteShiftDefinition | null {
  if (!shifts || shifts.length === 0) return null;

  const punchInDate = typeof punchInTimestamp === 'string' ? new Date(punchInTimestamp) : punchInTimestamp;
  const punchInMinutes = punchInDate.getHours() * 60 + punchInDate.getMinutes();

  // Find all matching shifts
  const matches = shifts.filter(s => isWithinShiftWindow(punchInMinutes, s));

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  // Multiple matches (overlap zone): pick the one whose start is closest to punch-in (absolute circular distance)
  return matches.reduce((best, current) => {
    const bestStart = timeToMinutes(best.startTime);
    const currentStart = timeToMinutes(current.startTime);

    const diffBest = Math.abs(punchInMinutes - bestStart);
    const distBest = Math.min(diffBest, 1440 - diffBest);

    const diffCurrent = Math.abs(punchInMinutes - currentStart);
    const distCurrent = Math.min(diffCurrent, 1440 - diffCurrent);

    return distCurrent < distBest ? current : best;
  });
}

/**
 * Calculate the absolute checkout deadline for a detected shift.
 * For night shifts (crossesMidnight), the end time is on the NEXT calendar day.
 *
 * @param shift - The detected shift definition
 * @param punchInDate - The actual punch-in timestamp
 * @returns The deadline Date after which the session should end
 */
export function getShiftCheckoutDeadline(
  shift: SiteShiftDefinition,
  punchInDate: Date
): Date {
  const buffer = shift.autoCheckoutBufferMinutes ?? 30;
  const [endH, endM] = shift.endTime.split(':').map(Number);

  const deadline = new Date(punchInDate);

  if (shift.crossesMidnight) {
    // Night shift: end time is the NEXT day
    // e.g., punch-in 21:00 Apr 17 → deadline 07:00 Apr 18 + buffer
    deadline.setDate(deadline.getDate() + 1);
  }

  deadline.setHours(endH, endM || 0, 0, 0);
  deadline.setMinutes(deadline.getMinutes() + buffer);

  return deadline;
}

/**
 * Get a human-readable label for a shift.
 */
export function getShiftLabel(shift: SiteShiftDefinition): string {
  const nightIcon = shift.crossesMidnight ? ' 🌙' : '';
  return `${shift.name} (${shift.startTime} → ${shift.endTime})${nightIcon}`;
}

/**
 * Auto-calculate whether a shift crosses midnight based on start/end times.
 */
export function doesShiftCrossMidnight(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) < timeToMinutes(startTime);
}

/**
 * Calculate the expected duration of a shift in hours.
 */
export function getShiftDurationHours(shift: SiteShiftDefinition): number {
  const start = timeToMinutes(shift.startTime);
  const end = timeToMinutes(shift.endTime);

  let durationMinutes: number;
  if (shift.crossesMidnight || end < start) {
    durationMinutes = (1440 - start) + end; // minutes until midnight + minutes after midnight
  } else {
    durationMinutes = end - start;
  }
  return durationMinutes / 60;
}

/**
 * Detect all shifts worked by an employee during their day's check-in/check-out span.
 */
export function detectAllShiftsWorked(
  checkIn: Date | string,
  checkOut: Date | string | null,
  shifts: SiteShiftDefinition[],
  workingHours?: number
): SiteShiftDefinition[] {
  if (!shifts || shifts.length === 0) return [];

  const inDate = new Date(checkIn);
  const outDate = checkOut 
    ? new Date(checkOut) 
    : new Date(inDate.getTime() + (workingHours || 0) * 60 * 60 * 1000);

  const matchedShifts: { shift: SiteShiftDefinition; startMs: number }[] = [];

  // Check shifts starting on candidate days: the day of check-in, and the following day
  const candidateDays = [0, 1];

  for (const dayOffset of candidateDays) {
    const baseDate = new Date(inDate);
    baseDate.setDate(baseDate.getDate() + dayOffset);

    for (const shift of shifts) {
      // Parse shift start and end times
      const [startH, startM] = shift.startTime.split(':').map(Number);
      const [endH, endM] = shift.endTime.split(':').map(Number);

      const shiftStart = new Date(baseDate);
      shiftStart.setHours(startH, startM || 0, 0, 0);

      const shiftEnd = new Date(baseDate);
      shiftEnd.setHours(endH, endM || 0, 0, 0);

      if (shift.crossesMidnight || (endH * 60 + endM) < (startH * 60 + startM)) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }

      // Calculate overlap
      const overlapStart = inDate.getTime() > shiftStart.getTime() ? inDate : shiftStart;
      const overlapEnd = outDate.getTime() < shiftEnd.getTime() ? outDate : shiftEnd;

      if (overlapEnd.getTime() > overlapStart.getTime()) {
        const overlapMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / (60 * 1000);
        // If they worked at least 2 hours (120 minutes) of this shift, consider it worked
        if (overlapMinutes >= 120) {
          if (!matchedShifts.some(item => item.shift.id === shift.id)) {
            matchedShifts.push({ shift, startMs: shiftStart.getTime() });
          }
        }
      }
    }
  }

  // Sort matched shifts by their actual occurrence start time
  return matchedShifts
    .sort((a, b) => a.startMs - b.startMs)
    .map(item => item.shift);
}
