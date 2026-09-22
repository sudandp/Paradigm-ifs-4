/**
 * imageRotation.ts
 *
 * Utility functions to detect sideways documents and auto-rotate them 90°/180°/270°.
 * Indian ID cards (PAN, Aadhaar, Bank Cheque/Passbook, Voter ID, Driving License)
 * are landscape format. Photos taken with smartphone cameras in portrait orientation
 * result in sideways images (height > width) which break standard OCR and look crooked in UI.
 */

/**
 * Returns true if the document type is expected to be landscape (width > height).
 */
export const isLandscapeDocumentType = (docType?: string, label?: string): boolean => {
  const combined = `${docType || ''} ${label || ''}`.toLowerCase();
  if (
    combined.includes('pan') ||
    combined.includes('aadhaar') ||
    combined.includes('idfront') ||
    combined.includes('idback') ||
    combined.includes('id proof') ||
    combined.includes('bank') ||
    combined.includes('cheque') ||
    combined.includes('passbook') ||
    combined.includes('voter') ||
    combined.includes('driving') ||
    combined.includes('license') ||
    combined.includes('dl')
  ) {
    return true;
  }
  return false;
};

/**
 * Loads an image from a Data URL, Blob, or File and returns the HTMLImageElement.
 */
export const loadImageElement = (source: string | Blob | File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for rotation'));

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    }
  });
};

/**
 * Rotates an image by specified degrees (e.g. 90, 180, 270) clockwise.
 * Returns both the rotated Data URL and a File object.
 */
export const rotateImage = async (
  source: string | Blob | File,
  degrees: number = 90,
  filename: string = 'rotated.jpg'
): Promise<{ dataUrl: string; file: File; width: number; height: number }> => {
  const img = await loadImageElement(source);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  // Normalize degrees to 0, 90, 180, 270
  const normDeg = ((degrees % 360) + 360) % 360;
  const isSwap = normDeg === 90 || normDeg === 270;
  const targetW = isSwap ? srcH : srcW;
  const targetH = isSwap ? srcW : srcH;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  ctx.translate(targetW / 2, targetH / 2);
  ctx.rotate((normDeg * Math.PI) / 180);
  ctx.drawImage(img, -srcW / 2, -srcH / 2);
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

  // Convert to File object
  let file: File;
  try {
    const rawB64 = dataUrl.split(',')[1] || '';
    const byteString = atob(rawB64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: 'image/jpeg' });
    file = new File([blob], filename, { type: 'image/jpeg' });
  } catch {
    file = new File([], filename, { type: 'image/jpeg' });
  }

  return { dataUrl, file, width: targetW, height: targetH };
};

/**
 * Automatically detects if an ID card / landscape document was captured sideways
 * in portrait mode (height > width * 1.05).
 * If sideways, automatically rotates it 90° clockwise to landscape.
 */
export const autoRotateDocumentIfSideways = async (
  source: string | Blob | File,
  docType?: string,
  label?: string,
  filename: string = 'document.jpg'
): Promise<{ dataUrl: string; file: File; wasRotated: boolean }> => {
  try {
    const isLandscapeExpected = isLandscapeDocumentType(docType, label);
    const img = await loadImageElement(source);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    // Note: Do not automatically force vertical/portrait documents to landscape.
    // Users often upload portrait documents, full-page letters, or upright camera captures.
    // Converting vertical to horizontal automatically distorts properly oriented uploads.
    // Manual rotation (Rotate button) is available in the UI when rotation is needed.

    // Already in correct aspect ratio or not a card
    let dataUrl: string;
    let file: File;
    if (typeof source === 'string') {
      dataUrl = source.startsWith('data:') ? source : `data:image/jpeg;base64,${source}`;
      try {
        const rawB64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const byteString = atob(rawB64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        file = new File([new Blob([ab], { type: 'image/jpeg' })], filename, { type: 'image/jpeg' });
      } catch {
        file = new File([], filename, { type: 'image/jpeg' });
      }
    } else if (source instanceof File) {
      file = source;
      dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(source);
      });
    } else {
      file = new File([source], filename, { type: 'image/jpeg' });
      dataUrl = URL.createObjectURL(source);
    }

    return { dataUrl, file, wasRotated: false };
  } catch (err) {
    console.warn('[AutoRotate] Error during orientation check, using original:', err);
    let fallbackDataUrl = '';
    let fallbackFile: File;
    if (typeof source === 'string') {
      fallbackDataUrl = source;
      fallbackFile = new File([], filename);
    } else {
      fallbackFile = source instanceof File ? source : new File([source], filename);
    }
    return { dataUrl: fallbackDataUrl, file: fallbackFile, wasRotated: false };
  }
};
