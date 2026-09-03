-- ====================================================================================================
-- ETIMETRACKLITE FULL DATABASE ARCHITECTURE & TABLES INSPECTOR (100% BULLETPROOF)
-- Uses SELECT * to avoid hardcoded column names
-- ====================================================================================================

USE [etimetracklite1];
GO

SET NOCOUNT ON;

PRINT '======================================================================';
PRINT '  1. ALL TABLES IN YOUR DATABASE';
PRINT '======================================================================';
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE' 
ORDER BY TABLE_NAME;
GO

PRINT '======================================================================';
PRINT '  2. SHIFT RECORDS IN dbo.Shifts';
PRINT '======================================================================';
SELECT * FROM dbo.Shifts;
GO

PRINT '======================================================================';
PRINT '  3. SAMPLE EMPLOYEES IN dbo.Employees';
PRINT '======================================================================';
SELECT TOP 5 * 
FROM dbo.Employees 
WHERE EmployeeCode IN ('420001', '420002', '420003');
GO

PRINT '======================================================================';
PRINT '  4. RAW PUNCHES IN dbo.DeviceLogs (Abdul Khadar Aug 18-21)';
PRINT '======================================================================';
SELECT * 
FROM dbo.DeviceLogs 
WHERE UserId = '420001' 
  AND LogDate >= '2026-08-18' AND LogDate <= '2026-08-21 23:59:59' 
ORDER BY LogDate;
GO

PRINT '======================================================================';
PRINT '  5. PROCESSED ATTENDANCE IN dbo.AttendanceLogs (Abdul Khadar Aug 18-21)';
PRINT '======================================================================';
SELECT a.* 
FROM dbo.AttendanceLogs a 
JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId 
WHERE e.EmployeeCode = '420001' 
  AND a.AttendanceDate >= '2026-08-18' AND a.AttendanceDate <= '2026-08-21' 
ORDER BY a.AttendanceDate;
GO
