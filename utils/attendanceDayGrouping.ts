import type { AttendanceEvent } from '../types';

type SessionKind = 'office_punch' | 'field_punch' | 'site' | 'site_ot';

const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getKind = (event: AttendanceEvent): SessionKind | null => {
  switch (event.type) {
    case 'punch-in':
    case 'punch-out':
      return event.workType === 'field' ? 'field_punch' : 'office_punch';
    case 'site-in':
    case 'site-out':
      return 'site';
    case 'site-ot-in':
    case 'site-ot-out':
      return 'site_ot';
    default:
      return null;
  }
};

const isStartEvent = (event: AttendanceEvent) =>
  event.type === 'punch-in' || event.type === 'site-in' || event.type === 'site-ot-in';

const isEndEvent = (event: AttendanceEvent) =>
  event.type === 'punch-out' || event.type === 'site-out' || event.type === 'site-ot-out';

/**
 * Process a SINGLE user's events to build day-key mappings.
 * Tracks open sessions to handle night shifts — events after midnight
 * are attributed to the session start date.
 */
const buildDayKeysForSingleUser = (events: AttendanceEvent[]): Record<string, string> => {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const open: Partial<Record<SessionKind, { startKey: string; startMs: number }>> = {};
  const keyById: Record<string, string> = {};

  for (const event of sorted) {
    const eventDate = new Date(event.timestamp);
    const eventKey = toLocalDateKey(eventDate);
    const kind = getKind(event);

    // Context check: If any session is already open, any new event (start or otherwise)
    // should potentially inherit that session's startKey to handle night shifts correctly.
    const activeSessions = Object.values(open).filter(Boolean) as Array<{ startKey: string; startMs: number }>;
    const existingStartKey = activeSessions.length > 0 
      ? activeSessions.reduce((best, cur) => (cur.startMs < best.startMs ? cur : best)).startKey 
      : null;

    if (kind && isStartEvent(event)) {
      // Check if this SAME kind of session is already open (missed punch-out scenario).
      // If so, implicitly close the stale session and start a fresh one on the new date.
      const sameKindOpen = open[kind];
      if (sameKindOpen) {
        // Same kind re-opened → missed punch-out. Start fresh on the new event's date.
        delete open[kind];
        open[kind] = { startKey: eventKey, startMs: eventDate.getTime() };
        keyById[event.id] = eventKey;
        continue;
      }

      // Different kind sub-session (e.g., Site OT starting within a primary Punch In):
      // Inherit the primary session's startKey, but only if the gap is reasonable (< 16 hours).
      // Beyond 16 hours the old session is considered stale/forgotten.
      const MAX_SESSION_MS = 16 * 60 * 60 * 1000;
      const isStale = existingStartKey && activeSessions.length > 0 &&
        activeSessions.every(s => (eventDate.getTime() - s.startMs) > MAX_SESSION_MS);

      const startKey = (existingStartKey && !isStale) ? existingStartKey : eventKey;
      open[kind] = { startKey, startMs: eventDate.getTime() };
      keyById[event.id] = startKey;
      continue;
    }

    if (kind && isEndEvent(event)) {
      keyById[event.id] = open[kind]?.startKey || existingStartKey || eventKey;
      delete open[kind];
      continue;
    }

    // Breaks/other events: attribute to the earliest started open session, if any.
    if (existingStartKey) {
      keyById[event.id] = existingStartKey;
    } else {
      keyById[event.id] = eventKey;
    }
  }

  return keyById;
};

/**
 * Group events by "attendance day" rather than raw calendar day.
 *
 * If a session starts late night and ends after midnight, all events in that open
 * session (including break-in/out and the eventual checkout) are attributed to the
 * session start date (night shift behavior).
 *
 * IMPORTANT: This function is now USER-AWARE. When events from multiple users are
 * passed in, each user's sessions are tracked independently to prevent cross-user
 * session contamination (e.g., User A's open session incorrectly anchoring User B's
 * events to the wrong date).
 */
export const buildAttendanceDayKeyByEventId = (events: AttendanceEvent[]) => {
  // Group events by userId first, then process each user independently
  const eventsByUser = new Map<string, AttendanceEvent[]>();
  
  for (const event of events) {
    const userId = String(event.userId);
    if (!eventsByUser.has(userId)) {
      eventsByUser.set(userId, []);
    }
    eventsByUser.get(userId)!.push(event);
  }

  // If all events belong to a single user (common case), skip the grouping overhead
  if (eventsByUser.size <= 1) {
    return buildDayKeysForSingleUser(events);
  }

  // Process each user's events independently and merge results
  const mergedKeyById: Record<string, string> = {};
  
  for (const [, userEvents] of eventsByUser) {
    const userKeys = buildDayKeysForSingleUser(userEvents);
    Object.assign(mergedKeyById, userKeys);
  }

  return mergedKeyById;
};
