@echo off
chcp 65001 >nul
echo ========================================================
echo   Fixing .env encoding and Starting CCTV Server
echo ========================================================

cd /d C:\cctv-attendance

:: Re-write .env cleanly with pure ASCII / UTF-8
(
echo # CCTV Attendance Edge Server - Environment Configuration
echo SUPABASE_URL=https://fmyafuhxlorbafbacywa.supabase.co
echo SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M
echo SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU
echo EDGE_DEVICE_ID=server-win-0t8n581gn63
echo EDGE_DEVICE_SECRET=paradigm-cctv-secret-2026
echo CAMERAS=main_gate_entry^|rtsp://admin:Paradigm%%402006@192.168.51.150:554/cam/realmonitor?channel=1^&subtype=0^|entry
echo MATCH_THRESHOLD=0.45
echo MIN_DETECTION_CONFIDENCE=0.65
echo COOLDOWN_SECONDS=300
echo PROCESSING_FPS=3
echo ADMIN_PORT=4100
echo LOG_LEVEL=INFO
echo CLOUDFLARE_URL=https://cctv.cctv.rest
echo SAVE_SNAPSHOTS=true
echo SNAPSHOT_RETENTION_DAYS=7
echo SNAPSHOT_DIR=./snapshots
echo DB_PATH=./data/cctv_attendance.db
echo MODELS_DIR=./models
) > C:\cctv-attendance\.env

echo [OK] .env rewritten cleanly without encoding artifacts.

:: Test Python launch
echo.
echo Starting Python main.py directly to verify...
echo ========================================================
python main.py
