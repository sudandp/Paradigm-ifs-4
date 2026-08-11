@echo off
setlocal enabledelayedexpansion
:: ============================================================
::  Paradigm CCTV Attendance -- 24/7 PM2 Auto-Start Setup
:: ============================================================

echo ===========================================================
echo   Paradigm CCTV Attendance -- 24/7 PM2 Auto-Start Setup
echo ===========================================================
echo.

cd /d "%~dp0"

:: 1. Verify venv
if not exist "%~dp0venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found at: %~dp0venv\Scripts\python.exe
    echo Run setup.bat first!
    pause
    exit /b 1
)

:: 2. Find PM2
set PM2_CMD=
if exist "%APPDATA%\npm\pm2.cmd" (
    set "PM2_CMD=%APPDATA%\npm\pm2.cmd"
) else (
    where pm2 >nul 2>&1
    if %errorlevel% equ 0 (
        set "PM2_CMD=pm2"
    ) else (
        echo [ERROR] PM2 not found. Install it with: npm install -g pm2
        pause
        exit /b 1
    )
)

:: 3. Register cctv-runner.js in PM2
echo [1/2] Registering CCTV service in PM2...
call "%PM2_CMD%" delete paradigm-cctv >nul 2>&1
call "%PM2_CMD%" start cctv-runner.js --name "paradigm-cctv"

:: 4. Save PM2 state
echo [2/2] Saving PM2 state for automatic restart on Windows boot...
call "%PM2_CMD%" save

echo.
echo ===========================================================
echo  [OK] CCTV service registered in PM2 successfully!
echo  It will now run 24/7 in background and auto-start on boot.
echo ===========================================================
echo.
call "%PM2_CMD%" list
echo.
pause
