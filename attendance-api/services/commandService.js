/**
 * services/commandService.js
 * eSSL Biometric Hardware Command Queue Engine (dbo.DeviceCommands)
 * Handles Remote Face/FP Enrollment, Block/Unblock, and Live Command Telemetry
 */

const { getPool, sql } = require('../config/db');

/**
 * Queue a remote biometric enrollment on an eSSL terminal
 */
async function enrollBiometric({ employeeCode, serialNumber, biometricType = 'fingerprint' }) {
  if (!employeeCode) throw new Error('employeeCode is required');
  if (!serialNumber) throw new Error('serialNumber (device SN) is required');

  const p = await getPool();

  // 1. Verify employee exists
  const empCheck = await p.request()
    .input('empCode', sql.VarChar, String(employeeCode).trim())
    .query('SELECT TOP 1 EmployeeId, EmployeeCode, EmployeeName FROM dbo.Employees WHERE EmployeeCode = @empCode');

  if (!empCheck.recordset.length) {
    throw new Error(`Employee with code ${employeeCode} does not exist in eTimeTrackLite`);
  }
  const employee = empCheck.recordset[0];

  // 2. Format command string for eSSL / ADMS protocol
  const cmdTitle = biometricType.toLowerCase() === 'face' ? 'ENROLL_FACE' : 'ENROLL_FP';
  const cmdString = biometricType.toLowerCase() === 'face'
    ? `ENROLL_FACE PIN=${employee.EmployeeCode}`
    : `ENROLL_FP PIN=${employee.EmployeeCode}\tRETRY=3`;

  // 3. Insert into dbo.DeviceCommands
  const insertRes = await p.request()
    .input('title', sql.NVarChar(255), cmdTitle)
    .input('cmd', sql.NText, cmdString)
    .input('sn', sql.NVarChar(100), String(serialNumber).trim())
    .input('status', sql.NVarChar(50), 'Pending')
    .input('type', sql.NVarChar(50), 'Command')
    .query(`
      INSERT INTO dbo.DeviceCommands (Title, DeviceCommand, SerialNumber, Status, Type, CreationDate)
      OUTPUT INSERTED.DeviceCommandId, INSERTED.CreationDate
      VALUES (@title, @cmd, @sn, @status, @type, GETDATE())
    `);

  const created = insertRes.recordset[0];

  return {
    success: true,
    commandId: created.DeviceCommandId,
    employeeCode: employee.EmployeeCode,
    employeeName: employee.EmployeeName,
    serialNumber,
    biometricType,
    status: 'Pending',
    createdAt: created.CreationDate,
    message: `Remote ${biometricType} enrollment command queued for device ${serialNumber}. Machine will prompt employee upon check-in/heartbeat.`,
  };
}

/**
 * Remotely lock or restore an employee's access at biometric terminals
 */
async function blockUnblockUser({ employeeCode, block = true, serialNumbers = [] }) {
  if (!employeeCode) throw new Error('employeeCode is required');

  const p = await getPool();
  const empCodeStr = String(employeeCode).trim();

  // 1. Fetch employee
  const empCheck = await p.request()
    .input('empCode', sql.VarChar, empCodeStr)
    .query('SELECT TOP 1 EmployeeId, EmployeeCode, EmployeeName, Status FROM dbo.Employees WHERE EmployeeCode = @empCode');

  if (!empCheck.recordset.length) {
    throw new Error(`Employee with code ${employeeCode} not found`);
  }
  const employee = empCheck.recordset[0];

  // 2. Update status in dbo.Employees
  const newEmpStatus = block ? 'Suspended' : 'Working';
  await p.request()
    .input('empCode', sql.VarChar, empCodeStr)
    .input('newStatus', sql.NVarChar(50), newEmpStatus)
    .query('UPDATE dbo.Employees SET Status = @newStatus WHERE EmployeeCode = @empCode');

  // 3. Resolve target devices
  let targetSns = serialNumbers;
  if (!targetSns || !targetSns.length) {
    // If no specific devices provided, broadcast to all active devices in dbo.Devices
    const devRes = await p.request().query('SELECT SerialNumber FROM dbo.Devices WHERE SerialNumber IS NOT NULL AND LEN(SerialNumber) > 0');
    targetSns = devRes.recordset.map(r => r.SerialNumber);
  }

  const queuedCommands = [];
  const disableFlag = block ? '1' : '0';
  const cmdTitle = block ? 'BLOCK_USER' : 'UNBLOCK_USER';
  const cmdPayload = `DATA USER PIN=${empCodeStr}\tDisable=${disableFlag}`;

  for (const sn of targetSns) {
    if (!sn) continue;
    try {
      const qRes = await p.request()
        .input('title', sql.NVarChar(255), cmdTitle)
        .input('cmd', sql.NText, cmdPayload)
        .input('sn', sql.NVarChar(100), sn)
        .input('status', sql.NVarChar(50), 'Pending')
        .input('type', sql.NVarChar(50), 'Command')
        .query(`
          INSERT INTO dbo.DeviceCommands (Title, DeviceCommand, SerialNumber, Status, Type, CreationDate)
          OUTPUT INSERTED.DeviceCommandId
          VALUES (@title, @cmd, @sn, @status, @type, GETDATE())
        `);
      queuedCommands.push({ commandId: qRes.recordset[0].DeviceCommandId, serialNumber: sn });
    } catch (err) {
      console.warn(`[CommandService] Failed to queue block/unblock command for device ${sn}:`, err.message);
    }
  }

  return {
    success: true,
    employeeCode: empCodeStr,
    employeeName: employee.EmployeeName,
    action: block ? 'blocked' : 'unblocked',
    updatedEmployeeStatus: newEmpStatus,
    commandsQueuedCount: queuedCommands.length,
    queuedCommands,
    message: `Employee ${empCodeStr} successfully ${block ? 'blocked' : 'unblocked'}. Commands dispatched to ${queuedCommands.length} terminals.`,
  };
}

/**
 * Check execution status of an async device command
 */
async function getCommandStatus(commandId) {
  if (!commandId) throw new Error('commandId is required');

  const p = await getPool();
  const res = await p.request()
    .input('cmdId', sql.Int, parseInt(commandId, 10))
    .query(`
      SELECT
        DeviceCommandId AS commandId,
        Title AS title,
        SerialNumber AS serialNumber,
        Status AS rawStatus,
        Type AS type,
        CreationDate AS creationDate,
        ExecutionDate AS executionDate
      FROM dbo.DeviceCommands
      WHERE DeviceCommandId = @cmdId
    `);

  if (!res.recordset.length) {
    return { success: false, found: false, commandId, message: 'Command not found' };
  }

  const row = res.recordset[0];
  let normalizedStatus = 'Pending';
  const rawLower = String(row.rawStatus || '').toLowerCase();

  if (rawLower === '1' || rawLower.includes('success') || rawLower.includes('ok') || row.executionDate) {
    normalizedStatus = 'Success';
  } else if (rawLower === '2' || rawLower.includes('fail') || rawLower.includes('error')) {
    normalizedStatus = 'Failed';
  } else if (rawLower.includes('sent')) {
    normalizedStatus = 'Sent';
  }

  return {
    success: true,
    found: true,
    commandId: row.commandId,
    title: row.title,
    serialNumber: row.serialNumber,
    status: normalizedStatus,
    rawStatus: row.rawStatus,
    creationDate: row.creationDate,
    executionDate: row.executionDate,
  };
}

/**
 * List recent commands in the queue for telemetry
 */
async function listRecentCommands({ limit = 30, serialNumber = null }) {
  const p = await getPool();
  const req = p.request().input('lim', sql.Int, Math.min(100, Math.max(1, limit)));

  let filter = '';
  if (serialNumber) {
    req.input('sn', sql.NVarChar(100), serialNumber);
    filter = 'WHERE SerialNumber = @sn';
  }

  const res = await req.query(`
    SELECT TOP (@lim)
      DeviceCommandId AS commandId,
      Title AS title,
      SerialNumber AS serialNumber,
      Status AS status,
      Type AS type,
      CreationDate AS creationDate,
      ExecutionDate AS executionDate
    FROM dbo.DeviceCommands
    ${filter}
    ORDER BY DeviceCommandId DESC
  `);

  return {
    success: true,
    commands: res.recordset,
    total: res.recordset.length,
  };
}

module.exports = {
  enrollBiometric,
  blockUnblockUser,
  getCommandStatus,
  listRecentCommands,
};
