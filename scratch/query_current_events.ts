import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

const userId = 'ed8ce87f-1f28-4a3a-a319-4dc502add40d';

async function queryEvents() {
  const { data: events, error } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', '2026-07-09T00:00:00Z')
    .order('timestamp', { ascending: true });

  if (error) {
    console.error("Error fetching events:", error);
    return;
  }

  console.log("=== Events for Venkatachalam ===");
  for (const e of events) {
    console.log(`${e.timestamp} | ${e.type} | ${e.work_type} | ${e.location_name || 'No Loc'} | ${e.id}`);
  }
  
  // Let's also check if there are any corrections/leave requests or attendance approvals
  const { data: approvals, error: appError } = await supabase
    .from('attendance_approvals')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', '2026-07-09T00:00:00Z');
    
  if (appError) {
    console.error("Error fetching approvals:", appError);
  } else {
    console.log("\n=== Approvals for Venkatachalam ===");
    console.log(JSON.stringify(approvals, null, 2));
  }
}

queryEvents();
