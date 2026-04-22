import { create } from 'zustand';
import { enterpriseApi } from '../services/enterpriseApi';
import type { SystemAuditLog, OpsApprovalRequest } from '../types/enterprise';

interface EnterpriseState {
  auditLogs: SystemAuditLog[];
  approvalRequests: OpsApprovalRequest[];
  
  isLoading: boolean;
  error: string | null;
  
  // Audit Logs
  fetchAuditLogs: (moduleName?: string, recordId?: string, limit?: number) => Promise<void>;
  
  // Approvals
  fetchApprovalRequests: (requiredRole?: string, status?: string) => Promise<void>;
  submitForApproval: (request: Partial<OpsApprovalRequest>) => Promise<OpsApprovalRequest>;
  processApproval: (id: string, approverId: string, status: 'Approved'|'Rejected', comments?: string) => Promise<OpsApprovalRequest>;
}

export const useEnterpriseStore = create<EnterpriseState>((set, get) => ({
  auditLogs: [],
  approvalRequests: [],
  isLoading: false,
  error: null,

  fetchAuditLogs: async (moduleName, recordId, limit) => {
    set({ isLoading: true, error: null });
    try {
      const logs = await enterpriseApi.getAuditLogs(moduleName, recordId, limit);
      set({ auditLogs: logs, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchApprovalRequests: async (requiredRole, status) => {
    set({ isLoading: true, error: null });
    try {
      const requests = await enterpriseApi.getApprovalRequests(requiredRole, status);
      set({ approvalRequests: requests, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  submitForApproval: async (request) => {
    try {
      const newReq = await enterpriseApi.submitForApproval(request);
      set((state) => ({ approvalRequests: [newReq, ...state.approvalRequests] }));
      return newReq;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  processApproval: async (id, approverId, status, comments) => {
    try {
      const updated = await enterpriseApi.processApproval(id, approverId, status, comments);
      set((state) => ({
        approvalRequests: state.approvalRequests.map(r => r.id === id ? updated : r)
      }));
      return updated;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  }

}));
