import { processEmployeeMonth } from '../utils/monthlyReportCalculations';
import type { User, AttendanceEvent } from '../types';

const mockUser: User = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  role: 'office_staff',
  organizationId: 'org-id',
  societyId: 'soc_head_office',
  location: 'Bangalore'
};

const mockEvents: AttendanceEvent[] = [
  {
    id: 'event-1',
    userId: 'test-user-id',
    type: 'punch-in',
    timestamp: '2026-06-27T09:00:00Z',
    source: 'web',
    locationName: 'Bangalore'
  },
  {
    id: 'event-2',
    userId: 'test-user-id',
    type: 'punch-out',
    timestamp: '2026-06-27T12:25:00Z', // 3h 25m worked
    source: 'web',
    locationName: 'Bangalore'
  }
];

// Mock approved permission (3 hours = 180m)
const mockPermission = {
  id: 'perm-1',
  userId: 'test-user-id',
  leaveType: 'Permission',
  status: 'approved',
  startDate: '2026-06-27T00:00:00Z',
  endDate: '2026-06-27T23:59:59Z',
  correctionDetails: {
    punchIn: '13:00',
    punchOut: '16:00',
    includeBreak: false
  }
};

// Mock approved main leave (0.5 EL)
const mockMainLeave = {
  id: 'leave-1',
  userId: 'test-user-id',
  leaveType: 'Earned Leave',
  status: 'approved',
  startDate: '2026-06-27T00:00:00Z',
  endDate: '2026-06-27T23:59:59Z',
  dayOption: 'half'
};

const allLeaves = [mockPermission, mockMainLeave];

console.log('Running processEmployeeMonth...');
try {
  const result = processEmployeeMonth(
    mockUser,
    mockEvents,
    allLeaves, // userLeaves
    [], // userHolidays
    2026, // year
    6, // month (June)
    [], // passedOfficeHolidays
    [], // passedFieldHolidays
    [], // passedSiteHolidays
    [], // passedRecurringHolidays
    allLeaves, // allLeaves
    'office_staff', // resolvedRole
    [], // routePoints
    null, // versionedUserRules
    { office: { dailyWorkingHours: { min: 8, max: 9 } } }, // attendance configuration
    [] // scopedSettings
  );

  console.log('Calculation successful!');
  console.log('Result Statuses:', result.statuses);
  console.log('Result DailyData for 27th:', result.dailyData[26]);
} catch (error: any) {
  console.error('Calculation failed with error:', error);
}
