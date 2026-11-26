#!/usr/bin/env node
// Local WhatsApp Cloud API webhook simulator (no dependencies).
//
// POST a signed inbound message:
//   node scripts/whatsapp-webhook-simulator.mjs --url http://127.0.0.1:54321/functions/v1/whatsapp-webhook \
//     --secret <WA_APP_SECRET> --from 919876543210 --name "Test User" --text "water clogged on tower 1 first floor"
// Image with caption:   ... --image-id 1479537139650973 --text "ceiling leaking"
// List reply:           ... --list-reply site:<uuid> [--text "Lakeside Towers"]
// Button reply:         ... --button-reply confirm:yes [--text "Yes"]
// Verify handshake:     node scripts/whatsapp-webhook-simulator.mjs --url <url> --verify <WA_VERIFY_TOKEN>
// Other flags: --phone-number-id <id>, --context <wamid>, --forwarded, --auth <bearer>, --dry-run, --bad-signature
import { createHmac, randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';

const { values: a } = parseArgs({
  options: {
    url: { type: 'string' },
    secret: { type: 'string', default: process.env.WA_APP_SECRET },
    from: { type: 'string', default: '919876543210' },
    name: { type: 'string', default: 'Test User' },
    text: { type: 'string' },
    'image-id': { type: 'string' },
    'list-reply': { type: 'string' },
    'button-reply': { type: 'string' },
    verify: { type: 'string' },
    'phone-number-id': { type: 'string', default: process.env.WA_PHONE_NUMBER_ID || '106540352242922' },
    'display-phone': { type: 'string', default: '15550783881' },
    context: { type: 'string' },
    forwarded: { type: 'boolean', default: false },
    auth: { type: 'string', default: process.env.SUPABASE_ANON_KEY },
    'dry-run': { type: 'boolean', default: false },
    'bad-signature': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage(code = 0) {
  console.log(`Usage:
  node scripts/whatsapp-webhook-simulator.mjs --url <function url> --secret <WA_APP_SECRET> \\
       [--from 919876543210] [--name "Test User"] (--text "..." | --image-id <id> [--text caption] |
       --list-reply <id> [--text title] | --button-reply <id> [--text title])
       [--context <wamid>] [--forwarded] [--phone-number-id <id>] [--auth <bearer>] [--dry-run] [--bad-signature]
  node scripts/whatsapp-webhook-simulator.mjs --url <function url> --verify <WA_VERIFY_TOKEN>

Env fallbacks: WA_APP_SECRET, WA_PHONE_NUMBER_ID, SUPABASE_ANON_KEY (sent as Authorization: Bearer, needed
unless the function is deployed with --no-verify-jwt).`);
  process.exit(code);
}

if (a.help) usage(0);
if (!a.url && !a['dry-run']) { console.error('error: --url is required'); usage(1); }

function headersBase() {
  const h = {};
  if (a.auth) h.Authorization = `Bearer ${a.auth}`;
  return h;
}

async function printResponse(res) {
  const text = await res.text();
  console.log(`\n<- HTTP ${res.status} ${res.statusText}`);
  for (const [k, v] of res.headers) if (/^(content-type|x-|sb-)/i.test(k)) console.log(`   ${k}: ${v}`);
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)); } catch { console.log(text); }
  if (!res.ok) process.exitCode = 1;
}

// --- GET hub.challenge handshake --------------------------------------------
if (a.verify !== undefined) {
  const challenge = String(Math.floor(Math.random() * 1e9));
  const u = new URL(a.url);
  u.searchParams.set('hub.mode', 'subscribe');
  u.searchParams.set('hub.verify_token', a.verify);
  u.searchParams.set('hub.challenge', challenge);
  console.log(`-> GET ${u}`);
  const res = await fetch(u, { headers: headersBase() });
  const body = await res.text();
  console.log(`<- HTTP ${res.status}: ${body}`);
  const ok = res.status === 200 && body.trim() === challenge;
  console.log(ok ? 'PASS: challenge echoed back' : `FAIL: expected 200 + "${challenge}"`);
  process.exit(ok ? 0 : 1);
}

// --- Build a Meta Cloud API inbound message ---------------------------------
if (!a.secret && !a['dry-run']) { console.error('error: --secret (or WA_APP_SECRET) is required'); usage(1); }

const wamid = 'wamid.' + Buffer.from(`${a.from}_${randomBytes(12).toString('hex')}`).toString('base64');
const message = { from: a.from, id: wamid, timestamp: String(Math.floor(Date.now() / 1000)) };

if (a['image-id']) {
  message.type = 'image';
  message.image = {
    mime_type: 'image/jpeg',
    sha256: randomBytes(32).toString('base64'),
    id: a['image-id'],
    ...(a.text ? { caption: a.text } : {}),
  };
} else if (a['list-reply']) {
  message.type = 'interactive';
  message.interactive = { type: 'list_reply', list_reply: { id: a['list-reply'], title: a.text ?? a['list-reply'].slice(0, 24) } };
} else if (a['button-reply']) {
  message.type = 'interactive';
  message.interactive = { type: 'button_reply', button_reply: { id: a['button-reply'], title: a.text ?? a['button-reply'].slice(0, 20) } };
} else if (a.text !== undefined) {
  message.type = 'text';
  message.text = { body: a.text };
} else {
  console.error('error: one of --text, --image-id, --list-reply, --button-reply, --verify is required');
  usage(1);
}

if (a.context || a.forwarded) {
  message.context = {
    ...(a.context ? { from: a['display-phone'], id: a.context } : {}),
    ...(a.forwarded ? { forwarded: true } : {}),
  };
}

const payload = {
  object: 'whatsapp_business_account',
  entry: [{
    id: '102290129340398',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: a['display-phone'], phone_number_id: a['phone-number-id'] },
        contacts: [{ profile: { name: a.name }, wa_id: a.from }],
        messages: [message],
      },
    }],
  }],
};

const raw = JSON.stringify(payload);
let signature = 'sha256=' + createHmac('sha256', a.secret ?? '').update(raw, 'utf8').digest('hex');
if (a['bad-signature']) signature = 'sha256=' + '0'.repeat(64);

console.log(`-> POST ${a.url ?? '(dry run)'}`);
console.log(`   X-Hub-Signature-256: ${signature}`);
console.log(JSON.stringify(payload, null, 2));
if (a['dry-run']) process.exit(0);

const started = Date.now();
try {
  const res = await fetch(a.url, {
    method: 'POST',
    headers: { ...headersBase(), 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
    body: raw,
  });
  await printResponse(res);
  console.log(`   (${Date.now() - started} ms, message id ${wamid})`);
} catch (e) {
  console.error(`request failed: ${e?.cause?.message ?? e?.message ?? e}`);
  process.exit(1);
}
