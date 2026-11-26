/**
 * Data access for the WhatsApp helpdesk admin setup
 * (channel_sites, site_locations, channel_contacts, channel_contact_sites, inbound_messages,
 *  site_ticket_assignees, ticket_notifications).
 * Tables are defined in supabase/migrations/20261125120000_whatsapp_helpdesk_core.sql and
 * supabase/migrations/20261126090000_helpdesk_assignment_eta_closure.sql.
 * RLS: all authenticated users can read config; writes require check_is_admin().
 */
import { supabase } from './supabase';

export type SiteLocationKind = 'tower' | 'floor' | 'area';
export type ContactRole = 'client' | 'resident' | 'staff' | 'unknown';
export type InboundStatus =
  | 'pending' | 'processing' | 'processed' | 'ignored' | 'awaiting_info' | 'review' | 'failed';

export const SITE_CODE_REGEX = /^[A-Z0-9_-]{2,30}$/;
export const CONTACT_ROLES: ContactRole[] = ['client', 'resident', 'staff', 'unknown'];
export const INBOUND_STATUSES: InboundStatus[] = [
  'pending', 'processing', 'processed', 'ignored', 'awaiting_info', 'review', 'failed',
];

export interface ChannelSite {
  id: string;
  site_code: string;
  display_name: string;
  entity_id: string | null;
  location_id: string | null;
  organization_id: string | null;
  dedupe_window_hours: number;
  auto_priority_bump_reporters: number;
  /** When the assignee punches out with open tickets, auto-reassign to someone on site (else only alert managers). */
  reassign_on_checkout: boolean;
  /** Resolved tickets are closed after this many hours without a client reply. */
  auto_close_hours: number;
  notify_client_on_eta_change: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ChannelSiteInput = Pick<
  ChannelSite,
  | 'site_code' | 'display_name' | 'entity_id' | 'location_id' | 'dedupe_window_hours' | 'auto_priority_bump_reporters'
  | 'reassign_on_checkout' | 'auto_close_hours' | 'notify_client_on_eta_change' | 'is_active'
>;

export interface SiteLocation {
  id: string;
  site_id: string;
  kind: SiteLocationKind;
  value: string;
  aliases: string[];
  created_at: string;
}

export interface ChannelContactSiteLink {
  contact_id: string;
  site_id: string;
  unit_number: string | null;
  added_via: 'qr' | 'picker' | 'admin';
  created_at: string;
}

export interface ChannelContact {
  id: string;
  channel: string;
  sender_id: string;
  phone: string | null;
  email: string | null;
  display_name: string | null;
  contact_role: ContactRole;
  user_id: string | null;
  last_site_id: string | null;
  last_inbound_at: string | null;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
  sites: ChannelContactSiteLink[];
}

export interface InboundMessageRow {
  id: string;
  channel: string;
  sender_id: string;
  sender_name: string | null;
  site_id: string | null;
  msg_type: string;
  body: string | null;
  status: InboundStatus;
  error: string | null;
  attempts: number;
  received_at: string;
  processed_at: string | null;
  ticket_id: string | null;
  ticket_number: string | null;
}

export interface OptionItem { id: string; name: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalises a phone to WhatsApp wa_id form: digits only with country code (assumes +91 for 10 digits). */
export const normalizeWaNumber = (raw: string): string | null => {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
};

export const normalizeSiteCode = (raw: string): string =>
  (raw || '').toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_-]/g, '');

export const parseAliases = (raw: string): string[] =>
  Array.from(new Set(
    (raw || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean),
  ));

export const getHelpdeskNumber = (): string => {
  const raw = (import.meta.env.VITE_WA_HELPDESK_NUMBER as string | undefined) || '';
  return raw.replace(/\D/g, '');
};

export const buildClickToChatLink = (helpdeskNumber: string, siteCode: string): string =>
  // Site codes are restricted to [A-Z0-9_-], which are URL-safe; keep "SITE:" readable for the webhook parser.
  `https://wa.me/${helpdeskNumber}?text=SITE:${encodeURIComponent(siteCode)}%20`;

const fail = (error: { message?: string } | null, fallback: string): never => {
  throw new Error(error?.message || fallback);
};

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export const fetchEntityOptions = async (): Promise<OptionItem[]> => {
  const { data, error } = await supabase.from('entities').select('id, name').order('name');
  if (error) fail(error, 'Failed to load entities');
  return (data || []).map((r: any) => ({ id: String(r.id), name: r.name || String(r.id) }));
};

export const fetchLocationOptions = async (): Promise<OptionItem[]> => {
  const { data, error } = await supabase.from('locations').select('id, name').order('name');
  if (error) fail(error, 'Failed to load locations');
  return (data || []).map((r: any) => ({ id: String(r.id), name: r.name || String(r.id) }));
};

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

export const fetchChannelSites = async (): Promise<ChannelSite[]> => {
  const { data, error } = await supabase
    .from('channel_sites')
    .select('*')
    .order('display_name');
  if (error) fail(error, 'Failed to load sites');
  return ((data || []) as any[]).map(r => ({
    ...r,
    // Mirror the column defaults in case the assignment migration has not been applied yet.
    reassign_on_checkout: r.reassign_on_checkout ?? true,
    auto_close_hours: r.auto_close_hours ?? 24,
    notify_client_on_eta_change: r.notify_client_on_eta_change ?? true,
  })) as ChannelSite[];
};

const validateSite = (input: ChannelSiteInput): ChannelSiteInput => {
  const site_code = normalizeSiteCode(input.site_code);
  if (!SITE_CODE_REGEX.test(site_code)) {
    throw new Error('Site code must be 2-30 characters: A-Z, 0-9, _ or -');
  }
  const display_name = (input.display_name || '').trim();
  if (!display_name) throw new Error('Display name is required');
  return {
    site_code,
    display_name,
    entity_id: input.entity_id || null,
    location_id: input.location_id || null,
    dedupe_window_hours: Math.max(1, Math.round(Number(input.dedupe_window_hours) || 72)),
    auto_priority_bump_reporters: Math.max(0, Math.round(Number(input.auto_priority_bump_reporters) || 0)),
    reassign_on_checkout: input.reassign_on_checkout !== false,
    auto_close_hours: Math.min(720, Math.max(1, Math.round(Number(input.auto_close_hours) || 24))),
    notify_client_on_eta_change: input.notify_client_on_eta_change !== false,
    is_active: !!input.is_active,
  };
};

export const createChannelSite = async (input: ChannelSiteInput): Promise<ChannelSite> => {
  const payload = validateSite(input);
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('channel_sites')
    .insert({ ...payload, created_by: user?.id ?? null })
    .select('*')
    .single();
  if (error) fail(error, 'Failed to create site');
  return data as ChannelSite;
};

export const updateChannelSite = async (id: string, input: ChannelSiteInput): Promise<ChannelSite> => {
  const payload = validateSite(input);
  const { data, error } = await supabase
    .from('channel_sites')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) fail(error, 'Failed to update site');
  return data as ChannelSite;
};

export const setChannelSiteActive = async (id: string, isActive: boolean): Promise<void> => {
  const { error } = await supabase.from('channel_sites').update({ is_active: isActive }).eq('id', id);
  if (error) fail(error, 'Failed to update site');
};

// ---------------------------------------------------------------------------
// Site locations
// ---------------------------------------------------------------------------

export const fetchSiteLocations = async (siteId: string): Promise<SiteLocation[]> => {
  const { data, error } = await supabase
    .from('site_locations')
    .select('*')
    .eq('site_id', siteId)
    .order('kind')
    .order('value');
  if (error) fail(error, 'Failed to load locations');
  return (data || []) as SiteLocation[];
};

export interface SiteLocationInput {
  kind: SiteLocationKind;
  value: string;
  aliases: string[];
}

const cleanLocation = (input: SiteLocationInput): SiteLocationInput => {
  const value = (input.value || '').trim().toUpperCase();
  if (!value) throw new Error('Canonical value is required');
  return {
    kind: input.kind,
    value,
    aliases: Array.from(new Set((input.aliases || []).map(a => a.trim().toLowerCase()).filter(Boolean))),
  };
};

export const upsertSiteLocations = async (siteId: string, inputs: SiteLocationInput[]): Promise<number> => {
  if (!inputs.length) return 0;
  const rows = inputs.map(i => ({ site_id: siteId, ...cleanLocation(i) }));
  const { data, error } = await supabase
    .from('site_locations')
    .upsert(rows, { onConflict: 'site_id,kind,value' })
    .select('id');
  if (error) fail(error, 'Failed to save locations');
  return (data || []).length;
};

export const updateSiteLocation = async (id: string, input: SiteLocationInput): Promise<void> => {
  const { error } = await supabase.from('site_locations').update(cleanLocation(input)).eq('id', id);
  if (error) fail(error, 'Failed to update location');
};

export const deleteSiteLocation = async (id: string): Promise<void> => {
  const { error } = await supabase.from('site_locations').delete().eq('id', id);
  if (error) fail(error, 'Failed to delete location');
};

/** Generates T1..Tn with common aliases ("tower n", "t-n", "block n", ...). */
export const buildTowerPresets = (count: number, prefix = 'T'): SiteLocationInput[] => {
  const out: SiteLocationInput[] = [];
  for (let n = 1; n <= count; n++) {
    const letter = n <= 26 ? String.fromCharCode(64 + n).toLowerCase() : null;
    const aliases = [`tower ${n}`, `tower-${n}`, `t-${n}`, `t ${n}`, `t${n}`, `block ${n}`, `b${n}`];
    if (letter) aliases.push(`tower ${letter}`, `block ${letter}`);
    out.push({ kind: 'tower', value: `${prefix}${n}`.toUpperCase(), aliases });
  }
  return out;
};

/** Generates floors G, 1..n with common aliases. */
export const buildFloorPresets = (count: number, includeGround = true): SiteLocationInput[] => {
  const out: SiteLocationInput[] = [];
  if (includeGround) {
    out.push({ kind: 'floor', value: 'G', aliases: ['ground', 'ground floor', 'gf', '0', 'floor 0'] });
  }
  const ord = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  for (let n = 1; n <= count; n++) {
    out.push({ kind: 'floor', value: String(n), aliases: [`floor ${n}`, `${ord(n)} floor`, ord(n), `f${n}`, `level ${n}`] });
  }
  return out;
};

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export interface ContactFilters {
  search?: string;
  role?: ContactRole | '';
  siteId?: string;
  limit?: number;
}

export const fetchChannelContacts = async (filters: ContactFilters = {}): Promise<ChannelContact[]> => {
  let contactIds: string[] | null = null;
  if (filters.siteId) {
    const { data: links, error: linkErr } = await supabase
      .from('channel_contact_sites')
      .select('contact_id')
      .eq('site_id', filters.siteId);
    if (linkErr) fail(linkErr, 'Failed to load contacts');
    contactIds = (links || []).map((l: any) => l.contact_id);
    if (!contactIds.length) return [];
  }

  let query = supabase
    .from('channel_contacts')
    .select('id, channel, sender_id, phone, email, display_name, contact_role, user_id, last_site_id, last_inbound_at, is_blocked, created_at, updated_at, sites:channel_contact_sites(contact_id, site_id, unit_number, added_via, created_at)')
    .order('updated_at', { ascending: false })
    .limit(filters.limit ?? 300);

  if (filters.role) query = query.eq('contact_role', filters.role);
  if (contactIds) query = query.in('id', contactIds.slice(0, 500));
  const term = (filters.search || '').trim().replace(/[%,()]/g, '');
  if (term) {
    const digits = term.replace(/\D/g, '');
    const parts = [`display_name.ilike.%${term}%`];
    if (digits.length >= 3) parts.push(`sender_id.ilike.%${digits}%`, `phone.ilike.%${digits}%`);
    query = query.or(parts.join(','));
  }

  const { data, error } = await query;
  if (error) fail(error, 'Failed to load contacts');
  return ((data || []) as any[]).map(r => ({ ...r, sites: r.sites || [] })) as ChannelContact[];
};

export interface ContactUpdate {
  display_name: string | null;
  contact_role: ContactRole;
  is_blocked: boolean;
}

export const updateChannelContact = async (id: string, update: ContactUpdate): Promise<void> => {
  const { error } = await supabase
    .from('channel_contacts')
    .update({
      display_name: update.display_name?.trim() || null,
      contact_role: update.contact_role,
      is_blocked: update.is_blocked,
    })
    .eq('id', id);
  if (error) fail(error, 'Failed to update contact');
};

export const linkContactToSite = async (contactId: string, siteId: string, unitNumber?: string | null): Promise<void> => {
  const { error } = await supabase
    .from('channel_contact_sites')
    .upsert(
      { contact_id: contactId, site_id: siteId, unit_number: unitNumber?.trim() || null, added_via: 'admin' },
      { onConflict: 'contact_id,site_id' },
    );
  if (error) fail(error, 'Failed to link site');
};

export const unlinkContactFromSite = async (contactId: string, siteId: string): Promise<void> => {
  const { error } = await supabase
    .from('channel_contact_sites')
    .delete()
    .eq('contact_id', contactId)
    .eq('site_id', siteId);
  if (error) fail(error, 'Failed to unlink site');
};

export interface BulkContactLine {
  line: number;
  raw: string;
  phone: string | null;
  name: string;
  unit: string;
  error?: string;
}

/** Parses pasted lines of "phone,name,unit" (also accepts tab or semicolon separators). */
export const parseBulkContactLines = (text: string): BulkContactLine[] => {
  const seen = new Set<string>();
  return (text || '')
    .split(/\r?\n/)
    .map((raw, idx) => ({ raw: raw.trim(), line: idx + 1 }))
    .filter(r => r.raw && !r.raw.startsWith('#'))
    .map(({ raw, line }) => {
      const [p = '', name = '', ...rest] = raw.split(/[,;\t]/).map(s => s.trim());
      const phone = normalizeWaNumber(p);
      const entry: BulkContactLine = { line, raw, phone, name, unit: rest.join(' ').trim() };
      if (!phone) entry.error = 'Invalid phone number';
      else if (seen.has(phone)) entry.error = 'Duplicate in list';
      if (phone) seen.add(phone);
      return entry;
    });
};

export interface BulkRegisterResult { created: number; updated: number; linked: number; skipped: number }

export const bulkRegisterContacts = async (
  siteId: string,
  lines: BulkContactLine[],
  role: ContactRole = 'client',
): Promise<BulkRegisterResult> => {
  const valid = lines.filter(l => l.phone && !l.error);
  const result: BulkRegisterResult = { created: 0, updated: 0, linked: 0, skipped: lines.length - valid.length };
  if (!valid.length) return result;

  const phones = valid.map(l => l.phone as string);
  const existingMap = new Map<string, { id: string; display_name: string | null }>();
  for (let i = 0; i < phones.length; i += 200) {
    const { data, error } = await supabase
      .from('channel_contacts')
      .select('id, sender_id, display_name')
      .eq('channel', 'whatsapp')
      .in('sender_id', phones.slice(i, i + 200));
    if (error) fail(error, 'Failed to look up contacts');
    (data || []).forEach((r: any) => existingMap.set(r.sender_id, { id: r.id, display_name: r.display_name }));
  }

  // Upsert contacts. Keep an existing display_name when the pasted name is blank.
  const rows = valid.map(l => {
    const phone = l.phone as string;
    const existing = existingMap.get(phone);
    const row: Record<string, unknown> = {
      channel: 'whatsapp',
      sender_id: phone,
      phone,
      display_name: l.name || existing?.display_name || null,
    };
    if (!existing) row.contact_role = role;
    return row;
  });
  // Rows without contact_role (existing contacts) must not reset their role, so split the batches.
  const newRows = rows.filter(r => 'contact_role' in r);
  const oldRows = rows.filter(r => !('contact_role' in r));

  const idByPhone = new Map<string, string>();
  for (const batch of [newRows, oldRows]) {
    for (let i = 0; i < batch.length; i += 200) {
      const chunk = batch.slice(i, i + 200);
      if (!chunk.length) continue;
      const { data, error } = await supabase
        .from('channel_contacts')
        .upsert(chunk, { onConflict: 'channel,sender_id' })
        .select('id, sender_id');
      if (error) fail(error, 'Failed to save contacts');
      (data || []).forEach((r: any) => idByPhone.set(r.sender_id, r.id));
    }
  }
  result.created = newRows.length;
  result.updated = oldRows.length;

  const links = valid
    .filter(l => idByPhone.has(l.phone as string))
    .map(l => ({
      contact_id: idByPhone.get(l.phone as string) as string,
      site_id: siteId,
      unit_number: l.unit || null,
      added_via: 'admin',
    }));
  for (let i = 0; i < links.length; i += 200) {
    const { error } = await supabase
      .from('channel_contact_sites')
      .upsert(links.slice(i, i + 200), { onConflict: 'contact_id,site_id' });
    if (error) fail(error, 'Failed to link contacts to site');
  }
  result.linked = links.length;
  return result;
};

// ---------------------------------------------------------------------------
// Inbound message log
// ---------------------------------------------------------------------------

export const fetchInboundMessages = async (status?: InboundStatus | '', limit = 200): Promise<InboundMessageRow[]> => {
  let query = supabase
    .from('inbound_messages')
    .select('id, channel, sender_id, sender_name, site_id, msg_type, body, status, error, attempts, received_at, processed_at, ticket_id, ticket:ops_tickets!inbound_messages_ticket_id_fkey(ticket_number)')
    .order('received_at', { ascending: false })
    .limit(limit);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) fail(error, 'Failed to load message log');
  return ((data || []) as any[]).map(r => {
    const t = Array.isArray(r.ticket) ? r.ticket[0] : r.ticket;
    const { ticket: _ticket, ...rest } = r;
    return { ...rest, ticket_number: t?.ticket_number ?? null } as InboundMessageRow;
  });
};

// ---------------------------------------------------------------------------
// Site ticket assignees (who handles tickets at a site)
// ---------------------------------------------------------------------------

export type AssigneeTier = 'technician' | 'supervisor' | 'manager';
export const ASSIGNEE_TIERS: AssigneeTier[] = ['technician', 'supervisor', 'manager'];
export const HELPDESK_CATEGORIES = ['Electrical', 'Plumbing', 'Housekeeping', 'Security', 'Civil', 'HVAC', 'General'] as const;

export interface StaffOption {
  id: string;
  name: string;
  role_id: string | null;
  phone: string | null;
}

export interface SiteTicketAssignee {
  id: string;
  site_id: string;
  user_id: string;
  tier: AssigneeTier;
  /** Empty = all categories. */
  categories: string[];
  is_active: boolean;
  created_at: string;
  user: StaffOption | null;
}

export interface SiteTicketAssigneeInput {
  tier: AssigneeTier;
  /** Empty = all categories. */
  categories: string[];
  is_active?: boolean;
}

export interface PresentStaff {
  user_id: string;
  name: string | null;
  role_id: string | null;
  last_in_at: string | null;
  /** Null when the person is on site but not configured as an assignee. */
  tier: AssigneeTier | null;
  categories: string[] | null;
  open_tickets: number;
}

const cleanCategories = (cats: string[]): string[] =>
  Array.from(new Set((cats || []).filter(c => (HELPDESK_CATEGORIES as readonly string[]).includes(c))));

const mapStaff = (r: any): StaffOption => ({
  id: String(r.id),
  name: r.name || 'Unnamed',
  role_id: r.role_id ?? null,
  phone: r.phone ?? null,
});

/** Searches staff (public.users) by name or phone. */
export const searchStaff = async (term: string, limit = 25): Promise<StaffOption[]> => {
  const t = (term || '').trim().replace(/[%,()]/g, '');
  let query = supabase.from('users').select('id, name, role_id, phone').order('name').limit(limit);
  if (t) {
    const digits = t.replace(/\D/g, '');
    const parts = [`name.ilike.%${t}%`];
    if (digits.length >= 3) parts.push(`phone.ilike.%${digits}%`);
    query = query.or(parts.join(','));
  }
  const { data, error } = await query;
  if (error) fail(error, 'Failed to search staff');
  return (data || []).map(mapStaff);
};

export const fetchUsersByIds = async (ids: string[]): Promise<StaffOption[]> => {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return [];
  const out: StaffOption[] = [];
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await supabase.from('users').select('id, name, role_id, phone').in('id', unique.slice(i, i + 200));
    if (error) fail(error, 'Failed to load staff');
    out.push(...(data || []).map(mapStaff));
  }
  return out;
};

export const fetchSiteAssignees = async (siteId: string): Promise<SiteTicketAssignee[]> => {
  const { data, error } = await supabase
    .from('site_ticket_assignees')
    .select('id, site_id, user_id, tier, categories, is_active, created_at')
    .eq('site_id', siteId)
    .order('created_at');
  if (error) fail(error, 'Failed to load assignees');
  const rows = (data || []) as any[];
  const users = new Map((await fetchUsersByIds(rows.map(r => String(r.user_id)))).map(u => [u.id, u]));
  return rows.map(r => ({
    ...r,
    categories: r.categories || [],
    user: users.get(String(r.user_id)) || null,
  })) as SiteTicketAssignee[];
};

/** Adds (or re-configures) a staff member for a site; unique per (site_id, user_id). */
export const upsertSiteAssignee = async (siteId: string, userId: string, input: SiteTicketAssigneeInput): Promise<void> => {
  if (!ASSIGNEE_TIERS.includes(input.tier)) throw new Error('Invalid tier');
  const { error } = await supabase
    .from('site_ticket_assignees')
    .upsert(
      {
        site_id: siteId,
        user_id: userId,
        tier: input.tier,
        categories: cleanCategories(input.categories),
        is_active: input.is_active ?? true,
      },
      { onConflict: 'site_id,user_id' },
    );
  if (error) fail(error, 'Failed to save assignee');
};

export const updateSiteAssignee = async (id: string, input: SiteTicketAssigneeInput): Promise<void> => {
  if (!ASSIGNEE_TIERS.includes(input.tier)) throw new Error('Invalid tier');
  const patch: Record<string, unknown> = { tier: input.tier, categories: cleanCategories(input.categories) };
  if (input.is_active !== undefined) patch.is_active = input.is_active;
  const { error } = await supabase.from('site_ticket_assignees').update(patch).eq('id', id);
  if (error) fail(error, 'Failed to update assignee');
};

export const setSiteAssigneeActive = async (id: string, isActive: boolean): Promise<void> => {
  const { error } = await supabase.from('site_ticket_assignees').update({ is_active: isActive }).eq('id', id);
  if (error) fail(error, 'Failed to update assignee');
};

export const deleteSiteAssignee = async (id: string): Promise<void> => {
  const { error } = await supabase.from('site_ticket_assignees').delete().eq('id', id);
  if (error) fail(error, 'Failed to remove assignee');
};

/** Staff currently punched in and matched to the site (RPC helpdesk_present_staff). */
export const fetchPresentStaff = async (siteId: string): Promise<PresentStaff[]> => {
  const { data, error } = await supabase.rpc('helpdesk_present_staff', { p_site_id: siteId });
  if (error) fail(error, 'Failed to load on-site staff');
  return ((data || []) as any[]).map(r => ({
    user_id: String(r.user_id),
    name: r.name ?? null,
    role_id: r.role_id ?? null,
    last_in_at: r.last_in_at ?? null,
    tier: (r.tier ?? null) as AssigneeTier | null,
    categories: r.categories ?? null,
    open_tickets: Number(r.open_tickets) || 0,
  }));
};

/** Escalation contacts (RPC helpdesk_site_managers): configured supervisors/managers + Site Responsibility Matrix. */
export const fetchSiteManagers = async (siteId: string): Promise<StaffOption[]> => {
  const { data, error } = await supabase.rpc('helpdesk_site_managers', { p_site_id: siteId });
  if (error) fail(error, 'Failed to load escalation contacts');
  const ids = Array.from(new Set(((data || []) as any[])
    .map(r => (r && typeof r === 'object' ? r.user_id : r))
    .filter(Boolean)
    .map(String)));
  const users = new Map((await fetchUsersByIds(ids)).map(u => [u.id, u]));
  return ids.map(id => users.get(id) || { id, name: 'Unknown user', role_id: null, phone: null });
};

// ---------------------------------------------------------------------------
// Ticket notification outbox (admin read-only)
// ---------------------------------------------------------------------------

export type NotificationStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';
export const NOTIFICATION_STATUSES: NotificationStatus[] = ['pending', 'processing', 'sent', 'failed', 'skipped'];

export interface TicketNotificationRow {
  id: string;
  ticket_id: string;
  ticket_number: string | null;
  audience: 'client' | 'assignee' | 'managers';
  event: string;
  status: NotificationStatus;
  attempts: number;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export const fetchTicketNotifications = async (status?: NotificationStatus | '', limit = 200): Promise<TicketNotificationRow[]> => {
  let query = supabase
    .from('ticket_notifications')
    .select('id, ticket_id, audience, event, status, attempts, error, created_at, sent_at, ticket:ops_tickets!ticket_notifications_ticket_id_fkey(ticket_number)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) fail(error, 'Failed to load notifications');
  return ((data || []) as any[]).map(r => {
    const t = Array.isArray(r.ticket) ? r.ticket[0] : r.ticket;
    const { ticket: _ticket, ...rest } = r;
    return { ...rest, ticket_number: t?.ticket_number ?? null } as TicketNotificationRow;
  });
};
