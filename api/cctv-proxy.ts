import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query.action as string) || '';
  const cameraName = req.query.camera || req.query.cameraName || 'main_gate_entry';
  let path = (req.query.path as string) || '';

  if (action === 'frame' || req.url?.includes('cctv-frame')) {
    path = `/camera/frame/${encodeURIComponent(String(cameraName))}`;
  } else if (!path) {
    path = `/camera/snapshot/${encodeURIComponent(String(cameraName))}`;
  }

  const candidateBases = [
    'https://cctv.cctv.rest',
    'https://cctv.paradigmfms.com',
    'http://localhost:4100',
    'http://127.0.0.1:4100',
  ];

  // Dynamic lookup of live CCTV tunnel from Supabase
  try {
    const sbUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
    const sbKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU';
    const sbRes = await fetch(`${sbUrl}/rest/v1/cctv_devices?select=ngrok_url&order=updated_at.desc&limit=1`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
      signal: AbortSignal.timeout(1800),
    });
    if (sbRes.ok) {
      const data = await sbRes.json();
      if (Array.isArray(data) && data[0]?.ngrok_url) {
        const live = data[0].ngrok_url.replace(/\/$/, '');
        if (live.startsWith('http') && !candidateBases.includes(live)) {
          candidateBases.unshift(live);
        }
      }
    }
  } catch {}

  for (const base of candidateBases) {
    const targetUrl = `${base}${path.startsWith('/') ? '' : '/'}${path}${req.url?.includes('?') && !req.url.includes('path=') ? req.url.slice(req.url.indexOf('?')) : ''}`;
    try {
      const fetchRes = await fetch(targetUrl, {
        headers: {
          'ngrok-skip-browser-warning': '1',
          'bypass-tunnel-reminder': 'true',
        },
        signal: AbortSignal.timeout(4000),
      });

      if (fetchRes.ok) {
        const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        const buffer = await fetchRes.arrayBuffer();
        return res.status(200).send(Buffer.from(buffer));
      }
    } catch {}
  }

  return res.status(502).json({ error: 'CCTV proxy unreachable' });
}
