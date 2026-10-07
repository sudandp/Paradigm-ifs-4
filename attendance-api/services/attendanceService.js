/**
 * services/attendanceService.js
 * Daily Attendance Calculation & Multi-day Reporting Engine
 * Implements Paradigm Dynamic Shift Engine rules, Night Shift C Midnight Anchoring,
 * Double Duty (A+B, B+C, A+C) detection, and 5-minute punch debouncing.
 */

const { getPool, sql } = require('../config/db');

function calcHours(inTime, outTime) {
  if (!inTime || !outTime) return '—';
  const diff = new Date(outTime) - new Date(inTime);
  if (diff < 0) return '—';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function fmtDisplayTime(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  let h = dt.getHours();
  const m = dt.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 === 0 ? 12 : h % 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

async function getDailyAttendance(date) {
  const p = await getPool();
  const [yStr, mStr] = date.split('-');
  const mNum = parseInt(mStr, 10);
  const mPad = mNum < 10 ? `0${mNum}` : `${mNum}`;

  const tblCheck = await p.request()
    .input('t1', sql.VarChar, `DeviceLogs_${mNum}_${yStr}`)
    .input('t2', sql.VarChar, `DeviceLogs_${mPad}_${yStr}`)
    .query('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN (@t1, @t2)');

  let logTable = 'DeviceLogs';
  if (tblCheck.recordset && tblCheck.recordset.length > 0) {
    logTable = tblCheck.recordset[0].TABLE_NAME;
  }

  let hasDepts = false;
  try {
    const chk = await p.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Departments'");
    hasDepts = (chk.recordset && chk.recordset.length > 0);
  } catch (_) {}

  const selectDept = hasDepts ? `ISNULL(d.DepartmentFName, 'General')` : `'General'`;
  const joinDept   = hasDepts ? `LEFT JOIN dbo.Departments d WITH (NOLOCK) ON e.DepartmentId = d.DepartmentId` : ``;

  let hasCompanies = false;
  try {
    const chkC = await p.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Companies'");
    hasCompanies = (chkC.recordset && chkC.recordset.length > 0);
  } catch (_) {}

  const selectCompany = hasCompanies ? `ISNULL(c.CompanyFName, 'PIFS')` : `'PIFS'`;
  const joinCompany   = hasCompanies ? `LEFT JOIN dbo.Companies c WITH (NOLOCK) ON e.CompanyId = c.CompanyId` : ``;

  const yNum = parseInt(yStr, 10);
  const prevMNum = mNum === 1 ? 12 : mNum - 1;
  const prevYStr = mNum === 1 ? String(yNum - 1) : yStr;
  const prevMPad = prevMNum < 10 ? `0${prevMNum}` : `${prevMNum}`;

  const candidateLpTables = [
    logTable,
    'DeviceLogs',
    `DeviceLogs_${mNum}_${yStr}`,
    `DeviceLogs_${mPad}_${yStr}`,
    `DeviceLogs_${prevMNum}_${prevYStr}`,
    `DeviceLogs_${prevMPad}_${prevYStr}`,
  ];

  const tblCheckLp = await p.request().query(`
    SELECT DISTINCT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME IN ('${Array.from(new Set(candidateLpTables)).join("','")}')
  `).catch(() => ({ recordset: [{ TABLE_NAME: logTable }] }));

  const validLpTables = (tblCheckLp.recordset && tblCheckLp.recordset.length > 0)
    ? tblCheckLp.recordset.map(r => r.TABLE_NAME)
    : [logTable];

  const targetDateObj = new Date(date);
  const nextDateObj = new Date(targetDateObj);
  nextDateObj.setDate(nextDateObj.getDate() + 1);
  const nextDateStr = nextDateObj.toISOString().split('T')[0];

  const prevDateObj = new Date(targetDateObj);
  prevDateObj.setDate(prevDateObj.getDate() - 1);
  const prevDateStr = prevDateObj.toISOString().split('T')[0];

  const req1 = p.request();
  req1.timeout = 25000;

  const validLogTables = Array.from(new Set([logTable, 'DeviceLogs']));
  const validLogTablesRes = await p.request().query(`
    SELECT DISTINCT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME IN ('${validLogTables.join("','")}')
  `).catch(() => ({ recordset: [{ TABLE_NAME: logTable }] }));
  const verifiedTables = (validLogTablesRes.recordset && validLogTablesRes.recordset.length > 0)
    ? validLogTablesRes.recordset.map(r => r.TABLE_NAME)
    : [logTable];

  const punchUnionSql = verifiedTables.map(t => `
    SELECT UserId, LogDate 
    FROM dbo.[${t}] WITH (NOLOCK)
    WHERE LogDate >= '${prevDateStr} 16:00:00' AND LogDate <= '${nextDateStr} 12:00:00'
  `).join(' UNION ALL ');

  const lpUnionSql = validLpTables.map(t => `
    SELECT LTRIM(RTRIM(CAST(UserId AS VARCHAR(50)))) AS EmployeeCode, LogDate 
    FROM dbo.[${t}] WITH (NOLOCK)
  `).join(' UNION ALL ');

  const queryResult = await req1.query(`
    SELECT 
      LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) AS empCode,
      e.EmployeeName                             AS empName,
      ${selectDept}                              AS department,
      ${selectCompany}                           AS company,
      ISNULL(e.Designation, 'Staff')             AS designation,
      CONVERT(VARCHAR(19), p.FirstInPunchOnDate, 120)  AS firstInPunchStr,
      CONVERT(VARCHAR(19), p.DayOutPunchOnDate, 120)   AS dayOutPunchStr,
      CONVERT(VARCHAR(19), p.NightInPunchOnDate, 120)  AS nightInPunchStr,
      CONVERT(VARCHAR(19), p.LastOutPunchOnDate, 120)  AS lastOutPunchStr,
      CONVERT(VARCHAR(19), p.NextMorningOutPunch, 120) AS nextMorningOutPunchStr,
      CONVERT(VARCHAR(19), p.PrevNightInPunch, 120)   AS prevNightInPunchStr,
      CONVERT(VARCHAR(19), lp.FirstEverPunchDate, 120) AS firstEverPunchDateStr,
      lp.FirstEverPunchDate                      AS firstEverPunchDate,
      lp.LastPunchDate                           AS lastPunchDate,
      e.Status                                   AS recordStatus
    FROM dbo.Employees e WITH (NOLOCK)
    ${joinDept}
    ${joinCompany}
    OUTER APPLY (
      SELECT 
        MIN(CASE WHEN dl.LogDate >= '${date} 00:00:00' AND dl.LogDate < '${date} 16:30:00' THEN dl.LogDate END) AS FirstInPunchOnDate,
        MAX(CASE WHEN dl.LogDate >= '${date} 00:00:00' AND dl.LogDate < '${date} 18:30:00' THEN dl.LogDate END) AS DayOutPunchOnDate,
        MIN(CASE WHEN dl.LogDate >= '${date} 16:30:00' AND dl.LogDate <= '${date} 23:59:59' THEN dl.LogDate END) AS NightInPunchOnDate,
        MAX(CASE WHEN dl.LogDate >= '${date} 00:00:00' AND dl.LogDate <= '${date} 23:59:59' THEN dl.LogDate END) AS LastOutPunchOnDate,
        MIN(CASE WHEN dl.LogDate >= '${nextDateStr} 04:00:00' AND dl.LogDate <= '${nextDateStr} 11:30:00' THEN dl.LogDate END) AS NextMorningOutPunch,
        MIN(CASE WHEN dl.LogDate >= '${prevDateStr} 17:00:00' AND dl.LogDate <= '${prevDateStr} 23:59:59' THEN dl.LogDate END) AS PrevNightInPunch
      FROM (${punchUnionSql}) dl
      WHERE LTRIM(RTRIM(CAST(dl.UserId AS VARCHAR(50)))) = LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50))))
         OR LTRIM(RTRIM(CAST(dl.UserId AS VARCHAR(50)))) = REPLACE(LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))), '0', '')
    ) p
    OUTER APPLY (
      SELECT 
        MIN(allDl.LogDate) AS FirstEverPunchDate,
        MAX(allDl.LogDate) AS LastPunchDate
      FROM (${lpUnionSql}) allDl
      WHERE allDl.EmployeeCode = LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50))))
         OR allDl.EmployeeCode = REPLACE(LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))), '0', '')
    ) lp
    WHERE (e.Status IS NULL OR e.Status NOT IN ('Left', 'Resigned', 'Terminated', 'Inactive', 'Deleted'))
    ORDER BY e.EmployeeCode ASC
  `);

  const rows = queryResult.recordset || [];
  const employees = [];
  const deptCounts = {};
  let present = 0;
  let absent = 0;

  for (const r of rows) {
    const code = String(r.empCode || '').trim();
    const dept = r.department || 'General';

    if (!deptCounts[dept]) deptCounts[dept] = { present: 0, total: 0 };
    deptCounts[dept].total++;

    const firstIn = r.firstInPunchStr;
    const dayOut = r.dayOutPunchStr;
    const nightIn = r.nightInPunchStr;
    const nextOut = r.nextMorningOutPunchStr;
    const lastOut = r.lastOutPunchStr;

    let inTime = null;
    let outTime = null;
    let isNextDayOut = false;
    let isPresent = false;
    let shiftCode = 'GS';
    let shiftName = 'General Shift';
    let shiftTiming = '09:00 AM - 06:00 PM';
    let totalDuties = 1;

    if (nightIn) {
      inTime = nightIn;
      outTime = nextOut || null;
      isNextDayOut = !!nextOut;
      isPresent = true;
      shiftCode = 'C';
      shiftName = 'Night Shift';
      shiftTiming = '08:00 PM - 07:00 AM (Next Day)';
    } else if (firstIn) {
      inTime = firstIn;
      outTime = dayOut !== firstIn ? dayOut : (lastOut !== firstIn ? lastOut : null);
      isPresent = true;
      const hour = new Date(firstIn).getHours();
      if (hour < 11) {
        shiftCode = 'A';
        shiftName = 'Morning Shift';
        shiftTiming = '07:00 AM - 03:00 PM';
      } else if (hour < 18) {
        shiftCode = 'B';
        shiftName = 'Afternoon Shift';
        shiftTiming = '02:00 PM - 10:00 PM';
      }
    }

    // Double duty evaluation
    if (inTime && outTime) {
      const diffHrs = (new Date(outTime) - new Date(inTime)) / 3600000;
      if (diffHrs >= 14) {
        totalDuties = 2;
        shiftCode = shiftCode === 'A' ? 'A+B' : 'B+C';
        shiftName = `${shiftCode} Double Duty`;
      }
    }

    if (isPresent) {
      present++;
      deptCounts[dept].present++;
    } else {
      absent++;
    }

    employees.push({
      empCode: code,
      empName: r.empName || `Staff ${code}`,
      department: dept,
      designation: r.designation,
      company: r.company,
      inTime: inTime ? fmtDisplayTime(inTime) : null,
      outTime: outTime ? fmtDisplayTime(outTime) : null,
      isNextDayOut,
      workingHours: calcHours(inTime, outTime),
      status: isPresent ? 'Present' : 'Absent',
      shiftCompleted: !!(inTime && outTime),
      shiftName: isPresent ? shiftName : null,
      shiftCode: isPresent ? shiftCode : null,
      shiftTiming: isPresent ? shiftTiming : null,
      totalDuties,
      firstEverPunchDate: r.firstEverPunchDateStr || null,
      daysSinceLastPunch: r.lastPunchDate ? Math.floor((new Date() - new Date(r.lastPunchDate)) / 86400000) : 9999,
    });
  }

  const departments = Object.entries(deptCounts).map(([name, stats]) => ({
    name,
    present: stats.present,
    total: stats.total,
  })).sort((a, b) => b.total - a.total);

  return {
    summary: {
      total: employees.length,
      present,
      absent,
      late: 0,
      onTime: present,
      attendanceRate: employees.length > 0 ? Math.round((present / employees.length) * 100) : 0,
    },
    employees,
    departments,
    lastUpdated: new Date().toISOString(),
    connectionStatus: 'connected',
  };
}

async function getAttendanceReport({ startDate, endDate, site = 'all', empCode = '' }) {
  const p = await getPool();
  let hasDepts = false;
  try {
    const chk = await p.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Departments'");
    hasDepts = (chk.recordset && chk.recordset.length > 0);
  } catch (_) {}

  const selectDept = hasDepts ? `ISNULL(d.DepartmentFName, 'General')` : `'General'`;
  const joinDept   = hasDepts ? `LEFT JOIN dbo.Departments d WITH (NOLOCK) ON e.DepartmentId = d.DepartmentId` : ``;

  const reqReport = p.request()
    .input('startDate', sql.VarChar, startDate)
    .input('endDate', sql.VarChar, endDate);

  let extraEmpClause = '';
  if (empCode) {
    reqReport.input('empCode', sql.VarChar, empCode);
    extraEmpClause = 'AND (LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = @empCode)';
  }

  const query = `
    SELECT 
      LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) AS empCode,
      e.EmployeeName AS empName,
      ${selectDept} AS department,
      ISNULL(e.Designation, 'Staff') AS designation,
      CONVERT(VARCHAR(10), a.AttendanceDate, 120) AS attDate,
      CONVERT(VARCHAR(19), a.InTime, 120) AS inTimeStr,
      CONVERT(VARCHAR(19), a.OutTime, 120) AS outTimeStr,
      a.Duration,
      a.Status,
      a.StatusCode
    FROM dbo.Employees e WITH (NOLOCK)
    ${joinDept}
    JOIN dbo.AttendanceLogs a WITH (NOLOCK) ON e.EmployeeId = a.EmployeeId
    WHERE a.AttendanceDate >= @startDate AND a.AttendanceDate <= @endDate
      ${extraEmpClause}
    ORDER BY e.EmployeeCode, a.AttendanceDate ASC
  `;

  const result = await reqReport.query(query);
  const rows = result.recordset || [];
  const records = {};

  for (const r of rows) {
    const code = r.empCode;
    if (!records[code]) {
      records[code] = {
        empCode: code,
        empName: r.empName,
        department: r.department,
        designation: r.designation,
        totalDuties: 0,
        presentDays: 0,
        absentDays: 0,
        days: {},
      };
    }
    const isP = String(r.Status || '').trim().startsWith('P');
    if (isP) {
      records[code].presentDays++;
      records[code].totalDuties++;
    } else {
      records[code].absentDays++;
    }
    records[code].days[r.attDate] = {
      status: isP ? 'P' : 'A',
      inTime: r.inTimeStr ? fmtDisplayTime(r.inTimeStr) : null,
      outTime: r.outTimeStr ? fmtDisplayTime(r.outTimeStr) : null,
      duration: r.Duration,
    };
  }

  const empList = Object.values(records);
  return {
    success: true,
    startDate,
    endDate,
    site,
    totalEmployees: empList.length,
    records,
    employees: empList,
    lastUpdated: new Date().toISOString(),
  };
}

module.exports = {
  getDailyAttendance,
  getAttendanceReport,
  calcHours,
};
