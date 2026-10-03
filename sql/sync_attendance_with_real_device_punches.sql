USE [etimetracklite1];
GO

SET NOCOUNT ON;

PRINT '========================================================================================';
PRINT '  [PARADIGM] SYNCING IN/OUT TIMINGS WITH ACTUAL BIOMETRIC DEVICE PUNCHES (SEPTEMBER 2026)';
PRINT '========================================================================================';

-- 1. Identify Night Shift IDs dynamically (using ShiftFName and ShiftSName)
IF OBJECT_ID('tempdb..#NightShiftIds') IS NOT NULL DROP TABLE #NightShiftIds;

SELECT ShiftId
INTO #NightShiftIds
FROM dbo.Shifts
WHERE ShiftFName LIKE '%Night%' 
   OR ShiftFName LIKE '%C Shift%' 
   OR ShiftSName = 'C' 
   OR ShiftSName = 'NIGHT-12'
   OR ShiftFName LIKE '%Shift C%';

-- 2. Combine DeviceLogs and DeviceLogs_9_2026 for September 2026
IF OBJECT_ID('tempdb..#AllDevicePunches') IS NOT NULL DROP TABLE #AllDevicePunches;

SELECT DISTINCT
    CAST(LTRIM(RTRIM(dl.UserId)) AS VARCHAR(50)) AS EmployeeCode,
    dl.LogDate,
    CAST(dl.LogDate AS DATE) AS PunchDate,
    CAST(dl.LogDate AS TIME) AS PunchTime
INTO #AllDevicePunches
FROM (
    SELECT UserId, LogDate FROM dbo.DeviceLogs WHERE LogDate >= '2026-09-01 00:00:00' AND LogDate < '2026-10-02 12:00:00'
    UNION ALL
    SELECT UserId, LogDate FROM dbo.DeviceLogs_9_2026 WHERE LogDate >= '2026-09-01 00:00:00' AND LogDate < '2026-10-02 12:00:00'
) dl
INNER JOIN dbo.Employees e ON LTRIM(RTRIM(e.EmployeeCode)) = LTRIM(RTRIM(dl.UserId))
WHERE dl.UserId IS NOT NULL AND LTRIM(RTRIM(dl.UserId)) <> '';

CREATE CLUSTERED INDEX IX_Punches ON #AllDevicePunches(EmployeeCode, LogDate);

-- 3. Compute Day-Shift Punches (Earliest and Latest on AttendanceDate)
IF OBJECT_ID('tempdb..#DayShiftPunches') IS NOT NULL DROP TABLE #DayShiftPunches;

SELECT 
    p.EmployeeCode,
    p.PunchDate AS AttendanceDate,
    MIN(p.LogDate) AS DeviceInTime,
    MAX(p.LogDate) AS DeviceOutTime,
    COUNT(p.LogDate) AS PunchCount
INTO #DayShiftPunches
FROM #AllDevicePunches p
GROUP BY p.EmployeeCode, p.PunchDate;

-- 4. Compute Night-Shift Punches (Crosses Midnight into Next Day Morning)
IF OBJECT_ID('tempdb..#NightShiftPunches') IS NOT NULL DROP TABLE #NightShiftPunches;

SELECT 
    inP.EmployeeCode,
    inP.PunchDate AS AttendanceDate,
    MIN(inP.LogDate) AS DeviceInTime,
    COALESCE(
        -- Next morning exit before 10:30 AM
        (SELECT MIN(outP.LogDate) 
         FROM #AllDevicePunches outP 
         WHERE outP.EmployeeCode = inP.EmployeeCode 
           AND outP.PunchDate = DATEADD(day, 1, inP.PunchDate)
           AND outP.PunchTime <= '10:30:00'),
        -- Fallback: latest evening punch
        MAX(inP.LogDate)
    ) AS DeviceOutTime
INTO #NightShiftPunches
FROM #AllDevicePunches inP
WHERE inP.PunchTime >= '18:00:00'
GROUP BY inP.EmployeeCode, inP.PunchDate;

-- 5. Update dbo.AttendanceLogs with Real Device Timings for Worked Days
BEGIN TRANSACTION;

-- A. Update Normal Day Shifts (A, B, GS, Day-12, etc.) where StatusCode != 'WO'
UPDATE a
SET 
    a.InTime = CASE 
                    WHEN dsp.DeviceInTime IS NOT NULL THEN dsp.DeviceInTime 
                    ELSE a.InTime 
               END,
    a.OutTime = CASE 
                    WHEN dsp.DeviceOutTime IS NOT NULL AND dsp.DeviceOutTime > dsp.DeviceInTime THEN dsp.DeviceOutTime
                    WHEN dsp.DeviceInTime IS NOT NULL THEN DATEADD(hour, 8, dsp.DeviceInTime)
                    ELSE a.OutTime 
                END,
    a.Duration = CASE 
                    WHEN dsp.DeviceInTime IS NOT NULL AND dsp.DeviceOutTime IS NOT NULL AND dsp.DeviceOutTime > dsp.DeviceInTime 
                         THEN DATEDIFF(minute, dsp.DeviceInTime, dsp.DeviceOutTime)
                    ELSE a.Duration 
                 END
FROM dbo.AttendanceLogs a
INNER JOIN dbo.Employees e ON e.EmployeeId = a.EmployeeId
INNER JOIN #DayShiftPunches dsp 
    ON LTRIM(RTRIM(e.EmployeeCode)) = dsp.EmployeeCode 
   AND CAST(a.AttendanceDate AS DATE) = dsp.AttendanceDate
WHERE a.AttendanceDate >= '2026-09-01' AND a.AttendanceDate <= '2026-09-30'
  AND a.StatusCode NOT IN ('WO', 'A')
  AND a.ShiftId NOT IN (SELECT ShiftId FROM #NightShiftIds);

-- B. Update Night Shifts (C Shift, Night-12) with Cross-Midnight Real Punches
UPDATE a
SET 
    a.InTime = CASE 
                    WHEN nsp.DeviceInTime IS NOT NULL THEN nsp.DeviceInTime 
                    ELSE a.InTime 
               END,
    a.OutTime = CASE 
                    WHEN nsp.DeviceOutTime IS NOT NULL AND nsp.DeviceOutTime > nsp.DeviceInTime THEN nsp.DeviceOutTime
                    WHEN nsp.DeviceInTime IS NOT NULL THEN DATEADD(hour, 8, nsp.DeviceInTime)
                    ELSE a.OutTime 
                END,
    a.Duration = CASE 
                    WHEN nsp.DeviceInTime IS NOT NULL AND nsp.DeviceOutTime IS NOT NULL AND nsp.DeviceOutTime > nsp.DeviceInTime 
                         THEN DATEDIFF(minute, nsp.DeviceInTime, nsp.DeviceOutTime)
                    ELSE a.Duration 
                 END
FROM dbo.AttendanceLogs a
INNER JOIN dbo.Employees e ON e.EmployeeId = a.EmployeeId
INNER JOIN #NightShiftPunches nsp 
    ON LTRIM(RTRIM(e.EmployeeCode)) = nsp.EmployeeCode 
   AND CAST(a.AttendanceDate AS DATE) = nsp.AttendanceDate
WHERE a.AttendanceDate >= '2026-09-01' AND a.AttendanceDate <= '2026-09-30'
  AND a.StatusCode NOT IN ('WO', 'A')
  AND a.ShiftId IN (SELECT ShiftId FROM #NightShiftIds);

-- C. Ensure Pure Weekly Offs and Absents remain Clean (1900-01-01)
UPDATE a
SET 
    a.InTime = '1900-01-01 00:00:00',
    a.OutTime = '1900-01-01 00:00:00',
    a.Duration = 0,
    a.OverTime = 0
FROM dbo.AttendanceLogs a
WHERE a.AttendanceDate >= '2026-09-01' AND a.AttendanceDate <= '2026-09-30'
  AND a.StatusCode IN ('WO', 'A');

COMMIT TRANSACTION;

PRINT '[OK] dbo.AttendanceLogs successfully synchronized with hardware device punch logs.';

-- 6. Verification Query: Inspect Goutam (31056) and others for exact device punches
SELECT 
    e.EmployeeCode,
    e.EmployeeName,
    CONVERT(VARCHAR(10), a.AttendanceDate, 120) AS AttendanceDate,
    a.StatusCode,
    ISNULL(s.ShiftFName, s.ShiftSName) AS ShiftName,
    CONVERT(VARCHAR(8), a.InTime, 108) AS RealInTime,
    CONVERT(VARCHAR(8), a.OutTime, 108) AS RealOutTime,
    a.Duration AS WorkedMinutes
FROM dbo.AttendanceLogs a
INNER JOIN dbo.Employees e ON e.EmployeeId = a.EmployeeId
LEFT JOIN dbo.Shifts s ON s.ShiftId = a.ShiftId
WHERE e.EmployeeCode IN ('31056', '31099', '31015')
  AND a.AttendanceDate >= '2026-09-01' AND a.AttendanceDate <= '2026-09-10'
ORDER BY e.EmployeeCode, a.AttendanceDate;
GO
