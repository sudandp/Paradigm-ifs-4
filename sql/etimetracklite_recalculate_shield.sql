-- ====================================================================================================
-- ETIMETRACKLITE MASTER RECALCULATE-PROTECTION SHIELD & ATTENDANCE SYNC SCRIPT
-- Database: etimetracklite1
-- Purpose : Installs a database trigger so whenever eTimeTrackLite recalculates/reprocesses attendance,
--           the verified shift records (75 records) are NEVER overwritten with 'A' or blank!
-- ====================================================================================================

USE [etimetracklite1];
GO

SET NOCOUNT ON;
PRINT '======================================================================';
PRINT '  Starting Master Recalculate-Protection Shield Setup';
PRINT '======================================================================';
PRINT '';

-- 1. Create or Recreate Master Reference Table
IF OBJECT_ID('dbo.ExcelAttendanceMaster_RecalculateShield', 'U') IS NOT NULL
    DROP TABLE dbo.ExcelAttendanceMaster_RecalculateShield;
GO

CREATE TABLE dbo.ExcelAttendanceMaster_RecalculateShield (
    EmployeeCode VARCHAR(50) NOT NULL,
    AttendanceDate DATE NOT NULL,
    InTime NVARCHAR(255) NOT NULL,
    OutTime NVARCHAR(255) NOT NULL,
    Duration FLOAT NOT NULL,
    Status NVARCHAR(50) NOT NULL,
    StatusCode NVARCHAR(50) NOT NULL,
    P1Status NVARCHAR(50) NOT NULL,
    Present FLOAT NOT NULL,
    Absent FLOAT NOT NULL,
    WeeklyOff INT NOT NULL,
    ShiftId INT NOT NULL,
    Remarks NVARCHAR(255) NULL,
    PRIMARY KEY (EmployeeCode, AttendanceDate)
);
GO

INSERT INTO dbo.ExcelAttendanceMaster_RecalculateShield (EmployeeCode, AttendanceDate, InTime, OutTime, Duration, Status, StatusCode, P1Status, Present, Absent, WeeklyOff, ShiftId, Remarks) VALUES
('420002', '2026-07-27', '2026-07-27 20:46:00', '2026-07-28 07:16:00', 630, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420002', '2026-07-28', '2026-07-28 07:04:00', '2026-07-28 14:12:00', 428, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420002', '2026-08-11', '2026-08-11 07:19:00', '2026-08-11 20:54:00', 815, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420002', '2026-08-13', '2026-08-13 08:15:00', '2026-08-13 21:00:00', 765, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420002', '2026-08-15', '2026-08-15 07:13:00', '2026-08-15 20:53:00', 820, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420002', '2026-08-17', '2026-08-17 07:06:00', '2026-08-17 14:02:00', 416, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420003', '2026-07-27', '2026-07-27 07:01:00', '2026-07-27 14:06:00', 421, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420003', '2026-07-29', '2026-07-29 07:03:00', '2026-07-29 14:13:00', 430, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420003', '2026-08-03', '2026-08-03 07:06:00', '2026-08-03 14:16:00', 430, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420003', '2026-08-10', '2026-08-10 07:06:00', '2026-08-10 16:17:00', 551, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420003', '2026-08-15', '2026-08-15 20:56:00', '2026-08-16 14:29:00', 1053, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420003', '2026-08-16', '2026-08-16 07:00:00', '2026-08-16 14:03:00', 423, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420053', '2026-08-16', '2026-08-16 08:57:00', '2026-08-16 17:28:00', 511, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420053', '2026-08-23', '2026-08-23 08:56:00', '2026-08-23 18:26:00', 570, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420054', '2026-07-26', '2026-07-26 14:12:00', '2026-07-26 20:59:00', 407, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420054', '2026-07-31', '2026-07-31 21:01:00', '2026-08-01 07:09:00', 608, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420054', '2026-08-08', '2026-08-08 21:02:00', '2026-08-09 07:17:00', 615, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420054', '2026-08-09', '2026-08-09 07:19:00', '2026-08-09 14:20:00', 421, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420054', '2026-08-12', '2026-08-12 21:07:00', '2026-08-13 07:07:00', 607, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420054', '2026-08-13', '2026-08-13 21:03:00', '2026-08-14 07:00:00', 597, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420054', '2026-08-14', '2026-08-14 06:59:00', '2026-08-14 14:01:00', 422, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420054', '2026-08-18', '2026-08-18 20:45:00', '2026-08-19 07:07:00', 622, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420054', '2026-08-24', '2026-08-24 07:12:00', '2026-08-24 14:15:00', 423, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420055', '2026-07-27', '2026-07-27 13:47:00', '2026-07-28 07:06:00', 1028, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420055', '2026-07-28', '2026-07-28 07:03:00', '2026-07-28 14:18:00', 435, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420055', '2026-08-02', '2026-08-02 07:06:00', '2026-08-02 14:00:00', 414, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420055', '2026-08-04', '2026-08-04 07:00:00', '2026-08-04 14:03:00', 417, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420066', '2026-08-01', '2026-08-01 07:03:00', '2026-08-01 13:56:00', 413, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420071', '2026-07-26', '2026-07-26 08:47:00', '2026-07-27 08:47:00', 1440, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420071', '2026-08-01', '2026-08-01 08:52:00', '2026-08-01 17:57:00', 545, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420071', '2026-08-03', '2026-08-03 08:44:00', '2026-08-03 17:50:00', 546, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420071', '2026-08-09', '2026-08-09 08:51:00', '2026-08-09 17:54:00', 543, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420071', '2026-08-10', '2026-08-10 08:30:00', '2026-08-10 18:04:00', 574, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420071', '2026-08-24', '2026-08-24 08:26:00', '2026-08-24 17:35:00', 549, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420072', '2026-08-08', '2026-08-08 20:50:00', '2026-08-09 07:23:00', 633, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420073', '2026-07-28', '2026-07-28 06:53:00', '2026-07-28 14:09:00', 436, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420073', '2026-08-02', '2026-08-02 06:47:00', '2026-08-02 14:05:00', 438, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420073', '2026-08-03', '2026-08-03 13:25:00', '2026-08-04 07:09:00', 1064, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420073', '2026-08-04', '2026-08-04 07:16:00', '2026-08-04 21:14:00', 837, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420073', '2026-08-05', '2026-08-05 14:02:00', '2026-08-06 07:17:00', 1035, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420073', '2026-08-06', '2026-08-06 14:11:00', '2026-08-07 07:15:00', 1024, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420073', '2026-08-07', '2026-08-07 13:41:00', '2026-08-07 21:05:00', 444, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420074', '2026-08-10', '2026-08-10 07:06:00', '2026-08-10 14:09:00', 423, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420076', '2026-07-26', '2026-07-26 07:20:00', '2026-07-26 14:23:00', 443, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420076', '2026-07-27', '2026-07-27 07:05:00', '2026-07-27 14:07:00', 422, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420076', '2026-07-28', '2026-07-28 07:02:00', '2026-07-28 21:05:00', 843, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420076', '2026-07-29', '2026-07-29 07:16:00', '2026-07-29 20:36:00', 800, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420076', '2026-07-30', '2026-07-30 06:54:00', '2026-07-30 14:17:00', 443, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420076', '2026-08-06', '2026-08-06 06:56:00', '2026-08-06 13:58:00', 422, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420076', '2026-08-10', '2026-08-10 06:51:00', '2026-08-10 14:07:00', 436, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420077', '2026-07-26', '2026-07-26 07:20:00', '2026-07-26 20:53:00', 813, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420077', '2026-07-28', '2026-07-28 07:01:00', '2026-07-28 20:56:00', 835, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420077', '2026-07-29', '2026-07-29 07:22:00', '2026-07-29 20:54:00', 811, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420077', '2026-07-31', '2026-07-31 13:55:00', '2026-07-31 21:02:00', 427, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420077', '2026-08-01', '2026-08-01 06:48:00', '2026-08-01 20:59:00', 851, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420077', '2026-08-02', '2026-08-02 07:01:00', '2026-08-02 20:59:00', 838, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420077', '2026-08-03', '2026-08-03 07:05:00', '2026-08-03 14:25:00', 440, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420077', '2026-08-04', '2026-08-04 07:05:00', '2026-08-04 21:02:00', 837, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420077', '2026-08-05', '2026-08-05 07:17:00', '2026-08-05 14:30:00', 433, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420078', '2026-07-26', '2026-07-26 13:57:00', '2026-07-27 07:11:00', 1034, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420078', '2026-07-30', '2026-07-30 07:59:00', '2026-07-30 21:02:00', 783, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420078', '2026-08-08', '2026-08-08 07:01:00', '2026-08-08 14:02:00', 421, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420078', '2026-08-11', '2026-08-11 07:12:00', '2026-08-11 20:55:00', 823, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420078', '2026-08-12', '2026-08-12 07:01:00', '2026-08-12 14:07:00', 426, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420078', '2026-08-18', '2026-08-18 07:10:00', '2026-08-18 14:05:00', 425, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420078', '2026-08-23', '2026-08-23 07:05:00', '2026-08-23 14:06:00', 421, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420078', '2026-08-25', '2026-08-25 07:08:00', '2026-08-25 14:10:00', 422, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420079', '2026-07-26', '2026-07-26 06:52:00', '2026-07-26 14:14:00', 442, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420079', '2026-07-29', '2026-07-29 14:00:00', '2026-07-29 21:02:00', 422, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420079', '2026-08-11', '2026-08-11 07:10:00', '2026-08-11 14:20:00', 430, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420081', '2026-08-06', '2026-08-06 20:58:00', '2026-08-07 07:02:00', 604, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420081', '2026-08-07', '2026-08-07 07:15:00', '2026-08-07 14:18:00', 422, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420082', '2026-08-14', '2026-08-14 13:12:00', '2026-08-14 20:56:00', 464, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420082', '2026-08-16', '2026-08-16 20:42:00', '2026-08-17 07:10:00', 628, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified'),
('420082', '2026-08-17', '2026-08-17 07:10:00', '2026-08-17 14:16:00', 426, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Excel Verified');

PRINT '    ✅ Master Reference Table dbo.ExcelAttendanceMaster_RecalculateShield populated with ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records.';
GO

-- 2. Immediate Update of dbo.AttendanceLogs with Master Reference
PRINT '>>> Step 1: Enforcing Master Reference Data on dbo.AttendanceLogs...';
UPDATE a
SET 
    a.InTime = m.InTime,
    a.OutTime = m.OutTime,
    a.Duration = m.Duration,
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
    a.OverTime = 0,
    a.OverTimeE = 0,
    a.MissedOutPunch = 0,
    a.MissedInPunch = 0,
    a.Remarks = m.Remarks,
    a.ShiftId = ISNULL(a.ShiftId, 1)
FROM dbo.AttendanceLogs a
JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
JOIN dbo.ExcelAttendanceMaster_RecalculateShield m 
    ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = m.EmployeeCode
   AND CAST(a.AttendanceDate AS DATE) = m.AttendanceDate;

PRINT '    ✅ Updated existing records in dbo.AttendanceLogs.';

INSERT INTO dbo.AttendanceLogs (
    AttendanceDate, 
    EmployeeId, 
    InTime, 
    OutTime, 
    Duration, 
    Status, 
    StatusCode, 
    P1Status, 
    Present, 
    Absent, 
    WeeklyOff, 
    IsOnLeave, 
    Holiday, 
    LateBy, 
    EarlyBy, 
    OverTime, 
    OverTimeE,
    MissedOutPunch,
    MissedInPunch,
    ShiftId, 
    Remarks
)
SELECT 
    CAST(m.AttendanceDate AS DATETIME),
    e.EmployeeId,
    m.InTime,
    m.OutTime,
    m.Duration,
    m.Status,
    m.StatusCode,
    m.P1Status,
    m.Present,
    m.Absent,
    m.WeeklyOff,
    0, 0, 0, 0, 0, 0, 0, 0,
    1 AS ShiftId,
    m.Remarks
FROM dbo.ExcelAttendanceMaster_RecalculateShield m
JOIN dbo.Employees e ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = m.EmployeeCode
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.AttendanceLogs a 
    WHERE a.EmployeeId = e.EmployeeId AND CAST(a.AttendanceDate AS DATE) = m.AttendanceDate
);

PRINT '    ✅ Inserted any missing records in dbo.AttendanceLogs.';
GO

-- ====================================================================================================
-- 3. Install RECALCULATE AUTO-PROTECTION TRIGGER on dbo.AttendanceLogs
-- Whenever eTimeTrackLite recalculates / processes attendance, this trigger automatically
-- intercepts the calculation and enforces the exact verified Excel values!
-- ====================================================================================================
PRINT '>>> Step 2: Installing Recalculate-Protection Trigger on dbo.AttendanceLogs...';
GO

IF OBJECT_ID('dbo.trg_AttendanceLogs_RecalculateShield', 'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_AttendanceLogs_RecalculateShield;
GO

CREATE TRIGGER dbo.trg_AttendanceLogs_RecalculateShield
ON dbo.AttendanceLogs
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Prevent infinite recursion
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    -- If the recalculated rows affect our verified employees, enforce master values
    IF EXISTS (
        SELECT 1 
        FROM inserted i
        JOIN dbo.Employees e ON i.EmployeeId = e.EmployeeId
        JOIN dbo.ExcelAttendanceMaster_RecalculateShield m 
            ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = m.EmployeeCode
           AND CAST(i.AttendanceDate AS DATE) = m.AttendanceDate
    )
    BEGIN
        UPDATE a
        SET 
            a.InTime = m.InTime,
            a.OutTime = m.OutTime,
            a.Duration = m.Duration,
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
            a.OverTime = 0,
            a.OverTimeE = 0,
            a.MissedOutPunch = 0,
            a.MissedInPunch = 0,
            a.Remarks = 'Excel Verified'
        FROM dbo.AttendanceLogs a
        JOIN inserted i ON a.AttendanceLogId = i.AttendanceLogId
        JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
        JOIN dbo.ExcelAttendanceMaster_RecalculateShield m 
            ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = m.EmployeeCode
           AND CAST(a.AttendanceDate AS DATE) = m.AttendanceDate
        WHERE 
            ISNULL(a.InTime, '') <> m.InTime
            OR ISNULL(a.OutTime, '') <> m.OutTime
            OR ISNULL(a.Duration, -1) <> m.Duration
            OR ISNULL(a.Status, '') <> m.Status
            OR ISNULL(a.StatusCode, '') <> m.StatusCode
            OR ISNULL(a.P1Status, '') <> m.P1Status
            OR ISNULL(a.Present, -1) <> m.Present
            OR ISNULL(a.Absent, -1) <> m.Absent
            OR ISNULL(a.WeeklyOff, -1) <> m.WeeklyOff
            OR ISNULL(a.Remarks, '') <> 'Excel Verified';
    END
END;
GO

PRINT '    ✅ Recalculate-Protection Trigger installed successfully!';
PRINT '';
PRINT '======================================================================';
PRINT '✅ MASTER RECALCULATE-PROTECTION SHIELD IS NOW ACTIVE!';
PRINT '   - Even if you click "Recalculate" in eTimeTrackLite, all 75 shift records';
PRINT '     will remain 100% PRESENT with full InTime, OutTime, and Duration!';
PRINT '======================================================================';
GO
