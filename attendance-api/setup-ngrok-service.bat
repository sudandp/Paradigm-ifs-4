@echo off
cls
echo ===========================================================
echo   Paradigm Attendance API -- Ngrok 24/7 PM2 Service Setup
echo ===========================================================
echo.

cd /d "%~dp0"

:: 1. Check & Install PM2 if missing
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
  echo [INFO] PM2 not found. Installing PM2 globally...
  call npm install -g pm2 >nul 2>&1
)

:: 2. Check & Download ngrok.exe if missing
if not exist "%~dp0ngrok.exe" (
  echo [INFO] Downloading ngrok binary...
  powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; curl.exe -k -L -o '%~dp0ngrok.zip' 'https://bin.equinox.io/a/cJk8dzafvmN/ngrok-v3-3.3.1-windows-amd64.zip'; tar -xf '%~dp0ngrok.zip' -C '%~dp0'; del /f /q '%~dp0ngrok.zip' >nul 2>&1"
)

:: 3. Run auto-update to ensure minimum version 3.20+ requirement is met
if exist "%~dp0ngrok.exe" (
  echo [1/3] Updating Ngrok to latest version & configuring Authtoken...
  "%~dp0ngrok.exe" update >nul 2>&1
  "%~dp0ngrok.exe" config add-authtoken 3HSqV1IUqDT64j36cV1MESjzb6P_WCVwkdXez4UoaUMKdtP >nul 2>&1
)

echo.
echo [2/3] Registering Ngrok Tunnel with PM2...
call pm2 delete paradigm-ngrok-tunnel >nul 2>&1
call pm2 start "%~dp0start-tunnel.bat" --name "paradigm-ngrok-tunnel"

echo.
echo [3/3] Saving PM2 service state for auto-boot...
call pm2 save

echo.
echo -----------------------------------------------------------
echo [OK] Ngrok 24/7 Service Setup Completed!
echo Your API is live at: https://tassel-estranged-prism.ngrok-free.dev
echo -----------------------------------------------------------

echo.
pause
