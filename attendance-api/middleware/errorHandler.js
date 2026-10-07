/**
 * middleware/errorHandler.js
 * Central error handling middleware. Catches unhandled errors and ensures process never terminates unexpectedly.
 */

function errorHandler(err, req, res, next) {
  const timestamp = new Date().toISOString();
  console.error(`[Error] [${timestamp}] ${req.method} ${req.originalUrl}:`, err.stack || err.message);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    timestamp,
    path: req.originalUrl,
  });
}

module.exports = errorHandler;
