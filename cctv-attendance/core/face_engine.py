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
        detection_threshold: float = 0.65,
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

    @staticmethod
    def is_authentic_human_face_with_diagnostics(
        frame: np.ndarray,
        bbox: np.ndarray | list[int],
        kps: Optional[np.ndarray] = None,
    ) -> tuple[bool, dict]:
        """Strict multi-stage validation to reject foliage, plants, trees, wall textures,
        shadows, and background artifacts from being recognized as faces.

        Returns (is_valid: bool, diagnostics: dict) with granular metrics.
        """
        diag = {
            "bbox": [int(v) for v in bbox],
            "width": 0,
            "height": 0,
            "aspect_ratio": 0.0,
            "green_ratio_pct": 0.0,
            "skin_ratio_pct": 0.0,
            "eye_distance_px": 0.0,
            "in_exclusion_roi": False,
            "status": "REJECTED",
            "reason": "Unknown",
        }
        try:
            h, w = frame.shape[:2]
            x1, y1, x2, y2 = [int(v) for v in bbox]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            fw, fh = x2 - x1, y2 - y1

            diag["width"] = fw
            diag["height"] = fh

            # Minimum size check (44x44px)
            if fw < 44 or fh < 44:
                diag["reason"] = f"Face dimensions too small ({fw}x{fh}px < 44x44px)"
                return False, diag

            aspect = fw / float(max(1, fh))
            diag["aspect_ratio"] = round(aspect, 2)
            if aspect < 0.55 or aspect > 1.45:
                diag["reason"] = f"Abnormal aspect ratio ({aspect:.2f})"
                return False, diag

            # ── Check 1: Gate Entry ROI Exclusion (Garden Planter Bed Zone) ──
            # In gate surveillance, humans walk on the stairs & walkway.
            # The static planter box / tree foliage sits in the upper-mid region: x ∈ [0.22, 0.45], y ∈ [0.0, 0.50]
            cx_rel = (x1 + x2) / 2.0 / float(w)
            cy_rel = (y1 + y2) / 2.0 / float(h)
            if 0.22 <= cx_rel <= 0.45 and cy_rel <= 0.50:
                diag["in_exclusion_roi"] = True
                diag["reason"] = f"Position ({cx_rel*100:.1f}%, {cy_rel*100:.1f}%) is inside garden foliage zone"
                return False, diag

            crop = frame[y1:y2, x1:x2]
            if crop.size == 0:
                diag["reason"] = "Empty frame crop"
                return False, diag

            # ── Check 2: Vegetation & Foliage Green Filter (HSV) ──
            hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
            hue = hsv[:, :, 0]
            sat = hsv[:, :, 1]
            # Plant green hues: Hue 30–90 with saturation >= 35
            green_mask = (hue >= 30) & (hue <= 90) & (sat >= 35)
            green_ratio = float(np.sum(green_mask)) / float(crop.shape[0] * crop.shape[1])
            diag["green_ratio_pct"] = round(green_ratio * 100.0, 1)

            if green_ratio > 0.18:
                diag["reason"] = f"High vegetation green content ({green_ratio*100:.1f}% > 18%)"
                return False, diag

            # ── Check 3: Human Skin Chrominance Verification (YCrCb) ──
            # Universal human skin tones cluster in Cr ∈ [130, 175], Cb ∈ [75, 130]
            ycrcb = cv2.cvtColor(crop, cv2.COLOR_BGR2YCrCb)
            cr = ycrcb[:, :, 1]
            cb = ycrcb[:, :, 2]
            skin_mask = (cr >= 130) & (cr <= 175) & (cb >= 75) & (cb <= 130)
            skin_ratio = float(np.sum(skin_mask)) / float(crop.shape[0] * crop.shape[1])
            diag["skin_ratio_pct"] = round(skin_ratio * 100.0, 1)

            if skin_ratio < 0.15:
                diag["reason"] = f"Insufficient human skin tones ({skin_ratio*100:.1f}% < 15%)"
                return False, diag

            # ── Check 4: 5-Point Facial Landmark Topology Check ──
            if kps is not None and len(kps) >= 5:
                lex, ley = kps[0]
                rex, rey = kps[1]
                nx, ny = kps[2]
                lmx, lmy = kps[3]
                rmx, rmy = kps[4]

                eye_dist = float(np.hypot(rex - lex, rey - ley))
                diag["eye_distance_px"] = round(eye_dist, 1)
                if eye_dist < 14.0:
                    diag["reason"] = f"Inter-pupillary distance too narrow ({eye_dist:.1f}px < 14px)"
                    return False, diag

                # Vertical order check: eyes center must be above nose, nose above mouth
                eyes_y = (ley + rey) / 2.0
                mouth_y = (lmy + rmy) / 2.0
                if mouth_y <= eyes_y + 4.0:
                    diag["reason"] = "Invalid landmark topology: mouth not below eyes"
                    return False, diag
                if ny <= eyes_y - 2.0 or ny >= mouth_y + 6.0:
                    diag["reason"] = "Invalid landmark topology: nose outside facial bounding zone"
                    return False, diag

            diag["status"] = "ACCEPTED"
            diag["reason"] = "Authentic Human Face Verified"
            return True, diag

        except Exception as e:
            diag["reason"] = f"Validation exception: {e}"
            return True, diag

    @staticmethod
    def is_authentic_human_face(
        frame: np.ndarray,
        bbox: np.ndarray | list[int],
        kps: Optional[np.ndarray] = None,
    ) -> bool:
        """Boolean wrapper for biometric authenticity check."""
        is_valid, _ = FaceEngine.is_authentic_human_face_with_diagnostics(frame, bbox, kps)
        return is_valid

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
                # 1. Filter by detection confidence (strict 0.75+ for true human faces)
                det_score = float(face.det_score)
                if det_score < max(0.75, self.detection_threshold):
                    continue

                bbox = face.bbox.astype(int)
                kps = getattr(face, 'kps', None)

                # 2. Strict Human Face vs Foliage / Background Artifacts Validation
                if not self.is_authentic_human_face(frame, bbox, kps):
                    continue

                face_crop, sharpness = self.extract_high_res_portrait(frame, bbox)
                if face_crop is None or face_crop.size == 0:
                    continue

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
        min_dim: int = 400,
    ) -> tuple[Optional[np.ndarray], float]:
        """Extract a high-resolution, naturally framed portrait with full head,
        hair, neck, and upper-body context. Designed specifically for overhead/downward
        angled CCTV cameras.
        
        Returns:
            (sharpened_portrait_bgr, laplacian_sharpness_score)
        """
        if full_frame is None or full_frame.size == 0:
            return None, 0.0

        h, w = full_frame.shape[:2]
        x1, y1, x2, y2 = (int(v) for v in bbox)
        fw, fh = max(1, x2 - x1), max(1, y2 - y1)

        # Generous portrait padding:
        # - 70% horizontal (ears, side of hair, shoulders)
        # - 85% top (crown of head & headroom even when face is tilted down)
        # - 100% bottom (chin, neck, collar, upper chest)
        pad_x = int(fw * 0.70)
        pad_top = int(fh * 0.85)
        pad_bot = int(fh * 1.00)

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
            nw, nh = round(cw * scale), round(ch * scale)
            crop = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_LANCZOS4)

        # Natural detail enhancement (subtle unsharp mask without artificial noise)
        try:
            blurred = cv2.GaussianBlur(crop, (0, 0), 1.2)
            sharpened = cv2.addWeighted(crop, 1.18, blurred, -0.18, 0)
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
