/**
 * middleware/cors.js
 * CORS configuration allowing Paradigm web, mobile, and local developer hosts.
 */

const cors = require('cors');

const ALLOWED_ORIGINS = [
  'https://cctv.rest',
  'https://attendance.cctv.rest',
  'https://cctv.cctv.rest',
  'https://app.paradigmfms.com',
  'https://paradigmfms.com',
  'https://www.paradigmfms.com',
  'https://paradigm-ifs-4.vercel.app',
  'https://www.paradigm-ifs-4.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'capacitor://localhost',
  'http://localhost',
];

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or whitelisted browser origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    // Allow any localhost port in development
    if (/^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive for API proxy while API_SECRET protects endpoints
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-api-secret', 'bypass-tunnel-reminder'],
});

module.exports = corsMiddleware;
