@echo off
setlocal enabledelayedexpansion
title CCTV Live Stream Auto-Fix
cd /d C:\cctv-attendance

echo ================================================================
echo   CCTV Camera Stream Auto-Fix & Reconnection
echo ================================================================
echo.

:: 1. Write the clean Python repair script
(
echo import cv2, os, sys, time
echo.
echo print('[1/3] Testing RTSP camera connections...')
echo tests = [
echo     ('CAM .150 (Encoded @)', 'rtsp://admin:Paradigm%%402006@192.168.51.150:554/cam/realmonitor?channel=1^&subtype=0'^),
echo     ('CAM .150 (Raw @)',     'rtsp://admin:Paradigm@2006@192.168.51.150:554/cam/realmonitor?channel=1^&subtype=0'^),
echo     ('CAM .149 (Encoded @)', 'rtsp://admin:Paradigm%%402006@192.168.51.149:554/cam/realmonitor?channel=1^&subtype=0'^),
echo     ('CAM .149 (Raw @)',     'rtsp://admin:Paradigm@2006@192.168.51.149:554/cam/realmonitor?channel=1^&subtype=0'^),
echo ]
echo.
echo working_url = None
echo for label, url in tests:
echo     os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;tcp^|timeout;3000000'
echo     try:
echo         cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
echo         if cap.isOpened():
echo             ret, f = cap.read()
echo             cap.release()
echo             if ret and f is not None:
echo                 print(f'  [SUCCESS] {label} -^> {f.shape[1]}x{f.shape[0]}')
echo                 if not working_url:
echo                     working_url = url
echo             else:
echo                 print(f'  [OPEN_NO_FRAME] {label}')
echo         else:
echo             print(f'  [FAILED] {label}')
echo     except Exception as e:
echo         print(f'  [ERROR] {label}: {e}')
echo.
echo if not working_url:
echo     print('  Defaulting to Camera .150...')
echo     working_url = 'rtsp://admin:Paradigm%402006@192.168.51.150:554/cam/realmonitor?channel=1&subtype=0'
echo.
echo print(f'\n[2/3] Writing verified configuration to C:\\cctv-attendance\\.env ...')
echo env_text = f'''# CCTV Attendance Edge Server Configuration
echo SUPABASE_URL=https://fmyafuhxlorbafbacywa.supabase.co
echo SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M
echo SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU
echo EDGE_DEVICE_ID=server-win-0t8n581gn63
echo EDGE_DEVICE_SECRET=paradigm-cctv-secret-2026
echo CAMERAS=main_gate_entry^|{working_url}^|entry
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
echo '''
echo with open('C:/cctv-attendance/.env', 'w', encoding='utf-8') as fp:
echo     fp.write(env_text)
echo print('  [OK] .env saved successfully!')
) > C:\cctv-attendance\repair.py

:: 2. Execute the repair script with Python
python C:\cctv-attendance\repair.py

:: 3. Restart PM2 with the updated environment
echo.
echo [3/3] Restarting PM2 process paradigm-cctv...
call pm2 restart paradigm-cctv --update-env
timeout /t 6 /nobreak >nul

:: 4. Verify camera stream status
echo.
echo ================================================================
echo   Verifying Live Camera Connection:
echo ================================================================
powershell -Command "(Invoke-WebRequest http://localhost:4100/debug/camera -UseBasicParsing).Content"

echo.
echo ================================================================
echo   DONE! Refresh Chrome at http://localhost:4100 or app dashboard
echo ================================================================
pause
