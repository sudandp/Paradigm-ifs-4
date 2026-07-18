const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSpecificUser() {
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .ilike('name', '%Sachin%');
  if (error) {
    console.error(error);
  } else {
    console.log('Matching users:', users);
  }
}

checkSpecificUser();
