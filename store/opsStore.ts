import { create } from 'zustand';
import { opsApi } from '../services/opsApi';
import type { 
  OpsTicket, 
  OpsMaintenanceSchedule, 
  OpsContract, 
  HelpdeskSlaPolicy,
  OpsAsset,
  AssetCategory,
  AssetPpmChecklist,
  AssetPpmLog
} from '../types/operations';

interface OpsState {
  tickets: OpsTicket[];
  schedules: OpsMaintenanceSchedule[];
  contracts: OpsContract[];
  slaPolicies: HelpdeskSlaPolicy[];
  assets: OpsAsset[];
  assetChecklists: AssetPpmChecklist[];
  
  isLoading: boolean;
  error: string | null;
  
  // Tickets & SLA Engine
  fetchTickets: (entityId?: string) => Promise<void>;
  createTicket: (ticket: Partial<OpsTicket>) => Promise<OpsTicket>;
  updateTicket: (id: string, updates: Partial<OpsTicket>) => Promise<OpsTicket>;
  deleteTicket: (id: string) => Promise<void>;
  requestClosureOtp: (ticketId: string) => Promise<{ success: boolean; expiresAt: string; message: string; demoOtp: string }>;
  verifyClosureOtp: (ticketId: string, otp: string) => Promise<OpsTicket>;
  adminOverrideClosure: (ticketId: string, reason: string, photoUrl?: string) => Promise<OpsTicket>;
  submitTicketRating: (ticketId: string, rating: number, tags?: string[], comment?: string) => Promise<OpsTicket>;
  fetchSlaPolicies: (entityId?: string) => Promise<void>;
  saveSlaPolicy: (policy: Partial<HelpdeskSlaPolicy>) => Promise<HelpdeskSlaPolicy>;

  // Phase 2: Assets & Digital PPM
  fetchAssets: (entityId?: string) => Promise<void>;
  createAsset: (asset: Partial<OpsAsset>) => Promise<OpsAsset>;
  updateAsset: (id: string, updates: Partial<OpsAsset>) => Promise<OpsAsset>;
  deleteAsset: (id: string) => Promise<void>;
  fetchAssetChecklists: (category?: AssetCategory) => Promise<void>;
  logAssetInspection: (log: Partial<AssetPpmLog>) => Promise<AssetPpmLog>;
  fetchAssetInspectionLogs: (assetId?: string) => Promise<AssetPpmLog[]>;
  
  // Maintenance
  fetchSchedules: (entityId?: string) => Promise<void>;
  createSchedule: (schedule: Partial<OpsMaintenanceSchedule>) => Promise<OpsMaintenanceSchedule>;
  updateSchedule: (id: string, updates: Partial<OpsMaintenanceSchedule>) => Promise<OpsMaintenanceSchedule>;
  
  // Contracts
  fetchContracts: (entityId?: string) => Promise<void>;
  createContract: (contract: Partial<OpsContract>) => Promise<OpsContract>;
  updateContract: (id: string, updates: Partial<OpsContract>) => Promise<OpsContract>;
  deleteContract: (id: string) => Promise<void>;
  seedDemoContracts: (entityId?: string) => Promise<OpsContract[]>;
}

export const useOpsStore = create<OpsState>((set, get) => ({
  tickets: [],
  schedules: [],
  contracts: [],
  slaPolicies: [],
  assets: [],
  assetChecklists: [],
  isLoading: false,
  error: null,

  // ==========================================================================
  // TICKETS & SLA ENGINE
  // ==========================================================================

  fetchTickets: async (entityId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const tickets = await opsApi.getTickets(entityId);
      set({ tickets, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createTicket: async (ticket) => {
    try {
      const newTicket = await opsApi.saveTicket(ticket);
      set((state) => ({ tickets: [newTicket, ...state.tickets] }));
      return newTicket;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateTicket: async (id, updates) => {
    try {
      const updated = await opsApi.saveTicket({ id, ...updates });
      set((state) => ({
        tickets: state.tickets.map(t => t.id === id ? updated : t)
      }));
      return updated;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteTicket: async (id) => {
    try {
      await opsApi.deleteTicket(id);
      set((state) => ({
        tickets: state.tickets.filter(t => t.id !== id)
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  requestClosureOtp: async (ticketId: string) => {
    try {
      const result = await opsApi.requestClosureOtp(ticketId);
      return result;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  verifyClosureOtp: async (ticketId: string, otp: string) => {
    try {
      const res = await opsApi.verifyClosureOtp(ticketId, otp);
      set((state) => ({
        tickets: state.tickets.map(t => t.id === ticketId ? res.ticket : t)
      }));
      return res.ticket;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  adminOverrideClosure: async (ticketId: string, reason: string, photoUrl?: string) => {
    try {
      const updated = await opsApi.adminOverrideClosure(ticketId, reason, photoUrl);
      set((state) => ({
        tickets: state.tickets.map(t => t.id === ticketId ? updated : t)
      }));
      return updated;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  submitTicketRating: async (ticketId: string, rating: number, tags: string[] = [], comment?: string) => {
    try {
      const updated = await opsApi.submitTicketRating(ticketId, rating, tags, comment);
      set((state) => ({
        tickets: state.tickets.map(t => t.id === ticketId ? updated : t)
      }));
      return updated;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchSlaPolicies: async (entityId?: string) => {
    try {
      const slaPolicies = await opsApi.getSlaPolicies(entityId);
      set({ slaPolicies });
    } catch (err: any) {
      console.error('Failed to fetch SLA policies', err);
    }
  },

  saveSlaPolicy: async (policy: Partial<HelpdeskSlaPolicy>) => {
    try {
      const saved = await opsApi.saveSlaPolicy(policy);
      set((state) => {
        const exists = state.slaPolicies.some(p => p.id === saved.id || (p.priority === saved.priority && p.entityId === saved.entityId));
        return {
          slaPolicies: exists
            ? state.slaPolicies.map(p => (p.id === saved.id || (p.priority === saved.priority && p.entityId === saved.entityId)) ? saved : p)
            : [...state.slaPolicies, saved]
        };
      });
      return saved;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  // ==========================================================================
  // PHASE 2: ASSET PPM & EQUIPMENT REGISTER
  // ==========================================================================

  fetchAssets: async (entityId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const assets = await opsApi.getAssets(entityId);
      set({ assets, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createAsset: async (asset: Partial<OpsAsset>) => {
    try {
      const created = await opsApi.saveAsset(asset);
      set((state) => ({ assets: [created, ...state.assets] }));
      return created;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateAsset: async (id: string, updates: Partial<OpsAsset>) => {
    try {
      const updated = await opsApi.saveAsset({ id, ...updates });
      set((state) => ({
        assets: state.assets.map(a => a.id === id ? updated : a)
      }));
      return updated;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteAsset: async (id: string) => {
    try {
      await opsApi.deleteAsset(id);
      set((state) => ({
        assets: state.assets.filter(a => a.id !== id)
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchAssetChecklists: async (category?: AssetCategory) => {
    try {
      const assetChecklists = await opsApi.getAssetChecklists(category);
      set({ assetChecklists });
    } catch (err: any) {
      console.error('Failed to fetch asset checklists', err);
    }
  },

  logAssetInspection: async (log: Partial<AssetPpmLog>) => {
    try {
      const logged = await opsApi.logAssetInspection(log);
      if (log.assetId) {
        set((state) => ({
          assets: state.assets.map(a => a.id === log.assetId ? { ...a, lastInspectedAt: logged.inspectedAt } : a)
        }));
      }
      return logged;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchAssetInspectionLogs: async (assetId?: string) => {
    try {
      return await opsApi.getAssetInspectionLogs(assetId);
    } catch (err: any) {
      console.error('Failed to fetch asset inspection logs', err);
      return [];
    }
  },

  // ==========================================================================
  // MAINTENANCE
  // ==========================================================================

  fetchSchedules: async (entityId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const schedules = await opsApi.getMaintenanceSchedules(entityId);
      set({ schedules, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createSchedule: async (schedule) => {
    try {
      const newSched = await opsApi.saveMaintenanceSchedule(schedule);
      set((state) => ({ schedules: [...state.schedules, newSched] }));
      return newSched;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateSchedule: async (id, updates) => {
    try {
      const updated = await opsApi.saveMaintenanceSchedule({ id, ...updates });
      set((state) => ({
        schedules: state.schedules.map(s => s.id === id ? updated : s)
      }));
      return updated;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  // ==========================================================================
  // CONTRACTS
  // ==========================================================================

  fetchContracts: async (entityId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const contracts = await opsApi.getContracts(entityId);
      set({ contracts, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createContract: async (contract) => {
    try {
      const newContract = await opsApi.saveContract(contract);
      set((state) => ({ contracts: [...state.contracts, newContract] }));
      return newContract;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateContract: async (id, updates) => {
    try {
      const updated = await opsApi.saveContract({ id, ...updates });
      set((state) => ({
        contracts: state.contracts.map(c => c.id === id ? updated : c)
      }));
      return updated;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteContract: async (id) => {
    try {
      await opsApi.deleteContract(id);
      set((state) => ({
        contracts: state.contracts.filter(c => c.id !== id)
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  seedDemoContracts: async (entityId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const demoContracts = await opsApi.seedDemoContracts(entityId);
      set((state) => ({ contracts: [...state.contracts, ...demoContracts], isLoading: false }));
      return demoContracts;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  }

}));
