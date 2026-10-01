-- ====================================================================================================
-- ETIMETRACKLITE MS SQL SCRIPT: BULK REBUILD AttendanceLogs for ALL EMPLOYEES
-- Months: AUGUST 2026 + SEPTEMBER 2026
-- Source: dbo.DeviceLogs + dbo.DeviceLogs_8_2026 + dbo.DeviceLogs_9_2026 (ALL partition tables)
-- Logic:  Per employee per day → MIN punch = InTime, MAX punch = OutTime → Present
-- FIX:    UNION ALL across main + partition tables (Sep punches were in DeviceLogs_9_2026 only)
-- ====================================================================================================

USE [etimetracklite1];
GO

SET NOCOUNT ON;
PRINT '======================================================================';
PRINT '  [BULK REBUILD v2] Aug+Sep 2026 AttendanceLogs for ALL Employees';
PRINT '  Sources: DeviceLogs + DeviceLogs_8_2026 + DeviceLogs_9_2026';
PRINT '======================================================================';
PRINT '';

-- ----------------------------------------------------------------------------------------------------
-- PRE-CHECK: Punch counts from ALL sources (main + partition tables)
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> PRE-CHECK: Punch counts per employee from ALL DeviceLog sources:';

SELECT
    e.EmployeeCode,
    e.EmployeeName,
    CONVERT(VARCHAR(7), d.LogDate, 120)     AS YearMonth,
    COUNT(DISTINCT CAST(d.LogDate AS DATE)) AS PunchDays,
    COUNT(*)                                AS TotalPunches
FROM (
    SELECT UserId, LogDate FROM dbo.DeviceLogs WITH (NOLOCK)
    WHERE LogDate >= '2026-08-01' AND LogDate < '2026-10-01'
    UNION ALL
    SELECT UserId, LogDate FROM dbo.DeviceLogs_8_2026 WITH (NOLOCK)
    WHERE LogDate >= '2026-08-01' AND LogDate < '2026-09-01'
    UNION ALL
    SELECT UserId, LogDate FROM dbo.DeviceLogs_9_2026 WITH (NOLOCK)
    WHERE LogDate >= '2026-09-01' AND LogDate < '2026-10-01'
) d
JOIN dbo.Employees e WITH (NOLOCK)
    ON LTRIM(RTRIM(CAST(d.UserId AS VARCHAR(50)))) = LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50))))
    OR CAST(d.UserId AS VARCHAR(50)) = CAST(e.EmployeeId AS VARCHAR(50))
GROUP BY e.EmployeeCode, e.EmployeeName, CONVERT(VARCHAR(7), d.LogDate, 120)
ORDER BY e.EmployeeCode, YearMonth;
GO

PRINT '';
PRINT '>>> Disabling triggers on dbo.AttendanceLogs...';
DISABLE TRIGGER ALL ON dbo.AttendanceLogs;
PRINT '    Triggers disabled.';
PRINT '';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 1: Clear Existing Aug+Sep 2026 AttendanceLogs (full clean rebuild)
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Clearing Aug+Sep 2026 AttendanceLogs for all employees...';

DELETE FROM dbo.AttendanceLogs
WHERE AttendanceDate >= '2026-08-01'
  AND AttendanceDate <  '2026-10-01';

PRINT '    Cleared. Rows deleted: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
PRINT '';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 2: BULK INSERT — Rebuild from ALL punch sources (main + both partition tables)
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Rebuilding AttendanceLogs from ALL DeviceLog sources (Aug+Sep 2026)...';

INSERT INTO dbo.AttendanceLogs (
    EmployeeId, AttendanceDate, InTime, OutTime, Duration, PunchRecords,
    Status, StatusCode, P1Status,
    Present, Absent, WeeklyOff,
    Holiday, IsOnLeave, LateBy, EarlyBy, IsonSpecialOff,
    OverTime, OverTimeE, MissedOutPunch, MissedInPunch,
    ShiftId, Remarks
)
SELECT
    e.EmployeeId,
    CAST(d.LogDate AS DATE)                                         AS AttendanceDate,
    CAST(MIN(d.LogDate) AS NVARCHAR(255))                           AS InTime,
    CAST(MAX(d.LogDate) AS NVARCHAR(255))                           AS OutTime,
    DATEDIFF(MINUTE, MIN(d.LogDate), MAX(d.LogDate))                AS Duration,
    CONVERT(VARCHAR(5), MIN(d.LogDate), 108) + ':in(1),' +
    CONVERT(VARCHAR(5), MAX(d.LogDate), 108) + ':out(1)'            AS PunchRecords,
    'Present '    AS Status,
    'P'           AS StatusCode,
    'P'           AS P1Status,
    1.0, 0.0, 0,
    0, 0, 0, 0, 0,
    0, 0,
    CASE WHEN MIN(d.LogDate) = MAX(d.LogDate) THEN 1 ELSE 0 END     AS MissedOutPunch,
    0,
    1,
    'Rebuilt from DeviceLogs'
FROM (
    -- KEY FIX: UNION ALL across main table + Aug partition + Sep partition
    SELECT UserId, LogDate FROM dbo.DeviceLogs WITH (NOLOCK)
    WHERE LogDate >= '2026-08-01' AND LogDate < '2026-10-01'
    UNION ALL
    SELECT UserId, LogDate FROM dbo.DeviceLogs_8_2026 WITH (NOLOCK)
    WHERE LogDate >= '2026-08-01' AND LogDate < '2026-09-01'
    UNION ALL
    SELECT UserId, LogDate FROM dbo.DeviceLogs_9_2026 WITH (NOLOCK)
    WHERE LogDate >= '2026-09-01' AND LogDate < '2026-10-01'
) d
JOIN dbo.Employees e WITH (NOLOCK)
    ON LTRIM(RTRIM(CAST(d.UserId AS VARCHAR(50)))) = LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50))))
    OR CAST(d.UserId AS VARCHAR(50)) = CAST(e.EmployeeId AS VARCHAR(50))
GROUP BY e.EmployeeId, CAST(d.LogDate AS DATE);

PRINT '    Bulk INSERT complete. Total rows inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
PRINT '';

-- ----------------------------------------------------------------------------------------------------
-- STEP 3: Re-enable Triggers
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Re-enabling triggers on dbo.AttendanceLogs...';
ENABLE TRIGGER ALL ON dbo.AttendanceLogs;
PRINT '    Triggers re-enabled.';
PRINT '';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 4: Verification Summary per Employee per Month
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> VERIFICATION: Aug+Sep 2026 Summary per Employee:';

SELECT
    e.EmployeeCode,
    e.EmployeeName,
    CONVERT(VARCHAR(7), a.AttendanceDate, 120)  AS YearMonth,
    COUNT(*)                                    AS TotalDays,
    SUM(CAST(a.Present AS INT))                 AS PresentDays,
    SUM(a.WeeklyOff)                            AS WeeklyOffDays,
    SUM(CAST(a.Absent AS INT))                  AS AbsentDays,
    SUM(a.MissedOutPunch)                       AS SinglePunchDays
FROM dbo.AttendanceLogs a WITH (NOLOCK)
JOIN dbo.Employees e WITH (NOLOCK) ON a.EmployeeId = e.EmployeeId
WHERE a.AttendanceDate >= '2026-08-01'
  AND a.AttendanceDate <= '2026-09-30'
GROUP BY e.EmployeeCode, e.EmployeeName,
         CONVERT(VARCHAR(7), a.AttendanceDate, 120)
ORDER BY e.EmployeeCode, YearMonth;
GO

PRINT '';
PRINT '======================================================================';
PRINT 'COMPLETED: ALL Employees Aug+Sep 2026 AttendanceLogs Rebuilt!';
PRINT '  Sources: DeviceLogs + DeviceLogs_8_2026 + DeviceLogs_9_2026';
PRINT '  Now try eTimeTrackLite Monthly Status Report for any employee.';
PRINT '======================================================================';
GO
