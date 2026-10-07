/**
 * services/employeeService.js
 * Employee CRUD, department, company, shift group, and holiday management
 */

const { getPool, sql } = require('../config/db');

async function getEmployees({ search = '', companyId, departmentId, status = 'Working' }) {
  const p = await getPool();
  let where = 'WHERE 1=1';
  if (status) where += ` AND e.Status = '${status}'`;
  if (companyId) where += ` AND e.CompanyId = ${parseInt(companyId, 10)}`;
  if (departmentId) where += ` AND e.DepartmentId = ${parseInt(departmentId, 10)}`;
  if (search) where += ` AND (e.EmployeeCode LIKE '%${search}%' OR e.EmployeeName LIKE '%${search}%')`;

  const r = await p.request().query(`
    SELECT TOP 500
      e.EmployeeId, e.EmployeeCode, e.EmployeeName, e.CompanyId, e.DepartmentId,
      e.ShiftGroupId, e.CategoryId, e.Status, e.DateofJoining,
      sg.ShiftGroupFName AS ShiftGroupName,
      ISNULL(c.CategoryFName, c.CategorySName) AS CategoryName
    FROM dbo.Employees e
    LEFT JOIN dbo.ShiftGroups sg ON e.ShiftGroupId = sg.ShiftGroupId
    LEFT JOIN dbo.Categories c ON e.CategoryId = c.CategoryId
    ${where}
    ORDER BY e.EmployeeCode
  `);
  return { success: true, employees: r.recordset, total: r.recordset.length };
}

async function getDepartments() {
  const p = await getPool();
  const r = await p.request().query('SELECT DepartmentId, DepartmentFName AS DepartmentName, CompanyId FROM dbo.Departments ORDER BY DepartmentFName');
  return { success: true, departments: r.recordset };
}

async function getCompanies() {
  const p = await getPool();
  const r = await p.request().query('SELECT CompanyId, CompanyFName AS CompanyName FROM dbo.Companies ORDER BY CompanyFName');
  return { success: true, companies: r.recordset };
}

async function getCategories() {
  const p = await getPool();
  const r = await p.request().query('SELECT CategoryId, CategoryFName AS CategoryName FROM dbo.Categories ORDER BY CategoryFName');
  return { success: true, categories: r.recordset };
}

async function getShiftGroups() {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT sg.ShiftGroupId, sg.ShiftGroupFName AS ShiftGroupName,
      (SELECT STRING_AGG(s.ShiftSName, ', ') FROM dbo.ShiftGroupShifts sgs 
       JOIN dbo.Shifts s ON sgs.ShiftId = s.ShiftId 
       WHERE sgs.ShiftGroupId = sg.ShiftGroupId) AS Shifts
    FROM dbo.ShiftGroups sg ORDER BY sg.ShiftGroupFName
  `);
  return { success: true, shiftGroups: r.recordset };
}

async function addEmployee({
  employeeCode, employeeName, companyId, departmentId,
  shiftGroupId = 1, categoryId = 1, status = 'Working',
  dateOfJoining = new Date().toISOString().slice(0, 10),
  designation = '', employmentType = 'Permanent'
}) {
  if (!employeeCode || !employeeName || !companyId || !departmentId) {
    throw new Error('employeeCode, employeeName, companyId, departmentId are required');
  }

  const p = await getPool();
  const existing = await p.request()
    .input('code', sql.VarChar, String(employeeCode))
    .query('SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = @code');

  if (existing.recordset.length > 0) {
    const err = new Error(`Employee code '${employeeCode}' already exists`);
    err.statusCode = 409;
    throw err;
  }

  const insertResult = await p.request()
    .input('code', sql.VarChar, String(employeeCode))
    .input('name', sql.NVarChar, String(employeeName))
    .input('companyId', sql.Int, parseInt(companyId, 10))
    .input('deptId', sql.Int, parseInt(departmentId, 10))
    .input('shiftGroupId', sql.Int, parseInt(shiftGroupId, 10))
    .input('categoryId', sql.Int, parseInt(categoryId, 10))
    .input('status', sql.VarChar, String(status))
    .input('doj', sql.DateTime, new Date(dateOfJoining))
    .input('designation', sql.NVarChar, String(designation))
    .input('empType', sql.NVarChar, String(employmentType))
    .query(`
      INSERT INTO dbo.Employees (EmployeeCode, EmployeeName, CompanyId, DepartmentId,
        ShiftGroupId, CategoryId, Status, DateofJoining, Designation, EmploymentType, RecordStatus)
      OUTPUT INSERTED.EmployeeId
      VALUES (@code, @name, @companyId, @deptId, @shiftGroupId, @categoryId,
              @status, @doj, @designation, @empType, 1)
    `);

  const newEmployeeId = insertResult.recordset[0].EmployeeId;

  // Assign default shift
  await p.request()
    .input('empId', sql.Int, newEmployeeId)
    .input('from', sql.DateTime, new Date(dateOfJoining))
    .input('to', sql.DateTime, new Date('2099-12-31'))
    .input('shiftId', sql.Int, 5)
    .query('INSERT INTO dbo.EmployeeShift (EmployeeId, ShiftId, Fromdate, Todate) VALUES (@empId, @shiftId, @from, @to)');

  return { success: true, message: 'Employee added to eSSL successfully', employeeId: newEmployeeId, employeeCode };
}

async function updateEmployeeDetails({
  employeeCode, departmentId, companyId, shiftGroupId, categoryId, status, designation, employmentType
}) {
  if (!employeeCode) throw new Error('employeeCode is required');

  const p = await getPool();
  const updates = [];
  const request = p.request().input('code', sql.VarChar, String(employeeCode));

  if (departmentId !== undefined) { updates.push('DepartmentId = @deptId'); request.input('deptId', sql.Int, parseInt(departmentId, 10)); }
  if (companyId !== undefined)    { updates.push('CompanyId = @compId');  request.input('compId', sql.Int, parseInt(companyId, 10)); }
  if (shiftGroupId !== undefined) { updates.push('ShiftGroupId = @sgId'); request.input('sgId', sql.Int, parseInt(shiftGroupId, 10)); }
  if (categoryId !== undefined)   { updates.push('CategoryId = @catId');  request.input('catId', sql.Int, parseInt(categoryId, 10)); }
  if (status !== undefined)       { updates.push('Status = @status');     request.input('status', sql.VarChar, String(status)); }
  if (designation !== undefined)  { updates.push('Designation = @desig'); request.input('desig', sql.NVarChar, String(designation)); }
  if (employmentType !== undefined){ updates.push('EmploymentType = @empType'); request.input('empType', sql.NVarChar, String(employmentType)); }

  if (updates.length === 0) throw new Error('No fields to update');

  const result = await request.query(`UPDATE dbo.Employees SET ${updates.join(', ')} WHERE EmployeeCode = @code`);
  if (result.rowsAffected[0] === 0) {
    const err = new Error(`Employee '${employeeCode}' not found`);
    err.statusCode = 404;
    throw err;
  }

  return { success: true, message: 'Employee details updated in eSSL', employeeCode, updatedFields: updates };
}

async function updateEmployeeSingle({ empCode, empName, siteName, designation, companyName }) {
  if (!empCode) throw new Error('empCode is required');

  const p = await getPool();
  const r = p.request();
  r.input('empCode', sql.VarChar, String(empCode).trim());
  r.input('empName', sql.VarChar, String(empName || '').trim());
  r.input('siteName', sql.VarChar, String(siteName || '').trim());
  r.input('desig', sql.VarChar, String(designation || '').trim());
  r.input('compName', sql.VarChar, String(companyName || '').trim());

  let hasCompanies = false;
  try {
    const chkC = await p.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Companies'");
    hasCompanies = (chkC.recordset && chkC.recordset.length > 0);
  } catch (_) {}

  const companyUpdateSql = hasCompanies
    ? `e.CompanyId = CASE WHEN @compName <> '' THEN ISNULL(
         (SELECT TOP 1 CompanyId FROM dbo.Companies WHERE CompanyFName LIKE '%' + @compName + '%' OR CompanySName LIKE '%' + @compName + '%'),
         e.CompanyId
       ) ELSE e.CompanyId END,`
    : ``;

  const query = `
    UPDATE e
    SET 
      e.EmployeeName = CASE WHEN @empName <> '' THEN @empName ELSE e.EmployeeName END,
      e.Designation = CASE WHEN @desig <> '' THEN @desig ELSE e.Designation END,
      ${companyUpdateSql}
      e.DepartmentId = ISNULL(
        (SELECT TOP 1 DepartmentId FROM dbo.Departments WHERE DepartmentFName = @siteName OR DepartmentSName = @siteName),
        e.DepartmentId
      )
    FROM dbo.Employees e
    WHERE LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = @empCode;
  `;

  const result = await r.query(query);
  return { success: true, empCode, rowsAffected: result.rowsAffected[0] || 0 };
}

async function bulkUpdateEmployees({ updates }) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error('updates array is required and must not be empty');
  }

  const p = await getPool();
  let updatedCount = 0;
  const errors = [];

  let hasCompanies = false;
  try {
    const chkC = await p.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Companies'");
    hasCompanies = (chkC.recordset && chkC.recordset.length > 0);
  } catch (_) {}

  for (const item of updates) {
    const empCode = String(item.empCode || item.employeeCode || '').trim();
    if (!empCode) continue;

    try {
      const siteName = String(item.siteName || item.site || '').trim();
      const empName = String(item.empName || item.employeeName || '').trim();
      const desig = String(item.designation || '').trim();
      const compName = String(item.companyName || item.company || '').trim();

      if (siteName) {
        try {
          await p.request()
            .input('deptName', sql.VarChar, siteName)
            .query(`
              IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE DepartmentFName = @deptName OR DepartmentSName = @deptName)
              BEGIN
                INSERT INTO dbo.Departments (DepartmentFName, DepartmentSName) VALUES (@deptName, @deptName);
              END
            `);
        } catch (_) {}
      }

      const r = p.request();
      r.input('empCode', sql.VarChar, empCode);
      r.input('empName', sql.VarChar, empName);
      r.input('siteName', sql.VarChar, siteName);
      r.input('desig', sql.VarChar, desig);
      r.input('compName', sql.VarChar, compName);

      const companyUpdateSql = hasCompanies
        ? `e.CompanyId = CASE WHEN @compName <> '' THEN ISNULL(
             (SELECT TOP 1 CompanyId FROM dbo.Companies WHERE CompanyFName LIKE '%' + @compName + '%' OR CompanySName LIKE '%' + @compName + '%'),
             e.CompanyId
           ) ELSE e.CompanyId END,`
        : ``;

      const query = `
        UPDATE e
        SET 
          e.EmployeeName = CASE WHEN @empName <> '' THEN @empName ELSE e.EmployeeName END,
          e.Designation = CASE WHEN @desig <> '' THEN @desig ELSE e.Designation END,
          ${companyUpdateSql}
          e.DepartmentId = CASE WHEN @siteName <> '' THEN ISNULL(
            (SELECT TOP 1 DepartmentId FROM dbo.Departments WHERE DepartmentFName = @siteName OR DepartmentSName = @siteName),
            e.DepartmentId
          ) ELSE e.DepartmentId END
        FROM dbo.Employees e
        WHERE LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = @empCode
           OR LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = REPLACE(@empCode, '0', '');
      `;

      const result = await r.query(query);
      if (result.rowsAffected && result.rowsAffected[0] > 0) {
        updatedCount++;
      }
    } catch (empErr) {
      errors.push({ empCode, error: empErr.message });
    }
  }

  return {
    success: true,
    updatedCount,
    totalRequested: updates.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

async function deleteEmployee({ employeeCode, hardDelete = false, lastWorkingDate }) {
  if (!employeeCode) throw new Error('employeeCode is required');

  const p = await getPool();
  if (hardDelete) {
    const empRow = await p.request()
      .input('code', sql.VarChar, String(employeeCode))
      .query('SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = @code');
    if (empRow.recordset.length === 0) {
      const err = new Error('Employee not found');
      err.statusCode = 404;
      throw err;
    }
    const empId = empRow.recordset[0].EmployeeId;

    await p.request().input('empId', sql.Int, empId).query('DELETE FROM dbo.EmployeeShift WHERE EmployeeId = @empId');
    await p.request().input('empId', sql.Int, empId).query('DELETE FROM dbo.EmployeeShiftSchedule WHERE EmployeeId = @empId');
    await p.request().input('code', sql.VarChar, String(employeeCode)).query('DELETE FROM dbo.Employees WHERE EmployeeCode = @code');

    return { success: true, message: `Employee ${employeeCode} permanently deleted from eSSL`, type: 'hard' };
  } else {
    const req2 = p.request()
      .input('code', sql.VarChar, String(employeeCode))
      .input('status', sql.VarChar, 'Left');
    if (lastWorkingDate) req2.input('lwd', sql.DateTime, new Date(lastWorkingDate));
    const lwdStr = lastWorkingDate ? ', LastWorkingDay = @lwd' : '';
    const result = await req2.query(`UPDATE dbo.Employees SET Status = @status${lwdStr} WHERE EmployeeCode = @code`);
    if (result.rowsAffected[0] === 0) {
      const err = new Error('Employee not found');
      err.statusCode = 404;
      throw err;
    }
    return { success: true, message: `Employee ${employeeCode} marked as Left in eSSL`, type: 'soft' };
  }
}

async function setWeeklyOff({ employeeCode, categoryId, categoryName }) {
  if (!employeeCode || (!categoryId && !categoryName)) {
    throw new Error('employeeCode and (categoryId or categoryName) are required');
  }

  const p = await getPool();
  let catId = categoryId;
  if (!catId && categoryName) {
    const catRow = await p.request()
      .input('cn', sql.NVarChar, String(categoryName))
      .query('SELECT TOP 1 CategoryId FROM dbo.Categories WHERE CategoryName = @cn');
    if (catRow.recordset.length === 0) {
      const err = new Error(`Category '${categoryName}' not found`);
      err.statusCode = 404;
      throw err;
    }
    catId = catRow.recordset[0].CategoryId;
  }

  const result = await p.request()
    .input('code', sql.VarChar, String(employeeCode))
    .input('catId', sql.Int, parseInt(catId, 10))
    .query('UPDATE dbo.Employees SET CategoryId = @catId WHERE EmployeeCode = @code');

  if (result.rowsAffected[0] === 0) {
    const err = new Error('Employee not found');
    err.statusCode = 404;
    throw err;
  }

  return { success: true, message: `Weekly off updated for ${employeeCode}`, employeeCode, categoryId: catId };
}

async function getHolidays({ year = new Date().getFullYear(), companyId }) {
  const p = await getPool();
  let where = `WHERE YEAR(HolidayDate) = ${parseInt(year, 10)}`;
  if (companyId) where += ` AND (CompanyId = ${parseInt(companyId, 10)} OR CompanyId IS NULL)`;
  const r = await p.request().query(`SELECT HolidayId, HolidayName, HolidayDate, CompanyId FROM dbo.Holidays ${where} ORDER BY HolidayDate`);
  return { success: true, holidays: r.recordset, total: r.recordset.length };
}

async function setHoliday({ holidayName, holidayDate, companyId = null }) {
  if (!holidayName || !holidayDate) throw new Error('holidayName and holidayDate are required');

  const p = await getPool();
  const existing = await p.request()
    .input('hdate', sql.Date, new Date(holidayDate))
    .input('compId', sql.Int, companyId ? parseInt(companyId, 10) : null)
    .query('SELECT HolidayId FROM dbo.Holidays WHERE HolidayDate = @hdate AND (CompanyId = @compId OR (CompanyId IS NULL AND @compId IS NULL))');

  let message;
  if (existing.recordset.length > 0) {
    await p.request()
      .input('name', sql.NVarChar, String(holidayName))
      .input('hdate', sql.Date, new Date(holidayDate))
      .input('compId', sql.Int, companyId ? parseInt(companyId, 10) : null)
      .query('UPDATE dbo.Holidays SET HolidayName = @name WHERE HolidayDate = @hdate AND (CompanyId = @compId OR (CompanyId IS NULL AND @compId IS NULL))');
    message = `Holiday '${holidayName}' updated for ${holidayDate}`;
  } else {
    await p.request()
      .input('name', sql.NVarChar, String(holidayName))
      .input('hdate', sql.Date, new Date(holidayDate))
      .input('compId', sql.Int, companyId ? parseInt(companyId, 10) : null)
      .query('INSERT INTO dbo.Holidays (HolidayName, HolidayDate, CompanyId, RecordStatus) VALUES (@name, @hdate, @compId, 1)');
    message = `Holiday '${holidayName}' added for ${holidayDate}`;
  }

  return { success: true, message, holidayName, holidayDate, companyId };
}

async function deleteHoliday({ holidayDate, companyId = null }) {
  if (!holidayDate) throw new Error('holidayDate is required');

  const p = await getPool();
  const result = await p.request()
    .input('hdate', sql.Date, new Date(holidayDate))
    .input('compId', sql.Int, companyId ? parseInt(companyId, 10) : null)
    .query('DELETE FROM dbo.Holidays WHERE HolidayDate = @hdate AND (CompanyId = @compId OR (CompanyId IS NULL AND @compId IS NULL))');

  if (result.rowsAffected[0] === 0) {
    const err = new Error('Holiday not found for that date/company');
    err.statusCode = 404;
    throw err;
  }

  return { success: true, message: `Holiday on ${holidayDate} deleted` };
}

module.exports = {
  getEmployees,
  getDepartments,
  getCompanies,
  getCategories,
  getShiftGroups,
  addEmployee,
  updateEmployeeDetails,
  updateEmployeeSingle,
  bulkUpdateEmployees,
  deleteEmployee,
  setWeeklyOff,
  getHolidays,
  setHoliday,
  deleteHoliday,
};
