import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data: snapshots, error } = await supabase
        .from('attendance_month_snapshots')
        .select('id, employee_id, year, month, summary')
        .eq('year', 2026)
        .eq('month', 6);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("June 2026 Snapshots:");
    for (const snap of (snapshots || [])) {
        const { data: user } = await supabase.from('users').select('name').eq('id', snap.employee_id).single();
        console.log(`User ID: ${snap.employee_id}, Name: ${user?.name}, Summary:`, snap.summary);
    }
}

main().catch(console.error);
