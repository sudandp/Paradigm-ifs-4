const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const m = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
};

const url = getEnv('VITE_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');

if (url && key) {
  const client = createClient(url, key);
  client.from('onboarding_submissions').select('*').then(({ data, error }) => {
    if (error) {
      console.error(error);
      return;
    }
    console.log('Total submissions:', data.length);
    data.forEach((s, idx) => {
      const org = s.organization || {};
      const pers = s.personal || {};
      const fullName = s.full_name || `${pers.firstName || ''} ${pers.lastName || ''}`.trim();
      const site = s.site || org.site || org.organizationName || s.organization_name;
      const des = s.designation || org.designation;
      const dept = s.department || org.department;
      const comp = s.company_name || org.companyName || s.company_id || org.companyId;
      console.log(`[${idx + 1}] ID:${s.employee_id || 'NO-ID'} | Name:${fullName} | Site:${site} | Des:${des} | Dept:${dept} | Comp:${comp}`);
    });
  });
}
