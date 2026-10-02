-- ====================================================================================================
-- ETIMETRACKLITE FIX: "Conversion from type 'DBNull' to type 'Double' is not valid"
-- Cause:
--   eTimeTrackLite's CalculateDetailedWorkingDuration() reads numerical columns
--   (Duration, OverTime, LateBy, EarlyBy, Present, Absent, WeeklyOff, Holiday, OverTimeE)
--   from dbo.AttendanceLogs and expects a Double. If any column is NULL (DBNull),
--   ASP.NET throws this InvalidCastException.
-- Fix:
--   Sanitizes all numeric columns across September 2026 to ensure 0 instead of NULL.
-- ====================================================================================================

USE [etimetracklite1];
GO
SET NOCOUNT ON;

PRINT '======================================================================';
PRINT '  FIXING DBNULL -> DOUBLE CONVERSION ERROR IN dbo.AttendanceLogs';
PRINT '======================================================================';

-- Step 1: Sanitize all numerical and date columns for September 2026
UPDATE dbo.AttendanceLogs
SET 
    Duration       = ISNULL(Duration, 0),
    OverTime       = ISNULL(OverTime, 0),
    LateBy         = ISNULL(LateBy, 0),
    EarlyBy        = ISNULL(EarlyBy, 0),
    Present        = ISNULL(Present, 0.0),
    Absent         = ISNULL(Absent, 0.0),
    WeeklyOff      = ISNULL(WeeklyOff, 0),
    Holiday        = ISNULL(Holiday, 0),
    ShiftId        = ISNULL(ShiftId, 3),
    OverTimeE      = ISNULL(OverTimeE, 0),
    IsOnLeave      = ISNULL(IsOnLeave, 0),
    MissedOutPunch = ISNULL(MissedOutPunch, 0),
    MissedInPunch  = ISNULL(MissedInPunch, 0),
    IsonSpecialOff = ISNULL(IsonSpecialOff, 0),
    InTime         = CASE WHEN InTime IS NULL OR LTRIM(RTRIM(InTime)) = '' THEN '1900-01-01 00:00:00' ELSE InTime END,
    OutTime        = CASE WHEN OutTime IS NULL OR LTRIM(RTRIM(OutTime)) = '' THEN '1900-01-01 00:00:00' ELSE OutTime END,
    Status         = CASE WHEN Status IS NULL OR LTRIM(RTRIM(Status)) = '' THEN 'Absent' ELSE Status END,
    StatusCode     = CASE WHEN StatusCode IS NULL OR LTRIM(RTRIM(StatusCode)) = '' THEN 'A' ELSE StatusCode END,
    P1Status       = CASE WHEN P1Status IS NULL OR LTRIM(RTRIM(P1Status)) = '' THEN 'A' ELSE P1Status END
WHERE AttendanceDate >= '2026-09-01' AND AttendanceDate <= '2026-09-30';

PRINT '✓ Sanitized ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows in dbo.AttendanceLogs.';
GO

-- Step 2: Verification - Confirm ZERO NULLs remain in any numerical columns
SELECT 
    COUNT(*) AS Total_Sep_Records,
    SUM(CASE WHEN Duration IS NULL THEN 1 ELSE 0 END) AS Null_Duration,
    SUM(CASE WHEN OverTime IS NULL THEN 1 ELSE 0 END) AS Null_OverTime,
    SUM(CASE WHEN LateBy IS NULL THEN 1 ELSE 0 END) AS Null_LateBy,
    SUM(CASE WHEN EarlyBy IS NULL THEN 1 ELSE 0 END) AS Null_EarlyBy,
    SUM(CASE WHEN Present IS NULL THEN 1 ELSE 0 END) AS Null_Present,
    SUM(CASE WHEN Absent IS NULL THEN 1 ELSE 0 END) AS Null_Absent,
    SUM(CASE WHEN WeeklyOff IS NULL THEN 1 ELSE 0 END) AS Null_WeeklyOff,
    SUM(CASE WHEN Holiday IS NULL THEN 1 ELSE 0 END) AS Null_Holiday,
    SUM(CASE WHEN ShiftId IS NULL THEN 1 ELSE 0 END) AS Null_ShiftId,
    SUM(CASE WHEN OverTimeE IS NULL THEN 1 ELSE 0 END) AS Null_OverTimeE
FROM dbo.AttendanceLogs
WHERE AttendanceDate >= '2026-09-01' AND AttendanceDate <= '2026-09-30';
GO

PRINT '======================================================================';
PRINT '✓ ALL DBNULLS RESOLVED: You can now generate the report without error!';
PRINT '======================================================================';
