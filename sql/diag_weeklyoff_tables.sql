-- ====================================================================================================
-- DIAGNOSTIC: Find Weekly Off Configuration Tables in eTimeTrackLite
-- Run this first to see how W/O is stored for employees
-- ====================================================================================================

USE [etimetracklite1];
GO

-- 1. Check what shift-related tables exist
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
  AND (
      TABLE_NAME LIKE '%Shift%'
   OR TABLE_NAME LIKE '%Weekly%'
   OR TABLE_NAME LIKE '%Off%'
   OR TABLE_NAME LIKE '%Leave%'
   OR TABLE_NAME LIKE '%Schedule%'
   OR TABLE_NAME LIKE '%Holiday%'
  )
ORDER BY TABLE_NAME;
GO

-- 2. Check dbo.EmployeeShift (maps employee to shift)
IF OBJECT_ID('dbo.EmployeeShift', 'U') IS NOT NULL
BEGIN
    PRINT 'dbo.EmployeeShift exists:';
    SELECT TOP 10 * FROM dbo.EmployeeShift WITH (NOLOCK) ORDER BY 1;
END;
GO

-- 3. Check dbo.Shifts (shift definitions - weekly off days)
IF OBJECT_ID('dbo.Shifts', 'U') IS NOT NULL
BEGIN
    PRINT 'dbo.Shifts exists:';
    SELECT * FROM dbo.Shifts WITH (NOLOCK);
END;
GO

-- 4. Check dbo.WeeklyOffs if exists
IF OBJECT_ID('dbo.WeeklyOffs', 'U') IS NOT NULL
BEGIN
    PRINT 'dbo.WeeklyOffs exists:';
    SELECT TOP 20 * FROM dbo.WeeklyOffs WITH (NOLOCK);
END;
GO

-- 5. Check CompanyDepartmentShifts
IF OBJECT_ID('dbo.CompanyDepartmentShifts', 'U') IS NOT NULL
BEGIN
    PRINT 'dbo.CompanyDepartmentShifts exists:';
    SELECT TOP 10 * FROM dbo.CompanyDepartmentShifts WITH (NOLOCK);
END;
GO

-- 6. Show columns of EmployeeShiftSchedule if exists
IF OBJECT_ID('dbo.EmployeeShiftSchedule', 'U') IS NOT NULL
BEGIN
    PRINT 'dbo.EmployeeShiftSchedule exists:';
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'EmployeeShiftSchedule'
    ORDER BY ORDINAL_POSITION;
    SELECT TOP 10 * FROM dbo.EmployeeShiftSchedule WITH (NOLOCK);
END;
GO
