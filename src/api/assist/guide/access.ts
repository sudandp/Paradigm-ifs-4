/**
 * App-guide access check (server side): can this asker open a given in-app page?
 *
 * Mirrors the browser logic exactly (no browser code imported):
 *  - store/permissionsStore.ts  `defaultPermissions` + `initRoles()` (a DB `roles` row with a permissions
 *    array REPLACES the defaults: base ∪ DB perms; a DB row without permissions falls back to defaults /
 *    technician; a role unknown to both gets the ProtectedRoute base fallback)
 *  - components/auth/ProtectedRoute.tsx  (admin bypass, essential permissions, director finance block)
 *  - utils/auth.ts `isAdmin`  (admin / super admin / developer)
 * Read-only: one cached `roles` select.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Permission } from '../../../../types/user';

/** Ported from store/permissionsStore.ts `defaultPermissions` (keep in sync). */
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  unverified: [],
  client: ['view_site_attendance'],
  client_panel: ['view_site_attendance'],
  admin: [
    'view_all_submissions', 'manage_users', 'manage_sites', 'view_entity_management', 'view_templates_hub',
    'view_ht_master_data', 'view_ht_yard_audits', 'view_ppm_audits', 'view_audit_change_log', 'view_snag_audit', 'view_site_audit_report', 'view_snag_report', 'view_ppm_audit_report',
    'view_helpdesk_tickets', 'view_preventive_maintenance', 'view_contract_manager', 'view_resident_portal',
    'view_profitability', 'view_payment_tracker', 'view_audit_trail', 'manage_family_verification',
    'view_attendance_bulk_feed', 'view_monthly_attendance_feed', 'manage_user_vehicles',
    'view_voip_configuration', 'view_notification_management',
    'view_developer_settings', 'view_operations_dashboard', 'view_site_dashboard',
    'create_enrollment', 'manage_roles_and_permissions', 'manage_attendance_rules',
    'view_all_attendance', 'view_own_attendance', 'apply_for_leave', 'manage_leave_requests',
    'manage_approval_workflow', 'download_attendance_report', 'manage_tasks',
    'manage_policies', 'manage_insurance', 'manage_enrollment_rules',
    'manage_uniforms', 'view_invoice_summary', 'view_verification_costing',
    'view_field_staff_tracking', 'manage_modules', 'access_support_desk',
    'view_my_team', 'view_field_reports', 'manage_biometric_devices', 'manage_device_approvals', 'view_kiosk_monitoring', 'manage_linked_devices',
    'manage_gate_registration', 'view_gate_logs', 'manage_gate_kiosk',
    'manage_geo_locations', 'view_my_locations', 'view_profile',
    'view_referrals', 'view_candidate_referrals', 'view_business_referrals', 'view_my_referrals',
    'view_client_dashboard', 'view_site_attendance', 'view_management_dashboard',
    'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile',
    'view_paradigm_assist', 'manage_paradigm_assist', 'manage_whatsapp_helpdesk',
  ],
  hr: [
    'view_all_submissions', 'manage_users', 'manage_sites', 'view_entity_management', 'view_templates_hub',
    'view_ht_master_data', 'view_ht_yard_audits', 'view_ppm_audits', 'view_audit_change_log', 'view_snag_audit', 'view_site_audit_report', 'view_snag_report', 'view_ppm_audit_report',
    'manage_family_verification', 'view_attendance_bulk_feed', 'view_monthly_attendance_feed',
    'manage_attendance_rules', 'view_all_attendance', 'view_own_attendance',
    'apply_for_leave', 'manage_leave_requests', 'download_attendance_report',
    'manage_policies', 'manage_insurance', 'manage_enrollment_rules',
    'manage_uniforms', 'view_invoice_summary', 'view_verification_costing', 'access_support_desk',
    'view_profile', 'view_referrals', 'view_candidate_referrals', 'view_business_referrals', 'view_my_referrals', 'manage_device_approvals', 'manage_gate_registration', 'view_gate_logs', 'manage_gate_kiosk',
    'view_management_dashboard', 'view_site_attendance',
    'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile',
    'view_paradigm_assist', 'manage_paradigm_assist',
  ],
  finance: ['view_invoice_summary', 'view_verification_costing', 'view_own_attendance', 'apply_for_leave', 'view_profile', 'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile', 'view_paradigm_assist'],
  operation_manager: [
    'view_operations_dashboard', 'view_site_attendance', 'view_ht_yard_audits', 'view_ppm_audits', 'view_audit_change_log', 'view_snag_audit', 'view_site_audit_report', 'view_snag_report', 'view_ppm_audit_report',
    'view_helpdesk_tickets', 'view_preventive_maintenance', 'view_contract_manager', 'view_resident_portal',
    'view_all_attendance', 'view_own_attendance', 'apply_for_leave', 'manage_leave_requests', 'access_support_desk',
    'view_my_team', 'view_field_reports', 'view_field_staff_tracking', 'manage_geo_locations', 'view_my_locations', 'view_profile',
    'download_attendance_report', 'view_mobile_nav_home', 'view_mobile_nav_profile', 'view_paradigm_assist', 'manage_paradigm_assist',
  ],
  site_manager: ['view_site_dashboard', 'view_site_attendance', 'create_enrollment', 'view_my_team', 'view_own_attendance', 'apply_for_leave', 'manage_leave_requests', 'access_support_desk', 'view_profile', 'view_client_dashboard', 'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile', 'view_paradigm_assist'],
  field_staff: ['create_enrollment', 'view_own_attendance', 'apply_for_leave', 'access_support_desk', 'view_profile', 'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile', 'view_paradigm_assist'],
  hr_ops: ['view_all_submissions', 'manage_users', 'manage_sites', 'view_entity_management', 'view_templates_hub', 'view_all_attendance', 'view_own_attendance', 'view_attendance_tracker', 'download_attendance_report', 'create_enrollment', 'manage_enrollment_rules', 'view_profile', 'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'],
  hr_onboarding: ['view_all_submissions', 'manage_users', 'manage_sites', 'view_entity_management', 'view_templates_hub', 'view_all_attendance', 'view_own_attendance', 'view_attendance_tracker', 'download_attendance_report', 'create_enrollment', 'manage_enrollment_rules', 'view_profile', 'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'],
  hr_operations: ['view_all_submissions', 'manage_users', 'manage_sites', 'view_entity_management', 'view_templates_hub', 'view_all_attendance', 'view_own_attendance', 'view_attendance_tracker', 'download_attendance_report', 'create_enrollment', 'manage_enrollment_rules', 'view_profile', 'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'],
  finance_manager: ['view_all_submissions', 'view_entity_management', 'view_templates_hub', 'view_invoice_summary', 'view_verification_costing', 'view_own_attendance', 'apply_for_leave', 'view_profile', 'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'],
  business_developer: ['view_crm_pipeline', 'view_my_referrals', 'access_support_desk', 'view_profile', 'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'],
  technician: ['create_enrollment', 'view_own_attendance', 'apply_for_leave', 'access_support_desk', 'view_profile', 'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'],
};
// developer / management share the admin list in the app (management minus a few admin-only extras)
DEFAULT_PERMISSIONS.developer = [...DEFAULT_PERMISSIONS.admin].filter(p => p !== 'manage_whatsapp_helpdesk');
DEFAULT_PERMISSIONS.management = [...DEFAULT_PERMISSIONS.admin].filter(p => !['manage_whatsapp_helpdesk', 'view_paradigm_assist', 'manage_paradigm_assist', 'view_site_attendance'].includes(p));

/** permissionsStore.initRoles: always merged into a DB role's permissions. */
const BASE_PERMISSIONS = ['view_profile', 'view_own_attendance', 'apply_for_leave', 'view_mobile_nav_home', 'view_mobile_nav_profile'];
/** ProtectedRoute: always allowed for any verified user. */
const ESSENTIAL_PERMISSIONS = new Set(['view_profile', 'view_own_attendance', 'apply_for_leave']);
/** ProtectedRoute: directors are blocked from these even if their role has them. */
const DIRECTOR_BLOCKED = new Set(['view_invoice_summary', 'view_verification_costing', 'manage_finance_settings', 'view_finance_reports', 'view_profitability', 'view_payment_tracker']);

/** utils/auth.ts isAdmin */
export const isAdminRole = (role?: string | null) => {
  if (!role) return false;
  const n = role.toLowerCase().replace(/_/g, ' ').trim();
  return n === 'admin' || n === 'super admin' || n === 'superadmin' || n === 'developer';
};

interface RoleRow { id: string; display_name: string | null; permissions: string[] | null }
let rolesCache: { at: number; rows: RoleRow[] } | null = null;
const ROLES_TTL_MS = 5 * 60 * 1000;

export async function loadRoles(sb: SupabaseClient): Promise<RoleRow[]> {
  if (rolesCache && Date.now() - rolesCache.at < ROLES_TTL_MS) return rolesCache.rows;
  const { data, error } = await sb.from('roles').select('id, display_name, permissions');
  if (error) { console.warn('[Assist guide] roles load failed:', error.message); return rolesCache?.rows ?? []; }
  rolesCache = { at: Date.now(), rows: (data ?? []) as RoleRow[] };
  return rolesCache.rows;
}

/** Effective permission list of a role, the way the app computes it after `initRoles(roles)`. */
export function effectivePermissions(roleId: string, roles: RoleRow[]): Set<string> {
  const id = (roleId || '').toLowerCase();
  if (!id || id === 'unverified') return new Set();
  const row = roles.find(r => r.id?.toLowerCase() === id);
  let perms: string[];
  if (row && row.permissions) perms = [...BASE_PERMISSIONS, ...(Array.isArray(row.permissions) ? row.permissions.filter(Boolean) : [])];
  else perms = DEFAULT_PERMISSIONS[id] ?? (row ? DEFAULT_PERMISSIONS.technician : []);
  if (!perms.length) perms = id.includes('client') ? ['view_site_attendance', 'view_client_dashboard', 'apply_for_leave'] : BASE_PERMISSIONS;
  return new Set(perms);
}

export interface GuideAccess {
  roleId: string;
  roleLabel: string;
  isAdmin: boolean;
  isDirector: boolean;
  perms: Set<string>;
  /** Same decision as ProtectedRoute for a route guarded by `perm` (null/undefined = open to every signed-in user). */
  can(perm?: Permission | string | null): boolean;
}

export async function accessFor(sb: SupabaseClient, roleId: string): Promise<GuideAccess> {
  const roles = await loadRoles(sb);
  const id = (roleId || '').toLowerCase();
  const perms = effectivePermissions(id, roles);
  const admin = isAdminRole(id);
  const director = id.includes('director');
  const row = roles.find(r => r.id?.toLowerCase() === id);
  const verified = !!id && id !== 'unverified';
  return {
    roleId: id,
    roleLabel: row?.display_name || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    isAdmin: admin,
    isDirector: director,
    perms,
    can(perm) {
      if (!verified) return false;
      if (!perm) return true;
      if (director && DIRECTOR_BLOCKED.has(perm)) return false;
      return admin || perms.has(perm) || ESSENTIAL_PERMISSIONS.has(perm);
    },
  };
}

/** Display names of roles that can open a page guarded by `perm` (for "who has access" hints). */
export async function rolesWithPermission(sb: SupabaseClient, perm: string, limit = 6): Promise<string[]> {
  const roles = await loadRoles(sb);
  const names = roles
    .filter(r => r.id !== 'unverified' && !isAdminRole(r.id) && !(r.id.includes('director') && DIRECTOR_BLOCKED.has(perm)) && effectivePermissions(r.id, roles).has(perm))
    .map(r => r.display_name || r.id);
  const uniq = [...new Set(names.map(n => n.replace(/\s+/g, ' ').trim()))];
  return ['Admin', ...uniq].slice(0, limit);
}
