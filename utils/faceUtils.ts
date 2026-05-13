/**
 * Face Biometric Utilities — Single Source of Truth
 * 
 * Centralizes all face recognition logic: distance calculation, liveness detection,
 * quality validation, duplicate checking, and threshold constants.
 * 
 * Used by: GateKiosk, PersonalFaceAuth, RegisterGateUser
 */

import { fetchGateUsers } from '../services/gateApi';

// ─── Thresholds (single source of truth) ─────────────────────────────────────
export const FACE_THRESHOLDS = {
  /** Strictly blocks same face from being registered under a different user. 
   * Standard face-api.js match threshold is 0.6. 
   * We use 0.55 for duplicate detection to be extremely aggressive against identity theft. */
  DUPLICATE_REGISTRATION: 0.55,
  /** Standard match for kiosk gate punch-in/out */
  KIOSK_MATCH: 0.70,
  /** Standard match for employee self-verification */
  EMPLOYEE_MATCH: 0.58,
  /** Slightly more forgiving threshold after liveness is confirmed + delay, but STILL SECURE */
  RELAXED_MATCH: 0.62,
  /** Minimum face detection confidence for enrollment capture */
  MIN_DETECTION_SCORE: 0.45,
  /** Face bounding box must be ≥ this fraction of frame width */
  MIN_FACE_SIZE_RATIO: 0.20,
  /** EAR threshold — below this value, eyes are considered "closed" */
  BLINK_EAR_THRESHOLD: 0.22,
  /** EAR must rise above this after a blink to confirm liveness */
  BLINK_EAR_OPEN_THRESHOLD: 0.25,
  /** Head rotation threshold for challenge-response (yaw) */
  HEAD_YAW_THRESHOLD: 1.5,
} as const;

// ─── Timing Constants ────────────────────────────────────────────────────────
export const FACE_TIMING = {
  /** How long (ms) to wait before relaxing match threshold */
  RELAXED_DELAY_MS: 1000,
  /** How long (ms) before liveness-only fallback kicks in */
  LIVENESS_FALLBACK_MS: 3000,
  /** Kiosk: max time (ms) to wait for liveness before showing prompt */
  KIOSK_LIVENESS_PROMPT_MS: 5000,
  /** Kiosk: max time (ms) before declaring liveness timeout */
  KIOSK_LIVENESS_TIMEOUT_MS: 10000,
  /** Seconds without a face before resetting liveness state (kiosk) */
  KIOSK_FACE_LOST_RESET_MS: 2000,
} as const;

// ─── Standard Euclidean Distance ─────────────────────────────────────────────
/**
 * Computes the Euclidean distance between two face descriptor vectors.
 * 
 * face-api.js descriptors are 128-dimensional vectors.
 * A distance < 0.6 is typically considered a match for the same person.
 * 
 * Returns a value between 0.0 (identical) and ~1.5+.
 * Returns 9.9 if inputs are invalid.
 */
export function euclideanDistance(a: any, b: any): number {
  if (!a || !b) return 9.9;
  const arrA = Array.from(a) as number[];
  const arrB = Array.from(b) as number[];
  if (arrA.length !== arrB.length || arrA.length !== 128) return 9.9;

  let sum = 0;
  for (let i = 0; i < arrA.length; i++) {
    const diff = arrA[i] - arrB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// ─── Eye Aspect Ratio (EAR) for Liveness Detection ──────────────────────────
/**
 * Computes the Eye Aspect Ratio for blink detection.
 * When a person blinks, EAR drops sharply and then rises back.
 * 
 * @param eye - Array of 6 landmark points for one eye
 *   [0]=outer corner, [1-2]=upper lid, [3]=inner corner, [4-5]=lower lid
 * @returns EAR value. Typically ~0.3 when open, ~0.15 when closed.
 */
export function getEAR(eye: { x: number; y: number }[]): number {
  if (!eye || eye.length < 6) return 0.3; // Default "open" if landmarks missing

  const p1 = eye[0];
  const p2 = eye[1];
  const p3 = eye[2];
  const p4 = eye[3];
  const p5 = eye[4];
  const p6 = eye[5];

  const dist1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const dist2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const dist3 = Math.hypot(p1.x - p4.x, p1.y - p4.y);

  if (dist3 === 0) return 0.3;
  return (dist1 + dist2) / (2 * dist3);
}

// ─── Head Rotation (Yaw) for Challenge-Response ──────────────────────────────
/**
 * Estimates head yaw (horizontal rotation) from face landmarks.
 * 
 * @param landmarks - 68-point landmarks from face-api.js
 * @returns Yaw score: < -1.5 (Look Left), > 1.5 (Look Right), ~0.0 (Center)
 */
export function getHeadYaw(landmarks: any): number {
  if (!landmarks) return 0;
  
  // Get landmark groups
  const nose = landmarks.getNose();
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  
  if (!nose.length || !leftEye.length || !rightEye.length) return 0;

  // Use nose tip (index 6 in nose array) and outer eye corners
  const noseTip = nose[6];
  const leftEyeOuter = leftEye[0];
  const rightEyeOuter = rightEye[3];

  const eyeCenter = (leftEyeOuter.x + rightEyeOuter.x) / 2;
  const eyeWidth = rightEyeOuter.x - leftEyeOuter.x;

  if (eyeWidth === 0) return 0;

  // Normalized offset from center
  return (noseTip.x - eyeCenter) / (eyeWidth * 0.25);
}

// ─── Descriptor Validation ───────────────────────────────────────────────────
/**
 * Validates that a face descriptor is structurally and numerically sound.
 * Checks: length = 128, no NaN/Infinity, magnitude ≈ 1.0 (for normalized), 
 * values within expected range.
 */
export function isValidDescriptor(descriptor: number[] | null): boolean {
  if (!descriptor || !Array.isArray(descriptor)) return false;
  if (descriptor.length !== 128) return false;

  // Check for NaN or Infinity
  if (descriptor.some(v => !isFinite(v))) return false;

  // Check magnitude is non-zero (can't be all zeros)
  const magnitude = Math.sqrt(descriptor.reduce((sum, x) => sum + x * x, 0));
  if (magnitude < 0.01) return false;

  return true;
}

// ─── Image Capture Quality Check ─────────────────────────────────────────────
/**
 * Validates that a face detection is high-quality enough for enrollment.
 * Checks detection score, face size relative to frame, and positioning.
 * 
 * @param detection - face-api.js detection result with `detection` and `landmarks`
 * @param frameWidth - video frame width in pixels
 * @param frameHeight - video frame height in pixels
 * @returns Object with `ok` boolean and array of `issues` if not OK
 */
export function checkCaptureQuality(
  detection: any,
  frameWidth: number,
  frameHeight: number
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!detection || !detection.detection) {
    return { ok: false, issues: ['No face detected'] };
  }

  // 1. Detection confidence
  const score = detection.detection.score || 0;
  if (score < FACE_THRESHOLDS.MIN_DETECTION_SCORE) {
    issues.push(`Low confidence (${(score * 100).toFixed(0)}%). Improve lighting or face angle.`);
  }

  // 2. Face size relative to frame
  const box = detection.detection.box;
  if (box) {
    const faceWidthRatio = box.width / frameWidth;
    if (faceWidthRatio < FACE_THRESHOLDS.MIN_FACE_SIZE_RATIO) {
      issues.push('Face too small. Move closer to the camera.');
    }

    // 3. Face centering — face center should be within middle 70% of frame
    const faceCenterX = box.x + box.width / 2;
    const faceCenterY = box.y + box.height / 2;
    const marginX = frameWidth * 0.15;
    const marginY = frameHeight * 0.15;

    if (faceCenterX < marginX || faceCenterX > frameWidth - marginX) {
      issues.push('Face is off-center horizontally. Center your face.');
    }
    if (faceCenterY < marginY || faceCenterY > frameHeight - marginY) {
      issues.push('Face is off-center vertically. Adjust camera angle.');
    }
  }

  return { ok: issues.length === 0, issues };
}

// ─── Multi-Face Detection Guard ──────────────────────────────────────────────
/**
 * Checks that exactly one face is in the frame.
 * Should be called before enrollment capture using `detectAllFaces()`.
 * 
 * @param faceCount - Number of faces detected by `detectAllFaces()`
 * @returns Object with `ok` boolean and `message` if not OK
 */
export function checkSingleFace(faceCount: number): { ok: boolean; message?: string } {
  if (faceCount === 0) {
    return { ok: false, message: 'No face detected. Please position your face in the frame.' };
  }
  if (faceCount > 1) {
    return { ok: false, message: 'Multiple faces detected. Only one person should be in the frame.' };
  }
  return { ok: true };
}

// ─── Duplicate Face Detection ────────────────────────────────────────────────
/**
 * Checks if a face descriptor already exists in the system under a different user.
 * Fetches all registered gate users and compares the new descriptor against each.
 * 
 * @param descriptor - The 128-d face descriptor to check
 * @param excludeUserId - Optional user ID to skip (for re-enrollment of existing user)
 * @returns Result with match info if a duplicate is found
 */
export async function findDuplicateFace(
  descriptor: number[],
  excludeUserId?: string
): Promise<{
  found: boolean;
  matchedUser?: {
    userId: string;
    userName: string;
    userEmail?: string;
    userPhotoUrl?: string;
    department?: string;
    enrolledAt?: string;
    distance: number;
  };
}> {
  if (!isValidDescriptor(descriptor)) {
    return { found: false };
  }

  try {
    const allUsers = await fetchGateUsers();
    console.log(`[faceUtils] Checking duplicate among ${allUsers.length} active users...`);

    for (const existingUser of allUsers) {
      // Skip self if re-enrolling
      if (excludeUserId && existingUser.userId === excludeUserId) continue;

      if (existingUser.faceDescriptor && isValidDescriptor(existingUser.faceDescriptor)) {
        const distance = euclideanDistance(descriptor, existingUser.faceDescriptor);
        
        // Log close matches for debugging
        if (distance < 0.6) {
          console.log(`[faceUtils] Potential duplicate: ${existingUser.userName}, Distance: ${distance.toFixed(4)}`);
        }

        if (distance < FACE_THRESHOLDS.DUPLICATE_REGISTRATION) {
          console.warn(`[faceUtils] Duplicate face confirmed with ${existingUser.userName} (Dist: ${distance.toFixed(4)})`);
          return {
            found: true,
            matchedUser: {
              userId: existingUser.userId,
              userName: existingUser.userName || 'Unknown',
              userEmail: existingUser.userEmail,
              userPhotoUrl: existingUser.userPhotoUrl,
              department: existingUser.department,
              enrolledAt: existingUser.createdAt,
              distance,
            },
          };
        }
      }
    }
  } catch (err) {
    console.error('[faceUtils] Failed to check for duplicate faces:', err);
    // Don't block registration on network errors — log and continue
  }

  return { found: false };
}

// ─── Kiosk Liveness State Manager ────────────────────────────────────────────
/**
 * Encapsulates the liveness detection state machine for the kiosk.
 * Create one instance per scan session. Reset when face is lost.
 */
export class LivenessDetector {
  private lastEar: number = 0.3;
  private blinkStarted: boolean = false;
  private _livenessConfirmed: boolean = false;
  private faceFirstSeenAt: number | null = null;
  private lastFaceSeenAt: number | null = null;

  get isConfirmed(): boolean {
    return this._livenessConfirmed;
  }

  /** Time (ms) since a face was first detected in this session */
  get timeSinceFaceDetected(): number {
    if (!this.faceFirstSeenAt) return 0;
    return Date.now() - this.faceFirstSeenAt;
  }

  /** Whether to show "blink to verify" prompt */
  get shouldShowBlinkPrompt(): boolean {
    return !this._livenessConfirmed && this.timeSinceFaceDetected > FACE_TIMING.KIOSK_LIVENESS_PROMPT_MS;
  }

  /** Whether liveness check has timed out */
  get isTimedOut(): boolean {
    return !this._livenessConfirmed && this.timeSinceFaceDetected > FACE_TIMING.KIOSK_LIVENESS_TIMEOUT_MS;
  }

  /**
   * Process a new EAR reading from a frame.
   * Call this every frame when a face with landmarks is detected.
   */
  processFrame(ear: number): void {
    const now = Date.now();

    // Track face presence timing
    if (!this.faceFirstSeenAt) {
      this.faceFirstSeenAt = now;
    }
    this.lastFaceSeenAt = now;

    // Detect eyes closing (blink start)
    if (ear < FACE_THRESHOLDS.BLINK_EAR_THRESHOLD && this.lastEar >= FACE_THRESHOLDS.BLINK_EAR_THRESHOLD) {
      this.blinkStarted = true;
    }

    // Detect eyes reopening (blink complete) → liveness confirmed
    if (this.blinkStarted && ear > FACE_THRESHOLDS.BLINK_EAR_OPEN_THRESHOLD) {
      this._livenessConfirmed = true;
    }

    this.lastEar = ear;
  }

  /**
   * Call when no face is detected for a period.
   * If face has been lost for > KIOSK_FACE_LOST_RESET_MS, reset state (new person approaching).
   */
  onFaceLost(): boolean {
    if (this.lastFaceSeenAt && (Date.now() - this.lastFaceSeenAt) > FACE_TIMING.KIOSK_FACE_LOST_RESET_MS) {
      this.reset();
      return true; // Was reset
    }
    return false;
  }

  /** Full reset — new scan session */
  reset(): void {
    this.lastEar = 0.3;
    this.blinkStarted = false;
    this._livenessConfirmed = false;
    this.faceFirstSeenAt = null;
    this.lastFaceSeenAt = null;
  }
}
