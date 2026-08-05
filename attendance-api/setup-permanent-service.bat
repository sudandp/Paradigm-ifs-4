@echo off
echo ═══════════════════════════════════════════════════════════
echo   Paradigm Attendance API — Permanent Windows Service Setup
echo ═══════════════════════════════════════════════════════════
echo.
echo This script sets up the Attendance API as a permanent 24/7
echo Windows Service that starts automatically on PC boot.
echo.

:: 1. Check if Node is available
node -v >nul 2>&1
IF ERRORLEVEL 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  pause
  exit /b 1
)

:: 2. Install pm2 globally if not installed
echo [1/3] Checking PM2 process manager...
call npm install -g pm2 pm2-windows-service >nul 2>&1

:: 3. Save pm2 service
echo [2/3] Registering Paradigm Attendance API service...
cd /d "%~dp0"
call pm2 start server.js --name "paradigm-attendance-api"
call pm2 save
call pm2-service-install -n "ParadigmAttendanceAPI"

echo.
echo ──────────────────────────────────────────────────────────
echo [OK] Permanent Windows Service Installed Successfully!
echo The API will now run automatically 24/7 on Windows boot.
echo ──────────────────────────────────────────────────────────
echo.
pause
