@echo off
echo ═══════════════════════════════════════════════════════════
echo   Paradigm Attendance API — First Time Setup
echo ═══════════════════════════════════════════════════════════
echo.

:: Check Node.js
node --version >nul 2>&1
IF ERRORLEVEL 1 (
  echo [ERROR] Node.js is NOT installed!
  echo Please download and install from: https://nodejs.org
  echo Choose the LTS version.
  pause
  exit /b 1
)

echo [OK] Node.js found:
node --version

echo.
echo [1/3] Installing dependencies...
npm install

echo.
echo [2/3] Creating .env file...
IF NOT EXIST .env (
  copy .env.example .env
  echo [OK] .env file created — please edit it with your SQL password
) ELSE (
  echo [SKIP] .env already exists
)

echo.
echo [3/3] Setup complete!
echo.
echo ──────────────────────────────────────────────────────────
echo  NEXT STEPS:
echo  1. Edit .env and set your API_SECRET to a strong password
echo  2. Run start.bat to start the API server
echo  3. Run cloudflared-setup.bat to create the tunnel
echo ──────────────────────────────────────────────────────────
echo.
pause
