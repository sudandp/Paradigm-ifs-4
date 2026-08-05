@echo off
cls
echo ===========================================================
echo   Paradigm Attendance API -- Ngrok Setup
echo ===========================================================
echo.

cd /d "%~dp0"

if not exist "%~dp0ngrok.exe" (
  echo [INFO] Downloading ngrok binary...
  powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; curl.exe -k -L -o '%~dp0ngrok.zip' 'https://bin.equinox.io/a/cJk8dzafvmN/ngrok-v3-3.3.1-windows-amd64.zip'; tar -xf '%~dp0ngrok.zip' -C '%~dp0'; del /f /q '%~dp0ngrok.zip' >nul 2>&1"
)

set "NGROK_CMD=ngrok"
if exist "%~dp0ngrok.exe" set "NGROK_CMD=%~dp0ngrok.exe"

echo [1/2] Saving Authtoken...
call %NGROK_CMD% config add-authtoken 3HSqV1IUqDT64j36cV1MESjzb6P_WCVwkdXez4UoaUMKdtP

echo.
echo [2/2] Starting Ngrok Tunnel on http://localhost:4000 ...
echo Domain: https://tassel-estranged-prism.ngrok-free.dev
echo.

call %NGROK_CMD% http 4000 --domain=tassel-estranged-prism.ngrok-free.dev

pause
