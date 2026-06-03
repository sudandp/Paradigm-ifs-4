import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const sqlPath = path.join(process.cwd(), 'database_optimizations.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying SQL migration from database_optimizations.sql...');
  
  // Try parameter name 'sql_query' first
  console.log('Trying parameter name "sql_query"...');
  let result = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (result.error) {
    console.warn('RPC with "sql_query" failed, trying "sql"...');
    result = await supabase.rpc('exec_sql', { sql });
  }

  if (result.error) {
    console.error('Error applying migration via RPC exec_sql:', result.error);
    console.log('\n--- Copy the SQL below to Supabase Dashboard > SQL Editor ---\n');
    console.log(sql);
    console.log('\n--------------------------------------------------------\n');
  } else {
    console.log('Migration applied successfully.');
  }
}

run().catch(console.error);
