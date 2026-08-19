@echo off
:: ============================================================
::  Paradigm CCTV & Attendance — Auto-Start & Auto-Close
::  Starts all background services and automatically closes CMD
:: ============================================================

cd /d "C:\cctv-attendance"

echo [1/3] Refreshing background services...
call pm2 restart all >nul 2>&1

echo [2/3] Saving PM2 daemon state...
call pm2 save >nul 2>&1

echo [3/3] Done! All services running in background.
echo Closing window in 2 seconds...

timeout /t 2 /nobreak >nul
exit
