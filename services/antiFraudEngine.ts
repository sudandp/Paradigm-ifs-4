/**
 * antiFraudEngine.ts
 * Recruiter-level anti-fraud controls for the BLUE-GUARD-2026 onboarding system.
 *
 * Responsibilities:
 * 1. GPS Audit Log — capture recruiter lat/lng on every sensitive action
 * 2. Face Match — compare live selfie against Aadhaar photo using pixel similarity
 * 3. Geo-Tagged Selfie — capture selfie with embedded GPS coordinates
 *
 * NOTE on Liveness:
 * Full blink-detection liveness via face-api.js is a Phase 2.2 future item
 * (requires loading TensorFlow models which bloats initial bundle).
 * This module implements the recruiter-GPS + face-match layer which runs today
 * with zero extra dependencies. Liveness can be bolted on top later.
 *
 * Face Match Algorithm:
 * Uses canvas pixel sampling (mean absolute error across 100 sampled pixels)
 * on greyscale 64×64 thumbnails of both images. This is NOT ML-grade — it acts
 * as a low-cost "obvious impersonation" gate. For production, replace the
 * compareImages() call with a HyperVerge face-match API call.
 */

import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecruiterGPS {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string; // ISO
  action: RecruiterAction;
  recruiterId: string;
}

export type RecruiterAction =
  | 'aadhaar_scan_start'
  | 'aadhaar_scan_confirm'
  | 'selfie_capture'
  | 'face_match'
  | 'form_submission';

export interface FaceMatchResult {
  score: number;          // 0–100; higher = more similar
  passed: boolean;        // true if score >= threshold
  threshold: number;
  method: 'pixel_sampling' | 'hyperverge_api';
  capturedAt: string;
}

export interface GeoTaggedSelfie {
  dataUrl: string;        // base64 image
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
}

// ─── 1. Recruiter GPS Capture ─────────────────────────────────────────────────

/**
 * Captures current GPS coordinates and logs to Supabase.
 * Call this at: Aadhaar scan start, confirm, selfie capture, and form submit.
 */
export async function captureRecruiterGPS(
  action: RecruiterAction,
  recruiterId: string,
  employeeId?: string,
): Promise<RecruiterGPS | null> {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 8000,
    });

    const gpsRecord: RecruiterGPS = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      capturedAt: new Date().toISOString(),
      action,
      recruiterId,
    };

    // Non-blocking Supabase write — failure must not block the onboarding flow
    supabase.from('recruiter_gps_log').insert({
      recruiter_id: recruiterId,
      employee_id: employeeId ?? null,
      action,
      latitude: gpsRecord.latitude,
      longitude: gpsRecord.longitude,
      accuracy: gpsRecord.accuracy,
      captured_at: gpsRecord.capturedAt,
    }).then(({ error }) => {
      if (error) console.warn('[AntiFraud] GPS log write failed:', error.message);
    });

    return gpsRecord;
  } catch (err) {
    // GPS permission denied or unavailable — log degraded record
    console.warn('[AntiFraud] GPS capture failed:', err);
    supabase.from('recruiter_gps_log').insert({
      recruiter_id: recruiterId,
      employee_id: employeeId ?? null,
      action,
      latitude: null,
      longitude: null,
      accuracy: null,
      error: 'GPS_UNAVAILABLE',
      captured_at: new Date().toISOString(),
    });
    return null;
  }
}

// ─── 2. Geo-Tagged Selfie Capture ─────────────────────────────────────────────

/**
 * Opens front camera, captures selfie, and embeds GPS coordinates into metadata.
 * Returns a GeoTaggedSelfie with the dataUrl and coordinates.
 */
export async function captureGeoTaggedSelfie(): Promise<GeoTaggedSelfie | null> {
  try {
    const [photo, position] = await Promise.all([
      Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        direction: CameraDirection.Front,
        promptLabelHeader: 'Take Worker Selfie',
        promptLabelPhoto: 'Take Selfie',
        promptLabelPicture: 'Take Selfie',
      }),
      Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 }),
    ]);

    if (!photo.dataUrl) return null;

    return {
      dataUrl: photo.dataUrl,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      capturedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[AntiFraud] Selfie capture failed:', err);
    return null;
  }
}

// ─── 3. Pixel-Sampling Face Match ─────────────────────────────────────────────

/**
 * Converts an image source (URL or dataUrl) to greyscale 64×64 pixel array.
 */
async function toGreyscaleThumbnail(imageSrc: string): Promise<Uint8ClampedArray | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      // Convert RGBA to greyscale
      const grey = new Uint8ClampedArray(64 * 64);
      for (let i = 0; i < grey.length; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
        grey[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }
      resolve(grey);
    };
    img.onerror = () => resolve(null);
    img.src = imageSrc;
  });
}

/**
 * Compares two images using mean absolute error on greyscale 64×64 thumbnails.
 * Score = 100 - (MAE / 255 * 100); higher = more similar.
 * Threshold: 65 (liberal — meant to catch obvious impersonation only).
 */
async function compareImages(src1: string, src2: string): Promise<number> {
  const [px1, px2] = await Promise.all([
    toGreyscaleThumbnail(src1),
    toGreyscaleThumbnail(src2),
  ]);
  if (!px1 || !px2) return 0;

  let totalError = 0;
  const sampleCount = 200;
  const step = Math.floor(px1.length / sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    totalError += Math.abs(px1[i * step] - px2[i * step]);
  }

  const mae = totalError / sampleCount;
  return Math.round(100 - (mae / 255) * 100);
}

/**
 * Runs face match between live selfie and Aadhaar photo.
 * Returns a FaceMatchResult with pass/fail verdict.
 *
 * @param selfieDataUrl  Base64 selfie from captureGeoTaggedSelfie()
 * @param aadhaarPhotoDataUrl  Base64 photo extracted from Aadhaar QR
 * @param threshold  Minimum similarity score to pass (default: 65)
 */
export async function runFaceMatch(
  selfieDataUrl: string,
  aadhaarPhotoDataUrl: string,
  threshold = 65,
): Promise<FaceMatchResult> {
  const score = await compareImages(selfieDataUrl, aadhaarPhotoDataUrl);
  return {
    score,
    passed: score >= threshold,
    threshold,
    method: 'pixel_sampling',
    capturedAt: new Date().toISOString(),
  };
}

// ─── 4. Combined Anti-Fraud Gate ─────────────────────────────────────────────

export interface AntiFraudGateResult {
  gps: RecruiterGPS | null;
  selfie: GeoTaggedSelfie | null;
  faceMatch: FaceMatchResult | null;
  overallPassed: boolean;
  failureReasons: string[];
}

/**
 * Full anti-fraud gate: capture GPS, take selfie, run face match.
 * Called immediately after Aadhaar QR scan confirmation in AadhaarScannerPage.
 *
 * @param aadhaarPhotoDataUrl  Photo extracted from Aadhaar QR (may be null for XML QR)
 * @param recruiterId  Auth user ID of the recruiter performing onboarding
 * @param employeeId  Submission UUID of the new employee
 */
export async function runAntiFraudGate(
  aadhaarPhotoDataUrl: string | null,
  recruiterId: string,
  employeeId?: string,
): Promise<AntiFraudGateResult> {
  const failureReasons: string[] = [];

  // Step 1: GPS
  const gps = await captureRecruiterGPS('face_match', recruiterId, employeeId);
  if (!gps) failureReasons.push('GPS unavailable — location audit degraded');

  // Step 2: Selfie
  const selfie = await captureGeoTaggedSelfie();
  if (!selfie) {
    failureReasons.push('Selfie capture failed — camera access denied');
    return { gps, selfie: null, faceMatch: null, overallPassed: false, failureReasons };
  }

  // Step 3: Face Match (only if Aadhaar has photo)
  let faceMatch: FaceMatchResult | null = null;
  if (aadhaarPhotoDataUrl) {
    faceMatch = await runFaceMatch(selfie.dataUrl, aadhaarPhotoDataUrl);
    if (!faceMatch.passed) {
      failureReasons.push(
        `Face match score ${faceMatch.score}/100 below threshold ${faceMatch.threshold} — possible impersonation`
      );
    }
  } else {
    // No Aadhaar photo available (XML QR doesn't embed photo)
    failureReasons.push('No Aadhaar photo in QR — face match skipped, selfie retained for manual review');
  }

  const overallPassed = failureReasons.length === 0 || (
    // Allow through with GPS warning alone (non-blocking)
    failureReasons.every(r => r.includes('GPS'))
  );

  return { gps, selfie, faceMatch, overallPassed, failureReasons };
}
