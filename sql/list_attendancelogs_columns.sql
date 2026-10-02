-- ====================================================================================================
-- INSPECT ALL COLUMNS AND DATA TYPES OF dbo.AttendanceLogs
-- ====================================================================================================

USE [etimetracklite1];
GO

SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'AttendanceLogs'
ORDER BY ORDINAL_POSITION;
GO
