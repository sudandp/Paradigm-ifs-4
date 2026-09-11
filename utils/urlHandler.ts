import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

/**
 * Universal external URL handler with full parity across Web, Android, and iOS.
 * - On Native (Capacitor): Uses @capacitor/browser to open in-app chrome tab or external browser.
 * - On Web: Uses window.open(url, '_blank', 'noopener,noreferrer').
 */
export async function openExternal(url: string, target: string = '_blank'): Promise<void> {
  if (!url) return;

  // Ensure standard protocol if missing
  let normalizedUrl = url.trim();
  if (!/^(https?|mailto|tel|sms|whatsapp):/i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url: normalizedUrl });
    } catch (err) {
      console.warn('[urlHandler] Browser.open failed, falling back to window.open:', err);
      window.open(normalizedUrl, target, 'noopener,noreferrer');
    }
  } else {
    window.open(normalizedUrl, target, 'noopener,noreferrer');
  }
}

/**
 * Open WhatsApp chat with specified phone number and optional pre-filled message.
 * Formats standard international phone numbers and opens native WhatsApp on mobile.
 */
export async function openWhatsApp(phone: string, message: string = ''): Promise<void> {
  const cleanPhone = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
  const encodedMsg = encodeURIComponent(message);
  const waUrl = cleanPhone 
    ? `https://wa.me/${cleanPhone}${encodedMsg ? `?text=${encodedMsg}` : ''}`
    : `https://wa.me/${encodedMsg ? `?text=${encodedMsg}` : ''}`;
  
  await openExternal(waUrl);
}

/**
 * Launch phone dialer with phone number.
 */
export function openDialer(phone: string): void {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  window.location.href = `tel:${cleanPhone}`;
}

/**
 * Launch email client.
 */
export function openEmail(email: string, subject: string = '', body: string = ''): void {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const query = params.toString();
  window.location.href = `mailto:${email}${query ? `?${query}` : ''}`;
}
