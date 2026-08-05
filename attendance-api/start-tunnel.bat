@echo off
cd /d "%~dp0"

:: 1. Download ngrok if missing
if not exist "%~dp0ngrok.exe" (
  echo [INFO] Downloading latest ngrok binary...
  powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; curl.exe -k -L -o '%~dp0ngrok.zip' 'https://bin.equinox.io/a/cJk8dzafvmN/ngrok-v3-3.3.1-windows-amd64.zip'; tar -xf '%~dp0ngrok.zip' -C '%~dp0'; del /f /q '%~dp0ngrok.zip' >nul 2>&1"
)

:: 2. Auto-update ngrok to 3.39+ if old version
if exist "%~dp0ngrok.exe" (
  "%~dp0ngrok.exe" update >nul 2>&1
  "%~dp0ngrok.exe" config add-authtoken 3HSqV1IUqDT64j36cV1MESjzb6P_WCVwkdXez4UoaUMKdtP >nul 2>&1
  
  echo [INFO] Launching Ngrok 24/7 Tunnel for tassel-estranged-prism.ngrok-free.dev ...
  "%~dp0ngrok.exe" http 4000 --authtoken=3HSqV1IUqDT64j36cV1MESjzb6P_WCVwkdXez4UoaUMKdtP --domain=tassel-estranged-prism.ngrok-free.dev
) else (
  echo [ERROR] ngrok.exe missing!
  pause
)
