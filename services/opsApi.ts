import { supabase } from './supabase';
import { api, offlineDb } from './api';
import { useAuthStore } from '../store/authStore';
import type { 
  OpsTicket, 
  OpsMaintenanceSchedule, 
  OpsMaintenanceLog, 
  OpsContract,
  TicketPriority,
  SnagEntry,
  HelpdeskSlaPolicy,
  OpsAsset,
  AssetCategory,
  AssetPpmChecklist,
  AssetPpmLog
} from '../types/operations';
import { isOfflineEnabled } from './offline/featureFlag';
import { isOnline } from './offline/networkStatus';
import { saveOfflineAware, unwrap, isNetworkError } from './offline/saveOfflineAware';
import * as cache from './offline/cache';
import * as outbox from './offline/outbox';
import { getCurrentUserId, syncEngine } from './offline/syncEngine';
import {
  cacheSnagEntry,
  cacheSnagEntries,
  getCachedSnagEntries,
  deleteSnagEntryFromCache,
} from './offline/cache';

// Helper to convert snake_case DB fields to camelCase TS fields
const toCamelCase = (data: any): any => {
  if (Array.isArray(data)) return data.map(item => toCamelCase(item));
  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    const camelCased: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
        camelCased[camelKey] = toCamelCase(data[key]);
      }
    }
    return camelCased;
  }
  return data;
};

// Helper to convert camelCase TS fields to snake_case DB fields
const toSnakeCase = (data: any): any => {
  if (Array.isArray(data)) return data.map(item => toSnakeCase(item));
  if (data !== null && typeof data === 'object' && !(data instanceof Date) && !(data instanceof File)) {
    const snaked: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        snaked[snakeKey] = toSnakeCase(data[key]);
      }
    }
    return snaked;
  }
  return data;
};

// Calculate SLA Due Dates based on Priority (Standard Enterprise SLA Rules)
const calculateSlaDueDates = (priority: TicketPriority) => {
  const now = new Date();
  const responseDate = new Date(now);
  const resolutionDate = new Date(now);

  switch (priority) {
    case 'P1': // Critical: 15m response, 2 hours resolution
      responseDate.setMinutes(responseDate.getMinutes() + 15);
      resolutionDate.setHours(resolutionDate.getHours() + 2);
      break;
    case 'P2': // High: 30m response, 6 hours resolution
      responseDate.setMinutes(responseDate.getMinutes() + 30);
      resolutionDate.setHours(resolutionDate.getHours() + 6);
      break;
    case 'P3': // Medium: 2h response, 24 hours resolution
      responseDate.setHours(responseDate.getHours() + 2);
      resolutionDate.setHours(resolutionDate.getHours() + 24);
      break;
    case 'P4': // Low: 4h response, 48 hours resolution
      responseDate.setHours(responseDate.getHours() + 4);
      resolutionDate.setHours(resolutionDate.getHours() + 48);
      break;
  }

  return {
    responseDueAt: responseDate.toISOString(),
    resolutionDueAt: resolutionDate.toISOString(),
    dueDate: resolutionDate.toISOString() // Backwards-compatible
  };
};

// Ticket select + mapping. The omnichannel (WhatsApp) joins depend on the
// 20261125120000_whatsapp_helpdesk_core migration; if PostgREST does not know the
// relationships yet, getTickets falls back to the base select and mutations follow suit.
const BASE_TICKET_SELECT = '*, entity:entities(name), assignee:assigned_to(name)';
const CHANNEL_TICKET_SELECT =
  `${BASE_TICKET_SELECT}, channel_site:channel_site_id(display_name), ` +
  'reporter_contact:reporter_contact_id(display_name, phone)';
let channelJoinsAvailable = true;
const ticketSelect = () => (channelJoinsAvailable ? CHANNEL_TICKET_SELECT : BASE_TICKET_SELECT);

const mapTicketRow = (row: any): OpsTicket => {
  const { entity, assignee, channel_site, reporter_contact, ...rest } = row || {};
  const ticket = toCamelCase(rest);
  ticket.entityName = entity?.name;
  ticket.assignedToName = assignee?.name;
  if (channel_site?.display_name) ticket.channelSiteName = channel_site.display_name;
  if (reporter_contact) {
    if (reporter_contact.display_name) ticket.reporterContactName = reporter_contact.display_name;
    if (reporter_contact.phone) ticket.reporterContactPhone = reporter_contact.phone;
  }
  if (ticket.extractionConfidence != null) ticket.extractionConfidence = Number(ticket.extractionConfidence);
  // Helpdesk assignment/closure columns (absent until the 20261126090000 migration is applied)
  // (assigned_at, assignment_note, reopen_count, client_confirmed_at, resolution_note come through `*`).
  if (ticket.reopenCount != null) ticket.reopenCount = Number(ticket.reopenCount) || 0;
  return ticket;
};

export const opsApi = {

  // ==========================================================================
  // TICKETS & SLA ENGINE
  // ==========================================================================

  getTickets: async (entityId?: string): Promise<OpsTicket[]> => {
    const runQuery = (select: string) => {
      let query = supabase.from('ops_tickets').select(select);
      if (entityId) {
        query = query.eq('entity_id', entityId);
      }
      return query.order('created_at', { ascending: false });
    };

    let { data, error } = await runQuery(ticketSelect());
    if (error && channelJoinsAvailable) {
      // Channel tables / FKs not deployed yet: retry without the WhatsApp joins
      console.warn('ops_tickets channel joins unavailable, falling back to base select', error);
      channelJoinsAvailable = false;
      ({ data, error } = await runQuery(BASE_TICKET_SELECT));
    }
    if (error) throw error;
    
    const now = new Date();
    return (data || []).map((row: any) => {
      const ticket: any = mapTicketRow(row);

      // Dynamic SLA breach detection if not already completed
      if (ticket.status !== 'Resolved' && ticket.status !== 'Closed') {
        const resDue = ticket.resolutionDueAt || ticket.dueDate;
        if (resDue && new Date(resDue) < now) {
          ticket.isEscalated = true;
          ticket.escalationLevel = ticket.escalationLevel || 1;
        }
      }
      return ticket;
    });
  },

  saveTicket: async (ticket: Partial<OpsTicket>): Promise<OpsTicket> => {
    const { id, createdAt, updatedAt, entityName, assignedToName, createdByName, channelSiteName, reporterContactName, reporterContactPhone, ...rest } = ticket as any;
    
    // Auto calculate SLA targets if new ticket
    if (!id && rest.priority) {
      const sla = calculateSlaDueDates(rest.priority);
      if (!rest.responseDueAt) rest.responseDueAt = sla.responseDueAt;
      if (!rest.resolutionDueAt) rest.resolutionDueAt = sla.resolutionDueAt;
      if (!rest.dueDate) rest.dueDate = sla.dueDate;
    }
    
    let query;
    if (id) {
      query = supabase.from('ops_tickets').update(toSnakeCase(rest)).eq('id', id);
    } else {
      // Generate standard ticket number if new
      if (!rest.ticketNumber) {
        rest.ticketNumber = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
      }
      query = supabase.from('ops_tickets').insert(toSnakeCase(rest));
    }
    
    const { data, error } = await query.select(ticketSelect()).single();
    if (error) throw error;
    
    const saved = mapTicketRow(data);
    return saved;
  },

  deleteTicket: async (id: string): Promise<void> => {
    const { error } = await supabase.from('ops_tickets').delete().eq('id', id);
    if (error) throw error;
  },

  // ==========================================================================
  // RESIDENT CLOSURE OTP & ADMIN OVERRIDE
  // ==========================================================================

  requestClosureOtp: async (ticketId: string): Promise<{ success: boolean; expiresAt: string; message: string; demoOtp: string }> => {
    // Generate secure 4-digit numeric OTP
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins expiry

    const { error } = await supabase
      .from('ops_tickets')
      .update({
        closure_otp: generatedOtp,
        closure_otp_expires_at: expiresAt
      })
      .eq('id', ticketId);

    if (error) throw error;

    return {
      success: true,
      expiresAt,
      message: `4-digit OTP sent to resident. Valid for 15 minutes.`,
      demoOtp: generatedOtp
    };
  },

  verifyClosureOtp: async (ticketId: string, otp: string): Promise<{ success: boolean; ticket: OpsTicket }> => {
    const { data, error } = await supabase
      .from('ops_tickets')
      .select('id, closure_otp, closure_otp_expires_at')
      .eq('id', ticketId)
      .single();

    if (error || !data) throw new Error('Ticket not found');

    const now = new Date();
    if (!data.closure_otp) {
      throw new Error('No OTP requested yet. Please click "Request OTP" first.');
    }

    if (data.closure_otp_expires_at && new Date(data.closure_otp_expires_at) < now) {
      throw new Error('Closure OTP has expired. Please request a fresh OTP.');
    }

    if (data.closure_otp.trim() !== otp.trim()) {
      throw new Error('Invalid OTP entered. Please verify with resident.');
    }

    // OTP matched! Mark ticket Resolved and record verification
    const { data: updated, error: updateErr } = await supabase
      .from('ops_tickets')
      .update({
        status: 'Resolved',
        closure_verified_at: now.toISOString(),
        resolved_at: now.toISOString(),
        closure_otp: null // Clear OTP after single-use consumption
      })
      .eq('id', ticketId)
      .select(ticketSelect())
      .single();

    if (updateErr) throw updateErr;

    const resTicket = mapTicketRow(updated);
    return { success: true, ticket: resTicket };
  },

  adminOverrideClosure: async (ticketId: string, reason: string, photoUrl?: string): Promise<OpsTicket> => {
    if (!reason || reason.trim().length < 5) {
      throw new Error('A detailed justification (min 5 characters) is required for Admin Override');
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('ops_tickets')
      .update({
        status: 'Resolved',
        admin_override: true,
        admin_override_reason: reason.trim(),
        admin_override_photo_url: photoUrl || null,
        resolved_at: now,
        closure_verified_at: now
      })
      .eq('id', ticketId)
      .select(ticketSelect())
      .single();

    if (error) throw error;

    const resTicket = mapTicketRow(data);
    return resTicket;
  },

  submitTicketRating: async (ticketId: string, rating: number, tags: string[] = [], comment?: string): Promise<OpsTicket> => {
    const { data, error } = await supabase
      .from('ops_tickets')
      .update({
        rating,
        feedback_tags: tags,
        feedback_comment: comment || null,
        status: 'Closed'
      })
      .eq('id', ticketId)
      .select(ticketSelect())
      .single();

    if (error) throw error;

    const resTicket = mapTicketRow(data);
    return resTicket;
  },

  getSlaPolicies: async (entityId?: string): Promise<HelpdeskSlaPolicy[]> => {
    let query = supabase.from('helpdesk_sla_policies').select('*');
    if (entityId) {
      query = query.or(`entity_id.eq.${entityId},entity_id.is.null`);
    }
    const { data, error } = await query.order('priority', { ascending: true });
    if (error) {
      console.warn('Could not fetch helpdesk_sla_policies (table might not be seeded yet)', error);
      return [];
    }
    return toCamelCase(data || []);
  },

  saveSlaPolicy: async (policy: Partial<HelpdeskSlaPolicy>): Promise<HelpdeskSlaPolicy> => {
    const { id, createdAt, updatedAt, ...rest } = policy as any;
    let query;
    if (id) {
      query = supabase.from('helpdesk_sla_policies').update(toSnakeCase(rest)).eq('id', id);
    } else {
      query = supabase.from('helpdesk_sla_policies').upsert(toSnakeCase(rest), { onConflict: 'organization_id,entity_id,priority' });
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return toCamelCase(data);
  },

  // ==========================================================================
  // PHASE 2: ASSET PPM & EQUIPMENT REGISTER
  // ==========================================================================

  getAssets: async (entityId?: string): Promise<OpsAsset[]> => {
    const online = isOnline();
    if (!online) {
      const cached = ((await offlineDb.getCache('ops_assets')) || []) as OpsAsset[];
      return entityId ? cached.filter((a: any) => a.entityId === entityId) : cached;
    }

    try {
      let query = supabase.from('ops_assets').select('*, entity:entities(name)');
      if (entityId) {
        query = query.eq('entity_id', entityId);
      }
      const { data, error } = await query.order('asset_code', { ascending: true });
      if (error) {
        console.warn('Could not fetch ops_assets from cloud, falling back to cache', error);
        const cached = ((await offlineDb.getCache('ops_assets')) || []) as OpsAsset[];
        return entityId ? cached.filter((a: any) => a.entityId === entityId) : cached;
      }

      // Link active open work orders for each asset
      let openTickets: any[] = [];
      try {
        const { data: ticketsData } = await supabase
          .from('ops_tickets')
          .select('id, ticket_number, asset_id, status')
          .not('asset_id', 'is', null)
          .in('status', ['Open', 'In Progress', 'On Hold']);
        openTickets = ticketsData || [];
      } catch {
        // Table column may not exist yet
      }

      const ticketMap = new Map<string, any>();
      openTickets.forEach(t => {
        if (t.asset_id && !ticketMap.has(t.asset_id)) {
          ticketMap.set(t.asset_id, t);
        }
      });

      const formatted = (data || []).map((row: any) => {
        const asset = toCamelCase(row);
        asset.entityName = row.entity?.name;
        const activeTkt = ticketMap.get(asset.id);
        if (activeTkt) {
          asset.activeTicketId = activeTkt.id;
          asset.activeTicketNumber = activeTkt.ticket_number;
        }
        return asset;
      });

      // Update offline cache
      const cached = ((await offlineDb.getCache('ops_assets')) || []) as OpsAsset[];
      const otherAssets = entityId ? cached.filter((a: any) => a.entityId !== entityId) : [];
      await offlineDb.setCache('ops_assets', [...otherAssets, ...formatted]);

      return formatted;
    } catch (err) {
      console.warn('Network exception fetching ops_assets, falling back to cache:', err);
      const cached = ((await offlineDb.getCache('ops_assets')) || []) as OpsAsset[];
      return entityId ? cached.filter((a: any) => a.entityId === entityId) : cached;
    }
  },

  saveAsset: async (asset: Partial<OpsAsset>): Promise<OpsAsset> => {
    const { id, createdAt, updatedAt, entityName, activeTicketId, activeTicketNumber, ...rest } = asset as any;
    const recordId = id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'asset_' + Date.now());
    if (!rest.qrCodePayload && rest.assetCode) {
      rest.qrCodePayload = `PARADIGM-ASSET:${rest.assetCode}:${Math.floor(100000 + Math.random() * 900000)}`;
    }
    const offlineAsset: OpsAsset = {
      ...asset,
      id: recordId,
      status: asset.status || 'Operational',
      qrCodePayload: rest.qrCodePayload || `PARADIGM-ASSET:GEN:${Date.now()}`,
    } as OpsAsset;

    const online = isOnline();
    if (!online) {
      await offlineDb.addToOutbox({
        table_name: 'ops_assets',
        action: id ? 'UPDATE' : 'INSERT',
        payload: offlineAsset,
      });
      const cached = ((await offlineDb.getCache('ops_assets')) || []) as OpsAsset[];
      const updated = id ? cached.map((a: any) => a.id === id ? { ...a, ...offlineAsset } : a) : [offlineAsset, ...cached.filter((a: any) => a.id !== recordId)];
      await offlineDb.setCache('ops_assets', updated);
      return offlineAsset;
    }

    try {
      let query;
      if (id) {
        query = supabase.from('ops_assets').update(toSnakeCase(rest)).eq('id', id);
      } else {
        query = supabase.from('ops_assets').insert(toSnakeCase({ ...rest, id: recordId }));
      }
      const { data, error } = await query.select('*, entity:entities(name)').single();
      if (error) throw error;
      const saved = toCamelCase(data);
      saved.entityName = data.entity?.name;

      const cached = ((await offlineDb.getCache('ops_assets')) || []) as OpsAsset[];
      const updated = cached.some((a: any) => a.id === saved.id)
        ? cached.map((a: any) => a.id === saved.id ? saved : a)
        : [saved, ...cached];
      await offlineDb.setCache('ops_assets', updated);

      return saved;
    } catch (err: any) {
      if (/network|failed to fetch|offline|timeout/i.test(String(err?.message || err))) {
        await offlineDb.addToOutbox({
          table_name: 'ops_assets',
          action: id ? 'UPDATE' : 'INSERT',
          payload: offlineAsset,
        });
        const cached = ((await offlineDb.getCache('ops_assets')) || []) as OpsAsset[];
        const updated = id ? cached.map((a: any) => a.id === id ? { ...a, ...offlineAsset } : a) : [offlineAsset, ...cached.filter((a: any) => a.id !== recordId)];
        await offlineDb.setCache('ops_assets', updated);
        return offlineAsset;
      }
      throw err;
    }
  },

  deleteAsset: async (id: string): Promise<void> => {
    const online = isOnline();
    if (!online) {
      await offlineDb.addToOutbox({ table_name: 'ops_assets', action: 'DELETE', payload: { id } });
      const cached = ((await offlineDb.getCache('ops_assets')) || []) as OpsAsset[];
      await offlineDb.setCache('ops_assets', cached.filter((a: any) => a.id !== id));
      return;
    }

    try {
      const { error } = await supabase.from('ops_assets').delete().eq('id', id);
      if (error) throw error;
      const cached = ((await offlineDb.getCache('ops_assets')) || []) as OpsAsset[];
      await offlineDb.setCache('ops_assets', cached.filter((a: any) => a.id !== id));
    } catch (err: any) {
      if (/network|failed to fetch|offline|timeout/i.test(String(err?.message || err))) {
        await offlineDb.addToOutbox({ table_name: 'ops_assets', action: 'DELETE', payload: { id } });
        const cached = ((await offlineDb.getCache('ops_assets')) || []) as OpsAsset[];
        await offlineDb.setCache('ops_assets', cached.filter((a: any) => a.id !== id));
        return;
      }
      throw err;
    }
  },

  getAssetChecklists: async (category?: AssetCategory): Promise<AssetPpmChecklist[]> => {
    const online = isOnline();
    if (!online) {
      const cached = ((await offlineDb.getCache('ops_asset_ppm_checklists')) || []) as AssetPpmChecklist[];
      return category ? cached.filter((c: any) => c.assetCategory === category) : cached;
    }

    try {
      let query = supabase.from('ops_asset_ppm_checklists').select('*');
      if (category) {
        query = query.eq('asset_category', category);
      }
      const { data, error } = await query.order('checklist_name', { ascending: true });
      if (error) {
        console.warn('Could not fetch ops_asset_ppm_checklists from cloud, falling back to cache', error);
        const cached = ((await offlineDb.getCache('ops_asset_ppm_checklists')) || []) as AssetPpmChecklist[];
        return category ? cached.filter((c: any) => c.assetCategory === category) : cached;
      }
      const formatted = toCamelCase(data || []);
      await offlineDb.setCache('ops_asset_ppm_checklists', formatted);
      return formatted;
    } catch (err) {
      console.warn('Network exception fetching ops_asset_ppm_checklists, falling back to cache:', err);
      const cached = ((await offlineDb.getCache('ops_asset_ppm_checklists')) || []) as AssetPpmChecklist[];
      return category ? cached.filter((c: any) => c.assetCategory === category) : cached;
    }
  },

  logAssetInspection: async (log: Partial<AssetPpmLog>): Promise<AssetPpmLog> => {
    const { id, createdAt, ...rest } = log as any;
    const recordId = id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'insp_' + Date.now());
    const now = new Date().toISOString();
    const offlineLog: AssetPpmLog = {
      ...log,
      id: recordId,
      inspectedAt: log.inspectedAt || now,
      qrScanned: log.qrScanned ?? false,
      parameterReadings: log.parameterReadings || {},
      hasAbnormalities: log.hasAbnormalities ?? false,
      photoUrls: log.photoUrls || [],
    } as AssetPpmLog;

    const online = isOnline();
    if (!online) {
      await offlineDb.addToOutbox({
        table_name: 'ops_asset_ppm_logs',
        action: 'INSERT',
        payload: offlineLog,
        dependsOn: log.assetId,
      });

      const cachedLogs = ((await offlineDb.getCache('ops_asset_ppm_logs')) || []) as AssetPpmLog[];
      await offlineDb.setCache('ops_asset_ppm_logs', [offlineLog, ...cachedLogs.filter((l: any) => l.id !== recordId)]);

      // Optimistically update cached asset's lastInspectedAt and status
      if (log.assetId) {
        const cachedAssets = ((await offlineDb.getCache('ops_assets')) || []) as OpsAsset[];
        const updatedAssets = cachedAssets.map((a: any) => a.id === log.assetId ? {
          ...a,
          lastInspectedAt: offlineLog.inspectedAt,
          status: log.hasAbnormalities ? 'Critical Fault' : a.status,
        } : a);
        await offlineDb.setCache('ops_assets', updatedAssets);
      }

      return offlineLog;
    }

    try {
      const { data, error } = await supabase
        .from('ops_asset_ppm_logs')
        .insert(toSnakeCase({ ...rest, id: recordId }))
        .select()
        .single();
      if (error) throw error;

      // Update asset's last_inspected_at timestamp and status
      if (rest.assetId) {
        const assetUpdates: Record<string, any> = {
          last_inspected_at: rest.inspectedAt || now,
        };
        if (rest.hasAbnormalities) {
          assetUpdates.status = 'Critical Fault';
        }
        await supabase
          .from('ops_assets')
          .update(assetUpdates)
          .eq('id', rest.assetId);
      }

      const formatted = toCamelCase(data);
      const cachedLogs = ((await offlineDb.getCache('ops_asset_ppm_logs')) || []) as AssetPpmLog[];
      await offlineDb.setCache('ops_asset_ppm_logs', [formatted, ...cachedLogs.filter((l: any) => l.id !== recordId)]);

      return formatted;
    } catch (err: any) {
      if (/network|failed to fetch|offline|timeout/i.test(String(err?.message || err))) {
        await offlineDb.addToOutbox({
          table_name: 'ops_asset_ppm_logs',
          action: 'INSERT',
          payload: offlineLog,
          dependsOn: log.assetId,
        });

        const cachedLogs = ((await offlineDb.getCache('ops_asset_ppm_logs')) || []) as AssetPpmLog[];
        await offlineDb.setCache('ops_asset_ppm_logs', [offlineLog, ...cachedLogs.filter((l: any) => l.id !== recordId)]);

        if (log.assetId) {
          const cachedAssets = ((await offlineDb.getCache('ops_assets')) || []) as OpsAsset[];
          const updatedAssets = cachedAssets.map((a: any) => a.id === log.assetId ? {
            ...a,
            lastInspectedAt: offlineLog.inspectedAt,
            status: log.hasAbnormalities ? 'Critical Fault' : a.status,
          } : a);
          await offlineDb.setCache('ops_assets', updatedAssets);
        }

        return offlineLog;
      }
      throw err;
    }
  },

  getAssetInspectionLogs: async (assetId?: string): Promise<AssetPpmLog[]> => {
    const online = isOnline();
    if (!online) {
      const cached = ((await offlineDb.getCache('ops_asset_ppm_logs')) || []) as AssetPpmLog[];
      return assetId ? cached.filter((l: any) => l.assetId === assetId) : cached;
    }

    try {
      let query = supabase.from('ops_asset_ppm_logs').select('*');
      if (assetId) {
        query = query.eq('asset_id', assetId);
      }
      const { data, error } = await query.order('inspected_at', { ascending: false }).limit(50);
      if (error) {
        console.warn('Could not fetch ops_asset_ppm_logs from cloud, falling back to cache', error);
        const cached = ((await offlineDb.getCache('ops_asset_ppm_logs')) || []) as AssetPpmLog[];
        return assetId ? cached.filter((l: any) => l.assetId === assetId) : cached;
      }
      const formatted = toCamelCase(data || []);
      const cached = ((await offlineDb.getCache('ops_asset_ppm_logs')) || []) as AssetPpmLog[];
      const others = assetId ? cached.filter((l: any) => l.assetId !== assetId) : [];
      await offlineDb.setCache('ops_asset_ppm_logs', [...others, ...formatted]);
      return formatted;
    } catch (err) {
      console.warn('Network exception fetching ops_asset_ppm_logs, falling back to cache:', err);
      const cached = ((await offlineDb.getCache('ops_asset_ppm_logs')) || []) as AssetPpmLog[];
      return assetId ? cached.filter((l: any) => l.assetId === assetId) : cached;
    }
  },

  // ==========================================================================
  // PREVENTIVE MAINTENANCE
  // ==========================================================================

  getMaintenanceSchedules: async (entityId?: string): Promise<OpsMaintenanceSchedule[]> => {
    const online = isOnline();
    if (!online) {
      const cached = ((await offlineDb.getCache('ops_maintenance_schedules')) || []) as OpsMaintenanceSchedule[];
      return entityId ? cached.filter((s: any) => s.entityId === entityId) : cached;
    }

    try {
      let query = supabase
        .from('ops_maintenance_schedules')
        .select('*, entity:entities(name)');
        
      if (entityId) {
        query = query.eq('entity_id', entityId);
      }
      
      const { data, error } = await query.order('next_due_date', { ascending: true });
      if (error) throw error;
      
      const formatted = (data || []).map((row: any) => {
        const sched = toCamelCase(row);
        sched.entityName = row.entity?.name;
        return sched;
      });

      const cached = ((await offlineDb.getCache('ops_maintenance_schedules')) || []) as OpsMaintenanceSchedule[];
      const others = entityId ? cached.filter((s: any) => s.entityId !== entityId) : [];
      await offlineDb.setCache('ops_maintenance_schedules', [...others, ...formatted]);

      return formatted;
    } catch (err) {
      console.warn('Failed to fetch maintenance schedules, falling back to cache:', err);
      const cached = ((await offlineDb.getCache('ops_maintenance_schedules')) || []) as OpsMaintenanceSchedule[];
      return entityId ? cached.filter((s: any) => s.entityId === entityId) : cached;
    }
  },

  saveMaintenanceSchedule: async (schedule: Partial<OpsMaintenanceSchedule>): Promise<OpsMaintenanceSchedule> => {
    const { id, createdAt, updatedAt, entityName, ...rest } = schedule as any;
    const recordId = id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'sched_' + Date.now());
    const offlineSchedule: OpsMaintenanceSchedule = {
      ...schedule,
      id: recordId,
      status: schedule.status || 'Active',
      frequency: schedule.frequency || 'Monthly',
      taskName: schedule.taskName || 'Maintenance Task',
      entityId: schedule.entityId || '',
      createdAt: schedule.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as OpsMaintenanceSchedule;

    const online = isOnline();
    if (!online) {
      await offlineDb.addToOutbox({
        table_name: 'ops_maintenance_schedules',
        action: id ? 'UPDATE' : 'INSERT',
        payload: offlineSchedule,
      });
      const cached = ((await offlineDb.getCache('ops_maintenance_schedules')) || []) as OpsMaintenanceSchedule[];
      const updated = id
        ? cached.map((s: any) => s.id === id ? { ...s, ...offlineSchedule } : s)
        : [offlineSchedule, ...cached.filter((s: any) => s.id !== recordId)];
      await offlineDb.setCache('ops_maintenance_schedules', updated);
      return offlineSchedule;
    }

    try {
      let query;
      if (id) {
        query = supabase.from('ops_maintenance_schedules').update(toSnakeCase(rest)).eq('id', id);
      } else {
        query = supabase.from('ops_maintenance_schedules').insert(toSnakeCase({ ...rest, id: recordId }));
      }
      
      const { data, error } = await query.select('*, entity:entities(name)').single();
      if (error) throw error;
      
      const saved = toCamelCase(data);
      saved.entityName = data.entity?.name;

      const cached = ((await offlineDb.getCache('ops_maintenance_schedules')) || []) as OpsMaintenanceSchedule[];
      const updated = cached.some((s: any) => s.id === saved.id)
        ? cached.map((s: any) => s.id === saved.id ? saved : s)
        : [saved, ...cached];
      await offlineDb.setCache('ops_maintenance_schedules', updated);

      return saved;
    } catch (err: any) {
      if (/network|failed to fetch|offline|timeout/i.test(String(err?.message || err))) {
        await offlineDb.addToOutbox({
          table_name: 'ops_maintenance_schedules',
          action: id ? 'UPDATE' : 'INSERT',
          payload: offlineSchedule,
        });
        const cached = ((await offlineDb.getCache('ops_maintenance_schedules')) || []) as OpsMaintenanceSchedule[];
        const updated = id
          ? cached.map((s: any) => s.id === id ? { ...s, ...offlineSchedule } : s)
          : [offlineSchedule, ...cached.filter((s: any) => s.id !== recordId)];
        await offlineDb.setCache('ops_maintenance_schedules', updated);
        return offlineSchedule;
      }
      throw err;
    }
  },

  logMaintenanceCompletion: async (log: Partial<OpsMaintenanceLog>): Promise<OpsMaintenanceLog> => {
    const { id, createdAt, completedByName, ...rest } = log as any;
    const recordId = id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'mlog_' + Date.now());
    const offlineLog: OpsMaintenanceLog = {
      ...log,
      id: recordId,
      scheduleId: log.scheduleId || '',
      completedDate: log.completedDate || new Date().toISOString(),
      status: log.status || 'Completed',
      photoUrls: log.photoUrls || [],
      createdAt: log.createdAt || new Date().toISOString(),
    } as OpsMaintenanceLog;

    const online = isOnline();
    if (!online) {
      await offlineDb.addToOutbox({
        table_name: 'ops_maintenance_logs',
        action: 'INSERT',
        payload: offlineLog,
        dependsOn: log.scheduleId,
      });
      const cached = ((await offlineDb.getCache('ops_maintenance_logs')) || []) as OpsMaintenanceLog[];
      await offlineDb.setCache('ops_maintenance_logs', [offlineLog, ...cached.filter((l: any) => l.id !== recordId)]);
      return offlineLog;
    }

    try {
      const { data, error } = await supabase
        .from('ops_maintenance_logs')
        .insert(toSnakeCase({ ...rest, id: recordId }))
        .select()
        .single();
        
      if (error) throw error;
      const formatted = toCamelCase(data);

      const cached = ((await offlineDb.getCache('ops_maintenance_logs')) || []) as OpsMaintenanceLog[];
      await offlineDb.setCache('ops_maintenance_logs', [formatted, ...cached.filter((l: any) => l.id !== recordId)]);

      return formatted;
    } catch (err: any) {
      if (/network|failed to fetch|offline|timeout/i.test(String(err?.message || err))) {
        await offlineDb.addToOutbox({
          table_name: 'ops_maintenance_logs',
          action: 'INSERT',
          payload: offlineLog,
          dependsOn: log.scheduleId,
        });
        const cached = ((await offlineDb.getCache('ops_maintenance_logs')) || []) as OpsMaintenanceLog[];
        await offlineDb.setCache('ops_maintenance_logs', [offlineLog, ...cached.filter((l: any) => l.id !== recordId)]);
        return offlineLog;
      }
      throw err;
    }
  },

  // ==========================================================================
  // CONTRACTS
  // ==========================================================================

  getContracts: async (entityId?: string): Promise<OpsContract[]> => {
    let query = supabase
      .from('ops_contracts')
      .select('*, entity:entities(name)');
      
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }
    
    const { data, error } = await query.order('end_date', { ascending: true });
    if (error) throw error;
    
    return (data || []).map((row: any) => {
      const contract = toCamelCase(row);
      contract.entityName = row.entity?.name;
      return contract;
    });
  },

  saveContract: async (contract: Partial<OpsContract>): Promise<OpsContract> => {
    const { id, createdAt, updatedAt, entityName, ...rest } = contract as any;
    let query;
    
    // Auto status check based on end_date
    if (rest.endDate) {
      const end = new Date(rest.endDate);
      const today = new Date();
      const diffTime = Math.abs(end.getTime() - today.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (end < today) {
        rest.status = 'Expired';
      } else if (diffDays <= (rest.renewalReminderDays || 30)) {
        rest.status = 'Expiring Soon';
      } else {
        rest.status = 'Active';
      }
    }
    
    if (id) {
      query = supabase.from('ops_contracts').update(toSnakeCase(rest)).eq('id', id);
    } else {
      query = supabase.from('ops_contracts').insert(toSnakeCase(rest));
    }
    
    const { data, error } = await query.select('*, entity:entities(name)').single();
    if (error) throw error;
    
    const saved = toCamelCase(data);
    saved.entityName = data.entity?.name;

    // Bi-directional Linkage: Sync covered assets with AMC vendor and expiry
    if (rest.coveredAssetIds && rest.coveredAssetIds.length > 0 && rest.vendorName) {
      try {
        await supabase
          .from('ops_assets')
          .update({
            amc_vendor_name: rest.vendorName,
            amc_expiry_date: rest.endDate || null
          })
          .in('id', rest.coveredAssetIds);
      } catch (assetSyncErr) {
        console.warn('Could not sync covered assets with contract:', assetSyncErr);
      }
    }

    return saved;
  },

  deleteContract: async (id: string): Promise<void> => {
    const { error } = await supabase.from('ops_contracts').delete().eq('id', id);
    if (error) throw error;
  },

  getContractEntities: async (): Promise<Array<{ id: string; name: string; location?: string }>> => {
    const { data, error } = await supabase
      .from('entities')
      .select('id, name, location')
      .order('name', { ascending: true });
    if (error) {
      console.warn('Failed to fetch entities for contracts', error);
      return [];
    }
    return data || [];
  },

  seedDemoContracts: async (targetEntityId?: string): Promise<OpsContract[]> => {
    let entityId = targetEntityId;
    if (!entityId) {
      const { data: ent } = await supabase.from('entities').select('id').limit(1).single();
      entityId = ent?.id || 'ent_aeris_residences';
    }

    const today = new Date();
    const demoPayloads: Partial<OpsContract>[] = [
      {
        contractTitle: 'Thermax Comprehensive STP Operation & Chemical AMC',
        contractType: 'Vendor AMC',
        vendorName: 'Thermax Water Technologies Ltd',
        vendorContactPerson: 'Rajesh K. (Senior Service Engineer)',
        vendorPhone: '+91 98450 12345',
        vendorEmail: 'service.south@thermaxglobal.com',
        startDate: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
        endDate: new Date(today.getFullYear() + 1, 2, 31).toISOString().split('T')[0],
        contractValue: 420000,
        paymentFrequency: 'Quarterly',
        renewalReminderDays: 45,
        scopeOfWork: 'Monthly bacterial culture dosing, blower & pump maintenance, quarterly treated water lab testing (TNPCB/CPCB compliant).',
        slaResponseTimeHours: 2,
        slaResolutionTimeHours: 8,
        status: 'Active',
        entityId
      },
      {
        contractTitle: 'Johnson High-Speed Elevators OEM Comprehensive Maintenance',
        contractType: 'Vendor AMC',
        vendorName: 'Johnson Lifts Pvt Ltd',
        vendorContactPerson: 'Suresh Babu (AMC Account Manager)',
        vendorPhone: '+91 94440 98765',
        vendorEmail: 'amc.bangalore@johnsonlifts.com',
        startDate: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
        endDate: new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0],
        contractValue: 560000,
        paymentFrequency: 'Quarterly',
        renewalReminderDays: 60,
        scopeOfWork: 'Bi-weekly lubrication & safety brake inspection, 24/7 breakdown passenger rescue, governor speed calibration, ARD battery health checks.',
        slaResponseTimeHours: 1,
        slaResolutionTimeHours: 4,
        status: 'Active',
        entityId
      },
      {
        contractTitle: 'Cummins Silent DG Breakdown & Preventive Care',
        contractType: 'Vendor AMC',
        vendorName: 'Cummins India Technical Services',
        vendorContactPerson: 'Venkatesh Murthy',
        vendorPhone: '+91 98860 55443',
        vendorEmail: 'cummins.care@cummins.com',
        startDate: new Date(today.getFullYear() - 1, 4, 15).toISOString().split('T')[0],
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 18).toISOString().split('T')[0],
        contractValue: 280000,
        paymentFrequency: 'Half-Yearly',
        renewalReminderDays: 30,
        scopeOfWork: 'B-check & C-check engine servicing, radiator flushing, governor calibration, auto-mains failure (AMF) panel sync testing.',
        slaResponseTimeHours: 2,
        slaResolutionTimeHours: 6,
        status: 'Expiring Soon',
        entityId
      },
      {
        contractTitle: 'Comprehensive Integrated Facility Management (IFM) Agreement',
        contractType: 'Client Agreement',
        vendorName: 'Paradigm Integrated Field Services',
        vendorContactPerson: 'Operations Lead',
        vendorPhone: '+91 80 4000 9000',
        vendorEmail: 'ops@paradigmservices.com',
        startDate: new Date(today.getFullYear(), 3, 1).toISOString().split('T')[0],
        endDate: new Date(today.getFullYear() + 1, 2, 31).toISOString().split('T')[0],
        contractValue: 2450000,
        paymentFrequency: 'Monthly',
        renewalReminderDays: 60,
        scopeOfWork: 'Turnkey facility management covering 24/7 MEP engineering, technical supervision, common area maintenance, and resident helpdesk operations.',
        slaResponseTimeHours: 1,
        slaResolutionTimeHours: 12,
        status: 'Active',
        entityId
      }
    ];

    const results: OpsContract[] = [];
    for (const item of demoPayloads) {
      const created = await opsApi.saveContract(item);
      results.push(created);
    }
    return results;
  },

  // ==========================================================================
  // SNAG AUDITS
  // ==========================================================================

  /**
   * Merge local outbox/IDB entries that haven't been synced yet into the
   * server list so they remain visible while sync is pending, in-flight, or
   * failed. Uses getAll() (not getPending()) so 'syncing' and 'failed' items
   * are never invisible.
   */
  getSnagEntries: async (): Promise<SnagEntry[]> => {
    const mergeWithOutbox = async (baseEntries: SnagEntry[]): Promise<SnagEntry[]> => {
      try {
        const outboxItems = await outbox.getForTable('snag_audits');
        if (!outboxItems || outboxItems.length === 0) return baseEntries;

        const outboxMap = new Map<string, any>();
        outboxItems.forEach(item => outboxMap.set(item.id, item));

        const baseMap = new Map<string, SnagEntry>();
        baseEntries.forEach(e => baseMap.set(e.id, e));

        // Incorporate outbox items
        for (const [id, item] of outboxMap.entries()) {
          if (item.action === 'DELETE') {
            baseMap.delete(id);
            continue;
          }
          if (item.payload) {
            const camelPayload = toCamelCase(item.payload) as SnagEntry;
            (camelPayload as any).outboxStatus = item.status;
            (camelPayload as any).pending = item.status === 'pending' || item.status === 'syncing';
            (camelPayload as any).failed = item.status === 'failed';
            (camelPayload as any).conflict = item.status === 'conflict';
            baseMap.set(id, camelPayload);
          }
        }

        // Annotate any existing entries matching outbox
        for (const [id, entry] of baseMap.entries()) {
          if (outboxMap.has(id)) {
            const item = outboxMap.get(id);
            (entry as any).outboxStatus = item.status;
            (entry as any).pending = item.status === 'pending' || item.status === 'syncing';
            (entry as any).failed = item.status === 'failed';
            (entry as any).conflict = item.status === 'conflict';
          }
        }

        return Array.from(baseMap.values()).sort(
          (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
        );
      } catch (err) {
        console.warn('[opsApi] mergeWithOutbox error:', err);
        return baseEntries;
      }
    };

    if (!isOnline()) {
      const cached = await cache.getAll<SnagEntry>('snag_audits');
      const normalized = cached.map((c: any) => toCamelCase(c) as SnagEntry);
      return await mergeWithOutbox(normalized);
    }

    try {
      const { data, error } = await supabase
        .from('snag_audits')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      const entries = (data || []).map((row: any) => toCamelCase(row) as SnagEntry);
      await cache.putServerRecords('snag_audits', entries);
      return await mergeWithOutbox(entries);
    } catch (fetchErr) {
      console.warn('[opsApi] Online fetch snag_audits failed, falling back to IDB cache:', fetchErr);
      const cached = await cache.getAll<SnagEntry>('snag_audits');
      const normalized = cached.map((c: any) => toCamelCase(c) as SnagEntry);
      return await mergeWithOutbox(normalized);
    }
  },

  saveSnagEntry: async (entry: Partial<SnagEntry>, fileToUpload?: File): Promise<SnagEntry & { saveResult?: 'synced' | 'queued' }> => {
    const isExisting = Boolean(entry.id && !entry.id.startsWith('snag-') && !entry.id.startsWith('sample-'));
    const recordId = isExisting ? (entry.id as string) : crypto.randomUUID();
    const currentUser = useAuthStore.getState().user;
    const now = new Date().toISOString();

    const snagRecord: SnagEntry = {
      ...entry,
      id: recordId,
      timestamp: entry.timestamp || now,
      createdAt: entry.createdAt || now,
      updatedAt: now,
      submittedBy: entry.submittedBy || currentUser?.name || 'Staff',
      emailAddress: entry.emailAddress || currentUser?.email || '',
      criticality: entry.criticality || 'Medium',
      status: entry.status || 'Open',
      snagDescription: entry.snagDescription || '',
      actionToBeTaken: entry.actionToBeTaken || '',
      remarks: entry.remarks || '',
      nameOfSite: entry.nameOfSite || '',
      purposeOfVisit: entry.purposeOfVisit || [],
      department: entry.department || [],
      snagPictureName: fileToUpload?.name ?? entry.snagPictureName ?? '',
      snagPictureUrl: entry.snagPictureUrl || '',
    };

    const attachments = fileToUpload
      ? [
          {
            blob: fileToUpload,
            payloadPath: 'snag_picture_url',
            key: 'snag_photo',
          },
        ]
      : [];

    const saveResult = await saveOfflineAware({
      table: 'snag_audits',
      record: snagRecord,
      attachments,
      baseUpdatedAt: entry.updatedAt,
      onlineSave: async (cleanRecord) => {
        let pictureUrl = cleanRecord.snagPictureUrl;
        let pictureName = cleanRecord.snagPictureName;

        if (fileToUpload) {
          const uploadResult = await api.uploadDocument(fileToUpload, 'onboarding-documents');
          pictureUrl = uploadResult.url;
          pictureName = fileToUpload.name;
        }

        const payload = {
          ...cleanRecord,
          snagPictureUrl: pictureUrl,
          snagPictureName: pictureName,
        };

        const { id, createdAt, updatedAt, ...rest } = payload as any;
        let query;
        if (isExisting) {
          query = supabase.from('snag_audits').update(toSnakeCase(rest)).eq('id', id);
        } else {
          query = supabase.from('snag_audits').insert({ id, ...toSnakeCase(rest) });
        }

        const res = await query.select('*').single();
        unwrap(res);
      },
    });

    // Notify managers on critical snag if online save succeeded
    if (saveResult === 'synced' && snagRecord.criticality === 'High') {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: submittingUser } = await supabase
            .from('users')
            .select('reporting_manager_id, reporting_manager_2_id, reporting_manager_3_id')
            .eq('id', user.id)
            .single();

          if (submittingUser) {
            const managers = [
              submittingUser.reporting_manager_id,
              submittingUser.reporting_manager_2_id,
              submittingUser.reporting_manager_3_id,
            ].filter(Boolean) as string[];

            for (const managerId of managers) {
              await api.createNotification({
                userId: managerId,
                message: `Critical Snag: "${snagRecord.snagDescription}" reported at "${snagRecord.nameOfSite}" by ${snagRecord.submittedBy || 'staff'}.`,
                type: 'warning',
                severity: 'High',
                linkTo: '/operations/snag-audit',
                metadata: { snagId: snagRecord.id },
              });
            }
          }
        }
      } catch (notifyErr) {
        console.warn('[opsApi] Failed to trigger critical snag notification:', notifyErr);
      }
    }

    return {
      ...snagRecord,
      saveResult,
      pending: saveResult === 'queued',
    } as SnagEntry & { saveResult?: 'synced' | 'queued' };
  },

  deleteSnagEntry: async (id: string): Promise<void> => {
    // 1. Remove from local cache immediately
    await cache.del('snag_audits', id);
    deleteSnagEntryFromCache(id).catch(() => {});

    // 2. Remove from outbox if pending
    await outbox.removeForRecord('snag_audits', id);

    // 3. If online, try online deletion
    if (isOnline()) {
      try {
        const { error } = await supabase.from('snag_audits').delete().eq('id', id);
        if (error) throw error;
        return;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    // 4. If offline or network drop, enqueue DELETE
    await outbox.enqueue({
      id,
      tableName: 'snag_audits',
      action: 'DELETE',
      payload: { id },
      schemaVersion: 1,
      userId: getCurrentUserId() || 'anonymous',
      capturedAt: new Date().toISOString(),
    });
  },

  updateSnagStatus: async (id: string, status: SnagEntry['status']): Promise<void> => {
    let existing = await cache.get<SnagEntry>('snag_audits', id);
    if (!existing) {
      const cached = await cache.getCachedSnagEntries();
      existing = cached.find((c: any) => c.id === id);
    }
    const now = new Date().toISOString();
    const updatedRecord: SnagEntry = existing
      ? { ...existing, status, updatedAt: now }
      : ({ id, status, updatedAt: now } as any);

    await saveOfflineAware({
      table: 'snag_audits',
      record: updatedRecord,
      baseUpdatedAt: existing?.updatedAt,
      onlineSave: async () => {
        const res = await supabase.from('snag_audits').update({ status }).eq('id', id);
        unwrap(res);
      },
    });
  }
};
