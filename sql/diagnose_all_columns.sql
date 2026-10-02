-- ====================================================================================================
-- DIAGNOSTIC 2: ALL COLUMNS OF AttendanceLogs FOR ROW 12500650 AND SHIFTS 1, 3, 4
-- ====================================================================================================

USE [etimetracklite1];
GO

-- 1. Check all columns and values of a working row
SELECT * 
FROM dbo.AttendanceLogs 
WHERE AttendanceLogId = 12500650;
GO

-- 2. Check an Absent row (Pushparaj Yadav Sep 1)
SELECT a.*
FROM dbo.AttendanceLogs a
JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
WHERE e.EmployeeCode = '32049' AND a.AttendanceDate = '2026-09-01';
GO

-- 3. Check for NULLs in dbo.Shifts and Fix them (IsFlexibleShift = 0, GraceTime = 0, PartialDay = 0)
UPDATE dbo.Shifts
SET 
    IsFlexibleShift = ISNULL(IsFlexibleShift, 0),
    PunchBeginDuration = ISNULL(PunchBeginDuration, 0),
    PunchEndDuration = ISNULL(PunchEndDuration, 0),
    ShiftDuration = ISNULL(ShiftDuration, 0),
    Break1 = ISNULL(Break1, 0),
    Break2 = ISNULL(Break2, 0),
    Break1Duration = ISNULL(Break1Duration, 0),
    Break2Duration = ISNULL(Break2Duration, 0),
    IsGraceTimeApplicable = ISNULL(IsGraceTimeApplicable, 0),
    IsPartialDayApplicable = ISNULL(IsPartialDayApplicable, 0),
    RecordStatus = ISNULL(RecordStatus, 1)
WHERE ShiftId IN (1, 3, 4, 5, 44, 45);
GO

PRINT '✓ Updated dbo.Shifts NULLs (IsFlexibleShift set to 0 for WO, NS, H).';
GO
