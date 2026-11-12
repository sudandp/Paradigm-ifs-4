import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Content-Length', TRACKING_PIXEL.length.toString());
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.status(200).send(TRACKING_PIXEL);

  const { c: campaignId, r: recipientEmail } = req.query;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (campaignId && recipientEmail && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: campaign } = await adminClient
        .from('marketing_campaigns')
        .select('opened_count')
        .eq('id', campaignId)
        .single();

      if (campaign) {
        await adminClient
          .from('marketing_campaigns')
          .update({
            opened_count: (campaign.opened_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', campaignId);
      }

      await adminClient.from('email_logs').insert({
        recipient_email: String(recipientEmail),
        subject: 'Campaign Opened',
        status: 'opened',
        rule_id: String(campaignId),
        metadata: {
          type: 'campaign_open',
          ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          user_agent: req.headers['user-agent']
        },
        created_at: new Date().toISOString()
      });
    } catch (e: any) {
      console.warn('[Vercel Open Track] Error logging open:', e.message);
    }
  }
}

