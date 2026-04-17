const { calculateWorkingHours } = require('../utils/attendanceCalculations');

// Ravi's sequence based on the screenshot and analysis
const events = [
  { type: 'punch-in', timestamp: '2026-04-17T06:51:00Z', workType: 'office' },
  { type: 'punch-in', timestamp: '2026-04-17T07:10:00Z', workType: 'field' },
  { type: 'punch-out', timestamp: '2026-04-17T08:59:00Z', workType: 'field' },
  { type: 'punch-out', timestamp: '2026-04-17T15:01:00Z', workType: 'office' }
];

console.log('Testing with current calculateWorkingHours implementation...');
const result = calculateWorkingHours(events, new Date('2026-04-17'));
console.log('Working Hours:', result.workingHours);
console.log('Working Hours (Formatted):', `${Math.floor(result.workingHours)}:${Math.round((result.workingHours % 1) * 60).toString().padStart(2, '0')}`);

// Expected: 8:10 (490 minutes)
// Current (Predicted): 2:08 (128 minutes)
