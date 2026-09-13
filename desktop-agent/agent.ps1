<#
.SYNOPSIS
    Paradigm Office - Native Work Laptop Productivity & Hardware Binding Companion
.DESCRIPTION
    Monitors active foreground window, enforces 1-laptop-to-1-user policy,
    and syncs productivity metrics to Supabase during active shifts.
#>

param(
    [string]$UserId = "",
    [string]$Email = ""
)

$SupabaseUrl = "https://fmyafuhxlorbafbacywa.supabase.co"
$SupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M"

$Headers = @{
    "apikey" = $SupabaseKey
    "Authorization" = "Bearer $SupabaseKey"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

# 1. Hardware UUID
$HardwareUUID = (Get-CimInstance Win32_ComputerSystemProduct).UUID
$Hostname = $env:COMPUTERNAME

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "🛡️  PARADIGM EXCLUSIVE WORK LAPTOP COMPANION AGENT (WIN)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Machine Name:  $Hostname"
Write-Host "Hardware UUID: $HardwareUUID"

# 2. Resolve User
if (-not $UserId -and -not $Email) {
    # Default to first admin or prompt
    $userRes = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/users?select=id,name,email,role&limit=1" -Headers $Headers -Method Get
    $TargetUser = $userRes[0]
} elseif ($UserId) {
    $userRes = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/users?id=eq.$UserId&select=id,name,email,role" -Headers $Headers -Method Get
    $TargetUser = $userRes[0]
} else {
    $userRes = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/users?email=eq.$Email&select=id,name,email,role" -Headers $Headers -Method Get
    $TargetUser = $userRes[0]
}

if (-not $TargetUser) {
    Write-Host "❌ User not found in Paradigm database." -ForegroundColor Red
    Exit
}

Write-Host "Employee:      $($TargetUser.name) ($($TargetUser.email))" -ForegroundColor Cyan

# 3. Check 1-Laptop-to-1-User Exclusive Registration
$existingDevices = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/user_devices?hardware_uuid=eq.$HardwareUUID&select=id,user_id,device_name,status" -Headers $Headers -Method Get

if ($existingDevices -and $existingDevices.Count -gt 0) {
    $boundDevice = $existingDevices[0]
    if ($boundDevice.user_id -ne $TargetUser.id) {
        Write-Host ""
        Write-Host "❌ [SECURITY VIOLATION] ACCESS DENIED!" -ForegroundColor Red
        Write-Host "This laptop is EXCLUSIVELY registered to another employee!" -ForegroundColor Red
        Write-Host "Rule: 1 Laptop is allowed for only 1 User." -ForegroundColor Red
        Write-Host "Please contact your system administrator to unbind this machine." -ForegroundColor Yellow
        Exit
    } else {
        Write-Host "✅ Machine Verified: Exclusively bound to $($TargetUser.name)" -ForegroundColor Green
    }
} else {
    Write-Host "📌 Binding this laptop exclusively to $($TargetUser.name)..." -ForegroundColor Yellow
    $newDevPayload = @{
        user_id = $TargetUser.id
        device_name = "$Hostname (Work Laptop)"
        device_type = "web"
        device_identifier = "hw-$($HardwareUUID.ToLower())"
        hardware_uuid = $HardwareUUID
        is_exclusive_laptop = $true
        status = "active"
        device_info = @{
            platform = "Windows"
            hostname = $Hostname
            os = (Get-CimInstance Win32_OperatingSystem).Caption
        }
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/user_devices" -Headers $Headers -Method Post -Body $newDevPayload | Out-Null
        Write-Host "✅ Machine registered and exclusively bound!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Warning: Could not register device in user_devices (table may have RLS or exists)." -ForegroundColor DarkYellow
    }
}

# C# definition to grab active foreground window without external tools
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  using System.Text;
  public class ActiveWin {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll", SetLastError=true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  }
"@

function Get-ActiveWindowInfo {
    $hwnd = [ActiveWin]::GetForegroundWindow()
    $sb = New-Object System.Text.StringBuilder 256
    [ActiveWin]::GetWindowText($hwnd, $sb, 256) | Out-Null
    $pidVal = 0
    [ActiveWin]::GetWindowThreadProcessId($hwnd, [ref]$pidVal) | Out-Null
    $proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
    
    $pName = if ($proc) { $proc.ProcessName } else { "Desktop" }
    $title = $sb.ToString()
    if (-not $title) { $title = "(No Title)" }

    $category = "Other"
    $pLower = $pName.ToLower()
    $tLower = $title.ToLower()

    if ($pLower -match "code|devenv|idea|webstorm|pycharm|sublime|cursor") {
        $category = "Development"
    } elseif ($pLower -match "chrome|msedge|firefox|brave|opera") {
        if ($tLower -match "github|stackoverflow|localhost|jira|console") {
            $category = "Development"
        } else {
            $category = "Browsing"
        }
    } elseif ($pLower -match "slack|teams|discord|zoom|telegram|whatsapp|outlook") {
        $category = "Communication"
    } elseif ($pLower -match "excel|word|powerpnt|onenote|notion|obsidian|trello") {
        $category = "Productivity"
    } elseif ($pLower -match "figma|photoshop|illustrator|canva|xd") {
        $category = "Design"
    } elseif ($pLower -match "powershell|cmd|bash|terminal|postman|dbeaver") {
        $category = "Utility"
    }

    return @{
        ProcessName = $pName
        WindowTitle = $title
        Category = $category
    }
}

Write-Host ""
Write-Host "🚀 Productivity tracking started. Sampling active window every 10 seconds..." -ForegroundColor Green
Write-Host "Press Ctrl+C to terminate." -ForegroundColor DarkGray
Write-Host ""

$today = (Get-Date).ToString("yyyy-MM-dd")

while ($true) {
    try {
        # Check active shift
        $todayStr = (Get-Date).ToString("yyyy-MM-dd")
        $attRes = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/attendance?user_id=eq.$($TargetUser.id)&date=eq.$todayStr&select=id,is_active,check_out&order=created_at.desc&limit=1" -Headers $Headers -Method Get
        $isShiftActive = $false
        if ($attRes -and $attRes.Count -gt 0) {
            $att = $attRes[0]
            if ($att.is_active -eq $true -or -not $att.check_out) {
                $isShiftActive = $true
            }
        }

        if (-not $isShiftActive) {
            Write-Host -NoNewline "`r⏸️  [PAUSED] $(Get-Date -Format 'HH:mm:ss') - Shift clocked out or no punch today. Waiting...  "
            Start-Sleep -Seconds 10
            continue
        }

        $win = Get-ActiveWindowInfo
        $payload = @{
            user_id = $TargetUser.id
            hardware_uuid = $HardwareUUID
            app_name = $win.ProcessName
            process_name = $win.ProcessName
            window_title = $win.WindowTitle
            category = $win.Category
            duration_seconds = 10
            is_idle = $false
            shift_date = $todayStr
        } | ConvertTo-Json

        Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/laptop_app_usage_logs" -Headers $Headers -Method Post -Body $payload | Out-Null
        $shortTitle = if ($win.WindowTitle.Length -gt 35) { $win.WindowTitle.Substring(0, 35) + "..." } else { $win.WindowTitle }
        Write-Host -NoNewline "`r⏱️  [$(Get-Date -Format 'HH:mm:ss')] Active: [$($win.Category)] $($win.ProcessName) - `"$shortTitle`"      "
    } catch {
        # Silent ignore to keep running
    }
    Start-Sleep -Seconds 10
}
