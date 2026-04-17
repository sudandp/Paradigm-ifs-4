export interface OnboardingData {
  id?: string;
  status: 'draft' | 'pending' | 'verified' | 'rejected';
  portalSyncStatus?: 'pending_sync' | 'synced' | 'failed';
  organizationId?: string;
  organizationName?: string;
  enrollmentDate: string;
  personal: PersonalDetails;
  address: AddressDetails;
  family: FamilyMember[];
  education: EducationRecord[];
  bank: BankDetails;
  uan: UanDetails;
  esi: EsiDetails;
  gmc: GmcDetails;
  organization: OrganizationDetails;
  uniforms: EmployeeUniformSelection[];
  biometrics: BiometricsData;
  salaryChangeRequest?: SalaryChangeRequest | null;
  requiresManualVerification?: boolean;
  formsGenerated?: boolean;
  verificationUsage?: VerificationUsageItem[];
}

export type OnboardingStep = 'personal' | 'address' | 'organization' | 'family' | 'education' | 'bank' | 'uan' | 'esi' | 'gmc' | 'uniform' | 'biometrics' | 'documents' | 'review';

export interface DocumentRules {
  aadhaar: boolean;
  pan: boolean;
  bankProof: boolean;
  educationCertificate: boolean;
  salarySlip: boolean;
  uanProof: boolean;
  familyAadhaar: boolean;
}

export interface VerificationRules {
  requireBengaluruAddress: boolean;
  requireDobVerification: boolean;
}

export interface EnrollmentRules {
  esiCtcThreshold: number;
  enforceManpowerLimit: boolean;
  manpowerLimitRule: 'warn' | 'block';
  allowSalaryEdit?: boolean;
  salaryThreshold: number;
  defaultPolicySingle: '1L' | '2L';
  defaultPolicyMarried: '1L' | '2L';
  enableEsiRule: boolean;
  enableGmcRule: boolean;
  enforceFamilyValidation?: boolean;
  rulesByDesignation: {
    [designation: string]: {
      documents: DocumentRules;
      verifications: VerificationRules;
    };
  };
}
