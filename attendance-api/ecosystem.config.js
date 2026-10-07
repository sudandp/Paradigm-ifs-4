/**
 * ecosystem.config.js
 * PM2 Enterprise Process Supervisor Configuration
 * Keeps attendance-api alive 24/7 with automatic restart, memory limits, and log management.
 */

module.exports = {
  apps: [
    {
      name: 'attendance-api',
      script: './server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      listen_timeout: 8000,
      kill_timeout: 5000,
    },
  ],
};
