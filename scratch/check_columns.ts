import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    // We can run an arbitrary SQL query via a known RPC or just query a single user row to see all keys returned.
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .limit(1)
        .maybeSingle();
        
    if (error) {
        console.error("Error fetching user:", error);
    } else {
        console.log("Columns in public.users:");
        console.log(Object.keys(user || {}));
        console.log("Full user object sample:", user);
    }
}

main().catch(console.error);
