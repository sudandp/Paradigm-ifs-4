import { supabase } from './supabase';
import type { HelpdeskActAction, HelpdeskPresentStaff } from '../types/operations';

/**
 * Staff actions on helpdesk (channel) tickets. Every mutation is a SECURITY DEFINER RPC from
 * 20261126090000_helpdesk_assignment_eta_closure.sql; they raise readable exceptions
 * ('Not allowed', 'ETA must be in the future', ...) which surface here as Error.message.
 */

const TICKET_MEDIA_BUCKET = 'ticket-media';

const rpc = async <T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message || `${fn} failed`);
  return data as T;
};

export interface HelpdeskUserOption {
  id: string;
  name: string;
  roleId?: string | null;
}

export const helpdeskActionsApi = {
  /** 'work' = assignee or manager; 'reassign' = managers and above. Returns false on any error. */
  canAct: async (ticketId: string, action: HelpdeskActAction): Promise<boolean> => {
    try {
      return !!(await rpc<boolean>('helpdesk_can_act', { p_ticket_id: ticketId, p_action: action }));
    } catch (err) {
      console.warn('[helpdeskActionsApi] helpdesk_can_act unavailable', err);
      return false;
    }
  },

  acceptTicket: (ticketId: string, etaIso: string) =>
    rpc<void>('helpdesk_accept_ticket', { p_ticket_id: ticketId, p_eta: etaIso }),

  setEta: (ticketId: string, etaIso: string, reason: string) =>
    rpc<void>('helpdesk_set_eta', { p_ticket_id: ticketId, p_eta: etaIso, p_reason: reason }),

  holdTicket: (ticketId: string, reason: string) =>
    rpc<void>('helpdesk_hold_ticket', { p_ticket_id: ticketId, p_reason: reason }),

  reassignTicket: (ticketId: string, userId: string, reason: string) =>
    rpc<void>('helpdesk_reassign_ticket', { p_ticket_id: ticketId, p_user_id: userId, p_reason: reason }),

  resolveTicket: (
    ticketId: string,
    note: string | null,
    photoPaths: string[],
    latitude?: number | null,
    longitude?: number | null
  ) =>
    rpc<void>('helpdesk_resolve_ticket', {
      p_ticket_id: ticketId,
      p_note: note,
      p_photo_paths: photoPaths,
      p_latitude: latitude ?? null,
      p_longitude: longitude ?? null,
    }),

  /** Staff punched in at / assigned to the site right now. */
  getPresentStaff: async (siteId: string): Promise<HelpdeskPresentStaff[]> => {
    const rows = await rpc<any[]>('helpdesk_present_staff', { p_site_id: siteId });
    return (rows || []).map(r => ({
      userId: r.user_id,
      name: r.name || 'Unnamed',
      roleId: r.role_id,
      lastInAt: r.last_in_at,
      tier: r.tier,
      categories: r.categories,
      openTickets: Number(r.open_tickets ?? 0) || 0,
    }));
  },

  /** All active users for the "Not on site" reassign list. */
  getUsers: async (): Promise<HelpdeskUserOption[]> => {
    const { data, error } = await supabase.from('users').select('id, name, role_id').order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data as any[]) || []).map(r => ({ id: r.id, name: r.name || 'Unnamed', roleId: r.role_id }));
  },

  /**
   * Uploads one JPEG after-photo to the private `ticket-media` bucket at
   * after/<ticket_id>/<timestamp>-<n>.jpg (the resolve RPC only accepts [A-Za-z0-9/_.-]).
   */
  uploadAfterPhoto: async (ticketId: string, blob: Blob, index: number): Promise<string> => {
    const safeId = ticketId.replace(/[^A-Za-z0-9_-]/g, '');
    const path = `after/${safeId}/${Date.now()}-${index}.jpg`;
    const { error } = await supabase.storage
      .from(TICKET_MEDIA_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    return path;
  },

  /** Best-effort cleanup of photos uploaded by this user when the resolve did not go through. */
  removeUploadedPhotos: async (paths: string[]): Promise<void> => {
    if (!paths.length) return;
    try {
      const { error } = await supabase.storage.from(TICKET_MEDIA_BUCKET).remove(paths);
      if (error) console.warn('[helpdesk] could not remove unused photos', error.message);
    } catch (e) {
      console.warn('[helpdesk] could not remove unused photos', e);
    }
  },
};

/** data:image/...;base64,xxx -> Blob */
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, b64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(header)?.[1] || 'image/jpeg';
  const bin = atob(b64 || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};
