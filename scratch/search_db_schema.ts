import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    // Query information_schema to list tables and columns
    const { data, error } = await supabase.rpc('get_tables_and_columns');
    if (error) {
        // Fallback: run query using standard postgrest if rpc doesn't exist
        console.log("RPC failed, fetching table list from public schema...");
        const { data: tables, error: err2 } = await supabase.from('users').select('*').limit(1);
        console.log("Connection check:", err2 ? "Failed" : "Success");
    } else {
        console.log(data);
    }
}

main().catch(console.error);
