const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectUsers() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, role_id, email')
    .order('name');
  if (error) {
    console.error(error);
  } else {
    console.log(`Total users found: ${users.length}`);
    console.log('First 30 users:');
    console.log(users.slice(0, 30));
  }
}

inspectUsers();
