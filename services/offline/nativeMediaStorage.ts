/**
 * nativeMediaStorage.ts — Paradigm Mobile Offline Media Durability Service
 *
 * Implements Phase 4 native camera photo durability and storage quota defense:
 * 1. Immediately copies raw camera captures to permanent sandbox storage (Filesystem.Directory.Data)
 *    so the OS never evicts them while offline (unlike temporary cache URIs).
 * 2. Generates lightweight client thumbnails (50-100KB) for instant UI previews & offline inspection.
 * 3. Enforces the Standard Enterprise Hybrid approach: Once Supabase Storage confirms upload,
 *    purges the multi-megabyte raw photo from disk while retaining the local thumbnail.
 */

import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { assertStorageQuotaAvailable } from './storageQuota';

export interface DurablePhotoResult {
  /** Permanent file identifier / relative path in Directory.Data */
  permanentPath: string;
  /** Full filesystem URI or web path for <img> tags */
  displayUri: string;
  /** Lightweight compressed Base64 data URL for instant offline cards & sync review */
  thumbnailDataUrl: string;
  /** File size in bytes */
  sizeBytes: number;
}

const MEDIA_SUBDIRECTORY = 'paradigm_offline_media';

/**
 * Ensures the dedicated offline media folder exists in Directory.Data
 */
async function ensureMediaDirectory(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Filesystem.mkdir({
      path: MEDIA_SUBDIRECTORY,
      directory: Directory.Data,
      recursive: true,
    });
  } catch (err: any) {
    // Ignore error if directory already exists
    if (!/exists/i.test(err?.message || '')) {
      console.warn('[NativeMedia] Failed to create media directory:', err);
    }
  }
}

/**
 * Creates a lightweight JPEG thumbnail (max 320x320, ~40-80KB) from a Base64 or DataURL string
 * using standard HTML Canvas.
 */
export async function generateThumbnail(dataUrl: string, maxDim: number = 320): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return dataUrl.slice(0, 500); // Node/Test environment fallback
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.65));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Saves a captured photo into permanent sandbox storage (Directory.Data)
 * and generates a lightweight thumbnail for immediate offline rendering.
 */
export async function savePhotoToDurableStorage(
  rawPhotoData: string,
  suggestedFileName?: string
): Promise<DurablePhotoResult> {
  const fileId = crypto.randomUUID();
  const fileName = suggestedFileName || `snap_${Date.now()}_${fileId.slice(0, 8)}.jpg`;
  const relativePath = `${MEDIA_SUBDIRECTORY}/${fileName}`;

  // 1. Generate lightweight thumbnail
  const thumbnailDataUrl = await generateThumbnail(rawPhotoData);
  const sizeBytes = Math.round((rawPhotoData.length * 3) / 4);

  // Assert storage capacity before writing to avoid silent OS failures (Phase 5)
  await assertStorageQuotaAvailable(sizeBytes);

  // In web browsers, return the in-memory data URL directly
  if (!Capacitor.isNativePlatform()) {
    return {
      permanentPath: relativePath,
      displayUri: rawPhotoData,
      thumbnailDataUrl,
      sizeBytes,
    };
  }

  // 2. On native Android/iOS, persist bytes to Directory.Data
  await ensureMediaDirectory();

  // Strip Data URL prefix if present for binary write
  const base64Data = rawPhotoData.includes(',')
    ? rawPhotoData.split(',')[1]
    : rawPhotoData;

  const writeResult = await Filesystem.writeFile({
    path: relativePath,
    data: base64Data,
    directory: Directory.Data,
    recursive: true,
  });

  return {
    permanentPath: relativePath,
    displayUri: writeResult.uri || relativePath,
    thumbnailDataUrl,
    sizeBytes,
  };
}

/**
 * Reads a previously saved durable photo from Directory.Data as a Data URL.
 */
export async function readDurablePhoto(permanentPath: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const file = await Filesystem.readFile({
      path: permanentPath,
      directory: Directory.Data,
    });

    const base64 = typeof file.data === 'string' ? file.data : '';
    return base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
  } catch (err) {
    console.warn(`[NativeMedia] Failed to read durable photo at ${permanentPath}:`, err);
    return null;
  }
}

/**
 * Standard Enterprise Post-Sync Cleanup:
 * Removes raw full-resolution photos from Directory.Data once the cloud confirms receipt,
 * preserving precious internal flash storage while local thumbnails remain in cache.
 */
export async function cleanupPermanentPhotoAfterSync(permanentPath: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    await Filesystem.deleteFile({
      path: permanentPath,
      directory: Directory.Data,
    });
    console.info(`[NativeMedia] Purged post-sync photo from local disk: ${permanentPath}`);
    return true;
  } catch (err) {
    console.warn(`[NativeMedia] Non-fatal photo purge failure for ${permanentPath}:`, err);
    return false;
  }
}
