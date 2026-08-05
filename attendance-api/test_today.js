require('dotenv').config();
const mssql = require('mssql');

const config = {
  server: 'localhost',
  database: process.env.DB_NAME || 'etimetracklite1',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Paradigm@1610',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: 'SQLEXPRESS',
    enableArithAbort: true,
  },
};

async function testCleanQuery() {
  try {
    const pool = await mssql.connect(config);
    const sqlQuery = `
      DECLARE @TargetDate DATE = '2026-08-05';

      SELECT 
          LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) AS BiometricCode,
          e.EmployeeName,
          'Brigade Cornerstone Utopia' AS SiteName,
          ISNULL(e.Designation, 'Staff') AS Designation,
          
          CONVERT(VARCHAR(19), p.FirstInPunch, 120) AS FirstInPunch,
          CONVERT(VARCHAR(8), p.FirstInPunch, 108)  AS FirstInTimeFormatted,
          
          CONVERT(VARCHAR(19), p.LastOutPunch, 120) AS LastOutPunch,
          CONVERT(VARCHAR(8), p.LastOutPunch, 108)  AS LastOutTimeFormatted,
          
          CASE 
              WHEN DATEPART(hour, p.FirstInPunch) >= 17 THEN 'Security / Staff Night Duty (12h)'
              ELSE 'Day Shift'
          END AS ShiftType,
          
          CAST(DATEDIFF(minute, p.FirstInPunch, p.LastOutPunch) / 60.0 AS DECIMAL(10,2)) AS HoursWorked,
          'PRESENT' AS AttendanceStatus

      FROM dbo.Employees e WITH (NOLOCK)
      LEFT JOIN dbo.Departments d WITH (NOLOCK) ON e.DepartmentId = d.DepartmentId

      INNER JOIN (
          SELECT 
              LTRIM(RTRIM(CAST(UserId AS VARCHAR(50)))) AS EmployeeCode,
              MIN(LogDate) AS FirstInPunch,
              MAX(LogDate) AS LastOutPunch
          FROM dbo.DeviceLogs_8_2026 WITH (NOLOCK)
          WHERE LogDate >= CAST(@TargetDate AS DATETIME) + '05:30:00' 
            AND LogDate <= CAST(@TargetDate AS DATETIME) + '23:59:59'
          GROUP BY LTRIM(RTRIM(CAST(UserId AS VARCHAR(50))))
      ) p ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = p.EmployeeCode

      WHERE ISNULL(e.RecordStatus, 1) = 1 
        AND ISNULL(e.Status, 'Working') NOT IN ('Resigned', 'Deleted', 'Inactive')
        AND (
            LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) LIKE '31%' 
            OR LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) LIKE '32%'
            OR ISNULL(d.DepartmentFName, '') LIKE '%Brigade%' 
            OR ISNULL(d.DepartmentFName, '') LIKE '%Utopia%'
        )

      ORDER BY BiometricCode ASC;
    `;

    const res = await pool.request().query(sqlQuery);
    console.log(`\n=== CLEAN QUERY RESULT (31xxx & 32xxx Present) ===`);
    console.log(`Total Present Employees: ${res.recordset.length}`);
    const sec32 = res.recordset.filter(r => r.BiometricCode.startsWith('32'));
    const mep31 = res.recordset.filter(r => r.BiometricCode.startsWith('31'));
    console.log(`31xxx Series (MEP): ${mep31.length}`);
    console.log(`32xxx Series (Security): ${sec32.length}`);
    console.table(res.recordset.slice(0, 15));
    await pool.close();
  } catch (err) {
    console.error('Database query error:', err);
  }
}

testCleanQuery();
