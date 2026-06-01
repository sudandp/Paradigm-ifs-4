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
      endpoint: 'groq-summarise' 
    });

    let { transcript, candidateName, role } = req.body;

    if (!transcript || !candidateName || !role) {
      return res.status(400).json({ error: 'transcript, candidateName, and role are required' });
    }

    // TASK 4: Input sanitisation and validation
    if (transcript.length > 50000) return res.status(400).json({ error: 'transcript exceeds maximum length of 50,000 characters' });
    if (candidateName.length > 200) return res.status(400).json({ error: 'candidateName exceeds maximum length of 200 characters' });
    if (role.length > 200) return res.status(400).json({ error: 'role exceeds maximum length of 200 characters' });

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
      console.error('Failed to parse JSON from Groq:', rawContent);
      return res.status(500).json({ error: 'AI returned invalid JSON formatting' });
    }

    return res.status(200).json({
      success: true,
      data: parsedResult
    });

  } catch (error: any) {
    console.error('Summarisation failed:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal error' });
  }
}
