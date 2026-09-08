import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EnrollmentRules, DocumentRules, VerificationRules } from '../types';
import { api } from '../services/api';
import { defaultDesignationRules, emptyEnrollmentRules } from '../utils/enrollmentRulesSerializer';

export { defaultDesignationRules, emptyEnrollmentRules } from '../utils/enrollmentRulesSerializer';

interface EnrollmentRulesState extends EnrollmentRules {
  isLoading: boolean;
  isSaving: boolean;
  lastFetchedAt: string | null;
  init: (rules: EnrollmentRules) => void;
  updateRules: (settings: Partial<EnrollmentRules>) => void;
  fetchRules: (forceRemote?: boolean) => Promise<EnrollmentRules>;
  saveRules: (rules: EnrollmentRules) => Promise<void>;
}

/**
 * Case-insensitive & trimmed helper to look up rules for a designation
 */
export const getRulesForDesignation = (
  rulesByDesignation: Record<string, { documents: DocumentRules; verifications: VerificationRules }> | undefined,
  designation?: string | null
): { documents: DocumentRules; verifications: VerificationRules } => {
  if (!rulesByDesignation) return defaultDesignationRules;
  if (!designation) {
    return rulesByDesignation['Default (All Roles)'] || defaultDesignationRules;
  }

  const cleanDesig = designation.trim().toLowerCase();

  // 1. Direct exact match
  if (rulesByDesignation[designation]) {
    return rulesByDesignation[designation];
  }

  // 2. Case-insensitive lookup
  const matchedKey = Object.keys(rulesByDesignation).find(
    k => k.trim().toLowerCase() === cleanDesig
  );
  if (matchedKey && rulesByDesignation[matchedKey]) {
    return rulesByDesignation[matchedKey];
  }

  // 3. Security Guard fallback for security-related roles if unconfigured
  if (cleanDesig.includes('guard') || cleanDesig.includes('security')) {
    const secKey = Object.keys(rulesByDesignation).find(
      k => k.trim().toLowerCase() === 'security guard'
    );
    if (secKey && rulesByDesignation[secKey]) {
      return rulesByDesignation[secKey];
    }
  }

  // 4. Fallback to Default
  return rulesByDesignation['Default (All Roles)'] || defaultDesignationRules;
};

export const useEnrollmentRulesStore = create<EnrollmentRulesState>()(
  persist(
    (set, get) => ({
      ...emptyEnrollmentRules,
      isLoading: false,
      isSaving: false,
      lastFetchedAt: null,

      init: (rules) => {
        if (rules) {
          set({ ...rules });
        }
      },

      updateRules: (settings) => set((state) => ({ ...state, ...settings })),

      fetchRules: async (forceRemote = false) => {
        const current = get();
        // Skip frequent remote calls within 10 seconds unless forced
        if (!forceRemote && current.lastFetchedAt) {
          const diffMs = Date.now() - new Date(current.lastFetchedAt).getTime();
          if (diffMs < 10000) {
            return current;
          }
        }

        set({ isLoading: true });
        try {
          const remoteRules = await api.getEnrollmentRules();
          if (remoteRules) {
            set({
              ...remoteRules,
              isLoading: false,
              lastFetchedAt: new Date().toISOString()
            });
            return remoteRules;
          }
        } catch (err) {
          console.warn('[EnrollmentRulesStore] Failed to fetch remote rules from Supabase, using local cache:', err);
        } finally {
          set({ isLoading: false });
        }
        return get();
      },

      saveRules: async (newRules: EnrollmentRules) => {
        set({ isSaving: true });
        try {
          await api.saveEnrollmentRules(newRules);
          set({
            ...newRules,
            isSaving: false,
            lastFetchedAt: new Date().toISOString()
          });
        } catch (err) {
          set({ isSaving: false });
          throw err;
        }
      },
    }),
    {
      name: 'paradigm-enrollment-rules',
      storage: createJSONStorage(() => localStorage),
    }
  )
);