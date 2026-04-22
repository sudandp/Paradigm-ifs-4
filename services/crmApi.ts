import { supabase } from './supabase';
import type {
  CrmLead, CrmFollowup, CrmChecklistTemplate, CrmChecklistSubmission,
  CrmStatutoryMaster, CrmQuotation, AuditLog, ManpowerSuggestionInput,
  ManpowerSuggestionOutput, LeadStatus, ManpowerRole
} from '../types/crm';

// ============================================================================
// Helpers (reuse pattern from api.ts)
// ============================================================================

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

// ============================================================================
// CRM API Service
// ============================================================================

export const crmApi = {

  // -------------------------------------------------------------------------
  // LEADS
  // -------------------------------------------------------------------------

  getLeads: async (): Promise<CrmLead[]> => {
    // Plain select — no FK joins (auth.users has no 'name' column)
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Enrich with user names from public.users
    const rows = data || [];
    const userIds = [...new Set(rows.flatMap(r => [r.assigned_to, r.created_by].filter(Boolean)))];
    let userMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name')
        .in('id', userIds);
      if (users) {
        userMap = Object.fromEntries(users.map(u => [u.id, u.name]));
      }
    }

    return rows.map((row: any) => {
      const lead = toCamelCase(row);
      lead.assignedToName = userMap[row.assigned_to] || null;
      lead.createdByName = userMap[row.created_by] || null;
      return lead;
    });
  },

  getLeadById: async (id: string): Promise<CrmLead | null> => {
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    const lead = toCamelCase(data);
    // Enrich assignee name
    if (data.assigned_to) {
      const { data: user } = await supabase.from('users').select('name').eq('id', data.assigned_to).single();
      lead.assignedToName = user?.name || null;
    }
    return lead;
  },

  createLead: async (lead: Partial<CrmLead>): Promise<CrmLead> => {
    const { id, createdAt, updatedAt, assignedToName, createdByName, ...rest } = lead as any;
    
    // Auto-inject organization_id and created_by if missing
    if (!rest.organization_id || !rest.created_by) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (!rest.created_by) rest.created_by = session.user.id;
        if (!rest.organization_id) {
          const { data: profile } = await supabase.from('users').select('organization_id').eq('id', session.user.id).single();
          if (profile?.organization_id) rest.organization_id = profile.organization_id;
        }
      }
    }

    const { data, error } = await supabase
      .from('crm_leads')
      .insert(toSnakeCase(rest))
      .select()
      .single();
    if (error) throw error;
    
    // Audit log
    await crmApi.createAuditLog('crm', data.id, 'create', null, data, 'Lead initialized in pipeline');
    
    return toCamelCase(data);
  },

  updateLead: async (id: string, updates: Partial<CrmLead>): Promise<CrmLead> => {
    // Fetch old value for audit
    const { data: oldData } = await supabase.from('crm_leads').select('*').eq('id', id).single();
    
    const { createdAt, updatedAt, assignedToName, createdByName, ...rest } = updates as any;
    const { data, error } = await supabase
      .from('crm_leads')
      .update(toSnakeCase(rest))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    // Audit log
    await crmApi.createAuditLog('crm', id, 'update', oldData, data, 'Lead updated');
    
    return toCamelCase(data);
  },

  updateLeadStatus: async (id: string, status: LeadStatus): Promise<CrmLead> => {
    const { data: oldData, error: fetchError } = await supabase.from('crm_leads').select('status').eq('id', id).single();
    if (fetchError) throw fetchError;
    
    const { data, error } = await supabase
      .from('crm_leads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    await crmApi.createAuditLog('crm', id, 'status_change', 
      { status: oldData?.status }, 
      { status }, 
      `Pipeline Transition: ${oldData?.status} → ${status}`
    );
    
    return toCamelCase(data);
  },

  deleteLead: async (id: string): Promise<void> => {
    const { error } = await supabase.from('crm_leads').delete().eq('id', id);
    if (error) throw error;
    await crmApi.createAuditLog('crm', id, 'delete', null, null, 'Lead deleted');
  },

  // -------------------------------------------------------------------------
  // FOLLOW-UPS
  // -------------------------------------------------------------------------

  getFollowups: async (leadId: string): Promise<CrmFollowup[]> => {
    const { data, error } = await supabase
      .from('crm_followups')
      .select('*, creator:created_by(name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => {
      const fu = toCamelCase(row);
      fu.createdByName = row.creator?.name || null;
      return fu;
    });
  },

  createFollowup: async (followup: Partial<CrmFollowup>): Promise<CrmFollowup> => {
    const { id, createdAt, createdByName, ...rest } = followup as any;
    const { data, error } = await supabase
      .from('crm_followups')
      .insert(toSnakeCase(rest))
      .select()
      .single();
    if (error) throw error;
    return toCamelCase(data);
  },

  // -------------------------------------------------------------------------
  // CHECKLIST TEMPLATES
  // -------------------------------------------------------------------------

  getChecklistTemplates: async (): Promise<CrmChecklistTemplate[]> => {
    const { data, error } = await supabase
      .from('crm_checklist_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  saveChecklistTemplate: async (template: Partial<CrmChecklistTemplate>): Promise<CrmChecklistTemplate> => {
    const { id, createdAt, updatedAt, ...rest } = template as any;
    let query;
    if (id) {
      query = supabase.from('crm_checklist_templates').update(toSnakeCase(rest)).eq('id', id);
    } else {
      query = supabase.from('crm_checklist_templates').insert(toSnakeCase(rest));
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return toCamelCase(data);
  },

  deleteChecklistTemplate: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('crm_checklist_templates')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  },

  // -------------------------------------------------------------------------
  // CHECKLIST SUBMISSIONS
  // -------------------------------------------------------------------------

  getChecklistSubmission: async (leadId: string): Promise<CrmChecklistSubmission | null> => {
    const { data, error } = await supabase
      .from('crm_checklist_submissions')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toCamelCase(data) : null;
  },

  saveChecklistSubmission: async (submission: Partial<CrmChecklistSubmission>): Promise<CrmChecklistSubmission> => {
    const { id, createdAt, updatedAt, ...rest } = submission as any;
    let query;
    if (id) {
      query = supabase.from('crm_checklist_submissions').update(toSnakeCase(rest)).eq('id', id);
    } else {
      query = supabase.from('crm_checklist_submissions').insert(toSnakeCase(rest));
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return toCamelCase(data);
  },

  // -------------------------------------------------------------------------
  // STATUTORY MASTERS
  // -------------------------------------------------------------------------

  getStatutoryMasters: async (): Promise<CrmStatutoryMaster[]> => {
    const { data, error } = await supabase
      .from('crm_statutory_masters')
      .select('*')
      .order('state');
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  saveStatutoryMaster: async (master: Partial<CrmStatutoryMaster>): Promise<CrmStatutoryMaster> => {
    const { id, createdAt, updatedAt, ...rest } = master as any;
    let query;
    if (id) {
      query = supabase.from('crm_statutory_masters').update(toSnakeCase(rest)).eq('id', id);
    } else {
      query = supabase.from('crm_statutory_masters').insert(toSnakeCase(rest));
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return toCamelCase(data);
  },

  // -------------------------------------------------------------------------
  // QUOTATIONS
  // -------------------------------------------------------------------------

  getQuotations: async (leadId?: string): Promise<CrmQuotation[]> => {
    let query = supabase.from('crm_quotations').select('*');
    if (leadId) query = query.eq('lead_id', leadId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  saveQuotation: async (quotation: Partial<CrmQuotation>): Promise<CrmQuotation> => {
    const { id, createdAt, updatedAt, ...rest } = quotation as any;
    let query;
    if (id) {
      query = supabase.from('crm_quotations').update(toSnakeCase(rest)).eq('id', id);
    } else {
      query = supabase.from('crm_quotations').insert(toSnakeCase(rest));
    }
    const { data, error } = await query.select().single();
    if (error) throw error;
    return toCamelCase(data);
  },

  // -------------------------------------------------------------------------
  // AUDIT LOGS
  // -------------------------------------------------------------------------

  createAuditLog: async (
    module: string,
    recordId: string,
    action: string,
    oldValue: any,
    newValue: any,
    description?: string
  ): Promise<void> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('audit_logs').insert({
        user_id: session?.user?.id,
        user_name: session?.user?.user_metadata?.name || session?.user?.email,
        module,
        record_id: recordId,
        action,
        old_value: oldValue,
        new_value: newValue,
        description,
      });
    } catch (e) {
      console.warn('[CRM Audit] Failed to create audit log:', e);
    }
  },

  getAuditLogs: async (module?: string, recordId?: string): Promise<AuditLog[]> => {
    let query = supabase.from('audit_logs').select('*');
    if (module) query = query.eq('module', module);
    if (recordId) query = query.eq('record_id', recordId);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return (data || []).map(toCamelCase);
  },

  // -------------------------------------------------------------------------
  // MANPOWER SUGGESTION ALGORITHM
  // -------------------------------------------------------------------------

  suggestManpower: (input: ManpowerSuggestionInput): ManpowerSuggestionOutput[] => {
    const { areaSqft, unitCount, towerCount, floorCount, propertyType, hasSwimmingPool, hasStp, hasClubHouse } = input;
    const suggestions: ManpowerSuggestionOutput[] = [];

    // Manager: 1 per property (large properties get 1 extra)
    suggestions.push({
      role: 'Manager',
      suggestedCount: unitCount > 500 ? 2 : 1,
      rationale: unitCount > 500 ? '2 managers for 500+ units' : '1 manager per property',
    });

    // Admin/Helpdesk: 1 per 200 units
    const adminCount = Math.max(1, Math.ceil(unitCount / 200));
    suggestions.push({ role: 'Admin', suggestedCount: adminCount, rationale: `1 per 200 units` });
    suggestions.push({ role: 'Helpdesk', suggestedCount: adminCount, rationale: `1 per 200 units` });

    // Housekeeping: 1 per 15,000 sqft
    const hkStaff = Math.max(2, Math.ceil(areaSqft / 15000));
    const hkSupervisor = Math.max(1, Math.ceil(hkStaff / 8));
    suggestions.push({ role: 'Housekeeping Staff', suggestedCount: hkStaff, rationale: `1 per 15,000 sqft` });
    suggestions.push({ role: 'Housekeeping Supervisor', suggestedCount: hkSupervisor, rationale: `1 per 8 HK staff` });

    // Security: 2 per tower entry (24/7 = 3 shifts)
    const guardCount = Math.max(4, towerCount * 2 * 3);
    suggestions.push({ role: 'Male Guard', suggestedCount: Math.ceil(guardCount * 0.7), rationale: '70% of total guards' });
    suggestions.push({ role: 'Female Guard', suggestedCount: Math.ceil(guardCount * 0.3), rationale: '30% of total guards' });
    suggestions.push({ role: 'Head Guard', suggestedCount: Math.max(1, Math.ceil(guardCount / 15)), rationale: '1 per 15 guards' });
    suggestions.push({ role: 'Security Supervisor', suggestedCount: Math.max(1, Math.ceil(guardCount / 20)), rationale: '1 per 20 guards' });
    suggestions.push({ role: 'Security Officer', suggestedCount: 1, rationale: '1 per property' });

    // Technicians: 1 electrician per 3 floors, 1 plumber per 5 floors
    suggestions.push({ role: 'Electrician', suggestedCount: Math.max(1, Math.ceil(floorCount / 3)), rationale: '1 per 3 floors' });
    suggestions.push({ role: 'Plumber', suggestedCount: Math.max(1, Math.ceil(floorCount / 5)), rationale: '1 per 5 floors' });
    suggestions.push({ role: 'Technician', suggestedCount: Math.max(1, Math.ceil(floorCount / 4)), rationale: '1 per 4 floors' });

    // Gardener: 1 per 20,000 sqft
    suggestions.push({ role: 'Gardener', suggestedCount: Math.max(1, Math.ceil(areaSqft / 20000)), rationale: '1 per 20,000 sqft' });

    // STP Operator: Only if STP exists
    if (hasStp) {
      suggestions.push({ role: 'STP Operator', suggestedCount: 2, rationale: 'STP requires 2 operators (day/night)' });
    }

    return suggestions;
  },
};
