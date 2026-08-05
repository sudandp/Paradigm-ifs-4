const sql = require('mssql');

const config = {
  server: 'localhost',
  database: 'master',
  user: 'sa',
  password: 'Paradigm@1610',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: 'SQLEXPRESS',
    enableArithAbort: true,
  },
};

async function findDatabases() {
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    console.log('✅ Connected to SQL Server!');
    
    const res = await pool.request().query(`SELECT name FROM sys.databases`);
    console.log('\nList of all databases on this SQL Server:');
    res.recordset.forEach(r => console.log('  -> ' + r.name));

    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

findDatabases();
