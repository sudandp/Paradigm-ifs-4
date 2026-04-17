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
