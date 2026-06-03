import { supabase } from './supabase';
import { format } from 'date-fns';

export interface DaySummary {
  day: string;
  present_count: number;
  wfh_count: number;
  on_leave_count: number;
  absent_count: number;
  avg_working_hours: number;
  late_arrivals: number;
  total_active_staff: number;
}

export interface TodayMetrics {
  present_today: number;
  absent_today: number;
  wfh_today: number;
  on_leave_today: number;
  late_arrivals_today: number;
  pending_leaves: number;
  approved_leaves: number;
  total_active_staff: number;
}

export interface TopPerformer {
  user_id: string;
  name: string;
  role_name: string;
  total_hours: number;
  days_present: number;
}

export async function fetchTodayMetrics(
  societyId?: string,
  siteIds?: string[]
): Promise<TodayMetrics> {
  try {
    const { data, error } = await supabase.rpc('get_today_metrics', {
      p_society_id: societyId ?? null,
      p_site_ids:   siteIds   ?? null,
    });
    if (error) throw error;
    return data[0] as TodayMetrics;
  } catch (error: any) {
    console.warn('[attendanceDashboard] get_today_metrics RPC failed, using fallback:', error.message);
    return fetchTodayMetricsFallback(societyId, siteIds);
  }
}

export async function fetchAttendanceSummary(
  startDate: Date,
  endDate: Date,
  societyId?: string,
  siteIds?: string[]
): Promise<DaySummary[]> {
  const { data, error } = await supabase.rpc('get_attendance_summary', {
    p_start:      format(startDate, 'yyyy-MM-dd'),
    p_end:        format(endDate,   'yyyy-MM-dd'),
    p_society_id: societyId ?? null,
    p_site_ids:   siteIds   ?? null,
  });

  if (error) {
    // RPC broken — fall back to direct query so charts still render
    console.warn('[attendanceDashboard] get_attendance_summary RPC failed, using fallback:', error.message);
    return fetchAttendanceSummaryFallback(startDate, endDate, societyId, siteIds);
  }
  return data as DaySummary[];
}

/** Direct-query fallback — used when the RPC is unavailable or broken */
async function fetchAttendanceSummaryFallback(
  startDate: Date,
  endDate: Date,
  societyId?: string,
  siteIds?: string[]
): Promise<DaySummary[]> {
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr   = format(endDate,   'yyyy-MM-dd');

  // 1. Get total active staff count (role_id IS NOT NULL = active)
  let staffQuery = supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .not('role_id', 'is', null);
  if (societyId) staffQuery = staffQuery.eq('society_id', societyId);
  if (siteIds?.length) staffQuery = staffQuery.in('organization_id', siteIds);
  const { count: totalActiveStaff } = await staffQuery;
  const staffCount = totalActiveStaff ?? 0;

  // 2. Fetch punch-in / punch-out events for the date window
  let evQuery = supabase
    .from('attendance_events')
    .select('user_id, timestamp, type')
    .gte('timestamp', `${startStr}T00:00:00+05:30`)
    .lte('timestamp', `${endStr}T23:59:59+05:30`)
    .in('type', ['punch-in', 'punch-out']);

  const { data: events, error: evErr } = await evQuery;
  if (evErr) throw evErr;

  // Current time — date-fns `format` already uses the browser's local timezone
  // (IST in this case), so no manual offset is needed.
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  const dayPresentMap: Record<string, Set<string>>                        = {};
  const dayFirstIn:    Record<string, Record<string, Date>>               = {};
  const dayLastOut:    Record<string, Record<string, Date>>               = {};

  for (const ev of (events ?? [])) {
    const ts  = new Date(ev.timestamp);
    // date-fns `format` uses the browser's local timezone, so we just format
    // the parsed timestamp directly — no manual UTC→IST shift needed.
    const day = format(ts, 'yyyy-MM-dd');

    if (ev.type === 'punch-in') {
      if (!dayPresentMap[day]) dayPresentMap[day] = new Set();
      dayPresentMap[day].add(ev.user_id);
      if (!dayFirstIn[day]) dayFirstIn[day] = {};
      if (!dayFirstIn[day][ev.user_id] || ts < dayFirstIn[day][ev.user_id]) {
        dayFirstIn[day][ev.user_id] = ts;
      }
    }
    if (ev.type === 'punch-out') {
      if (!dayLastOut[day]) dayLastOut[day] = {};
      if (!dayLastOut[day][ev.user_id] || ts > dayLastOut[day][ev.user_id]) {
        dayLastOut[day][ev.user_id] = ts;
      }
    }
  }

  // 3. Calculate avg hours per day
  // For today: use current IST time if no punch-out (ongoing shift)
  const dayHoursMap: Record<string, { totalHours: number; count: number }> = {};
  for (const day of Object.keys(dayFirstIn)) {
    let totalHrs = 0; let cnt = 0;
    for (const uid of Object.keys(dayFirstIn[day])) {
      const inTime  = dayFirstIn[day][uid];
      const outTime = dayLastOut[day]?.[uid] ?? (day === todayStr ? now : null);
      if (!outTime) continue; // past day with no punch-out — skip
      totalHrs += (outTime.getTime() - inTime.getTime()) / 3_600_000;
      cnt++;
    }
    if (cnt > 0) dayHoursMap[day] = { totalHours: totalHrs, count: cnt };
  }

  // 4. Generate day-by-day result
  const result: DaySummary[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const dayStr     = format(cursor, 'yyyy-MM-dd');
    const presentSet = dayPresentMap[dayStr] ?? new Set();
    const hoursInfo  = dayHoursMap[dayStr];
    const presentCnt = presentSet.size;
    const absentCnt  = Math.max(0, staffCount - presentCnt);

    result.push({
      day:                dayStr,
      present_count:      presentCnt,
      wfh_count:          0,
      on_leave_count:     0,
      absent_count:       absentCnt,
      avg_working_hours:  hoursInfo
        ? Math.round((hoursInfo.totalHours / hoursInfo.count) * 10) / 10
        : 0,
      late_arrivals:      0,
      total_active_staff: staffCount,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}



export async function fetchTopPerformers(
  startDate: Date,
  endDate: Date,
  societyId?: string,
  siteIds?: string[],
  limit = 4
): Promise<TopPerformer[]> {
  try {
    const { data, error } = await supabase.rpc('get_top_performers', {
      p_start:      format(startDate, 'yyyy-MM-dd'),
      p_end:        format(endDate,   'yyyy-MM-dd'),
      p_society_id: societyId ?? null,
      p_site_ids:   siteIds   ?? null,
      p_limit:      limit,
    });
    if (error) throw error;
    return data as TopPerformer[];
  } catch (error: any) {
    console.warn('[attendanceDashboard] get_top_performers RPC failed, using fallback:', error.message);
    return fetchTopPerformersFallback(startDate, endDate, societyId, siteIds, limit);
  }
}

export function buildChartDatasets(rows: DaySummary[]) {
  return {
    labels:            rows.map(r => format(new Date(r.day), 'dd MMM')),
    presentTrend:      rows.map(r => r.present_count),
    absentTrend:       rows.map(r => r.absent_count),
    wfhTrend:          rows.map(r => r.wfh_count),
    onLeaveTrend:      rows.map(r => r.on_leave_count),
    productivityTrend: rows.map(r => r.avg_working_hours),
    totalActiveStaff:  rows[0]?.total_active_staff ?? 0,
  };
}

/** Direct-query fallback for get_today_metrics */
async function fetchTodayMetricsFallback(
  societyId?: string,
  siteIds?: string[]
): Promise<TodayMetrics> {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const startOfDayStr = `${todayStr}T00:00:00+05:30`;
  const endOfDayStr = `${todayStr}T23:59:59+05:30`;

  // 1. Get active staff count
  let staffQuery = supabase
    .from('users')
    .select('id')
    .not('role_id', 'is', null)
    .neq('role_id', 'unverified');
  if (societyId) staffQuery = staffQuery.eq('society_id', societyId);
  if (siteIds?.length) staffQuery = staffQuery.in('organization_id', siteIds);
  const { data: staffData, error: staffErr } = await staffQuery;
  if (staffErr) {
    console.error('[attendanceDashboard] fetchTodayMetricsFallback staff query failed:', staffErr.message);
  }
  const staff = staffData || [];
  const staffIds = staff.map(u => u.id);
  const totalActiveStaff = staff.length;

  if (totalActiveStaff === 0) {
    return {
      present_today: 0,
      absent_today: 0,
      wfh_today: 0,
      on_leave_today: 0,
      late_arrivals_today: 0,
      pending_leaves: 0,
      approved_leaves: 0,
      total_active_staff: 0
    };
  }

  // 2. Fetch today's punches
  const { data: punches } = await supabase
    .from('attendance_events')
    .select('user_id, timestamp, type')
    .in('user_id', staffIds)
    .gte('timestamp', startOfDayStr)
    .lte('timestamp', endOfDayStr)
    .eq('type', 'punch-in');

  const presentUserIds = new Set((punches || []).map(p => p.user_id));

  // Calculate late arrivals (after 09:30 AM)
  const userFirstPunch: Record<string, Date> = {};
  (punches || []).forEach(p => {
    const ts = new Date(p.timestamp);
    if (!userFirstPunch[p.user_id] || ts < userFirstPunch[p.user_id]) {
      userFirstPunch[p.user_id] = ts;
    }
  });
  let lateArrivalsToday = 0;
  Object.values(userFirstPunch).forEach(ts => {
    const hrs = ts.getHours();
    const mins = ts.getMinutes();
    if (hrs > 9 || (hrs === 9 && mins > 30)) {
      lateArrivalsToday++;
    }
  });

  // 3. Fetch leaves
  const { data: leaves } = await supabase
    .from('leave_requests')
    .select('user_id, status, leave_type, start_date, end_date')
    .in('user_id', staffIds);

  const parsedToday = new Date(todayStr);
  let pendingLeaves = 0;
  let approvedLeaves = 0;
  const wfhTodaySet = new Set<string>();
  const leaveTodaySet = new Set<string>();

  (leaves || []).forEach(lr => {
    if (!lr.start_date || !lr.end_date) return;
    const start = new Date(lr.start_date);
    const end = new Date(lr.end_date);
    const isToday = parsedToday >= start && parsedToday <= end;
    const isApproved = ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(String(lr.status).toLowerCase());
    const isPending = String(lr.status).toLowerCase() === 'pending';

    if (isToday) {
      if (isApproved) {
        approvedLeaves++;
        const lType = String(lr.leave_type || '').toLowerCase();
        const isWfh = lType.includes('work from home') || lType === 'wfh' || lType === 'w/h';
        if (isWfh) {
          wfhTodaySet.add(lr.user_id);
        } else {
          leaveTodaySet.add(lr.user_id);
        }
      } else if (isPending) {
        pendingLeaves++;
      }
    }
  });

  const wfh_today = wfhTodaySet.size;
  const on_leave_today = leaveTodaySet.size;
  const totalPresentToday = new Set([...presentUserIds, ...wfhTodaySet]).size;
  const absent_today = Math.max(0, totalActiveStaff - totalPresentToday - on_leave_today);

  return {
    present_today: totalPresentToday,
    absent_today,
    wfh_today,
    on_leave_today,
    late_arrivals_today: lateArrivalsToday,
    pending_leaves: pendingLeaves,
    approved_leaves: approvedLeaves,
    total_active_staff: totalActiveStaff
  };
}

/** Direct-query fallback for get_top_performers */
async function fetchTopPerformersFallback(
  startDate: Date,
  endDate: Date,
  societyId?: string,
  siteIds?: string[],
  limit = 4
): Promise<TopPerformer[]> {
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr   = format(endDate,   'yyyy-MM-dd');

  // 1. Get active users
  let staffQuery = supabase
    .from('users')
    .select('id, name, role:roles(display_name)')
    .not('role_id', 'is', null)
    .neq('role_id', 'unverified');
  if (societyId) staffQuery = staffQuery.eq('society_id', societyId);
  if (siteIds?.length) staffQuery = staffQuery.in('organization_id', siteIds);
  const { data: staffData, error: staffErr } = await staffQuery;
  if (staffErr) {
    console.error('[attendanceDashboard] fetchTopPerformersFallback staff query failed:', staffErr.message);
  }
  const staff = staffData || [];
  const staffMap = new Map(staff.map(u => [u.id, u]));
  const staffIds = staff.map(u => u.id);

  if (staffIds.length === 0) return [];

  // 2. Fetch events
  const { data: events, error: evErr } = await supabase
    .from('attendance_events')
    .select('user_id, timestamp, type')
    .in('user_id', staffIds)
    .gte('timestamp', `${startStr}T00:00:00+05:30`)
    .lte('timestamp', `${endStr}T23:59:59+05:30`)
    .in('type', ['punch-in', 'punch-out', 'break-in', 'break-out']);

  if (evErr) throw evErr;

  // Group events by user and by day
  const userDayEvents: Record<string, Record<string, any[]>> = {};
  (events || []).forEach(e => {
    const day = format(new Date(e.timestamp), 'yyyy-MM-dd');
    if (!userDayEvents[e.user_id]) userDayEvents[e.user_id] = {};
    if (!userDayEvents[e.user_id][day]) userDayEvents[e.user_id][day] = [];
    userDayEvents[e.user_id][day].push(e);
  });

  // Calculate duration per user
  const performers: TopPerformer[] = [];
  for (const [userId, daysMap] of Object.entries(userDayEvents)) {
    let totalHours = 0;
    let daysPresent = 0;

    for (const [day, dayEvts] of Object.entries(daysMap)) {
      dayEvts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const punchIn = dayEvts.find(e => e.type === 'punch-in');
      const punchOut = [...dayEvts].reverse().find(e => e.type === 'punch-out');

      if (punchIn && punchOut) {
        const inTime = new Date(punchIn.timestamp);
        const outTime = new Date(punchOut.timestamp);
        
        let breakSeconds = 0;
        for (let i = 0; i < dayEvts.length; i++) {
          if (dayEvts[i].type === 'break-out') {
            const next = dayEvts.slice(i + 1).find(e => e.type === 'break-in' || e.type === 'punch-out');
            if (next) {
              breakSeconds += (new Date(next.timestamp).getTime() - new Date(dayEvts[i].timestamp).getTime()) / 1000;
            }
          }
        }

        const netWorked = Math.max(0, (outTime.getTime() - inTime.getTime()) / 1000 - breakSeconds);
        totalHours += netWorked / 3600;
        daysPresent++;
      }
    }

    if (totalHours > 0) {
      const u = staffMap.get(userId);
      performers.push({
        user_id: userId,
        name: u?.name || 'Staff Member',
        role_name: (u?.role as any)?.display_name || 'Staff',
        total_hours: totalHours,
        days_present: daysPresent
      });
    }
  }

  return performers
    .sort((a, b) => b.total_hours - a.total_hours)
    .slice(0, limit);
}
