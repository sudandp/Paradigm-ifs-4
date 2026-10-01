-- ====================================================================================================
-- ETIMETRACKLITE MS SQL SCRIPT: N NAGA BUSHANA REDDY (EMP 32001)
-- Rebuild AttendanceLogs for AUGUST 2026 + SEPTEMBER 2026
-- Source: dbo.DeviceLogs (raw biometric punches already present)
-- Logic:  Per day → MIN punch = InTime, MAX punch = OutTime → Duration → Present
-- ====================================================================================================

USE [etimetracklite1];
GO

SET NOCOUNT ON;
PRINT '======================================================================';
PRINT '  [ETIMETRACKLITE] Rebuilding Aug+Sep 2026 AttendanceLogs for 32001';
PRINT '======================================================================';
PRINT '';

-- ----------------------------------------------------------------------------------------------------
-- STEP 0: Resolve EmployeeId & Disable Triggers
-- ----------------------------------------------------------------------------------------------------
DECLARE @EmpId INT;
DECLARE @EmpCode VARCHAR(50) = '32001';

SELECT TOP 1 @EmpId = EmployeeId
FROM dbo.Employees WITH (NOLOCK)
WHERE LTRIM(RTRIM(CAST(EmployeeCode AS VARCHAR(50)))) = @EmpCode
   OR EmployeeId = 32001;

IF @EmpId IS NULL
BEGIN
    SET @EmpId = 32001;
    PRINT '⚠ EmployeeId not matched in dbo.Employees, defaulting @EmpId = 32001';
END
ELSE
    PRINT '✓ Resolved Employee: Id = ' + CAST(@EmpId AS VARCHAR(20)) + ', Code = ' + @EmpCode;

PRINT '>>> Disabling triggers on dbo.AttendanceLogs...';
DISABLE TRIGGER ALL ON dbo.AttendanceLogs;
PRINT '    ✓ Triggers disabled.';
PRINT '';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 1: Clear Existing Aug & Sep 2026 AttendanceLogs for Employee 32001
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Clearing any existing Aug & Sep 2026 AttendanceLogs for 32001...';

DECLARE @EmpId2 INT;
SELECT TOP 1 @EmpId2 = EmployeeId
FROM dbo.Employees WITH (NOLOCK)
WHERE LTRIM(RTRIM(CAST(EmployeeCode AS VARCHAR(50)))) = '32001' OR EmployeeId = 32001;
IF @EmpId2 IS NULL SET @EmpId2 = 32001;

DELETE FROM dbo.AttendanceLogs
WHERE EmployeeId = @EmpId2
  AND AttendanceDate >= '2026-08-01'
  AND AttendanceDate <  '2026-10-01';

PRINT '    ✅ Cleared existing Aug+Sep 2026 records.';
PRINT '';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 2: Derive Daily Attendance from DeviceLogs → Insert into AttendanceLogs
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Rebuilding AttendanceLogs from DeviceLogs for Aug+Sep 2026...';

DECLARE @EmpId3 INT;
SELECT TOP 1 @EmpId3 = EmployeeId
FROM dbo.Employees WITH (NOLOCK)
WHERE LTRIM(RTRIM(CAST(EmployeeCode AS VARCHAR(50)))) = '32001' OR EmployeeId = 32001;
IF @EmpId3 IS NULL SET @EmpId3 = 32001;

INSERT INTO dbo.AttendanceLogs (
    EmployeeId, AttendanceDate, InTime, OutTime, Duration, PunchRecords,
    Status, StatusCode, P1Status,
    Present, Absent, WeeklyOff,
    Holiday, IsOnLeave, LateBy, EarlyBy, IsonSpecialOff,
    OverTime, OverTimeE, MissedOutPunch, MissedInPunch,
    ShiftId, Remarks
)
SELECT
    @EmpId3,
    CAST(d.LogDate AS DATE)                                             AS AttendanceDate,
    CAST(MIN(d.LogDate) AS NVARCHAR(255))                               AS InTime,
    CAST(MAX(d.LogDate) AS NVARCHAR(255))                               AS OutTime,
    DATEDIFF(MINUTE, MIN(d.LogDate), MAX(d.LogDate))                    AS Duration,
    CONVERT(VARCHAR(5), MIN(d.LogDate), 108) + ':in(1),' +
    CONVERT(VARCHAR(5), MAX(d.LogDate), 108) + ':out(1)'                AS PunchRecords,
    'Present '                                                          AS Status,
    'P'                                                                 AS StatusCode,
    'P'                                                                 AS P1Status,
    1.0, 0.0, 0,   -- Present, Absent, WeeklyOff
    0, 0, 0, 0, 0, -- Holiday, IsOnLeave, LateBy, EarlyBy, IsonSpecialOff
    0, 0,          -- OverTime, OverTimeE
    -- MissedOutPunch: flag if only 1 punch exists that day (IN = OUT)
    CASE WHEN MIN(d.LogDate) = MAX(d.LogDate) THEN 1 ELSE 0 END,
    0,             -- MissedInPunch
    1,             -- ShiftId
    'Rebuilt from DeviceLogs'
FROM dbo.DeviceLogs d WITH (NOLOCK)
WHERE (
        d.UserId = '32001'
     OR d.UserId = '032001'
     OR CAST(d.UserId AS VARCHAR(50)) = '32001'
     )
  AND d.LogDate >= '2026-08-01 00:00:00'
  AND d.LogDate <  '2026-10-01 00:00:00'
  AND NOT EXISTS (
        SELECT 1 FROM dbo.AttendanceLogs a WITH (NOLOCK)
        WHERE a.EmployeeId = @EmpId3
          AND CAST(a.AttendanceDate AS DATE) = CAST(d.LogDate AS DATE)
      )
GROUP BY CAST(d.LogDate AS DATE);

PRINT '    ✅ AttendanceLogs rebuilt from DeviceLogs.';
PRINT '';

-- Re-enable Triggers
PRINT '>>> Re-enabling triggers on dbo.AttendanceLogs...';
ENABLE TRIGGER ALL ON dbo.AttendanceLogs;
PRINT '    ✓ Triggers re-enabled.';
PRINT '';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 3: Verification — Show Rebuilt Records
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Verification: Rebuilt AttendanceLogs for 32001 (Aug+Sep 2026):';

SELECT
    e.EmployeeCode,
    e.EmployeeName,
    CONVERT(VARCHAR(10), a.AttendanceDate, 120)                         AS ShiftDate,
    a.InTime,
    a.OutTime,
    a.Duration                                                          AS DurationMins,
    CONVERT(VARCHAR(5), DATEADD(MINUTE, a.Duration, 0), 108)            AS WorkingTime,
    a.Status,
    a.StatusCode,
    a.Present,
    a.Absent,
    a.WeeklyOff,
    a.MissedOutPunch,
    a.Remarks
FROM dbo.AttendanceLogs a WITH (NOLOCK)
JOIN dbo.Employees e WITH (NOLOCK) ON a.EmployeeId = e.EmployeeId
WHERE (e.EmployeeCode = '32001' OR a.EmployeeId = 32001)
  AND a.AttendanceDate >= '2026-08-01'
  AND a.AttendanceDate <= '2026-09-30'
ORDER BY a.AttendanceDate;
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 4: Summary Count Check per Month
-- ----------------------------------------------------------------------------------------------------
SELECT
    CONVERT(VARCHAR(7), AttendanceDate, 120) AS YearMonth,
    COUNT(*)                                 AS TotalDays,
    SUM(CAST(Present AS INT))                AS PresentDays,
    SUM(WeeklyOff)                           AS WeeklyOffDays,
    SUM(CAST(Absent AS INT))                 AS AbsentDays,
    SUM(MissedOutPunch)                      AS SinglePunchDays
FROM dbo.AttendanceLogs WITH (NOLOCK)
WHERE EmployeeId IN (
    SELECT EmployeeId FROM dbo.Employees WITH (NOLOCK)
    WHERE LTRIM(RTRIM(CAST(EmployeeCode AS VARCHAR(50)))) = '32001' OR EmployeeId = 32001
)
  AND AttendanceDate >= '2026-08-01'
  AND AttendanceDate <= '2026-09-30'
GROUP BY CONVERT(VARCHAR(7), AttendanceDate, 120)
ORDER BY YearMonth;
GO

PRINT '';
PRINT '======================================================================';
PRINT '✅ COMPLETED: 32001 Aug+Sep 2026 AttendanceLogs Rebuilt from DeviceLogs';
PRINT '======================================================================';
GO
