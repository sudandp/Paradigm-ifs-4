const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email, role_id')
    .ilike('name', '%Nakul%');
  console.log('Nakul:', users, error);

  if (users && users.length > 0) {
    const { data: role } = await supabase.from('roles').select('*').eq('id', users[0].role_id);
    console.log('Nakul role:', role);
  }

  const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'attendance_settings').single();
  console.log('attendance setting missedCheckoutConfig:', JSON.stringify(settings?.value?.missedCheckoutConfig || settings?.value?.missed_checkout_config, null, 2));
}

main();
