import { format, differenceInMinutes, isSameDay } from 'date-fns';
import type { AttendanceEvent } from '../types';

const MAX_SESSION_MINUTES = 16 * 60; // a single Site OT session can't exceed 16h
const BOUNCE_MINUTES = 5; // ins within 5 min of each other are treated as duplicates

/**
 * Pairs every `site-ot-in` with its matching `site-ot-out` and returns total
 * Site OT minutes per day (keyed by the in-punch date, yyyy-MM-dd).
 *
 * - Handles multiple sessions per day (all are summed).
 * - Ignores accidental duplicate punches (in/out bounces).
 * - An out is only matched if it comes before the next real in and within 16h,
 *   so a missed out-punch never steals another day's out.
 * - An open session on today counts up to "now".
 */
export const computeSiteOtMinutesByDay = (events: AttendanceEvent[], now: Date = new Date()): Map<string, number> => {
    const result = new Map<string, number>();
    const otEvents = events
        .filter(e => e.type === 'site-ot-in' || e.type === 'site-ot-out')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const usedOuts = new Set<number>();
    let i = 0;
    while (i < otEvents.length) {
        const ev = otEvents[i];
        if (ev.type !== 'site-ot-in') { i++; continue; }

        const inTime = new Date(ev.timestamp);

        // Next genuine in-punch (skip bounces)
        let nextInIdx = -1;
        for (let j = i + 1; j < otEvents.length; j++) {
            if (otEvents[j].type === 'site-ot-in' && differenceInMinutes(new Date(otEvents[j].timestamp), inTime) > BOUNCE_MINUTES) {
                nextInIdx = j;
                break;
            }
        }
        const limit = nextInIdx === -1 ? otEvents.length : nextInIdx;

        // Latest out before the next in and within the max session length
        let outTime: Date | null = null;
        for (let j = i + 1; j < limit; j++) {
            const c = otEvents[j];
            if (c.type !== 'site-ot-out' || usedOuts.has(j)) continue;
            const t = new Date(c.timestamp);
            if (t <= inTime || differenceInMinutes(t, inTime) > MAX_SESSION_MINUTES) continue;
            outTime = t;
            usedOuts.add(j);
        }

        let mins = 0;
        if (outTime) {
            mins = differenceInMinutes(outTime, inTime);
        } else if (isSameDay(inTime, now)) {
            mins = Math.max(0, differenceInMinutes(now, inTime));
        }

        const key = format(inTime, 'yyyy-MM-dd');
        result.set(key, (result.get(key) || 0) + mins);

        i = limit;
    }
    return result;
};
