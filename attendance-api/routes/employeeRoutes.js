/**
 * routes/employeeRoutes.js
 * eSSL employee management, bulk update, policy, shift-groups, and holidays
 */

const express = require('express');
const router = express.Router();
const employeeService = require('../services/employeeService');
const { requireApiKey } = require('../middleware/auth');

// Single employee update
router.post(['/update-employee', '/api/update-employee'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.updateEmployeeSingle(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /essl/employees & /api/essl/employees
router.get(['/essl/employees', '/api/essl/employees'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.getEmployees(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /essl/departments & /api/essl/departments
router.get(['/essl/departments', '/api/essl/departments'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.getDepartments();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /essl/companies & /api/essl/companies
router.get(['/essl/companies', '/api/essl/companies'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.getCompanies();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /essl/categories & /api/essl/categories
router.get(['/essl/categories', '/api/essl/categories'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.getCategories();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /essl/shift-groups & /api/essl/shift-groups
router.get(['/essl/shift-groups', '/api/essl/shift-groups'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.getShiftGroups();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /essl/add-employee & /api/essl/add-employee
router.post(['/essl/add-employee', '/api/essl/add-employee'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.addEmployee(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /essl/update-employee-details & /api/essl/update-employee-details
router.post(['/essl/update-employee-details', '/api/essl/update-employee-details'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.updateEmployeeDetails(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /essl/bulk-update-employees & aliases
router.post(
  ['/essl/bulk-update-employees', '/api/essl/bulk-update-employees', '/bulk-update-employees', '/api/bulk-update-employees'],
  requireApiKey,
  async (req, res, next) => {
    try {
      const result = await employeeService.bulkUpdateEmployees(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /essl/delete-employee & /api/essl/delete-employee
router.post(['/essl/delete-employee', '/api/essl/delete-employee'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.deleteEmployee(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /essl/set-weekly-off & /api/essl/set-weekly-off
router.post(['/essl/set-weekly-off', '/api/essl/set-weekly-off'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.setWeeklyOff(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /essl/holidays & /api/essl/holidays
router.get(['/essl/holidays', '/api/essl/holidays'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.getHolidays(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /essl/set-holiday & /api/essl/set-holiday
router.post(['/essl/set-holiday', '/api/essl/set-holiday'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.setHoliday(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /essl/delete-holiday & /api/essl/delete-holiday
router.post(['/essl/delete-holiday', '/api/essl/delete-holiday'], requireApiKey, async (req, res, next) => {
  try {
    const result = await employeeService.deleteHoliday(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
