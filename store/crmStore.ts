import { create } from 'zustand';
import { crmApi } from '../services/crmApi';
import type { CrmLead, CrmFollowup, CrmChecklistTemplate, CrmChecklistSubmission, CrmQuotation, LeadStatus } from '../types/crm';

interface CrmState {
  // Data
  leads: CrmLead[];
  followups: Record<string, CrmFollowup[]>; // keyed by leadId
  templates: CrmChecklistTemplate[];
  quotations: CrmQuotation[];
  submissions: Record<string, CrmChecklistSubmission | null>; // keyed by leadId

  // UI State
  isLoading: boolean;
  error: string | null;
  selectedLeadId: string | null;
  kanbanFilter: 'all' | 'mine';
  searchQuery: string;

  // Actions
  fetchLeads: () => Promise<void>;
  createLead: (lead: Partial<CrmLead>) => Promise<CrmLead>;
  updateLead: (id: string, updates: Partial<CrmLead>) => Promise<CrmLead>;
  updateLeadStatus: (id: string, status: LeadStatus) => Promise<CrmLead>;
  deleteLead: (id: string) => Promise<void>;

  fetchFollowups: (leadId: string) => Promise<void>;
  createFollowup: (followup: Partial<CrmFollowup>) => Promise<void>;

  fetchTemplates: () => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  fetchQuotations: (leadId?: string) => Promise<void>;
  fetchSubmission: (leadId: string) => Promise<void>;

  setSelectedLead: (id: string | null) => void;
  setKanbanFilter: (filter: 'all' | 'mine') => void;
  setSearchQuery: (query: string) => void;
}

export const useCrmStore = create<CrmState>((set, get) => ({
  leads: [],
  followups: {},
  templates: [],
  quotations: [],
  submissions: {},
  isLoading: false,
  error: null,
  selectedLeadId: null,
  kanbanFilter: 'all',
  searchQuery: '',

  fetchLeads: async () => {
    set({ isLoading: true, error: null });
    try {
      const leads = await crmApi.getLeads();
      set({ leads, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createLead: async (lead) => {
    set({ isLoading: true, error: null });
    try {
      const newLead = await crmApi.createLead(lead);
      set(state => ({ leads: [newLead, ...state.leads], isLoading: false }));
      return newLead;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  updateLead: async (id, updates) => {
    try {
      const updated = await crmApi.updateLead(id, updates);
      set(state => ({
        leads: state.leads.map(l => l.id === id ? updated : l),
      }));
      return updated;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateLeadStatus: async (id, status) => {
    try {
      const updated = await crmApi.updateLeadStatus(id, status);
      set(state => ({
        leads: state.leads.map(l => l.id === id ? updated : l),
      }));
      return updated;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteLead: async (id) => {
    try {
      await crmApi.deleteLead(id);
      set(state => ({
        leads: state.leads.filter(l => l.id !== id),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchFollowups: async (leadId) => {
    try {
      const followups = await crmApi.getFollowups(leadId);
      set(state => ({
        followups: { ...state.followups, [leadId]: followups },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createFollowup: async (followup) => {
    try {
      const created = await crmApi.createFollowup(followup);
      const leadId = followup.leadId!;
      set(state => ({
        followups: {
          ...state.followups,
          [leadId]: [created, ...(state.followups[leadId] || [])],
        },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchTemplates: async () => {
    try {
      const templates = await crmApi.getChecklistTemplates();
      set({ templates });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteTemplate: async (id: string) => {
    try {
      await crmApi.deleteChecklistTemplate(id);
      set(state => ({
        templates: state.templates.filter(t => t.id !== id),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchQuotations: async (leadId?) => {
    try {
      const quotations = await crmApi.getQuotations(leadId);
      set({ quotations });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchSubmission: async (leadId) => {
    try {
      const submission = await crmApi.getChecklistSubmission(leadId);
      set(state => ({
        submissions: { ...state.submissions, [leadId]: submission },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  setSelectedLead: (id) => set({ selectedLeadId: id }),
  setKanbanFilter: (filter) => set({ kanbanFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
