import type { User } from '../types';
import type { SiteResponsibilityMatrix } from '../types/siteRouting';

// Normalization utilities matching SiteResponsibilityMatrix
export const getCleanRoot = (name: string): string => {
  if (!name) return '';
  const words = name.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/).filter(w => w.length >= 3);
  let root = words[0] || name.trim().toLowerCase();
  if (root === 'arpitha') root = 'arpita';
  if (root === 'poojashree' || root === 'poojashri') root = 'pooja';
  return root;
};

export const getCanonicalUserName = (user: Partial<User> | null | undefined): string => {
  if (!user) return '';
  const email = (user.email || '').toLowerCase();
  const rawName = (user.name || '').trim();

  // Canonical name mappings
  if (rawName.toLowerCase() === 'chennamma' || (email === 'chandana.hr@paradigmfms.com' && rawName.toLowerCase().includes('chennamma'))) return 'Chennamma';
  if (email === 'onboarding@paradigmfms.com') return 'Chandana R';
  if (email === 'pooja@paradigmfms.in') return 'Poojashree S';
  if (email === 'hr.kavya@paradigmfms.com') return 'Kavya M';
  if (rawName.toLowerCase() === 'pooja') return 'Poojashree S';
  if (email === 'arpitha@paradigmfms.com' || rawName.toLowerCase().includes('arpitha') || rawName.toLowerCase().includes('arpita')) return 'Arpitha Nair';
  if (email === 'vishwa.finance@paradigmfms.com' || rawName.toLowerCase() === 'vishwa finance' || rawName.toLowerCase() === 'vishwa') return 'Vishwa';
  if (email === 'sinchana@paradigmfms.in' || rawName.toLowerCase() === 'sinchana') return 'Sinchana KM';
  if (email === 'aryasouthwall@paradigmfms.in' || rawName.toLowerCase() === 'arya' || rawName.toLowerCase().includes('arya')) return 'Arya Thomas';
  if (email === 'sandeep.accounts@paradigmfms.com') return 'Sandeep Biswas';
  if (email === 'chethan@paradigmfms.com') return 'Chethan V';
  return rawName;
};

/**
 * Official Company Short Names & Full Legal Entity Names:
 * - PIFS: Paradigm Integrated Facility Management Services
 * - SWLLP: SOUTHWALL SECURITY LLP
 * - PIFS & SWLLP: Split (PIFS & SWLLP)
 * - PPFMS: PARADIGM PROPERTY & FACILITY MANAGEMENT SERVICES
 * - PIFS & PPFMS: Joint (PIFS & PPFMS)
 * - PPFMS & SWLLP: Split (PPFMS & SWLLP)
 */
export const COMPANY_FULL_NAMES: Record<string, string> = {
  'PIFS': 'Paradigm Integrated Facility Management Services',
  'SWLLP': 'SOUTHWALL SECURITY LLP',
  'PIFS & SWLLP': 'Split: Paradigm Integrated Facility Management Services & SOUTHWALL SECURITY LLP',
  'PPFMS': 'PARADIGM PROPERTY & FACILITY MANAGEMENT SERVICES',
  'PIFS & PPFMS': 'Joint: Paradigm Integrated Facility Management Services & PPFMS',
  'PPFMS & SWLLP': 'Split: PPFMS & SOUTHWALL SECURITY LLP'
};

export const normalizeCompanyShortName = (rawCompany: string | null | undefined): string => {
  if (!rawCompany) return 'PIFS';
  const c = rawCompany.trim();
  const cUpper = c.toUpperCase();

  // 1. Standard Short Codes
  if (cUpper === 'PIFS') return 'PIFS';
  if (cUpper === 'SWLLP') return 'SWLLP';
  if (cUpper === 'PPFMS') return 'PPFMS';
  if (cUpper === 'PIFS & SWLLP' || cUpper === 'PIFS + SWLLP' || cUpper === 'PIFS & SW' || cUpper === 'PIFS + SW') {
    return 'PIFS & SWLLP';
  }
  if (cUpper === 'PIFS & PPFMS' || cUpper === 'PIFS + PPFMS') {
    return 'PIFS & PPFMS';
  }
  if (cUpper.includes('PPFMS') && (cUpper.includes('SWLLP') || cUpper.includes('SW'))) {
    return 'PPFMS & SWLLP';
  }

  // 2. Hybrid / Security outsourced strings
  if (cUpper.includes('SECURITY OUTSOURCED')) {
    return 'PIFS';
  }

  // 3. Full name mapping
  if (cUpper.includes('SOUTHWALL') || cUpper.includes('SWIFT WING')) {
    if (cUpper.includes('PIFS') || cUpper.includes('PARADIGM')) return 'PIFS & SWLLP';
    if (cUpper.includes('PPFMS')) return 'PPFMS & SWLLP';
    return 'SWLLP';
  }
  if (cUpper.includes('PARADIGM PROPERTY') || cUpper.includes('PPFMS')) {
    return 'PPFMS';
  }
  if (cUpper.includes('PARADIGM INTEGRATED') || cUpper.includes('PIFS')) {
    return 'PIFS';
  }

  return c;
};

export const COMPANY_GROUPS = {
  PARADIGM: [
    'PIFS',
    'PPFMS',
    'PIFS & PPFMS',
    'Paradigm Integrated Facility Management Services',
    'Paradigm Integrated Facility Services',
    'PARADIGM PROPERTY & FACILITY MANAGEMENT SERVICES'
  ],
  SOUTH_WALL: [
    'SWLLP',
    'SOUTHWALL SECURITY LLP',
    'SOUTHWALL',
    'Swift Wing LLP'
  ]
};

export interface UserRoutingScope {
  isGlobalAdmin: boolean;
  canonicalName: string;
  userEmail: string;
  allowedCompanies: string[]; // empty if global admin (meaning all)
  permittedSiteNames: Set<string>;
  permittedSiteList: string[];
  isSitePermitted: (siteName: string, companyName?: string) => boolean;
}

/**
 * Determines which companies and sites a user is authorized to view, download, and update.
 */
export function getUserRoutingScope(
  user: Partial<User> | null | undefined,
  matrixList: SiteResponsibilityMatrix[]
): UserRoutingScope {
  if (!user) {
    return {
      isGlobalAdmin: false,
      canonicalName: '',
      userEmail: '',
      allowedCompanies: [],
      permittedSiteNames: new Set<string>(),
      permittedSiteList: [],
      isSitePermitted: () => false
    };
  }

  const role = (user.role || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  const isGlobalAdmin = ['admin', 'super_admin', 'management', 'developer', 'hr_ops'].includes(role) ||
    email.includes('admin') ||
    email.includes('management') ||
    email === 'sudhan@paradigmfms.com';

  const canonicalName = getCanonicalUserName(user);
  const userCleanRoot = getCleanRoot(canonicalName);

  // If Global Admin, has access to all sites and companies
  if (isGlobalAdmin) {
    const allSiteNames = new Set(matrixList.map(m => m.siteName).filter(Boolean));
    return {
      isGlobalAdmin: true,
      canonicalName,
      userEmail: email,
      allowedCompanies: [], // means all
      permittedSiteNames: allSiteNames,
      permittedSiteList: Array.from(allSiteNames).sort(),
      isSitePermitted: () => true
    };
  }

  // Build permitted sites from matrix and user profile
  const permittedSites = new Set<string>();
  const permittedCompanies = new Set<string>();

  // 1. Direct profile allocations (organizationName / organization_name)
  const orgNames = user.organizationName || (user as any).organization_name;
  if (orgNames) {
    orgNames.split(',').forEach((s: string) => {
      const trimmed = s.trim();
      if (trimmed && trimmed.toLowerCase() !== 'head office') {
        permittedSites.add(trimmed);
      }
    });
  }

  // 2. Matrix-based role & employee allocations
  matrixList.forEach(m => {
    if (!m.siteName) return;

    const accountsRoot = getCleanRoot(m.accountsInchargeName || '');
    const hrRoot = getCleanRoot(m.hrInchargeName || '');
    const opsRoot = getCleanRoot(m.opsManagerName || '');
    const siteMgrRoot = getCleanRoot(m.siteManagerName || '');
    const fieldOfficerRoot = getCleanRoot(m.fieldOfficerName || '');

    const isAssigned = (
      (userCleanRoot && (
        accountsRoot === userCleanRoot ||
        hrRoot === userCleanRoot ||
        opsRoot === userCleanRoot ||
        siteMgrRoot === userCleanRoot ||
        fieldOfficerRoot === userCleanRoot
      )) ||
      (m.accountsInchargeId && m.accountsInchargeId === user.id) ||
      (m.hrInchargeId && m.hrInchargeId === user.id) ||
      (m.opsManagerId && m.opsManagerId === user.id) ||
      (m.siteManagerId && m.siteManagerId === user.id) ||
      (m.fieldOfficerId && m.fieldOfficerId === user.id)
    );

    if (isAssigned) {
      permittedSites.add(m.siteName);
      if (m.billingCompany) {
        permittedCompanies.add(normalizeCompanyShortName(m.billingCompany));
      }
    }
  });

  // Extract allowed companies
  let allowedCompanies = Array.from(permittedCompanies).sort();
  if (allowedCompanies.length === 0) {
    if (email.includes('southwall') || canonicalName === 'Arya Thomas') {
      allowedCompanies = ['SWLLP'];
    } else {
      allowedCompanies = ['PIFS', 'PPFMS'];
    }
  }

  const permittedList = Array.from(permittedSites).sort();

  const isSitePermitted = (siteName: string, companyName?: string): boolean => {
    if (!siteName) return false;

    // Check by exact site name match
    if (permittedSites.has(siteName)) return true;

    // Check case-insensitive
    const lower = siteName.toLowerCase().trim();
    const hasMatch = permittedList.some(p => p.toLowerCase().trim() === lower);
    if (hasMatch) return true;

    // Check if site prefix matches
    const hasPrefixMatch = permittedList.some(p => {
      const pLower = p.toLowerCase().trim();
      return lower.startsWith(pLower) || pLower.startsWith(lower);
    });
    if (hasPrefixMatch) return true;

    return false;
  };

  return {
    isGlobalAdmin: false,
    canonicalName,
    userEmail: email,
    allowedCompanies,
    permittedSiteNames: permittedSites,
    permittedSiteList: permittedList,
    isSitePermitted
  };
}

/**
 * Helper to get pre-fill metadata from the matrix for a given site
 */
export function getSiteMetadataFromMatrix(
  siteName: string,
  matrixList: SiteResponsibilityMatrix[]
): Partial<SiteResponsibilityMatrix> | null {
  if (!siteName || !matrixList.length) return null;
  const clean = siteName.toLowerCase().trim();
  const match = matrixList.find(m => (m.siteName || '').toLowerCase().trim() === clean);
  if (!match) return null;
  return {
    ...match,
    billingCompany: normalizeCompanyShortName(match.billingCompany)
  };
}

/**
 * Validates parsed import rows against routing scope
 */
export function validateImportRows<T extends { siteName?: string; companyName?: string }>(
  rows: T[],
  scope: UserRoutingScope,
  matrixList: SiteResponsibilityMatrix[]
): {
  validRows: T[];
  rejectedRows: { row: T; reason: string }[];
  warningMessage?: string;
} {
  if (scope.isGlobalAdmin) {
    return { validRows: rows, rejectedRows: [] };
  }

  const validRows: T[] = [];
  const rejectedRows: { row: T; reason: string }[] = [];

  rows.forEach(r => {
    const sName = r.siteName?.trim() || '';
    if (!sName) return;

    // Find matrix entry for site
    const matrixEntry = getSiteMetadataFromMatrix(sName, matrixList);
    const company = matrixEntry?.billingCompany || r.companyName || '';

    if (scope.isSitePermitted(sName, company)) {
      validRows.push(r);
    } else {
      const companyLabel = company ? ` (${company})` : '';
      rejectedRows.push({
        row: r,
        reason: `Site "${sName}"${companyLabel} is outside your authorized scope.`
      });
    }
  });

  let warningMessage: string | undefined;
  if (rejectedRows.length > 0) {
    const sample = rejectedRows.slice(0, 3).map(rj => rj.row.siteName).join(', ');
    warningMessage = `${rejectedRows.length} site(s) skipped due to permission limits: ${sample}${rejectedRows.length > 3 ? ` and ${rejectedRows.length - 3} more` : ''}. Only your assigned company/sites can be updated.`;
  }

  return { validRows, rejectedRows, warningMessage };
}
