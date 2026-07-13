import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const userId = '2a82f0cc-effb-4576-917c-72408ea06b45'; // Sanjay Ganapati Naik
    
    // Fetch all attendance events in July 2026 for Sanjay
    const { data: attendanceEvents, error: attError } = await supabase
        .from('attendance_events')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', '2026-07-10T00:00:00Z')
        .lte('timestamp', '2026-07-13T23:59:59Z')
        .order('timestamp', { ascending: true });
        
    if (attError) {
        console.error("Error fetching attendance events:", attError);
        return;
    }
    
    console.log("Attendance events from July 10 to 13:");
    console.log(attendanceEvents.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        type: e.type,
        workType: e.workType,
        checkout_note: e.checkout_note,
        note: e.note
    })));
}

main().catch(console.error);
