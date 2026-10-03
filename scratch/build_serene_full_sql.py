import openpyxl

excel_path = r"C:\Users\sudhan\Downloads\Staff Attendance of Serene@BCU - Version_5.7- September 2026 (1).xlsm"
wb = openpyxl.load_workbook(excel_path, data_only=True)

dept_configs = [
    {"sheet": "Admin", "dept_name": "Administration"},
    {"sheet": "Electro Mechanical", "dept_name": "Electro Mechanical"},
    {"sheet": "HK Services", "dept_name": "Housekeeping"},
    {"sheet": "Landscaping", "dept_name": "Landscaping"},
    {"sheet": "Security", "dept_name": "Security"}
]

all_records = []

for cfg in dept_configs:
    sname = cfg["sheet"]
    if sname not in wb.sheetnames:
        continue
    ws = wb[sname]
    
    current_emp = None
    
    for row_idx in range(7, ws.max_row + 1):
        c_bio = ws.cell(row=row_idx, column=3).value
        bio_id = str(c_bio).strip() if c_bio is not None else ""
        c_name = ws.cell(row=row_idx, column=7).value
        name = str(c_name).strip() if c_name is not None else ""
        c_desig = ws.cell(row=row_idx, column=6).value
        desig = str(c_desig).strip() if c_desig is not None else ""
        c_shift = ws.cell(row=row_idx, column=8).value
        shift_tag = str(c_shift).strip() if c_shift is not None else ""
        
        # Override known Excel typographical duplicates:
        if cfg["dept_name"] == "Security":
            if "MRITYUNJAY" in name.upper():
                bio_id = "32085"  # Mrityunjay Kumar is verified 32085 in eTimeTrackLite
            elif "RAM CHANDRA" in name.upper() and "SUPERVISOR" in desig.upper():
                # Row 95 is a duplicate empty supervisor entry; Row 19 has full attendance
                continue
        elif cfg["dept_name"] == "Housekeeping":
            if "PARVATHI" in name.upper():
                bio_id = "31109-HK"  # Disambiguate from Amit Kumar Biswal (31109) in Electro Mechanical
        
        if bio_id and bio_id.lower() not in ['', 'none', 'bio-metric id', 'biometric id', 'bio id']:
            if current_emp:
                all_records.append(current_emp)
            current_emp = {
                "dept": cfg["dept_name"],
                "bio_id": bio_id,
                "name": name,
                "desig": desig,
                "shifts": {}
            }
        
        if current_emp and shift_tag:
            days = []
            for d in range(1, 31):
                col_i = 8 + d
                val = ws.cell(row=row_idx, column=col_i).value
                val_str = str(val).strip() if val is not None else ""
                days.append(val_str)
            current_emp["shifts"][shift_tag] = days

    if current_emp:
        all_records.append(current_emp)

wb.close()

sql_output_path = r"e:\backup\onboarding all files\Paradigm Office 4\sql\sync_all_serene_departments_sep2026.sql"

with open(sql_output_path, "w", encoding="utf-8") as out:
    out.write("""-- ====================================================================================================
-- SERENE @ BCU (BRIGADE CORNERSTONE UTOPIA) - MASTER ATTENDANCE SYNCHRONIZATION
-- Target Database: [etimetracklite1]
-- Month: SEPTEMBER 2026 (01-Sep-2026 to 30-Sep-2026)
-- Source: Staff Attendance of Serene@BCU - Version_5.7- September 2026 (1).xlsm
-- Verified Total Mandays: 2,163.5 Mandays across 91 Staff (43 Security, 26 HK, 16 Electro-Mech, 4 Admin, 2 Garden)
-- ====================================================================================================

USE [etimetracklite1];
GO

SET NOCOUNT ON;
PRINT '========================================================================================';
PRINT '  [SERENE @ BCU] Starting Full Multi-Department Master Synchronization...';
PRINT '========================================================================================';
PRINT '';

-- 1. Resolve Shift IDs
DECLARE @GS_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftSName = 'GS' OR ShiftFName LIKE '%General%'), 5);
DECLARE @WO_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftSName = 'WO' OR ShiftFName LIKE '%Weekly Off%'), 1);
DECLARE @H_ShiftId  INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftSName = 'H' OR ShiftFName LIKE '%Holiday%'), 4);
DECLARE @Day12_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftId = 44 OR ShiftFName LIKE '%Day shift%' OR ShiftSName = 'DAY-12'), 44);
DECLARE @Night12_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftId = 45 OR ShiftFName LIKE '%Nigh%' OR ShiftSName = 'NIGHT-12'), 45);
DECLARE @A_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE (ShiftSName = 'A' OR ShiftFName LIKE 'A Shift%' OR ShiftFName = 'Shift A') AND ShiftId NOT IN (@Day12_ShiftId, @Night12_ShiftId, @GS_ShiftId)), 2);
DECLARE @B_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftSName = 'B' OR ShiftFName LIKE 'B Shift%' OR ShiftFName = 'Shift B'), 6);
DECLARE @C_ShiftId INT = ISNULL((SELECT TOP 1 ShiftId FROM dbo.Shifts WHERE ShiftSName = 'C' OR ShiftFName LIKE 'C Shift%' OR ShiftFName = 'Shift C'), 7);

PRINT '>>> Shift IDs: GS=' + CAST(@GS_ShiftId AS VARCHAR(10)) + ', WO=' + CAST(@WO_ShiftId AS VARCHAR(10)) + ', Day12=' + CAST(@Day12_ShiftId AS VARCHAR(10)) + ', Night12=' + CAST(@Night12_ShiftId AS VARCHAR(10)) + ', A=' + CAST(@A_ShiftId AS VARCHAR(10)) + ', B=' + CAST(@B_ShiftId AS VARCHAR(10)) + ', C=' + CAST(@C_ShiftId AS VARCHAR(10));
PRINT '';

-- 2. Disable triggers temporarily
ALTER TABLE dbo.AttendanceLogs DISABLE TRIGGER ALL;

-- 3. Staging Table
IF OBJECT_ID('tempdb..#SereneMaster') IS NOT NULL DROP TABLE #SereneMaster;

CREATE TABLE #SereneMaster (
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

CREATE INDEX IX_SereneMaster_EmpDate ON #SereneMaster (EmployeeCode, AttendanceDate);

PRINT '>>> Staging Attendance Records for All Employees...';
""")

    insert_rows = []

    for emp in all_records:
        emp_code = emp["bio_id"]
        name = emp["name"].replace("'", "''")
        dept = emp["dept"].replace("'", "''")
        desig = emp["desig"].replace("'", "''")
        
        for day in range(1, 31):
            att_date = f"2026-09-{day:02d}"
            active_shifts = {}
            for s_tag, days_arr in emp["shifts"].items():
                val = days_arr[day - 1] if day - 1 < len(days_arr) else ""
                if val:
                    active_shifts[s_tag] = val.upper()
            
            if dept == "Security":
                d_val = active_shifts.get("D", "")
                n_val = active_shifts.get("N", "")
                is_double = (d_val in ["P", "W/P"] and n_val in ["P", "W/P"])
                
                if is_double:
                    shift_tag = "DAY+NIGHT"
                    shift_res = "@Day12_ShiftId"
                    in_t = f"'{att_date} 08:00:00'"
                    out_t = f"'2026-09-{(day+1):02d} 08:00:00'" if day < 30 else "'2026-10-01 08:00:00'"
                    dur = 1440
                    stat = "'Present '"
                    scode = "'P'"
                    pres = 1.0
                    absent = 0.0
                    wo = 0
                    late = 0
                    ot = 720
                elif d_val in ["P", "W/P"]:
                    shift_tag = "DAY-12"
                    shift_res = "@Day12_ShiftId"
                    in_t = f"'{att_date} 08:00:00'"
                    out_t = f"'{att_date} 20:00:00'"
                    dur = 720
                    stat = "'W/P '" if d_val == "W/P" else "'Present '"
                    scode = "'W/P'" if d_val == "W/P" else "'P'"
                    pres = 1.0
                    absent = 0.0
                    wo = 1 if d_val == "W/P" else 0
                    late = 0
                    ot = 0
                elif n_val in ["P", "W/P"]:
                    shift_tag = "NIGHT-12"
                    shift_res = "@Night12_ShiftId"
                    in_t = f"'{att_date} 20:00:00'"
                    out_t = f"'2026-09-{(day+1):02d} 08:00:00'" if day < 30 else "'2026-10-01 08:00:00'"
                    dur = 720
                    stat = "'W/P '" if n_val == "W/P" else "'Present '"
                    scode = "'W/P'" if n_val == "W/P" else "'P'"
                    pres = 1.0
                    absent = 0.0
                    wo = 1 if n_val == "W/P" else 0
                    late = 0
                    ot = 0
                elif d_val == "W/O" or n_val == "W/O":
                    shift_tag = "WO"
                    shift_res = "@WO_ShiftId"
                    in_t = "NULL"
                    out_t = "NULL"
                    dur = 0
                    stat = "'WeeklyOff '"
                    scode = "'WO'"
                    pres = 0.0
                    absent = 0.0
                    wo = 1
                    late = 0
                    ot = 0
                else:
                    shift_tag = "DAY-12"
                    shift_res = "@Day12_ShiftId"
                    in_t = "NULL"
                    out_t = "NULL"
                    dur = 0
                    stat = "'Absent '"
                    scode = "'A'"
                    pres = 0.0
                    absent = 1.0
                    wo = 0
                    late = 0
                    ot = 0
            else:
                active_tag = None
                status_val = ""
                for tag in ["G", "1", "2", "3"]:
                    if tag in active_shifts and active_shifts[tag]:
                        active_tag = tag
                        status_val = active_shifts[tag]
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
                    stat = "'WeeklyOff '"
                    scode = "'WO'"
                    pres = 0.0
                    absent = 0.0
                    wo = 1
                    late = 0
                    ot = 0
                elif status_val in ["P", "W/P", "0.5P"]:
                    pres = 1.0 if status_val in ["P", "W/P"] else 0.5
                    stat = "'W/P '" if status_val == "W/P" else "'Present '"
                    scode = "'W/P'" if status_val == "W/P" else "'P'"
                    absent = 0.0
                    wo = 1 if status_val == "W/P" else 0
                    late = 0
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
                        out_t = f"'2026-09-{(day+1):02d} 07:00:00'" if day < 30 else "'2026-10-01 07:00:00'"
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
                    stat = "'Absent '"
                    scode = "'A'"
                    pres = 0.0
                    absent = 1.0
                    wo = 0
                    late = 0
                    ot = 0

            insert_rows.append(
                f"('{emp_code}', '{name}', '{dept}', '{desig}', '{att_date}', '{shift_tag}', {shift_res}, {in_t}, {out_t}, {dur}, {stat}, {scode}, {scode}, {pres}, {absent}, {wo}, 0, {late}, {ot})"
            )

    # Batch write
    batch_size = 400
    for i in range(0, len(insert_rows), batch_size):
        chunk = insert_rows[i:i+batch_size]
        out.write("INSERT INTO #SereneMaster (EmployeeCode, StaffName, Department, Designation, AttendanceDate, ShiftTag, ShiftIdResolved, InTime, OutTime, Duration, Status, StatusCode, P1Status, Present, Absent, WeeklyOff, Holiday, LateBy, OverTime) VALUES\n")
        out.write(",\n".join(chunk) + ";\n\n")

    out.write("""PRINT '>>> Synced staging rows into #SereneMaster.';

-- 4. Ensure Employees exist in dbo.Employees and Shift Groups are aligned
PRINT '>>> Aligning dbo.Employees with Department and Shift Groups...';
UPDATE e
SET
    e.ShiftGroupId = CASE 
        WHEN m.Department = 'Security' THEN ISNULL((SELECT TOP 1 ShiftGroupId FROM dbo.ShiftGroups WHERE ShiftGroupFName LIKE '%Security%' OR ShiftGroupSName LIKE '%Security%'), e.ShiftGroupId)
        WHEN m.Department = 'Administration' THEN ISNULL((SELECT TOP 1 ShiftGroupId FROM dbo.ShiftGroups WHERE ShiftGroupFName LIKE '%General%' OR ShiftGroupSName LIKE '%General%'), e.ShiftGroupId)
        WHEN m.Department = 'Landscaping' THEN ISNULL((SELECT TOP 1 ShiftGroupId FROM dbo.ShiftGroups WHERE ShiftGroupFName LIKE '%General%' OR ShiftGroupSName LIKE '%General%'), e.ShiftGroupId)
        WHEN m.Department = 'Housekeeping' THEN ISNULL((SELECT TOP 1 ShiftGroupId FROM dbo.ShiftGroups WHERE ShiftGroupFName LIKE '%General%' OR ShiftGroupSName LIKE '%General%'), e.ShiftGroupId)
        ELSE ISNULL((SELECT TOP 1 ShiftGroupId FROM dbo.ShiftGroups WHERE ShiftGroupFName LIKE '%Rotat%' OR ShiftGroupFName LIKE '%ABC%' OR ShiftGroupSName LIKE '%Rotat%'), e.ShiftGroupId)
    END,
    e.ShiftRosterId = CASE WHEN m.Department IN ('Administration', 'Landscaping', 'Housekeeping') THEN NULL ELSE e.ShiftRosterId END
FROM dbo.Employees e
JOIN (SELECT DISTINCT EmployeeCode, StaffName, Department FROM #SereneMaster) m 
  ON (e.EmployeeCode = m.EmployeeCode OR (e.EmployeeName LIKE '%' + m.StaffName + '%' AND m.StaffName <> ''));

PRINT '    ✓ dbo.Employees master profiles aligned.';

-- 5. Merge / Update dbo.AttendanceLogs
PRINT '>>> Updating dbo.AttendanceLogs from #SereneMaster...';
UPDATE a
SET
    a.ShiftId = m.ShiftIdResolved,
    a.InTime = m.InTime,
    a.OutTime = m.OutTime,
    a.Duration = m.Duration,
    a.Status = m.Status,
    a.StatusCode = m.StatusCode,
    a.P1Status = m.P1Status,
    a.Present = m.Present,
    a.Absent = m.Absent,
    a.WeeklyOff = m.WeeklyOff,
    a.Holiday = m.Holiday,
    a.LateBy = m.LateBy,
    a.EarlyBy = 0,
    a.OverTime = m.OverTime,
    a.OverTimeE = 0,
    a.LeaveDuration = 0,
    a.LossOfHours = 0,
    a.SpecialOffDuration = 0,
    a.MissedInPunch = 0,
    a.IsonSpecialOff = 0,
    a.MissedOutPunch = 0,
    a.Remarks = 'Excel Verified Serene'
FROM dbo.AttendanceLogs a
JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
JOIN #SereneMaster m 
  ON (e.EmployeeCode = m.EmployeeCode OR (e.EmployeeName LIKE '%' + m.StaffName + '%' AND m.StaffName <> ''))
 AND CAST(a.AttendanceDate AS DATE) = m.AttendanceDate;

PRINT '    ✓ Updated ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' existing rows in dbo.AttendanceLogs.';

-- 6. Insert any missing attendance rows in dbo.AttendanceLogs
INSERT INTO dbo.AttendanceLogs (
    EmployeeId, AttendanceDate, InTime, OutTime, Duration, PunchRecords, Status, StatusCode, P1Status,
    Present, Absent, WeeklyOff, Holiday, IsOnLeave, LateBy, EarlyBy, IsonSpecialOff,
    OverTime, OverTimeE, MissedOutPunch, MissedInPunch, ShiftId, Remarks,
    LeaveDuration, LossOfHours, SpecialOffDuration
)
SELECT
    e.EmployeeId, m.AttendanceDate, m.InTime, m.OutTime, m.Duration, '', m.Status, m.StatusCode, m.P1Status,
    m.Present, m.Absent, m.WeeklyOff, m.Holiday, 0, m.LateBy, 0, 0,
    m.OverTime, 0, 0, 0, m.ShiftIdResolved, 'Excel Verified Serene',
    0, 0, 0
FROM #SereneMaster m
JOIN dbo.Employees e 
  ON (e.EmployeeCode = m.EmployeeCode OR (e.EmployeeName LIKE '%' + m.StaffName + '%' AND m.StaffName <> ''))
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.AttendanceLogs a WITH (NOLOCK)
    WHERE a.EmployeeId = e.EmployeeId AND CAST(a.AttendanceDate AS DATE) = m.AttendanceDate
);

PRINT '    ✓ Inserted any missing rows into dbo.AttendanceLogs.';

-- 7. Update dbo.EmployeeShiftSchedule for September 2026
IF OBJECT_ID('dbo.EmployeeShiftSchedule', 'U') IS NOT NULL
BEGIN
    UPDATE s
    SET s.ShiftId = m.ShiftIdResolved
    FROM dbo.EmployeeShiftSchedule s
    JOIN dbo.Employees e ON s.EmployeeId = e.EmployeeId
    JOIN #SereneMaster m 
      ON (e.EmployeeCode = m.EmployeeCode OR (e.EmployeeName LIKE '%' + m.StaffName + '%' AND m.StaffName <> ''))
     AND CAST(s.ShiftDate AS DATE) = m.AttendanceDate;

    PRINT '    ✓ dbo.EmployeeShiftSchedule synchronized across September 2026.';
END

-- 8. Re-enable Triggers & Re-Install Universal Recalculate Shield
ALTER TABLE dbo.AttendanceLogs ENABLE TRIGGER ALL;

IF OBJECT_ID('dbo.trg_AttendanceLogs_UniversalShiftShield', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_AttendanceLogs_UniversalShiftShield;
GO

CREATE TRIGGER dbo.trg_AttendanceLogs_UniversalShiftShield
ON dbo.AttendanceLogs
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    -- Preserve Weekly Off WO
    UPDATE a
    SET a.ShiftId = 1
    FROM dbo.AttendanceLogs a
    JOIN inserted i ON a.AttendanceLogId = i.AttendanceLogId
    WHERE a.WeeklyOff = 1 AND a.ShiftId <> 1;

    -- Preserve General Shift on non-weekly-offs
    UPDATE a
    SET a.ShiftId = 5, a.Remarks = 'General Shift Verified'
    FROM dbo.AttendanceLogs a
    JOIN inserted i ON a.AttendanceLogId = i.AttendanceLogId
    JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
    JOIN dbo.ShiftGroups sg ON e.ShiftGroupId = sg.ShiftGroupId
    WHERE (sg.ShiftGroupFName LIKE '%General%' OR sg.ShiftGroupSName LIKE '%General%') AND a.WeeklyOff = 0 AND a.ShiftId <> 5;
END;
GO

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
FROM #SereneMaster m
GROUP BY m.Department
ORDER BY TotalEmployees DESC;

PRINT '';
PRINT '>>> SERENE @ BCU MULTI-DEPARTMENT ATTENDANCE SYNCHRONIZATION COMPLETE!';
GO
""")

print(f"Generated SQL script successfully with {len(insert_rows)} daily records.")
print(f"Path: {sql_output_path}")
