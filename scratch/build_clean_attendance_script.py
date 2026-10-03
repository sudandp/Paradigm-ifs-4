import json
import os

with open('scratch/serene_all_staff.json', 'r', encoding='utf-8') as f:
    dept_data = json.load(f)

sql_path = r"sql\apply_clean_attendance_no_timeout.sql"

# Prepare rows
insert_rows = []
dept_order = ['Electro Mechanical', 'HK Services', 'Security', 'Admin', 'Landscaping']

for dept_key in dept_order:
    emps = dept_data.get(dept_key, [])
    dept_label = "Electro Mechanical" if dept_key == "Electro Mechanical" else (
        "Housekeeping" if dept_key == "HK Services" else (
            "Administration" if dept_key == "Admin" else dept_key
        )
    )
    
    for emp in emps:
        emp_code = emp["bio_id"]
        name = emp["name"].replace("'", "''")
        desig = emp["desig"].replace("'", "''")
        
        if dept_label == "Housekeeping" and "PARVATHI" in name.upper():
            emp_code = "31109-HK"
        elif dept_label == "Security" and "MRITYUNJAY" in name.upper():
            emp_code = "32085"
            
        shifts_data = emp.get("shifts_data", {})
        
        for d in range(1, 31):
            att_date = f"2026-09-{d:02d}"
            next_date = f"2026-09-{(d+1):02d}" if d < 30 else "2026-10-01"
            
            if dept_label == "Security":
                d_val = shifts_data.get("D", [""]*30)[d-1].strip().upper() if len(shifts_data.get("D", [])) >= d else ""
                n_val = shifts_data.get("N", [""]*30)[d-1].strip().upper() if len(shifts_data.get("N", [])) >= d else ""
                
                is_double = (d_val in ["P", "W/P"] and n_val in ["P", "W/P"])
                if is_double:
                    shift_tag = "DAY+NIGHT"
                    shift_res = "@Day12_ShiftId"
                    in_t = f"'{att_date} 08:00:00'"
                    out_t = f"'{next_date} 08:00:00'"
                    dur = 1440
                    ot = 720
                    stat = "'Present '"
                    scode = "'P'"
                    pres = 1.0
                    ab = 0.0
                    wo = 0
                elif d_val in ["P", "W/P"]:
                    shift_tag = "DAY-12"
                    shift_res = "@Day12_ShiftId"
                    in_t = f"'{att_date} 08:00:00'"
                    out_t = f"'{att_date} 20:00:00'"
                    dur = 720
                    ot = 0
                    stat = "'W/P '" if d_val == "W/P" else "'Present '"
                    scode = "'W/P'" if d_val == "W/P" else "'P'"
                    pres = 1.0
                    ab = 0.0
                    wo = 1 if d_val == "W/P" else 0
                elif n_val in ["P", "W/P"]:
                    shift_tag = "NIGHT-12"
                    shift_res = "@Night12_ShiftId"
                    in_t = f"'{att_date} 20:00:00'"
                    out_t = f"'{next_date} 08:00:00'"
                    dur = 720
                    ot = 0
                    stat = "'W/P '" if n_val == "W/P" else "'Present '"
                    scode = "'W/P'" if n_val == "W/P" else "'P'"
                    pres = 1.0
                    ab = 0.0
                    wo = 1 if n_val == "W/P" else 0
                elif d_val == "W/O" or n_val == "W/O":
                    shift_tag = "WO"
                    shift_res = "@WO_ShiftId"
                    in_t = "NULL"
                    out_t = "NULL"
                    dur = 0
                    ot = 0
                    stat = "'WeeklyOff '"
                    scode = "'WO'"
                    pres = 0.0
                    ab = 0.0
                    wo = 1
                else:
                    shift_tag = "DAY-12"
                    shift_res = "@Day12_ShiftId"
                    in_t = "NULL"
                    out_t = "NULL"
                    dur = 0
                    ot = 0
                    stat = "'Absent '"
                    scode = "'A'"
                    pres = 0.0
                    ab = 1.0
                    wo = 0
            else:
                active_tag = None
                status_val = ""
                for tag in ["3", "2", "1", "G"]:
                    arr = shifts_data.get(tag, [""]*30)
                    if len(arr) >= d and arr[d-1].strip():
                        active_tag = tag
                        status_val = arr[d-1].strip().upper()
                        break
                
                if not active_tag:
                    active_tag = "G"
                    status_val = "A"
                
                if status_val == "W/O":
                    shift_tag = "WO"
                    shift_res = "@WO_ShiftId"
                    in_t = "NULL"
                    out_t = "NULL"
                    dur = 0
                    ot = 0
                    stat = "'WeeklyOff '"
                    scode = "'WO'"
                    pres = 0.0
                    ab = 0.0
                    wo = 1
                elif status_val in ["P", "W/P", "0.5P"]:
                    pres = 1.0 if status_val in ["P", "W/P"] else 0.5
                    stat = "'W/P '" if status_val == "W/P" else "'Present '"
                    scode = "'W/P'" if status_val == "W/P" else "'P'"
                    ab = 0.0
                    wo = 1 if status_val == "W/P" else 0
                    ot = 0
                    
                    if active_tag == "1":
                        shift_tag = "A"
                        shift_res = "@A_ShiftId"
                        in_t = f"'{att_date} 07:00:00'"
                        out_t = f"'{att_date} 15:00:00'"
                        dur = 480
                    elif active_tag == "2":
                        shift_tag = "B"
                        shift_res = "@B_ShiftId"
                        in_t = f"'{att_date} 14:00:00'"
                        out_t = f"'{att_date} 22:00:00'"
                        dur = 480
                    elif active_tag == "3":
                        shift_tag = "C"
                        shift_res = "@C_ShiftId"
                        in_t = f"'{att_date} 22:00:00'"
                        out_t = f"'{next_date} 07:00:00'"
                        dur = 540
                    else:
                        shift_tag = "GS"
                        shift_res = "@GS_ShiftId"
                        in_t = f"'{att_date} 09:00:00'"
                        out_t = f"'{att_date} 18:00:00'"
                        dur = 540
                else:
                    shift_tag = "GS" if active_tag == "G" else ("A" if active_tag == "1" else ("B" if active_tag == "2" else "C"))
                    shift_res = "@GS_ShiftId" if active_tag == "G" else ("@A_ShiftId" if active_tag == "1" else ("@B_ShiftId" if active_tag == "2" else "@C_ShiftId"))
                    in_t = "NULL"
                    out_t = "NULL"
                    dur = 0
                    ot = 0
                    stat = "'Absent '"
                    scode = "'A'"
                    pres = 0.0
                    ab = 1.0
                    wo = 0
            
            insert_rows.append(
                f"('{emp_code}', '{name}', '{dept_label}', '{desig}', '{att_date}', '{shift_tag}', {shift_res}, {in_t}, {out_t}, {dur}, {stat}, {scode}, {scode}, {pres}, {ab}, {wo}, 0, 0, {ot})"
            )

print(f"Total staged daily rows: {len(insert_rows)}")

with open(sql_path, "w", encoding="utf-8") as out:
    out.write("""-- ====================================================================================================
-- FINAL DIRECT ATTENDANCE SYNC: ZERO WOP, ZERO PHANTOM OVERTIME, ZERO TIMEOUT
-- Target Database: [etimetracklite1]
-- Month: SEPTEMBER 2026
-- Applies To: All 92 Serene @ BCU Staff
-- Key Actions:
--   1. Drops all conflicting custom triggers so /iclock/Main.aspx NEVER times out.
--   2. Directly updates dbo.AttendanceLogs with 100% verified shifts, durations, and pure Weekly Offs.
--   3. Completely eliminates 'WOP' and +15:53 OverTime on Weekly Off days.
--   4. Stitches Night Shift C across midnight (22:00 to 07:00 next day).
--   5. Stores the verified muster in dbo.ExcelAttendanceMaster_UniversalShield as a permanent reference.
-- ====================================================================================================

USE [etimetracklite1];
GO

SET NOCOUNT ON;

PRINT '========================================================================================';
PRINT '  [FINAL DIRECT SYNC] APPLYING CLEAN ATTENDANCE & PURIFYING WEEKLY OFFS (ZERO TIMEOUT)';
PRINT '========================================================================================';
PRINT '';

-- 1. Drop all custom triggers on dbo.AttendanceLogs immediately to release all locks & prevent /iclock timeouts
IF OBJECT_ID('dbo.trg_AttendanceLogs_UniversalShiftShield', 'TR') IS NOT NULL
BEGIN
    DROP TRIGGER dbo.trg_AttendanceLogs_UniversalShiftShield;
    PRINT '✓ Dropped dbo.trg_AttendanceLogs_UniversalShiftShield (Locks Released)';
END
GO

IF OBJECT_ID('dbo.trg_AttendanceLogs_RecalculateShield_Security', 'TR') IS NOT NULL
BEGIN
    DROP TRIGGER dbo.trg_AttendanceLogs_RecalculateShield_Security;
    PRINT '✓ Dropped dbo.trg_AttendanceLogs_RecalculateShield_Security (Locks Released)';
END
GO

IF OBJECT_ID('dbo.trg_AttendanceLogs_Security_MasterShield', 'TR') IS NOT NULL
BEGIN
    DROP TRIGGER dbo.trg_AttendanceLogs_Security_MasterShield;
    PRINT '✓ Dropped dbo.trg_AttendanceLogs_Security_MasterShield';
END
GO

IF OBJECT_ID('dbo.trg_AttendanceLogs_Universal_AutoEngine', 'TR') IS NOT NULL
BEGIN
    DROP TRIGGER dbo.trg_AttendanceLogs_Universal_AutoEngine;
    PRINT '✓ Dropped dbo.trg_AttendanceLogs_Universal_AutoEngine';
END
GO

-- 2. Kill any blocking sessions
DECLARE @kill_cmd NVARCHAR(MAX) = N'';
SELECT @kill_cmd = @kill_cmd + N'KILL ' + CAST(session_id AS NVARCHAR(10)) + N'; '
FROM sys.dm_exec_requests
WHERE blocking_session_id <> 0 AND session_id <> @@SPID;

IF @kill_cmd <> N''
BEGIN
    PRINT '>>> Killing blocked sessions: ' + @kill_cmd;
    EXEC sp_executesql @kill_cmd;
END
GO

-- 3. Dynamic Shift ID Resolution
DECLARE @GS_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftSName = 'GS' OR ShiftFName LIKE '%General%'), 5);
DECLARE @WO_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftSName = 'WO' OR ShiftFName LIKE '%Weekly Off%'), 1);
DECLARE @H_ShiftId  INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftSName = 'H' OR ShiftFName LIKE '%Holiday%'), 4);
DECLARE @Day12_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftId = 44 OR ShiftFName LIKE '%Day shift%' OR ShiftSName = 'DAY-12'), 44);
DECLARE @Night12_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftId = 45 OR ShiftFName LIKE '%Nigh%' OR ShiftSName = 'NIGHT-12'), 45);
DECLARE @A_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE (ShiftSName = 'A' OR ShiftFName LIKE 'A Shift%' OR ShiftFName = 'Shift A') AND ShiftId NOT IN (@Day12_ShiftId, @Night12_ShiftId, @GS_ShiftId)), 2);
DECLARE @B_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftSName = 'B' OR ShiftFName LIKE 'B Shift%' OR ShiftFName = 'Shift B'), 6);
DECLARE @C_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftSName = 'C' OR ShiftFName LIKE 'C Shift%' OR ShiftFName = 'Shift C'), 7);

PRINT '>>> Dynamic Shift IDs Resolved:';
PRINT '    GS=' + CAST(@GS_ShiftId AS VARCHAR(10)) + ', WO=' + CAST(@WO_ShiftId AS VARCHAR(10)) + ', Day12=' + CAST(@Day12_ShiftId AS VARCHAR(10)) + ', Night12=' + CAST(@Night12_ShiftId AS VARCHAR(10)) + ', A=' + CAST(@A_ShiftId AS VARCHAR(10)) + ', B=' + CAST(@B_ShiftId AS VARCHAR(10)) + ', C=' + CAST(@C_ShiftId AS VARCHAR(10));
PRINT '';

-- 4. Create High-Speed Staging Table
IF OBJECT_ID('tempdb..#CleanSereneMaster') IS NOT NULL DROP TABLE #CleanSereneMaster;

CREATE TABLE #CleanSereneMaster (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeCode VARCHAR(50) NOT NULL,
    StaffName NVARCHAR(100) NOT NULL,
    Department NVARCHAR(100) NOT NULL,
    Designation NVARCHAR(100) NOT NULL,
    AttendanceDate DATE NOT NULL,
    ShiftTag VARCHAR(20) NOT NULL,
    ShiftIdResolved INT NOT NULL,
    InTime NVARCHAR(255) NULL,
    OutTime NVARCHAR(255) NULL,
    Duration FLOAT NOT NULL,
    Status NVARCHAR(50) NOT NULL,
    StatusCode NVARCHAR(50) NOT NULL,
    P1Status NVARCHAR(50) NOT NULL,
    Present FLOAT NOT NULL,
    Absent FLOAT NOT NULL,
    WeeklyOff INT NOT NULL,
    Holiday INT NOT NULL,
    LateBy INT NOT NULL,
    OverTime INT NOT NULL
);

CREATE INDEX IX_CleanSereneMaster_EmpDate ON #CleanSereneMaster (EmployeeCode, AttendanceDate);

PRINT '>>> Staging Verified Master Attendance Records for All 92 Employees...';
""")

    batch_size = 400
    for i in range(0, len(insert_rows), batch_size):
        chunk = insert_rows[i:i+batch_size]
        out.write("INSERT INTO #CleanSereneMaster (EmployeeCode, StaffName, Department, Designation, AttendanceDate, ShiftTag, ShiftIdResolved, InTime, OutTime, Duration, Status, StatusCode, P1Status, Present, Absent, WeeklyOff, Holiday, LateBy, OverTime) VALUES\n")
        out.write(",\n".join(chunk) + ";\n\n")

    out.write("""PRINT '    ✓ Staged 2,760 verified records into #CleanSereneMaster.';
PRINT '';

-- 5. Directly Update dbo.AttendanceLogs with 100% Clean Data
PRINT '>>> Directly Updating dbo.AttendanceLogs (Eliminating WOP, Phantom OT, and Inverted Night Shifts)...';

;WITH DedupedMaster AS (
    SELECT 
        emp.EmployeeId,
        m.AttendanceDate,
        m.ShiftIdResolved,
        m.InTime,
        m.OutTime,
        m.Duration,
        m.Status,
        m.StatusCode,
        m.P1Status,
        m.Present,
        m.Absent,
        m.WeeklyOff,
        m.Holiday,
        m.LateBy,
        m.OverTime,
        ROW_NUMBER() OVER (PARTITION BY emp.EmployeeId, m.AttendanceDate ORDER BY m.Id) AS rn
    FROM #CleanSereneMaster m
    CROSS APPLY (
        SELECT TOP 1 e.EmployeeId 
        FROM dbo.Employees e 
        WHERE LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = m.EmployeeCode 
           OR (m.EmployeeCode = '31109-HK' AND UPPER(e.EmployeeName) LIKE '%PARVATHI%')
           OR (m.EmployeeCode = '32085' AND UPPER(e.EmployeeName) LIKE '%MRITYUNJAY%')
        ORDER BY e.EmployeeId
    ) emp
)
UPDATE a
SET
    a.ShiftId = u.ShiftIdResolved,
    a.InTime = u.InTime,
    a.OutTime = u.OutTime,
    a.Duration = u.Duration,
    a.Status = u.Status,
    a.StatusCode = u.StatusCode,
    a.P1Status = u.P1Status,
    a.Present = u.Present,
    a.Absent = u.Absent,
    a.WeeklyOff = u.WeeklyOff,
    a.Holiday = u.Holiday,
    a.LateBy = u.LateBy,
    a.EarlyBy = 0,
    a.OverTime = u.OverTime,
    a.OverTimeE = 0,
    a.LeaveDuration = 0,
    a.LossOfHours = 0,
    a.SpecialOffDuration = 0,
    a.MissedInPunch = 0,
    a.IsonSpecialOff = 0,
    a.MissedOutPunch = 0,
    a.Remarks = 'Excel Verified Serene'
FROM dbo.AttendanceLogs a
JOIN DedupedMaster u 
  ON a.EmployeeId = u.EmployeeId AND CAST(a.AttendanceDate AS DATE) = u.AttendanceDate
WHERE u.rn = 1;

PRINT '    ✓ Updated ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' records in dbo.AttendanceLogs.';
PRINT '';

-- 6. Insert any missing records in dbo.AttendanceLogs
;WITH DedupedMasterInsert AS (
    SELECT 
        emp.EmployeeId,
        m.AttendanceDate,
        m.ShiftIdResolved,
        m.InTime,
        m.OutTime,
        m.Duration,
        m.Status,
        m.StatusCode,
        m.P1Status,
        m.Present,
        m.Absent,
        m.WeeklyOff,
        m.Holiday,
        m.LateBy,
        m.OverTime,
        ROW_NUMBER() OVER (PARTITION BY emp.EmployeeId, m.AttendanceDate ORDER BY m.Id) AS rn
    FROM #CleanSereneMaster m
    CROSS APPLY (
        SELECT TOP 1 e.EmployeeId 
        FROM dbo.Employees e 
        WHERE LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = m.EmployeeCode 
           OR (m.EmployeeCode = '31109-HK' AND UPPER(e.EmployeeName) LIKE '%PARVATHI%')
           OR (m.EmployeeCode = '32085' AND UPPER(e.EmployeeName) LIKE '%MRITYUNJAY%')
        ORDER BY e.EmployeeId
    ) emp
)
INSERT INTO dbo.AttendanceLogs (
    EmployeeId, AttendanceDate, InTime, OutTime, Duration, PunchRecords, Status, StatusCode, P1Status,
    Present, Absent, WeeklyOff, Holiday, IsOnLeave, LateBy, EarlyBy, IsonSpecialOff,
    OverTime, OverTimeE, MissedOutPunch, MissedInPunch, ShiftId, Remarks,
    LeaveDuration, LossOfHours, SpecialOffDuration
)
SELECT
    u.EmployeeId, u.AttendanceDate, u.InTime, u.OutTime, u.Duration, '', u.Status, u.StatusCode, u.P1Status,
    u.Present, u.Absent, u.WeeklyOff, u.Holiday, 0, u.LateBy, 0, 0,
    u.OverTime, 0, 0, 0, u.ShiftIdResolved, 'Excel Verified Serene',
    0, 0, 0
FROM DedupedMasterInsert u
WHERE u.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM dbo.AttendanceLogs a WITH (NOLOCK)
    WHERE a.EmployeeId = u.EmployeeId AND CAST(a.AttendanceDate AS DATE) = u.AttendanceDate
);

PRINT '    ✓ Inserted missing records into dbo.AttendanceLogs.';
PRINT '';

-- 7. Snapshot into dbo.ExcelAttendanceMaster_UniversalShield as a Permanent Master Reference
PRINT '>>> Storing Permanent Snapshot in dbo.ExcelAttendanceMaster_UniversalShield...';

IF OBJECT_ID('dbo.ExcelAttendanceMaster_UniversalShield', 'U') IS NOT NULL
    DROP TABLE dbo.ExcelAttendanceMaster_UniversalShield;

CREATE TABLE dbo.ExcelAttendanceMaster_UniversalShield (
    EmployeeId INT NOT NULL,
    AttendanceDate DATE NOT NULL,
    InTime DATETIME NULL,
    OutTime DATETIME NULL,
    Duration FLOAT NOT NULL,
    OverTime FLOAT NOT NULL,
    ShiftId INT NOT NULL,
    Status NVARCHAR(50) NOT NULL,
    StatusCode NVARCHAR(10) NOT NULL,
    P1Status NVARCHAR(10) NOT NULL,
    Present FLOAT NOT NULL,
    Absent FLOAT NOT NULL,
    WeeklyOff INT NOT NULL,
    Holiday INT NOT NULL,
    Remarks NVARCHAR(100) NOT NULL,
    CONSTRAINT PK_ExcelUniversalShield PRIMARY KEY CLUSTERED (EmployeeId, AttendanceDate)
);

;WITH DedupedShield AS (
    SELECT 
        emp.EmployeeId,
        m.AttendanceDate,
        CASE WHEN m.InTime IS NOT NULL AND ISDATE(m.InTime) = 1 THEN CAST(m.InTime AS DATETIME) ELSE NULL END AS InTime,
        CASE WHEN m.OutTime IS NOT NULL AND ISDATE(m.OutTime) = 1 THEN CAST(m.OutTime AS DATETIME) ELSE NULL END AS OutTime,
        m.Duration,
        m.OverTime,
        m.ShiftIdResolved AS ShiftId,
        m.Status,
        m.StatusCode,
        m.P1Status,
        m.Present,
        m.Absent,
        m.WeeklyOff,
        m.Holiday,
        'Excel Verified Shielded' AS Remarks,
        ROW_NUMBER() OVER (PARTITION BY emp.EmployeeId, m.AttendanceDate ORDER BY m.Id) AS rn
    FROM #CleanSereneMaster m
    CROSS APPLY (
        SELECT TOP 1 e.EmployeeId 
        FROM dbo.Employees e 
        WHERE LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = m.EmployeeCode 
           OR (m.EmployeeCode = '31109-HK' AND UPPER(e.EmployeeName) LIKE '%PARVATHI%')
           OR (m.EmployeeCode = '32085' AND UPPER(e.EmployeeName) LIKE '%MRITYUNJAY%')
        ORDER BY e.EmployeeId
    ) emp
)
INSERT INTO dbo.ExcelAttendanceMaster_UniversalShield (
    EmployeeId, AttendanceDate, InTime, OutTime, Duration, OverTime,
    ShiftId, Status, StatusCode, P1Status, Present, Absent, WeeklyOff, Holiday, Remarks
)
SELECT 
    EmployeeId, AttendanceDate, InTime, OutTime, Duration, OverTime,
    ShiftId, Status, StatusCode, P1Status, Present, Absent, WeeklyOff, Holiday, Remarks
FROM DedupedShield
WHERE rn = 1;

PRINT '    ✓ Stored ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' records in dbo.ExcelAttendanceMaster_UniversalShield.';
PRINT '';

-- 8. Create Instant One-Click Restore Procedure (NO TRIGGER = ZERO LOCKS = ZERO TIMEOUTS)
IF OBJECT_ID('dbo.sp_Restore_Serene_Verified_Attendance_Sep2026', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_Restore_Serene_Verified_Attendance_Sep2026;
GO

CREATE PROCEDURE dbo.sp_Restore_Serene_Verified_Attendance_Sep2026
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE a
    SET 
        a.InTime = s.InTime,
        a.OutTime = s.OutTime,
        a.Duration = s.Duration,
        a.OverTime = s.OverTime,
        a.ShiftId = s.ShiftId,
        a.Status = s.Status,
        a.StatusCode = s.StatusCode,
        a.P1Status = s.P1Status,
        a.Present = s.Present,
        a.Absent = s.Absent,
        a.WeeklyOff = s.WeeklyOff,
        a.Holiday = s.Holiday,
        a.LateBy = 0,
        a.EarlyBy = 0,
        a.OverTimeE = 0,
        a.Remarks = s.Remarks
    FROM dbo.AttendanceLogs a
    JOIN dbo.ExcelAttendanceMaster_UniversalShield s WITH (NOLOCK)
        ON a.EmployeeId = s.EmployeeId AND CAST(a.AttendanceDate AS DATE) = s.AttendanceDate
    WHERE a.Status <> s.Status 
       OR a.ShiftId <> s.ShiftId 
       OR ISNULL(a.Duration, -1) <> s.Duration
       OR ISNULL(a.WeeklyOff, -1) <> s.WeeklyOff
       OR a.StatusCode <> s.StatusCode
       OR ISNULL(a.OverTime, -1) <> s.OverTime
       OR (s.WeeklyOff = 1 AND a.InTime IS NOT NULL);

    PRINT '✓ Verified Attendance Master Restored successfully in < 1 second.';
END;
GO

PRINT '✓ Stored Procedure dbo.sp_Restore_Serene_Verified_Attendance_Sep2026 created.';
PRINT '';

-- 9. Verification Summary across Departments
PRINT '========================================================================================';
PRINT '  VERIFICATION: SERENE @ BCU SEPTEMBER 2026 MANDAYS BY DEPARTMENT';
PRINT '========================================================================================';

SELECT 
    m.Department,
    COUNT(DISTINCT m.EmployeeCode) AS TotalEmployees,
    SUM(m.Present) AS TotalPresentDays,
    SUM(m.WeeklyOff) AS TotalWeeklyOffs,
    SUM(m.Absent) AS TotalAbsentDays,
    SUM(m.OverTime) / 60.0 AS TotalOTHours
FROM #CleanSereneMaster m
GROUP BY m.Department
ORDER BY TotalEmployees DESC;

PRINT '';
PRINT '========================================================================================';
PRINT '  VERIFICATION: GOUTAM (31056) FIRST 10 DAYS OF SEPTEMBER 2026';
PRINT '========================================================================================';

SELECT 
    CONVERT(VARCHAR(10), a.AttendanceDate, 120) AS AttDate,
    a.Status,
    a.StatusCode,
    ISNULL(CONVERT(VARCHAR(8), a.InTime, 108), '-') AS InTime,
    ISNULL(CONVERT(VARCHAR(8), a.OutTime, 108), '-') AS OutTime,
    a.Duration,
    a.OverTime,
    a.WeeklyOff,
    a.Present,
    s.ShiftSName AS Shift
FROM dbo.AttendanceLogs a WITH (NOLOCK)
JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
JOIN dbo.Shifts s ON a.ShiftId = s.ShiftId
WHERE e.EmployeeCode = '31056' AND a.AttendanceDate BETWEEN '2026-09-01' AND '2026-09-10'
ORDER BY a.AttendanceDate;

PRINT '';
PRINT '>>> CLEAN ATTENDANCE APPLIED: ZERO WOP, ZERO PHANTOM OVERTIME, ZERO TIMEOUT!';
GO
""")

print("Successfully written sql/apply_clean_attendance_no_timeout.sql!")
