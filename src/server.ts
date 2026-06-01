import * as dotenv from 'dotenv';
dotenv.config(); // Load .env
dotenv.config({ path: '.env.local', override: true }); // Load .env.local and OVERRIDE existing (Vite style)

// [SECURITY FIX C3] Removed process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
// TLS certificate validation is now enabled (Node.js default).
// If you need to work with self-signed certs in dev, configure per-connection instead.

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { errorMiddleware } from './api/middleware/error.middleware.js';
import { sendEmailLogic } from '../api/send-email.js';
import hrmRouter from './api/routes/hrm.routes.js';
import { transcribeAudio, summariseTranscript } from './api/controllers/groq.controller.js';
import { runHrmAutomation } from './api/hrm.automation.js';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { authMiddleware } from './api/middleware/auth.middleware.js';
import FormData from 'form-data';

import fetch from 'node-fetch';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
// [SECURITY FIX C7] Service Role Key MUST come from a non-VITE_ env var only.
// Never fall back to the anon key — it doesn't have the required permissions and
// using a VITE_ prefix would expose the key in the frontend bundle.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

// [SECURITY FIX C4] Restrict CORS to known origins instead of allowing all
const ALLOWED_ORIGINS = [
  'https://paradigm-ifs-4.vercel.app',
  'https://www.paradigm-ifs-4.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'capacitor://localhost',  // Capacitor iOS
  'http://localhost',       // Capacitor Android
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, server-to-server, curl)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(null, true); // In dev, still allow but log. Change to callback(new Error('CORS')) in production.
    }
  },
  credentials: true,
}));

// [SECURITY FIX H14] Reduced body limit from 50MB to 10MB to prevent memory exhaustion
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/hrm', hrmRouter);
app.post('/api/groq-transcribe', transcribeAudio);
app.post('/api/groq-summarise', summariseTranscript);

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

        // Ensure we have the raw decoded path from the request
        const decodedPath = decodeURIComponent(storagePath);

        // Step 1: Try direct match with the original path
        let { data, error } = await supabase.storage.from(bucket).download(decodedPath);

        // Step 2: Smart Fallback - If not found, try case-insensitive match for the filename
        // This handles cases where database references might have different casing than storage
        if (error && (error.message.includes('not found') || error.message.includes('Invalid key') || (error as any).status === 404)) {
            console.log(`[Server] Direct match failed for ${decodedPath}, attempting smart fallback...`);
            
            const pathParts = decodedPath.split('/');
            const filename = pathParts.pop();
            const parentFolder = pathParts.join('/');

            if (filename) {
                const { data: files, error: listError } = await supabase.storage.from(bucket).list(parentFolder || undefined);
                
                if (!listError && files) {
                    const caseInsensitiveMatch = files.find(f => f.name.toLowerCase() === filename.toLowerCase());
                    if (caseInsensitiveMatch) {
                        const fallbackPath = parentFolder ? `${parentFolder}/${caseInsensitiveMatch.name}` : caseInsensitiveMatch.name;
                        console.log(`[Server] Smart Fallback: Found case-insensitive match -> ${fallbackPath}`);
                        const fallbackResult = await supabase.storage.from(bucket).download(fallbackPath);
                        data = fallbackResult.data;
                        error = fallbackResult.error;
                    }
                }
            }
        }

        clearTimeout(timeoutId);

        if (error) {
            console.error(`[Server] Supabase proxy COMPLETELY failed: ${error.message} for [${bucket}] ${storagePath}`);
            return res.status(404).json({ error: `File not found in storage: ${storagePath}` });
        }

        if (!data) {
            console.error(`[Server] Supabase proxy returned empty data for [${bucket}] ${storagePath}`);
            return res.status(404).json({ error: 'File data is empty' });
        }


        const buffer = await data.arrayBuffer();
        const filename = storagePath.split('/').pop() || 'file';
        const contentType = data.type || getMimeType(filename);

        console.log(`[Server] Proxy SUCCESS: [${bucket}] ${storagePath} (${buffer.byteLength} bytes, ${contentType})`);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        // [SECURITY FIX C4] Removed Access-Control-Allow-Origin: * — handled by CORS middleware above

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

// [SECURITY FIX H7] Simple in-memory rate limiter for email endpoint
const emailRateMap = new Map<string, { count: number; resetAt: number }>();
const EMAIL_RATE_LIMIT = 20; // max requests per window
const EMAIL_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Email API Route
app.post('/api/send-email', async (req: Request, res: Response) => {
    console.log('[Server] POST /api/send-email');
    
    // [SECURITY FIX C2] Enforce authentication — reject if no valid token
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.replace('Bearer ', '');
    let authenticatedUser: any = null;

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data } = await authClient.auth.getUser(token);
        if (!data?.user) {
            console.warn('[Server] Unauthorized request to /api/send-email — invalid token');
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        authenticatedUser = data.user;
    } else {
        console.warn('[Server] Supabase not configured — skipping auth in dev mode');
    }

    // [SECURITY FIX H7] Rate limit check per user/IP
    const rateLimitKey = authenticatedUser?.id || req.ip || 'unknown';
    const now = Date.now();
    const rateEntry = emailRateMap.get(rateLimitKey);
    if (rateEntry && now < rateEntry.resetAt) {
        if (rateEntry.count >= EMAIL_RATE_LIMIT) {
            return res.status(429).json({ error: 'Too many email requests. Please wait before trying again.' });
        }
        rateEntry.count++;
    } else {
        emailRateMap.set(rateLimitKey, { count: 1, resetAt: now + EMAIL_RATE_WINDOW_MS });
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

app.post('/api/exotel-dial', authMiddleware, async (req: Request, res: Response) => {
    const { targetNumber } = req.body;
    if (!targetNumber) {
        return res.status(400).json({ error: 'targetNumber is required' });
    }

    const apiKey = (process.env.EXOTEL_API_KEY || '').trim();
    const apiToken = (process.env.EXOTEL_API_TOKEN || '').trim();
    const accountSid = (process.env.EXOTEL_ACCOUNT_SID || '').trim();
    const subdomain = (process.env.EXOTEL_SUBDOMAIN || 'api.in.exotel.com').trim();

    const user = (req as any).user;
    let fromNumber = (process.env.EXOTEL_HR_NUMBER || '').trim();
    let callerIdNumber = (process.env.EXOTEL_EXOPHONE || '').trim();

    // Fetch settings to check if there is a mapped phone/exophone for this user
    try {
        const { data: settingsData } = await supabase
            .from('settings')
            .select('voip_settings')
            .eq('id', 'singleton')
            .maybeSingle();

        if (settingsData && settingsData.voip_settings) {
            const voipSettings = settingsData.voip_settings as any;
            const hrMapping = voipSettings.hr_mappings?.find((m: any) => m.user_id === user.id);
            const bdMapping = voipSettings.bd_mappings?.find((m: any) => m.user_id === user.id);
            const activeMapping = hrMapping || bdMapping;

            if (activeMapping && activeMapping.phone && activeMapping.exophone) {
                fromNumber = activeMapping.phone;
                callerIdNumber = activeMapping.exophone;
                console.log(`[Server Exotel] Using mapped connection for user ${user?.id}: From ${fromNumber}, CallerId: ${callerIdNumber}`);
            }
        }
    } catch (e: any) {
        console.warn('[Server Exotel] Failed to lookup VoIP settings mapping:', e.message);
    }

    if (!apiKey || !apiToken || !accountSid || !fromNumber || !callerIdNumber) {
        return res.status(500).json({ error: 'Exotel credentials or user mapping are not fully configured on server.' });
    }

    try {
        const url = `https://${subdomain}/v1/Accounts/${accountSid}/Calls/connect.json`;

        // Dynamic Callback Url based on host
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.get('host');
        const callbackUrl = `${protocol}://${host}/api/exotel-callback`;

        console.log(`[Server Exotel] Connecting call. Mapped From: ${fromNumber} -> Candidate: ${targetNumber}. Callback: ${callbackUrl}`);

        const formData = new URLSearchParams({
            From: fromNumber,
            To: targetNumber,
            CallerId: callerIdNumber,
            Record: 'true',
            TimeLimit: '3600',
            StatusCallback: callbackUrl,
            StatusCallbackContentType: 'application/json'
        });

        const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': authHeader
            },
            body: formData.toString()
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Exotel API error ${response.status}: ${errText}`);
        }

        const data = await response.json() as any;
        const callSid = data?.Call?.Sid;

        if (!callSid) {
            throw new Error('Call connected but Exotel returned no CallSid.');
        }

        console.log(`[Server Exotel] Call initiated. SID: ${callSid}`);
        return res.status(200).json({ success: true, callSid });
    } catch (err: any) {
        console.error('[Server Exotel] Connect Call Failed:', err.message);
        return res.status(500).json({ error: err.message || 'Failed to initiate VoIP call' });
    }
});

// ── Exotel Callback Endpoint ──
app.post('/api/exotel-callback', async (req: Request, res: Response) => {
    console.log('[Server Exotel Callback] Received request body:', req.body);
    
    // Respond immediately to prevent Exotel retrying
    res.status(200).send('OK');

    // Run the heavy processing in the background asynchronously
    processExotelCallbackInBackground(req.body).catch(err => {
        console.error('[Server Exotel Callback] Background processing error:', err);
    });
});

// ── Exotel Webhook Helper Functions ──
async function processExotelCallbackInBackground(body: any) {
    const callSid = body?.Call?.Sid || body?.CallSid;
    const status = body?.Call?.Status || body?.Status;
    const recordingUrl = body?.Call?.RecordingUrl || body?.RecordingUrl;
    const durationStr = body?.Call?.DialDuration || body?.DialDuration || body?.Call?.Duration || body?.Duration || '0';
    const durationSeconds = parseInt(durationStr, 10);

    const hrNumber = process.env.EXOTEL_HR_NUMBER || '';
    const fromNum = body?.Call?.From || body?.From;
    const toNum = body?.Call?.To || body?.To;
    const phoneNumber = toNum === hrNumber ? fromNum : toNum;

    console.log(`[Exotel Callback] Processing CallSid: ${callSid}, status: ${status}, Phone: ${phoneNumber}`);

    if (!callSid || !phoneNumber) {
        console.warn('[Exotel Callback] Missing CallSid or phone number.');
        return;
    }

    // Broadcast call_ended to update frontend
    await supabase.channel('call_updates').send({
        type: 'broadcast',
        event: 'call_ended',
        payload: { phoneNumber }
    });

    if (status !== 'completed' || !recordingUrl) {
        console.log(`[Exotel Callback] Call not completed or no recording URL (status: ${status})`);
        
        // Save failed call record
        const candidate = await lookupCandidate(phoneNumber);
        const hrUserId = await getHrUserId();

        await supabase.from('call_recordings').insert({
            hr_user_id: hrUserId,
            candidate_id: candidate?.id || null,
            phone_number: phoneNumber,
            duration_seconds: durationSeconds,
            s3_path: 'FAILED_OR_NO_RECORDING'
        });

        await supabase.channel('call_updates').send({
            type: 'broadcast',
            event: 'call_error',
            payload: { phoneNumber }
        });
        return;
    }

    try {
        console.log(`[Exotel Callback] Downloading audio from Exotel...`);
        const apiKey = (process.env.EXOTEL_API_KEY || '').trim();
        const apiToken = (process.env.EXOTEL_API_TOKEN || '').trim();
        
        const auth = 'Basic ' + Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
        const mediaRes = await fetch(recordingUrl, {
            headers: { 'Authorization': auth }
        });

        if (!mediaRes.ok) {
            throw new Error(`Exotel audio download failed: ${mediaRes.status} ${mediaRes.statusText}`);
        }

        const audioBuffer = Buffer.from(await mediaRes.arrayBuffer());
        console.log(`[Exotel Callback] Audio downloaded: ${audioBuffer.length} bytes.`);

        const ext = recordingUrl.includes('.mp3') ? 'mp3' : 'wav';
        const filename = `exotel_${callSid}_${Date.now()}.${ext}`;
        const contentType = ext === 'mp3' ? 'audio/mpeg' : 'audio/wav';

        // Upload to Supabase storage
        console.log(`[Exotel Callback] Uploading to Supabase Storage: ${filename}`);
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('call-recordings')
            .upload(`audio/${filename}`, audioBuffer, {
                contentType,
                upsert: true
            });

        if (uploadError) {
            throw new Error(`Supabase storage upload failed: ${uploadError.message}`);
        }

        const s3Path = uploadData.path;
        console.log(`[Exotel Callback] Upload success: ${s3Path}`);

        // Transcribe
        console.log(`[Exotel Callback] Starting Groq transcription...`);
        const transcriptText = await transcribeAudioBuffer(audioBuffer, filename, contentType);
        console.log(`[Exotel Callback] Transcription complete: "${transcriptText.substring(0, 100)}..."`);

        // Get candidate info
        const candidate = await lookupCandidate(phoneNumber);
        const candidateName = candidate?.name || 'Unknown Candidate';
        const candidateRole = candidate?.requested_role || 'General Candidate';
        const candidateId = candidate?.id || null;

        // Summarize
        console.log(`[Exotel Callback] Starting Groq summarization...`);
        const summaryJson = await summariseText(transcriptText, candidateName, candidateRole);

        // Database inserts
        const hrUserId = await getHrUserId();

        const { data: recRecord, error: dbErr1 } = await supabase
            .from('call_recordings')
            .insert({
                hr_user_id: hrUserId,
                candidate_id: candidateId,
                phone_number: phoneNumber,
                duration_seconds: durationSeconds,
                s3_path: s3Path
            })
            .select('id')
            .single();

        if (dbErr1) throw new Error(`Recording DB insert failed: ${dbErr1.message}`);

        const { error: dbErr2 } = await supabase
            .from('call_transcripts')
            .insert({
                recording_id: recRecord.id,
                transcript_text: transcriptText,
                summary: summaryJson.summary,
                candidate_interest: summaryJson.candidateInterest,
                key_points: summaryJson.keyPoints,
                action_items: summaryJson.actionItems,
                follow_up_date: summaryJson.followUpDate,
                suggested_stage: summaryJson.suggestedStage,
                call_outcome: summaryJson.callOutcome
            });

        if (dbErr2) throw new Error(`Transcript DB insert failed: ${dbErr2.message}`);

        // Insert into hrm_call_logs to satisfy CRM pipeline updates
        const outcomeVal = summaryJson.callOutcome.toLowerCase().replace(' ', '_');
        const { error: dbErr3 } = await supabase
            .from('hrm_call_logs')
            .insert({
                candidate_id: candidateId,
                caller_id: hrUserId,
                called_at: new Date().toISOString(),
                outcome: outcomeVal,
                notes: summaryJson.summary,
                next_call_at: summaryJson.followUpDate ? new Date(summaryJson.followUpDate).toISOString() : null
            });

        if (dbErr3) {
            console.warn('[Exotel Callback] Failed to write to hrm_call_logs:', dbErr3.message);
        }

        // Broadcast success update to frontend
        await supabase.channel('call_updates').send({
            type: 'broadcast',
            event: 'call_processed',
            payload: { recording_id: recRecord.id, phoneNumber }
        });

        console.log('[Exotel Callback] Call processing fully completed!');
    } catch (err: any) {
        console.error('[Exotel Callback] Failed background task:', err.message);
        await supabase.channel('call_updates').send({
            type: 'broadcast',
            event: 'call_error',
            payload: { phoneNumber }
        });
    }
}

async function transcribeAudioBuffer(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY || '';
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const groqForm = new FormData();
    groqForm.append('file', buffer, { filename, contentType });
    groqForm.append('model', 'whisper-large-v3-turbo');
    groqForm.append('response_format', 'json');
    groqForm.append('language', 'en');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            ...groqForm.getHeaders()
        },
        body: groqForm as any
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Groq Whisper failed: ${response.status} - ${text}`);
    }

    const data = await response.json() as any;
    return data.text || '';
}

async function summariseText(transcript: string, candidateName: string, role: string) {
    const apiKey = process.env.GROQ_API_KEY || '';
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const systemPrompt = `You are an expert HR recruitment assistant. Analyse call transcripts between HR professionals and job candidates. Return ONLY a valid JSON object.`;
    const userPrompt = `Analyse this call transcript for candidate "${candidateName}" applying for "${role}".

TRANSCRIPT:
${transcript}

Return ONLY this JSON (no markdown, no code blocks):
{
  "summary": "A concise 2-3 sentence summary of the discussion",
  "candidateInterest": "High | Medium | Low",
  "keyPoints": ["point 1", "point 2"],
  "actionItems": ["action 1", "action 2"],
  "followUpDate": "YYYY-MM-DD or null",
  "suggestedStage": "new | contacted | screened | interview | offer | joined | rejected",
  "callOutcome": "reached | no_answer | callback | interested | not_interested"
}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.2,
            max_tokens: 512
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Groq Summarize failed: ${response.status} - ${text}`);
    }

    const data = await response.json() as any;
    const raw = data.choices?.[0]?.message?.content || '{}';

    let parsed: any;
    try {
        parsed = JSON.parse(raw);
    } catch {
        const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        parsed = match ? JSON.parse(match[1]) : { summary: raw };
    }

    return {
        summary: parsed.summary || 'Call completed.',
        candidateInterest: parsed.candidateInterest || 'Medium',
        keyPoints: parsed.keyPoints || [],
        actionItems: parsed.actionItems || [],
        followUpDate: parsed.followUpDate || null,
        suggestedStage: parsed.suggestedStage || 'screened',
        callOutcome: parsed.callOutcome || 'reached'
    };
}

async function lookupCandidate(phoneNumber: string) {
    const rawNumber = phoneNumber.replace(/\D/g, '');
    let cleanNumber = rawNumber;
    if (rawNumber.length === 12 && rawNumber.startsWith('91')) {
        cleanNumber = rawNumber.substring(2);
    }
    
    const { data, error } = await supabase
        .from('candidate_referrals')
        .select('id, name, requested_role')
        .or(`phone_number.eq.${cleanNumber},phone_number.eq.+91${cleanNumber},phone_number.eq.91${cleanNumber}`)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[Exotel Callback] Candidate lookup error:', error.message);
    }
    return data;
}

async function getHrUserId(): Promise<string | null> {
    const email = process.env.HR_EMAIL;
    if (!email) return null;
    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error('[Exotel Callback] Failed user lookup:', error.message);
    }
    return data?.id || null;
}

// Health Check
app.get('/', (req: Request, res: Response) => {
    res.send('Server is running.');
});

// Error Handler Middleware
app.use(errorMiddleware);

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Trigger HRM automation on boot (wrapped to avoid interrupting startup)
    runHrmAutomation().catch(err => console.error('[Server] Failed to run HRM automation on boot:', err));

    // Schedule HRM automation to run every 6 hours
    setInterval(() => {
        runHrmAutomation().catch(err => console.error('[Server] Failed to run scheduled HRM automation:', err));
    }, 1000 * 60 * 60 * 6);
});