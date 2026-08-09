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
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:5173",
            "https://paradigm-ifs-4.vercel.app",
            f"http://localhost:{config.admin_port}",
        ],
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
        """HTML admin dashboard with live camera feed previews."""
        enrolled_count = db.get_embedding_count()
        queue_stats = db.get_queue_stats()
        recent = db.get_recent_detections(limit=10)

        # Camera Cards HTML
        camera_cards_html = ""
        for cam in config.cameras:
            is_connected = False
            frame_cnt = 0
            if pipeline and hasattr(pipeline, 'grabber') and cam.name in pipeline.grabber.streams:
                st = pipeline.grabber.streams[cam.name]
                is_connected = st.is_connected
                frame_cnt = st.frame_count

            status_pill = (
                '<span class="badge online">🟢 Connected</span>'
                if is_connected else
                '<span class="badge offline">🔴 Reconnecting</span>'
            )
            direction_pill = (
                '<span class="badge entry">Entry Gate</span>'
                if cam.direction == 'entry' else
                '<span class="badge exit">Exit Gate</span>'
            )

            camera_cards_html += f"""
            <div class="cam-card">
                <div class="cam-header">
                    <div>
                        <div class="cam-title">🎥 {cam.name}</div>
                        <div style="margin-top:4px">{direction_pill} {status_pill}</div>
                    </div>
                    <div style="font-size:0.75rem;color:#64748b">Frames: {frame_cnt}</div>
                </div>
                <div class="cam-preview">
                    <img id="img-{cam.name}" src="/camera/frame/{cam.name}" alt="{cam.name} preview" 
                         onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'320\' height=\'180\' viewBox=\'0 0 320 180\'><rect width=\'320\' height=\'180\' fill=\'%230f172a\'/><text x=\'50%\' y=\'50%\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%2364748b\' font-family=\'sans-serif\' font-size=\'14\'>Connecting camera stream...</text></svg>'" />
                </div>
            </div>"""

        recent_rows = ""
        for log in recent:
            ts = time.strftime('%H:%M:%S', time.localtime(log.get('timestamp', 0)))
            user = log.get('user_name') or '❓ Unknown'
            camera = log.get('camera_name', '-')
            direction = log.get('direction', '-')
            conf = log.get('confidence', 0)
            recent_rows += f"""
            <tr>
                <td>{ts}</td>
                <td>{'✅ ' + user if log.get('user_id') else '❓ Unknown'}</td>
                <td>{camera}</td>
                <td>{'🟢 Entry' if direction == 'entry' else '🔴 Exit'}</td>
                <td>{conf:.2f}</td>
            </tr>"""

        return HTMLResponse(content=f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CCTV Attendance Admin — {config.edge_device_id}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: #0f172a; color: #e2e8f0; padding: 24px; }}
        h1 {{ font-size: 1.5rem; color: #38bdf8; margin-bottom: 8px; }}
        .sub {{ color: #64748b; font-size: 0.875rem; margin-bottom: 24px; }}
        .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }}
        .card {{ background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }}
        .card .label {{ font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }}
        .card .value {{ font-size: 2rem; font-weight: 700; color: #38bdf8; margin-top: 4px; }}
        
        .cam-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 24px; }}
        .cam-card {{ background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }}
        .cam-header {{ padding: 12px 16px; background: #0f172a; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }}
        .cam-title {{ font-weight: 700; color: #e2e8f0; font-size: 0.9rem; }}
        .cam-preview {{ aspect-ratio: 16/9; background: #000; position: relative; overflow: hidden; }}
        .cam-preview img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
        
        table {{ width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; }}
        th {{ background: #0f172a; padding: 12px 16px; text-align: left; font-size: 0.75rem; color: #64748b; text-transform: uppercase; }}
        td {{ padding: 12px 16px; border-top: 1px solid #334155; font-size: 0.875rem; }}
        h2 {{ font-size: 1rem; color: #94a3b8; margin-bottom: 12px; margin-top: 24px; }}
        .badge {{ display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; }}
        .online {{ background: #064e3b; color: #34d399; }}
        .offline {{ background: #450a0a; color: #f87171; }}
        .entry {{ background: #0284c7; color: #e0f2fe; }}
        .exit {{ background: #7c3aed; color: #f3e8ff; }}
    </style>
    <script>
        // Auto-refresh camera preview images every 1.5s
        setInterval(() => {{
            {"; ".join([f"const i_{cam.name} = document.getElementById('img-{cam.name}'); if(i_{cam.name}) i_{cam.name}.src = '/camera/frame/{cam.name}?t=' + Date.now();" for cam in config.cameras])}
        }}, 1500);
        
        // Auto-refresh page data every 15s
        setTimeout(() => location.reload(), 15000);
    </script>
</head>
<body>
    <h1>🎥 CCTV Attendance Admin</h1>
    <div class="sub">Device: {config.edge_device_id} &nbsp;|&nbsp; Live Feeds & Status</div>
    
    <div class="cards">
        <div class="card">
            <div class="label">Enrolled Faces</div>
            <div class="value">{enrolled_count}</div>
        </div>
        <div class="card">
            <div class="label">Queue Pending</div>
            <div class="value">{queue_stats.get('pending') or 0}</div>
        </div>
        <div class="card">
            <div class="label">Queue Failed</div>
            <div class="value">{queue_stats.get('failed') or 0}</div>
        </div>
        <div class="card">
            <div class="label">Cameras</div>
            <div class="value">{len(config.cameras)}</div>
        </div>
    </div>

    <h2>🎥 Live Camera Feeds</h2>
    <div class="cam-grid">
        {camera_cards_html if camera_cards_html else '<div style="color:#64748b">No cameras configured</div>'}
    </div>

    <h2>📋 Recent Detections</h2>
    <table>
        <thead>
            <tr><th>Time</th><th>Person</th><th>Camera</th><th>Direction</th><th>Confidence</th></tr>
        </thead>
        <tbody>
            {recent_rows if recent_rows else '<tr><td colspan="5" style="color:#64748b;text-align:center">No detections yet</td></tr>'}
        </tbody>
    </table>
    
    <div style="margin-top:24px;color:#334155;font-size:0.75rem">
        API Endpoints: 
        <a href="/docs" style="color:#38bdf8">/docs</a> &nbsp;|&nbsp;
        <a href="/health" style="color:#38bdf8">/health</a> &nbsp;|&nbsp;
        <a href="/stats" style="color:#38bdf8">/stats</a> &nbsp;|&nbsp;
        <a href="/cameras" style="color:#38bdf8">/cameras</a>
    </div>
</body>
</html>""")

    return app
