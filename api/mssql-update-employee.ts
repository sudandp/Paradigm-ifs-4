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

  const candidateBaseUrls = [
    (process.env.MSSQL_PROXY_URL || '').replace(/\/$/, ''),
    'https://blond-backup-lending-upgrading.trycloudflare.com',
    'https://attendance.paradigmfms.com',
  ].filter(Boolean);

  const apiSecret = process.env.MSSQL_API_SECRET || 'paradigm-attendance-secret-2024';

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
        body: JSON.stringify(req.body)
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }
    } catch (_) {}
  }

  return res.status(500).json({ success: false, error: 'Could not connect to MS SQL update proxy endpoint' });
}
