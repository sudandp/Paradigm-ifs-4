/**
 * services/deviceService.js
 * Biometric Devices telemetry & raw punch logs extraction
 */

const { getPool, sql } = require('../config/db');
const env = require('../config/env');

/**
 * Fetch biometric devices list with online/offline status
 */
async function getDevices() {
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
  ];

  for (const q of queries) {
    try {
      const result = await p.request().query(q);
      if (result.recordset) {
        const devices = result.recordset.map(r => ({
          deviceId: r.DeviceId,
          serialNo: r.serialNo,
          deviceName: r.deviceName,
          location: r.location,
          lastPing: r.lastPing,
          status: r.status === 'online' ? 'online' : 'offline',
        }));
        const online = devices.filter(d => d.status === 'online').length;
        const offline = devices.filter(d => d.status === 'offline').length;
        return { devices, online, offline, total: devices.length };
      }
    } catch (_) {
      // try next query
    }
  }

  return { devices: [], online: 0, offline: 0, total: 0, note: 'Device table not found — check /tables' };
}

/**
 * Fetch and debounce raw device logs for a date with a 5-minute window
 */
async function fetchRawDeviceLogsForDate(date, debounceMs = 5 * 60 * 1000) {
  const p = await getPool();
  const [yStr, mStr] = date.split('-');
  const mNum = parseInt(mStr, 10);
  const mPad = mNum < 10 ? `0${mNum}` : `${mNum}`;

  const tblCheck = await p.request()
    .input('t1', sql.VarChar, `DeviceLogs_${mNum}_${yStr}`)
    .input('t2', sql.VarChar, `DeviceLogs_${mPad}_${yStr}`)
    .query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN (@t1, @t2)`)
    .catch(() => ({ recordset: [] }));

  const logTable = (tblCheck.recordset && tblCheck.recordset.length > 0)
    ? tblCheck.recordset[0].TABLE_NAME
    : 'DeviceLogs';

  const tablesToQuery = Array.from(new Set([logTable, 'DeviceLogs']));
  const validTablesRes = await p.request().query(`
    SELECT DISTINCT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME IN ('${tablesToQuery.join("','")}')
  `).catch(() => ({ recordset: [{ TABLE_NAME: logTable }] }));

  const validTables = (validTablesRes.recordset && validTablesRes.recordset.length > 0)
    ? validTablesRes.recordset.map(r => r.TABLE_NAME)
    : [logTable];

  let hasDevices = false;
  try {
    const devChk = await p.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Devices'`);
    hasDevices = (devChk.recordset && devChk.recordset.length > 0);
  } catch (_) {}

  const selectDevice = hasDevices
    ? `ISNULL(dev.DeviceFName, 'Device-' + CAST(d.DeviceId AS VARCHAR)) AS deviceName, ISNULL(dev.SerialNumber, '') AS serialNo`
    : `'Device-' + CAST(d.DeviceId AS VARCHAR) AS deviceName, '' AS serialNo`;
  const joinDevice = hasDevices
    ? `LEFT JOIN dbo.Devices dev WITH (NOLOCK) ON d.DeviceId = dev.DeviceId`
    : ``;

  const unionSql = validTables.map(t => `
    SELECT 
      d.DownloadDate,
      d.DeviceId,
      LTRIM(RTRIM(CAST(d.UserId AS VARCHAR(50)))) AS empCode,
      d.LogDate,
      ISNULL(d.Direction, 'in') AS direction,
      ISNULL(d.C1, 'VS_FACE') AS verifyMode,
      ${selectDevice}
    FROM dbo.[${t}] d WITH (NOLOCK)
    ${joinDevice}
    WHERE d.LogDate >= '${date} 00:00:00' AND d.LogDate <= '${date} 23:59:59'
  `).join(' UNION ALL ');

  const queryRes = await p.request().query(`
    SELECT * FROM (
      ${unionSql}
    ) AllLogs
    ORDER BY empCode, LogDate ASC
  `).catch(err => {
    console.warn('[DeviceLogs] Query error:', err.message);
    return { recordset: [] };
  });

  const rawRows = queryRes.recordset || [];
  const logsByEmp = new Map();
  const debouncedList = [];

  const fmtSimpleTime = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    let h = dt.getHours();
    const m = dt.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 === 0 ? 12 : h % 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // 5-Minute Debounce Algorithm per employee
  for (const row of rawRows) {
    const emp = row.empCode;
    if (!emp) continue;
    const punchTime = new Date(row.LogDate).getTime();
    if (isNaN(punchTime)) continue;

    if (!logsByEmp.has(emp)) {
      logsByEmp.set(emp, []);
    }

    const empLogs = logsByEmp.get(emp);
    const lastAccepted = empLogs.length > 0 ? empLogs[empLogs.length - 1] : null;

    if (!lastAccepted || (punchTime - new Date(lastAccepted.rawIso).getTime()) >= debounceMs) {
      const logIso = new Date(row.LogDate).toISOString();
      const cleanPunch = {
        emp_code: emp,
        log_date: logIso,
        download_date: row.DownloadDate ? new Date(row.DownloadDate).toISOString() : logIso,
        device_name: row.deviceName,
        serial_no: row.serialNo,
        direction: row.direction,
        verify_mode: row.verifyMode,
        source: 'etimetracklite',
      };
      empLogs.push({
        time: fmtSimpleTime(row.LogDate),
        rawIso: logIso,
        device: row.deviceName,
        serial: row.serialNo,
        direction: row.direction,
        verify: row.verifyMode,
      });
      debouncedList.push(cleanPunch);
    }
  }

  // Build rawAllList — all raw punches without debounce
  const rawAllList = rawRows
    .filter(row => row.empCode && !isNaN(new Date(row.LogDate).getTime()))
    .map(row => {
      const logIso = new Date(row.LogDate).toISOString();
      return {
        emp_code: String(row.empCode),
        log_date: logIso,
        download_date: row.DownloadDate ? new Date(row.DownloadDate).toISOString() : logIso,
        device_name: row.deviceName || 'Device',
        serial_no: row.serialNo || '',
        direction: row.direction || 'in',
        verify_mode: row.verifyMode || 'VS_FACE',
        source: 'etimetracklite',
      };
    });

  return { debouncedList, logsByEmp, rawAllList };
}

/**
 * Fetch detailed eSSL devices for EsslAdminPanel
 */
async function getEsslDevices() {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT 
      DeviceId,
      DeviceFName AS DeviceName,
      DeviceSName AS ShortName,
      DeviceDirection,
      SerialNumber,
      ConnectionType,
      IpAddress,
      BaudRate,
      CommKey,
      ComPort,
      LastLogDownloadDate,
      LastPing,
      DeviceType,
      DeviceLocation,
      FaceDeviceType,
      CASE 
        WHEN LastPing >= DATEADD(minute, -15, GETDATE()) THEN 'online'
        WHEN LastLogDownloadDate >= DATEADD(hour, -24, GETDATE()) THEN 'online'
        ELSE 'offline'
      END AS Status
    FROM dbo.Devices
    ORDER BY DeviceFName
  `);
  return { success: true, devices: r.recordset, total: r.recordset.length };
}

/**
 * Add or update eSSL device in MSSQL dbo.Devices & Supabase
 */
async function addEsslDevice(body) {
  const p = await getPool();
  const {
    deviceName,
    shortName,
    serialNumber,
    deviceDirection = 'all',
    connectionType = 'Cloud',
    ipAddress = '',
    commKey = '0',
    deviceType = 'eSSL AiFace-Mars',
    location = '',
  } = body;

  if (!deviceName || !serialNumber) {
    throw new Error('deviceName and serialNumber are required');
  }

  const sName = shortName || String(deviceName).substring(0, 20);
  const snClean = String(serialNumber).trim();

  const existing = await p.request()
    .input('sn', sql.NVarChar, snClean)
    .query('SELECT DeviceId, DeviceFName FROM dbo.Devices WHERE SerialNumber = @sn');

  let deviceId;
  if (existing.recordset.length > 0) {
    deviceId = existing.recordset[0].DeviceId;
    await p.request()
      .input('id', sql.Int, deviceId)
      .input('name', sql.NVarChar, deviceName)
      .input('sname', sql.NVarChar, sName)
      .input('dir', sql.NVarChar, deviceDirection)
      .input('conn', sql.NVarChar, connectionType)
      .input('ip', sql.NVarChar, ipAddress)
      .input('key', sql.NVarChar, commKey)
      .input('type', sql.NVarChar, deviceType)
      .input('loc', sql.NVarChar, location)
      .query(`
        UPDATE dbo.Devices SET
          DeviceFName = @name,
          DeviceSName = @sname,
          DeviceDirection = @dir,
          ConnectionType = @conn,
          IpAddress = @ip,
          CommKey = @key,
          DeviceType = @type,
          DeviceLocation = @loc,
          LastPing = GETDATE()
        WHERE DeviceId = @id
      `);
  } else {
    const insRes = await p.request()
      .input('name', sql.NVarChar, deviceName)
      .input('sname', sql.NVarChar, sName)
      .input('dir', sql.NVarChar, deviceDirection)
      .input('sn', sql.NVarChar, snClean)
      .input('conn', sql.NVarChar, connectionType)
      .input('ip', sql.NVarChar, ipAddress)
      .input('key', sql.NVarChar, commKey)
      .input('type', sql.NVarChar, deviceType)
      .input('loc', sql.NVarChar, location)
      .query(`
        INSERT INTO dbo.Devices (
          DeviceFName, DeviceSName, DeviceDirection, SerialNumber,
          ConnectionType, IpAddress, CommKey, DeviceType, DeviceLocation,
          LastPing, C1
        ) VALUES (
          @name, @sname, @dir, @sn,
          @conn, @ip, @key, @type, @loc,
          GETDATE(), 'Active'
        );
        SELECT SCOPE_IDENTITY() AS NewDeviceId;
      `);
    deviceId = insRes.recordset[0]?.NewDeviceId;
  }

  // Mirror to Supabase biometric_devices if configured
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/biometric_devices`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          sn: snClean.toLowerCase(),
          name: deviceName,
          status: 'online',
          location_name: location || deviceName,
          ip_address: ipAddress || null,
        }),
      });
    } catch (sbErr) {
      console.warn('[eSSL] Supabase mirror notice:', sbErr.message);
    }
  }

  return {
    success: true,
    message: `eSSL Device '${deviceName}' registered successfully`,
    deviceId,
    serialNumber: snClean,
    deviceName,
    location,
  };
}

/**
 * Delete eSSL device
 */
async function deleteEsslDevice({ deviceId, serialNumber }) {
  if (!deviceId && !serialNumber) {
    throw new Error('deviceId or serialNumber required');
  }

  const p = await getPool();
  let delQuery = 'DELETE FROM dbo.Devices WHERE ';
  const r = p.request();
  if (deviceId) {
    r.input('id', sql.Int, parseInt(deviceId, 10));
    delQuery += 'DeviceId = @id';
  } else {
    r.input('sn', sql.NVarChar, String(serialNumber).trim());
    delQuery += 'SerialNumber = @sn';
  }

  await r.query(delQuery);

  if (env.SUPABASE_SERVICE_ROLE_KEY && serialNumber) {
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/biometric_devices?sn=eq.${encodeURIComponent(String(serialNumber).toLowerCase())}`, {
        method: 'DELETE',
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      });
    } catch (_) {}
  }

  return { success: true, message: 'Device removed successfully' };
}

module.exports = {
  getDevices,
  fetchRawDeviceLogsForDate,
  getEsslDevices,
  addEsslDevice,
  deleteEsslDevice,
};
