import { supabase } from './supabase';
import type {
  TicketEvent,
  TicketReporter,
  TicketMedia,
  TicketMediaKind,
  ChannelSiteOption,
} from '../types/operations';

/**
 * Read-only access to the omnichannel (WhatsApp helpdesk) ticket detail tables:
 * ticket_events, ticket_reporters (+ channel_contacts), ticket_media (private
 * `ticket-media` bucket, served through signed URLs) and channel_sites.
 *
 * Every call degrades to an empty result if the tables are not deployed yet so
 * the ops helpdesk keeps working without the WhatsApp migration.
 */

const TICKET_MEDIA_BUCKET = 'ticket-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

const warnOnce = (() => {
  const seen = new Set<string>();
  return (key: string, err: unknown) => {
    if (seen.has(key)) return;
    seen.add(key);
    console.warn(`[ticketTimelineApi] ${key} unavailable`, err);
  };
})();

export const ticketTimelineApi = {
  /** Timeline / audit events for a ticket, oldest first. */
  getTicketEvents: async (ticketId: string): Promise<TicketEvent[]> => {
    const { data, error } = await supabase
      .from('ticket_events')
      .select(
        'id, ticket_id, event_type, actor_user_id, actor_contact_id, inbound_message_id, payload, is_internal, created_at, ' +
          'actor_user:actor_user_id(name), actor_contact:actor_contact_id(display_name)'
      )
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      warnOnce('ticket_events', error);
      return [];
    }

    return ((data as any[]) || []).map(row => ({
      id: row.id,
      ticketId: row.ticket_id,
      eventType: row.event_type,
      actorUserId: row.actor_user_id,
      actorUserName: row.actor_user?.name ?? undefined,
      actorContactId: row.actor_contact_id,
      actorContactName: row.actor_contact?.display_name ?? undefined,
      inboundMessageId: row.inbound_message_id,
      payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
      isInternal: !!row.is_internal,
      createdAt: row.created_at,
    }));
  },

  /** Everyone who reported this ticket (first reporter + merged duplicates), oldest first. */
  getTicketReporters: async (ticketId: string): Promise<TicketReporter[]> => {
    const { data, error } = await supabase
      .from('ticket_reporters')
      .select('ticket_id, contact_id, reported_at, contact:contact_id(display_name, phone, channel)')
      .eq('ticket_id', ticketId)
      .order('reported_at', { ascending: true });

    if (error) {
      warnOnce('ticket_reporters', error);
      return [];
    }

    return ((data as any[]) || []).map(row => ({
      ticketId: row.ticket_id,
      contactId: row.contact_id,
      displayName: row.contact?.display_name ?? undefined,
      phone: row.contact?.phone ?? undefined,
      channel: row.contact?.channel ?? undefined,
      reportedAt: row.reported_at,
    }));
  },

  /** Photos attached to the ticket with short-lived signed URLs. */
  getTicketMedia: async (ticketId: string): Promise<TicketMedia[]> => {
    const { data, error } = await supabase
      .from('ticket_media')
      .select('id, ticket_id, kind, storage_path, mime_type, latitude, longitude, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      warnOnce('ticket_media', error);
      return [];
    }

    const rows = (data as any[]) || [];
    if (rows.length === 0) return [];

    const paths = rows.map(r => r.storage_path).filter(Boolean);
    const urlByPath = new Map<string, string>();
    try {
      const { data: signed, error: signErr } = await supabase.storage
        .from(TICKET_MEDIA_BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      if (signErr) throw signErr;
      (signed || []).forEach(s => {
        if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
      });
    } catch {
      // Fall back to one-by-one signing (e.g. a single bad path fails the batch)
      await Promise.all(
        paths.map(async path => {
          const { data: one } = await supabase.storage
            .from(TICKET_MEDIA_BUCKET)
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
          if (one?.signedUrl) urlByPath.set(path, one.signedUrl);
        })
      );
    }

    return rows.map(row => ({
      id: row.id,
      ticketId: row.ticket_id,
      kind: (row.kind || 'before') as TicketMediaKind,
      storagePath: row.storage_path,
      mimeType: row.mime_type,
      signedUrl: urlByPath.get(row.storage_path) ?? null,
      latitude: row.latitude,
      longitude: row.longitude,
      createdAt: row.created_at,
    }));
  },

  /** Active channel sites for the helpdesk site filter. */
  getChannelSites: async (): Promise<ChannelSiteOption[]> => {
    const { data, error } = await supabase
      .from('channel_sites')
      .select('id, display_name, site_code')
      .order('display_name', { ascending: true });

    if (error) {
      warnOnce('channel_sites', error);
      return [];
    }
    return ((data as any[]) || []).map(row => ({
      id: row.id,
      displayName: row.display_name,
      siteCode: row.site_code,
    }));
  },
};

/** "98xxxxxx10" style masking: keep first 2 and last 2 digits of the national number. */
export const maskPhone = (phone?: string | null): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  // Drop an Indian country code so the visible prefix is the mobile number's start
  const national = digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
  return `${national.slice(0, 2)}${'x'.repeat(Math.max(national.length - 4, 0))}${national.slice(-2)}`;
};

/** "Tower T1 · Floor 1 · LOBBY" */
export const formatTicketLocation = (t: { tower?: string | null; floor?: string | null; area?: string | null }): string => {
  const parts: string[] = [];
  if (t.tower) parts.push(/^tower/i.test(t.tower) ? t.tower : `Tower ${t.tower}`);
  if (t.floor) parts.push(/^floor/i.test(t.floor) ? t.floor : `Floor ${t.floor}`);
  if (t.area) parts.push(t.area);
  return parts.join(' · ');
};
