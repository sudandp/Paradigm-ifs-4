import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function listTriggers() {
  const { data, error } = await supabase.rpc('run_sql', {
    sql_query: `
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'attendance_events';
    `
  });

  if (error) {
    // If run_sql RPC does not exist, let's run it via a simple select or query information schema using custom query if we have an RPC
    console.error("Error fetching triggers:", error);
    
    // Let's try running a direct query via a temporary function or inspect using pg tables if possible,
    // or let's inspect the migration files.
  } else {
    console.log("Triggers:", data);
  }
}

listTriggers();
