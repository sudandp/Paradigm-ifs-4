import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const userId = '5321c6f6-578e-4168-9da8-060148e1587b'; // Sudhan M
    console.log("Querying leaves and attendance for user Sudhan M, ID:", userId);

    // Try leave_requests table
    const { data: leaves, error: leaveError } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', userId)
        .gte('start_date', '2026-06-01')
        .lte('start_date', '2026-06-30');

    if (leaveError) {
        console.error("Error fetching leaves:", leaveError);
        return;
    }

    console.log(`Leaves count: ${leaves?.length}`);
    console.log("Leaves:", JSON.stringify(leaves, null, 2));
}

main().catch(console.error);
