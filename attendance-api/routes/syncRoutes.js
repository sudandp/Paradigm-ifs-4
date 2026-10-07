/**
 * routes/syncRoutes.js
 * Manual and background Supabase synchronization endpoints
 */

const express = require('express');
const router = express.Router();
const syncService = require('../services/syncService');
const { requireApiKey } = require('../middleware/auth');
const env = require('../config/env');

// POST /sync/today
router.post('/sync/today', requireApiKey, async (req, res, next) => {
  const date = (req.query.date || '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? req.query.date
    : new Date().toISOString().slice(0, 10);
  const triggeredBy = String(req.query.by || 'manual');
  const t0 = Date.now();

  try {
    const rows = await syncService.fetchAttendanceRowsForDate(date);
    const result = await syncService.upsertToSupabase(rows);
    const durationMs = Date.now() - t0;
    await syncService.logSync(date, rows.length, 'ok', null, durationMs, triggeredBy);
    res.json({ success: true, date, records: rows.length, duration_ms: durationMs, skipped: result.skipped || false });
  } catch (err) {
    const durationMs = Date.now() - t0;
    await syncService.logSync(date, 0, 'failed', err.message, durationMs, triggeredBy);
    next(err);
  }
});

// POST /sync/backfill
router.post('/sync/backfill', requireApiKey, async (req, res) => {
  const year = parseInt(req.query.year || new Date().getFullYear(), 10);
  const startDate = req.query.startDate || `${year}-01-01`;
  const endDate = req.query.endDate || (year === new Date().getFullYear()
    ? new Date().toISOString().slice(0, 10)
    : `${year}-12-31`);

  res.json({ status: 'backfill_started', year, startDate, endDate, message: 'Running in background — check server logs' });

  setImmediate(async () => {
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      try {
        const rows = await syncService.fetchAttendanceRowsForDate(dateStr);
        await syncService.upsertToSupabase(rows);
        if (rows.rawDeviceLogs && rows.rawDeviceLogs.length > 0) {
          await syncService.upsertBiometricDeviceLogs(rows.rawDeviceLogs);
        }
        await syncService.logSync(dateStr, rows.length, 'ok', null, 0, 'backfill');
      } catch (err) {
        await syncService.logSync(dateStr, 0, 'failed', err.message, 0, 'backfill');
      }
      await new Promise(r => setTimeout(r, 800));
      cur.setDate(cur.getDate() + 1);
    }
  });
});

// POST /sync/auto-delete
router.post('/sync/auto-delete', requireApiKey, async (req, res, next) => {
  const currentYear = new Date().getFullYear();
  const deleteUpToYear = parseInt(req.query.year || (currentYear - 2), 10);

  try {
    const result = await syncService.deleteYearFromSupabaseSafely(deleteUpToYear);
    res.json({ success: true, deleted_up_to_year: deleteUpToYear, current_year: currentYear, result });
  } catch (err) {
    next(err);
  }
});

// GET /sync/status
router.get('/sync/status', requireApiKey, async (req, res, next) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.json({ configured: false, message: 'SUPABASE_SERVICE_ROLE_KEY not set' });
  }
  try {
    const r = await fetch(
      `${env.SUPABASE_URL}/rest/v1/attendance_sync_log?select=*&order=synced_at.desc&limit=10`,
      {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    const data = r.ok ? await r.json() : [];
    res.json({ configured: true, recent_syncs: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
