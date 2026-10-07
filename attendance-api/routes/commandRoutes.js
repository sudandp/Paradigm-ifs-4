/**
 * routes/commandRoutes.js
 * Hardware commands router (Remote Face/FP Enrollment, Block/Unblock, Live Command Telemetry)
 */

const express = require('express');
const router = express.Router();
const commandService = require('../services/commandService');
const { requireApiKey } = require('../middleware/auth');

// Remote biometric enrollment prompt on physical device
router.post(['/essl/enroll-biometric', '/api/essl/enroll-biometric'], requireApiKey, async (req, res, next) => {
  try {
    const result = await commandService.enrollBiometric(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Remotely block or unblock user access at biometric terminals
router.post(['/essl/block-unblock-user', '/api/essl/block-unblock-user'], requireApiKey, async (req, res, next) => {
  try {
    const result = await commandService.blockUnblockUser(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Check status of a queued hardware command
router.get(['/essl/command-status/:commandId', '/api/essl/command-status/:commandId', '/essl/command-status', '/api/essl/command-status'], requireApiKey, async (req, res, next) => {
  try {
    const commandId = req.params.commandId || req.query.commandId;
    if (!commandId) {
      return res.status(400).json({ success: false, error: 'commandId parameter is required' });
    }
    const result = await commandService.getCommandStatus(commandId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// List recent commands for the telemetry dashboard
router.get(['/essl/commands', '/api/essl/commands'], requireApiKey, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '30', 10);
    const sn = req.query.serialNumber || null;
    const result = await commandService.listRecentCommands({ limit, serialNumber: sn });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
