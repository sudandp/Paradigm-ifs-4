/**
 * modulePreload.ts — Intelligent Predictive Route Preloading
 *
 * Pre-warms dynamic JavaScript chunks when users hover over sidebar navigation items.
 * By the time the user clicks, the chunk is already cached in memory, delivering
 * instantaneous (0ms perceived latency) navigation across all 23 application modules.
 */

type PreloadFn = () => Promise<any>;

const preloadedRoutes = new Set<string>();

const MODULE_LOADERS: Record<string, PreloadFn> = {
  // CRM & Sales
  '/crm': () => import('../pages/crm/CrmDashboard'),
  '/crm/checklists': () => import('../pages/crm/ChecklistBuilder'),
  '/referral/management': () => import('../pages/referral/ReferralManagement'),
  '/hrm/my-referrals': () => import('../pages/referral/MyReferralsPage'),

  // HRM Portal
  '/hrm/calls/queue': () => import('../pages/hr/HRCallQueue'),
  '/hrm/letters/templates': () => import('../pages/hr/TemplateManagerPage'),
  '/hrm/reports': () => import('../pages/hr/ReportsDashboard'),

  // Dashboards
  '/client/dashboard': () => import('../pages/client/ClientDashboard'),
  '/client/site-attendance': () => import('../pages/client/ClientAttendanceDashboard'),
  '/site/dashboard': () => import('../pages/site/OrganizationDashboard'),
  '/operations/dashboard': () => import('../pages/operations/OperationsDashboard'),
  '/management/dashboard': () => import('../pages/management/ManagementDashboard'),

  // Operations Hub
  '/operations/tickets': () => import('../pages/operations/HelpdeskTickets'),
  '/operations/maintenance': () => import('../pages/operations/MaintenanceScheduler'),
  '/operations/contracts': () => import('../pages/operations/ContractManager'),

  // Finance Hub
  '/finance/profitability': () => import('../pages/finance/ProfitabilityDashboard'),
  '/finance/payments': () => import('../pages/finance/PaymentTracker'),

  // Enterprise Controls
  '/enterprise/approvals': () => import('../pages/enterprise/ApprovalsInbox'),
  '/enterprise/audit-trail': () => import('../pages/enterprise/AuditTrail'),

  // Attendance Logs
  '/attendance/dashboard': () => import('../pages/attendance/AttendanceDashboard'),
  '/finance': () => import('../pages/finance/FinanceModule'),

  // Real-time Tracking
  '/hr/field-staff-tracking': () => import('../pages/hr/FieldStaffTracking'),

  // Leaves & Rules
  '/hr/leave-management': () => import('../pages/hr/LeaveManagement'),
  '/admin/approval-workflow': () => import('../pages/admin/ApprovalWorkflow'),
  '/hr/attendance-settings': () => import('../pages/hr/AttendanceSettings'),
  '/hr/third-saturday-policy': () => import('../pages/hr/ThirdSaturdayPolicyPage'),

  // Employee Onboarding
  '/verification/dashboard': () => import('../pages/verification/VerificationDashboard'),
  '/onboarding/submissions': () => import('../pages/onboarding/MySubmissions'),
  '/onboarding': () => import('../pages/OnboardingHome'),
  '/hr/enrollment-rules': () => import('../pages/hr/EnrollmentRules'),
  '/hr/family-verification': () => import('../pages/hr/FamilyVerification'),

  // Client Management & Templates Hub
  '/hr/entity-management': () => import('../pages/hr/EntityManagement'),

  // Site Management
  '/admin/sites': () => import('../pages/admin/OrganizationManagement'),
  '/admin/site-routing': () => import('../pages/admin/SiteResponsibilityMatrix'),
  '/attendance/locations': () => import('../pages/attendance/MyLocations'),
  '/hr/locations': () => import('../pages/hr/LocationManagement'),

  // Operations & Team
  '/tasks': () => import('../pages/tasks/TaskManagement'),
  '/my-team/field-reports': () => import('../pages/my-team/FieldReports'),
  '/my-team': () => import('../pages/my-team/MyTeamPage'),

  // Uniforms & Kit
  '/uniforms': () => import('../pages/uniforms/UniformDashboard'),

  // Policies & Compliance
  '/hr/policies-and-insurance': () => import('../pages/hr/PoliciesAndInsurance'),

  // Finance & Invoicing
  '/billing/summary': () => import('../pages/billing/InvoiceSummary'),

  // Audit & Snag Reports
  '/admin/ht-master-data': () => import('../pages/admin/HTMasterDataAdmin'),
  '/operations/ppm-calendar': () => import('../pages/operations/PPMCalendarPage'),
  '/operations/asset-qr-center': () => import('../pages/operations/AssetQRCenterPage'),
  '/operations/ppm-audits': () => import('../pages/operations/PPMDashboard'),
  '/operations/ht-yard-audits': () => import('../pages/operations/HTYardAuditDashboard'),
  '/operations/ht-yard-audit-logs': () => import('../pages/operations/HTYardAuditLogsPage'),
  '/operations/snag-audit': () => import('../pages/operations/SnagAuditPage'),
  '/operations/snag-report': () => import('../pages/operations/SnagReportPage'),

  // Biometric Devices
  '/admin/device-approvals': () => import('../pages/admin/DeviceApprovals'),
  '/admin/devices': () => import('../pages/admin/ManageDevices'),
  '/admin/device-logs': () => import('../pages/admin/DeviceLogsPage'),
  '/admin/kiosks': () => import('../pages/admin/KioskManagement'),
  '/settings/devices': () => import('../pages/settings/DeviceManagement'),
  '/admin/cctv-devices': () => import('../pages/admin/ManageCctvDevices'),
  '/admin/cctv-dashboard': () => import('../pages/admin/CctvDashboard'),

  // Gate Attendance
  '/gate/register': () => import('../pages/gate/RegisterGateUser'),
  '/gate/logs': () => import('../pages/gate/GateAttendanceLogs'),
  '/gate': () => import('../pages/gate/GateKiosk'),

  // Security & Roles
  '/admin/roles': () => import('../pages/admin/RoleManagement'),
  '/admin/users': () => import('../pages/admin/UserManagement'),
  '/admin/user-home-details': () => import('../pages/admin/UserHomeDetails'),
  '/admin/user-vehicles': () => import('../pages/admin/UserVehiclesManagement'),
  '/admin/modules': () => import('../pages/admin/ModuleManagement'),
  '/admin/workflow-chart': () => import('../pages/admin/WorkflowChartPage'),

  // System Config
  '/developer/api': () => import('../pages/developer/ApiSettings'),
  '/developer/voip': () => import('../pages/developer/VoipSettings'),
  '/notifications': () => import('../pages/admin/AdvancedNotificationSettings'),
  '/billing/cost-analysis': () => import('../pages/billing/CostAnalysis'),

  // Support & Profile
  '/support': () => import('../pages/support/SupportDashboard'),
  '/profile': () => import('../pages/profile/ProfilePage'),
};

/**
 * Preloads the chunk for a given route path if not already loaded.
 */
export function preloadRoute(path: string): void {
  const basePath = path.split('?')[0];
  if (preloadedRoutes.has(basePath)) return;

  const loader = MODULE_LOADERS[basePath];
  if (loader) {
    preloadedRoutes.add(basePath);
    loader().catch((err) => {
      // Non-fatal warning; will retry normally if clicked
      console.debug('[Preload] Route preload deferred:', basePath, err);
      preloadedRoutes.delete(basePath);
    });
  }
}

/**
 * Preloads all routes belonging to a category when the category header is hovered or expanded.
 */
export function preloadCategoryRoutes(links: Array<{ to: string }>): void {
  links.forEach((l) => preloadRoute(l.to));
}
