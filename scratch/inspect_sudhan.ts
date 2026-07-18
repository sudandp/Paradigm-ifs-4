import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .ilike('name', '%Sudhan%');

    if (userError) {
        console.error("Error fetching users:", userError);
        return;
    }

    console.log("Users:", users);

    for (const user of users || []) {
        console.log(`\n=== Inspecting user: ${user.name} (${user.id}) ===`);
        
        // Fetch comp off logs
        const { data: compOffLogs, error: logError } = await supabase
            .from('comp_off_logs')
            .select('*')
            .eq('user_id', user.id);
            
        if (logError) {
            console.error("Error fetching comp off logs:", logError);
        } else {
            console.log("Comp Off Logs:");
            console.log(JSON.stringify(compOffLogs, null, 2));
        }

        // Fetch leave requests
        const { data: leaveRequests, error: reqError } = await supabase
            .from('leave_requests')
            .select('*')
            .eq('user_id', user.id);

        if (reqError) {
            console.error("Error fetching leave requests:", reqError);
        } else {
            console.log("Leave Requests:");
            console.log(JSON.stringify(leaveRequests, null, 2));
        }
    }
}

main().catch(console.error);
