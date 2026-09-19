import { supabase } from './supabase';
import { api } from './api';
import { useAuthStore } from '../store/authStore';
import type { 
  OpsTicket, 
  OpsMaintenanceSchedule, 
  OpsMaintenanceLog, 
  OpsContract,
  TicketPriority,
  SnagEntry
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

// Calculate Due Date based on SLA Priority
const calculateDueDate = (priority: TicketPriority): string => {
  const now = new Date();
  switch (priority) {
    case 'P1': now.setHours(now.getHours() + 2); break; // 2 hours
    case 'P2': now.setHours(now.getHours() + 4); break; // 4 hours
    case 'P3': now.setHours(now.getHours() + 24); break; // 24 hours
    case 'P4': now.setHours(now.getHours() + 48); break; // 48 hours
  }
  return now.toISOString();
};

export const opsApi = {

  // ==========================================================================
  // TICKETS
  // ==========================================================================

  getTickets: async (entityId?: string): Promise<OpsTicket[]> => {
    let query = supabase
      .from('ops_tickets')
      .select('*, entity:entities(name), assignee:assigned_to(name)');
    
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    
    return (data || []).map((row: any) => {
      const ticket = toCamelCase(row);
      ticket.entityName = row.entity?.name;
      ticket.assignedToName = row.assignee?.name;
      return ticket;
    });
  },

  saveTicket: async (ticket: Partial<OpsTicket>): Promise<OpsTicket> => {
    const { id, createdAt, updatedAt, entityName, assignedToName, createdByName, ...rest } = ticket as any;
    
    // Auto calculate due date if it's a new ticket
    if (!id && rest.priority && !rest.dueDate) {
      rest.dueDate = calculateDueDate(rest.priority);
    }
    
    let query;
    if (id) {
      query = supabase.from('ops_tickets').update(toSnakeCase(rest)).eq('id', id);
    } else {
      // Generate a ticket number if new
      if (!rest.ticketNumber) {
        rest.ticketNumber = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
      }
      query = supabase.from('ops_tickets').insert(toSnakeCase(rest));
    }
    
    const { data, error } = await query.select('*, entity:entities(name), assignee:assigned_to(name)').single();
    if (error) throw error;
    
    const saved = toCamelCase(data);
    saved.entityName = data.entity?.name;
    saved.assignedToName = data.assignee?.name;
    return saved;
  },

  deleteTicket: async (id: string): Promise<void> => {
    const { error } = await supabase.from('ops_tickets').delete().eq('id', id);
    if (error) throw error;
  },

  // ==========================================================================
  // PREVENTIVE MAINTENANCE
  // ==========================================================================

  getMaintenanceSchedules: async (entityId?: string): Promise<OpsMaintenanceSchedule[]> => {
    let query = supabase
      .from('ops_maintenance_schedules')
      .select('*, entity:entities(name)');
      
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }
    
    const { data, error } = await query.order('next_due_date', { ascending: true });
    if (error) throw error;
    
    return (data || []).map((row: any) => {
      const sched = toCamelCase(row);
      sched.entityName = row.entity?.name;
      return sched;
    });
  },

  saveMaintenanceSchedule: async (schedule: Partial<OpsMaintenanceSchedule>): Promise<OpsMaintenanceSchedule> => {
    const { id, createdAt, updatedAt, entityName, ...rest } = schedule as any;
    let query;
    
    if (id) {
      query = supabase.from('ops_maintenance_schedules').update(toSnakeCase(rest)).eq('id', id);
    } else {
      query = supabase.from('ops_maintenance_schedules').insert(toSnakeCase(rest));
    }
    
    const { data, error } = await query.select('*, entity:entities(name)').single();
    if (error) throw error;
    
    const saved = toCamelCase(data);
    saved.entityName = data.entity?.name;
    return saved;
  },

  logMaintenanceCompletion: async (log: Partial<OpsMaintenanceLog>): Promise<OpsMaintenanceLog> => {
    const { id, createdAt, completedByName, ...rest } = log as any;
    
    const { data, error } = await supabase
      .from('ops_maintenance_logs')
      .insert(toSnakeCase(rest))
      .select()
      .single();
      
    if (error) throw error;
    return toCamelCase(data);
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
    return saved;
  },

  deleteContract: async (id: string): Promise<void> => {
    const { error } = await supabase.from('ops_contracts').delete().eq('id', id);
    if (error) throw error;
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
      return await mergeWithOutbox(cached);
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
      return await mergeWithOutbox(cached);
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
