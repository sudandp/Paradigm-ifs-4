import { create } from 'zustand';
import { financeApi } from '../services/financeApi';
import type { OpsPaymentReceipt, ProfitabilityMetric } from '../types/finance';

interface FinanceState {
  receipts: OpsPaymentReceipt[];
  profitabilityMetrics: ProfitabilityMetric[];
  
  isLoading: boolean;
  error: string | null;
  
  // Receipts
  fetchReceipts: (entityId?: string) => Promise<void>;
  createReceipt: (receipt: Partial<OpsPaymentReceipt>) => Promise<OpsPaymentReceipt>;
  updateReceipt: (id: string, updates: Partial<OpsPaymentReceipt>) => Promise<OpsPaymentReceipt>;
  deleteReceipt: (id: string) => Promise<void>;
  
  // Profitability
  fetchProfitabilityStats: () => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  receipts: [],
  profitabilityMetrics: [],
  isLoading: false,
  error: null,

  fetchReceipts: async (entityId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const receipts = await financeApi.getPaymentReceipts(entityId);
      set({ receipts, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createReceipt: async (receipt) => {
    try {
      const newReceipt = await financeApi.savePaymentReceipt(receipt);
      set((state) => ({ receipts: [newReceipt, ...state.receipts] }));
      return newReceipt;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateReceipt: async (id, updates) => {
    try {
      const updated = await financeApi.savePaymentReceipt({ id, ...updates });
      set((state) => ({
        receipts: state.receipts.map(r => r.id === id ? updated : r)
      }));
      return updated;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteReceipt: async (id) => {
    try {
      await financeApi.deletePaymentReceipt(id);
      set((state) => ({
        receipts: state.receipts.filter(r => r.id !== id)
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchProfitabilityStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const metrics = await financeApi.getProfitabilityStats();
      set({ profitabilityMetrics: metrics, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  }

}));
