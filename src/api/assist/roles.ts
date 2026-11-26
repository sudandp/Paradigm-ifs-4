/**
 * Role → access rules for Paradigm Assist data answers.
 * ONE place to change who-sees-what. Unknown roles fall back to 'self' with basic capabilities.
 */
import type { Capability, ScopeLevel } from './types.js';

/** See everyone (people data). */
export const ORG_WIDE_ROLES = new Set([
  'admin', 'super_admin', 'developer', 'management', 'director', 'chief_experience_officer',
  'hr', 'hr_ops', 'hr_onboaring', 'hr_recruitment',
]);

/** See their reporting tree (recursive) + staff at their Responsibility-Matrix sites. */
export const TEAM_ROLES = new Set([
  'operation_manager', 'reporting_manager', 'site_manager', 'field_officer',
  'technical_manager', 'technical_supervisor', 'admin_manager',
]);

export const ADMIN_ROLES = new Set(['admin', 'super_admin', 'developer', 'management', 'director', 'chief_experience_officer']);
export const HR_ROLES = new Set(['hr', 'hr_ops', 'hr_onboaring', 'hr_recruitment']);
export const FINANCE_ROLES = new Set([
  'finance', 'finance_manager', 'finance_controller', 'senior_accountant', 'senior_accountant_southwall',
  'accounts_excitative', 'accounts_excitative_invoice', 'accounts_excitative_southwall', 'auditor',
]);
export const CRM_ROLES = new Set(['business_developer', 'senior_manager_–_client_partnerships']);
export const AUDIT_TRAIL_ROLES = new Set(['admin', 'super_admin', 'developer', 'director']);

export function scopeLevelFor(role: string): ScopeLevel {
  if (!role || role === 'unverified') return 'none';
  if (ORG_WIDE_ROLES.has(role)) return 'all';
  if (TEAM_ROLES.has(role)) return 'team';
  return 'self';
}

export function capabilitiesFor(role: string): Set<Capability> {
  const caps = new Set<Capability>();
  if (!role || role === 'unverified') return caps;
  // everyone verified: own attendance/leave, basic directory, tickets/escalation, ops info (sites, weather)
  caps.add('attendance'); caps.add('leave'); caps.add('directory'); caps.add('tickets'); caps.add('ops');
  // own GPS is always allowed by the tool itself; others' GPS needs 'tracking'
  if (ADMIN_ROLES.has(role) || TEAM_ROLES.has(role)) caps.add('tracking');
  if (ADMIN_ROLES.has(role) || HR_ROLES.has(role) || TEAM_ROLES.has(role)) caps.add('directory_phone');
  if (ADMIN_ROLES.has(role) || HR_ROLES.has(role)) { caps.add('hr_records'); caps.add('comms'); }
  if (ADMIN_ROLES.has(role) || FINANCE_ROLES.has(role) || role === 'operation_manager') caps.add('finance');
  if (ADMIN_ROLES.has(role) || CRM_ROLES.has(role)) caps.add('crm');
  if (AUDIT_TRAIL_ROLES.has(role)) caps.add('audit_trail');
  return caps;
}

/** Finance sees every site; ops managers only their matrix sites (handled in scope.ts). */
export const FINANCE_ALL_SITES_ROLES = new Set([...ADMIN_ROLES, ...FINANCE_ROLES]);

/** Columns/tables that must NEVER appear in any tool output. */
export const NEVER_EXPOSE = {
  tables: ['user_children', 'salary_structure_config', 'smtp_accounts', 'smtp_accounts_usage', 'settings', 'system_backups', 'fcm_tokens', 'app_config'],
  userColumns: ['passcode', 'face_embedding_512', 'home_latitude', 'home_longitude', 'home_address', 'archived_original_email', 'date_of_birth', 'salary_hold_reason'],
  locationColumns: ['kiosk_pin'],
  note: 'user_documents: status (uploaded / missing / type) only — never file URLs or document numbers.',
};

export const ROLE_LABEL = (role: string) => role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
