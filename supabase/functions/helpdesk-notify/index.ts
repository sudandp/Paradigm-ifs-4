// @ts-nocheck: Supabase Edge Function (Deno).
// Drains public.ticket_notifications. Kicked by a DB trigger (pg_net) on every new row,
// and by the helpdesk-process-inbound cron every minute as a safety net.
// Auth: "x-cron-secret: <HELPDESK_CRON_SECRET>" or the service-role key.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processOutbox } from '../_shared/helpdesk/notify.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('HELPDESK_CRON_SECRET') ?? '';

Deno.serve(async (req: Request) => {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const cron = req.headers.get('x-cron-secret') ?? '';
  if (!((CRON_SECRET && cron === CRON_SECRET) || (SERVICE_KEY && bearer === SERVICE_KEY))) {
    return new Response('Unauthorized', { status: 401 });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  try {
    const stats = await processOutbox(supabase, 50);
    return new Response(JSON.stringify(stats), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[helpdesk-notify]', e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500 });
  }
});
