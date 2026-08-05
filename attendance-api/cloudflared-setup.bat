@echo off
echo ═══════════════════════════════════════════════════════════
echo   Paradigm Attendance API — Cloudflare Tunnel Setup
echo ═══════════════════════════════════════════════════════════
echo.
echo This script creates a FREE permanent HTTPS tunnel so your
echo Attendance API is accessible from the internet securely.
echo.

:: Check if cloudflared is installed
cloudflared --version >nul 2>&1
IF ERRORLEVEL 1 (
  echo [INFO] cloudflared not found. Downloading now...
  echo.
  :: Download cloudflared for Windows x64
  powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
  echo [OK] Downloaded cloudflared.exe
  echo.
)

echo ──────────────────────────────────────────────────────────
echo  OPTION A: Quick Tunnel (temporary URL, no account needed)
echo  Good for: Testing right now
echo ──────────────────────────────────────────────────────────
echo.
echo  Running quick tunnel on http://localhost:4000...
echo  You will see a URL like: https://random-name.trycloudflare.com
echo  Copy that URL and put it in your Vercel MSSQL_PROXY_URL variable.
echo.
echo  NOTE: This URL changes every restart. For permanent URL, use Option B below.
echo.

IF EXIST cloudflared.exe (
  cloudflared.exe tunnel --url http://localhost:4000
) ELSE (
  cloudflared tunnel --url http://localhost:4000
)

echo.
echo ──────────────────────────────────────────────────────────
echo  OPTION B: Permanent Tunnel (requires free Cloudflare account)
echo  1. Go to: https://dash.cloudflare.com/
echo  2. Zero Trust → Tunnels → Create Tunnel
echo  3. Name it: paradigm-attendance
echo  4. Run the connector command shown on screen
echo  5. Set Public Hostname: attendance.yourdomain.com → localhost:4000
echo ──────────────────────────────────────────────────────────
echo.
pause
