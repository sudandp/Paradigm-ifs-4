import { Request, Response } from 'express';
import FormData from 'form-data';
import fetch from 'node-fetch';
import busboy from 'busboy';
import { Readable } from 'stream';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

/**
 * POST /api/groq-transcribe
 * Accepts multipart/form-data with an 'audio' file field.
 * Proxies the audio to Groq Whisper and returns { text }.
 */
export async function transcribeAudio(req: Request, res: Response) {
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured on server' });
  }

  try {
    // Parse the incoming multipart file using busboy
    const bb = busboy({ headers: req.headers });
    let audioBuffer: Buffer | null = null;
    let audioFileName = 'recording.wav';

    await new Promise<void>((resolve, reject) => {
      bb.on('file', (_field, fileStream, info) => {
        audioFileName = info.filename || audioFileName;
        const chunks: Buffer[] = [];
        fileStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        fileStream.on('end', () => { audioBuffer = Buffer.concat(chunks); });
        fileStream.on('error', reject);
      });
      bb.on('finish', resolve);
      bb.on('error', reject);
      req.pipe(bb);
    });

    if (!audioBuffer) {
      return res.status(400).json({ error: 'No audio file received' });
    }

    // Forward to Groq Whisper
    const groqForm = new FormData();
    groqForm.append('file', audioBuffer, { filename: audioFileName, contentType: 'audio/wav' });
    groqForm.append('model', 'whisper-large-v3-turbo');
    groqForm.append('response_format', 'json');
    groqForm.append('language', 'en');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        ...groqForm.getHeaders()
      },
      body: groqForm
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('[Groq Transcribe] API error:', errText);
      return res.status(groqRes.status).json({ error: `Groq API error: ${errText}` });
    }

    const data = await groqRes.json() as { text: string };
    console.log(`[Groq Transcribe] Transcribed ${audioFileName}: "${data.text?.substring(0, 80)}..."`);
    return res.status(200).json({ success: true, text: data.text || '' });

  } catch (error: any) {
    console.error('[Express Groq Controller] Transcription Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

/**
 * POST /api/groq-summarise
 * Accepts JSON body: { transcript, candidateName, role }
 * Returns structured AI summary using Groq Llama.
 */
export async function summariseTranscript(req: Request, res: Response) {
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured on server' });
  }

  try {
    const { transcript, candidateName = 'the candidate', role = 'the role' } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'transcript field is required' });
    }

    const systemPrompt = `You are an expert HR recruitment assistant. Analyse call transcripts between HR professionals and job candidates. Return ONLY a valid JSON object.`;

    const userPrompt = `Analyse this call transcript for candidate "${candidateName}" applying for "${role}".

TRANSCRIPT:
${transcript}

Return ONLY this JSON (no markdown, no code blocks):
{
  "summary": "2-3 sentence overall summary",
  "candidateInterest": "High | Medium | Low",
  "keyPoints": ["point 1", "point 2"],
  "actionItems": ["action 1", "action 2"],
  "followUpDate": "YYYY-MM-DD or null",
  "suggestedStage": "Screening | Technical Interview | HR Interview | Offer | Rejected",
  "callOutcome": "Successful | Voicemail | No Answer | Rescheduled"
}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
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

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('[Groq Summarise] API error:', errText);
      return res.status(groqRes.status).json({ error: `Groq API error: ${errText}` });
    }

    const data = await groqRes.json() as any;
    const raw = data.choices?.[0]?.message?.content || '{}';

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try extracting JSON from markdown code blocks
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      parsed = match ? JSON.parse(match[1]) : { summary: raw };
    }

    console.log(`[Groq Summarise] Summary generated for ${candidateName}: "${parsed.summary?.substring(0, 60)}..."`);
    return res.status(200).json({ success: true, ...parsed });

  } catch (error: any) {
    console.error('[Express Groq Controller] Summarisation Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
