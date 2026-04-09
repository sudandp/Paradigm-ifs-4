import type { ComponentType } from 'react';

export type UserRole = string;

export interface Role {
  id: string;
  displayName: string;
  permissions?: Permission[];
}

export type Permission =
  | 'view_all_submissions'
  | 'manage_users'
  | 'manage_sites'
  | 'view_entity_management'
  | 'view_developer_settings'
  | 'view_operations_dashboard'
  | 'view_site_dashboard'
  | 'create_enrollment'
  | 'manage_roles_and_permissions'
  | 'manage_attendance_rules'
  | 'view_own_attendance'
  | 'view_all_attendance'
  | 'apply_for_leave'
  | 'manage_leave_requests'
  | 'manage_approval_workflow'
  | 'download_attendance_report'
  | 'manage_tasks'
  | 'manage_policies'
  | 'manage_insurance'
  | 'manage_enrollment_rules'
  | 'manage_uniforms'
  | 'view_invoice_summary'
  | 'view_verification_costing'
  | 'view_field_staff_tracking'
  | 'manage_modules'
  | 'access_support_desk'
  | 'view_my_team'
  | 'view_field_reports'
  | 'manage_biometric_devices'
  | 'manage_geo_locations'
  | 'view_my_locations'
  | 'view_profile'
  | 'view_mobile_nav_home'
  | 'view_mobile_nav_attendance'
  | 'view_mobile_nav_tasks'
  | 'view_mobile_nav_profile'
  | 'manage_finance_settings'
  | 'view_finance_reports'
  | 'view_attendance_tracker';

export interface AppModule {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface Organization {
  id: string;
  shortName: string;
  fullName: string;
  address: string;
  manpowerApprovedCount?: number;
  provisionalCreationDate?: string;
  reportingManagerName?: string;
  managerName?: string;
  fieldStaffNames?: string[];
  backendFieldStaffName?: string;
  parentId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  role: string; // Display name for UI
  roleId: string; // UUID from database
  organizationId?: string;
  organizationName?: string;
  reportingManagerId?: string;
  reportingManager2Id?: string;
  reportingManager3Id?: string;
  photoUrl?: string;
  biometricId?: string;

  /**
   * Computed property used by some UI screens to indicate whether the
   * user is currently checked in (available) or not.  This field is
   * optional because most API calls do not include availability by
   * default.
   */
  isAvailable?: boolean;
  
  // Salary hold fields for violation enforcement
  salaryHold?: boolean;
  salaryHoldReason?: string | null;
  salaryHoldDate?: string | null; // ISO String
  earnedLeaveOpeningBalance?: number;
  earnedLeaveOpeningDate?: string; // YYYY-MM-DD
  sickLeaveOpeningBalance?: number;
  sickLeaveOpeningDate?: string; // YYYY-MM-DD
  compOffOpeningBalance?: number;
  compOffOpeningDate?: string; // YYYY-MM-DD
  floatingLeaveOpeningBalance?: number;
  floatingLeaveOpeningDate?: string; // YYYY-MM-DD
  otHoursBank?: number;
  monthlyOtHours?: number;
  /**
   * Optional human-readable location name for proximity logic.
   */
  locationName?: string;
  /**
   * Flag indicating if the user is considered "nearby" the current user.
   */
  isNearby?: boolean;
  location?: string;
  societyId?: string;
  societyName?: string;
  locationId?: string;
  passcode?: string;
}

export interface UserChild {
  id: string;
  userId: string;
  childName: string;
  dateOfBirth: string; // YYYY-MM-DD
  birthCertificateUrl?: string | null;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BiometricDevice {
  id: string;
  sn: string;
  name: string;
  organizationId?: string | null;
  locationName?: string | null;
  status: 'online' | 'offline';
  lastSeen?: string;
  ipAddress?: string;
  port?: number;
  createdAt: string;
  updatedAt: string;
  organization?: {
    shortName: string;
  } | null;
}

export interface UploadedFile {
  name: string;
  type: string;
  size: number;
  preview: string;
  url?: string;
  path?: string | null; // Path in Supabase storage bucket
  file?: File;
  progress?: number;
}

export interface PersonalDetails {
  employeeId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed' | '';
  bloodGroup: '' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  mobile: string;
  alternateMobile?: string;
  email: string;
  idProofType?: 'Aadhaar' | 'PAN' | 'Voter ID' | '';
  idProofNumber?: string;
  photo?: UploadedFile | null;
  idProofFront?: UploadedFile | null;
  idProofBack?: UploadedFile | null;
  emergencyContactName: string;
  emergencyContactNumber: string;
  relationship: 'Spouse' | 'Child' | 'Father' | 'Mother' | 'Sibling' | 'Other' | '';
  salary: number | null;
  verifiedStatus?: {
    name?: boolean | null;
    dob?: boolean | null;
    idProofNumber?: boolean | null;
    email?: boolean | null;
  };
  isQrVerified?: boolean;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  verifiedStatus?: {
    line1?: boolean | null;
    city?: boolean | null;
    state?: boolean | null;
    pincode?: boolean | null;
    country?: boolean | null;
  };
}

export interface AddressDetails {
  present: Address;
  permanent: Address;
  sameAsPresent: boolean;
}

export interface FamilyMember {
  id: string;
  relation: 'Spouse' | 'Child' | 'Father' | 'Mother' | '';
  name: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  occupation?: string;
  dependent: boolean;
  idProof: UploadedFile | null;
  phone?: string;
}

export interface EducationRecord {
  id: string;
  degree: string;
  institution: string;
  startYear: string;
  endYear: string;
  percentage?: number | null;
  grade?: string;
  document?: UploadedFile | null;
}

export interface BankDetails {
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName: string;
  bankProof?: UploadedFile | null;
  verifiedStatus?: {
    accountHolderName?: boolean | null;
    accountNumber?: boolean | null;
    ifscCode?: boolean | null;
  };
}

export interface UanDetails {
  uanNumber?: string;
  pfNumber?: string;
  hasPreviousPf: boolean;
  document?: UploadedFile | null;
  salarySlip?: UploadedFile | null;
  verifiedStatus?: {
    uanNumber?: boolean | null;
  };
}

export interface EsiDetails {
  esiNumber?: string;
  esiRegistrationDate?: string;
  esicBranch?: string;
  hasEsi: boolean;
  document?: UploadedFile | null;
  verifiedStatus?: {
    esiNumber?: boolean | null;
  };
}

export interface GmcDetails {
  isOptedIn: boolean | null;
  policyAmount?: '1L' | '2L' | '';
  nomineeName?: string;
  nomineeRelation?: 'Spouse' | 'Child' | 'Father' | 'Mother' | '';
  wantsToAddDependents?: boolean;
  selectedSpouseId?: string;
  selectedChildIds?: string[];
  gmcPolicyCopy?: UploadedFile | null;
  declarationAccepted?: boolean;
  optOutReason?: string;
  alternateInsuranceProvider?: string;
  alternateInsuranceStartDate?: string;
  alternateInsuranceEndDate?: string;
  alternateInsuranceCoverage?: string;
}

export interface OrganizationDetails {
  designation: string;
  department: string;
  reportingManager: string;
  organizationId: string;
  organizationName: string;
  joiningDate: string;
  workType: 'Full-time' | 'Part-time' | 'Contract' | '';
  site?: string;
  defaultSalary?: number | null;
}

export interface EmployeeUniformSelection {
  itemId: string; // From UniformItem.id
  itemName: string; // From UniformItem.name
  sizeId: string; // From MasterGents/LadiesUniforms.pants/shirts[].id
  sizeLabel: string; // e.g., "32" or "L"
  fit: string; // e.g., "Regular Fit"
  quantity: number;
}

export interface SalaryChangeRequest {
  id: string;
  onboardingId: string;
  employeeName: string;
  siteName: string;
  requestedBy: string; // userId
  requestedByName: string;
  requestedAt: string; // ISO string
  originalAmount: number;
  requestedAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvedBy?: string; // userId
  approvedAt?: string;
  rejectionReason?: string;
}

export interface Fingerprints {
  leftThumb: UploadedFile | null;
  leftIndex: UploadedFile | null;
  leftMiddle: UploadedFile | null;
  leftRing: UploadedFile | null;
  leftLittle: UploadedFile | null;
  rightThumb: UploadedFile | null;
  rightIndex: UploadedFile | null;
  rightMiddle: UploadedFile | null;
  rightRing: UploadedFile | null;
  rightLittle: UploadedFile | null;
}

export interface BiometricsData {
  signatureImage: UploadedFile | null;
  fingerprints: Fingerprints;
}

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

export interface EmailSettings {
  // SMTP settings are now managed on the backend for security.
}

export interface SiteManagementSettings {
  enableProvisionalSites: boolean;
}

export interface AddressSettings {
  enablePincodeVerification: boolean;
}

export interface GmcPolicySettings {
  applicability: 'Mandatory' | 'Optional - Opt-in Default' | 'Optional - Opt-out Default';
  optInDisclaimer: string;
  coverageDetails: string;
  optOutDisclaimer: string;
  requireAlternateInsurance: boolean;
  collectProvider: boolean;
  collectStartDate: boolean;
  collectEndDate: boolean;
  collectExtentOfCover: boolean;
}

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

export interface OtpSettings {
  enabled: boolean;
}

export interface BackupSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startTime: string; // "HH:mm"
  interval?: number; // e.g., Every 1 month, every 3 months
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  monthOfYear?: number; // 1-12
  nextRun?: string;  // ISO string
  lastRun?: string;  // ISO string
}

export interface ApiSettings {
  autoBackupEnabled: boolean;
  backupSchedule?: BackupSchedule;
  appVersion?: string;
}


export interface NotificationSettings {
  email: {
    enabled: boolean;
  };
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  enabled: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
  category: 'report' | 'alert' | 'greeting' | 'document_expiry';
  variables: { key: string; description: string }[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailScheduleRule {
  id: string;
  name: string;
  templateId: string;
  triggerType: 'scheduled' | 'event' | 'document_expiry';
  scheduleConfig?: {
    time: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  eventType?: string;
  expiryConfig?: {
    table: string;
    field: string;
    daysBefore: number;
  };
  reportType?: string;
  reportFormat: 'html' | 'pdf' | 'csv';
  recipientType: 'role' | 'users' | 'custom_emails';
  recipientRoles: string[];
  recipientUserIds: string[];
  recipientEmails: string[];
  isActive: boolean;
  lastSentAt?: string;
  nextRunAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  ruleId?: string;
  templateId?: string;
  recipientEmail: string;
  subject: string;
  status: 'sent' | 'failed' | 'queued';
  errorMessage?: string;
  triggerType?: 'manual' | 'automatic';
  metadata: Record<string, any>;
  createdAt: string;
}

export type AttendanceReportType = 'basic' | 'monthly' | 'log' | 'work_hours' | 'site_ot' | 'audit';

export interface ReportEmailPayload {
  to: string | string[];
  subject: string;
  html?: string;
  body?: string;
  attachments?: {
    filename: string;
    content: string; // base64
    contentType: string;
  }[];
  triggerType: 'manual' | 'automatic';
  reportType?: AttendanceReportType;
  smtpConfig?: any; // Optional override
  filters?: Record<string, any>;
}

// Types for Entity Management
export type RegistrationType = 'ROC' | 'ROF' | 'Society' | 'Trust' | '';

export interface Entity {
  id: string;
  status?: 'draft' | 'completed';
  name: string;
  logoUrl?: string;
  organizationId?: string;
  location?: string;
  registeredAddress?: string;
  registrationType?: RegistrationType;
  registrationNumber?: string;
  gstNumber?: string | null;
  panNumber?: string | null;
  email?: string;
  eShramNumber?: string;
  shopAndEstablishmentCode?: string;
  epfoCode?: string;
  epfoDocUrl?: string;
  esicCode?: string;
  esicDocUrl?: string;
  eShramDocUrl?: string;
  psaraLicenseNumber?: string;
  psaraValidTill?: string | null;
  insuranceIds?: string[];
  policyIds?: string[];
  insurances?: SiteInsurance[];
  policies?: SitePolicy[];
  companyId?: string;
  
  // Registration Documents (Updated)
  cinNumber?: string;
  cinDocUrl?: string;
  dinNumber?: string;
  dinDocUrl?: string;
  tanNumber?: string;
  tanDocUrl?: string;
  udyogNumber?: string;
  udyogDocUrl?: string;

  // Advanced Fields (Phase 1 Redesign)
  siteTakeoverDate?: string | null;
  billingName?: string | null;
  emails?: { id: string; email: string; isPrimary?: boolean; }[];
  siteManagement?: {
    keyAccountManager?: string;
    kamEffectiveDate?: string;
    siteAreaSqFt?: number;
    projectType?: string;
    unitCount?: number;
  };
  agreements?: {
    id: string;
    fromDate?: string;
    toDate?: string;
    renewalTriggerDays?: number;
    minWageTriggerDays?: number;
    wordCopyUrl?: string;
    signedCopyUrl?: string;
    agreementDate?: string;
    addendum1Date?: string;
    addendum2Date?: string;
  }[];
  complianceDetails?: {
    form6Applicable: boolean;
    form6ValidityFrom?: string;
    form6ValidityTo?: string;
    form6RenewalInterval?: number;
    form6DocumentUrl?: string;
    minWageRevisionApplicable: boolean;
    minWageRevisionDocumentUrl?: string;
    minWageRevisionValidityFrom?: string;
    minWageRevisionValidityTo?: string;
  };
  holidayConfig?: {
    holidayType?: 'company_10' | 'company_12' | 'custom_10' | 'custom_12' | '';
    numberOfDays?: 10 | 12;
    holidays?: { date: string; description: string; }[];
    salaryRule?: 'Full' | 'Duty' | 'Nil' | 'Category';
    billingRule?: 'Full' | 'Duty' | 'Nil' | 'Category';
    logicVariation?: string; // 1+1, 1, 1.5, 0 etc.
  };
  financialLinkage?: {
    costingSheetUrl?: string;
    effectiveDate?: string;
    version?: string;
  };
  assetTracking?: {
    tools?: { 
      name: string; 
      brand: string; 
      size: string; 
      quantity: number; 
      issueDate: string; 
      imageUrl?: string; 
      dcCopyRef?: string;
    }[];
    dcCopy1Url?: string;
    dcCopy2Url?: string;
    sims?: { count: number; details: { number: string; phone: string; }[]; };
    equipment?: { name: string; brand: string; model: string; serial: string; accessories: string; condition: 'New' | 'Old'; issueDate: string; }[];
  };
  intermittentEquipment?: {
    name: string;
    billingType: 'Billable' | 'Non-billable';
    frequency: string;
    durationDays: number;
    nextTaskDate?: string;
  }[];
  billingControls?: {
    billingCycleStart?: string;
    salaryDate?: string;
    uniformDeductions: boolean;
    deductionCategory?: string;
  };
  verificationData?: {
    categories: {
      name: string;
      employmentPlusPolice: string[];
      policeOnly: string[];
    }[];
  };
  complianceDocuments?: ComplianceDocument[];
}

export interface CompanyEmail {
  id: string;
  email: string;
}

export interface ComplianceCodes {
  eShramNumber?: string;
  eShramDocUrl?: string;
  shopAndEstablishmentCode?: string;
  shopAndEstablishmentValidTill?: string | null;
  epfoCode?: string;
  epfoDocUrl?: string;
  esicCode?: string;
  esicDocUrl?: string;
  psaraLicenseNumber?: string;
  psaraValidTill?: string | null;
}

export interface ComplianceDocument {
  id: string;
  type: string;
  documentUrls?: string[] | null;
  expiryDate?: string | null;
  effectiveDate?: string | null;
  announcedDate?: string | null;
  editorLog?: string | null;
}

export interface CompanyHoliday {
  id: string;
  date: string;
  year: number;
  festivalName: string;
}

export interface CompanyInsurance {
  id: string;
  name: string;
  documentUrls?: string[] | null;
  effectiveDate?: string | null;
  announcedDate?: string | null;
  editorLog?: string | null;
}

export interface SiteInsurance {
  id: string;
  provider: string;
  type: string;
  policyNumber?: string;
  validTill?: string | null;
  documentUrls?: string[] | null;
}

export interface SitePolicy {
  id: string;
  name: string;
  level: 'BO' | 'Site' | 'Both';
  documentUrls?: string[] | null;
}

export interface CompanyPolicy {
  id: string;
  name: string;
  documentUrls?: string[] | null;
  level: 'BO' | 'Site' | 'Both';
  description?: string;
  effectiveDate?: string | null;
  announcedDate?: string | null;
  editorLog?: string | null;
}

export interface Company {
  id: string;
  name: string;
  status?: 'draft' | 'completed';
  entities: Entity[];
  groupId?: string;
  location?: string;
  address?: string;
  logoUrl?: string;
  
  // Basic Details
  registrationType?: RegistrationType;
  registrationNumber?: string;
  gstNumber?: string | null;
  gstDocUrl?: string | null;
  panNumber?: string | null;
  panDocUrl?: string | null;

  // Independence identification fields
  cinNumber?: string;
  cinDocUrl?: string;
  dinNumber?: string;
  dinDocUrl?: string;
  tanNumber?: string;
  tanDocUrl?: string;
  udyogNumber?: string;
  udyogDocUrl?: string;
  
  // Nested JSONB Structures
  emails?: CompanyEmail[];
  complianceCodes?: ComplianceCodes;
  complianceDocuments?: ComplianceDocument[];
  holidays?: CompanyHoliday[];
  insurances?: CompanyInsurance[];
  policies?: CompanyPolicy[];
}

export interface OrganizationGroup {
  id: string;
  name: string; // e.g., "Paradigm Group"
  locations: string[];
  companies: Company[];
}

export interface Policy {
  id: string;
  name: string;
  description?: string;
  fileUrl?: string;
}

export type InsuranceType = 'GMC' | 'GPA' | 'WCA' | 'Other';
export interface Insurance {
  id: string;
  type: InsuranceType;
  provider: string;
  policyNumber: string;
  validTill: string;
}

export interface HolidayListItem {
  id: string;
  date: string;
  description: string;
}

export interface ToolListItem {
  id: string;
  name: string;
  brand: string;
  size: string;
  quantity: number | null;
  issueDate: string;
  picture?: UploadedFile | null;
}

export interface SimDetail {
  id: string;
  mobileNumber: string;
  allocatedTo?: string;
  plan?: string;
  ownerName?: string;
}

export interface IssuedEquipment {
  id: string;
  name: string;
  brand: string;
  modelNumber: string;
  serialNumber: string;
  accessories: string;
  condition: 'New' | 'Old' | '';
  issueDate: string;
  picture?: UploadedFile | null;
}

export interface InsurancePolicyDetails {
  policyNumber: string;
  provider: string;
  validFrom: string;
  validTo: string;
  document?: UploadedFile | null;
}

export interface SiteInsuranceStatus {
  isCompliant: boolean;
  gpa?: InsurancePolicyDetails;
  gmcGhi?: InsurancePolicyDetails;
  gtl?: InsurancePolicyDetails;
  wc?: InsurancePolicyDetails;
}

export interface IssuedTool {
  id: string;
  department: string;
  name: string;
  quantity: number | null;
  picture?: UploadedFile | null;
  inwardDcCopy?: UploadedFile | null;
  deliveryCopy?: UploadedFile | null;
  invoiceCopy?: UploadedFile | null;
  receiverName?: string;
  signedReceipt?: UploadedFile | null;
}

export interface SiteConfiguration {
  organizationId: string;
  entityId?: string;
  location?: string | null;
  billingName?: string | null;
  registeredAddress?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  email1?: string | null;
  email2?: string | null;
  email3?: string | null;
  eShramNumber?: string | null;
  shopAndEstablishmentCode?: string | null;
  keyAccountManager?: string | null;
  siteAreaSqFt?: number | null;
  projectType?: 'Apartment' | 'Villa' | 'Vilament' | 'Rowhouse' | 'Combined' | 'Commercial Office' | 'Commercial Retail' | 'Commercial' | 'Public' | '';
  apartmentCount?: number | null;
  agreements?: {
    id: string;
    fromDate?: string | null;
    toDate?: string | null;
    renewalIntervalDays?: number | null;
    softCopy?: UploadedFile | null;
    scannedCopy?: UploadedFile | null;
    agreementDate?: string | null;
    addendum1Date?: string | null;
    addendum2Date?: string | null;
  }[];
  siteOperations?: {
    form6Applicable: boolean;
    form6RenewalTaskCreation?: boolean;
    form6ValidityFrom?: string | null;
    form6ValidityTo?: string | null;
    form6Document?: UploadedFile | null;

    minWageRevisionApplicable: boolean;
    minWageRevisionTaskCreation?: boolean;
    minWageRevisionValidityFrom?: string | null;
    minWageRevisionValidityTo?: string | null;
    minWageRevisionDocument?: UploadedFile | null;

    holidays?: {
      numberOfDays?: number | null;
      list?: HolidayListItem[];
      salaryPayment?: 'Full Payment' | 'Duty Payment' | 'Nil Payment' | '';
      billing?: 'Full Payment' | 'Duty Payment' | 'Nil Payment' | '';
    };

    costingSheetLink?: string | null;

    tools?: {
      dcCopy1?: UploadedFile | null;
      dcCopy2?: UploadedFile | null;
      list?: ToolListItem[];
    };

    sims?: {
      issuedCount?: number | null;
      details?: SimDetail[];
    };

    equipment?: {
      issued?: IssuedEquipment[];
      intermittent?: {
        billing: 'To Be Billed' | 'Not to be Billed' | '';
        frequency: 'Monthly' | 'Bi-Monthly' | 'Quarterly' | 'Half Yearly' | 'Yearly' | '';
        taskCreation?: boolean;
        durationDays?: number | null;
      };
    };

    billingCycleFrom?: string | null;
    uniformDeductions: boolean;
  };
  insuranceStatus?: SiteInsuranceStatus;
  assets?: Asset[];
  issuedTools?: IssuedTool[];
}

export interface Agreement {
  id: string;
  name: string;
  fromDate?: string;
  toDate?: string;
  renewalIntervalDays?: number | null;
  softCopy?: UploadedFile | null;
  scannedCopy?: UploadedFile | null;
  agreementDate?: string;
  addendum1Date?: string;
  addendum2Date?: string;
}


// Types for Attendance
export type AttendanceEventType = 'punch-in' | 'punch-out' | 'break-in' | 'break-out' | 'site-ot-in' | 'site-ot-out';

export interface AttendanceEvent {
  id: string;
  userId: string;
  timestamp: string; // ISO String
  type: AttendanceEventType;
  latitude?: number;
  longitude?: number;
  /**
   * Optional reference to the geofenced location used for this attendance event.  When
   * check‑in/out occurs within a defined geofence, locationId will be populated
   * with the corresponding location record.  When an event is recorded outside
   * all known geofences, this field may be null or undefined.
   */
  locationId?: string | null;
  /**
   * Optional human-readable location name/address stored directly with the event.
   * This is populated during check-in/out to enable fast report generation without
   * needing to resolve coordinates or join with the locations table.
   */
  locationName?: string | null;
  /**
   * Optional reference to the biometric device that recorded this event.
   * Null if recorded via mobile app.
   */
  deviceId?: string | null;
  checkoutNote?: string;
  attachmentUrl?: string | null;
  workType?: 'office' | 'field';
  fieldReportId?: string;
  isManual?: boolean;
  createdBy?: string;
  reason?: string;
  /** True when this event belongs to an overtime (2nd+) punch cycle. */
  isOt?: boolean;
}

export interface RoutePoint {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: string; // ISO String
  accuracy?: number;
  speed?: number;
  heading?: number;
}

// -----------------------------------------------------------------------------
// Geofencing Types
//
// Locations define circular geofences that staff can check in/out within.  A
// location may be shared across multiple users via the user_locations table.  Each
// location has a center coordinate and radius (meters).  createdBy denotes the
// user who created it; createdAt is an ISO timestamp.  The optional name
// property provides a friendly label for display.

export interface Location {
  id: string;
  name: string | null;
  latitude: number;
  longitude: number;
  radius: number;
  /** Optional human readable address (street, area, city). */
  address?: string | null;
  createdBy?: string | null;
  createdAt?: string;

  /**
   * Optional name of the user who created this location.  This is derived
   * on the client side by mapping createdBy to the user's name.  Not
   * stored in the database.
   */
  createdByName?: string;
}

export interface RecurringHolidayRule {
  id?: string; // Optional for new rules before saving
  type?: 'office' | 'field' | 'site' | 'admin' | 'management'; // Optional as it might be inferred
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  n: number; // 1 for 1st, 2 for 2nd, 3 for 3rd, 4 for 4th, 5 for 5th
  roleType?: string; // For database compatibility
  occurrence?: number; // For database compatibility
}

export interface StaffAttendanceRules {
  minimumHoursFullDay: number;
  minimumHoursHalfDay: number;
  annualEarnedLeaves: number;
  earnedLeavesExpiryDate?: string; // ISO or YYYY-MM-DD
  annualSickLeaves: number;
  sickLeavesExpiryDate?: string; // ISO or YYYY-MM-DD
  monthlyFloatingLeaves: number;
  floatingLeavesExpiryDate?: string; // ISO or YYYY-MM-DD
  annualCompOffLeaves: number;
  compOffLeavesExpiryDate?: string; // ISO or YYYY-MM-DD
  enableAttendanceNotifications: boolean;
  sickLeaveCertificateThreshold: number;
  geofencingEnabled?: boolean;
  maxViolationsPerMonth?: number;
  recurringHolidays?: RecurringHolidayRule[];
  // Fixed office hours configuration
  fixedOfficeHours?: {
    checkInTime: string; // "09:00"
    checkOutTime: string; // "18:00"
  };
  dailyWorkingHours?: {
    min: number; // 7
    max: number; // 9
  };
  monthlyTargetHours?: number; // 216
  enableHoursBasedCalculation?: boolean;
  // Break tracking
  enableBreakTracking?: boolean;
  lunchBreakDuration?: number; // minutes, default 60
  // Holiday restrictions
  maxHolidaysPerCategory?: number; // Total limit (e.g., 10)
  adminAllocatedHolidays?: number; // Limit for admin (e.g., 5)
  employeeHolidays?: number; // Limit for employee selection (e.g., 5)
  enableCustomHolidays?: boolean; // Whether users can pick their own holidays
  enableOtToCompOffConversion?: boolean; // Convert OT to Comp Off day
  otConversionThreshold?: number; // Hours required for 1 Comp Off (e.g., 8)
  enableShortfall?: boolean; // Show shortfall card and calendar
  // Weekly off configuration
  weeklyOffDays?: number[]; // [0] for Sunday, [0,6] for Sunday and Saturday
  // Field Staff Site/Travel Tracking
  minimumSitePercentage?: number; // e.g., 75 - minimum % of time that must be on-site
  minimumSiteHours?: number; // New: Absolute minimum site hours required
  maximumTravelPercentage?: number; // e.g., 25 - maximum % of time for travel
  enableSiteTimeTracking?: boolean; // Enable site vs travel validation for field staff
  enableViolationBlocking?: boolean; // Whether violations should block the user and hold salary
  earnedLeaveAccrual?: {
    daysRequired: number; // e.g., 10
    amountEarned: number; // e.g., 0.5
  };
  enableSickLeaveAccrual?: boolean;
  holidayPool?: { name: string; date: string }[];
  // Device limits configuration
  deviceLimits?: {
    web: number; // Number of allowed web devices
    android: number; // Number of allowed Android devices
    ios: number; // Number of allowed iOS devices
  };
  // Admin-configured tracking interval (minutes)
  trackingIntervalMinutes?: number;
  // Maternity & Child Care Leave
  maternityLeaveWeeks?: number; // default 26
  maternityMinTenureMonths?: number; // default 6
  childCareLeaveUnder5?: number; // default 6 days/year
  childCareLeave5to15?: number; // default 3 days/year
  enableMaternityChildCare?: boolean;
}

export interface UserHoliday {
  id: string;
  userId: string;
  holidayName: string;
  holidayDate: string;
  year: number;
}

export interface AttendanceSettings {
  office: StaffAttendanceRules;
  field: StaffAttendanceRules;
  site: StaffAttendanceRules;
  admin?: StaffAttendanceRules;
  management?: StaffAttendanceRules;
  missedCheckoutConfig?: {
    enabledGroups: ('office' | 'field' | 'site' | 'admin' | 'management')[];
    enabledRoles?: string[]; // Deprecated in favor of roleMapping
    roleMapping?: {
      office: string[];
      field: string[];
      site: string[];
      admin?: string[];
      management?: string[];
    };
  };
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: 'office' | 'field' | 'site' | 'admin' | 'management';
}

export interface AttendanceViolation {
  id: string;
  userId: string;
  violationDate: string; // ISO String
  type: string; // Legacy field
  violationType?: string; // e.g. 'LATE_PUNCH_IN', 'GEO_FENCE_VIOLATION'
  violationDetails?: any; // JSONB for expected vs actual
  severity?: 'Low' | 'Medium' | 'High';
  reason?: string;
  locationName?: string | null;
  attemptedLatitude?: number | null;
  attemptedLongitude?: number | null;
  assignedGeofenceId?: string | null;
  distanceFromGeofence?: number | null; // meters
  violationMonth: string; // 'YYYY-MM'
  adminNote?: string | null;
  createdAt: string; // ISO String
}

export interface AttendanceUnlockRequest {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string; // ISO String
  managerId?: string;
  respondedAt?: string; // ISO String
  rejectionReason?: string;
}

export interface ViolationReset {
  id: string;
  userId: string;
  resetMonth: string; // 'YYYY-MM'
  previousViolationCount: number;
  resetBy: string; // admin user id
  resetReason: string;
  createdAt: string; // ISO String
}

// Field Staff Site/Travel Violations
export interface FieldAttendanceViolation {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  
  // Time breakdown
  totalHours: number;
  siteHours: number;
  travelHours: number;
  sitePercentage: number;
  travelPercentage: number;
  siteVisits?: number;
  
  // Violation details
  violationType: 'site_time_low' | 'insufficient_hours' | string;
  violationDetails?: any; // JSONB for breakdown, expected vs actual
  severity?: 'Low' | 'Medium' | 'High';
  requiredSitePercentage: number;
  
  // Workflow
  status: 'pending' | 'acknowledged' | 'escalated';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  managerNotes?: string;
  
  // Escalation
  userReason?: string;
  escalatedTo?: string;
  escalatedAt?: string;
  escalationLevel: number; // 0=direct manager, 1=HR/Admin
  
  // Impacts
  affectsSalary: boolean;
  affectsPerformance: boolean;
  attendanceGranted: boolean; // True after acknowledgment grants (P) status
  
  createdAt: string;
  updatedAt: string;
}


export interface GeofencingSettings {
  enabled: boolean;
  maxViolationsPerMonth: number;
}


export type DailyAttendanceStatus = 'Present' | 'Half Day' | 'Absent' | 'Holiday' | 'Weekend' | 'Incomplete' | 'On Leave (Full)' | 'On Leave (Half)';

export interface DailyAttendanceRecord {
  date: string; // YYYY-MM-DD
  day: string; // 'Monday', etc.
  checkIn: string | null; // "HH:mm"
  checkOut: string | null; // "HH:mm"
  duration: string | null; // "HHh MMm"
  status: DailyAttendanceStatus;
}

// Types for Leave Management
export type LeaveType = 'Earned' | 'Sick' | 'Floating' | 'Comp Off' | 'Loss of Pay' | 'Maternity' | 'Child Care' | 'Pink Leave' | 'WFH' | 'Correction';
export type LeaveRequestStatus = 'pending_manager_approval' | 'pending_hr_confirmation' | 'pending_admin_correction' | 'correction_made' | 'approved' | 'rejected' | 'cancelled' | 'withdrawn';

export interface ApprovalRecord {
  approverId: string;
  approverName: string;
  approverPhotoUrl?: string | null;
  status: 'approved' | 'rejected';
  timestamp: string;
  comments?: string;
}

export interface CompOffLog {
  id: string;
  userId: string;
  userName?: string;
  dateEarned: string; // YYYY-MM-DD
  reason: string;
  status: 'earned' | 'used' | 'expired';
  leaveRequestId?: string | null;
  grantedById?: string;
  grantedByName?: string;
}

export interface LeaveBalance {
  userId: string;
  [key: string]: any; // Broadened to allow debug and other dynamic fields
  earnedTotal: number;
  earnedUsed: number;
  earnedPending: number;
  sickTotal: number;
  sickUsed: number;
  sickPending: number;
  floatingTotal: number;
  floatingUsed: number;
  floatingPending: number;
  compOffTotal: number;
  compOffUsed: number;
  compOffPending: number;
  maternityTotal: number;
  maternityUsed: number;
  maternityPending: number;
  childCareTotal: number;
  childCareUsed: number;
  childCarePending: number;
  pinkTotal: number;
  pinkUsed: number;
  pinkPending: number;
  otHoursThisMonth: number;
  expiryStates?: {
    earned: boolean;
    sick: boolean;
    floating: boolean;
    compOff: boolean;
  };
  debug?: {
    staffType?: string;
    countableDays?: number;
    hasEarnedRule?: boolean;
    day17IsFloating?: boolean;
    hasSettings?: boolean;
    officeRules?: boolean;
    fieldRules?: boolean;
    earnedRule?: any;
    openingDate?: string;
    asOfDate?: string;
    processedLeaves?: any[];
    monthsElapsed?: number;
  };
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  status: LeaveRequestStatus;
  dayOption?: 'full' | 'half'; // for single-day leave requests
  currentApproverId: string | null;
  currentApproverName?: string | null;
  currentApproverPhotoUrl?: string | null;
  approvalHistory: ApprovalRecord[];
  doctorCertificate?: UploadedFile | null;
}

export interface ExtraWorkLog {
  id: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  workDate: string; // YYYY-MM-DD
  workType: 'Holiday' | 'Week Off' | 'Night Shift';
  claimType: 'OT' | 'Comp Off';
  hoursWorked?: number | null;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approverId?: string | null;
  approverName?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
}

// =============================================
// Device Management Types
// =============================================

export type DeviceType = 'web' | 'android' | 'ios';
export type DeviceStatus = 'active' | 'pending' | 'revoked';
export type DeviceRequestStatus = 'pending' | 'approved' | 'rejected';
export type DeviceActivityType = 'login' | 'logout' | 'blocked_attempt' | 'registration';

/**
 * Device information captured from the user agent or device API
 */
export interface DeviceInfo {
  // Browser/Platform info
  userAgent?: string;
  platform?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  
  // Device specific (for mobile apps)
  deviceModel?: string;
  manufacturer?: string;
  hardwareModel?: string; // Specific model number (e.g. SM-G991B)
  uuid?: string; // Capacitor Device ID
  
  // Screen info
  screenResolution?: string;
  colorDepth?: number;
  
  // Network info
  ipAddress?: string;
  connectionType?: string; // wifi, cellular, etc.
  
  // Fingerprint components (for web)
  canvas?: string;
  webgl?: string;
  fonts?: string[];
  plugins?: string[];
  timezone?: string;
  language?: string;

  // Status info
  batteryLevel?: number;
  isCharging?: boolean;
  appVersion?: string;
  androidId?: string; // Specifically for Android
}

/**
 * Registered device for a user
 */
export interface UserDevice {
  id: string;
  userId: string;
  deviceType: DeviceType;
  deviceIdentifier: string; // Unique fingerprint or device ID
  deviceName: string; // User-friendly name like "Chrome on Windows" or "iPhone 14"
  deviceInfo: DeviceInfo;
  status: DeviceStatus;
  registeredAt: string; // ISO timestamp
  lastUsedAt: string; // ISO timestamp
  approvedById?: string | null;
  approvedByName?: string; // Derived on client
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Device approval request when exceeding limits
 */
export interface DeviceChangeRequest {
  id: string;
  userId: string;
  userName?: string; // Derived on client
  userPhotoUrl?: string; // Derived on client
  reportingManagerName?: string; // Derived on client
  deviceType: DeviceType;
  deviceIdentifier: string;
  deviceName: string;
  deviceInfo: DeviceInfo;
  status: DeviceRequestStatus;
  requestedAt: string; // ISO timestamp
  reviewedById?: string | null;
  reviewedByName?: string; // Derived on client
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  reportingManagerNotified: boolean;
  createdAt: string;
  updatedAt: string;
  // Derived fields
  currentDeviceCount?: number; // Number of active devices of this type
}

/**
 * Activity log for device usage
 */
export interface DeviceActivityLog {
  id: string;
  userId: string;
  deviceId?: string | null;
  deviceName?: string; // Derived from device_id
  activityType: DeviceActivityType;
  timestamp: string; // ISO timestamp
  ipAddress?: string | null;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  } | null;
  deviceInfo?: DeviceInfo;
  createdAt: string;
}

/**
 * Device limits configuration (extends StaffAttendanceRules)
 */
export interface DeviceLimitsConfig {
  web: number;
  android: number;
  ios: number;
}

// Types for Task Management
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'To Do' | 'In Progress' | 'Done';
export type EscalationStatus = 'None' | 'Level 1' | 'Level 2' | 'Email Sent';

export interface Task {
  id: string;
  name: string;
  description?: string;
  dueDate?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string; // ISO String
  assignedToId?: string;
  assignedToName?: string;
  completionNotes?: string;
  completionPhoto?: UploadedFile | null;
  escalationStatus: EscalationStatus;
  escalationLevel1UserId?: string;
  escalationLevel1DurationDays?: number;
  escalationLevel2UserId?: string;
  escalationLevel2DurationDays?: number;
  escalationEmail?: string;
  escalationEmailDurationDays?: number;
}

// Types for Notifications
// Extend notification types with a generic 'greeting' type used for welcome
// and greeting notifications.  Existing types are preserved for backwards
// compatibility.  Notifications of type 'greeting' are used when users
// first log in or out to send friendly welcome/goodbye messages.
export type NotificationType =
  | 'task_assigned'
  | 'task_escalated'
  | 'provisional_site_reminder'
  | 'security'
  | 'info'
  | 'warning'
  | 'greeting'
  | 'approval_request'
  | 'emergency_broadcast'
  | 'emergency'
  | 'direct_ping';

export interface Notification {
  id: string;
  userId: string;
  title?: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string; // ISO String
  linkTo?: string; // e.g., '/tasks'
  link?: string; // Alternative property name for link
  severity?: 'Low' | 'Medium' | 'High';
  metadata?: any;
  acknowledgedAt?: string | null;
}

export interface CommunicationLog {
  id: string;
  senderId: string;
  receiverId: string;
  type: 'call' | 'sms' | 'whatsapp' | 'ping';
  metadata?: any;
  createdAt: string;
}

export interface NotificationRule {
  id: string;
  eventType: string;
  recipientRole?: string;
  recipientUserId?: string;
  isEnabled: boolean;
  sendAlert: boolean;
  sendPush: boolean;
  sendEmail?: boolean;
  emailTemplateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomatedNotificationRule {
  id: string;
  name: string;
  description?: string;
  triggerType: 'missed_punch_out' | 'late_arrival' | string;
  targetCategory?: string;
  isActive: boolean;
  config: {
    time?: string;
    frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    dayOfWeek?: number; // 0-6
    dayOfMonth?: number; // 1-31
    monthOfYear?: number; // 1-12
    durationMinutes?: number; // For "lasts for X duration" logic
    chainedRuleId?: string; // Rule to trigger after this one
    notifyManager?: boolean; // Also notify the reporting manager
    [key: string]: any;
  };
  pushTitleTemplate?: string;
  pushBodyTemplate?: string;
  smsTemplate?: string;
  enablePush: boolean;
  enableSms: boolean;
  enableEmail?: boolean;
  emailTemplateId?: string;
  maxAlerts?: number;
  cooldownMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledNotification {
  id: string;
  title?: string;
  message: string;
  type?: string;
  targetRole?: string;
  targetUserIds?: string[];
  scheduledAt: string;
  isSent: boolean;
  createdAt: string;
  createdBy?: string;
  processedAt?: string;
}

// Manpower Details Type
export interface ManpowerDetail {
  designation: string;
  count: number;
}

// Back Office ID Series Type
export interface BackOfficeIdSeries {
  id: string;
  department: string;
  designation: string;
  permanentId: string;
  temporaryId: string;
}

// Site Staff Designation Type
export interface SiteStaffDesignation {
  id: string;
  department: string;
  designation: string;
  permanentId: string;
  temporaryId: string;
  monthlySalary?: number | null;
}

export interface SiteStaff {
  id: string;
  siteId: string;
  name: string;
  employeeCode: string;
  designation: string;
}

// Asset Management Types
export type AssetCondition = 'New' | 'Used' | '';
export type DamageStatus = 'With Damages' | 'Without Damages' | '';

export interface PhoneAsset {
  id: string;
  type: 'Phone';
  brand: string | null;
  condition: AssetCondition | null;
  chargerStatus: 'With Charger' | 'Without Charger' | '' | null;
  displayStatus: DamageStatus | null;
  bodyStatus: DamageStatus | null;
  imei: string | null;
  color: string | null;
  picture?: UploadedFile | null;
}

export interface SimAsset {
  id: string;
  type: 'Sim';
  number: string | null;
}

export interface ComputerAsset {
  id: string;
  type: 'Computer';
  computerType: 'Laptop' | 'Desktop' | 'Tab' | '' | null;
  brand: string | null;
  condition: AssetCondition | null;
  bagStatus: 'With Bag' | 'Without Bag' | '' | null;
  mouseStatus: 'With Mouse' | 'Without Mouse' | '' | null;
  chargerStatus: 'With Charger' | 'Without Charger' | '' | null;
  displayStatus: DamageStatus | null;
  bodyStatus: DamageStatus | null;
  serialNumber: string | null;
  windowsKey: string | null;
  officeStatus: 'With Office' | 'Without Office' | '' | null;
  antivirusStatus: 'With Antivirus' | 'Without Antivirus' | '' | null;
  picture?: UploadedFile | null;
}

export interface IdCardAsset {
  id: string;
  type: 'IdCard';
  issueDate: string | null;
}

export interface PetrocardAsset {
  id: string;
  type: 'Petrocard';
  number: string | null;
}

export interface VehicleAsset {
  id: string;
  type: 'Vehicle';
  vehicleType: 'Bicycle' | 'Two Wheeler' | 'Three Wheeler' | 'Four Wheeler' | '' | null;
  brand: string | null;
  dlNumber: string | null;
  dlFrontPic?: UploadedFile | null;
  dlBackPic?: UploadedFile | null;
  condition: AssetCondition | null;
  kmsAtIssue: number | null;
  vehicleNumber: string | null;
  chassisNumber: string | null;
  insuranceValidity: string | null;
  pollutionCertValidity: string | null;
  finesStatus: 'Existing' | 'Nil' | '' | null;
  picture?: UploadedFile | null;
}

export interface ToolAssetItem {
  id: string;
  name: string | null;
  description: string | null;
  quantity: number | null;
}

export interface ToolsAsset {
  id: string;
  type: 'Tools';
  toolList: ToolAssetItem[] | null;
  picture?: UploadedFile | null;
}

export interface OtherAsset {
  id: string;
  type: 'Other';
  name: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  condition: AssetCondition | null;
  issueCondition: string | null;
  accessories: string | null;
  picture?: UploadedFile | null;
}

export type Asset = PhoneAsset | SimAsset | ComputerAsset | IdCardAsset | PetrocardAsset | VehicleAsset | ToolsAsset | OtherAsset;

// Types for Master Tools List
export interface MasterTool {
  id: string;
  name: string;
}

export type MasterToolsList = {
  [category: string]: MasterTool[];
};

// Types for Gents Uniform Chart
export interface GentsPantsSize {
  id: string;
  size: string;
  length: number;
  waist: number;
  hip: number;
  tilesLoose: number;
  bottomWaist: number;
  fit: 'Slim Fit' | 'Regular Fit' | 'Plump Fit';
}

export interface GentsShirtSize {
  id: string;
  size: string;
  length: number;
  sleeves: number;
  sleevesLoose: number;
  chest: number;
  halfChestLoose: number;
  shoulder: number;
  collar: number;
  fit: 'Slim Fit' | 'Regular Fit' | 'Plump Fit';
}

export interface MasterGentsUniforms {
  pants: GentsPantsSize[];
  shirts: GentsShirtSize[];
}

export interface UniformDesignationConfig {
  id: string;
  designation: string;
  pantsQuantities: Record<string, number | null>; // key is GentsPantsSize id
  shirtsQuantities: Record<string, number | null>; // key is GentsShirtSize id
}

export interface UniformDepartmentConfig {
  id: string;
  department: string;
  designations: UniformDesignationConfig[];
}

export interface SiteGentsUniformConfig {
  organizationId: string;
  departments: UniformDepartmentConfig[];
}

// Types for Ladies Uniform Chart
export interface LadiesPantsSize {
  id: string;
  size: string;
  length: number;
  waist: number;
  hip: number;
  fit: 'Slim Fit' | 'Regular Fit' | 'Comfort Fit';
}

export interface LadiesShirtSize {
  id: string;
  size: string;
  length: number;
  sleeves: number;
  bust: number;
  shoulder: number;
  fit: 'Slim Fit' | 'Regular Fit' | 'Comfort Fit';
}

export interface MasterLadiesUniforms {
  pants: LadiesPantsSize[];
  shirts: LadiesShirtSize[];
}

export interface LadiesUniformDesignationConfig {
  id: string;
  designation: string;
  pantsQuantities: Record<string, number | null>; // key is LadiesPantsSize id
  shirtsQuantities: Record<string, number | null>; // key is LadiesShirtSize id
}

export interface LadiesUniformDepartmentConfig {
  id: string;
  department: string;
  designations: LadiesUniformDesignationConfig[];
}

export interface SiteLadiesUniformConfig {
  organizationId: string;
  departments: LadiesUniformDepartmentConfig[];
}

// Types for Uniform Details
export interface UniformItem {
  id: string;
  name: string;
}

export interface UniformDetailDesignation {
  id: string;
  designation: string;
  items: UniformItem[];
}

export interface UniformDetailDepartment {
  id: string;
  department: string;
  designations: UniformDetailDesignation[];
}

export interface SiteUniformDetailsConfig {
  organizationId: string;
  departments: UniformDetailDepartment[];
}

// Types for Billing & Invoicing
export interface InvoiceLineItem {
  id: string;
  description: string;
  deployment: number;
  noOfDays: number;
  ratePerDay: number;
  ratePerMonth: number;
}

export interface InvoiceData {
  siteName: string;
  siteAddress: string;
  invoiceNumber: string;
  invoiceDate: string;
  statementMonth: string;
  lineItems: InvoiceLineItem[];
}

export interface BillingRates {
  [designation: string]: {
    ratePerDay: number;
    ratePerMonth: number;
  }
}

export interface PerfiosApiSettings {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
}

export interface GeminiApiSettings {
  enabled: boolean;
}

export interface OfflineOcrSettings {
  enabled: boolean;
}

export interface VerificationResult {
  success: boolean;
  message: string;
  verifiedFields: {
    name: boolean | null;
    dob: boolean | null;
    aadhaar: boolean | null;
    bank: boolean | null;
    uan: boolean | null;
    esi: boolean | null;
    // Fix: Add optional fields for detailed bank verification
    accountHolderName?: boolean | null;
    accountNumber?: boolean | null;
    ifscCode?: boolean | null;
  };
}

export interface PerfiosVerificationData {
  name: string;
  dob: string;
  aadhaar: string | null;
  pan: string | null;
  bank: {
    accountNumber: string;
    ifsc: string;
  };
  uan: string | null;
  esi: string | null;
}

// Types for Uniform Management
export interface UniformRequestItem {
  sizeId: string;
  sizeLabel: string;
  fit: string;
  category: 'Pants' | 'Shirts';
  quantity: number;
}

export interface UniformRequest {
  id: string;
  siteId: string;
  siteName: string;
  gender: 'Gents' | 'Ladies';
  requestedDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Issued';
  items: UniformRequestItem[];
  source?: 'Bulk' | 'Enrollment' | 'Individual';
  requestedById?: string;
  requestedByName?: string;
  employeeDetails?: {
    employeeName: string;
    employeeId: string;
    items: {
      itemName: string;
      sizeLabel: string;
      fit: string;
      quantity: number;
    }[];
  }[];
}


// Types for Verification Costing
export interface VerificationCostSetting {
  id: string;
  name: string;
  cost: number;
}

export type VerificationCosts = VerificationCostSetting[];

export interface VerificationUsageItem {
  name: string;
  count: number;
  cost?: number; // Calculated on the frontend
}

export interface SubmissionCostBreakdown {
  id: string;
  employeeId: string;
  employeeName: string;
  enrollmentDate: string;
  totalCost: number;
  breakdown: VerificationUsageItem[];
}

// Types for Support Desk
export interface TicketComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string; // ISO String
}

export interface TicketPost {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string; // ISO String
  likes: string[]; // Array of user IDs
  comments: TicketComment[];
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: 'Software Developer' | 'Admin' | 'Operational' | 'HR Query' | 'Other';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'In Progress' | 'Pending Requester' | 'Resolved' | 'Closed';
  raisedById: string;
  raisedByName: string;
  raisedAt: string; // ISO String
  assignedToId: string | null;
  assignedToName: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  rating: number | null;
  feedback: string | null;
  attachmentUrl?: string | null;
  posts: TicketPost[];
}

// Types for Smart Field Reporting
export type ChecklistItemType = 'yes_no_na' | 'numeric' | 'text';

export interface ChecklistItem {
  id: string;
  label: string;
  type: ChecklistItemType;
  required: boolean;
}

export interface ChecklistSection {
  id: string;
  title: string;
  icon: string;
  items: ChecklistItem[];
}

export type FieldReportJobType = 
    | 'PPM' 
    | 'Breakdown/Repair' 
    | 'Site Training' 
    | 'Site Visit' 
    | 'Meeting with Association' 
    | 'Site Inspection';

export interface ChecklistTemplate {
  id: string;
  jobType: FieldReportJobType;
  assetCategory?: string;
  version: number;
  sections: ChecklistSection[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}
export interface FieldReportResponse {
  value: string | number;
  remarks?: string;
  reasonId?: string;
  photoUrls?: string[];
}

export interface FieldReportEvidence {
  url: string;
  type: 'image' | 'pdf';
  timestamp: string;
  lat?: number;
  lng?: number;
  category: 'before' | 'after' | 'incident' | 'general';
}

export interface FieldReport {
  id: string;
  attendanceEventId: string;
    templateId: string;
    userId: string;
    
    // Context
    siteName: string;
    jobType: FieldReportJobType;
    assetArea: string;
  visitStartTime: string;
  visitEndTime: string;
  
  // Content
  responses: Record<string, FieldReportResponse>;
  evidence: FieldReportEvidence[];
  summary: string;
  userRemarks: string;
  
  createdAt: string;
}

export interface GmcSubmission {
  id: string;
  employeeName: string;
  companyName: string;
  siteName: string;
  dob: string;
  gender: string;
  contactNumber: string;
  maritalStatus: string;
  spouseName?: string | null;
  spouseContact?: string | null;
  fatherName?: string | null;
  fatherDob?: string | null;
  motherName?: string | null;
  motherDob?: string | null;
  children?: any[] | null;
  planName: string;
  premiumAmount: number;
  acknowledged: boolean;
  employeeId: string;
  dateOfJoining: string;
  designation: string;
  fatherGender?: string | null;
  motherGender?: string | null;
  spouseDob?: string | null;
  spouseGender?: string | null;
  updatedAt: string;
}

export interface SiteAttendanceRecord {
  id: string;
  siteId: string;
  siteName: string;
  billingDate: string;
  contractAmount: number;
  contractManagementFee: number;
  billedAmount: number;
  billedManagementFee: number;
  billingDifference: number;
  managementFeeDifference: number;
  variationStatus: 'Profit' | 'Loss';
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteInvoiceRecord {
  id: string;
  sNo: number;
  siteId: string;
  siteName: string;
  companyName: string;
  billingCycle: string;
  opsRemarks: string;
  hrRemarks: string;
  financeRemarks: string;
  opsIncharge: string;
  hrIncharge: string;
  invoiceIncharge: string;

  // Attendance Status of Managers
  managerTentativeDate: string;
  managerReceivedDate: string;

  // Attendance Status of HR
  hrTentativeDate: string;
  hrReceivedDate: string;
  attendanceReceivedTime: string;

  // Invoice Status
  invoiceSharingTentativeDate: string;
  invoicePreparedDate: string;
  invoiceSentDate: string;
  invoiceSentTime: string;
  invoiceSentMethodRemarks: string;

  createdBy?: string;
  createdByName?: string;
  createdByRole?: string;
  createdAt?: string;
  updatedAt?: string;

  // soft delete
  deletedAt?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedReason?: string;
  revisionCount?: number;
}

export interface RevisionLog {
  id: string;
  recordId: string;
  revisedBy?: string;
  revisedByName?: string;
  revisedAt: string;
  diff: Record<string, { old: any; new: any }>;
  revisionNumber: number;
}

export interface SiteInvoiceDefault {
  id?: string;
  siteId: string;
  siteName: string;
  companyName?: string;
  contractAmount?: number;
  contractManagementFee?: number;
  billingYear?: number | null; // Null means "Applicable to all years unless overridden"
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteFinanceRecord {
  id: string;
  siteId: string;
  siteName: string;
  companyName?: string;
  billingMonth: string; // YYYY-MM-DD
  
  contractAmount: number;
  contractManagementFee: number;
  billedAmount: number;
  billedManagementFee: number;
  
  totalBilledAmount: number; // Generated (C+D)
  
  remarks?: string;
  status: 'pending' | 'approved' | 'invoiced';
  createdBy?: string;
  createdByName?: string;
  createdByRole?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;

  // Deletion tracking
  deletedAt?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedReason?: string;
  revisionCount?: number;
}

// =============================================
// Employee Scoring System Types
// =============================================

export type RoleCategory = 'office_staff' | 'field_staff' | 'support';

export interface RoleWeights {
  performance: number; // 0-1
  attendance: number;  // 0-1
  response: number;    // 0-1
}

export interface EmployeeScore {
  id: string;
  userId: string;
  month: string; // YYYY-MM-01
  performanceScore: number; // 0-100
  attendanceScore: number;  // 0-100
  responseScore: number;    // 0-100
  overallScore: number;     // 0-100 (weighted)
  tiebreakerScore: number;  // Total clocked-in minutes per month
  roleCategory: RoleCategory;
  calculatedAt: string; // ISO timestamp
  createdAt: string;
}

// =============================================
// Costing & Resource Configuration Types
// =============================================

export type CostingStatus = 'Draft' | 'Approved';
export type BillingCycle = 'Monthly' | 'Weekly';
export type BillingModel = 'Per Month' | 'Per Day' | 'Per Hour' | 'Lumpsum';
export type UnitType = 'Manpower' | 'Duty' | 'Visit' | 'Days' | 'Actuals' | 'Lumpsum';
export type ShiftType = 'General' | '1st Shift' | '2nd Shift' | '3rd Shift' | '4th Shift';

export interface ResourceShift {
  name: string;
  startTime: string;
  endTime: string;
}

export interface CostingResource {
  id: string;
  department: string;
  designation: string;
  costCentre: string;
  unitType: UnitType;
  quantity: number | null;
  billingRate: number | null;
  billingModel: BillingModel;
  total: number;

  // Working Hours & Shifts
  workingHoursStart: string;
  workingHoursEnd: string;
  shiftType: ShiftType;
  shifts: ResourceShift[];
  openShiftAllowed: boolean;

  // Weekly Off
  weeklyOffApplicable: boolean;
  weeklyOffType: string;

  // Leave
  leaveApplicable: boolean;
  earnedLeaveCount: number | null;
  sickLeaveCount: number | null;

  // Holiday
  holidayBillingRule: string;
  holidayPaymentRule: string;

  // Duty Rules
  dutyRule: string;

  // Uniform Deduction
  uniformDeduction: boolean;
  uniformDeductionNote: string;

  // Verifications
  employmentVerification: boolean;
  backgroundVerification: boolean;
  policeVerification: boolean;
}

export interface AdditionalCharge {
  id: string;
  chargeName: string;
  chargeType: string;
  amount: number;
  frequency: string;
}

export interface SiteCostingMaster {
  id: string;
  siteId: string;
  siteName?: string;
  clientName?: string;
  effectiveFrom: string;
  effectiveTo: string;
  billingCycle: BillingCycle;
  adminChargePercent: number;
  adminChargeApplicable?: boolean;
  status: CostingStatus;
  versionNo: number;
  resources: CostingResource[];
  additionalCharges: AdditionalCharge[];
  createdAt?: string;
  updatedAt?: string;
}
