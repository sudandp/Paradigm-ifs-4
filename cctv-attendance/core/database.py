"""
CCTV Attendance — Local SQLite Database

Stores face embeddings cache, detection logs, and offline event queue.
This is the edge-local database; cloud sync happens via Supabase API.
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Optional

import numpy as np
from loguru import logger


class LocalDatabase:
    """SQLite database for edge-local storage of face embeddings and event queue."""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: Optional[sqlite3.Connection] = None

    def connect(self) -> None:
        """Initialize database connection and create tables if needed."""
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._create_tables()
        logger.info(f"[DB] Connected to {self.db_path}")

    def close(self) -> None:
        """Close database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        return self._conn

    def _create_tables(self) -> None:
        """Create all required tables."""
        self.conn.executescript("""
            -- Enrolled face embeddings (synced from Supabase users table)
            CREATE TABLE IF NOT EXISTS face_embeddings (
                user_id         TEXT PRIMARY KEY,
                user_name       TEXT NOT NULL,
                biometric_id    TEXT,
                department      TEXT DEFAULT 'General',
                embedding       BLOB NOT NULL,          -- 512-dim float32 numpy array
                photo_url       TEXT,
                organization_id TEXT,
                synced_at       REAL NOT NULL,           -- Unix timestamp of last sync
                is_active       INTEGER DEFAULT 1
            );

            -- Detection event log (local audit trail)
            CREATE TABLE IF NOT EXISTS detection_log (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id         TEXT,                    -- NULL if unknown face
                user_name       TEXT,
                camera_name     TEXT NOT NULL,
                direction       TEXT NOT NULL,            -- 'entry' or 'exit'
                confidence      REAL NOT NULL,
                timestamp       REAL NOT NULL,           -- Unix timestamp
                snapshot_path   TEXT,                     -- Local path to face crop
                context_snapshot_path TEXT,              -- Full-frame context photo path
                pushed_to_cloud INTEGER DEFAULT 0,       -- 1 if successfully synced
                created_at      REAL DEFAULT (strftime('%s', 'now'))
            );

            -- Offline event queue (when internet is down)
            CREATE TABLE IF NOT EXISTS event_queue (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                payload         TEXT NOT NULL,            -- JSON payload to push
                created_at      REAL DEFAULT (strftime('%s', 'now')),
                retry_count     INTEGER DEFAULT 0,
                last_retry_at   REAL,
                status          TEXT DEFAULT 'pending'    -- pending, syncing, failed
            );

            -- Unknown faces queue (for admin enrollment)
            CREATE TABLE IF NOT EXISTS unknown_faces (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                embedding       BLOB NOT NULL,
                snapshot_path   TEXT,
                camera_name     TEXT NOT NULL,
                timestamp       REAL NOT NULL,
                pushed_to_cloud INTEGER DEFAULT 0,
                resolved        INTEGER DEFAULT 0,       -- 1 if admin linked to a user
                created_at      REAL DEFAULT (strftime('%s', 'now'))
            );

            -- Cooldown tracker (prevent duplicate punches within window)
            CREATE TABLE IF NOT EXISTS cooldown_tracker (
                user_id         TEXT NOT NULL,
                camera_name     TEXT NOT NULL,
                last_seen_at    REAL NOT NULL,
                PRIMARY KEY (user_id, camera_name)
            );

            -- Sync metadata
            CREATE TABLE IF NOT EXISTS sync_state (
                key             TEXT PRIMARY KEY,
                value           TEXT,
                updated_at      REAL DEFAULT (strftime('%s', 'now'))
            );

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_detection_timestamp ON detection_log(timestamp);
            CREATE INDEX IF NOT EXISTS idx_detection_user ON detection_log(user_id);
            CREATE INDEX IF NOT EXISTS idx_queue_status ON event_queue(status);
            CREATE INDEX IF NOT EXISTS idx_unknown_resolved ON unknown_faces(resolved);
            CREATE INDEX IF NOT EXISTS idx_cooldown_user ON cooldown_tracker(user_id);
        """)
        self.conn.commit()

    # ─── Face Embeddings ──────────────────────────────────────────────────────

    def upsert_embedding(
        self,
        user_id: str,
        user_name: str,
        embedding: np.ndarray,
        biometric_id: str = '',
        department: str = 'General',
        photo_url: str = '',
        organization_id: str = '',
    ) -> None:
        """Insert or update a face embedding for an enrolled user."""
        self.conn.execute("""
            INSERT INTO face_embeddings (user_id, user_name, biometric_id, department, 
                                         embedding, photo_url, organization_id, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                user_name = excluded.user_name,
                biometric_id = excluded.biometric_id,
                department = excluded.department,
                embedding = excluded.embedding,
                photo_url = excluded.photo_url,
                organization_id = excluded.organization_id,
                synced_at = excluded.synced_at
        """, (user_id, user_name, biometric_id, department,
              embedding.tobytes(), photo_url, organization_id, time.time()))
        self.conn.commit()

    def get_all_embeddings(self) -> list[dict]:
        """Get all active face embeddings for matching."""
        rows = self.conn.execute("""
            SELECT user_id, user_name, biometric_id, department, embedding, photo_url
            FROM face_embeddings
            WHERE is_active = 1
        """).fetchall()

        result = []
        for row in rows:
            emb = np.frombuffer(row['embedding'], dtype=np.float32)
            result.append({
                'user_id': row['user_id'],
                'user_name': row['user_name'],
                'biometric_id': row['biometric_id'],
                'department': row['department'],
                'embedding': emb,
                'photo_url': row['photo_url'],
            })
        return result

    def get_embedding_count(self) -> int:
        """Get total number of enrolled embeddings."""
        row = self.conn.execute("SELECT COUNT(*) as cnt FROM face_embeddings WHERE is_active = 1").fetchone()
        return row['cnt'] if row else 0

    # ─── Cooldown Tracker ─────────────────────────────────────────────────────

    def check_cooldown(self, user_id: str, camera_name: str, cooldown_seconds: int) -> bool:
        """Check if a user is within cooldown period for a camera.
        
        Returns True if the user is still in cooldown (should NOT be re-detected).
        Returns False if cooldown has expired or no record exists.
        """
        row = self.conn.execute("""
            SELECT last_seen_at FROM cooldown_tracker
            WHERE user_id = ? AND camera_name = ?
        """, (user_id, camera_name)).fetchone()

        if not row:
            return False
        
        elapsed = time.time() - row['last_seen_at']
        return elapsed < cooldown_seconds

    def update_cooldown(self, user_id: str, camera_name: str) -> None:
        """Update the cooldown timestamp for a user on a camera."""
        self.conn.execute("""
            INSERT INTO cooldown_tracker (user_id, camera_name, last_seen_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, camera_name) DO UPDATE SET
                last_seen_at = excluded.last_seen_at
        """, (user_id, camera_name, time.time()))
        self.conn.commit()

    def clear_expired_cooldowns(self, cooldown_seconds: int) -> int:
        """Remove expired cooldown entries. Returns count of removed entries."""
        cutoff = time.time() - cooldown_seconds
        cursor = self.conn.execute(
            "DELETE FROM cooldown_tracker WHERE last_seen_at < ?", (cutoff,)
        )
        self.conn.commit()
        return cursor.rowcount

    # ─── Detection Log ────────────────────────────────────────────────────────

    def log_detection(
        self,
        user_id: Optional[str],
        user_name: Optional[str],
        camera_name: str,
        direction: str,
        confidence: float,
        timestamp: float,
        snapshot_path: Optional[str] = None,
        context_snapshot_path: Optional[str] = None,
    ) -> int:
        """Log a face detection event. Returns the log ID."""
        # Add context_snapshot_path column if it doesn't exist yet (migration safety)
        try:
            self.conn.execute("ALTER TABLE detection_log ADD COLUMN context_snapshot_path TEXT")
            self.conn.commit()
        except Exception:
            pass  # Column already exists
        cursor = self.conn.execute("""
            INSERT INTO detection_log (user_id, user_name, camera_name, direction,
                                       confidence, timestamp, snapshot_path, context_snapshot_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, user_name, camera_name, direction, confidence, timestamp,
              snapshot_path, context_snapshot_path))
        self.conn.commit()
        return cursor.lastrowid  # type: ignore

    def get_recent_detections(self, limit: int = 50) -> list[dict]:
        """Get most recent detections for the dashboard."""
        rows = self.conn.execute("""
            SELECT * FROM detection_log
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,)).fetchall()
        return [dict(row) for row in rows]

    def get_today_detections(self) -> list[dict]:
        """Get all detections from today."""
        import datetime
        today_start = datetime.datetime.now().replace(
            hour=0, minute=0, second=0, microsecond=0
        ).timestamp()
        rows = self.conn.execute("""
            SELECT * FROM detection_log
            WHERE timestamp >= ?
            ORDER BY timestamp ASC
        """, (today_start,)).fetchall()
        return [dict(row) for row in rows]

    # ─── Offline Event Queue ──────────────────────────────────────────────────

    def enqueue_event(self, payload: dict) -> int:
        """Add an event to the offline queue for later sync."""
        cursor = self.conn.execute("""
            INSERT INTO event_queue (payload, status)
            VALUES (?, 'pending')
        """, (json.dumps(payload),))
        self.conn.commit()
        return cursor.lastrowid  # type: ignore

    def get_pending_events(self, limit: int = 50) -> list[dict]:
        """Get pending events from the queue for sync."""
        rows = self.conn.execute("""
            SELECT id, payload, retry_count, created_at
            FROM event_queue
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT ?
        """, (limit,)).fetchall()
        return [{'id': r['id'], 'payload': json.loads(r['payload']),
                 'retry_count': r['retry_count'], 'created_at': r['created_at']}
                for r in rows]

    def mark_event_synced(self, event_id: int) -> None:
        """Mark an event as successfully synced (removes from queue)."""
        self.conn.execute("DELETE FROM event_queue WHERE id = ?", (event_id,))
        self.conn.commit()

    def mark_event_failed(self, event_id: int) -> None:
        """Increment retry count for a failed event."""
        self.conn.execute("""
            UPDATE event_queue
            SET retry_count = retry_count + 1,
                last_retry_at = ?,
                status = CASE WHEN retry_count >= 5 THEN 'failed' ELSE 'pending' END
            WHERE id = ?
        """, (time.time(), event_id))
        self.conn.commit()

    def get_queue_stats(self) -> dict:
        """Get queue statistics."""
        row = self.conn.execute("""
            SELECT 
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                COUNT(*) as total
            FROM event_queue
        """).fetchone()
        return dict(row) if row else {'pending': 0, 'failed': 0, 'total': 0}

    # ─── Unknown Faces ────────────────────────────────────────────────────────

    def log_unknown_face(
        self,
        embedding: np.ndarray,
        camera_name: str,
        timestamp: float,
        snapshot_path: Optional[str] = None,
    ) -> int:
        """Log an unknown/unrecognized face for admin review."""
        cursor = self.conn.execute("""
            INSERT INTO unknown_faces (embedding, camera_name, timestamp, snapshot_path)
            VALUES (?, ?, ?, ?)
        """, (embedding.tobytes(), camera_name, timestamp, snapshot_path))
        self.conn.commit()
        return cursor.lastrowid  # type: ignore

    # ─── Sync State ───────────────────────────────────────────────────────────

    def get_sync_state(self, key: str) -> Optional[str]:
        """Get a sync state value."""
        row = self.conn.execute(
            "SELECT value FROM sync_state WHERE key = ?", (key,)
        ).fetchone()
        return row['value'] if row else None

    def set_sync_state(self, key: str, value: str) -> None:
        """Set a sync state value."""
        self.conn.execute("""
            INSERT INTO sync_state (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
        """, (key, value, time.time()))
        self.conn.commit()
