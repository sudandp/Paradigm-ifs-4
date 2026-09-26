/**
 * attendanceDataService.ts
 * Smart Attendance Data Router — MS SQL ↔ Supabase Tiered Cache
 *
 * Routing rules (year-based):
 *   Current year  → Supabase only (fast, always available)
 *   Previous year → Try MS SQL first; fall back to Supabase cache if offline
 *   2+ years ago  → MS SQL only (not in Supabase cache)
 *
 * This service is transparent to the UI — all consumers just call
 * fetchAttendanceByDate() or fetchAttendanceReport() and get data back
 * regardless of whether MS SQL is reachable.
 */

import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AttendanceCacheRow {
  id?: number;
  emp_code: string;
  emp_name: string;
  department: string;
  designation: string;
  site: string;
  attendance_date: string;   // YYYY-MM-DD
  in_time: string | null;
  out_time: string | null;
  status: string;
  status_code: string;
  duration_mins: number;
  late_mins: number;
  ot_mins: number;
  working_hours: string | null;
  data_year: number;
  source: string;
  synced_at: string;
}

export interface SyncStatus {
  configured: boolean;
  recent_syncs: Array<{
    sync_date: string;
    records_synced: number;
    status: string;
    error_msg: string | null;
    duration_ms: number;
    triggered_by: string;
    synced_at: string;
  }>;
}

export type DataSource = 'supabase' | 'mssql' | 'supabase_fallback';

export interface AttendanceFetchResult {
  data: AttendanceCacheRow[];
  source: DataSource;
  cached: boolean;
  error?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const MSSQL_TIMEOUT_MS = 12000;

// ─── Core Router ────────────────────────────────────────────────────────────

/** Maximum date range allowed in a single fetch (days) */
const MAX_GLOBAL_QUERY_DAYS = 62; // ~2 months for all-site queries
const MAX_SINGLE_EMP_QUERY_DAYS = 366; // 1 year for individual employee

/**
 * Fetch attendance records for a date range.
 * Automatically routes to the right data source based on year.
 */
export async function fetchAttendanceByDateRange(
  startDate: string,
  endDate: string,
  options?: { empCode?: string; site?: string; siteId?: string }
): Promise<AttendanceFetchResult> {
  // 🛡️ Safety Guard: Validate inputs
  if (!startDate || !endDate) {
    return { data: [], source: 'supabase', cached: true, error: 'Start date and end date are required' };
  }

  const startMs = new Date(startDate).getTime();
  const endMs   = new Date(endDate).getTime();
  if (isNaN(startMs) || isNaN(endMs)) {
    return { data: [], source: 'supabase', cached: true, error: 'Invalid date format provided' };
  }

  // 🛡️ Safety Guard: Prevent unbounded runaway queries
  const diffDays = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24));
  const maxAllowedDays = options?.empCode ? MAX_SINGLE_EMP_QUERY_DAYS : MAX_GLOBAL_QUERY_DAYS;
  if (diffDays > maxAllowedDays) {
    console.warn(`[AttendanceService] Query range (${diffDays} days) exceeds limit of ${maxAllowedDays} days.`);
  }

  const startYear = new Date(startDate).getFullYear();

  if (startYear === CURRENT_YEAR) {
    // ✅ Current year — read from Supabase (hot cache, always live)
    return fetchFromSupabaseCache(startDate, endDate, options);
  }

  if (startYear === CURRENT_YEAR - 1) {
    // ⚡ Previous year — try MS SQL first, fall back to Supabase cache
    try {
      const mssqlResult = await fetchFromMssql(startDate, endDate, options);
      if (mssqlResult.data.length > 0) return mssqlResult;
    } catch {
      // MS SQL offline — transparent fallback to Supabase cache
    }
    const fallback = await fetchFromSupabaseCache(startDate, endDate, options);
    return { ...fallback, source: 'supabase_fallback', cached: true };
  }

  // 📦 Older than 1 year — MS SQL only (not cached in Supabase)
  return fetchFromMssql(startDate, endDate, options);
}

/**
 * Fetch attendance for a single date.
 * Convenience wrapper around fetchAttendanceByDateRange.
 */
export async function fetchAttendanceByDate(
  date: string,
  options?: { site?: string }
): Promise<AttendanceFetchResult> {
  return fetchAttendanceByDateRange(date, date, options);
}

// ─── Supabase Cache Layer ────────────────────────────────────────────────────

async function fetchFromSupabaseCache(
  startDate: string,
  endDate: string,
  options?: { empCode?: string; site?: string; siteId?: string }
): Promise<AttendanceFetchResult> {
  let query = supabase
    .from('attendance_cache')
    .select('*')
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDate)
    .order('attendance_date', { ascending: true })
    .order('emp_name', { ascending: true })
    .limit(5000); // 🛡️ Prevent payload exhaustion

  if (options?.empCode) {
    query = query.eq('emp_code', options.empCode);
  }
  if (options?.site) {
    query = query.eq('site', options.site);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], source: 'supabase', cached: true, error: error.message };
  }

  return {
    data: (data || []) as AttendanceCacheRow[],
    source: 'supabase',
    cached: true,
  };
}

// ─── MS SQL Proxy Layer ──────────────────────────────────────────────────────

async function fetchFromMssql(
  startDate: string,
  endDate: string,
  options?: { empCode?: string; site?: string; siteId?: string }
): Promise<AttendanceFetchResult> {
  const isSingleDay = startDate === endDate;

  if (isSingleDay) {
    // Single day — use /attendance endpoint, transform to AttendanceCacheRow[]
    const params = new URLSearchParams({ action: 'attendance', date: startDate });
    if (options?.siteId) params.set('siteId', options.siteId);

    const res = await fetch(`/api/mssql?${params}`, {
      signal: AbortSignal.timeout(MSSQL_TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`MS SQL ${res.status}: ${res.statusText}`);
    const json = await res.json();

    const employees: any[] = json.employees || [];
    const rows: AttendanceCacheRow[] = employees.map((e: any) => ({
      emp_code:        String(e.empCode || ''),
      emp_name:        String(e.empName || ''),
      department:      String(e.department || 'General'),
      designation:     String(e.designation || 'Staff'),
      site:            String(e.department || 'Default'),
      attendance_date: startDate,
      in_time:         e.inTime || null,
      out_time:        e.outTime || null,
      status:          String(e.status || 'Absent'),
      status_code:     e.status === 'Present' || e.status === 'Late' ? 'P' : 'A',
      duration_mins:   e.workingHoursMinutes || 0,
      late_mins:       e.lateMinutes || 0,
      ot_mins:         e.otMinutes || 0,
      working_hours:   e.workingHours || null,
      data_year:       new Date(startDate).getFullYear(),
      source:          'mssql',
      synced_at:       new Date().toISOString(),
    }));

    return { data: rows, source: 'mssql', cached: false };
  }

  // Multi-day report
  const params = new URLSearchParams({
    action:    'attendance-report',
    startDate,
    endDate,
    ...(options?.empCode && { empCode: options.empCode }),
    ...(options?.siteId  && { site:   options.siteId }),
  });

  const res = await fetch(`/api/mssql?${params}`, {
    signal: AbortSignal.timeout(MSSQL_TIMEOUT_MS * 3),
  });

  if (!res.ok) throw new Error(`MS SQL ${res.status}: ${res.statusText}`);
  const json = await res.json();

  // Flatten report format into AttendanceCacheRow[]
  const rows: AttendanceCacheRow[] = [];
  const records: Record<string, any> = json.records || {};
  for (const [empCode, emp] of Object.entries(records)) {
    const days: Record<string, any> = (emp as any).days || {};
    for (const [date, day] of Object.entries(days)) {
      const d = day as any;
      rows.push({
        emp_code:        empCode,
        emp_name:        (emp as any).empName || '',
        department:      (emp as any).department || 'General',
        designation:     (emp as any).designation || 'Staff',
        site:            (emp as any).department || 'Default',
        attendance_date: date,
        in_time:         d.inTime || null,
        out_time:        d.outTime || null,
        status:          d.status || 'Absent',
        status_code:     d.statusCode || 'A',
        duration_mins:   d.durationMins || 0,
        late_mins:       d.lateMins || 0,
        ot_mins:         d.otMins || 0,
        working_hours:   d.workingHours || null,
        data_year:       new Date(date).getFullYear(),
        source:          'mssql',
        synced_at:       new Date().toISOString(),
      });
    }
  }

  return { data: rows, source: 'mssql', cached: false };
}

// ─── Sync Utilities (for admin UI) ──────────────────────────────────────────

/** Get the last sync status from the attendance API */
export async function getSyncStatus(): Promise<SyncStatus | null> {
  try {
    const res = await fetch(
      `https://attendance.cctv.rest/sync/status`,
      {
        headers: { 'x-api-key': 'paradigm-attendance-secret-2024' },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Trigger a manual sync for a specific date (admin action) */
export async function triggerManualSync(date?: string): Promise<{ success: boolean; records?: number; error?: string }> {
  const target = date || new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(
      `https://attendance.cctv.rest/sync/today?date=${target}&by=manual`,
      {
        method: 'POST',
        headers: { 'x-api-key': 'paradigm-attendance-secret-2024' },
        signal: AbortSignal.timeout(30000),
      }
    );
    const json = await res.json();
    return { success: json.success, records: json.records, error: json.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Trigger backfill for a full year (admin action — runs in background on server) */
export async function triggerBackfill(year: number): Promise<{ status: string; message: string }> {
  try {
    const res = await fetch(
      `https://attendance.cctv.rest/sync/backfill?year=${year}`,
      {
        method: 'POST',
        headers: { 'x-api-key': 'paradigm-attendance-secret-2024' },
        signal: AbortSignal.timeout(15000),
      }
    );
    return res.json();
  } catch (err: any) {
    return { status: 'error', message: err.message };
  }
}

/** Check which data source a given year will use */
export function getDataSourceForYear(year: number): { source: DataSource; label: string } {
  if (year === CURRENT_YEAR) {
    return { source: 'supabase', label: 'Live (Supabase Cache)' };
  }
  if (year === CURRENT_YEAR - 1) {
    return { source: 'supabase_fallback', label: 'MS SQL (Supabase fallback if offline)' };
  }
  return { source: 'mssql', label: 'MS SQL Direct (archived)' };
}
