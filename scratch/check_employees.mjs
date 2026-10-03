import sql from 'mssql';

async function check() {
  const configs = [
    {
      server: 'localhost',
      database: 'etimetracklite1',
      options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
      driver: 'msnodesqlv8',
      connectionString: 'Driver={SQL Server Native Client 11.0};Server=.\\SQLEXPRESS;Database=etimetracklite1;Trusted_Connection=yes;'
    },
    {
      server: 'localhost\\SQLEXPRESS',
      database: 'etimetracklite1',
      user: 'sa',
      password: '',
      options: { encrypt: false, trustServerCertificate: true }
    },
    {
      server: '127.0.0.1',
      database: 'etimetracklite1',
      user: 'sa',
      password: 'sa',
      options: { encrypt: false, trustServerCertificate: true }
    }
  ];

  for (const cfg of configs) {
    try {
      console.log('Trying config...');
      const pool = await sql.connect(cfg);
      console.log('Connected!');
      const r = await pool.request().query(`
        SELECT EmployeeId, EmployeeCode, EmployeeName, DepartmentId, Designation 
        FROM dbo.Employees 
        WHERE EmployeeName LIKE '%Parvathi%' 
           OR EmployeeName LIKE '%KENA%' 
           OR EmployeeName LIKE '%Biswal%' 
           OR EmployeeName LIKE '%MRITYUNJAY%'
           OR EmployeeCode IN ('31109', '32086')
      `);
      console.log('Employees found:');
      console.table(r.recordset);
      
      const cols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'EmployeeShiftSchedule'
      `);
      console.log('EmployeeShiftSchedule columns:');
      console.table(cols.recordset);

      await pool.close();
      return;
    } catch (err) {
      console.log('Failed:', err.message);
    }
  }
}

check();
