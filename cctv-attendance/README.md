# CCTV Attendance Edge Server

> **Paradigm IFS 4.0 — CCTV-Based Site Attendance Add-on**
>
> Automatically marks attendance by detecting employees' faces from CCTV cameras.
> Runs on the on-site Windows server alongside `attendance-api`.

---

## Quick Start

```
1. Run setup.bat     → Install Python dependencies + create .env
2. Edit .env         → Add Supabase keys + RTSP URLs
3. Run start.bat     → Start the edge server
4. Open browser      → http://localhost:4100  (Admin Dashboard)
```

---

## Requirements

| Item | Spec |
|---|---|
| **OS** | Windows 10/11 |
| **Python** | 3.10+ |
| **RAM** | 8 GB minimum (16 GB recommended) |
| **CPU** | Intel i5+ (i7 for multiple cameras) |
| **GPU** | Not required (CPU-only inference) |
| **Network** | LAN access to CCTV cameras (RTSP) |

---

## File Structure

```
cctv-attendance/
├── main.py                  ← Main entry point (run this)
├── requirements.txt         ← Python dependencies
├── setup.bat                ← First-time setup script
├── start.bat                ← Start server script
├── install-service.bat      ← Install as Windows Service
├── .env.example             ← Config template (copy to .env)
├── core/
│   ├── config.py            ← Configuration management
│   ├── database.py          ← Local SQLite (embeddings, queue, logs)
│   ├── face_engine.py       ← InsightFace ArcFace recognition
│   ├── frame_grabber.py     ← RTSP multi-camera capture
│   ├── dispatcher.py        ← Supabase cloud push + offline queue
│   ├── pipeline.py          ← Main processing orchestrator
│   └── admin_server.py      ← FastAPI admin API + dashboard
├── data/                    ← SQLite database (auto-created)
├── logs/                    ← Log files (auto-created)
├── models/                  ← InsightFace models (auto-downloaded)
└── snapshots/               ← Face detection crops (auto-created)
```

---

## Camera Configuration

Add cameras in `.env` as comma-separated entries:

```
CAMERAS=name|rtsp_url|direction, name|rtsp_url|direction
```

**Hikvision example:**
```
CAMERAS=gate_a_entry|rtsp://admin:pass@192.168.1.64:554/Streaming/Channels/101|entry,gate_a_exit|rtsp://admin:pass@192.168.1.65:554/Streaming/Channels/101|exit
```

**Dahua example:**
```
CAMERAS=main_gate|rtsp://admin:pass@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0|entry
```

---

## Face Enrollment

### Option 1: Via Admin API (upload photo)
```bash
curl -X POST http://localhost:4100/enroll \
  -F "user_id=<uuid>" \
  -F "user_name=Rahul Sharma" \
  -F "department=Security" \
  -F "photo=@/path/to/photo.jpg"
```

### Option 2: Via Paradigm IFS Dashboard
Go to `Admin → CCTV Devices → Enroll Face` in the web app.

### Option 3: Sync from Supabase
```bash
curl -X POST http://localhost:4100/sync/embeddings
```

---

## Admin API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Admin dashboard (HTML) |
| `/health` | GET | Health check |
| `/stats` | GET | Pipeline statistics |
| `/cameras` | GET | Camera list |
| `/logs/today` | GET | Today's detections |
| `/logs/recent` | GET | Last 50 detections |
| `/enrolled` | GET | Enrolled employees |
| `/enroll` | POST | Enroll a face (photo upload) |
| `/enroll/{user_id}` | DELETE | Remove enrollment |
| `/sync/embeddings` | POST | Sync from Supabase |
| `/sync/queue` | POST | Drain offline queue |
| `/docs` | GET | Interactive API docs |

---

## Supabase Tables Created

Run `supabase/migrations/20260809_cctv_attendance.sql` in the Supabase SQL Editor.

| Table | Purpose |
|---|---|
| `cctv_devices` | Registered edge servers |
| `cctv_attendance_logs` | CCTV detection audit trail |
| `cctv_enrollment_queue` | Unknown faces for admin review |
| `users.face_embedding_512` | 512-dim ArcFace embeddings |

---

## Production: Install as Windows Service

1. Download [NSSM](https://nssm.cc/download) and place `nssm.exe` in this folder
2. Run `install-service.bat` as Administrator
3. The server auto-starts on boot, no login required

---

## Cloudflare Tunnel (same as attendance-api)

The edge server needs to receive embedding syncs and push events. If already using Cloudflare Tunnel for `attendance-api`, add a route for port 4100 to expose the admin API if needed (not required — the edge server pushes outbound only).

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Camera not connecting | Check RTSP URL format, firewall, camera online status |
| No faces detected | Verify camera angle (face-level), check lighting |
| Low accuracy | Increase `MATCH_THRESHOLD`, re-enroll with better photo |
| Offline queue growing | Check internet, run `/sync/queue` |
| Model download fails | Run `setup.bat` with internet access |
