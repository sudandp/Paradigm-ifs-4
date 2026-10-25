import type { OnboardingData } from '../types';

/**
 * Robust detection of SouthWall Security LLP vs Paradigm Integrated Facility Services
 * Independent of bundler-specific imports so it can be used safely in both
 * browser code (Vite) and Node CLI / test runners.
 */
export function isSouthWallEmployee(d?: OnboardingData | null | any): boolean {
  if (!d) return false;
  const org = (d.organization as any) || {};
  const p = (d.personal as any) || {};

  const compName = String(
    org.companyName || org.company_name || (d as any).companyName || (d as any).company_name ||
    org.companyId || org.company_id || (d as any).companyId || (d as any).company_id || ''
  ).toLowerCase();

  const orgName = String(org.organizationName || org.organization_name || (d as any).organization_name || (d as any).organizationName || '').toLowerCase();
  const site = String(org.site || org.location || (d as any).site || (d as any).location || '').toLowerCase();
  const dept = String(org.department || (d as any).department || '').toLowerCase();
  const des = String(org.designation || (d as any).designation || '').toLowerCase();
  const empId = String(p.employeeId || p.employee_id || (d as any).employee_id || (d as any).employeeId || d.id || '').toUpperCase();

  // Explicit SouthWall tokens
  const southWallKeywords = ['south wall', 'southwall', 'south-wall', 'swllp', 'comp_1774527590821'];
  if (southWallKeywords.some(kw => compName.includes(kw) || orgName.includes(kw) || site.includes(kw) || dept.includes(kw) || des.includes(kw))) {
    return true;
  }

  // Explicit facility/MEP/technical staff belong to Paradigm Services unless explicitly under SouthWall company
  const isFacilityOrTechnical = 
    des.includes('plumber') || des.includes('electrician') || des.includes('technician') ||
    des.includes('carpenter') || des.includes('painter') || des.includes('stp') || des.includes('wtp') ||
    des.includes('facility') || dept.includes('plumb') || dept.includes('elect') || dept.includes('stp_wtp') ||
    dept.includes('multi_technician') || dept.includes('hk_services');

  if (isFacilityOrTechnical && !compName.includes('south') && !compName.includes('swllp') && compName !== 'comp_1774527590821') {
    return false;
  }

  // Employee ID starting with SW- or SW
  if (empId.startsWith('SW-') || empId.startsWith('SW_') || empId.startsWith('SW')) {
    return true;
  }

  // Check known SouthWall security sites
  const southWallSites = [
    'akshaya patra', 'akshaya_patra', 'uber verdant', 'uber_verdant',
    'gk_ispat', 'gk ispat', 'iskcon', 'habitat_aura', 'habitat aura', 'keshav_setlur', 'keshav setlur',
    'nikoo_homes', 'nikoo homes', 'brigade_jacaranda', 'brigade jacaranda', 'brigade_laburnum', 'brigade laburnum',
    'dsr_eden_greens', 'dsr eden greens', 'global_edifice_infra', 'global edifice', 'habitat_eden_heights', 'eden heights',
    'icon_sanctury', 'icon sanctuary', 'nadathur_fame_india', 'nadathur', 'paliwal_ttn', 'paliwal', 'purva_sunshine',
    'purva sunshine', 'raja_ritz_avenue', 'raja ritz', 'serene_brigade', 'shriram_smrithi', 'shriram smrithi',
    'shriram_spurthi', 'shriram spurthi', 'sjr_spencer', 'sjr spencer', 'snn_spiritua', 'snn spiritua',
    'birla alokya', 'birla_alokya', 'birla', 'brigade cornerstone utopia', 'brigade_cornerstone_utopia', 'cornerstone utopia', 'utopia', 'bcu serene', 'bcu'
  ];
  if (southWallSites.some(st => orgName.includes(st) || site.includes(st))) {
    return true;
  }

  // Security roles / guard designation when under SouthWall or security operations
  if (dept.includes('security') || des.includes('security') || des.includes('guard')) {
    if (compName.includes('south') || compName.includes('sw') || compName === 'comp_1774527590821' || !compName.includes('paradigm')) {
      return true;
    }
  }

  return false;
}

export function getCompanyScope(d?: OnboardingData | null | any): 'southwall' | 'paradigm' {
  return isSouthWallEmployee(d) ? 'southwall' : 'paradigm';
}
