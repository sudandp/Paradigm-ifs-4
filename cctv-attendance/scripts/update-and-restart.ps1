# ============================================================
#  CCTV Attendance Edge Server - Hot Update & Stream Verifier
#  Run on WIN-0T8N581GN63
# ============================================================

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Restarting CCTV Edge Server and Live Stream...  " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Restart PM2
Write-Host "`n[1] Restarting PM2 process paradigm-cctv..." -ForegroundColor Yellow
& pm2 restart paradigm-cctv --update-env
Start-Sleep -Seconds 8

# 2. Check health
Write-Host "`n[2] Checking edge server health..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "http://localhost:4100/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "  Health: $($health.Content)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Edge server not responding: $_" -ForegroundColor Red
}

# 3. Check camera status
Write-Host "`n[3] Checking camera connection status..." -ForegroundColor Yellow
for ($i = 1; $i -le 4; $i++) {
    try {
        $cams = Invoke-WebRequest -Uri "http://localhost:4100/cameras" -TimeoutSec 5 -UseBasicParsing
        Write-Host "  Attempt $i - Cameras: $($cams.Content)"
        if ($cams.Content -like "*`"connected`":true*") {
            Write-Host "`n  [SUCCESS] Camera connected and streaming live!" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "  Waiting for grabber thread... ($i)"
    }
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Verification complete. Refresh your browser!" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
