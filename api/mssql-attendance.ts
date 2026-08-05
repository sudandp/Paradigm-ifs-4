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

  const tunnelUrl = process.env.MSSQL_PROXY_URL || 'https://reliance-dinner-url-consumers.trycloudflare.com';
  const apiSecret = process.env.MSSQL_API_SECRET || 'paradigm-attendance-secret-2024';

  const date = req.query.date || '';
  const siteId = req.query.siteId || 'all';

  try {
    const targetUrl = `${tunnelUrl.replace(/\/$/, '')}/api/attendance?date=${encodeURIComponent(String(date))}&siteId=${encodeURIComponent(String(siteId))}`;
    
    const response = await fetch(targetUrl, {
      headers: {
        'x-api-secret': apiSecret,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        summary: { date, totalEmployees: 0, present: 0, absent: 0, late: 0, onTime: 0, attendanceRate: 0 },
        employees: [],
        trend: [],
        departments: [],
        lastUpdated: new Date().toISOString(),
        connectionStatus: 'error',
        errorMessage: `Upstream attendance API returned HTTP ${response.status}: ${errorText.slice(0, 100)}`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('MSSQL Attendance Proxy Error:', err);
    return res.status(500).json({
      summary: { date, totalEmployees: 0, present: 0, absent: 0, late: 0, onTime: 0, attendanceRate: 0 },
      employees: [],
      trend: [],
      departments: [],
      lastUpdated: new Date().toISOString(),
      connectionStatus: 'error',
      errorMessage: `Could not connect to local Cloudflare Tunnel server: ${err.message}`,
    });
  }
}
