"""
CCTV Attendance — Main Processing Pipeline

The central orchestrator that connects:
  Frame Grabber → Object Detector (YOLO) → Face Engine (InsightFace) → Database → Dispatcher

Two-layer detection architecture:
  Layer 1 — YOLOv8n detects all objects (humans, cars, bikes, etc.) in each frame
  Layer 2 — InsightFace runs ONLY on person crops to identify registered employees

This ensures:
  • Cars, bikes, trucks are labeled and tracked even when no face is visible
  • Humans walking away or at an angle show "UNKNOWN PERSON" instead of nothing
  • Face recognition quality improves (smaller crop → better detection)
  • No more all-black snapshots — any detected object produces a real snapshot
"""

from __future__ import annotations

import asyncio
import base64
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
from .object_detector import ObjectDetector, DetectedObject


class AttendancePipeline:
    """Main attendance processing pipeline.
    
    Lifecycle:
        1. Initialize (load models, connect cameras, sync embeddings)
        2. Run processing loop (YOLO detect → face recognize → push events)
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
        self.object_detector = ObjectDetector(
            confidence_threshold=0.40,
            iou_threshold=0.45,
        )
        self.grabber = MultiCameraGrabber(
            cameras=config.cameras,
            target_fps=25,
        )
        self.dispatcher = EventDispatcher(config, self.db)
        
        # Cached enrolled embeddings (refreshed periodically)
        self._enrolled: list[dict] = []
        self._last_enrollment_refresh = 0.0
        self._enrollment_refresh_interval = 60.0  # Refresh every 60s
        
        # Real-time tracking state for live video HUD overlay
        # Each track entry now includes: bbox, user_name, user_id, confidence,
        # is_match, direction, timestamp, object_type, label
        self.latest_tracks: dict[str, list[dict]] = {}

        # Configured camera Action Zones (ROI polygon bounds)
        # Structure: {camera_name: [[x1, y1], [x2, y2], ...]} (normalized 0.0-1.0 coords)
        self.action_zones: dict[str, list[list[float]]] = {}

        # Unknown face cooldown — prevent same person creating duplicate queue entries
        # Structure: {camera_name: [(embedding_vec, last_seen_timestamp), ...]}
        # Compares cosine similarity — if > 0.78 within cooldown window → skip
        self._unknown_face_seen: dict[str, list[tuple]] = {}
        self._unknown_cooldown: float = 20.0  # seconds between same unknown face reports
        self._unknown_sim_threshold: float = 0.78  # strict cosine similarity to consider "same person"

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

        # 1.1 Load Camera Action Zones (ROI Polygons)
        zones_map = self.db.get_all_action_zones()
        for cname, zdata in zones_map.items():
            if zdata.get('enabled') and zdata.get('polygon'):
                self.action_zones[cname] = zdata['polygon']
        logger.info(f"[Pipeline] Loaded {len(self.action_zones)} active camera Action Zones")

        # 2. Object Detector (YOLO Layer 1)
        obj_ready = self.object_detector.initialize()
        if not obj_ready:
            logger.warning(
                "[Pipeline] Object detector (YOLO) not available — "
                "falling back to face-only detection"
            )

        # 3. Face Engine (InsightFace Layer 2)
        if not self.face_engine.initialize():
            logger.error("[Pipeline] Face engine initialization failed!")
            return False

        # 4. Cloud dispatcher
        await self.dispatcher.initialize()

        # 5. Sync embeddings from cloud
        if self.config.cloud_enabled:
            count = await self.dispatcher.sync_embeddings()
            logger.info(f"[Pipeline] Synced {count} face embeddings from cloud")

        # 6. Load enrolled embeddings into memory
        self._refresh_enrolled_cache()

        # 7. Send initial heartbeat to Supabase
        if self.config.cloud_enabled:
            cams_meta = [{'name': cam.name, 'direction': cam.direction} for cam in self.config.cameras]
            await self.dispatcher.send_heartbeat(cams_meta)

        # 8. Start cameras
        cam_status = self.grabber.start_all()
        connected = sum(1 for v in cam_status.values() if v)
        if connected == 0:
            logger.error("[Pipeline] No cameras connected!")
            return False

        # 9. Ensure directories exist
        if self.config.save_snapshots:
            self.config.snapshot_dir.mkdir(parents=True, exist_ok=True)

        logger.info(
            f"[Pipeline] Ready — {connected} cameras, "
            f"{len(self._enrolled)} enrolled faces, "
            f"action_zones={len(self.action_zones)}, "
            f"object_detector={'ON' if obj_ready else 'OFF (face-only)'}"
        )
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

                # 5. Periodically clean expired cooldowns & purge expired snapshots
                if time.time() - last_cooldown_cleanup > self.config.cooldown_seconds:
                    self.db.clear_expired_cooldowns(self.config.cooldown_seconds)
                    self._cleanup_old_snapshots()
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

    @staticmethod
    def _bbox_overlap_ratio(face_bbox: list[int], vehicle_bbox: list[int]) -> float:
        """Calculate what fraction of the face bbox overlaps with a vehicle bbox.
        Returns 0.0 if no overlap, up to 1.0 if face is fully inside vehicle.
        """
        fx1, fy1, fx2, fy2 = face_bbox
        vx1, vy1, vx2, vy2 = vehicle_bbox

        # Intersection
        ix1 = max(fx1, vx1)
        iy1 = max(fy1, vy1)
        ix2 = min(fx2, vx2)
        iy2 = min(fy2, vy2)

        if ix2 <= ix1 or iy2 <= iy1:
            return 0.0

        intersection_area = (ix2 - ix1) * (iy2 - iy1)
        face_area = max(1, (fx2 - fx1) * (fy2 - fy1))
        return intersection_area / face_area

    async def _process_frame(self, captured: CapturedFrame) -> None:
        """Process a single frame with concurrent multi-face recognition:
        
        1. (Optional) YOLO detects vehicles → builds exclusion zones
        2. InsightFace SCRFD detects ALL faces in the frame simultaneously
        3. Faces inside vehicle zones are suppressed (headlights/reflectors)
        4. Matches every remaining face against enrolled employee embeddings
        5. Attendance events pushed for matched employees; unknown faces queued
        """
        self._stats.frames_processed += 1
        loop = asyncio.get_event_loop()
        current_tracks: list[dict] = []
        enrolled_snapshot = list(self._enrolled)

        # ── Layer 1: YOLO Vehicle Zone Detection (if available) ────────
        vehicle_bboxes: list[list[int]] = []
        if self.object_detector.is_ready:
            try:
                objects: list[DetectedObject] = await loop.run_in_executor(
                    None, self.object_detector.detect, captured.frame
                )
                for obj in objects:
                    if not obj.is_person:
                        # Collect all vehicle/non-person bounding boxes
                        vehicle_bboxes.append(obj.bbox)
                        self._stats.vehicles_detected += 1
                        current_tracks.append({
                            'bbox':        obj.bbox,
                            'object_type': obj.label,
                            'label':       obj.label,
                            'user_name':   obj.label,
                            'user_id':     None,
                            'confidence':  obj.confidence,
                            'is_match':    False,
                            'direction':   captured.direction.upper(),
                            'timestamp':   time.time(),
                        })
            except Exception as e:
                logger.debug(f"[Pipeline] YOLO detection error (non-fatal): {e}")

        # ── Layer 2: Concurrent Multi-Face Detection (InsightFace within Action Zone) ────────
        cam_action_zone = self.action_zones.get(captured.camera_name)
        faces: list[DetectedFace] = await loop.run_in_executor(
            None, self.face_engine.detect_faces, captured.frame, cam_action_zone
        )

        if faces:
            self._stats.faces_detected += len(faces)

            # ── Vehicle Zone Suppression ──
            # Remove faces whose bbox overlaps >50% with any vehicle bbox
            filtered_faces: list[DetectedFace] = []
            for face in faces:
                face_bbox = [int(v) for v in face.bbox]
                in_vehicle_zone = False

                for vbox in vehicle_bboxes:
                    overlap = self._bbox_overlap_ratio(face_bbox, vbox)
                    if overlap > 0.50:
                        in_vehicle_zone = True
                        self._stats.vehicle_suppressed += 1
                        logger.debug(
                            f"[Pipeline] 🚗 Face suppressed — inside vehicle zone "
                            f"(overlap={overlap:.0%}) @ {captured.camera_name}"
                        )
                        break

                if not in_vehicle_zone:
                    filtered_faces.append(face)

            faces = filtered_faces

        if faces:
            # Vectorized Batch Matching: Match all detected faces in one fast BLAS matrix multiplication (<1ms)
            face_embeddings = [f.embedding for f in faces]
            matches: list[Optional[MatchResult]] = await loop.run_in_executor(
                None,
                self.face_engine.match_faces_batch,
                face_embeddings,
                enrolled_snapshot,
                self.config.match_threshold,
            )

            for face, match in zip(faces, matches):
                is_match = bool(match and match.is_match)
                user_name = match.user_name if (is_match and match) else "Unknown"
                user_id = match.user_id if (is_match and match) else None
                conf = match.similarity if (is_match and match) else face.detection_score

                track_bbox = [int(v) for v in face.bbox]

                current_tracks.append({
                    'bbox':        track_bbox,
                    'object_type': 'FACE',
                    'label':       'FACE',
                    'user_name':   user_name,
                    'user_id':     user_id,
                    'confidence':  conf,
                    'is_match':    is_match,
                    'direction':   captured.direction.upper(),
                    'timestamp':   time.time(),
                })

                await self._handle_detected_face(face, match, captured)

            self.latest_tracks[captured.camera_name] = current_tracks
        else:
            # Immediately clear tracks when no face is in view so no stale box lingers
            if vehicle_bboxes:
                # Keep vehicle tracks visible even when no faces
                self.latest_tracks[captured.camera_name] = current_tracks
            else:
                self.latest_tracks[captured.camera_name] = []

    async def _process_frame_faces_only(
        self,
        captured: CapturedFrame,
        enrolled_snapshot: list[dict],
        current_tracks: list[dict],
    ) -> None:
        """Fallback path when YOLO is unavailable — run InsightFace on full frame."""
        loop = asyncio.get_event_loop()
        cam_action_zone = self.action_zones.get(captured.camera_name)
        faces: list[DetectedFace] = await loop.run_in_executor(
            None, self.face_engine.detect_faces, captured.frame, cam_action_zone
        )

        if not faces:
            if captured.camera_name in self.latest_tracks:
                tracks = self.latest_tracks[captured.camera_name]
                if tracks and (time.time() - tracks[0].get('timestamp', 0) > 1.2):
                    self.latest_tracks[captured.camera_name] = []
            return

        self._stats.faces_detected += len(faces)

        face_embeddings = [f.embedding for f in faces]
        matches: list[Optional[MatchResult]] = await loop.run_in_executor(
            None,
            self.face_engine.match_faces_batch,
            face_embeddings,
            enrolled_snapshot,
            self.config.match_threshold,
        )

        for face, match in zip(faces, matches):
            is_match = bool(match and match.is_match)
            user_name = match.user_name if (is_match and match) else "UNKNOWN PERSON"
            user_id = match.user_id if (is_match and match) else None
            conf = match.similarity if (is_match and match) else face.detection_score

            current_tracks.append({
                'bbox':        [int(v) for v in face.bbox],
                'object_type': 'HUMAN',
                'label':       'HUMAN',
                'user_name':   user_name,
                'user_id':     user_id,
                'confidence':  conf,
                'is_match':    is_match,
                'direction':   captured.direction.upper(),
                'timestamp':   time.time(),
            })

            await self._handle_detected_face(face, match, captured)

    async def _handle_detected_face(
        self, face: DetectedFace, match: Optional[MatchResult], captured: CapturedFrame
    ) -> None:
        """Handle a single detected face: match and create attendance event."""
        if match and match.is_match:
            # ─── Known Face: Check cooldown and create event ──────
            if self.db.check_cooldown(
                match.user_id, captured.camera_name, self.config.cooldown_seconds
            ):
                self._stats.cooldown_skips += 1
                return

            snapshot_path, snapshot_data_url = self._encode_snapshot(face, match.user_id, captured)
            # Save high-quality full-frame context photo for admin lightbox
            context_path = self._save_context_snapshot(captured, face)

            # Log locally
            self.db.log_detection(
                user_id=match.user_id,
                user_name=match.user_name,
                camera_name=captured.camera_name,
                direction=captured.direction,
                confidence=match.similarity,
                timestamp=captured.timestamp,
                snapshot_path=snapshot_path,
                context_snapshot_path=context_path,
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
                snapshot_path=snapshot_data_url or snapshot_path,
            )

            self._stats.matches += 1
            logger.info(
                f"[Pipeline] ✅ MATCH: {match.user_name} @ "
                f"{captured.camera_name} ({captured.direction}) — "
                f"{match.similarity:.3f}"
            )

        else:
            # ─── Unknown Face: Deduplicate before logging / pushing ────────
            # Compare embedding against recently seen unknowns on this camera.
            # If cosine similarity > threshold within cooldown window → same person, skip.
            cam = captured.camera_name
            now_ts = captured.timestamp

            # Clean up expired entries
            self._unknown_face_seen.setdefault(cam, [])
            self._unknown_face_seen[cam] = [
                (emb, ts) for emb, ts in self._unknown_face_seen[cam]
                if now_ts - ts < self._unknown_cooldown
            ]

            # Check similarity against all recent unknown faces on this camera
            is_duplicate = False
            try:
                import numpy as _np
                for prev_emb, _ in self._unknown_face_seen[cam]:
                    norm_a = _np.linalg.norm(face.embedding)
                    norm_b = _np.linalg.norm(prev_emb)
                    if norm_a > 0 and norm_b > 0:
                        sim = float(_np.dot(face.embedding, prev_emb) / (norm_a * norm_b))
                        if sim >= self._unknown_sim_threshold:
                            is_duplicate = True
                            break
            except Exception:
                pass

            if is_duplicate:
                self._stats.cooldown_skips += 1
                logger.debug(
                    f"[Pipeline] 🔁 Duplicate unknown face on {cam} — skipping (cooldown)"
                )
                return

            # Not a duplicate — record this embedding and proceed
            self._unknown_face_seen[cam].append((face.embedding.copy(), now_ts))

            snapshot_path, snapshot_data_url = self._encode_snapshot(face, "unknown", captured)
            # Save high-quality full-frame context photo for admin lightbox
            context_path = self._save_context_snapshot(captured, face)

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
                context_snapshot_path=context_path,
            )

            await self.dispatcher.push_unknown_face(
                embedding=face.embedding,
                camera_name=captured.camera_name,
                timestamp=captured.timestamp,
                snapshot_url=snapshot_data_url,
                det_score=face.detection_score,
            )

            self._stats.unknown_faces += 1

    async def _save_body_snapshot(
        self, obj: DetectedObject, captured: CapturedFrame
    ) -> None:
        """Save a person body snapshot (no face detected) for admin review."""
        if not self.config.save_snapshots:
            return
        try:
            x1, y1, x2, y2 = obj.bbox
            body_crop = captured.frame[y1:y2, x1:x2]
            if body_crop.size == 0:
                return
            timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
            date_dir = self.config.snapshot_dir / datetime.now().strftime('%Y-%m-%d')
            date_dir.mkdir(parents=True, exist_ok=True)
            filepath = date_dir / f"body_unknown_{captured.camera_name}_{timestamp_str}.jpg"
            cv2.imwrite(str(filepath), body_crop, [cv2.IMWRITE_JPEG_QUALITY, 80])
        except Exception as e:
            logger.warning(f"[Pipeline] Body snapshot save error: {e}")

    def _encode_snapshot(
        self,
        face: DetectedFace,
        user_id: str,
        captured: CapturedFrame,
    ) -> tuple[Optional[str], Optional[str]]:
        """Save face crop to disk (if enabled) and encode as high-resolution base64 data URL.

        Returns (snapshot_path, snapshot_data_url).
        """
        snapshot_path: Optional[str] = None
        snapshot_data_url: Optional[str] = None

        if face.face_crop is None:
            return snapshot_path, snapshot_data_url

        if self.config.save_snapshots:
            snapshot_path = self._save_snapshot(face.face_crop, user_id, captured.camera_name)

        try:
            crop_h, crop_w = face.face_crop.shape[:2]
            target_dim = 480
            if max(crop_w, crop_h) > target_dim:
                scale = target_dim / float(max(crop_w, crop_h))
                resized = cv2.resize(
                    face.face_crop,
                    (round(crop_w * scale), round(crop_h * scale)),
                    interpolation=cv2.INTER_AREA,
                )
            elif max(crop_w, crop_h) < 320:
                scale = 320 / float(max(crop_w, crop_h))
                resized = cv2.resize(
                    face.face_crop,
                    (round(crop_w * scale), round(crop_h * scale)),
                    interpolation=cv2.INTER_LANCZOS4,
                )
            else:
                resized = face.face_crop

            ret, buf = cv2.imencode('.jpg', resized, [cv2.IMWRITE_JPEG_QUALITY, 95, cv2.IMWRITE_JPEG_OPTIMIZE, 1])
            if ret:
                snapshot_data_url = (
                    f"data:image/jpeg;base64,"
                    f"{base64.b64encode(buf.tobytes()).decode('utf-8')}"
                )
        except Exception as e:
            logger.warning(f"[Pipeline] Snapshot encoding error: {e}")

        return snapshot_path, snapshot_data_url

    def _cleanup_old_snapshots(self) -> None:
        """Purge snapshot files older than snapshot_retention_days."""
        try:
            if not self.config.snapshot_dir.exists():
                return
            cutoff_ts = time.time() - (self.config.snapshot_retention_days * 86400)
            deleted_count = 0
            for p in self.config.snapshot_dir.rglob('*.jpg'):
                if p.is_file() and p.stat().st_mtime < cutoff_ts:
                    try:
                        p.unlink()
                        deleted_count += 1
                    except Exception:
                        pass
            if deleted_count > 0:
                logger.info(f"[Pipeline] Purged {deleted_count} expired snapshot files")
        except Exception as e:
            logger.warning(f"[Pipeline] Snapshot cleanup error: {e}")

    def _refresh_enrolled_cache(self) -> None:
        """Reload enrolled embeddings from local database into memory."""
        self._enrolled = self.db.get_all_embeddings()
        self._last_enrollment_refresh = time.time()
        logger.debug(f"[Pipeline] Refreshed enrolled cache: {len(self._enrolled)} faces")

    def _save_context_snapshot(
        self, captured: CapturedFrame, face: DetectedFace
    ) -> Optional[str]:
        """Save the full camera frame at detection time as a high-quality JPEG.

        Draws a bounding box around the detected face so the admin can
        immediately see which person triggered the event.
        Returns the file path, or None if save_snapshots is disabled.
        """
        if not self.config.save_snapshots:
            return None
        try:
            frame = captured.frame.copy()
            # Draw face bounding box in green
            if face.bbox is not None:
                x1, y1, x2, y2 = [int(v) for v in face.bbox]
                h, w = frame.shape[:2]
                pad = 20
                x1c = max(0, x1 - pad)
                y1c = max(0, y1 - pad)
                x2c = min(w, x2 + pad)
                y2c = min(h, y2 + pad)
                cv2.rectangle(frame, (x1c, y1c), (x2c, y2c), (0, 230, 100), 3)
            timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
            date_dir = self.config.snapshot_dir / datetime.now().strftime('%Y-%m-%d') / 'context'
            date_dir.mkdir(parents=True, exist_ok=True)
            filepath = date_dir / f"ctx_{captured.camera_name}_{timestamp_str}.jpg"
            cv2.imwrite(str(filepath), frame, [cv2.IMWRITE_JPEG_QUALITY, 95, cv2.IMWRITE_JPEG_OPTIMIZE, 1])
            return str(filepath)
        except Exception as e:
            logger.warning(f"[Pipeline] Context snapshot save error: {e}")
            return None

    def _save_snapshot(self, face_crop: np.ndarray, user_id: str, camera_name: str) -> str:
        """Save a high-resolution face crop to disk. Returns the file path."""
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        filename = f"{user_id}_{camera_name}_{timestamp_str}.jpg"
        date_dir = self.config.snapshot_dir / datetime.now().strftime('%Y-%m-%d')
        date_dir.mkdir(parents=True, exist_ok=True)
        filepath = date_dir / filename
        cv2.imwrite(str(filepath), face_crop, [cv2.IMWRITE_JPEG_QUALITY, 92])
        return str(filepath)


    def set_camera_action_zone(
        self,
        camera_name: str,
        polygon: list[list[float]],
        enabled: bool = True,
    ) -> None:
        """Update and persist Action Zone polygon for a camera at runtime."""
        self.db.set_action_zone(camera_name, polygon, enabled)
        if enabled and polygon and len(polygon) >= 3:
            self.action_zones[camera_name] = polygon
        else:
            self.action_zones.pop(camera_name, None)
        logger.info(
            f"[Pipeline] Action Zone updated for camera '{camera_name}' "
            f"(enabled={enabled}, vertices={len(polygon) if polygon else 0})"
        )

    def get_camera_action_zone(self, camera_name: str) -> Optional[dict]:
        """Get action zone configuration for a camera."""
        return self.db.get_action_zone(camera_name)

    def get_stats(self) -> dict:
        """Get current pipeline statistics."""
        queue_stats = self.db.get_queue_stats()
        return {
            'frames_processed':   self._stats.frames_processed,
            'faces_detected':     self._stats.faces_detected,
            'objects_detected':   self._stats.objects_detected,
            'vehicles_detected':  self._stats.vehicles_detected,
            'matches':            self._stats.matches,
            'unknown_faces':      self._stats.unknown_faces,
            'cooldown_skips':     self._stats.cooldown_skips,
            'vehicle_suppressed': self._stats.vehicle_suppressed,
            'errors':             self._stats.errors,
            'enrolled_count':     len(self._enrolled),
            'object_detector_on': self.object_detector.is_ready,
            'queue_pending':      queue_stats.get('pending', 0),
            'queue_failed':       queue_stats.get('failed', 0),
            'cameras':            self.grabber.get_status(),
        }


class PipelineStats:
    """Simple stats counter for the pipeline."""
    def __init__(self):
        self.frames_processed: int = 0
        self.faces_detected: int = 0
        self.objects_detected: int = 0   # YOLO total objects
        self.vehicles_detected: int = 0  # Non-person objects
        self.matches: int = 0
        self.unknown_faces: int = 0
        self.cooldown_skips: int = 0
        self.vehicle_suppressed: int = 0  # Faces suppressed inside vehicle zones
        self.errors: int = 0
        self.started_at: float = time.time()
