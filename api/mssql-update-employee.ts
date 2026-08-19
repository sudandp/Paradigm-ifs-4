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
    'https://attendance.paradigmfms.com',
    'https://cctv.paradigmfms.com',
    (process.env.MSSQL_PROXY_URL || '').replace(/\/$/, ''),
    'https://tassel-estranged-prism.ngrok-free.dev',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'http://192.168.51.112:4000',
  ].filter(Boolean);

  // Dynamic fallback: auto-detect live tunnel URL from Supabase cctv_devices
  try {
    const sbUrl = process.env.VITE_SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
    const sbKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU';
    const sbRes = await fetch(`${sbUrl}/rest/v1/cctv_devices?select=ngrok_url&order=last_seen.desc&limit=1`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
      signal: AbortSignal.timeout(1800),
    });
    if (sbRes.ok) {
      const data = await sbRes.json();
      if (Array.isArray(data) && data[0]?.ngrok_url) {
        const liveTunnel = data[0].ngrok_url.replace(/\/$/, '');
        if (liveTunnel.startsWith('http') && !candidateBaseUrls.includes(liveTunnel)) {
          candidateBaseUrls.unshift(liveTunnel);
        }
      }
    }
  } catch {}

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
