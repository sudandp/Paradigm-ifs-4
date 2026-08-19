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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const action = (req.query.action as string) || (req.url?.includes('transcribe') ? 'transcribe' : 'summarise');

    // ── Transcribe Action ─────────────────────────────────────
    if (action === 'transcribe') {
      const { audioUrl } = req.body;
      if (!audioUrl || typeof audioUrl !== 'string') {
        return res.status(400).json({ error: 'audioUrl is required' });
      }

      if (audioUrl.length > 2000) {
        return res.status(400).json({ error: 'audioUrl exceeds maximum length of 2000 characters' });
      }

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
    }

    // ── Summarise Action ──────────────────────────────────────
    let { transcript, candidateName, role } = req.body;
    if (!transcript || !candidateName || !role) {
      return res.status(400).json({ error: 'transcript, candidateName, and role are required' });
    }

    const stripHtml = (str: string) => str.replace(/<[^>]*>?/gm, '');
    transcript = stripHtml(transcript);
    candidateName = stripHtml(candidateName);
    role = stripHtml(role);

    const systemPrompt = `You are an expert HR recruitment assistant. 
Analyze the provided phone call transcript between an HR representative and a candidate named ${candidateName} who is applying for the role of ${role}.

You MUST return your response as a raw, valid JSON object with the following exact keys:
{
  "summary": "A concise 2-3 sentence summary of the conversation.",
  "candidateInterest": "High, Medium, or Low",
  "keyPoints": ["Array of string bullet points"],
  "actionItems": ["Array of tasks HR needs to do next"],
  "followUpDate": "ISO Date string (YYYY-MM-DD) if mentioned, otherwise null",
  "suggestedStage": "String (e.g., Interview, Rejected, Offer)",
  "callOutcome": "Must be one of: reached, no_answer, callback, interested, not_interested"
}

Do not include markdown blocks, just the JSON string.`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (!groqResponse.ok) {
      throw new Error(`Groq Chat API returned ${groqResponse.status}`);
    }

    const groqData = await groqResponse.json();
    const rawContent = groqData.choices[0].message.content;

    let parsedResult;
    try {
      parsedResult = JSON.parse(rawContent);
    } catch (parseErr) {
      return res.status(500).json({ error: 'AI returned invalid JSON formatting' });
    }

    return res.status(200).json({
      success: true,
      data: parsedResult
    });

  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Internal error' });
  }
}
