// @ts-nocheck: Supabase Edge Function (Deno) module.
// Channel-agnostic helpdesk engine: inbound message -> site -> AI extraction -> create/merge ticket -> reply.
// Phase 1 (WhatsApp first). Assignment/ETA/photo-closure arrive in Phase 3.

import { extractIssue, parseLocation, normalizeFloor, normalizeAgainstMaster, type Extraction, type SiteLocationRow } from './extract.ts';
import { buildListPayload, buildTextPayload, downloadMedia, sendPayload } from './whatsapp.ts';

const STATE_TTL_MS = 30 * 60 * 1000;          // bot waits 30 min for site / location / description
const PHOTO_ATTACH_WINDOW_MS = 15 * 60 * 1000; // photo without text attaches to the reporter's ticket from the last 15 min
const REVIEW_CONFIDENCE = 0.4;                 // below this an "issue" goes to the review queue instead of a ticket
const SITE_CODE_RE = /\bSITE\s*[:\-#]?\s*([A-Z0-9_-]{2,30})\b/i;

type Supa = any;

interface ConversationState {
  awaiting?: 'site' | 'location' | 'description' | 'reopen_comment';
  ticket_id?: string;        // reopen_comment: the ticket the client said is not fixed
  inbound_id?: string;       // the message that started the conversation
  text?: string;             // accumulated issue text
  media_ids?: string[];      // inbound_message ids whose media should be attached
  site_id?: string;
  site_options?: string[];
  extraction?: Extraction;
  since?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Store one normalised message. Returns the row id, or null if it was a duplicate webhook delivery. */
export async function storeInbound(supabase: Supa, m: any): Promise<string | null> {
  const { data, error } = await supabase
    .from('inbound_messages')
    .insert({
      channel: m.channel,
      external_msg_id: m.externalMsgId,
      sender_id: m.senderId,
      sender_name: m.senderName,
      msg_type: m.msgType,
      body: m.body,
      media: m.media,
      context_msg_id: m.contextMsgId,
      is_forwarded: m.isForwarded,
      raw: { ...m.raw, _reply_id: m.replyId },
      received_at: m.receivedAt,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return null; // unique (channel, external_msg_id): Meta retry
    throw error;
  }
  return data.id;
}

/** Process a stored inbound message end-to-end. Safe to call more than once. */
export async function processInbound(supabase: Supa, inboundId: string): Promise<void> {
  // Claim the row (pending/failed -> processing) so two workers never process it twice
  const { data: msg } = await supabase
    .from('inbound_messages')
    .update({ status: 'processing' })
    .eq('id', inboundId)
    .in('status', ['pending', 'failed'])
    .select('*')
    .maybeSingle();
  if (!msg) return;

  try {
    await supabase.from('inbound_messages').update({ attempts: (msg.attempts ?? 0) + 1 }).eq('id', inboundId);
    const outcome = await handle(supabase, msg);
    await supabase.from('inbound_messages').update({
      status: outcome.status,
      contact_id: outcome.contactId ?? msg.contact_id,
      site_id: outcome.siteId ?? null,
      ticket_id: outcome.ticketId ?? null,
      ai_result: outcome.extraction ?? null,
      error: null,
      processed_at: new Date().toISOString(),
    }).eq('id', inboundId);
  } catch (e) {
    console.error('[helpdesk/engine] processing failed', inboundId, e);
    await supabase.from('inbound_messages')
      .update({ status: 'failed', error: String(e?.message ?? e).slice(0, 2000) })
      .eq('id', inboundId);
  }
}

/** Cron: drafts waiting for a location for > 30 min become tickets with "location unknown". */
export async function expireStaleDrafts(supabase: Supa): Promise<number> {
  const cutoff = new Date(Date.now() - STATE_TTL_MS).toISOString();
  const { data: contacts } = await supabase
    .from('channel_contacts')
    .select('*')
    .eq('conversation_state->>awaiting', 'location')
    .lt('conversation_state->>since', cutoff)
    .limit(50);
  let created = 0;
  for (const contact of contacts ?? []) {
    const st: ConversationState = contact.conversation_state ?? {};
    await setState(supabase, contact.id, {});
    if (!st.site_id || !st.extraction) continue;
    const site = await getSite(supabase, st.site_id);
    if (!site) continue;
    const res = await createOrMerge(supabase, { contact, site, extraction: st.extraction, text: st.text ?? '', inboundId: st.inbound_id, mediaIds: st.media_ids ?? [] });
    await reply(supabase, contact, formatTicketReply(res, site, st.extraction) + '\n\n_Location not received — our team will confirm it with you._', { ticketId: res.ticket_id });
    if (st.inbound_id) await supabase.from('inbound_messages').update({ status: 'processed', ticket_id: res.ticket_id }).eq('id', st.inbound_id);
    created++;
  }
  return created;
}

// ---------------------------------------------------------------------------
// Core flow
// ---------------------------------------------------------------------------
interface Outcome { status: string; contactId?: string; siteId?: string; ticketId?: string; extraction?: Extraction }

async function handle(supabase: Supa, msg: any): Promise<Outcome> {
  const contact = await upsertContact(supabase, msg);
  if (contact.is_blocked) return { status: 'ignored', contactId: contact.id };

  await storeMedia(supabase, msg);

  const replyId: string | null = msg.raw?._reply_id ?? null;
  let text: string = (msg.body ?? '').trim();
  const hasMedia = (msg.media ?? []).length > 0;

  // 0. Client answering "Is the issue fixed?" (buttons, template quick reply, or a plain yes/no)
  const confirmation = await handleConfirmation(supabase, contact, msg, replyId, text);
  if (confirmation) return confirmation;

  if (msg.msg_type === 'audio') {
    await reply(supabase, contact, "🎙️ Voice notes aren't supported yet. Please type the issue with tower and floor, e.g. *Water leakage, Tower 1, 2nd floor*.", { inReplyTo: msg.id });
    return { status: 'ignored', contactId: contact.id };
  }

  // 1. Site from QR code text ("SITE:LAKESIDE ...") or from an interactive picker reply ("site:<uuid>")
  let pickedSite: any = null;
  const codeMatch = text.match(SITE_CODE_RE);
  if (codeMatch) {
    pickedSite = await getSiteByCode(supabase, codeMatch[1].toUpperCase());
    text = text.replace(SITE_CODE_RE, '').trim();
    if (!pickedSite) {
      await reply(supabase, contact, `❓ Site code *${codeMatch[1].toUpperCase()}* was not found. Please scan the QR poster at your site again.`, { inReplyTo: msg.id });
      return { status: 'ignored', contactId: contact.id };
    }
    await linkContactToSite(supabase, contact, pickedSite.id, 'qr');
  } else if (replyId?.startsWith('site:')) {
    pickedSite = await getSite(supabase, replyId.slice(5));
    if (pickedSite) await linkContactToSite(supabase, contact, pickedSite.id, 'picker');
  }

  // 2. Continue a pending conversation
  let state: ConversationState = contact.conversation_state ?? {};
  if (state.since && Date.now() - new Date(state.since).getTime() > STATE_TTL_MS && state.awaiting !== 'location') {
    state = {};
    await setState(supabase, contact.id, {});
  }

  if (state.awaiting === 'reopen_comment' && state.ticket_id) {
    await setState(supabase, contact.id, {});
    // A clearly different new problem is not a comment on the reopened ticket
    let isNewIssue = false;
    if (text && !hasMedia) {
      const quick = await extractIssue(text, []);
      const { data: rt } = await supabase.from('ops_tickets').select('issue_type').eq('id', state.ticket_id).maybeSingle();
      isNewIssue = quick.is_issue && quick.confidence >= 0.6 && quick.issue_type !== 'other' && quick.issue_type !== rt?.issue_type;
    }
    if (!isNewIssue && (text || hasMedia)) {
      await supabase.from('ticket_events').insert({
        ticket_id: state.ticket_id, event_type: 'message', actor_contact_id: contact.id, inbound_message_id: msg.id,
        payload: { text: text || '(photo)', context: 'reopen_comment' },
      });
      if (hasMedia) await attachMedia(supabase, state.ticket_id, [msg.id], contact.id);
      await reply(supabase, contact, '📝 Noted — shared with the technician.', { inReplyTo: msg.id, ticketId: state.ticket_id });
      return { status: 'processed', contactId: contact.id, ticketId: state.ticket_id };
    }
  }

  if (state.awaiting === 'site') {
    const site = pickedSite ?? (await resolveSiteFromReply(supabase, contact, state, text));
    if (!site) {
      await askForSite(supabase, contact, msg.id, state.site_options);
      return { status: 'awaiting_info', contactId: contact.id };
    }
    await setState(supabase, contact.id, {});
    const pendingText = [state.text, pickedSite || !looksLikeSelection(text) ? text : ''].filter(Boolean).join('\n').trim();
    const mediaIds = [...(state.media_ids ?? []), ...(hasMedia ? [msg.id] : [])];
    if (!pendingText) {
      await reply(supabase, contact, `📍 You're linked to *${site.display_name}*. Please describe the issue with tower and floor.`, { inReplyTo: msg.id });
      return { status: 'processed', contactId: contact.id, siteId: site.id };
    }
    return await handleIssue(supabase, { contact, site, text: pendingText, inboundId: state.inbound_id ?? msg.id, mediaIds, replyTo: msg.id });
  }

  if (state.awaiting === 'location' && state.site_id && state.extraction) {
    const site = await getSite(supabase, state.site_id);
    await setState(supabase, contact.id, {});
    if (site) {
      const master = await getMaster(supabase, site.id);
      const loc = parseLocation(text);
      const ex: Extraction = { ...state.extraction };
      ex.tower = ex.tower ?? normalizeAgainstMaster(loc.tower ?? matchMasterToken(text, 'tower', master), 'tower', master);
      ex.floor = ex.floor ?? normalizeFloor(loc.floor);
      ex.area = ex.area ?? normalizeAgainstMaster(matchMasterToken(text, 'area', master), 'area', master);
      ex.unit = ex.unit ?? loc.unit;
      const mediaIds = [...(state.media_ids ?? []), ...(hasMedia ? [msg.id] : [])];
      const res = await createOrMerge(supabase, { contact, site, extraction: ex, text: `${state.text ?? ''}\nLocation: ${text}`.trim(), inboundId: state.inbound_id ?? msg.id, mediaIds });
      await reply(supabase, contact, formatTicketReply(res, site, ex), { inReplyTo: msg.id, ticketId: res.ticket_id });
      if (state.inbound_id && state.inbound_id !== msg.id) {
        await supabase.from('inbound_messages').update({ status: 'processed', ticket_id: res.ticket_id }).eq('id', state.inbound_id);
      }
      return { status: 'processed', contactId: contact.id, siteId: site.id, ticketId: res.ticket_id, extraction: ex };
    }
  }

  if (state.awaiting === 'description' && state.site_id && text) {
    const site = await getSite(supabase, state.site_id);
    await setState(supabase, contact.id, {});
    if (site) {
      return await handleIssue(supabase, { contact, site, text, inboundId: msg.id, mediaIds: [...(state.media_ids ?? []), ...(hasMedia ? [msg.id] : [])], replyTo: msg.id });
    }
  }

  // 3. Fresh message: work out the site
  const site = pickedSite ?? (await defaultSite(supabase, contact));

  // Photo with no text: attach to the reporter's recent ticket, or ask what it is
  if (!text && hasMedia) {
    const recent = await recentTicketOf(supabase, contact.id);
    if (recent) {
      await attachMedia(supabase, recent.id, [msg.id], contact.id);
      await reply(supabase, contact, `📷 Photo added to ticket *${recent.ticket_number}*.`, { inReplyTo: msg.id, ticketId: recent.id });
      return { status: 'processed', contactId: contact.id, siteId: recent.channel_site_id, ticketId: recent.id };
    }
    if (!site) {
      await setState(supabase, contact.id, { awaiting: 'site', inbound_id: msg.id, media_ids: [msg.id], since: nowIso() });
      await askForSite(supabase, contact, msg.id);
      return { status: 'awaiting_info', contactId: contact.id };
    }
    await setState(supabase, contact.id, { awaiting: 'description', inbound_id: msg.id, media_ids: [msg.id], site_id: site.id, since: nowIso() });
    await reply(supabase, contact, '📷 Got the photo. What is the issue and where (tower / floor)?', { inReplyTo: msg.id });
    return { status: 'awaiting_info', contactId: contact.id, siteId: site.id };
  }

  if (!text) return { status: 'ignored', contactId: contact.id };

  if (!site) {
    // Don't ask unknown numbers for a site when they only said hi/thanks
    const quick = await extractIssue(text, []);
    if (quick.intent === 'thanks') return { status: 'ignored', contactId: contact.id, extraction: quick };
    await setState(supabase, contact.id, {
      awaiting: 'site', inbound_id: msg.id, text: quick.is_issue ? text : '', media_ids: hasMedia ? [msg.id] : [],
      site_options: await contactSiteIds(supabase, contact), since: nowIso(),
    });
    await askForSite(supabase, contact, msg.id, await contactSiteIds(supabase, contact));
    return { status: 'awaiting_info', contactId: contact.id, extraction: quick };
  }

  return await handleIssue(supabase, { contact, site, text, inboundId: msg.id, mediaIds: hasMedia ? [msg.id] : [], replyTo: msg.id });
}

async function handleIssue(supabase: Supa, a: { contact: any; site: any; text: string; inboundId: string; mediaIds: string[]; replyTo: string }): Promise<Outcome> {
  const { contact, site, text } = a;
  const master = await getMaster(supabase, site.id);
  const ex = await extractIssue(text, master);
  const base = { contactId: contact.id, siteId: site.id, extraction: ex };

  if (ex.intent === 'thanks') return { status: 'ignored', ...base };
  if (ex.intent === 'greeting') {
    await reply(supabase, contact, helpText(site), { inReplyTo: a.replyTo });
    return { status: 'ignored', ...base };
  }
  if (ex.intent === 'status_query') {
    await reply(supabase, contact, await statusText(supabase, contact, text), { inReplyTo: a.replyTo });
    return { status: 'processed', ...base };
  }
  if (!ex.is_issue) {
    await reply(supabase, contact, helpText(site), { inReplyTo: a.replyTo });
    return { status: 'ignored', ...base };
  }
  if (ex.confidence < REVIEW_CONFIDENCE) {
    await reply(supabase, contact, '🙏 Thanks, our team will review your message and get back to you shortly.', { inReplyTo: a.replyTo });
    return { status: 'review', ...base };
  }

  // Ask once for the location when nothing at all was given
  if (!ex.tower && !ex.floor && !ex.area && !ex.unit) {
    await setState(supabase, contact.id, {
      awaiting: 'location', inbound_id: a.inboundId, text, media_ids: a.mediaIds, site_id: site.id, extraction: ex, since: nowIso(),
    });
    await reply(supabase, contact, locationQuestion(master), { inReplyTo: a.replyTo });
    return { status: 'awaiting_info', ...base };
  }

  const res = await createOrMerge(supabase, { contact, site, extraction: ex, text, inboundId: a.inboundId, mediaIds: a.mediaIds });
  await reply(supabase, contact, formatTicketReply(res, site, ex), { inReplyTo: a.replyTo, ticketId: res.ticket_id });
  return { status: 'processed', ...base, ticketId: res.ticket_id };
}

async function createOrMerge(supabase: Supa, a: { contact: any; site: any; extraction: Extraction; text: string; inboundId?: string; mediaIds: string[] }) {
  const ex = a.extraction;
  const description = [a.text, ex.unit ? `Unit: ${ex.unit}` : null].filter(Boolean).join('\n');
  const { data, error } = await supabase.rpc('helpdesk_ingest_issue', {
    p_site_id: a.site.id,
    p_contact_id: a.contact.id,
    p_inbound_message_id: a.inboundId ?? null,
    p_title: ex.title,
    p_description: description,
    p_category: ex.category,
    p_priority: ex.priority,
    p_issue_type: ex.issue_type,
    p_tower: ex.tower,
    p_floor: ex.floor,
    p_area: ex.area,
    p_confidence: ex.confidence,
    p_source_channel: a.contact.channel,
  });
  if (error) throw error;
  const res = Array.isArray(data) ? data[0] : data;
  if (a.mediaIds.length) await attachMedia(supabase, res.ticket_id, a.mediaIds, a.contact.id);
  return { ...res, was_new_reporter: true };
}

// ---------------------------------------------------------------------------
// Client confirmation (close / reopen)
// ---------------------------------------------------------------------------
const CONFIRM_RE = /^confirm:(yes|no):([0-9a-f-]{36})$/i;
// Whole-message matches only, so "No water in tower 2" is never read as "not fixed"
const TRAIL = String.raw`[\s!.,🙏👍👍🏻👍🏼👍🏽👍🏾👍🏿✅❌👎]*$`;
const YES_RE = new RegExp(String.raw`^(yes|y|yeah|yep|ok|okay|fixed|done|resolved|solved|haan|ha|han|ji|👍[\u{1F3FB}-\u{1F3FF}]?|✅)` +
  String.raw`(\s+(it\s+is\s+|it'?s\s+|its\s+)?(fixed|done|resolved|solved|working|fine|ok))?` + TRAIL, 'iu');
const NO_RE = new RegExp(String.raw`^(no|nope|nahi|nhi|not\s*(ok|okay|fixed|done|resolved|solved|working)|` +
  String.raw`still\s+(not\s+(fixed|working|ok)|same|there|leaking|blocked|clogged)|❌|👎)(\s+(yet|still|fixed|working))?` + TRAIL, 'iu');

/** The "Is the issue fixed?" prompt is the latest thing we sent this contact, for this ticket. */
async function lastPromptTicket(supabase: Supa, contact: any, contextMsgId: string | null): Promise<string | null> {
  if (contextMsgId) {
    const { data } = await supabase.from('outbound_messages').select('ticket_id')
      .eq('channel', contact.channel).eq('external_msg_id', contextMsgId).maybeSingle();
    if (data?.ticket_id) return data.ticket_id;
  }
  const { data: last } = await supabase.from('outbound_messages').select('ticket_id, msg_type')
    .eq('contact_id', contact.id).in('status', ['sent', 'delivered', 'read'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!last?.ticket_id || !['interactive', 'template'].includes(last.msg_type)) return null;
  return last.ticket_id;
}

async function handleConfirmation(supabase: Supa, contact: any, msg: any, replyId: string | null, text: string): Promise<Outcome | null> {
  let ticketId: string | null = null;
  let ok: boolean | null = null;

  const m = replyId?.match(CONFIRM_RE);
  if (m) {
    ok = m[1].toLowerCase() === 'yes';
    ticketId = m[2];
  } else if (text && (YES_RE.test(text) || NO_RE.test(text))) {
    // Plain yes/no only counts as an answer to our "Is it fixed?" prompt for a ticket that is still Resolved
    const promptTicket = await lastPromptTicket(supabase, contact, msg.context_msg_id ?? null);
    if (!promptTicket) return null;
    const { data: t } = await supabase.from('ops_tickets').select('id, status').eq('id', promptTicket).maybeSingle();
    if (t?.status !== 'Resolved') return null;
    ticketId = t.id;
    ok = YES_RE.test(text);
  }
  if (!ticketId || ok === null) return null;

  const { data: result, error } = await supabase.rpc('helpdesk_client_confirm', {
    p_ticket_id: ticketId, p_contact_id: contact.id, p_ok: ok, p_comment: m ? null : text,
  });
  if (error) throw error;
  const { data: t } = await supabase.from('ops_tickets').select('ticket_number, status').eq('id', ticketId).maybeSingle();
  const num = t?.ticket_number ?? 'your ticket';

  const replies: Record<string, string> = {
    closed: `🙏 Thank you for confirming! Ticket *${num}* is now closed.`,
    reopened: `😔 Sorry about that. Ticket *${num}* is reopened and the team has been alerted.\nWhat is still wrong? You can reply with details or a photo.`,
    already_closed: ok
      ? `Ticket *${num}* is already closed. Thank you!`
      : `Ticket *${num}* was already closed. Please send the issue again (with tower and floor) and we'll raise a new ticket.`,
  };
  const key = ['closed', 'reopened', 'already_closed'].includes(result) ? result : null;
  if (result === 'reopened') {
    await setState(supabase, contact.id, { awaiting: 'reopen_comment', ticket_id: ticketId, since: nowIso() });
  }
  await reply(supabase, contact, key ? replies[key] : `Ticket *${num}* is currently *${t?.status ?? 'unknown'}*.`, { inReplyTo: msg.id, ticketId });
  return { status: 'processed', contactId: contact.id, ticketId };
}

// ---------------------------------------------------------------------------
// Contacts & sites
// ---------------------------------------------------------------------------
async function upsertContact(supabase: Supa, msg: any) {
  const { data: existing } = await supabase
    .from('channel_contacts').select('*').eq('channel', msg.channel).eq('sender_id', msg.sender_id).maybeSingle();

  if (existing) {
    const patch: any = { last_inbound_at: msg.received_at };
    if (!existing.display_name && msg.sender_name) patch.display_name = msg.sender_name;
    await supabase.from('channel_contacts').update(patch).eq('id', existing.id);
    return { ...existing, ...patch };
  }

  // New number: is it an employee?
  const last10 = String(msg.sender_id).replace(/\D/g, '').slice(-10);
  const { data: staff } = last10.length === 10
    ? await supabase.from('users').select('id, name, phone').ilike('phone', `%${last10}`).limit(1)
    : { data: [] };
  const user = staff?.[0];

  const { data: created, error } = await supabase.from('channel_contacts').upsert({
    channel: msg.channel,
    sender_id: msg.sender_id,
    phone: `+${String(msg.sender_id).replace(/\D/g, '')}`,
    display_name: user?.name ?? msg.sender_name,
    contact_role: user ? 'staff' : 'client',
    user_id: user?.id ?? null,
    last_inbound_at: msg.received_at,
  }, { onConflict: 'channel,sender_id' }).select('*').single();
  if (error) throw error;
  return created;
}

async function setState(supabase: Supa, contactId: string, state: ConversationState) {
  await supabase.from('channel_contacts').update({ conversation_state: state }).eq('id', contactId);
}

async function getSite(supabase: Supa, id: string) {
  const { data } = await supabase.from('channel_sites').select('*').eq('id', id).eq('is_active', true).maybeSingle();
  return data;
}

async function getSiteByCode(supabase: Supa, code: string) {
  const { data } = await supabase.from('channel_sites').select('*').eq('site_code', code).eq('is_active', true).maybeSingle();
  return data;
}

async function getMaster(supabase: Supa, siteId: string): Promise<SiteLocationRow[]> {
  const { data } = await supabase.from('site_locations').select('kind, value, aliases').eq('site_id', siteId);
  return data ?? [];
}

async function linkContactToSite(supabase: Supa, contact: any, siteId: string, via: 'qr' | 'picker' | 'admin') {
  await supabase.from('channel_contact_sites').upsert({ contact_id: contact.id, site_id: siteId, added_via: via }, { onConflict: 'contact_id,site_id', ignoreDuplicates: true });
  await supabase.from('channel_contacts').update({ last_site_id: siteId }).eq('id', contact.id);
  contact.last_site_id = siteId;
}

/** Sites this contact may report for: linked sites, plus (for staff) sites of their attendance locations. */
async function contactSiteIds(supabase: Supa, contact: any): Promise<string[]> {
  const ids = new Set<string>();
  const { data: links } = await supabase.from('channel_contact_sites').select('site_id').eq('contact_id', contact.id);
  for (const l of links ?? []) ids.add(l.site_id);
  if (contact.user_id) {
    const { data: locs } = await supabase.from('user_locations').select('location_id').eq('user_id', contact.user_id);
    const locIds = (locs ?? []).map((l: any) => l.location_id);
    if (locIds.length) {
      const { data: sites } = await supabase.from('channel_sites').select('id').in('location_id', locIds).eq('is_active', true);
      for (const s of sites ?? []) ids.add(s.id);
    }
  }
  return [...ids];
}

/** One linked site => use it. Several => only if the contact used one in the last 2 hours. */
async function defaultSite(supabase: Supa, contact: any) {
  const ids = await contactSiteIds(supabase, contact);
  if (ids.length === 1) return await getSite(supabase, ids[0]);
  if (ids.length > 1 && contact.last_site_id && ids.includes(contact.last_site_id)) {
    const { data: recent } = await supabase.from('inbound_messages').select('id')
      .eq('contact_id', contact.id).eq('site_id', contact.last_site_id)
      .gte('received_at', new Date(Date.now() - 2 * 3600_000).toISOString()).limit(1);
    if (recent?.length) return await getSite(supabase, contact.last_site_id);
  }
  return null;
}

async function resolveSiteFromReply(supabase: Supa, contact: any, state: ConversationState, text: string) {
  const options = state.site_options ?? [];
  const n = text.match(/^\s*(\d{1,2})\s*$/);
  if (n && options[Number(n[1]) - 1]) {
    const site = await getSite(supabase, options[Number(n[1]) - 1]);
    if (site) await linkContactToSite(supabase, contact, site.id, 'picker');
    return site;
  }
  if (options.length && text.length >= 3) {
    const { data } = await supabase.from('channel_sites').select('*').in('id', options).eq('is_active', true);
    const hit = (data ?? []).find((s: any) => s.display_name.toLowerCase().includes(text.toLowerCase()) || s.site_code === text.toUpperCase());
    if (hit) await linkContactToSite(supabase, contact, hit.id, 'picker');
    return hit ?? null;
  }
  return null;
}

const looksLikeSelection = (t: string) => /^\s*\d{1,2}\s*$/.test(t) || t.length <= 3;

function matchMasterToken(text: string, kind: 'tower' | 'area', master: SiteLocationRow[]): string | null {
  const lower = ` ${text.toLowerCase()} `;
  for (const row of master.filter((r) => r.kind === kind)) {
    for (const cand of [row.value, ...(row.aliases ?? [])]) {
      if (cand && lower.includes(` ${cand.toLowerCase()} `)) return row.value;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------
async function storeMedia(supabase: Supa, msg: any) {
  const media = msg.media ?? [];
  if (!media.length || media.every((m: any) => m.storage_path || m.error)) return;
  const month = new Date().toISOString().slice(0, 7);
  const updated = [];
  for (const [i, m] of media.entries()) {
    if (m.storage_path) { updated.push(m); continue; }
    try {
      const { bytes, mimeType } = await downloadMedia(m.id);
      const ext = (mimeType.split('/')[1] ?? 'bin').split(';')[0].replace('jpeg', 'jpg');
      const path = `${msg.channel}/${month}/${msg.id}-${i}.${ext}`;
      const { error } = await supabase.storage.from('ticket-media').upload(path, bytes, { contentType: mimeType, upsert: true });
      if (error) throw error;
      updated.push({ ...m, storage_path: path, mime_type: mimeType });
    } catch (e) {
      console.error('[helpdesk/engine] media download failed', m.id, e);
      updated.push({ ...m, error: String(e?.message ?? e) });
    }
  }
  msg.media = updated;
  await supabase.from('inbound_messages').update({ media: updated }).eq('id', msg.id);
}

async function attachMedia(supabase: Supa, ticketId: string, inboundIds: string[], contactId: string) {
  const { data: msgs } = await supabase.from('inbound_messages').select('id, media').in('id', inboundIds);
  const rows = [];
  for (const m of msgs ?? []) {
    for (const f of m.media ?? []) {
      if (f.storage_path) rows.push({ ticket_id: ticketId, kind: 'before', storage_path: f.storage_path, mime_type: f.mime_type, uploaded_by_contact: contactId, inbound_message_id: m.id });
    }
  }
  if (!rows.length) return;
  const { data: existing } = await supabase.from('ticket_media').select('storage_path').eq('ticket_id', ticketId);
  const have = new Set((existing ?? []).map((r: any) => r.storage_path));
  const fresh = rows.filter((r) => !have.has(r.storage_path));
  if (!fresh.length) return;
  await supabase.from('ticket_media').insert(fresh);
  await supabase.from('ticket_events').insert({ ticket_id: ticketId, event_type: 'media_added', actor_contact_id: contactId, payload: { count: fresh.length } });
}

async function recentTicketOf(supabase: Supa, contactId: string) {
  const since = new Date(Date.now() - PHOTO_ATTACH_WINDOW_MS).toISOString();
  const { data } = await supabase.from('ticket_reporters')
    .select('reported_at, ops_tickets!inner(id, ticket_number, status, channel_site_id)')
    .eq('contact_id', contactId).gte('reported_at', since)
    .in('ops_tickets.status', ['Open', 'In Progress', 'On Hold'])
    .order('reported_at', { ascending: false }).limit(1);
  return data?.[0]?.ops_tickets ?? null;
}

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------
async function reply(supabase: Supa, contact: any, text: string, opts: { inReplyTo?: string; ticketId?: string } = {}) {
  return sendLogged(supabase, contact, buildTextPayload(contact.sender_id, text), 'text', opts);
}

/** Sends and logs one message. Returns true only when Meta accepted it. Never throws. */
export async function sendLogged(
  supabase: Supa, contact: any, payload: any, msgType: string,
  opts: { inReplyTo?: string; ticketId?: string; notificationId?: string },
): Promise<boolean> {
  if (contact.channel !== 'whatsapp') return false; // other channels arrive in Phase 6
  const { data: row, error: logErr } = await supabase.from('outbound_messages').insert({
    channel: contact.channel, to_id: contact.sender_id, contact_id: contact.id,
    ticket_id: opts.ticketId ?? null, in_reply_to: opts.inReplyTo ?? null,
    notification_id: opts.notificationId ?? null, msg_type: msgType, payload,
  }).select('id').single();
  if (logErr) console.error('[helpdesk/engine] outbound log insert failed', logErr);
  try {
    const wamid = await sendPayload(payload);
    if (row?.id) await supabase.from('outbound_messages').update({ status: 'sent', external_msg_id: wamid, sent_at: nowIso() }).eq('id', row.id);
    return true;
  } catch (e) {
    console.error('[helpdesk/engine] send failed', e);
    if (row?.id) await supabase.from('outbound_messages').update({ status: 'failed', error: String(e?.message ?? e).slice(0, 1000) }).eq('id', row.id);
    return false;
  }
}

async function askForSite(supabase: Supa, contact: any, inReplyTo: string, options?: string[]) {
  const ids = options ?? [];
  if (ids.length > 1) {
    const { data: sites } = await supabase.from('channel_sites').select('id, display_name, site_code').in('id', ids).eq('is_active', true);
    if (sites?.length && sites.length <= 10) {
      return sendLogged(supabase, contact, buildListPayload(contact.sender_id, '🏢 Which site is this about?', 'Choose site',
        sites.map((s: any) => ({ id: `site:${s.id}`, title: s.display_name, description: s.site_code }))), 'interactive', { inReplyTo });
    }
    if (sites?.length) {
      return reply(supabase, contact, '🏢 Which site is this about? Reply with the number:\n' +
        ids.map((id, i) => `${i + 1}. ${sites.find((s: any) => s.id === id)?.display_name ?? ''}`).join('\n'), { inReplyTo });
    }
  }
  return reply(supabase, contact,
    '👋 Welcome to Paradigm Helpdesk!\n\nPlease scan the *QR code poster* at your site, or send your site code like this:\n*SITE:YOURCODE*', { inReplyTo });
}

function locationQuestion(master: SiteLocationRow[]) {
  const towers = master.filter((r) => r.kind === 'tower').map((r) => r.value).slice(0, 8);
  const example = towers[0] ? `${towers[0]}, 2nd floor` : 'Tower 1, 2nd floor';
  return `📍 Where exactly is this? Please reply with the tower / floor / area.\nExample: *${example}*` +
    (towers.length ? `\nTowers: ${towers.join(', ')}` : '');
}

function helpText(site: any) {
  return `👋 Hi! This is Paradigm Helpdesk${site ? ` for *${site.display_name}*` : ''}.\n\n` +
    'To raise an issue, describe it with the location, e.g.\n*Water clogged, Tower 1, first floor*\n\n' +
    'You can also send a photo. To check a ticket, send *status*.';
}

async function statusText(supabase: Supa, contact: any, text: string) {
  const num = text.match(/\bTKT-\d{4}-\d+\b/i)?.[0]?.toUpperCase();
  let q = supabase.from('ticket_reporters')
    .select('ops_tickets!inner(ticket_number, title, status, eta_at, resolution_due_at, tower, floor)')
    .eq('contact_id', contact.id);
  q = num ? q.eq('ops_tickets.ticket_number', num) : q.in('ops_tickets.status', ['Open', 'In Progress', 'On Hold']);
  const { data } = await q.order('reported_at', { ascending: false }).limit(5);
  const tickets = (data ?? []).map((r: any) => r.ops_tickets);
  if (!tickets.length) return num ? `I couldn't find ticket *${num}* raised by you.` : '✅ You have no open tickets.';
  return '📋 *Your tickets*\n\n' + tickets.map((t: any) =>
    `*${t.ticket_number}* – ${t.title}\nStatus: ${t.status}${t.eta_at || t.resolution_due_at ? ` · ETA ${fmtTime(t.eta_at ?? t.resolution_due_at)}` : ''}`,
  ).join('\n\n');
}

export function formatTicketReply(res: any, site: any, ex: Extraction) {
  const where = [site.display_name, ex.tower && `Tower ${ex.tower.replace(/^T/, '')}`, ex.floor && `Floor ${ex.floor}`, ex.area, ex.unit && `Unit ${ex.unit}`]
    .filter(Boolean).join(' · ');
  const eta = res.eta_at ?? res.resolution_due_at;
  if (res.is_duplicate) {
    return `ℹ️ This issue is already reported as *${res.ticket_number}*.\n` +
      `Status: *${res.ticket_status}*${res.report_count > 1 ? ` · reported by ${res.report_count} people` : ''}\n` +
      (res.assigned_to_name ? `👷 ${res.assigned_to_name}\n` : '') +
      (eta ? `⏱ ETA: ${fmtTime(eta)}\n` : '') +
      `We've added you to the updates.`;
  }
  return `✅ Ticket *${res.ticket_number}* raised\n` +
    `🏢 ${where}\n` +
    `🔧 ${ex.category} – ${ex.title}\n` +
    (res.priority === 'P1' ? '🚨 Marked *urgent*\n' : '') +
    (res.assigned_to_name ? `👷 Assigned to ${res.assigned_to_name}\n` : '') +
    (eta ? `⏱ Target: ${fmtTime(eta)}\n` : '') +
    `\nWe'll update you here. Reply *status* anytime.`;
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

const nowIso = () => new Date().toISOString();
