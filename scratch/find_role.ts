import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, name, email, role_id');
        
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    console.log("Users in public.users:");
    for (const u of users) {
        if (u.role_id === 'admin' || u.role_id === 'hr' || u.role_id === 'management') {
            console.log(`- ${u.name} | ${u.email} | ${u.role_id}`);
        }
    }
}

main().catch(console.error);
