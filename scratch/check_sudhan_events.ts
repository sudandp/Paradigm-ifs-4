import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const userId = '5321c6f6-578e-4168-9da8-060148e1587b'; // Sudhan M
    console.log("Querying events for user Sudhan M, ID:", userId);

    const { data: events, error: eventError } = await supabase
        .from('attendance_events')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', '2026-07-01T00:00:00Z')
        .lte('timestamp', '2026-07-09T23:59:59Z')
        .order('timestamp', { ascending: true });

    if (eventError) {
        console.error("Error fetching events:", eventError);
        return;
    }

    console.log(`Events count: ${events?.length}`);
    console.log("Events:", JSON.stringify(events, null, 2));
}

main().catch(console.error);
