// Quick MS SQL connection test — run with: node test_mssql.mjs
import sql from 'mssql';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const config = {
  server: process.env.MSSQL_SERVER || 'WIN-0T8N581GN63',
  database: process.env.MSSQL_DATABASE || 'etimetrackite1',
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || '',
  port: parseInt(process.env.MSSQL_PORT || '1433', 10),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.MSSQL_INSTANCE || 'SQLEXPRESS',
  },
  connectionTimeout: 10000,
};

console.log('🔌 Testing MS SQL connection...');
console.log(`   Server  : ${config.server}\\${config.options.instanceName}`);
console.log(`   Database: ${config.database}`);
console.log(`   User    : ${config.user}`);
console.log(`   Port    : ${config.port}`);
console.log('');

try {
  const pool = await new sql.ConnectionPool(config).connect();
  console.log('✅ Connected successfully!\n');

  // List tables
  const result = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);

  console.log(`📋 Tables found in [${config.database}] (${result.recordset.length} tables):`);
  result.recordset.forEach((row, i) => {
    console.log(`   ${i + 1}. ${row.TABLE_NAME}`);
  });

  await pool.close();
} catch (err) {
  console.error('❌ Connection FAILED:', err.message);
  console.log('\n📌 Possible fixes:');
  console.log('   1. SQL Server might be on a different machine — check if WIN-0T8N581GN63 is reachable');
  console.log('   2. SQL Server Browser service might be stopped on that machine');
  console.log('   3. Firewall might be blocking port 1433');
  console.log('   4. Try connecting with the IP address instead of hostname');
}
