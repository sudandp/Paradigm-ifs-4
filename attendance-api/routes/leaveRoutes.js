/**
 * routes/leaveRoutes.js
 * Leave synchronization router (dbo.LeaveEntries)
 */

const express = require('express');
const router = express.Router();
const leaveService = require('../services/leaveService');
const { requireApiKey } = require('../middleware/auth');

// Synchronize an approved leave entry into eTimeTrackLite
router.post(['/essl/sync-leave', '/api/essl/sync-leave'], requireApiKey, async (req, res, next) => {
  try {
    const result = await leaveService.syncLeaveEntry(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// List configured leave types
router.get(['/essl/leave-types', '/api/essl/leave-types'], requireApiKey, async (req, res, next) => {
  try {
    const result = await leaveService.getLeaveTypes();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
