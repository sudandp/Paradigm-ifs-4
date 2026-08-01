import { SupabaseClient } from '@supabase/supabase-js';
import { format, startOfDay } from 'date-fns';
import { FIXED_HOLIDAYS } from './constants';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

export interface ReportData {
  [key: string]: string;
}

/**
 * Shared Helper: Get IST Date String (YYYY-MM-DD)
 */
export function getISTDateString(date: Date): string {
  const istDate = new Date(date.getTime() + IST_OFFSET);
  return istDate.toISOString().substring(0, 10);
}

/**
 * Shared Report Generation Utility
 * These functions can be used by both Vercel APIs and local scripts.
 */

export const reportGenerators = {
  /**
   * Generates a comprehensive daily attendance report.
   */
  attendance_daily: async (supabase: SupabaseClient, nowIST: Date): Promise<ReportData> => {
    const startOfTodayUTC = startOfDay(new Date(nowIST.getTime() - IST_OFFSET));
    const todayStr = nowIST.toISOString().substring(0, 10);

    const [settingsRes, usersRes, eventsRes, leavesRes] = await Promise.all([
      supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single(),
      supabase.from('users').select('id, name, role:roles(display_name)').neq('role_id', 'unverified'),
      supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', startOfTodayUTC.toISOString()).order('timestamp', { ascending: true }),
      supabase.from('leave_requests').select('user_id').eq('status', 'approved').lte('start_date', todayStr).gte('end_date', todayStr)
    ]);

    const configStartTime = settingsRes.data?.attendance_settings?.office?.fixedOfficeHours?.checkInTime || '09:30';
    const filteredUsers = (usersRes.data || []).filter((u: any) => {
      const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
      return roleName.toLowerCase() !== 'management';
    });
    
    const staffIds = new Set(filteredUsers.map((u: any) => u.id));
    const todayEvents = (eventsRes.data || []).filter((e: any) => staffIds.has(e.user_id));
    const onLeaveUserIds = new Set((leavesRes.data || []).map((l: any) => l.user_id));

    // Inactivity lookback (10 days)
    const tenDaysAgoUTC = new Date(startOfTodayUTC.getTime() - (9 * 24 * 60 * 60 * 1000));
    const { data: recentEvents } = await supabase.from('attendance_events').select('user_id').gte('timestamp', tenDaysAgoUTC.toISOString());
    const recentlyActiveUserIds = new Set((recentEvents || []).map((e: any) => e.user_id));

    const presentUserIds = new Set<string>();
    const userFirstPunches: Record<string, string> = {};
    todayEvents.forEach((e: any) => {
      presentUserIds.add(e.user_id);
      if ((e.type === 'punch-in' || e.type === 'check_in') && !userFirstPunches[e.user_id]) userFirstPunches[e.user_id] = e.timestamp;
    });

    let lateCount = 0;
    Object.values(userFirstPunches).forEach(ts => {
      const inDate = new Date(new Date(ts).getTime() + IST_OFFSET);
      const inTime = `${String(inDate.getUTCHours()).padStart(2, '0')}:${String(inDate.getUTCMinutes()).padStart(2, '0')}`;
      if (inTime > configStartTime) lateCount++;
    });

    const totalPresent = presentUserIds.size;
    const onLeaveCount = Array.from(onLeaveUserIds).filter(id => staffIds.has(id)).length;
    const inactiveCount = Math.max(0, filteredUsers.length - recentlyActiveUserIds.size);
    const totalAbsent = Math.max(0, filteredUsers.length - totalPresent - onLeaveCount - inactiveCount);

    let tableHtml = '';
    filteredUsers.forEach((user: any, i: number) => {
      let dept = (Array.isArray(user.role) ? user.role[0]?.display_name : user.role?.display_name) || 'Staff';
      dept = dept.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

      let status = 'Present', color = '#16a34a', pin = '—', pout = '—', wh = '—';
      if (presentUserIds.has(user.id)) {
        const inTs = userFirstPunches[user.id];
        if (inTs) {
          const inDate = new Date(new Date(inTs).getTime() + IST_OFFSET);
          pin = format(inDate, 'hh:mm a');
          const inTime = `${String(inDate.getUTCHours()).padStart(2, '0')}:${String(inDate.getUTCMinutes()).padStart(2, '0')}`;
          if (inTime > configStartTime) { status = 'Late'; color = '#d97706'; }
        }

        const lastOut = todayEvents.filter((e: any) => e.user_id === user.id && (e.type === 'punch-out' || e.type === 'check_out')).pop();
        if (lastOut) {
          pout = format(new Date(new Date(lastOut.timestamp).getTime() + IST_OFFSET), 'hh:mm a');
          if (inTs) {
            const diff = new Date(lastOut.timestamp).getTime() - new Date(inTs).getTime();
            wh = `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
          }
        }
      } else if (onLeaveUserIds.has(user.id)) { status = 'On Leave'; color = '#2563eb'; }
      else if (recentlyActiveUserIds.has(user.id)) { status = 'Absent'; color = '#dc2626'; }
      else { status = 'Inactive'; color = '#9ca3af'; }

      tableHtml += `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td style="border:1px solid #eee;padding:8px">${i+1}</td>
        <td style="border:1px solid #eee;padding:8px;font-weight:500">${user.name}</td>
        <td style="border:1px solid #eee;padding:8px">${dept}</td>
        <td style="border:1px solid #eee;padding:8px">${pin}</td>
        <td style="border:1px solid #eee;padding:8px">${pout}</td>
        <td style="border:1px solid #eee;padding:8px">${wh}</td>
        <td style="border:1px solid #eee;padding:8px;color:${color};font-weight:600">${status}</td>
      </tr>`;
    });

    return {
      date: format(nowIST, 'EEEE, MMMM do, yyyy'),
      reportDate: format(nowIST, 'dd MMM yyyy'),
      generatedTime: format(nowIST, 'hh:mm a'),
      year: format(nowIST, 'yyyy'),
      totalEmployees: String(filteredUsers.length),
      totalPresent: String(totalPresent),
      totalAbsent: String(totalAbsent),
      lateCount: String(lateCount),
      attendancePercentage: filteredUsers.length > 0 ? Math.round((totalPresent/filteredUsers.length)*100).toString() : '0',
      onLeaveCount: String(onLeaveCount),
      inactiveCount: String(inactiveCount),
      table: tableHtml || '<tr><td colspan="7">No data</td></tr>'
    };
  },

  /**
   * Generates Monthly Attendance Report (Matrix Grid)
   */
  attendance_monthly: async (supabase: SupabaseClient, nowIST: Date): Promise<ReportData> => {
    const targetDate = new Date(nowIST.getFullYear(), nowIST.getMonth() - 1, 1);
    const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    const monthStr = format(targetDate, 'MMMM yyyy');
    const daysInMonth = lastDayOfMonth.getDate();

    const bufferStartDate = new Date(firstDayOfMonth);
    bufferStartDate.setDate(firstDayOfMonth.getDate() - 7);

    const [usersRes, eventsRes, leavesRes, holidaysRes, recurringHolidaysRes] = await Promise.all([
      supabase.from('users').select('id, name, role:roles(display_name)').neq('role_id', 'unverified').order('name'),
      supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', bufferStartDate.toISOString()).lte('timestamp', lastDayOfMonth.toISOString()).order('timestamp', { ascending: true }),
      supabase.from('leave_requests').select('user_id, start_date, end_date, leave_type').eq('status', 'approved').gte('end_date', getISTDateString(bufferStartDate)).lte('start_date', getISTDateString(lastDayOfMonth)),
      supabase.from('holidays').select('*').gte('date', getISTDateString(bufferStartDate)).lte('date', getISTDateString(lastDayOfMonth)),
      supabase.from('recurring_holidays').select('*')
    ]);

    const users = (usersRes.data || []) as any[];
    const events = (eventsRes.data || []) as any[];
    const leaves = (leavesRes.data || []) as any[];
    const holidays = (holidaysRes.data || []) as any[];
    const recurringHolidays = (recurringHolidaysRes.data || []) as any[];

    let totalPresentCount = 0;

    let tableHtml = `<style>
.report-grid { width: 100%; border-collapse: collapse; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 8px; border: 1px solid #e2e8f0; }
.report-grid th { border: 1px solid #e2e8f0; padding: 6px 3px; font-weight: 700; background-color: #f8fafc; color: #1e293b; }
.report-grid td { border: 1px solid #e2e8f0; padding: 4px 2px; text-align: center; color: #334155; }
.report-grid td.emp-name { text-align: left; font-weight: 600; min-width: 120px; padding: 6px 6px; color: #0f172a; }
.report-grid td.p { color: #166534; font-weight: bold; background-color: #f0fdf4; }
.report-grid td.a { color: #991b1b; background-color: #fef2f2; }
.report-grid td.wo { color: #4b5563; background-color: #f9fafb; }
.report-grid td.h { color: #854d0e; background-color: #fffbeb; font-weight: bold; }
.report-grid td.hd { color: #92400e; background-color: #fffbeb; font-weight: bold; }
.report-grid td.ot { color: #0d9488; background-color: #f0f9ff; font-weight: bold; }
.report-grid td.co { color: #0891b2; background-color: #fdf2f8; font-weight: bold; }
.report-grid td.el { color: #4f46e5; background-color: #f5f3ff; font-weight: bold; }
.report-grid td.sl { color: #7c3aed; background-color: #fff1f2; font-weight: bold; }
.report-grid td.tot { font-weight: 800; background-color: #f3f4f6; color: #1e293b; border-left: 2px solid #10b981; }
.report-grid tr.even { background-color: #ffffff; }
.report-grid tr.odd { background-color: #f8fafc; }
</style>
<table class="report-grid">
<thead>
        <tr style="background: #e5e7eb; color: #111827;">
          <th style="border: 1px solid #999; padding: 4px; text-align: left; width: 120px;">Employee Name</th>`;
    
    for (let d = 1; d <= daysInMonth; d++) {
      tableHtml += `<th style="border: 1px solid #999; padding: 2px; text-align: center; width: 18px;">${String(d).padStart(2, '0')}</th>`;
    }
    tableHtml += `<th style="border: 1px solid #999; padding: 4px; text-align: center; background: #d1fae5; color: #065f46;">P</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #dbeafe; color: #1e40af;">0.5P</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #ccfbf1; color: #0f766e;">OT (P)</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #cffafe; color: #0e7490;">C/O</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #e0e7ff; color: #3730a3;">E/L</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #fdf4ff; color: #701a75;">C/L</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #f3e8ff; color: #6b21a8;">S/L</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #fee2e2; color: #991b1b;">A</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #ddd;">W/O</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #ffedd5; color: #9a3412;">H</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #ddd; font-weight: 800;">Pay</th>
        </tr>
      </thead>
      <tbody>`;

    users.forEach((user, idx) => {
      tableHtml += `<tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
        <td class="emp-name">${user.name}</td>`;
      
      let presentCount = 0;
      let halfDayCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let weeklyOffCount = 0;
      let totalWorkHours = 0;
      let overtimeCount = 0;
      let sickLeaveCount = 0;
      let earnedLeaveCount = 0;
      let casualLeaveCount = 0;
      let compOffCount = 0;
      let holidayCount = 0;

      let daysPresentInWeek = 0;
      // Pre-calculate work days in the overlapping week before the month starts
      const firstDay = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
      const startOfFirstWeek = new Date(firstDay);
      startOfFirstWeek.setDate(firstDay.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1)); // Mon
      
      if (firstDay > startOfFirstWeek) {
        let check = new Date(startOfFirstWeek);
        while (check < firstDay) {
          const cStr = getISTDateString(check);
          const isSun = (user.weeklyOffDays && user.weeklyOffDays.length > 0) ? user.weeklyOffDays.includes(check.getDay()) : check.getDay() === 0;
          if (isSun) {
            daysPresentInWeek = 0;
          } else {
            const dayEvs = events.filter(e => e.user_id === user.id && getISTDateString(new Date(e.timestamp)) === cStr);
            const dayLv = leaves.find(l => l.user_id === user.id && cStr >= l.start_date && cStr <= l.end_date);
            const isH = holidays.find(h => h.date === cStr);

            let worked = false;
            const hasActivity = dayEvs.length > 0;
            
            if (hasActivity) {
              worked = true;
            } else if (dayLv && !['loss of pay', 'loss-of-pay', 'lop'].includes((dayLv.leave_type || '').toLowerCase())) {
              worked = true;
            } else if (isH) {
              worked = true;
            }
            if (worked) daysPresentInWeek++;
          }
          check.setDate(check.getDate() + 1);
        }
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const currentDate = new Date(nowIST.getFullYear(), nowIST.getMonth(), d);
        const isSunday = (user.weeklyOffDays && user.weeklyOffDays.length > 0) ? user.weeklyOffDays.includes(currentDate.getDay()) : currentDate.getDay() === 0;
        const isMonday = currentDate.getDay() === 1;
        
        if (isMonday) daysPresentInWeek = 0;

        const dateStr = getISTDateString(currentDate);
        const dayEvents = events.filter(e => e.user_id === user.id && getISTDateString(new Date(e.timestamp)) === dateStr);
        const dayLeave = leaves.find(l => l.user_id === user.id && dateStr >= l.start_date && dateStr <= l.end_date);
        const isPublicHoliday = holidays.find(h => h.date === dateStr) || FIXED_HOLIDAYS.some(fh => dateStr.endsWith('-' + fh.date));

        let status = 'A';
        let color = '#dc2626';
        let dayWorked = false;
        let bgColor = 'transparent';
        
        const punchIn = dayEvents.find(e => e.type === 'punch-in' || e.type === 'check_in');
        const punchOut = dayEvents.filter(e => e.type === 'punch-out' || e.type === 'check_out').pop();

        let workStatus = 'A';
        let workColor = '#dc2626';
        let leaveStatus = '';
        let leaveColor = '';

        if (punchIn || punchOut) {
          const durationHours = (punchIn && punchOut) ? (new Date(punchOut.timestamp).getTime() - new Date(punchIn.timestamp).getTime()) / 3600000 : 0;
          totalWorkHours += durationHours;
          if (isSunday) {
            if (punchIn) {
              workStatus = 'WOP';
              workColor = '#0d9488';
              dayWorked = true;
            }
          } else if (durationHours >= 5 || (!punchOut && punchIn)) {
            workStatus = 'P';
            workColor = '#16a34a';
            if (durationHours > 14) overtimeCount++;
            dayWorked = true;
          } else if (durationHours > 1) {
            workStatus = '0.5P';
            workColor = '#d97706';
            dayWorked = true;
          } else if (punchIn) {
            workStatus = 'P';
            workColor = '#16a34a';
            dayWorked = true;
          }
        }

        let isCorrection = false;
        let isHalfDayLeave = false;

        if (dayLeave) {
          const lt = (dayLeave.leave_type || '').toLowerCase();
          const lStatus = String(dayLeave.status || dayLeave.leaveStatus || '').toLowerCase();
          isCorrection = lt.includes('correction') || lStatus === 'correction_made';
          isHalfDayLeave = dayLeave.day_option === 'half';

          const isLOP = ['loss of pay', 'loss-of-pay', 'lop'].includes(lt);
          if (isCorrection) {
              leaveStatus = 'P';
              leaveColor = '#16a34a';
          } else if (lt === 'sick') { 
              leaveStatus = 'S/L'; 
              leaveColor = '#7c3aed'; 
          } else if (lt.includes('comp') || lt === 'c/o') { 
              leaveStatus = 'C/O'; 
              leaveColor = '#0891b2'; 
          } else if (lt === 'casual' || lt === 'c/l') { 
              leaveStatus = 'C/L'; 
              leaveColor = '#701a75'; 
          } else if (isLOP) { 
              leaveStatus = 'A'; 
              leaveColor = '#dc2626'; 
          } else { 
              leaveStatus = 'E/L'; 
              leaveColor = '#4f46e5'; 
          }
        }

        // Combine logic
        if (isCorrection) {
            status = 'P';
            color = '#16a34a';
            presentCount++;
            dayWorked = true;
        } else if (workStatus !== 'A' && isHalfDayLeave) {
            status = '0.5P';
            color = '#1d4ed8'; // blueish for half-day split
            halfDayCount++;
            if (leaveStatus === 'S/L') { sickLeaveCount += 0.5; leaveCount += 0.5; }
            else if (leaveStatus === 'C/O') { compOffCount += 0.5; leaveCount += 0.5; }
            else if (leaveStatus === 'E/L') { earnedLeaveCount += 0.5; leaveCount += 0.5; }
            else if (leaveStatus === 'C/L') { casualLeaveCount += 0.5; leaveCount += 0.5; }
            dayWorked = true;
        } else if (workStatus !== 'A') {
            status = workStatus;
            color = workColor;
            if (status === 'P' || status === 'WOP') presentCount++;
            else if (status === '0.5P') halfDayCount++;
        } else if (dayLeave) {
            status = leaveStatus;
            color = leaveColor;
            if (status === 'S/L') { sickLeaveCount++; }
            else if (status === 'C/O') { compOffCount++; }
            else if (status === 'E/L') { earnedLeaveCount++; }
            else if (status === 'C/L') { casualLeaveCount++; }
            else if (status === 'A') absentCount++;
            else if (status === 'P') presentCount++;
            
            if (status !== 'A') dayWorked = true;
        } else if (isPublicHoliday) {
            status = 'H';
            color = '#854d0e';
            bgColor = '#fef9c3';
            holidayCount++;
            dayWorked = true;
        } else if (isSunday) {
            if (daysPresentInWeek >= 3) {
                status = 'W/O';
                color = '#6b7280';
                weeklyOffCount++;
            } else {
                status = 'A';
                color = '#dc2626';
                absentCount++;
            }
        } else {
            absentCount++;
        }

        if (dayWorked) daysPresentInWeek++;

        let cellClass = "";
        if (status === 'P') cellClass = 'class="p"';
        else if (status === 'A') cellClass = 'class="a"';
        else if (status === 'W/O') cellClass = 'class="wo"';
        else if (status === 'H') cellClass = 'class="h"';
        else if (status.includes('0.5')) cellClass = 'class="hd"';
        else if (status.includes('SL')) cellClass = 'class="sl"';
        else if (status.includes('EL')) cellClass = 'class="el"';
        else if (status.includes('CO') || status.includes('C/O')) cellClass = 'class="co"';
        else cellClass = `style="color: ${color}; background: ${bgColor}; font-weight: bold;"`;

        tableHtml += `<td ${cellClass}>${status}</td>`;
      }

      const grandTotal = presentCount + (halfDayCount * 0.5) + sickLeaveCount + earnedLeaveCount + casualLeaveCount + compOffCount + weeklyOffCount + holidayCount + overtimeCount;

      tableHtml += `<td class="p">${presentCount}</td>
        <td class="hd">${halfDayCount}</td>
        <td class="ot">${overtimeCount}</td>
        <td class="co">${compOffCount}</td>
        <td class="el">${earnedLeaveCount}</td>
        <td class="tot" style="color: #701a75;">${casualLeaveCount}</td>
        <td class="sl">${sickLeaveCount}</td>
        <td class="a">${absentCount}</td>
        <td class="wo">${weeklyOffCount}</td>
        <td class="h">${holidayCount}</td>
        <td class="tot">${grandTotal}</td>
      </tr>`;
      
      totalPresentCount += presentCount;
    });

    tableHtml += `</tbody></table>`;

    const billingCycle = `01 ${format(targetDate, 'MMM yyyy')} - ${daysInMonth} ${format(targetDate, 'MMM yyyy')}`;
    const totalPossibleDays = users.length * daysInMonth; // Or a more accurate calculation if needed
    const attendancePercentage = totalPossibleDays > 0 ? Math.round((totalPresentCount / totalPossibleDays) * 100).toString() : '0';

    tableHtml += `<div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; font-family: sans-serif;">
      <table style="width: 100%; border-collapse: collapse; text-align: center;">
        <tr>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #166534; font-weight: bold;">P:</span> PRESENT</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #991b1b; font-weight: bold;">A:</span> ABSENT</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #991b1b; font-weight: bold;">LOP:</span> LOSS OF PAY</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #92400e; font-weight: bold;">0.5P:</span> HALF DAY</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #155e75; font-weight: bold;">W/H:</span> WFH</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #0c4a6e; font-weight: bold;">W/P:</span> WEEK OFF WORK</td>
        </tr>
        <tr>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #475569; font-weight: bold;">W/O:</span> WEEKLY OFF</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #b45309; font-weight: bold;">H:</span> HOLIDAY</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #0369a1; font-weight: bold;">OT(P):</span> OT / EXTRAP</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #6d28d9; font-weight: bold;">S/L:</span> SICK LEAVE</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #4338ca; font-weight: bold;">E/L:</span> EARNED LEAVE</td>
          <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #be185d; font-weight: bold;">C/O:</span> COMP OFF</td>
        </tr>
      </table>
      <div style="text-align: center; margin-top: 15px; font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Paradigm Services - Monthly Status Report</div>
    </div>`;

    return {
      date: monthStr,
      billingCycle: billingCycle,
      reportDate: format(nowIST, 'dd MMM yyyy'),
      generatedTime: format(nowIST, 'hh:mm a'),
      year: format(nowIST, 'yyyy'),
      totalEmployees: String(users.length),
      totalPresent: String(totalPresentCount),
      attendancePercentage: attendancePercentage,
      table: tableHtml,
      generatedBy: 'Manual Request'
    };
  },

  /**
   * Generates Work Hours Report (Grid Style)
   */
  attendance_work_hours: async (supabase: SupabaseClient, nowIST: Date): Promise<ReportData> => {
    const firstDayOfMonth = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
    const lastDayOfMonth = new Date(nowIST.getFullYear(), nowIST.getMonth() + 1, 0);
    const monthStr = format(nowIST, 'MMMM yyyy');
    const daysInMonth = lastDayOfMonth.getDate();

    const [usersRes, eventsRes] = await Promise.all([
      supabase.from('users').select('id, name, role:roles(display_name)').neq('role_id', 'unverified').order('name'),
      supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', firstDayOfMonth.toISOString()).lte('timestamp', lastDayOfMonth.toISOString()).order('timestamp', { ascending: true })
    ]);

    const users = (usersRes.data || []) as any[];
    const events = (eventsRes.data || []) as any[];

    let tableHtml = `<thead>
        <tr style="background: #111827; color: #fff;">
          <th style="border: 1px solid #555; padding: 4px; text-align: left; width: 120px;">Employee Name</th>`;
    
    for (let d = 1; d <= daysInMonth; d++) {
      tableHtml += `<th style="border: 1px solid #555; padding: 2px; text-align: center; width: 18px;">${d}</th>`;
    }
    tableHtml += `<th style="border: 1px solid #555; padding: 4px; text-align: center; background: #374151;">Total</th></tr></thead><tbody>`;

    users.forEach((user, idx) => {
      tableHtml += `<tr style="background: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
        <td style="border: 1px solid #ddd; padding: 4px; font-weight: 500;">${user.name}</td>`;
      
      let totalMonthMinutes = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = format(new Date(nowIST.getFullYear(), nowIST.getMonth(), d), 'yyyy-MM-dd');
        const dayEvents = events.filter(e => e.user_id === user.id && getISTDateString(new Date(e.timestamp)) === dateStr);
        
        let dayMinutes = 0;
        const punchIn = dayEvents.find(e => (e.type === 'punch-in' || e.type === 'check_in'));
        const punchOut = dayEvents.filter(e => (e.type === 'punch-out' || e.type === 'check_out')).pop();

        if (punchIn && punchOut) {
          dayMinutes = (new Date(punchOut.timestamp).getTime() - new Date(punchIn.timestamp).getTime()) / 60000;
          totalMonthMinutes += dayMinutes;
        }

        const hours = dayMinutes > 0 ? (dayMinutes / 60).toFixed(1) : '-';
        tableHtml += `<td style="border: 1px solid #ddd; padding: 2px; text-align: center;">${hours}</td>`;
      }

      const totalHours = (totalMonthMinutes / 60).toFixed(1);
      tableHtml += `<td style="border: 1px solid #ddd; padding: 4px; text-align: center; font-weight: bold; background: #f3f4f6;">${totalHours}</td>
      </tr>`;
    });

    tableHtml += `</tbody>`;

    return {
      date: monthStr,
      totalEmployees: String(users.length),
      table: tableHtml
    };
  },

  /**
   * Generates Site OT Report
   */
  attendance_site_ot: async (supabase: SupabaseClient, nowIST: Date): Promise<ReportData> => {
    const monthStr = format(nowIST, 'MMMM yyyy');

    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, monthly_ot_hours, site_assignments(site_id, organizations(name))')
      .gt('monthly_ot_hours', 0);

    let tableHtml = `<table style="width:100%; border-collapse: collapse; font-size: 12px; border: 1px solid #ddd;">
      <thead>
        <tr style="background: #f3f4f6; color: #374151;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Employee</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Primary Site</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">OT Hours (Monthly)</th>
        </tr>
      </thead>
      <tbody>`;

    const users = (usersData || []) as any[];
    if (users.length === 0) {
      tableHtml += `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #666;">No overtime recorded for this period.</td></tr>`;
    } else {
      users.forEach((user, idx) => {
        const siteName = user.site_assignments?.[0]?.organizations?.name || 'Unassigned';
        tableHtml += `<tr style="background: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: 500;">${user.name}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${siteName}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold; color: #d97706;">${user.monthly_ot_hours || 0}h</td>
        </tr>`;
      });
    }

    tableHtml += `</tbody></table>`;

    return {
      date: monthStr,
      totalStaffWithOT: String(users.length),
      table: tableHtml
    };
  },

  /**
   * Generates Audit Log Report
   */
  attendance_audit: async (supabase: SupabaseClient, nowIST: Date): Promise<ReportData> => {
    const twentyFourHoursAgo = new Date(nowIST.getTime() - (24 * 60 * 60 * 1000));
    const dateStr = format(nowIST, 'EEEE, MMMM do, yyyy');

    const { data: logsData } = await supabase
      .from('attendance_audit_logs')
      .select('id, action, details, created_at, performed_by, target_user_id')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false });

    const auditLogs = (logsData || []) as any[];
    
    // Fetch users involved in the logs to get names
    const userIds = new Set<string>();
    auditLogs.forEach(log => {
      if (log.performed_by) userIds.add(log.performed_by);
      if (log.target_user_id) userIds.add(log.target_user_id);
    });

    let userMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name')
        .in('id', Array.from(userIds));
      usersData?.forEach(u => { userMap[u.id] = u.name; });
    }

    let tableHtml = `<table style="width:100%; border-collapse: collapse; font-family: sans-serif; font-size: 11px; border: 1px solid #ddd;">
      <thead>
        <tr style="background: #f3f4f6; color: #374151;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Time</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Performed By</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Action</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Target</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Reason/Details</th>
        </tr>
      </thead>
      <tbody>`;

    if (auditLogs.length === 0) {
      tableHtml += `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #666;">No administrative changes in the last 24 hours.</td></tr>`;
    } else {
      auditLogs.forEach((log, idx) => {
        const time = format(new Date(new Date(log.created_at).getTime() + IST_OFFSET), 'hh:mm a');
        const details = log.details?.reason || log.details?.message || JSON.stringify(log.details);
        const performerName = userMap[log.performed_by] || 'System';
        const targetName = userMap[log.target_user_id] || '—';
        
        tableHtml += `<tr style="background: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
          <td style="border: 1px solid #ddd; padding: 8px;">${time}</td>
          <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${performerName}</td>
          <td style="border: 1px solid #ddd; padding: 8px;"><span style="padding: 2px 6px; background: #fee2e2; color: #991b1b; border-radius: 4px; text-transform: uppercase; font-size: 9px;">${log.action}</span></td>
          <td style="border: 1px solid #ddd; padding: 8px;">${targetName}</td>
          <td style="border: 1px solid #ddd; padding: 8px; color: #666;">${details}</td>
        </tr>`;
      });
    }

    tableHtml += `</tbody></table>`;

    return {
      date: dateStr,
      logCount: String(auditLogs.length),
      table: tableHtml
    };
  },

  /**
   * Placeholder for Document Expiry Report
   */
  document_expiry: async (supabase: SupabaseClient, nowIST: Date): Promise<ReportData> => {
    return {
      date: format(nowIST, 'yyyy-MM-dd'),
      items: '0',
      table: '<tr><td colspan="5">No expiring documents found.</td></tr>'
    };
  },

  /**
   * Placeholder for Pending Approvals Report
   */
  pending_approvals: async (supabase: SupabaseClient, nowIST: Date): Promise<ReportData> => {
    return {
      date: format(nowIST, 'yyyy-MM-dd'),
      items: '0',
      table: '<tr><td colspan="4">No pending approvals.</td></tr>'
    };
  },

  /**
   * CRM BD Daily Activity Report
   */
  crm_bd_daily: async (supabase: SupabaseClient, nowIST: Date): Promise<ReportData | ReportData[]> => {
    const todayStr = getISTDateString(nowIST);
    const startOfTodayUTC = startOfDay(new Date(nowIST.getTime() - IST_OFFSET));
    const sevenDaysAgoUTC = new Date(startOfTodayUTC.getTime() - 7 * 24 * 3600000);

    const { data: usersRes } = await supabase.from('users').select('id, name, role_id, role:roles(display_name)').eq('is_blocked', false);
    const bdUsers = (usersRes || []).filter((u: any) => {
      const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
      const roleId = (u.role_id || '').toLowerCase();
      const rName = roleName.toLowerCase();
      return rName === 'business developer' || rName === 'business_developer' || rName === 'bd' || roleId === 'business_developer' || roleId === 'bd';
    });

    const defaultDate = format(nowIST, 'dd MMM yyyy');
    if (bdUsers.length === 0) {
      return {
        date: defaultDate,
        bd_name: 'All BDs',
        bdName: 'All BDs',
        report_date: defaultDate,
        reportDate: defaultDate,
        attendance_status: 'No Active BDs',
        attendanceStatus: 'No Active BDs',
        check_in_time: 'N/A',
        checkInTime: 'N/A',
        check_out_time: 'N/A',
        checkOutTime: 'N/A',
        working_hours: '0h 0m',
        workingHours: '0h 0m',
        kms_travelled: '0',
        kmsTravelled: '0',
        prospect_calls: '0',
        prospectCalls: '0',
        followup_calls: '0',
        followupCalls: '0',
        new_leads_count: '0',
        newLeadsCount: '0',
        sites_count: '0',
        sitesCount: '0',
        sites_visited: 'None',
        sitesVisited: 'None',
        new_leads_table: '<div style="padding:16px;text-align:center;color:#64748b;">No active Business Developers found.</div>',
        newLeadsTable: '<div style="padding:16px;text-align:center;color:#64748b;">No active Business Developers found.</div>',
        metrics_table: '<div style="padding:16px;text-align:center;color:#64748b;">No activity metrics available.</div>',
        metricsTable: '<div style="padding:16px;text-align:center;color:#64748b;">No activity metrics available.</div>',
        pipeline_snapshot: '<div style="padding:16px;text-align:center;color:#64748b;">No pipeline data available.</div>',
        pipelineSnapshot: '<div style="padding:16px;text-align:center;color:#64748b;">No pipeline data available.</div>'
      };
    }

    const [eventsRes, leadsRes, callsRes, allLeadsRes, sevenDayFollowupsRes, sevenDayEventsRes] = await Promise.all([
      supabase.from('attendance_events').select('user_id, type, timestamp, latitude, longitude, travel_distance').gte('timestamp', startOfTodayUTC.toISOString()).order('timestamp', { ascending: true }),
      supabase.from('crm_leads').select('id, created_by, assigned_to, company_name, client_name, association_name, contact_person, status, source, city, created_at, stage_updated_at, updated_at, next_followup_date, lost_reason').gte('created_at', startOfTodayUTC.toISOString()),
      supabase.from('crm_followups').select('created_by, type, outcome, lead_id, created_at, next_followup_date').gte('created_at', startOfTodayUTC.toISOString()),
      supabase.from('crm_leads').select('id, created_by, assigned_to, company_name, client_name, association_name, contact_person, status, source, city, created_at, stage_updated_at, updated_at, next_followup_date, lost_reason'),
      supabase.from('crm_followups').select('created_by, type, outcome, lead_id, created_at, next_followup_date').gte('created_at', sevenDaysAgoUTC.toISOString()),
      supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', sevenDaysAgoUTC.toISOString()).eq('type', 'punch-in')
    ]);

    const events = eventsRes.data || [];
    const leads = leadsRes.data || [];
    const calls = callsRes.data || [];
    const allLeads = allLeadsRes.data || [];
    const sevenDayFollowups = sevenDayFollowupsRes.data || [];
    const sevenDayEvents = sevenDayEventsRes.data || [];

    const leadName = (l: any) => l.company_name || l.association_name || l.client_name || 'Unknown';
    const daysSince = (dateStr: string | null | undefined): number => {
      if (!dateStr) return 999;
      return (nowIST.getTime() - new Date(dateStr).getTime()) / 86400000;
    };
    const stageOrder: Record<string, number> = { 'Negotiation': 1, 'Proposal Sent': 2, 'Survey Completed': 3, 'Site Visit Planned': 4, 'Contacted': 5, 'New Lead': 6, 'Onboarding Started': 1 };
    const stageColor: Record<string, string> = { 'Negotiation': '#f97316', 'Proposal Sent': '#ec4899', 'Survey Completed': '#06b6d4', 'Site Visit Planned': '#f59e0b', 'Contacted': '#8b5cf6', 'New Lead': '#3b82f6', 'Won': '#10b981', 'Lost': '#ef4444', 'Onboarding Started': '#006b3f' };

    const reports: ReportData[] = [];

    for (const bd of bdUsers) {
      const bdEvents = [...events.filter((e: any) => e.user_id === bd.id)].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const attendance_status = bdEvents.length > 0 ? 'Present' : 'Absent';
      const toIST = (ts: string): Date => new Date(new Date(ts).getTime() + IST_OFFSET);
      const firstPunchIn = bdEvents.find((e: any) => e.type === 'punch-in');
      const lastPunchOut = [...bdEvents].reverse().find((e: any) => e.type === 'punch-out');
      let check_in_time = 'N/A';
      let check_out_time = 'N/A';
      if (firstPunchIn) check_in_time = format(toIST(firstPunchIn.timestamp), 'hh:mm a');
      if (lastPunchOut) check_out_time = format(toIST(lastPunchOut.timestamp), 'hh:mm a');
      let working_hours = '0h 0m';
      if (firstPunchIn && lastPunchOut) {
        const totalMs = new Date(lastPunchOut.timestamp).getTime() - new Date(firstPunchIn.timestamp).getTime();
        if (totalMs > 0) {
          let breakMs = 0; let lastBreakInTs: number | null = null;
          bdEvents.forEach((e: any) => {
            if (e.type === 'break-in') { lastBreakInTs = new Date(e.timestamp).getTime(); }
            else if (e.type === 'break-out' && lastBreakInTs !== null) { breakMs += new Date(e.timestamp).getTime() - lastBreakInTs; lastBreakInTs = null; }
          });
          const netMs = Math.max(0, totalMs - breakMs);
          working_hours = `${Math.floor(netMs / 3600000)}h ${Math.floor((netMs % 3600000) / 60000)}m`;
        }
      }
      // Fix: travel_distance is cumulative (each GPS ping stores the running total, not delta).
      // The old naive sum was multiplying the value by the number of pings (~10x inflation).
      // Correct approach: use the maximum recorded value (the final cumulative reading).
      const travelValues = bdEvents.map((e: any) => e.travel_distance || 0).filter((d: number) => d > 0);
      const kms_travelled = travelValues.length > 0 ? Math.max(...travelValues).toFixed(2) : '0.00';

      const newLeadsToday = leads.filter((l: any) => l.created_by === bd.id || l.assigned_to === bd.id);
      const newLeadsIds = new Set(newLeadsToday.map((l: any) => l.id));
      const isCallType = (t: string) => ['call', 'phone call', 'outbound call'].includes((t || '').toLowerCase());
      const isSiteVisitType = (t: string) => ['site visit', 'sitevisit', 'site-visit'].includes((t || '').toLowerCase());
      const allBDLeads = allLeads.filter((l: any) => l.assigned_to === bd.id || l.created_by === bd.id);
      const allBDLeadIds = new Set(allBDLeads.map((l: any) => l.id));
      // Fix: match calls by lead ownership too, not just created_by,
      // to handle followups where created_by differs from the BD's user id.
      const bdCalls = calls.filter((c: any) => c.created_by === bd.id || allBDLeadIds.has(c.lead_id));
      const prospect_calls = bdCalls.filter((c: any) => isCallType(c.type) && newLeadsIds.has(c.lead_id)).length;
      const followup_calls = bdCalls.filter((c: any) => isCallType(c.type) && !newLeadsIds.has(c.lead_id)).length;
      const new_leads_count = newLeadsToday.length;
      const siteVisitsFromCRM = bdCalls.filter((c: any) => isSiteVisitType(c.type)).length;
      const siteVisitsFromAttendance = bdEvents.filter((e: any) => e.type === 'site-in').length;
      const sites_count = siteVisitsFromCRM > 0 ? siteVisitsFromCRM : siteVisitsFromAttendance;



      // ── SECTION 1: Follow-up Completion Rate ─────────────────────────────
      const todayFollowupsDone = calls.filter((c: any) => c.created_by === bd.id).length;
      const todayScheduled = sevenDayFollowups.filter((f: any) => {
        if (!f.next_followup_date) return false;
        const fDateStr = new Date(f.next_followup_date).toISOString().substring(0, 10);
        return fDateStr === todayStr && allBDLeads.some((l: any) => l.id === f.lead_id);
      }).length;
      const completionRate = todayScheduled > 0 ? Math.min(100, Math.round((todayFollowupsDone / todayScheduled) * 100)) : (todayFollowupsDone > 0 ? 100 : 0);
      const rateColor = completionRate >= 80 ? '#10b981' : completionRate >= 50 ? '#f59e0b' : '#ef4444';
      const rateLabel = completionRate >= 80 ? '✅ On Track' : completionRate >= 50 ? '⚠️ Moderate' : '🔴 Needs Attention';
      const followup_completion_block = `<div style="margin-bottom:20px;padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">📋 Follow-up Completion</div><div style="font-size:11px;font-weight:600;color:${rateColor};background:${rateColor}15;padding:4px 10px;border-radius:20px;">${rateLabel}</div></div><div style="display:flex;align-items:center;gap:16px;"><div style="font-size:36px;font-weight:800;color:${rateColor};">${completionRate}%</div><div><div style="font-size:12px;color:#64748b;margin-bottom:2px;">Done today: <strong style="color:#1e293b;">${todayFollowupsDone}</strong></div><div style="font-size:12px;color:#64748b;">Scheduled: <strong style="color:#1e293b;">${todayScheduled}</strong></div></div></div><div style="margin-top:12px;background:#e2e8f0;border-radius:100px;height:8px;overflow:hidden;"><div style="width:${completionRate}%;background:${rateColor};height:8px;border-radius:100px;"></div></div></div>`;

      // ── SECTION 2: Overdue/Stale Leads Alert ─────────────────────────────
      const overdueLeads = allBDLeads.filter((l: any) => {
        if (['Won', 'Lost'].includes(l.status)) return false;
        const lastActivity = l.stage_updated_at || l.updated_at || l.created_at;
        const daysStale = daysSince(lastActivity);
        const hasOverdueFollowup = l.next_followup_date && new Date(l.next_followup_date) < nowIST;
        return daysStale >= 7 || hasOverdueFollowup;
      }).sort((a: any, b: any) => daysSince(b.stage_updated_at || b.updated_at || b.created_at) - daysSince(a.stage_updated_at || a.updated_at || a.created_at));
      let overdue_leads_block = '';
      if (overdueLeads.length === 0) {
        overdue_leads_block = `<div style="padding:16px;text-align:center;color:#10b981;font-weight:600;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">✅ No stale leads — all active leads have recent activity!</div>`;
      } else {
        const criticalCount = overdueLeads.filter((l: any) => daysSince(l.stage_updated_at || l.updated_at || l.created_at) >= 14).length;
        const alertColor = criticalCount > 0 ? '#ef4444' : '#f59e0b';
        const alertBg = criticalCount > 0 ? '#fef2f2' : '#fffbeb';
        overdue_leads_block = `<div style="background:${alertBg};border:1px solid ${alertColor}30;border-left:4px solid ${alertColor};border-radius:8px;padding:12px 16px;margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:${alertColor};">${criticalCount > 0 ? '🔴' : '🟡'} ${overdueLeads.length} lead(s) need attention${criticalCount > 0 ? ` — ${criticalCount} critical (14+ days)` : ''}</div></div><table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Lead</th><th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Stage</th><th style="padding:8px 12px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Days Stale</th><th style="padding:8px 12px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Next Action</th></tr></thead><tbody>` +
          overdueLeads.slice(0, 8).map((l: any, i: number) => {
            const days = Math.floor(daysSince(l.stage_updated_at || l.updated_at || l.created_at));
            const daysColor = days >= 14 ? '#ef4444' : days >= 7 ? '#f59e0b' : '#64748b';
            const sc = stageColor[l.status] || '#64748b';
            const nextAction = l.next_followup_date ? format(new Date(l.next_followup_date), 'dd MMM') : 'Not set';
            const overdueNote = l.next_followup_date && new Date(l.next_followup_date) < nowIST ? ' ⚠️' : '';
            return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};border-top:1px solid #f1f5f9;"><td style="padding:10px 12px;font-weight:600;color:#1e293b;">${leadName(l)}</td><td style="padding:10px 12px;"><span style="background:${sc}20;color:${sc};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;">${l.status}</span></td><td style="padding:10px 12px;text-align:center;font-weight:700;color:${daysColor};">${days}d</td><td style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;">${nextAction}${overdueNote}</td></tr>`;
          }).join('') + `</tbody></table>`;
      }

      // ── SECTION 3: Top 5 Closest-to-Close ────────────────────────────────
      const activeLeads = allBDLeads.filter((l: any) => !['Won', 'Lost'].includes(l.status)).sort((a: any, b: any) => (stageOrder[a.status] || 9) - (stageOrder[b.status] || 9)).slice(0, 5);
      const top_leads_block = activeLeads.length === 0
        ? `<div style="padding:16px;text-align:center;color:#64748b;font-style:italic;">No active leads in pipeline.</div>`
        : `<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">#</th><th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Lead</th><th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Stage</th><th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">City</th><th style="padding:8px 12px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Next Followup</th></tr></thead><tbody>` +
          activeLeads.map((l: any, i: number) => {
            const sc = stageColor[l.status] || '#64748b';
            const nf = l.next_followup_date ? format(new Date(l.next_followup_date), 'dd MMM') : '—';
            return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};border-top:1px solid #f1f5f9;"><td style="padding:10px 12px;font-weight:700;color:#94a3b8;">${i + 1}</td><td style="padding:10px 12px;font-weight:600;color:#1e293b;">${leadName(l)}</td><td style="padding:10px 12px;"><span style="background:${sc}20;color:${sc};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;">${l.status}</span></td><td style="padding:10px 12px;color:#64748b;">${l.city || '—'}</td><td style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;">${nf}</td></tr>`;
          }).join('') + `</tbody></table>`;

      // ── SECTION 4: Won/Lost This Week ─────────────────────────────────────
      const wonThisWeek = allBDLeads.filter((l: any) => l.status === 'Won' && daysSince(l.stage_updated_at || l.updated_at) <= 7);
      const lostThisWeek = allBDLeads.filter((l: any) => l.status === 'Lost' && daysSince(l.stage_updated_at || l.updated_at) <= 7);
      const totalDecided = wonThisWeek.length + lostThisWeek.length;
      const winRate = totalDecided > 0 ? Math.round((wonThisWeek.length / totalDecided) * 100) : 0;
      const won_lost_block = `<div style="display:table;width:100%;border-collapse:separate;border-spacing:12px;"><div style="display:table-cell;width:50%;vertical-align:top;"><div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center;"><div style="font-size:28px;font-weight:800;color:#10b981;">${wonThisWeek.length}</div><div style="font-size:11px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.5px;">🏆 Won This Week</div>${wonThisWeek.slice(0, 3).map((l: any) => `<div style="font-size:11px;color:#064e3b;margin-top:4px;">• ${leadName(l)}</div>`).join('')}</div></div><div style="display:table-cell;width:50%;vertical-align:top;"><div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;text-align:center;"><div style="font-size:28px;font-weight:800;color:#ef4444;">${lostThisWeek.length}</div><div style="font-size:11px;font-weight:600;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;">❌ Lost This Week</div>${lostThisWeek.slice(0, 3).map((l: any) => `<div style="font-size:11px;color:#7f1d1d;margin-top:4px;">• ${leadName(l)}${l.lost_reason ? ` (${l.lost_reason})` : ''}</div>`).join('')}</div></div></div>${totalDecided > 0 ? `<div style="margin-top:8px;text-align:center;font-size:12px;color:#64748b;">Win Rate this week: <strong style="color:${winRate >= 50 ? '#10b981' : '#ef4444'};">${winRate}%</strong></div>` : '<div style="margin-top:8px;text-align:center;font-size:12px;color:#94a3b8;font-style:italic;">No Won/Lost decisions this week.</div>'}`;

      // ── SECTION 5: Lead Source Breakdown ─────────────────────────────────
      const sourceCounts: Record<string, number> = {};
      allBDLeads.forEach((l: any) => { const src = l.source || 'Unknown'; sourceCounts[src] = (sourceCounts[src] || 0) + 1; });
      const sourceEntries = Object.entries(sourceCounts).sort(([, a], [, b]) => b - a);
      const maxSourceCount = sourceEntries.length > 0 ? sourceEntries[0][1] : 1;
      const sourceColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];
      const lead_source_block = sourceEntries.length === 0
        ? `<div style="padding:16px;text-align:center;color:#64748b;font-style:italic;">No lead source data available.</div>`
        : sourceEntries.map(([src, count], i) => {
          const pct = Math.round((count / maxSourceCount) * 100);
          const clr = sourceColors[i % sourceColors.length];
          return `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span style="font-weight:500;color:#1e293b;">${src}</span><span style="font-weight:700;color:${clr};">${count} lead${count !== 1 ? 's' : ''}</span></div><div style="background:#e2e8f0;border-radius:100px;height:8px;overflow:hidden;"><div style="width:${pct}%;background:${clr};height:8px;border-radius:100px;"></div></div></div>`;
        }).join('');

      // ── SECTION 6: Today vs 7-Day Average ────────────────────────────────
      const dailyMetrics = Array.from({ length: 7 }, (_, i) => {
        const dayStr = new Date(startOfTodayUTC.getTime() - i * 86400000).toISOString().substring(0, 10);
        const dayFu = sevenDayFollowups.filter((f: any) => f.created_by === bd.id && f.created_at?.startsWith(dayStr));
        return { calls: dayFu.filter((f: any) => isCallType(f.type)).length, sites: dayFu.filter((f: any) => isSiteVisitType(f.type)).length };
      });
      const avgCalls = dailyMetrics.slice(1).reduce((a, d) => a + d.calls, 0) / 6 || 0;
      const avgSites = dailyMetrics.slice(1).reduce((a, d) => a + d.sites, 0) / 6 || 0;
      const todayTotalCalls = prospect_calls + followup_calls;
      const callsDelta = todayTotalCalls - avgCalls;
      const sitesDelta = sites_count - avgSites;
      const deltaStyle = (v: number) => v >= 0 ? 'color:#10b981;' : 'color:#ef4444;';
      const deltaSign = (v: number) => v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
      const seven_day_avg_block = `<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Metric</th><th style="padding:10px 14px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Today</th><th style="padding:10px 14px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">6-Day Avg</th><th style="padding:10px 14px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Δ Trend</th></tr></thead><tbody><tr><td style="padding:10px 14px;font-weight:500;color:#1e293b;border-top:1px solid #f1f5f9;">📞 Total Calls</td><td style="padding:10px 14px;text-align:center;font-weight:700;border-top:1px solid #f1f5f9;">${todayTotalCalls}</td><td style="padding:10px 14px;text-align:center;color:#64748b;border-top:1px solid #f1f5f9;">${avgCalls.toFixed(1)}</td><td style="padding:10px 14px;text-align:center;font-weight:700;border-top:1px solid #f1f5f9;${deltaStyle(callsDelta)}">${deltaSign(callsDelta)}</td></tr><tr style="background:#f9fafb;"><td style="padding:10px 14px;font-weight:500;color:#1e293b;border-top:1px solid #f1f5f9;">🏗️ Site Visits</td><td style="padding:10px 14px;text-align:center;font-weight:700;border-top:1px solid #f1f5f9;">${sites_count}</td><td style="padding:10px 14px;text-align:center;color:#64748b;border-top:1px solid #f1f5f9;">${avgSites.toFixed(1)}</td><td style="padding:10px 14px;text-align:center;font-weight:700;border-top:1px solid #f1f5f9;${deltaStyle(sitesDelta)}">${deltaSign(sitesDelta)}</td></tr><tr><td style="padding:10px 14px;font-weight:500;color:#1e293b;border-top:1px solid #f1f5f9;">📋 New Leads</td><td style="padding:10px 14px;text-align:center;font-weight:700;border-top:1px solid #f1f5f9;">${new_leads_count}</td><td style="padding:10px 14px;text-align:center;color:#64748b;border-top:1px solid #f1f5f9;">—</td><td style="padding:10px 14px;text-align:center;color:#94a3b8;border-top:1px solid #f1f5f9;">—</td></tr></tbody></table>`;

      // ── SECTION 7: Proposal→Negotiation Conversion Funnel ────────────────
      const inProposal = allBDLeads.filter((l: any) => l.status === 'Proposal Sent').length;
      const inNegotiation = allBDLeads.filter((l: any) => l.status === 'Negotiation').length;
      const inWon = allBDLeads.filter((l: any) => l.status === 'Won').length;
      const totalSent = inProposal + inNegotiation + inWon;
      const propToNegRate = totalSent > 0 ? Math.round(((inNegotiation + inWon) / totalSent) * 100) : 0;
      const negToWonRate = (inNegotiation + inWon) > 0 ? Math.round((inWon / (inNegotiation + inWon)) * 100) : 0;
      const conversion_funnel_block = `<div style="display:flex;gap:0;align-items:stretch;font-size:12px;"><div style="flex:1;background:#ede9fe;border-radius:8px 0 0 8px;padding:14px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#7c3aed;">${totalSent}</div><div style="font-size:10px;font-weight:600;color:#6d28d9;text-transform:uppercase;">Proposal Sent</div></div><div style="width:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f3f0ff;font-size:14px;color:#7c3aed;font-weight:700;">→<span style="font-size:9px;color:#8b5cf6;">${propToNegRate}%</span></div><div style="flex:1;background:#fff7ed;padding:14px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#f97316;">${inNegotiation + inWon}</div><div style="font-size:10px;font-weight:600;color:#ea580c;text-transform:uppercase;">Negotiation</div></div><div style="width:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fef3e2;font-size:14px;color:#f97316;font-weight:700;">→<span style="font-size:9px;color:#f97316;">${negToWonRate}%</span></div><div style="flex:1;background:#f0fdf4;border-radius:0 8px 8px 0;padding:14px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#10b981;">${inWon}</div><div style="font-size:10px;font-weight:600;color:#059669;text-transform:uppercase;">Won</div></div></div>`;

      // ── SECTION 8: Call Outcomes Breakdown ───────────────────────────────
      const outcomeCounts: Record<string, number> = {};
      calls.filter((c: any) => c.created_by === bd.id && isCallType(c.type)).forEach((c: any) => { const o = c.outcome || 'Not Recorded'; outcomeCounts[o] = (outcomeCounts[o] || 0) + 1; });
      const outcomeColors: Record<string, string> = { 'Interested': '#10b981', 'Not Interested': '#ef4444', 'Callback': '#f59e0b', 'Callback Requested': '#f59e0b', 'No Answer': '#94a3b8', 'Not Recorded': '#cbd5e1' };
      const call_outcomes_block = Object.keys(outcomeCounts).length === 0
        ? `<div style="padding:16px;text-align:center;color:#64748b;font-style:italic;">No calls logged today.</div>`
        : `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px 0;">` +
          Object.entries(outcomeCounts).map(([outcome, count]) => {
            const clr = outcomeColors[outcome] || '#64748b';
            return `<div style="display:inline-flex;align-items:center;gap:6px;background:${clr}15;border:1px solid ${clr}40;border-radius:20px;padding:6px 14px;"><div style="width:8px;height:8px;border-radius:50%;background:${clr};"></div><span style="font-size:12px;font-weight:600;color:${clr};">${outcome}</span><span style="font-size:12px;font-weight:800;color:#1e293b;">${count}</span></div>`;
          }).join('') + `</div>`;

      // ── SECTION 9: Geography / City Coverage ─────────────────────────────
      const uniqueCities = [...new Set(allBDLeads.map((l: any) => l.city).filter(Boolean))] as string[];
      const todaySiteInCount = bdEvents.filter((e: any) => e.type === 'site-in').length;
      const geography_block = `<div style="margin-bottom:12px;font-size:12px;color:#64748b;">🏗️ <strong style="color:#1e293b;">${todaySiteInCount} site visit${todaySiteInCount !== 1 ? 's' : ''}</strong> today &nbsp;|&nbsp; 🗺️ Active in <strong style="color:#1e293b;">${uniqueCities.length} city/cities</strong></div><div style="display:flex;flex-wrap:wrap;gap:6px;">${uniqueCities.slice(0, 10).map(city => `<span style="background:#e0f2fe;color:#0369a1;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;">${city}</span>`).join('')}${uniqueCities.length > 10 ? `<span style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:20px;font-size:11px;">+${uniqueCities.length - 10} more</span>` : ''}</div>`;

      // ── SECTION 10: Motivational Streak Strip ────────────────────────────
      let streak = 0;
      for (let i = 0; i < 7; i++) {
        const dayStr = new Date(startOfTodayUTC.getTime() - i * 86400000).toISOString().substring(0, 10);
        if (sevenDayEvents.some((e: any) => e.user_id === bd.id && e.timestamp?.startsWith(dayStr))) streak++;
        else break;
      }
      const streakBadge = streak >= 7 ? '🏆 7-Day Attendance Streak!' : streak >= 5 ? '🔥 On Fire! 5+ Days!' : streak >= 3 ? '⭐ Building Momentum!' : streak >= 1 ? '💪 Keep Going!' : "📅 Let's Start Strong!";
      const streakBg = streak >= 5 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : streak >= 3 ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : 'linear-gradient(135deg,#64748b,#475569)';
      const streak_block = `<div style="background:${streakBg};border-radius:12px;padding:16px 20px;color:white;display:flex;justify-content:space-between;align-items:center;"><div><div style="font-size:16px;font-weight:800;">${streakBadge}</div><div style="font-size:12px;opacity:0.85;margin-top:2px;">${streak} consecutive day${streak !== 1 ? 's' : ''} present</div></div><div style="font-size:36px;font-weight:800;opacity:0.9;">${streak}</div></div>`;

      // ── Original tables: New Leads + Metrics + Pipeline ──────────────────
      let new_leads_table = `<div style="padding:16px;text-align:center;color:#64748b;font-style:italic;">No new leads added today.</div>`;
      if (newLeadsToday.length > 0) {
        new_leads_table = `<table width="100%" style="border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Company</th><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Contact</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Status</th></tr></thead><tbody>` +
          newLeadsToday.map((lead: any, i: number) => {
            const sc = stageColor[lead.status] || '#64748b';
            return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};"><td style="padding:12px 14px;font-size:12px;color:#1e293b;font-weight:600;border-top:1px solid #f1f5f9;">${leadName(lead)}</td><td style="padding:12px 14px;font-size:12px;color:#475569;border-top:1px solid #f1f5f9;">${lead.contact_person || '-'}</td><td style="padding:12px 14px;text-align:center;border-top:1px solid #f1f5f9;"><span style="background:${sc}20;color:${sc};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;">${lead.status}</span></td></tr>`;
          }).join('') + `</tbody></table>`;
      }
      const metricsData = [
        { metric: 'Outbound Calls (New Prospects)', actual: prospect_calls },
        { metric: 'Follow-up Calls', actual: followup_calls },
        { metric: 'Site Visits Conducted', actual: sites_count },
        { metric: 'New Leads Added', actual: new_leads_count },
        { metric: 'KMs Travelled', actual: kms_travelled }
      ];
      const metrics_table = `<table width="100%" style="border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Metric</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Actual</th></tr></thead><tbody>` +
        metricsData.map((row, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};"><td style="padding:12px 14px;font-size:12px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9;">${row.metric}</td><td style="padding:12px 14px;text-align:center;font-size:13px;font-weight:700;color:#0f172a;border-top:1px solid #f1f5f9;">${row.actual}</td></tr>`).join('') +
        `</tbody></table>`;

      const myLeads = allLeads.filter((l: any) => l.assigned_to === bd.id || l.created_by === bd.id);
      const allStages = ['New Lead', 'Contacted', 'Site Visit Planned', 'Survey Completed', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
      let activeTotal = 0;
      const pipeline_snapshot = `<table width="100%" style="border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Stage</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Count</th></tr></thead><tbody>` +
        allStages.map((stage, i) => {
          const count = myLeads.filter((l: any) => l.status === stage).length;
          if (!['Won', 'Lost'].includes(stage)) activeTotal += count;
          const sc = stageColor[stage] || '#64748b';
          return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};"><td style="padding:12px 14px;font-size:12px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sc};margin-right:6px;"></span>${stage}</td><td style="padding:12px 14px;text-align:center;font-size:13px;font-weight:700;color:${sc};border-top:1px solid #f1f5f9;">${count}</td></tr>`;
        }).join('') +
        `</tbody></table><div style="margin-top:8px;text-align:right;font-size:12px;font-weight:700;color:#166534;padding:8px;background:#f0fdf4;border-top:1px solid #bbf7d0;">Total active pipeline: ${activeTotal} leads</div>`;

      reports.push({
        bd_name: bd.name, bdName: bd.name,
        report_date: format(nowIST, 'dd MMM yyyy'), reportDate: format(nowIST, 'dd MMM yyyy'),
        date: format(nowIST, 'EEEE, MMMM do, yyyy'),
        attendance_status, attendanceStatus: attendance_status,
        check_in_time, checkInTime: check_in_time,
        check_out_time, checkOutTime: check_out_time,
        working_hours, workingHours: working_hours,
        kms_travelled, kmsTravelled: kms_travelled,
        prospect_calls: String(prospect_calls), prospectCalls: String(prospect_calls),
        followup_calls: String(followup_calls), followupCalls: String(followup_calls),
        new_leads_count: String(new_leads_count), newLeadsCount: String(new_leads_count),
        sites_count: String(sites_count), sitesCount: String(sites_count),
        sites_visited: String(sites_count), sitesVisited: String(sites_count),
        new_leads_table, newLeadsTable: new_leads_table,
        metrics_table, metricsTable: metrics_table,
        pipeline_snapshot, pipelineSnapshot: pipeline_snapshot,
        // 10 new enhanced sections
        followup_completion_block, followupCompletionBlock: followup_completion_block,
        overdue_leads_block, overdueLeadsBlock: overdue_leads_block,
        top_leads_block, topLeadsBlock: top_leads_block,
        won_lost_block, wonLostBlock: won_lost_block,
        lead_source_block, leadSourceBlock: lead_source_block,
        seven_day_avg_block, sevenDayAvgBlock: seven_day_avg_block,
        conversion_funnel_block, conversionFunnelBlock: conversion_funnel_block,
        call_outcomes_block, callOutcomesBlock: call_outcomes_block,
        geography_block, geographyBlock: geography_block,
        streak_block, streakBlock: streak_block
      });
    }

    return reports.length === 1 ? reports[0] : reports;
  },
  bd_daily: async (supabase: SupabaseClient, nowIST: Date): Promise<ReportData | ReportData[]> => {
    return (reportGenerators as any).crm_bd_daily(supabase, nowIST);
  }
};

/**
 * Evaluates template conditionals based on the reporting data provided.
 */
export function evaluateConditionals(str: string, data: Record<string, string>) {
  return str.replace(/\{(\w+)\s*([><!=]=?)\s*([0-9.]+)\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/ig, (m, key, op, val2Str, t, f) => {
    const v1 = parseFloat(data[Object.keys(data).find(k=>k.toLowerCase()===key.toLowerCase())||''] || '0');
    const v2 = parseFloat(val2Str);
    let ok = false;
    if(op==='>')ok=v1>v2; else if(op==='<')ok=v1<v2; else if(op==='>=')ok=v1>=v2; else if(op==='<=')ok=v1<=v2; else if(op==='==')ok=v1==v2; else if(op==='!=')ok=v1!=v2;
    return ok ? t : f;
  });
}

/**
 * Resolves recipient emails for a rule (Management role, specific users, or custom emails).
 */
export async function resolveRecipients(supabase: SupabaseClient, rule: any): Promise<string[]> {
  if (rule.recipient_type === 'custom_emails') return rule.recipient_emails || [];
  if (rule.recipient_type === 'role') {
    const { data: users } = await supabase.from('users').select('email').in('role_id', rule.recipient_roles || []);
    return (users || []).map((u: { email: string }) => u.email).filter(Boolean);
  }
  if (rule.recipient_type === 'users') {
    const { data: users } = await supabase.from('users').select('email').in('id', rule.recipient_user_ids || []);
    return (users || []).map((u: { email: string }) => u.email).filter(Boolean);
  }
  return [];
}
