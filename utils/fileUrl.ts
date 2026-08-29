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

const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
const STORAGE_ENDPOINT = '/storage/v1/object/public';
// Prefix without trailing slash for more flexible matching
const SUPABASE_STORAGE_PREFIX = `${PROJECT_URL.replace(/\/$/, '')}${STORAGE_ENDPOINT}`;

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
  if (!supabaseUrl || typeof supabaseUrl !== 'string') return supabaseUrl;
  
  // If it's a blob: or data: URL, return as-is
  if (supabaseUrl.startsWith('blob:') || supabaseUrl.startsWith('data:')) {
    return supabaseUrl;
  }

  // Clean the input URL - remove any double slashes after the protocol
  const sanitizedUrl = supabaseUrl.replace(/([^:]\/)\/+/g, '$1');
  
  // On native platforms, skip proxy — no Express server available on device.
  const isNative = Capacitor.isNativePlatform() || 
                  (typeof navigator !== 'undefined' && navigator.userAgent.includes('ParadigmApp'));
  
  const isDev = Boolean((import.meta.env as any)?.DEV) || 
                (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

  // If incoming URL is an /api/view-file/ proxy path and we are in dev/native, convert back to direct Supabase public URL
  if (sanitizedUrl.startsWith('/api/view-file/')) {
    const relativePath = sanitizedUrl.replace(/^\/api\/view-file\//, '');
    if (isDev || isNative) {
      return `${SUPABASE_STORAGE_PREFIX}/${relativePath}`;
    }
  }

  if (sanitizedUrl.startsWith(SUPABASE_STORAGE_PREFIX)) {
    if (isNative || isDev) {
      // Return the raw public URL — the native WebView and dev server load it directly
      return sanitizedUrl;
    }
    
    // Extract storage path: prefix might end with or without a slash
    let storagePath = sanitizedUrl.substring(SUPABASE_STORAGE_PREFIX.length);
    if (storagePath.startsWith('/')) {
      storagePath = storagePath.substring(1);
    }

    // Public buckets should not be proxied on web because <img> tags 
    // do not send the Authorization header, causing 401 errors from the proxy.
    const publicBuckets = ['avatars', 'logo', 'background', 'public', 'onboarding-documents', 'documents', 'company-assets'];
    const bucket = storagePath.split('/')[0];
    
    if (publicBuckets.includes(bucket)) {
      return sanitizedUrl;
    }
    
    return `/api/view-file/${storagePath}`;
  }
  
  return sanitizedUrl;
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
