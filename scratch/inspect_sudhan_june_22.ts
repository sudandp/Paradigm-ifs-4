import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const userId = "5321c6f6-578e-4168-9da8-060148e1587b"; // Sudhan M
    const dateStr = "2026-06-22";

    console.log("Fetching attendance events for June 22, 2026...");
    const { data: events, error: eErr } = await supabase
        .from('attendance_events')
        .select('*')
        .eq('user_id', userId)
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
