const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');
const getEnv = (k) => {
  const m = envContent.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
};
const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY'));

supabase.from('onboarding_submissions').select('*').limit(2).then(({ data }) => {
  console.log('Row 0 keys:', Object.keys(data[0]));
  console.log('Row 0 organization:', data[0].organization);
  console.log('Row 0 personal:', data[0].personal ? Object.keys(data[0].personal) : null);
  console.log('Row 0 company fields:', {
    comp_name_col: data[0].company_name,
    org_comp: data[0].organization?.companyName,
    site: data[0].organization?.site || data[0].site,
    des: data[0].organization?.designation || data[0].designation,
    dept: data[0].organization?.department || data[0].department
  });
});
