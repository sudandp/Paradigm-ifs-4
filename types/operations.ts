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
  
  attachments: string[];
  
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
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
  
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
