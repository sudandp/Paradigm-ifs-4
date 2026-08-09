"""
CCTV Attendance — Event Dispatcher

Pushes attendance events to Supabase cloud. Handles:
- Real-time push when online
- Offline queue with retry logic
- Snapshot upload to Supabase Storage
- Face embedding sync (cloud → edge)
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import aiohttp
import numpy as np
from loguru import logger

from .config import AppConfig
from .database import LocalDatabase


class EventDispatcher:
    """Handles pushing CCTV attendance events to Supabase cloud.
    
    Features:
    - Async HTTP push with timeout and retry
    - Offline queue fallback when cloud is unreachable
    - Periodic queue drain for buffered events
    - Snapshot upload to Supabase Storage
    """

    def __init__(self, config: AppConfig, db: LocalDatabase):
        self.config = config
        self.db = db
        self._session: Optional[aiohttp.ClientSession] = None
        self._cloud_available = False

    async def initialize(self) -> None:
        """Create HTTP session for cloud communication."""
        if not self.config.cloud_enabled:
            logger.warning("[Dispatcher] Cloud sync disabled — no Supabase credentials")
            return

        self._session = aiohttp.ClientSession(
            headers={
                'Content-Type': 'application/json',
                'apikey': self.config.supabase_service_role_key,
                'Authorization': f'Bearer {self.config.supabase_service_role_key}',
                'Prefer': 'return=representation',
            },
            timeout=aiohttp.ClientTimeout(total=15),
        )
        
        # Test connectivity
        await self._check_cloud()

    async def close(self) -> None:
        """Close HTTP session."""
        if self._session:
            await self._session.close()
            self._session = None

    async def _check_cloud(self) -> bool:
        """Check if Supabase is reachable."""
        if not self._session:
            return False
        try:
            url = f"{self.config.supabase_url}/rest/v1/"
            async with self._session.get(url) as resp:
                self._cloud_available = resp.status < 500
                return self._cloud_available
        except Exception:
            self._cloud_available = False
            return False

    @staticmethod
    def _get_local_ip() -> str:
        """Auto-detect the machine's LAN IP address."""
        import socket
        try:
            # Connect to an external host to discover the outbound LAN interface
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(('8.8.8.8', 80))
                return s.getsockname()[0]
        except Exception:
            return '127.0.0.1'

    async def send_heartbeat(self, cameras: list[dict]) -> bool:
        """Send device heartbeat to Supabase cctv_devices table via UPSERT."""
        if not self._session or not self.config.cloud_enabled:
            return False
        try:
            url = f"{self.config.supabase_url}/rest/v1/cctv_devices?on_conflict=edge_device_id"
            payload = {
                'edge_device_id': self.config.edge_device_id,
                'site_name': 'Main Gate Site',
                'location_name': 'Main Entrance',
                'status': 'online',
                'last_seen': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'cameras': cameras,
                'match_threshold': self.config.match_threshold,
                'cooldown_seconds': self.config.cooldown_seconds,
                'is_active': True,
                'server_host': self._get_local_ip(),
                'admin_port': 4100,
            }
            headers = {
                'Prefer': 'resolution=merge-duplicates,return=representation'
            }
            async with self._session.post(url, json=payload, headers=headers) as resp:
                if resp.status < 400:
                    logger.info(f"[Dispatcher] 🟢 Heartbeat sent — device online in cloud ({self.config.edge_device_id})")
                    return True
                else:
                    body = await resp.text()
                    logger.warning(f"[Dispatcher] Heartbeat POST failed ({resp.status}): {body}")
                    return False
        except Exception as e:
            logger.warning(f"[Dispatcher] Heartbeat update failed: {e}")
            return False

    async def push_attendance_event(
        self,
        user_id: str,
        user_name: str,
        camera_name: str,
        direction: str,
        confidence: float,
        timestamp: float,
        snapshot_path: Optional[str] = None,
    ) -> bool:
        """Push a single attendance event to Supabase.
        
        If cloud is unavailable, the event is queued locally for later sync.
        
        Args:
            user_id: Supabase user UUID
            user_name: Employee name
            camera_name: Which camera detected them
            direction: 'entry' or 'exit'
            confidence: Match confidence (0.0 - 1.0)
            timestamp: Unix timestamp of detection
            snapshot_path: Optional local path to face snapshot
            
        Returns:
            True if event was pushed (or queued) successfully
        """
        # Map direction to attendance event type
        event_type = 'punch-in' if direction == 'entry' else 'punch-out'
        
        # Build the attendance event payload
        dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        
        payload = {
            'user_id': user_id,
            'timestamp': dt.isoformat(),
            'type': event_type,
            'device_id': self.config.edge_device_id,
            'location_name': f'CCTV: {camera_name}',
            'source': 'cctv',
        }

        # Also build a CCTV-specific log entry
        cctv_log_payload = {
            'user_id': user_id,
            'user_name': user_name,
            'camera_name': camera_name,
            'direction': direction,
            'confidence': round(confidence, 4),
            'detected_at': dt.isoformat(),
            'edge_device_id': self.config.edge_device_id,
        }

        # Try to push directly to cloud
        if self._cloud_available and self._session:
            success = await self._push_to_cloud(payload, cctv_log_payload)
            if success:
                return True

        # Fallback: queue locally
        logger.info(f"[Dispatcher] Queuing event for {user_name} (offline)")
        self.db.enqueue_event({
            'attendance_event': payload,
            'cctv_log': cctv_log_payload,
        })
        return True

    async def _push_to_cloud(self, attendance_payload: dict, cctv_log_payload: dict) -> bool:
        """Push event directly to Supabase REST API."""
        if not self._session:
            return False

        try:
            # 1. Insert into attendance_events
            url = f"{self.config.supabase_url}/rest/v1/attendance_events"
            async with self._session.post(url, json=attendance_payload) as resp:
                if resp.status == 409:
                    # Duplicate — already exists (idempotent)
                    logger.debug(f"[Dispatcher] Duplicate event ignored for {attendance_payload.get('user_id')}")
                    return True
                elif resp.status >= 400:
                    body = await resp.text()
                    logger.warning(f"[Dispatcher] attendance_events insert failed ({resp.status}): {body}")
                    return False

            # 2. Insert into cctv_attendance_logs (audit trail)
            url = f"{self.config.supabase_url}/rest/v1/cctv_attendance_logs"
            async with self._session.post(url, json=cctv_log_payload) as resp:
                if resp.status >= 400:
                    body = await resp.text()
                    logger.warning(f"[Dispatcher] cctv_attendance_logs insert failed ({resp.status}): {body}")
                    # Non-critical — attendance event was already inserted

            logger.info(
                f"[Dispatcher] ✅ Pushed: {cctv_log_payload.get('user_name')} "
                f"({attendance_payload.get('type')}) via {cctv_log_payload.get('camera_name')}"
            )
            return True

        except asyncio.TimeoutError:
            logger.warning("[Dispatcher] Cloud push timed out")
            self._cloud_available = False
            return False
        except Exception as e:
            logger.error(f"[Dispatcher] Cloud push error: {e}")
            self._cloud_available = False
            return False

    async def drain_queue(self) -> int:
        """Process pending events from the offline queue.
        
        Returns the number of events successfully synced.
        """
        if not self._cloud_available:
            # Re-check connectivity
            if not await self._check_cloud():
                return 0

        pending = self.db.get_pending_events(limit=50)
        if not pending:
            return 0

        synced = 0
        for event in pending:
            payload = event['payload']
            success = await self._push_to_cloud(
                payload.get('attendance_event', {}),
                payload.get('cctv_log', {}),
            )
            if success:
                self.db.mark_event_synced(event['id'])
                synced += 1
            else:
                self.db.mark_event_failed(event['id'])
                break  # Stop on first failure to preserve ordering

        if synced > 0:
            logger.info(f"[Dispatcher] Drained {synced}/{len(pending)} events from offline queue")
        
        return synced

    async def sync_embeddings(self) -> int:
        """Sync face embeddings from Supabase to local SQLite.
        
        Fetches all users with face_embedding_512 and updates local cache.
        Returns the number of embeddings synced.
        """
        if not self._session or not self.config.cloud_enabled:
            return 0

        try:
            # Fetch users with 512-dim embeddings
            url = (
                f"{self.config.supabase_url}/rest/v1/users"
                f"?select=id,name,biometric_id,organization_id,face_embedding_512"
                f"&face_embedding_512=not.is.null"
            )
            async with self._session.get(url) as resp:
                if resp.status != 200:
                    logger.warning(f"[Dispatcher] Embedding sync failed: {resp.status}")
                    return 0
                
                users = await resp.json()

            count = 0
            for user in users:
                emb_data = user.get('face_embedding_512')
                if not emb_data:
                    continue
                
                # Convert from JSON array to numpy
                embedding = np.array(emb_data, dtype=np.float32)
                if embedding.shape != (512,):
                    logger.warning(f"[Dispatcher] Invalid embedding shape for {user['id']}: {embedding.shape}")
                    continue

                self.db.upsert_embedding(
                    user_id=user['id'],
                    user_name=user.get('name', 'Unknown'),
                    embedding=embedding,
                    biometric_id=user.get('biometric_id', ''),
                    organization_id=user.get('organization_id', ''),
                )
                count += 1

            logger.info(f"[Dispatcher] Synced {count} face embeddings from cloud")
            self.db.set_sync_state('last_embedding_sync', str(time.time()))
            return count

        except Exception as e:
            logger.error(f"[Dispatcher] Embedding sync error: {e}")
            return 0

    async def push_unknown_face(
        self,
        embedding: np.ndarray,
        camera_name: str,
        timestamp: float,
        snapshot_url: Optional[str] = None,
    ) -> bool:
        """Push an unknown face to the cloud enrollment queue."""
        if not self._session or not self.config.cloud_enabled:
            return False

        try:
            payload = {
                'embedding': embedding.tolist(),
                'camera_name': camera_name,
                'detected_at': datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat(),
                'edge_device_id': self.config.edge_device_id,
                'snapshot_url': snapshot_url,
                'status': 'pending',
            }
            
            url = f"{self.config.supabase_url}/rest/v1/cctv_enrollment_queue"
            async with self._session.post(url, json=payload) as resp:
                if resp.status < 400:
                    logger.info(f"[Dispatcher] Unknown face pushed to enrollment queue")
                    return True
                else:
                    body = await resp.text()
                    logger.warning(f"[Dispatcher] Unknown face push failed: {body}")
                    return False

        except Exception as e:
            logger.error(f"[Dispatcher] Unknown face push error: {e}")
            return False
