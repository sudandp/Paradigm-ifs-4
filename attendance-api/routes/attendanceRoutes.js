/**
 * routes/attendanceRoutes.js
 * Daily Attendance & Multi-day Reporting Matrix endpoints
 */

const express = require('express');
const router = express.Router();
const attendanceService = require('../services/attendanceService');
const { requireApiKey } = require('../middleware/auth');

// GET /attendance & /api/attendance
router.get(['/attendance', '/api/attendance'], requireApiKey, async (req, res, next) => {
  const date = (req.query.date || '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? req.query.date
    : new Date().toISOString().slice(0, 10);

  try {
    const result = await attendanceService.getDailyAttendance(date);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /attendance-report & /api/attendance-report
router.get(['/attendance-report', '/api/attendance-report'], requireApiKey, async (req, res, next) => {
  const startDate = (req.query.startDate || '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? req.query.startDate
    : new Date().toISOString().slice(0, 8) + '01';
  const endDate = (req.query.endDate || '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? req.query.endDate
    : new Date().toISOString().slice(0, 10);
  const site = (req.query.site || req.query.siteId || 'all').trim();
  const empCode = (req.query.empCode || '').trim();

  try {
    const result = await attendanceService.getAttendanceReport({ startDate, endDate, site, empCode });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
