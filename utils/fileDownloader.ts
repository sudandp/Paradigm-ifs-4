import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { saveAs } from 'file-saver';

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
 * - On Web: uses standard file-saver `saveAs`.
 * - On Native (Android / iOS): writes file to Cache/Documents via @capacitor/filesystem
 *   and invokes the native system Share Sheet via @capacitor/share so users can
 *   view, open in external apps (Excel, PDF viewer), or save to device storage.
 */
export async function downloadFile(
  data: Blob | ArrayBuffer | Uint8Array | string,
  fileName: string,
  mimeType?: string
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // Web Browser execution
    const blob = data instanceof Blob 
      ? data 
      : new Blob([data as any], { type: mimeType || 'application/octet-stream' });
    saveAs(blob, fileName);
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
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });

    const fileUri = result.uri;

    // Check if system share is available
    const canShare = await Share.canShare().then(r => r.value).catch(() => true);

    if (canShare) {
      await Share.share({
        title: fileName,
        text: `Exported document: ${fileName}`,
        url: fileUri,
        dialogTitle: `Open or Save ${fileName}`,
      });
    } else {
      console.log(`[fileDownloader] File written to native storage: ${fileUri}`);
    }
  } catch (error) {
    console.error('[fileDownloader] Native file save/share failed, attempting web fallback:', error);
    const blob = data instanceof Blob 
      ? data 
      : new Blob([data as any], { type: mimeType || 'application/octet-stream' });
    saveAs(blob, fileName);
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
