require('dotenv').config();
const sql = require('mssql');

const DB_CONFIG = {
  server: 'localhost',
  database: process.env.DB_NAME || 'etimetracklite1',
  user:     process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Paradigm@1610',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || 'SQLEXPRESS',
    enableArithAbort: true,
  },
  connectionTimeout: 10000,
  requestTimeout: 30000,
};

async function getPool() {
  try {
    return await new sql.ConnectionPool(DB_CONFIG).connect();
  } catch (err) {
    const windowsConfig = {
      server: 'localhost',
      database: DB_CONFIG.database,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        instanceName: DB_CONFIG.options.instanceName,
        trustedConnection: true,
        enableArithAbort: true,
      },
    };
    return await new sql.ConnectionPool(windowsConfig).connect();
  }
}

(async () => {
  try {
    const pool = await getPool();
    console.log('Connected to MS SQL successfully!');

    // 1. Check Companies table
    const comps = await pool.request().query('SELECT CompanyId, CompanyFName, CompanySName FROM dbo.Companies');
    console.log('COMPANIES in MS SQL:', JSON.stringify(comps.recordset, null, 2));

    // 2. Check employee counts by company
    const empComps = await pool.request().query(`
      SELECT e.CompanyId, c.CompanyFName, c.CompanySName, COUNT(*) as cnt 
      FROM dbo.Employees e 
      LEFT JOIN dbo.Companies c ON e.CompanyId = c.CompanyId 
      WHERE ISNULL(e.RecordStatus, 1) = 1 
        AND ISNULL(e.Status, 'Working') NOT IN ('Resigned', 'Deleted', 'Inactive')
      GROUP BY e.CompanyId, c.CompanyFName, c.CompanySName
    `);
    console.log('ACTIVE EMPLOYEES BY COMPANY:', JSON.stringify(empComps.recordset, null, 2));

    // 3. Check Utopia (31 / 32) employees by company and designation
    const utopiaEmps = await pool.request().query(`
      SELECT e.CompanyId, c.CompanyFName, c.CompanySName, e.Designation, COUNT(*) as cnt
      FROM dbo.Employees e 
      LEFT JOIN dbo.Companies c ON e.CompanyId = c.CompanyId 
      WHERE (e.EmployeeCode LIKE '31%' OR e.EmployeeCode LIKE '32%')
        AND ISNULL(e.RecordStatus, 1) = 1 
        AND ISNULL(e.Status, 'Working') NOT IN ('Resigned', 'Deleted', 'Inactive')
      GROUP BY e.CompanyId, c.CompanyFName, c.CompanySName, e.Designation
      ORDER BY c.CompanyFName, e.Designation
    `);
    console.log('UTOPIA EMPLOYEES BREAKDOWN:', JSON.stringify(utopiaEmps.recordset, null, 2));

    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
