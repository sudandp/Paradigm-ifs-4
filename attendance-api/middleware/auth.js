/**
 * middleware/auth.js
 * API Key Authentication Middleware
 */

const env = require('../config/env');

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.headers['x-api-secret'] || req.query.apiKey;

  if (!env.API_SECRET) {
    console.warn('[Auth] WARNING: No API_SECRET set — all requests allowed. Set API_SECRET in .env!');
    return next();
  }

  if (key !== env.API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized — invalid API key' });
  }

  next();
}

module.exports = {
  requireApiKey,
};
