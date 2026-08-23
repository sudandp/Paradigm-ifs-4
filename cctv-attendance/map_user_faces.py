#!/usr/bin/env python3
"""
==============================================================================
  CCTV Attendance — User Face Mapping & Embedding Batch Pipeline
==============================================================================
This script reads profile photos of employees from Supabase, extracts 512-dim
ArcFace embeddings using InsightFace (buffalo_l), and saves the embeddings
into `public.users.face_embedding_512` in Supabase PostgreSQL.

It also syncs the local CCTV edge database so cameras recognize users immediately.

Usage:
  python map_user_faces.py               # Map all unmapped users
  python map_user_faces.py --force       # Re-map all users (even already mapped)
  python map_user_faces.py --limit 10    # Map first 10 users for testing
  python map_user_faces.py --dry-run     # Test extraction without writing to DB
"""

from __future__ import annotations

import argparse
import base64
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import requests
from dotenv import load_dotenv
from loguru import logger

# Add parent and local dir to sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from core.config import AppConfig
from core.database import LocalDatabase
from core.dispatcher import EventDispatcher
from core.face_engine import FaceEngine


def upgrade_photo_resolution_if_needed(url: str) -> str:
    """If the URL is a low-res Google avatar (s96-c), upgrade to HD (s512-c)."""
    if not url:
        return url
    if "googleusercontent.com" in url:
        # Replace =s96-c or =s64 or similar with =s512-c
        url = re.sub(r"=s\d+(-c)?", "=s512-c", url)
    return url


def resolve_photo_bytes(photo_url: str, supabase_url: str, service_role_key: str) -> Optional[bytes]:
    """Download or decode photo bytes from various URL formats."""
    if not photo_url or not isinstance(photo_url, str):
        return None

    photo_url = upgrade_photo_resolution_if_needed(photo_url.strip())

    # 1. Base64 Data URL
    if photo_url.startswith("data:image/"):
        try:
            _, b64_data = photo_url.split(",", 1)
            return base64.b64decode(b64_data)
        except Exception as e:
            logger.warning(f"Failed to decode base64 photo: {e}")
            return None

    # 2. Relative API / Storage URL (e.g. /api/view-file/avatars/... or avatars/...)
    fetch_url = photo_url
    headers = {}

    if photo_url.startswith("/api/view-file/"):
        rel_path = photo_url.replace("/api/view-file/", "")
        fetch_url = f"{supabase_url.rstrip('/')}/storage/v1/object/authenticated/{rel_path}"
        headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        }
    elif photo_url.startswith("http://") or photo_url.startswith("https://"):
        fetch_url = photo_url
        if supabase_url and supabase_url in photo_url:
            headers = {
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
            }
    else:
        # Assume relative storage path
        clean_path = photo_url.lstrip("/")
        fetch_url = f"{supabase_url.rstrip('/')}/storage/v1/object/authenticated/{clean_path}"
        headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        }

    try:
        resp = requests.get(fetch_url, headers=headers, timeout=15)
        if resp.status_code == 200 and len(resp.content) > 100:
            return resp.content

        # If authenticated failed on storage, try public object endpoint
        if "/storage/v1/object/authenticated/" in fetch_url:
            fallback_url = fetch_url.replace("/storage/v1/object/authenticated/", "/storage/v1/object/public/")
            r2 = requests.get(fallback_url, timeout=15)
            if r2.status_code == 200 and len(r2.content) > 100:
                return r2.content

        logger.debug(f"Failed to download image from {fetch_url} (HTTP {resp.status_code})")
        return None
    except Exception as e:
        logger.warning(f"Error fetching photo from {fetch_url}: {e}")
        return None


def bytes_to_bgr_image(image_bytes: bytes) -> Optional[np.ndarray]:
    """Convert raw image bytes to OpenCV BGR numpy array."""
    if not image_bytes:
        return None
    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.warning(f"Error decoding image with OpenCV: {e}")
        return None


def run_batch_mapping(
    force: bool = False,
    limit: Optional[int] = None,
    dry_run: bool = False,
    sync_edge: bool = True,
) -> dict:
    """Execute the full batch user mapping from Supabase profile photos."""
    start_time = time.time()
    
    # Load configuration
    config = AppConfig.load()
    if not config.supabase_url or not config.supabase_service_role_key:
        logger.error("Supabase URL or Service Role Key missing in config / .env")
        return {"success": False, "error": "Missing Supabase configuration"}

    # Initialize FaceEngine
    models_path = Path(config.models_dir) if config.models_dir else SCRIPT_DIR / "models"
    if not models_path.is_absolute():
        models_path = SCRIPT_DIR / models_path

    logger.info(f"Initializing FaceEngine with models directory: {models_path}")
    face_engine = FaceEngine(models_dir=models_path, detection_threshold=0.35)
    if not face_engine.initialize():
        logger.error("Failed to initialize InsightFace face engine")
        return {"success": False, "error": "Face engine initialization failed"}

    headers = {
        "apikey": config.supabase_service_role_key,
        "Authorization": f"Bearer {config.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    # Fetch users from Supabase
    query_url = (
        f"{config.supabase_url.rstrip('/')}/rest/v1/users"
        f"?select=id,name,email,photo_url,face_embedding_512,biometric_id,organization_id"
        f"&photo_url=not.is.null"
    )
    if not force:
        query_url += "&face_embedding_512=is.null"

    if limit and limit > 0:
        query_url += f"&limit={limit}"

    logger.info(f"Fetching users to map from Supabase: {query_url}")
    try:
        resp = requests.get(query_url, headers=headers, timeout=20)
        if resp.status_code != 200:
            logger.error(f"Failed to fetch users from Supabase: {resp.status_code} - {resp.text}")
            return {"success": False, "error": f"Supabase fetch error: {resp.status_code}"}
        users_to_process = resp.json()
    except Exception as e:
        logger.error(f"Error querying Supabase users: {e}")
        return {"success": False, "error": str(e)}

    total_count = len(users_to_process)
    logger.info(f"Found {total_count} candidate users with profile photos to map.")

    if total_count == 0:
        logger.info("No unmapped users found. All users with photos are already mapped!")
        return {
            "success": True,
            "total_candidates": 0,
            "mapped_count": 0,
            "failed_count": 0,
            "duration_seconds": round(time.time() - start_time, 2),
        }

    mapped_count = 0
    failed_count = 0
    failed_users: list[dict] = []
    mapped_users: list[dict] = []

    for idx, user in enumerate(users_to_process, 1):
        user_id = user.get("id")
        user_name = user.get("name") or "Unknown"
        photo_url = user.get("photo_url")

        logger.info(f"[{idx}/{total_count}] Processing: {user_name} ({user_id})")

        if not photo_url:
            failed_count += 1
            failed_users.append({"id": user_id, "name": user_name, "reason": "Empty photo_url"})
            continue

        # 1. Download photo
        img_bytes = resolve_photo_bytes(photo_url, config.supabase_url, config.supabase_service_role_key)
        if not img_bytes:
            failed_count += 1
            failed_users.append({"id": user_id, "name": user_name, "reason": f"Could not download photo: {photo_url[:60]}"})
            continue

        # 2. Decode image
        img_bgr = bytes_to_bgr_image(img_bytes)
        if img_bgr is None or img_bgr.size == 0:
            failed_count += 1
            failed_users.append({"id": user_id, "name": user_name, "reason": "Corrupted or unreadable image format"})
            continue

        # 3. Detect and extract 512-dim ArcFace embedding
        try:
            detected_faces = face_engine.detect_faces(img_bgr)
            if not detected_faces:
                # Retry with resized image if photo is very small or very large
                h, w = img_bgr.shape[:2]
                if h < 200 or w < 200:
                    scale = max(2.0, 400.0 / min(h, w))
                    resized = cv2.resize(img_bgr, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
                    detected_faces = face_engine.detect_faces(resized)

            if not detected_faces:
                failed_count += 1
                failed_users.append({"id": user_id, "name": user_name, "reason": "No face detected in photo (blurry, obstructed, or icon/logo)"})
                continue

            # Pick largest/most confident face
            best_face = max(detected_faces, key=lambda f: (f.detection_score, (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1])))
            embedding_np = best_face.embedding

            if embedding_np is None or embedding_np.shape != (512,):
                failed_count += 1
                failed_users.append({"id": user_id, "name": user_name, "reason": f"Invalid embedding shape {embedding_np.shape if embedding_np is not None else 'None'}"})
                continue

            embedding_list = [float(v) for v in embedding_np.tolist()]
        except Exception as e:
            failed_count += 1
            failed_users.append({"id": user_id, "name": user_name, "reason": f"Embedding extraction error: {e}"})
            continue

        # 4. Save to Supabase
        if not dry_run:
            update_url = f"{config.supabase_url.rstrip('/')}/rest/v1/users?id=eq.{user_id}"
            update_payload = {
                "face_embedding_512": embedding_list,
            }
            try:
                u_resp = requests.patch(update_url, json=update_payload, headers=headers, timeout=10)
                if u_resp.status_code in (200, 204):
                    mapped_count += 1
                    mapped_users.append({"id": user_id, "name": user_name, "confidence": round(best_face.detection_score, 3)})
                    logger.info(f"  --> Successfully saved 512-d embedding for {user_name} (Confidence: {best_face.detection_score:.2f})")
                else:
                    failed_count += 1
                    failed_users.append({"id": user_id, "name": user_name, "reason": f"Supabase update failed: {u_resp.status_code} - {u_resp.text}"})
            except Exception as e:
                failed_count += 1
                failed_users.append({"id": user_id, "name": user_name, "reason": f"Supabase update error: {e}"})
        else:
            mapped_count += 1
            mapped_users.append({"id": user_id, "name": user_name, "confidence": round(best_face.detection_score, 3)})
            logger.info(f"  --> [DRY RUN] Extracted 512-d embedding for {user_name}")

    # 5. Local SQLite Edge Sync
    synced_edge_count = 0
    if sync_edge and not dry_run and mapped_count > 0:
        logger.info("Syncing updated embeddings into local CCTV edge database...")
        try:
            db_path = SCRIPT_DIR / "data" / "cctv_attendance.db"
            db_path.parent.mkdir(parents=True, exist_ok=True)
            local_db = LocalDatabase(db_path=db_path)
            local_db.connect()

            dispatcher = EventDispatcher(config, local_db)
            import asyncio
            async def _do_sync():
                await dispatcher.initialize()
                c = await dispatcher.sync_embeddings()
                await dispatcher.close()
                return c

            synced_edge_count = asyncio.run(_do_sync())
            local_db.close()
            logger.info(f"Local edge server cache updated: {synced_edge_count} embeddings active for live CCTV recognition.")
        except Exception as e:
            logger.warning(f"Local edge sync warning: {e}")

    duration = round(time.time() - start_time, 2)
    summary = {
        "success": True,
        "total_candidates": total_count,
        "mapped_count": mapped_count,
        "failed_count": failed_count,
        "synced_edge_count": synced_edge_count,
        "duration_seconds": duration,
        "mapped_users": mapped_users,
        "failed_users": failed_users,
    }

    logger.info("======================================================")
    logger.info(f"  MAPPING COMPLETE in {duration}s")
    logger.info(f"  Successfully Mapped: {mapped_count}/{total_count}")
    logger.info(f"  Failed / No Face:   {failed_count}/{total_count}")
    if synced_edge_count > 0:
        logger.info(f"  Local Edge DB Active: {synced_edge_count} users")
    logger.info("======================================================")

    return summary


def main():
    parser = argparse.ArgumentParser(description="Map user profile photos to CCTV ArcFace 512-dim embeddings in Supabase.")
    parser.add_argument("--force", action="store_true", help="Re-process all users with photos, even if already mapped.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of users to process.")
    parser.add_argument("--dry-run", action="store_true", help="Extract embeddings without writing to database.")
    parser.add_argument("--no-edge-sync", action="store_true", help="Skip syncing local edge server SQLite database.")

    args = parser.parse_args()

    results = run_batch_mapping(
        force=args.force,
        limit=args.limit,
        dry_run=args.dry_run,
        sync_edge=not args.no_edge_sync,
    )

    if not results.get("success"):
        sys.exit(1)


if __name__ == "__main__":
    main()
