import sql from 'mssql';

const configs = [
  {
    server: '127.0.0.1',
    database: 'etimetracklite1',
    user: 'sa',
    password: '',
    options: { encrypt: false, trustServerCertificate: true, instanceName: 'SQLEXPRESS' },
    connectionTimeout: 5000,
  },
  {
    server: 'localhost',
    database: 'etimetracklite1',
    user: 'sa',
    password: '',
    options: { encrypt: false, trustServerCertificate: true, instanceName: 'SQLEXPRESS' },
    connectionTimeout: 5000,
  },
  {
    server: '127.0.0.1',
    database: 'etimetracklite1',
    options: { encrypt: false, trustServerCertificate: true, trustedConnection: true },
    connectionTimeout: 5000,
  }
];

async function run() {
  for (const cfg of configs) {
    try {
      console.log('Trying cfg with server:', cfg.server, 'instance:', cfg.options.instanceName);
      const pool = await new sql.ConnectionPool(cfg).connect();
      console.log('Connected successfully!');
      
      const emp = await pool.request().query(`
        SELECT EmployeeId, EmployeeCode, EmployeeName, ShiftGroupId, ShiftRosterId, DepartmentId
        FROM dbo.Employees
        WHERE EmployeeCode = '31001' OR EmployeeId = 31001;
      `);
      console.log('EMPLOYEE:', JSON.stringify(emp.recordset, null, 2));

      const shifts = await pool.request().query(`
        SELECT ShiftId, ShiftFName, ShiftSName, BeginTime, EndTime, ShiftDuration, PunchBeginDuration, PunchEndDuration
        FROM dbo.Shifts;
      `);
      console.log('SHIFTS:', JSON.stringify(shifts.recordset, null, 2));

      const sGroups = await pool.request().query(`SELECT * FROM dbo.ShiftGroups;`);
      console.log('SHIFT GROUPS:', JSON.stringify(sGroups.recordset, null, 2));

      try {
        const sRosters = await pool.request().query(`SELECT * FROM dbo.ShiftRosterDetails;`);
        console.log('ROSTER DETAILS:', JSON.stringify(sRosters.recordset, null, 2));
      } catch(e) {
        console.log('ShiftRosterDetails err:', e.message);
      }

      const att = await pool.request().query(`
        SELECT TOP 10 a.AttendanceDate, a.ShiftId, s.ShiftFName, s.ShiftSName, a.InTime, a.OutTime, a.Duration, a.LateBy, a.EarlyBy, a.OverTime
        FROM dbo.AttendanceLogs a
        LEFT JOIN dbo.Shifts s ON a.ShiftId = s.ShiftId
        WHERE (a.EmployeeId = 31001 OR a.EmployeeId = (SELECT TOP 1 EmployeeId FROM dbo.Employees WHERE EmployeeCode='31001'))
          AND a.AttendanceDate >= '2026-09-01'
        ORDER BY a.AttendanceDate;
      `);
      console.log('ATTENDANCE LOGS (first 10 days):', JSON.stringify(att.recordset, null, 2));

      pool.close();
      return;
    } catch(err) {
      console.log('Failed:', err.message);
    }
  }
}
run();
