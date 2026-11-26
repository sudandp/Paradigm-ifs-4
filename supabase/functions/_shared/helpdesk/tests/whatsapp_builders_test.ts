// Run: deno test --no-lock --allow-env supabase/functions/_shared/helpdesk/tests/
// Unit tests for the Phase 3 WhatsApp payload builders and the 24h service-window check.
import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  buildButtonsPayload,
  buildImagePayload,
  buildTemplatePayload,
  isWithinServiceWindow,
} from '../whatsapp.ts';

const TO = '919876543210';
const HOUR = 3600_000;

// ---------------------------------------------------------------------------
// buildButtonsPayload
// ---------------------------------------------------------------------------
Deno.test('buildButtonsPayload: interactive button envelope', () => {
  const p = buildButtonsPayload(TO, 'Is the issue fixed?', [
    { id: 'confirm:yes:abc', title: 'Yes, fixed' },
    { id: 'confirm:no:abc', title: 'Not fixed' },
  ]);
  assertEquals(p.messaging_product, 'whatsapp');
  assertEquals(p.recipient_type, 'individual');
  assertEquals(p.to, TO);
  assertEquals(p.type, 'interactive');
  assertEquals(p.interactive.type, 'button');
  assertEquals(p.interactive.body.text, 'Is the issue fixed?');
  assertEquals(p.interactive.action.buttons, [
    { type: 'reply', reply: { id: 'confirm:yes:abc', title: 'Yes, fixed' } },
    { type: 'reply', reply: { id: 'confirm:no:abc', title: 'Not fixed' } },
  ]);
});

Deno.test('buildButtonsPayload: at most 3 buttons', () => {
  const buttons = ['a', 'b', 'c', 'd', 'e'].map((x) => ({ id: x, title: x.toUpperCase() }));
  const p = buildButtonsPayload(TO, 'pick', buttons);
  assertEquals(p.interactive.action.buttons.length, 3);
  assertEquals(p.interactive.action.buttons.map((b: any) => b.reply.id), ['a', 'b', 'c']);
});

Deno.test('buildButtonsPayload: titles truncated to 20 chars, ids to 256, body to 1024', () => {
  const p = buildButtonsPayload(TO, 'x'.repeat(2000), [{ id: 'i'.repeat(300), title: 'T'.repeat(25) }]);
  const b = p.interactive.action.buttons[0].reply;
  assertEquals(b.title, 'T'.repeat(20));
  assertEquals(b.title.length, 20);
  assertEquals(b.id.length, 256);
  assertEquals(p.interactive.body.text.length, 1024);
});

Deno.test('buildButtonsPayload: the real confirm button titles fit untruncated', () => {
  // Same titles notify.ts sends for the "resolved" prompt
  const p = buildButtonsPayload(TO, 'fixed?', [
    { id: 'confirm:yes:00000000-0000-0000-0000-000000000000', title: '✅ Yes, fixed' },
    { id: 'confirm:no:00000000-0000-0000-0000-000000000000', title: '❌ Not fixed' },
  ]);
  assertEquals(p.interactive.action.buttons[0].reply.title, '✅ Yes, fixed');
  assertEquals(p.interactive.action.buttons[1].reply.title, '❌ Not fixed');
  // confirm ids must round-trip into the engine's CONFIRM_RE shape
  for (const b of p.interactive.action.buttons) {
    assert(/^confirm:(yes|no):[0-9a-f-]{36}$/i.test(b.reply.id), b.reply.id);
  }
});

Deno.test('buildButtonsPayload: empty list yields empty buttons array', () => {
  const p = buildButtonsPayload(TO, 'x', []);
  assertEquals(p.interactive.action.buttons, []);
});

// ---------------------------------------------------------------------------
// buildImagePayload
// ---------------------------------------------------------------------------
Deno.test('buildImagePayload: link + caption', () => {
  const url = 'https://example.supabase.co/storage/v1/object/sign/ticket-media/a.jpg?token=x';
  const p = buildImagePayload(TO, url, 'After photo – TKT-2611-00001');
  assertEquals(p, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: TO,
    type: 'image',
    image: { link: url, caption: 'After photo – TKT-2611-00001' },
  });
});

Deno.test('buildImagePayload: no caption key when caption omitted or empty', () => {
  assertEquals(buildImagePayload(TO, 'https://x/y.jpg').image, { link: 'https://x/y.jpg' });
  assertEquals('caption' in buildImagePayload(TO, 'https://x/y.jpg', '').image, false);
});

Deno.test('buildImagePayload: caption truncated to 1024', () => {
  const p = buildImagePayload(TO, 'https://x/y.jpg', 'c'.repeat(1500));
  assertEquals(p.image.caption!.length, 1024);
});

// ---------------------------------------------------------------------------
// buildTemplatePayload
// ---------------------------------------------------------------------------
Deno.test('buildTemplatePayload: name, language and body params', () => {
  const p = buildTemplatePayload(TO, 'ticket_update', 'en', ['TKT-2611-00001', 'Assigned to Ravi']);
  assertEquals(p.type, 'template');
  assertEquals(p.to, TO);
  assertEquals(p.template.name, 'ticket_update');
  assertEquals(p.template.language, { code: 'en' });
  assertEquals(p.template.components, [
    { type: 'body', parameters: [{ type: 'text', text: 'TKT-2611-00001' }, { type: 'text', text: 'Assigned to Ravi' }] },
  ]);
});

Deno.test('buildTemplatePayload: no params and no buttons -> no components key', () => {
  const p = buildTemplatePayload(TO, 'hello_world', 'en_US', []);
  assertEquals('components' in p.template, false);
  assertEquals(p.template, { name: 'hello_world', language: { code: 'en_US' } });
});

Deno.test('buildTemplatePayload: params sanitised (newlines, tabs, 4+ spaces)', () => {
  const p = buildTemplatePayload(TO, 't', 'en', [
    'line1\nline2',
    'a\n\n\nb',
    'tab\there',
    'mixed\t\n\tend',
    'four    spaces',
    'eight        spaces',
    'three   ok',
  ]);
  const texts = p.template.components![0].parameters.map((x: any) => x.text);
  assertEquals(texts, [
    'line1 line2',
    'a b',
    'tab here',
    'mixed end',
    'four   spaces',
    'eight   spaces',
    'three   ok',
  ]);
  for (const t of texts) {
    assert(!/[\n\t]/.test(t), `newline/tab left in ${JSON.stringify(t)}`);
    assert(!/ {4,}/.test(t), `4+ spaces left in ${JSON.stringify(t)}`);
  }
});

Deno.test('buildTemplatePayload: newline next to spaces cannot re-create 4+ spaces', () => {
  const p = buildTemplatePayload(TO, 't', 'en', ['a  \n  b']);
  const text = p.template.components![0].parameters[0].text;
  assert(!/ {4,}/.test(text), JSON.stringify(text));
  assertEquals(text, 'a   b');
});

Deno.test('buildTemplatePayload: empty / null params become "-" and long params are capped', () => {
  // deno-lint-ignore no-explicit-any
  const p = buildTemplatePayload(TO, 't', 'en', ['', null as any, undefined as any, 'x'.repeat(1500)]);
  const texts = p.template.components![0].parameters.map((x: any) => x.text);
  assertEquals(texts.slice(0, 3), ['-', '-', '-']);
  assertEquals(texts[3].length, 1000);
});

Deno.test('buildTemplatePayload: quick-reply payload components use string indexes', () => {
  const id = '11111111-2222-3333-4444-555555555555';
  const p = buildTemplatePayload(TO, 'ticket_resolved', 'en', ['TKT-1', 'Leak'], [`confirm:yes:${id}`, `confirm:no:${id}`]);
  const comps = p.template.components!;
  assertEquals(comps.length, 3);
  assertEquals(comps[0].type, 'body');
  assertEquals(comps[1], { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: `confirm:yes:${id}` }] });
  assertEquals(comps[2], { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: `confirm:no:${id}` }] });
  for (const c of comps.slice(1)) assertEquals(typeof c.index, 'string');
});

Deno.test('buildTemplatePayload: quick replies without body params', () => {
  const p = buildTemplatePayload(TO, 't', 'en', [], ['p0']);
  assertEquals(p.template.components, [
    { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: 'p0' }] },
  ]);
});

// ---------------------------------------------------------------------------
// isWithinServiceWindow (24h window with a 30 min safety margin => 23.5h)
// ---------------------------------------------------------------------------
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

Deno.test('isWithinServiceWindow: null / undefined / empty -> false', () => {
  assertEquals(isWithinServiceWindow(null), false);
  assertEquals(isWithinServiceWindow(undefined), false);
  assertEquals(isWithinServiceWindow(''), false);
});

Deno.test('isWithinServiceWindow: 1h ago -> true', () => {
  assertEquals(isWithinServiceWindow(ago(1 * HOUR)), true);
});

Deno.test('isWithinServiceWindow: just now -> true', () => {
  assertEquals(isWithinServiceWindow(ago(0)), true);
});

Deno.test('isWithinServiceWindow: 23h ago -> true', () => {
  assertEquals(isWithinServiceWindow(ago(23 * HOUR)), true);
});

Deno.test('isWithinServiceWindow: 23h40m ago (inside 24h but past the safety margin) -> false', () => {
  assertEquals(isWithinServiceWindow(ago(23 * HOUR + 40 * 60_000)), false);
});

Deno.test('isWithinServiceWindow: 24h ago -> false', () => {
  assertEquals(isWithinServiceWindow(ago(24 * HOUR)), false);
});

Deno.test('isWithinServiceWindow: 3 days ago -> false', () => {
  assertEquals(isWithinServiceWindow(ago(72 * HOUR)), false);
});

Deno.test('isWithinServiceWindow: unparseable timestamp -> false', () => {
  assertEquals(isWithinServiceWindow('not-a-date'), false);
});
