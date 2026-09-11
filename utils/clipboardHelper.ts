import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';

/**
 * Copies string content to the system clipboard with 100% native & web parity.
 *
 * In native WebViews (Android/iOS), navigator.clipboard.writeText can throw
 * DOMException or NotAllowedError if the document lacks explicit focus.
 * This utility uses @capacitor/clipboard natively, falling back gracefully
 * to modern Web APIs and legacy execCommand.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Native platform handling via Capacitor plugin
  if (Capacitor.isNativePlatform()) {
    try {
      await Clipboard.write({ string: text });
      return true;
    } catch (err) {
      console.warn('[clipboardHelper] Native Clipboard.write failed, trying web fallback:', err);
    }
  }

  // 2. Modern Web Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[clipboardHelper] navigator.clipboard.writeText failed, trying legacy fallback:', err);
    }
  }

  // 3. Fallback: textarea + execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('[clipboardHelper] All clipboard strategies failed:', err);
    return false;
  }
}

export const safeCopyToClipboard = copyToClipboard;
