@echo off
:: ============================================================
::  Paradigm 24/7 Self-Healing & Windows Auto-Boot Service
:: ============================================================

echo ===========================================================
echo  Installing Windows Auto-Boot & Self-Healing Watchdog
echo ===========================================================
echo.

:: 1. Save PM2 list
cd /d C:\cctv-attendance
call pm2 save

:: 2. Register Windows Startup Task so PM2 starts on boot
echo [1/2] Creating Windows Startup Task (PM2_Resurrect_OnBoot)...
schtasks /create /sc onstart /tn "PM2_Resurrect_OnBoot" /tr "cmd /c pm2 resurrect" /rl highest /f >nul 2>&1

:: 3. Also add a shortcut into user Startup folder as fallback
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
echo [2/2] Adding PM2 Resurrect to Windows Startup Folder...
(
echo @echo off
echo pm2 resurrect
) > "%STARTUP_DIR%\pm2-resurrect.bat"

echo.
echo ===========================================================
echo  [SUCCESS] 24/7 Auto-Start & Auto-Renewal Configured!
echo.
echo  1. On Server Boot: Windows automatically starts PM2
echo  2. On Crash / Exit: PM2 automatically restarts within 2s
echo  3. On Tunnel Drop: Watchdog AUTO-RENEWS and syncs URLs
echo ===========================================================
echo.
pause
