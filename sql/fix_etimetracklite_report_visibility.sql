-- ====================================================================================================
-- ETIMETRACKLITE REPORT COMPATIBILITY FIX SCRIPT (EXACT SCHEMA MATCHED)
-- Target Database: [etimetracklite1]
-- Table: dbo.AttendanceLogs
-- Solves: Missing StatusCode = 'P', P1Status = 'P', Present = 1.0, Absent = 0.0, ShiftId, Duration
-- ====================================================================================================

USE [etimetracklite1];
GO

SET NOCOUNT ON;
PRINT '======================================================================';
PRINT '  Starting Full Report-Schema Alignment for eTimeTrackLite';
PRINT '======================================================================';
PRINT '';

-- 1. Create Staging Table for Master Verified Attendance
IF OBJECT_ID('tempdb..#ReportAttendance') IS NOT NULL DROP TABLE #ReportAttendance;

CREATE TABLE #ReportAttendance (
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

INSERT INTO #ReportAttendance (EmployeeCode, AttendanceDate, InTime, OutTime, Duration, Status, StatusCode, P1Status, Present, Absent, WeeklyOff, ShiftId, Remarks) VALUES
('420002', '2026-07-27', '2026-07-27 20:46:00', '2026-07-28 07:16:00', 630, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420002', '2026-07-28', '2026-07-28 07:04:00', '2026-07-28 14:12:00', 428, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420002', '2026-08-11', '2026-08-11 07:19:00', '2026-08-11 20:54:00', 815, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420002', '2026-08-13', '2026-08-13 08:15:00', '2026-08-13 21:00:00', 765, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420002', '2026-08-15', '2026-08-15 07:13:00', '2026-08-15 20:53:00', 820, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420002', '2026-08-17', '2026-08-17 07:06:00', '2026-08-17 14:02:00', 416, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420003', '2026-07-27', '2026-07-27 07:01:00', '2026-07-27 14:06:00', 421, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420003', '2026-07-29', '2026-07-29 07:03:00', '2026-07-29 14:13:00', 430, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420003', '2026-08-03', '2026-08-03 07:06:00', '2026-08-03 14:16:00', 430, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420003', '2026-08-10', '2026-08-10 07:06:00', '2026-08-10 16:17:00', 551, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420003', '2026-08-15', '2026-08-15 20:56:00', '2026-08-16 14:29:00', 1053, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420003', '2026-08-16', '2026-08-16 07:00:00', '2026-08-16 14:03:00', 423, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420053', '2026-08-16', '2026-08-16 08:57:00', '2026-08-16 17:28:00', 511, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420053', '2026-08-23', '2026-08-23 08:56:00', '2026-08-23 18:26:00', 570, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420054', '2026-07-26', '2026-07-26 14:12:00', '2026-07-26 20:59:00', 407, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420054', '2026-07-31', '2026-07-31 21:01:00', '2026-08-01 07:09:00', 608, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420054', '2026-08-08', '2026-08-08 21:02:00', '2026-08-09 07:17:00', 615, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420054', '2026-08-09', '2026-08-09 07:19:00', '2026-08-09 14:20:00', 421, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420054', '2026-08-12', '2026-08-12 21:07:00', '2026-08-13 07:07:00', 607, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420054', '2026-08-13', '2026-08-13 21:03:00', '2026-08-14 07:00:00', 597, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420054', '2026-08-14', '2026-08-14 06:59:00', '2026-08-14 14:01:00', 422, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420054', '2026-08-18', '2026-08-18 20:45:00', '2026-08-19 07:07:00', 622, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420054', '2026-08-24', '2026-08-24 07:12:00', '2026-08-24 14:15:00', 423, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420055', '2026-07-27', '2026-07-27 13:47:00', '2026-07-28 07:06:00', 1028, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420055', '2026-07-28', '2026-07-28 07:03:00', '2026-07-28 14:18:00', 435, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420055', '2026-08-02', '2026-08-02 07:06:00', '2026-08-02 14:00:00', 414, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420055', '2026-08-04', '2026-08-04 07:00:00', '2026-08-04 14:03:00', 417, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420066', '2026-08-01', '2026-08-01 07:03:00', '2026-08-01 13:56:00', 413, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420071', '2026-07-26', '2026-07-26 08:47:00', '2026-07-27 08:47:00', 1440, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420071', '2026-08-01', '2026-08-01 08:52:00', '2026-08-01 17:57:00', 545, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420071', '2026-08-03', '2026-08-03 08:44:00', '2026-08-03 17:50:00', 546, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420071', '2026-08-09', '2026-08-09 08:51:00', '2026-08-09 17:54:00', 543, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420071', '2026-08-10', '2026-08-10 08:30:00', '2026-08-10 18:04:00', 574, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420071', '2026-08-24', '2026-08-24 08:26:00', '2026-08-24 17:35:00', 549, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420072', '2026-08-08', '2026-08-08 20:50:00', '2026-08-09 07:23:00', 633, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420073', '2026-07-28', '2026-07-28 06:53:00', '2026-07-28 14:09:00', 436, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420073', '2026-08-02', '2026-08-02 06:47:00', '2026-08-02 14:05:00', 438, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420073', '2026-08-03', '2026-08-03 13:25:00', '2026-08-04 07:09:00', 1064, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420073', '2026-08-04', '2026-08-04 07:16:00', '2026-08-04 21:14:00', 837, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420073', '2026-08-05', '2026-08-05 14:02:00', '2026-08-06 07:17:00', 1035, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420073', '2026-08-06', '2026-08-06 14:11:00', '2026-08-07 07:15:00', 1024, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420073', '2026-08-07', '2026-08-07 13:41:00', '2026-08-07 21:05:00', 444, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420074', '2026-08-10', '2026-08-10 07:06:00', '2026-08-10 14:09:00', 423, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420076', '2026-07-26', '2026-07-26 07:20:00', '2026-07-26 14:23:00', 443, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420076', '2026-07-27', '2026-07-27 07:05:00', '2026-07-27 14:07:00', 422, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420076', '2026-07-28', '2026-07-28 07:02:00', '2026-07-28 21:05:00', 843, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420076', '2026-07-29', '2026-07-29 07:16:00', '2026-07-29 20:36:00', 800, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420076', '2026-07-30', '2026-07-30 06:54:00', '2026-07-30 14:17:00', 443, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420076', '2026-08-06', '2026-08-06 06:56:00', '2026-08-06 13:58:00', 422, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420076', '2026-08-10', '2026-08-10 06:51:00', '2026-08-10 14:07:00', 436, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420077', '2026-07-26', '2026-07-26 07:20:00', '2026-07-26 20:53:00', 813, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420077', '2026-07-28', '2026-07-28 07:01:00', '2026-07-28 20:56:00', 835, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420077', '2026-07-29', '2026-07-29 07:22:00', '2026-07-29 20:54:00', 811, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420077', '2026-07-31', '2026-07-31 13:55:00', '2026-07-31 21:02:00', 427, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420077', '2026-08-01', '2026-08-01 06:48:00', '2026-08-01 20:59:00', 851, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420077', '2026-08-02', '2026-08-02 07:01:00', '2026-08-02 20:59:00', 838, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420077', '2026-08-03', '2026-08-03 07:05:00', '2026-08-03 14:25:00', 440, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420077', '2026-08-04', '2026-08-04 07:05:00', '2026-08-04 21:02:00', 837, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420077', '2026-08-05', '2026-08-05 07:17:00', '2026-08-05 14:30:00', 433, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420078', '2026-07-26', '2026-07-26 13:57:00', '2026-07-27 07:11:00', 1034, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420078', '2026-07-30', '2026-07-30 07:59:00', '2026-07-30 21:02:00', 783, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420078', '2026-08-08', '2026-08-08 07:01:00', '2026-08-08 14:02:00', 421, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420078', '2026-08-11', '2026-08-11 07:12:00', '2026-08-11 20:55:00', 823, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420078', '2026-08-12', '2026-08-12 07:01:00', '2026-08-12 14:07:00', 426, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420078', '2026-08-18', '2026-08-18 07:10:00', '2026-08-18 14:05:00', 425, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420078', '2026-08-23', '2026-08-23 07:05:00', '2026-08-23 14:06:00', 421, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420078', '2026-08-25', '2026-08-25 07:08:00', '2026-08-25 14:10:00', 422, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420079', '2026-07-26', '2026-07-26 06:52:00', '2026-07-26 14:14:00', 442, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420079', '2026-07-29', '2026-07-29 14:00:00', '2026-07-29 21:02:00', 422, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420079', '2026-08-11', '2026-08-11 07:10:00', '2026-08-11 14:20:00', 430, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420081', '2026-08-06', '2026-08-06 20:58:00', '2026-08-07 07:02:00', 604, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420081', '2026-08-07', '2026-08-07 07:15:00', '2026-08-07 14:18:00', 422, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420082', '2026-08-14', '2026-08-14 13:12:00', '2026-08-14 20:56:00', 464, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420082', '2026-08-16', '2026-08-16 20:42:00', '2026-08-17 07:10:00', 628, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync'),
('420082', '2026-08-17', '2026-08-17 07:10:00', '2026-08-17 14:16:00', 426, 'Present ', 'P', 'P', 1, 0, 0, 1, 'Manual Shift Sync');

PRINT '>>> Loaded ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records into report staging.';

-- 2. Update existing records in dbo.AttendanceLogs with full schema alignment
PRINT '>>> Step 1: Updating dbo.AttendanceLogs with full report attributes...';
UPDATE a
SET 
    a.InTime = ra.InTime,
    a.OutTime = ra.OutTime,
    a.Duration = ra.Duration,
    a.Status = ra.Status,
    a.StatusCode = ra.StatusCode,
    a.P1Status = ra.P1Status,
    a.Present = ra.Present,
    a.Absent = ra.Absent,
    a.WeeklyOff = ra.WeeklyOff,
    a.IsOnLeave = 0,
    a.Holiday = 0,
    a.LateBy = 0,
    a.EarlyBy = 0,
    a.OverTime = 0,
    a.OverTimeE = 0,
    a.MissedOutPunch = 0,
    a.MissedInPunch = 0,
    a.Remarks = ra.Remarks,
    a.ShiftId = ISNULL(a.ShiftId, 1)
FROM dbo.AttendanceLogs a
JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
JOIN #ReportAttendance ra 
    ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = ra.EmployeeCode
   AND CAST(a.AttendanceDate AS DATE) = ra.AttendanceDate;

PRINT '    ✅ Updated ' + CAST(@@ROWCOUNT AS VARCHAR) + ' records in dbo.AttendanceLogs.';

-- 3. Insert any missing records in dbo.AttendanceLogs
PRINT '>>> Step 2: Inserting any missing records into dbo.AttendanceLogs...';
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
    CAST(ra.AttendanceDate AS DATETIME),
    e.EmployeeId,
    ra.InTime,
    ra.OutTime,
    ra.Duration,
    ra.Status,
    ra.StatusCode,
    ra.P1Status,
    ra.Present,
    ra.Absent,
    ra.WeeklyOff,
    0 AS IsOnLeave,
    0 AS Holiday,
    0 AS LateBy,
    0 AS EarlyBy,
    0 AS OverTime,
    0 AS OverTimeE,
    0 AS MissedOutPunch,
    0 AS MissedInPunch,
    1 AS ShiftId,
    ra.Remarks
FROM #ReportAttendance ra
JOIN dbo.Employees e ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = ra.EmployeeCode
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.AttendanceLogs a 
    WHERE a.EmployeeId = e.EmployeeId AND CAST(a.AttendanceDate AS DATE) = ra.AttendanceDate
);

PRINT '    ✅ Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' missing records into dbo.AttendanceLogs.';

DROP TABLE #ReportAttendance;

PRINT '';
PRINT '======================================================================';
PRINT '✅ REPORT COMPATIBILITY FIX COMPLETED!';
PRINT '======================================================================';
GO

-- Verification Query: Check exact report view for these employees
SELECT 
    e.EmployeeCode,
    e.EmployeeName,
    CONVERT(VARCHAR(10), a.AttendanceDate, 120) AS ShiftDate,
    a.InTime,
    a.OutTime,
    a.Duration AS DurationMins,
    a.Status,
    a.StatusCode,
    a.P1Status,
    a.Present,
    a.Absent,
    a.Remarks
FROM dbo.AttendanceLogs a WITH (NOLOCK)
JOIN dbo.Employees e WITH (NOLOCK) ON a.EmployeeId = e.EmployeeId
WHERE e.EmployeeCode IN ('420002', '420003', '420053', '420054', '420055', '420066', '420071', '420072', '420073', '420074', '420076', '420077', '420078', '420079', '420081', '420082')
  AND a.AttendanceDate >= '2026-07-26' AND a.AttendanceDate <= '2026-08-25'
  AND a.StatusCode = 'P'
ORDER BY e.EmployeeCode, a.AttendanceDate;
GO
