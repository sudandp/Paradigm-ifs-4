import { evaluateAttendanceStatus } from '../utils/attendanceCalculations';

const status = evaluateAttendanceStatus({
    day: new Date('2026-06-04'),
    userId: '123',
    userCategory: 'office',
    userRules: {},
    dayEvents: [],
    officeHolidays: [],
    fieldHolidays: [],
    siteHolidays: [],
    recurringHolidays: [],
    userHolidaysPool: [],
    leaves: [{
        userId: '123',
        startDate: '2026-06-04',
        endDate: '2026-06-04',
        status: 'approved',
        leaveType: 'EL',
        dayOption: 'half'
    }],
    daysPresentInWeek: 5,
    isActiveInPreviousWeek: true,
    workingHours: 0
} as any);

console.log("Evaluated status:", status);
