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
  const { data, error } = await supabase.rpc('get_today_metrics', {
    p_society_id: societyId ?? null,
    p_site_ids:   siteIds   ?? null,
  });
  if (error) throw error;
  return data[0] as TodayMetrics;
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
  const { data, error } = await supabase.rpc('get_top_performers', {
    p_start:      format(startDate, 'yyyy-MM-dd'),
    p_end:        format(endDate,   'yyyy-MM-dd'),
    p_society_id: societyId ?? null,
    p_site_ids:   siteIds   ?? null,
    p_limit:      limit,
  });
  if (error) throw error;
  return data as TopPerformer[];
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
