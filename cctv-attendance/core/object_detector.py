"""
CCTV Attendance — AI Object Detector

Wraps YOLOv8n (ultralytics) for real-time scene understanding.
Detects humans (full-body), cars, motorcycles, bicycles, trucks, buses.

Runs as Layer 1 in the two-layer detection pipeline:
  Frame → YOLO Object Detection → (Person crops) → InsightFace Face Recognition
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from loguru import logger

# ─── Focused class filter — COCO class IDs ──────────────────────────────────
# Only these classes get tracked; everything else is ignored for performance.
TRACKED_CLASS_IDS: set[int] = {
    0,   # person
    1,   # bicycle
    2,   # car
    3,   # motorcycle
    5,   # bus
    7,   # truck
}

# Human-readable labels for COCO class IDs (focused subset)
LABEL_MAP: dict[int, str] = {
    0: "HUMAN",
    1: "BICYCLE",
    2: "CAR",
    3: "MOTORCYCLE",
    5: "BUS",
    7: "TRUCK",
}

# BGR color per object type for overlay rendering
OBJECT_COLORS: dict[str, tuple[int, int, int]] = {
    "HUMAN":        (255, 180,   0),   # Blue  — body detected, no face yet
    "CAR":          (0,   140, 255),   # Orange
    "TRUCK":        (0,   120, 220),   # Dark orange
    "BUS":          (0,   100, 200),   # Amber-orange
    "MOTORCYCLE":   (255, 220,   0),   # Cyan-yellow
    "BICYCLE":      (220, 255,   0),   # Lime-cyan
}

_ultralytics_available = False
try:
    from ultralytics import YOLO as _YOLO  # type: ignore
    _ultralytics_available = True
except ImportError:
    logger.warning(
        "ultralytics not installed — object detection disabled. "
        "Install: pip install ultralytics"
    )


@dataclass
class DetectedObject:
    """A single detected object in a frame."""
    label: str               # Human-readable label e.g. 'HUMAN', 'CAR'
    class_id: int            # COCO class ID
    confidence: float        # Detection confidence 0.0–1.0
    bbox: list[int]          # [x1, y1, x2, y2] in full-frame pixels
    is_person: bool          # True if class_id == 0 (person)

    @property
    def color(self) -> tuple[int, int, int]:
        """BGR color for this object type."""
        return OBJECT_COLORS.get(self.label, (160, 160, 160))

    @property
    def width(self) -> int:
        return self.bbox[2] - self.bbox[0]

    @property
    def height(self) -> int:
        return self.bbox[3] - self.bbox[1]

    @property
    def area(self) -> int:
        return self.width * self.height


class ObjectDetector:
    """YOLOv8n-based scene object detector.

    Optimized for CPU inference — uses the nano model for maximum speed.
    Only detects the focused subset of classes (persons + vehicles).

    Usage:
        detector = ObjectDetector()
        detector.initialize()
        objects = detector.detect(frame)
    """

    def __init__(
        self,
        model_name: str = "yolov8n.pt",
        confidence_threshold: float = 0.40,
        iou_threshold: float = 0.45,
    ):
        self.model_name = model_name
        self.confidence_threshold = confidence_threshold
        self.iou_threshold = iou_threshold
        self._model: Optional[object] = None
        self._initialized = False

    def initialize(self) -> bool:
        """Load YOLOv8n model. Downloads on first run (~6 MB).

        Returns True if initialization succeeds.
        """
        if not _ultralytics_available:
            logger.error(
                "[ObjectDetector] ultralytics not available. "
                "Run: pip install ultralytics"
            )
            return False

        try:
            logger.info(f"[ObjectDetector] Loading {self.model_name}...")
            start = time.time()

            # YOLO auto-downloads model to ~/.ultralytics/assets/ on first run
            self._model = _YOLO(self.model_name)

            # Warm-up pass — first inference is always slow due to JIT compilation
            dummy = np.zeros((320, 320, 3), dtype=np.uint8)
            self._model(dummy, verbose=False, classes=list(TRACKED_CLASS_IDS))

            elapsed = time.time() - start
            logger.info(
                f"[ObjectDetector] {self.model_name} loaded in {elapsed:.1f}s — "
                f"tracking {len(TRACKED_CLASS_IDS)} object classes"
            )
            self._initialized = True
            return True

        except Exception as e:
            logger.error(f"[ObjectDetector] Initialization failed: {e}")
            return False

    @property
    def is_ready(self) -> bool:
        return self._initialized and self._model is not None

    def detect(self, frame: np.ndarray) -> list[DetectedObject]:
        """Run YOLO inference on a frame.

        Args:
            frame: BGR image (OpenCV format)

        Returns:
            List of DetectedObject, sorted by confidence descending.
            Only returns objects in TRACKED_CLASS_IDS.
        """
        if not self.is_ready:
            return []

        try:
            results = self._model(  # type: ignore
                frame,
                verbose=False,
                conf=self.confidence_threshold,
                iou=self.iou_threshold,
                classes=list(TRACKED_CLASS_IDS),
                imgsz=640,
            )

            objects: list[DetectedObject] = []

            for result in results:
                if result.boxes is None:
                    continue
                for box in result.boxes:
                    class_id = int(box.cls[0].item())
                    if class_id not in TRACKED_CLASS_IDS:
                        continue

                    conf = float(box.conf[0].item())
                    x1, y1, x2, y2 = (int(v) for v in box.xyxy[0].tolist())

                    # Clamp to frame bounds
                    h, w = frame.shape[:2]
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w, x2), min(h, y2)

                    if x2 <= x1 or y2 <= y1:
                        continue

                    label = LABEL_MAP.get(class_id, f"OBJ_{class_id}")
                    objects.append(DetectedObject(
                        label=label,
                        class_id=class_id,
                        confidence=conf,
                        bbox=[x1, y1, x2, y2],
                        is_person=(class_id == 0),
                    ))

            # Sort by confidence descending
            objects.sort(key=lambda o: o.confidence, reverse=True)
            return objects

        except Exception as e:
            logger.error(f"[ObjectDetector] Detection error: {e}")
            return []

    def crop_object(self, frame: np.ndarray, obj: DetectedObject, pad_ratio: float = 0.05) -> np.ndarray:
        """Crop an object region from the frame with optional padding.

        Args:
            frame: Full BGR frame
            obj: Detected object whose bbox to crop
            pad_ratio: Fractional padding around the crop (default 5%)

        Returns:
            Cropped BGR image
        """
        x1, y1, x2, y2 = obj.bbox
        h, w = frame.shape[:2]
        pad_x = int((x2 - x1) * pad_ratio)
        pad_y = int((y2 - y1) * pad_ratio)
        cx1 = max(0, x1 - pad_x)
        cy1 = max(0, y1 - pad_y)
        cx2 = min(w, x2 + pad_x)
        cy2 = min(h, y2 + pad_y)
        return frame[cy1:cy2, cx1:cx2].copy()
