const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const getEnv = (k) => {
  const m = envContent.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
};
const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY'));

supabase.from('onboarding_submissions').select('id, employee_id, organization, personal').then(({ data, error }) => {
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  data.forEach((r, idx) => {
    const org = r.organization || {};
    const pers = r.personal || {};
    const empId = r.employee_id || pers.employeeId || 'NO-ID';
    const site = org.site || org.organizationName || 'NO-SITE';
    const des = org.designation || 'NO-DES';
    const dept = org.department || 'NO-DEPT';
    const compId = org.company_id || org.companyId || 'NO-COMPID';
    const compName = org.company_name || org.companyName || 'NO-COMPNAME';
    console.log(`[${(idx+1).toString().padStart(2)}] ${empId.padEnd(10)} | Site: ${site.padEnd(28)} | Des: ${des.padEnd(22)} | Dept: ${dept.padEnd(20)} | CompId: ${compId}`);
  });
});
