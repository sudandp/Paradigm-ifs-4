import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testQuery() {
  const userId = '216d264d-b20b-45a1-91b5-09cb47c781fb'; // Veerabhadra T M

  const userRes = await supabase.from('users')
    .select(`
      role_id, 
      role:roles(display_name),
      earned_leave_opening_balance, 
      earned_leave_opening_date, 
      sick_leave_opening_balance, 
      sick_leave_opening_date,
      child_care_leave_opening_balance,
      child_care_leave_opening_date,
      comp_off_opening_balance,
      comp_off_opening_date,
      floating_leave_opening_balance,
      floating_leave_opening_date,
      joining_date,
      gender,
      created_at,
      organization_name,
      society_name,
      society_id,
      location_id,
      companies!users_society_id_fkey(location)
    `)
    .eq('id', userId)
    .single();

  console.log("=== USER RES QUERY RESULT ===");
  console.log("Error:", userRes.error);
  console.log("Data:", userRes.data);
}

testQuery().catch(console.error);
