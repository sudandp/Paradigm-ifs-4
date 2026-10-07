/**
 * services/leaveService.js
 * eSSL Leave Entries & Types Synchronization (dbo.LeaveEntries, dbo.LeaveTypes)
 * Prevents eTimeTrackLite daily attendance calculations from marking approved leaves as Absent ('A').
 */

const { getPool, sql } = require('../config/db');

/**
 * Sync an approved leave entry into eTimeTrackLite
 */
async function syncLeaveEntry({
  employeeCode,
  leaveTypeId = 1,
  fromDate,
  toDate,
  remarks = 'Approved from Paradigm Office',
  approvedBy = 'Admin',
}) {
  if (!employeeCode) throw new Error('employeeCode is required');
  if (!fromDate) throw new Error('fromDate is required (YYYY-MM-DD)');
  const endD = toDate || fromDate;

  const p = await getPool();

  // 1. Fetch EmployeeId
  const empRes = await p.request()
    .input('empCode', sql.VarChar, String(employeeCode).trim())
    .query('SELECT TOP 1 EmployeeId, EmployeeName FROM dbo.Employees WHERE EmployeeCode = @empCode');

  if (!empRes.recordset.length) {
    throw new Error(`Employee with code ${employeeCode} not found in eTimeTrackLite`);
  }
  const employee = empRes.recordset[0];

  // 2. Insert into dbo.LeaveEntries
  const insRes = await p.request()
    .input('empId', sql.Int, employee.EmployeeId)
    .input('leaveTypeId', sql.Int, parseInt(leaveTypeId, 10))
    .input('fromDate', sql.DateTime, new Date(`${fromDate} 00:00:00`))
    .input('toDate', sql.DateTime, new Date(`${endD} 23:59:59`))
    .input('leaveStatus', sql.NVarChar(50), 'Approved')
    .input('isApproved', sql.Int, 1)
    .input('approvedBy', sql.NVarChar(100), approvedBy)
    .input('remarks', sql.NVarChar(255), remarks)
    .query(`
      INSERT INTO dbo.LeaveEntries (
        EmployeeId, LeaveTypeId, FromDate, ToDate,
        LeaveStatus, IsApproved, ApprovedBy, Remarks,
        CreatedDate, LastModifiedDate
      )
      OUTPUT INSERTED.LeaveEntryId, INSERTED.CreatedDate
      VALUES (
        @empId, @leaveTypeId, @fromDate, @toDate,
        @leaveStatus, @isApproved, @approvedBy, @remarks,
        GETDATE(), GETDATE()
      )
    `);

  const created = insRes.recordset[0];

  return {
    success: true,
    leaveEntryId: created.LeaveEntryId,
    employeeCode,
    employeeName: employee.EmployeeName,
    fromDate,
    toDate: endD,
    leaveStatus: 'Approved',
    message: `Leave successfully synchronized for ${employee.EmployeeName} (${fromDate} to ${endD}).`,
  };
}

/**
 * List available leave types from eTimeTrackLite
 */
async function getLeaveTypes() {
  const p = await getPool();
  const res = await p.request().query(`
    SELECT
      LeaveTypeId,
      ISNULL(LeaveTypeFName, 'Leave') AS leaveTypeName,
      ISNULL(LeaveTypeSName, '') AS shortName
    FROM dbo.LeaveTypes WITH (NOLOCK)
    ORDER BY LeaveTypeId
  `);

  return {
    success: true,
    leaveTypes: res.recordset,
    total: res.recordset.length,
  };
}

module.exports = {
  syncLeaveEntry,
  getLeaveTypes,
};
