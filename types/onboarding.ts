import type { 
  PersonalDetails, 
  AddressDetails, 
  FamilyMember, 
  EducationRecord, 
  BankDetails, 
  UanDetails, 
  EsiDetails, 
  GmcDetails, 
  OrganizationDetails, 
  EmployeeUniformSelection, 
  BiometricsData, 
  SalaryChangeRequest 
} from './user';

import type { VerificationUsageItem } from './index';

export interface OnboardingData {
  id?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
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
  verifiedBy?: string | null;
  verifiedByPhoto?: string | null;
  verifiedAt?: string | null;
  verificationMode?: 'auto' | 'manual' | null;
  submissionMode?: 'manual' | 'auto_ai' | null;
  rejectionReason?: string | null;
  rejection_reason?: string | null;
  rejectedBy?: string | null;
  rejected_by?: string | null;
  rejectedAt?: string | null;
  rejected_at?: string | null;
  createdBy?: string | null;
  created_by?: string | null;
  created_user_id?: string | null;
  createdUserId?: string | null;
  created_by_name?: string | null;
  createdByName?: string | null;
  created_by_photo?: string | null;
  createdByPhoto?: string | null;
  created_by_role?: string | null;
  createdByRole?: string | null;
  submittedBy?: string | null;
  submitted_by?: string | null;
}

export type OnboardingStep = 'personal' | 'address' | 'organization' | 'family' | 'education' | 'bank' | 'uan' | 'esi' | 'gmc' | 'uniform' | 'biometrics' | 'documents' | 'review';


export interface DocumentRules {
  photo?: boolean;
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
  requireBankNameMatch?: boolean;
  requireUanVerification?: boolean;
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
  requireDigitalSignature?: boolean;
  requireOfficerAttestation?: boolean;
  requireBookletReview?: boolean;
  maxFamilyDependents?: number;
  rulesByDesignation: {
    [designation: string]: {
      documents: DocumentRules;
      verifications: VerificationRules;
    };
  };
}
