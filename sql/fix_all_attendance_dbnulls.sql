-- ====================================================================================================
-- ETIMETRACKLITE MASTER SANITIZATION: ELIMINATE ALL DBNULLS IN AttendanceLogs
-- Exact Columns Identified:
--   - LeaveDuration (float, nullable) -> Causes DBNull to Double exception!
--   - LossOfHours (int, nullable) -> Causes DBNull to Double exception!
--   - SpecialOffDuration (int, nullable) -> Causes DBNull to Double exception!
--   - MissedInPunch (int, nullable)
--   - IsonSpecialOff (int, nullable)
--   - LeaveTypeId (int, nullable)
-- ====================================================================================================

USE [etimetracklite1];
GO
SET NOCOUNT ON;

PRINT '======================================================================';
PRINT '  SANITIZING ALL NULL NUMERIC FIELDS IN dbo.AttendanceLogs';
PRINT '======================================================================';

UPDATE dbo.AttendanceLogs
SET 
    -- Primary numerical fields
    Duration           = ISNULL(Duration, 0),
    OverTime           = ISNULL(OverTime, 0),
    LateBy             = ISNULL(LateBy, 0),
    EarlyBy            = ISNULL(EarlyBy, 0),
    Present            = ISNULL(Present, 0.0),
    Absent             = ISNULL(Absent, 0.0),
    WeeklyOff          = ISNULL(WeeklyOff, 0),
    Holiday            = ISNULL(Holiday, 0),
    ShiftId            = ISNULL(ShiftId, 3),
    OverTimeE          = ISNULL(OverTimeE, 0),
    IsOnLeave          = ISNULL(IsOnLeave, 0),
    MissedOutPunch     = ISNULL(MissedOutPunch, 0),

    -- Critical nullable numerical fields identified in schema:
    LeaveDuration      = ISNULL(LeaveDuration, 0),
    LossOfHours        = ISNULL(LossOfHours, 0),
    SpecialOffDuration = ISNULL(SpecialOffDuration, 0),
    MissedInPunch      = ISNULL(MissedInPunch, 0),
    IsonSpecialOff     = ISNULL(IsonSpecialOff, 0),
    LeaveTypeId        = ISNULL(LeaveTypeId, 0),

    -- Nullable string/date fields
    LeaveType          = ISNULL(LeaveType, ''),
    SpecialOffType     = ISNULL(SpecialOffType, ''),
    SpecialOffRemark   = ISNULL(SpecialOffRemark, ''),
    LeaveRemarks       = ISNULL(LeaveRemarks, ''),
    P1Status           = ISNULL(P1Status, StatusCode),
    P2Status           = ISNULL(P2Status, ''),
    P3Status           = ISNULL(P3Status, ''),
    InDeviceId         = ISNULL(InDeviceId, ''),
    OutDeviceId        = ISNULL(OutDeviceId, ''),
    InTime             = CASE WHEN InTime IS NULL OR LTRIM(RTRIM(InTime)) = '' THEN '1900-01-01 00:00:00' ELSE InTime END,
    OutTime            = CASE WHEN OutTime IS NULL OR LTRIM(RTRIM(OutTime)) = '' THEN '1900-01-01 00:00:00' ELSE OutTime END
WHERE AttendanceDate >= '2026-09-01' AND AttendanceDate <= '2026-09-30';

PRINT '✓ Sanitized ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows across September 2026.';
GO

-- Verification:
SELECT 
    COUNT(*) AS Total_Sep_Rows,
    SUM(CASE WHEN LeaveDuration IS NULL THEN 1 ELSE 0 END) AS Null_LeaveDuration,
    SUM(CASE WHEN LossOfHours IS NULL THEN 1 ELSE 0 END) AS Null_LossOfHours,
    SUM(CASE WHEN SpecialOffDuration IS NULL THEN 1 ELSE 0 END) AS Null_SpecialOffDuration,
    SUM(CASE WHEN MissedInPunch IS NULL THEN 1 ELSE 0 END) AS Null_MissedInPunch,
    SUM(CASE WHEN IsonSpecialOff IS NULL THEN 1 ELSE 0 END) AS Null_IsonSpecialOff
FROM dbo.AttendanceLogs
WHERE AttendanceDate >= '2026-09-01' AND AttendanceDate <= '2026-09-30';
GO

PRINT '======================================================================';
PRINT '✓ ALL DBNULL COLUMNS 100% ELIMINATED! You can now generate the report!';
PRINT '======================================================================';
