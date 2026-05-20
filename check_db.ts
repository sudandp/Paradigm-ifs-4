import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const { data, error } = await supabase.rpc('get_column_info', {}); // Let's check if we can query pg_catalog
  // Or just query pg_attribute and pg_class via RPC or raw sql if we don't have SQL endpoint, but wait, we don't have raw SQL endpoint in supabase-js client.
  // We can query pg_tables or run a query through a postgres endpoint if there is one.
  // Wait! Let's do a select from information_schema.columns or pg_constraint via standard select? No, supabase client doesn't expose pg_* directly unless there's a view.
  // But wait! Can we check if organization_id can be updated to 'test_site_1,test_site_2' for a user and see if it fails?
  // Let's do that! That's a direct, robust way to find out if there's a foreign key constraint.
  const testUserId = 'f06f05d9-cf5f-4e4d-a0b4-9534fd2d1e7b'; // Pradeepp Gangaiah
  console.log("Attempting to update organization_id with comma-separated string...");
  const { data: updateRes, error: updateErr } = await supabase
    .from('users')
    .update({ organization_id: 'site1,site2' })
    .eq('id', testUserId)
    .select();
  
  if (updateErr) {
    console.log("Update failed as expected (or FK constraint exists):", updateErr.message);
  } else {
    console.log("Update succeeded! No FK constraint on organization_id:", updateRes);
    // Revert it!
    await supabase.from('users').update({ organization_id: 'pifs-bgl' }).eq('id', testUserId);
  }
}

check();
