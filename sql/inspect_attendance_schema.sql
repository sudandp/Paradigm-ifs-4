-- ====================================================================================================
-- SCHEMA INSPECTOR SCRIPT FOR ETIMETRACKLITE DATABASE
-- Run this in SSMS to view exact columns and sample data from your Attendance & Device tables
-- ====================================================================================================

USE [etimetracklite1];
GO

PRINT '======================================================================';
PRINT '  1. COLUMNS IN dbo.AttendanceLogs';
PRINT '======================================================================';
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'AttendanceLogs'
ORDER BY ORDINAL_POSITION;
GO

PRINT '======================================================================';
PRINT '  2. SAMPLE 5 ROWS FROM dbo.AttendanceLogs (Abdul Khadar - 420001)';
PRINT '======================================================================';
SELECT TOP 5 a.*
FROM dbo.AttendanceLogs a
JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
WHERE e.EmployeeCode = '420001'
ORDER BY a.AttendanceDate DESC;
GO

PRINT '======================================================================';
PRINT '  3. COLUMNS IN dbo.DeviceLogs';
PRINT '======================================================================';
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'DeviceLogs'
ORDER BY ORDINAL_POSITION;
GO
