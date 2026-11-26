// Run: deno test --allow-env supabase/functions/_shared/helpdesk/tests/
// (whatsapp.ts reads WA_* env vars at import time, so --allow-env is required.)
import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { parseWebhook, verifyMetaSignature } from '../whatsapp.ts';

const SECRET = 'test_app_secret_123';
// parseWebhook drops events for other numbers when WA_PHONE_NUMBER_ID is set; match it if present.
const PHONE_NUMBER_ID = Deno.env.get('WA_PHONE_NUMBER_ID') || '106540352242922';

async function sign(body: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  return 'sha256=' + Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// verifyMetaSignature
// ---------------------------------------------------------------------------
const BODY = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: '1', changes: [] }] });

Deno.test('verifyMetaSignature: valid signature', async () => {
  assertEquals(await verifyMetaSignature(BODY, await sign(BODY), SECRET), true);
});

Deno.test('verifyMetaSignature: uppercase hex digest accepted', async () => {
  const h = await sign(BODY);
  assertEquals(await verifyMetaSignature(BODY, 'sha256=' + h.slice(7).toUpperCase(), SECRET), true);
});

Deno.test('verifyMetaSignature: tampered body', async () => {
  const h = await sign(BODY);
  assertEquals(await verifyMetaSignature(BODY.replace('"1"', '"2"'), h, SECRET), false);
});

Deno.test('verifyMetaSignature: wrong secret', async () => {
  assertEquals(await verifyMetaSignature(BODY, await sign(BODY, 'other'), SECRET), false);
});

Deno.test('verifyMetaSignature: missing header / empty secret', async () => {
  assertEquals(await verifyMetaSignature(BODY, null, SECRET), false);
  assertEquals(await verifyMetaSignature(BODY, '', SECRET), false);
  assertEquals(await verifyMetaSignature(BODY, await sign(BODY), ''), false);
});

Deno.test('verifyMetaSignature: wrong prefix', async () => {
  const h = await sign(BODY);
  assertEquals(await verifyMetaSignature(BODY, 'sha1=' + h.slice(7), SECRET), false);
  assertEquals(await verifyMetaSignature(BODY, h.slice(7), SECRET), false);
});

Deno.test('verifyMetaSignature: truncated digest', async () => {
  const h = await sign(BODY);
  assertEquals(await verifyMetaSignature(BODY, h.slice(0, -2), SECRET), false);
});

// ---------------------------------------------------------------------------
// parseWebhook — Meta Cloud API webhook shapes
// ---------------------------------------------------------------------------
const FROM = '919876543210';

function envelope(value: Record<string, unknown>, object = 'whatsapp_business_account') {
  return {
    object,
    entry: [{
      id: '102290129340398', // WABA id
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '15550783881', phone_number_id: PHONE_NUMBER_ID },
          ...value,
        },
      }],
    }],
  };
}

const contacts = [{ profile: { name: 'Test User' }, wa_id: FROM }];

function messagePayload(message: Record<string, unknown>) {
  return envelope({
    contacts,
    messages: [{ from: FROM, id: 'wamid.HBgMOTE5ODc2NTQzMjEwFQIAEhggQTFCMkMzRDQ=', timestamp: '1764067200', ...message }],
  });
}

Deno.test('parseWebhook: text message', () => {
  const { messages, statuses } = parseWebhook(messagePayload({
    type: 'text', text: { body: '  water clogged on tower 1 first floor ' },
  }));
  assertEquals(statuses.length, 0);
  assertEquals(messages.length, 1);
  const m = messages[0];
  assertEquals(m.channel, 'whatsapp');
  assertEquals(m.externalMsgId, 'wamid.HBgMOTE5ODc2NTQzMjEwFQIAEhggQTFCMkMzRDQ=');
  assertEquals(m.senderId, FROM);
  assertEquals(m.senderName, 'Test User');
  assertEquals(m.msgType, 'text');
  assertEquals(m.body, 'water clogged on tower 1 first floor');
  assertEquals(m.replyId, null);
  assertEquals(m.media, []);
  assertEquals(m.contextMsgId, null);
  assertEquals(m.isForwarded, false);
  assertEquals(m.receivedAt, new Date(1764067200 * 1000).toISOString());
});

Deno.test('parseWebhook: image with caption', () => {
  const { messages } = parseWebhook(messagePayload({
    type: 'image',
    image: {
      caption: 'Ceiling leaking in lobby',
      mime_type: 'image/jpeg',
      sha256: 'Gx3b1pWbQZr0kz3m4v6s9yJ8vZ0eYw1yVq2Qe9d0xYc=',
      id: '1479537139650973',
    },
  }));
  assertEquals(messages.length, 1);
  assertEquals(messages[0].msgType, 'image');
  assertEquals(messages[0].body, 'Ceiling leaking in lobby');
  assertEquals(messages[0].media, [{
    id: '1479537139650973', mime_type: 'image/jpeg',
    sha256: 'Gx3b1pWbQZr0kz3m4v6s9yJ8vZ0eYw1yVq2Qe9d0xYc=', filename: undefined,
  }]);
});

Deno.test('parseWebhook: image without caption -> body null', () => {
  const { messages } = parseWebhook(messagePayload({
    type: 'image', image: { mime_type: 'image/jpeg', sha256: 'x', id: '999' },
  }));
  assertEquals(messages[0].body, null);
  assertEquals(messages[0].media.length, 1);
});

Deno.test('parseWebhook: interactive list_reply', () => {
  const { messages } = parseWebhook(messagePayload({
    type: 'interactive',
    context: { from: '15550783881', id: 'wamid.OUTBOUND_LIST_MSG' },
    interactive: {
      type: 'list_reply',
      list_reply: { id: 'site:6f1c2a9e-0b7d-4c35-9a52-1f3e8d2b7c40', title: 'Lakeside Towers', description: 'Whitefield' },
    },
  }));
  assertEquals(messages[0].msgType, 'interactive');
  assertEquals(messages[0].replyId, 'site:6f1c2a9e-0b7d-4c35-9a52-1f3e8d2b7c40');
  assertEquals(messages[0].body, 'Lakeside Towers');
  assertEquals(messages[0].contextMsgId, 'wamid.OUTBOUND_LIST_MSG');
  assertEquals(messages[0].isForwarded, false);
});

Deno.test('parseWebhook: interactive button_reply', () => {
  const { messages } = parseWebhook(messagePayload({
    type: 'interactive',
    interactive: { type: 'button_reply', button_reply: { id: 'confirm:yes', title: 'Yes' } },
  }));
  assertEquals(messages[0].replyId, 'confirm:yes');
  assertEquals(messages[0].body, 'Yes');
});

Deno.test('parseWebhook: template quick-reply button', () => {
  const { messages } = parseWebhook(messagePayload({
    type: 'button',
    context: { from: '15550783881', id: 'wamid.TEMPLATE_MSG' },
    button: { payload: 'feedback:good', text: 'Resolved 👍' },
  }));
  assertEquals(messages[0].msgType, 'button');
  assertEquals(messages[0].replyId, 'feedback:good');
  assertEquals(messages[0].body, 'Resolved 👍');
  assertEquals(messages[0].contextMsgId, 'wamid.TEMPLATE_MSG');
});

Deno.test('parseWebhook: forwarded message', () => {
  const fwd = parseWebhook(messagePayload({
    type: 'text', text: { body: 'Lift not working' }, context: { forwarded: true },
  }));
  assertEquals(fwd.messages[0].isForwarded, true);
  assertEquals(fwd.messages[0].contextMsgId, null);

  const freq = parseWebhook(messagePayload({
    type: 'text', text: { body: 'Lift not working' }, context: { frequently_forwarded: true },
  }));
  assertEquals(freq.messages[0].isForwarded, true);
});

Deno.test('parseWebhook: location message', () => {
  const { messages } = parseWebhook(messagePayload({
    type: 'location',
    location: { latitude: 12.97, longitude: 77.75, name: 'Lakeside Towers', address: 'Whitefield, Bengaluru' },
  }));
  assertEquals(messages[0].body, 'Lakeside Towers, Whitefield, Bengaluru');
});

Deno.test('parseWebhook: statuses payload', () => {
  const payload = envelope({
    statuses: [
      {
        id: 'wamid.OUT1', status: 'delivered', timestamp: '1764067300', recipient_id: FROM,
        conversation: { id: 'c1', origin: { type: 'service' } },
        pricing: { billable: true, pricing_model: 'CBP', category: 'service' },
      },
      {
        id: 'wamid.OUT2', status: 'failed', timestamp: '1764067301', recipient_id: FROM,
        errors: [{ code: 131047, title: 'Re-engagement message', message: 'Re-engagement message' }],
      },
    ],
  });
  const { messages, statuses } = parseWebhook(payload);
  assertEquals(messages.length, 0);
  assertEquals(statuses, [
    { externalMsgId: 'wamid.OUT1', status: 'delivered', error: null, timestamp: new Date(1764067300 * 1000).toISOString() },
    { externalMsgId: 'wamid.OUT2', status: 'failed', error: '131047: Re-engagement message', timestamp: new Date(1764067301 * 1000).toISOString() },
  ]);
});

Deno.test('parseWebhook: wrong object ignored', () => {
  const payload = messagePayload({ type: 'text', text: { body: 'hi' } });
  (payload as any).object = 'page';
  assertEquals(parseWebhook(payload), { messages: [], statuses: [] });
  assertEquals(parseWebhook(null), { messages: [], statuses: [] });
  assertEquals(parseWebhook({}), { messages: [], statuses: [] });
});

Deno.test('parseWebhook: reaction ignored, other messages in batch kept', () => {
  const payload = envelope({
    contacts,
    messages: [
      { from: FROM, id: 'wamid.R1', timestamp: '1764067200', type: 'reaction', reaction: { message_id: 'wamid.OUT1', emoji: '👍' } },
      { from: FROM, id: 'wamid.T1', timestamp: '1764067201', type: 'text', text: { body: 'thanks' } },
    ],
  });
  const { messages } = parseWebhook(payload);
  assertEquals(messages.length, 1);
  assertEquals(messages[0].externalMsgId, 'wamid.T1');
});

Deno.test('parseWebhook: non-messages field ignored', () => {
  const payload = messagePayload({ type: 'text', text: { body: 'hi' } });
  (payload as any).entry[0].changes[0].field = 'message_template_status_update';
  assertEquals(parseWebhook(payload).messages.length, 0);
});

Deno.test('parseWebhook: unknown sender name -> null', () => {
  const payload = messagePayload({ type: 'text', text: { body: 'hi' } });
  delete (payload as any).entry[0].changes[0].value.contacts;
  const { messages } = parseWebhook(payload);
  assert(messages.length === 1);
  assertEquals(messages[0].senderName, null);
});
