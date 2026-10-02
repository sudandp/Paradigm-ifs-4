-- ====================================================================================================
-- COMPREHENSIVE DBNULL SCAN ACROSS dbo.Employees AND dbo.AttendanceLogs
-- ====================================================================================================

USE [etimetracklite1];
GO

PRINT '======================================================================';
PRINT '  1. NUMERIC COLUMNS IN dbo.Employees WITH NULLS';
PRINT '======================================================================';
SELECT 
    COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Employees' 
  AND DATA_TYPE IN ('float', 'real', 'decimal', 'numeric', 'money', 'smallmoney', 'int', 'smallint', 'tinyint', 'bigint')
ORDER BY COLUMN_NAME;
GO

PRINT '======================================================================';
PRINT '  2. CHECK SECURITY GUARDS IN dbo.Employees FOR NULL NUMERIC FIELDS';
PRINT '======================================================================';
SELECT 
    e.EmployeeId, e.EmployeeCode, e.EmployeeName,
    e.DepartmentId, e.DesignationId, e.CategoryId,
    e.ShiftId, e.DevicePassword, e.DeviceExpiryRule
FROM dbo.Employees e
WHERE e.EmployeeCode IN ('32010', '32049', '32001', '32088', '32082', '32079', '32085');
GO

PRINT '======================================================================';
PRINT '  3. TOTAL NULLS IN dbo.AttendanceLogs ACROSS ENTIRE TABLE (ALL MONTHS)';
PRINT '======================================================================';
SELECT 
    COUNT(*) AS TotalRowsWithNulls
FROM dbo.AttendanceLogs
WHERE 
    Duration IS NULL OR OverTime IS NULL OR LateBy IS NULL OR EarlyBy IS NULL 
    OR Present IS NULL OR Absent IS NULL OR WeeklyOff IS NULL OR Holiday IS NULL 
    OR ShiftId IS NULL OR OverTimeE IS NULL OR IsOnLeave IS NULL;
GO
