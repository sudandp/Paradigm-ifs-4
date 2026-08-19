"""
Cloudflare Dual Tunnel Runner for Paradigm CCTV + Biometric Attendance Edge Server
- Automatically launches 2 Cloudflare Tunnels:
    1. Port 4000 → MS SQL Biometric Attendance API (Site Attendance Dashboard)
    2. Port 4100 → CCTV AI Surveillance Server (CCTV Dashboard & Live RTSP)
- 100% Free & Unlimited Bandwidth (No monthly data cap)
- Automatically downloads cloudflared.exe if missing
- Pushes both live URLs to Supabase instantly so dashboards connect with ZERO configuration!
"""

import os
import re
import sys
import time
import threading
import subprocess
import urllib.request
import json
from pathlib import Path

EXE_PATH = Path(__file__).parent / 'cloudflared.exe'
DOWNLOAD_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"

SB_URL = os.getenv('SUPABASE_URL', 'https://fmyafuhxlorbafbacywa.supabase.co')
SB_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M')
DEV_ID = os.getenv('EDGE_DEVICE_ID', 'server-win-0t8n581gn63')

live_urls = {
    'attendance_4000': None,
    'cctv_4100': None,
}

def ensure_cloudflared_installed():
    if not EXE_PATH.exists():
        print("[Cloudflare] cloudflared.exe not found. Downloading latest Windows release...")
        try:
            urllib.request.urlretrieve(DOWNLOAD_URL, EXE_PATH)
            print(f"[Cloudflare] Download completed: {EXE_PATH.resolve()}")
        except Exception as e:
            print(f"[Cloudflare] ERROR: Failed to download cloudflared.exe: {e}")
            sys.exit(1)

def push_to_supabase():
    """Sync both active tunnel URLs to Supabase cctv_devices and sync_state table."""
    try:
        cctv_url = live_urls.get('cctv_4100')
        att_url = live_urls.get('attendance_4000')

        if cctv_url:
            try:
                (Path(__file__).parent / 'tunnel_url.txt').write_text(cctv_url, encoding='utf-8')
            except Exception:
                pass

        payload = {}
        if cctv_url:
            payload['ngrok_url'] = cctv_url
        if att_url:
            payload['device_secret'] = att_url

        if payload:
            post_req = urllib.request.Request(
                f"{SB_URL}/rest/v1/cctv_devices?edge_device_id=eq.{DEV_ID}",
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    'apikey': SB_KEY,
                    'Authorization': f"Bearer {SB_KEY}",
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                method='PATCH'
            )
            with urllib.request.urlopen(post_req, timeout=3) as resp:
                print(f"[OK] Instantly synced to Supabase (HTTP {resp.status})")
    except Exception as ex:
        print(f"[Note] Supabase push error ({ex})")

def monitor_tunnel(port: int, label: str, key_name: str):
    cmd = [str(EXE_PATH.resolve()), "tunnel", "--url", f"http://127.0.0.1:{port}"]
    print(f"[Cloudflare] Starting tunnel for {label} on http://127.0.0.1:{port} ...")

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        bufsize=1
    )

    url_saved = False
    url_pattern = re.compile(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com')

    try:
        if process.stdout is not None:
            for line in process.stdout:
                if not line:
                    break
                match = url_pattern.search(line)
                if match and not url_saved:
                    found_url = match.group(0).strip()
                    live_urls[key_name] = found_url
                    url_saved = True
                    print(f"\n=======================================================")
                    print(f"[OK] LIVE {label.upper()} TUNNEL URL: {found_url}")
                    print(f"=======================================================\n", flush=True)
                    push_to_supabase()

        process.wait()
    except Exception as e:
        print(f"[{label}] Tunnel stopped: {e}")
        if process.poll() is None:
            process.terminate()

def run_both_tunnels():
    ensure_cloudflared_installed()

    # 1. Start Attendance API Tunnel (Port 4000)
    t1 = threading.Thread(target=monitor_tunnel, args=(4000, "Biometric Attendance API (Port 4000)", "attendance_4000"), daemon=True)
    t1.start()

    # 2. Start CCTV AI Surveillance Tunnel (Port 4100)
    t2 = threading.Thread(target=monitor_tunnel, args=(4100, "CCTV AI Surveillance (Port 4100)", "cctv_4100"), daemon=True)
    t2.start()

    print("=" * 65)
    print("  PARADIGM DUAL TUNNEL RUNNING (PORT 4000 & PORT 4100)")
    print("  Press Ctrl+C anytime to stop.")
    print("=" * 65)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping all Cloudflare tunnels...")

if __name__ == '__main__':
    run_both_tunnels()

