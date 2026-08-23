import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  fit?: 'inside' | 'cover' | 'contain' | 'fill';
  withoutEnlargement?: boolean;
}

export interface CompressionResult {
  buffer: Buffer;
  mimeType: string;
  format: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
}

// Preset configurations for different use cases
export const COMPRESSION_PRESETS = {
  // Document scans & ID proofs (Aadhaar, PAN, Certificates, Invoices)
  DOCUMENT: {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 82,
    format: 'webp' as const,
    withoutEnlargement: true,
  },
  // Profile photos / avatars
  AVATAR: {
    maxWidth: 600,
    maxHeight: 600,
    quality: 80,
    format: 'webp' as const,
    withoutEnlargement: true,
  },
  // Snag audit / Maintenance / Asset photos
  ASSET_OR_SNAG: {
    maxWidth: 1400,
    maxHeight: 1400,
    quality: 80,
    format: 'webp' as const,
    withoutEnlargement: true,
  },
  // Small preview thumbnails
  THUMBNAIL: {
    maxWidth: 320,
    maxHeight: 320,
    quality: 75,
    format: 'webp' as const,
    withoutEnlargement: true,
  },
};

/**
 * Checks whether a MIME type or file extension corresponds to a compressible image.
 */
export function isCompressibleImage(mimeOrExt: string): boolean {
  if (!mimeOrExt) return false;
  const lower = mimeOrExt.toLowerCase();
  return (
    lower.includes('image/jpeg') ||
    lower.includes('image/jpg') ||
    lower.includes('image/png') ||
    lower.includes('image/webp') ||
    lower.includes('image/heic') ||
    lower.includes('image/heif') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.heic') ||
    lower.endsWith('.heif')
  );
}

/**
 * Compresses an image Buffer using sharp.
 */
export async function compressImageBuffer(
  inputBuffer: Buffer,
  options: ImageCompressionOptions = {}
): Promise<CompressionResult> {
  const originalSize = inputBuffer.byteLength;
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 82,
    format = 'webp',
    fit = 'inside',
    withoutEnlargement = true,
  } = options;

  let pipeline = sharp(inputBuffer, { failOn: 'none' });

  // 1. Auto-rotate based on EXIF orientation (critical for mobile camera photos)
  pipeline = pipeline.rotate();

  // 2. Resize while maintaining aspect ratio
  pipeline = pipeline.resize({
    width: maxWidth,
    height: maxHeight,
    fit,
    withoutEnlargement,
  });

  // 3. Format conversion and quality compression
  let mimeType = 'image/webp';
  if (format === 'webp') {
    pipeline = pipeline.webp({ quality, effort: 4, smartSubsample: true });
    mimeType = 'image/webp';
  } else if (format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality, progressive: true, mozjpeg: true });
    mimeType = 'image/jpeg';
  } else if (format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 8, adaptiveFiltering: true });
    mimeType = 'image/png';
  }

  const { data: outputBuffer, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const compressedSize = outputBuffer.byteLength;
  const reductionPercentage = originalSize > 0 
    ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100)) 
    : 0;

  return {
    buffer: outputBuffer,
    mimeType,
    format: info.format,
    width: info.width,
    height: info.height,
    originalSize,
    compressedSize,
    reductionPercentage,
  };
}

/**
 * Compresses a Base64-encoded image string.
 * Supports both raw base64 and data URI schemes (data:image/...;base64,...).
 */
export async function compressBase64Image(
  base64String: string,
  options: ImageCompressionOptions = {}
): Promise<{
  base64: string;
  dataUri: string;
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
}> {
  if (!base64String) {
    throw new Error('Empty base64 string provided');
  }

  // Extract base64 payload if it's a data URI
  let cleanBase64 = base64String;

  if (base64String.startsWith('data:')) {
    const match = base64String.match(/^data:[^;]+;base64,(.*)$/);
    if (match) {
      cleanBase64 = match[1];
    }
  }

  const inputBuffer = Buffer.from(cleanBase64, 'base64');
  const result = await compressImageBuffer(inputBuffer, options);

  const outputBase64 = result.buffer.toString('base64');
  const dataUri = `data:${result.mimeType};base64,${outputBase64}`;

  return {
    base64: outputBase64,
    dataUri,
    mimeType: result.mimeType,
    originalSize: result.originalSize,
    compressedSize: result.compressedSize,
    reductionPercentage: result.reductionPercentage,
  };
}

/**
 * Compresses an image and uploads it directly to Supabase Storage.
 */
export async function compressAndUploadToSupabase(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string,
  inputBuffer: Buffer,
  options: ImageCompressionOptions = {}
): Promise<{
  publicUrl: string;
  storagePath: string;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
  mimeType: string;
}> {
  const result = await compressImageBuffer(inputBuffer, options);

  // If format changed to webp and storagePath has an extension, normalize path
  let finalPath = storagePath;
  if (options.format === 'webp' || !options.format) {
    finalPath = storagePath.replace(/\.(jpe?g|png|heic|heif)$/i, '.webp');
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(finalPath, result.buffer, {
      contentType: result.mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(finalPath);

  return {
    publicUrl: data?.publicUrl || '',
    storagePath: finalPath,
    originalSize: result.originalSize,
    compressedSize: result.compressedSize,
    reductionPercentage: result.reductionPercentage,
    mimeType: result.mimeType,
  };
}
