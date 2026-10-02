$connStr = "Server=.\SQLEXPRESS;Database=etimetracklite1;Integrated Security=True;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
try {
    $conn.Open()
    Write-Host ">>> CONNECTED TO .\SQLEXPRESS etimetracklite1!" -ForegroundColor Green

    # 1. Shifts
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT ShiftId, ShiftFName, ShiftSName, BeginTime, EndTime, ShiftDuration, PunchBeginDuration, PunchEndDuration FROM dbo.Shifts ORDER BY ShiftId;"
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    $dt = New-Object System.Data.DataTable
    $adapter.Fill($dt) | Out-Null
    Write-Host "`n--- SHIFTS ---" -ForegroundColor Yellow
    $dt | Format-Table -AutoSize | Out-String | Write-Host

    # 2. Shift Groups
    $cmd.CommandText = "SELECT * FROM dbo.ShiftGroups;"
    $dtGroups = New-Object System.Data.DataTable
    $adapter.SelectCommand = $cmd
    $adapter.Fill($dtGroups) | Out-Null
    Write-Host "`n--- SHIFT GROUPS ---" -ForegroundColor Yellow
    $dtGroups | Format-Table -AutoSize | Out-String | Write-Host

    # 3. Shift Group Details
    try {
        $cmd.CommandText = "SELECT * FROM dbo.ShiftGroupDetails;"
        $dtDetails = New-Object System.Data.DataTable
        $adapter.Fill($dtDetails) | Out-Null
        Write-Host "`n--- SHIFT GROUP DETAILS ---" -ForegroundColor Yellow
        $dtDetails | Format-Table -AutoSize | Out-String | Write-Host
    } catch {
        Write-Host "ShiftGroupDetails table does not exist or empty."
    }

    # 4. Department summary with assigned ShiftGroupId
    $cmd.CommandText = @"
SELECT 
    d.DepartmentId,
    d.DepartmentName,
    e.ShiftGroupId,
    sg.ShiftGroupName,
    COUNT(*) AS EmployeeCount
FROM dbo.Employees e
LEFT JOIN dbo.Departments d ON e.DepartmentId = d.DepartmentId
LEFT JOIN dbo.ShiftGroups sg ON e.ShiftGroupId = sg.ShiftGroupId
GROUP BY d.DepartmentId, d.DepartmentName, e.ShiftGroupId, sg.ShiftGroupName
ORDER BY d.DepartmentName, e.ShiftGroupId;
"@
    $dtDepts = New-Object System.Data.DataTable
    $adapter.Fill($dtDepts) | Out-Null
    Write-Host "`n--- EMPLOYEES BY DEPARTMENT & SHIFT GROUP ---" -ForegroundColor Yellow
    $dtDepts | Format-Table -AutoSize | Out-String | Write-Host

    # 5. Check Mehant Kumar (31001) and others
    $cmd.CommandText = @"
SELECT EmployeeId, EmployeeCode, EmployeeName, DepartmentId, Designation, ShiftGroupId, ShiftRosterId
FROM dbo.Employees
WHERE EmployeeCode IN ('31001', '31014', '32010', '32001') OR EmployeeName LIKE '%Mehant%';
"@
    $dtEmp = New-Object System.Data.DataTable
    $adapter.Fill($dtEmp) | Out-Null
    Write-Host "`n--- SAMPLE EMPLOYEES ---" -ForegroundColor Yellow
    $dtEmp | Format-Table -AutoSize | Out-String | Write-Host

} catch {
    Write-Host "Connection / Query Error: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    $conn.Close()
}
