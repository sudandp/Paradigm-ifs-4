"""
CCTV Attendance — Main Processing Pipeline

The central orchestrator that connects:
  Frame Grabber → Face Engine → Database → Dispatcher

Runs a continuous loop processing frames from all cameras,
detecting faces, matching against enrolled employees, and
pushing attendance events to the cloud.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from loguru import logger

from .config import AppConfig
from .database import LocalDatabase
from .dispatcher import EventDispatcher
from .face_engine import FaceEngine, DetectedFace, MatchResult
from .frame_grabber import MultiCameraGrabber, CapturedFrame


class AttendancePipeline:
    """Main attendance processing pipeline.
    
    Lifecycle:
        1. Initialize (load models, connect cameras, sync embeddings)
        2. Run processing loop (detect → match → push)
        3. Periodically sync embeddings and drain offline queue
        4. Shutdown gracefully
    """

    def __init__(self, config: AppConfig):
        self.config = config
        self.db = LocalDatabase(config.db_path)
        self.face_engine = FaceEngine(
            models_dir=config.models_dir,
            detection_threshold=config.min_detection_confidence,
        )
        self.grabber = MultiCameraGrabber(
            cameras=config.cameras,
            target_fps=config.processing_fps,
        )
        self.dispatcher = EventDispatcher(config, self.db)
        
        # Cached enrolled embeddings (refreshed periodically)
        self._enrolled: list[dict] = []
        self._last_enrollment_refresh = 0.0
        self._enrollment_refresh_interval = 60.0  # Refresh every 60s
        
        # Stats
        self._stats = PipelineStats()
        self._running = False

    async def initialize(self) -> bool:
        """Initialize all components. Returns True if ready to process."""
        logger.info("=" * 60)
        logger.info("  CCTV Attendance Pipeline — Initializing")
        logger.info("=" * 60)

        # 1. Database
        self.db.connect()
        logger.info(f"[Pipeline] Database: {self.config.db_path}")

        # 2. Face Engine
        if not self.face_engine.initialize():
            logger.error("[Pipeline] Face engine initialization failed!")
            return False

        # 3. Cloud dispatcher
        await self.dispatcher.initialize()

        # 4. Sync embeddings from cloud
        if self.config.cloud_enabled:
            count = await self.dispatcher.sync_embeddings()
            logger.info(f"[Pipeline] Synced {count} face embeddings from cloud")

        # 5. Load enrolled embeddings into memory
        self._refresh_enrolled_cache()

        # 6. Send initial heartbeat to Supabase
        if self.config.cloud_enabled:
            cams_meta = [{'name': cam.name, 'direction': cam.direction} for cam in self.config.cameras]
            await self.dispatcher.send_heartbeat(cams_meta)

        # 7. Start cameras
        cam_status = self.grabber.start_all()
        connected = sum(1 for v in cam_status.values() if v)
        if connected == 0:
            logger.error("[Pipeline] No cameras connected!")
            return False

        # 8. Ensure directories exist
        if self.config.save_snapshots:
            self.config.snapshot_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"[Pipeline] Ready — {connected} cameras, {len(self._enrolled)} enrolled faces")
        return True

    async def run(self) -> None:
        """Main processing loop. Runs until stopped."""
        self._running = True
        frame_interval = 1.0 / self.config.processing_fps
        queue_drain_interval = 30.0  # Drain offline queue every 30s
        last_queue_drain = time.time()
        last_cooldown_cleanup = time.time()

        logger.info("[Pipeline] Processing loop started")

        while self._running:
            loop_start = time.time()

            try:
                # 1. Grab frames from all cameras
                frames = self.grabber.get_all_frames()
                
                if not frames:
                    await asyncio.sleep(0.1)
                    continue

                # 2. Process each frame
                for captured_frame in frames:
                    await self._process_frame(captured_frame)

                # 3. Periodically refresh enrolled embeddings
                if time.time() - self._last_enrollment_refresh > self._enrollment_refresh_interval:
                    self._refresh_enrolled_cache()
                    if self.config.cloud_enabled:
                        await self.dispatcher.sync_embeddings()
                        self._refresh_enrolled_cache()

                # 4. Periodically drain offline queue & send heartbeat
                if time.time() - last_queue_drain > queue_drain_interval:
                    await self.dispatcher.drain_queue()
                    if self.config.cloud_enabled:
                        cams_meta = [
                            {'name': cam.name, 'direction': cam.direction}
                            for cam in self.config.cameras
                        ]
                        await self.dispatcher.send_heartbeat(cams_meta)
                    last_queue_drain = time.time()

                # 5. Periodically clean expired cooldowns
                if time.time() - last_cooldown_cleanup > self.config.cooldown_seconds:
                    self.db.clear_expired_cooldowns(self.config.cooldown_seconds)
                    last_cooldown_cleanup = time.time()

            except Exception as e:
                logger.error(f"[Pipeline] Processing error: {e}")
                self._stats.errors += 1

            # Throttle to target FPS
            elapsed = time.time() - loop_start
            sleep_time = max(0, frame_interval - elapsed)
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

        logger.info("[Pipeline] Processing loop ended")

    async def stop(self) -> None:
        """Gracefully stop the pipeline."""
        logger.info("[Pipeline] Stopping...")
        self._running = False
        self.grabber.stop_all()
        await self.dispatcher.close()
        self.db.close()
        logger.info("[Pipeline] Stopped")

    async def _process_frame(self, captured: CapturedFrame) -> None:
        """Process a single frame: detect faces, match, and push events."""
        self._stats.frames_processed += 1

        # Run CPU-bound face detection in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        faces = await loop.run_in_executor(
            None, self.face_engine.detect_faces, captured.frame
        )

        if not faces:
            return

        self._stats.faces_detected += len(faces)

        for face in faces:
            await self._handle_detected_face(face, captured)

    async def _handle_detected_face(
        self, face: DetectedFace, captured: CapturedFrame
    ) -> None:
        """Handle a single detected face: match and create attendance event."""

        # Run CPU-bound face matching in thread pool
        loop = asyncio.get_event_loop()
        enrolled_snapshot = list(self._enrolled)  # Snapshot to avoid race conditions
        match = await loop.run_in_executor(
            None,
            lambda: self.face_engine.match_face(
                embedding=face.embedding,
                enrolled_embeddings=enrolled_snapshot,
                threshold=self.config.match_threshold,
            )
        )

        if match and match.is_match:
            # ─── Known Face: Check cooldown and create event ──────
            if self.db.check_cooldown(
                match.user_id, captured.camera_name, self.config.cooldown_seconds
            ):
                # Within cooldown — skip
                self._stats.cooldown_skips += 1
                return

            # Save snapshot if configured
            snapshot_path = None
            if self.config.save_snapshots and face.face_crop is not None:
                snapshot_path = self._save_snapshot(
                    face.face_crop, match.user_id, captured.camera_name
                )

            # Log locally
            self.db.log_detection(
                user_id=match.user_id,
                user_name=match.user_name,
                camera_name=captured.camera_name,
                direction=captured.direction,
                confidence=match.similarity,
                timestamp=captured.timestamp,
                snapshot_path=snapshot_path,
            )

            # Update cooldown
            self.db.update_cooldown(match.user_id, captured.camera_name)

            # Push to cloud
            await self.dispatcher.push_attendance_event(
                user_id=match.user_id,
                user_name=match.user_name,
                camera_name=captured.camera_name,
                direction=captured.direction,
                confidence=match.similarity,
                timestamp=captured.timestamp,
                snapshot_path=snapshot_path,
            )

            self._stats.matches += 1
            logger.info(
                f"[Pipeline] [MATCH] {match.user_name} detected at "
                f"{captured.camera_name} ({captured.direction}) — "
                f"confidence: {match.similarity:.3f}"
            )

        else:
            # ─── Unknown Face: Log for admin review ───────────────
            snapshot_path = None
            if self.config.save_snapshots and face.face_crop is not None:
                snapshot_path = self._save_snapshot(
                    face.face_crop, "unknown", captured.camera_name
                )

            self.db.log_unknown_face(
                embedding=face.embedding,
                camera_name=captured.camera_name,
                timestamp=captured.timestamp,
                snapshot_path=snapshot_path,
            )

            self.db.log_detection(
                user_id=None,
                user_name=None,
                camera_name=captured.camera_name,
                direction=captured.direction,
                confidence=face.detection_score,
                timestamp=captured.timestamp,
                snapshot_path=snapshot_path,
            )

            self._stats.unknown_faces += 1

    def _refresh_enrolled_cache(self) -> None:
        """Reload enrolled embeddings from local database into memory."""
        self._enrolled = self.db.get_all_embeddings()
        self._last_enrollment_refresh = time.time()
        logger.debug(f"[Pipeline] Refreshed enrolled cache: {len(self._enrolled)} faces")

    def _save_snapshot(self, face_crop: np.ndarray, user_id: str, camera_name: str) -> str:
        """Save a face crop to disk. Returns the file path."""
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        filename = f"{user_id}_{camera_name}_{timestamp_str}.jpg"
        
        # Organize by date
        date_dir = self.config.snapshot_dir / datetime.now().strftime('%Y-%m-%d')
        date_dir.mkdir(parents=True, exist_ok=True)
        
        filepath = date_dir / filename
        cv2.imwrite(str(filepath), face_crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return str(filepath)

    def get_stats(self) -> dict:
        """Get current pipeline statistics."""
        queue_stats = self.db.get_queue_stats()
        return {
            'frames_processed': self._stats.frames_processed,
            'faces_detected': self._stats.faces_detected,
            'matches': self._stats.matches,
            'unknown_faces': self._stats.unknown_faces,
            'cooldown_skips': self._stats.cooldown_skips,
            'errors': self._stats.errors,
            'enrolled_count': len(self._enrolled),
            'queue_pending': queue_stats.get('pending', 0),
            'queue_failed': queue_stats.get('failed', 0),
            'cameras': self.grabber.get_status(),
        }


class PipelineStats:
    """Simple stats counter for the pipeline."""
    def __init__(self):
        self.frames_processed: int = 0
        self.faces_detected: int = 0
        self.matches: int = 0
        self.unknown_faces: int = 0
        self.cooldown_skips: int = 0
        self.errors: int = 0
        self.started_at: float = time.time()
