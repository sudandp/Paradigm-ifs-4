"""
CCTV Attendance Edge Server — Configuration Module

Loads and validates configuration from environment variables.
Uses pydantic-settings for type-safe config with validation.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from loguru import logger


# ─── Camera Configuration ────────────────────────────────────────────────────

@dataclass
class CameraConfig:
    """Configuration for a single CCTV camera."""
    name: str                           # Human-readable name e.g. 'gate_a_entry'
    rtsp_url: str                       # RTSP stream URL
    direction: Literal['entry', 'exit'] # Whether this camera watches entries or exits
    enabled: bool = True

    @staticmethod
    def parse_from_env(cameras_str: str) -> list['CameraConfig']:
        """Parse comma-separated camera configs from env var.
        
        Format: name|rtsp_url|direction, ...
        Example: gate_a_entry|rtsp://admin:pass@192.168.1.64:554/...|entry
        """
        cameras = []
        if not cameras_str:
            return cameras

        for cam_str in cameras_str.split(','):
            cam_str = cam_str.strip()
            if not cam_str:
                continue
            parts = cam_str.split('|')
            if len(parts) < 3:
                logger.warning(f"Skipping malformed camera config: {cam_str}")
                continue
            
            name = parts[0].strip()
            rtsp_url = parts[1].strip()
            direction = parts[2].strip().lower()
            
            if direction not in ('entry', 'exit'):
                logger.warning(f"Invalid direction '{direction}' for camera '{name}', defaulting to 'entry'")
                direction = 'entry'
            
            cameras.append(CameraConfig(
                name=name,
                rtsp_url=rtsp_url,
                direction=direction,  # type: ignore
            ))
        
        return cameras


# ─── Main Configuration ──────────────────────────────────────────────────────

@dataclass
class AppConfig:
    """Main application configuration. Loaded from .env file."""
    
    # --- Supabase ---
    supabase_url: str = ''
    supabase_service_role_key: str = ''
    supabase_anon_key: str = ''
    
    # --- Device Identity ---
    edge_device_id: str = 'edge-server-default'
    edge_device_secret: str = ''
    
    # --- Cameras ---
    cameras: list[CameraConfig] = field(default_factory=list)
    
    # --- Recognition ---
    match_threshold: float = 0.45       # Cosine similarity threshold
    min_detection_confidence: float = 0.5
    cooldown_seconds: int = 300         # 5-minute cooldown per person
    processing_fps: int = 3             # Frames to process per second
    
    # --- Local Server ---
    admin_port: int = 4100
    log_level: str = 'INFO'
    
    # --- Snapshots ---
    save_snapshots: bool = True
    snapshot_retention_days: int = 7
    snapshot_dir: Path = Path('./snapshots')
    
    # --- Offline Queue ---
    max_offline_queue_size: int = 1000
    
    # --- Paths ---
    db_path: Path = Path('./data/cctv_attendance.db')
    models_dir: Path = Path('./models')

    @staticmethod
    def load() -> 'AppConfig':
        """Load configuration from .env file and environment variables."""
        # Look for .env in the cctv-attendance directory
        env_path = Path(__file__).parent.parent / '.env'
        if env_path.exists():
            load_dotenv(env_path)
            logger.info(f"Loaded .env from {env_path}")
        else:
            load_dotenv()  # Try default locations
            logger.warning(f"No .env found at {env_path}, using system environment")

        config = AppConfig(
            supabase_url=os.getenv('SUPABASE_URL', ''),
            supabase_service_role_key=os.getenv('SUPABASE_SERVICE_ROLE_KEY', ''),
            supabase_anon_key=os.getenv('SUPABASE_ANON_KEY', ''),
            edge_device_id=os.getenv('EDGE_DEVICE_ID', 'edge-server-default'),
            edge_device_secret=os.getenv('EDGE_DEVICE_SECRET', ''),
            cameras=CameraConfig.parse_from_env(os.getenv('CAMERAS', '')),
            match_threshold=float(os.getenv('MATCH_THRESHOLD', '0.45')),
            min_detection_confidence=float(os.getenv('MIN_DETECTION_CONFIDENCE', '0.5')),
            cooldown_seconds=int(os.getenv('COOLDOWN_SECONDS', '300')),
            processing_fps=int(os.getenv('PROCESSING_FPS', '3')),
            admin_port=int(os.getenv('ADMIN_PORT', '4100')),
            log_level=os.getenv('LOG_LEVEL', 'INFO'),
            save_snapshots=os.getenv('SAVE_SNAPSHOTS', 'true').lower() == 'true',
            snapshot_retention_days=int(os.getenv('SNAPSHOT_RETENTION_DAYS', '7')),
            snapshot_dir=Path(os.getenv('SNAPSHOT_DIR', './snapshots')),
            max_offline_queue_size=int(os.getenv('MAX_OFFLINE_QUEUE_SIZE', '1000')),
        )

        config.validate()
        return config

    def validate(self) -> None:
        """Validate configuration values and warn about missing required fields."""
        warnings = []
        errors = []

        if not self.supabase_url:
            warnings.append("SUPABASE_URL not set — cloud sync disabled")
        if not self.supabase_service_role_key:
            warnings.append("SUPABASE_SERVICE_ROLE_KEY not set — cloud sync disabled")
        if not self.cameras:
            warnings.append("No cameras configured — set CAMERAS in .env. Pipeline will not start, but admin API remains available for enrollment.")
        if not (0.0 <= self.match_threshold <= 1.0):
            errors.append(f"MATCH_THRESHOLD must be 0.0-1.0, got {self.match_threshold}")
        if self.processing_fps < 1 or self.processing_fps > 30:
            warnings.append(f"PROCESSING_FPS={self.processing_fps} outside recommended range (1-10 for CPU)")

        for w in warnings:
            logger.warning(f"[Config] {w}")
        for e in errors:
            logger.error(f"[Config] {e}")
        
        if errors:
            raise ValueError(f"Configuration errors: {'; '.join(errors)}")

    @property
    def cloud_enabled(self) -> bool:
        """Whether Supabase cloud sync is configured."""
        return bool(self.supabase_url and self.supabase_service_role_key)
