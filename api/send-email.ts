import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as nodemailer from 'nodemailer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { format, startOfDay } from 'date-fns';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

// Internal Helpers (Simplified)
function getISTDateString(date: any): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return format(new Date(), 'yyyy-MM-dd'); // Fallback to safely formatted current date
    const istDate = new Date(d.getTime() + IST_OFFSET);
    return istDate.toISOString().substring(0, 10);
  } catch {
    return format(new Date(), 'yyyy-MM-dd');
  }
}

function safeFormat(date: any, formatStr: string, fallback = '—') {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch {
    return fallback;
  }
}

function evaluateConditionalsInternal(str: string, data: Record<string, string>) {
  return str.replace(/\{(\w+)\s*([><!=]=?)\s*([0-9.]+)\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/ig, (_m, key, op, val2Str, t, f) => {
    const cleanKey = key.toLowerCase().replace(/[_-]/g, '');
    const dataKey = Object.keys(data).find(k => k.toLowerCase().replace(/[_-]/g, '') === cleanKey);
    const v1 = parseFloat(dataKey ? data[dataKey] : '0');
    const v2 = parseFloat(val2Str);
    let ok = false;
    if(op==='>')ok=v1>v2; else if(op==='<')ok=v1<v2; else if(op==='>=')ok=v1>=v2; else if(op==='<=')ok=v1<=v2; else if(op==='==')ok=v1==v2; else if(op==='!=')ok=v1!=v2;
    return ok ? t : f;
  });
}

// Inlined Report Generators to avoid import crashes
const reportGenerators = {
  attendance_daily: async (supabase: SupabaseClient, nowIST: Date, filters?: any) => {
    const todayStr = (filters?.dateRange?.start && filters?.dateRange?.end && filters?.dateRange?.start === filters?.dateRange?.end) 
      ? filters.dateRange.start 
      : getISTDateString(nowIST);
    
    const startOfTodayUTC = startOfDay(new Date(new Date(todayStr).getTime()));
    const [settingsRes, usersRes, eventsRes, leavesRes] = await Promise.all([
      supabase.from('settings').select('attendance_settings').eq('id', 'singleton').maybeSingle(),
      supabase.from('users').select('id, name, role:roles(display_name)').eq('is_blocked', false),
      supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', startOfTodayUTC.toISOString()).order('timestamp', { ascending: true }),
      supabase.from('leave_requests').select('user_id').eq('status', 'approved').lte('start_date', todayStr).gte('end_date', todayStr)
    ]);
    const configStartTime = settingsRes.data?.attendance_settings?.office?.fixedOfficeHours?.checkInTime || '09:30';
    const filteredUsers = (usersRes.data || []).filter((u: any) => {
      const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
      return roleName.toLowerCase() !== 'management';
    });
    const staffIds = new Set(filteredUsers.map((u: any) => u.id));
    
    // Apply additional filters from dashboard
    let targetUsers = filteredUsers;
    if (filters?.user?.id) {
      targetUsers = filteredUsers.filter((u: any) => u.id === filters.user.id);
    } else if (filters?.role) {
      targetUsers = filteredUsers.filter((u: any) => {
        const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
        return roleName === filters.role;
      });
    }

    const todayEvents = (eventsRes.data || []).filter((e: any) => staffIds.has(e.user_id));
    const onLeaveUserIds = new Set((leavesRes.data || []).map((l: any) => l.user_id));
    const tenDaysAgoUTC = new Date(startOfTodayUTC.getTime() - (9 * 24 * 60 * 60 * 1000));
    const { data: recentEvents } = await supabase.from('attendance_events').select('user_id').gte('timestamp', tenDaysAgoUTC.toISOString());
    const recentlyActiveUserIds = new Set((recentEvents || []).map((e: any) => e.user_id));
    
    const presentUserIds = new Set<string>();
    const userFirstPunches: Record<string, string> = {};
    todayEvents.forEach((e: any) => {
      presentUserIds.add(e.user_id);
      if ((e.type === 'punch-in' || e.type === 'check_in') && !userFirstPunches[e.user_id]) userFirstPunches[e.user_id] = e.timestamp;
    });

    let tableHtml = `<table width="100%" style="border-collapse:collapse;font-family:sans-serif;font-size:12px;">
      <thead><tr style="background:#f8fafc;color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;">
        <th style="border:1px solid #e2e8f0;padding:10px 8px;text-align:center;">#</th>
        <th style="border:1px solid #e2e8f0;padding:10px 8px;text-align:left;">Employee Name</th>
        <th style="border:1px solid #e2e8f0;padding:10px 8px;text-align:left;">Role / Dept</th>
        <th style="border:1px solid #e2e8f0;padding:10px 8px;text-align:center;">Check In</th>
        <th style="border:1px solid #e2e8f0;padding:10px 8px;text-align:center;">Check Out</th>
        <th style="border:1px solid #e2e8f0;padding:10px 8px;text-align:center;">Break In</th>
        <th style="border:1px solid #e2e8f0;padding:10px 8px;text-align:center;">Break Out</th>
        <th style="border:1px solid #e2e8f0;padding:10px 8px;text-align:center;">OT In</th>
        <th style="border:1px solid #e2e8f0;padding:10px 8px;text-align:center;">OT Out</th>
        <th style="border:1px solid #e2e8f0;padding:10px 8px;text-align:center;">Work Hours</th>
        <th style="border:1px solid #e2e8f0;padding:10px 8px;text-align:center;">Status</th>
      </tr></thead><tbody>`;
    let lateCount = 0;
    targetUsers.forEach((user: any, i: number) => {
      let dept = (Array.isArray(user.role) ? user.role[0]?.display_name : user.role?.display_name) || 'Staff';
      dept = dept.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      let status = 'Present', color = '#16a34a', pin = '—', pout = '—', bin = '—', bout = '—', otin = '—', otout = '—', wh = '—';
      if (presentUserIds.has(user.id)) {
        const userEvents = todayEvents.filter((e: any) => e.user_id === user.id);
        const inTs = userFirstPunches[user.id];
        const inDate = new Date(new Date(inTs).getTime() + IST_OFFSET);
        pin = safeFormat(inDate, 'hh:mm a');
        
        const inTime = !isNaN(inDate.getTime()) ? `${String(inDate.getUTCHours()).padStart(2, '0')}:${String(inDate.getUTCMinutes()).padStart(2, '0')}` : '00:00';
        if (inTime > configStartTime) { status = 'Late'; color = '#d97706'; lateCount++; }
        
        const lastOut = userEvents.filter((e: any) => e.type === 'punch-out' || e.type === 'check_out').pop();
        if (lastOut) {
          const outDate = new Date(new Date(lastOut.timestamp).getTime() + IST_OFFSET);
          pout = safeFormat(outDate, 'hh:mm a');
          const diff = new Date(lastOut.timestamp).getTime() - new Date(inTs).getTime();
          wh = !isNaN(diff) ? `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m` : '—';
        }

        // Fetch Breaks
        const firstBIn = userEvents.find((e: any) => e.type === 'break-in' || e.type === 'break_in');
        const lastBOut = userEvents.filter((e: any) => e.type === 'break-out' || e.type === 'break_out').pop();
        if (firstBIn) bin = safeFormat(new Date(new Date(firstBIn.timestamp).getTime() + IST_OFFSET), 'hh:mm a');
        if (lastBOut) bout = safeFormat(new Date(new Date(lastBOut.timestamp).getTime() + IST_OFFSET), 'hh:mm a');

        // Fetch Site OT
        const firstOTIn = userEvents.find((e: any) => e.type === 'site-ot-in' || e.type === 'site_ot_in');
        const lastOTOut = userEvents.filter((e: any) => e.type === 'site-ot-out' || e.type === 'site_ot_out').pop();
        if (firstOTIn) otin = safeFormat(new Date(new Date(firstOTIn.timestamp).getTime() + IST_OFFSET), 'hh:mm a');
        if (lastOTOut) otout = safeFormat(new Date(new Date(lastOTOut.timestamp).getTime() + IST_OFFSET), 'hh:mm a');
      } else if (onLeaveUserIds.has(user.id)) { status = 'On Leave'; color = '#2563eb'; }
      else if (recentlyActiveUserIds.has(user.id)) { status = 'Absent'; color = '#dc2626'; }
      else { status = 'Inactive'; color = '#9ca3af'; }
      tableHtml += `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td style="border:1px solid #eee;padding:8px">${i+1}</td>
        <td style="border:1px solid #eee;padding:8px;font-weight:500">${user.name}</td>
        <td style="border:1px solid #eee;padding:8px">${dept}</td>
        <td style="border:1px solid #eee;padding:8px">${pin}</td>
        <td style="border:1px solid #eee;padding:8px">${pout}</td>
        <td style="border:1px solid #eee;padding:8px">${bin}</td>
        <td style="border:1px solid #eee;padding:8px">${bout}</td>
        <td style="border:1px solid #eee;padding:8px">${otin}</td>
        <td style="border:1px solid #eee;padding:8px">${otout}</td>
        <td style="border:1px solid #eee;padding:8px">${wh}</td>
        <td style="border:1px solid #eee;padding:8px;color:${color};font-weight:600">${status}</td>
      </tr>`;
    });
    
    const totalPresent = presentUserIds.size;
    const onLeaveCount = Array.from(onLeaveUserIds).filter(id => staffIds.has(id)).length;
    const totalAbsent = Math.max(0, targetUsers.length - totalPresent - onLeaveCount);

    tableHtml += `</tbody></table>`;

    return {
      date: safeFormat(new Date(todayStr), 'EEEE, MMMM do, yyyy'),
      reportDate: safeFormat(new Date(todayStr), 'dd MMM yyyy'),
      generatedTime: safeFormat(nowIST, 'hh:mm a'),
      year: safeFormat(nowIST, 'yyyy'),
      totalEmployees: String(targetUsers.length),
      totalPresent: String(totalPresent),
      totalAbsent: String(totalAbsent),
      lateCount: String(lateCount),
      attendancePercentage: targetUsers.length > 0 ? Math.round((totalPresent/targetUsers.length)*100).toString() : '0',
      onLeaveCount: String(onLeaveCount),
      logo: '<img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;">',
      table: tableHtml
    };
  },
  attendance_monthly: async (supabase: SupabaseClient, nowIST: Date, filters?: any) => {
    const targetDate = filters?.dateRange?.start ? new Date(filters.dateRange.start) : new Date(nowIST.getFullYear(), nowIST.getMonth() - 1, 1);
    const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    const monthStr = format(targetDate, 'MMMM yyyy');
    const daysInMonth = lastDayOfMonth.getDate();
    const today = new Date(nowIST.getTime());
    today.setUTCHours(0,0,0,0);

    const [settingsRes, usersRes, snapshotsRes, eventsRes, leavesRes, holidaysRes] = await Promise.all([
      supabase.from('settings').select('attendance_settings').eq('id', 'singleton').maybeSingle(),
      supabase.from('users').select('id, name, role:roles(display_name)').neq('role_id', 'unverified').eq('is_active', true).order('name'),
      supabase.from('attendance_month_snapshots').select('*').eq('year', targetDate.getFullYear()).eq('month', targetDate.getMonth() + 1),
      supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', firstDayOfMonth.toISOString()).lte('timestamp', lastDayOfMonth.toISOString()).order('timestamp', { ascending: true }),
      supabase.from('leave_requests').select('user_id, start_date, end_date, leave_type, status, day_option').eq('status', 'approved').gte('end_date', getISTDateString(firstDayOfMonth)).lte('start_date', getISTDateString(lastDayOfMonth)),
      supabase.from('holidays').select('*').gte('date', getISTDateString(firstDayOfMonth)).lte('date', getISTDateString(lastDayOfMonth))
    ]);

    const attendanceSettings = settingsRes.data?.attendance_settings;
    const configStartTime = attendanceSettings?.office?.fixedOfficeHours?.checkInTime || '09:30';
    const users = (usersRes.data || []) as any[];
    const events = (eventsRes.data || []) as any[];
    const leaves = (leavesRes.data || []) as any[];
    const holidays = (holidaysRes.data || []) as any[];
    const snapshots = (snapshotsRes.data || []) as any[];

    let targetUsers = users;
    if (filters?.user?.id) {
      targetUsers = users.filter(u => u.id === filters.user.id);
    } else if (filters?.role) {
      targetUsers = users.filter((u: any) => {
        const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
        return roleName === filters.role;
      });
    }

    let totalPresentCount = 0;
    let totalAbsentCount = 0;
    let totalLateCount = 0;

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
.report-grid td.ot { color: #075985; background-color: #f0f9ff; font-weight: bold; }
.report-grid td.co { color: #9d174d; background-color: #fdf2f8; font-weight: bold; }
.report-grid td.el { color: #5b21b6; background-color: #f5f3ff; font-weight: bold; }
.report-grid td.sl { color: #9f1239; background-color: #fff1f2; font-weight: bold; }
.report-grid td.tot { font-weight: 800; background-color: #ecfdf5; color: #065f46; border-left: 2px solid #10b981; }
.report-grid tr.even { background-color: #ffffff; }
.report-grid tr.odd { background-color: #f8fafc; }
</style>
<table class="report-grid">
    <thead>
      <tr style="background: #f8fafc; color: #1e293b; border-bottom: 2px solid #e2e8f0;">
        <th style="border: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; min-width: 140px; font-weight: 700;">Employee Name</th>`;
    
    for (let d = 1; d <= daysInMonth; d++) {
      tableHtml += `<th style="border: 1px solid #e2e8f0; padding: 4px 2px; text-align: center; width: 22px; font-size: 9px; font-weight: 600;">${d}</th>`;
    }
    tableHtml += `
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f0fdf4; color: #166534; width: 25px; font-weight: 700;">P</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fffbeb; color: #92400e; width: 35px; font-weight: 700;">0.5P</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f0f9ff; color: #075985; width: 25px; font-weight: 700;">OT</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fdf2f8; color: #9d174d; width: 25px; font-weight: 700;">C/O</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f5f3ff; color: #5b21b6; width: 25px; font-weight: 700;">E/L</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fff1f2; color: #9f1239; width: 25px; font-weight: 700;">S/L</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fef2f2; color: #991b1b; width: 25px; font-weight: 700;">A</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f9fafb; color: #4b5563; width: 30px; font-weight: 700;">W/O</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fffbeb; color: #854d0e; width: 25px; font-weight: 700;">H</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #ecfdf5; color: #065f46; width: 35px; font-weight: 800; border-left: 2px solid #10b981;">Pay</th>
        </tr>
    </thead>
    <tbody>`;

    targetUsers.forEach((user, idx) => {
      tableHtml += `<tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
        <td class="emp-name">${user.name}</td>`;
      
      let countP = 0, countHalfP = 0, countOT = 0, countCO = 0, countEL = 0, countSL = 0, countA = 0, countWO = 0, countH = 0, userPaidLeave = 0;
      let daysPresentInWeek = 0;

      const userSnapshot = snapshots.find(s => s.employee_id === user.id);

      for (let d = 1; d <= daysInMonth; d++) {
        const currentDate = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), d);
        const dateStr = getISTDateString(currentDate);
        const isFuture = currentDate > today;
        const isSunday = currentDate.getDay() === 0;
        const isMonday = currentDate.getDay() === 1;
        if (isMonday) daysPresentInWeek = 0;

        if (isFuture) {
          tableHtml += `<td style="border: 1px solid #e2e8f0; padding: 2px; text-align: center; color: #ccc; font-size: 8px;">—</td>`;
          continue;
        }

        let status = '', color = '#64748b', cellBg = 'transparent';

        if (userSnapshot && userSnapshot.daily_data) {
          const snapshotDay = userSnapshot.daily_data.find((d: any) => d.date === dateStr);
          status = snapshotDay ? snapshotDay.status : 'A';
          if (status === 'P') { countP++; totalPresentCount++; }
          else if (status === '0.5P' || status === '1/2P') { countHalfP++; totalPresentCount += 0.5; status = '0.5P'; }
          else if (status === 'H') countH++;
          else if (status === 'W/O' || status === 'WO') countWO++;
          else if (status.includes('SL')) { countSL += status.includes('0.5') ? 0.5 : 1; userPaidLeave += status.includes('0.5') ? 0.5 : 1; }
          else if (status.includes('EL') || status.includes('E/L')) { countEL += status.includes('0.5') ? 0.5 : 1; userPaidLeave += status.includes('0.5') ? 0.5 : 1; }
          else if (status.includes('CO') || status.includes('C/O')) { countCO += status.includes('0.5') ? 0.5 : 1; userPaidLeave += status.includes('0.5') ? 0.5 : 1; }
          else if (status.includes('L') && !status.includes('SL') && !status.includes('EL') && !status.includes('E/L')) { userPaidLeave += status.includes('0.5') ? 0.5 : 1; }
          else if (status === 'A' || status === '0.5A') { countA += status === '0.5A' ? 0.5 : 1; totalAbsentCount += status === '0.5A' ? 0.5 : 1; }
        } else {
          const dayEvents = events.filter(e => e.user_id === user.id && getISTDateString(e.timestamp) === dateStr);
          const dayLeave = leaves.find(l => l.user_id === user.id && dateStr >= l.start_date && dateStr <= l.end_date);
          const isPublicHoliday = holidays.find(h => h.date === dateStr);
          
          const punchIn = dayEvents.find(e => e.type === 'punch-in' || e.type === 'check_in');
          const punchOut = dayEvents.filter(e => e.type === 'punch-out' || e.type === 'check_out').pop();

          if (punchIn || punchOut) {
            const durationHours = (punchIn && punchOut) ? (new Date(punchOut.timestamp).getTime() - new Date(punchIn.timestamp).getTime()) / 3600000 : 0;
            const punchInTime = punchIn ? format(new Date(new Date(punchIn.timestamp).getTime() + IST_OFFSET), 'HH:mm') : '—';
            if (punchInTime !== '—' && punchInTime > configStartTime) totalLateCount++;
            if (durationHours >= 5 || (!punchOut && punchIn)) {
              status = 'P'; color = '#16a34a'; cellBg = '#f0fdf4'; countP++; totalPresentCount++;
            } else if (durationHours > 1) {
              status = '0.5P'; color = '#d97706'; cellBg = '#fffbeb'; countHalfP++; totalPresentCount += 0.5;
            } else {
              status = 'P'; color = '#16a34a'; cellBg = '#f0fdf4'; countP++; totalPresentCount++;
            }
          } else if (dayLeave) {
            const isHalfDay = dayLeave.day_option === 'half';
            const leaveType = dayLeave.leave_type?.toLowerCase() || '';
            if (leaveType === 'loss of pay' || leaveType === 'lop') {
              status = isHalfDay ? '0.5A' : 'A'; color = '#dc2626'; cellBg = '#fef2f2'; countA += isHalfDay ? 0.5 : 1; totalAbsentCount += isHalfDay ? 0.5 : 1;
            } else {
              if (leaveType.includes('sick')) { status = isHalfDay ? '0.5SL' : 'S/L'; countSL += isHalfDay ? 0.5 : 1; cellBg = '#fff1f2'; }
              else if (leaveType.includes('earned') || leaveType.includes('annual')) { status = isHalfDay ? '0.5EL' : 'E/L'; countEL += isHalfDay ? 0.5 : 1; cellBg = '#f5f3ff'; }
              else if (leaveType.includes('comp') || leaveType.includes('c/o')) { status = isHalfDay ? '0.5CO' : 'C/O'; countCO += isHalfDay ? 0.5 : 1; cellBg = '#fdf2f8'; }
              else { status = isHalfDay ? '0.5L' : 'L'; cellBg = '#eff6ff'; }
              color = '#2563eb'; userPaidLeave += isHalfDay ? 0.5 : 1;
            }
          } else if (isPublicHoliday) {
            status = 'H'; color = '#854d0e'; cellBg = '#fef3c7'; countH++;
          } else if (isSunday) {
            if (daysPresentInWeek >= 3) {
              status = 'W/O'; color = '#64748b'; cellBg = '#f1f5f9'; countWO++;
            } else {
              status = 'A'; color = '#dc2626'; cellBg = '#fef2f2'; countA++; totalAbsentCount++;
            }
          } else {
            status = 'A'; color = '#dc2626'; cellBg = '#fef2f2'; countA++; totalAbsentCount++;
          }

          if (['P', '0.5P', 'L', 'EL', 'SL', 'CO', 'C/O', 'H'].some(s => status.includes(s))) daysPresentInWeek++;
        }
        let cellClass = "";
        if (status === 'P') cellClass = 'class="p"';
        else if (status === 'A') cellClass = 'class="a"';
        else if (status === 'W/O' || status === 'WO') cellClass = 'class="wo"';
        else if (status === 'H') cellClass = 'class="h"';
        else if (status.includes('0.5')) cellClass = 'class="hd"';
        else if (status.includes('SL')) cellClass = 'class="sl"';
        else if (status.includes('EL')) cellClass = 'class="el"';
        else if (status.includes('CO') || status.includes('C/O')) cellClass = 'class="co"';
        else if (status === '—') cellClass = '';
        else cellClass = `style="color: ${color}; background: ${cellBg}; font-weight: 700;"`;

        tableHtml += `<td ${cellClass}>${status || '—'}</td>`;
      }

      const payableDays = countP + (countHalfP * 0.5) + countWO + countH + userPaidLeave;
      tableHtml += `<td class="p">${countP}</td><td class="hd">${countHalfP}</td><td class="ot">${countOT}</td><td class="co">${countCO}</td><td class="el">${countEL}</td><td class="sl">${countSL}</td><td class="a">${countA}</td><td class="wo">${countWO}</td><td class="h">${countH}</td><td class="tot">${payableDays}</td></tr>`;
    });
    tableHtml += `</tbody></table>`;
    
    // Add Legend
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

    const totalPossible = targetUsers.length * daysInMonth;
    const attendancePercentage = totalPossible > 0 ? Math.round((totalPresentCount / totalPossible) * 100) : 0;
    
    // Add billing cycle text for top right text
    const billingCycle = `01 ${safeFormat(targetDate, 'MMM yyyy')} - ${daysInMonth} ${safeFormat(targetDate, 'MMM yyyy')}`;

    return { 
      date: monthStr, 
      reportDate: safeFormat(nowIST, 'dd MMM yyyy'),
      generatedTime: safeFormat(nowIST, 'hh:mm a'),
      year: safeFormat(nowIST, 'yyyy'),
      totalEmployees: String(targetUsers.length), 
      table: tableHtml,
      attendancePercentage: String(attendancePercentage),
      totalAbsent: String(Math.round(totalAbsentCount)),
      lateCount: String(totalLateCount),
      logo: '<img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;">',
      totalPresent: String(Math.round(totalPresentCount)),
      generatedBy: filters?.triggeredBy || 'Manual Request',
      billingCycle: billingCycle
    };
  },
  document_expiry: async (supabase: SupabaseClient, nowIST: Date, filters?: any) => {
    return { date: format(nowIST, 'yyyy-MM-dd'), items: '0' };
  },
  crm_bd_daily: async (supabase: SupabaseClient, nowIST: Date) => {
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

    if (bdUsers.length === 0) {
      const defaultDate = safeFormat(nowIST, 'EEEE, MMMM do, yyyy');
      return [{
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
        kms_travelled: '0.00',
        kmsTravelled: '0.00',
        prospect_calls: '0',
        prospectCalls: '0',
        followup_calls: '0',
        followupCalls: '0',
        new_leads_count: '0',
        newLeadsCount: '0',
        sites_count: '0',
        sitesCount: '0',
        sites_visited: '0',
        sitesVisited: '0',
        new_leads_table: '<div style="padding:16px;text-align:center;color:#64748b;">No active Business Developers found.</div>',
        newLeadsTable: '<div style="padding:16px;text-align:center;color:#64748b;">No active Business Developers found.</div>',
        metrics_table: '<div style="padding:16px;text-align:center;color:#64748b;">No activity metrics available.</div>',
        metricsTable: '<div style="padding:16px;text-align:center;color:#64748b;">No activity metrics available.</div>',
        pipeline_snapshot: '<div style="padding:16px;text-align:center;color:#64748b;">No pipeline data available.</div>',
        pipelineSnapshot: '<div style="padding:16px;text-align:center;color:#64748b;">No pipeline data available.</div>'
      }];
    }

    // Fetch all data in one parallel batch
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

    // Helpers
    const leadName = (l: any) => l.company_name || l.association_name || l.client_name || 'Unknown';
    const daysSince = (dateStr: string | null | undefined): number => {
      if (!dateStr) return 999;
      return (nowIST.getTime() - new Date(dateStr).getTime()) / 86400000;
    };
    const stageOrder: Record<string, number> = { 'Negotiation': 1, 'Proposal Sent': 2, 'Survey Completed': 3, 'Site Visit Planned': 4, 'Contacted': 5, 'New Lead': 6, 'Onboarding Started': 1 };
    const stageColor: Record<string, string> = { 'Negotiation': '#f97316', 'Proposal Sent': '#ec4899', 'Survey Completed': '#06b6d4', 'Site Visit Planned': '#f59e0b', 'Contacted': '#8b5cf6', 'New Lead': '#3b82f6', 'Won': '#10b981', 'Lost': '#ef4444', 'Onboarding Started': '#006b3f' };

    const reports: any[] = [];

    for (const bd of bdUsers) {
      // ── Attendance & Time ─────────────────────────────────────────────────
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
      let savedDistance = 0;
      bdEvents.forEach((e: any) => { if (e.travel_distance > 0) savedDistance += e.travel_distance; });
      const kms_travelled = savedDistance.toFixed(2);

      // ── Today's CRM Activity ─────────────────────────────────────────────
      const newLeadsToday = leads.filter((l: any) => l.created_by === bd.id || l.assigned_to === bd.id);
      const newLeadsIds = new Set(newLeadsToday.map((l: any) => l.id));
      const isCallType = (t: string) => ['call', 'phone call', 'outbound call'].includes((t || '').toLowerCase());
      const isSiteVisitType = (t: string) => ['site visit', 'sitevisit', 'site-visit'].includes((t || '').toLowerCase());
      const prospect_calls = calls.filter((c: any) => c.created_by === bd.id && isCallType(c.type) && newLeadsIds.has(c.lead_id)).length;
      const followup_calls = calls.filter((c: any) => c.created_by === bd.id && isCallType(c.type) && !newLeadsIds.has(c.lead_id)).length;
      const new_leads_count = newLeadsToday.length;
      const siteVisitsFromCRM = calls.filter((c: any) => c.created_by === bd.id && isSiteVisitType(c.type)).length;
      const siteVisitsFromAttendance = bdEvents.filter((e: any) => e.type === 'site-in').length;
      const sites_count = siteVisitsFromCRM > 0 ? siteVisitsFromCRM : siteVisitsFromAttendance;

      // ── All-time BD leads ─────────────────────────────────────────────────
      const allBDLeads = allLeads.filter((l: any) => l.assigned_to === bd.id || l.created_by === bd.id);

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

    return reports;
  },
  bd_daily: async (supabase: SupabaseClient, nowIST: Date) => {
    return (reportGenerators as any).crm_bd_daily(supabase, nowIST);
  }
};

async function resolveRecipientsInternal(supabase: SupabaseClient, rule: any): Promise<string[]> {
  if (rule.recipient_type === 'custom_emails') return rule.recipient_emails || [];
  if (rule.recipient_type === 'role') {
    // [SECURITY FIX H11] Added is_active=true filter
    const { data: users } = await supabase.from('users').select('email')
      .in('role_id', rule.recipient_roles || [])
      .eq('is_active', true);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }
  if (rule.recipient_type === 'users') {
    // [SECURITY FIX H11] Added is_active=true filter
    const { data: users } = await supabase.from('users').select('email')
      .in('id', rule.recipient_user_ids || [])
      .eq('is_active', true);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }
  return [];
}

const getSupabaseConfig = (urlOverride?: string, keyOverride?: string) => ({
  url: urlOverride || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  // [SECURITY FIX C7] Removed fallback to VITE_SUPABASE_ANON_KEY
  serviceKey: keyOverride || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
});

async function getSmtpConfig(supabase: SupabaseClient) {
  const { data } = await supabase.from('settings').select('email_config').eq('id', 'singleton').maybeSingle();
  const cfg = data?.email_config || {};
  return {
    host: cfg.host || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(cfg.port || process.env.SMTP_PORT || '587'),
    secure: cfg.secure ?? (process.env.SMTP_SECURE === 'true' || false),
    user: cfg.user || process.env.SMTP_USER || '',
    pass: cfg.pass || process.env.SMTP_PASS || '',
    fromEmail: cfg.from_email || cfg.user || process.env.SMTP_FROM_EMAIL || '',
    fromName: cfg.from_name || 'Paradigm FMS',
    replyTo: cfg.reply_to || cfg.from_email
  };
}

export async function sendEmailLogic(body: any, supabaseUrl?: string, supabaseServiceKey?: string) {
  const { url, serviceKey } = getSupabaseConfig(supabaseUrl, supabaseServiceKey);
  const supabase = createClient(url, serviceKey);
  
  let { to, cc, subject, html, ruleId, test, testEmail, smtpConfig, triggerType, reportType, filters } = body;
  
  // Fallback for body vs html naming mismatch
  if (!html && body.body) html = body.body;
  
  // Use provided SMTP config (from UI) or fallback to DB
  const config = smtpConfig || await getSmtpConfig(supabase);
  
  if (!config.user || !config.pass) throw new Error('SMTP credentials not found.');

  // If html is provided, we skip the rule-based rendering (consolidation)
  if (ruleId && !html) {
    const { data: rule } = await supabase.from('email_schedule_rules').select('*').eq('id', ruleId).single();
    if (!rule) throw new Error('Rule not found');
    
    const { data: template } = rule.template_id ? await supabase.from('email_templates').select('*').eq('id', rule.template_id).single() : { data: null };
    
    const reportTypeKey = rule.report_type?.toLowerCase().replace(/\s+/g, '_');
    const generator = (reportGenerators as any)[reportTypeKey] || reportGenerators.attendance_daily;
    const nowIST = new Date(new Date().getTime() + IST_OFFSET);
    const reportData = await generator(supabase, nowIST);

    const render = (text: string, data: any) => {
      if (!text) return '';
      return text.replace(/\{([\w]+)\}/gi, (match, key) => {
        const cleanKey = key.toLowerCase().replace(/[_-]/g, '');
        const dataKey = Object.keys(data || {}).find(k => k.toLowerCase().replace(/[_-]/g, '') === cleanKey);
        if (dataKey && (data as any)[dataKey] !== undefined && (data as any)[dataKey] !== null) {
          return String((data as any)[dataKey]);
        }
        return match;
      });
    };

    // Support for custom message Injection from template variables
    let greetingMessage = `Here is your automated status update for <strong>{date}</strong>. The data below reflects real-time triggers from the Paradigm system as of <strong>{generatedTime} IST</strong>.`;
    
    // Override greeting for Monthly Report
    if (rule.report_type === 'attendance_monthly') {
        greetingMessage = `Dear Management,<br/><br/>This is the consolidated attendance summary for the period of <strong>{date}</strong>. It covers overall employee presence across all <strong>{totalEmployees}</strong> active members of the staff.<br/><br/>Overall attendance stands at <strong>{attendancePercentage}%</strong>. Please review the detailed monthly attendance grid below for any discrepancies.`;
    } else if (rule.report_type === 'attendance_daily') {
        greetingMessage = `Dear Team,<br/><br/>Today's attendance stands at <strong>{attendancePercentage}%</strong>. A total of <strong>{totalAbsent}</strong> employees were absent, and <strong>{lateCount}</strong> reported late.<br/><br/>Attendance requires attention.`;
    }

    if (template?.variables && Array.isArray(template.variables)) {
        const customMsgObj = template.variables.find((v: any) => v.key === '_custom_message');
        if (customMsgObj && customMsgObj.description && customMsgObj.description.trim()) {
            let evaluatedMsg = evaluateConditionalsInternal(customMsgObj.description, reportData || {});
            greetingMessage = evaluatedMsg.replace(/\n/g, '<br/>');
        }
    }
    
    // CRITICAL: Render the greeting message itself with available reportData 
    // This ensures nested placeholders like {attendancePercentage} are replaced
    greetingMessage = render(greetingMessage, reportData || {});
    
    // Inject the greeting into reportData so it can be evaluated in the template
    // Providing multiple common keys for maximum template compatibility
    reportData.greetingMessage = greetingMessage;
    reportData.customGreeting = greetingMessage;
    reportData.greeting_message = greetingMessage;
    reportData.custom_greeting = greetingMessage;
    reportData.summary = greetingMessage;

    html = template?.body_template;
    if (!html) {
        const getMonthlyReportPremiumTemplate = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>@media only screen and (max-width: 600px) { .stats-container { display: block !important; } .stat-card { margin-bottom: 16px !important; width: 100% !important; } .header-content { display: block !important; text-align: center !important; } .header-right { text-align: center !important; margin-top: 20px !important; } .logo-container { justify-content: center !important; margin-bottom: 12px !important; } } body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; } table { width: 100%; border-collapse: collapse; } .report-grid { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; } .report-grid th { padding: 12px 6px; font-weight: 600; background-color: #f8fafc; color: #475569; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; } .report-grid td { padding: 10px 4px; text-align: center; color: #334155; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-weight: 500; } .report-grid td:last-child, .report-grid th:last-child { border-right: none; } .report-grid tr:last-child td { border-bottom: none; } .report-grid td.emp-name { text-align: left; font-weight: 600; min-width: 150px; padding: 10px 14px; color: #0f172a; } .report-grid td.p { color: #059669; font-weight: 700; background-color: rgba(16, 185, 129, 0.08); } .report-grid td.a { color: #dc2626; background-color: rgba(239, 68, 68, 0.08); } .report-grid td.wo { color: #64748b; background-color: #f1f5f9; } .report-grid td.h { color: #d97706; background-color: rgba(245, 158, 11, 0.08); font-weight: 700; } .report-grid td.hd { color: #ea580c; background-color: rgba(249, 115, 22, 0.08); font-weight: 700; } .report-grid td.ot { color: #0284c7; background-color: rgba(14, 165, 233, 0.08); font-weight: 700; } .report-grid td.co { color: #db2777; background-color: rgba(236, 72, 153, 0.08); font-weight: 700; } .report-grid td.el { color: #7c3aed; background-color: rgba(139, 92, 246, 0.08); font-weight: 700; } .report-grid td.sl { color: #e11d48; background-color: rgba(225, 29, 72, 0.08); font-weight: 700; } .report-grid td.tot { font-weight: 800; background-color: #f0fdf4; color: #047857; }</style></head><body style="margin: 0; padding: 0; background-color: #f4fbf7; -webkit-font-smoothing: antialiased;"><div style="max-width: 1000px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(4, 120, 87, 0.08), 0 0 0 1px rgba(4,120,87,0.02);"><div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 48px 40px; color: white;"><div style="display: flex; justify-content: space-between; align-items: center;" class="header-content"><div><div class="logo-container" style="display: flex; align-items: center; margin-bottom: 12px;"><div style="background: white; padding: 10px 14px; border-radius: 12px; display: inline-flex; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"><img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm Services" style="height: 36px; display: block;"></div></div><div style="font-size: 13px; font-weight: 600; color: #a7f3d0; text-transform: uppercase; letter-spacing: 2px;">Paradigm Services</div></div><div style="text-align: right;" class="header-right"><h1 style="margin: 0 0 12px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: white;">Monthly Attendance</h1><div style="display: inline-block; background: rgba(255, 255, 255, 0.15); padding: 8px 16px; border-radius: 20px; font-size: 15px; font-weight: 600; color: #ffffff; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.2);">{date}</div></div></div></div><div style="padding: 40px;"><div style="margin-bottom: 40px; padding: 24px; background: #f0fdf4; border-radius: 16px; border-left: 4px solid #10b981;"><p style="margin: 0; color: #064e3b; font-size: 16px; line-height: 1.7; font-weight: 400;">{customGreeting}</p></div><div class="stats-container" style="display: flex; gap: 24px; margin-bottom: 48px;"><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;"><div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #059669;"></div><div style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Monthly Presence</div><div style="font-size: 40px; font-weight: 800; color: #064e3b; letter-spacing: -1px; line-height: 1;">{attendancePercentage}<span style="font-size: 24px; color: #059669; font-weight: 700; margin-left: 2px;">%</span></div></div><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;"><div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #34d399;"></div><div style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Total Punches</div><div style="font-size: 40px; font-weight: 800; color: #064e3b; letter-spacing: -1px; line-height: 1;">{totalPresent}</div></div><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;"><div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #6ee7b7;"></div><div style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Active Staff</div><div style="font-size: 40px; font-weight: 800; color: #064e3b; letter-spacing: -1px; line-height: 1;">{totalEmployees}</div></div></div><div style="margin-bottom: 48px;"><div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;"><div><h3 style="margin: 0 0 6px 0; color: #064e3b; font-size: 18px; font-weight: 700; letter-spacing: -0.3px;">Detailed Attendance Grid</h3><div style="font-size: 13px; color: #64748b; font-weight: 400;">Comprehensive overview of daily attendance records</div></div><div style="font-size: 12px; color: #047857; font-weight: 600; background: #ecfdf5; padding: 8px 14px; border-radius: 8px; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 6px;"><span style="font-size: 14px;">↔</span> Scroll on mobile</div></div><div style="overflow-x: auto; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">{table}</div></div><div style="padding-top: 40px; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; align-items: center; text-align: center;"><div style="margin-bottom: 20px;"><img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm" style="height: 28px; opacity: 0.6;"></div><p style="margin: 0 0 24px 0; color: #64748b; font-size: 13px; font-weight: 400; max-width: 500px; line-height: 1.6;">This is an official automated compliance report generated by the Paradigm Attendance Management System.</p><div style="display: inline-flex; align-items: center; gap: 16px; background: #f0fdf4; padding: 12px 24px; border-radius: 100px; border: 1px solid #bbf7d0;"><a href="https://app.paradigmfms.com" style="color: #047857; text-decoration: none; font-weight: 700; font-size: 13px;">Open Dashboard &rarr;</a><span style="color: #6ee7b7;">|</span><span style="color: #064e3b; font-size: 13px; font-weight: 500;">&copy; {year} Paradigm Facility Management Services</span></div><div style="margin-top: 24px; font-size: 11px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Generated: {generatedTime} &bull; Request By: {generatedBy}</div></div></div></div></body></html>`;
        const getDefaultPremiumTemplate = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@media only screen and (max-width: 600px) { .stats-container { display: block !important; } .stat-card { margin-bottom: 12px !important; width: 100% !important; } }</style></head><body style="margin: 0; padding: 0; background-color: #f1f5f9;"><div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);"><!-- Header --><div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 32px; color: white;"><div style="display: flex; justify-content: space-between; align-items: center;"><div style="display: flex; align-items: center; gap: 12px;"><div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);"><img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;" onerror="this.style.display='none'"><span style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin-left: 2px;">PARADIGM</span></div></div><div style="text-align: right;"><div style="font-size: 11px; opacity: 0.7; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Attendance Management System</div><div style="font-size: 16px; font-weight: 600;">{reportDate}</div></div></div></div><div style="padding: 32px;"><div style="margin-bottom: 32px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;"><div style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 12px;">Hi,</div><p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">{greetingMessage}</p></div><div class="stats-container" style="display: flex; gap: 16px; margin-bottom: 32px;"><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);"><div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Staff Presence</div><div style="font-size: 28px; font-weight: 800; color: #059669;">{attendancePercentage}%</div></div><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);"><div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Total Present</div><div style="font-size: 28px; font-weight: 800; color: #10b981;">{totalPresent}</div></div><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);"><div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Total Late</div><div style="font-size: 28px; font-weight: 800; color: #f59e0b;">{lateCount}</div></div></div><div style="margin-bottom: 32px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;"><div style="background: #f8fafc; padding: 16px 24px; border-bottom: 1px solid #e2e8f0;"><h3 style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 700;">Detailed Overview</h3></div><div style="overflow-x: auto;">{table}</div></div></div></div></body></html>`;
        html = (rule.report_type === 'attendance_monthly') ? getMonthlyReportPremiumTemplate() : getDefaultPremiumTemplate();
    }

    const hasGreetingPlaceholder = html.includes('{greetingMessage}') || 
                                   html.includes('{customGreeting}') || 
                                   html.includes('{greeting_message}') || 
                                   html.includes('{custom_greeting}') ||
                                   html.includes('{summary}');

    if (template?.body_template && !hasGreetingPlaceholder) {
        const greetingBlock = `\n<div style="font-family: Arial, sans-serif; padding: 0 0 20px 0; color: #333; font-size: 14px; line-height: 1.6; text-align: left;">\n  {greetingMessage}\n</div>\n`;
        if (html.toLowerCase().includes('<body')) {
            html = html.replace(/(<body[^>]*>)/i, `$1${greetingBlock}`);
        } else {
            html = greetingBlock + html;
        }
    }

    subject = render(evaluateConditionalsInternal(template?.subject_template || rule.name, reportData), reportData);
    html = render(evaluateConditionalsInternal(html, reportData), reportData);

    if (test && typeof testEmail === 'string' && testEmail.includes('@')) {
      to = [testEmail];
      console.log(`[send-email] Test mode: Overriding recipients with ${testEmail}`);
    } else if (!to || (Array.isArray(to) && to.length === 0)) {
      to = await resolveRecipientsInternal(supabase, rule);
      console.log(`[send-email] Resolved recipients from rule ${ruleId}: ${to.join(', ')}`);
    }

    
    if (!triggerType) triggerType = 'automatic';
  } else if (reportType && triggerType === 'manual') {
    // Handle manual triggers from dashboard without a ruleId
    const reportTypeKey = reportType.toLowerCase().replace(/\s+/g, '_');
    const generator = (reportGenerators as any)[reportTypeKey] || reportGenerators.attendance_daily;
    const nowIST = new Date(new Date().getTime() + IST_OFFSET);
    const reportData = await generator(supabase, nowIST, filters);

    const render = (text: string, data: any) => (text || '').replace(/\{(\w+)\}/g, (match, key) => {
      const dataKey = Object.keys(data).find(k => k.toLowerCase() === key.toLowerCase());
      return dataKey ? (data as any)[dataKey] : match;
    });

    const userMessage = html || ''; // Original message from modal
    
    // For manual monthly reports, use the same formal greeting if no custom message provided
    let greetingMessage = userMessage;
    if (!greetingMessage && reportTypeKey === 'attendance_monthly') {
        greetingMessage = `Dear Management,<br/><br/>This is the consolidated attendance summary for the period of <strong>{date}</strong>. It covers overall employee presence across all <strong>{totalEmployees}</strong> active members of the staff.<br/><br/>Overall attendance stands at <strong>{attendancePercentage}%</strong>. Please review the detailed monthly attendance grid below for any discrepancies.`;
    } else if (!greetingMessage) {
        greetingMessage = `Here is your requested <strong>${reportType.replace(/_/g, ' ')}</strong> status update for <strong>{date}</strong>.`;
    }
    
    reportData.greetingMessage = greetingMessage;
    reportData.customGreeting = greetingMessage;

    const getMonthlyReportPremiumTemplate = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>@media only screen and (max-width: 600px) { .stats-container { display: block !important; } .stat-card { margin-bottom: 16px !important; width: 100% !important; } .header-content { display: block !important; text-align: center !important; } .header-right { text-align: center !important; margin-top: 20px !important; } .logo-container { justify-content: center !important; margin-bottom: 12px !important; } } body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; } table { width: 100%; border-collapse: collapse; } .report-grid { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; } .report-grid th { padding: 12px 6px; font-weight: 600; background-color: #f8fafc; color: #475569; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; } .report-grid td { padding: 10px 4px; text-align: center; color: #334155; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-weight: 500; } .report-grid td:last-child, .report-grid th:last-child { border-right: none; } .report-grid tr:last-child td { border-bottom: none; } .report-grid td.emp-name { text-align: left; font-weight: 600; min-width: 150px; padding: 10px 14px; color: #0f172a; } .report-grid td.p { color: #059669; font-weight: 700; background-color: rgba(16, 185, 129, 0.08); } .report-grid td.a { color: #dc2626; background-color: rgba(239, 68, 68, 0.08); } .report-grid td.wo { color: #64748b; background-color: #f1f5f9; } .report-grid td.h { color: #d97706; background-color: rgba(245, 158, 11, 0.08); font-weight: 700; } .report-grid td.hd { color: #ea580c; background-color: rgba(249, 115, 22, 0.08); font-weight: 700; } .report-grid td.ot { color: #0284c7; background-color: rgba(14, 165, 233, 0.08); font-weight: 700; } .report-grid td.co { color: #db2777; background-color: rgba(236, 72, 153, 0.08); font-weight: 700; } .report-grid td.el { color: #7c3aed; background-color: rgba(139, 92, 246, 0.08); font-weight: 700; } .report-grid td.sl { color: #e11d48; background-color: rgba(225, 29, 72, 0.08); font-weight: 700; } .report-grid td.tot { font-weight: 800; background-color: #f0fdf4; color: #047857; }</style></head><body style="margin: 0; padding: 0; background-color: #f4fbf7; -webkit-font-smoothing: antialiased;"><div style="max-width: 1000px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(4, 120, 87, 0.08), 0 0 0 1px rgba(4,120,87,0.02);"><div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 48px 40px; color: white;"><div style="display: flex; justify-content: space-between; align-items: center;" class="header-content"><div><div class="logo-container" style="display: flex; align-items: center; margin-bottom: 12px;"><div style="background: white; padding: 10px 14px; border-radius: 12px; display: inline-flex; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"><img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm Services" style="height: 36px; display: block;"></div></div><div style="font-size: 13px; font-weight: 600; color: #a7f3d0; text-transform: uppercase; letter-spacing: 2px;">Paradigm Services</div></div><div style="text-align: right;" class="header-right"><h1 style="margin: 0 0 12px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: white;">Monthly Attendance</h1><div style="display: inline-block; background: rgba(255, 255, 255, 0.15); padding: 8px 16px; border-radius: 20px; font-size: 15px; font-weight: 600; color: #ffffff; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.2);">{date}</div></div></div></div><div style="padding: 40px;"><div style="margin-bottom: 40px; padding: 24px; background: #f0fdf4; border-radius: 16px; border-left: 4px solid #10b981;"><p style="margin: 0; color: #064e3b; font-size: 16px; line-height: 1.7; font-weight: 400;">{customGreeting}</p></div><div class="stats-container" style="display: flex; gap: 24px; margin-bottom: 48px;"><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;"><div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #059669;"></div><div style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Monthly Presence</div><div style="font-size: 40px; font-weight: 800; color: #064e3b; letter-spacing: -1px; line-height: 1;">{attendancePercentage}<span style="font-size: 24px; color: #059669; font-weight: 700; margin-left: 2px;">%</span></div></div><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;"><div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #34d399;"></div><div style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Total Punches</div><div style="font-size: 40px; font-weight: 800; color: #064e3b; letter-spacing: -1px; line-height: 1;">{totalPresent}</div></div><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;"><div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #6ee7b7;"></div><div style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Active Staff</div><div style="font-size: 40px; font-weight: 800; color: #064e3b; letter-spacing: -1px; line-height: 1;">{totalEmployees}</div></div></div><div style="margin-bottom: 48px;"><div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;"><div><h3 style="margin: 0 0 6px 0; color: #064e3b; font-size: 18px; font-weight: 700; letter-spacing: -0.3px;">Detailed Attendance Grid</h3><div style="font-size: 13px; color: #64748b; font-weight: 400;">Comprehensive overview of daily attendance records</div></div><div style="font-size: 12px; color: #047857; font-weight: 600; background: #ecfdf5; padding: 8px 14px; border-radius: 8px; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 6px;"><span style="font-size: 14px;">↔</span> Scroll on mobile</div></div><div style="overflow-x: auto; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">{table}</div></div><div style="padding-top: 40px; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; align-items: center; text-align: center;"><div style="margin-bottom: 20px;"><img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm" style="height: 28px; opacity: 0.6;"></div><p style="margin: 0 0 24px 0; color: #64748b; font-size: 13px; font-weight: 400; max-width: 500px; line-height: 1.6;">This is an official automated compliance report generated by the Paradigm Attendance Management System.</p><div style="display: inline-flex; align-items: center; gap: 16px; background: #f0fdf4; padding: 12px 24px; border-radius: 100px; border: 1px solid #bbf7d0;"><a href="https://app.paradigmfms.com" style="color: #047857; text-decoration: none; font-weight: 700; font-size: 13px;">Open Dashboard &rarr;</a><span style="color: #6ee7b7;">|</span><span style="color: #064e3b; font-size: 13px; font-weight: 500;">&copy; {year} Paradigm Facility Management Services</span></div><div style="margin-top: 24px; font-size: 11px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Generated: {generatedTime} &bull; Request By: {generatedBy}</div></div></div></div></body></html>`;


    const getDefaultPremiumTemplate = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@media only screen and (max-width: 600px) { .stats-container { display: block !important; } .stat-card { margin-bottom: 12px !important; width: 100% !important; } .attendance-table { font-size: 8px !important; } }</style></head><body style="margin: 0; padding: 0; background-color: #f1f5f9;"><div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 900px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);"><!-- Header --><div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 32px; color: white;"><div style="display: flex; justify-content: space-between; align-items: center;"><div style="display: flex; align-items: center; gap: 12px;"><div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);"><img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;" onerror="this.style.display='none'"><span style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin-left: 2px;">PARADIGM</span></div></div><div style="text-align: right;"><div style="font-size: 11px; opacity: 0.7; text-transform: uppercase; font-weight: 700;">${reportType.replace(/_/g, ' ')}</div><div style="font-size: 16px; font-weight: 600;">{date}</div></div></div></div><div style="padding: 32px;"><div style="margin-bottom: 32px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;"><div style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 12px;">Hi,</div><p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">{greetingMessage}</p></div><div style="margin-bottom: 32px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;"><div style="background: #f8fafc; padding: 16px 24px; border-bottom: 1px solid #e2e8f0;"><h3 style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 700;">Report Overview</h3></div><div style="overflow-x: auto;" class="attendance-table"><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;"><th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">S.No</th><th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">Employee Name</th><th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">Dept</th><th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">In</th><th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">Out</th><th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">B.In</th><th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">B.Out</th><th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">OT.In</th><th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">OT.Out</th><th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">Dur</th><th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">Status</th></tr></thead><tbody>{table}</tbody></table></div></div></div></div></body></html>`;

    html = render(reportTypeKey === 'attendance_monthly' ? getMonthlyReportPremiumTemplate() : getDefaultPremiumTemplate(), reportData);
  }

  const toAddresses = (Array.isArray(to) ? to : [to]).filter(e => typeof e === 'string' && e.includes('@'));
  if (toAddresses.length === 0) throw new Error('No valid recipients found');

  const ccAddresses = (Array.isArray(cc) ? cc : [cc]).filter(e => typeof e === 'string' && e.includes('@'));

  const transporter = nodemailer.createTransport({
    host: config.host || config.smtpHost, 
    port: config.port || config.smtpPort, 
    secure: config.secure !== undefined ? config.secure : config.smtpSecure,
    auth: { user: config.user || config.smtpUser, pass: config.pass || config.smtpPass },
    // [SECURITY FIX C6] TLS validation enabled (removed rejectUnauthorized: false)
  });

  const fromEmail = (config.fromEmail || config.smtpFromEmail || config.user || config.smtpUser || '').toLowerCase();
  
  // INDIVIDUAL SENDING: Loop through recipients to ensure privacy and individual inbox delivery
  const results = [];
  for (const recipient of toAddresses) {
    const mailOptions: any = {
      from: `"${config.fromName || config.smtpFromName || 'Paradigm FMS'}" <${fromEmail}>`,
      to: recipient,
      subject, 
      html, 
      replyTo: config.replyTo || config.smtpReplyTo || fromEmail
    };
    if (ccAddresses.length > 0) mailOptions.cc = ccAddresses.join(', ');
    if (body.attachments && Array.isArray(body.attachments)) {
      mailOptions.attachments = body.attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    results.push(info);

    // Log each successful delivery
    try {
      await supabase.from('email_logs').insert({
        recipient_email: recipient, 
        subject, 
        status: 'sent', 
        rule_id: ruleId || null, 
        metadata: { 
          trigger_type: triggerType || 'manual',
          vercel_env: process.env.VERCEL_ENV || 'development',
          individual_send: true
        },
        created_at: new Date().toISOString()
      });
    } catch (logLog) {
      console.error(`[send-email] Logging failed for ${recipient} but email was likely sent:`, logLog);
    }
  }

  return results[0]; // Return first info for backwards compatibility
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();
  
  try {
    const { url, serviceKey } = getSupabaseConfig();
    const info = await sendEmailLogic(req.body, url, serviceKey);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('[send-email] Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}
