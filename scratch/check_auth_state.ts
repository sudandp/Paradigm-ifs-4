import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    // 1. Check if user still exists in auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error("Error listing auth users:", authError);
    } else {
        const deepikaAuth = authUsers.users.find(u => u.email?.includes('sudandpineee'));
        console.log("Deepika in auth.users:", deepikaAuth ? `YES, ID: ${deepikaAuth.id}` : "NO");
    }

    // 2. Check if user still exists in public.users
    const { data: publicUsers, error: publicError } = await supabase
        .from('users')
        .select('*')
        .ilike('name', '%Deepika%');
    if (publicError) {
        console.error("Error listing public users:", publicError);
    } else {
        console.log("Deepika in public.users:", publicUsers.length > 0 ? "YES" : "NO");
    }
}

main().catch(console.error);
