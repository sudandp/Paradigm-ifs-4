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

function getProxyConfig(): { url: string; secret: string } | null {
  let url = process.env.MSSQL_PROXY_URL?.trim();
  if (!url || url.includes('trycloudflare.com')) {
    url = 'https://tassel-estranged-prism.ngrok-free.dev';
  }
  const secret = process.env.MSSQL_API_SECRET?.trim() || 'paradigm-attendance-secret-2024';
  return { url, secret };
}

// ─── Main: Fetch attendance via Proxy ───────────────────────────

export async function getAttendanceData(
  date: string,
  siteId: string = 'all'
): Promise<AttendanceResponse> {
  const proxy = getProxyConfig();

  if (!proxy) {
    console.error('[MSSQL Controller] MSSQL_PROXY_URL not set in .env.local');
    return errorShape(date, 'MSSQL_PROXY_URL is not configured. Set it to your Cloudflare Tunnel URL.');
  }

  const safeDate = date.match(/^\d{4}-\d{2}-\d{2}$/) ? date : new Date().toISOString().slice(0, 10);
  const endpoint = `${proxy.url}/attendance?date=${safeDate}`;

  console.log(`[MSSQL Controller] Fetching via proxy: ${endpoint}`);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-api-key': proxy.secret,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(90_000), // 90s timeout for cloudflared tunnel
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Proxy returned ${res.status}: ${body}`);
    }

    const data = await res.json() as AttendanceResponse;
    console.log(`[MSSQL Controller] ✅ Got ${data.employees?.length ?? 0} employee records`);
    return data;

  } catch (err: any) {
    console.error('[MSSQL Controller] Proxy fetch failed:', err.message);
    return errorShape(date, err.message);
  }
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
  const proxy = getProxyConfig();
  if (!proxy) {
    return { devices: [], online: 0, offline: 0, total: 0, note: 'MSSQL_PROXY_URL not configured' };
  }

  const endpoint = `${proxy.url}/devices`;
  console.log(`[MSSQL Controller] Fetching devices: ${endpoint}`);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 'x-api-key': proxy.secret, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
    const data = await res.json() as DeviceResponse;
    console.log(`[MSSQL Controller] ✅ Got ${data.total} devices (${data.online} online)`);
    return data;
  } catch (err: any) {
    console.error('[MSSQL Controller] Device fetch failed:', err.message);
    return { devices: [], online: 0, offline: 0, total: 0, note: err.message };
  }
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
  const proxy = getProxyConfig();
  if (!proxy) {
    return {
      proxyConfigured: false,
      proxyUrl: 'NOT_SET',
      healthStatus: 'ERROR',
      devicesStatus: 'ERROR',
      attendanceStatus: 'ERROR',
      details: 'MSSQL_PROXY_URL is missing in .env.local',
    };
  }

  let healthStatus = 'UNKNOWN';
  let devicesStatus = 'UNKNOWN';
  let attendanceStatus = 'UNKNOWN';
  const notes: string[] = [];

  // Test 1: Health
  try {
    const t0 = Date.now();
    const res = await fetch(`${proxy.url}/health`, { signal: AbortSignal.timeout(5000) });
    const ms = Date.now() - t0;
    if (res.ok) {
      healthStatus = `OK (${ms}ms)`;
    } else {
      healthStatus = `HTTP ${res.status}`;
    }
  } catch (err: any) {
    healthStatus = `FAILED: ${err.message}`;
    notes.push(`Health check failed: ${err.message}`);
  }

  // Test 2: Devices
  try {
    const t0 = Date.now();
    const res = await fetch(`${proxy.url}/devices`, {
      headers: { 'x-api-key': proxy.secret },
      signal: AbortSignal.timeout(10000),
    });
    const ms = Date.now() - t0;
    if (res.ok) {
      devicesStatus = `OK (${ms}ms)`;
    } else {
      devicesStatus = `HTTP ${res.status}`;
    }
  } catch (err: any) {
    devicesStatus = `FAILED: ${err.message}`;
    notes.push(`Devices fetch failed: ${err.message}`);
  }

  // Test 3: Attendance
  try {
    const t0 = Date.now();
    const date = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${proxy.url}/attendance?date=${date}`, {
      headers: { 'x-api-key': proxy.secret },
      signal: AbortSignal.timeout(15000),
    });
    const ms = Date.now() - t0;
    if (res.ok) {
      attendanceStatus = `OK (${ms}ms)`;
    } else {
      attendanceStatus = `HTTP ${res.status}`;
    }
  } catch (err: any) {
    attendanceStatus = `FAILED: ${err.message}`;
    notes.push(`Attendance fetch failed: ${err.message}`);
  }

  return {
    proxyConfigured: true,
    proxyUrl: proxy.url,
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
  const proxy = getProxyConfig();
  if (!proxy) {
    return { success: false, error: 'MSSQL_PROXY_URL is not configured.' };
  }

  const endpoint = `${proxy.url}/update-employee`;
  console.log(`[MSSQL Controller] Updating employee ${empCode} via proxy: ${endpoint}`);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': proxy.secret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ empCode, empName, siteName, designation }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Proxy returned ${res.status}: ${body}`);
    }

    const data = await res.json();
    return { success: true, rowsAffected: data.rowsAffected };
  } catch (err: any) {
    console.error('[MSSQL Controller] Employee update failed:', err.message);
    return { success: false, error: err.message };
  }
}

