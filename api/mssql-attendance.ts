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

  let tunnelUrl = (process.env.MSSQL_PROXY_URL || '').replace(/\/$/, '');
  if (!tunnelUrl || tunnelUrl.includes('trycloudflare.com') || tunnelUrl.includes('loca.lt') || tunnelUrl.includes('ngrok-free.dev')) {
    tunnelUrl = 'https://attendance.paradigmfms.com';
  }
  const apiSecret = process.env.MSSQL_API_SECRET || 'paradigm-attendance-secret-2024';

  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const siteId = req.query.siteId || 'all';

  // Try both /attendance and /api/attendance to support all local server setups
  const endpoints = [
    `${tunnelUrl}/attendance?date=${encodeURIComponent(String(date))}&siteId=${encodeURIComponent(String(siteId))}`,
    `${tunnelUrl}/api/attendance?date=${encodeURIComponent(String(date))}&siteId=${encodeURIComponent(String(siteId))}`
  ];

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

  return res.status(500).json({
    summary: { date, totalEmployees: 0, present: 0, absent: 0, late: 0, onTime: 0, attendanceRate: 0 },
    employees: [],
    trend: [],
    departments: [],
    lastUpdated: new Date().toISOString(),
    connectionStatus: 'error',
    errorMessage: lastError || `Could not connect to Cloudflare Tunnel (${tunnelUrl})`,
  });
}
