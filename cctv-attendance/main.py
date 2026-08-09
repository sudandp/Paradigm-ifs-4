"""
CCTV Attendance Edge Server — Main Entry Point

Starts all components concurrently:
  - Face recognition pipeline (main loop)
  - Local admin API server (FastAPI/uvicorn)
  - Periodic snapshot cleanup

Usage:
    python main.py
"""

from __future__ import annotations

import asyncio
import signal
import sys
import time
from pathlib import Path

import uvicorn
from loguru import logger

# ─── Configure Logging ───────────────────────────────────────────────────────
logger.remove()  # Remove default handler
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{message}</cyan>",
    level="INFO",
)
logger.add(
    "logs/cctv_attendance_{time:YYYY-MM-DD}.log",
    rotation="00:00",
    retention="30 days",
    level="DEBUG",
    encoding="utf-8",
)

from core.config import AppConfig
from core.pipeline import AttendancePipeline
from core.admin_server import create_admin_app


async def run_pipeline(pipeline: AttendancePipeline) -> None:
    """Run the face recognition pipeline."""
    try:
        initialized = await pipeline.initialize()
        if not initialized:
            logger.error("Pipeline initialization failed — check cameras and models")
            return
        await pipeline.run()
    except asyncio.CancelledError:
        logger.info("Pipeline cancelled")
    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
    finally:
        await pipeline.stop()


async def run_admin_server(config: AppConfig, pipeline: AttendancePipeline) -> None:
    """Run the local admin API server."""
    admin_app = create_admin_app(
        config=config,
        db=pipeline.db,
        face_engine=pipeline.face_engine,
    )

    server_config = uvicorn.Config(
        app=admin_app,
        host="0.0.0.0",
        port=config.admin_port,
        log_level="warning",  # Suppress uvicorn access logs
        access_log=False,
    )
    server = uvicorn.Server(server_config)
    
    try:
        logger.info(f"[Admin] Server started at http://localhost:{config.admin_port}")
        await server.serve()
    except asyncio.CancelledError:
        logger.info("[Admin] Server stopped")


async def run_snapshot_cleanup(config: AppConfig) -> None:
    """Periodically delete snapshots older than retention period."""
    retention_days = config.snapshot_retention_days
    
    while True:
        try:
            await asyncio.sleep(3600)  # Run every hour
            
            if not config.snapshot_dir.exists():
                continue

            cutoff = time.time() - (retention_days * 86400)
            deleted = 0
            
            for img_file in config.snapshot_dir.rglob("*.jpg"):
                if img_file.stat().st_mtime < cutoff:
                    img_file.unlink()
                    deleted += 1

            # Remove empty directories
            for d in sorted(config.snapshot_dir.iterdir(), reverse=True):
                if d.is_dir():
                    try:
                        d.rmdir()  # Only removes if empty
                    except OSError:
                        pass

            if deleted > 0:
                logger.info(f"[Cleanup] Deleted {deleted} snapshots older than {retention_days} days")

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[Cleanup] Error: {e}")


async def main() -> None:
    """Main async entry point."""
    logger.info("=" * 60)
    logger.info("  Paradigm CCTV Attendance Edge Server v1.0")
    logger.info("=" * 60)

    # Load configuration
    config = AppConfig.load()
    logger.info(f"  Device ID : {config.edge_device_id}")
    logger.info(f"  Cameras   : {len(config.cameras)}")
    logger.info(f"  FPS       : {config.processing_fps}")
    logger.info(f"  Threshold : {config.match_threshold}")
    logger.info(f"  Admin     : http://localhost:{config.admin_port}")
    logger.info("=" * 60)

    # Create pipeline
    pipeline = AttendancePipeline(config)

    # Create tasks
    tasks = [
        asyncio.create_task(run_pipeline(pipeline), name="pipeline"),
        asyncio.create_task(run_admin_server(config, pipeline), name="admin"),
        asyncio.create_task(run_snapshot_cleanup(config), name="cleanup"),
    ]

    # Handle graceful shutdown on SIGINT / SIGTERM
    shutdown_event = asyncio.Event()

    def handle_shutdown(sig, frame):
        logger.info(f"Received signal {sig} — shutting down gracefully...")
        shutdown_event.set()

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    # Wait for shutdown signal or any task failure
    try:
        done, pending = await asyncio.wait(
            tasks + [asyncio.create_task(shutdown_event.wait())],
            return_when=asyncio.FIRST_COMPLETED,
        )
    finally:
        # Cancel remaining tasks
        for task in tasks:
            if not task.done():
                task.cancel()
        
        # Wait for all tasks to finish
        await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("Shutdown complete")


if __name__ == "__main__":
    # Ensure data/logs directories exist
    Path("data").mkdir(exist_ok=True)
    Path("logs").mkdir(exist_ok=True)

    asyncio.run(main())
