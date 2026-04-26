import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMore() {
  const tables = ['site_assets', 'site_issued_tools', 'site_manpower', 'organizations', 'organization_groups'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(0);
    if (error) {
      console.log(`Table ${table}: FAILED - ${error.message}`);
    } else {
      console.log(`Table ${table}: SUCCESS`);
    }
  }
}

checkMore();
