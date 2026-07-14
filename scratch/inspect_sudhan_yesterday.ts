import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const sudhanId = "5321c6f6-578e-4168-9da8-060148e1587b";

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', sudhanId)
        .single();

    if (error) {
        console.error("Error fetching Sudhan M profile:", error);
        return;
    }

    console.log("Sudhan M Profile details:");
    console.log("ID:", user.id);
    console.log("Name:", user.name);
    console.log("Role ID:", user.role_id);
    console.log("Society ID:", user.society_id);
    console.log("Organization ID:", user.organization_id);
}

main().catch(console.error);
