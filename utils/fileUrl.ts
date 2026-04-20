import { UploadedFile } from '../types';
import { Capacitor } from '@capacitor/core';

/**
 * Utility functions for professional file URL handling.
 * Converts raw Supabase storage URLs to proxy URLs served through our own domain.
 * 
 * On native platforms (Android/iOS via Capacitor), the proxy is skipped because
 * there is no Express server running on the device. The raw Supabase public URL
 * is used directly instead.
 */

const SUPABASE_STORAGE_PREFIX = 'https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public/';

/**
 * Convert a raw Supabase storage URL to our proxy URL.
 * 
 * On web: proxies through /api/view-file/ for CORS/security.
 * On native (Android/iOS): returns the raw Supabase URL directly since there is
 * no local Express server to handle the proxy route.
 * 
 * If the URL is not a Supabase URL, it is returned as-is.
 */
export function getProxyUrl(supabaseUrl: string): string {
  if (!supabaseUrl) return supabaseUrl;
  
  // On native platforms, skip proxy — no Express server available on device.
  // The WebView can load Supabase public URLs directly over the internet.
  const isNative = Capacitor.isNativePlatform() || navigator.userAgent.includes('ParadigmApp');
  
  if (supabaseUrl.startsWith(SUPABASE_STORAGE_PREFIX)) {
    if (isNative) {
      // Return the raw public URL — the native WebView loads it directly
      return supabaseUrl;
    }
    const storagePath = supabaseUrl.replace(SUPABASE_STORAGE_PREFIX, '');
    return `/api/view-file/${storagePath}`;
  }
  
  // Not a Supabase URL — return as-is (e.g. blob: URLs during upload)
  return supabaseUrl;
}

/**
 * Extract a clean, human-readable filename from a storage URL or path.
 * Strips any timestamp prefix (e.g., "1774615442405_Invoice.pdf" → "Invoice.pdf").
 */
export function getCleanFilename(urlOrPath: string): string {
  if (!urlOrPath) return 'Document';
  
  try {
    // Get just the filename from the URL/path
    const decoded = decodeURIComponent(urlOrPath);
    const filename = decoded.split('/').pop() || 'Document';
    
    // Strip timestamp prefix pattern: "1234567890123_filename.ext"
    const timestampPattern = /^\d{10,15}_/;
    return filename.replace(timestampPattern, '');
  } catch {
    return 'Document';
  }
}

/**
 * Detect file type from name or URL.
 */
export function getFileType(urlOrPath: string): string {
  if (!urlOrPath) return 'application/octet-stream';
  const ext = urlOrPath.split('.').pop()?.toLowerCase();
  
  const mimeMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv',
    'txt': 'text/plain'
  };

  return mimeMap[ext || ''] || 'application/octet-stream';
}

/**
 * Construct an UploadedFile object from a storage URL.
 */
export function getUploadedFileFromUrl(url: string, defaultName: string = 'Document'): UploadedFile | null {
  if (!url) return null;
  
  const proxyUrl = getProxyUrl(url);
  const name = getCleanFilename(url) || defaultName;
  const type = getFileType(url);
  
  return {
    name,
    type,
    size: 0, // Size is unknown for URLs
    preview: proxyUrl,
    url: proxyUrl
  } as UploadedFile;
}
