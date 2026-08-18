/**
 * mssql.controller.ts
 *
 * Fetches attendance data from the Attendance API Proxy running on WIN-0T8N581GN63.
 * The proxy connects locally to SQL Server and exposes data via HTTPS (Cloudflare Tunnel).
 *
 * Architecture:
 *   Vercel/Express (this file)
 *     → HTTPS fetch → Cloudflare Tunnel URL
 *       → attendance-api/server.js (on WIN-0T8N581GN63)
 *         → SQL Server localhost (never exposed to internet)
 *
 * Env vars required (.env.local):
 *   MSSQL_PROXY_URL   = https://your-tunnel.trycloudflare.com
 *   MSSQL_API_SECRET  = your_secret_key (must match API_SECRET in attendance-api/.env)
 */

// ─── Types ─────────────────────────────────────────────────────

export interface AttendanceSummary {
  date: string;
  totalEmployees: number;
  present: number;
  absent: number;
  late: number;
  onTime: number;
  attendanceRate: number;
}

export interface EmployeeAttendanceRow {
  empCode: string;
  empName: string;
  department: string;
  designation: string;
  inTime: string | null;
  outTime: string | null;
  workingHours: string;
  status: 'Present' | 'Absent' | 'Late' | 'Half Day';
  lateMinutes: number;
}

export interface TrendPoint {
  date: string;
  present: number;
  absent: number;
  attendanceRate: number;
}

export interface AttendanceResponse {
  summary: AttendanceSummary;
  deviceSummary?: { online: number; offline: number; total: number };
  employees: EmployeeAttendanceRow[];
  trend: TrendPoint[];
  departments: { name: string; present: number; total: number }[];
  lastUpdated: string;
  connectionStatus: 'connected' | 'error';
  errorMessage?: string;
}

export interface DeviceRow {
  deviceId: number | string;
  serialNo: string;
  deviceName: string;
  location: string;
  lastPing: string | null;
  status: 'online' | 'offline';
}

export interface DeviceResponse {
  devices: DeviceRow[];
  online: number;
  offline: number;
  total: number;
  note?: string;
}

// ─── Proxy Config ───────────────────────────────────────────────

function getCandidateProxyUrls(): { urls: string[]; secret: string } {
  const secret = process.env.MSSQL_API_SECRET?.trim() || 'paradigm-attendance-secret-2024';
  const urls = [
    process.env.MSSQL_PROXY_URL?.trim(),
    'https://attendance.paradigmfms.com',
    'https://sustainability-silk-owners-musical.trycloudflare.com',
    'https://pretty-nails-dream.loca.lt',
  ].filter(Boolean) as string[];
  return { urls, secret };
}

// ─── Main: Fetch attendance via Proxy ───────────────────────────

export async function getAttendanceData(
  date: string,
  siteId: string = 'all'
): Promise<AttendanceResponse> {
  const { urls, secret } = getCandidateProxyUrls();

  const safeDate = date.match(/^\d{4}-\d{2}-\d{2}$/) ? date : new Date().toISOString().slice(0, 10);
  let lastError = '';

  for (const proxyUrl of urls) {
    const endpoints = [
      `${proxyUrl}/attendance?date=${safeDate}`,
      `${proxyUrl}/api/attendance?date=${safeDate}`
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`[MSSQL Controller] Trying proxy: ${endpoint}`);
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'x-api-key': secret,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '1',
            'bypass-tunnel-reminder': 'true',
            'Bypass-Tunnel-Reminder': '1',
          },
          signal: AbortSignal.timeout(15_000),
        });

        if (res.ok) {
          const data = await res.json() as AttendanceResponse;
          console.log(`[MSSQL Controller] ✅ Got ${data.employees?.length ?? 0} employee records from ${endpoint}`);
          return data;
        } else {
          const body = await res.text();
          lastError = `[${endpoint}] HTTP ${res.status}: ${body.slice(0, 100)}`;
        }
      } catch (err: any) {
        lastError = `[${endpoint}] ${err.message}`;
      }
    }
  }

  return errorShape(date, lastError || 'All tunnel candidate endpoints failed');
}

// ─── Helper ─────────────────────────────────────────────────────

function errorShape(date: string, msg: string): AttendanceResponse {
  return {
    summary: { date, totalEmployees: 0, present: 0, absent: 0, late: 0, onTime: 0, attendanceRate: 0 },
    employees: [],
    trend: [],
    departments: [],
    lastUpdated: new Date().toISOString(),
    connectionStatus: 'error',
    errorMessage: msg,
  };
}

// ─── Fetch Device Status via Proxy ──────────────────────────────

export async function getDeviceData(): Promise<DeviceResponse> {
  const { urls, secret } = getCandidateProxyUrls();

  for (const proxyUrl of urls) {
    const endpoint = `${proxyUrl}/devices`;
    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'x-api-key': secret,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
          'bypass-tunnel-reminder': 'true',
          'Bypass-Tunnel-Reminder': '1',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = await res.json() as DeviceResponse;
        return data;
      }
    } catch (_) {}
  }

  return { devices: [], online: 0, offline: 0, total: 0, note: 'All proxy endpoints failed' };
}

// ─── Diagnostic Debugger ─────────────────────────────────────────

export async function debugMssqlConnection(): Promise<{
  proxyConfigured: boolean;
  proxyUrl: string;
  healthStatus: string;
  devicesStatus: string;
  attendanceStatus: string;
  details: string;
}> {
  const { urls, secret } = getCandidateProxyUrls();
  const primaryUrl = urls[0] || 'NOT_SET';

  let healthStatus = 'UNKNOWN';
  let devicesStatus = 'UNKNOWN';
  let attendanceStatus = 'UNKNOWN';
  const notes: string[] = [];

  for (const proxyUrl of urls) {
    try {
      const t0 = Date.now();
      const res = await fetch(`${proxyUrl}/health`, {
        headers: {
          'ngrok-skip-browser-warning': '1',
          'bypass-tunnel-reminder': 'true',
          'Bypass-Tunnel-Reminder': '1',
        },
        signal: AbortSignal.timeout(5000)
      });
      const ms = Date.now() - t0;
      if (res.ok) {
        healthStatus = `OK (${ms}ms) via ${proxyUrl}`;
        break;
      }
    } catch (err: any) {
      notes.push(`[${proxyUrl}] Health failed: ${err.message}`);
    }
  }

  return {
    proxyConfigured: urls.length > 0,
    proxyUrl: primaryUrl,
    healthStatus,
    devicesStatus,
    attendanceStatus,
    details: notes.join(' | ') || 'All endpoints functioning normally.',
  };
}

/** No-op — pool lives in the proxy server, not here */
export async function closeMssqlPool(): Promise<void> {}

// ─── Update Employee details in MS SQL via Proxy ─────────────────

export async function updateMssqlEmployeeDetails(
  empCode: string,
  empName?: string,
  siteName?: string,
  designation?: string
): Promise<{ success: boolean; rowsAffected?: number; error?: string }> {
  const { urls, secret } = getCandidateProxyUrls();

  for (const proxyUrl of urls) {
    const endpoint = `${proxyUrl}/update-employee`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': secret,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
          'bypass-tunnel-reminder': 'true',
          'Bypass-Tunnel-Reminder': '1',
        },
        body: JSON.stringify({ empCode, empName, siteName, designation }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, rowsAffected: data.rowsAffected };
      }
    } catch (_) {}
  }

  return { success: false, error: 'All proxy update endpoints failed' };
}

