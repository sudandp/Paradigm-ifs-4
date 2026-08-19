"""
CCTV Attendance — Face Recognition Engine

Uses InsightFace (ArcFace) for face detection and 512-dimensional embedding
generation. Optimized for CPU-only inference using ONNX Runtime.

Pipeline:
  Frame → Detect Faces → Generate Embeddings → Match Against Enrolled DB
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from loguru import logger

# InsightFace lazy import to handle missing dependency gracefully
_insightface_available = False
try:
    import insightface
    from insightface.app import FaceAnalysis
    _insightface_available = True
except ImportError:
    logger.warning("insightface not installed — face recognition disabled. Run: pip install insightface onnxruntime")


@dataclass
class DetectedFace:
    """A single detected face in a frame."""
    bbox: np.ndarray            # [x1, y1, x2, y2] bounding box
    embedding: np.ndarray       # 512-dimensional ArcFace embedding
    detection_score: float      # Face detection confidence (0.0 - 1.0)
    landmarks: Optional[np.ndarray] = None  # 5-point facial landmarks
    face_crop: Optional[np.ndarray] = None  # Cropped face image (for snapshots)
    sharpness_score: float = 0.0            # Laplacian variance sharpness score



@dataclass
class MatchResult:
    """Result of matching a detected face against the enrolled database."""
    user_id: str
    user_name: str
    biometric_id: str
    department: str
    similarity: float           # Cosine similarity (0.0 - 1.0)
    is_match: bool              # Whether similarity exceeds threshold


class FaceEngine:
    """Face detection and recognition engine using InsightFace ArcFace.
    
    Optimized for CPU-only inference:
    - Uses 'buffalo_l' model pack (detection + recognition)
    - Processes at configurable resolution to balance speed vs accuracy
    - Returns 512-dimensional normalized embeddings
    """

    def __init__(
        self,
        models_dir: Path = Path('./models'),
        detection_threshold: float = 0.5,
        det_size: tuple[int, int] = (640, 640),
    ):
        self.models_dir = models_dir
        self.detection_threshold = detection_threshold
        self.det_size = det_size
        self._app: Optional[FaceAnalysis] = None
        self._initialized = False

    def initialize(self) -> bool:
        """Load face detection and recognition models.
        
        Downloads models on first run (~130 MB).
        Returns True if initialization succeeds.
        """
        if not _insightface_available:
            logger.error("InsightFace not available. Install: pip install insightface onnxruntime")
            return False

        try:
            logger.info("[FaceEngine] Loading InsightFace models (buffalo_l)...")
            start = time.time()

            self.models_dir.mkdir(parents=True, exist_ok=True)

            # Auto-detect CUDA GPU availability in ONNX Runtime
            import onnxruntime as ort
            available_providers = ort.get_available_providers()
            
            providers = ['CPUExecutionProvider']
            ctx_id = -1  # CPU mode
            
            if 'CUDAExecutionProvider' in available_providers:
                providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
                ctx_id = 0  # GPU 0
                logger.info("[FaceEngine] NVIDIA CUDA GPU detected! Enabling GPU acceleration.")
            elif 'TensorrtExecutionProvider' in available_providers:
                providers.append('TensorrtExecutionProvider')
                logger.info("[FaceEngine] NVIDIA TensorRT detected! Enabling TensorRT acceleration.")

            # Initialize FaceAnalysis with model pack
            self._app = FaceAnalysis(
                name='buffalo_l',
                root=str(self.models_dir),
                providers=providers,
            )

            # Prepare with detection size (det_size) and context ID (0 for GPU, -1 for CPU)
            self._app.prepare(ctx_id=ctx_id, det_size=self.det_size)

            elapsed = time.time() - start
            mode_str = "GPU (CUDA) mode" if ctx_id == 0 else "CPU mode"
            logger.info(f"[FaceEngine] Models loaded in {elapsed:.1f}s ({mode_str})")
            self._initialized = True
            return True

        except Exception as e:
            logger.error(f"[FaceEngine] Initialization failed: {e}")
            return False

    @property
    def is_ready(self) -> bool:
        return self._initialized and self._app is not None

    def detect_faces(self, frame: np.ndarray) -> list[DetectedFace]:
        """Detect all faces in a frame and generate embeddings.
        
        Args:
            frame: BGR image (OpenCV format)
            
        Returns:
            List of DetectedFace with bounding boxes, embeddings, and scores.
        """
        if not self.is_ready:
            return []

        try:
            # InsightFace expects BGR (OpenCV default)
            faces = self._app.get(frame)  # type: ignore

            results = []
            for face in faces:
                # Filter by detection confidence
                det_score = float(face.det_score)
                if det_score < self.detection_threshold:
                    continue

                bbox = face.bbox.astype(int)
                face_crop, sharpness = self.extract_high_res_portrait(frame, bbox)

                results.append(DetectedFace(
                    bbox=face.bbox,
                    embedding=face.normed_embedding,  # Already L2-normalized
                    detection_score=det_score,
                    landmarks=getattr(face, 'landmark_2d_106', None),
                    face_crop=face_crop,
                    sharpness_score=sharpness,
                ))

            return results


        except Exception as e:
            logger.error(f"[FaceEngine] Detection error: {e}")
            return []

    def match_face(
        self,
        embedding: np.ndarray,
        enrolled_embeddings: list[dict],
        threshold: float = 0.45,
    ) -> Optional[MatchResult]:
        """Match a face embedding against all enrolled embeddings.
        
        Uses cosine similarity (since InsightFace embeddings are L2-normalized,
        cosine similarity = dot product).
        
        Args:
            embedding: 512-dim normalized face embedding to match
            enrolled_embeddings: List of dicts with 'user_id', 'user_name', 
                                 'biometric_id', 'department', 'embedding'
            threshold: Minimum cosine similarity for a match
            
        Returns:
            MatchResult for the best match, or None if no match found.
        """
        if not enrolled_embeddings:
            return None

        best_match: Optional[MatchResult] = None
        best_similarity = -1.0

        for enrolled in enrolled_embeddings:
            # Cosine similarity via dot product (embeddings are L2-normalized)
            similarity = float(np.dot(embedding, enrolled['embedding']))
            
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = MatchResult(
                    user_id=enrolled['user_id'],
                    user_name=enrolled['user_name'],
                    biometric_id=enrolled.get('biometric_id', ''),
                    department=enrolled.get('department', 'General'),
                    similarity=similarity,
                    is_match=similarity >= threshold,
                )

        if best_match and best_match.is_match:
            return best_match
        
        return None

    def generate_embedding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """Generate a 512-dim embedding from a face image (for enrollment).
        
        Args:
            face_image: BGR image containing a single face
            
        Returns:
            512-dim normalized embedding, or None if no face detected.
        """
        faces = self.detect_faces(face_image)
        if not faces:
            return None
        
        # Return the embedding of the largest/most confident face
        best_face = max(faces, key=lambda f: f.detection_score)
        return best_face.embedding

    def extract_high_res_portrait(
        self,
        full_frame: np.ndarray,
        bbox: np.ndarray | list[int],
        min_dim: int = 360,
    ) -> tuple[Optional[np.ndarray], float]:
        """Extract a high-resolution portrait with full head and upper-body context,
        measure sharpness, and enhance image clarity.
        
        Returns:
            (sharpened_portrait_bgr, laplacian_sharpness_score)
        """
        if full_frame is None or full_frame.size == 0:
            return None, 0.0

        h, w = full_frame.shape[:2]
        x1, y1, x2, y2 = (int(v) for v in bbox)
        fw, fh = max(1, x2 - x1), max(1, y2 - y1)

        # Generous portrait padding: 55% horizontal, 65% top (full head/hair), 60% bottom (shoulders/torso)
        pad_x = int(fw * 0.55)
        pad_top = int(fh * 0.65)
        pad_bot = int(fh * 0.60)

        cx1 = max(0, x1 - pad_x)
        cy1 = max(0, y1 - pad_top)
        cx2 = min(w, x2 + pad_x)
        cy2 = min(h, y2 + pad_bot)

        if cx2 <= cx1 or cy2 <= cy1:
            return None, 0.0

        crop = full_frame[cy1:cy2, cx1:cx2].copy()
        if crop.size == 0:
            return None, 0.0

        # Measure motion blur / sharpness (Laplacian variance)
        try:
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        except Exception:
            sharpness = 50.0

        # High-quality Lanczos-4 scaling if smaller than min_dim
        ch, cw = crop.shape[:2]
        if max(ch, cw) < min_dim:
            scale = min_dim / float(max(ch, cw))
            nw, nh = int(round(cw * scale)), int(round(ch * scale))
            crop = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_LANCZOS4)

        # Edge-preserving detail enhancement
        try:
            blurred = cv2.GaussianBlur(crop, (0, 0), 1.5)
            sharpened = cv2.addWeighted(crop, 1.25, blurred, -0.25, 0)
            return sharpened, sharpness
        except Exception:
            return crop, sharpness

    def detect_faces_in_crop(
        self,
        full_frame: np.ndarray,
        crop_x1: int,
        crop_y1: int,
        crop_x2: int,
        crop_y2: int,
    ) -> list["DetectedFace"]:
        """Detect faces within a sub-region of the full frame.

        Runs face detection on the cropped region and translates all
        bounding boxes / landmarks back to full-frame coordinates.
        """
        h, w = full_frame.shape[:2]
        cx1 = max(0, crop_x1)
        cy1 = max(0, crop_y1)
        cx2 = min(w, crop_x2)
        cy2 = min(h, crop_y2)

        if cx2 <= cx1 or cy2 <= cy1:
            return []

        person_crop = full_frame[cy1:cy2, cx1:cx2]
        if person_crop.size == 0:
            return []

        # Detect faces in the crop
        faces = self.detect_faces(person_crop)

        # Translate coordinates back to full-frame space and re-extract full-frame portrait
        for face in faces:
            fx1, fy1, fx2, fy2 = (int(v) for v in face.bbox)
            full_bbox = np.array([
                cx1 + fx1, cy1 + fy1,
                cx1 + fx2, cy1 + fy2,
            ], dtype=np.float32)
            face.bbox = full_bbox

            # Extract crisp high-resolution portrait from full frame
            portrait, sharpness = self.extract_high_res_portrait(full_frame, full_bbox)
            face.face_crop = portrait
            face.sharpness_score = sharpness

        return faces


    def batch_generate_embeddings(
        self, images: list[np.ndarray]
    ) -> list[Optional[np.ndarray]]:
        """Generate embeddings for multiple face images (for batch enrollment).
        
        Args:
            images: List of BGR images, each containing a single face
            
        Returns:
            List of 512-dim embeddings (None for images where no face was detected)
        """
        return [self.generate_embedding(img) for img in images]
