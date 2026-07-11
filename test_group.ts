type AttendanceEvent = any;

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

    const activeSessions = Object.values(open).filter(Boolean) as Array<{ startKey: string; startMs: number }>;
    const existingStartKey = activeSessions.length > 0 
      ? activeSessions.reduce((best, cur) => (cur.startMs < best.startMs ? cur : best)).startKey 
      : null;

    if (kind && isStartEvent(event)) {
      if (open[kind]) {
        // ...
      }
      open[kind] = { startKey: existingStartKey || eventKey, startMs: eventDate.getTime() };
      keyById[event.id] = existingStartKey || eventKey;
    } else if (kind && isEndEvent(event)) {
      if (open[kind]) {
        keyById[event.id] = open[kind]!.startKey;
        open[kind] = undefined;
      } else {
        keyById[event.id] = existingStartKey || eventKey;
      }
    } else {
      keyById[event.id] = existingStartKey || eventKey;
    }
  }

  return keyById;
};

const events: AttendanceEvent[] = [
    { id: '1', timestamp: '2026-07-10T04:22:08.662+00:00', type: 'punch-in', workType: 'office' } as any,
    { id: '2', timestamp: '2026-07-10T04:22:22.023+00:00', type: 'punch-in', workType: 'field' } as any,
    { id: '3', timestamp: '2026-07-10T12:20:09.649+00:00', type: 'break-in', workType: 'office' } as any,
    { id: '4', timestamp: '2026-07-10T12:21:18.228+00:00', type: 'break-out', workType: 'office' } as any,
    { id: '5', timestamp: '2026-07-11T08:08:00.000+00:00', type: 'punch-out', workType: 'office' } as any,
    { id: '6', timestamp: '2026-07-11T08:08:00.000+00:00', type: 'punch-out', workType: 'field' } as any,
];

console.log(buildDayKeysForSingleUser(events));
