import { detectAllShiftsWorked } from '../utils/shiftDetection';
import type { SiteShiftDefinition } from '../types';

const shiftA: SiteShiftDefinition = {
  id: 'shift-a-id',
  name: 'Shift A',
  startTime: '07:00',
  endTime: '15:00',
  crossesMidnight: false,
};

const shiftB: SiteShiftDefinition = {
  id: 'shift-b-id',
  name: 'Shift B',
  startTime: '13:00',
  endTime: '21:00',
  crossesMidnight: false,
};

const shiftC: SiteShiftDefinition = {
  id: 'shift-c-id',
  name: 'Shift C',
  startTime: '21:00',
  endTime: '07:00',
  crossesMidnight: true,
};

const shifts = [shiftA, shiftB, shiftC];

console.log("Running detectAllShiftsWorked test with 24 hours (21:05 on June 3 to 20:57 on June 4):");
const result = detectAllShiftsWorked(
  '2026-06-03T21:05:00',
  '2026-06-04T20:57:00',
  shifts
);

console.log("Resulting shifts:", result.map(s => s.name).join(', '));
