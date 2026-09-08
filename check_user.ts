import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const userId = '34aaddf9-77a0-4e2f-984b-b745cddb4808';
    
    // Test 1: Fetch settings and user as done in api.ts
    const [settingsRes, userRes] = await Promise.all([
        supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single(),
        supabase.from('users')
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
          .single()
    ]);

    const VITE_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU";
    const anonSupabase = createClient(SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
    const { data: sData, error: sError } = await anonSupabase
        .from('settings')
        .select('*');
    console.log("Anon settings query result:", sData, sError);

    const testSql = `SELECT policyname, tablename, roles, cmd, qual FROM pg_policies WHERE tablename IN ('settings', 'users');`;
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('exec_sql', { sql: testSql });
    console.log("exec_sql result:", rpcRes, rpcErr);
}

main().catch(console.error);
