"""
CCTV Attendance — FastAPI Admin Server

Local web API & dashboard for:
- Camera status monitoring
- Pipeline statistics
- Face enrollment (upload photo → generate embedding)
- Recent detection logs
- Manual embedding sync trigger
"""

from __future__ import annotations

import base64
import time
from io import BytesIO
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from loguru import logger
from PIL import Image

from .config import AppConfig
from .database import LocalDatabase
from .face_engine import FaceEngine


def create_admin_app(
    config: AppConfig,
    db: LocalDatabase,
    face_engine: FaceEngine,
    pipeline: Optional[any] = None,
) -> FastAPI:
    """Create the FastAPI admin application.
    
    This is a local-only server (not exposed to internet).
    The pipeline object is injected after initialization.
    """
    app = FastAPI(
        title="CCTV Attendance Admin",
        description="Edge server administration for Paradigm CCTV Attendance",
        version="1.0.0",
    )

    # Allow requests from the Paradigm IFS app (local only)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ─── Health & Status ──────────────────────────────────────────────────────

    @app.get("/health")
    async def health():
        """Health check endpoint."""
        return {
            "status": "running",
            "service": "Paradigm CCTV Attendance Edge Server",
            "device_id": config.edge_device_id,
            "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "enrolled_count": db.get_embedding_count(),
            "cloud_enabled": config.cloud_enabled,
        }

    @app.get("/stats")
    async def stats():
        """Pipeline statistics."""
        queue_stats = db.get_queue_stats()
        return {
            "enrolled_faces": db.get_embedding_count(),
            "queue": queue_stats,
            "cameras_configured": len(config.cameras),
            "match_threshold": config.match_threshold,
            "cooldown_seconds": config.cooldown_seconds,
            "processing_fps": config.processing_fps,
        }

    @app.get("/cameras")
    async def cameras():
        """Camera configuration (passwords masked)."""
        return [
            {
                "name": cam.name,
                "direction": cam.direction,
                "enabled": cam.enabled,
                "connected": pipeline.grabber.streams[cam.name].is_connected if pipeline and cam.name in pipeline.grabber.streams else False,
            }
            for cam in config.cameras
        ]

    @app.get("/camera/frame/{camera_name}")
    async def camera_frame(camera_name: str):
        """Get latest camera frame snapshot as JPEG image."""
        if not pipeline or not hasattr(pipeline, 'grabber'):
            raise HTTPException(503, "Camera pipeline not initialized")
        stream = pipeline.grabber.streams.get(camera_name)
        if not stream:
            raise HTTPException(404, f"Camera '{camera_name}' not configured")
        
        captured = stream.get_frame()
        if captured is None or captured.frame is None:
            raise HTTPException(503, "No frame available from RTSP stream")
        
        import cv2
        from fastapi.responses import Response
        ret, buffer = cv2.imencode('.jpg', captured.frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not ret:
            raise HTTPException(500, "JPEG encoding failed")
        
        return Response(
            content=buffer.tobytes(),
            media_type="image/jpeg",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            }
        )

    @app.get("/camera/stream/{camera_name}")
    async def camera_mjpeg_stream(camera_name: str):
        """Continuous MJPEG stream — browsers treat this like a live video via <img> tag."""
        import cv2
        import asyncio
        from fastapi.responses import StreamingResponse

        if not pipeline or not hasattr(pipeline, 'grabber'):
            raise HTTPException(503, "Camera pipeline not initialized")
        if camera_name not in pipeline.grabber.streams:
            raise HTTPException(404, f"Camera '{camera_name}' not found")

        async def generate():
            while True:
                try:
                    stream = pipeline.grabber.streams.get(camera_name)
                    if stream is None:
                        break
                    captured = stream.get_frame()
                    if captured is not None and captured.frame is not None:
                        ret, buf = cv2.imencode(
                            '.jpg', captured.frame,
                            [cv2.IMWRITE_JPEG_QUALITY, 75]
                        )
                        if ret:
                            frame_bytes = buf.tobytes()
                            yield (
                                b'--frame\r\n'
                                b'Content-Type: image/jpeg\r\n\r\n'
                                + frame_bytes +
                                b'\r\n'
                            )
                except Exception:
                    pass
                await asyncio.sleep(1 / 15)  # 15 FPS target

        return StreamingResponse(
            generate(),
            media_type="multipart/x-mixed-replace; boundary=frame",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "X-Content-Type-Options": "nosniff",
            }
        )

    # ─── Detection Logs ───────────────────────────────────────────────────────


    @app.get("/logs/recent")
    async def recent_logs(limit: int = 50):
        """Get recent detection logs."""
        logs = db.get_recent_detections(limit=min(limit, 200))
        return {"logs": logs, "count": len(logs)}

    @app.get("/logs/today")
    async def today_logs():
        """Get today's detection logs."""
        logs = db.get_today_detections()
        return {"logs": logs, "count": len(logs)}

    # ─── Face Enrollment ──────────────────────────────────────────────────────

    @app.post("/enroll")
    async def enroll_face(
        user_id: str = Form(...),
        user_name: str = Form(...),
        biometric_id: str = Form(""),
        department: str = Form("General"),
        organization_id: str = Form(""),
        photo: UploadFile = File(...),
    ):
        """Enroll an employee's face from a photo upload."""
        if not face_engine.is_ready:
            raise HTTPException(503, "Face engine not initialized")

        if photo.content_type not in ("image/jpeg", "image/jpg", "image/png", "image/webp"):
            raise HTTPException(400, f"Unsupported image type: {photo.content_type}")

        contents = await photo.read()
        try:
            pil_image = Image.open(BytesIO(contents)).convert("RGB")
        except Exception:
            raise HTTPException(400, "Invalid image file")

        import cv2
        frame = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

        embedding = face_engine.generate_embedding(frame)
        if embedding is None:
            raise HTTPException(
                422,
                "No face detected in uploaded image. Use clear front-facing photo."
            )

        db.upsert_embedding(
            user_id=user_id,
            user_name=user_name,
            embedding=embedding,
            biometric_id=biometric_id,
            department=department,
            organization_id=organization_id,
        )

        logger.info(f"[Admin] Enrolled face for {user_name} ({user_id})")

        return {
            "success": True,
            "user_id": user_id,
            "user_name": user_name,
            "embedding_dims": len(embedding),
            "message": f"Successfully enrolled {user_name}",
        }

    @app.delete("/enroll/{user_id}")
    async def remove_enrollment(user_id: str):
        """Remove a user's face enrollment (deactivates their embedding)."""
        try:
            db.conn.execute(
                "UPDATE face_embeddings SET is_active = 0 WHERE user_id = ?", (user_id,)
            )
            db.conn.commit()
        except RuntimeError as e:
            raise HTTPException(503, f"Database not ready: {e}")
        except Exception as e:
            raise HTTPException(500, f"Failed to remove enrollment: {e}")
        logger.info(f"[Admin] Deactivated enrollment for {user_id}")
        return {"success": True, "user_id": user_id}

    @app.get("/enrolled")
    async def list_enrolled():
        """List all enrolled employees (without embedding data)."""
        try:
            rows = db.conn.execute("""
                SELECT user_id, user_name, biometric_id, department, synced_at, is_active
                FROM face_embeddings
                ORDER BY user_name ASC
            """).fetchall()
        except RuntimeError as e:
            raise HTTPException(503, f"Database not ready: {e}")
        return {
            "users": [dict(row) for row in rows],
            "total": len(rows),
        }

    # ─── Manual Sync ──────────────────────────────────────────────────────────

    @app.post("/sync/embeddings")
    async def trigger_embedding_sync():
        """Manually trigger embedding sync from Supabase."""
        from .dispatcher import EventDispatcher
        dispatcher = EventDispatcher(config, db)
        try:
            await dispatcher.initialize()
            count = await dispatcher.sync_embeddings()
            return {"success": True, "synced_count": count}
        except Exception as e:
            raise HTTPException(500, str(e))
        finally:
            await dispatcher.close()

    @app.post("/sync/queue")
    async def trigger_queue_drain():
        """Manually trigger offline queue drain."""
        from .dispatcher import EventDispatcher
        dispatcher = EventDispatcher(config, db)
        try:
            await dispatcher.initialize()
            count = await dispatcher.drain_queue()
            return {"success": True, "synced_count": count}
        except Exception as e:
            raise HTTPException(500, str(e))
        finally:
            await dispatcher.close()

    # ─── Admin Dashboard HTML ─────────────────────────────────────────────────

    @app.get("/", response_class=HTMLResponse)
    async def dashboard():
        """HTML admin dashboard — Paradigm Services branded CCTV monitor."""
        enrolled_count = db.get_embedding_count()
        queue_stats = db.get_queue_stats()
        recent = db.get_recent_detections(limit=10)

        # Build camera cards
        camera_cards_html = ""
        for cam in config.cameras:
            is_connected = False
            frame_cnt = 0
            if pipeline and hasattr(pipeline, "grabber") and cam.name in pipeline.grabber.streams:
                st = pipeline.grabber.streams[cam.name]
                is_connected = st.is_connected
                frame_cnt = st.frame_count

            status_badge = (
                '<span class="badge badge-online">&#9679; Connected</span>'
                if is_connected else
                '<span class="badge badge-offline">&#9679; Reconnecting</span>'
            )
            direction_badge = (
                '<span class="badge badge-entry">&#8593; Entry Gate</span>'
                if cam.direction == "entry" else
                '<span class="badge badge-exit">&#8595; Exit Gate</span>'
            )
            rec_overlay = '<div class="cam-overlay"><span class="dot"></span> REC</div>' if is_connected else ""
            live_status = "&#128994; Live" if is_connected else "&#128308; Offline"
            safe_id = cam.name.replace("-", "_").replace(".", "_")

            camera_cards_html += f"""
            <div class="cam-card">
                <div class="cam-header">
                    <div>
                        <div class="cam-name">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
                            </svg>
                            {cam.name}
                        </div>
                        <div class="cam-badges">{direction_badge} {status_badge}</div>
                    </div>
                    <div class="cam-frames">{frame_cnt} frames</div>
                </div>
                <div class="cam-preview">
                    <img id="img-{safe_id}" src="/camera/frame/{cam.name}" alt="{cam.name}" />
                    {rec_overlay}
                </div>
                <div class="cam-footer">
                    <span>{cam.name}</span>
                    <span>{live_status}</span>
                </div>
            </div>"""

        # Build detection rows
        recent_rows = ""
        for log in recent:
            ts = time.strftime("%H:%M:%S", time.localtime(log.get("timestamp", 0)))
            user_name = log.get("user_name") or "Unknown"
            is_known = bool(log.get("user_id"))
            camera = log.get("camera_name", "-")
            direction = log.get("direction", "-")
            conf = log.get("confidence", 0)
            conf_pct = int(conf * 100)
            person_cls = "person-known" if is_known else "person-unknown"
            person_icon = "&#10003;" if is_known else "?"
            dir_badge = (
                '<span class="badge badge-entry">&#8593; Entry</span>'
                if direction == "entry" else
                '<span class="badge badge-exit">&#8595; Exit</span>'
            )
            recent_rows += f"""
            <tr>
                <td class="mono">{ts}</td>
                <td><span class="{person_cls}">{person_icon} {user_name}</span></td>
                <td class="muted">{camera}</td>
                <td>{dir_badge}</td>
                <td>
                    <div class="conf-bar">
                        <div class="conf-track"><div class="conf-fill" style="width:{conf_pct}%"></div></div>
                        <span class="conf-num">{conf:.2f}</span>
                    </div>
                </td>
            </tr>"""

        # Build JS refresh calls
        js_refresh = "; ".join([
            f"var e_{cam.name.replace('-','_').replace('.','_')}=document.getElementById('img-{cam.name.replace('-','_').replace(chr(46),chr(95))}'); if(e_{cam.name.replace('-','_').replace('.','_')}) e_{cam.name.replace('-','_').replace('.','_')}.src='/camera/frame/{cam.name}?t='+Date.now();"
            for cam in config.cameras
        ])

        queue_pending = queue_stats.get("pending") or 0
        queue_failed  = queue_stats.get("failed")  or 0
        pending_color = "#f97316" if queue_pending > 0 else "var(--brand-green)"
        failed_color  = "#ff4f4f" if queue_failed  > 0 else "var(--brand-green)"
        cloud_color   = "var(--online)" if config.cloud_enabled else "var(--text-dim)"
        cloud_label   = "Active" if config.cloud_enabled else "Disabled"

        return HTMLResponse(content=f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Paradigm Services &mdash; CCTV Surveillance Monitor</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root {{
  --brand-green:  #006B3F;
  --brand-gdim:   rgba(0,107,63,0.12);
  --brand-gold:   #C5A84E;
  --bg-base:      #050e1a;
  --bg-panel:     #0b1929;
  --bg-card:      #0f2035;
  --border:       rgba(0,107,63,0.22);
  --border-s:     rgba(255,255,255,0.06);
  --txt:          #e8f4ee;
  --muted:        #6b8fa8;
  --dim:          #3d5a73;
  --online:       #00c97a;
  --offline:      #ff4f4f;
  --entry:        #38bdf8;
  --exit:         #f97316;
}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{
  font-family:'Manrope',-apple-system,sans-serif;
  background:var(--bg-base);color:var(--txt);min-height:100vh;
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -20%,rgba(0,107,63,0.15) 0%,transparent 70%),
    repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.015) 40px),
    repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,0.015) 40px);
}}
/* NAV */
.nav{{display:flex;align-items:center;justify-content:space-between;padding:13px 28px;background:rgba(5,14,26,0.92);border-bottom:1px solid var(--border);backdrop-filter:blur(12px);position:sticky;top:0;z-index:100}}
.brand{{display:flex;align-items:center;gap:13px}}
.brand-name{{font-size:.95rem;font-weight:800;color:var(--txt);letter-spacing:.08em;text-transform:uppercase}}
.brand-sub{{font-size:.62rem;color:var(--brand-gold);letter-spacing:.12em;text-transform:uppercase;font-weight:600}}
.nav-right{{display:flex;align-items:center;gap:18px}}
.dev-badge{{display:flex;align-items:center;gap:6px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:5px 11px;font-size:.7rem;color:var(--muted)}}
.dev-badge .dot{{width:7px;height:7px;border-radius:50%;background:var(--online);box-shadow:0 0 8px var(--online);animation:pulse 2s infinite}}
.rec-pill{{display:flex;align-items:center;gap:5px;background:rgba(255,79,79,.12);border:1px solid rgba(255,79,79,.3);border-radius:6px;padding:4px 10px;font-size:.68rem;font-weight:700;color:#ff6b6b;letter-spacing:.08em}}
.rec-dot{{width:6px;height:6px;border-radius:50%;background:#ff4f4f;animation:pulse 1.2s infinite}}
@keyframes pulse{{0%,100%{{opacity:1}}50%{{opacity:.4}}}}
/* LAYOUT */
.main{{padding:22px 28px;max-width:1600px;margin:0 auto}}
.sec-title{{display:flex;align-items:center;gap:10px;font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;margin-bottom:13px}}
.sec-title::after{{content:'';flex:1;height:1px;background:var(--border)}}
/* KPI */
.kpi-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:13px;margin-bottom:26px}}
.kpi{{background:var(--bg-card);border:1px solid var(--border-s);border-radius:12px;padding:17px 19px;position:relative;overflow:hidden}}
.kpi::before{{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--brand-green),transparent)}}
.kpi-ico{{font-size:1.3rem;margin-bottom:9px}}
.kpi-val{{font-size:2.1rem;font-weight:800;line-height:1;margin-bottom:3px}}
.kpi-lbl{{font-size:.66rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}}
/* SYS */
.sys-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:11px;margin-bottom:26px}}
.sys-item{{background:var(--bg-card);border:1px solid var(--border-s);border-radius:10px;padding:13px 15px;display:flex;align-items:center;gap:11px}}
.sys-ico{{font-size:1rem;width:32px;height:32px;border-radius:8px;background:var(--brand-gdim);display:flex;align-items:center;justify-content:center;flex-shrink:0}}
.sys-lbl{{font-size:.64rem;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}}
.sys-val{{font-size:.8rem;font-weight:700;color:var(--txt);margin-top:1px;word-break:break-all}}
/* CAMERAS */
.cam-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:15px;margin-bottom:26px}}
.cam-card{{background:var(--bg-card);border:1px solid var(--border-s);border-radius:13px;overflow:hidden;transition:box-shadow .2s}}
.cam-card:hover{{box-shadow:0 0 0 1px var(--border),0 8px 28px rgba(0,107,63,.12)}}
.cam-header{{padding:11px 15px;background:var(--bg-panel);border-bottom:1px solid var(--border-s);display:flex;justify-content:space-between;align-items:flex-start}}
.cam-name{{font-size:.8rem;font-weight:700;color:var(--txt);display:flex;align-items:center;gap:6px}}
.cam-name svg{{color:var(--brand-green)}}
.cam-badges{{display:flex;align-items:center;gap:5px;margin-top:4px}}
.cam-frames{{font-size:.64rem;color:var(--dim)}}
.cam-preview{{aspect-ratio:16/9;background:#000;position:relative;overflow:hidden}}
.cam-preview img{{width:100%;height:100%;object-fit:cover;display:block}}
.cam-overlay{{position:absolute;top:9px;left:9px;display:flex;align-items:center;gap:4px;background:rgba(5,14,26,.75);border:1px solid rgba(255,79,79,.4);border-radius:5px;padding:3px 7px;font-size:.62rem;font-weight:700;color:#ff6b6b;letter-spacing:.08em;backdrop-filter:blur(4px)}}
.cam-overlay .dot{{width:5px;height:5px;border-radius:50%;background:#ff4f4f;animation:pulse 1.2s infinite}}
.cam-footer{{padding:7px 15px;background:var(--bg-panel);border-top:1px solid var(--border-s);font-size:.64rem;color:var(--dim);display:flex;justify-content:space-between}}
/* BADGES */
.badge{{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:5px;font-size:.63rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase}}
.badge-online {{background:rgba(0,201,122,.12);color:var(--online);border:1px solid rgba(0,201,122,.25)}}
.badge-offline{{background:rgba(255,79,79,.1);color:var(--offline);border:1px solid rgba(255,79,79,.2)}}
.badge-entry  {{background:rgba(56,189,248,.1);color:var(--entry);border:1px solid rgba(56,189,248,.2)}}
.badge-exit   {{background:rgba(249,115,22,.1);color:var(--exit);border:1px solid rgba(249,115,22,.2)}}
/* TABLE */
.tbl-wrap{{background:var(--bg-card);border:1px solid var(--border-s);border-radius:13px;overflow:hidden;margin-bottom:26px}}
table{{width:100%;border-collapse:collapse}}
thead tr{{background:var(--bg-panel)}}
th{{padding:10px 15px;text-align:left;font-size:.64rem;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.1em;border-bottom:1px solid var(--border-s)}}
td{{padding:9px 15px;font-size:.78rem;border-top:1px solid var(--border-s);color:var(--txt)}}
tbody tr:hover{{background:rgba(0,107,63,.04)}}
.person-known{{color:var(--online);font-weight:600}}
.person-unknown{{color:var(--brand-gold);font-weight:600}}
.conf-bar{{display:flex;align-items:center;gap:7px}}
.conf-track{{flex:1;height:3px;background:var(--border-s);border-radius:99px;overflow:hidden;max-width:72px}}
.conf-fill{{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--brand-green),#00e87a)}}
.conf-num{{font-size:.68rem;color:var(--muted)}}
.mono{{font-family:monospace;color:var(--muted)}}
.muted{{color:var(--muted)}}
/* FOOTER */
.footer{{display:flex;align-items:center;justify-content:space-between;padding:13px 28px;border-top:1px solid var(--border-s);font-size:.66rem;color:var(--dim)}}
.footer a{{color:var(--brand-green);text-decoration:none;font-weight:600}}
.footer a:hover{{color:var(--brand-gold)}}
.footer-links{{display:flex;gap:18px}}
</style>
<script>
setInterval(function(){{ {js_refresh} }}, 1500);
function tick(){{var e=document.getElementById('clk');if(e)e.textContent=new Date().toLocaleTimeString('en-IN',{{hour12:false}});}}
setInterval(tick,1000);tick();
setTimeout(function(){{location.reload();}},15000);
</script>
</head>
<body>

<nav class="nav">
  <div class="brand">
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="5.5" fill="#006B3F"/>
      <circle cx="18" cy="6.5" r="3"   fill="#006B3F"/>
      <circle cx="18" cy="29.5" r="3"  fill="#006B3F"/>
      <circle cx="6.5" cy="18" r="3"   fill="#006B3F"/>
      <circle cx="29.5" cy="18" r="3"  fill="#006B3F"/>
      <circle cx="10" cy="10" r="2.5"  fill="#006B3F"/>
      <circle cx="26" cy="26" r="2.5"  fill="#006B3F"/>
      <circle cx="10" cy="26" r="2.5"  fill="#006B3F"/>
      <circle cx="26" cy="10" r="2.5"  fill="#006B3F"/>
      <circle cx="18" cy="6.5" r="1.3" fill="#C5A84E"/>
      <circle cx="10" cy="10" r="1.1"  fill="#C5A84E"/>
      <circle cx="26" cy="10" r="1.1"  fill="#C5A84E"/>
    </svg>
    <div>
      <div class="brand-name">Paradigm Services</div>
      <div class="brand-sub">CCTV Surveillance Monitor</div>
    </div>
  </div>
  <div class="nav-right">
    <div class="dev-badge"><span class="dot"></span><span>{config.edge_device_id}</span></div>
    <div class="rec-pill"><span class="rec-dot"></span>REC</div>
    <span id="clk" style="font-size:.73rem;color:var(--muted);font-weight:600;min-width:62px;text-align:right">--:--:--</span>
  </div>
</nav>

<div class="main">

  <div class="sec-title">System Overview</div>
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-ico">&#128100;</div>
      <div class="kpi-val" style="color:var(--brand-green)">{enrolled_count}</div>
      <div class="kpi-lbl">Enrolled Faces</div>
    </div>
    <div class="kpi">
      <div class="kpi-ico">&#128247;</div>
      <div class="kpi-val" style="color:var(--brand-green)">{len(config.cameras)}</div>
      <div class="kpi-lbl">Active Cameras</div>
    </div>
    <div class="kpi">
      <div class="kpi-ico">&#9203;</div>
      <div class="kpi-val" style="color:{pending_color}">{queue_pending}</div>
      <div class="kpi-lbl">Queue Pending</div>
    </div>
    <div class="kpi">
      <div class="kpi-ico">&#10060;</div>
      <div class="kpi-val" style="color:{failed_color}">{queue_failed}</div>
      <div class="kpi-lbl">Queue Failed</div>
    </div>
  </div>

  <div class="sec-title">Device Configuration</div>
  <div class="sys-grid">
    <div class="sys-item"><div class="sys-ico">&#128187;</div><div><div class="sys-lbl">Edge Device</div><div class="sys-val">{config.edge_device_id}</div></div></div>
    <div class="sys-item"><div class="sys-ico">&#127919;</div><div><div class="sys-lbl">Match Threshold</div><div class="sys-val">{config.match_threshold:.0%}</div></div></div>
    <div class="sys-item"><div class="sys-ico">&#9203;</div><div><div class="sys-lbl">Cooldown Period</div><div class="sys-val">{config.cooldown_seconds}s</div></div></div>
    <div class="sys-item"><div class="sys-ico">&#128640;</div><div><div class="sys-lbl">Processing FPS</div><div class="sys-val">{config.processing_fps} fps</div></div></div>
    <div class="sys-item"><div class="sys-ico">&#9729;</div><div><div class="sys-lbl">Cloud Sync</div><div class="sys-val" style="color:{cloud_color}">{cloud_label}</div></div></div>
  </div>

  <div class="sec-title">Live Camera Feeds</div>
  <div class="cam-grid">
    {camera_cards_html if camera_cards_html else '<div style="color:var(--dim);padding:32px;background:var(--bg-card);border-radius:12px;border:1px solid var(--border-s);text-align:center">No cameras configured</div>'}
  </div>

  <div class="sec-title">Recent Detections</div>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>Time</th><th>Person</th><th>Camera</th><th>Direction</th><th>Confidence</th></tr></thead>
      <tbody>
        {recent_rows if recent_rows else '<tr><td colspan="5" style="color:var(--dim);text-align:center;padding:26px">No detections recorded yet</td></tr>'}
      </tbody>
    </table>
  </div>

</div>

<div class="footer">
  <span>&copy; 2026 Paradigm Services&trade; &nbsp;&middot;&nbsp; CCTV Attendance Edge v1.0</span>
  <div class="footer-links">
    <a href="/docs">API Docs</a>
    <a href="/health">Health</a>
    <a href="/stats">Stats</a>
    <a href="/cameras">Cameras</a>
    <a href="/enrolled">Enrolled</a>
  </div>
</div>

</body>
</html>""")

    return app

