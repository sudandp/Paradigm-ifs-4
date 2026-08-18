import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const cameraName = req.query.camera || req.query.cameraName || 'main_gate_entry';
  const candidateBaseUrls = [
    (process.env.MSSQL_PROXY_URL || '').replace(/\/$/, ''),
    'https://cctv.paradigmfms.com',
    'https://guide-accuracy-literature-fifteen.trycloudflare.com',
    'https://sustainability-silk-owners-musical.trycloudflare.com',
  ].filter(Boolean);

  for (const base of candidateBaseUrls) {
    const targetUrl = `${base}/camera/frame/${encodeURIComponent(String(cameraName))}?ngrok-skip-browser-warning=true&bypass-tunnel-reminder=true&_t=${Date.now()}`;
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'ngrok-skip-browser-warning': '1',
          'bypass-tunnel-reminder': 'true',
          'Bypass-Tunnel-Reminder': '1',
        },
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(200).send(Buffer.from(buffer));
      }
    } catch (_) {}
  }

  return res.status(502).json({ error: 'Failed to fetch camera frame from any candidate tunnel' });
}
