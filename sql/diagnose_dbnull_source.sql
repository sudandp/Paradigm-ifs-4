-- ====================================================================================================
-- DIAGNOSTIC 1: INSPECT dbo.Shifts and dbo.AttendanceLogs FOR NULL VALUES
-- Purpose: Find the exact column causing "Conversion from type 'DBNull' to type 'Double'"
-- ====================================================================================================

USE [etimetracklite1];
GO

PRINT '======================================================================';
PRINT '  1. SHIFTS ASSIGNED TO SECURITY STAFF (Check for NULLs in dbo.Shifts)';
PRINT '======================================================================';
SELECT * 
FROM dbo.Shifts
WHERE ShiftId IN (1, 3, 4, 5, 44, 45);
GO

PRINT '======================================================================';
PRINT '  2. COLUMNS OF dbo.Shifts WITH NULLS';
PRINT '======================================================================';
SELECT 
    ShiftId, 
    ShiftCode, 
    ShiftDescription,
    Duration, 
    PunchBeginDuration, 
    PunchEndDuration, 
    GraceIn, 
    GraceOut
FROM dbo.Shifts
WHERE ShiftId IN (1, 3, 4, 5, 44, 45);
GO

PRINT '======================================================================';
PRINT '  3. CHECK EMPLOYEE SHIFT SCHEDULE (Roster) FOR NULL ShiftId';
PRINT '======================================================================';
SELECT COUNT(*) AS Null_ShiftId_In_Roster
FROM dbo.EmployeeShiftSchedule
WHERE ShiftDate >= '2026-09-01' AND ShiftDate <= '2026-09-30'
  AND ShiftId IS NULL;
GO

PRINT '======================================================================';
PRINT '  4. SAMPLE ROW FROM dsSource FOR EMPLOYEE 32010';
PRINT '======================================================================';
SELECT TOP 5 
    a.AttendanceLogId, a.EmployeeId, a.AttendanceDate, a.ShiftId, 
    a.InTime, a.OutTime, a.Duration, a.LateBy, a.EarlyBy, a.OverTime, a.OverTimeE
FROM dbo.AttendanceLogs a
JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
WHERE e.EmployeeCode = '32010' AND a.AttendanceDate >= '2026-09-01'
ORDER BY a.AttendanceDate;
GO
