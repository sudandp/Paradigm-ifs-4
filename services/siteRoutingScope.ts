import type { User } from '../types';
import type { SiteResponsibilityMatrix } from '../types/siteRouting';

// Normalization utilities matching SiteResponsibilityMatrix
export const getCleanRoot = (name: string): string => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower.includes('sandeep biswas') || lower === 'sandeep.accounts') return 'sandeepbiswas';
  if (lower.includes('sandeep b') || lower === 'sandeep' || lower.includes('sandeep ops')) return 'sandeepb';
  const words = lower.replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/).filter(w => w.length >= 3);
  let root = words[0] || lower;
  if (root === 'arpitha') root = 'arpita';
  if (root === 'poojashree' || root === 'poojashri') root = 'pooja';
  if (root === 'baskar' || root === 'bhaskar') return 'baskar';
  return root;
};

export const getCanonicalUserName = (user: Partial<User> | null | undefined): string => {
  if (!user) return '';
  const email = (user.email || '').toLowerCase();
  const rawName = (user.name || '').trim();

  // Canonical name mappings
  if (rawName.toLowerCase().includes('baskar') || rawName.toLowerCase().includes('bhaskar') || email.includes('baskar') || email.includes('bhaskar')) return 'Baskar A';
  if (rawName.toLowerCase().includes('chennamma') || email === 'chandana.hr@paradigmfms.com') return 'Chennamma';
  if (email === 'onboarding@paradigmfms.com') return 'Chandana R';
  if (email === 'pooja@paradigmfms.in') return 'Poojashree S';
  if (email === 'hr.kavya@paradigmfms.com') return 'Kavya M';
  if (rawName.toLowerCase() === 'pooja') return 'Poojashree S';
  if (email === 'arpitha@paradigmfms.com' || rawName.toLowerCase().includes('arpitha') || rawName.toLowerCase().includes('arpita')) return 'Arpitha Nair';
  if (email === 'vishwa.finance@paradigmfms.com' || rawName.toLowerCase() === 'vishwa finance' || rawName.toLowerCase() === 'vishwa') return 'Vishwa';
  if (email === 'sinchana@paradigmfms.in' || rawName.toLowerCase() === 'sinchana') return 'Sinchana KM';
  if (email === 'aryasouthwall@paradigmfms.in' || rawName.toLowerCase() === 'arya' || rawName.toLowerCase().includes('arya')) return 'Arya Thomas';
  if (email === 'sandeep.accounts@paradigmfms.com' || rawName.toLowerCase().includes('sandeep biswas')) return 'Sandeep Biswas';
  if (email.includes('sandeep') || rawName.toLowerCase().includes('sandeep b') || rawName.toLowerCase() === 'sandeep') return 'Sandeep B';
  if (email === 'chethan@paradigmfms.com') return 'Chethan V';
  return rawName;
};

export const normalizeHrInchargeName = (rawName: string | null | undefined): string => {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';

  if (trimmed.includes('/') || trimmed.includes('&') || trimmed.includes(',')) {
    const parts = trimmed.split(/[/&,]/).map(p => normalizeHrInchargeName(p)).filter(Boolean);
    return parts.join(' / ');
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'baskar' || lower === 'baskar a' || lower === 'baskara' || lower === 'bhaskar' || lower === 'bhaskar a' || lower === 'bhaskara') return 'Baskar A';
  if (lower === 'kavya' || lower === 'kavya m' || lower === 'kavyam') return 'Kavya M';
  if (lower.startsWith('pooja') || lower.startsWith('poojashree') || lower.startsWith('poojashri') || lower.startsWith('pcoja')) return 'Poojashree S';
  if (lower.includes('chennamma')) return 'Chennamma';
  if (lower === 'chandana' || lower === 'chandana r' || lower === 'chandana.r') return 'Chandana R';
  if (lower.includes('arpitha') || lower.includes('arpita')) return 'Arpitha Nair';
  if (lower.includes('sinchana')) return 'Sinchana KM';

  return trimmed;
};

export const normalizeOpsInchargeName = (rawName: string | null | undefined): string => {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';

  if (trimmed.includes('/') || trimmed.includes('&') || trimmed.includes(',')) {
    const parts = trimmed.split(/[/&,]/).map(p => normalizeOpsInchargeName(p)).filter(Boolean);
    return parts.join(' / ');
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'sandeep biswas') return 'Sandeep Biswas';
  if (lower === 'sandeep' || lower === 'sandeep b') return 'Sandeep B';
  if (lower === 'keshav' || lower === 'keshav murthy' || lower === 'keshav setlur' || lower === 'keshav s') return 'Keshav Setlur';
  if (lower === 'isaac' || lower === 'isaac roy' || lower === 'issac') return 'Isaac Roy';
  if (lower === 'venkat' || lower === 'venkatachalam' || lower === 'venkatesh') return 'Venkatachalam';
  if (lower === 'shilpa' || lower === 'shilpa m') return 'Shilpa M';
  if (lower === 'harish' || lower === 'harish h p') return 'Harish H P';
  if (lower === 'stany' || lower === 'stany d souza') return 'Stany D Souza';
  if (lower === 'nakul' || lower === 'nakul r alvar') return 'Nakul R Alvar';
  if (lower === 'ankur') return 'Ankur';
  if (lower === 'pradeepp' || lower === 'pradeep' || lower === 'pradeepp gangaiah') return 'Pradeepp Gangaiah';
  if (lower === 'nithin' || lower === 'nithin gowda') return 'Nithin Gowda';
  if (lower === 'ravi' || lower === 'ravi deva') return 'Ravi DEVA';
  if (lower === 'tharun' || lower === 'tharun boyapally') return 'Tharun Boyapally';
  if (lower === 'chethan' || lower === 'chethan v') return 'Chethan V';
  if (lower === 'prashanth' || lower === 'prashanth m') return 'Prashanth M';
  if (lower === 'arya' || lower === 'arya thomas') return 'Arya Thomas';

  return trimmed;
};

export const normalizeAccountsInchargeName = (rawName: string | null | undefined): string => {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';

  if (trimmed.includes('/') || trimmed.includes('&') || trimmed.includes(',')) {
    const parts = trimmed.split(/[/&,]/).map(p => normalizeAccountsInchargeName(p)).filter(Boolean);
    return parts.join(' / ');
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes('arpitha') || lower.includes('arpita')) return 'Arpitha Nair';
  if (lower.includes('sinchana')) return 'Sinchana KM';
  if (lower.includes('arya')) return 'Arya Thomas';
  if (lower === 'chethan' || lower === 'chethan v') return 'Chethan V';
  if (lower === 'sandeep' || lower === 'sandeep biswas') return 'Sandeep Biswas';
  if (lower === 'sandeep b') return 'Sandeep B';
  if (lower.includes('vishwa')) return 'Vishwa';

  return trimmed;
};

/**
 * Official Company Short Names & Exact Legal Entity Names from Client Structure:
 * - PIFS: PARADIGM INTEGRATED FACILITY SERVICES PVT LTD
 * - SWLLP: SOUTHWALL SECURITY LLP
 * - PPFMS: PARADIGM PROPERTY & FACILITY MANAGEMENT SERVICES
 * - PIFS & SWLLP: Split (PARADIGM INTEGRATED & SOUTHWALL SECURITY LLP)
 * - PIFS & PPFMS: Joint (PARADIGM INTEGRATED & PPFMS)
 * - PPFMS & SWLLP: Split (PPFMS & SOUTHWALL SECURITY LLP)
 */
export const COMPANY_FULL_NAMES: Record<string, string> = {
  'PIFS': 'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD',
  'SWLLP': 'SOUTHWALL SECURITY LLP',
  'PPFMS': 'PARADIGM PROPERTY & FACILITY MANAGEMENT SERVICES',
  'PIFS & SWLLP': 'Split: PARADIGM INTEGRATED & SOUTHWALL SECURITY LLP',
  'PIFS & PPFMS': 'Joint: PARADIGM INTEGRATED & PPFMS',
  'PPFMS & SWLLP': 'Split: PPFMS & SOUTHWALL SECURITY LLP'
};

export const getCompanyFullName = (shortName: string | null | undefined): string => {
  if (!shortName) return 'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD';
  const norm = normalizeCompanyShortName(shortName);
  return COMPANY_FULL_NAMES[norm] || shortName;
};

export const getCompanyShortName = (fullNameOrAny: string | null | undefined): string => {
  if (!fullNameOrAny) return 'PIFS';
  return normalizeCompanyShortName(fullNameOrAny);
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
    if (cUpper.includes('PIFS') || cUpper.includes('PARADIGM INTEGRATED') || cUpper.includes('PARADIGM')) return 'PIFS & SWLLP';
    if (cUpper.includes('PPFMS') || cUpper.includes('PARADIGM PROPERTY')) return 'PPFMS & SWLLP';
    return 'SWLLP';
  }
  if ((cUpper.includes('PARADIGM INTEGRATED') || cUpper.includes('PIFS')) && (cUpper.includes('PPFMS') || cUpper.includes('PARADIGM PROPERTY'))) {
    return 'PIFS & PPFMS';
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

export interface SiteTeamMember {
  role: 'ops_manager' | 'site_manager' | 'field_officer' | 'hr_lead' | 'accounts_lead';
  name: string;
  id?: string;
  siteName: string;
}

export interface SiteTeamInfo {
  siteName: string;
  societyName?: string;
  billingCompany: string;
  billingCompanyFullName: string;
  billingCycle: string;
  opsManagerName: string;
  opsManagerId?: string;
  siteManagerName: string;
  siteManagerId?: string;
  fieldOfficerName: string;
  fieldOfficerId?: string;
  hrInchargeName: string;
  hrInchargeId?: string;
  accountsInchargeName: string;
  accountsInchargeId?: string;
  teamMembers: { name: string; role: string; id?: string }[];
}

export interface UserRoutingScope {
  isGlobalAdmin: boolean;
  canonicalName: string;
  userEmail: string;
  allowedCompanies: string[]; // empty if global admin (meaning all)
  permittedSiteNames: Set<string>;
  permittedSiteList: string[];
  isSitePermitted: (siteName: string, companyName?: string) => boolean;
  // Cross-functional team mappings
  siteTeams: Record<string, SiteTeamInfo>;
  siteTeamMemberNames: Set<string>;
  siteTeamMemberIds: Set<string>;
  isTeamMemberPermitted: (memberNameOrId: string) => boolean;
  isTaskPermitted: (task: { siteId?: string; siteName?: string; assignedTo?: string; assignedToName?: string; createdBy?: string }) => boolean;
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
      isSitePermitted: () => false,
      siteTeams: {},
      siteTeamMemberNames: new Set<string>(),
      siteTeamMemberIds: new Set<string>(),
      isTeamMemberPermitted: () => false,
      isTaskPermitted: () => false
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
    const siteTeams: Record<string, SiteTeamInfo> = {};
    const siteTeamMemberNames = new Set<string>();
    const siteTeamMemberIds = new Set<string>();

    matrixList.forEach(m => {
      if (!m.siteName) return;
      const bComp = normalizeCompanyShortName(m.billingCompany);
      const bCompFull = getCompanyFullName(bComp);
      const teamList: { name: string; role: string; id?: string }[] = [];

      const addMember = (rawName: string | null | undefined, mRole: string, id?: string | null) => {
        if (!rawName || rawName.trim().toLowerCase() === 'unassigned') return;
        const normName = mRole === 'ops_manager' ? normalizeOpsInchargeName(rawName) :
                         mRole === 'hr_lead' ? normalizeHrInchargeName(rawName) :
                         mRole === 'accounts_lead' ? normalizeAccountsInchargeName(rawName) : rawName.trim();
        teamList.push({ name: normName, role: mRole, id: id || undefined });
        siteTeamMemberNames.add(normName);
        siteTeamMemberNames.add(rawName.trim());
        const root = getCleanRoot(normName);
        if (root) siteTeamMemberNames.add(root);
        if (id) siteTeamMemberIds.add(id);
      };

      addMember(m.opsManagerName, 'ops_manager', m.opsManagerId);
      addMember(m.siteManagerName || m.siteSupervisorName, 'site_manager', m.siteManagerId || m.siteSupervisorId);
      addMember(m.fieldOfficerName, 'field_officer', m.fieldOfficerId);
      addMember(m.hrInchargeName, 'hr_lead', m.hrInchargeId);
      addMember(m.accountsInchargeName, 'accounts_lead', m.accountsInchargeId);

      siteTeams[m.siteName] = {
        siteName: m.siteName,
        billingCompany: bComp,
        billingCompanyFullName: bCompFull,
        billingCycle: m.billingCycle || '',
        opsManagerName: normalizeOpsInchargeName(m.opsManagerName),
        opsManagerId: m.opsManagerId || undefined,
        siteManagerName: m.siteManagerName || m.siteSupervisorName || '',
        siteManagerId: m.siteManagerId || m.siteSupervisorId || undefined,
        fieldOfficerName: m.fieldOfficerName || '',
        fieldOfficerId: m.fieldOfficerId || undefined,
        hrInchargeName: normalizeHrInchargeName(m.hrInchargeName),
        hrInchargeId: m.hrInchargeId || undefined,
        accountsInchargeName: normalizeAccountsInchargeName(m.accountsInchargeName),
        accountsInchargeId: m.accountsInchargeId || undefined,
        teamMembers: teamList
      };
    });

    return {
      isGlobalAdmin: true,
      canonicalName,
      userEmail: email,
      allowedCompanies: [], // means all
      permittedSiteNames: allSiteNames,
      permittedSiteList: Array.from(allSiteNames).sort(),
      isSitePermitted: () => true,
      siteTeams,
      siteTeamMemberNames,
      siteTeamMemberIds,
      isTeamMemberPermitted: () => true,
      isTaskPermitted: () => true
    };
  }

  // 1. Identify User's Assigned Companies from profile / role / email / canonical name
  const userRoleStr = (user.role || '').toLowerCase();
  const userOrgStr = (user.organizationName || (user as any).organization_name || (user as any).company || (user as any).companyName || '').toLowerCase();
  
  const isSouthwall = userOrgStr.includes('southwall') || userRoleStr.includes('southwall') || email.includes('southwall') || canonicalName === 'Arya Thomas' || userRoleStr.includes('swllp') || userOrgStr.includes('swllp');
  const isPPFMS = !isSouthwall && (userOrgStr.includes('ppfms') || userRoleStr.includes('ppfms') || email.includes('ppfms'));
  const isPIFS = !isSouthwall && !isPPFMS && (userOrgStr.includes('pifs') || userRoleStr.includes('pifs') || email.includes('pifs') || email.includes('paradigm'));

  const permittedSites = new Set<string>();
  const permittedCompanies = new Set<string>();

  if (isSouthwall) {
    permittedCompanies.add('SWLLP');
  } else if (isPPFMS) {
    permittedCompanies.add('PPFMS');
  } else if (isPIFS) {
    permittedCompanies.add('PIFS');
  }

  // 2. Direct profile allocations (Assigned Site(s) from User Profile / organizationName / organizationId / assignedSites)
  const orgNames = user.organizationName || (user as any).organization_name;
  if (orgNames) {
    orgNames.split(',').forEach((s: string) => {
      const trimmed = s.trim();
      if (trimmed && trimmed.toLowerCase() !== 'head office' && trimmed.toLowerCase() !== 'all') {
        permittedSites.add(trimmed);
      }
    });
  }

  const rawAssigned = (user as any).assignedSites || (user as any).assigned_sites || user.organizationId || (user as any).organization_id;
  if (rawAssigned) {
    const rawList = Array.isArray(rawAssigned) ? rawAssigned : String(rawAssigned).split(',');
    rawList.forEach((item: any) => {
      if (!item) return;
      const str = String(item).trim();
      if (!str || str.toLowerCase() === 'head office' || str.toLowerCase() === 'all') return;
      
      const mMatch = matrixList.find(m => m.id === str || m.siteId === str || (m.siteName && m.siteName.toLowerCase() === str.toLowerCase()));
      if (mMatch && mMatch.siteName) {
        permittedSites.add(mMatch.siteName);
        const mCompany = normalizeCompanyShortName(mMatch.billingCompany);
        if (mCompany) permittedCompanies.add(mCompany);
      } else if (str.startsWith('ent_')) {
        const formatted = str.replace(/^ent_/, '').replace(/_/g, ' ').trim();
        const looseMatch = matrixList.find(m => m.siteName && m.siteName.toLowerCase().replace(/[^a-z0-9]/g, '') === formatted.replace(/[^a-z0-9]/g, ''));
        if (looseMatch && looseMatch.siteName) {
          permittedSites.add(looseMatch.siteName);
          const mCompany = normalizeCompanyShortName(looseMatch.billingCompany);
          if (mCompany) permittedCompanies.add(mCompany);
        }
      } else {
        permittedSites.add(str);
      }
    });
  }

  // 3. Matrix-based role & employee allocations (Direct Incharge assignments)
  matrixList.forEach(m => {
    if (!m.siteName) return;

    const mCompany = normalizeCompanyShortName(m.billingCompany);

    const accountsRoot = getCleanRoot(m.accountsInchargeName || '');
    const hrRoot = getCleanRoot(m.hrInchargeName || '');
    const opsRoot = getCleanRoot(m.opsManagerName || '');
    const siteMgrRoot = getCleanRoot(m.siteManagerName || '');
    const fieldOfficerRoot = getCleanRoot(m.fieldOfficerName || '');

    const isDirectlyAssigned = (
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

    // If user is directly assigned to this site in the matrix:
    if (isDirectlyAssigned) {
      permittedSites.add(m.siteName);
      if (mCompany) {
        permittedCompanies.add(mCompany);
      }
    }
  });

  // Extract allowed companies list
  const allowedCompanies = Array.from(permittedCompanies).sort();

  // Fallback: ONLY if the user has NO specific allocated sites anywhere, populate company sites
  if (permittedSites.size === 0 && allowedCompanies.length > 0) {
    matrixList.forEach(m => {
      if (!m.siteName) return;
      const mCompany = normalizeCompanyShortName(m.billingCompany);
      if (allowedCompanies.some(c => c === mCompany || mCompany.includes(c) || c.includes(mCompany))) {
        permittedSites.add(m.siteName);
      }
    });
  }

  // Canonical display list for badges, headers, and UI filters (14 sites)
  const canonicalSiteList = Array.from(permittedSites).sort();

  // Expanded lookup set including billing legal names and legacy aliases for matching
  const expandedLookupSet = new Set<string>();
  permittedSites.forEach(s => expandedLookupSet.add(s.toLowerCase().trim()));

  const normalizeSiteKey = (str: string): string => {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const historicalAliases: Record<string, string[]> = {
    'artisane projects': ['realserve', 'artisane', 'artisane forest breeze'],
    'gk ispat pvt ltd': ['g k ispat pvt ltd', 'g.k.ispat pvt.ltd.', 'gk ispat'],
    'habitat aura': ['h v ventures projects pvt ltd', 'hv ventures projects private limited', 'habitat aura'],
    'iskcon - ttd': ['sri venkateshwara seva trust', 'iskcon ttd', 'ttd kalyan mantapa'],
    'iskcon vaikunta hill': ['sankirtan seva trust  v k hill', 'sankirtan seva trust v k hill', 'vaikunta hill'],
    'keshav setlur': ['keshava setlur'],
    'sv grandur': ['sv garndur', 'sv garndur apartment co operative society ltd', 'sv grandur apartment co- operative society ltd'],
    'trans indus': ['trands indus', 'trands indus residents association', 'trans indus residents association'],
    'vrindhavan pg': ['hare krishna movement bangalore', 'vrindavan pg'],
    'akshaya patra': ['the akshaya patra foundation', 'akshaya patra foundation'],
    'prestige falcon city': ['prestige falcon city apartment owners association'],
    'prestige park square': ['prestige park square owners association'],
    'purva atmosphere': ['purva atmosphere apartment owners association'],
    'iskcon': ['iskcon bangalore', 'hare krishna hill']
  };

  // Cross-reference matrixList to register billingLegalName and aliases
  matrixList.forEach(m => {
    const sName = m.siteName || '';
    const lName = m.billingLegalName || (m as any).billing_legal_name || '';
    const sKey = normalizeSiteKey(sName);

    const matchesPermitted = Array.from(permittedSites).some(p => {
      const pKey = normalizeSiteKey(p);
      return pKey === sKey || p.toLowerCase().trim() === sName.toLowerCase().trim();
    });

    if (matchesPermitted) {
      if (sName) expandedLookupSet.add(sName.toLowerCase().trim());
      if (lName) expandedLookupSet.add(lName.toLowerCase().trim());

      Object.entries(historicalAliases).forEach(([aliasKey, aliases]) => {
        if (normalizeSiteKey(aliasKey) === sKey) {
          aliases.forEach(a => expandedLookupSet.add(a.toLowerCase().trim()));
        }
      });
    }
  });

  const isSitePermitted = (siteName: string, companyName?: string): boolean => {
    if (!siteName) return false;

    // 1. Direct site match in permitted set or canonical list
    if (permittedSites.has(siteName)) return true;

    const lower = siteName.toLowerCase().trim();
    if (expandedLookupSet.has(lower)) return true;

    const norm = normalizeSiteKey(siteName);
    if (!norm) return false;

    // 2. Normalized alphanumeric match
    for (const item of expandedLookupSet) {
      const itemNorm = normalizeSiteKey(item);
      if (itemNorm === norm) return true;
      if (itemNorm && (norm.startsWith(itemNorm) || itemNorm.startsWith(norm))) return true;
      if (itemNorm.length >= 6 && (norm.includes(itemNorm) || itemNorm.includes(norm))) return true;
    }

    // 3. Matrix lookup: if siteName matches any matrix entry whose siteName is permitted
    const matrixMatch = matrixList.find(m => {
      const mSiteNorm = normalizeSiteKey(m.siteName);
      const mLegalNorm = normalizeSiteKey(m.billingLegalName || (m as any).billing_legal_name || '');
      return (mSiteNorm && mSiteNorm === norm) || (mLegalNorm && mLegalNorm === norm);
    });

    if (matrixMatch) {
      const mSiteNorm = normalizeSiteKey(matrixMatch.siteName);
      for (const p of permittedSites) {
        if (normalizeSiteKey(p) === mSiteNorm) return true;
      }
    }

    // 4. If user has NO specific site allocations, allow by company
    if (permittedSites.size === 0 && allowedCompanies.length > 0) {
      let normComp = companyName ? normalizeCompanyShortName(companyName) : '';
      if (!normComp && matrixMatch) {
        normComp = normalizeCompanyShortName(matrixMatch.billingCompany);
      }
      if (normComp) {
        return allowedCompanies.some(ac => normComp === ac || normComp.includes(ac) || ac.includes(normComp));
      }
    }

    return false;
  };

  // Build cross-functional site team map for permitted sites
  const siteTeams: Record<string, SiteTeamInfo> = {};
  const siteTeamMemberNames = new Set<string>();
  const siteTeamMemberIds = new Set<string>();

  // Include user's own identity in team members
  if (canonicalName) siteTeamMemberNames.add(canonicalName);
  if (user.name) siteTeamMemberNames.add(user.name.trim());
  if (userCleanRoot) siteTeamMemberNames.add(userCleanRoot);
  if (user.id) siteTeamMemberIds.add(user.id);

  matrixList.forEach(m => {
    if (!m.siteName) return;
    if (!isSitePermitted(m.siteName, m.billingCompany)) return;

    const bComp = normalizeCompanyShortName(m.billingCompany);
    const bCompFull = getCompanyFullName(bComp);
    const teamList: { name: string; role: string; id?: string }[] = [];

    const addMember = (rawName: string | null | undefined, mRole: string, id?: string | null) => {
      if (!rawName || rawName.trim().toLowerCase() === 'unassigned') return;
      const normName = mRole === 'ops_manager' ? normalizeOpsInchargeName(rawName) :
                       mRole === 'hr_lead' ? normalizeHrInchargeName(rawName) :
                       mRole === 'accounts_lead' ? normalizeAccountsInchargeName(rawName) : rawName.trim();
      teamList.push({ name: normName, role: mRole, id: id || undefined });
      siteTeamMemberNames.add(normName);
      siteTeamMemberNames.add(rawName.trim());
      const root = getCleanRoot(normName);
      if (root) siteTeamMemberNames.add(root);
      if (id) siteTeamMemberIds.add(id);
    };

    addMember(m.opsManagerName, 'ops_manager', m.opsManagerId);
    addMember(m.siteManagerName || m.siteSupervisorName, 'site_manager', m.siteManagerId || m.siteSupervisorId);
    addMember(m.fieldOfficerName, 'field_officer', m.fieldOfficerId);
    addMember(m.hrInchargeName, 'hr_lead', m.hrInchargeId);
    addMember(m.accountsInchargeName, 'accounts_lead', m.accountsInchargeId);

    siteTeams[m.siteName] = {
      siteName: m.siteName,
      billingCompany: bComp,
      billingCompanyFullName: bCompFull,
      billingCycle: m.billingCycle || '',
      opsManagerName: normalizeOpsInchargeName(m.opsManagerName),
      opsManagerId: m.opsManagerId || undefined,
      siteManagerName: m.siteManagerName || m.siteSupervisorName || '',
      siteManagerId: m.siteManagerId || m.siteSupervisorId || undefined,
      fieldOfficerName: m.fieldOfficerName || '',
      fieldOfficerId: m.fieldOfficerId || undefined,
      hrInchargeName: normalizeHrInchargeName(m.hrInchargeName),
      hrInchargeId: m.hrInchargeId || undefined,
      accountsInchargeName: normalizeAccountsInchargeName(m.accountsInchargeName),
      accountsInchargeId: m.accountsInchargeId || undefined,
      teamMembers: teamList
    };
  });

  const isTeamMemberPermitted = (memberNameOrId: string): boolean => {
    if (!memberNameOrId) return false;
    const cleanStr = memberNameOrId.trim();
    if (siteTeamMemberIds.has(cleanStr)) return true;
    if (siteTeamMemberNames.has(cleanStr)) return true;
    const root = getCleanRoot(cleanStr);
    if (root && siteTeamMemberNames.has(root)) return true;
    for (const name of siteTeamMemberNames) {
      if (name.toLowerCase() === cleanStr.toLowerCase()) return true;
      if (cleanStr.length >= 4 && (name.toLowerCase().includes(cleanStr.toLowerCase()) || cleanStr.toLowerCase().includes(name.toLowerCase()))) return true;
    }
    return false;
  };

  const isTaskPermitted = (task: { siteId?: string; siteName?: string; assignedTo?: string; assignedToName?: string; createdBy?: string }): boolean => {
    if (task.siteName && isSitePermitted(task.siteName)) return true;
    if (task.siteId && isSitePermitted(task.siteId)) return true;
    if (task.assignedTo && (task.assignedTo === user.id || siteTeamMemberIds.has(task.assignedTo))) return true;
    if (task.assignedToName && isTeamMemberPermitted(task.assignedToName)) return true;
    if (task.createdBy && (task.createdBy === user.id || siteTeamMemberIds.has(task.createdBy))) return true;
    return false;
  };

  return {
    isGlobalAdmin: false,
    canonicalName,
    userEmail: email,
    allowedCompanies,
    permittedSiteNames: permittedSites,
    permittedSiteList: canonicalSiteList,
    isSitePermitted,
    siteTeams,
    siteTeamMemberNames,
    siteTeamMemberIds,
    isTeamMemberPermitted,
    isTaskPermitted
  };
}

/**
 * Extracts all unique cross-functional team members (Ops, HR, Finance, Site Mgr, Field Officer)
 * who share allocated sites with the given user.
 */
export function getSiteTeamMembers(
  user: Partial<User> | null | undefined,
  matrixList: SiteResponsibilityMatrix[]
): { id?: string; name: string; role: string; siteName: string }[] {
  const scope = getUserRoutingScope(user, matrixList);
  const result: { id?: string; name: string; role: string; siteName: string }[] = [];
  const seen = new Set<string>();

  Object.values(scope.siteTeams).forEach(st => {
    st.teamMembers.forEach(tm => {
      const key = `${tm.name}_${tm.role}_${st.siteName}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          id: tm.id,
          name: tm.name,
          role: tm.role,
          siteName: st.siteName
        });
      }
    });
  });

  return result;
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
  const cleanAlpha = clean.replace(/[^a-z0-9]/g, '');

  // 1. Exact case-insensitive match or ID match
  let match = matrixList.find(m => (m.siteName || '').toLowerCase().trim() === clean || (m.id || '').toLowerCase() === clean);

  // 2. Alphanumeric stripped match
  if (!match && cleanAlpha) {
    match = matrixList.find(m => (m.siteName || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlpha);
  }

  // 3. Substring / Includes match
  if (!match && clean.length >= 3) {
    match = matrixList.find(m => {
      const mClean = (m.siteName || '').toLowerCase().trim();
      return mClean && (mClean.includes(clean) || clean.includes(mClean));
    });
  }

  if (!match) return null;
  const billingCompany = normalizeCompanyShortName(match.billingCompany);
  let hrInchargeName = normalizeHrInchargeName(match.hrInchargeName);
  if (billingCompany.toUpperCase().includes('SWLLP') && hrInchargeName === 'Chennamma') {
    hrInchargeName = 'Baskar A';
  }

  return {
    ...match,
    billingCompany,
    opsManagerName: normalizeOpsInchargeName(match.opsManagerName),
    hrInchargeName,
    accountsInchargeName: normalizeAccountsInchargeName(match.accountsInchargeName)
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

/**
 * Determines whether a given billing period (year, month) is locked for direct modification.
 * - Global admins / super_admins are never locked.
 * - Active working period = current month and previous month (the active billing cycle).
 * - Earlier periods (e.g. 2+ months past) are considered locked historical records.
 */
export function isHistoricalLockedPeriod(
  year: string | number | undefined,
  month: string | number | undefined,
  userRole?: string
): boolean {
  const role = (userRole || '').toLowerCase();
  if (['admin', 'super_admin', 'management', 'developer'].includes(role)) {
    return false; // Admins can directly modify without blocking
  }

  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Active working period starts from 1st of previous month
  const activeStartDate = new Date(currentYear, currentMonth - 2, 1);
  const targetDate = new Date(y, m - 1, 1);

  return targetDate < activeStartDate;
}

export interface RoleFormPermissions {
  isAdmin: boolean;
  isHR: boolean;
  isFinance: boolean;
  canEditAttendance: boolean;
  canEditInvoice: boolean;
  canEditMetadata: boolean;
  canEditOpsRemarks: boolean;
  canEditHrRemarks: boolean;
  canEditFinanceRemarks: boolean;
}

/**
 * Evaluates role-based permissions for attendance and invoicing form interactions
 */
export function getUserFormPermissions(user: Partial<User> | null | undefined): RoleFormPermissions {
  if (!user) {
    return {
      isAdmin: false,
      isHR: false,
      isFinance: false,
      canEditAttendance: false,
      canEditInvoice: false,
      canEditMetadata: false,
      canEditOpsRemarks: false,
      canEditHrRemarks: false,
      canEditFinanceRemarks: false,
    };
  }

  const role = (user.role || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  const canonicalName = getCanonicalUserName(user);
  const cleanName = canonicalName.toLowerCase();

  const isAdmin = ['admin', 'super_admin', 'management', 'developer'].includes(role) ||
    email.includes('admin') ||
    email.includes('management') ||
    email === 'sudhan@paradigmfms.com';

  const isFinance = ['finance', 'finance_manager', 'accounts', 'billing'].includes(role) ||
    email.includes('finance') ||
    email.includes('accounts') ||
    email === 'arpitha@paradigmfms.com' ||
    email === 'sandeep.accounts@paradigmfms.com' ||
    email === 'vishwa.finance@paradigmfms.com' ||
    cleanName.includes('arpitha') ||
    cleanName.includes('vishwa');

  const isHR = ['hr', 'hr_ops', 'operations', 'site_manager', 'field_officer'].includes(role) ||
    email.includes('hr') ||
    email === 'onboarding@paradigmfms.com' ||
    email === 'pooja@paradigmfms.in' ||
    email === 'hr.kavya@paradigmfms.com' ||
    email === 'sinchana@paradigmfms.in' ||
    email === 'aryasouthwall@paradigmfms.in' ||
    cleanName.includes('chandana') ||
    cleanName.includes('chennamma') ||
    cleanName.includes('poojashree') ||
    cleanName.includes('kavya') ||
    cleanName.includes('sinchana') ||
    cleanName.includes('arya');

  // If a user has an ambiguous or standard role (e.g. employee without specific prefix), default canEditAttendance if not finance
  const canEditAttendance = isAdmin || isHR || (!isFinance && !isAdmin);
  const canEditInvoice = isAdmin || isFinance;

  return {
    isAdmin,
    isHR: isHR && !isAdmin,
    isFinance: isFinance && !isAdmin,
    canEditAttendance,
    canEditInvoice,
    canEditMetadata: isAdmin, // Only Admins can manually override Matrix metadata
    canEditOpsRemarks: isAdmin || isHR || role.includes('ops') || role.includes('operations'),
    canEditHrRemarks: isAdmin || isHR || (!isFinance && !isAdmin),
    canEditFinanceRemarks: isAdmin || isFinance,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Effective Date Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a YYYY-MM-DD string to a Date at 00:00:00 IST (UTC+5:30).
 * Access transitions happen at IST midnight.
 */
export const toISTMidnight = (dateStr: string): Date => {
  // YYYY-MM-DD parsed as IST midnight = UTC offset -05:30 = subtract 19800 seconds
  const [y, m, d] = dateStr.split('-').map(Number);
  // Create the date at UTC 00:00 then subtract 5h30m to get IST midnight in UTC terms
  const utc = Date.UTC(y, m - 1, d, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
  return new Date(utc);
};

/**
 * Returns today's date string in YYYY-MM-DD IST format.
 */
export const todayIST = (): string => {
  const now = new Date();
  // Shift to IST (+5:30)
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
};

/**
 * Determines whether a SiteResponsibilityMatrix record grants site access
 * to a specific user (by ID or canonical name) at a given moment.
 *
 * Rules:
 * - If `effectiveFrom` is not set → the site is always active (legacy data).
 * - If `effectiveFrom` is today or in the past → new incharge assignments are live.
 * - If `effectiveFrom` is in the future → old incharges still have access;
 *   newly assigned incharges do NOT yet have access for this site.
 *
 * @param m             The matrix row to check
 * @param userId        The user's ID to check access for
 * @param userNameRoot  The user's clean root name (from getCleanRoot)
 * @param asOf          The moment to evaluate against (defaults to now in IST)
 * @returns             `true` if the user currently has access to this site
 */
export const isSiteActiveForUser = (
  m: SiteResponsibilityMatrix,
  userId: string,
  userNameRoot: string,
  asOf?: Date
): boolean => {
  const now = asOf ?? new Date();

  // Resolve whether the user appears in ANY incharge field (by ID or name root)
  const matchesById = (
    m.opsManagerId === userId ||
    m.hrInchargeId === userId ||
    m.accountsInchargeId === userId ||
    m.siteManagerId === userId ||
    m.fieldOfficerId === userId
  );
  const matchesByName = userNameRoot && (
    getCleanRoot(m.opsManagerName || '') === userNameRoot ||
    getCleanRoot(m.hrInchargeName || '') === userNameRoot ||
    getCleanRoot(m.accountsInchargeName || '') === userNameRoot ||
    getCleanRoot(m.siteManagerName || m.siteSupervisorName || '') === userNameRoot ||
    getCleanRoot(m.fieldOfficerName || '') === userNameRoot
  );

  const isCurrentlyAssigned = matchesById || matchesByName;

  // No effectiveFrom set → honour assignment as-is
  if (!m.effectiveFrom) return isCurrentlyAssigned;

  const effectiveDate = toISTMidnight(m.effectiveFrom);
  const effectiveAlreadyPassed = now >= effectiveDate;

  if (effectiveAlreadyPassed) {
    // The change has taken effect — use current assignments
    return isCurrentlyAssigned;
  }

  // The change is PENDING (effectiveFrom is in the future).
  // For this site we need to check the PREVIOUS assignment from the change log.
  const log = m.changeLog;
  if (!log || log.length === 0) {
    // No history — treat current assignment as active
    return isCurrentlyAssigned;
  }

  // Most recent log entry represents the snapshot taken just before the pending change
  const latestEntry = log[log.length - 1];
  const wasOpsManager   = getCleanRoot(latestEntry.previousOpsManager || '') === userNameRoot;
  const wasHrIncharge   = getCleanRoot(latestEntry.previousHrIncharge || '') === userNameRoot;
  const wasAccounts     = getCleanRoot(latestEntry.previousAccountsIncharge || '') === userNameRoot;
  const wasSiteManager  = getCleanRoot(latestEntry.previousSiteManager || '') === userNameRoot;
  const wasFieldOfficer = getCleanRoot(latestEntry.previousFieldOfficer || '') === userNameRoot;

  return wasOpsManager || wasHrIncharge || wasAccounts || wasSiteManager || wasFieldOfficer;
};
