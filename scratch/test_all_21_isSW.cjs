const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const getEnv = (k) => {
  const m = envContent.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
};
const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY'));

// Paste current isSouthWallEmployee implementation
function isSouthWallEmployee(d) {
  if (!d) return false;
  const org = d.organization || {};
  const p = d.personal || {};

  const compName = String(
    org.companyName || d.companyName || d.company_name ||
    org.companyId || d.companyId || d.company_id || ''
  ).toLowerCase();

  const orgName = String(org.organizationName || d.organization_name || '').toLowerCase();
  const site = String(org.site || org.location || '').toLowerCase();
  const dept = String(org.department || '').toLowerCase();
  const des = String(org.designation || '').toLowerCase();
  const empId = String(p.employeeId || d.id || '').toUpperCase();

  // Explicit SouthWall tokens
  const southWallKeywords = ['south wall', 'southwall', 'south-wall', 'swllp', 'comp_1774527590821'];
  if (southWallKeywords.some(kw => compName.includes(kw) || orgName.includes(kw) || site.includes(kw) || dept.includes(kw) || des.includes(kw))) {
    return true;
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
    'shriram_spurthi', 'shriram spurthi', 'sjr_spencer', 'sjr spencer', 'snn_spiritua', 'snn spiritua'
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

supabase.from('onboarding_submissions').select('*').then(({ data }) => {
  data.forEach((r, idx) => {
    // Test row as-is
    const isSW_row = isSouthWallEmployee(r);
    // Test with camelCased row (as returned by API getVerificationSubmissions or getOnboardingDataById)
    const camelOrg = {};
    if (r.organization) {
      Object.keys(r.organization).forEach(k => {
        const camelK = k.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
        camelOrg[camelK] = r.organization[k];
      });
    }
    const camelRow = { ...r, organization: camelOrg };
    const isSW_camel = isSouthWallEmployee(camelRow);
    const empId = r.employee_id || r.personal?.employeeId || 'NO-ID';
    console.log(`[${(idx+1).toString().padStart(2)}] ${empId.padEnd(10)} | row: ${isSW_row} | camel: ${isSW_camel}`);
  });
});
