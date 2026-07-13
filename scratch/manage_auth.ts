import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Updating password for chethanark17@gmail.com...");
    const { data, error } = await supabase.auth.admin.updateUserById(
        '5e4dfb96-5a08-4ec5-8564-403053271178',
        { password: 'P@radigmIFS#2026!' }
    );
    if (error) {
        console.error("Error updating password:", error);
    } else {
        console.log("Password updated successfully to 'P@radigmIFS#2026!'!");
    }
}

main().catch(console.error);
