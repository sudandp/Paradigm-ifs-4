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
