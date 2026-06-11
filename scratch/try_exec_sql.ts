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

async function runSQL(rpcName: string, params: any): Promise<boolean> {
  console.log(`Trying RPC: ${rpcName} with params:`, Object.keys(params));
  try {
    const { data, error } = await supabase.rpc(rpcName, params);
    if (error) {
      console.log(`  RPC ${rpcName} failed:`, error.message);
      return false;
    }
    console.log(`  RPC ${rpcName} SUCCEEDED! Result:`, data);
    return true;
  } catch (err: any) {
    console.log(`  RPC ${rpcName} threw exception:`, err.message || err);
    return false;
  }
}

async function run() {
  const sqlPath = path.join('supabase', 'migrations', '20260611_add_support_permission_to_developer.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`Migration file not found at ${sqlPath}`);
    return;
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // List of RPCs and parameters to try
  const strategies = [
    { name: 'execute_sql', params: { sql } },
    { name: 'execute_sql', params: { sql_query: sql } },
    { name: 'exec_sql', params: { sql } },
    { name: 'exec_sql', params: { sql_query: sql } },
    { name: 'exec_sql', params: { query: sql } },
    { name: 'run_sql', params: { sql } },
    { name: 'run_sql', params: { sql_query: sql } }
  ];

  let success = false;
  for (const strategy of strategies) {
    const result = await runSQL(strategy.name, strategy.params);
    if (result) {
      success = true;
      break;
    }
  }

  if (success) {
    console.log("Migration executed successfully!");
  } else {
    console.error("All SQL execution RPC strategies failed. We need to check database schema or fallback methods.");
  }
}

run();
