import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    // We can query pg_catalog to find constraints on public.users
    const query = `
        SELECT 
            conname AS constraint_name,
            pg_get_constraintdef(c.oid) AS constraint_definition
        FROM 
            pg_constraint c
        JOIN 
            pg_namespace n ON n.oid = c.connamespace
        WHERE 
            n.nspname = 'public'
            AND conrelid = 'public.users'::regclass;
    `;
    
    // Use unsafe sql execution RPC if available, or fetch triggers
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: query });
    if (error) {
        console.error("RPC error:", error);
    } else {
        console.log("Constraints on public.users:");
        console.log(data);
    }
}

main().catch(console.error);
