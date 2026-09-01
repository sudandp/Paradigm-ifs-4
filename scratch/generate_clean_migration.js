const fs = require('fs');

const userMapping = {
  ops: {
    'SANDEEP': { name: 'Sandeep B', id: '04364421-22db-44e2-b1f1-08bcebc3d562' },
    'ISAAC': { name: 'Isaac Roy', id: '2a637f75-8829-4572-bdbb-d60f7bb62bd6' },
    'VENKAT': { name: 'Venkatachalam', id: 'ed8ce87f-1f28-4a3a-a319-4dc502add40d' },
    'SHILPA': { name: 'Shilpa M', id: '94a4f34e-f4d0-42d5-b2c5-7b43419a3325' },
    'KESHAV': { name: 'Keshav Murthy', id: 'ef0e7e26-ce43-46ac-9f20-5c128faeae47' },
    'HARISH': { name: 'Harish H P', id: '10c74709-58d5-43d8-a8aa-9233699fc751' },
    'STANY': { name: 'Stany  D Souza', id: '4f62cbdd-6410-4fa3-9d7e-04b05fc41866' },
    'NAKUL': { name: 'Nakul R Alvar', id: '84d4ee16-b60f-401c-9478-584b7cbea26d' },
    'ANKUR': { name: 'Ankur', id: '944263d8-c7e4-42e1-b112-cdb3b1392b44' },
    'PRADEEP': { name: 'Pradeepp Gangaiah', id: 'f06f05d9-cf5f-4e4d-a0b4-9534fd2d1e7b' },
    'RAVI': { name: 'Ravi DEVA', id: '171fac2f-d595-4720-a193-86431982a01e' },
    'NITHIN': { name: 'Nithin Gowda', id: 'b1788ef5-4df5-44db-8511-f82bb96d408f' },
    'THARUN': { name: 'Tharun Boyapally', id: '2049a7a4-8ac7-4ab4-b004-0e1349351d3a' }
  },
  hr: {
    'CHANDANA': { name: 'Chandana R', id: 'bbcbb70e-9c52-46c3-96e9-8e89155e35bd' },
    'CHENNAMMA': { name: 'Chandana R', id: 'bbcbb70e-9c52-46c3-96e9-8e89155e35bd' },
    'POOJA': { name: 'Poojashree S', id: 'c96bc0e5-4b75-42a2-9f69-139de275ab7e' },
    'POOJASHREE': { name: 'Poojashree S', id: 'c96bc0e5-4b75-42a2-9f69-139de275ab7e' },
    'KAVYA': { name: 'Kavya M', id: '07f61efd-24f2-457e-84b3-d8dafcb556c6' },
    'UDITA': { name: 'Udita Paul', id: '4e1fcd1e-c4c7-4175-be8b-dec31a6b5206' }
  },
  accounts: {
    'ARPITA': { name: 'Arpitha Nairy', id: '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27' },
    'ARPITHA': { name: 'Arpitha Nairy', id: '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27' },
    'SINCHANA': { name: 'Sinchana KM', id: 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f' },
    'ARYA': { name: 'Arya Thomas', id: 'de592a75-44de-441a-80fe-dc4a77e6901c' },
    'CHETHAN': { name: 'Chethan V', id: 'd29b6020-e4ba-436c-adfb-b5fd2cd74990' },
    'SANDEEP': { name: 'Sandeep Biswas', id: 'bfd1ca1f-26b9-4f25-8b0d-467327b774a4' }
  }
};

const content = fs.readFileSync('data/initialSiteResponsibilityData.ts', 'utf8');
const jsonMatch = content.match(/export const INITIAL_SITE_RESPONSIBILITY_DATA: SiteResponsibilityMatrix\[\] = (\[[\s\S]*?\]);/);
if (!jsonMatch) {
  console.error('Could not find INITIAL_SITE_RESPONSIBILITY_DATA');
  process.exit(1);
}

const data = eval(jsonMatch[1]);
console.log('Read', data.length, 'sites from fallback data.');

const updated = data.map(item => {
  const opsKey = (item.opsManagerName || '').trim().toUpperCase();
  const hrKey = (item.hrInchargeName || '').trim().toUpperCase();
  const acKey = (item.accountsInchargeName || '').trim().toUpperCase();

  const ops = userMapping.ops[opsKey] || { name: item.opsManagerName, id: item.opsManagerId || null };
  const hr = userMapping.hr[hrKey] || { name: item.hrInchargeName, id: item.hrInchargeId || null };
  const ac = userMapping.accounts[acKey] || { name: item.accountsInchargeName, id: item.accountsInchargeId || null };

  const esc = [
    { level: 1, role: 'Site Supervisor', name: 'Site In-charge', contact: '+91 80 4123 4567' },
    { level: 2, role: 'Operations Manager', name: ops.name, contact: 'Direct Ops Line' },
    { level: 3, role: 'Head of Operations', name: 'Management Desk', contact: 'support@paradigmfms.com' }
  ];

  return {
    ...item,
    opsManagerName: ops.name,
    opsManagerId: ops.id,
    hrInchargeName: hr.name,
    hrInchargeId: hr.id,
    accountsInchargeName: ac.name,
    accountsInchargeId: ac.id,
    escalationMatrix: esc
  };
});

// Update data/initialSiteResponsibilityData.ts
const newTsContent = 'import type { SiteResponsibilityMatrix } from \'../types/siteRouting\';\n\nexport const INITIAL_SITE_RESPONSIBILITY_DATA: SiteResponsibilityMatrix[] = ' + JSON.stringify(updated, null, 2) + ';\n';
fs.writeFileSync('data/initialSiteResponsibilityData.ts', newTsContent, 'utf8');
console.log('Saved updated initialSiteResponsibilityData.ts with clean official names and UUIDs!');

// Build clean SQL Migration
let sql = `-- =========================================================================
-- MIGRATION: Site Responsibility & Routing Matrix Table with Mapped DB Users
-- Description: Direct relational links to public.users (UUIDs) and official names
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.site_responsibility_matrix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_name TEXT NOT NULL UNIQUE,
    site_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    ops_manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ops_manager_name TEXT NOT NULL,
    hr_incharge_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    hr_incharge_name TEXT NOT NULL,
    accounts_incharge_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    accounts_incharge_name TEXT NOT NULL,
    billing_company TEXT NOT NULL DEFAULT 'PIFS',
    billing_cycle TEXT DEFAULT '3rd Billing Cycle',
    units_count INTEGER,
    takeover_date DATE,
    billing_legal_name TEXT,
    billing_address TEXT,
    voucher_type TEXT,
    gstin TEXT,
    pan TEXT,
    escalation_matrix JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_resp_ops ON public.site_responsibility_matrix(ops_manager_id);
CREATE INDEX IF NOT EXISTS idx_site_resp_hr ON public.site_responsibility_matrix(hr_incharge_id);
CREATE INDEX IF NOT EXISTS idx_site_resp_accts ON public.site_responsibility_matrix(accounts_incharge_id);
CREATE INDEX IF NOT EXISTS idx_site_resp_site ON public.site_responsibility_matrix(site_id);
CREATE INDEX IF NOT EXISTS idx_site_resp_active ON public.site_responsibility_matrix(is_active);

ALTER TABLE public.site_responsibility_matrix ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on site_responsibility_matrix" ON public.site_responsibility_matrix;
CREATE POLICY "Allow authenticated read on site_responsibility_matrix"
    ON public.site_responsibility_matrix FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "Allow admin write on site_responsibility_matrix" ON public.site_responsibility_matrix;
CREATE POLICY "Allow admin write on site_responsibility_matrix"
    ON public.site_responsibility_matrix FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Seed / Upsert all active 102 sites with mapped user accounts
INSERT INTO public.site_responsibility_matrix (
    site_name,
    ops_manager_id,
    ops_manager_name,
    hr_incharge_id,
    hr_incharge_name,
    accounts_incharge_id,
    accounts_incharge_name,
    billing_company,
    billing_cycle,
    units_count,
    takeover_date,
    billing_legal_name,
    billing_address,
    voucher_type,
    gstin,
    pan,
    escalation_matrix
) VALUES
`;

const escapeSql = (str) => {
  if (str === null || str === undefined) return 'NULL';
  return `'` + String(str).replace(/'/g, `''`) + `'`;
};

const rowsSql = updated.map(u => {
  const opsIdSql = u.opsManagerId ? `'${u.opsManagerId}'::uuid` : 'NULL';
  const hrIdSql = u.hrInchargeId ? `'${u.hrInchargeId}'::uuid` : 'NULL';
  const acIdSql = u.accountsInchargeId ? `'${u.accountsInchargeId}'::uuid` : 'NULL';
  const dateSql = u.takeoverDate ? `'${u.takeoverDate}'::date` : 'NULL';
  const unitsSql = u.unitsCount !== null && u.unitsCount !== undefined ? u.unitsCount : 'NULL';
  const escSql = `'` + JSON.stringify(u.escalationMatrix).replace(/'/g, `''`) + `'::jsonb`;

  return `    (${escapeSql(u.siteName)}, ${opsIdSql}, ${escapeSql(u.opsManagerName)}, ${hrIdSql}, ${escapeSql(u.hrInchargeName)}, ${acIdSql}, ${escapeSql(u.accountsInchargeName)}, ${escapeSql(u.billingCompany)}, ${escapeSql(u.billingCycle)}, ${unitsSql}, ${dateSql}, ${escapeSql(u.billingLegalName)}, ${escapeSql(u.billingAddress)}, ${escapeSql(u.voucherType)}, ${escapeSql(u.gstin)}, ${escapeSql(u.pan)}, ${escSql})`;
}).join(',\n');

sql += rowsSql + '\n';
sql += `ON CONFLICT (site_name) DO UPDATE SET
    ops_manager_id = EXCLUDED.ops_manager_id,
    ops_manager_name = EXCLUDED.ops_manager_name,
    hr_incharge_id = EXCLUDED.hr_incharge_id,
    hr_incharge_name = EXCLUDED.hr_incharge_name,
    accounts_incharge_id = EXCLUDED.accounts_incharge_id,
    accounts_incharge_name = EXCLUDED.accounts_incharge_name,
    billing_company = EXCLUDED.billing_company,
    billing_cycle = EXCLUDED.billing_cycle,
    units_count = EXCLUDED.units_count,
    takeover_date = EXCLUDED.takeover_date,
    billing_legal_name = EXCLUDED.billing_legal_name,
    billing_address = EXCLUDED.billing_address,
    voucher_type = EXCLUDED.voucher_type,
    gstin = EXCLUDED.gstin,
    pan = EXCLUDED.pan,
    escalation_matrix = EXCLUDED.escalation_matrix,
    updated_at = NOW();
`;

fs.writeFileSync('supabase/migrations/20260901_create_site_responsibility_matrix.sql', sql, 'utf8');
console.log('Successfully wrote clean mapped SQL migration to supabase/migrations/20260901_create_site_responsibility_matrix.sql!');
