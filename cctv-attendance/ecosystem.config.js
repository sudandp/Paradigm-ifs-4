module.exports = {
  apps: [
    {
      name: 'attendance-api',
      script: 'server.js',
      cwd: 'C:/attendance-api',
      interpreter: 'node',
      autorestart: true,
      max_restarts: 10,
      env: {
        PORT: 4000,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'paradigm-cctv',
      script: 'main.py',
      cwd: 'C:/cctv-attendance',
      interpreter: 'python',
      autorestart: true,
      max_restarts: 10
    }
  ]
};
