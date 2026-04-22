import { supabase } from './supabase';
import type { SystemAuditLog, OpsApprovalRequest } from '../types/enterprise';

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

export const enterpriseApi = {

  // ==========================================================================
  // AUDIT LOGS
  // ==========================================================================

  getAuditLogs: async (moduleName?: string, recordId?: string, limit = 100): Promise<SystemAuditLog[]> => {
    let query = supabase
      .from('system_audit_logs')
      .select('*, user:user_id(name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (moduleName) query = query.eq('module_name', moduleName);
    if (recordId) query = query.eq('record_id', recordId);
    
    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map((row: any) => {
      const log = toCamelCase(row);
      log.userName = row.user?.name;
      log.userEmail = row.user?.email;
      return log;
    });
  },

  // ==========================================================================
  // APPROVAL REQUESTS
  // ==========================================================================

  getApprovalRequests: async (requiredRole?: string, status?: string): Promise<OpsApprovalRequest[]> => {
    let query = supabase
      .from('ops_approval_requests')
      .select(`
        *, 
        entity:entities(name), 
        requester:requested_by(name),
        approver:approver_id(name)
      `)
      .order('created_at', { ascending: false });
      
    if (requiredRole) query = query.eq('required_role', requiredRole);
    if (status) query = query.eq('status', status);
    
    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map((row: any) => {
      const req = toCamelCase(row);
      req.entityName = row.entity?.name;
      req.requestedByName = row.requester?.name;
      req.approverName = row.approver?.name;
      return req;
    });
  },

  submitForApproval: async (request: Partial<OpsApprovalRequest>): Promise<OpsApprovalRequest> => {
    const { data, error } = await supabase
      .from('ops_approval_requests')
      .insert(toSnakeCase({ ...request, status: 'Pending' }))
      .select()
      .single();
      
    if (error) throw error;
    return toCamelCase(data);
  },

  processApproval: async (id: string, approverId: string, status: 'Approved'|'Rejected', comments?: string): Promise<OpsApprovalRequest> => {
    const { data, error } = await supabase
      .from('ops_approval_requests')
      .update(toSnakeCase({ status, approverId, comments }))
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    return toCamelCase(data);
  }
};
