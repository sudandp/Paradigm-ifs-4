/**
 * routes/cameraRoutes.js
 * CCTV Camera Proxy & Face Enrollment routes
 */

const express = require('express');
const router = express.Router();
const http = require('http');

const CCTV_PORT = process.env.CCTV_PORT || 4100;
const CCTV_BASE = `http://127.0.0.1:${CCTV_PORT}`;

// GET /camera/frame/:cameraName — single JPEG snapshot frame
router.get('/camera/frame/:cameraName', async (req, res) => {
  const camName = req.params.cameraName;
  const targetUrl = `${CCTV_BASE}/camera/frame/${encodeURIComponent(camName)}?${new URLSearchParams(req.query).toString()}`;
  try {
    const upstream = await fetch(targetUrl, { signal: AbortSignal.timeout(5000) });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream CCTV service returned ${upstream.status}` });
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const buffer = await upstream.arrayBuffer();
    return res.end(Buffer.from(buffer));
  } catch (err) {
    if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'CCTV attendance service not running or camera unreachable on port ' + CCTV_PORT });
    }
    return res.status(502).json({ error: err.message });
  }
});

// GET /camera/stream/:cameraName — MJPEG multipart streaming
router.get('/camera/stream/:cameraName', (req, res) => {
  const camName = req.params.cameraName;
  const targetPath = `/camera/stream/${encodeURIComponent(camName)}?${new URLSearchParams(req.query).toString()}`;

  const upstreamReq = http.request({
    hostname: '127.0.0.1',
    port: CCTV_PORT,
    path: targetPath,
    method: 'GET',
    headers: req.headers,
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
    upstreamRes.pipe(res);
  });

  upstreamReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(503).json({ error: 'CCTV attendance service unreachable: ' + err.message });
    }
  });

  req.on('close', () => {
    upstreamReq.destroy();
  });

  upstreamReq.end();
});

// GET /camera/snapshot/:cameraName
router.get('/camera/snapshot/:cameraName', async (req, res) => {
  const camName = req.params.cameraName;
  const targetUrl = `${CCTV_BASE}/camera/snapshot/${encodeURIComponent(camName)}`;
  try {
    const upstream = await fetch(targetUrl, { signal: AbortSignal.timeout(6000) });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream error ${upstream.status}` });
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    const buffer = await upstream.arrayBuffer();
    return res.end(Buffer.from(buffer));
  } catch (err) {
    return res.status(503).json({ error: 'CCTV attendance service unreachable: ' + err.message });
  }
});

// POST /camera/enroll — enroll employee face from CCTV capture
router.post('/camera/enroll', async (req, res) => {
  const targetUrl = `${CCTV_BASE}/camera/enroll`;
  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(503).json({ error: 'CCTV attendance service unreachable: ' + err.message });
  }
});

module.exports = router;
