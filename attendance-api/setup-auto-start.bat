@echo off
setlocal enabledelayedexpansion

echo ===========================================================
echo   Paradigm Attendance API -- 24/7 Auto-Start Setup
echo ===========================================================
echo.

cd /d "%~dp0"

:: 1. Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is not installed or not found on PATH.
  pause
  exit /b 1
)

:: 2. Ensure PM2 is installed globally
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
  if exist "%APPDATA%\npm\pm2.cmd" (
    set "PM2_CMD=%APPDATA%\npm\pm2.cmd"
  ) else (
    echo [1/4] Installing PM2 process manager globally...
    call npm install -g pm2
    set "PM2_CMD=%APPDATA%\npm\pm2.cmd"
  )
) else (
  set "PM2_CMD=pm2"
)

:: 3. Setup Ngrok static binary & authtoken if missing
if not exist "%~dp0ngrok.exe" (
  echo [2/4] Downloading Ngrok static binary...
  powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; curl.exe -k -L -o '%~dp0ngrok.zip' 'https://bin.equinox.io/a/cJk8dzafvmN/ngrok-v3-3.3.1-windows-amd64.zip'; tar -xf '%~dp0ngrok.zip' -C '%~dp0'; del /f /q '%~dp0ngrok.zip' >nul 2>&1"
)

if exist "%~dp0ngrok.exe" (
  echo [2/4] Configuring Ngrok static domain authentication...
  "%~dp0ngrok.exe" config add-authtoken 3HSqV1IUqDT64j36cV1MESjzb6P_WCVwkdXez4UoaUMKdtP >nul 2>&1
)

:: 4. Register server.js and static tunnel in PM2
echo [3/4] Registering Attendance API and Tunnel in PM2...
call %PM2_CMD% delete paradigm-tunnel >nul 2>&1

call %PM2_CMD% start server.js --name "paradigm-attendance-api"
call %PM2_CMD% start tunnel-runner.js --name "paradigm-tunnel"

:: 5. Save PM2 state & create Windows Startup trigger
echo [4/4] Configuring Windows Auto-Start trigger...
call %PM2_CMD% save

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_SCRIPT=%STARTUP_FOLDER%\ParadigmAttendanceAutoStart.bat"

echo @echo off > "%SHORTCUT_SCRIPT%"
echo cd /d "%~dp0" >> "%SHORTCUT_SCRIPT%"
if defined PM2_CMD (
  echo call "%PM2_CMD%" resurrect >> "%SHORTCUT_SCRIPT%"
) else (
  echo call pm2 resurrect >> "%SHORTCUT_SCRIPT%"
)

echo.
echo -----------------------------------------------------------
echo [OK] 24/7 Auto-Start Setup Completed Successfully!
echo.
echo  - Service 1: paradigm-attendance-api (Node server on port 4000)
echo  - Service 2: paradigm-ngrok-tunnel (Static URL: https://tassel-estranged-prism.ngrok-free.dev)
echo.
echo Both services are now running and will automatically start
echo whenever Windows boots up or logs in.
echo -----------------------------------------------------------
echo.
call %PM2_CMD% list
echo.
pause
