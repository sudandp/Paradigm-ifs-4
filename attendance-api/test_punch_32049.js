const mssql = require('mssql');
require('dotenv').config();

async function checkPunches() {
  try {
    const pool = await mssql.connect({
      server: 'localhost',
      database: 'etimetracklite1',
      options: { encrypt: false, trustServerCertificate: true, instanceName: 'SQLEXPRESS', trustedConnection: true },
    });

    console.log('--- RAW PUNCHES FOR 32049 ON 04 AUG & 05 AUG ---');
    const res = await pool.request().query(`
      SELECT UserId, LogDate, DeviceId 
      FROM dbo.DeviceLogs_8_2026 WITH (NOLOCK)
      WHERE LTRIM(RTRIM(CAST(UserId AS VARCHAR(50)))) = '32049'
        AND LogDate >= '2026-08-04 00:00:00' AND LogDate <= '2026-08-05 23:59:59'
      ORDER BY LogDate ASC
    `);

    console.log(res.recordset);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkPunches();
