"""
setup_env.py - Writes clean .env file and tests configuration loading.
Run on WIN-0T8N581GN63:
    python setup_env.py
"""
import os
from pathlib import Path

env_content = """# CCTV Attendance Edge Server Configuration
SUPABASE_URL=https://fmyafuhxlorbafbacywa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU
EDGE_DEVICE_ID=server-win-0t8n581gn63
EDGE_DEVICE_SECRET=paradigm-cctv-secret-2026
CAMERAS=main_gate_entry|rtsp://admin:Paradigm%402006@192.168.51.150:554/cam/realmonitor?channel=1&subtype=0|entry
MATCH_THRESHOLD=0.45
MIN_DETECTION_CONFIDENCE=0.65
COOLDOWN_SECONDS=300
PROCESSING_FPS=3
ADMIN_PORT=4100
LOG_LEVEL=INFO
CLOUDFLARE_URL=https://cctv.cctv.rest
SAVE_SNAPSHOTS=true
SNAPSHOT_RETENTION_DAYS=7
SNAPSHOT_DIR=./snapshots
DB_PATH=./data/cctv_attendance.db
MODELS_DIR=./models
"""

env_path = Path("C:/cctv-attendance/.env")
with open(env_path, "w", encoding="utf-8") as f:
    f.write(env_content)

print(f"[OK] Wrote .env cleanly to {env_path.resolve()}")

# Verify reading back
from dotenv import load_dotenv
load_dotenv(env_path, override=True)
device_id = os.getenv("EDGE_DEVICE_ID")
cameras = os.getenv("CAMERAS")
print(f"[Verified] EDGE_DEVICE_ID : {device_id}")
print(f"[Verified] CAMERAS        : {cameras}")
print("\nNow run: pm2 restart paradigm-cctv --update-env")
