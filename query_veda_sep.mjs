// Query Vedamurthy SS (31014) attendance records from MSSQL for September 2026
import sql from 'mssql';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const config = {
  server: process.env.MSSQL_SERVER || 'WIN-0T8N581GN63',
  database: 'etimetracklite1',
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || '',
  port: parseInt(process.env.MSSQL_PORT || '1433', 10),
  options: { encrypt: false, trustServerCertificate: true, instanceName: process.env.MSSQL_INSTANCE || 'SQLEXPRESS' },
  connectionTimeout: 10000,
};

try {
  const pool = await new sql.ConnectionPool(config).connect();
  console.log('CONNECTED\n');

  const attLogs = await pool.request().query(
    USE [etimetracklite1];
    SELECT EmployeeId, AttendanceDate, InTime, OutTime, Duration, Status, StatusCode, LateBy, OverTime
    FROM dbo.AttendanceLogs
    WHERE EmployeeId = 31014
      AND AttendanceDate >= '2026-09-01' AND AttendanceDate < '2026-10-01'
    ORDER BY AttendanceDate;
  );
  console.log('ATTENDANCE LOGS:');
  attLogs.recordset.forEach(r => {
    const day = new Date(r.AttendanceDate).getDate().toString().padStart(2,'0');
    const inT = r.InTime ? String(r.InTime).substring(11,16) : '--:--';
    const outT = r.OutTime ? String(r.OutTime).substring(11,16) : '--:--';
    console.log('Sep'+day+': In='+inT+' Out='+outT+' Dur='+r.Duration+'m Status='+String(r.Status||'').trim()+' Late='+r.LateBy+'m OT='+r.OverTime+'m');
  });

  const devLogs = await pool.request().query(
    USE [etimetracklite1];
    SELECT UserId, LogDate, Direction FROM dbo.DeviceLogs
    WHERE UserId = 31014 AND LogDate >= '2026-09-01' AND LogDate < '2026-10-01'
    ORDER BY LogDate;
  );
  console.log('\nDEVICE LOGS (raw punches):');
  devLogs.recordset.forEach(r => {
    const d = new Date(r.LogDate);
    console.log('Sep'+d.getDate().toString().padStart(2,'0')+' '+d.toTimeString().substring(0,5)+' Dir='+r.Direction);
  });

  await pool.close();
} catch (err) { console.error('FAILED:', err.message); }
