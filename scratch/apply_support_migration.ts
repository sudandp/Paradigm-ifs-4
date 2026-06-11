import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function apply() {
  const sqlPath = path.join('supabase', 'migrations', '20260611_add_support_permission_to_developer.sql');
  console.log(`Reading SQL migration from ${sqlPath}...`);
  if (!fs.existsSync(sqlPath)) {
    console.error(`Migration file does not exist at ${sqlPath}`);
    return;
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Executing SQL migration via exec_sql RPC...');

  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Error applying migration via RPC:', error);
  } else {
    console.log('Migration applied successfully:', data);
  }
}

apply();
