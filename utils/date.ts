/**
 * Formats a date string or Date object into a readable string/time
 */
export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return 'Never';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const dayDiff = Math.floor(diff / (1000 * 3600 * 24));
  
  // If less than 24 hours ago, show relative time
  if (dayDiff === 0) {
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  }
  
  // If less than 7 days ago, show day name
  if (dayDiff < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  }
  
  // Otherwise show full date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

import type { ThirdSaturdayPolicyConfig } from '../types/attendance';

export const DEFAULT_THIRD_SATURDAY_POLICY: ThirdSaturdayPolicyConfig = {
  enabled: true,
  officeStaffOnly: true,
  femaleExempt: true,
  applicableEntities: [
    'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD (Bangalore)',
    'AP Enterprises (Bangalore)',
    'SOUTHWALL SECURITY LLP (Bangalore)'
  ],
  exemptEntities: [
    'PARADIGM PROPERTY & FACILITY MANAGEMENT SERVICES (Bangalore)',
    'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD (Hyderabad)'
  ],
  applicableLocations: [
    'Head Office',
    'Bangalore',
    'Bengaluru',
    'BLR',
    'Karnataka'
  ],
  exemptLocations: [
    'Hyderabad',
    'Hydrabath',
    'Telangana',
    'Secunderabad'
  ],
  requireReportingManagerApproval: true,
  allowDirectUnlockOnApproval: true,
  notifyReportingManager: true
};

let _runtimeThirdSaturdayPolicy: ThirdSaturdayPolicyConfig | null = null;

export function setRuntimeThirdSaturdayPolicy(policy: ThirdSaturdayPolicyConfig | null) {
  _runtimeThirdSaturdayPolicy = policy;
  if (typeof window !== 'undefined') {
    (window as any).__thirdSaturdayPolicy = policy;
  }
}

export function getRuntimeThirdSaturdayPolicy(): ThirdSaturdayPolicyConfig {
  if (_runtimeThirdSaturdayPolicy) return _runtimeThirdSaturdayPolicy;
  if (typeof window !== 'undefined' && (window as any).__thirdSaturdayPolicy) {
    return (window as any).__thirdSaturdayPolicy;
  }
  return DEFAULT_THIRD_SATURDAY_POLICY;
}

/**
 * Checks if a given date is the 3rd Saturday of the month
 */
export function isThirdSaturday(date: Date = new Date()): boolean {
  if (date.getDay() !== 6) return false; // 6 = Saturday
  const dayOfMonth = date.getDate();
  return dayOfMonth >= 15 && dayOfMonth <= 21;
}

/**
 * Checks if a user is Head Office / Office Staff (Image 2).
 * Excludes site staff (security guards, cleaners, site technicians assigned to societies).
 */
export function isHeadOfficeOrOfficeStaff(user: any): boolean {
  if (!user) return true;

  // 1. Explicit staff category
  const staffCategory = String(user.staffCategory || user.staff_category || user.category || '').trim().toLowerCase();
  if (staffCategory === 'site' || staffCategory === 'field') return false;
  if (staffCategory === 'office' || staffCategory === 'admin' || staffCategory === 'management') return true;

  // 2. Assigned site / entity (Image 2: [x] Head Office MANDATORY (HQ))
  const sitesStr = [
    user.organizationName,
    user.organization_name,
    user.societyName,
    user.assignedSites,
    user.siteNames,
    user.location,
    user.locationName
  ].filter(Boolean).join(' ').toLowerCase();

  if (sitesStr.includes('head office') || sitesStr.includes('corporate') || (user as any).isHeadOffice) {
    return true;
  }

  // 3. Role check
  const role = String(user.role || '').trim().toLowerCase();
  if (
    role.includes('guard') || 
    role.includes('site_') || 
    role.includes('technician') || 
    role.includes('plumber') || 
    role.includes('electrician') || 
    role.includes('reliever') || 
    role.includes('caretaker') ||
    role.includes('housekeeping')
  ) {
    return false;
  }

  const officeRoles = [
    'admin', 'hr', 'finance', 'developer', 'hr_ops', 'management', 'super_admin', 'iot_architect',
    'accountant', 'senior_accountant', 'accounts_executive', 'accounts_excitative',
    'finance_manager', 'hr_onboarding', 'hr_recruitment', 'auditor', 'director', 'facility_executive',
    'back_office_staff', 'pantry_boy', 'office_staff', 'office'
  ];

  if (officeRoles.some(r => role === r || role.includes(r))) {
    return true;
  }

  // 4. If assigned exclusively to client societies (e.g. 42 Estate Queens Square) without Head Office
  if (user.organizationId && !sitesStr.includes('head office')) {
    return false;
  }

  return true;
}

/**
 * Checks if the 3rd Saturday work restriction / policy is applicable to a specific user.
 * 
 * Rules:
 * 1. Policy disabled -> false (everyone can punch in).
 * 2. Office / Head Office Staff ONLY (Image 2): Site staff assigned to societies have no restriction.
 * 3. Female users: NO restriction (when femaleExempt is true).
 * 4. Exempt entities (e.g. PPFMS, PIFS Hyderabad): NO restriction.
 * 5. Exempt locations (e.g. Hyderabad / Hydrabath): NO restriction.
 * 6. Applicable only to target locations (e.g. Head Office, Bangalore / Karnataka).
 * 7. Applicable only to target entities (PIFS, AP Enterprises, Southwall).
 * 8. All others: NO restriction.
 */
export function isThirdSaturdayPolicyApplicable(
  user?: any | null, 
  lastCompany?: string | null,
  policyConfig?: ThirdSaturdayPolicyConfig | null
): boolean {
  if (!user) return true;

  const policy = policyConfig || getRuntimeThirdSaturdayPolicy();

  // If policy is disabled globally, restriction is not applicable
  if (policy.enabled === false) {
    return false;
  }

  // 1. Office / Head Office Staff Only check (Image 2)
  if (policy.officeStaffOnly !== false && !isHeadOfficeOrOfficeStaff(user)) {
    return false; // Site / Field staff assigned to client societies are completely exempt
  }

  // 2. Female users have NO restriction if femaleExempt is enabled
  const gender = String(user.gender || '').trim().toLowerCase();
  if (policy.femaleExempt && (gender === 'female' || gender === 'ladies' || gender === 'f')) {
    return false;
  }

  // Location string
  const locationStr = [
    user.location,
    user.locationName,
    user.location_name,
    user.city,
    user.state,
    user.branch,
    user.societyName,
    user.homeAddress
  ].filter(Boolean).join(' ').toLowerCase();

  // Organization / entity string
  const orgStr = [
    user.organizationName,
    user.organization_name,
    user.societyName,
    user.company,
    user.companyName,
    user.company_name,
    user.companyCode,
    user.shortName,
    user.short_name,
    user.alias,
    user.entity,
    user.entityName,
    user.department,
    user.operatingCompany,
    lastCompany,
    (user as any).lastCompany
  ].filter(Boolean).join(' ').toLowerCase();

/**
 * Helper to match an entity rule item against a user's orgStr and locationStr.
 * Supports both plain entity names (e.g. "PIFS", "Southwall")
 * AND entity names with location specification (e.g. "PARADIGM INTEGRATED FACILITY SERVICES PVT LTD (Hyderabad)" or "PIFS - Bangalore")
 */
function matchEntityItem(ruleItem: string, orgStr: string, locationStr: string): boolean {
  if (!ruleItem) return false;
  const raw = ruleItem.trim();
  if (!raw) return false;

  // Check if rule item specifies a location in parentheses or hyphen, e.g. "Company (Location)" or "Company - Location"
  let entityTarget = raw;
  let locTarget: string | null = null;

  const parenMatch = raw.match(/^(.*?)\s*[([]\s*(.*?)\s*[)\]]$/);
  const hyphenMatch = !parenMatch ? raw.match(/^(.*?)\s*-\s*([A-Za-z\s]+)$/) : null;

  if (parenMatch) {
    entityTarget = parenMatch[1].trim();
    locTarget = parenMatch[2].trim().toLowerCase();
  } else if (hyphenMatch) {
    entityTarget = hyphenMatch[1].trim();
    locTarget = hyphenMatch[2].trim().toLowerCase();
  }

  // If location is specified in the rule, verify the user belongs to that location
  if (locTarget) {
    const userLoc = `${locationStr} ${orgStr}`.toLowerCase();
    const locRegex = new RegExp(`\\b${locTarget}\\b`, 'i');
    if (!locRegex.test(userLoc) && !userLoc.includes(locTarget)) {
      return false; // Does not match required location
    }
  }

  const norm = entityTarget.toLowerCase();
  if (!norm) return false;

  // Direct substring match
  if (orgStr.includes(norm)) return true;

  // Word boundary regex match with flexible whitespace
  const escaped = norm.replace(/\s+/g, '\\s*');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  if (regex.test(orgStr)) return true;

  // Known entity abbreviation cross-mappings
  if ((norm.includes('southwall') || norm.includes('swllp')) && (orgStr.includes('southwall') || orgStr.includes('south wall') || orgStr.includes('swllp'))) {
    return true;
  }
  if ((norm.includes('pifs') || norm.includes('paradigm integrated')) && (orgStr.includes('pifs') || orgStr.includes('paradigm integrated'))) {
    return true;
  }
  if ((norm.includes('ppfms') || norm.includes('paradigm property')) && (orgStr.includes('ppfms') || orgStr.includes('paradigm property'))) {
    return true;
  }
  if (norm.includes('ap enterpri') && orgStr.includes('ap enterpri')) {
    return true;
  }

  return false;
}

  // 2. Exempt entities check (e.g. PPFMS, PIFS (Hyderabad))
  if (policy.exemptEntities && policy.exemptEntities.length > 0) {
    const isExemptOrg = policy.exemptEntities.some(item => matchEntityItem(item, orgStr, locationStr));
    if (isExemptOrg) {
      return false;
    }
  }

  // 3. Exempt locations check (e.g. Hyderabad / Hydrabath)
  if (policy.exemptLocations && policy.exemptLocations.length > 0) {
    const isExemptLoc = policy.exemptLocations.some(item => {
      const norm = item.trim().toLowerCase();
      return norm && (locationStr.includes(norm) || orgStr.includes(norm));
    });
    if (isExemptLoc) {
      return false;
    }
  }

  // 4. Must be in applicable locations (e.g. Bangalore / Karnataka)
  if (policy.applicableLocations && policy.applicableLocations.length > 0 && locationStr) {
    const isApplicableLocation = policy.applicableLocations.some(item => {
      const norm = item.trim().toLowerCase();
      if (!norm) return false;
      const regex = new RegExp(`\\b${norm}\\b`, 'i');
      return regex.test(locationStr) || locationStr.includes(norm);
    });

    if (!isApplicableLocation) {
      return false;
    }
  }

  // 5. Applicable ONLY to specified target entities (e.g. PIFS (Bangalore), AP Enterprises, Southwall)
  if (policy.applicableEntities && policy.applicableEntities.length > 0 && orgStr) {
    const isTargetOrg = policy.applicableEntities.some(item => matchEntityItem(item, orgStr, locationStr));

    if (!isTargetOrg) {
      return false; // Other entities outside target list have no restriction
    }
  }

  return true;
}

/**
 * Formats a date string, Date object, or timestamp into DD/MM/YYYY format without timezone shifts
 * e.g. "1998-03-02" -> "02/03/1998"
 * e.g. "2026-09-01" -> "01/09/2026"
 */
export function formatDisplayDate(dateStr?: string | Date | number | null): string {
  if (!dateStr) return '-';
  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    if (!trimmed || trimmed === '-' || trimmed === '—') return '-';

    // Already DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;

    // YYYY-MM-DD or YYYY/MM/DD (handles timestamps with T or space as well)
    const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    // DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }

  if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
    const d = String(dateStr.getDate()).padStart(2, '0');
    const m = String(dateStr.getMonth() + 1).padStart(2, '0');
    const y = dateStr.getFullYear();
    return `${d}/${m}/${y}`;
  }

  return String(dateStr);
}
