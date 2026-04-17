import { calculateWorkingHours } from '../utils/attendanceCalculations.js';

// Ravi's sequence based on the screenshot and analysis
const events = [
  { type: 'punch-in', timestamp: '2026-04-17T06:51:00Z', workType: 'office', userId: 'ravi', id: '1' },
  { type: 'punch-in', timestamp: '2026-04-17T07:10:00Z', workType: 'field', userId: 'ravi', id: '2' },
  { type: 'punch-out', timestamp: '2026-04-17T08:59:00Z', workType: 'field', userId: 'ravi', id: '3' },
  { type: 'punch-out', timestamp: '2026-04-17T15:01:00Z', workType: 'office', userId: 'ravi', id: '4' }
] as any[];

console.log('Testing with current calculateWorkingHours implementation...');
const result = calculateWorkingHours(events, new Date('2026-04-17'));
console.log('Working Hours:', result.workingHours);
console.log('Working Hours (Formatted):', `${Math.floor(result.workingHours)}:${Math.round((result.workingHours % 1) * 60).toString().padStart(2, '0')}`);

// Expected: 8:10 (490 minutes) -> 8.166 hrs
// Current (Predicted): 2:08 (128 minutes) -> 2.133 hrs
