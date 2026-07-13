import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const eventId = '74fda637-d0f0-45cf-9227-86e6704c177d'; // Sanjay's auto check-out event
    
    // We want to update its timestamp to 2026-07-11T23:59:59.000+00:00 (backdated to Jul 11)
    const { data, error } = await supabase
        .from('attendance_events')
        .update({
            timestamp: '2026-07-11T23:59:59.000+00:00'
        })
        .eq('id', eventId)
        .select();
        
    if (error) {
        console.error("Error updating timestamp:", error);
    } else {
        console.log("Successfully backdated event timestamp to 2026-07-11T23:59:59Z:");
        console.log(data);
    }
}

main().catch(console.error);
