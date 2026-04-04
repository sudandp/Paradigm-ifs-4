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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increase limit for large HTML content
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// API Routes

// Placeholder for other routes (e.g., users, organizations)
// app.use('/api/users', userRoutes);
// app.use('/api/organizations', organizationRoutes);

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