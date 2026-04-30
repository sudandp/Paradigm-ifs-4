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

    let tableHtml = '';
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

    return {
      date: safeFormat(new Date(todayStr), 'EEEE, MMMM do, yyyy'),
      reportDate: safeFormat(new Date(todayStr), 'dd MMM yyyy'),
      generatedTime: safeFormat(nowIST, 'hh:mm a'),
      totalEmployees: String(targetUsers.length),
      totalPresent: String(totalPresent),
      totalAbsent: String(totalAbsent),
      lateCount: String(lateCount),
      attendancePercentage: targetUsers.length > 0 ? Math.round((totalPresent/targetUsers.length)*100).toString() : '0',
      onLeaveCount: String(onLeaveCount),
      logo: '<img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;">',
      table: tableHtml || '<tr><td colspan="7">No data</td></tr>'
    };
  },
  attendance_monthly: async (supabase: SupabaseClient, nowIST: Date, filters?: any) => {
    const targetDate = filters?.dateRange?.start ? new Date(filters.dateRange.start) : nowIST;
    const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    const monthStr = format(targetDate, 'MMMM yyyy');
    const daysInMonth = lastDayOfMonth.getDate();
    const today = new Date(nowIST.getTime());
    today.setUTCHours(0,0,0,0);

    const [settingsRes, usersRes, eventsRes, leavesRes, holidaysRes] = await Promise.all([
      supabase.from('settings').select('attendance_settings').eq('id', 'singleton').maybeSingle(),
      supabase.from('users').select('id, name, role:roles(display_name)').neq('role_id', 'unverified').order('name'),
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

    let tableHtml = `<table style="width:100%; border-collapse: collapse; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10px; border: 1px solid #e2e8f0;">
    <thead>
      <tr style="background: #f8fafc; color: #1e293b; border-bottom: 2px solid #e2e8f0;">
        <th style="border: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; min-width: 140px; font-weight: 700;">Employee Name</th>`;
    
    for (let d = 1; d <= daysInMonth; d++) {
      tableHtml += `<th style="border: 1px solid #e2e8f0; padding: 4px 2px; text-align: center; width: 22px; font-size: 9px; font-weight: 600;">${d}</th>`;
    }
    tableHtml += `
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f0fdf4; color: #166534; width: 25px; font-weight: 700;">P</th>
          <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fffbeb; color: #92400e; width: 35px; font-weight: 700;">1/2P</th>
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
      tableHtml += `<tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="border: 1px solid #e2e8f0; padding: 8px 6px; font-weight: 600; font-size: 11px; color: #334155;">${user.name}</td>`;
      
      let countP = 0, countHalfP = 0, countOT = 0, countCO = 0, countEL = 0, countSL = 0, countA = 0, countWO = 0, countH = 0, userPaidLeave = 0;
      let daysPresentInWeek = 0;

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

        const dayEvents = events.filter(e => e.user_id === user.id && getISTDateString(e.timestamp) === dateStr);
        const dayLeave = leaves.find(l => l.user_id === user.id && dateStr >= l.start_date && dateStr <= l.end_date);
        const isPublicHoliday = holidays.find(h => h.date === dateStr);
        
        let status = '', color = '#64748b', cellBg = 'transparent';
        const punchIn = dayEvents.find(e => e.type === 'punch-in' || e.type === 'check_in');
        const punchOut = dayEvents.filter(e => e.type === 'punch-out' || e.type === 'check_out').pop();

        if (punchIn || punchOut) {
          const durationHours = (punchIn && punchOut) ? (new Date(punchOut.timestamp).getTime() - new Date(punchIn.timestamp).getTime()) / 3600000 : 0;
          const punchInTime = punchIn ? format(new Date(new Date(punchIn.timestamp).getTime() + IST_OFFSET), 'HH:mm') : '—';
          if (punchInTime !== '—' && punchInTime > configStartTime) totalLateCount++;
          if (durationHours >= 5 || (!punchOut && punchIn)) {
            status = 'P'; color = '#16a34a'; cellBg = '#f0fdf4'; countP++; totalPresentCount++;
          } else if (durationHours > 1) {
            status = '1/2P'; color = '#d97706'; cellBg = '#fffbeb'; countHalfP++; totalPresentCount += 0.5;
          } else {
            status = 'P'; color = '#16a34a'; cellBg = '#f0fdf4'; countP++; totalPresentCount++;
          }
        } else if (dayLeave) {
          const isHalfDay = dayLeave.day_option === 'half';
          const leaveType = dayLeave.leave_type?.toLowerCase() || '';
          if (leaveType === 'loss of pay' || leaveType === 'lop') {
            status = isHalfDay ? '1/2A' : 'A'; color = '#dc2626'; cellBg = '#fef2f2'; countA += isHalfDay ? 0.5 : 1; totalAbsentCount += isHalfDay ? 0.5 : 1;
          } else {
            if (leaveType.includes('sick')) { status = isHalfDay ? '1/2SL' : 'S/L'; countSL += isHalfDay ? 0.5 : 1; cellBg = '#fff1f2'; }
            else if (leaveType.includes('earned') || leaveType.includes('annual')) { status = isHalfDay ? '1/2EL' : 'E/L'; countEL += isHalfDay ? 0.5 : 1; cellBg = '#f5f3ff'; }
            else if (leaveType.includes('comp') || leaveType.includes('c/o')) { status = isHalfDay ? '1/2CO' : 'C/O'; countCO += isHalfDay ? 0.5 : 1; cellBg = '#fdf2f8'; }
            else { status = isHalfDay ? '1/2L' : 'L'; cellBg = '#eff6ff'; }
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

        if (['P', '1/2P', 'L', 'EL', 'SL', 'CO', 'H'].some(s => status.includes(s))) daysPresentInWeek++;
        tableHtml += `<td style="border: 1px solid #e2e8f0; padding: 2px; text-align: center; color: ${color}; background: ${cellBg}; font-weight: 700; font-size: 8px;">${status || '—'}</td>`;
      }

      const payableDays = countP + (countHalfP * 0.5) + countWO + countH + userPaidLeave;
      tableHtml += `<td style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; font-weight: 700; color: #166534; background: #f0fdf4;">${countP}</td><td style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; font-weight: 700; color: #92400e; background: #fffbeb;">${countHalfP}</td><td style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; font-weight: 700; color: #075985; background: #f0f9ff;">${countOT}</td><td style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; font-weight: 700; color: #9d174d; background: #fdf2f8;">${countCO}</td><td style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; font-weight: 700; color: #5b21b6; background: #f5f3ff;">${countEL}</td><td style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; font-weight: 700; color: #9f1239; background: #fff1f2;">${countSL}</td><td style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; font-weight: 700; color: #991b1b; background: #fef2f2;">${countA}</td><td style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; color: #4b5563; background: #f9fafb;">${countWO}</td><td style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; color: #854d0e; background: #fffbeb;">${countH}</td><td style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; font-weight: 800; background: #ecfdf5; color: #064e3b; border-left: 2px solid #10b981;">${payableDays}</td></tr>`;
    });
    tableHtml += `</tbody></table>`;
    
    // Add Legend
    tableHtml += `<div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;"><div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; align-items: center;"><div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #16a34a; display: inline-block;"></span> <strong style="color: #166534;">P:</strong> PRESENT</div><div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #dc2626; display: inline-block;"></span> <strong style="color: #991b1b;">A:</strong> ABSENT</div><div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #991b1b; display: inline-block;"></span> <strong style="color: #991b1b;">LOP:</strong> LOSS OF PAY</div><div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #d97706; display: inline-block;"></span> <strong style="color: #92400e;">1/2P:</strong> HALF DAY</div><div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #0891b2; display: inline-block;"></span> <strong style="color: #155e75;">W/H:</strong> WFH</div><div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #0369a1; display: inline-block;"></span> <strong style="color: #0c4a6e;">W/P:</strong> WEEK OFF WORK</div><div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #64748b; display: inline-block;"></span> <strong style="color: #475569;">W/O:</strong> WEEKLY OFF</div><div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span> <strong style="color: #b45309;">H:</strong> HOLIDAY</div><div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #0ea5e9; display: inline-block;"></span> <strong style="color: #0369a1;">OT(P):</strong> OT / EXTRAP</div><div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #8b5cf6; display: inline-block;"></span> <strong style="color: #6d28d9;">S/L:</strong> SICK LEAVE</div><div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #6366f1; display: inline-block;"></span> <strong style="color: #4338ca;">E/L:</strong> EARNED LEAVE</div><div style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #ec4899; display: inline-block;"></span> <strong style="color: #be185d;">C/O:</strong> COMP OFF</div></div><div style="text-align: center; margin-top: 10px; font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Paradigm Services - Monthly Status Report</div></div>`;

    const totalPossible = targetUsers.length * daysInMonth;
    const attendancePercentage = totalPossible > 0 ? Math.round((totalPresentCount / totalPossible) * 100) : 0;
    
    return { 
      date: monthStr, 
      reportDate: safeFormat(nowIST, 'dd MMM yyyy'),
      generatedTime: safeFormat(nowIST, 'hh:mm a'),
      totalEmployees: String(targetUsers.length), 
      table: tableHtml,
      attendancePercentage: String(attendancePercentage),
      totalAbsent: String(Math.round(totalAbsentCount)),
      lateCount: String(totalLateCount),
      logo: '<img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;">',
      totalPresent: String(Math.round(totalPresentCount)),
      generatedBy: filters?.triggeredBy || 'Manual Request'
    };
  },
  document_expiry: async (supabase: SupabaseClient, nowIST: Date, filters?: any) => {
    return { date: format(nowIST, 'yyyy-MM-dd'), items: '0' };
  }
};

async function resolveRecipientsInternal(supabase: SupabaseClient, rule: any): Promise<string[]> {
  if (rule.recipient_type === 'custom_emails') return rule.recipient_emails || [];
  if (rule.recipient_type === 'role') {
    // [SECURITY FIX H11] Added is_active=true and is_deleted=false filters
    const { data: users } = await supabase.from('users').select('email')
      .in('role_id', rule.recipient_roles || [])
      .eq('is_active', true)
      .eq('is_deleted', false);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }
  if (rule.recipient_type === 'users') {
    // [SECURITY FIX H11] Added is_active=true and is_deleted=false filters
    const { data: users } = await supabase.from('users').select('email')
      .in('id', rule.recipient_user_ids || [])
      .eq('is_active', true)
      .eq('is_deleted', false);
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

    const render = (text: string, data: any) => (text || '').replace(/\{(\w+)\}/g, (match, key) => {
      const cleanKey = key.toLowerCase().replace(/[_-]/g, '');
      const dataKey = Object.keys(data).find(k => k.toLowerCase().replace(/[_-]/g, '') === cleanKey);
      return dataKey ? (data as any)[dataKey] : match;
    });

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
    if (!html || rule.report_type === 'attendance_monthly') {
        const getMonthlyReportPremiumTemplate = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>@media only screen and (max-width: 600px) { .stats-container { display: block !important; } .stat-card { margin-bottom: 12px !important; width: 100% !important; } .header-content { display: block !important; text-align: center !important; } .header-right { text-align: center !important; margin-top: 12px !important; } } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #e2e8f0; }</style></head><body style="margin: 0; padding: 0; background-color: #f8fafc;"><div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 1000px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #ffffff; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);"><div style="padding: 40px; border-bottom: 1px solid #f1f5f9; background: #ffffff;"><div style="display: flex; justify-content: space-between; align-items: center;" class="header-content"><div><img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm Services" style="height: 50px; display: block; margin-bottom: 8px;"><div style="font-size: 14px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px;">Paradigm Services</div></div><div style="text-align: right;" class="header-right"><h1 style="margin: 0; font-size: 32px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">Monthly Attendance Report</h1><div style="font-size: 18px; font-weight: 600; color: #64748b; margin-top: 4px;">{date}</div><div style="font-size: 12px; color: #94a3b8; margin-top: 12px; font-weight: 500;">Generated: {generatedTime} | By: {generatedBy}</div></div></div></div><div style="padding: 40px;"><div class="stats-container" style="display: flex; gap: 24px; margin-bottom: 40px;"><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left; border-left: 5px solid #10b981;"><div style="font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Monthly Presence</div><div style="font-size: 42px; font-weight: 900; color: #065f46;">{attendancePercentage}%</div></div><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left; border-left: 5px solid #3b82f6;"><div style="font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Total Punches</div><div style="font-size: 42px; font-weight: 900; color: #1e40af;">{totalPresent}</div></div><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left; border-left: 5px solid #64748b;"><div style="font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Active Staff</div><div style="font-size: 42px; font-weight: 900; color: #334155;">{totalEmployees}</div></div></div><div style="margin-bottom: 40px;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;"><h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Detailed Attendance Grid</h3><div style="font-size: 12px; color: #94a3b8; font-weight: 600;">Scroll horizontally if viewing on mobile</div></div><div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px;">{table}</div></div><div style="padding-top: 40px; border-top: 1px solid #f1f5f9; text-align: center;"><p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 13px; font-weight: 500;">This is an official automated compliance report from the Paradigm Attendance Management System.</p><div style="display: inline-flex; gap: 12px; justify-content: center;"><a href="https://app.paradigmfms.com" style="color: #059669; text-decoration: none; font-weight: 700; font-size: 13px;">Open Dashboard</a><span style="color: #e2e8f0;">|</span><span style="color: #64748b; font-size: 13px; font-weight: 600;">Paradigm Facility Management Services</span></div></div></div></div></body></html>`;


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

    const getMonthlyReportPremiumTemplate = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>@media only screen and (max-width: 600px) { .stats-container { display: block !important; } .stat-card { margin-bottom: 12px !important; width: 100% !important; } .header-content { display: block !important; text-align: center !important; } .header-right { text-align: center !important; margin-top: 12px !important; } } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #e2e8f0; }</style></head><body style="margin: 0; padding: 0; background-color: #f8fafc;"><div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 1000px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #ffffff; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);"><div style="padding: 40px; border-bottom: 1px solid #f1f5f9; background: #ffffff;"><div style="display: flex; justify-content: space-between; align-items: center;" class="header-content"><div><img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm Services" style="height: 50px; display: block; margin-bottom: 8px;"><div style="font-size: 14px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px;">Paradigm Services</div></div><div style="text-align: right;" class="header-right"><h1 style="margin: 0; font-size: 32px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">Monthly Attendance Report</h1><div style="font-size: 18px; font-weight: 600; color: #64748b; margin-top: 4px;">{date}</div><div style="font-size: 12px; color: #94a3b8; margin-top: 12px; font-weight: 500;">Generated: {generatedTime} | By: {generatedBy}</div></div></div></div><div style="padding: 40px;"><div class="stats-container" style="display: flex; gap: 24px; margin-bottom: 40px;"><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left; border-left: 5px solid #10b981;"><div style="font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Monthly Presence</div><div style="font-size: 42px; font-weight: 900; color: #065f46;">{attendancePercentage}%</div></div><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left; border-left: 5px solid #3b82f6;"><div style="font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Total Punches</div><div style="font-size: 42px; font-weight: 900; color: #1e40af;">{totalPresent}</div></div><div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left; border-left: 5px solid #64748b;"><div style="font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Active Staff</div><div style="font-size: 42px; font-weight: 900; color: #334155;">{totalEmployees}</div></div></div><div style="margin-bottom: 40px;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;"><h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Detailed Attendance Grid</h3><div style="font-size: 12px; color: #94a3b8; font-weight: 600;">Scroll horizontally if viewing on mobile</div></div><div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px;">{table}</div></div><div style="padding-top: 40px; border-top: 1px solid #f1f5f9; text-align: center;"><p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 13px; font-weight: 500;">This is an official automated compliance report from the Paradigm Attendance Management System.</p><div style="display: inline-flex; gap: 12px; justify-content: center;"><a href="https://app.paradigmfms.com" style="color: #059669; text-decoration: none; font-weight: 700; font-size: 13px;">Open Dashboard</a><span style="color: #e2e8f0;">|</span><span style="color: #64748b; font-size: 13px; font-weight: 600;">Paradigm Facility Management Services</span></div></div></div></div></body></html>`;


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
