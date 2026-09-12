const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: users, error: uErr } = await supabase.from('users').select('id, name').ilike('name', '%Shilpa%');
  console.log('Users found:', users, uErr);
  if (users && users.length > 0) {
    for (const u of users) {
      console.log('\n--- Checking leaves for:', u.name, u.id);
      const { data: leaves, error: lErr } = await supabase.from('leave_requests').select('*').eq('user_id', u.id);
      console.log('Total leaves:', leaves?.length, lErr);
      if (leaves && leaves.length > 0) {
        leaves.forEach(l => {
          console.log(`- ID: ${l.id} | Type: ${l.leave_type} | Status: ${l.status} | Dates: ${l.start_date} to ${l.end_date} | Created: ${l.created_at}`);
        });
      }
    }
  }
}

main().catch(console.error);
