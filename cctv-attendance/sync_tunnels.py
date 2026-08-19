"""
Self-Healing Cloudflare Tunnel Sync & Watchdog for Paradigm Attendance + CCTV
- Auto-starts Dual Tunnels (Port 4000 MS SQL & Port 4100 CCTV)
- Pushes live URLs to Supabase instantly
- Continuous 30s Health Watchdog: Detects disconnections and AUTO-RENEWS tunnels
- Auto-recovers on crash or network loss
"""

import os
import re
import sys
import time
import subprocess
import urllib.request
import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()
EXE_PATH = BASE_DIR / 'cloudflared.exe'
DOWNLOAD_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"

SB_URL = 'https://fmyafuhxlorbafbacywa.supabase.co'
SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
DEV_ID = 'server-win-0t8n581gn63'

def ensure_exe():
    if not EXE_PATH.exists():
        print("[Cloudflare] Downloading cloudflared.exe...")
        urllib.request.urlretrieve(DOWNLOAD_URL, EXE_PATH)
        print("[Cloudflare] Download complete!")

def extract_url_from_log(log_path, timeout_sec=20):
    pattern = re.compile(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
    start = time.time()
    while time.time() - start < timeout_sec:
        if log_path.exists():
            try:
                text = log_path.read_text(encoding='utf-8', errors='ignore')
                match = pattern.search(text)
                if match:
                    return match.group(0).strip()
            except Exception:
                pass
        time.sleep(0.5)
    return None

def start_tunnel_process(port: int, log_path: Path):
    if log_path.exists():
        log_path.unlink(missing_ok=True)
    flags = 0x08000000 if sys.platform == 'win32' else 0
    cmd = [
        str(EXE_PATH), "tunnel", "--url", f"http://localhost:{port}",
        "--http-host-header", f"localhost:{port}",
        "--logfile", str(log_path)
    ]
    return subprocess.Popen(cmd, creationflags=flags)

def push_to_supabase(url_att=None, url_cctv=None):
    payload = {'status': 'online', 'updated_at': time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    if url_att:
        payload['device_secret'] = url_att
    if url_cctv:
        payload['ngrok_url'] = url_cctv
        try:
            (BASE_DIR / 'tunnel_url.txt').write_text(url_cctv, encoding='utf-8')
        except Exception:
            pass

    try:
        req = urllib.request.Request(
            f"{SB_URL}/rest/v1/cctv_devices?edge_device_id=eq.{DEV_ID}",
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'apikey': SB_KEY,
                'Authorization': f'Bearer {SB_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            method='PATCH'
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            print(f"[Supabase] Synced live URLs (HTTP {res.status})")
            return True
    except Exception as e:
        print(f"[Supabase Sync Error]: {e}")
        return False

def test_url_alive(url: str, path: str = '/'):
    if not url:
        return False
    try:
        req = urllib.request.Request(f"{url.rstrip('/')}{path}", headers={'User-Agent': 'Watchdog/1.0'})
        with urllib.request.urlopen(req, timeout=4) as res:
            return res.status in (200, 404, 401, 403)
    except Exception:
        return False

def main():
    ensure_exe()

    log_4000 = BASE_DIR / 'tunnel_4000.log'
    log_4100 = BASE_DIR / 'tunnel_4100.log'

    print("[1/3] Starting Attendance API Tunnel (Port 4000)...")
    p1 = start_tunnel_process(4000, log_4000)

    print("[2/3] Starting CCTV AI Surveillance Tunnel (Port 4100)...")
    p2 = start_tunnel_process(4100, log_4100)

    url_att = extract_url_from_log(log_4000)
    url_cctv = extract_url_from_log(log_4100)

    print("\n=======================================================")
    print(f"  ATTENDANCE (Port 4000) : {url_att}")
    print(f"  CCTV       (Port 4100) : {url_cctv}")
    print("=======================================================\n")

    push_to_supabase(url_att, url_cctv)

    # ── Self-Healing Watchdog Loop ─────────────────────────────
    last_heartbeat = time.time()
    att_fail_count = 0
    cctv_fail_count = 0

    print("[Watchdog] Active 24/7 Self-Healing Watchdog started.")

    while True:
        time.sleep(30)

        # 1. Check Port 4000 Tunnel Health
        if p1.poll() is not None or not test_url_alive(url_att, '/attendance'):
            att_fail_count += 1
            print(f"[Watchdog] Port 4000 tunnel check failed ({att_fail_count}/2)")
            if att_fail_count >= 2:
                print("[Watchdog] AUTO-RENEWING Port 4000 Tunnel...")
                try: p1.terminate()
                except Exception: pass
                p1 = start_tunnel_process(4000, log_4000)
                new_att = extract_url_from_log(log_4000)
                if new_att:
                    url_att = new_att
                    print(f"[Watchdog] New Port 4000 URL: {url_att}")
                    push_to_supabase(url_att=url_att)
                att_fail_count = 0
        else:
            att_fail_count = 0

        # 2. Check Port 4100 Tunnel Health
        if p2.poll() is not None or not test_url_alive(url_cctv, '/health'):
            cctv_fail_count += 1
            print(f"[Watchdog] Port 4100 tunnel check failed ({cctv_fail_count}/2)")
            if cctv_fail_count >= 2:
                print("[Watchdog] AUTO-RENEWING Port 4100 Tunnel...")
                try: p2.terminate()
                except Exception: pass
                p2 = start_tunnel_process(4100, log_4100)
                new_cctv = extract_url_from_log(log_4100)
                if new_cctv:
                    url_cctv = new_cctv
                    print(f"[Watchdog] New Port 4100 URL: {url_cctv}")
                    push_to_supabase(url_cctv=url_cctv)
                cctv_fail_count = 0
        else:
            cctv_fail_count = 0

        # 3. Regular 60s Heartbeat
        if time.time() - last_heartbeat > 60:
            push_to_supabase()
            last_heartbeat = time.time()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("Stopping Watchdog...")
