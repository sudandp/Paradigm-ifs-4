import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const candidateBaseUrls: string[] = [
    'https://attendance.cctv.rest',
    'https://attendance.paradigmfms.com',
    (process.env.MSSQL_PROXY_URL || '').replace(/\/$/, ''),
    'https://tassel-estranged-prism.ngrok-free.dev',
  ].filter(Boolean);

  // Dynamic fallback: auto-detect live attendance tunnel URL from Supabase cctv_devices
  try {
    const sbUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
    const sbKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU';
    const sbRes = await fetch(`${sbUrl}/rest/v1/cctv_devices?select=ngrok_url,device_secret&order=updated_at.desc&limit=1`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
      signal: AbortSignal.timeout(2000),
    });
    if (sbRes.ok) {
      const data = await sbRes.json();
      if (Array.isArray(data) && data[0]) {
        const attLive = data[0].device_secret?.replace(/\/$/, '');
        if (attLive && attLive.startsWith('http') && !candidateBaseUrls.includes(attLive)) {
          candidateBaseUrls.unshift(attLive);
        }
      }
    }
  } catch {}

  const apiSecret = process.env.MSSQL_API_SECRET || 'paradigm-attendance-secret-2024';
  const action = (req.query.action as string) || 'attendance';

  // 1. Devices Endpoint
  if (action === 'devices' || req.url?.includes('mssql-devices')) {
    const endpoints: string[] = [];
    for (const base of candidateBaseUrls) {
      endpoints.push(`${base}/devices`);
      endpoints.push(`${base}/api/devices`);
    }

    for (const targetUrl of endpoints) {
      try {
        const response = await fetch(targetUrl, {
          headers: {
            'x-api-secret': apiSecret,
            'x-api-key': apiSecret,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '1',
            'bypass-tunnel-reminder': 'true',
            'Bypass-Tunnel-Reminder': '1',
          },
          signal: AbortSignal.timeout(3500),
        });

        if (response.ok) {
          const data = await response.json();
          return res.status(200).json(data);
        }
      } catch (_) {}
    }
    return res.status(200).json({ devices: [], total: 0, online: 0, offline: 0 });
  }

  // 2. Update Employee Endpoint
  if (action === 'update-employee' || req.url?.includes('mssql-update-employee')) {
    const endpoints: string[] = [];
    for (const base of candidateBaseUrls) {
      endpoints.push(`${base}/update-employee`);
      endpoints.push(`${base}/api/update-employee`);
      endpoints.push(`${base}/api/mssql-update-employee`);
    }

    for (const targetUrl of endpoints) {
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'x-api-secret': apiSecret,
            'x-api-key': apiSecret,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '1',
            'bypass-tunnel-reminder': 'true',
            'Bypass-Tunnel-Reminder': '1',
          },
          body: JSON.stringify(req.body),
          signal: AbortSignal.timeout(3500),
        });

        if (response.ok) {
          const data = await response.json();
          return res.status(200).json(data);
        }
      } catch (_) {}
    }
    return res.status(500).json({ success: false, error: 'Could not connect to MS SQL update proxy endpoint' });
  }

  // 3. Attendance Main Query
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const siteId = req.query.siteId || 'all';

  const endpoints: string[] = [];
  for (const base of candidateBaseUrls) {
    endpoints.push(`${base}/attendance?date=${encodeURIComponent(String(date))}&siteId=${encodeURIComponent(String(siteId))}`);
    endpoints.push(`${base}/api/attendance?date=${encodeURIComponent(String(date))}&siteId=${encodeURIComponent(String(siteId))}`);
  }

  let lastError = '';

  for (const targetUrl of endpoints) {
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'x-api-secret': apiSecret,
          'x-api-key': apiSecret,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
          'bypass-tunnel-reminder': 'true',
          'Bypass-Tunnel-Reminder': '1',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      } else {
        const errorText = await response.text();
        lastError = `[${targetUrl}] HTTP ${response.status}: ${errorText.slice(0, 150)}`;
      }
    } catch (err: any) {
      lastError = `[${targetUrl}] Fetch failed: ${err.message}`;
    }
  }

  return res.status(200).json({
    summary: { date, totalEmployees: 0, present: 0, absent: 0, late: 0, onTime: 0, attendanceRate: 0 },
    employees: [],
    trend: [],
    departments: [],
    lastUpdated: new Date().toISOString(),
    connectionStatus: 'error',
    errorMessage: lastError || `Could not connect to MS SQL proxy (${candidateBaseUrls[0] || 'none'})`,
  });
}
