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
  const res = await pool.request().query(`
    SELECT COUNT(DISTINCT a.EmployeeId) as totalEmps, COUNT(*) as totalLogs
    FROM dbo.AttendanceLogs a
    WHERE a.AttendanceDate >= '2026-09-01' AND a.AttendanceDate <= '2026-09-30'
  `);
  console.log('MSSQL Sep 2026 logs:', res.recordset);

  const emps = await pool.request().query(`
    SELECT DISTINCT TOP 20 e.EmployeeCode, e.EmployeeName
    FROM dbo.AttendanceLogs a
    JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
    WHERE a.AttendanceDate >= '2026-09-01' AND a.AttendanceDate <= '2026-09-30'
  `);
  console.log('Sample employees with Sep 2026 logs:', emps.recordset);

  await pool.close();
} catch (err) {
  console.error('Error:', err.message);
}
