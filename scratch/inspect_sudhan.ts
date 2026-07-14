import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Searching for Sudhan M...");
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .ilike('name', '%Sudhan%');

    if (error) {
        console.error("Error fetching users:", error);
        return;
    }

    console.log("Found users matching 'Sudhan':");
    console.log(JSON.stringify(users, null, 2));

    if (!users || users.length === 0) {
        console.log("No user named Sudhan found.");
        return;
    }

    const sudhan = users[0];
    const sudhanId = sudhan.id;

    console.log(`\nFetching attendance events for Sudhan M (${sudhanId}) near yesterday 7:15 PM...`);
    // Let's get today's date and calculate yesterday.
    // Today is July 14, 2026. Yesterday was July 13, 2026.
    // Let's fetch all events for July 13, 2026.
    const { data: events, error: eErr } = await supabase
        .from('attendance_events')
        .select('*')
        .eq('user_id', sudhanId)
        .gte('timestamp', '2026-07-13T00:00:00')
        .lte('timestamp', '2026-07-13T23:59:59')
        .order('timestamp', { ascending: true });

    if (eErr) {
        console.error("Error fetching events:", eErr);
    } else {
        console.log("Yesterday's events:");
        console.log(JSON.stringify(events, null, 2));
    }
}

main().catch(console.error);
