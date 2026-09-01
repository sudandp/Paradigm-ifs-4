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
  
  siteSupervisorId?: string | null;
  siteSupervisorName?: string | null;
  
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
  
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteRoutingStats {
  totalSites: number;
  totalOpsManagers: number;
  totalHrIncharges: number;
  totalAccountsIncharges: number;
  unassignedSites: number;
  billingCycleCounts: Record<string, number>;
  companyCounts: Record<string, number>;
}
