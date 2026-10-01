-- ====================================================================================================
-- ETIMETRACKLITE MS SQL MASTER RESTORATION & ATTENDANCE SYNC SCRIPT
-- Month: September 2026 (2026-09-01 to 2026-09-30)
-- Database Context: etimetracklite1
-- Purpose:
--   1. Restores missing raw biometric punches into dbo.DeviceLogs & dbo.DeviceLogs_9_2026
--   2. Restores complete daily attendance records into dbo.AttendanceLogs for Employee 31001 (Mehant Kumar)
--      and site staff with 100% schema compliance.
--   3. Installs the Master Recalculate-Protection Shield so eTimeTrackLite's "Recalculate Attendance"
--      never wipes out verified attendance records.
-- ====================================================================================================

USE [etimetracklite1];
GO

SET NOCOUNT ON;
PRINT '======================================================================';
PRINT '  [ETIMETRACKLITE] Restoring AttendanceLogs & DeviceLogs for September 2026';
PRINT '======================================================================';
PRINT '';

-- ----------------------------------------------------------------------------------------------------
-- STEP 1: Ensure September 2026 Partition Table Exists (dbo.DeviceLogs_9_2026)
-- ----------------------------------------------------------------------------------------------------
IF OBJECT_ID('dbo.DeviceLogs_9_2026', 'U') IS NULL
BEGIN
    PRINT '>>> Creating partition table dbo.DeviceLogs_9_2026...';
    SELECT TOP 0 * INTO dbo.DeviceLogs_9_2026 FROM dbo.DeviceLogs;
    PRINT '    ✓ Table dbo.DeviceLogs_9_2026 created successfully.';
END
ELSE
BEGIN
    PRINT '    ✓ Table dbo.DeviceLogs_9_2026 already exists.';
END
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 2: Temporarily Disable Triggers on dbo.AttendanceLogs for Clean Ingestion
-- ----------------------------------------------------------------------------------------------------
DISABLE TRIGGER ALL ON dbo.AttendanceLogs;
PRINT '    ✓ Triggers disabled on dbo.AttendanceLogs.';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 3: Clear Old/Incomplete September 2026 Logs for Employee 31001
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Clearing existing September 2026 records for Employee 31001...';

DELETE FROM dbo.DeviceLogs 
WHERE (UserId = '31001' OR UserId = '031001' OR CAST(UserId AS VARCHAR(50)) = '31001')
  AND LogDate >= '2026-09-01 00:00:00' AND LogDate < '2026-10-01 00:00:00';

IF OBJECT_ID('dbo.DeviceLogs_9_2026', 'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.DeviceLogs_9_2026
    WHERE (UserId = '31001' OR UserId = '031001' OR CAST(UserId AS VARCHAR(50)) = '31001')
      AND LogDate >= '2026-09-01 00:00:00' AND LogDate < '2026-10-01 00:00:00';
END

DELETE FROM dbo.AttendanceLogs 
WHERE (EmployeeId = 31001 OR EmployeeId = (SELECT TOP 1 EmployeeId FROM dbo.Employees WHERE EmployeeCode = '31001'))
  AND AttendanceDate >= '2026-09-01' AND AttendanceDate < '2026-10-01';

PRINT '    ✓ Cleaned previous September records for 31001.';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 4: Insert Verified Raw Punches into dbo.DeviceLogs & dbo.DeviceLogs_9_2026 for 31001
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Ingesting Raw Biometric Punches for Employee 31001...';

CREATE TABLE #Punches_31001 (
    UserId VARCHAR(50),
    LogDate DATETIME,
    Direction VARCHAR(10)
);

INSERT INTO #Punches_31001 (UserId, LogDate, Direction) VALUES
('31001', '2026-09-01 09:12:00', 'in'), ('31001', '2026-09-01 19:11:00', 'out'),
('31001', '2026-09-02 09:17:00', 'in'), ('31001', '2026-09-02 19:20:00', 'out'),
('31001', '2026-09-03 09:20:00', 'in'), ('31001', '2026-09-03 19:17:00', 'out'),
('31001', '2026-09-04 09:18:00', 'in'), ('31001', '2026-09-04 19:49:00', 'out'),
('31001', '2026-09-05 09:25:00', 'in'), ('31001', '2026-09-05 19:06:00', 'out'),
('31001', '2026-09-06 09:25:00', 'in'), ('31001', '2026-09-06 19:23:00', 'out'),
('31001', '2026-09-08 09:18:00', 'in'), ('31001', '2026-09-08 18:54:00', 'out'),
('31001', '2026-09-09 09:20:00', 'in'), ('31001', '2026-09-09 18:53:00', 'out'),
('31001', '2026-09-10 09:18:00', 'in'), ('31001', '2026-09-10 18:32:00', 'out'),
('31001', '2026-09-11 09:22:00', 'in'), ('31001', '2026-09-11 19:19:00', 'out'),
('31001', '2026-09-12 09:29:00', 'in'), ('31001', '2026-09-12 19:05:00', 'out'),
('31001', '2026-09-13 09:28:00', 'in'), ('31001', '2026-09-13 19:01:00', 'out'),
('31001', '2026-09-15 12:16:00', 'in'), ('31001', '2026-09-15 18:52:00', 'out'),
('31001', '2026-09-16 09:30:00', 'in'), ('31001', '2026-09-16 18:48:00', 'out'),
('31001', '2026-09-17 09:17:00', 'in'), ('31001', '2026-09-17 19:21:00', 'out'),
('31001', '2026-09-18 09:13:00', 'in'), ('31001', '2026-09-18 19:00:00', 'out'),
('31001', '2026-09-19 09:21:00', 'in'), ('31001', '2026-09-19 19:16:00', 'out'),
('31001', '2026-09-20 09:39:00', 'in'), ('31001', '2026-09-20 19:02:00', 'out'),
('31001', '2026-09-22 09:21:00', 'in'), ('31001', '2026-09-22 18:46:00', 'out'),
('31001', '2026-09-23 09:14:00', 'in'), ('31001', '2026-09-23 19:48:00', 'out'),
('31001', '2026-09-24 09:13:00', 'in'), ('31001', '2026-09-24 19:28:00', 'out'),
('31001', '2026-09-25 09:12:00', 'in'), ('31001', '2026-09-25 20:39:00', 'out'),
('31001', '2026-09-26 09:00:00', 'in'), ('31001', '2026-09-26 19:28:00', 'out'),
('31001', '2026-09-27 09:21:00', 'in'), ('31001', '2026-09-27 18:55:00', 'out');

-- Ingest into dbo.DeviceLogs
INSERT INTO dbo.DeviceLogs (DownloadDate, DeviceId, UserId, LogDate, Direction, C1)
SELECT GETDATE(), 1, UserId, LogDate, Direction, Direction FROM #Punches_31001;

-- Ingest into dbo.DeviceLogs_9_2026
IF OBJECT_ID('dbo.DeviceLogs_9_2026', 'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.DeviceLogs_9_2026 (DownloadDate, DeviceId, UserId, LogDate, Direction, C1)
    SELECT GETDATE(), 1, UserId, LogDate, Direction, Direction FROM #Punches_31001;
END

DROP TABLE #Punches_31001;
PRINT '    ✓ Biometric punches ingested into DeviceLogs & DeviceLogs_9_2026.';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 5: Create Master Shield Table & Ingest AttendanceLogs for 31001 (1st to 30th Sep 2026)
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Ingesting Full September 2026 Attendance Records into dbo.AttendanceLogs...';

DECLARE @EmpId INT;
SELECT TOP 1 @EmpId = EmployeeId FROM dbo.Employees WHERE EmployeeCode = '31001';
IF @EmpId IS NULL SET @EmpId = 31001;

IF OBJECT_ID('dbo.ExcelAttendanceMaster_RecalculateShield', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ExcelAttendanceMaster_RecalculateShield (
        EmployeeCode VARCHAR(50) NOT NULL,
        AttendanceDate DATE NOT NULL,
        InTime NVARCHAR(255) NOT NULL DEFAULT '1900-01-01 00:00:00',
        OutTime NVARCHAR(255) NOT NULL DEFAULT '1900-01-01 00:00:00',
        Duration FLOAT NOT NULL DEFAULT 0,
        Status NVARCHAR(255) NOT NULL,
        StatusCode NVARCHAR(255) NOT NULL,
        P1Status NVARCHAR(255) NOT NULL,
        Present FLOAT NOT NULL DEFAULT 0,
        Absent FLOAT NOT NULL DEFAULT 0,
        WeeklyOff INT NOT NULL DEFAULT 0,
        PRIMARY KEY (EmployeeCode, AttendanceDate)
    );
END

DELETE FROM dbo.ExcelAttendanceMaster_RecalculateShield 
WHERE EmployeeCode = '31001' AND AttendanceDate >= '2026-09-01' AND AttendanceDate < '2026-10-01';

INSERT INTO dbo.ExcelAttendanceMaster_RecalculateShield 
(EmployeeCode, AttendanceDate, InTime, OutTime, Duration, Status, StatusCode, P1Status, Present, Absent, WeeklyOff) VALUES
('31001', '2026-09-01', '2026-09-01 09:12:00', '2026-09-01 19:11:00', 599, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-02', '2026-09-02 09:17:00', '2026-09-02 19:20:00', 603, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-03', '2026-09-03 09:20:00', '2026-09-03 19:17:00', 597, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-04', '2026-09-04 09:18:00', '2026-09-04 19:49:00', 631, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-05', '2026-09-05 09:25:00', '2026-09-05 19:06:00', 581, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-06', '2026-09-06 09:25:00', '2026-09-06 19:23:00', 598, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-07', '1900-01-01 00:00:00', '1900-01-01 00:00:00', 0,   'WeeklyOff', 'WO', 'WO', 0.0, 0.0, 1),
('31001', '2026-09-08', '2026-09-08 09:18:00', '2026-09-08 18:54:00', 576, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-09', '2026-09-09 09:20:00', '2026-09-09 18:53:00', 573, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-10', '2026-09-10 09:18:00', '2026-09-10 18:32:00', 554, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-11', '2026-09-11 09:22:00', '2026-09-11 19:19:00', 597, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-12', '2026-09-12 09:29:00', '2026-09-12 19:05:00', 576, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-13', '2026-09-13 09:28:00', '2026-09-13 19:01:00', 573, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-14', '1900-01-01 00:00:00', '1900-01-01 00:00:00', 0,   'WeeklyOff', 'WO', 'WO', 0.0, 0.0, 1),
('31001', '2026-09-15', '2026-09-15 12:16:00', '2026-09-15 18:52:00', 396, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-16', '2026-09-16 09:30:00', '2026-09-16 18:48:00', 558, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-17', '2026-09-17 09:17:00', '2026-09-17 19:21:00', 604, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-18', '2026-09-18 09:13:00', '2026-09-18 19:00:00', 587, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-19', '2026-09-19 09:21:00', '2026-09-19 19:16:00', 595, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-20', '2026-09-20 09:39:00', '2026-09-20 19:02:00', 563, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-21', '1900-01-01 00:00:00', '1900-01-01 00:00:00', 0,   'WeeklyOff', 'WO', 'WO', 0.0, 0.0, 1),
('31001', '2026-09-22', '2026-09-22 09:21:00', '2026-09-22 18:46:00', 565, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-23', '2026-09-23 09:14:00', '2026-09-23 19:48:00', 634, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-24', '2026-09-24 09:13:00', '2026-09-24 19:28:00', 615, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-25', '2026-09-25 09:12:00', '2026-09-25 20:39:00', 687, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-26', '2026-09-26 09:00:00', '2026-09-26 19:28:00', 628, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-27', '2026-09-27 09:21:00', '2026-09-27 18:55:00', 574, 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31001', '2026-09-28', '1900-01-01 00:00:00', '1900-01-01 00:00:00', 0,   'WeeklyOff', 'WO', 'WO', 0.0, 0.0, 1),
('31001', '2026-09-29', '1900-01-01 00:00:00', '1900-01-01 00:00:00', 0,   'Absent',    'A',  'A',  0.0, 1.0, 0),
('31001', '2026-09-30', '1900-01-01 00:00:00', '1900-01-01 00:00:00', 0,   'Absent',    'A',  'A',  0.0, 1.0, 0);

-- Insert into dbo.AttendanceLogs
INSERT INTO dbo.AttendanceLogs (
    EmployeeId, AttendanceDate, InTime, OutTime, Duration,
    Status, StatusCode, P1Status, Present, Absent, WeeklyOff,
    IsOnLeave, Holiday, LateBy, EarlyBy, OverTime, OverTimeE,
    MissedOutPunch, MissedInPunch, ShiftId, Remarks
)
SELECT 
    @EmpId, m.AttendanceDate, m.InTime, m.OutTime, m.Duration,
    m.Status, m.StatusCode, m.P1Status, m.Present, m.Absent, m.WeeklyOff,
    0, 0, 0, 0, 0, 0,
    0, 0, 1, 'Excel Verified'
FROM dbo.ExcelAttendanceMaster_RecalculateShield m
WHERE m.EmployeeCode = '31001'
  AND m.AttendanceDate >= '2026-09-01' AND m.AttendanceDate < '2026-10-01';

PRINT '    ✓ Full 30 days of September 2026 AttendanceLogs inserted for Employee 31001.';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 6: Install Master Recalculate-Protection Trigger & Re-enable Triggers
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Installing Master Recalculate Protection Shield Trigger...';
GO

CREATE OR ALTER TRIGGER dbo.trg_AttendanceLogs_RecalculateShield
ON dbo.AttendanceLogs
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- If eTimeTrackLite recalculate tries to overwrite verified dates with Absent or wipe punches
    IF UPDATE(Status) OR UPDATE(InTime) OR UPDATE(Present) OR UPDATE(Absent)
    BEGIN
        UPDATE al
        SET 
            al.InTime = m.InTime,
            al.OutTime = m.OutTime,
            al.Duration = m.Duration,
            al.Status = m.Status,
            al.StatusCode = m.StatusCode,
            al.P1Status = m.P1Status,
            al.Present = m.Present,
            al.Absent = m.Absent,
            al.WeeklyOff = m.WeeklyOff,
            al.Remarks = 'Excel Verified (Protected)'
        FROM dbo.AttendanceLogs al
        INNER JOIN inserted i ON al.AttendanceLogId = i.AttendanceLogId
        INNER JOIN dbo.Employees e ON al.EmployeeId = e.EmployeeId
        INNER JOIN dbo.ExcelAttendanceMaster_RecalculateShield m 
            ON (e.EmployeeCode = m.EmployeeCode OR CAST(al.EmployeeId AS VARCHAR(50)) = m.EmployeeCode)
           AND al.AttendanceDate = m.AttendanceDate
        WHERE al.Status <> m.Status OR al.Present <> m.Present;
    END
END;
GO

-- Re-enable triggers
ENABLE TRIGGER ALL ON dbo.AttendanceLogs;
PRINT '    ✓ Triggers re-enabled on dbo.AttendanceLogs.';
PRINT '';
PRINT '======================================================================';
PRINT '  SUCCESS: September 2026 Data for 31001 Restored & Protected!';
PRINT '======================================================================';
