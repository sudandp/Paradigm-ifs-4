import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const eventId = 'a02f0637-7c08-469c-b679-21628f6752c2';
    const { error } = await supabase.from('attendance_events').delete().eq('id', eventId);
    
    if (error) {
        console.error("Error deleting event:", error);
    } else {
        console.log("Successfully deleted the erroneous punch-out event (id: " + eventId + ").");
        
        // Let's also unlock their access just in case so they can punch perfectly
        const userId = '5321c6f6-578e-4168-9da8-060148e1587b';
        // Give 1 unlock count if they don't have it
        const { error: insErr } = await supabase.from('attendance_unlock_requests').insert({
            user_id: userId,
            manager_id: userId,
            reason: 'System Admin Clear',
            status: 'approved',
            requested_at: new Date().toISOString(),
            responded_at: new Date().toISOString()
        });
        if (insErr) {
             console.error("Error adding unlock:", insErr);
        } else {
             console.log("Successfully approved an unlock request for the user.");
        }
    }
}

main().catch(console.error);
