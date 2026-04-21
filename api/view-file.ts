import type { VercelRequest, VercelResponse } from '@vercel/node';

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

    // Fix: Decode first to ensure we don't double encode
    const decodedFullPath = decodeURIComponent(filePath);
    const parts = decodedFullPath.split('/');
    const bucket = parts[0];
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
