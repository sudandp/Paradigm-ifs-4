// CRM Module Type Definitions

// ============================================================================
// Lead Pipeline
// ============================================================================

export type LeadStatus =
  | 'New Lead'
  | 'Contacted'
  | 'Site Visit Planned'
  | 'Survey Completed'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost'
  | 'Onboarding Started';

export type LeadSource =
  | 'Referral'
  | 'Website'
  | 'Direct'
  | 'Marketing'
  | 'Facebook Ads'
  | 'WhatsApp Campaign'
  | 'Other';

export type PropertyType = 'Residential' | 'Commercial' | 'Mixed Use';

export interface CrmLead {
  id: string;
  organizationId?: string;

  // Client Info
  clientName: string;
  associationName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  source?: LeadSource;

  // Property Info
  propertyType?: PropertyType;
  city?: string;
  location?: string;
  areaSqft?: number;
  builtUpArea?: number;
  superBuiltUpArea?: number;
  towerCount?: number;
  floorCount?: number;
  unitCount?: number;

  // Pipeline
  status: LeadStatus;

  // Existing Vendors
  presentFmsCompany?: string;
  presentSecurityAgency?: string;
  pestControlVendor?: string;
  otherVendors?: { name: string; service: string }[];

  // Assignment
  assignedTo?: string;
  assignedToName?: string;
  expectedStartDate?: string;
  lostReason?: string;
  notes?: string;

  // Conversion
  convertedEntityId?: string;
  convertedAt?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByName?: string;
}

// ============================================================================
// Follow-ups
// ============================================================================

export type FollowupType = 'Call' | 'Meeting' | 'Email' | 'WhatsApp' | 'Site Visit' | 'Other';

export interface CrmFollowup {
  id: string;
  leadId: string;
  type?: FollowupType;
  notes?: string;
  outcome?: string;
  nextFollowupDate?: string;
  reminderSet?: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

// ============================================================================
// Dynamic Checklist Engine
// ============================================================================

export type ChecklistFieldType =
  | 'yes_no'
  | 'yes_no_remarks'
  | 'text'
  | 'number'
  | 'date'
  | 'photo'
  | 'rating_1_5'
  | 'dropdown';

export interface ChecklistFieldDef {
  id: string;
  label: string;
  type: ChecklistFieldType;
  required: boolean;
  options?: string[]; // For dropdown type
}

export interface ChecklistSectionDef {
  id: string;
  name: string;
  fields: ChecklistFieldDef[];
}

export interface CrmChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  version: number;
  isActive: boolean;
  sections: ChecklistSectionDef[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistFieldResponse {
  value: string | number | boolean;
  remarks?: string;
  photoUrls?: string[];
}

export interface CrmChecklistSubmission {
  id: string;
  leadId: string;
  templateId: string;
  data: Record<string, ChecklistFieldResponse>;
  photoUrls: Record<string, string[]>;
  voiceNoteUrl?: string;
  remarks?: string;
  status: 'draft' | 'submitted' | 'reviewed';
  submittedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Statutory Masters
// ============================================================================

export interface CrmStatutoryMaster {
  id: string;
  pfRate: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  bonusRate: number;
  gratuityRate: number;
  edliRate: number;
  adminChargesRate: number;
  lwfEmployee: number;
  lwfEmployer: number;
  esiWageCeiling: number;
  pfWageCeiling: number;
  state?: string;
  city?: string;
  minWages: Record<string, number>; // Category -> Amount
  effectiveFrom?: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Quotations / Proposals
// ============================================================================

export type QuotationStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Sent to Client'
  | 'Accepted'
  | 'Rejected';

export interface ManpowerLineItem {
  role: string;
  department: string;
  count: number;
  salary: number;
  shiftType: string;
  dutyHours: number;
  weeklyOff: string;
  relieverRequired: boolean;
  experienceRequired?: string;
  existingStaffRetention?: number; // percentage
  joiningDate?: string;
}

export interface CrmQuotation {
  id: string;
  leadId: string;
  quotationNumber?: string;
  version: number;
  manpowerDetails: ManpowerLineItem[];

  // Costs
  totalSalaryCost: number;
  statutoryCost: number;
  consumablesCost: number;
  equipmentCost: number;
  uniformCost: number;
  adminCharges: number;
  managementFee: number;
  managementFeePercent: number;
  gstAmount: number;
  gstPercent: number;

  // Totals
  monthlyCost: number;
  annualCost: number;

  // Profitability
  marginAmount: number;
  marginPercent: number;

  // Output
  pdfUrl?: string;

  // Status
  status: QuotationStatus;
  approvedBy?: string;
  approvedAt?: string;
  approvalRemarks?: string;

  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Audit Logs
// ============================================================================

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  module: string;
  recordId?: string;
  action: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  deviceInfo?: string;
  description?: string;
  createdAt: string;
}

// ============================================================================
// Kanban Board Helpers
// ============================================================================

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'New Lead',
  'Contacted',
  'Site Visit Planned',
  'Survey Completed',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
  'Onboarding Started',
];

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  'New Lead': '#3b82f6',
  'Contacted': '#8b5cf6',
  'Site Visit Planned': '#f59e0b',
  'Survey Completed': '#06b6d4',
  'Proposal Sent': '#ec4899',
  'Negotiation': '#f97316',
  'Won': '#10b981',
  'Lost': '#ef4444',
  'Onboarding Started': '#006b3f',
};

// ============================================================================
// Manpower Suggestion Roles (from Excel checklist)
// ============================================================================

export const MANPOWER_ROLES = [
  'Manager',
  'Admin',
  'Helpdesk',
  'Electrician',
  'Plumber',
  'Technician',
  'Housekeeping Supervisor',
  'Housekeeping Staff',
  'Gardener',
  'STP Operator',
  'Security Officer',
  'Security Supervisor',
  'Head Guard',
  'Male Guard',
  'Female Guard',
] as const;

export type ManpowerRole = typeof MANPOWER_ROLES[number];

// ============================================================================
// Manpower Suggestion Algorithm Input/Output
// ============================================================================

export interface ManpowerSuggestionInput {
  areaSqft: number;
  unitCount: number;
  towerCount: number;
  floorCount: number;
  propertyType: PropertyType;
  hasSwimmingPool: boolean;
  hasStp: boolean;
  hasClubHouse: boolean;
}

export interface ManpowerSuggestionOutput {
  role: ManpowerRole;
  suggestedCount: number;
  rationale: string;
}
