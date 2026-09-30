import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Safely sanitizes a filename for Windows, macOS, and Linux filesystems.
 * Strips invalid characters: \ / : * ? " < > | and control characters.
 */
export function sanitizeFileName(name: string): string {
  if (!name) return 'document';
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Triggers a native web browser file download reliably across all modern browsers (Chrome, Edge, Safari, Firefox).
 * 
 * Why this is needed instead of bare `fileSaver.saveAs` or immediate `URL.revokeObjectURL`:
 * 1. Chrome/Chromium on Windows requires the `<a>` element to be connected to the DOM (`document.body.appendChild`)
 *    for the `download` attribute to be respected when downloading Blob URLs.
 * 2. Chromium initiates file downloads asynchronously in its browser download manager. If `URL.revokeObjectURL`
 *    is called immediately after `a.click()`, Chromium's download engine finds the Blob URL revoked,
 *    causing it to fail or fall back to the internal Blob UUID (e.g. `f19f42ad-a1c8-47e9...`) with no file extension!
 * 3. Keeping the Blob URL active and delaying revocation by 60 seconds guarantees the browser download engine
 *    has fully resolved the file metadata, proper filename, and streamed the payload.
 */
export function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const cleanName = sanitizeFileName(fileName);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.style.display = 'none';
  link.href = url;
  link.download = cleanName;
  link.setAttribute('download', cleanName);

  document.body.appendChild(link);

  try {
    link.click();
  } catch (err) {
    console.error('[triggerBrowserDownload] Click dispatch failed:', err);
  }

  // Chrome on Windows requires the Blob URL to remain valid until the browser
  // download manager completes transferring the blob data. If revoked immediately,
  // Chrome falls back to using the internal Blob UUID with no file extension.
  setTimeout(() => {
    try {
      if (link.parentNode) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    } catch {
      // Ignored
    }
  }, 60000);
}

/**
 * Converts a Blob or ArrayBuffer to a Base64 string for Capacitor Filesystem write.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Remove data URL prefix (e.g. "data:application/octet-stream;base64,")
      const base64 = dataUrl.split(',')[1] || dataUrl;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Universal file download & share adapter with 100% web & native parity.
 *
 * - On Web: uses DOM-attached download anchor with delayed URL revocation so Chrome / Chromium
 *   never falls back to raw UUIDs and preserves the exact filename & extension.
 * - On Native (Android / iOS): writes file to Cache/Documents via @capacitor/filesystem
 *   and invokes the native system Share Sheet via @capacitor/share so users can
 *   view, open in external apps (Excel, PDF viewer), or save to device storage.
 */
export async function downloadFile(
  data: Blob | ArrayBuffer | Uint8Array | string,
  fileName: string,
  mimeType?: string
): Promise<void> {
  const cleanName = sanitizeFileName(fileName);

  if (!Capacitor.isNativePlatform()) {
    // Web Browser execution
    let blob: Blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (typeof data === 'string') {
      if (data.startsWith('data:')) {
        const parts = data.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const resolvedMime = mimeType || (mimeMatch ? mimeMatch[1] : 'application/octet-stream');
        const binaryStr = atob(parts[1]);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: resolvedMime });
      } else {
        blob = new Blob([data], { type: mimeType || 'text/plain;charset=utf-8' });
      }
    } else {
      blob = new Blob([data as any], { type: mimeType || 'application/octet-stream' });
    }

    triggerBrowserDownload(blob, cleanName);
    return;
  }

  // Native Mobile (Capacitor) execution
  try {
    let base64Data: string;

    if (typeof data === 'string') {
      if (data.startsWith('data:')) {
        base64Data = data.split(',')[1];
      } else {
        base64Data = data;
      }
    } else if (data instanceof Blob) {
      base64Data = await blobToBase64(data);
    } else {
      const blob = new Blob([data as any], { type: mimeType || 'application/octet-stream' });
      base64Data = await blobToBase64(blob);
    }

    // Write file to Cache directory first for fast access & sharing
    const result = await Filesystem.writeFile({
      path: cleanName,
      data: base64Data,
      directory: Directory.Cache,
    });

    const fileUri = result.uri;

    // Check if system share is available
    const canShare = await Share.canShare().then(r => r.value).catch(() => true);

    if (canShare) {
      await Share.share({
        title: cleanName,
        text: `Exported document: ${cleanName}`,
        url: fileUri,
        dialogTitle: `Open or Save ${cleanName}`,
      });
    } else {
      console.log(`[fileDownloader] File written to native storage: ${fileUri}`);
    }
  } catch (error) {
    console.error('[fileDownloader] Native file save/share failed, attempting web fallback:', error);
    let blob: Blob;
    if (data instanceof Blob) {
      blob = data;
    } else {
      blob = new Blob([data as any], { type: mimeType || 'application/octet-stream' });
    }
    triggerBrowserDownload(blob, cleanName);
  }
}

/**
 * Drop-in replacement for file-saver `saveAs`.
 */
export const saveAsHybrid = (blob: Blob, fileName: string): void => {
  downloadFile(blob, fileName).catch((err) => {
    console.error('[saveAsHybrid] Failed to download file:', err);
  });
};

export { saveAsHybrid as saveAs };
