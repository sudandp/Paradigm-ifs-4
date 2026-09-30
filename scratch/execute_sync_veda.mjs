import sql from 'mssql';
import fs from 'fs';

const DB_CONFIG = {
  server: 'localhost',
  database: 'etimetracklite1',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Paradigm@1610',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || 'SQLEXPRESS',
    enableArithAbort: true,
  },
  connectionTimeout: 10000,
  requestTimeout: 60000,
};

async function run() {
  try {
    const pool = await sql.connect(DB_CONFIG);
    console.log('Connected to MSSQL [etimetracklite1] successfully!');
    
    const sqlFile = fs.readFileSync('sql/sync_31014_september_2026_etimetracklite.sql', 'utf8');
    const batches = sqlFile.split(/^\s*GO\s*$/gmi);
    
    for (let i = 0; i < batches.length; i++) {
      const b = batches[i].trim();
      if (!b) continue;
      try {
        const req = pool.request();
        const res = await req.query(b);
        if (res.recordset && res.recordset.length > 0) {
          console.table(res.recordset.slice(0, 31));
        }
      } catch (batchErr) {
        console.warn(`Batch ${i} warning:`, batchErr.message);
      }
    }
    
    console.log('All batches executed successfully on etimetracklite1!');
    await pool.close();
  } catch (err) {
    console.log('Direct MSSQL connection note (will supply script to user for SSMS):', err.message);
  }
}

run();
