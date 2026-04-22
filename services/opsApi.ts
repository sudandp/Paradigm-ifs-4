import { supabase } from './supabase';
import type { 
  OpsTicket, 
  OpsMaintenanceSchedule, 
  OpsMaintenanceLog, 
  OpsContract,
  TicketPriority
} from '../types/operations';

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
  }
};
