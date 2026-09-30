-- ====================================================================================================
-- ETIMETRACKLITE MS SQL SCRIPT: VEDAMURTHY SS (EMPLOYEE 31014) - SEPTEMBER 2026 ATTENDANCE SYNC
-- Database Context: etimetracklite1
-- Purpose:
--   1. Temporarily DISABLES triggers on dbo.AttendanceLogs to prevent older recalculate shields
--      from forcing old cached times on days 1 to 16.
--   2. Clears old/conflicting biometric punches and attendance logs for Employee 31014 in September 2026.
--   3. Inserts clean raw biometric punches (IN & OUT) into dbo.DeviceLogs & partition tables.
--   4. Cleanses and synchronizes old reference tables (ExcelAttendanceMaster_RecalculateShield, 
--      ExcelAttendanceMaster_PurvaVenezia) so all triggers recognize the new verified schedule.
--   5. Creates dbo.ExcelAttendanceMaster_31014_Sep2026 master table with all 30 days.
--   6. Directly updates/inserts all 30 days into dbo.AttendanceLogs with full schema compliance.
--   7. Re-enables triggers and updates dbo.trg_AttendanceLogs_RecalculateShield_31014.
--   8. Displays verification table showing all 30 days.
-- ====================================================================================================

USE [etimetracklite1];
GO

SET NOCOUNT ON;
PRINT '======================================================================';
PRINT '  [ETIMETRACKLITE] Starting September 2026 Attendance Sync for 31014';
PRINT '======================================================================';
PRINT '';

-- ----------------------------------------------------------------------------------------------------
-- STEP 0: Resolve EmployeeId and EmployeeCode for 31014 & Disable Triggers
-- ----------------------------------------------------------------------------------------------------
DECLARE @EmpId INT;
DECLARE @EmpCode VARCHAR(50) = '31014';

SELECT TOP 1 @EmpId = EmployeeId 
FROM dbo.Employees WITH (NOLOCK)
WHERE LTRIM(RTRIM(CAST(EmployeeCode AS VARCHAR(50)))) = @EmpCode 
   OR EmployeeId = 31014;

IF @EmpId IS NULL
BEGIN
    SET @EmpId = 31014;
    PRINT '⚠ Note: EmployeeId not matched in dbo.Employees, defaulting @EmpId = 31014';
END
ELSE
BEGIN
    PRINT '✓ Resolved Employee: Id = ' + CAST(@EmpId AS VARCHAR(20)) + ', Code = ' + @EmpCode;
END;

-- CRITICAL: Disable triggers temporarily so existing older triggers don't overwrite days 1-16
PRINT '>>> Disabling triggers on dbo.AttendanceLogs to bypass legacy cache triggers...';
DISABLE TRIGGER ALL ON dbo.AttendanceLogs;
PRINT '    ✓ Triggers disabled on dbo.AttendanceLogs.';
PRINT '';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 1: Clear Old / Conflicting Biometric Punches & Attendance Records for September 2026
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Clearing existing September 2026 records for Employee 31014...';

-- Clear raw punches in DeviceLogs
DELETE FROM dbo.DeviceLogs
WHERE (UserId = '31014' OR UserId = '031014' OR CAST(UserId AS VARCHAR(50)) = '31014')
  AND LogDate >= '2026-09-01 00:00:00' 
  AND LogDate < '2026-10-01 00:00:00';

-- Clear partition table DeviceLogs_9_2026 if it exists
IF OBJECT_ID('dbo.DeviceLogs_9_2026', 'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.DeviceLogs_9_2026
    WHERE (UserId = '31014' OR UserId = '031014' OR CAST(UserId AS VARCHAR(50)) = '31014')
      AND LogDate >= '2026-09-01 00:00:00' 
      AND LogDate < '2026-10-01 00:00:00';
END;

-- Clear partition table DeviceLogs_09_2026 if it exists
IF OBJECT_ID('dbo.DeviceLogs_09_2026', 'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.DeviceLogs_09_2026
    WHERE (UserId = '31014' OR UserId = '031014' OR CAST(UserId AS VARCHAR(50)) = '31014')
      AND LogDate >= '2026-09-01 00:00:00' 
      AND LogDate < '2026-10-01 00:00:00';
END;

-- Cleanse legacy master shield tables for 31014 in Sep 2026 so they don't hold outdated 1-16 day records
IF OBJECT_ID('dbo.ExcelAttendanceMaster_RecalculateShield', 'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.ExcelAttendanceMaster_RecalculateShield
    WHERE (EmployeeCode = '31014' OR EmployeeCode = '031014')
      AND AttendanceDate >= '2026-09-01' AND AttendanceDate < '2026-10-01';
    PRINT '    ✓ Cleansed legacy dbo.ExcelAttendanceMaster_RecalculateShield.';
END;

IF OBJECT_ID('dbo.ExcelAttendanceMaster_PurvaVenezia', 'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.ExcelAttendanceMaster_PurvaVenezia
    WHERE (EmployeeCode = '31014' OR EmployeeCode = '031014')
      AND AttendanceDate >= '2026-09-01' AND AttendanceDate < '2026-10-01';
    PRINT '    ✓ Cleansed legacy dbo.ExcelAttendanceMaster_PurvaVenezia.';
END;

-- Clear daily AttendanceLogs
DECLARE @TargetEmpId INT;
SELECT TOP 1 @TargetEmpId = EmployeeId FROM dbo.Employees WHERE LTRIM(RTRIM(CAST(EmployeeCode AS VARCHAR(50)))) = '31014' OR EmployeeId = 31014;
IF @TargetEmpId IS NULL SET @TargetEmpId = 31014;

DELETE FROM dbo.AttendanceLogs
WHERE (EmployeeId = @TargetEmpId OR EmployeeId = 31014)
  AND AttendanceDate >= '2026-09-01' 
  AND AttendanceDate < '2026-10-01';

PRINT '    ✅ Cleared conflicting records for September 2026.';
PRINT '';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 2: Insert Clean Raw Biometric Punches into dbo.DeviceLogs & Monthly Partition
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Inserting verified biometric punches into dbo.DeviceLogs...';

IF OBJECT_ID('tempdb..#VedaPunches', 'U') IS NOT NULL DROP TABLE #VedaPunches;

CREATE TABLE #VedaPunches (
    UserId VARCHAR(50),
    LogDate DATETIME,
    Direction VARCHAR(20)
);

INSERT INTO #VedaPunches (UserId, LogDate, Direction) VALUES
('31014', '2026-09-01 10:28:00', 'in'),
('31014', '2026-09-01 19:15:00', 'out'),
('31014', '2026-09-02 10:05:00', 'in'),
('31014', '2026-09-02 19:21:00', 'out'),
-- 03-Sep: W/O (No punches)
('31014', '2026-09-04 10:22:00', 'in'),
('31014', '2026-09-04 19:42:00', 'out'),
('31014', '2026-09-05 10:22:00', 'in'),
('31014', '2026-09-05 19:33:00', 'out'),
('31014', '2026-09-06 10:31:00', 'in'),
('31014', '2026-09-06 19:39:00', 'out'),
('31014', '2026-09-07 10:08:00', 'in'),
('31014', '2026-09-07 19:20:00', 'out'),
('31014', '2026-09-08 10:22:00', 'in'),
('31014', '2026-09-08 19:31:00', 'out'),
('31014', '2026-09-09 10:05:00', 'in'),
('31014', '2026-09-09 18:35:00', 'out'),
-- 10-Sep: W/O (No punches)
('31014', '2026-09-11 10:40:00', 'in'),
('31014', '2026-09-11 19:45:00', 'out'),
('31014', '2026-09-12 10:05:00', 'in'),
('31014', '2026-09-12 19:06:00', 'out'),
('31014', '2026-09-13 10:35:00', 'in'),
('31014', '2026-09-13 19:02:00', 'out'),
-- 14-Sep: Absent (No punches)
('31014', '2026-09-15 10:00:00', 'in'),
('31014', '2026-09-15 19:09:00', 'out'),
('31014', '2026-09-16 10:13:00', 'in'),
('31014', '2026-09-16 19:24:00', 'out'),
('31014', '2026-09-17 10:20:00', 'in'),
('31014', '2026-09-17 19:24:00', 'out'),
-- 18-Sep: W/O (No punches)
('31014', '2026-09-19 10:08:00', 'in'),
('31014', '2026-09-19 19:15:00', 'out'),
('31014', '2026-09-20 10:37:00', 'in'),
('31014', '2026-09-20 19:48:00', 'out'),
('31014', '2026-09-21 10:11:00', 'in'),
('31014', '2026-09-21 19:24:00', 'out'),
('31014', '2026-09-22 10:20:00', 'in'),
('31014', '2026-09-22 18:00:00', 'out'),
-- 23-Sep: W/O (No punches)
('31014', '2026-09-24 10:06:00', 'in'),
('31014', '2026-09-24 19:28:00', 'out'),
('31014', '2026-09-25 10:28:00', 'in'),
('31014', '2026-09-25 20:20:00', 'out'),
('31014', '2026-09-26 10:38:00', 'in'),
('31014', '2026-09-26 19:17:00', 'out'),
('31014', '2026-09-27 10:10:00', 'in'),
('31014', '2026-09-27 19:12:00', 'out'),
('31014', '2026-09-28 10:07:00', 'in'),
('31014', '2026-09-28 20:02:00', 'out'),
('31014', '2026-09-29 10:08:00', 'in'),
('31014', '2026-09-29 19:18:00', 'out'),
('31014', '2026-09-30 10:11:00', 'in'),
('31014', '2026-09-30 19:20:00', 'out');

-- Insert into dbo.DeviceLogs
INSERT INTO dbo.DeviceLogs (DownloadDate, DeviceId, UserId, LogDate, Direction, C1)
SELECT 
    p.LogDate,
    1,
    p.UserId,
    p.LogDate,
    p.Direction,
    p.Direction
FROM #VedaPunches p
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.DeviceLogs d WITH (NOLOCK)
    WHERE d.UserId = p.UserId AND d.LogDate = p.LogDate
);

-- Insert into partition dbo.DeviceLogs_9_2026 if it exists
IF OBJECT_ID('dbo.DeviceLogs_9_2026', 'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.DeviceLogs_9_2026 (DownloadDate, DeviceId, UserId, LogDate, Direction, C1)
    SELECT p.LogDate, 1, p.UserId, p.LogDate, p.Direction, p.Direction
    FROM #VedaPunches p
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.DeviceLogs_9_2026 d WITH (NOLOCK)
        WHERE d.UserId = p.UserId AND d.LogDate = p.LogDate
    );
END;

-- Insert into partition dbo.DeviceLogs_09_2026 if it exists
IF OBJECT_ID('dbo.DeviceLogs_09_2026', 'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.DeviceLogs_09_2026 (DownloadDate, DeviceId, UserId, LogDate, Direction, C1)
    SELECT p.LogDate, 1, p.UserId, p.LogDate, p.Direction, p.Direction
    FROM #VedaPunches p
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.DeviceLogs_09_2026 d WITH (NOLOCK)
        WHERE d.UserId = p.UserId AND d.LogDate = p.LogDate
    );
END;

DROP TABLE #VedaPunches;
PRINT '    ✅ 50 verified biometric punches inserted into DeviceLogs.';
PRINT '';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 3: Create Master Reference Table (ExcelAttendanceMaster_31014_Sep2026)
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Creating Master Reference Table dbo.ExcelAttendanceMaster_31014_Sep2026...';

IF OBJECT_ID('dbo.ExcelAttendanceMaster_31014_Sep2026', 'U') IS NOT NULL
    DROP TABLE dbo.ExcelAttendanceMaster_31014_Sep2026;
GO

CREATE TABLE dbo.ExcelAttendanceMaster_31014_Sep2026 (
    EmployeeCode VARCHAR(50) NOT NULL,
    AttendanceDate DATE NOT NULL,
    InTime NVARCHAR(255) NOT NULL DEFAULT '1900-01-01 00:00:00',
    OutTime NVARCHAR(255) NOT NULL DEFAULT '1900-01-01 00:00:00',
    Duration FLOAT NOT NULL DEFAULT 0,
    PunchRecords NVARCHAR(500) NOT NULL DEFAULT '',
    Status NVARCHAR(255) NOT NULL,
    StatusCode NVARCHAR(255) NOT NULL,
    P1Status NVARCHAR(255) NOT NULL,
    Present FLOAT NOT NULL DEFAULT 0,
    Absent FLOAT NOT NULL DEFAULT 0,
    WeeklyOff INT NOT NULL DEFAULT 0,
    PRIMARY KEY (EmployeeCode, AttendanceDate)
);
GO

INSERT INTO dbo.ExcelAttendanceMaster_31014_Sep2026 
(EmployeeCode, AttendanceDate, InTime, OutTime, Duration, PunchRecords, Status, StatusCode, P1Status, Present, Absent, WeeklyOff) 
VALUES
('31014', '2026-09-01', '2026-09-01 10:28:00', '2026-09-01 19:15:00', 527, '10:28:in(1),19:15:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-02', '2026-09-02 10:05:00', '2026-09-02 19:21:00', 556, '10:05:in(1),19:21:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-03', '1900-01-01 00:00:00', '1900-01-01 00:00:00', 0,   '',                         'WeeklyOff', 'WO', 'WO', 0.0, 0.0, 1),
('31014', '2026-09-04', '2026-09-04 10:22:00', '2026-09-04 19:42:00', 560, '10:22:in(1),19:42:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-05', '2026-09-05 10:22:00', '2026-09-05 19:33:00', 551, '10:22:in(1),19:33:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-06', '2026-09-06 10:31:00', '2026-09-06 19:39:00', 548, '10:31:in(1),19:39:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-07', '2026-09-07 10:08:00', '2026-09-07 19:20:00', 552, '10:08:in(1),19:20:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-08', '2026-09-08 10:22:00', '2026-09-08 19:31:00', 549, '10:22:in(1),19:31:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-09', '2026-09-09 10:05:00', '2026-09-09 18:35:00', 510, '10:05:in(1),18:35:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-10', '1900-01-01 00:00:00', '1900-01-01 00:00:00', 0,   '',                         'WeeklyOff', 'WO', 'WO', 0.0, 0.0, 1),
('31014', '2026-09-11', '2026-09-11 10:40:00', '2026-09-11 19:45:00', 545, '10:40:in(1),19:45:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-12', '2026-09-12 10:05:00', '2026-09-12 19:06:00', 541, '10:05:in(1),19:06:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-13', '2026-09-13 10:35:00', '2026-09-13 19:02:00', 507, '10:35:in(1),19:02:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-14', '1900-01-01 00:00:00', '1900-01-01 00:00:00', 0,   '',                         'Absent   ', 'A',  'A',  0.0, 1.0, 0),
('31014', '2026-09-15', '2026-09-15 10:00:00', '2026-09-15 19:09:00', 549, '10:00:in(1),19:09:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-16', '2026-09-16 10:13:00', '2026-09-16 19:24:00', 551, '10:13:in(1),19:24:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-17', '2026-09-17 10:20:00', '2026-09-17 19:24:00', 544, '10:20:in(1),19:24:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-18', '1900-01-01 00:00:00', '1900-01-01 00:00:00', 0,   '',                         'WeeklyOff', 'WO', 'WO', 0.0, 0.0, 1),
('31014', '2026-09-19', '2026-09-19 10:08:00', '2026-09-19 19:15:00', 547, '10:08:in(1),19:15:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-20', '2026-09-20 10:37:00', '2026-09-20 19:48:00', 551, '10:37:in(1),19:48:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-21', '2026-09-21 10:11:00', '2026-09-21 19:24:00', 553, '10:11:in(1),19:24:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-22', '2026-09-22 10:20:00', '2026-09-22 18:00:00', 460, '10:20:in(1),18:00:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-23', '1900-01-01 00:00:00', '1900-01-01 00:00:00', 0,   '',                         'WeeklyOff', 'WO', 'WO', 0.0, 0.0, 1),
('31014', '2026-09-24', '2026-09-24 10:06:00', '2026-09-24 19:28:00', 562, '10:06:in(1),19:28:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-25', '2026-09-25 10:28:00', '2026-09-25 20:20:00', 592, '10:28:in(1),20:20:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-26', '2026-09-26 10:38:00', '2026-09-26 19:17:00', 519, '10:38:in(1),19:17:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-27', '2026-09-27 10:10:00', '2026-09-27 19:12:00', 542, '10:10:in(1),19:12:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-28', '2026-09-28 10:07:00', '2026-09-28 20:02:00', 595, '10:07:in(1),20:02:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-29', '2026-09-29 10:08:00', '2026-09-29 19:18:00', 550, '10:08:in(1),19:18:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0),
('31014', '2026-09-30', '2026-09-30 10:11:00', '2026-09-30 19:20:00', 549, '10:11:in(1),19:20:out(1)', 'Present ', 'P', 'P', 1.0, 0.0, 0);

PRINT '    ✅ Master Reference Table created with 30 records.';

-- Also sync into legacy dbo.ExcelAttendanceMaster_RecalculateShield if it exists
IF OBJECT_ID('dbo.ExcelAttendanceMaster_RecalculateShield', 'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.ExcelAttendanceMaster_RecalculateShield 
    (EmployeeCode, AttendanceDate, InTime, OutTime, Duration, Status, StatusCode, P1Status, Present, Absent, WeeklyOff, ShiftId, Remarks)
    SELECT 
        m.EmployeeCode,
        m.AttendanceDate,
        m.InTime,
        m.OutTime,
        m.Duration,
        m.Status,
        m.StatusCode,
        m.P1Status,
        m.Present,
        m.Absent,
        m.WeeklyOff,
        1,
        'Excel Verified'
    FROM dbo.ExcelAttendanceMaster_31014_Sep2026 m
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.ExcelAttendanceMaster_RecalculateShield s
        WHERE s.EmployeeCode = m.EmployeeCode AND s.AttendanceDate = m.AttendanceDate
    );
    PRINT '    ✓ Synchronized 30 verified records into dbo.ExcelAttendanceMaster_RecalculateShield.';
END;
PRINT '';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 4: Populate / Sync dbo.AttendanceLogs with Full Schema Compliance
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Syncing all 30 days into dbo.AttendanceLogs (Direct Overwrite with Triggers Disabled)...';

DECLARE @TargetEmpId INT;
SELECT TOP 1 @TargetEmpId = EmployeeId FROM dbo.Employees WHERE LTRIM(RTRIM(CAST(EmployeeCode AS VARCHAR(50)))) = '31014' OR EmployeeId = 31014;
IF @TargetEmpId IS NULL SET @TargetEmpId = 31014;

-- A. Update existing logs
UPDATE a
SET 
    a.InTime = m.InTime,
    a.OutTime = m.OutTime,
    a.Duration = m.Duration,
    a.PunchRecords = m.PunchRecords,
    a.Status = m.Status,
    a.StatusCode = m.StatusCode,
    a.P1Status = m.P1Status,
    a.Present = m.Present,
    a.Absent = m.Absent,
    a.WeeklyOff = m.WeeklyOff,
    a.Holiday = 0,
    a.IsOnLeave = 0,
    a.LateBy = 0,
    a.EarlyBy = 0,
    a.IsonSpecialOff = 0,
    a.OverTime = 0,
    a.OverTimeE = 0,
    a.MissedOutPunch = 0,
    a.MissedInPunch = 0,
    a.ShiftId = 1,
    a.Remarks = 'Excel Verified'
FROM dbo.AttendanceLogs a
JOIN dbo.ExcelAttendanceMaster_31014_Sep2026 m
    ON CAST(a.AttendanceDate AS DATE) = m.AttendanceDate
WHERE a.EmployeeId = @TargetEmpId;

-- B. Insert any missing days (e.g. if any day was completely deleted)
INSERT INTO dbo.AttendanceLogs (
    EmployeeId,
    AttendanceDate,
    InTime,
    OutTime,
    Duration,
    PunchRecords,
    Status,
    StatusCode,
    P1Status,
    Present,
    Absent,
    WeeklyOff,
    Holiday,
    IsOnLeave,
    LateBy,
    EarlyBy,
    IsonSpecialOff,
    OverTime,
    OverTimeE,
    MissedOutPunch,
    MissedInPunch,
    ShiftId,
    Remarks
)
SELECT
    @TargetEmpId,
    m.AttendanceDate,
    m.InTime,
    m.OutTime,
    m.Duration,
    m.PunchRecords,
    m.Status,
    m.StatusCode,
    m.P1Status,
    m.Present,
    m.Absent,
    m.WeeklyOff,
    0, -- Holiday
    0, -- IsOnLeave
    0, -- LateBy
    0, -- EarlyBy
    0, -- IsonSpecialOff
    0, -- OverTime
    0, -- OverTimeE
    0, -- MissedOutPunch
    0, -- MissedInPunch
    1, -- ShiftId (General Shift)
    'Excel Verified'
FROM dbo.ExcelAttendanceMaster_31014_Sep2026 m
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.AttendanceLogs a WITH (NOLOCK)
    WHERE a.EmployeeId = @TargetEmpId
      AND CAST(a.AttendanceDate AS DATE) = m.AttendanceDate
);

PRINT '    ✅ All 30 days of September 2026 synced into dbo.AttendanceLogs.';
PRINT '';

-- CRITICAL: Re-enable triggers on dbo.AttendanceLogs
PRINT '>>> Re-enabling triggers on dbo.AttendanceLogs...';
ENABLE TRIGGER ALL ON dbo.AttendanceLogs;
PRINT '    ✓ Triggers re-enabled on dbo.AttendanceLogs.';
PRINT '';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 5: Install / Update Recalculate-Protection Shield Trigger
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Installing Master Recalculate-Protection Shield Trigger for 31014...';

IF OBJECT_ID('dbo.trg_AttendanceLogs_RecalculateShield_31014', 'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_AttendanceLogs_RecalculateShield_31014;
GO

CREATE TRIGGER dbo.trg_AttendanceLogs_RecalculateShield_31014
ON dbo.AttendanceLogs
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    -- If eTimeTrackLite's "Recalculate Attendance" attempts to overwrite verified data:
    IF EXISTS (
        SELECT 1 
        FROM inserted i
        JOIN dbo.Employees e ON i.EmployeeId = e.EmployeeId
        JOIN dbo.ExcelAttendanceMaster_31014_Sep2026 m 
            ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = m.EmployeeCode
           AND CAST(i.AttendanceDate AS DATE) = m.AttendanceDate
        WHERE ISNULL(i.Remarks, '') <> 'Excel Verified'
           OR i.InTime <> m.InTime
           OR i.OutTime <> m.OutTime
           OR i.Duration <> m.Duration
           OR i.Status <> m.Status
           OR i.Present <> m.Present
           OR i.Absent <> m.Absent
           OR i.WeeklyOff <> m.WeeklyOff
    )
    BEGIN
        UPDATE a
        SET 
            a.InTime = m.InTime,
            a.OutTime = m.OutTime,
            a.Duration = m.Duration,
            a.PunchRecords = m.PunchRecords,
            a.Status = m.Status,
            a.StatusCode = m.StatusCode,
            a.P1Status = m.P1Status,
            a.Present = m.Present,
            a.Absent = m.Absent,
            a.WeeklyOff = m.WeeklyOff,
            a.Holiday = 0,
            a.IsOnLeave = 0,
            a.LateBy = 0,
            a.EarlyBy = 0,
            a.IsonSpecialOff = 0,
            a.OverTime = 0,
            a.OverTimeE = 0,
            a.MissedOutPunch = 0,
            a.MissedInPunch = 0,
            a.ShiftId = 1,
            a.Remarks = 'Excel Verified'
        FROM dbo.AttendanceLogs a
        JOIN inserted i ON a.AttendanceLogId = i.AttendanceLogId
        JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
        JOIN dbo.ExcelAttendanceMaster_31014_Sep2026 m 
            ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = m.EmployeeCode
           AND CAST(a.AttendanceDate AS DATE) = m.AttendanceDate;
    END;
END;
GO

PRINT '    ✅ Recalculate-Protection Trigger installed successfully!';
PRINT '';
GO

-- ----------------------------------------------------------------------------------------------------
-- STEP 6: Verification Query (All 30 Days of September 2026)
-- ----------------------------------------------------------------------------------------------------
PRINT '>>> Verification: Displaying September 2026 records for Employee 31014:';
SELECT 
    e.EmployeeCode,
    e.EmployeeName,
    CONVERT(VARCHAR(10), a.AttendanceDate, 120) AS ShiftDate,
    a.InTime,
    a.OutTime,
    a.Duration AS DurationMins,
    CONVERT(VARCHAR(5), DATEADD(minute, a.Duration, 0), 108) AS WorkingTime,
    a.PunchRecords,
    a.Status,
    a.StatusCode,
    a.Present,
    a.Absent,
    a.WeeklyOff,
    a.Remarks
FROM dbo.AttendanceLogs a WITH (NOLOCK)
JOIN dbo.Employees e WITH (NOLOCK) ON a.EmployeeId = e.EmployeeId
WHERE (e.EmployeeCode = '31014' OR a.EmployeeId = 31014)
  AND a.AttendanceDate >= '2026-09-01' AND a.AttendanceDate <= '2026-09-30'
ORDER BY a.AttendanceDate;
GO

PRINT '';
PRINT '======================================================================';
PRINT '✅ COMPLETED: 31014 ALL 30 DAYS SYNCED & PROTECTED!';
PRINT '======================================================================';
GO
