/**
 * Utility functions for professional file URL handling.
 * Converts raw Supabase storage URLs to proxy URLs served through our own domain.
 */

const SUPABASE_STORAGE_PREFIX = 'https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public/';

/**
 * Convert a raw Supabase storage URL to our proxy URL.
 * 
 * Input:  https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public/compliance-documents/documents/uid/123/Invoice.pdf
 * Output: /api/view-file/compliance-documents/documents/uid/123/Invoice.pdf
 * 
 * If the URL is not a Supabase URL, it is returned as-is.
 */
export function getProxyUrl(supabaseUrl: string): string {
  if (!supabaseUrl) return supabaseUrl;
  
  if (supabaseUrl.startsWith(SUPABASE_STORAGE_PREFIX)) {
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
