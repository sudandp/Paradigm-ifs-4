import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EnrollmentRules, DocumentRules, VerificationRules } from '../types';

interface EnrollmentRulesState extends EnrollmentRules {
  init: (rules: EnrollmentRules) => void;
  updateRules: (settings: Partial<EnrollmentRules>) => void;
}

export const defaultDesignationRules: {
  documents: DocumentRules;
  verifications: VerificationRules;
} = {
  documents: {
    photo: true,
    aadhaar: true,
    pan: false,
    bankProof: true,
    educationCertificate: false,
    salarySlip: false,
    uanProof: false,
    familyAadhaar: false,
  },
  verifications: {
    requireBengaluruAddress: false,
    requireDobVerification: false,
  }
};

const emptyRules: EnrollmentRules = {
  esiCtcThreshold: 21000,
  enforceManpowerLimit: false,
  manpowerLimitRule: 'warn',
  allowSalaryEdit: false,
  salaryThreshold: 21000,
  defaultPolicySingle: '1L',
  defaultPolicyMarried: '2L',
  enableEsiRule: false,
  enableGmcRule: false,
  enforceFamilyValidation: true,
  rulesByDesignation: {
    'Default (All Roles)': defaultDesignationRules,
  },
};

export const useEnrollmentRulesStore = create<EnrollmentRulesState>()(
  persist(
    (set) => ({
      ...emptyRules,
      init: (rules) => {
        if (rules) {
          set(rules);
        }
      },
      updateRules: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    {
      name: 'paradigm-enrollment-rules',
      storage: createJSONStorage(() => localStorage),
    }
  )
);