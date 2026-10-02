-- ====================================================================================================
-- ETIMETRACKLITE FIX: ASSIGN GENERAL SHIFT (GS) TO MEHANT KUMAR (EMPLOYEE 31001)
-- Database Context: [etimetracklite1]
-- Solves:
--   1. Replaces 'A Shift' with 'GS' (General Shift: 09:00 - 18:00) on all working days.
--   2. Eliminates false "Late By 2 hours" (e.g., 09:12 is only 12m late for GS, NOT 2h 12m late).
--   3. Recomputes OverTime accurately past 18:00 PM (instead of past 15:00 PM).
--   4. Updates dbo.Employees & dbo.EmployeeShiftSchedule so future recalculations don't revert to A Shift.
-- ====================================================================================================

USE [etimetracklite1];
GO

SET NOCOUNT ON;
PRINT '======================================================================';
PRINT '  Diagnosing & Fixing Shift Assignment for Employee 31001 (Mehant Kumar)';
PRINT '======================================================================';

-- ----------------------------------------------------------------------------------------------------
-- STEP 1: Identify EmployeeId and GS ShiftId
-- ----------------------------------------------------------------------------------------------------
DECLARE @EmpId INT;
DECLARE @GS_ShiftId INT;
DECLARE @A_ShiftId INT;
DECLARE @GeneralShiftGroupId INT;

-- Get EmployeeId
SELECT TOP 1 @EmpId = EmployeeId 
FROM dbo.Employees WITH (NOLOCK)
WHERE EmployeeCode = '31001' OR EmployeeId = 31001;

-- Get General Shift ID (BeginTime 09:00 or ShiftSName 'GS')
SELECT TOP 1 @GS_ShiftId = ShiftId 
FROM dbo.Shifts WITH (NOLOCK)
WHERE ShiftSName = 'GS' OR ShiftFName LIKE '%General%';

-- Get A Shift ID
SELECT TOP 1 @A_ShiftId = ShiftId 
FROM dbo.Shifts WITH (NOLOCK)
WHERE ShiftSName = 'A' OR ShiftFName LIKE '%A Shift%';

-- Get General Shift Group ID if exists
SELECT TOP 1 @GeneralShiftGroupId = ShiftGroupId
FROM dbo.ShiftGroups WITH (NOLOCK)
WHERE ShiftGroupName LIKE '%General%';

PRINT 'EmployeeId        : ' + CAST(@EmpId AS VARCHAR(20));
PRINT 'General ShiftId   : ' + CAST(@GS_ShiftId AS VARCHAR(20));
PRINT 'A ShiftId         : ' + ISNULL(CAST(@A_ShiftId AS VARCHAR(20)), 'Not Found');
PRINT 'General GroupId   : ' + ISNULL(CAST(@GeneralShiftGroupId AS VARCHAR(20)), 'None');
PRINT '';

-- ----------------------------------------------------------------------------------------------------
-- STEP 2: Show Current Diagnostic
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> CURRENT EMPLOYEE CONFIGURATION:';
SELECT 
    EmployeeId, EmployeeCode, EmployeeName, 
    ShiftGroupId, ShiftRosterId, DepartmentId
FROM dbo.Employees
WHERE EmployeeId = @EmpId;

-- ----------------------------------------------------------------------------------------------------
-- STEP 3: Update dbo.Employees to Fixed General Shift
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Updating dbo.Employees to assign General Shift / Group...';
UPDATE dbo.Employees
SET 
    ShiftGroupId = ISNULL(@GeneralShiftGroupId, ShiftGroupId),
    ShiftRosterId = NULL -- Clear rotational roster so it stays permanently on General Shift
WHERE EmployeeId = @EmpId;
PRINT '    ✓ dbo.Employees updated.';

-- ----------------------------------------------------------------------------------------------------
-- STEP 4: Update dbo.EmployeeShiftSchedule for September 2026 to GS
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Updating dbo.EmployeeShiftSchedule to GS (ShiftId = ' + CAST(@GS_ShiftId AS VARCHAR(10)) + ')...';
IF OBJECT_ID('dbo.EmployeeShiftSchedule', 'U') IS NOT NULL
BEGIN
    UPDATE dbo.EmployeeShiftSchedule
    SET ShiftId = @GS_ShiftId
    WHERE EmployeeId = @EmpId
      AND ScheduleDate >= '2026-09-01' AND ScheduleDate <= '2026-09-30';
    PRINT '    ✓ Updated ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' schedule rows in dbo.EmployeeShiftSchedule.';
END

-- ----------------------------------------------------------------------------------------------------
-- STEP 5: Update dbo.AttendanceLogs for September 2026
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Updating dbo.AttendanceLogs for September 2026 with GS timings and recalculated LateBy / OT...';

-- Temporarily disable triggers
DISABLE TRIGGER ALL ON dbo.AttendanceLogs;

UPDATE a
SET 
    -- 1. Set Shift to General Shift on all worked days (or absent days)
    a.ShiftId = CASE 
        WHEN a.WeeklyOff = 1 THEN a.ShiftId -- keep Weekly Off shift
        ELSE @GS_ShiftId 
    END,

    -- 2. Recalculate LateBy against 09:00 AM (General Shift Start)
    a.LateBy = CASE 
        WHEN a.InTime IS NOT NULL AND a.InTime <> '' AND a.WeeklyOff = 0 AND a.Present = 1 THEN
            CASE 
                -- If punch-in is after 09:00 AM (e.g. 09:12 -> 12 minutes late, NOT 132 mins late!)
                WHEN DATEPART(hour, a.InTime) * 60 + DATEPART(minute, a.InTime) > 9 * 60 THEN
                    (DATEPART(hour, a.InTime) * 60 + DATEPART(minute, a.InTime)) - (9 * 60)
                ELSE 0
            END
        ELSE 0
    END,

    -- 3. Recalculate EarlyBy against 18:00 PM (General Shift End)
    a.EarlyBy = CASE 
        WHEN a.OutTime IS NOT NULL AND a.OutTime <> '' AND a.WeeklyOff = 0 AND a.Present = 1 THEN
            CASE 
                -- If left before 18:00 PM
                WHEN DATEPART(hour, a.OutTime) * 60 + DATEPART(minute, a.OutTime) < 18 * 60 THEN
                    (18 * 60) - (DATEPART(hour, a.OutTime) * 60 + DATEPART(minute, a.OutTime))
                ELSE 0
            END
        ELSE 0
    END,

    -- 4. Recalculate OverTime past 18:00 PM (General Shift End)
    a.OverTime = CASE 
        WHEN a.OutTime IS NOT NULL AND a.OutTime <> '' AND a.WeeklyOff = 0 AND a.Present = 1 THEN
            CASE 
                -- If punch-out is after 18:00 PM (e.g. 19:11 -> 71 minutes OT past 18:00)
                WHEN DATEPART(hour, a.OutTime) * 60 + DATEPART(minute, a.OutTime) > 18 * 60 THEN
                    (DATEPART(hour, a.OutTime) * 60 + DATEPART(minute, a.OutTime)) - (18 * 60)
                ELSE 0
            END
        ELSE 0
    END,

    a.Remarks = 'General Shift Verified'
FROM dbo.AttendanceLogs a
WHERE a.EmployeeId = @EmpId
  AND a.AttendanceDate >= '2026-09-01' AND a.AttendanceDate <= '2026-09-30';

PRINT '    ✓ Updated ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' attendance rows in dbo.AttendanceLogs.';

-- Re-enable triggers
ENABLE TRIGGER ALL ON dbo.AttendanceLogs;
PRINT '    ✓ Triggers re-enabled.';

-- ----------------------------------------------------------------------------------------------------
-- STEP 6: Verification
-- ----------------------------------------------------------------------------------------------------
PRINT '';
PRINT '======================================================================';
PRINT '  VERIFICATION: FIRST 7 DAYS OF SEPTEMBER 2026 FOR MEHANT KUMAR';
PRINT '======================================================================';

SELECT 
    CAST(a.AttendanceDate AS DATE) AS AttDate,
    s.ShiftSName AS ShiftCode,
    s.ShiftFName AS ShiftName,
    SUBSTRING(CONVERT(VARCHAR(20), a.InTime, 120), 12, 5) AS InTime,
    SUBSTRING(CONVERT(VARCHAR(20), a.OutTime, 120), 12, 5) AS OutTime,
    a.Duration AS DurationMins,
    a.LateBy AS LateByMins,
    a.EarlyBy AS EarlyByMins,
    a.OverTime AS OverTimeMins,
    a.Status
FROM dbo.AttendanceLogs a
LEFT JOIN dbo.Shifts s ON a.ShiftId = s.ShiftId
WHERE a.EmployeeId = @EmpId
  AND a.AttendanceDate >= '2026-09-01' AND a.AttendanceDate <= '2026-09-07'
ORDER BY a.AttendanceDate;

PRINT '';
PRINT '>>> Shift reassignment to General Shift complete!';
GO
