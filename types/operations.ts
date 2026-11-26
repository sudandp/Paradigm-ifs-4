// Operations Module Type Definitions

// ============================================================================
// Tickets & SLAs
// ============================================================================

export type TicketCategory =
  | 'Electrical'
  | 'Plumbing'
  | 'Housekeeping'
  | 'Security'
  | 'Civil'
  | 'HVAC'
  | 'General';

export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';

export type TicketStatus = 'Open' | 'In Progress' | 'On Hold' | 'Resolved' | 'Closed';

export interface OpsTicket {
  id: string;
  organizationId?: string;
  entityId: string;
  entityName?: string; // Joined from entities
  
  ticketNumber?: string;
  title: string;
  description?: string;
  category: TicketCategory;
  
  priority: TicketPriority;
  status: TicketStatus;
  
  dueDate?: string;
  resolvedAt?: string;
  
  assignedTo?: string;
  assignedToName?: string; // Joined from users
  
  reportedByName?: string;
  reportedByPhone?: string;

  // Unit / Resident Context
  unitNumber?: string;
  residentName?: string;
  residentPhone?: string;

  // SLA Timestamps & Escalation Engine
  responseDueAt?: string;
  resolutionDueAt?: string;
  firstRespondedAt?: string;
  isEscalated?: boolean;
  escalationLevel?: number; // 0=None, 1=FM, 2=Society Manager, 3=Management Committee

  // Resident Closure OTP & Admin Override
  closureOtp?: string;
  closureOtpExpiresAt?: string;
  closureVerifiedAt?: string;
  adminOverride?: boolean;
  adminOverrideReason?: string;
  adminOverridePhotoUrl?: string;

  // Resident Feedback & Service Rating (1-5 Stars)
  rating?: number;
  feedbackTags?: string[];
  feedbackComment?: string;
  
  // Asset PPM Work Order Linkage
  assetId?: string;
  assetCode?: string;
  ppmLogId?: string;
  
  attachments: string[];

  // Omnichannel intake (WhatsApp helpdesk bot)
  sourceChannel?: TicketSourceChannel | null;
  channelSiteId?: string | null;
  channelSiteName?: string; // Joined from channel_sites.display_name
  tower?: string | null;
  floor?: string | null;
  area?: string | null;
  issueType?: string | null;
  reporterContactId?: string | null;
  reporterContactName?: string; // Joined from channel_contacts.display_name
  reporterContactPhone?: string; // Joined from channel_contacts.phone
  reportCount?: number;
  etaAt?: string | null;
  pendingReason?: string | null;
  proofRequired?: boolean;
  extractionConfidence?: number | null;

  // Helpdesk assignment / ETA / closure (20261126090000_helpdesk_assignment_eta_closure)
  assignedAt?: string | null;
  assignmentNote?: string | null; // e.g. 'No technician on site – assigned to supervisor'
  reopenCount?: number;
  clientConfirmedAt?: string | null;
  resolutionNote?: string | null;

  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export type TicketSourceChannel = 'app' | 'whatsapp' | 'telegram' | 'email' | (string & {});

export type TicketEventType =
  | 'created'
  | 'duplicate_report'
  | 'priority_bumped'
  | 'media_added'
  | 'assigned'
  | 'eta_set'
  | 'eta_changed'
  | 'on_hold'
  | 'reassigned'
  | 'resolved'
  | 'client_confirmed'
  | 'reopened'
  | 'auto_closed'
  | 'escalated'
  | 'assignment_failed'
  | 'assignee_checked_out'
  | 'message'
  | (string & {});

export interface TicketEvent {
  id: string;
  ticketId: string;
  eventType: TicketEventType;
  actorUserId?: string | null;
  actorUserName?: string;
  actorContactId?: string | null;
  actorContactName?: string;
  inboundMessageId?: string | null;
  payload: Record<string, any>;
  isInternal: boolean;
  createdAt: string;
}

/** Row from helpdesk_present_staff(p_site_id): staff punched in at / assigned to the site right now. */
export interface HelpdeskPresentStaff {
  userId: string;
  name: string;
  roleId?: string | null;
  lastInAt?: string | null;
  tier?: 'technician' | 'supervisor' | 'manager' | string | null;
  categories?: string[] | null;
  openTickets: number;
}

export type HelpdeskActAction = 'work' | 'reassign';

export interface TicketReporter {
  ticketId: string;
  contactId: string;
  displayName?: string;
  phone?: string;
  channel?: string;
  reportedAt: string;
}

export type TicketMediaKind = 'before' | 'progress' | 'after';

export interface TicketMedia {
  id: string;
  ticketId: string;
  kind: TicketMediaKind;
  storagePath: string;
  mimeType?: string | null;
  signedUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
}

export interface ChannelSiteOption {
  id: string;
  displayName: string;
  siteCode?: string;
}

export interface HelpdeskSlaPolicy {
  id: string;
  organizationId?: string;
  entityId?: string;
  priority: TicketPriority;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  escalateToRoleId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Preventive Maintenance (PPM)
// ============================================================================

export type MaintenanceFrequency =
  | 'Daily'
  | 'Weekly'
  | 'Fortnightly'
  | 'Monthly'
  | 'Quarterly'
  | 'Half-Yearly'
  | 'Yearly';

export type MaintenanceStatus = 'Active' | 'Paused' | 'Discontinued';

export interface OpsMaintenanceSchedule {
  id: string;
  organizationId?: string;
  entityId: string;
  entityName?: string;
  
  taskName: string;
  description?: string;
  category?: TicketCategory;
  
  assetReference?: string;
  
  frequency: MaintenanceFrequency;
  lastCompletedDate?: string;
  nextDueDate?: string;
  
  status: MaintenanceStatus;
  assignedRole?: string;
  
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type MaintenanceLogStatus = 'Completed' | 'Skipped' | 'Delayed';

export interface OpsMaintenanceLog {
  id: string;
  scheduleId: string;
  
  completedDate: string;
  completedBy?: string;
  completedByName?: string;
  
  remarks?: string;
  photoUrls: string[];
  
  status: MaintenanceLogStatus;
  createdAt: string;
}

// ============================================================================
// Contract Management
// ============================================================================

export type ContractType =
  | 'Client Agreement'
  | 'Vendor AMC'
  | 'Lease'
  | 'Service Level Agreement'
  | 'Other';

export type ContractStatus =
  | 'Active'
  | 'Expiring Soon'
  | 'Expired'
  | 'Renewed'
  | 'Terminated';

export interface OpsContract {
  id: string;
  organizationId?: string;
  entityId: string;
  entityName?: string;
  
  contractTitle: string;
  contractType: ContractType;
  
  vendorName?: string;
  
  startDate: string;
  endDate: string;
  contractValue: number;
  
  status: ContractStatus;
  renewalReminderDays: number;
  
  documentUrl?: string;
  notes?: string;

  // Vendor Contact & Contract Particulars
  vendorContactPerson?: string;
  vendorPhone?: string;
  vendorEmail?: string;
  paymentFrequency?: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Annually' | 'One-Time';
  scopeOfWork?: string;
  slaResponseTimeHours?: number;
  slaResolutionTimeHours?: number;
  coveredAssetIds?: string[];
  autoRenewal?: boolean;
  
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Snag Audits
// ============================================================================

export type Criticality = 'High' | 'Medium' | 'Low';

export type PurposeOfVisit =
  | 'Monthly Audit'
  | 'Quarterly Audit'
  | 'Breakdown Visit'
  | 'Training'
  | 'Other';

export type Department = 'MEP' | 'House Keeping' | 'Security' | 'Landscaping' | 'Fire and Safety' | 'Other';

export interface SnagEntry {
  id: string;
  timestamp: string;
  emailAddress: string;
  nameOfSite: string;
  purposeOfVisit: PurposeOfVisit[];
  department: Department[];
  snagPictureUrl?: string;
  snagPictureName?: string;
  criticality: Criticality;
  snagDescription: string;
  actionToBeTaken: string;
  remarks?: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  submittedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Inventory & Material Usage
// ============================================================================

export type InventoryCategory =
  | 'Electrical'
  | 'Plumbing'
  | 'HVAC'
  | 'Cleaning'
  | 'Civil'
  | 'Security'
  | 'General';

export interface InventoryItem {
  id: string;
  organizationId?: string;
  entityId?: string;
  entityName?: string;
  itemCode: string;
  name: string;
  category: InventoryCategory;
  unitOfMeasure: string;
  unitCost: number;
  unitSellingPrice: number;
  currentStock: number;
  minReorderLevel: number;
  location?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpsTicketMaterial {
  id: string;
  ticketId: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  category?: InventoryCategory;
  quantityUsed: number;
  unitPrice: number;
  totalPrice: number;
  remarks?: string;
  issuedBy?: string;
  issuedByName?: string;
  createdAt: string;
}

// ============================================================================
// Phase 2: Asset PPM & Equipment Register
// ============================================================================

export type AssetCategory = 
  | 'STP' 
  | 'GENERATOR' 
  | 'LIFT' 
  | 'BOOSTER_PUMPS' 
  | 'WTP' 
  | 'ELECTRICAL_PANEL' 
  | 'HT_YARD' 
  | 'FIRE_FIGHTING';

export type AssetStatus = 
  | 'Operational' 
  | 'Under Maintenance' 
  | 'Critical Fault' 
  | 'Decommissioned';

export interface OpsAsset {
  id: string;
  organizationId?: string;
  entityId?: string;
  entityName?: string;
  
  assetCode: string;
  name: string;
  category: AssetCategory;
  location: string;
  makeModel?: string;
  serialNumber?: string;
  installationDate?: string;
  capacity?: string;
  
  amcVendorName?: string;
  amcExpiryDate?: string;
  
  status: AssetStatus;
  qrCodePayload: string;
  lastInspectedAt?: string;
  
  // Active Work Order Linkage
  activeTicketId?: string;
  activeTicketNumber?: string;
  
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssetPpmParameter {
  id: string;
  label: string;
  unit?: string;
  type: 'NUMBER' | 'PASS_FAIL' | 'TEXT';
  min?: number;
  max?: number;
  desc?: string;
}

export interface AssetPpmChecklist {
  id: string;
  assetCategory: AssetCategory;
  checklistName: string;
  frequency: 'Daily' | 'Weekly' | 'Fortnightly' | 'Monthly' | 'Quarterly' | 'Yearly';
  parameters: AssetPpmParameter[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AssetPpmLog {
  id: string;
  assetId: string;
  checklistId?: string;
  inspectedBy?: string;
  inspectedByName?: string;
  inspectedAt: string;
  qrScanned: boolean;
  parameterReadings: Record<string, any>;
  hasAbnormalities: boolean;
  abnormalityNotes?: string;
  photoUrls: string[];
  ticketId?: string;
  createdAt?: string;
}

