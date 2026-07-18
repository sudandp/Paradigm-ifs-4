const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectRules() {
  const { data: rules, error } = await supabase.from('email_schedule_rules').select('*');
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(rules, null, 2));
  }
}

inspectRules();
