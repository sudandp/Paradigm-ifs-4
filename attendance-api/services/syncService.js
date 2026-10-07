/**
 * services/syncService.js
 * Supabase Synchronization & Auto-Scheduler Service
 */

const { getPool, sql } = require('../config/db');
const env = require('../config/env');
const { fetchRawDeviceLogsForDate } = require('./deviceService');

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

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
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
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
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        sync_date: syncDate,
        records_synced: recordsSynced,
        status,
        error_msg: errorMsg || null,
        duration_ms: durationMs,
        triggered_by: triggeredBy || 'auto',
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.warn('[Sync] Failed to write sync log:', e.message);
  }
}

/** Push raw device logs to Supabase biometric_device_logs */
async function upsertBiometricDeviceLogs(rows) {
  if (!SUPABASE_SERVICE_KEY) return { count: 0, skipped: true };
  if (!rows || rows.length === 0) return { count: 0 };

  const uniqueMap = new Map();
  for (const r of rows) {
    const k = `${r.emp_code}_${r.log_date}`;
    if (!uniqueMap.has(k)) {
      uniqueMap.set(k, r);
    }
  }
  const uniqueRows = Array.from(uniqueMap.values());
  const CHUNK_SIZE = 300;
  let totalUpserted = 0;

  for (let i = 0; i < uniqueRows.length; i += CHUNK_SIZE) {
    const chunk = uniqueRows.slice(i, i + CHUNK_SIZE);
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/biometric_device_logs?on_conflict=emp_code,log_date`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        if (response.status === 404 || errText.includes('biometric_device_logs')) {
          return { count: 0, missingTable: true };
        }
        console.warn(`[Sync] biometric_device_logs upsert warning (${response.status}):`, errText);
      } else {
        totalUpserted += chunk.length;
      }
    } catch (err) {
      console.warn('[Sync] Device log chunk sync error:', err.message);
    }
  }

  return { count: totalUpserted };
}

/** Purge old biometric device logs */
async function purgeOldBiometricDeviceLogs(retentionDays = 90) {
  if (!SUPABASE_SERVICE_KEY) return;
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/biometric_device_logs?log_date=lt.${cutoffDate}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      console.log(`[Cleanup] 🧹 Purged biometric device logs older than ${retentionDays} days`);
    }
  } catch (err) {
    console.warn('[Cleanup] Error purging old biometric device logs:', err.message);
  }
}

/** Prune sync logs older than 30 days */
async function pruneOldSyncLogs() {
  if (!SUPABASE_SERVICE_KEY) return;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/attendance_sync_log?synced_at=lt.${thirtyDaysAgo}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch (_) {}
}

/** Chunked safe year deletion from Supabase */
async function deleteYearFromSupabaseSafely(yearToDelete) {
  if (!SUPABASE_SERVICE_KEY) return { success: false, error: 'Key not set' };

  let totalDeletedMonths = 0;
  for (let m = 1; m <= 12; m++) {
    const mPad = m < 10 ? `0${m}` : `${m}`;
    const startMonth = `${yearToDelete}-${mPad}-01`;
    const endMonth = new Date(yearToDelete, m, 0).toISOString().slice(0, 10);

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_cache?attendance_date=gte.${startMonth}&attendance_date=lte.${endMonth}`,
      {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: 'return=minimal',
        },
        signal: AbortSignal.timeout(30000),
      }
    );

    if (res.ok) totalDeletedMonths++;
    await new Promise(r => setTimeout(r, 200));
  }

  await pruneOldSyncLogs().catch(() => {});
  return { success: true, deletedMonths: totalDeletedMonths };
}

/** Fetch single-day attendance rows from MS SQL for Supabase sync */
async function fetchAttendanceRowsForDate(date) {
  const p = await getPool();
  const [yStr, mStr] = date.split('-');
  const mNum = parseInt(mStr, 10);
  const mPad = mNum < 10 ? `0${mNum}` : `${mNum}`;

  const tblCheck = await p.request()
    .input('t1', sql.VarChar, `DeviceLogs_${mNum}_${yStr}`)
    .input('t2', sql.VarChar, `DeviceLogs_${mPad}_${yStr}`)
    .query('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN (@t1, @t2)')
    .catch(() => ({ recordset: [] }));

  const logTable = (tblCheck.recordset && tblCheck.recordset.length > 0)
    ? tblCheck.recordset[0].TABLE_NAME
    : 'DeviceLogs';

  let hasDepts = false;
  try {
    const deptCheck = await p.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Departments'");
    hasDepts = (deptCheck.recordset && deptCheck.recordset.length > 0);
  } catch (_) {}

  const selectDept = hasDepts ? `ISNULL(d.DepartmentFName, 'General')` : `'General'`;
  const joinDept   = hasDepts ? `LEFT JOIN dbo.Departments d WITH (NOLOCK) ON e.DepartmentId = d.DepartmentId` : ``;

  const nextDateStr = new Date(new Date(date).getTime() + 86400000).toISOString().slice(0, 10);
  const prevDateStr = new Date(new Date(date).getTime() - 86400000).toISOString().slice(0, 10);

  let hasAttendanceLogs = false;
  try {
    const alCheck = await p.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AttendanceLogs'");
    hasAttendanceLogs = (alCheck.recordset && alCheck.recordset.length > 0);
  } catch (_) {}

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
      CONVERT(VARCHAR(19), p.DayOutPunchOnDate, 120)     AS dayOutPunchStr,
      CONVERT(VARCHAR(19), p.NightInPunchOnDate, 120)    AS nightInPunchStr,
      CONVERT(VARCHAR(19), p.LastOutPunchOnDate, 120)    AS lastOutPunchStr,
      CONVERT(VARCHAR(19), p.NextMorningOutPunch, 120)   AS nextMorningOutPunchStr,
      CONVERT(VARCHAR(19), p.PrevNightInPunch, 120)      AS prevNightInPunchStr,
      p.PrevNightInPunch                                 AS prevNightInPunch,
      ${selectAl}
    FROM dbo.Employees e WITH (NOLOCK)
    ${joinDept}
    LEFT JOIN (
      SELECT
        EmployeeCode,
        MIN(CASE WHEN LogDate >= '${date} 05:30:00' AND LogDate <= '${date} 23:59:59' THEN LogDate END) AS FirstInPunchOnDate,
        MAX(CASE WHEN LogDate >= '${date} 11:30:00' AND LogDate < '${date} 17:00:00' THEN LogDate END) AS DayOutPunchOnDate,
        MIN(CASE WHEN LogDate >= '${date} 17:00:00' AND LogDate <= '${date} 23:59:59' THEN LogDate END) AS NightInPunchOnDate,
        MAX(CASE WHEN LogDate >= '${date} 00:00:00' AND LogDate <= '${date} 23:59:59' THEN LogDate END) AS LastOutPunchOnDate,
        MIN(CASE WHEN LogDate >= '${nextDateStr} 00:00:00' AND LogDate <= '${nextDateStr} 12:30:00' THEN LogDate END) AS NextMorningOutPunch,
        MAX(CASE WHEN LogDate >= '${prevDateStr} 17:00:00' AND LogDate <= '${prevDateStr} 23:59:59' THEN LogDate END) AS PrevNightInPunch
      FROM (${lpUnionSql}) AllPunches
      WHERE LogDate >= '${prevDateStr} 17:00:00' AND LogDate <= '${nextDateStr} 12:30:00'
      GROUP BY EmployeeCode
    ) p ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = p.EmployeeCode
    ${joinAl}
    WHERE ISNULL(e.RecordStatus, 1) = 1
      AND ISNULL(e.Status, 'Working') NOT IN ('Resigned', 'Deleted', 'Inactive')
  `);

  const dataYear = parseInt(yStr, 10);

  const getSmartSite = (code, dbSite) => {
    const siteStr = String(dbSite || '').trim();
    if (siteStr && siteStr !== 'General' && siteStr !== 'Default' && siteStr !== '—') return siteStr;
    const c = String(code || '').trim();
    if (c.startsWith('31') || c.startsWith('32')) return 'Brigade Cornerstone Utopia';
    if (c.startsWith('17')) return 'Mahendra Aarna';
    if (c.startsWith('42')) return 'Purva Venezia';
    if (c.startsWith('46')) return 'Parkwest';
    if (c.startsWith('77') || c.startsWith('78')) return 'Nikoo Homes';
    if (c.startsWith('70')) return 'Sobha Silicon Oasis';
    if (c.startsWith('79') || c.startsWith('80')) return 'Nikoo Paradigm';
    if (c.startsWith('99')) return 'Dsr Eden Greens';
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
    return `${String(dh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const parseSqlStr = (str) => {
    if (!str) return null;
    const parts = String(str).trim().split(' ');
    if (parts.length < 2) return null;
    const dParts = parts[0].split('-').map(Number);
    const tParts = parts[1].split(':').map(Number);
    if (dParts.length < 3 || tParts.length < 3) return null;
    return {
      hours: tParts[0], minutes: tParts[1], seconds: tParts[2],
      timestamp: Date.UTC(dParts[0], dParts[1] - 1, dParts[2], tParts[0], tParts[1], tParts[2]),
    };
  };

  let rawLogsMap = new Map();
  let rawPunchesList = [];
  let rawAllPunchesList = [];
  try {
    const rawRes = await fetchRawDeviceLogsForDate(date);
    rawLogsMap = rawRes.logsByEmp;
    rawPunchesList = rawRes.debouncedList;
    rawAllPunchesList = rawRes.rawAllList;
  } catch (rawErr) {
    console.warn('[Sync] Could not attach raw device logs:', rawErr.message);
  }

  const mappedRows = (result.recordset || []).map(row => {
    let inTimeStr = null;
    let outTimeStr = null;
    let status = 'Absent';
    let statusCode = 'A';
    let workingHours = null;
    let shiftCompleted = false;
    let durationMins = 0;
    let otMins = 0;

    const firstIn = parseSqlStr(row.firstInPunchStr);
    const dayOut = parseSqlStr(row.dayOutPunchStr);
    const nightIn = parseSqlStr(row.nightInPunchStr);
    const lastOut = parseSqlStr(row.lastOutPunchStr);
    const nextMorningOut = parseSqlStr(row.nextMorningOutPunchStr);
    const prevNight = parseSqlStr(row.prevNightInPunchStr);

    const _gapH = prevNight && firstIn ? (firstIn.timestamp - prevNight.timestamp) / 3600000 : 0;
    const isCShiftCarryover = !!(prevNight && firstIn && firstIn.hours < 9 && _gapH >= 4 && _gapH <= 14);
    let skipAlFallback = false;

    let effectiveIn = null;
    let effectiveOut = null;
    let isNextDayOut = false;

    if (!isCShiftCarryover && firstIn && firstIn.hours < 11 && nightIn && nextMorningOut) {
      const afternoonOut = dayOut || (lastOut && lastOut.hours >= 13 && lastOut.hours <= 16 ? lastOut : null);
      effectiveIn = firstIn;
      effectiveOut = nextMorningOut;
      isNextDayOut = true;
      const m1 = afternoonOut ? Math.max(0, Math.floor((afternoonOut.timestamp - firstIn.timestamp) / 60000) - 30) : 7 * 60;
      const m2 = Math.max(0, Math.floor((nextMorningOut.timestamp - nightIn.timestamp) / 60000) - 30);
      durationMins = m1 + m2;
      workingHours = `${Math.floor(durationMins / 60)}h ${String(durationMins % 60).padStart(2, '0')}m`;
      otMins = m2;
      shiftCompleted = true;
      status = 'Present';
    } else if (firstIn && !isCShiftCarryover) {
      effectiveIn = firstIn;
      if (lastOut && lastOut.timestamp > firstIn.timestamp) {
        effectiveOut = lastOut;
      }
    } else if (nightIn) {
      effectiveIn = nightIn;
      if (nextMorningOut) {
        effectiveOut = nextMorningOut;
        isNextDayOut = true;
      }
    }

    if (effectiveIn || effectiveOut) {
      if (effectiveIn) {
        const inH = effectiveIn.hours; const inM = effectiveIn.minutes;
        const inAmpm = inH >= 12 ? 'pm' : 'am';
        const displayInH = inH % 12 === 0 ? 12 : inH % 12;
        inTimeStr = `${String(displayInH).padStart(2, '0')}:${String(inM).padStart(2, '0')} ${inAmpm}`;
      }
      if (effectiveOut) {
        const outH = effectiveOut.hours; const outM = effectiveOut.minutes;
        const outAmpm = outH >= 12 ? 'pm' : 'am';
        const displayOutH = outH % 12 === 0 ? 12 : outH % 12;
        outTimeStr = `${String(displayOutH).padStart(2, '0')}:${String(outM).padStart(2, '0')} ${outAmpm}`;
      }
      if (effectiveIn && effectiveOut && durationMins === 0) {
        let diffMs = effectiveOut.timestamp - effectiveIn.timestamp;
        if (isNextDayOut && diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
        if (diffMs > 0) {
          durationMins = Math.max(0, Math.floor(diffMs / 60000) - 30);
          workingHours = `${Math.floor(durationMins / 60)}h ${String(durationMins % 60).padStart(2, '0')}m`;
          if (durationMins >= 360) shiftCompleted = true;
        }
        status = 'Present';
      } else if (effectiveIn && !effectiveOut) {
        status = 'Present';
      }
    }

    if (isCShiftCarryover && !effectiveIn && !effectiveOut) skipAlFallback = true;
    if (status === 'Absent' && !skipAlFallback) {
      const alStatus = (row.alStatus || '').trim();
      if (alStatus === 'Present ' || fmtTime(row.alInTime)) {
        status = 'Present';
        statusCode = 'P';
      }
    }
    if (status === 'Present') statusCode = 'P';

    const empPunches = rawLogsMap.get(String(row.empCode || '')) || [];

    return {
      emp_code: String(row.empCode || ''),
      emp_name: String(row.empName || ''),
      department: String(row.department || 'General'),
      designation: String(row.designation || 'Staff'),
      site: getSmartSite(row.empCode, row.department),
      attendance_date: date,
      in_time: inTimeStr,
      out_time: outTimeStr,
      status,
      status_code: statusCode,
      duration_mins: durationMins,
      late_mins: row.lateBy ? Number(row.lateBy) : 0,
      ot_mins: otMins,
      working_hours: workingHours,
      shift_completed: shiftCompleted,
      data_year: dataYear,
      source: 'mssql',
      raw_punches: empPunches.length > 0 ? empPunches : null,
      synced_at: new Date().toISOString(),
    };
  });

  mappedRows.rawDeviceLogs = rawAllPunchesList;
  mappedRows.debouncedDeviceLogs = rawPunchesList;
  return mappedRows;
}

let isAutoSyncRunning = false;
let autoSyncCycleCounter = 0;

async function runAutoSync() {
  if (isAutoSyncRunning) return;
  isAutoSyncRunning = true;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  try {
    const rows = await fetchAttendanceRowsForDate(today);
    await upsertToSupabase(rows);
    if (rows.rawDeviceLogs && rows.rawDeviceLogs.length > 0) {
      await upsertBiometricDeviceLogs(rows.rawDeviceLogs);
    }
    await logSync(today, rows.length, 'ok', null, 0, 'auto');

    try {
      const rowsYesterday = await fetchAttendanceRowsForDate(yesterday);
      await upsertToSupabase(rowsYesterday);
      if (rowsYesterday.rawDeviceLogs && rowsYesterday.rawDeviceLogs.length > 0) {
        await upsertBiometricDeviceLogs(rowsYesterday.rawDeviceLogs);
      }
      await logSync(yesterday, rowsYesterday.length, 'ok', null, 0, 'auto');
    } catch (_) {}

    autoSyncCycleCounter++;
    if (autoSyncCycleCounter % 12 === 0) {
      pruneOldSyncLogs().catch(() => {});
      purgeOldBiometricDeviceLogs(90).catch(() => {});
    }
  } catch (err) {
    console.warn('[AutoSync] Sync notice:', err.message);
  } finally {
    isAutoSyncRunning = false;
  }
}

function scheduleYearlyCleanup() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear() + 1, 0, 1, 2, 0, 0);
  const msUntil = jan1.getTime() - now.getTime();
  const MAX_SAFE_DELAY = 20 * 24 * 60 * 60 * 1000;

  if (msUntil > MAX_SAFE_DELAY) {
    setTimeout(() => scheduleYearlyCleanup(), MAX_SAFE_DELAY);
    return;
  }

  setTimeout(async () => {
    try {
      const delYear = new Date().getFullYear() - 2;
      await deleteYearFromSupabaseSafely(delYear);
    } catch (_) {}
    scheduleYearlyCleanup();
  }, msUntil);
}

module.exports = {
  upsertToSupabase,
  logSync,
  upsertBiometricDeviceLogs,
  fetchAttendanceRowsForDate,
  deleteYearFromSupabaseSafely,
  runAutoSync,
  scheduleYearlyCleanup,
};
