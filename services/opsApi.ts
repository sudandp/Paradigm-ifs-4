import { supabase } from './supabase';
import { api } from './api';
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
import { enqueue, storePhoto, cancelPendingInsert } from './offline/outbox';
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

  getSnagEntries: async (): Promise<SnagEntry[]> => {
    // ── Offline path ──────────────────────────────────────────────────────────
    if (isOfflineEnabled() && !isOnline()) {
      const cached = await getCachedSnagEntries();
      return cached.map((row) => toCamelCase(row) as SnagEntry);
    }
    // ── Online path (unchanged) ───────────────────────────────────────────────
    const { data, error } = await supabase
      .from('snag_audits')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    const entries = (data || []).map((row: any) => toCamelCase(row) as SnagEntry);
    // Write-through: update local cache after every successful online fetch
    cacheSnagEntries(entries).catch(() => {});
    return entries;
  },

  saveSnagEntry: async (entry: Partial<SnagEntry>, fileToUpload?: File): Promise<SnagEntry> => {
    // ── Offline path ──────────────────────────────────────────────────────────
    if (isOfflineEnabled() && !isOnline()) {
      const localId = (entry.id && !entry.id.startsWith('snag-') && !entry.id.startsWith('sample-'))
        ? entry.id
        : crypto.randomUUID();

      // Store photo blob in IDB for later upload
      let photoId: string | undefined;
      if (fileToUpload) {
        try {
          photoId = await storePhoto(fileToUpload, fileToUpload.name, localId);
        } catch (photoErr) {
          console.warn('[opsApi] Failed to store photo blob offline:', photoErr);
        }
      }

      const now = new Date().toISOString();
      const offlineEntry: SnagEntry = {
        ...entry,
        id: localId,
        timestamp: entry.timestamp || now,
        createdAt: entry.createdAt || now,
        updatedAt: now,
        // Photo URL unknown until sync — leave as existing or undefined
        snagPictureUrl: entry.snagPictureUrl,
        snagPictureName: fileToUpload?.name ?? entry.snagPictureName,
      } as SnagEntry;

      const snakePayload = toSnakeCase(offlineEntry) as Record<string, unknown>;

      // Write to local IDB mirror for immediate UI display
      await cacheSnagEntry(offlineEntry);

      // Enqueue to outbox for sync on reconnect
      await enqueue({
        id: localId,
        tableName: 'snag_audits',
        action: entry.id && !entry.id.startsWith('snag-') && !entry.id.startsWith('sample-')
          ? 'UPDATE'
          : 'INSERT',
        payload: snakePayload,
        photoId,
      });

      console.log(`[opsApi] Snag entry queued offline (id=${localId})`);
      // Return same shape as online — pending:true signals a badge in the UI
      return { ...offlineEntry, pending: true } as SnagEntry & { pending: boolean };
    }

    // ── Online path (completely unchanged) ────────────────────────────────────
    let pictureUrl = entry.snagPictureUrl;
    let pictureName = entry.snagPictureName;

    // Upload picture to storage if present
    if (fileToUpload) {
      try {
        const uploadResult = await api.uploadDocument(fileToUpload, 'documents');
        pictureUrl = uploadResult.url;
        pictureName = fileToUpload.name;
      } catch (err) {
        console.error('Failed to upload snag picture to cloud:', err);
      }
    }

    const snagData = {
      ...entry,
      snagPictureUrl: pictureUrl,
      snagPictureName: pictureName
    };

    const { id, createdAt, updatedAt, ...rest } = snagData as any;
    let query;

    if (id && !id.startsWith('snag-') && !id.startsWith('sample-')) {
      query = supabase.from('snag_audits').update(toSnakeCase(rest)).eq('id', id);
    } else {
      const { id: _, ...insertRest } = rest;
      query = supabase.from('snag_audits').insert(toSnakeCase(insertRest));
    }

    const { data, error } = await query.select('*').single();
    if (error) {
      console.error('Supabase saveSnagEntry error details:', error);
      throw error;
    }

    const saved = toCamelCase(data) as SnagEntry;

    // Cache the saved entry locally for offline reads
    cacheSnagEntry(saved).catch(() => {});

    // Trigger critical notifications to all managers if criticality is High
    if (saved.criticality === 'High') {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: submittingUser, error: userFetchError } = await supabase
            .from('users')
            .select('reporting_manager_id, reporting_manager_2_id, reporting_manager_3_id')
            .eq('id', user.id)
            .single();

          if (submittingUser && !userFetchError) {
            const managers = [
              submittingUser.reporting_manager_id,
              submittingUser.reporting_manager_2_id,
              submittingUser.reporting_manager_3_id
            ].filter(Boolean) as string[];

            for (const managerId of managers) {
              await api.createNotification({
                userId: managerId,
                message: `Critical Snag: "${saved.snagDescription}" reported at "${saved.nameOfSite}" by ${saved.submittedBy || 'staff'}.`,
                type: 'warning',
                severity: 'High',
                linkTo: '/operations/snag-audit',
                metadata: { snagId: saved.id }
              });
            }
          }
        }
      } catch (notifyErr) {
        console.error('Failed to trigger critical snag notification to managers:', notifyErr);
      }
    }

    return saved;
  },

  deleteSnagEntry: async (id: string): Promise<void> => {
    // Offline path: queue the DELETE for sync, remove from IDB immediately
    // so the withdrawn record cannot reappear in the offline list.
    // Compliance note: this closes the gap where an admin deletes a snag
    // while an auditor's device is offline — the delete propagates on reconnect.
    if (isOfflineEnabled() && !isOnline()) {
      // Remove from local IDB immediately so it cannot reappear in the offline list
      await deleteSnagEntryFromCache(id);

      // Edge case: record was created offline and deleted offline before it ever synced.
      // The server has never seen this ID — sending a DELETE would be a no-op at best
      // or a permission error at worst. Cancel the pending INSERT instead.
      const wasCancelledLocally = await cancelPendingInsert(id);
      if (!wasCancelledLocally) {
        // Record has been synced before — safe to enqueue a DELETE for propagation
        await enqueue({ id, tableName: 'snag_audits', action: 'DELETE', payload: { id } });
      }
      return;
    }

    const { error } = await supabase.from('snag_audits').delete().eq('id', id);
    if (error) throw error;
    // Mirror delete to IDB — prevents withdrawn records from reappearing offline
    deleteSnagEntryFromCache(id).catch((e) =>
      console.warn('[Offline] IDB delete mirror failed for snag', id, e)
    );
  },

  updateSnagStatus: async (id: string, status: SnagEntry['status']): Promise<void> => {
    const { error } = await supabase.from('snag_audits').update({ status }).eq('id', id);
    if (error) throw error;
  }
};
