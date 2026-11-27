// Department responsibility areas for senior roles (directors, CXOs, management).
// Must stay in sync with the CHECK constraints in
// supabase/migrations/20261127150000_business_development_department.sql

export type ResponsibilityArea = 'finance' | 'operations' | 'field_staff' | 'site_staff' | 'hr' | 'business_development';

export const RESPONSIBILITY_AREAS: { id: ResponsibilityArea; label: string; description: string }[] = [
  { id: 'finance', label: 'Finance', description: 'Finance & accounts staff, invoices, finance tracker' },
  { id: 'operations', label: 'Operations', description: 'Operations managers, site managers, supervisors' },
  { id: 'field_staff', label: 'Field Staff', description: 'Field officers, field managers, field staff' },
  { id: 'site_staff', label: 'Site Staff', description: 'Security, housekeeping, technicians, MEP' },
  { id: 'hr', label: 'HR', description: 'HR, HR ops, recruitment' },
  { id: 'business_development', label: 'Business Development', description: 'Business developers (BD)' },
];

/** Roles that see everything; they never need responsibility areas. */
export const PLATFORM_ADMIN_ROLES = ['admin', 'super_admin', 'developer'];

/** Senior roles whose visibility is scoped by the responsibility-area checkboxes. */
export const isAreaScopedRole = (roleId?: string | null): boolean => {
  const r = (roleId || '').toLowerCase();
  if (!r) return false;
  return (
    ['management', 'director', 'ceo', 'coo', 'cto', 'cfo', 'cxo', 'general_manager'].includes(r) ||
    r.startsWith('chief_') ||
    r.includes('director')
  );
};

export const isPlatformAdminRole = (roleId?: string | null): boolean =>
  PLATFORM_ADMIN_ROLES.includes((roleId || '').toLowerCase());

/** HR Onboarding roles (incl. the misspelt production role id `hr_onboaring`).
 *  Must match public.is_hr_onboarding_role() in 20261127180000_hr_onboarding_alerts.sql */
export const isHrOnboardingRole = (roleId?: string | null): boolean =>
  ['hr_onboarding', 'hr_onboaring'].includes((roleId || '').toLowerCase());
