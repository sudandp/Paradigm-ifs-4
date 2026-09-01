import cv2, os, sys

# Test the two password variants on both cameras
tests = [
    ("CAM .150 (%40)", "rtsp://admin:Paradigm%402006@192.168.51.150:554/cam/realmonitor?channel=1&subtype=0"),
    ("CAM .150 (@)",    "rtsp://admin:Paradigm@2006@192.168.51.150:554/cam/realmonitor?channel=1&subtype=0"),
    ("CAM .149 (%40)", "rtsp://admin:Paradigm%402006@192.168.51.149:554/cam/realmonitor?channel=1&subtype=0"),
    ("CAM .149 (@)",    "rtsp://admin:Paradigm@2006@192.168.51.149:554/cam/realmonitor?channel=1&subtype=0"),
]

best_url = None
for label, url in tests:
    os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;tcp|timeout;4000000'
    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    if cap.isOpened():
        ret, f = cap.read()
        cap.release()
        if ret and f is not None:
            print(f"SUCCESS: {label} -> {f.shape[1]}x{f.shape[0]}")
            if not best_url:
                best_url = url
        else:
            print(f"OPENED_NO_FRAME: {label}")
    else:
        print(f"FAILED: {label}")

if best_url:
    print(f"\nWriting working URL to C:\\cctv-attendance\\.env ...")
    lines = [
        "SUPABASE_URL=https://fmyafuhxlorbafbacywa.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M",
        "SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU",
        "EDGE_DEVICE_ID=server-win-0t8n581gn63",
        "EDGE_DEVICE_SECRET=paradigm-cctv-secret-2026",
        f"CAMERAS=main_gate_entry|{best_url}|entry",
        "MATCH_THRESHOLD=0.45",
        "MIN_DETECTION_CONFIDENCE=0.65",
        "COOLDOWN_SECONDS=300",
        "PROCESSING_FPS=3",
        "ADMIN_PORT=4100",
        "LOG_LEVEL=INFO",
        "CLOUDFLARE_URL=https://cctv.cctv.rest",
        "SAVE_SNAPSHOTS=true",
        "SNAPSHOT_RETENTION_DAYS=7",
        "SNAPSHOT_DIR=./snapshots",
        "DB_PATH=./data/cctv_attendance.db",
        "MODELS_DIR=./models",
    ]
    with open("C:/cctv-attendance/.env", "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines) + "\n")
    print("[OK] .env updated with live working RTSP stream!")
else:
    print("\nNo stream connected. Check if camera is locked out (wait 1 minute) or password changed.")
