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
  const sqlPath = path.join('supabase', 'migrations', '20260711_fix_attendance_violations_insert_rls.sql');
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
    
    // Let's try executing via other RPC strategies just in case
    const strategies = [
      { name: 'execute_sql', params: { sql } },
      { name: 'execute_sql', params: { sql_query: sql } },
      { name: 'exec_sql', params: { sql_query: sql } },
      { name: 'exec_sql', params: { query: sql } },
      { name: 'run_sql', params: { sql } },
      { name: 'run_sql', params: { sql_query: sql } }
    ];
    
    for (const strategy of strategies) {
      console.log(`Trying alternative RPC: ${strategy.name}...`);
      const { data: altData, error: altError } = await supabase.rpc(strategy.name, strategy.params);
      if (!altError) {
        console.log(`Alternative RPC ${strategy.name} succeeded:`, altData);
        return;
      }
      console.error(`  Alternative RPC ${strategy.name} failed:`, altError.message);
    }
  } else {
    console.log('Migration applied successfully:', data);
  }
}

apply();
