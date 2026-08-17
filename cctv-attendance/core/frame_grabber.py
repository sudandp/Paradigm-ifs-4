"""
CCTV Attendance — Frame Grabber

Connects to CCTV cameras via RTSP and captures frames at a configurable FPS.
Supports multi-camera concurrent capture using threading.
Handles reconnection, timeouts, and frame quality validation.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from queue import Queue, Full
from typing import Callable, Optional

import cv2
import numpy as np
from loguru import logger

from .config import CameraConfig


@dataclass
class CapturedFrame:
    """A single captured frame from a camera."""
    frame: np.ndarray           # BGR image array
    camera_name: str
    direction: str              # 'entry' or 'exit'
    timestamp: float            # Unix timestamp
    frame_number: int


class CameraStream:
    """Manages RTSP connection and frame capture for a single camera.
    
    Uses a background thread to continuously read frames from the RTSP stream.
    Only the latest frame is kept to avoid memory buildup.
    """

    def __init__(self, config: CameraConfig, target_fps: int = 25):
        self.config = config
        self.target_fps = target_fps
        self._cap: Optional[cv2.VideoCapture] = None
        self._latest_frame: Optional[np.ndarray] = None
        self._frame_lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._frame_count = 0
        self._consecutive_failures = 0
        self._max_failures = 30  # Reconnect after this many consecutive read failures
        self._last_frame_time = 0.0

    @property
    def is_connected(self) -> bool:
        return self._cap is not None and self._cap.isOpened()

    @property
    def frame_count(self) -> int:
        return self._frame_count

    def connect(self) -> bool:
        """Open RTSP connection to the camera."""
        try:
            logger.info(f"[Camera:{self.config.name}] Connecting to RTSP stream...")
            
            # Force TCP transport — prevents the 30-failure / 2-min disconnect cycle
            # caused by UDP packet loss on the local network.
            import os
            os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;tcp|timeout;10000000'

            # OpenCV RTSP options for stability
            self._cap = cv2.VideoCapture(self.config.rtsp_url, cv2.CAP_FFMPEG)
            
            if not self._cap or not self._cap.isOpened():
                logger.error(f"[Camera:{self.config.name}] Failed to open RTSP stream")
                return False

            # Set buffer size to minimum to reduce latency
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            # Try to set receive timeout (may not work with all backends)
            self._cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)
            self._cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)


            # Read camera properties
            width = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            native_fps = self._cap.get(cv2.CAP_PROP_FPS)

            logger.info(
                f"[Camera:{self.config.name}] Connected — "
                f"{width}x{height} @ {native_fps:.1f} FPS (processing at {self.target_fps} FPS)"
            )
            
            self._consecutive_failures = 0
            return True

        except Exception as e:
            logger.error(f"[Camera:{self.config.name}] Connection error: {e}")
            return False

    def disconnect(self) -> None:
        """Close RTSP connection."""
        if self._cap:
            self._cap.release()
            self._cap = None
        logger.info(f"[Camera:{self.config.name}] Disconnected")

    def start(self) -> None:
        """Start background frame capture thread."""
        if self._running:
            return
        
        if not self.is_connected:
            if not self.connect():
                logger.error(f"[Camera:{self.config.name}] Cannot start — connection failed")
                return

        self._running = True
        self._thread = threading.Thread(
            target=self._capture_loop,
            name=f"cam-{self.config.name}",
            daemon=True,
        )
        self._thread.start()
        logger.info(f"[Camera:{self.config.name}] Capture thread started")

    def stop(self) -> None:
        """Stop background frame capture."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5.0)
            self._thread = None
        self.disconnect()

    def get_frame(self) -> Optional[CapturedFrame]:
        """Get the latest captured frame (non-blocking).
        
        Returns None if no frame is available.
        """
        with self._frame_lock:
            if self._latest_frame is None:
                return None
            frame = self._latest_frame.copy()
            timestamp = self._last_frame_time
        
        return CapturedFrame(
            frame=frame,
            camera_name=self.config.name,
            direction=self.config.direction,
            timestamp=timestamp,
            frame_number=self._frame_count,
        )

    def _capture_loop(self) -> None:
        """Background loop that continuously reads frames from RTSP."""
        frame_interval = 1.0 / self.target_fps

        while self._running:
            try:
                if not self.is_connected:
                    logger.warning(f"[Camera:{self.config.name}] Disconnected, attempting reconnect...")
                    time.sleep(5.0)
                    if not self.connect():
                        time.sleep(10.0)
                        continue

                ret, frame = self._cap.read()  # type: ignore

                if not ret or frame is None:
                    self._consecutive_failures += 1
                    if self._consecutive_failures >= self._max_failures:
                        logger.warning(
                            f"[Camera:{self.config.name}] {self._max_failures} consecutive "
                            f"read failures — reconnecting"
                        )
                        self.disconnect()
                        time.sleep(2.0)
                    continue

                self._consecutive_failures = 0
                self._frame_count += 1

                # Store latest frame (overwriting previous to avoid memory buildup)
                with self._frame_lock:
                    self._latest_frame = frame
                    self._last_frame_time = time.time()

                # Throttle to target FPS
                time.sleep(frame_interval)

            except Exception as e:
                logger.error(f"[Camera:{self.config.name}] Capture error: {e}")
                time.sleep(1.0)

        logger.info(f"[Camera:{self.config.name}] Capture loop ended")


class MultiCameraGrabber:
    """Manages multiple camera streams and provides frames for processing.
    
    Coordinates frame capture from all configured cameras and provides
    a unified interface for the face recognition pipeline.
    """

    def __init__(self, cameras: list[CameraConfig], target_fps: int = 25):
        self.streams: dict[str, CameraStream] = {}
        for cam in cameras:
            if cam.enabled:
                self.streams[cam.name] = CameraStream(cam, target_fps)

    def start_all(self) -> dict[str, bool]:
        """Start all camera streams. Returns status per camera."""
        status = {}
        for name, stream in self.streams.items():
            try:
                stream.start()
                status[name] = stream.is_connected
            except Exception as e:
                logger.error(f"[MultiCam] Failed to start {name}: {e}")
                status[name] = False
        
        connected = sum(1 for v in status.values() if v)
        logger.info(f"[MultiCam] Started {connected}/{len(self.streams)} cameras")
        return status

    def stop_all(self) -> None:
        """Stop all camera streams."""
        for name, stream in self.streams.items():
            try:
                stream.stop()
            except Exception as e:
                logger.error(f"[MultiCam] Error stopping {name}: {e}")
        logger.info("[MultiCam] All cameras stopped")

    def get_all_frames(self) -> list[CapturedFrame]:
        """Get the latest frame from each camera.
        
        Returns a list of frames (one per camera that has a frame available).
        """
        frames = []
        for name, stream in self.streams.items():
            frame = stream.get_frame()
            if frame is not None:
                frames.append(frame)
        return frames

    def get_status(self) -> dict[str, dict]:
        """Get status of all cameras."""
        return {
            name: {
                'connected': stream.is_connected,
                'direction': stream.config.direction,
                'frame_count': stream.frame_count,
                'rtsp_url': _mask_rtsp_url(stream.config.rtsp_url),
            }
            for name, stream in self.streams.items()
        }


def _mask_rtsp_url(url: str) -> str:
    """Mask password in RTSP URL for display."""
    # rtsp://admin:password@192.168.1.64:554/... → rtsp://admin:***@192.168.1.64:554/...
    if '@' in url and ':' in url:
        try:
            protocol, rest = url.split('://', 1)
            creds, host = rest.split('@', 1)
            user, _pwd = creds.split(':', 1)
            return f"{protocol}://{user}:***@{host}"
        except ValueError:
            pass
    return url
