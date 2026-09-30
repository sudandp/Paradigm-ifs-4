import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../../../services/supabase';
import { AttendanceData, DeviceData, EmployeeRow } from './types';

export const ATTENDANCE_CACHE_PREFIX = 'paradigm_site_attendance_cache_';
export const ATTENDANCE_CACHE_LATEST = 'paradigm_site_attendance_cache_latest';
export const DEVICES_CACHE_KEY = 'paradigm_site_devices_cache';

export const DEFAULT_ATTENDANCE_SNAPSHOT: AttendanceData = {
  summary: {
    date: format(new Date(), 'yyyy-MM-dd'),
    totalEmployees: 0,
    totalHeadcount: 0,
    activeTotal: 0,
    inactiveTotal: 0,
    present: 0,
    absent: 0,
    late: 0,
    onTime: 0,
    attendanceRate: 0,
  },
  deviceSummary: { online: 0, offline: 0, total: 0 },
  employees: [],
  trend: [],
  departments: [],
  lastUpdated: new Date().toISOString(),
  connectionStatus: 'connected',
};

export const DEFAULT_DEVICES_SNAPSHOT: DeviceData = {
  devices: [],
  online: 0,
  offline: 0,
  total: 0,
};

export function getLocalAttendanceCache(date?: string): AttendanceData {
  try {
    if (date) {
      const key = `${ATTENDANCE_CACHE_PREFIX}${date}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.summary?.date === date && (parsed.summary || (Array.isArray(parsed.employees) && parsed.employees.length > 0))) {
          return parsed;
        }
      }
      return { ...DEFAULT_ATTENDANCE_SNAPSHOT, summary: { ...DEFAULT_ATTENDANCE_SNAPSHOT.summary, date } };
    }

    const raw = localStorage.getItem(ATTENDANCE_CACHE_LATEST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.summary || (Array.isArray(parsed.employees) && parsed.employees.length > 0))) {
        return parsed;
      }
    }
  } catch (e) {
    void e;
  }
  return DEFAULT_ATTENDANCE_SNAPSHOT;
}

export function getLocalDevicesCache(): DeviceData {
  try {
    const raw = localStorage.getItem(DEVICES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.devices)) {
        return parsed;
      }
    }
  } catch (e) {
    void e;
  }
  return DEFAULT_DEVICES_SNAPSHOT;
}

export interface UseSiteAttendanceOptions {
  selectedDate: string;
  autoRefreshIntervalMs?: number;
}

export function useSiteAttendance({ selectedDate, autoRefreshIntervalMs = 300000 }: UseSiteAttendanceOptions) {
  const initialAttendance = useMemo(() => getLocalAttendanceCache(selectedDate), [selectedDate]);
  const initialDevices = useMemo(() => getLocalDevicesCache(), []);

  const [data, setData] = useState<AttendanceData>(initialAttendance);
  const [deviceData, setDeviceData] = useState<DeviceData>(initialDevices);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanErrorMessage = useMemo(() => {
    if (!data?.errorMessage) return 'Database connection is temporarily offline. Retrying...';
    const text = data.errorMessage.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    if (text.includes('502') || text.includes('Bad Gateway') || text.includes('500') || text.includes('DOCTYPE')) {
      return 'Database proxy server disconnected. Please verify local proxy server status.';
    }
    return text || 'Database connection is temporarily offline.';
  }, [data]);

  const fetchData = useCallback(async (showRefreshSpinner = false) => {
    setRefreshing(true);
    if (showRefreshSpinner) setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const apiBaseUrl = (
        import.meta.env.VITE_API_URL || 
        (Capacitor.isNativePlatform() ? 'https://app.paradigmfms.com' : '')
      ).replace(/\/$/, '');
      const ts = Date.now();
      const [attRes, deviceRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/mssql-attendance?date=${selectedDate}&siteId=all&_t=${ts}`, {
          cache: 'no-store',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`${apiBaseUrl}/api/mssql-devices?_t=${ts}`, {
          cache: 'no-store',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
      ]);

      let json: AttendanceData | null = null;
      if (attRes.ok) {
        json = await attRes.json().catch(() => null);
      }

      // If proxy returned error or 0 employees, activate direct Supabase Cloud Cache failover
      if (!json || json.connectionStatus === 'error' || (!json.employees || json.employees.length === 0)) {
        try {
          const { data: cacheRows, error: sbErr } = await supabase
            .from('attendance_cache')
            .select('*')
            .eq('attendance_date', selectedDate)
            .limit(5000);

          if (!sbErr && cacheRows && cacheRows.length > 0) {
            let pres = 0; let abs = 0; let lt = 0;
            const deptMap = new Map<string, { total: number; present: number }>();
            const emps: EmployeeRow[] = cacheRows.map((r: any) => {
              const isP = r.status === 'Present' || r.status_code === 'P' || (r.in_time && r.in_time !== '—' && r.in_time !== '-');
              const isL = (r.late_mins || 0) > 0 || r.status === 'Late';
              if (isP) pres++; else abs++;
              if (isL) lt++;
              const smartSite = r.site && r.site !== 'Default' ? r.site : (r.department || 'General');
              if (!deptMap.has(smartSite)) deptMap.set(smartSite, { total: 0, present: 0 });
              const stat = deptMap.get(smartSite)!;
              stat.total++;
              if (isP) stat.present++;
              const isSec = String(r.emp_code || '').startsWith('32') ||
                smartSite.toLowerCase().includes('security') ||
                (r.department && r.department.toLowerCase().includes('security')) ||
                (r.designation && (r.designation.toLowerCase().includes('security') || r.designation.toLowerCase().includes('guard') || r.designation.toLowerCase().includes('officer')));
              const isDouble = isSec
                ? ((r.ot_mins && r.ot_mins >= 720) || (r.duration_mins && r.duration_mins >= 1200))
                : ((r.ot_mins && r.ot_mins >= 360) || (r.duration_mins && r.duration_mins >= 660));
              let fallbackShiftName = 'A Shift Group';
              let fallbackShiftCode = 'A';
              if (isSec) {
                if (isDouble) {
                  fallbackShiftName = 'Security Day + Night Duty (24h)';
                  fallbackShiftCode = 'DAY+NIGHT';
                } else {
                  const mMatch = (r.in_time || '').match(/(\d{1,2}):(\d{2})/);
                  let inH = 8;
                  if (mMatch) {
                    inH = parseInt(mMatch[1], 10);
                    if ((r.in_time || '').toLowerCase().includes('pm') && inH < 12) inH += 12;
                    if ((r.in_time || '').toLowerCase().includes('am') && inH === 12) inH = 0;
                  }
                  if (inH >= 17 || inH < 5) {
                    fallbackShiftName = 'Security Night Duty (12h)';
                    fallbackShiftCode = 'NIGHT-12';
                  } else {
                    fallbackShiftName = 'Security Day Duty (12h)';
                    fallbackShiftCode = 'DAY-12';
                  }
                }
              } else {
                fallbackShiftName = isDouble ? 'B + C Shift Group' : 'A Shift Group';
                fallbackShiftCode = isDouble ? 'B+C' : 'A';
              }
              return {
                empCode: r.emp_code,
                empName: r.emp_name || 'Staff',
                department: smartSite,
                designation: r.designation || 'Staff',
                site: smartSite,
                company: String(r.emp_code || '').startsWith('32') ? 'Southwall Security LLP' : 'PIFS',
                inTime: r.in_time || '—',
                outTime: r.out_time || '—',
                status: isP ? 'Present' : ((r.status === 'Inactive' || r.status === 'Discontinued / Left' || r.status === 'Not Joined Yet' || r.status_code === 'INACTIVE') ? 'Inactive' : (r.status || 'Absent')),
                statusCode: isP ? 'P' : ((r.status === 'Inactive' || r.status === 'Discontinued / Left' || r.status === 'Not Joined Yet' || r.status_code === 'INACTIVE') ? 'INACTIVE' : (r.status_code || 'A')),
                workingHours: r.working_hours || (isP ? '9h 00m' : '—'),
                shiftCompleted: r.shift_completed || false,
                shiftType: isDouble ? 'double' : 'single',
                shiftName: fallbackShiftName,
                shiftCode: fallbackShiftCode,
                totalDuties: isDouble ? 2 : 1,
                lateMinutes: r.late_mins || 0,
                overtimeMinutes: r.ot_mins || 0,
                otHours: r.ot_mins ? `${Math.floor(r.ot_mins / 60)}h ${r.ot_mins % 60}m` : '—',
                isActiveEmployee: isP || (r.status !== 'Inactive' && r.status !== 'Discontinued / Left' && r.status !== 'Not Joined Yet' && r.status_code !== 'INACTIVE' && ((r.duration_mins || 0) >= 240)),
                daysSinceLastPunch: isP ? 0 : 999,
                source: 'supabase_cache',
              };
            });
            const tot = emps.length;
            const depts = Array.from(deptMap.entries()).map(([name, stat]) => ({
              name, present: stat.present, total: stat.total
            })).sort((a, b) => b.total - a.total);

            json = {
              summary: {
                date: selectedDate,
                totalEmployees: tot,
                activeTotal: tot,
                inactiveTotal: 0,
                present: pres,
                absent: abs,
                late: lt,
                onTime: Math.max(0, pres - lt),
                attendanceRate: tot > 0 ? Math.round((pres / tot) * 100) : 0,
              },
              employees: emps,
              departments: depts,
              trend: [],
              lastUpdated: new Date().toISOString(),
              connectionStatus: 'connected',
              source: 'supabase_cache',
              cached: true,
            };
          }
        } catch (sbCatchErr) {
          console.warn('[useSiteAttendance] Direct Supabase fallback error:', sbCatchErr);
        }
      }

      if (!json || json.connectionStatus === 'error') {
        const cached = getLocalAttendanceCache(selectedDate);
        if (cached && (cached.employees?.length || 0) > 0) {
          setData({
            ...cached,
            connectionStatus: 'error',
            errorMessage: json?.errorMessage || 'Database connection is temporarily offline.',
          });
        } else if (json) {
          setData(json);
        }
      } else {
        setData(json);
        try {
          if ((json.employees?.length || 0) > 0) {
            localStorage.setItem(`${ATTENDANCE_CACHE_PREFIX}${selectedDate}`, JSON.stringify(json));
            localStorage.setItem(ATTENDANCE_CACHE_LATEST, JSON.stringify(json));
          }
        } catch (e) {
          void e;
        }
      }

      if (deviceRes.ok) {
        const dJson: DeviceData = await deviceRes.json().catch(() => null);
        if (dJson) {
          setDeviceData(dJson);
          try {
            localStorage.setItem(DEVICES_CACHE_KEY, JSON.stringify(dJson));
          } catch (e) {
            void e;
          }
        }
      }
    } catch (err: any) {
      console.error('[useSiteAttendance] fetch error:', err.message);
      setData(prev => ({
        ...prev,
        connectionStatus: 'error',
        errorMessage: err.message,
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  // Initial & date-change fetch with instant cache retrieval
  useEffect(() => {
    const cached = getLocalAttendanceCache(selectedDate);
    setData(cached);
    setLoading(false);
    fetchData();
  }, [selectedDate, fetchData]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshIntervalMs > 0) {
      autoRefreshRef.current = setInterval(() => {
        fetchData();
      }, autoRefreshIntervalMs);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [fetchData, autoRefreshIntervalMs]);

  return {
    data,
    setData,
    deviceData,
    setDeviceData,
    loading,
    refreshing,
    fetchData,
    cleanErrorMessage,
  };
}
