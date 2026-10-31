import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Building,
  Building2,
  Box,
  BriefcaseBusiness,
  Users,
  IndianRupee,
  Sliders,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Folder,
  FolderOpen,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  ClipboardList,
  Wrench,
  Ticket,
  FileSpreadsheet,
  Zap,
  QrCode,
  Smartphone,
  Cpu,
  Lock,
  LifeBuoy,
  Phone,
  Settings,
  Bell,
  LineChart,
  Wallet,
  Target,
  UserCheck,
  UserPlus,
  Home,
  FileText,
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  Bot,
  Camera,
  Activity,
  Shirt,
  ShieldHalf,
  FileDigit,
  Baby,
  Calculator,
  Badge,
  HeartPulse,
  Archive,
  Sun,
  CalendarDays,
  Navigation,
  FileSignature,
  ListTodo,
  History
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { usePermissionsStore } from '../../store/permissionsStore';
import { useNotificationStore, isHrNotification } from '../../store/notificationStore';
import { isAdmin } from '../../utils/auth';
import { APP_VERSION } from '../../src/config/appVersion';
import Logo from '../ui/Logo';
import type { Permission } from '../../types';

export interface NavChildItem {
  id: string;
  label: string;
  to: string;
  icon?: React.ElementType;
  permission?: Permission;
  badge?: string;
}

export interface NavFolderItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  children: NavChildItem[];
}

export interface NavDirectItem {
  id: string;
  label: string;
  to: string;
  icon?: React.ElementType;
  permission?: Permission;
  badge?: string;
}

export type NavSubEntry =
  | { type: 'link'; item: NavDirectItem }
  | { type: 'folder'; folder: NavFolderItem };

export type PillarId =
  | 'dashboard'
  | 'operations'
  | 'hr'
  | 'bd'
  | 'backoffice'
  | 'finance'
  | 'communication'
  | 'reports'
  | 'settings';

export interface PillarConfig {
  id: PillarId;
  label: string;
  icon: React.ElementType;
  badgeDot?: boolean;
  entries: NavSubEntry[];
}

/**
 * Returns a distinct, domain-appropriate Lucide icon based on the folder/section heading.
 * Ensures zero repeated generic folder icons in the sub-nav drawer.
 */
export const getHeadingIcon = (label: string): React.ElementType => {
  const normalized = label.toLowerCase();
  if (normalized.includes('executive')) return LineChart;
  if (normalized.includes('operation') || normalized.includes('site')) return Building;
  if (normalized.includes('hr') || normalized.includes('workforce') || normalized.includes('staff')) return UserCheck;
  if (normalized.includes('financial') || normalized.includes('finance') || normalized.includes('cost')) return Wallet;
  if (normalized.includes('society') || normalized.includes('gate') || normalized.includes('security')) return ShieldCheck;
  if (normalized.includes('cctv') || normalized.includes('camera') || normalized.includes('surveillance')) return Camera;
  if (normalized.includes('audit') || normalized.includes('equipment') || normalized.includes('maint')) return Wrench;
  if (normalized.includes('task') || normalized.includes('field ops')) return ListTodo;
  if (normalized.includes('attendance') || normalized.includes('shift')) return Calendar;
  if (normalized.includes('leave') || normalized.includes('approval')) return CheckCircle2;
  if (normalized.includes('onboarding') || normalized.includes('enroll')) return UserPlus;
  if (normalized.includes('kit') || normalized.includes('uniform') || normalized.includes('policy')) return Shirt;
  if (normalized.includes('tracking') || normalized.includes('location')) return Navigation;
  if (normalized.includes('sales') || normalized.includes('pipeline') || normalized.includes('crm')) return Target;
  if (normalized.includes('referral')) return Sparkles;
  if (normalized.includes('client') || normalized.includes('account')) return BriefcaseBusiness;
  if (normalized.includes('entity') || normalized.includes('master setup')) return Layers;
  if (normalized.includes('routing') || normalized.includes('matrix')) return MapPin;
  if (normalized.includes('template') || normalized.includes('feed')) return FileSpreadsheet;
  if (normalized.includes('invoicing') || normalized.includes('billing')) return FileText;
  if (normalized.includes('assist') || normalized.includes('ai')) return Bot;
  if (normalized.includes('channel') || normalized.includes('call') || normalized.includes('comm')) return Phone;
  if (normalized.includes('report') || normalized.includes('snag')) return BarChart3;
  if (normalized.includes('compliance') || normalized.includes('log')) return History;
  if (normalized.includes('role') || normalized.includes('access')) return Lock;
  if (normalized.includes('biometric') || normalized.includes('hardware')) return Cpu;
  if (normalized.includes('diagnostic') || normalized.includes('support')) return LifeBuoy;
  return LayoutDashboard;
};

// ── 9 ENTERPRISE DEPARTMENT PILLARS PROPERLY SEGREGATED ──
export const ENTERPRISE_PILLARS: PillarConfig[] = [
  // ── 1. DASHBOARD ──
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    entries: [
      {
        type: 'link',
        item: { id: 'mgmt_dash_top', label: 'Management Dashboard', to: '/management/dashboard', icon: LayoutDashboard, permission: 'view_management_dashboard' }
      }
    ]
  },

  // ── 2. SITE OPERATIONS ──
  {
    id: 'operations',
    label: 'Site Ops',
    icon: Building2,
    entries: [
      {
        type: 'link',
        item: { id: 'ops_dash_main', label: 'Site Operations Dashboard', to: '/operations/dashboard', icon: Building2, permission: 'view_operations_dashboard' }
      },
      {
        type: 'folder',
        folder: {
          id: 'ops_society_gate',
          label: 'Society & Gate Operations',
          icon: Building2,
          children: [
            { id: 'gate_community_main', label: 'Gate & Community OS', to: '/admin/gate-dashboard', badge: 'New' },
            { id: 'gate_kiosk_pub', label: 'Community Gate Kiosk', to: '/community-gate' },
            { id: 'resident_gate_pass', label: 'Resident Gate Pass', to: '/resident/gate' },
            { id: 'gate_kiosk', label: 'Security Gate Kiosk', to: '/gate', permission: 'manage_gate_kiosk' },
            { id: 'gate_reg', label: 'Gate Registration', to: '/gate/register', permission: 'manage_gate_registration' },
            { id: 'gate_logs', label: 'Gate Attendance Logs', to: '/gate/logs', permission: 'view_gate_logs' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'ops_cctv',
          label: 'CCTV & Surveillance',
          icon: Camera,
          children: [
            { id: 'cctv_dash', label: 'CCTV Live Dashboard', to: '/admin/cctv-dashboard', permission: 'manage_biometric_devices' },
            { id: 'cctv_dev', label: 'CCTV Devices', to: '/admin/cctv-devices', permission: 'manage_biometric_devices' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'ops_audits_maint',
          label: 'Equipment & Audits',
          icon: Wrench,
          children: [
            { id: 'site_dash_sub', label: 'Site Infrastructure Dashboard', to: '/site/dashboard', permission: 'view_site_dashboard' },
            { id: 'prev_maint', label: 'Preventive Maintenance', to: '/operations/maintenance', permission: 'view_preventive_maintenance' },
            { id: 'contract_mgr', label: 'Contract Manager', to: '/operations/contracts', permission: 'view_contract_manager' },
            { id: 'resident_exp', label: 'Resident Experience', to: '/operations/resident-portal', permission: 'view_resident_portal' },
            { id: 'ht_master', label: 'Master Data Config', to: '/admin/ht-master-data', permission: 'view_ht_master_data' },
            { id: 'ppm_calendar', label: 'PPM Calendar', to: '/operations/ppm-calendar', permission: 'view_ppm_audits' },
            { id: 'ppm_audits', label: 'PPM Audits', to: '/operations/ppm-audits', permission: 'view_ppm_audits' },
            { id: 'ht_yard_audits', label: 'HT Yard & Site Audit', to: '/operations/ht-yard-audits', permission: 'view_ht_yard_audits' },
            { id: 'audit_logs', label: 'Audit Change Log', to: '/operations/ht-yard-audit-logs', permission: 'view_audit_change_log' },
            { id: 'asset_qr', label: 'Asset QR Tags Center', to: '/operations/asset-qr-center', permission: 'view_ht_yard_audits' },
            { id: 'snag_audit', label: 'Snag Audit Entry', to: '/operations/snag-audit', permission: 'view_snag_audit' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'ops_tasks_team',
          label: 'Tasks & Field Ops',
          icon: ListTodo,
          children: [
            { id: 'tasks_mgr', label: 'Task Manager', to: '/tasks', permission: 'manage_tasks' },
            { id: 'helpdesk_tickets', label: 'Helpdesk Tickets', to: '/operations/tickets', permission: 'view_helpdesk_tickets' },
            { id: 'my_team', label: 'My Operations Team', to: '/my-team', permission: 'view_my_team' }
          ]
        }
      }
    ]
  },

  // ── 3. HR (HUMAN RESOURCES) ──
  {
    id: 'hr',
    label: 'HR',
    icon: Users,
    entries: [
      {
        type: 'link',
        item: { id: 'att_dash_main', label: 'Attendance Dashboard', to: '/attendance/dashboard', icon: Calendar, permission: 'view_own_attendance' }
      },
      {
        type: 'folder',
        folder: {
          id: 'hr_att',
          label: 'Attendance & Shifts',
          icon: Calendar,
          children: [
            { id: 'att_dash', label: 'Attendance Dashboard', to: '/attendance/dashboard', permission: 'view_own_attendance' },
            { id: 'att_tracker', label: 'Real-time Tracker', to: '/finance?tab=attendance', permission: 'view_attendance_tracker' },
            { id: 'att_rules', label: 'Attendance & Shift Rules', to: '/hr/attendance-settings', permission: 'manage_attendance_rules' },
            { id: 'saturday_policy', label: '3rd Saturday Policy', to: '/hr/third-saturday-policy', permission: 'manage_attendance_rules' },
            { id: 'holiday_sel', label: 'Company Holiday Selection', to: '/hr/entity-management?tab=company_holiday_selection', permission: 'view_entity_management' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'hr_leaves',
          label: 'Leaves & Approvals',
          icon: CheckCircle2,
          children: [
            { id: 'leave_mgmt', label: 'Leave Management', to: '/hr/leave-management', permission: 'manage_leave_requests' },
            { id: 'leave_settings', label: 'Approval Workflow Settings', to: '/admin/approval-workflow', permission: 'manage_approval_workflow' },
            { id: 'ent_approvals', label: 'Approvals Inbox', to: '/enterprise/approvals', permission: 'manage_approval_workflow' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'hr_onboarding',
          label: 'Employee Onboarding',
          icon: UserPlus,
          children: [
            { id: 'all_sub', label: 'Verification Dashboard', to: '/verification/dashboard', permission: 'view_all_submissions' },
            { id: 'new_enroll', label: 'New Enrollment', to: '/onboarding', permission: 'create_enrollment' },
            { id: 'my_sub', label: 'My Submissions', to: '/onboarding/submissions', permission: 'create_enrollment' },
            { id: 'enroll_rules', label: 'Enrollment Rules', to: '/hr/enrollment-rules', permission: 'manage_enrollment_rules' },
            { id: 'family_ver', label: 'Family Verification', to: '/hr/family-verification', permission: 'manage_family_verification' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'hr_uniforms_pol',
          label: 'Staff Kit & Policies',
          icon: Shirt,
          children: [
            { id: 'uniform_mgmt', label: 'Uniform Management', to: '/uniforms', permission: 'manage_uniforms' },
            { id: 'policies_ins', label: 'Policies & Insurance', to: '/hr/policies-and-insurance', permission: 'manage_policies' },
            { id: 'designations', label: 'Staff Designation', to: '/hr/entity-management?tab=staff_designation', permission: 'view_entity_management' },
            { id: 'gmc_pol', label: 'GMC Insurance Policy', to: '/hr/entity-management?tab=gmc_policy', permission: 'view_entity_management' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'hr_tracking',
          label: 'Field Staff Tracking',
          icon: Navigation,
          children: [
            { id: 'staff_track', label: 'User Activity Tracking', to: '/hr/field-staff-tracking', permission: 'view_field_staff_tracking' },
            { id: 'my_locs', label: 'My Locations', to: '/attendance/locations', permission: 'view_my_locations' }
          ]
        }
      }
    ]
  },

  // ── 4. BUSINESS DEVELOPMENT (BD & CRM) ──
  {
    id: 'bd',
    label: 'Business Dev',
    icon: Target,
    entries: [
      {
        type: 'link',
        item: { id: 'crm_pipe_main', label: 'CRM Sales Pipeline', to: '/crm', icon: Target, permission: 'view_crm_pipeline', badge: 'Pipeline' }
      },
      {
        type: 'folder',
        folder: {
          id: 'bd_crm',
          label: 'Sales Pipeline & Checklists',
          icon: Target,
          children: [
            { id: 'crm_pipe', label: 'CRM Sales Pipeline', to: '/crm', permission: 'view_crm_pipeline' },
            { id: 'crm_checks', label: 'Checklist Templates', to: '/crm/checklists', permission: 'view_crm_checklists' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'bd_referrals',
          label: 'Referral Program',
          icon: Users,
          children: [
            { id: 'ref_mgmt', label: 'Referral Management', to: '/referral/management', permission: 'view_referrals' },
            { id: 'my_ref', label: 'My Referrals', to: '/hrm/my-referrals', permission: 'view_my_referrals' },
            { id: 'ref_emp', label: 'Employee Referral Form', to: '/referral/employee' },
            { id: 'ref_biz', label: 'Business Referral Form', to: '/referral/business' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'bd_client_accounts',
          label: 'Client Relations & Accounts',
          icon: BriefcaseBusiness,
          children: [
            { id: 'bd_client_dash', label: 'Client Dashboard', to: '/client/dashboard', permission: 'view_client_dashboard' },
            { id: 'bd_client_att', label: 'Site Attendance Overview', to: '/client/site-attendance', permission: 'view_site_attendance' }
          ]
        }
      }
    ]
  },

  // ── 5. BACK OFFICE (MASTER DATA & ENTITY SETUP) ──
  {
    id: 'backoffice',
    label: 'Back Office',
    icon: Layers,
    entries: [
      {
        type: 'link',
        item: { id: 'bo_entity_main', label: 'Client Management', to: '/hr/entity-management?tab=client_structure', icon: Layers, permission: 'view_entity_management' }
      },
      {
        type: 'folder',
        folder: {
          id: 'bo_entity',
          label: 'Entity & Master Setup',
          icon: Layers,
          children: [
            { id: 'client_struct', label: 'Client Structure', to: '/hr/entity-management?tab=client_structure', permission: 'view_entity_management' },
            { id: 'site_cfg', label: 'Site Configuration', to: '/hr/entity-management?tab=site_configuration', permission: 'view_entity_management' },
            { id: 'costing_res', label: 'Costing & Resource', to: '/hr/entity-management?tab=costing_resource', permission: 'view_entity_management' },
            { id: 'bo_heads', label: 'Back Office & ID Series', to: '/hr/entity-management?tab=backoffice_heads', permission: 'view_entity_management' },
            { id: 'asset_mgmt', label: 'Asset Management', to: '/hr/entity-management?tab=asset', permission: 'view_entity_management' },
            { id: 'tools_list', label: 'Tools List', to: '/hr/entity-management?tab=tools_list', permission: 'view_entity_management' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'bo_site_masters',
          label: 'Site & Routing Masters',
          icon: MapPin,
          children: [
            { id: 'sites_admin', label: 'Site Management', to: '/admin/sites', permission: 'manage_sites' },
            { id: 'site_matrix', label: 'Site Responsibility Matrix', to: '/admin/site-routing', permission: 'manage_sites' },
            { id: 'geo_locations', label: 'Geo Locations', to: '/hr/locations', permission: 'manage_geo_locations' },
            { id: 'resident_home', label: 'Resident Home & Units', to: '/admin/user-home-details', permission: 'manage_users' },
            { id: 'user_veh', label: 'User Vehicles Directory', to: '/admin/user-vehicles', permission: 'manage_user_vehicles' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'bo_templates_feeds',
          label: 'Templates & Bulk Feeds',
          icon: FileSpreadsheet,
          children: [
            { id: 'templates_hub', label: 'Client Management Templates', to: '/hr/entity-management?tab=templates_hub', permission: 'view_templates_hub' },
            { id: 'att_bulk', label: 'Attendance Bulk Feed', to: '/hr/entity-management?tab=attendance_bulk', permission: 'view_attendance_bulk_feed' },
            { id: 'att_bulk_monthly', label: 'Monthly Attendance Feed', to: '/hr/entity-management?tab=attendance_monthly_bulk', permission: 'view_monthly_attendance_feed' },
            { id: 'doc_viewer', label: 'Document Viewer', to: '/document-viewer' }
          ]
        }
      }
    ]
  },

  // ── 6. FINANCE ──
  {
    id: 'finance',
    label: 'Finance',
    icon: IndianRupee,
    entries: [
      {
        type: 'link',
        item: { id: 'fin_profit_main', label: 'Profitability Overview', to: '/finance/profitability', icon: LineChart, permission: 'view_profitability' }
      },
      {
        type: 'folder',
        folder: {
          id: 'fin_billing_coll',
          label: 'Invoicing & Collections',
          icon: IndianRupee,
          children: [
            { id: 'inv_sum_f', label: 'Invoice Summary', to: '/billing/summary', permission: 'view_invoice_summary' },
            { id: 'fin_payments', label: 'Payment Tracker', to: '/finance/payments', permission: 'view_payment_tracker' },
            { id: 'fin_profit_f', label: 'Profitability Overview', to: '/finance/profitability', permission: 'view_profitability' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'fin_cost_rates',
          label: 'Cost Analysis & Rates',
          icon: Wallet,
          children: [
            { id: 'ver_cost', label: 'Verification Cost Analysis', to: '/billing/cost-analysis', permission: 'view_verification_costing' },
            { id: 'costing_rates', label: 'Costing & Resource Rates', to: '/hr/entity-management?tab=costing_resource', permission: 'view_entity_management' },
            { id: 'templates_rates', label: 'Master Templates Hub', to: '/hr/entity-management?tab=templates_hub', permission: 'view_templates_hub' }
          ]
        }
      }
    ]
  },

  // ── 7. COMMUNICATION ──
  {
    id: 'communication',
    label: 'Communication',
    icon: MessageSquare,
    entries: [
      {
        type: 'link',
        item: { id: 'assist_ai_main', label: 'Paradigm Assist AI', to: '/assist', icon: Bot, permission: 'view_paradigm_assist' }
      },
      {
        type: 'folder',
        folder: {
          id: 'comms_assist',
          label: 'Paradigm Assist Suite',
          icon: Bot,
          children: [
            { id: 'assist_hub', label: 'Paradigm Assist AI', to: '/assist', permission: 'view_paradigm_assist' },
            { id: 'emergency_hub', label: 'Emergency Hub', to: '/assist/emergency', permission: 'view_paradigm_assist' },
            { id: 'duty_roster', label: 'Duty Roster', to: '/assist/roster', permission: 'view_paradigm_assist' },
            { id: 'faq_sops', label: 'FAQ & SOPs', to: '/assist/faq', permission: 'view_paradigm_assist' },
            { id: 'assist_admin', label: 'Assist Admin Suite', to: '/admin/assist', permission: 'manage_paradigm_assist' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'comms_channels',
          label: 'Communications & Queues',
          icon: MessageSquare,
          children: [
            { id: 'hr_calls', label: 'HR Call Queue', to: '/hrm/calls/queue', permission: 'view_hr_call_queue' },
            { id: 'hr_letters', label: 'Letter Templates', to: '/hrm/letters/templates', permission: 'view_letter_templates' },
            { id: 'notif_rules', label: 'Notification Management', to: '/notifications', permission: 'view_notification_management' },
            { id: 'voip_telephony', label: 'VoIP Configuration', to: '/developer/voip', permission: 'view_voip_configuration' }
          ]
        }
      }
    ]
  },

  // ── 8. REPORTS ──
  {
    id: 'reports',
    label: 'Reports',
    icon: LineChart,
    entries: [
      {
        type: 'link',
        item: { id: 'hr_reports_main', label: 'HR Reports Dashboard', to: '/hrm/reports', icon: BarChart3, permission: 'view_reports_dashboard' }
      },
      {
        type: 'folder',
        folder: {
          id: 'rep_ops_snag',
          label: 'Operations & Snag Reports',
          icon: FileSpreadsheet,
          children: [
            { id: 'site_audit_rep', label: 'Site Audit Report', to: '/operations/snag-report?tab=site', permission: 'view_site_audit_report' },
            { id: 'field_rep', label: 'Field Reports', to: '/my-team/field-reports', permission: 'view_field_reports' },
            { id: 'snag_rep', label: 'Snag Master Report', to: '/operations/snag-report?tab=snag', permission: 'view_snag_report' },
            { id: 'ppm_audit_rep', label: 'PPM Audit Report', to: '/operations/snag-report?tab=ppm', permission: 'view_ppm_audit_report' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'rep_hr_comp',
          label: 'HR & Compliance Logs',
          icon: BarChart3,
          children: [
            { id: 'ent_audit', label: 'Enterprise Audit Trail', to: '/enterprise/audit-trail', permission: 'view_audit_trail' },
            { id: 'att_overview_rep', label: 'Attendance Overview Report', to: '/hr/entity-management?tab=attendance_overview', permission: 'view_entity_management' }
          ]
        }
      }
    ]
  },

  // ── 9. SETTINGS ──
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    entries: [
      {
        type: 'link',
        item: { id: 'user_profile', label: 'My Profile & Account', to: '/profile', icon: Settings, permission: 'view_profile' }
      },
      {
        type: 'folder',
        folder: {
          id: 'sec_roles',
          label: 'Security & Roles',
          icon: Lock,
          children: [
            { id: 'role_mgmt', label: 'Role Management', to: '/admin/roles', permission: 'manage_roles_and_permissions' },
            { id: 'user_mgmt', label: 'User Management', to: '/admin/users', permission: 'manage_users' },
            { id: 'access_mod', label: 'Access Tasks & Modules', to: '/admin/modules', permission: 'manage_modules' },
            { id: 'wf_chart', label: '2D Workflow Visualizer', to: '/admin/workflow-chart', permission: 'manage_approval_workflow' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'bio_hardware',
          label: 'Biometric & Hardware',
          icon: Smartphone,
          children: [
            { id: 'dev_approvals', label: 'Device Approvals', to: '/admin/device-approvals', permission: 'manage_device_approvals' },
            { id: 'bio_devices', label: 'Biometric Devices', to: '/admin/devices', permission: 'manage_biometric_devices' },
            { id: 'essl_sync', label: 'eSSL Master Sync (MSSQL)', to: '/admin/essl', permission: 'manage_biometric_devices' },
            { id: 'dev_logs', label: 'Raw Device Logs', to: '/admin/device-logs', permission: 'manage_biometric_devices' },
            { id: 'kiosks_mon', label: 'Kiosk Monitoring', to: '/admin/kiosks', permission: 'view_kiosk_monitoring' },
            { id: 'linked_dev', label: 'Linked Devices', to: '/settings/devices', permission: 'manage_linked_devices' }
          ]
        }
      },
      {
        type: 'folder',
        folder: {
          id: 'sys_diag',
          label: 'Support & Diagnostics',
          icon: LifeBuoy,
          children: [
            { id: 'sys_support', label: 'Backend Support Desk', to: '/support', permission: 'access_support_desk' },
            { id: 'api_settings', label: 'Developer API Keys', to: '/developer/api', permission: 'view_developer_settings' },
            { id: 'offline_diag', label: 'Offline Diagnostics', to: '/settings/offline-diagnostics' }
          ]
        }
      }
    ]
  }
];

interface DualTierSidebarProps {
  onLinkClick?: () => void;
  isMobile?: boolean;
}

export const DualTierSidebar: React.FC<DualTierSidebarProps> = ({ onLinkClick, isMobile = false }) => {
  const { user } = useAuthStore();
  const { permissions } = usePermissionsStore();
  const { pendingHrCount, pendingApprovalsCount, notifications } = useNotificationStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Dynamically determine if HR pillar has actionable pending approvals or unread verification requests
  const hasPendingHrBadge = useMemo(() => {
    if (typeof pendingHrCount === 'number') {
      return pendingHrCount > 0;
    }
    if (pendingApprovalsCount > 0) return true;
    return notifications.some((n) => !n.isRead && isHrNotification(n));
  }, [pendingHrCount, pendingApprovalsCount, notifications]);

  // Helper to check if a specific route or folder has actionable pending items / notifications
  const isRoutePending = useCallback(
    (to: string): boolean => {
      const norm = to.split('?')[0].toLowerCase();
      return notifications.some((n) => {
        if (n.isRead) return false;
        const target = (n.linkTo || n.link || '').toLowerCase();
        if (target && target.includes(norm)) return true;
        const msg = (n.message || '').toLowerCase();
        if (norm.includes('verification') && /(verification|onboarding)/i.test(msg)) return true;
        if (norm.includes('leave') && /leave/i.test(msg)) return true;
        if (norm.includes('attendance') && /(attendance|unlock|punch)/i.test(msg)) return true;
        return false;
      });
    },
    [notifications]
  );

  const isFolderPending = useCallback(
    (folder: NavFolderItem): boolean => {
      return folder.children.some((child) => isRoutePending(child.to));
    },
    [isRoutePending]
  );

  // Primary active pillar (9 Departments)
  const [activePillar, setActivePillar] = useState<PillarId>('dashboard');
  // Secondary drawer collapse toggle (starts collapsed, auto-expands on cursor placed)
  const [isSubNavCollapsed, setIsSubNavCollapsed] = useState<boolean>(true);
  // Accordion sub-folder states: record of folderId -> boolean
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  // Sub-nav search filter
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Hover & auto-collapse controller: Auto-expand on cursor placed, auto-close after item selected or mouse leave
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnterSidebar = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsSubNavCollapsed(false);
  };

  const handleMouseLeaveSidebar = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
    }
    leaveTimeoutRef.current = setTimeout(() => {
      setIsSubNavCollapsed(true);
    }, 280);
  };

  const handleItemSelect = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsSubNavCollapsed(true);
    if (onLinkClick) onLinkClick();
  };

  useEffect(() => {
    return () => {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
    };
  }, []);

  // Extract user permissions
  const userPermissions = useMemo(() => {
    if (!user || !permissions) return [];
    const roleId = user.roleId?.toLowerCase() || '';
    const roleName = user.role?.toLowerCase() || '';
    const roleNameUnderscore = roleName.replace(/\s+/g, '_');
    const roleNameHyphen = roleName.replace(/\s+/g, '-');
    const directPerms = (user as any).permissions || [];

    const found =
      permissions[user.roleId] ||
      permissions[roleId] ||
      permissions[user.role] ||
      permissions[roleName] ||
      permissions[roleNameUnderscore] ||
      permissions[roleNameHyphen] ||
      [];

    return [...new Set([...found, ...directPerms])];
  }, [user, permissions]);

  // Permission filter helper
  const hasAccess = (perm?: Permission) => {
    if (!perm) return true;
    if (!user) return false;
    if (isAdmin(user.role)) return true;
    return userPermissions.includes(perm);
  };

  // Filter pillar entries according to permissions
  const filteredPillars = useMemo(() => {
    return ENTERPRISE_PILLARS.map((pillar) => {
      const allowedEntries: NavSubEntry[] = [];
      pillar.entries.forEach((entry) => {
        if (entry.type === 'link') {
          if (hasAccess(entry.item.permission)) {
            allowedEntries.push(entry);
          }
        } else if (entry.type === 'folder') {
          const validChildren = entry.folder.children.filter((c) => hasAccess(c.permission));
          if (validChildren.length > 0) {
            allowedEntries.push({
              type: 'folder',
              folder: {
                ...entry.folder,
                children: validChildren
              }
            });
          }
        }
      });
      return {
        ...pillar,
        badgeDot: pillar.id === 'hr' ? hasPendingHrBadge : (pillar.badgeDot ?? false),
        entries: allowedEntries
      };
    });
  }, [user, userPermissions, hasPendingHrBadge]);

  // Active link check helper (handles query parameters like ?tab=...)
  const isLinkActive = (to: string): boolean => {
    const currentFull = location.pathname + location.search;
    if (to.includes('?')) {
      return currentFull === to;
    }
    return location.pathname === to && (!location.search || !location.search.includes('tab='));
  };

  // Auto-detect active pillar & auto-expand parent folder on route change
  useEffect(() => {
    // 1. If current activePillar ALREADY contains the active route, KEEP IT! (No unwanted rerouting)
    const currentPillar = filteredPillars.find((p) => p.id === activePillar);
    if (currentPillar) {
      for (const entry of currentPillar.entries) {
        if (entry.type === 'link' && isLinkActive(entry.item.to)) {
          return;
        }
        if (entry.type === 'folder') {
          for (const child of entry.folder.children) {
            if (isLinkActive(child.to)) {
              setExpandedFolders((prev) => ({
                ...prev,
                [entry.folder.id]: true
              }));
              return;
            }
          }
        }
      }
    }

    // 2. Deterministic route-to-pillar priority rules (Prevents incorrect rerouting)
    const path = location.pathname.toLowerCase();
    let preferredPillarId: PillarId | null = null;
    if (
      path.startsWith('/gate') ||
      path.startsWith('/operations') ||
      path.startsWith('/site') ||
      path.startsWith('/resident/gate') ||
      path.startsWith('/community-gate')
    ) {
      preferredPillarId = 'operations';
    } else if (
      path.startsWith('/attendance') ||
      path.startsWith('/verification') ||
      path.startsWith('/onboarding') ||
      path.startsWith('/hr/') ||
      path.startsWith('/uniforms')
    ) {
      preferredPillarId = 'hr';
    } else if (
      path.startsWith('/crm') ||
      path.startsWith('/referral') ||
      path.startsWith('/client')
    ) {
      preferredPillarId = 'bd';
    } else if (
      path.startsWith('/billing') ||
      path.startsWith('/finance')
    ) {
      preferredPillarId = 'finance';
    } else if (
      path.startsWith('/assist')
    ) {
      preferredPillarId = 'communication';
    } else if (
      path.startsWith('/hrm/reports') ||
      path.includes('snag-report') ||
      path.startsWith('/enterprise/audit-trail')
    ) {
      preferredPillarId = 'reports';
    } else if (
      path.startsWith('/management')
    ) {
      preferredPillarId = 'dashboard';
    } else if (
      path.startsWith('/admin/roles') ||
      path.startsWith('/admin/users') ||
      path.startsWith('/admin/devices') ||
      path.startsWith('/admin/essl') ||
      path.startsWith('/admin/device-logs') ||
      path.startsWith('/admin/kiosks') ||
      path.startsWith('/settings') ||
      path.startsWith('/support') ||
      path.startsWith('/developer') ||
      path.startsWith('/profile')
    ) {
      preferredPillarId = 'settings';
    }

    if (preferredPillarId) {
      const targetPillar = filteredPillars.find((p) => p.id === preferredPillarId);
      if (targetPillar) {
        for (const entry of targetPillar.entries) {
          if (entry.type === 'link' && isLinkActive(entry.item.to)) {
            setActivePillar(preferredPillarId);
            return;
          }
          if (entry.type === 'folder') {
            for (const child of entry.folder.children) {
              if (isLinkActive(child.to)) {
                setActivePillar(preferredPillarId);
                setExpandedFolders((prev) => ({
                  ...prev,
                  [entry.folder.id]: true
                }));
                return;
              }
            }
          }
        }
      }
    }

    // 3. Fallback: Search all pillars
    for (const pillar of filteredPillars) {
      for (const entry of pillar.entries) {
        if (entry.type === 'link') {
          if (isLinkActive(entry.item.to)) {
            setActivePillar(pillar.id);
            return;
          }
        } else if (entry.type === 'folder') {
          for (const child of entry.folder.children) {
            if (isLinkActive(child.to)) {
              setActivePillar(pillar.id);
              setExpandedFolders((prev) => ({
                ...prev,
                [entry.folder.id]: true
              }));
              return;
            }
          }
        }
      }
    }
  }, [location.pathname, location.search, filteredPillars]);

  // Toggle accordion folder
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const currentPillarConfig = filteredPillars.find((p) => p.id === activePillar) || filteredPillars[0];

  // Filter current entries by search term
  const displayedEntries = useMemo(() => {
    if (!searchFilter.trim()) return currentPillarConfig.entries;
    const q = searchFilter.toLowerCase();
    const result: NavSubEntry[] = [];

    currentPillarConfig.entries.forEach((entry) => {
      if (entry.type === 'link') {
        if (entry.item.label.toLowerCase().includes(q)) {
          result.push(entry);
        }
      } else if (entry.type === 'folder') {
        const matchingKids = entry.folder.children.filter((c) => c.label.toLowerCase().includes(q));
        if (matchingKids.length > 0 || entry.folder.label.toLowerCase().includes(q)) {
          result.push({
            type: 'folder',
            folder: {
              ...entry.folder,
              children: matchingKids.length > 0 ? matchingKids : entry.folder.children
            }
          });
        }
      }
    });
    return result;
  }, [currentPillarConfig, searchFilter]);

  const effectiveCompany = user?.societyName || user?.organizationName || '';
  const isSouthWall =
    effectiveCompany.toLowerCase().includes('south wall') ||
    effectiveCompany.toLowerCase().includes('southwall') ||
    effectiveCompany.toLowerCase().includes('south-wall');

  return (
    <div
      className="flex h-full select-none font-sans text-slate-800 antialiased relative z-20 desktop-scaled"
      onMouseEnter={handleMouseEnterSidebar}
      onMouseLeave={handleMouseLeaveSidebar}
    >
      {/* ── 1. PRIMARY FIXED ICON RAIL (Screen-Adaptive Scaling) ── */}
      <aside className="w-[68px] sm:w-[72px] lg:w-[76px] bg-white border-r border-slate-200/90 flex flex-col items-center py-2 shrink-0 z-20 shadow-xs relative h-full">
        <div className="flex flex-col items-center w-full h-full">
          {/* Top Brand Logo */}
          <div className="flex flex-col items-center w-full shrink-0">
            <div
              onClick={() => navigate('/')}
              className="flex items-center justify-center cursor-pointer group py-1"
              title={isSouthWall ? 'South Wall Services' : 'Paradigm IFS'}
            >
              <img
                src={isSouthWall ? '/southwall-favicon.png' : '/favicon.ico'}
                alt="Brand Logo"
                className="w-8 h-8 object-contain animate-[spin_10s_linear_infinite] group-hover:[animation-duration:2.5s] transition-transform duration-300 select-none drop-shadow-xs"
              />
            </div>
            <div className="w-6 h-px bg-slate-200 my-1" />
          </div>

          {/* Fixed Pillar Navigation Buttons: 9 Department Pillars - Compact Stacked Layout */}
          <LayoutGroup id="sidebar-department-pillars">
            <div className="w-full px-1 overflow-y-auto overflow-x-hidden scrollbar-none py-1 space-y-1 min-h-0">
              {filteredPillars.map((pillar) => {
                const Icon = pillar.icon;
                const isActive = activePillar === pillar.id;

                return (
                  <motion.button
                    key={pillar.id}
                    onClick={() => {
                      setActivePillar(pillar.id);
                      handleMouseEnterSidebar();
                    }}
                    onMouseEnter={() => {
                      setActivePillar(pillar.id);
                      handleMouseEnterSidebar();
                    }}
                    whileTap={{ scale: 0.94 }}
                    title={pillar.label}
                    className={`group relative w-full h-[46px] rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors duration-150 shrink-0 ${
                      isActive
                        ? 'text-[#006B3F] font-bold'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Animated Sliding Background Pill */}
                    {isActive && (
                      <motion.div
                        layoutId="activePillarBackground"
                        className="absolute inset-0 bg-[#F0FDF4] rounded-xl border border-emerald-100/90 shadow-2xs z-0"
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 32,
                          mass: 0.7
                        }}
                      />
                    )}

                    {/* Left Paradigm Green Active Indicator Bar - Smooth Sliding Pill */}
                    {isActive && (
                      <motion.span
                        layoutId="activePillarIndicator"
                        className="absolute -left-[4px] top-1.5 bottom-1.5 w-1.5 bg-[#006B3F] rounded-r-full shadow-xs z-10"
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 32,
                          mass: 0.7
                        }}
                      />
                    )}

                    {/* Icon with clean line weight & spring scale on active */}
                    <div className="relative z-10 flex items-center justify-center">
                      <motion.div
                        animate={{ scale: isActive ? 1.08 : 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="flex items-center justify-center"
                      >
                        <Icon
                          className={`w-4 h-4 stroke-[1.8] transition-colors duration-150 ${
                            isActive
                              ? 'text-[#006B3F]'
                              : 'text-slate-500 group-hover:text-slate-800'
                          }`}
                        />
                      </motion.div>

                      {/* Red notification dot */}
                      {pillar.badgeDot && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 absolute -top-0.5 -right-1 ring-2 ring-white" />
                      )}
                    </div>

                    {/* Label: Cleanly centered, scales dynamically */}
                    <span
                      className={`relative z-10 text-[8.5px] sm:text-[9px] tracking-tight mt-0.5 leading-tight text-center select-none truncate max-w-[62px] transition-colors duration-150 ${
                        isActive
                          ? 'font-bold text-[#006B3F]'
                          : 'font-medium text-slate-600 group-hover:text-slate-900'
                      }`}
                    >
                      {pillar.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </LayoutGroup>

          {/* Subtle Bottom Version Indicator */}
          <div className="mt-auto shrink-0 pt-2 pb-1 flex flex-col items-center">
            <span className="text-[8px] font-mono text-slate-400 opacity-60 uppercase tracking-tighter select-none">
              v{APP_VERSION}
            </span>
          </div>
        </div>
      </aside>

      {/* ── 2. SECONDARY SUB-NAV DRAWER (Adaptive 208px–240px Wide) ── */}
      <aside
        className={`bg-white border-r border-slate-200/90 flex flex-col shrink-0 z-10 shadow-xs transition-all duration-300 overflow-hidden ${
          isSubNavCollapsed ? 'w-0 border-r-0' : 'w-52 lg:w-56 2xl:w-60'
        }`}
      >
        {!isSubNavCollapsed && (
          <div className="flex flex-col h-full w-52 lg:w-56 2xl:w-60">
            {/* Sub-nav Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <currentPillarConfig.icon className="w-4 h-4 text-[#006B3F]" />
                <h2 className="text-sm font-extrabold text-slate-900 tracking-tight uppercase">
                  {currentPillarConfig.label}
                </h2>
              </div>
              <button
                onClick={() => setIsSubNavCollapsed(true)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition cursor-pointer"
                title="Collapse sidebar"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Filter Search Input */}
            <div className="px-3 pt-3 pb-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={`Search ${currentPillarConfig.label}...`}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-emerald-500 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Sub-Nav Items List */}
            <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1 custom-scrollbar">
              {displayedEntries.map((entry) => {
                // TYPE A: DIRECT LINK ITEM
                if (entry.type === 'link') {
                  const active = isLinkActive(entry.item.to);
                  const Icon = entry.item.icon || ChevronRight;
                  const isPending = isRoutePending(entry.item.to);

                  return (
                    <NavLink
                      key={entry.item.id}
                      to={entry.item.to}
                      onClick={handleItemSelect}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                        active
                          ? 'bg-[#F0FDF4] text-[#006B3F] font-bold border border-emerald-200 shadow-2xs'
                          : isPending
                          ? 'text-slate-900 bg-red-50/60 hover:bg-red-50 font-bold border border-red-100'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#006B3F]' : isPending ? 'text-red-500' : 'text-slate-400'}`} />
                        <span className="truncate">{entry.item.label}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        {isPending && (
                          <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                            Pending
                          </span>
                        )}
                        {entry.item.badge && !isPending && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full">
                            {entry.item.badge}
                          </span>
                        )}
                      </div>
                    </NavLink>
                  );
                }

                // TYPE B: ACCORDION SUB-FOLDER (SHOWS "OTHER STUFFS" ON CLICK)
                if (entry.type === 'folder') {
                  const isExpanded = expandedFolders[entry.folder.id] ?? false;
                  // Dynamic heading-based icon (NEVER a generic repeated folder icon)
                  const HeadingIcon = entry.folder.icon || getHeadingIcon(entry.folder.label);
                  const hasActiveChild = entry.folder.children.some((c) => isLinkActive(c.to));
                  const folderPending = isFolderPending(entry.folder);

                  return (
                    <div key={entry.folder.id} className="pt-0.5">
                      {/* Folder Toggle Button */}
                      <button
                        onClick={() => toggleFolder(entry.folder.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all duration-150 cursor-pointer ${
                          hasActiveChild
                            ? 'bg-slate-100 text-slate-900 font-bold border border-slate-200/80'
                            : folderPending
                            ? 'text-slate-900 bg-red-50/40 hover:bg-red-50/80 font-bold border border-red-100/80'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <HeadingIcon
                            className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                              hasActiveChild ? 'text-[#006B3F]' : folderPending ? 'text-red-500' : 'text-slate-500'
                            }`}
                          />
                          <span className="truncate">{entry.folder.label}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          {folderPending && (
                            <span
                              className="w-2 h-2 rounded-full bg-red-500 animate-pulse ring-2 ring-red-200"
                              title="Contains pending actionable items"
                            />
                          )}
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full font-mono">
                            {entry.folder.children.length}
                          </span>
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </motion.div>
                        </div>
                      </button>

                      {/* Smooth Accordion Expansion with Nested "Other Stuffs" */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="overflow-hidden pl-4 pr-1 mt-1 space-y-0.5 border-l-2 border-slate-200/80 ml-3.5"
                          >
                            {entry.folder.children.map((child) => {
                              const active = isLinkActive(child.to);
                              const childPending = isRoutePending(child.to);
                              return (
                                <NavLink
                                  key={child.id}
                                  to={child.to}
                                  onClick={handleItemSelect}
                                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer ${
                                    active
                                      ? 'bg-[#F0FDF4] text-[#006B3F] font-bold border border-emerald-200 shadow-2xs'
                                      : childPending
                                      ? 'text-slate-900 bg-red-50/60 hover:bg-red-50 font-bold border border-red-100'
                                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                  }`}
                                >
                                  <div className="flex items-center space-x-1.5 truncate">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        active
                                          ? 'bg-[#006B3F]'
                                          : childPending
                                          ? 'bg-red-500 ring-2 ring-red-200 animate-pulse'
                                          : 'bg-slate-300'
                                      }`}
                                    />
                                    <span className="truncate">{child.label}</span>
                                  </div>
                                  <div className="flex items-center space-x-1 shrink-0">
                                    {childPending && (
                                      <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                        Pending
                                      </span>
                                    )}
                                    {child.badge && !childPending && (
                                      <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1 py-0.2 rounded">
                                        {child.badge}
                                      </span>
                                    )}
                                  </div>
                                </NavLink>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }

                return null;
              })}

              {displayedEntries.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400 italic">
                  No matching options in {currentPillarConfig.label}
                </div>
              )}
            </nav>
          </div>
        )}
      </aside>

      {/* Floating Expand Tab when sub-nav is collapsed */}
      {isSubNavCollapsed && (
        <button
          onClick={handleMouseEnterSidebar}
          onMouseEnter={handleMouseEnterSidebar}
          className="self-center -ml-2 z-30 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-r-lg p-1 shadow-md hover:bg-slate-50 transition cursor-pointer"
          title="Expand sub-menu"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default DualTierSidebar;
