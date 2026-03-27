import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mapping of bucket names to their Supabase project URL prefix
const SUPABASE_STORAGE_BASE = 'https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public';

// MIME type lookup by extension
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function getMimeType(filename: string): string {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Extract the full path from the catch-all route
    // e.g. /api/view-file/compliance-documents/documents/uid/123/Invoice.pdf
    const pathSegments = req.query.path;
    if (!pathSegments || (Array.isArray(pathSegments) && pathSegments.length === 0)) {
      return res.status(400).json({ error: 'No file path provided' });
    }

    const filePath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
    const supabaseUrl = `${SUPABASE_STORAGE_BASE}/${filePath}`;

    // Fetch the file from Supabase
    const response = await fetch(supabaseUrl);

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `File not found or inaccessible (${response.status})` 
      });
    }

    const buffer = await response.arrayBuffer();
    const filename = filePath.split('/').pop() || 'document';
    const contentType = getMimeType(filename);

    // Set headers for inline viewing (not forced download)
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('[view-file] Proxy error:', error);
    return res.status(500).json({ error: 'Failed to fetch file' });
  }
}
