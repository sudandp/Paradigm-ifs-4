import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    // 1. Find the user
    const { data: users, error: findError } = await supabase
        .from('users')
        .select('id, name, email')
        .ilike('name', '%Deepika%');
        
    if (findError) {
        console.error("Error finding user:", findError);
        return;
    }
    
    if (!users || users.length === 0) {
        console.log("No user found matching 'Deepika'");
        return;
    }
    
    const user = users[0];
    console.log(`Found user: ${user.name} (${user.email}), ID: ${user.id}`);
    
    // 2. Attempt deletion to see the exact constraint error
    console.log("Attempting to delete user...");
    const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);
        
    if (deleteError) {
        console.error("DELETE FAILED!");
        console.error("Code:", deleteError.code);
        console.error("Message:", deleteError.message);
        console.error("Details:", deleteError.details);
        console.error("Hint:", deleteError.hint);
    } else {
        console.log("DELETE SUCCEEDED in public.users!");
    }
}

main().catch(console.error);
