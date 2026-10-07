/**
 * config/db.js
 * Resilient MS SQL connection pool with auto-reconnect and health checks.
 */

const sql = require('mssql');
const env = require('./env');

const DB_CONFIG = {
  server: env.DB_SERVER,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: env.DB_INSTANCE,
    enableArithAbort: true,
    trustedConnection: env.DB_TRUSTED,
  },
  pool: { max: 15, min: 2, idleTimeoutMillis: 60000 },
  connectionTimeout: 30000,
  requestTimeout: 120000,
};

let pool = null;

async function getPool() {
  if (pool && pool.connected) return pool;

  console.log('[DB] Connecting to SQL Server...');
  try {
    pool = await new sql.ConnectionPool(DB_CONFIG).connect();
    console.log('[DB] Connected to', DB_CONFIG.database, 'via SQL Auth');
  } catch (err) {
    console.warn(`[DB] SQL Auth failed (${err.message}), trying Windows Auth / Local Named Pipes...`);
    // Fallback: Trusted Windows Authentication
    const windowsConfig = {
      server: env.DB_SERVER,
      database: env.DB_NAME,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        instanceName: DB_CONFIG.options.instanceName,
        trustedConnection: true,
        enableArithAbort: true,
      },
    };
    pool = await new sql.ConnectionPool(windowsConfig).connect();
    console.log('[DB] Connected to', env.DB_NAME, 'via Windows Auth');
  }

  pool.on('error', (err) => {
    console.error('[DB] Pool error:', err.message);
    pool = null;
  });

  return pool;
}

module.exports = {
  getPool,
  sql,
  DB_CONFIG,
};
