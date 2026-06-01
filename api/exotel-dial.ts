import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

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
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(403).json({ error: 'Forbidden: Invalid user token' });
    }

    const { targetNumber } = req.body;
    if (!targetNumber) {
      return res.status(400).json({ error: 'targetNumber is required' });
    }

    const apiKey = process.env.EXOTEL_API_KEY || '';
    const apiToken = process.env.EXOTEL_API_TOKEN || '';
    const accountSid = process.env.EXOTEL_ACCOUNT_SID || '';
    const subdomain = process.env.EXOTEL_SUBDOMAIN || 'api.in.exotel.com';

    let fromNumber = process.env.EXOTEL_HR_NUMBER || '';
    let callerIdNumber = process.env.EXOTEL_EXOPHONE || '';

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
          console.log(`[Vercel Exotel] Using mapped connection for user ${user.id}: From ${fromNumber}, CallerId: ${callerIdNumber}`);
        }
      }
    } catch (e) {
      console.warn('[Vercel Exotel] Failed to lookup VoIP settings mapping:', e);
    }

    if (!apiKey || !apiToken || !accountSid || !fromNumber || !callerIdNumber) {
      return res.status(500).json({ error: 'Exotel credentials or user mapping are not fully configured on server.' });
    }

    const url = `https://${apiKey}:${apiToken}@${subdomain}/v1/Accounts/${accountSid}/Calls/connect`;

    // Dynamic Callback Url based on host
    const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const host = req.headers.host;
    const callbackUrl = `${protocol}://${host}/api/exotel-callback`;

    console.log(`[Vercel Exotel] Connecting call. Mapped From: ${fromNumber} -> Candidate: ${targetNumber}. Callback: ${callbackUrl}`);

    const formData = new URLSearchParams({
      From: fromNumber,
      To: targetNumber,
      CallerId: callerIdNumber,
      Record: 'true',
      TimeLimit: '3600',
      StatusCallback: callbackUrl,
      StatusCallbackContentType: 'application/json'
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

    console.log(`[Vercel Exotel] Call initiated successfully. SID: ${callSid}`);
    return res.status(200).json({ success: true, callSid });

  } catch (error: any) {
    console.error('VoIP connect call failed:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal error' });
  }
}
