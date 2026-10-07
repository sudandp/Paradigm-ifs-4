/**
 * routes/systemRoutes.js
 * System diagnostics, table inspection, and health check endpoints
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/db');
const env = require('../config/env');
const { requireApiKey } = require('../middleware/auth');
const { exec } = require('child_process');

// Health Check
router.get(['/', '/health', '/api/health'], (req, res) => {
  res.json({
    service: 'Paradigm Attendance API',
    status: 'running',
    version: '2.0.0-modular',
    database: env.DB_NAME,
    time: new Date().toISOString(),
  });
});

// Remote Restart (Admin Only via PM2)
router.post('/restart', requireApiKey, (req, res) => {
  console.log('[Restart] Remote restart triggered by admin at', new Date().toISOString());
  res.json({ status: 'restarting', message: 'PM2 restart issued. API will be back in ~5s.', time: new Date().toISOString() });
  setTimeout(() => {
    exec('pm2 restart attendance-api', (err) => {
      if (err) console.error('[Restart] pm2 error:', err.message);
    });
  }, 300);
});

// Tables Listing
router.get(['/tables', '/api/tables'], requireApiKey, async (req, res, next) => {
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
    next(err);
  }
});

// Columns Listing
router.get('/columns/:table', requireApiKey, async (req, res, next) => {
  const tableName = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
  try {
    const p = await getPool();
    const result = await p.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
      ORDER BY ORDINAL_POSITION
    `);
    res.json({ table: tableName, columns: result.recordset });
  } catch (err) {
    next(err);
  }
});

// Diagnostics
router.get('/diagnose', requireApiKey, async (req, res, next) => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const p = await getPool();

    const safe = async (label, query) => {
      try {
        const r = await p.request().query(query);
        return { label, value: r.recordset[0]?.value ?? r.recordset[0]?.cnt ?? '?', ok: true };
      } catch (e) {
        return { label, value: null, error: e.message, ok: false };
      }
    };

    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    const partTbl = `DeviceLogs_${curMonth}_${curYear}`;

    let hasPartition = false;
    try {
      const partCheck = await p.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${partTbl}'`);
      hasPartition = (partCheck.recordset && partCheck.recordset.length > 0);
    } catch (_) {}

    const deviceLogsQuery = hasPartition
      ? `SELECT COUNT(*) AS value FROM (
           SELECT UserId, LogDate FROM dbo.DeviceLogs WHERE CAST(LogDate AS DATE) = CAST(GETDATE() AS DATE)
           UNION ALL
           SELECT UserId, LogDate FROM dbo.${partTbl} WHERE CAST(LogDate AS DATE) = CAST(GETDATE() AS DATE)
         ) AS u`
      : `SELECT COUNT(*) AS value FROM dbo.DeviceLogs WHERE CAST(LogDate AS DATE) = CAST(GETDATE() AS DATE)`;

    const latestPunchQuery = hasPartition
      ? `SELECT TOP 1 CONVERT(VARCHAR, LogDate, 120) AS value FROM (
           SELECT TOP 1 LogDate FROM dbo.DeviceLogs ORDER BY LogDate DESC
           UNION ALL
           SELECT TOP 1 LogDate FROM dbo.${partTbl} ORDER BY LogDate DESC
         ) AS u ORDER BY LogDate DESC`
      : `SELECT TOP 1 CONVERT(VARCHAR,LogDate,120) AS value FROM dbo.DeviceLogs ORDER BY LogDate DESC`;

    const metrics = await Promise.all([
      safe('Total Active Employees',     `SELECT COUNT(*) AS value FROM dbo.Employees WHERE Status = 'Working' OR Status = 'Active' OR RecordStatus = 1`),
      safe(`DeviceLogs today (${hasPartition ? 'Main + ' + partTbl : 'Main'})`, deviceLogsQuery),
      safe('AttendanceLogs today',       `SELECT COUNT(*) AS value FROM dbo.AttendanceLogs WHERE CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE)`),
      safe('Present (P) today',          `SELECT COUNT(*) AS value FROM dbo.AttendanceLogs WHERE CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE) AND (StatusCode = 'P' OR Status LIKE 'Present%' OR Present > 0)`),
      safe('Late (L) today',             `SELECT COUNT(*) AS value FROM dbo.AttendanceLogs WHERE CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE) AND (StatusCode = 'L' OR Status LIKE 'Late%' OR LateBy > 0)`),
      safe('Absent (A) today',           `SELECT COUNT(*) AS value FROM dbo.AttendanceLogs WHERE CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE) AND (StatusCode = 'A' OR Status LIKE 'Absent%' OR Absent > 0)`),
      safe('Unprocessed Initial (1900)', `SELECT COUNT(*) AS value FROM dbo.AttendanceLogs WHERE CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE) AND InTime LIKE '1900-01-01%'`),
      safe('Sample InTime (att)',        `SELECT TOP 1 CONVERT(VARCHAR,InTime,108) AS value FROM dbo.AttendanceLogs WHERE InTime IS NOT NULL AND InTime NOT LIKE '1900-01-01%'`),
      safe('Sample LogDate (device)',    latestPunchQuery),
    ]);

    const samplePunchesQuery = hasPartition
      ? `SELECT TOP 5 UserId, CONVERT(VARCHAR, LogDate, 120) AS LogDate FROM (
           SELECT TOP 5 UserId, LogDate FROM dbo.DeviceLogs WHERE CAST(LogDate AS DATE) = CAST(GETDATE() AS DATE)
           UNION ALL
           SELECT TOP 5 UserId, LogDate FROM dbo.${partTbl} WHERE CAST(LogDate AS DATE) = CAST(GETDATE() AS DATE)
         ) AS u ORDER BY LogDate DESC`
      : `SELECT TOP 5 UserId, CONVERT(VARCHAR, LogDate, 120) AS LogDate FROM dbo.DeviceLogs WHERE CAST(LogDate AS DATE) = CAST(GETDATE() AS DATE) ORDER BY LogDate DESC`;

    const samplePunches = await p.request().query(samplePunchesQuery).catch(e => ({ recordset: [{ error: e.message }] }));

    res.json({
      serverTime: new Date().toISOString(),
      diagnosticsFor: today,
      partitionTableDetected: hasPartition ? partTbl : null,
      metrics,
      samplePunches: samplePunches.recordset,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
