import { api } from '../services/api';
import { processEmployeeMonth } from '../utils/monthlyReportCalculations';
import { startOfMonth, endOfMonth, subDays, startOfWeek, format, isAfter, startOfToday } from 'date-fns';

async function testMonthlyHoursReportExact() {
  const year = 2026;
  const month = 8;
  const userId = 'all';

  const startDate = startOfMonth(new Date(year, month - 1));
  let endDate = endOfMonth(new Date(year, month - 1));
  const today = startOfToday();
  if (isAfter(endDate, today)) endDate = today;

  const versionedGlobalRules = await api.getRuleVersionForMonth(year, month);
  const [usersData, leavesDataResponse, userHolidaysData, rolesData, globalHolidaysRes, allSiteHolidays, orgStructureData] = await Promise.all([
    api.getUsers(),
    api.getLeaveRequests({ 
      startDate: format(subDays(startDate, 45), 'yyyy-MM-dd'),
      endDate: format(new Date(endDate.getTime() + 24*60*60*1000), 'yyyy-MM-dd')
    }),
    api.getAllUserHolidays({ year }),
    api.getRoles(),
    api.getInitialAppData(),
    api.getAllSiteSpecificHolidays(),
    api.getOrganizationStructure().catch(() => [])
  ]);

  const leavesData = leavesDataResponse?.data || [];
  const kavya = usersData.find(u => u.name === 'Kavya M');
  if (!kavya) { console.log('Kavya not found'); return; }

  const fetchStartDate = startOfWeek(subDays(startDate, 15), { weekStartsOn: 1 });
  const allEvents = await api.getAttendanceEventsForUsers(
    [kavya.id],
    format(fetchStartDate, 'yyyy-MM-dd'),
    format(new Date(endDate.getTime() + 36 * 60 * 60 * 1000), 'yyyy-MM-dd HH:mm:ss')
  );

  const eventsByUser = new Map<string, any[]>();
  allEvents.forEach(e => {
    const uid = String(e.userId);
    if (!eventsByUser.has(uid)) eventsByUser.set(uid, []);
    eventsByUser.get(uid)!.push(e);
  });

  const leavesByUser = new Map<string, any[]>();
  (leavesData || []).forEach((l: any) => {
    const lUserId = String(l.userId || l.user_id);
    const lStatus = String(l.status || l.leaveStatus || '').toLowerCase();
    const isApproved = ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(lStatus);
    if (isApproved) {
      if (!leavesByUser.has(lUserId)) leavesByUser.set(lUserId, []);
      leavesByUser.get(lUserId)!.push(l);
    }
  });

  const currentMasterHolidays = globalHolidaysRes?.holidays || [];
  const currentOfficeHolidays = currentMasterHolidays.filter((h: any) => h.type === 'office');
  const currentFieldHolidays = currentMasterHolidays.filter((h: any) => h.type === 'field');
  const currentSiteHolidays = currentMasterHolidays.filter((h: any) => h.type === 'site');
  const currentRecurringHolidays = [{ day: 'Saturday', n: 3, type: 'office' }];

  const uid = String(kavya.id);
  const userEvents = eventsByUser.get(uid) || [];
  const userLeaves = leavesByUser.get(uid) || [];

  const attSettings = globalHolidaysRes?.attendanceSettings || (globalHolidaysRes as any)?.attendance || {};

  console.log('userLeaves for Kavya count:', userLeaves.length, userLeaves.map(l => ({ type: l.leaveType, start: l.startDate, status: l.status })));
  console.log('userEvents for Kavya count:', userEvents.length);

  const result = processEmployeeMonth(
    kavya,
    userEvents,
    userLeaves,
    userHolidaysData || [],
    year,
    month,
    currentOfficeHolidays,
    currentFieldHolidays,
    currentSiteHolidays,
    currentRecurringHolidays,
    userLeaves,
    'hr_ops',
    [],
    versionedGlobalRules,
    attSettings,
    []
  );

  console.log('Monthly exact result statuses:', result.statuses);
  console.log('Summary stats:', {
    presentDays: result.presentDays,
    halfDays: result.halfDays,
    earnedLeaves: result.earnedLeaves,
    floatingHolidays: result.floatingHolidays,
    absentDays: result.absentDays,
    totalPayableDays: result.totalPayableDays
  });
}

testMonthlyHoursReportExact().catch(console.error);
