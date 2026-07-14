import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Fetching RLS policies for attendance_events...");
    const { data, error } = await supabase.rpc('get_policies', { table_name: 'attendance_events' });
    
    if (error) {
        // RPC might not exist, let's query pg_policies directly
        console.log("RPC get_policies failed, running SQL query...");
        const { data: policies, error: pErr } = await supabase.rpc('pg_execute', {
            query: "SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'attendance_events';"
        });
        if (pErr) {
            console.error("SQL query error:", pErr);
            // Let's run a generic select query on pg_policies via pg_execute if available, or just query information_schema.
            const { data: policies2, error: pErr2 } = await supabase.rpc('execute_sql', {
                sql: "SELECT * FROM pg_policies WHERE tablename = 'attendance_events';"
            });
            if (pErr2) {
                console.error("execute_sql error:", pErr2);
            } else {
                console.log("Policies:", JSON.stringify(policies2, null, 2));
            }
        } else {
            console.log("Policies:", JSON.stringify(policies, null, 2));
        }
    } else {
        console.log("Policies:", JSON.stringify(data, null, 2));
    }
}

main().catch(console.error);
