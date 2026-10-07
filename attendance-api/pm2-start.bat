@echo off
REM ====================================================================
REM  Paradigm Attendance API — 24/7 PM2 Service Launcher
REM ====================================================================

cd /d "%~dp0"

echo [PM2] Checking if PM2 is installed globally...
call npm list -g pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [PM2] Installing PM2 globally...
    call npm install -g pm2
)

if not exist logs (
    mkdir logs
)

echo [PM2] Starting or Reloading attendance-api via ecosystem.config.js...
call pm2 startOrReload ecosystem.config.js

echo [PM2] Saving process list...
call pm2 save

echo [PM2] Displaying status...
call pm2 status

echo ====================================================================
echo  Attendance API is now supervised by PM2 in the background!
echo ====================================================================
