import { processDailyEvents } from '../utils/attendanceCalculations';

const events: any[] = [
    { type: 'punch-in', timestamp: '2026-07-21T03:30:00Z' },
    { type: 'punch-out', timestamp: '2026-07-21T18:29:00Z' },
    { type: 'punch-in', timestamp: '2026-07-22T04:30:00Z' }
];

const targetDate = new Date('2026-07-22T00:00:00'); // 22nd July local time
console.log(processDailyEvents(events, targetDate));
