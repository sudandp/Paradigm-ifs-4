import type { ComponentType } from 'react';
// Auto-generated barrel file

export * from './user';
export * from './organization';
export * from './onboarding';
export * from './settings';
export * from './attendance';
export * from './common';

import { UploadedFile } from './common';

// Unmapped legacy types

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

export interface Policy {
  id: string;
  name: string;
  description?: string;
  fileUrl?: string;
}

export type DeviceType = 'web' | 'android' | 'ios';

export type DeviceStatus = 'active' | 'pending' | 'revoked';

export type DeviceRequestStatus = 'pending' | 'approved' | 'rejected';

export type DeviceActivityType = 'login' | 'logout' | 'blocked_attempt' | 'registration';

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

export * from './asset';

// Types for Master Tools List

export interface MasterTool {
  id: string;
  name: string;
}

export type MasterToolsList = {
  [category: string]: MasterTool[];
};


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
  cost?: number;
}

export interface UniformRequest {
  id: string;
  siteId: string;
  siteName: string;
  department?: string;
  designation?: string;
  gender: 'Gents' | 'Ladies';
  requestedDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Issued';
  items: UniformRequestItem[];
  totalCost?: number;
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
