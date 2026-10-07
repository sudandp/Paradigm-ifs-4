/**
 * routes/deviceRoutes.js
 * Biometric device telemetry and raw punch log routes
 */

const express = require('express');
const router = express.Router();
const deviceService = require('../services/deviceService');
const { requireApiKey } = require('../middleware/auth');

// GET /devices & /api/devices
router.get(['/devices', '/api/devices'], requireApiKey, async (req, res, next) => {
  try {
    const result = await deviceService.getDevices();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /device-logs & /api/device-logs
router.get(['/device-logs', '/api/device-logs'], requireApiKey, async (req, res, next) => {
  const date = (req.query.date || '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? req.query.date
    : new Date().toISOString().slice(0, 10);
  const empCode = (req.query.empCode || req.query.userId || '').trim();
  const isRaw = req.query.raw === 'true' || req.query.raw === '1';

  try {
    const { debouncedList, logsByEmp, rawAllList } = await deviceService.fetchRawDeviceLogsForDate(date);

    if (isRaw) {
      const allForDisplay = rawAllList.map((p, idx) => ({
        id: `raw-${idx}-${p.emp_code}-${p.log_date}`,
        downloadDate: p.download_date,
        userId: p.emp_code,
        logDate: p.log_date,
        deviceName: p.device_name,
        serialNo: p.serial_no,
        attState: p.direction ? (p.direction.toLowerCase() === 'in' ? 'Check In' : 'Check Out') : '',
        verifyMode: p.verify_mode || 'VS_FACE',
        gps: '',
        attPhoto: 'View',
      }));
      const filtered = empCode
        ? allForDisplay.filter(p => p.userId === empCode)
        : allForDisplay;
      return res.json({
        date,
        empCode: empCode || null,
        count: filtered.length,
        totalRaw: filtered.length,
        punches: filtered,
      });
    }

    if (empCode) {
      const empLogs = logsByEmp.get(empCode) || [];
      return res.json({ date, empCode, count: empLogs.length, punches: empLogs });
    }

    return res.json({
      date,
      totalPunches: debouncedList.length,
      totalEmployees: logsByEmp.size,
      punches: debouncedList.slice(0, 200),
      note: debouncedList.length > 200 ? 'Showing first 200 punches. Filter by empCode for specific logs.' : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// GET /essl/devices & /api/essl/devices
router.get(['/essl/devices', '/api/essl/devices'], requireApiKey, async (req, res, next) => {
  try {
    const result = await deviceService.getEsslDevices();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /essl/add-device & /api/essl/add-device
router.post(['/essl/add-device', '/api/essl/add-device'], requireApiKey, async (req, res, next) => {
  try {
    const result = await deviceService.addEsslDevice(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /essl/delete-device & /api/essl/delete-device
router.post(['/essl/delete-device', '/api/essl/delete-device'], requireApiKey, async (req, res, next) => {
  try {
    const result = await deviceService.deleteEsslDevice(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
