import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const userId = 'bbcbb70e-9c52-46c3-96e9-8e89155e35bd';
    const { data: requests, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', userId);
        
    if (error) {
        console.error("Error fetching requests:", error);
    } else {
        console.log("Found leave requests for Chandana R:");
        console.log(JSON.stringify(requests, null, 2));
    }
}

main().catch(console.error);
