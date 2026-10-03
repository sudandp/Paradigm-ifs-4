USE [etimetracklite1];
GO

SET NOCOUNT ON;

-- 1. Repair single-punch days (if employee punched once, award standard 8h duty)
UPDATE a
SET 
    a.OutTime = DATEADD(hour, 8, a.InTime),
    a.Duration = 480
FROM dbo.AttendanceLogs a
WHERE a.AttendanceDate >= '2026-09-01' AND a.AttendanceDate <= '2026-09-30'
  AND a.StatusCode = 'P'
  AND (a.InTime = a.OutTime OR a.Duration = 0)
  AND a.InTime > '1900-01-01 00:00:00';

-- 2. Synchronize Universal Shield
IF OBJECT_ID('dbo.ExcelAttendanceMaster_UniversalShield') IS NOT NULL
BEGIN
    UPDATE u
    SET 
        u.InTime = a.InTime,
        u.OutTime = a.OutTime,
        u.Duration = a.Duration
    FROM dbo.ExcelAttendanceMaster_UniversalShield u
    INNER JOIN dbo.AttendanceLogs a 
        ON a.EmployeeId = u.EmployeeId 
       AND CAST(a.AttendanceDate AS DATE) = CAST(u.AttendanceDate AS DATE)
    WHERE a.AttendanceDate >= '2026-09-01' AND a.AttendanceDate <= '2026-09-30';
END

-- 3. View exact HH:MM:SS biometric punch timestamps (Duration cast to INT for modulo compatibility)
SELECT 
    e.EmployeeCode,
    e.EmployeeName,
    CONVERT(VARCHAR(10), a.AttendanceDate, 120) AS AttendanceDate,
    a.StatusCode,
    ISNULL(s.ShiftFName, s.ShiftSName) AS ShiftName,
    CASE 
        WHEN a.InTime <= '1900-01-01 00:00:00' THEN '--:--:--'
        ELSE CONVERT(VARCHAR(8), a.InTime, 108) 
    END AS Exact_InTime,
    CASE 
        WHEN a.OutTime <= '1900-01-01 00:00:00' THEN '--:--:--'
        ELSE CONVERT(VARCHAR(8), a.OutTime, 108) 
    END AS Exact_OutTime,
    CAST(a.Duration AS INT) AS WorkedMinutes,
    CAST(CAST(a.Duration AS INT) / 60 AS VARCHAR(5)) + 'h ' + CAST(CAST(a.Duration AS INT) % 60 AS VARCHAR(5)) + 'm' AS WorkedHours
FROM dbo.AttendanceLogs a
INNER JOIN dbo.Employees e ON e.EmployeeId = a.EmployeeId
LEFT JOIN dbo.Shifts s ON s.ShiftId = a.ShiftId
WHERE e.EmployeeCode IN ('31056', '31099', '31015')
  AND a.AttendanceDate >= '2026-09-01' AND a.AttendanceDate <= '2026-09-10'
ORDER BY e.EmployeeCode, a.AttendanceDate;
GO
