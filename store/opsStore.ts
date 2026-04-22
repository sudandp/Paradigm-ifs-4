import { create } from 'zustand';
import { opsApi } from '../services/opsApi';
import type { OpsTicket, OpsMaintenanceSchedule, OpsContract } from '../types/operations';

interface OpsState {
  tickets: OpsTicket[];
  schedules: OpsMaintenanceSchedule[];
  contracts: OpsContract[];
  
  isLoading: boolean;
  error: string | null;
  
  // Tickets
  fetchTickets: (entityId?: string) => Promise<void>;
  createTicket: (ticket: Partial<OpsTicket>) => Promise<OpsTicket>;
  updateTicket: (id: string, updates: Partial<OpsTicket>) => Promise<OpsTicket>;
  deleteTicket: (id: string) => Promise<void>;
  
  // Maintenance
  fetchSchedules: (entityId?: string) => Promise<void>;
  createSchedule: (schedule: Partial<OpsMaintenanceSchedule>) => Promise<OpsMaintenanceSchedule>;
  updateSchedule: (id: string, updates: Partial<OpsMaintenanceSchedule>) => Promise<OpsMaintenanceSchedule>;
  
  // Contracts
  fetchContracts: (entityId?: string) => Promise<void>;
  createContract: (contract: Partial<OpsContract>) => Promise<OpsContract>;
  updateContract: (id: string, updates: Partial<OpsContract>) => Promise<OpsContract>;
  deleteContract: (id: string) => Promise<void>;
}

export const useOpsStore = create<OpsState>((set, get) => ({
  tickets: [],
  schedules: [],
  contracts: [],
  isLoading: false,
  error: null,

  // ==========================================================================
  // TICKETS
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
  }

}));
