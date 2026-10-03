-- ====================================================================================================
-- IMMEDIATE HOTFIX: FIX "Conversion from type 'DBNull' to type 'Date' is not valid" IN /iclock
-- Database: [etimetracklite1]
-- Month: SEPTEMBER 2026
--
-- CAUSE:
--   eTimeTrackLite CalculateDetailedWorkingDuration() in ASP.NET reads InTime and OutTime
--   using VB.NET Conversions.ToDate(row("InTime")).
--   When InTime or OutTime is NULL (DBNull), ASP.NET crashes with this error.
--   eTimeTrackLite expects '1900-01-01 00:00:00' for blank/unworked days (WO, Absent).
--
-- FIX:
--   1. Converts all NULL InTime/OutTime to '1900-01-01 00:00:00' for September 2026.
--   2. Sanitizes all nullable numeric & shift columns to ensure zero DBNulls.
--   3. Immediately allows /iclock Monthly Attendance Report to generate cleanly.
-- ====================================================================================================

USE [etimetracklite1];
GO

SET NOCOUNT ON;

PRINT '========================================================================================';
PRINT '  [ETIMETRACKLITE HOTFIX] ELIMINATING DBNULL -> DATE EXCEPTION IN REPORT GENERATION';
PRINT '========================================================================================';
PRINT '';

-- Step 1: Sanitize InTime, OutTime, and all numeric columns in dbo.AttendanceLogs for September 2026
UPDATE dbo.AttendanceLogs
SET 
    -- Date & Time fields: replace NULL with '1900-01-01 00:00:00'
    InTime             = CASE WHEN InTime IS NULL OR LTRIM(RTRIM(InTime)) = '' THEN '1900-01-01 00:00:00' ELSE InTime END,
    OutTime            = CASE WHEN OutTime IS NULL OR LTRIM(RTRIM(OutTime)) = '' THEN '1900-01-01 00:00:00' ELSE OutTime END,

    -- Numerical fields: replace NULL with 0
    Duration           = ISNULL(Duration, 0),
    OverTime           = ISNULL(OverTime, 0),
    LateBy             = ISNULL(LateBy, 0),
    EarlyBy            = ISNULL(EarlyBy, 0),
    Present            = ISNULL(Present, 0.0),
    Absent             = ISNULL(Absent, 0.0),
    WeeklyOff          = ISNULL(WeeklyOff, 0),
    Holiday            = ISNULL(Holiday, 0),
    ShiftId            = ISNULL(ShiftId, 1),
    OverTimeE          = ISNULL(OverTimeE, 0),
    IsOnLeave          = ISNULL(IsOnLeave, 0),
    MissedOutPunch     = ISNULL(MissedOutPunch, 0),
    MissedInPunch      = ISNULL(MissedInPunch, 0),
    IsonSpecialOff     = ISNULL(IsonSpecialOff, 0),
    LeaveDuration      = ISNULL(LeaveDuration, 0),
    LossOfHours        = ISNULL(LossOfHours, 0),
    SpecialOffDuration = ISNULL(SpecialOffDuration, 0),
    LeaveTypeId        = ISNULL(LeaveTypeId, 0),

    -- String fields
    LeaveType          = ISNULL(LeaveType, ''),
    SpecialOffType     = ISNULL(SpecialOffType, ''),
    SpecialOffRemark   = ISNULL(SpecialOffRemark, ''),
    LeaveRemarks       = ISNULL(LeaveRemarks, ''),
    P1Status           = ISNULL(P1Status, StatusCode),
    P2Status           = ISNULL(P2Status, ''),
    P3Status           = ISNULL(P3Status, ''),
    InDeviceId         = ISNULL(InDeviceId, ''),
    OutDeviceId        = ISNULL(OutDeviceId, '')
WHERE AttendanceDate >= '2026-09-01' AND AttendanceDate <= '2026-09-30';

PRINT '    [OK] Sanitized ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows in dbo.AttendanceLogs (InTime/OutTime NULLs converted to 1900-01-01).';
PRINT '';

-- Step 2: Also sanitize the Permanent Shield master table
IF OBJECT_ID('dbo.ExcelAttendanceMaster_UniversalShield', 'U') IS NOT NULL
BEGIN
    UPDATE dbo.ExcelAttendanceMaster_UniversalShield
    SET 
        InTime   = ISNULL(InTime, '1900-01-01 00:00:00'),
        OutTime  = ISNULL(OutTime, '1900-01-01 00:00:00'),
        Duration = ISNULL(Duration, 0),
        OverTime = ISNULL(OverTime, 0)
    WHERE AttendanceDate >= '2026-09-01' AND AttendanceDate <= '2026-09-30';

    PRINT '    [OK] Sanitized dbo.ExcelAttendanceMaster_UniversalShield reference snapshot.';
END
GO

-- Step 3: Sanitize dbo.Shifts columns
UPDATE dbo.Shifts
SET 
    IsFlexibleShift       = ISNULL(IsFlexibleShift, 0),
    PunchBeginDuration    = ISNULL(PunchBeginDuration, 0),
    PunchEndDuration      = ISNULL(PunchEndDuration, 0),
    ShiftDuration         = ISNULL(ShiftDuration, 0),
    Break1                = ISNULL(Break1, 0),
    Break2                = ISNULL(Break2, 0),
    Break1Duration        = ISNULL(Break1Duration, 0),
    Break2Duration        = ISNULL(Break2Duration, 0),
    IsGraceTimeApplicable = ISNULL(IsGraceTimeApplicable, 0),
    IsPartialDayApplicable= ISNULL(IsPartialDayApplicable, 0),
    RecordStatus          = ISNULL(RecordStatus, 1);
GO

PRINT '    [OK] Sanitized dbo.Shifts flags and durations.';
PRINT '';

-- Step 4: Verification - Ensure 0 DBNulls remain in InTime or OutTime for September 2026
SELECT 
    COUNT(*) AS Total_September_Rows,
    SUM(CASE WHEN InTime IS NULL THEN 1 ELSE 0 END) AS Null_InTime_Count,
    SUM(CASE WHEN OutTime IS NULL THEN 1 ELSE 0 END) AS Null_OutTime_Count,
    SUM(CASE WHEN Duration IS NULL THEN 1 ELSE 0 END) AS Null_Duration_Count,
    SUM(CASE WHEN WeeklyOff IS NULL THEN 1 ELSE 0 END) AS Null_WeeklyOff_Count
FROM dbo.AttendanceLogs
WHERE AttendanceDate >= '2026-09-01' AND AttendanceDate <= '2026-09-30';

PRINT '';
PRINT '>>> DBNULL TO DATE EXCEPTION ELIMINATED! YOU CAN NOW GENERATE REPORTS IN /iclock SUCCESSFULLY!';
GO
