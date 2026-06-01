import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  process.env.FRONTEND_URL || 'https://your-production-app.vercel.app'
];

export const config = {
  api: {
    bodyParser: { sizeLimit: '25mb' },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(403).json({ error: 'Forbidden: Invalid user token' });
    }

    // TASK 2: Rate Limiting
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('api_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('hr_user_id', user.id)
      .gte('created_at', oneHourAgo);

    if (count !== null && count >= 20) {
      res.setHeader('Retry-After', '3600');
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    }

    // Log this request
    await supabase.from('api_rate_limits').insert({ 
      hr_user_id: user.id, 
      endpoint: 'groq-transcribe' 
    });

    const { audioUrl } = req.body;
    if (!audioUrl || typeof audioUrl !== 'string') {
      return res.status(400).json({ error: 'audioUrl is required' });
    }

    // TASK 4: Input sanitisation and validation
    if (audioUrl.length > 2000) {
      return res.status(400).json({ error: 'audioUrl exceeds maximum length of 2000 characters' });
    }

    try {
      const parsedUrl = new URL(audioUrl);
      const supabaseHost = new URL(process.env.SUPABASE_URL!).host;
      if (parsedUrl.host !== supabaseHost) {
        return res.status(400).json({ error: 'Invalid audioUrl domain. Must be the Supabase storage domain.' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid audioUrl format' });
    }

    // Fetch Audio and proxy to Groq
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error('Failed to fetch audio from storage');

    const audioBlob = await audioResponse.blob();
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');
    formData.append('model', 'distil-whisper-large-v3-en');
    formData.append('response_format', 'json');
    formData.append('language', 'en');

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: formData as any
    });

    if (!groqResponse.ok) throw new Error(`Groq API returned ${groqResponse.status}`);
    const data = await groqResponse.json();

    return res.status(200).json({ success: true, text: data.text });
  } catch (error: any) {
    console.error('Transcription failed:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal error' });
  }
}
