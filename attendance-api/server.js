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

// ΓöÇΓöÇΓöÇ CORS ΓÇö only allow your Vercel domain ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use(cors({
  origin: [
    'https://paradigm-ifs-4.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ]
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

// ΓöÇΓöÇΓöÇ GET /attendance ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
      let workingHours = 'ΓÇö';
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
       LastPing AS lastPing,
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
       LastActivity AS lastPing,
       CASE WHEN DATEDIFF(MINUTE, LastActivity, GETDATE()) <= 30 THEN 'online' ELSE 'offline' END AS status
     FROM dbo.iclock_Device WITH (NOLOCK)
     ORDER BY deviceName`,

    // 4. iclock_Device variant
    `SELECT
       DeviceId, SerialNo AS serialNo,
       ISNULL(DeviceName, SerialNo) AS deviceName,
       ISNULL(Location, '') AS location,
       LastPing AS lastPing,
       CASE WHEN DATEDIFF(MINUTE, LastPing, GETDATE()) <= 30 THEN 'online' ELSE 'offline' END AS status
     FROM dbo.iclock_Device WITH (NOLOCK)
     ORDER BY deviceName`,

    // 5. iclock_terminal table
    `SELECT
       id AS DeviceId, sn AS serialNo,
       ISNULL(alias, sn) AS deviceName,
       ISNULL(area_name, '') AS location,
       last_activity AS lastPing,
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
app.listen(PORT, () => {
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
