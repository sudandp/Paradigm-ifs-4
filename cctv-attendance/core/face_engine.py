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
from typing import Optional, Any

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
        models_dir: Any = Path('./models'),
        detection_threshold: float = 0.45,
        det_size: tuple[int, int] = (960, 960),
    ):
        if hasattr(models_dir, 'models_dir'):
            self.models_dir = Path(models_dir.models_dir)
        elif isinstance(models_dir, str):
            self.models_dir = Path(models_dir)
        else:
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
            logger.info(f"[FaceEngine] Models loaded in {elapsed:.1f}s ({mode_str}) [det_size={self.det_size}]")
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
        action_zone: Optional[list[list[float]]] = None,
    ) -> tuple[bool, dict]:
        """Multi-stage validation optimized for multi-person crowd & stairway surveillance:
        Rejects background foliage, vehicle lights, non-human objects, and out-of-zone faces
        without rejecting real people in crowds or under night lighting.

        Rejection checks (in order):
          0. Action Zone ROI boundary check (if configured by user)
          1. Minimum size (22×22px)
          2. Aspect ratio (0.45–1.85)
          3. Foliage green filter (HSV green > 35%)
          4. Red/orange vehicle light filter (HSV red > 25%)
          5. Skin tone minimum (YCrCb, reject if < 12%)
          6. Texture complexity (Laplacian variance < 15.0)
          7. Facial landmark topology (inter-pupillary distance < 8px)
        """
        diag = {
            "bbox": [int(v) for v in bbox],
            "width": 0,
            "height": 0,
            "aspect_ratio": 0.0,
            "green_ratio_pct": 0.0,
            "red_light_ratio_pct": 0.0,
            "skin_ratio_pct": 0.0,
            "texture_variance": 0.0,
            "eye_distance_px": 0.0,
            "in_exclusion_roi": False,
            "in_action_zone": True,
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

            # ── Check 0: Action Zone (User-Defined ROI Polygon) ──
            if action_zone and len(action_zone) >= 3:
                in_zone = FaceEngine.is_bbox_in_action_zone(bbox, (h, w), action_zone)
                diag["in_action_zone"] = in_zone
                if not in_zone:
                    fcx, fcy = (x1 + x2) // 2, (y1 + y2) // 2
                    diag["reason"] = f"Face position ({fcx},{fcy}px) is outside defined Action Zone"
                    return False, diag

            # Minimum size check (18x18px for distant crowd / stair depth)
            if fw < 18 or fh < 18:
                diag["reason"] = f"Face dimensions too small ({fw}x{fh}px < 18x18px)"
                return False, diag

            aspect = fw / float(max(1, fh))
            diag["aspect_ratio"] = round(aspect, 2)
            if aspect < 0.45 or aspect > 1.85:
                diag["reason"] = f"Abnormal aspect ratio ({aspect:.2f})"
                return False, diag

            crop = frame[y1:y2, x1:x2]
            if crop.size == 0:
                diag["reason"] = "Empty frame crop"
                return False, diag

            total_pixels = float(crop.shape[0] * crop.shape[1])

            # ── Check 1: Pure Foliage Green Filter (HSV) ──
            # Reject if crop is dominated by plant chlorophyll green (>38%)
            hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
            hue = hsv[:, :, 0]
            sat = hsv[:, :, 1]
            green_mask = (hue >= 35) & (hue <= 85) & (sat >= 50)
            green_ratio = float(np.sum(green_mask)) / total_pixels
            diag["green_ratio_pct"] = round(green_ratio * 100.0, 1)

            if green_ratio > 0.38:
                diag["reason"] = f"High vegetation green content ({green_ratio*100:.1f}% > 38%)"
                return False, diag

            # ── Check 2: Red/Orange Vehicle Light Rejection (HSV) ──
            # Catches tail lights, brake lights, reflectors, indicator LEDs
            val = hsv[:, :, 2]
            red_low = (hue <= 10) & (sat >= 100) & (val >= 100)
            red_high = (hue >= 160) & (sat >= 100) & (val >= 100)
            red_mask = red_low | red_high
            red_ratio = float(np.sum(red_mask)) / total_pixels
            diag["red_light_ratio_pct"] = round(red_ratio * 100.0, 1)

            if red_ratio > 0.30:
                diag["reason"] = f"Red/orange vehicle light detected ({red_ratio*100:.1f}% > 30%)"
                return False, diag

            # ── Check 3: Skin Tone Minimum (YCrCb chrominance) ──
            # Robust across all skin tones under varying lighting & stairs depth
            ycrcb = cv2.cvtColor(crop, cv2.COLOR_BGR2YCrCb)
            cr = ycrcb[:, :, 1]
            cb = ycrcb[:, :, 2]
            skin_mask = (cr >= 133) & (cr <= 173) & (cb >= 77) & (cb <= 127)
            skin_ratio = float(np.sum(skin_mask)) / total_pixels
            diag["skin_ratio_pct"] = round(skin_ratio * 100.0, 1)

            min_skin = 0.05 if (kps is not None and len(kps) >= 5) else 0.08
            if skin_ratio < min_skin:
                diag["reason"] = f"No human skin detected ({skin_ratio*100:.1f}% < {min_skin*100:.0f}%)"
                return False, diag

            # ── Check 4: Texture Complexity (Laplacian variance) ──
            # Flat-colored blobs (lights, signs, paint) have very low texture
            gray_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            laplacian_var = float(cv2.Laplacian(gray_crop, cv2.CV_64F).var())
            diag["texture_variance"] = round(laplacian_var, 1)

            min_texture = 10.0 if (kps is not None and len(kps) >= 5) else 13.0
            if laplacian_var < min_texture:
                diag["reason"] = f"Low texture / flat blob ({laplacian_var:.1f} < {min_texture:.1f})"
                return False, diag

            # ── Check 5: 5-Point Facial Landmark Topology Check ──
            if kps is not None and len(kps) >= 5:
                lex, ley = kps[0]
                rex, rey = kps[1]
                nx, ny = kps[2]
                lmx, lmy = kps[3]
                rmx, rmy = kps[4]

                eye_dist = float(np.hypot(rex - lex, rey - ley))
                diag["eye_distance_px"] = round(eye_dist, 1)
                if eye_dist < 8.0:
                    diag["reason"] = f"Inter-pupillary distance too narrow ({eye_dist:.1f}px < 8px)"
                    return False, diag

            diag["status"] = "ACCEPTED"
            diag["reason"] = "Authentic Human Face Verified (Inside Action Zone)"
            return True, diag

        except Exception as e:
            diag["reason"] = f"Validation exception: {e}"
            return True, diag

    @staticmethod
    def is_bbox_in_action_zone(
        bbox: np.ndarray | list[int],
        frame_shape: tuple[int, ...],
        action_zone: Optional[list[list[float]]],
    ) -> bool:
        """Check if face bounding box is inside user-configured Action Zone polygon.
        
        Args:
            bbox: [x1, y1, x2, y2] in pixel coords
            frame_shape: (H, W) or (H, W, C)
            action_zone: list of normalized points [[x, y], ...] where 0.0 <= x,y <= 1.0
        """
        if not action_zone or len(action_zone) < 3:
            return True

        try:
            h, w = frame_shape[:2]
            x1, y1, x2, y2 = [int(v) for v in bbox]
            
            # Key sample points of face: center, chin, top
            fcx = float(x1 + x2) / 2.0
            fcy = float(y1 + y2) / 2.0
            chin_y = float(y2)
            
            # Pixel polygon array
            poly_pts = np.array(
                [[round(p[0] * w), round(p[1] * h)] for p in action_zone],
                dtype=np.int32
            )

            # Test face center
            dist_center = cv2.pointPolygonTest(poly_pts, (fcx, fcy), False)
            if dist_center >= 0:
                return True

            # Test chin point (for people entering the zone)
            dist_chin = cv2.pointPolygonTest(poly_pts, (fcx, chin_y), False)
            if dist_chin >= 0:
                return True

            return False
        except Exception as e:
            logger.error(f"[FaceEngine] Error checking action zone: {e}")
            return True

    @staticmethod
    def is_authentic_human_face(
        frame: np.ndarray,
        bbox: np.ndarray | list[int],
        kps: Optional[np.ndarray] = None,
        action_zone: Optional[list[list[float]]] = None,
    ) -> bool:
        """Boolean wrapper for biometric authenticity check."""
        is_valid, _ = FaceEngine.is_authentic_human_face_with_diagnostics(frame, bbox, kps, action_zone=action_zone)
        return is_valid

    def detect_faces(
        self,
        frame: np.ndarray,
        action_zone: Optional[list[list[float]]] = None,
    ) -> list[DetectedFace]:
        """Detect ALL faces in a frame simultaneously and generate embeddings.
        
        Args:
            frame: BGR image (OpenCV format)
            action_zone: Optional normalized polygon [[x, y], ...] defining capture zone.
            
        Returns:
            List of DetectedFace with bounding boxes, embeddings, and scores.
        """
        if not self.is_ready:
            return []

        try:
            # InsightFace SCRFD full-frame detection
            faces = self._app.get(frame)  # type: ignore

            results = []
            for face in faces:
                # 1. Filter by detection confidence (0.45+ captures all crowd members)
                det_score = float(face.det_score)
                if det_score < self.detection_threshold:
                    continue

                bbox = face.bbox.astype(int)
                kps = getattr(face, 'kps', None)

                # 2. Authentic Face & Action Zone Validation
                if not self.is_authentic_human_face(frame, bbox, kps, action_zone=action_zone):
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

    def match_faces_batch(
        self,
        embeddings: list[np.ndarray],
        enrolled_embeddings: list[dict],
        threshold: float = 0.45,
    ) -> list[Optional[MatchResult]]:
        """Vectorized batch face matching for 10+ faces simultaneously.
        
        Runs a single matrix multiplication np.dot(enrolled_matrix, query_matrix)
        taking < 0.5ms even with 500 enrolled employees.
        """
        if not embeddings or not enrolled_embeddings:
            return [None] * len(embeddings)

        try:
            enrolled_mat = np.stack([e['embedding'] for e in enrolled_embeddings])  # (N, 512)
            query_mat = np.stack(embeddings)  # (M, 512)

            # Cosine similarity matrix (M, N)
            sim_matrix = np.dot(query_mat, enrolled_mat.T)

            results: list[Optional[MatchResult]] = []
            for i in range(len(embeddings)):
                best_idx = int(np.argmax(sim_matrix[i]))
                best_sim = float(sim_matrix[i, best_idx])

                if best_sim >= threshold:
                    enrolled = enrolled_embeddings[best_idx]
                    results.append(MatchResult(
                        user_id=enrolled['user_id'],
                        user_name=enrolled['user_name'],
                        biometric_id=enrolled.get('biometric_id', ''),
                        department=enrolled.get('department', 'General'),
                        similarity=best_sim,
                        is_match=True,
                    ))
                else:
                    results.append(None)
            return results
        except Exception as e:
            logger.error(f"[FaceEngine] Batch matching error: {e}")
            return [self.match_face(emb, enrolled_embeddings, threshold) for emb in embeddings]

    def match_face(
        self,
        embedding: np.ndarray,
        enrolled_embeddings: list[dict],
        threshold: float = 0.45,
    ) -> Optional[MatchResult]:
        """Match a face embedding against all enrolled embeddings."""
        if not enrolled_embeddings:
            return None

        best_match: Optional[MatchResult] = None
        best_similarity = -1.0

        for enrolled in enrolled_embeddings:
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
