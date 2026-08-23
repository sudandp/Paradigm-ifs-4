/**
 * Client-Side Image Pre-Compression Utility
 * Compresses large camera photos (5-15MB) down to ~100-250KB before upload,
 * saving mobile bandwidth and preventing bloated Supabase Storage/S3 bills.
 */

export interface ClientCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/webp' | 'image/jpeg' | 'image/png';
}

export const CLIENT_COMPRESSION_PRESETS = {
  DOCUMENT: {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.82,
    format: 'image/webp' as const,
  },
  AVATAR: {
    maxWidth: 600,
    maxHeight: 600,
    quality: 0.80,
    format: 'image/webp' as const,
  },
  ASSET_OR_SNAG: {
    maxWidth: 1400,
    maxHeight: 1400,
    quality: 0.80,
    format: 'image/webp' as const,
  },
  THUMBNAIL: {
    maxWidth: 320,
    maxHeight: 320,
    quality: 0.75,
    format: 'image/webp' as const,
  },
};

/**
 * Checks whether a file is an image that can be compressed.
 */
export function isImageFile(file: File | Blob): boolean {
  if (!file || !file.type) return false;
  return (
    file.type.startsWith('image/') &&
    !file.type.includes('svg') &&
    !file.type.includes('gif')
  );
}

/**
 * Compresses an image File or Blob in the browser/mobile app using Canvas.
 * Returns a new compressed File object.
 */
export async function compressImageFile(
  file: File,
  options: ClientCompressionOptions = {}
): Promise<File> {
  // If not an image (e.g. PDF, Word doc) or already very small (< 150KB), return as is
  if (!isImageFile(file) || file.size < 150 * 1024) {
    return file;
  }

  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    format = 'image/webp',
  } = options;

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Calculate aspect ratio preserving bounds
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          // Fallback to original if context not available
          return resolve(file);
        }

        // Fill background with white for transparency edge-cases
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Try preferred format (webp), fallback to jpeg if not supported by browser
        const targetMime = format || 'image/webp';

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file); // Fallback on blob failure
            }

            // Only use compressed version if it is actually smaller
            if (blob.size < file.size) {
              const extension = targetMime === 'image/webp' ? '.webp' : '.jpg';
              const baseName = file.name.replace(/\.[^/.]+$/, '');
              const newFileName = `${baseName}${extension}`;

              const compressedFile = new File([blob], newFileName, {
                type: targetMime,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          targetMime,
          quality
        );
      };

      img.onerror = () => resolve(file); // Fallback to original on error
      img.src = event.target?.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses a base64 image string client-side.
 */
export async function compressBase64Client(
  base64String: string,
  options: ClientCompressionOptions = {}
): Promise<{ dataUri: string; base64: string; sizeReduction: number }> {
  if (!base64String || !base64String.startsWith('data:image')) {
    return { dataUri: base64String, base64: base64String, sizeReduction: 0 };
  }

  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    format = 'image/webp',
  } = options;

  return new Promise((resolve) => {
    const img = new Image();
    const originalLength = base64String.length;

    img.onload = () => {
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve({ dataUri: base64String, base64: base64String.split(',')[1] || '', sizeReduction: 0 });
      }

      ctx.drawImage(img, 0, 0, width, height);

      const targetMime = format || 'image/webp';
      const compressedDataUri = canvas.toDataURL(targetMime, quality);
      const compressedBase64 = compressedDataUri.split(',')[1] || '';

      const reduction = Math.max(0, Math.round(((originalLength - compressedDataUri.length) / originalLength) * 100));

      resolve({
        dataUri: compressedDataUri,
        base64: compressedBase64,
        sizeReduction: reduction,
      });
    };

    img.onerror = () => {
      resolve({ dataUri: base64String, base64: base64String.split(',')[1] || '', sizeReduction: 0 });
    };

    img.src = base64String;
  });
}
