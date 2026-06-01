const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 'singleton').maybeSingle();
  if (error) {
    console.error('Error fetching settings:', error);
  } else {
    console.log('Successfully fetched settings row:');
    console.log('Keys in data:', Object.keys(data));
    if (data && 'voip_settings' in data) {
      console.log('SUCCESS: voip_settings column IS present in public.settings!');
      console.log('voip_settings value:', data.voip_settings);
    } else {
      console.log('FAILURE: voip_settings column IS NOT present in public.settings.');
    }
  }
}

check();
