@echo off
setlocal enabledelayedexpansion
:: ============================================================
::  Paradigm CCTV Attendance -- PM2 Auto-Start Setup
::  Fixed: uses explicit pm2 path for Administrator sessions
:: ============================================================

echo ===========================================================
echo   Paradigm CCTV Attendance -- PM2 Auto-Start Setup
echo ===========================================================
echo.

set INSTALL_DIR=C:\cctv-attendance
set PYTHON_EXE=%INSTALL_DIR%\venv\Scripts\python.exe
set MAIN_SCRIPT=%INSTALL_DIR%\main.py

:: Check Python venv
if not exist "%PYTHON_EXE%" (
    echo [ERROR] Python venv not found: %PYTHON_EXE%
    echo Run setup.bat first!
    pause
    exit /b 1
)
echo [OK] Python venv found.

:: Find PM2 - check multiple locations
set PM2_CMD=
if exist "%APPDATA%\npm\pm2.cmd" (
    set "PM2_CMD=%APPDATA%\npm\pm2.cmd"
    echo [OK] PM2 found at: %APPDATA%\npm\pm2.cmd
    goto :found_pm2
)
where pm2 >nul 2>&1
if %errorlevel% equ 0 (
    set PM2_CMD=pm2
    echo [OK] PM2 found in PATH.
    goto :found_pm2
)
echo [ERROR] PM2 not found. Please install: npm install -g pm2
pause
exit /b 1

:found_pm2

:: Create PM2 ecosystem config for the CCTV service
echo [1/3] Creating PM2 ecosystem config...
(
    echo module.exports = {
    echo   apps: [{
    echo     name: 'paradigm-cctv',
    echo     script: '%PYTHON_EXE:\=/%',
    echo     args: '%MAIN_SCRIPT:\=/%',
    echo     cwd: '%INSTALL_DIR:\=/%',
    echo     interpreter: 'none',
    echo     autorestart: true,
    echo     restart_delay: 5000,
    echo     max_restarts: 10,
    echo     watch: false,
    echo   }]
    echo };
) > "%INSTALL_DIR%\ecosystem.cctv.config.js"
echo [1/3] Config created.

:: Remove old + register new
echo [2/3] Registering paradigm-cctv in PM2...
call "%PM2_CMD%" delete paradigm-cctv >nul 2>&1
call "%PM2_CMD%" start "%INSTALL_DIR%\ecosystem.cctv.config.js"
if %errorlevel% neq 0 (
    echo [ERROR] PM2 failed to start. Trying direct method...
    call "%PM2_CMD%" start "%PYTHON_EXE%" --name "paradigm-cctv" --cwd "%INSTALL_DIR%"
)

:: Save PM2 state
echo [3/3] Saving PM2 state for auto-start on reboot...
call "%PM2_CMD%" save --force

echo.
echo ===========================================================
echo  [OK] All done! CCTV auto-starts on every Windows boot.
echo ===========================================================
echo.
call "%PM2_CMD%" list
echo.
pause
