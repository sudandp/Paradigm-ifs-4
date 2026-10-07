/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Paradigm FMS — Attendance API Proxy (Production 10/10 Architecture)
 *  Runs ON: WIN-0T8N581GN63 (SQL Server Host Machine)
 *  Connects to: SQL Server via localhost / Named Pipes
 *  Exposed via: Cloudflare Tunnel (HTTPS)
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const env = require('./config/env');
const { getPool } = require('./config/db');
const corsMiddleware = require('./middleware/cors');
const errorHandler = require('./middleware/errorHandler');

// Domain Routers
const systemRoutes = require('./routes/systemRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const commandRoutes = require('./routes/commandRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const syncRoutes = require('./routes/syncRoutes');
const cameraRoutes = require('./routes/cameraRoutes');

// Background Services
const { runAutoSync, scheduleYearlyCleanup } = require('./services/syncService');

const app = express();

// Global Middlewares
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));

// Mount Routes with Full Path Parity
app.use(systemRoutes);
app.use(attendanceRoutes);
app.use(deviceRoutes);
app.use(employeeRoutes);
app.use(commandRoutes);
app.use(leaveRoutes);
app.use(syncRoutes);
app.use(cameraRoutes);

// Global Error Boundary
app.use(errorHandler);

// Start HTTP Server
const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       Paradigm Attendance API — Enterprise Production v2    ║');
  console.log(`║  Status   : RUNNING on http://0.0.0.0:${env.PORT}                   ║`);
  console.log(`║  Database : ${env.DB_NAME}                                  ║`);
  console.log('║  Security : API Secret Guard + Cloudflare Tunnel Active      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Warm up database connection pool
  getPool().catch(err => console.error('[Startup] Initial DB connection notice:', err.message));

  // Initialize 5-minute Supabase auto-sync
  setTimeout(() => {
    console.log('[AutoSync] Initiating 5-minute continuous sync loop to Supabase...');
    runAutoSync();
    setInterval(runAutoSync, 5 * 60 * 1000);
  }, 30000);

  // Initialize yearly Jan 1 data cleanup schedule
  scheduleYearlyCleanup();
});

// Process Crash Protection & Graceful Shutdown
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception caught by supervisor:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection caught at:', promise, 'reason:', reason);
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Closing gracefully...');
  server.close(() => {
    console.log('[Server] Process terminated.');
    process.exit(0);
  });
});

module.exports = app;
