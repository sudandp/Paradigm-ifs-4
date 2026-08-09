@echo off
:: ============================================================
::  Paradigm CCTV Attendance — Install as Windows Service
::  Uses NSSM (Non-Sucking Service Manager) to auto-start
::  on boot without needing a logged-in user.
::
::  Pre-requisite: Download nssm.exe from nssm.cc and place
::  in this directory.
:: ============================================================

:: Must run as Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Please run this script as Administrator!
    pause
    exit /b 1
)

set SERVICE_NAME=ParadigmCCTVAttendance
set INSTALL_DIR=%~dp0
set PYTHON_EXE=%INSTALL_DIR%venv\Scripts\python.exe
set MAIN_SCRIPT=%INSTALL_DIR%main.py

:: Check NSSM
if not exist "nssm.exe" (
    echo  [ERROR] nssm.exe not found in this directory.
    echo  Download from: https://nssm.cc/download
    pause
    exit /b 1
)

echo  [SERVICE] Installing %SERVICE_NAME% as Windows Service...

:: Remove existing service if present
nssm.exe stop %SERVICE_NAME% >nul 2>&1
nssm.exe remove %SERVICE_NAME% confirm >nul 2>&1

:: Install service
nssm.exe install %SERVICE_NAME% "%PYTHON_EXE%" "%MAIN_SCRIPT%"
nssm.exe set %SERVICE_NAME% AppDirectory "%INSTALL_DIR%"
nssm.exe set %SERVICE_NAME% DisplayName "Paradigm CCTV Attendance"
nssm.exe set %SERVICE_NAME% Description "Paradigm IFS CCTV-based attendance edge processing server"
nssm.exe set %SERVICE_NAME% Start SERVICE_AUTO_START
nssm.exe set %SERVICE_NAME% AppStdout "%INSTALL_DIR%logs\service_stdout.log"
nssm.exe set %SERVICE_NAME% AppStderr "%INSTALL_DIR%logs\service_stderr.log"
nssm.exe set %SERVICE_NAME% AppRotateFiles 1
nssm.exe set %SERVICE_NAME% AppRotateSeconds 86400

:: Start service
nssm.exe start %SERVICE_NAME%

echo.
echo  [OK] Service installed and started!
echo  [OK] It will auto-start on system boot.
echo.
echo  Commands:
echo    sc query %SERVICE_NAME%   ^(check status^)
echo    sc stop %SERVICE_NAME%    ^(stop service^)
echo    sc start %SERVICE_NAME%   ^(start service^)
echo.
pause
