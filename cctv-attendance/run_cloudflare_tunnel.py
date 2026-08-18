"""
Cloudflare Tunnel Runner for Paradigm CCTV Attendance Edge Server
- 100% Free & Unlimited Bandwidth (No monthly data cap)
- Automatically downloads cloudflared.exe if missing
- Automatically starts tunnel to port 4100
- Writes the live URL to tunnel_url.txt for instant Supabase heartbeat sync
"""

import os
import re
import sys
import time
import subprocess
import urllib.request
from pathlib import Path

PORT = int(os.getenv('ADMIN_PORT', '4100'))
EXE_PATH = Path(__file__).parent / 'cloudflared.exe'
URL_FILE = Path(__file__).parent / 'tunnel_url.txt'

DOWNLOAD_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"

def ensure_cloudflared_installed():
    if not EXE_PATH.exists():
        print("[Cloudflare] cloudflared.exe not found. Downloading latest Windows release...")
        try:
            urllib.request.urlretrieve(DOWNLOAD_URL, EXE_PATH)
            print(f"[Cloudflare] Download completed: {EXE_PATH.resolve()}")
        except Exception as e:
            print(f"[Cloudflare] ERROR: Failed to download cloudflared.exe: {e}")
            print(f"Please download manually from: {DOWNLOAD_URL} and save as {EXE_PATH}")
            sys.exit(1)

def run_tunnel():
    ensure_cloudflared_installed()
    cmd = [str(EXE_PATH.resolve()), "tunnel", "--url", f"http://127.0.0.1:{PORT}"]
    print(f"[Cloudflare] Starting tunnel for http://127.0.0.1:{PORT} ...")

    # Start cloudflared process and read stderr (where cloudflared outputs the URL)
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
                print(line, end='', flush=True)
                
                match = url_pattern.search(line)
                if match and not url_saved:
                    found_url = match.group(0).strip()
                    URL_FILE.write_text(found_url, encoding='utf-8')
                    url_saved = True
                    print(f"\n=======================================================")
                    print(f"[OK] LIVE CLOUDFLARE TUNNEL URL: {found_url}")
                    print(f"Saved to {URL_FILE.resolve()}")
                    print(f"Supabase and live app will sync this URL automatically!")
                    print(f"=======================================================\n", flush=True)

        process.wait()
    except KeyboardInterrupt:
        print("\nStopping Cloudflare Tunnel...")
        process.terminate()
        if URL_FILE.exists():
            URL_FILE.unlink(missing_ok=True)

if __name__ == '__main__':
    run_tunnel()

