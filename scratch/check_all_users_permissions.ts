import { api } from '../services/api';
import { getEarlyDepartureDeductions } from '../utils/attendanceCalculations';
import { format, startOfMonth, endOfMonth, subDays, startOfWeek } from 'date-fns';

async function checkAllUsers() {
  const users = await api.getUsers();
  const year = 2026;
  const month = 8;
  const startDate = startOfMonth(new Date(year, month - 1));
  const endDate = endOfMonth(new Date(year, month - 1));
  const fetchStartDate = startOfWeek(subDays(startDate, 15), { weekStartsOn: 1 });

  const userIds = users.map(u => u.id);
  const allEvents = await api.getAttendanceEventsForUsers(
    userIds,
    format(fetchStartDate, 'yyyy-MM-dd'),
    format(new Date(endDate.getTime() + 36 * 60 * 60 * 1000), 'yyyy-MM-dd HH:mm:ss')
  );

  const leavesRes = await api.getLeaveRequests({
    startDate: format(subDays(startDate, 45), 'yyyy-MM-dd'),
    endDate: format(new Date(endDate.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  });
  const allLeaves = leavesRes?.data || [];

  const eventsByUser = new Map<string, any[]>();
  allEvents.forEach(e => {
    const uid = String(e.userId);
    if (!eventsByUser.has(uid)) eventsByUser.set(uid, []);
    eventsByUser.get(uid)!.push(e);
  });

  const leavesByUser = new Map<string, any[]>();
  allLeaves.forEach((l: any) => {
    const uid = String(l.userId || l.user_id);
    if (!leavesByUser.has(uid)) leavesByUser.set(uid, []);
    leavesByUser.get(uid)!.push(l);
  });

  console.log('--- USERS WITH FRACTIONAL OR PERMISSION STATUSES IN AUG 2026 ---');
  for (const user of users) {
    const uEvents = eventsByUser.get(user.id) || [];
    const uLeaves = leavesByUser.get(user.id) || [];
    const deductions = getEarlyDepartureDeductions(uEvents, 480, uLeaves, uLeaves, '2026-08');
    if (deductions.length > 0) {
      console.log(`User: ${user.name} (${user.role}) - Early departure deductions (${deductions.length}):`, deductions.map(d => `${d.dateStr}: early ${d.earlyMins}m, worked ${d.formattedWorked} (${d.permissionTimeRange})`));
    }
  }
}

checkAllUsers().catch(console.error);
