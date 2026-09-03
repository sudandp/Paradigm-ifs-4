-- ====================================================================================================
-- DIAGNOSTIC QUERY FOR ABDUL KHADAR (420001)
-- Run this in SSMS to see why Day 20 shows 'A' on the Basic Report
-- ====================================================================================================

USE [etimetracklite1];
GO

SELECT 
    a.AttendanceLogId,
    CONVERT(VARCHAR(10), a.AttendanceDate, 120) AS AttendanceDate,
    a.InTime,
    a.OutTime,
    a.Duration,
    a.LateBy,
    a.EarlyBy,
    a.IsOnLeave,
    a.LeaveType,
    a.WeeklyOff,
    a.Holiday,
    a.ShiftId,
    a.Present,
    a.Absent,
    a.Status,
    a.StatusCode,
    a.P1Status,
    a.P2Status,
    a.P3Status,
    a.IsonSpecialOff,
    a.OverTime,
    a.MissedOutPunch,
    a.MissedInPunch,
    a.Remarks,
    CAST(a.PunchRecords AS VARCHAR(MAX)) AS PunchRecords
FROM dbo.AttendanceLogs a
JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
WHERE e.EmployeeCode = '420001'
  AND a.AttendanceDate >= '2026-08-18' AND a.AttendanceDate <= '2026-08-22'
ORDER BY a.AttendanceDate;
GO

-- Also check if there is an entry in EmployeeShiftSchedule or EmpShiftFromRosters or LeaveEntries
SELECT * 
FROM dbo.LeaveEntries l
JOIN dbo.Employees e ON l.EmployeeId = e.EmployeeId
WHERE e.EmployeeCode = '420001'
  AND l.LeaveDate >= '2026-08-18' AND l.LeaveDate <= '2026-08-22';
GO

SELECT * 
FROM dbo.EmployeeShiftSchedule ess
JOIN dbo.Employees e ON ess.EmployeeId = e.EmployeeId
WHERE e.EmployeeCode = '420001'
  AND ess.ShiftDate >= '2026-08-18' AND ess.ShiftDate <= '2026-08-22';
GO
