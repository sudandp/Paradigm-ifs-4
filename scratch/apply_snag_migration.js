import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSQL(rpcName, params) {
  console.log(`Trying RPC: ${rpcName}`);
  try {
    const { data, error } = await supabase.rpc(rpcName, params);
    if (error) {
      console.log(`  RPC ${rpcName} failed:`, error.message);
      return false;
    }
    console.log(`  RPC ${rpcName} SUCCEEDED!`);
    return true;
  } catch (err) {
    console.log(`  RPC ${rpcName} threw exception:`, err.message || err);
    return false;
  }
}

async function run() {
  try {
    const migrationPath = path.resolve('supabase/migrations/20260706_create_snag_audits.sql');
    console.log('Reading migration file:', migrationPath);
    const sql = fs.readFileSync(migrationPath, 'utf8');

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
      console.log('Migration executed successfully!');
    } else {
      console.error('All SQL execution RPC strategies failed.');
    }
  } catch (err) {
    console.error('Failed to run migration script:', err);
  }
}

run();
