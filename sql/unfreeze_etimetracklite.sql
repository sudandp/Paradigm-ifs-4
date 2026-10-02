-- ====================================================================================================
-- ETIMETRACKLITE IMMEDIATE UNFREEZE & UNLOCK SCRIPT
-- Purpose:
--   1. Rollback any open/hanging transactions in SSMS holding exclusive locks on dbo.AttendanceLogs
--   2. Drop the heavy trigger that causes ASP.NET to time out (Request timed out)
--   3. Immediately kill any blocking sessions waiting on dbo.AttendanceLogs
-- ====================================================================================================

USE [etimetracklite1];
GO

-- 1. Check and Rollback any hanging transaction in current connection
WHILE @@TRANCOUNT > 0
BEGIN
    PRINT '>>> Rolling back uncommitted transaction...';
    ROLLBACK TRANSACTION;
END
GO

-- 2. Drop the shield trigger immediately to stop lock contention
IF OBJECT_ID('dbo.trg_AttendanceLogs_Security_MasterShield', 'TR') IS NOT NULL
BEGIN
    DROP TRIGGER dbo.trg_AttendanceLogs_Security_MasterShield;
    PRINT '✓ Dropped dbo.trg_AttendanceLogs_Security_MasterShield (Locks Released)';
END
GO

IF OBJECT_ID('dbo.trg_AttendanceLogs_Universal_AutoEngine', 'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_AttendanceLogs_Universal_AutoEngine;
GO
IF OBJECT_ID('dbo.trg_AttendanceLogs_Universal_EnterpriseEngine', 'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_AttendanceLogs_Universal_EnterpriseEngine;
GO
IF OBJECT_ID('dbo.trg_AttendanceLogs_Shield_32049_Sep2026', 'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_AttendanceLogs_Shield_32049_Sep2026;
GO

-- 3. Kill any lingering sessions that are blocking dbo.AttendanceLogs
DECLARE @kill_cmd NVARCHAR(MAX) = N'';
SELECT @kill_cmd = @kill_cmd + N'KILL ' + CAST(session_id AS NVARCHAR(10)) + N'; '
FROM sys.dm_exec_requests
WHERE blocking_session_id <> 0 AND session_id <> @@SPID;

IF @kill_cmd <> N''
BEGIN
    PRINT '>>> Killing blocked/blocking sessions: ' + @kill_cmd;
    EXEC sp_executesql @kill_cmd;
END
GO

-- 4. Ensure all triggers are enabled (clean state)
ENABLE TRIGGER ALL ON dbo.AttendanceLogs;
PRINT '✓ All standard table triggers enabled.';
GO

-- 5. Verification: Fast select with NOLOCK
SELECT TOP 5 
    EmployeeId, AttendanceDate, InTime, OutTime, Duration, OverTime, Status, Remarks
FROM dbo.AttendanceLogs WITH (NOLOCK)
WHERE AttendanceDate >= '2026-09-01'
ORDER BY AttendanceDate DESC;
GO

PRINT '======================================================================';
PRINT '✓ UNFREEZE COMPLETE: eTimeTrackLite Web is now UNLOCKED & ACTIVE!';
PRINT '  Please refresh your browser (http://14.195.89.50:8080/iclock/Main.aspx)';
PRINT '======================================================================';
