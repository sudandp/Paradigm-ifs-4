// @ts-nocheck: Supabase Edge Function (Deno).
// Cron worker (every minute) for the omnichannel helpdesk:
//   - retries inbound messages left pending/failed (max 3 attempts)
//   - un-sticks rows stuck in "processing" (worker died)
//   - turns drafts that waited > 30 min for a location into tickets
//   - drains the ticket_notifications outbox (safety net for the pg_net kick)
// Auth: header "x-cron-secret: <HELPDESK_CRON_SECRET>" (stored in Vault for pg_cron), or the service-role key.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { expireStaleDrafts, processInbound } from '../_shared/helpdesk/engine.ts';
import { processOutbox } from '../_shared/helpdesk/notify.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('HELPDESK_CRON_SECRET') ?? '';
const MAX_ATTEMPTS = 3;

Deno.serve(async (req: Request) => {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const cron = req.headers.get('x-cron-secret') ?? '';
  const authorised = (CRON_SECRET && cron === CRON_SECRET) || (SERVICE_KEY && bearer === SERVICE_KEY);
  if (!authorised) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Rows stuck in "processing" for > 5 min -> failed, so they get retried
  await supabase.from('inbound_messages')
    .update({ status: 'failed', error: 'processing timeout' })
    .eq('status', 'processing')
    .lt('received_at', new Date(Date.now() - 5 * 60_000).toISOString());

  const { data: due } = await supabase.from('inbound_messages')
    .select('id')
    .in('status', ['pending', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
    .lt('received_at', new Date(Date.now() - 60_000).toISOString()) // leave fresh ones to the webhook
    .order('received_at', { ascending: true })
    .limit(25);

  for (const row of due ?? []) await processInbound(supabase, row.id);
  const drafts = await expireStaleDrafts(supabase);
  let notifications = null;
  try { notifications = await processOutbox(supabase, 50); } catch (e) { console.error('[helpdesk-process-inbound] outbox', e); }

  return new Response(JSON.stringify({ retried: due?.length ?? 0, drafts_converted: drafts, notifications }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
