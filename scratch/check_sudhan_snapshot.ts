import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const userId = '5321c6f6-578e-4168-9da8-060148e1587b'; // Sudhan M
    const { data: snapshots, error } = await supabase
        .from('attendance_month_snapshots')
        .select('*')
        .eq('employee_id', userId)
        .eq('year', 2026)
        .eq('month', 6);
        
    if (error) {
        console.error("Error:", error);
    } else {
        if (snapshots && snapshots.length > 0) {
            console.log("Snapshot found:", JSON.stringify(snapshots[0], null, 2));
        } else {
            console.log("No snapshot found.");
        }
    }
}
main();
