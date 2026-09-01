# ============================================================
#  CCTV Quick Camera Reconnect
#  Run on WIN-0T8N581GN63
#  Usage: powershell -ExecutionPolicy Bypass -File quick-reconnect.ps1
# ============================================================

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  CCTV Camera Debug and Quick Reconnect" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# -- 1. Camera status from API --------------------------------
Write-Host ""
Write-Host "[1] Camera status from edge server..." -ForegroundColor Yellow
try {
    $cams = Invoke-WebRequest -Uri "http://localhost:4100/cameras" -TimeoutSec 5 -UseBasicParsing
    Write-Host "  $($cams.Content)" -ForegroundColor White
} catch {
    Write-Host "  FAIL: $_" -ForegroundColor Red
}

# -- 2. Check running Python process --------------------------
Write-Host ""
Write-Host "[2] Python process check..." -ForegroundColor Yellow
$pyProc = Get-Process -Name "python*" -ErrorAction SilentlyContinue
if ($pyProc) {
    foreach ($p in $pyProc) {
        $mem = [math]::Round($p.WorkingSet64 / 1MB, 0)
        Write-Host "  PID $($p.Id) | Mem: ${mem} MB" -ForegroundColor Green
    }
} else {
    Write-Host "  WARNING: No Python process running!" -ForegroundColor Red
}

# -- 3. Find Python executable --------------------------------
Write-Host ""
Write-Host "[3] Locating Python..." -ForegroundColor Yellow
$venvPy  = "C:\cctv-attendance\venv\Scripts\python.exe"
$sysPy   = "C:\Program Files\Python313\python.exe"
$sysPy12 = "C:\Program Files\Python312\python.exe"
$sysPy11 = "C:\Program Files\Python311\python.exe"

if (Test-Path $venvPy)  { $PY = $venvPy }
elseif (Test-Path $sysPy)   { $PY = $sysPy }
elseif (Test-Path $sysPy12) { $PY = $sysPy12 }
elseif (Test-Path $sysPy11) { $PY = $sysPy11 }
else                         { $PY = "python" }
Write-Host "  Using: $PY" -ForegroundColor Green

# -- 4. Run RTSP tester (Python script, no escaping issues) ---
Write-Host ""
Write-Host "[4] Testing RTSP streams with Python OpenCV..." -ForegroundColor Yellow
Write-Host "    (may take up to 30 seconds)"
Write-Host ""
$testScript = "C:\cctv-attendance\scripts\test-rtsp.py"
if (Test-Path $testScript) {
    & $PY $testScript
} else {
    Write-Host "  test-rtsp.py not found at $testScript" -ForegroundColor Red
    Write-Host "  Copy it from the dev machine first." -ForegroundColor Red
}

# -- 5. Register with PM2 and restart -------------------------
Write-Host ""
Write-Host "[5] Registering and restarting edge server via PM2..." -ForegroundColor Yellow

# Write ecosystem config
$eco = "C:\cctv-attendance\ecosystem.config.cjs"
if (-not (Test-Path $eco)) {
    $ecoContent = @'
module.exports = {
  apps: [{
    name: 'paradigm-cctv',
    script: 'C:\\cctv-attendance\\cctv-runner.cjs',
    interpreter: 'node',
    cwd: 'C:\\cctv-attendance',
    watch: false,
    autorestart: true,
    max_restarts: 20,
    min_uptime: '10s',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
'@
    Set-Content $eco -Value $ecoContent -Encoding UTF8
    Write-Host "  Created ecosystem.config.cjs" -ForegroundColor Green
}

Write-Host "  Stopping existing Python processes..."
Get-Process -Name "python*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "  Restarting via PM2..."
& pm2 delete paradigm-cctv 2>$null
& pm2 start $eco
& pm2 save
Start-Sleep -Seconds 8

# -- 6. Health check after restart ----------------------------
Write-Host ""
Write-Host "[6] Post-restart health check..." -ForegroundColor Yellow
try {
    $h = Invoke-WebRequest -Uri "http://localhost:4100/health" -TimeoutSec 10 -UseBasicParsing
    Write-Host "  OK: $($h.Content)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL. Run: pm2 logs paradigm-cctv" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Done. Check: https://cctv.cctv.rest" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
