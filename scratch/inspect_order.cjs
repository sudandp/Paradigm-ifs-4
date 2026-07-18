const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectOrder() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, created_at, role_id')
    .neq('role_id', 'unverified')
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
  } else {
    console.log('Total verified users:', users.length);
    console.log('Users ordered by created_at DESC:');
    users.slice(0, 15).forEach((u, i) => {
      console.log(`${i+1}. ${u.name} (${u.created_at})`);
    });
  }
}

inspectOrder();
