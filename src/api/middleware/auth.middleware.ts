import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * [SECURITY FIX C2] Authentication middleware.
 * Validates the Bearer JWT token against Supabase and attaches user data to the request.
 * Rejects unauthenticated requests with 401.
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    // [SECURITY FIX H4] Fail-closed: deny access when Supabase is not configured
    // instead of silently skipping auth (fail-open is dangerous in production)
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('[AuthMiddleware] CRITICAL: Supabase not configured — blocking all requests');
        return res.status(503).json({ error: 'Server authentication is not configured. Contact administrator.' });
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data?.user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        // Attach user to request for downstream handlers
        (req as any).user = data.user;
        next();
    } catch (err) {
        console.error('[AuthMiddleware] Token validation failed:', err);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};