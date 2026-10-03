import sql from 'mssql';

const DB_CONFIG = {
  server: 'localhost',
  database: 'etimetracklite1',
  user: 'sa',
  password: 'Paradigm@1610',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: 'SQLEXPRESS',
  },
};

async function check() {
  const pool = await sql.connect(DB_CONFIG);
  const res = await pool.request().query(`
    SELECT CONVERT(VARCHAR(10), a.AttendanceDate, 120) as AttDate,
           CONVERT(VARCHAR(8), a.InTime, 108) as InTime,
           CONVERT(VARCHAR(8), a.OutTime, 108) as OutTime,
           a.Duration, a.LateBy, a.EarlyBy, a.OverTime, a.Status, a.StatusCode, a.ShiftId
    FROM dbo.AttendanceLogs a
    JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
    WHERE e.EmployeeCode = '31056' AND a.AttendanceDate BETWEEN '2026-09-01' AND '2026-09-12'
    ORDER BY a.AttendanceDate
  `);
  console.table(res.recordset);

  // Also check raw punches in DeviceLogs
  const punches = await pool.request().query(`
    SELECT CONVERT(VARCHAR(19), LogDate, 120) as PunchTime, Direction, DeviceId
    FROM dbo.DeviceLogs
    WHERE UserId = '31056' AND LogDate BETWEEN '2026-09-01' AND '2026-09-06'
    ORDER BY LogDate
  `);
  console.log('Raw DeviceLogs punches for 31056:');
  console.table(punches.recordset);

  await pool.close();
}

check().catch(console.error);
