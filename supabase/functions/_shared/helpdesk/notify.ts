// @ts-nocheck: Supabase Edge Function (Deno) module.
// Delivers rows from public.ticket_notifications:
//   client   -> WhatsApp to every reporter (free-form inside the 24h window, approved template outside it)
//   assignee -> in-app notification + push (existing send-notification function)
//   managers -> in-app notification + push to site supervisors / managers
import { sendLogged } from './engine.ts';
import { buildButtonsPayload, buildImagePayload, buildTemplatePayload, buildTextPayload, isWithinServiceWindow } from './whatsapp.ts';

type Supa = any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TPL_LANG = Deno.env.get('WA_TPL_LANG') ?? 'en';
// Template "ticket_update":    "Update on your ticket {{1}}: {{2}}"
const TPL_UPDATE = Deno.env.get('WA_TPL_TICKET_UPDATE') ?? '';
// Template "ticket_resolved":  "Your ticket {{1}} ({{2}}) has been resolved. Is the issue fixed?"  + quick replies [Yes, fixed] [No, not fixed]
const TPL_RESOLVED = Deno.env.get('WA_TPL_TICKET_RESOLVED') ?? '';

export async function processOutbox(supabase: Supa, limit = 50): Promise<{ sent: number; failed: number; skipped: number }> {
  const { data: rows, error } = await supabase.rpc('helpdesk_claim_notifications', { p_limit: limit });
  if (error) throw error;
  const stats = { sent: 0, failed: 0, skipped: 0 };
  for (const n of rows ?? []) {
    try {
      const result = await deliver(supabase, n);
      await supabase.from('ticket_notifications').update({
        status: result, error: null, sent_at: result === 'sent' ? new Date().toISOString() : null,
      }).eq('id', n.id);
      stats[result]++;
    } catch (e) {
      console.error('[helpdesk/notify] delivery failed', n.id, e);
      await supabase.from('ticket_notifications').update({ status: 'failed', error: String(e?.message ?? e).slice(0, 1000) }).eq('id', n.id);
      stats.failed++;
    }
  }
  return stats;
}

async function deliver(supabase: Supa, n: any): Promise<'sent' | 'skipped'> {
  const { data: t } = await supabase.from('ops_tickets')
    .select('id, ticket_number, title, status, priority, category, tower, floor, area, eta_at, resolution_due_at, assigned_to, assignment_note, resolution_note, pending_reason, channel_site_id, escalation_level, reopen_count, channel_sites:channel_site_id(display_name)')
    .eq('id', n.ticket_id).maybeSingle();
  if (!t) return 'skipped';
  const assignee = t.assigned_to
    ? (await supabase.from('users').select('id, name, phone').eq('id', t.assigned_to).maybeSingle()).data
    : null;
  const ctx = { t, n, assignee, site: t.channel_sites?.display_name ?? '' };

  if (n.audience === 'client') return await notifyClients(supabase, ctx);
  if (n.audience === 'assignee') {
    if (!assignee) return 'skipped';
    const msg = staffMessage(ctx, 'assignee');
    if (!msg) return 'skipped';
    await pushToUsers(supabase, [assignee.id], msg, t.id);
    return 'sent';
  }
  if (n.audience === 'managers') {
    const { data: mgrs } = await supabase.rpc('helpdesk_site_managers', { p_site_id: t.channel_site_id });
    const ids = [...new Set((mgrs ?? []).map((m: any) => m.user_id))].filter((id) => id && id !== t.assigned_to);
    const msg = staffMessage(ctx, 'managers');
    if (!ids.length || !msg) return 'skipped';
    await pushToUsers(supabase, ids, msg, t.id);
    return 'sent';
  }
  return 'skipped';
}

// ---------------------------------------------------------------------------
// Clients (WhatsApp)
// ---------------------------------------------------------------------------
async function notifyClients(supabase: Supa, ctx: any): Promise<'sent' | 'skipped'> {
  const { t, n } = ctx;
  const { data: reporters } = await supabase.from('ticket_reporters')
    .select('channel_contacts!inner(id, channel, sender_id, last_inbound_at, is_blocked)')
    .eq('ticket_id', t.id);
  const contacts = (reporters ?? []).map((r: any) => r.channel_contacts)
    .filter((c: any) => c && c.channel === 'whatsapp' && !c.is_blocked);
  if (!contacts.length) return 'skipped';

  const text = clientText(ctx);
  if (!text) return 'skipped';

  let photoUrls: string[] = [];
  if (n.event === 'resolved') {
    const { data: media } = await supabase.from('ticket_media').select('storage_path')
      .eq('ticket_id', t.id).eq('kind', 'after').order('created_at', { ascending: false }).limit(2);
    for (const m of media ?? []) {
      const { data: signed } = await supabase.storage.from('ticket-media').createSignedUrl(m.storage_path, 3600);
      if (signed?.signedUrl) photoUrls.push(signed.signedUrl);
    }
  }

  // On a retry, don't message people who already got this notification
  const { data: already } = await supabase.from('outbound_messages').select('contact_id')
    .eq('notification_id', n.id).in('status', ['sent', 'delivered', 'read']);
  const done = new Set((already ?? []).map((r: any) => r.contact_id));

  let delivered = 0;
  let failed = 0;
  let attempted = 0;
  for (const c of contacts) {
    if (done.has(c.id)) { delivered++; continue; }
    const opts = { ticketId: t.id, notificationId: n.id };
    let ok: boolean | null = null; // null = nothing we are allowed to send
    if (isWithinServiceWindow(c.last_inbound_at)) {
      if (n.event === 'resolved') {
        for (const url of photoUrls) await sendLogged(supabase, c, buildImagePayload(c.sender_id, url, `After photo – ${t.ticket_number}`), 'image', opts);
        ok = await sendLogged(supabase, c, buildButtonsPayload(c.sender_id, text, [
          { id: `confirm:yes:${t.id}`, title: '✅ Yes, fixed' },
          { id: `confirm:no:${t.id}`, title: '❌ Not fixed' },
        ]), 'interactive', opts);
      } else {
        ok = await sendLogged(supabase, c, buildTextPayload(c.sender_id, text), 'text', opts);
      }
    } else if (n.event === 'resolved' && TPL_RESOLVED) {
      // Outside the 24h window: only approved templates are allowed
      ok = await sendLogged(supabase, c, buildTemplatePayload(c.sender_id, TPL_RESOLVED, TPL_LANG, [t.ticket_number, t.title],
        [`confirm:yes:${t.id}`, `confirm:no:${t.id}`]), 'template', opts);
    } else if (TPL_UPDATE) {
      ok = await sendLogged(supabase, c, buildTemplatePayload(c.sender_id, TPL_UPDATE, TPL_LANG, [t.ticket_number, oneLine(text)]), 'template', opts);
    }
    if (ok === null) continue;
    attempted++;
    if (ok) delivered++; else failed++;
  }
  if (failed) throw new Error(`WhatsApp delivery failed for ${failed} of ${attempted} recipient(s)`); // retried; delivered ones are skipped
  return delivered ? 'sent' : 'skipped';
}

function clientText({ t, n, assignee }: any): string | null {
  const num = `*${t.ticket_number}*`;
  const eta = n.payload?.eta ?? t.eta_at;
  switch (n.event) {
    case 'assigned':
    case 'reassigned':
      return `👷 Ticket ${num} is now assigned to ${assignee?.name ?? 'our team'}.` + (eta ? `\n⏱ ETA: ${fmt(eta)}` : '');
    case 'eta_set':
      return `👍 ${assignee?.name ?? 'Our technician'} has accepted ticket ${num}.\n⏱ ETA: ${fmt(eta)}`;
    case 'eta_changed':
      return `⏱ Ticket ${num}: new ETA ${fmt(eta)}` + (n.payload?.reason ? ` (${n.payload.reason})` : '') + '.';
    case 'on_hold':
      return `⏸ Ticket ${num} is on hold: ${n.payload?.reason ?? t.pending_reason ?? 'pending'}. We'll update you.`;
    case 'resolved':
      return `✅ Ticket ${num} (${t.title}) has been resolved` + (assignee?.name ? ` by ${assignee.name}` : '') + '.' +
        (t.resolution_note ? `\n📝 ${t.resolution_note}` : '') + '\n\nIs the issue fixed?';
    case 'closed':
      return `🔒 Ticket ${num} is closed. Thank you! Message us anytime for a new issue.`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Staff (in-app + push)
// ---------------------------------------------------------------------------
function staffMessage({ t, n, assignee, site }: any, audience: 'assignee' | 'managers'): { title: string; body: string } | null {
  const where = [site, t.tower && `Tower ${String(t.tower).replace(/^T/, '')}`, t.floor && `Floor ${t.floor}`, t.area].filter(Boolean).join(' · ');
  const head = `${t.ticket_number} · ${t.priority}`;
  const who = assignee?.name ?? 'Unassigned';
  const a = audience === 'assignee';
  switch (n.event) {
    case 'assigned':
    case 'reassigned':
      return a
        ? { title: `🛠 New ticket ${head}`, body: `${t.title} — ${where}. Tap to accept and set ETA.` }
        : { title: `↪ ${head} assigned to ${who}`, body: `${t.title} — ${where}` + (n.payload?.note ? ` (${n.payload.note})` : '') + (n.payload?.reason && n.payload.reason !== 'new_ticket' ? ` · reason: ${reasonLabel(n.payload.reason)}` : '') };
    case 'unassigned':
      return a ? null : { title: `⚠️ ${head} could not be assigned`, body: `${t.title} — ${where}. No staff available; please assign manually.` };
    case 'accept_reminder':
      return a
        ? { title: `⏰ Please accept ${t.ticket_number}`, body: `${t.title} — ${where}. Set an ETA now.` }
        : { title: `⏰ ${head} not accepted yet`, body: `${who} has not accepted: ${t.title} — ${where}` };
    case 'eta_reminder':
      return a ? { title: `⏱ ETA in 15 min: ${t.ticket_number}`, body: `${t.title} — ${where}. Update the ETA if you need more time.` } : null;
    case 'overdue':
      return a
        ? { title: `🔴 Overdue: ${t.ticket_number}`, body: `${t.title} — ${where}. Set a new ETA with a reason, or resolve with a photo.` }
        : { title: `🔴 Overdue (level ${n.payload?.level ?? t.escalation_level}): ${head}`, body: `${who} · ${t.title} — ${where}` };
    case 'on_hold':
      return a ? null : { title: `⏸ ${head} on hold`, body: `${n.payload?.reason ?? t.pending_reason} — ${t.title}` };
    case 'resolved':
      return a ? null : { title: `✅ ${head} resolved by ${who}`, body: `${t.title} — ${where}` };
    case 'reopened':
      return { title: `❗ Client says NOT fixed: ${t.ticket_number}`, body: `${t.title} — ${where}` + (n.payload?.comment ? `: "${n.payload.comment}"` : '') + ` (reopened ${t.reopen_count}x)` };
    case 'handover':
      return a ? null : { title: `🚪 Assignee left site: ${head}`, body: `${who} punched out with this ticket open. Reassign if needed.` };
    default:
      return null;
  }
}

async function pushToUsers(supabase: Supa, userIds: string[], msg: { title: string; body: string }, ticketId: string) {
  const link = `/operations/tickets?ticket=${ticketId}`;
  await supabase.from('notifications').insert(userIds.map((user_id) => ({
    user_id, type: 'helpdesk_ticket', message: `${msg.title} — ${msg.body}`, link_to: link,
  })));
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, title: msg.title, message: msg.body, data: { type: 'helpdesk_ticket', ticket_id: ticketId, link } }),
    });
    if (!res.ok) console.warn('[helpdesk/notify] push failed', res.status, await res.text());
  } catch (e) {
    console.warn('[helpdesk/notify] push error', e); // in-app notification already stored
  }
}

const reasonLabel = (r: string) => ({ assignee_checked_out: 'previous assignee punched out', new_ticket: 'new ticket' } as any)[r] ?? r.replace(/_/g, ' ');
const oneLine = (s: string) => s.replace(/\*/g, '').replace(/\s*\n+\s*/g, ' · ').slice(0, 900);
function fmt(iso: string) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}
