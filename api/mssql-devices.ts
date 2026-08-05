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

  try {
    const targetUrl = `${tunnelUrl.replace(/\/$/, '')}/api/devices`;
    
    const response = await fetch(targetUrl, {
      headers: {
        'x-api-secret': apiSecret,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ devices: [], total: 0, online: 0, offline: 0 });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('MSSQL Devices Proxy Error:', err);
    return res.status(500).json({ devices: [], total: 0, online: 0, offline: 0, error: err.message });
  }
}
