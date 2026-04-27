import type { VercelRequest, VercelResponse } from '@vercel/node';

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * [SECURITY FIX C3] Validate the caller's JWT before serving any file.
 * Returns the authenticated user or null.
 */
async function authenticateRequest(req: VercelRequest): Promise<{ id: string } | null> {
  // 1. Try Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) return { id: data.user.id };
    } catch { /* fall through */ }
  }

  // 2. Try sb-access-token cookie (Supabase session)
  const cookies = req.headers.cookie || '';
  const tokenMatch = cookies.match(/sb-[^=]+-auth-token=([^;]+)/);
  if (tokenMatch) {
    try {
      const decoded = JSON.parse(decodeURIComponent(tokenMatch[1]));
      const accessToken = Array.isArray(decoded) ? decoded[0] : decoded?.access_token;
      if (accessToken) {
        const { data, error } = await supabase.auth.getUser(accessToken);
        if (!error && data?.user) return { id: data.user.id };
      }
    } catch { /* fall through */ }
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const pathSegments = req.query.path;
    let filePath = '';
    
    if (!pathSegments || (Array.isArray(pathSegments) && pathSegments.length === 0)) {
       const url = req.url || '';
       const match = url.match(/\/api\/view-file\/(.*)/);
       if (!match || !match[1]) return res.status(400).json({ error: 'No file path provided' });
       filePath = match[1].split('?')[0];
    } else {
       filePath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
    }

    const decodedFullPath = decodeURIComponent(filePath);
    const parts = decodedFullPath.split('/');
    const bucket = parts[0];

    const publicBuckets = ['avatars', 'logo', 'background', 'public'];
    const isPublicBucket = publicBuckets.includes(bucket);

    if (!isPublicBucket) {
      const user = await authenticateRequest(req);
      if (!user) {
        return res.status(401).json({ error: 'Authentication required to access restricted files' });
      }
    }

    // [SECURITY FIX C3] Path traversal protection
    if (decodedFullPath.includes('..') || decodedFullPath.includes('\\')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const storagePath = parts.slice(1).join('/');

    if (!bucket || !storagePath) return res.status(400).json({ error: 'Invalid file path format' });

    // Step 1: Try direct match
    let { data, error } = await supabase.storage.from(bucket).download(storagePath);

    // Step 2: Smart Fallback for case-sensitivity
    if (error && (error.message.includes('not found') || error.message.includes('Invalid key'))) {
      const pathParts = storagePath.split('/');
      const filename = pathParts.pop();
      const parentFolder = pathParts.join('/');

      if (filename) {
        const { data: files } = await supabase.storage.from(bucket).list(parentFolder || undefined);
        const matchingFile = files?.find(f => f.name.toLowerCase() === filename.toLowerCase());
        if (matchingFile) {
          const fallbackPath = parentFolder ? `${parentFolder}/${matchingFile.name}` : matchingFile.name;
          const fallbackResult = await supabase.storage.from(bucket).download(fallbackPath);
          data = fallbackResult.data;
          error = fallbackResult.error;
        }
      }
    }

    if (error || !data) {
      return res.status(404).json({ error: error?.message || 'File not found' });
    }

    const buffer = await data.arrayBuffer();
    const filename = storagePath.split('/').pop() || 'document';
    const contentType = data.type || getMimeType(filename);


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
