import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import FormData from 'form-data';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;
  console.log('[Vercel Exotel Webhook] Callback received:', body);

  const callSid = body?.Call?.Sid || body?.CallSid;
  const status = body?.Call?.Status || body?.Status;
  const recordingUrl = body?.Call?.RecordingUrl || body?.RecordingUrl;
  const durationStr = body?.Call?.DialDuration || body?.DialDuration || body?.Call?.Duration || body?.Duration || '0';
  const durationSeconds = parseInt(durationStr, 10);

  const hrNumber = process.env.EXOTEL_HR_NUMBER || '';
  const fromNum = body?.Call?.From || body?.From;
  const toNum = body?.Call?.To || body?.To;
  const phoneNumber = toNum === hrNumber ? fromNum : toNum;

  if (!callSid || !phoneNumber) {
    console.warn('[Vercel Exotel Webhook] Missing CallSid or phone number.');
    return res.status(200).send('OK (Missing Sid/Phone)');
  }

  // Broadcast call_ended
  try {
    await supabase.channel('call_updates').send({
      type: 'broadcast',
      event: 'call_ended',
      payload: { phoneNumber }
    });
  } catch (e) {
    console.error('Realtime broadcast failed:', e);
  }

  // If call not completed or no recording URL
  if (status !== 'completed' || !recordingUrl) {
    console.log(`[Vercel Exotel Webhook] Call failed or no recording. Status: ${status}`);
    try {
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
    } catch (dbErr) {
      console.error('Database write failed:', dbErr);
    }
    return res.status(200).send('OK (Failed Call Recorded)');
  }

  // Process synchronous callback execution for Vercel
  try {
    console.log(`[Vercel Exotel Webhook] Downloading audio...`);
    const apiKey = process.env.EXOTEL_API_KEY || '';
    const apiToken = process.env.EXOTEL_API_TOKEN || '';
    const auth = 'Basic ' + Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
    
    const mediaRes = await fetch(recordingUrl, {
      headers: { 'Authorization': auth }
    });

    if (!mediaRes.ok) {
      throw new Error(`Exotel audio download failed: ${mediaRes.status}`);
    }

    const audioBuffer = Buffer.from(await mediaRes.arrayBuffer());
    console.log(`[Vercel Exotel Webhook] Audio downloaded: ${audioBuffer.length} bytes.`);

    const ext = recordingUrl.includes('.mp3') ? 'mp3' : 'wav';
    const filename = `exotel_${callSid}_${Date.now()}.${ext}`;
    const contentType = ext === 'mp3' ? 'audio/mpeg' : 'audio/wav';

    // Upload to Supabase Storage
    console.log(`[Vercel Exotel Webhook] Uploading to Storage...`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('call-recordings')
      .upload(`audio/${filename}`, audioBuffer, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Supabase Storage upload error: ${uploadError.message}`);
    }

    const s3Path = uploadData.path;

    // Transcribe
    console.log(`[Vercel Exotel Webhook] Transcribing...`);
    const transcriptText = await transcribeAudioBuffer(audioBuffer, filename, contentType);

    // Candidate details
    const candidate = await lookupCandidate(phoneNumber);
    const candidateName = candidate?.name || 'Unknown Candidate';
    const candidateRole = candidate?.requested_role || 'General Candidate';
    const candidateId = candidate?.id || null;

    // Summarize
    console.log(`[Vercel Exotel Webhook] Summarizing...`);
    const summaryJson = await summariseText(transcriptText, candidateName, candidateRole);

    // Save records
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

    if (dbErr1) throw new Error(`Recording DB write failed: ${dbErr1.message}`);

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

    if (dbErr2) throw new Error(`Transcript DB write failed: ${dbErr2.message}`);

    // Insert hrm_call_log for CRM integration
    const outcomeVal = summaryJson.callOutcome.toLowerCase().replace(' ', '_');
    await supabase
      .from('hrm_call_logs')
      .insert({
        candidate_id: candidateId,
        caller_id: hrUserId,
        called_at: new Date().toISOString(),
        outcome: outcomeVal,
        notes: summaryJson.summary,
        next_call_at: summaryJson.followUpDate ? new Date(summaryJson.followUpDate).toISOString() : null
      });

    // Broadcast success
    await supabase.channel('call_updates').send({
      type: 'broadcast',
      event: 'call_processed',
      payload: { recording_id: recRecord.id, phoneNumber }
    });

    console.log('[Vercel Exotel Webhook] VoIP processing completed!');
    return res.status(200).send('OK (Call Processed successfully)');

  } catch (error: any) {
    console.error('Vercel Exotel Webhook failed:', error);
    try {
      await supabase.channel('call_updates').send({
        type: 'broadcast',
        event: 'call_error',
        payload: { phoneNumber }
      });
    } catch {}
    return res.status(500).json({ success: false, error: error.message || 'Internal error' });
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
    console.error('[Exotel Webhook] Candidate lookup error:', error.message);
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
    console.error('[Exotel Webhook] Failed user lookup:', error.message);
  }
  return data?.id || null;
}
