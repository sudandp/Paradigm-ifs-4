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
        self.last_error = ""
        self.active_rtsp_url = self.config.rtsp_url
        self.connection_attempts = 0

    @property
    def is_connected(self) -> bool:
        return self._cap is not None and self._cap.isOpened()

    @property
    def frame_count(self) -> int:
        return self._frame_count

    def _get_candidate_urls(self) -> list[str]:
        """Generate alternative RTSP URLs to try if default fails."""
        import urllib.parse
        base = self.config.rtsp_url
        candidates = [base]

        # Clean double-escaped %%40 if present
        if '%%40' in base:
            candidates.append(base.replace('%%40', '%40'))
            candidates.append(base.replace('%%40', '@'))

        # Alternative: %40 <-> raw @
        if '%40' in base:
            candidates.append(base.replace('%40', '@'))

        # Alternative: Subtype swapping (subtype=0 main 1080p, subtype=1 sub 480p)
        current = list(candidates)
        for cand in current:
            if 'subtype=0' in cand:
                candidates.append(cand.replace('subtype=0', 'subtype=1'))
            elif 'subtype=1' in cand:
                candidates.append(cand.replace('subtype=1', 'subtype=0'))

        # Alternative: Alternate confirmed camera IP (swap .150 <-> .149)
        current = list(candidates)
        for cand in current:
            if '192.168.51.150' in cand:
                candidates.append(cand.replace('192.168.51.150', '192.168.51.149'))
            elif '192.168.51.149' in cand:
                candidates.append(cand.replace('192.168.51.149', '192.168.51.150'))

        # Deduplicate while preserving order
        seen = set()
        deduped = []
        for c in candidates:
            if c not in seen:
                seen.add(c)
                deduped.append(c)
        return deduped

    def _probe_host(self, host: str, port: int = 554, timeout: float = 0.4) -> bool:
        """Non-blocking TCP probe. Returns True if host:port responds."""
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(timeout)
            ok = s.connect_ex((host, port)) == 0
            s.close()
            return ok
        except Exception:
            return False

    def _scan_fallback_ips(self, parsed_url, nvr_host: str) -> list[str]:
        """
        When NVR is unreachable, scan 192.168.51.149-165 in parallel (400ms probes)
        and build RTSP candidate URLs for any host with port 554 open.
        """
        import threading, urllib.parse
        user_info = f"{parsed_url.username}:{parsed_url.password}" if parsed_url.username else "admin:admin"
        base = self.config.rtsp_url
        live: list[str] = []
        lock = threading.Lock()

        def probe(ip: str) -> None:
            if self._probe_host(ip):
                with lock:
                    live.append(ip)

        threads = [threading.Thread(target=probe, args=(f"192.168.51.{i}",), daemon=True) for i in range(149, 166)]
        for t in threads: t.start()
        for t in threads: t.join(timeout=1.5)

        candidates: list[str] = []
        for cam_ip in live:
            fallback_base = base.replace(nvr_host, cam_ip)
            candidates.append(fallback_base)
            if 'subtype=0' in fallback_base:
                candidates.append(fallback_base.replace('subtype=0', 'subtype=1'))
            candidates += [
                f"rtsp://{user_info}@{cam_ip}:554/Streaming/Channels/101",
                f"rtsp://{user_info}@{cam_ip}:554/h264/ch1/main/av_stream",
            ]
            logger.info(f"[Camera:{self.config.name}] Auto-discovered fallback camera at {cam_ip}:554")
        return candidates

    def connect(self) -> bool:
        """Open RTSP connection with NVR first, then auto-discover fallback IPs."""
        import os
        import urllib.parse

        self.connection_attempts += 1
        logger.info(f"[Camera:{self.config.name}] Connecting (attempt {self.connection_attempts})...")

        parsed = urllib.parse.urlparse(self.config.rtsp_url)
        nvr_host = parsed.hostname or '192.168.51.150'
        port = parsed.port or 554

        # Build candidate list: target host first, fallback direct IPs if unreachable
        if self._probe_host(nvr_host, port, timeout=2.0):
            self.last_error = f"TCP {nvr_host}:{port} open, negotiating RTSP..."
            candidate_urls = self._get_candidate_urls()
        else:
            self.last_error = f"Socket error: {nvr_host}:{port} unreachable — scanning LAN for cameras..."
            logger.warning(f"[Camera:{self.config.name}] {self.last_error}")
            candidate_urls = self._scan_fallback_ips(parsed, nvr_host)
            if not candidate_urls:
                logger.error(f"[Camera:{self.config.name}] No reachable RTSP hosts found on 192.168.51.x")
                return False

        for cand_url in candidate_urls:
            for transport in ['tcp', 'udp']:
                try:
                    os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = (
                        f'rtsp_transport;{transport}|'
                        'fflags;nobuffer|'
                        'flags;low_delay|'
                        'max_delay;100000|'
                        'reorder_queue_size;0|'
                        'buffer_size;102400|'
                        'timeout;4000000'
                    )
                    cap = cv2.VideoCapture(cand_url, cv2.CAP_FFMPEG)
                    if cap and cap.isOpened():
                        ret, test_frame = cap.read()
                        if ret and test_frame is not None:
                            self._cap = cap
                            self.active_rtsp_url = cand_url
                            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                            width = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                            height = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                            native_fps = self._cap.get(cv2.CAP_PROP_FPS)
                            logger.info(
                                f"[Camera:{self.config.name}] Connected via {transport.upper()} — "
                                f"{width}x{height} @ {native_fps:.1f} FPS ({cand_url.split('@')[-1]})"
                            )
                            self._consecutive_failures = 0
                            self.last_error = "Connected"
                            return True
                        else:
                            cap.release()
                except Exception as e:
                    self.last_error = f"Error ({transport}): {e}"

        logger.error(f"[Camera:{self.config.name}] Failed to connect to any candidate RTSP stream")
        return False

    def disconnect(self) -> None:
        """Close RTSP connection."""
        if self._cap:
            self._cap.release()
            self._cap = None
        logger.info(f"[Camera:{self.config.name}] Disconnected")

    def start(self) -> None:
        """Start background frame capture thread. Always launches thread to auto-reconnect."""
        if self._running:
            return

        # Attempt initial quick connect
        if not self.is_connected:
            self.connect()

        # Always start background thread so auto-reconnect continuously runs
        self._running = True
        self._thread = threading.Thread(
            target=self._capture_loop,
            name=f"cam-{self.config.name}",
            daemon=True,
        )
        self._thread.start()
        logger.info(f"[Camera:{self.config.name}] Background capture thread active")

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
        """High-speed real-time capture loop:
        Constantly drains the RTSP buffer so OpenCV is ALWAYS reading the current live frame (0ms lag).
        """
        while self._running:
            try:
                if not self.is_connected or self._cap is None:
                    logger.warning(f"[Camera:{self.config.name}] Disconnected, attempting reconnect...")
                    time.sleep(5.0)
                    if not self.connect():
                        time.sleep(5.0)
                        continue

                cap = self._cap
                if cap is None:
                    continue

                # Read live frame directly
                ret, frame = cap.read()
                if not ret or frame is None:
                    self._consecutive_failures += 1
                    if self._consecutive_failures >= self._max_failures:
                        logger.warning(
                            f"[Camera:{self.config.name}] {self._max_failures} consecutive "
                            f"read failures — reconnecting"
                        )
                        self.disconnect()
                        time.sleep(2.0)
                    time.sleep(0.01)
                    continue

                self._consecutive_failures = 0
                self._frame_count += 1
                now = time.time()

                # Overwrite immediately with the freshest live frame
                with self._frame_lock:
                    self._latest_frame = frame
                    self._last_frame_time = now

                # Yield thread briefly without accumulating buffer
                time.sleep(0.001)

            except Exception as e:
                logger.error(f"[Camera:{self.config.name}] Capture error: {e}")
                time.sleep(0.5)

        logger.info(f"[Camera:{self.config.name}] Capture loop ended")


class MultiCameraGrabber:
    """Manages multiple camera streams and provides frames for processing.
    
    Coordinates frame capture from all configured cameras and provides
    a unified interface for the face recognition pipeline.
    """

    def __init__(self, cameras: list[CameraConfig], target_fps: int = 30):
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
