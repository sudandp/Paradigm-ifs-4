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

/**
 * Check if a time-of-day (in minutes) falls within a shift window.
 */
export function isWithinShiftWindow(timeMinutes: number, shift: SiteShiftDefinition): boolean {
  const start = timeToMinutes(shift.startTime);
  const end = timeToMinutes(shift.endTime);

  if (shift.crossesMidnight || end < start) {
    // Night shift: 21:00 → 07:00 means valid if time >= 21:00 OR time < 07:00
    return timeMinutes >= start || timeMinutes < end;
  }
  // Day shift: 07:00 → 15:00 means valid if 07:00 <= time < 15:00
  return timeMinutes >= start && timeMinutes < end;
}

/**
 * Auto-detect which shift a punch-in belongs to.
 *
 * Algorithm:
 * 1. Find all shifts whose window contains the punch-in time
 * 2. If multiple matches (overlap zone, e.g. Shift A ends 15:00, Shift B starts 14:00),
 *    pick the shift whose start time is closest to (and before/at) the punch-in time
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

  // Multiple matches (overlap zone): pick the one whose start is closest to punch-in
  // "Closest" means the smallest positive (or zero) distance from start to punch-in
  return matches.reduce((best, current) => {
    const bestStart = timeToMinutes(best.startTime);
    const currentStart = timeToMinutes(current.startTime);

    // Calculate distance from shift start to punch-in, handling wrap-around
    const distBest = ((punchInMinutes - bestStart) + 1440) % 1440;
    const distCurrent = ((punchInMinutes - currentStart) + 1440) % 1440;

    // Smaller distance = more recently started shift = winner
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
