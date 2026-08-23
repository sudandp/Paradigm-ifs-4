import { encode, decode, isBlurhashValid } from 'blurhash';

/**
 * Cache for decoded BlurHash canvas data URLs to prevent redundant re-decoding.
 */
const blurhashDataUrlCache = new Map<string, string>();

/**
 * Generates a deterministic, aesthetically pleasing BlurHash string based on a string seed (e.g. user ID, name, or filename).
 * Uses a soft pastel gradient palette so unloaded images always render a warm, branded placeholder.
 */
export function generateDeterministicBlurhash(seed: string = 'default'): string {
  // Preset collection of rich, modern, harmonious blurhash strings (blues, emeralds, warm ambers, indigos, dark teal)
  const PRESET_HASHES = [
    'L6PZfSi_.AyE_3t7t7R**0o#DgR4', // Cool slate/teal
    'LKO2:N%2Tw=w]~s:%2S4wcWBRjof', // Emerald & forest green
    'L5H2EC=~00_400%M%MD%00~q_3%M', // Deep graphite/midnight
    'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.', // Soft sky/indigo
    'L8Nm~?_300-;00%M%Mof00~q_3%M', // Modern dark emerald
    'L7I#^i?b00_300-;00%M00~q_3%M', // Slate navy
    'LJIX*Q00_300~q00%M%M00_3%M%M', // Royal blue & emerald
    'LBC$?4~q00_300%M%M%M00_3%M%M', // Clean modern subtle dark
    'L9KnWJ~q00_300%M%M%M00_3%M%M', // Neutral modern dark green
  ];

  if (!seed) return PRESET_HASHES[0];

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % PRESET_HASHES.length;
  return PRESET_HASHES[index];
}

/**
 * Validates whether a given string is a syntactically valid BlurHash.
 */
export function isValidBlurhash(blurhash?: string | null): boolean {
  if (!blurhash || typeof blurhash !== 'string' || blurhash.length < 6) {
    return false;
  }
  try {
    const check = isBlurhashValid(blurhash);
    return check.result;
  } catch {
    return false;
  }
}

/**
 * Decodes a BlurHash string to a raw RGBA Uint8ClampedArray.
 */
export function decodeBlurhash(
  blurhash: string,
  width: number = 32,
  height: number = 32,
  punch: number = 1
): Uint8ClampedArray | null {
  try {
    if (!isValidBlurhash(blurhash)) return null;
    return decode(blurhash, width, height, punch);
  } catch (error) {
    console.warn('Failed to decode blurhash:', blurhash, error);
    return null;
  }
}

/**
 * Renders a BlurHash onto an HTMLCanvasElement.
 */
export function renderBlurhashToCanvas(
  blurhash: string,
  canvas: HTMLCanvasElement,
  width: number = 32,
  height: number = 32
): boolean {
  try {
    const pixels = decodeBlurhash(blurhash, width, height);
    if (!pixels) return false;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    return true;
  } catch (err) {
    console.warn('Error rendering blurhash to canvas:', err);
    return false;
  }
}

/**
 * Decodes a BlurHash to a cached base64 PNG data URL for direct use in CSS background or img src.
 */
export function getBlurhashDataUrl(
  blurhash: string,
  width: number = 32,
  height: number = 32
): string | null {
  const cacheKey = `${blurhash}_${width}x${height}`;
  if (blurhashDataUrlCache.has(cacheKey)) {
    return blurhashDataUrlCache.get(cacheKey)!;
  }

  if (typeof document === 'undefined') return null;

  try {
    const canvas = document.createElement('canvas');
    const success = renderBlurhashToCanvas(blurhash, canvas, width, height);
    if (!success) return null;

    const dataUrl = canvas.toDataURL('image/png');
    blurhashDataUrlCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

/**
 * Encodes an HTMLImageElement, File, or Blob into a BlurHash string on the client side.
 */
export async function encodeImageToBlurhash(
  source: HTMLImageElement | File | Blob | string,
  componentX: number = 4,
  componentY: number = 3
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      let objectUrlToRevoke: string | null = null;

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          // Scale down to max 64x64 for lightning-fast blurhash computation
          const targetWidth = 64;
          const targetHeight = Math.max(1, Math.round((img.height / img.width) * targetWidth));
          
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          const hash = encode(imageData.data, targetWidth, targetHeight, componentX, componentY);
          
          if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
          resolve(hash);
        } catch (err) {
          console.warn('Error encoding image to blurhash:', err);
          if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
          resolve(null);
        }
      };

      img.onerror = () => {
        if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
        resolve(null);
      };

      if (typeof source === 'string') {
        img.src = source;
      } else if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
        img.src = source.src;
      } else if (typeof Blob !== 'undefined' && source instanceof Blob) {
        objectUrlToRevoke = URL.createObjectURL(source);
        img.src = objectUrlToRevoke;
      } else {
        resolve(null);
      }
    } catch {
      resolve(null);
    }
  });
}
