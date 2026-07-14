import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const sudhanId = "5321c6f6-578e-4168-9da8-060148e1587b";
    console.log(`Setting password for user ${sudhanId} (Sudhan M) to 'PAR_1610'...`);
    
    const { data, error } = await supabase.auth.admin.updateUserById(
        sudhanId,
        { password: 'PAR_1610' }
    );

    if (error) {
        console.error("Error setting passcode:", error);
    } else {
        console.log("Successfully set Sudhan M's passcode back to '1610'!");
    }
}

main().catch(console.error);
