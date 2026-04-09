import * as dotenv from 'dotenv';
dotenv.config(); // Load .env
dotenv.config({ path: '.env.local' }); // Load .env.local (Vite style)

// Fix for local dev SSL issues: self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { errorMiddleware } from './api/middleware/error.middleware.js';
import { sendEmailLogic } from '../api/send-email.js';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

import fetch from 'node-fetch';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

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

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increase limit for large HTML content
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// API Routes

// Initialize Supabase client for proxy use (Service Role bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * File Proxy Route - Ported from api/view-file.ts to local dev server
 * Proxies requests for storage objects to Supabase, bypassing origin restriction issues
 * and allowing local dev to display files.
 */
app.use('/api/view-file', async (req: Request, res: Response) => {
    if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
    
    try {
        // Extract bucket and path from URL
        // Format: /api/view-file/bucket-name/path/to/file.ext
        const fullPath = req.path.replace(/^\//, '');
        if (!fullPath) {
            console.warn('[Server] view-file: No file path provided');
            return res.status(400).json({ error: 'No file path provided' });
        }

        const parts = fullPath.split('/');
        const bucket = parts[0];
        const storagePath = parts.slice(1).join('/');

        if (!bucket || !storagePath) {
            console.warn(`[Server] view-file: Invalid path format: ${fullPath}`);
            return res.status(400).json({ error: 'Invalid file path format' });
        }

        console.log(`[Server] Proxying storage request: ${bucket}/${storagePath}`);

        // Set a timeout for the download
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        // Ensure path segments are properly encoded to safely handle spaces and special chars
        const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');

        const { data, error } = await supabase.storage
            .from(bucket)
            .download(encodedPath);

        clearTimeout(timeoutId);

        if (error) {
            console.error(`[Server] Supabase proxy failed: ${error.message} for ${bucket}/${storagePath}`);
            return res.status(400).json({ error: error.message });
        }

        if (!data) {
            return res.status(404).json({ error: 'File not found' });
        }

        const buffer = await data.arrayBuffer();
        const filename = storagePath.split('/').pop() || 'file';
        const contentType = data.type || getMimeType(filename);

        console.log(`[Server] Proxy success: ${bucket}/${storagePath} (${buffer.byteLength} bytes, ${contentType})`);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');

        return res.send(Buffer.from(buffer));
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.error('[Server] view-file proxy timeout');
            return res.status(504).json({ error: 'Request to storage timed out' });
        }
        console.error('[Server] view-file proxy error:', error);
        return res.status(500).json({ error: 'Failed to fetch file' });
    }
});

// Email API Route
app.post('/api/send-email', async (req: Request, res: Response) => {
    console.log('[Server] POST /api/send-email');
    
    // Simple Auth check (Optional for local dev, but good for consistency)
    const authHeader = req.headers['authorization'];
    if (authHeader && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data } = await supabase.auth.getUser(token);
        if (!data?.user) {
            // In local dev, we might be more lenient or just log a warning
            console.warn('[Server] Unauthorized request to /api/send-email');
        }
    }

    try {
        const info = await sendEmailLogic(req.body, SUPABASE_URL, SUPABASE_SERVICE_KEY);
        res.status(200).json({
            success: true,
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected,
        });
    } catch (error: any) {
        console.error('[Server] send-email error:', error.message);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// Health Check
app.get('/', (req: Request, res: Response) => {
    res.send('Server is running.');
});

// Error Handler Middleware
app.use(errorMiddleware);

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});