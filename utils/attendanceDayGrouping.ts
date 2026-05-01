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
 * Group events by "attendance day" rather than raw calendar day.
 *
 * If a session starts late night and ends after midnight, all events in that open
 * session (including break-in/out and the eventual checkout) are attributed to the
 * session start date (night shift behavior).
 */
export const buildAttendanceDayKeyByEventId = (events: AttendanceEvent[]) => {
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
      // If we are starting a sub-session (like Site OT) while a primary session (like Punch In)
      // is already open, inherit the primary's startKey.
      const startKey = existingStartKey || eventKey;
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

