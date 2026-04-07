import { SupabaseClient } from '@supabase/supabase-js';
import { format, startOfDay } from 'date-fns';

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
        const inDate = new Date(new Date(inTs).getTime() + IST_OFFSET);
        pin = format(inDate, 'hh:mm a');
        const inTime = `${String(inDate.getUTCHours()).padStart(2, '0')}:${String(inDate.getUTCMinutes()).padStart(2, '0')}`;
        if (inTime > configStartTime) { status = 'Late'; color = '#d97706'; }
        const lastOut = todayEvents.filter((e: any) => e.user_id === user.id && (e.type === 'punch-out' || e.type === 'check_out')).pop();
        if (lastOut) {
          pout = format(new Date(new Date(lastOut.timestamp).getTime() + IST_OFFSET), 'hh:mm a');
          const diff = new Date(lastOut.timestamp).getTime() - new Date(inTs).getTime();
          wh = `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
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
      generatedTime: format(nowIST, 'hh:mm a'),
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
    const firstDayOfMonth = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
    const lastDayOfMonth = new Date(nowIST.getFullYear(), nowIST.getMonth() + 1, 0);
    const monthStr = format(nowIST, 'MMMM yyyy');
    const daysInMonth = lastDayOfMonth.getDate();

    const [usersRes, eventsRes, leavesRes] = await Promise.all([
      supabase.from('users').select('id, name, role:roles(display_name)').neq('role_id', 'unverified').order('name'),
      supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', firstDayOfMonth.toISOString()).lte('timestamp', lastDayOfMonth.toISOString()).order('timestamp', { ascending: true }),
      supabase.from('leave_requests').select('user_id, start_date, end_date, leave_type').eq('status', 'approved').gte('end_date', format(firstDayOfMonth, 'yyyy-MM-dd')).lte('start_date', format(lastDayOfMonth, 'yyyy-MM-dd'))
    ]);

    const users = (usersRes.data || []) as any[];
    const events = (eventsRes.data || []) as any[];
    const leaves = (leavesRes.data || []) as any[];

    let tableHtml = `<table style="width:100%; border-collapse: collapse; font-family: sans-serif; font-size: 9px; border: 1px solid #ddd;">
      <thead>
        <tr style="background: #e5e7eb; color: #111827;">
          <th style="border: 1px solid #999; padding: 4px; text-align: left; width: 120px;">Employee Name</th>`;
    
    for (let d = 1; d <= daysInMonth; d++) {
      tableHtml += `<th style="border: 1px solid #999; padding: 2px; text-align: center; width: 18px;">${String(d).padStart(2, '0')}</th>`;
    }
    tableHtml += `<th style="border: 1px solid #999; padding: 4px; text-align: center; background: #d1fae5; color: #065f46;">P</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #dbeafe; color: #1e40af;">1/2P</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #ccfbf1; color: #0f766e;">P(1)</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #cffafe; color: #0e7490;">C/O</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #e0e7ff; color: #3730a3;">E/L</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #f3e8ff; color: #6b21a8;">S/L</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #fee2e2; color: #991b1b;">A</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #ddd;">WO</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #ffedd5; color: #9a3412;">H</th>
          <th style="border: 1px solid #999; padding: 4px; text-align: center; background: #ddd; font-weight: 800;">Pay</th>
        </tr>
      </thead>
      <tbody>`;

    users.forEach((user, idx) => {
      tableHtml += `<tr style="background: ${idx % 2 === 0 ? '#fff' : '#f3f4f6'};">
        <td style="border: 1px solid #bbb; padding: 4px; font-weight: 600;">${user.name}</td>`;
      
      let presentCount = 0;
      let halfDayCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let weeklyOffCount = 0;
      let totalWorkHours = 0;
      let overtimeCount = 0;
      let sickLeaveCount = 0;
      let earnedLeaveCount = 0;
      let compOffCount = 0;
      let holidayCount = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const currentDate = new Date(nowIST.getFullYear(), nowIST.getMonth(), d);
        const isSunday = currentDate.getUTCDay() === 0;
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dayEvents = events.filter(e => e.user_id === user.id && getISTDateString(new Date(e.timestamp)) === dateStr);
        const dayLeave = leaves.find(l => l.user_id === user.id && dateStr >= l.start_date && dateStr <= l.end_date);

        let status = 'A';
        let color = '#dc2626';
        
        const punchIn = dayEvents.find(e => e.type === 'punch-in' || e.type === 'check_in');
        const punchOut = dayEvents.filter(e => e.type === 'punch-out' || e.type === 'check_out').pop();

        if (punchIn && punchOut) {
          const durationHours = (new Date(punchOut.timestamp).getTime() - new Date(punchIn.timestamp).getTime()) / 3600000;
          totalWorkHours += durationHours;
          if (isSunday) {
            status = 'WOP';
            color = '#0d9488';
            presentCount++;
            overtimeCount++;
          } else if (durationHours >= 5) {
            status = 'P';
            color = '#16a34a';
            presentCount++;
            if (durationHours > 14) overtimeCount++;
          } else if (durationHours > 1) {
            status = '0.5P';
            color = '#d97706';
            halfDayCount++;
          }
        } else if (dayLeave) {
          const lt = (dayLeave.leave_type || '').toLowerCase();
          if (lt === 'sick') { status = 'S/L'; color = '#7c3aed'; sickLeaveCount++; }
          else if (lt.includes('comp')) { status = 'C/O'; color = '#0891b2'; compOffCount++; }
          else { status = 'E/L'; color = '#4f46e5'; earnedLeaveCount++; }
          leaveCount++;
        } else if (isSunday) {
          status = 'WO';
          color = '#6b7280';
          weeklyOffCount++;
        } else {
          absentCount++;
        }

        tableHtml += `<td style="border: 1px solid #bbb; padding: 2px; text-align: center; color: ${color}; font-weight: bold; font-size: 8px;">${status}</td>`;
      }

      const grandTotal = presentCount + (halfDayCount * 0.5) + leaveCount + weeklyOffCount + holidayCount;

      tableHtml += `<td style="border: 1px solid #bbb; padding: 4px; text-align: center; font-weight: bold; color: #16a34a;">${presentCount}</td>
        <td style="border: 1px solid #bbb; padding: 4px; text-align: center; font-weight: bold; color: #d97706;">${halfDayCount}</td>
        <td style="border: 1px solid #bbb; padding: 4px; text-align: center; font-weight: bold; color: #0d9488;">${overtimeCount}</td>
        <td style="border: 1px solid #bbb; padding: 4px; text-align: center; font-weight: bold; color: #0891b2;">${compOffCount}</td>
        <td style="border: 1px solid #bbb; padding: 4px; text-align: center; font-weight: bold; color: #4f46e5;">${earnedLeaveCount}</td>
        <td style="border: 1px solid #bbb; padding: 4px; text-align: center; font-weight: bold; color: #7c3aed;">${sickLeaveCount}</td>
        <td style="border: 1px solid #bbb; padding: 4px; text-align: center; font-weight: bold; color: #dc2626;">${absentCount}</td>
        <td style="border: 1px solid #bbb; padding: 4px; text-align: center; color: #6b7280;">${weeklyOffCount}</td>
        <td style="border: 1px solid #bbb; padding: 4px; text-align: center; color: #ea580c;">${holidayCount}</td>
        <td style="border: 1px solid #bbb; padding: 4px; text-align: center; font-weight: 900; background: #f3f4f6;">${grandTotal}</td>
      </tr>`;
    });

    tableHtml += `</tbody></table>`;

    return {
      date: monthStr,
      totalEmployees: String(users.length),
      table: tableHtml
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

    let tableHtml = `<table style="width:100%; border-collapse: collapse; font-family: sans-serif; font-size: 8px; border: 1px solid #999;">
      <thead>
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

    tableHtml += `</tbody></table>`;

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
