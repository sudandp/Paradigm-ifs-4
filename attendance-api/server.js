/**
 * ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
 *  Paradigm FMS ΓÇö Attendance API Proxy
 *  Runs ON: WIN-0T8N581GN63 (the SQL Server machine)
 *  Connects to: SQL Server via localhost (safe, never internet)
 *  Exposed via: Cloudflare Tunnel (HTTPS, no port forwarding)
 * ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
 *
 *  Setup:
 *    1. Copy this entire attendance-api/ folder to WIN-0T8N581GN63
 *    2. Run setup.bat once to install dependencies
 *    3. Edit .env with your SQL password
 *    4. Run start.bat to start the API
 *    5. Run cloudflared-setup.bat to create the tunnel
 * ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const sql     = require('mssql');

const app  = express();
const PORT = process.env.PORT || 4000;

// ΓöÇΓöÇΓöÇ API Key Auth ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const API_SECRET = process.env.API_SECRET || '';

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!API_SECRET) {
    console.warn('[Auth] WARNING: No API_SECRET set ΓÇö all requests allowed. Set API_SECRET in .env!');
    return next();
  }
  if (key !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized ΓÇö invalid API key' });
  }
  next();
}

// ─── CORS ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://cctv.rest',
    'https://attendance.cctv.rest',
    'https://cctv.cctv.rest',
    'https://app.paradigmfms.com',
    'https://paradigmfms.com',
    'https://www.paradigmfms.com',
    'https://paradigm-ifs-4.vercel.app',
    'https://www.paradigm-ifs-4.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  credentials: true,
}));
app.use(express.json());

// ΓöÇΓöÇΓöÇ MS SQL Connection (connects to localhost ΓÇö never internet) ΓöÇ
const DB_CONFIG = {
  server: 'localhost',
  database: process.env.DB_NAME     || 'etimetracklite1',
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD || 'Paradigm@1610',
  port:     parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || 'SQLEXPRESS',
    enableArithAbort: true,
    trustedConnection: process.env.DB_TRUSTED === 'true',
  },
  pool: { max: 10, min: 2, idleTimeoutMillis: 60000 },
  connectionTimeout: 30000,
  requestTimeout: 120000,
};

let pool = null;

async function getPool() {
  if (pool && pool.connected) return pool;
  console.log('[DB] Connecting to SQL Server...');
  try {
    pool = await new sql.ConnectionPool(DB_CONFIG).connect();
    console.log('[DB] Connected to', DB_CONFIG.database, 'via SQL Auth');
  } catch (err) {
    console.warn('[DB] SQL Auth failed (' + err.message + '), trying Windows Auth / Local Named Pipes...');
    // Fallback: Trusted Windows Authentication / Local instance
    const windowsConfig = {
      server: 'localhost',
      database: DB_CONFIG.database,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        instanceName: DB_CONFIG.options.instanceName,
        trustedConnection: true,
        enableArithAbort: true,
      },
    };
    pool = await new sql.ConnectionPool(windowsConfig).connect();
    console.log('[DB] Connected to', DB_CONFIG.database, 'via Windows Auth');
  }

  pool.on('error', (err) => {
    console.error('[DB] Pool error:', err.message);
    pool = null;
  });
  return pool;
}

// ΓöÇΓöÇΓöÇ Health Check ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get(['/', '/health'], (req, res) => {
  res.json({
    service: 'Paradigm Attendance API',
    status: 'running',
    database: DB_CONFIG.database,
    time: new Date().toISOString(),
  });
});

// ─── Remote Restart (Admin Only) ──────────────────────────────────────────────
// POST /restart  →  triggers: pm2 restart attendance-api
// PM2 daemon handles the restart externally; safe to call from within the process.
app.post('/restart', requireApiKey, (req, res) => {
  const { exec } = require('child_process');
  console.log('[Restart] Remote restart triggered by admin at', new Date().toISOString());
  res.json({ status: 'restarting', message: 'PM2 restart issued. API will be back in ~5s.', time: new Date().toISOString() });
  setTimeout(() => {
    exec('pm2 restart attendance-api', (err) => {
      if (err) console.error('[Restart] pm2 error:', err.message);
    });
  }, 300);
});

// ─── CCTV Camera Proxy ─────────────────────────────────────────────────────
// Proxies camera frame/snapshot requests from the cctv-attendance Python
// service on localhost:4100 through this server (port 4000) via ngrok tunnel.
// This allows remote browsers to view live camera feeds without a separate tunnel.
const CCTV_PORT = process.env.CCTV_PORT || 4100;
const CCTV_BASE = `http://127.0.0.1:${CCTV_PORT}`;

// GET /camera/frame/:cameraName  — single JPEG snapshot frame
app.get('/camera/frame/:cameraName', async (req, res) => {
  const camName = req.params.cameraName;
  const targetUrl = `${CCTV_BASE}/camera/frame/${encodeURIComponent(camName)}?${new URLSearchParams(req.query).toString()}`;
  try {
    const http = require('http');
    const proxyReq = http.get(targetUrl, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      console.warn(`[CCTV Proxy] Frame fetch error for ${camName}:`, err.message);
      res.status(502).json({ error: 'CCTV service unreachable', details: err.message });
    });
    req.on('close', () => proxyReq.destroy());
  } catch (err) {
    res.status(500).json({ error: 'Camera proxy error', details: err.message });
  }
});

// GET /camera/stream/:cameraName  — continuous MJPEG live stream
// The browser receives a multipart/x-mixed-replace response and renders it as live video
// directly inside an <img> tag — no JavaScript polling needed.
app.get('/camera/stream/:cameraName', (req, res) => {
  const camName = req.params.cameraName;
  const targetUrl = `${CCTV_BASE}/camera/stream/${encodeURIComponent(camName)}`;
  const http = require('http');

  // Disable Express response buffering — critical for streaming
  res.setHeader('X-Accel-Buffering', 'no');

  const proxyReq = http.get(targetUrl, (proxyRes) => {
    // Forward all headers (crucially Content-Type: multipart/x-mixed-replace)
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'ngrok-skip-browser-warning': '1',  // Pass through so Ngrok doesn't inject HTML
      'X-Content-Type-Options': 'nosniff',
    });
    // Pipe the endless MJPEG stream directly — do NOT buffer
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.warn(`[CCTV Stream Proxy] Stream error for ${camName}:`, err.message);
    if (!res.headersSent) res.status(502).json({ error: 'CCTV stream unavailable', details: err.message });
  });

  // When the browser disconnects, kill the upstream connection
  req.on('close', () => proxyReq.destroy());
});


// GET /camera/snapshot/:cameraName  — single snapshot
app.get('/camera/snapshot/:cameraName', async (req, res) => {
  const camName = req.params.cameraName;
  const targetUrl = `${CCTV_BASE}/camera/snapshot/${encodeURIComponent(camName)}`;
  try {
    const http = require('http');
    const proxyReq = http.get(targetUrl, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      res.status(502).json({ error: 'CCTV service unreachable', details: err.message });
    });
    req.on('close', () => proxyReq.destroy());
  } catch (err) {
    res.status(500).json({ error: 'Camera proxy error', details: err.message });
  }
});

// POST /camera/enroll — forwards face enrollment to CCTV edge service
app.post('/camera/enroll', (req, res) => {
  const http = require('http');
  const targetUrl = new URL(`${CCTV_BASE}/enroll`);
  const proxyReq = http.request(targetUrl, {
    method: 'POST',
    headers: req.headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.warn('[CCTV Proxy] Enrollment forwarding error:', err.message);
    res.status(502).json({ error: 'CCTV service unreachable', details: err.message });
  });
  req.pipe(proxyReq);
});



// ─── GET /attendance ──────────────────────────────────────────────────────
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get('/attendance', requireApiKey, async (req, res) => {
  const date = (req.query.date || '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? req.query.date
    : new Date().toISOString().slice(0, 10);

  console.log(`[API] GET /attendance date=${date}`);

  try {
    const p = await getPool();

    // Determine target monthly log table (prioritize monthly DeviceLogs_8_2026 over main DeviceLogs)
    const [yStr, mStr] = date.split('-');
    const mNum = parseInt(mStr, 10);
    const mPad = mNum < 10 ? `0${mNum}` : `${mNum}`;

    const tblCheck = await p.request()
      .input('t1', sql.VarChar, `DeviceLogs_${mNum}_${yStr}`)
      .input('t2', sql.VarChar, `DeviceLogs_${mPad}_${yStr}`)
      .query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN (@t1, @t2)`);

    let logTable = 'DeviceLogs';
    if (tblCheck.recordset && tblCheck.recordset.length > 0) {
      logTable = tblCheck.recordset[0].TABLE_NAME;
    }

    console.log(`[API] Target table for ${date}: dbo.[${logTable}]`);

    // Check if Departments table exists
    let hasDepts = false;
    try {
      const chk = await p.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Departments'`);
      hasDepts = (chk.recordset && chk.recordset.length > 0);
    } catch (_) {}

    const selectDept = hasDepts ? `ISNULL(d.DepartmentFName, 'General')` : `'General'`;
    const joinDept   = hasDepts ? `LEFT JOIN dbo.Departments d WITH (NOLOCK) ON e.DepartmentId = d.DepartmentId` : ``;

    // Build multi-table UNION for finding LastPunchDate across recent monthly tables & main DeviceLogs
    const yNum = parseInt(yStr, 10);
    const prevMNum = mNum === 1 ? 12 : mNum - 1;
    const prevYStr = mNum === 1 ? String(yNum - 1) : yStr;
    const prevMPad = prevMNum < 10 ? `0${prevMNum}` : `${prevMNum}`;

    const candidateLpTables = [
      logTable,
      'DeviceLogs',
      `DeviceLogs_${mNum}_${yStr}`,
      `DeviceLogs_${mPad}_${yStr}`,
      `DeviceLogs_${prevMNum}_${prevYStr}`,
      `DeviceLogs_${prevMPad}_${prevYStr}`
    ];

    const tblCheckLp = await p.request().query(`
      SELECT DISTINCT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('${Array.from(new Set(candidateLpTables)).join("','")}')
    `).catch(() => ({ recordset: [{ TABLE_NAME: logTable }] }));

    const validLpTables = (tblCheckLp.recordset && tblCheckLp.recordset.length > 0)
      ? tblCheckLp.recordset.map(r => r.TABLE_NAME)
      : [logTable];

    const lpUnionSql = validLpTables.map(t => `
      SELECT LTRIM(RTRIM(CAST(UserId AS VARCHAR(50)))) AS EmployeeCode, LogDate 
      FROM dbo.[${t}] WITH (NOLOCK)
    `).join(' UNION ALL ');

    const targetDateObj = new Date(date);
    const nextDateObj = new Date(targetDateObj);
    nextDateObj.setDate(nextDateObj.getDate() + 1);
    const nextDateStr = nextDateObj.toISOString().split('T')[0];

    const prevDateObj = new Date(targetDateObj);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDateStr = prevDateObj.toISOString().split('T')[0];

    // EXACT SQL JOIN QUERY WITH OVERNIGHT NIGHT SHIFT ATTRIBUTION
    const req1 = p.request();
    req1.timeout = 25000;

    const queryResult = await req1.query(`
      SELECT 
        LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) AS empCode,
        e.EmployeeName                             AS empName,
        ${selectDept}                              AS department,
        ISNULL(e.Designation, 'Staff')             AS designation,
        CONVERT(VARCHAR(19), p.FirstInPunchOnDate, 120)  AS firstInPunchStr,
        CONVERT(VARCHAR(19), p.NightInPunchOnDate, 120)  AS nightInPunchStr,
        CONVERT(VARCHAR(19), p.LastOutPunchOnDate, 120)  AS lastOutPunchStr,
        CONVERT(VARCHAR(19), p.NextMorningOutPunch, 120) AS nextMorningOutPunchStr,
        CONVERT(VARCHAR(19), p.PrevNightInPunch, 120)   AS prevNightInPunchStr,
        p.FirstInPunchOnDate                       AS firstInPunch,
        p.NightInPunchOnDate                       AS nightInPunch,
        p.LastOutPunchOnDate                       AS lastOutPunch,
        p.NextMorningOutPunch                      AS nextMorningOutPunch,
        p.PrevNightInPunch                         AS prevNightInPunch,
        CONVERT(VARCHAR(19), lp.FirstEverPunchDate, 120) AS firstEverPunchDateStr,
        lp.FirstEverPunchDate                      AS firstEverPunchDate,
        lp.LastPunchDate                           AS lastPunchDate,
        DATEDIFF(day, lp.LastPunchDate, '${date}') AS daysSinceLastPunch
      FROM dbo.Employees e WITH (NOLOCK)
      ${joinDept}
      LEFT JOIN (
        SELECT 
          EmployeeCode,
          MIN(CASE WHEN LogDate >= '${date} 05:30:00' AND LogDate <= '${date} 23:59:59' THEN LogDate END) AS FirstInPunchOnDate,
          MIN(CASE WHEN LogDate >= '${date} 17:00:00' AND LogDate <= '${date} 23:59:59' THEN LogDate END) AS NightInPunchOnDate,
          MAX(CASE WHEN LogDate >= '${date} 00:00:00' AND LogDate <= '${date} 23:59:59' THEN LogDate END) AS LastOutPunchOnDate,
          MIN(CASE WHEN LogDate >= '${nextDateStr} 00:00:00' AND LogDate <= '${nextDateStr} 12:30:00' THEN LogDate END) AS NextMorningOutPunch,
          MAX(CASE WHEN LogDate >= '${prevDateStr} 17:00:00' AND LogDate <= '${prevDateStr} 23:59:59' THEN LogDate END) AS PrevNightInPunch
        FROM (
          ${lpUnionSql}
        ) AllPunches
        WHERE LogDate >= '${prevDateStr} 17:00:00' AND LogDate <= '${nextDateStr} 12:30:00'
        GROUP BY EmployeeCode
      ) p ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = p.EmployeeCode
      LEFT JOIN (
        SELECT 
          EmployeeCode,
          MIN(LogDate) AS FirstEverPunchDate,
          MAX(LogDate) AS LastPunchDate
        FROM (
          ${lpUnionSql}
        ) AllPunches
        GROUP BY EmployeeCode
      ) lp ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = lp.EmployeeCode
      WHERE ISNULL(e.RecordStatus, 1) = 1 
        AND ISNULL(e.Status, 'Working') NOT IN ('Resigned', 'Deleted', 'Inactive')
      ORDER BY e.EmployeeName
    `);

    const rows = queryResult.recordset || [];

    // ΓöÇΓöÇ 5-Tier Smart Site Auto-Assignment Engine ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const prefixSiteMap = new Map([
      ['17', 'Mahendra Aarna'],
      ['31', 'Brigade Cornerstone Utopia'],
      ['32', 'Brigade Cornerstone Utopia'],
      ['42', 'Purva Venezia'],
      ['77', 'Nikoo Homes'],
      ['78', 'Nikoo Homes'],
      ['70', 'Sobha Silicon Oasis'],
      ['79', 'Nikoo Paradigm'],
      ['80', 'Nikoo Paradigm'],
      ['99', 'Dsr Eden Greens'],
    ]);

    const getSmartSite = (code, dbSite) => {
      const siteStr = String(dbSite || '').trim();
      if (siteStr && siteStr !== 'General' && siteStr !== 'Default' && siteStr !== '—') {
        return { site: siteStr, isSmart: false };
      }

      const cleanCode = String(code || '').trim();
      if (cleanCode.startsWith('31') || cleanCode.startsWith('32')) {
        return { site: 'Brigade Cornerstone Utopia', isSmart: true };
      }
      if (cleanCode.length >= 3 && prefixSiteMap.has(cleanCode.slice(0, 3))) {
        return { site: prefixSiteMap.get(cleanCode.slice(0, 3)), isSmart: true };
      }
      if (cleanCode.startsWith('17')) return { site: 'Mahendra Aarna', isSmart: true };
      if (cleanCode.startsWith('42')) return { site: 'Purva Venezia', isSmart: true };
      if (cleanCode.startsWith('77') || cleanCode.startsWith('78')) return { site: 'Nikoo Homes', isSmart: true };
      if (cleanCode.startsWith('70')) return { site: 'Sobha Silicon Oasis', isSmart: true };
      if (cleanCode.startsWith('79') || cleanCode.startsWith('80')) return { site: 'Nikoo Paradigm', isSmart: true };
      if (cleanCode.startsWith('99')) return { site: 'Dsr Eden Greens', isSmart: true };

      return { site: 'Default', isSmart: false };
    };

    const employees = rows.map(row => {
      let inTimeStr = null;
      let outTimeStr = null;
      let status = 'Absent';
      let workingHours = '-';
      let shiftCompleted = false;

      const parseSqlStr = (str) => {
        if (!str) return null;
        const parts = String(str).trim().split(' ');
        if (parts.length < 2) return null;
        const dParts = parts[0].split('-').map(Number);
        const tParts = parts[1].split(':').map(Number);
        if (dParts.length < 3 || tParts.length < 3) return null;
        return {
          year: dParts[0],
          month: dParts[1] - 1,
          day: dParts[2],
          hours: tParts[0],
          minutes: tParts[1],
          seconds: tParts[2],
          timestamp: Date.UTC(dParts[0], dParts[1] - 1, dParts[2], tParts[0], tParts[1], tParts[2]),
        };
      };

      const firstIn = parseSqlStr(row.firstInPunchStr);
      const nightIn = parseSqlStr(row.nightInPunchStr);
      const lastOut = parseSqlStr(row.lastOutPunchStr);
      const nextMorningOut = parseSqlStr(row.nextMorningOutPunchStr);
      const prevNightIn = parseSqlStr(row.prevNightInPunchStr);

      // Determine effective IN and OUT punches cleanly
      let effectiveIn = null;
      let effectiveOut = null;

      if (firstIn) {
        if (firstIn.hours < 15 || (firstIn.hours < 17 && lastOut && lastOut.timestamp > firstIn.timestamp && Math.floor((lastOut.timestamp - firstIn.timestamp) / 60000) > 5)) {
          // Standard Morning / Day Punch IN
          effectiveIn = firstIn;
          if (lastOut && lastOut.timestamp > firstIn.timestamp) {
            const diffMins = Math.floor((lastOut.timestamp - firstIn.timestamp) / 60000);
            if (diffMins > 5) {
              effectiveOut = lastOut;
            }
          }
        } else if (firstIn.hours >= 15) {
          // Evening Punch (>= 15:30 / 3:30 PM)
          if (nextMorningOut) {
            // Night shift starting today
            effectiveIn = firstIn;
            effectiveOut = nextMorningOut;
          } else if (lastOut && lastOut.timestamp > firstIn.timestamp) {
            const diffMins = Math.floor((lastOut.timestamp - firstIn.timestamp) / 60000);
            if (diffMins > 5) {
              effectiveIn = firstIn;
              effectiveOut = lastOut;
            } else {
              // Single evening punch without morning punch -> Missed Punch IN (this punch is OUT time)
              effectiveOut = firstIn;
            }
          } else {
            // Single evening punch without morning punch -> Missed Punch IN (this punch is OUT time)
            effectiveOut = firstIn;
          }
        } else {
          effectiveIn = firstIn;
        }
      } else if (nightIn) {
        if (nextMorningOut) {
          effectiveIn = nightIn;
          effectiveOut = nextMorningOut;
        } else {
          effectiveOut = nightIn;
        }
      }

      if (effectiveIn || effectiveOut) {
        if (effectiveIn) {
          const inH = effectiveIn.hours;
          const inM = effectiveIn.minutes;
          const inAmpm = inH >= 12 ? 'pm' : 'am';
          const displayInH = inH % 12 === 0 ? 12 : inH % 12;
          inTimeStr = `${String(displayInH).padStart(2, '0')}:${String(inM).padStart(2, '0')} ${inAmpm}`;
        }

        if (effectiveOut) {
          const outH = effectiveOut.hours;
          const outM = effectiveOut.minutes;
          const outAmpm = outH >= 12 ? 'pm' : 'am';
          const displayOutH = outH % 12 === 0 ? 12 : outH % 12;
          outTimeStr = `${String(displayOutH).padStart(2, '0')}:${String(outM).padStart(2, '0')} ${outAmpm}`;
        }

        if (effectiveIn && effectiveOut) {
          const diffMs = effectiveOut.timestamp - effectiveIn.timestamp;
          if (diffMs > 0) {
            const totalMins = Math.floor(diffMs / 60000);
            const h = Math.floor(totalMins / 60);
            const m = totalMins % 60;
            workingHours = `${h}h ${String(m).padStart(2, '0')}m`;
            if (totalMins >= 360) shiftCompleted = true;
          }
          status = 'Present';
        } else if (effectiveIn && !effectiveOut) {
          status = 'Present';
        } else if (!effectiveIn && effectiveOut) {
          status = 'Missed Punch IN';
        }
      }

      const smartSiteInfo = getSmartSite(row.empCode, row.department);

      const daysSince = row.daysSinceLastPunch !== undefined && row.daysSinceLastPunch !== null ? Number(row.daysSinceLastPunch) : 9999;
      const firstEverDateStr = row.firstEverPunchDateStr ? String(row.firstEverPunchDateStr).slice(0, 10) : null;

      let lifecycleStatus = 'Regular';
      if (firstEverDateStr && date < firstEverDateStr) {
        status = 'Not Joined Yet';
        lifecycleStatus = 'Not Joined Yet';
      } else if (firstEverDateStr && firstEverDateStr.slice(0, 7) === date.slice(0, 7)) {
        lifecycleStatus = 'New Joinee';
      }

      if (status === 'Absent' && daysSince > 14 && daysSince < 9000) {
        status = 'Discontinued / Left';
        lifecycleStatus = 'Discontinued';
      }

      const isActiveEmployee = status === 'Present' || (row.lastPunchDate && daysSince <= 25 && status !== 'Not Joined Yet' && status !== 'Discontinued / Left');

      return {
        empCode: String(row.empCode || ''),
        empName: String(row.empName || 'Employee'),
        department: smartSiteInfo.site,
        designation: String(row.designation || 'Staff'),
        inTime: inTimeStr,
        outTime: outTimeStr,
        workingHours,
        status,
        shiftCompleted,
        lateMinutes: 0,
        hadPrevNightShift: Boolean(row.prevNightInPunch),
        lifecycleStatus,
        firstEverPunchDate: firstEverDateStr,
        isSmartSite: smartSiteInfo.isSmart,
        isActiveEmployee,
        daysSinceLastPunch: daysSince,
      };
    });

    // Query raw distinct device punches for today to reflect full device scan count
    const presentRawCountRes = await p.request().query(`
      SELECT COUNT(DISTINCT UserId) AS rawPresentCount 
      FROM dbo.[${logTable}] WITH (NOLOCK) 
      WHERE LogDate >= '${date} 00:00:00' AND LogDate <= '${date} 23:59:59'
    `).catch(() => ({ recordset: [] }));

    const rawPresentCount = (presentRawCountRes.recordset && presentRawCountRes.recordset[0]) 
      ? Number(presentRawCountRes.recordset[0].rawPresentCount || 0) 
      : 0;

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.isActiveEmployee !== false);
    const activeTotal = activeEmployees.length;
    const inactiveTotal = totalEmployees - activeTotal;

    const present = Math.max(rawPresentCount, employees.filter(e => e.status === 'Present').length);
    const absent = Math.max(0, activeTotal - present);

    // Site Breakdown
    const deptMap = new Map();
    employees.forEach(e => {
      const site = e.department || 'General';
      if (!deptMap.has(site)) {
        deptMap.set(site, { total: 0, present: 0 });
      }
      const item = deptMap.get(site);
      item.total += 1;
      if (e.status === 'Present') {
        item.present += 1;
      }
    });

    const departments = Array.from(deptMap.entries()).map(([name, stat]) => ({
      name,
      present: stat.present,
      total: stat.total,
    })).sort((a, b) => b.total - a.total);

    // ΓöÇΓöÇ Build 7-Day Attendance Trend (Multi-Month UNION ALL Engine) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const trendMap = new Map();
    const datesList = [];

    try {
      const targetDateObj = new Date(date);
      for (let i = 6; i >= 0; i--) {
        const d = new Date(targetDateObj);
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().slice(0, 10);
        datesList.push(dStr);
        trendMap.set(dStr, 0);
      }

      const startDate7Days = datesList[0];
      const endDate7Days   = datesList[datesList.length - 1];

      // Collect all monthly table names involved in the 7-day window
      const candidateTables = new Set([logTable, 'DeviceLogs']);
      for (const dStr of datesList) {
        const [yStr, mStr] = dStr.split('-');
        const mNum = parseInt(mStr, 10);
        const mPad = mNum < 10 ? `0${mNum}` : `${mNum}`;
        candidateTables.add(`DeviceLogs_${mNum}_${yStr}`);
        candidateTables.add(`DeviceLogs_${mPad}_${yStr}`);
      }

      const tblNamesArray = Array.from(candidateTables);
      const reqTrendTbl = p.request();
      tblNamesArray.forEach((t, idx) => reqTrendTbl.input(`t${idx}`, sql.VarChar, t));

      const existingTblsRes = await reqTrendTbl.query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME IN (${tblNamesArray.map((_, idx) => `@t${idx}`).join(',')})
      `);

      const validTables = (existingTblsRes.recordset || []).map(r => r.TABLE_NAME);

      if (validTables.length > 0) {
        const unionSql = validTables.map(tbl => `
          SELECT LTRIM(RTRIM(CAST(UserId AS VARCHAR(50)))) AS UserId, LogDate 
          FROM dbo.[${tbl}] WITH (NOLOCK)
          WHERE LogDate >= '${startDate7Days} 00:00:00' AND LogDate <= '${endDate7Days} 23:59:59'
        `).join(' UNION ALL ');

        const finalTrendSql = `
          WITH AllPunches AS (
            ${unionSql}
          )
          SELECT 
            CONVERT(VARCHAR(10), LogDate, 120) AS logDate,
            COUNT(DISTINCT UserId) AS presentCount
          FROM AllPunches
          GROUP BY CONVERT(VARCHAR(10), LogDate, 120)
        `;

        const reqTrendExec = p.request();
        reqTrendExec.timeout = 15000;
        const trendQueryRes = await reqTrendExec.query(finalTrendSql).catch(e => {
          console.warn('[API] Trend UNION query warning:', e.message);
          return { recordset: [] };
        });

        if (trendQueryRes.recordset) {
          trendQueryRes.recordset.forEach(r => {
            const rawVal = r.logDate || r.LOGDATE || r.logdate || r.LogDate;
            let dateKey = null;

            if (typeof rawVal === 'string') {
              dateKey = rawVal.trim().slice(0, 10);
            } else if (rawVal instanceof Date) {
              const y = rawVal.getFullYear();
              const m = String(rawVal.getMonth() + 1).padStart(2, '0');
              const d = String(rawVal.getDate()).padStart(2, '0');
              dateKey = `${y}-${m}-${d}`;
            }

            const pCnt = Number(r.presentCount || r.PRESENTCOUNT || r.presentcount) || 0;

            if (dateKey && trendMap.has(dateKey)) {
              trendMap.set(dateKey, pCnt);
            }
          });
          console.log('[API] Trend Map Data:', Array.from(trendMap.entries()));
        }
      }
    } catch (trendErr) {
      console.warn('[API] Trend query warning:', trendErr.message);
    }

    const trend = datesList.map(dStr => {
      const pCount = trendMap.get(dStr) || 0;
      const aCount = Math.max(0, activeTotal - pCount);
      const parts = dStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dObj = new Date(year, month, day);

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedDate = `${String(day).padStart(2, '0')} ${monthNames[month] || ''}`;

      return {
        date: formattedDate,
        present: pCount,
        absent: aCount,
        attendanceRate: activeTotal > 0 ? Math.round((pCount / activeTotal) * 100) : 0,
      };
    });

    console.log(`[API] Γ£à Success: Total=${totalEmployees}, Present=${present}, Absent=${absent}, TrendItems=${trend.length}`);

    return res.json({
      summary: {
        date,
        totalEmployees: activeTotal,
        totalHeadcount: totalEmployees,
        activeTotal,
        inactiveTotal,
        present,
        absent,
        late: 0,
        onTime: present,
        attendanceRate: activeTotal > 0 ? Math.round((present / activeTotal) * 100) : 0,
      },
      employees,
      trend,
      departments,
      lastUpdated: new Date().toISOString(),
      connectionStatus: 'connected',
    });

  } catch (err) {
    console.error('[API] /attendance error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /attendance-report — Multi-day / Monthly Report Matrix ───────────
app.get(['/attendance-report', '/api/attendance-report'], requireApiKey, async (req, res) => {
  const startDate = (req.query.startDate || '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? req.query.startDate
    : new Date().toISOString().slice(0, 8) + '01';
  const endDate = (req.query.endDate || '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? req.query.endDate
    : new Date().toISOString().slice(0, 10);
  const siteFilter = (req.query.site || req.query.siteId || 'all').trim();
  const empCodeFilter = (req.query.empCode || '').trim();

  console.log(`[API] GET /attendance-report range=${startDate} to ${endDate}, site=${siteFilter}, emp=${empCodeFilter || 'all'}`);

  try {
    const p = await getPool();

    // Check if Departments table exists
    let hasDepts = false;
    try {
      const chk = await p.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Departments'`);
      hasDepts = (chk.recordset && chk.recordset.length > 0);
    } catch (_) {}

    const selectDept = hasDepts ? `ISNULL(d.DepartmentFName, 'General')` : `'General'`;
    const joinDept   = hasDepts ? `LEFT JOIN dbo.Departments d WITH (NOLOCK) ON e.DepartmentId = d.DepartmentId` : ``;

    const reqReport = p.request();
    reqReport.input('startDate', sql.VarChar, startDate);
    reqReport.input('endDate', sql.VarChar, endDate);

    let extraEmpClause = '';
    if (empCodeFilter) {
      reqReport.input('empCodeFilter', sql.VarChar, empCodeFilter);
      extraEmpClause = `AND LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = @empCodeFilter`;
    }

    // Query dbo.AttendanceLogs joined with dbo.Employees
    const attSql = `
      SELECT 
        LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) AS empCode,
        e.EmployeeName AS empName,
        ${selectDept} AS department,
        ISNULL(e.Designation, 'Staff') AS designation,
        CONVERT(VARCHAR(10), a.AttendanceDate, 120) AS dateStr,
        CASE 
          WHEN a.InTime IS NULL OR a.InTime = '1900-01-01 00:00:00' THEN NULL 
          ELSE CONVERT(VARCHAR(8), a.InTime, 108) 
        END AS inTime,
        CASE 
          WHEN a.OutTime IS NULL OR a.OutTime = '1900-01-01 00:00:00' THEN NULL 
          ELSE CONVERT(VARCHAR(8), a.OutTime, 108) 
        END AS outTime,
        ISNULL(a.Duration, 0) AS durationMins,
        ISNULL(a.LateBy, 0) AS lateMinutes,
        ISNULL(a.OverTime, 0) AS otMinutes,
        LTRIM(RTRIM(ISNULL(a.Status, 'Absent'))) AS status,
        LTRIM(RTRIM(ISNULL(a.StatusCode, 'A'))) AS statusCode,
        ISNULL(a.WeeklyOff, 0) AS isWeeklyOff,
        ISNULL(a.Holiday, 0) AS isHoliday,
        ISNULL(a.Present, 0) AS isPresent,
        ISNULL(a.Absent, 0) AS isAbsent,
        ISNULL(a.PunchRecords, '') AS punchRecords
      FROM dbo.Employees e WITH (NOLOCK)
      ${joinDept}
      JOIN dbo.AttendanceLogs a WITH (NOLOCK) 
        ON e.EmployeeId = a.EmployeeId 
       AND a.AttendanceDate >= @startDate 
       AND a.AttendanceDate <= @endDate
      WHERE ISNULL(e.RecordStatus, 1) = 1 
        AND ISNULL(e.Status, 'Working') NOT IN ('Resigned', 'Deleted', 'Inactive')
        ${extraEmpClause}
      ORDER BY e.EmployeeName, a.AttendanceDate
    `;

    const reportRes = await reqReport.query(attSql);
    let rows = reportRes.recordset || [];

    // Prefix-based smart site mapper
    const prefixSiteMap = new Map([
      ['17', 'Mahendra Aarna'],
      ['31', 'Brigade Cornerstone Utopia'],
      ['32', 'Brigade Cornerstone Utopia'],
      ['42', 'Purva Venezia'],
      ['77', 'Nikoo Homes'],
      ['78', 'Nikoo Homes'],
      ['70', 'Sobha Silicon Oasis'],
      ['79', 'Nikoo Paradigm'],
      ['80', 'Nikoo Paradigm'],
      ['99', 'Dsr Eden Greens'],
    ]);

    const resolveSite = (code, dbSite) => {
      const s = String(dbSite || '').trim();
      if (s && s !== 'General' && s !== 'Default' && s !== '—') return s;
      const c = String(code || '').trim();
      if (c.startsWith('31') || c.startsWith('32')) return 'Brigade Cornerstone Utopia';
      if (c.length >= 3 && prefixSiteMap.has(c.slice(0, 3))) return prefixSiteMap.get(c.slice(0, 3));
      if (c.startsWith('17')) return 'Mahendra Aarna';
      if (c.startsWith('42')) return 'Purva Venezia';
      if (c.startsWith('77') || c.startsWith('78')) return 'Nikoo Homes';
      if (c.startsWith('70')) return 'Sobha Silicon Oasis';
      if (c.startsWith('79') || c.startsWith('80')) return 'Nikoo Paradigm';
      if (c.startsWith('99')) return 'Dsr Eden Greens';
      return 'Default';
    };

    // If dbo.AttendanceLogs has 0 rows for this site/range (common before desktop recalculation),
    // query authoritative raw biometric punch tables (dbo.DeviceLogs_M_YYYY)
    const siteMatches = (code, dept) => {
      if (siteFilter === 'all' || !siteFilter) return true;
      const s = resolveSite(code, dept).toLowerCase();
      const target = siteFilter.toLowerCase();
      const isUtopia = target.includes('utopia') && (String(code).startsWith('31') || String(code).startsWith('32'));
      return s.includes(target) || target.includes(s) || isUtopia;
    };

    const siteMatchedRows = rows.filter(r => siteMatches(r.empCode, r.department));
    if (siteMatchedRows.length === 0) {
      console.log(`[API] AttendanceLogs has 0 records for site='${siteFilter}'. Querying DeviceLogs tables directly...`);
      const [syStr, smStr] = startDate.split('-');
      const [eyStr, emStr] = endDate.split('-');
      const candidateTables = new Set(['DeviceLogs']);

      const sM = parseInt(smStr, 10);
      const eM = parseInt(emStr, 10);
      const sY = parseInt(syStr, 10);
      const eY = parseInt(eyStr, 10);

      for (let y = sY; y <= eY; y++) {
        const startMonth = (y === sY) ? sM : 1;
        const endMonth = (y === eY) ? eM : 12;
        for (let m = startMonth; m <= endMonth; m++) {
          const mPad = m < 10 ? `0${m}` : `${m}`;
          candidateTables.add(`DeviceLogs_${m}_${y}`);
          candidateTables.add(`DeviceLogs_${mPad}_${y}`);
        }
      }

      const tblNamesArray = Array.from(candidateTables);
      const reqTbl = p.request();
      tblNamesArray.forEach((t, idx) => reqTbl.input(`t${idx}`, sql.VarChar, t));

      const existingTblsRes = await reqTbl.query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME IN (${tblNamesArray.map((_, idx) => `@t${idx}`).join(',')})
      `).catch(() => ({ recordset: [] }));

      const validTables = (existingTblsRes.recordset || []).map(r => r.TABLE_NAME);
      if (validTables.length > 0) {
        const unionSql = validTables.map(tbl => `
          SELECT LTRIM(RTRIM(CAST(UserId AS VARCHAR(50)))) AS empCode, LogDate 
          FROM dbo.[${tbl}] WITH (NOLOCK)
          WHERE LogDate >= '${startDate} 00:00:00' AND LogDate <= '${endDate} 23:59:59'
        `).join(' UNION ALL ');

        const rawPunchesSql = `
          WITH RawPunches AS (
            ${unionSql}
          ),
          DailyAgg AS (
            SELECT 
              empCode,
              CONVERT(VARCHAR(10), LogDate, 120) AS dateStr,
              MIN(LogDate) AS inPunch,
              MAX(LogDate) AS outPunch,
              COUNT(*) AS punchCount
            FROM RawPunches
            GROUP BY empCode, CONVERT(VARCHAR(10), LogDate, 120)
          )
          SELECT 
            LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) AS empCode,
            e.EmployeeName AS empName,
            ${selectDept} AS department,
            ISNULL(e.Designation, 'Staff') AS designation,
            d.dateStr,
            CONVERT(VARCHAR(8), d.inPunch, 108) AS inTime,
            CASE WHEN d.punchCount > 1 THEN CONVERT(VARCHAR(8), d.outPunch, 108) ELSE NULL END AS outTime,
            DATEDIFF(minute, d.inPunch, d.outPunch) AS durationMins,
            0 AS lateMinutes,
            0 AS otMinutes,
            'Present' AS status,
            'P' AS statusCode,
            0 AS isWeeklyOff,
            0 AS isHoliday,
            1 AS isPresent,
            0 AS isAbsent
          FROM DailyAgg d
          JOIN dbo.Employees e WITH (NOLOCK) ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = d.empCode
          ${joinDept}
          WHERE ISNULL(e.RecordStatus, 1) = 1 
            AND ISNULL(e.Status, 'Working') NOT IN ('Resigned', 'Deleted', 'Inactive')
            ${extraEmpClause}
          ORDER BY e.EmployeeName, d.dateStr
        `;

        const rawRes = await p.request().query(rawPunchesSql).catch((err) => {
          console.error('[API] DeviceLogs query error:', err.message);
          return { recordset: [] };
        });
        if (rawRes.recordset && rawRes.recordset.length > 0) {
          rows = rawRes.recordset;
          console.log(`[API] DeviceLogs fallback retrieved ${rows.length} biometric daily punch records.`);
        }
      }
    }

    const records = {};
    for (const r of rows) {
      const code = r.empCode;
      const site = resolveSite(code, r.department);

      // Site filter if specified
      if (siteFilter !== 'all' && siteFilter !== '') {
        const target = siteFilter.toLowerCase().trim();
        const current = site.toLowerCase().trim();
        const isUtopia = target.includes('utopia') && (String(code).startsWith('31') || String(code).startsWith('32'));
        if (!current.includes(target) && !target.includes(current) && !isUtopia) {
          continue;
        }
      }

      if (!records[code]) {
        records[code] = {
          empCode: code,
          empName: r.empName,
          department: site,
          designation: r.designation,
          days: {},
          summary: {
            presentDays: 0,
            absentDays: 0,
            woDays: 0,
            lateDays: 0,
            totalNetMins: 0,
            totalOtMins: 0,
          }
        };
      }

      const isP = r.statusCode === 'P' || r.isPresent === 1 || r.status.toLowerCase().includes('present');
      const isWO = r.isWeeklyOff === 1 || r.statusCode === 'WO' || r.status.toLowerCase().includes('weekly');
      const isA = r.isAbsent === 1 || r.statusCode === 'A' || r.status.toLowerCase().includes('absent');

      let finalStatus = 'A';
      if (isP) finalStatus = 'P';
      else if (isWO) finalStatus = 'WO';
      else if (isA) finalStatus = 'A';
      else if (r.statusCode) finalStatus = r.statusCode;

      if (isP) records[code].summary.presentDays++;
      else if (isWO) records[code].summary.woDays++;
      else if (isA) records[code].summary.absentDays++;

      if (r.lateMinutes > 0) records[code].summary.lateDays++;
      records[code].summary.totalNetMins += r.durationMins || 0;
      records[code].summary.totalOtMins += r.otMinutes || 0;

      const inTimeClean = r.inTime ? r.inTime.slice(0, 5) : '—';
      const outTimeClean = r.outTime ? r.outTime.slice(0, 5) : '—';
      const h = Math.floor(r.durationMins / 60);
      const m = r.durationMins % 60;
      const hoursFormatted = r.durationMins > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : '—';

      records[code].days[r.dateStr] = {
        dateStr: r.dateStr,
        inTime: inTimeClean,
        outTime: outTimeClean,
        hours: hoursFormatted,
        durationMins: r.durationMins,
        netMins: r.durationMins,
        otMins: r.otMinutes,
        lateMinutes: r.lateMinutes,
        status: finalStatus,
        isWeeklyOff: isWO,
        punchRecords: r.punchRecords,
      };
    }

    const empList = Object.values(records);
    return res.json({
      success: true,
      startDate,
      endDate,
      site: siteFilter,
      totalEmployees: empList.length,
      records,
      employees: empList,
      lastUpdated: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[API] /attendance-report error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ΓöÇΓöÇΓöÇ GET /tables ΓÇö helper to discover your DB schema ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get('/tables', requireApiKey, async (req, res) => {
  try {
    const p = await getPool();
    const result = await p.request().query(`
      SELECT TABLE_NAME,
             (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c WHERE c.TABLE_NAME = t.TABLE_NAME) AS col_count
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    res.json({ tables: result.recordset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ΓöÇΓöÇΓöÇ GET /devices ΓÇö biometric device status ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// Tries multiple table names used by different eTimeTrack versions (dbo.Devices, dbo.iclock_Device, etc.)
app.get('/devices', requireApiKey, async (req, res) => {
  const p = await getPool();

  const queries = [
    // 1. eTimeTrackLite Web / Desktop Devices table with exact schema
    `SELECT
       DeviceId,
       ISNULL(SerialNumber, '') AS serialNo,
       ISNULL(DeviceFName, SerialNumber) AS deviceName,
       ISNULL(DeviceLocation, '') AS location,
       CONVERT(VARCHAR(19), LastPing, 120) AS lastPing,
       CASE WHEN LastPing IS NOT NULL AND DATEDIFF(MINUTE, LastPing, GETDATE()) <= 60 THEN 'online' ELSE 'offline' END AS status
     FROM dbo.Devices WITH (NOLOCK)
     ORDER BY DeviceFName`,

    // 2. Devices table with alternative column names
    `SELECT
       DeviceId,
       CAST(DeviceId AS VARCHAR) AS serialNo,
       CAST(DeviceId AS VARCHAR) AS deviceName,
       '' AS location,
       NULL AS lastPing,
       'offline' AS status
     FROM dbo.Devices WITH (NOLOCK)`,

    // 3. Standard eSSL eTimeTrackLite iclock_Device table
    `SELECT
       DeviceId, SN AS serialNo,
       ISNULL(Alias, SN) AS deviceName,
       ISNULL(Location, '') AS location,
       CONVERT(VARCHAR(19), LastActivity, 120) AS lastPing,
       CASE WHEN DATEDIFF(MINUTE, LastActivity, GETDATE()) <= 30 THEN 'online' ELSE 'offline' END AS status
     FROM dbo.iclock_Device WITH (NOLOCK)
     ORDER BY deviceName`,

    // 4. iclock_Device variant
    `SELECT
       DeviceId, SerialNo AS serialNo,
       ISNULL(DeviceName, SerialNo) AS deviceName,
       ISNULL(Location, '') AS location,
       CONVERT(VARCHAR(19), LastPing, 120) AS lastPing,
       CASE WHEN DATEDIFF(MINUTE, LastPing, GETDATE()) <= 30 THEN 'online' ELSE 'offline' END AS status
     FROM dbo.iclock_Device WITH (NOLOCK)
     ORDER BY deviceName`,

    // 5. iclock_terminal table
    `SELECT
       id AS DeviceId, sn AS serialNo,
       ISNULL(alias, sn) AS deviceName,
       ISNULL(area_name, '') AS location,
       CONVERT(VARCHAR(19), last_activity, 120) AS lastPing,
       CASE WHEN DATEDIFF(MINUTE, last_activity, GETDATE()) <= 30 THEN 'online' ELSE 'offline' END AS status
     FROM dbo.iclock_terminal WITH (NOLOCK)
     ORDER BY deviceName`,
  ];

  for (const q of queries) {
    try {
      const result = await p.request().query(q);
      if (result.recordset) {
        const devices = result.recordset.map(r => ({
          deviceId:   r.DeviceId,
          serialNo:   r.serialNo,
          deviceName: r.deviceName,
          location:   r.location,
          lastPing:   r.lastPing,
          status:     r.status === 'online' ? 'online' : 'offline',
        }));
        const online  = devices.filter(d => d.status === 'online').length;
        const offline = devices.filter(d => d.status === 'offline').length;
        return res.json({ devices, online, offline, total: devices.length });
      }
    } catch (_) { /* try next query */ }
  }

  res.json({ devices: [], online: 0, offline: 0, total: 0, note: 'Device table not found ΓÇö check /tables' });
});



// ΓöÇΓöÇΓöÇ GET /diagnose ΓÇö full data health check for today ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get('/diagnose', requireApiKey, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const p = await getPool();

    // Try to safely run each metric
    const safe = async (label, query) => {
      try {
        const r = await p.request().query(query);
        return { label, value: r.recordset[0]?.value ?? r.recordset[0]?.cnt ?? '?', ok: true };
      } catch (e) {
        return { label, value: null, error: e.message, ok: false };
      }
    };

    const metrics = await Promise.all([
      safe('Total Active Employees',  `SELECT COUNT(*) AS value FROM dbo.Employees WHERE IsActive = 1`),
      safe('DeviceLogs today',        `SELECT COUNT(*) AS value FROM dbo.DeviceLogs WHERE CAST(LogDate AS DATE) = CAST(GETDATE() AS DATE)`),
      safe('AttendanceLogs today',    `SELECT COUNT(*) AS value FROM dbo.AttendanceLogs WHERE CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE)`),
      safe('Present (P) today',       `SELECT COUNT(*) AS value FROM dbo.AttendanceLogs WHERE CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE) AND Status = 'P'`),
      safe('Late (L) today',          `SELECT COUNT(*) AS value FROM dbo.AttendanceLogs WHERE CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE) AND Status = 'L'`),
      safe('Absent (A) today',        `SELECT COUNT(*) AS value FROM dbo.AttendanceLogs WHERE CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE) AND Status = 'A'`),
      safe('Sample InTime (att)',     `SELECT TOP 1 CONVERT(VARCHAR,InTime,108) AS value FROM dbo.AttendanceLogs WHERE InTime IS NOT NULL`),
      safe('Sample LogDate (device)', `SELECT TOP 1 CONVERT(VARCHAR,LogDate,120) AS value FROM dbo.DeviceLogs ORDER BY LogDate DESC`),
    ]);

    // Sample top 5 device punches today
    const samplePunches = await p.request().query(`
      SELECT TOP 5 UserId, CONVERT(VARCHAR, LogDate, 120) AS LogDate
      FROM dbo.DeviceLogs
      WHERE CAST(LogDate AS DATE) = CAST(GETDATE() AS DATE)
      ORDER BY LogDate DESC
    `).catch(e => ({ recordset: [{ error: e.message }] }));

    res.json({
      serverTime: new Date().toISOString(),
      diagnosticsFor: today,
      metrics,
      sampleDevicePunches: samplePunches.recordset,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ΓöÇΓöÇΓöÇ GET /columns/:table ΓÇö get columns of a specific table ΓöÇΓöÇΓöÇΓöÇ
app.get('/columns/:table', requireApiKey, async (req, res) => {
  try {
    const p = await getPool();
    const r = p.request();
    r.input('tbl', sql.NVarChar, req.params.table);
    const result = await r.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tbl
      ORDER BY ORDINAL_POSITION
    `);
    res.json({ table: req.params.table, columns: result.recordset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ΓöÇΓöÇΓöÇ Start ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// ─── POST /update-employee — Update employee details in MS SQL ───────
app.post('/update-employee', requireApiKey, async (req, res) => {
  const { empCode, empName, siteName, designation } = req.body;
  if (!empCode) {
    return res.status(400).json({ error: 'empCode is required' });
  }

  try {
    const p = await getPool();
    const r = p.request();
    r.input('empCode', sql.VarChar, String(empCode).trim());
    r.input('empName', sql.VarChar, String(empName || '').trim());
    r.input('siteName', sql.VarChar, String(siteName || '').trim());
    r.input('desig', sql.VarChar, String(designation || '').trim());

    const query = `
      UPDATE e
      SET 
        e.EmployeeName = CASE WHEN @empName <> '' THEN @empName ELSE e.EmployeeName END,
        e.Designation = CASE WHEN @desig <> '' THEN @desig ELSE e.Designation END,
        e.DepartmentId = ISNULL(
          (SELECT TOP 1 DepartmentId FROM dbo.Departments WHERE DepartmentFName = @siteName OR DepartmentSName = @siteName),
          e.DepartmentId
        )
      FROM dbo.Employees e
      WHERE LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = @empCode;
    `;

    const result = await r.query(query);
    console.log(`[API] Updated employee ${empCode} in MS SQL. Rows affected:`, result.rowsAffected);
    res.json({ success: true, empCode, rowsAffected: result.rowsAffected[0] || 0 });
  } catch (err) {
    console.error('[API] Failed to update MS SQL employee:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
//  SUPABASE SYNC SYSTEM — MS SQL → Supabase Attendance Cache
//  Keeps current-year records hot in Supabase so frontend works even
//  when the Cloudflare tunnel to this machine is offline.
//  Auto-syncs every 5 minutes. Cleans up old years on Jan 1.
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL         = process.env.SUPABASE_URL         || 'https://fmyafuhxlorbafbacywa.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Push an array of row objects to Supabase attendance_cache with UPSERT (Chunked in batches of 300) */
async function upsertToSupabase(rows) {
  if (!SUPABASE_SERVICE_KEY) {
    console.warn('[Sync] SUPABASE_SERVICE_ROLE_KEY not set — skipping Supabase upsert');
    return { count: 0, skipped: true };
  }
  if (!rows || rows.length === 0) return { count: 0 };

  const CHUNK_SIZE = 300;
  let totalUpserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/attendance_cache?on_conflict=emp_code,attendance_date`, {
      method: 'POST',
      headers: {
        apikey:          SUPABASE_SERVICE_KEY,
        Authorization:   `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type':  'application/json',
        Prefer:          'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText);
      throw new Error(`Supabase upsert failed (${response.status}): ${err}`);
    }
    totalUpserted += chunk.length;
  }

  return { count: totalUpserted };
}

/** Log a sync run to attendance_sync_log */
async function logSync(syncDate, recordsSynced, status, errorMsg, durationMs, triggeredBy) {
  if (!SUPABASE_SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/attendance_sync_log`, {
      method: 'POST',
      headers: {
        apikey:         SUPABASE_SERVICE_KEY,
        Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({
        sync_date:       syncDate,
        records_synced:  recordsSynced,
        status:          status,
        error_msg:       errorMsg || null,
        duration_ms:     durationMs,
        triggered_by:    triggeredBy || 'auto',
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.warn('[Sync] Failed to write sync log:', e.message);
  }
}

/** Fetch single-day attendance from MS SQL and return formatted rows ready for Supabase */
async function fetchAttendanceRowsForDate(date) {
  const p = await getPool();

  const [yStr, mStr] = date.split('-');
  const mNum = parseInt(mStr, 10);
  const mPad = mNum < 10 ? `0${mNum}` : `${mNum}`;

  // Find the right partition table
  const tblCheck = await p.request()
    .input('t1', sql.VarChar, `DeviceLogs_${mNum}_${yStr}`)
    .input('t2', sql.VarChar, `DeviceLogs_${mPad}_${yStr}`)
    .query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN (@t1, @t2)`)
    .catch(() => ({ recordset: [] }));

  const logTable = (tblCheck.recordset && tblCheck.recordset.length > 0)
    ? tblCheck.recordset[0].TABLE_NAME
    : 'DeviceLogs';

  // Check if Departments table exists
  const deptCheck = await p.request()
    .query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Departments'`)
    .catch(() => ({ recordset: [] }));
  const hasDepts = deptCheck.recordset && deptCheck.recordset.length > 0;

  const selectDept = hasDepts ? `ISNULL(d.DepartmentFName, 'General')` : `'General'`;
  const joinDept   = hasDepts ? `LEFT JOIN dbo.Departments d WITH (NOLOCK) ON e.DepartmentId = d.DepartmentId` : ``;

  const nextDateStr = new Date(new Date(date).getTime() + 86400000).toISOString().slice(0, 10);
  const prevDateStr = new Date(new Date(date).getTime() - 86400000).toISOString().slice(0, 10);

  // Check if AttendanceLogs table exists
  const alCheck = await p.request()
    .query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AttendanceLogs'`)
    .catch(() => ({ recordset: [] }));
  const hasAttendanceLogs = alCheck.recordset && alCheck.recordset.length > 0;

  const selectAl = hasAttendanceLogs
    ? `al.InTime AS alInTime, al.OutTime AS alOutTime, al.Duration AS duration, al.LateBy AS lateBy, al.OverTime AS overTime, al.Status AS alStatus`
    : `NULL AS alInTime, NULL AS alOutTime, 0 AS duration, 0 AS lateBy, 0 AS overTime, NULL AS alStatus`;

  const joinAl = hasAttendanceLogs
    ? `LEFT JOIN dbo.AttendanceLogs al WITH (NOLOCK) ON al.EmployeeId = e.EmployeeId AND CONVERT(date, al.AttendanceDate) = '${date}'`
    : ``;

  const candidateLpTables = Array.from(new Set([logTable, 'DeviceLogs']));
  const tblCheckLp = await p.request().query(`
    SELECT DISTINCT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME IN ('${candidateLpTables.join("','")}')
  `).catch(() => ({ recordset: [{ TABLE_NAME: logTable }] }));

  const validLpTables = (tblCheckLp.recordset && tblCheckLp.recordset.length > 0)
    ? tblCheckLp.recordset.map(r => r.TABLE_NAME)
    : [logTable];

  const lpUnionSql = validLpTables.map(t => `
    SELECT LTRIM(RTRIM(CAST(UserId AS VARCHAR(50)))) AS EmployeeCode, LogDate 
    FROM dbo.[${t}] WITH (NOLOCK)
  `).join(' UNION ALL ');

  const req1 = p.request();
  req1.timeout = 60000;

  const result = await req1.query(`
    SELECT
      LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) AS empCode,
      e.EmployeeName                                     AS empName,
      ${selectDept}                                      AS department,
      ISNULL(e.Designation, 'Staff')                     AS designation,
      CONVERT(VARCHAR(19), p.FirstInPunchOnDate, 120)    AS firstInPunchStr,
      CONVERT(VARCHAR(19), p.NightInPunchOnDate, 120)    AS nightInPunchStr,
      CONVERT(VARCHAR(19), p.LastOutPunchOnDate, 120)    AS lastOutPunchStr,
      CONVERT(VARCHAR(19), p.NextMorningOutPunch, 120)   AS nextMorningOutPunchStr,
      ${selectAl}
    FROM dbo.Employees e WITH (NOLOCK)
    ${joinDept}
    LEFT JOIN (
      SELECT
        EmployeeCode,
        MIN(CASE WHEN LogDate >= '${date} 05:30:00' AND LogDate <= '${date} 23:59:59' THEN LogDate END) AS FirstInPunchOnDate,
        MIN(CASE WHEN LogDate >= '${date} 17:00:00' AND LogDate <= '${date} 23:59:59' THEN LogDate END) AS NightInPunchOnDate,
        MAX(CASE WHEN LogDate >= '${date} 00:00:00' AND LogDate <= '${date} 23:59:59' THEN LogDate END) AS LastOutPunchOnDate,
        MIN(CASE WHEN LogDate >= '${nextDateStr} 00:00:00' AND LogDate <= '${nextDateStr} 12:30:00' THEN LogDate END) AS NextMorningOutPunch
      FROM (${lpUnionSql}) AllPunches
      WHERE LogDate >= '${prevDateStr} 17:00:00' AND LogDate <= '${nextDateStr} 12:30:00'
      GROUP BY EmployeeCode
    ) p ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = p.EmployeeCode
    ${joinAl}
    WHERE ISNULL(e.RecordStatus, 1) = 1
      AND ISNULL(e.Status, 'Working') NOT IN ('Resigned', 'Deleted', 'Inactive')
  `);

  const dataYear = parseInt(yStr, 10);

  // Site prefix map (same as in /attendance)
  const prefixSiteMap = {
    '17': 'Mahendra Aarna', '31': 'Brigade Cornerstone Utopia', '32': 'Brigade Cornerstone Utopia',
    '42': 'Purva Venezia', '77': 'Nikoo Homes', '78': 'Nikoo Homes',
    '70': 'Sobha Silicon Oasis', '79': 'Nikoo Paradigm', '80': 'Nikoo Paradigm',
    '99': 'Dsr Eden Greens',
  };

  const getSmartSite = (code) => {
    const c = String(code || '').trim();
    if (prefixSiteMap[c.slice(0, 2)]) return prefixSiteMap[c.slice(0, 2)];
    if (prefixSiteMap[c.slice(0, 3)]) return prefixSiteMap[c.slice(0, 3)];
    return 'Default';
  };

  const fmtTime = (sqlStr) => {
    if (!sqlStr) return null;
    const parts = String(sqlStr).trim().split(' ');
    if (parts.length < 2) return null;
    const tParts = parts[1].split(':').map(Number);
    if (tParts.length < 2) return null;
    const h = tParts[0]; const m = tParts[1];
    const ampm = h >= 12 ? 'pm' : 'am';
    const dh = h % 12 === 0 ? 12 : h % 12;
    return `${String(dh).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
  };

  return (result.recordset || []).map(row => {
    const inTime  = fmtTime(row.firstInPunchStr) || fmtTime(row.alInTime);
    const outTime = fmtTime(row.lastOutPunchStr)  || fmtTime(row.alOutTime);
    let status = 'Absent'; let statusCode = 'A'; let durationMins = 0;

    const alStatus = (row.alStatus || '').trim();
    if (alStatus === 'Present ') { status = 'Present'; statusCode = 'P'; }
    else if (inTime)             { status = 'Present'; statusCode = 'P'; }

    if (row.duration && row.duration > 0) durationMins = row.duration;

    return {
      emp_code:        String(row.empCode || ''),
      emp_name:        String(row.empName || ''),
      department:      String(row.department || 'General'),
      designation:     String(row.designation || 'Staff'),
      site:            getSmartSite(row.empCode),
      attendance_date: date,
      in_time:         inTime,
      out_time:        outTime,
      status:          status,
      status_code:     statusCode,
      duration_mins:   durationMins,
      late_mins:       row.lateBy  ? Number(row.lateBy)  : 0,
      ot_mins:         row.overTime ? Number(row.overTime) : 0,
      data_year:       dataYear,
      source:          'mssql',
      synced_at:       new Date().toISOString(),
    };
  });
}

// ─── POST /sync/today ───────────────────────────────────────────────────────
// Syncs a single date (default: today) from MS SQL → Supabase
app.post('/sync/today', requireApiKey, async (req, res) => {
  const date = (req.query.date || '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? req.query.date
    : new Date().toISOString().slice(0, 10);

  const triggeredBy = String(req.query.by || 'manual');
  const t0 = Date.now();
  console.log(`[Sync] Starting sync for ${date} (triggered by: ${triggeredBy})`);

  try {
    const rows = await fetchAttendanceRowsForDate(date);
    const result = await upsertToSupabase(rows);
    const durationMs = Date.now() - t0;

    await logSync(date, rows.length, 'ok', null, durationMs, triggeredBy);
    console.log(`[Sync] ✅ ${date} — ${rows.length} records upserted in ${durationMs}ms`);
    res.json({ success: true, date, records: rows.length, duration_ms: durationMs, skipped: result.skipped || false });
  } catch (err) {
    const durationMs = Date.now() - t0;
    console.error(`[Sync] ❌ ${date} failed:`, err.message);
    await logSync(date, 0, 'failed', err.message, durationMs, triggeredBy);
    res.status(500).json({ success: false, date, error: err.message, duration_ms: durationMs });
  }
});

// ─── POST /sync/backfill ────────────────────────────────────────────────────
// Backfills a full year (or date range) from MS SQL → Supabase
// Runs in background — responds immediately, logs to console
app.post('/sync/backfill', requireApiKey, async (req, res) => {
  const year      = parseInt(req.query.year || new Date().getFullYear(), 10);
  const startDate = req.query.startDate || `${year}-01-01`;
  const endDate   = req.query.endDate   || (year === new Date().getFullYear()
    ? new Date().toISOString().slice(0, 10)
    : `${year}-12-31`);

  console.log(`[Backfill] Starting backfill for ${startDate} → ${endDate}`);
  res.json({ status: 'backfill_started', year, startDate, endDate, message: 'Running in background — check server logs' });

  // Run in background after response is sent
  setImmediate(async () => {
    const cur = new Date(startDate);
    const end = new Date(endDate);
    let totalSynced = 0; let totalFailed = 0;

    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      try {
        const rows = await fetchAttendanceRowsForDate(dateStr);
        await upsertToSupabase(rows);
        totalSynced += rows.length;
        console.log(`[Backfill] ✅ ${dateStr} — ${rows.length} records`);
        await logSync(dateStr, rows.length, 'ok', null, 0, 'backfill');
      } catch (err) {
        totalFailed++;
        console.warn(`[Backfill] ⚠️  ${dateStr} failed:`, err.message);
        await logSync(dateStr, 0, 'failed', err.message, 0, 'backfill');
      }
      // 800ms pause between days to avoid overloading SQL Server
      await new Promise(r => setTimeout(r, 800));
      cur.setDate(cur.getDate() + 1);
    }

    console.log(`[Backfill] 🎉 Complete — ${totalSynced} total records synced, ${totalFailed} days failed`);
  });
});

// ─── Helper: Chunked Year Delete (Protects PostgreSQL from massive table locks) ─
async function deleteYearFromSupabaseSafely(yearToDelete) {
  if (!SUPABASE_SERVICE_KEY) return { success: false, error: 'Key not set' };

  console.log(`[Cleanup] Safely deleting year ${yearToDelete} in monthly batches...`);
  let totalDeletedMonths = 0;

  // Delete month-by-month (Jan to Dec) with 200ms pauses between months
  for (let m = 1; m <= 12; m++) {
    const mPad = m < 10 ? `0${m}` : `${m}`;
    const startMonth = `${yearToDelete}-${mPad}-01`;
    // Last day of month
    const endMonth = new Date(yearToDelete, m, 0).toISOString().slice(0, 10);

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_cache?attendance_date=gte.${startMonth}&attendance_date=lte.${endMonth}`,
      {
        method: 'DELETE',
        headers: {
          apikey:        SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer:        'return=minimal',
        },
        signal: AbortSignal.timeout(30000),
      }
    );

    if (res.ok) {
      totalDeletedMonths++;
    } else {
      console.warn(`[Cleanup] Month ${startMonth} delete response: ${res.status}`);
    }
    // 200ms micro-pause to release table locks & let Postgres autovacuum breathe
    await new Promise(r => setTimeout(r, 200));
  }

  // Also clean up any logs older than 30 days
  await pruneOldSyncLogs().catch(() => {});

  return { success: true, deletedMonths: totalDeletedMonths };
}

/** Prune sync logs older than 30 days to keep Supabase storage lightweight */
async function pruneOldSyncLogs() {
  if (!SUPABASE_SERVICE_KEY) return;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/attendance_sync_log?synced_at=lt.${thirtyDaysAgo}`, {
      method: 'DELETE',
      headers: {
        apikey:        SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer:        'return=minimal',
      },
      signal: AbortSignal.timeout(10000),
    });
    console.log('[Cleanup] 🧹 Pruned sync logs older than 30 days');
  } catch (err) {
    // Non-fatal
  }
}

// ─── POST /sync/auto-delete ─────────────────────────────────────────────────
// Deletes data older than (currentYear - 2) from Supabase safely in chunks
app.post('/sync/auto-delete', requireApiKey, async (req, res) => {
  const currentYear  = new Date().getFullYear();
  const deleteUpToYear = parseInt(req.query.year || (currentYear - 2), 10);

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(400).json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  try {
    const result = await deleteYearFromSupabaseSafely(deleteUpToYear);
    res.json({ success: true, deleted_up_to_year: deleteUpToYear, current_year: currentYear, result });
  } catch (err) {
    console.error('[Cleanup] ❌ Auto-delete failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /sync/status ───────────────────────────────────────────────────────
// Returns recent sync log entries from Supabase
app.get('/sync/status', requireApiKey, async (req, res) => {
  if (!SUPABASE_SERVICE_KEY) {
    return res.json({ configured: false, message: 'SUPABASE_SERVICE_ROLE_KEY not set' });
  }
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_sync_log?select=*&order=synced_at.desc&limit=10`,
      {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    const data = r.ok ? await r.json() : [];
    res.json({ configured: true, recent_syncs: data });
  } catch (err) {
    res.status(500).json({ configured: true, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  AUTO-SYNC SCHEDULER — Every 5 minutes, syncs today to Supabase
//  Equipped with Concurrency Mutex Lock + Hourly Log Rotation
// ═══════════════════════════════════════════════════════════════════════════

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let isAutoSyncRunning = false;
let autoSyncCycleCounter = 0;

async function runAutoSync() {
  if (isAutoSyncRunning) {
    console.log('[AutoSync] ⏳ Previous sync is still in progress. Skipping this cycle to prevent overlap.');
    return;
  }

  isAutoSyncRunning = true;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  try {
    // 1. Sync Today's live punches (real-time updates)
    const rows = await fetchAttendanceRowsForDate(today);
    await upsertToSupabase(rows);
    await logSync(today, rows.length, 'ok', null, 0, 'auto');
    console.log(`[AutoSync] ✅ ${today} — ${rows.length} records synced to Supabase`);

    // 2. Automatically sync Yesterday every cycle to finalize night-shift out-punches and completed daily records
    try {
      const rowsYesterday = await fetchAttendanceRowsForDate(yesterday);
      await upsertToSupabase(rowsYesterday);
      await logSync(yesterday, rowsYesterday.length, 'ok', null, 0, 'auto');
      console.log(`[AutoSync] ✅ ${yesterday} — ${rowsYesterday.length} records finalized in Supabase`);
    } catch (yErr) {
      console.warn('[AutoSync] Note on yesterday auto-sync:', yErr.message);
    }

    // 3. Once every 12 cycles (~1 hour), run safety reconciliation for 2 days ago + prune old sync logs
    autoSyncCycleCounter++;
    if (autoSyncCycleCounter % 12 === 0) {
      try {
        const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
        const rowsPast = await fetchAttendanceRowsForDate(twoDaysAgo);
        await upsertToSupabase(rowsPast);
        await logSync(twoDaysAgo, rowsPast.length, 'ok', null, 0, 'auto');
        console.log(`[AutoSync] 🔄 Reconciled ${twoDaysAgo} (${rowsPast.length} records)`);
      } catch (_) {}

      pruneOldSyncLogs().catch(() => {});
    }
  } catch (err) {
    console.warn('[AutoSync] ⚠️  Sync failed (will retry in 5 min):', err.message);
    await logSync(today, 0, 'failed', err.message, 0, 'auto').catch(() => {});
  } finally {
    isAutoSyncRunning = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  JAN 1 YEARLY CLEANUP — Auto-deletes data older than 1 year from Supabase
// ═══════════════════════════════════════════════════════════════════════════

function scheduleYearlyCleanup() {
  const now   = new Date();
  const jan1  = new Date(now.getFullYear() + 1, 0, 1, 2, 0, 0); // Jan 1 next year at 02:00 AM (off-peak)
  const msUntil = jan1.getTime() - now.getTime();

  console.log(`[Cleanup] Next yearly auto-delete scheduled for ${jan1.toISOString()} (in ${Math.round(msUntil / 3600000)}h)`);

  setTimeout(async () => {
    console.log('[Cleanup] 🗑️  Jan 1 (02:00 AM) — running safe yearly auto-delete from Supabase...');
    try {
      const currentYear = new Date().getFullYear();
      const delYear = currentYear - 2;
      await deleteYearFromSupabaseSafely(delYear);
      console.log(`[Cleanup] ✅ Safely purged records for year <= ${delYear}`);
    } catch (err) {
      console.error('[Cleanup] ❌ Yearly cleanup error:', err.message);
    }
    scheduleYearlyCleanup(); // schedule for NEXT year
  }, msUntil);
}

app.listen(PORT, '0.0.0.0', () => {

  console.log('');
  console.log('ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ');
  console.log('  Paradigm Attendance API');
  console.log(`  Running on: http://localhost:${PORT}`);
  console.log(`  Database  : ${DB_CONFIG.database}`);
  console.log('  Now run cloudflared-setup.bat to expose it');
  console.log('ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ');
  console.log('');

  // Warm up the DB connection on startup
  getPool().catch(err => console.error('[Startup] DB connection failed:', err.message));

  // Start Supabase auto-sync after 30s (let DB connection stabilize first)
  setTimeout(() => {
    console.log('[AutoSync] Starting 5-minute sync loop to Supabase...');
    runAutoSync(); // run immediately
    setInterval(runAutoSync, SYNC_INTERVAL_MS);
  }, 30_000);

  // Schedule yearly Jan-1 auto-delete
  scheduleYearlyCleanup();
});


// ΓöÇΓöÇΓöÇ Helper ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function calcHours(inTime, outTime) {
  if (!inTime || !outTime) return 'ΓÇö';
  const diff = new Date(outTime) - new Date(inTime);
  if (diff < 0) return 'ΓÇö';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${String(m).padStart(2,'0')}m`;
}
