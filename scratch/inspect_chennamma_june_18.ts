import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Searching for Chennamma in users table...");
    const { data: users, error: uErr } = await supabase
        .from('users')
        .select('id, name, role_id, role:roles(display_name)')
        .ilike('name', '%Chennamma%');

    if (uErr || !users || users.length === 0) {
        console.error("User search failed:", uErr || "No user found");
        return;
    }

    const user = users[0];
    console.log("Found user profile:", JSON.stringify(user, null, 2));

    const dateStr = "2026-06-18";
    console.log(`\nFetching leave/permission requests for Chennamma on ${dateStr}...`);
    const { data: leaves } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id);

    if (leaves) {
        console.log("All leave/permission requests:");
        leaves.forEach((l: any) => {
            const start = l.start_date || l.startDate;
            const end = l.end_date || l.endDate;
            if (start && start.includes(dateStr)) {
                console.log(JSON.stringify(l, null, 2));
            }
        });
    }

    console.log(`\nFetching attendance events for Chennamma on ${dateStr}...`);
    const { data: events, error: eErr } = await supabase
        .from('attendance_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', dateStr + "T00:00:00")
        .lte('timestamp', dateStr + "T23:59:59");

    if (eErr) {
        console.error("Events error:", eErr);
    } else {
        console.log("Events count:", events?.length);
        console.log(JSON.stringify(events, null, 2));
    }
}

main().catch(console.error);
