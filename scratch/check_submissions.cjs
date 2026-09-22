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
  client.from('onboarding_submissions').select('*').eq('id', '4d3cf2e3-c5ba-4652-9263-56bf7485888d').single().then(({ data, error }) => {
    if (error) console.error(error);
    else console.log('Row 4d3cf2e3:', {
      id: data.id,
      user_id: data.user_id,
      created_user_id: data.created_user_id,
      employee_id: data.employee_id,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
      personal: data.personal
    });
  });
}
