# ============================================================
#  CCTV Attendance Edge Server - Network Diagnostics & Auto-Fix
#  Run this on WIN-0T8N581GN63 (the CCTV server machine)
#  Usage: powershell -ExecutionPolicy Bypass -File diagnose-and-fix.ps1
# ============================================================

$ENV_FILE = "C:\cctv-attendance\.env"
$TARGET_NVR  = "192.168.51.111"
$TARGET_PORT = 554

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  CCTV Edge Server - Black Screen Diagnostic Tool" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# -- 1. Check current server IP / adapter --------------------
Write-Host "[STEP 1] Checking server network adapters..." -ForegroundColor Yellow
$adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -ne 'WellKnown' }
foreach ($a in $adapters) {
    Write-Host "  Adapter: $($a.InterfaceAlias)  IP: $($a.IPAddress)/$($a.PrefixLength)"
}

$localIPs = $adapters | Select-Object -ExpandProperty IPAddress
$onRightSubnet = $localIPs | Where-Object { $_ -like "192.168.51.*" }
if ($onRightSubnet) {
    Write-Host ""
    Write-Host "  [OK] Server is on 192.168.51.x subnet - $($onRightSubnet -join ', ')" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  [WARN] Server is NOT on 192.168.51.x subnet!" -ForegroundColor Red
    Write-Host "         Your IPs: $($localIPs -join ', ')"
    Write-Host "         The NVR (192.168.51.111) will be unreachable until the server joins the office LAN."
}

# -- 2. Ping NVR ---------------------------------------------
Write-Host ""
Write-Host "[STEP 2] Pinging NVR at $TARGET_NVR..." -ForegroundColor Yellow
$ping = Test-Connection -ComputerName $TARGET_NVR -Count 2 -Quiet -ErrorAction SilentlyContinue
if ($ping) {
    Write-Host "  [OK] NVR is pingable" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] NVR does not respond to ping" -ForegroundColor Red
}

# -- 3. TCP port 554 check on NVR ----------------------------
Write-Host ""
Write-Host "[STEP 3] Testing TCP port 554 on NVR ($TARGET_NVR)..." -ForegroundColor Yellow
$tcp = Test-NetConnection -ComputerName $TARGET_NVR -Port $TARGET_PORT -WarningAction SilentlyContinue
if ($tcp.TcpTestSucceeded) {
    Write-Host "  [OK] Port 554 OPEN - RTSP should work" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Port 554 is CLOSED or unreachable on $TARGET_NVR" -ForegroundColor Red
}

# -- 4. Scan 192.168.51.x subnet for live cameras ------------
Write-Host ""
Write-Host "[STEP 4] Scanning 192.168.51.1 - 192.168.51.200 for live RTSP devices (port 554)..." -ForegroundColor Yellow
Write-Host "         (This may take ~30 seconds...)"

$foundCameras = @()
$jobs = 1..200 | ForEach-Object {
    $ip = "192.168.51.$_"
    Start-Job -ScriptBlock {
        param($h)
        $t = New-Object System.Net.Sockets.TcpClient
        try {
            $r = $t.BeginConnect($h, 554, $null, $null)
            $ok = $r.AsyncWaitHandle.WaitOne(400, $false)
            if ($ok -and $t.Connected) { return $h }
        } catch {} finally { $t.Close() }
        return $null
    } -ArgumentList $ip
}

$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job -Force

$foundCameras = $results | Where-Object { $_ -ne $null }

if ($foundCameras.Count -gt 0) {
    Write-Host ""
    Write-Host "  [FOUND] Cameras responding on port 554:" -ForegroundColor Green
    $foundCameras | ForEach-Object { Write-Host "    -> $_" -ForegroundColor Cyan }
} else {
    Write-Host "  [NONE] No devices found with port 554 open on 192.168.51.x" -ForegroundColor Red
    Write-Host "         Check that the NVR is powered on and connected to the same switch."
}

# -- 5. Check Cloudflare tunnel status -----------------------
Write-Host ""
Write-Host "[STEP 5] Checking Cloudflare tunnel (cloudflared)..." -ForegroundColor Yellow
$cf = Get-Service -Name "Cloudflared*" -ErrorAction SilentlyContinue
if ($cf) {
    Write-Host "  [OK] cloudflared service found: Status = $($cf.Status)"
    if ($cf.Status -ne 'Running') {
        Write-Host "  [FIX] Starting cloudflared..." -ForegroundColor Yellow
        Start-Service $cf.Name
        Write-Host "       cloudflared started." -ForegroundColor Green
    }
} else {
    $cfProc = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($cfProc) {
        Write-Host "  [OK] cloudflared process is running (PID $($cfProc.Id))" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] cloudflared is NOT running - remote dashboard will show black screen" -ForegroundColor Red
        Write-Host "         Start it: cloudflared tunnel run paradigm-cctv"
    }
}

# -- 6. Check PM2 / Edge Server status -----------------------
Write-Host ""
Write-Host "[STEP 6] Checking PM2 edge server..." -ForegroundColor Yellow
try {
    $pm2Output = & pm2 jlist 2>&1
    $pm2Status = $pm2Output | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($pm2Status) {
        $cctv = $pm2Status | Where-Object { $_.name -like "*cctv*" -or $_.name -like "*paradigm*" }
        if ($cctv) {
            $cctv | ForEach-Object {
                $color = if ($_.pm2_env.status -eq 'online') { 'Green' } else { 'Red' }
                Write-Host "  Process: $($_.name) - Status: $($_.pm2_env.status)" -ForegroundColor $color
            }
        } else {
            Write-Host "  [WARN] No CCTV process found in PM2" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "  [INFO] PM2 not available or no processes"
}

# -- 7. Test edge server health ------------------------------
Write-Host ""
Write-Host "[STEP 7] Testing local edge server health (port 4100)..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "http://localhost:4100/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "  [OK] Edge server is healthy: $($health.Content)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Edge server not responding on port 4100" -ForegroundColor Red
    Write-Host "         Try: pm2 restart paradigm-cctv"
}

# -- 8. Auto-update .env if camera IP changed ----------------
if ($foundCameras.Count -gt 0 -and (-not ($foundCameras -contains $TARGET_NVR))) {
    Write-Host ""
    Write-Host "[STEP 8] NVR IP appears to have CHANGED." -ForegroundColor Yellow
    Write-Host "         Old IP: $TARGET_NVR"
    Write-Host "         Found active RTSP device(s): $($foundCameras -join ', ')"

    $newIp = $foundCameras[0]
    $choice = Read-Host "  Update .env to use $newIp? (y/n)"

    if ($choice -eq 'y' -or $choice -eq 'Y') {
        $envContent = Get-Content $ENV_FILE -Raw -ErrorAction SilentlyContinue
        if ($envContent) {
            $updated = $envContent -replace [regex]::Escape($TARGET_NVR), $newIp
            Set-Content $ENV_FILE -Value $updated -Encoding UTF8 -NoNewline
            Write-Host "  [OK] .env updated - NVR IP changed to $newIp" -ForegroundColor Green
            Write-Host "  Restarting PM2 processes..."
            & pm2 restart all
            Write-Host "  [DONE] PM2 restarted." -ForegroundColor Green
        } else {
            Write-Host "  [WARN] Could not read $ENV_FILE - update manually" -ForegroundColor Red
        }
    }
} elseif ($foundCameras -contains $TARGET_NVR) {
    Write-Host ""
    Write-Host "[STEP 8] NVR IP ($TARGET_NVR) is correct and reachable." -ForegroundColor Green
    Write-Host "         If stream is still black, the RTSP credential or channel may be wrong."
    Write-Host "         Test with Python:"
    Write-Host "         python -c `"import cv2; c=cv2.VideoCapture('rtsp://admin:Paradigm%402006@192.168.51.111:554/cam/realmonitor?channel=1&subtype=0'); print('Open:',c.isOpened())`""
}

# -- 9. Quick credential test --------------------------------
Write-Host ""
Write-Host "[STEP 9] RTSP credential test command (run manually if needed):" -ForegroundColor Yellow
$cam_env = Select-String -Path $ENV_FILE -Pattern "^CAMERAS=" -ErrorAction SilentlyContinue
if ($cam_env) {
    $parts = ($cam_env.Line -replace "^CAMERAS=", "") -split "\|"
    $rtsp = $parts[1]
    Write-Host "  VLC test:    vlc `"$rtsp`"" -ForegroundColor Cyan
    Write-Host "  Python test: python -c `"import cv2; c=cv2.VideoCapture('$rtsp'); print('Open:',c.isOpened())`"" -ForegroundColor Cyan
}

# -- Summary -------------------------------------------------
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTIC COMPLETE - Summary:" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
if ($onRightSubnet -and $tcp.TcpTestSucceeded) {
    Write-Host "  Network OK | RTSP port OK" -ForegroundColor Green
    Write-Host "  -> Check RTSP credentials/channel in $ENV_FILE"
} elseif ($onRightSubnet -and -not $tcp.TcpTestSucceeded) {
    Write-Host "  Network OK but port 554 CLOSED" -ForegroundColor Red
    Write-Host "  -> NVR may be off, or RTSP not enabled in NVR web settings"
} elseif (-not $onRightSubnet) {
    Write-Host "  Server NOT on 192.168.51.x LAN" -ForegroundColor Red
    Write-Host "  -> Plug server into office switch, or configure static IP 192.168.51.x"
} else {
    Write-Host "  Network unreachable. Check physical LAN connection." -ForegroundColor Red
}
Write-Host ""
