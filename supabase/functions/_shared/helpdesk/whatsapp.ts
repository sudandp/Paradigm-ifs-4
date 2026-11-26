// @ts-nocheck: Supabase Edge Function (Deno) module.
// WhatsApp Cloud API (Meta) client: webhook signature check, payload parsing, sending, media download.
// Written against Meta's native payload so a BSP that proxies the Cloud API only needs env changes.

const GRAPH_VERSION = Deno.env.get('WA_GRAPH_VERSION') ?? 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const WA_TOKEN = Deno.env.get('WA_ACCESS_TOKEN') ?? '';
const WA_PHONE_NUMBER_ID = Deno.env.get('WA_PHONE_NUMBER_ID') ?? '';
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

export interface NormalizedMessage {
  channel: 'whatsapp';
  externalMsgId: string;
  senderId: string;          // wa_id, digits only, with country code
  senderName: string | null;
  msgType: string;
  body: string | null;       // text, caption, or interactive reply title
  replyId: string | null;    // interactive list/button reply id (e.g. "site:<uuid>")
  media: { id: string; mime_type: string; sha256?: string; filename?: string }[];
  contextMsgId: string | null;
  isForwarded: boolean;
  receivedAt: string;
  raw: unknown;
}

export interface StatusUpdate {
  externalMsgId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error: string | null;
  timestamp: string;
}

/** Verify Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body with the app secret). */
export async function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header || !appSecret || !header.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const expected = Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join('');
  const given = header.slice('sha256='.length).toLowerCase();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

export function parseWebhook(payload: any): { messages: NormalizedMessage[]; statuses: StatusUpdate[] } {
  const messages: NormalizedMessage[] = [];
  const statuses: StatusUpdate[] = [];
  if (payload?.object !== 'whatsapp_business_account') return { messages, statuses };

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const value = change.value ?? {};
      // Ignore events for other numbers on the same WABA
      if (WA_PHONE_NUMBER_ID && value.metadata?.phone_number_id && value.metadata.phone_number_id !== WA_PHONE_NUMBER_ID) continue;

      const names = new Map<string, string>();
      for (const c of value.contacts ?? []) names.set(c.wa_id, c.profile?.name ?? null);

      for (const m of value.messages ?? []) {
        if (m.type === 'reaction' || m.type === 'system' || m.type === 'ephemeral') continue;
        const media: NormalizedMessage['media'] = [];
        let body: string | null = null;
        let replyId: string | null = null;

        switch (m.type) {
          case 'text': body = m.text?.body ?? null; break;
          case 'image': case 'video': case 'audio': case 'sticker': case 'document': {
            const obj = m[m.type];
            if (obj?.id) media.push({ id: obj.id, mime_type: obj.mime_type, sha256: obj.sha256, filename: obj.filename });
            body = obj?.caption ?? null;
            break;
          }
          case 'interactive': {
            const r = m.interactive?.list_reply ?? m.interactive?.button_reply;
            replyId = r?.id ?? null;
            body = r?.title ?? null;
            break;
          }
          case 'button': replyId = m.button?.payload ?? null; body = m.button?.text ?? null; break;
          case 'location': {
            const l = m.location ?? {};
            body = [l.name, l.address].filter(Boolean).join(', ') || null;
            break;
          }
        }

        messages.push({
          channel: 'whatsapp',
          externalMsgId: m.id,
          senderId: String(m.from),
          senderName: names.get(m.from) ?? null,
          msgType: m.type,
          body: body?.trim() || null,
          replyId,
          media,
          contextMsgId: m.context?.id ?? null,
          isForwarded: Boolean(m.context?.forwarded || m.context?.frequently_forwarded),
          receivedAt: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString(),
          raw: m,
        });
      }

      for (const s of value.statuses ?? []) {
        statuses.push({
          externalMsgId: s.id,
          status: s.status,
          error: s.errors?.[0] ? `${s.errors[0].code}: ${s.errors[0].title}` : null,
          timestamp: s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString(),
        });
      }
    }
  }
  return { messages, statuses };
}

async function graphPost(path: string, body: unknown): Promise<any> {
  if (!WA_TOKEN || !WA_PHONE_NUMBER_ID) throw new Error('WA_ACCESS_TOKEN / WA_PHONE_NUMBER_ID not configured');
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${json?.error?.message ?? JSON.stringify(json)}`);
  return json;
}

/** Build a Cloud API message payload. `kind` decides the shape. */
export function buildTextPayload(to: string, text: string, replyToWamid?: string | null) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text.slice(0, 4096), preview_url: false },
    ...(replyToWamid ? { context: { message_id: replyToWamid } } : {}),
  };
}

/** Interactive list (max 10 rows). rows: [{id, title (<=24 chars), description?}] */
export function buildListPayload(to: string, bodyText: string, buttonText: string, rows: { id: string; title: string; description?: string }[]) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText.slice(0, 1024) },
      action: {
        button: buttonText.slice(0, 20),
        sections: [{
          title: 'Options',
          rows: rows.slice(0, 10).map((r) => ({
            id: r.id.slice(0, 200),
            title: r.title.slice(0, 24),
            ...(r.description ? { description: r.description.slice(0, 72) } : {}),
          })),
        }],
      },
    },
  };
}

/** Reply buttons (max 3, title <= 20 chars). Only allowed inside the 24h customer-service window. */
export function buildButtonsPayload(to: string, bodyText: string, buttons: { id: string; title: string }[]) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText.slice(0, 1024) },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) } })) },
    },
  };
}

/** Image by URL (e.g. a short-lived signed Supabase Storage URL). */
export function buildImagePayload(to: string, link: string, caption?: string) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: { link, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
  };
}

/**
 * Pre-approved template (required outside the 24h window).
 * bodyParams fill {{1}}, {{2}}…; quickReplyPayloads set the payload of quick-reply buttons by index.
 */
export function buildTemplatePayload(to: string, name: string, lang: string, bodyParams: string[], quickReplyPayloads: string[] = []) {
  const components: any[] = [];
  if (bodyParams.length) {
    components.push({
      type: 'body',
      // Template params may not contain newlines/tabs or > 4 consecutive spaces
      parameters: bodyParams.map((p) => ({ type: 'text', text: String(p ?? '-').replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').slice(0, 1000) || '-' })),
    });
  }
  quickReplyPayloads.forEach((payload, index) => {
    components.push({ type: 'button', sub_type: 'quick_reply', index: String(index), parameters: [{ type: 'payload', payload }] });
  });
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: { name, language: { code: lang }, ...(components.length ? { components } : {}) },
  };
}

/** WhatsApp allows free-form messages only within 24h of the user's last message (keep a safety margin). */
export function isWithinServiceWindow(lastInboundAt: string | null | undefined): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - new Date(lastInboundAt).getTime() < 23.5 * 3600_000;
}

export async function sendPayload(payload: unknown): Promise<string | null> {
  const json = await graphPost(`${WA_PHONE_NUMBER_ID}/messages`, payload);
  return json?.messages?.[0]?.id ?? null;
}

/** Blue ticks + typing indicator are best-effort only. */
export async function markRead(wamid: string): Promise<void> {
  try {
    await graphPost(`${WA_PHONE_NUMBER_ID}/messages`, { messaging_product: 'whatsapp', status: 'read', message_id: wamid });
  } catch (_e) { /* non-fatal */ }
}

/** Media URLs from Meta expire in minutes: download right away. */
export async function downloadMedia(mediaId: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (!WA_TOKEN) throw new Error('WA_ACCESS_TOKEN not configured');
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
  const meta = await metaRes.json();
  if (!metaRes.ok || !meta?.url) throw new Error(`media lookup failed: ${meta?.error?.message ?? metaRes.status}`);
  if (meta.file_size && meta.file_size > MAX_MEDIA_BYTES) throw new Error(`media too large (${meta.file_size} bytes)`);
  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
  if (!fileRes.ok) throw new Error(`media download failed: ${fileRes.status}`);
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  return { bytes, mimeType: meta.mime_type ?? fileRes.headers.get('content-type') ?? 'application/octet-stream' };
}
