import { processEmployeeMonth, resolveUserRules } from '../utils/monthlyReportCalculations';
import type { User, AttendanceEvent, SiteShiftDefinition } from '../types';

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

const dummyUser: User = {
  id: 'golekha-parida-id',
  name: 'Golekha Parida',
  role: 'Security Guard',
  organizationId: 'rmz-site-id',
  societyId: 'company-id',
  email: 'golekha@example.com',
  gender: 'male',
} as any;

const dummyUserRules = {
  enableSiteTimeTracking: true,
  enableShiftManagement: true,
  dailyWorkingHours: { max: 9.0 },
  siteShifts: [shiftA, shiftB, shiftC],
};

const dummyAttendance = {
  roleMapping: {
    office: [],
    field: [],
    site: ['security_guard']
  },
  site: dummyUserRules,
};

// Events for June 3rd (continuous 24 hours of work) using local timestamps and site-in/out types
const events: AttendanceEvent[] = [
  {
    id: 'e1',
    userId: 'golekha-parida-id',
    type: 'site-in',
    timestamp: '2026-06-03T21:05:00',
    locationName: 'RMZ Site',
  },
  {
    id: 'e2',
    userId: 'golekha-parida-id',
    type: 'site-out',
    timestamp: '2026-06-04T20:57:00',
    locationName: 'RMZ Site',
  }
] as any[];

console.log("Processing monthly report for June 2026...");
const report = processEmployeeMonth(
  dummyUser,
  events,
  [], // userLeaves
  [], // userHolidays
  2026, // year
  6,    // month (June)
  [],   // officeHolidays
  [],   // fieldHolidays
  [],   // siteHolidays
  [],   // recurringHolidays
  [],   // allLeaves
  'Security Guard', // resolvedRole
  [],   // routePoints
  null, // versionedUserRules
  dummyAttendance // attendance settings
);

const day3Data = report.dailyData.find(d => d.date === 3);
console.log("\n--- Day 3 Data ---");
if (day3Data) {
  console.log(`In Time: ${day3Data.inTime}`);
  console.log(`Out Time: ${day3Data.outTime}`);
  console.log(`Net Worked Hours: ${day3Data.netWorkedHours}`);
  console.log(`Shift: ${day3Data.shift}`);
} else {
  console.log("No data for Day 3");
}

console.log("\n--- Shift Counts Summary ---");
console.log(JSON.stringify(report.shiftCounts, null, 2));

console.log("\n--- OT Summary (site staff only) ---");
console.log(`OT Days: ${report.overtimeDays}`);
console.log(`Total Payable Days: ${report.totalPayableDays}`);
