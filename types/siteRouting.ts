export interface EscalationTier {
  level: number;
  role: string;
  name: string;
  contact?: string;
  email?: string;
}

export interface RoutingRules {
  daily_attendance_report?: string[];
  missed_punch_alert?: string[];
  invoice_generation_alert?: string[];
  field_audit_tickets?: string[];
  staff_grievance_tickets?: string[];
  [key: string]: string[] | undefined;
}

/** One entry in the per-site incharge change audit trail */
export interface SiteInchargeChangeEntry {
  /** ISO timestamp when the admin pressed "Save Mapping" */
  changedAt: string;
  /** ISO date string (YYYY-MM-DD) from which the new assignments are effective */
  effectiveFrom: string;
  /** Name of the admin who made the change */
  changedBy?: string;
  // Previous values
  previousOpsManager?: string;
  previousHrIncharge?: string;
  previousAccountsIncharge?: string;
  previousSiteManager?: string;
  previousFieldOfficer?: string;
  // New values
  newOpsManager?: string;
  newHrIncharge?: string;
  newAccountsIncharge?: string;
  newSiteManager?: string;
  newFieldOfficer?: string;
}

export interface SiteResponsibilityMatrix {
  id: string;
  siteId?: string | null;
  organizationId?: string | null;
  siteName: string;
  
  // Operational Incharges
  opsManagerId?: string | null;
  opsManagerName: string;
  
  hrInchargeId?: string | null;
  hrInchargeName: string;
  
  accountsInchargeId?: string | null;
  accountsInchargeName: string;
  
  fieldOfficerId?: string | null;
  fieldOfficerName?: string | null;

  siteSupervisorId?: string | null;
  siteSupervisorName?: string | null;
  siteManagerId?: string | null;
  siteManagerName?: string | null;
  
  // Billing & Legal
  billingCompany: string;
  billingCycle: string;
  unitsCount?: number | null;
  takeoverDate?: string | null;
  gstin?: string | null;
  pan?: string | null;
  billingLegalName?: string | null;
  buyerAddress?: string | null;
  voucherType?: string | null;
  
  // Escalation & Automated Routing
  escalationTiers?: EscalationTier[];
  routingRules?: RoutingRules;

  /** ISO date (YYYY-MM-DD): when the current incharge assignments became/become effective */
  effectiveFrom?: string | null;
  /** Full audit trail of incharge changes with their effective dates */
  changeLog?: SiteInchargeChangeEntry[];
  
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteRoutingStats {
  totalSites: number;
  totalOpsManagers: number;
  totalHrIncharges: number;
  totalAccountsIncharges: number;
  totalFieldOfficers?: number;
  totalSiteManagers?: number;
  unassignedSites: number;
  billingCycleCounts: Record<string, number>;
  companyCounts: Record<string, number>;
}

export interface SiteChangeRequest {
  id: string;
  recordType: 'attendance' | 'finance';
  recordId?: string;
  siteName: string;
  companyName?: string;
  targetMonth: string;
  targetYear: string;
  requestType: 'ADD' | 'EDIT' | 'DELETE';
  proposedData: Record<string, any>;
  originalData?: Record<string, any>;
  reason: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole?: string;
  reportingManagerId?: string;
  reportingManagerName?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewComments?: string;
  createdAt?: string;
  updatedAt?: string;
}
