// @ts-nocheck: Supabase Edge Function (Deno).
// WhatsApp Cloud API webhook.
//   GET  -> Meta verification handshake (hub.challenge)
//   POST -> verify X-Hub-Signature-256, store messages idempotently, ACK fast, process in background.
// Deployed with verify_jwt = false (Meta cannot send a Supabase JWT); the HMAC signature is the auth.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseWebhook, verifyMetaSignature, markRead } from '../_shared/helpdesk/whatsapp.ts';
import { processInbound, storeInbound } from '../_shared/helpdesk/engine.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VERIFY_TOKEN = Deno.env.get('WA_VERIFY_TOKEN') ?? '';
const APP_SECRET = Deno.env.get('WA_APP_SECRET') ?? '';

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe'
      && VERIFY_TOKEN.length > 0
      && url.searchParams.get('hub.verify_token') === VERIFY_TOKEN;
    return ok
      ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 })
      : new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const rawBody = await req.text();
  if (!(await verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256'), APP_SECRET))) {
    console.warn('[whatsapp-webhook] invalid signature');
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return new Response('Bad JSON', { status: 400 }); }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { messages, statuses } = parseWebhook(payload);

  // Store first (fast, idempotent), so nothing is lost even if background processing dies.
  const toProcess: { id: string; wamid: string }[] = [];
  for (const m of messages) {
    try {
      const id = await storeInbound(supabase, m);
      if (id) toProcess.push({ id, wamid: m.externalMsgId });
    } catch (e) {
      console.error('[whatsapp-webhook] store failed', m.externalMsgId, e);
      return new Response('Storage error', { status: 500 }); // Meta will retry
    }
  }

  for (const s of statuses) {
    await supabase.from('outbound_messages')
      .update({ status: s.status, error: s.error, status_updated_at: s.timestamp })
      .eq('channel', 'whatsapp').eq('external_msg_id', s.externalMsgId);
  }

  const work = async () => {
    for (const { id, wamid } of toProcess) {
      await markRead(wamid);
      await processInbound(supabase, id); // sequential: keeps one sender's messages in order
    }
  };

  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(work());
  } else {
    await work();
  }
  return new Response('EVENT_RECEIVED', { status: 200 });
});
