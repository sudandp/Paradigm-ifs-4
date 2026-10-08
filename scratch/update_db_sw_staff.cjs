const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const getEnv = (k) => {
  const m = envContent.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
};
const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY'));

async function updateSouthWallStaff() {
  const { data, error } = await supabase.from('onboarding_submissions').select('*');
  if (error) {
    console.error('Fetch error:', error);
    return;
  }

  let updatedCount = 0;
  for (const r of data) {
    const org = r.organization || {};
    const compId = org.company_id || org.companyId;
    const dept = String(org.department || '').toLowerCase();
    const des = String(org.designation || '').toLowerCase();
    const isSecurity = dept.includes('security') || des.includes('security') || des.includes('guard');

    // Only update the 21 SouthWall staff with comp_1774527590821 or security role
    if (compId === 'comp_1774527590821' || isSecurity) {
      const newOrg = {
        ...org,
        company_id: 'comp_1774527590821',
        companyId: 'comp_1774527590821',
        company_name: 'SOUTHWALL SECURITY LLP',
        companyName: 'SOUTHWALL SECURITY LLP',
        company_address: '198, 2nd Floor, CMH Road, Indiranagar, Bangalore - 560 038.',
        companyAddress: '198, 2nd Floor, CMH Road, Indiranagar, Bangalore - 560 038.',
      };

      const { error: updateErr } = await supabase
        .from('onboarding_submissions')
        .update({
          organization: newOrg,
        })
        .eq('id', r.id);

      if (updateErr) {
        console.error(`Failed to update ${r.id}:`, updateErr);
      } else {
        updatedCount++;
        console.log(`Updated [${updatedCount}] ID: ${r.employee_id || r.id} (${org.site || 'no-site'} / ${des})`);
      }
    }
  }

  console.log(`Finished updating ${updatedCount} SouthWall staff in database.`);
}

updateSouthWallStaff().catch(console.error);
