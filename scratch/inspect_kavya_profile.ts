import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const year = 2026;
    const month = 7;
    const userId = "07f61efd-24f2-457e-84b3-d8dafcb556c6"; // Kavya M

    console.log(`Checking if month ${year}-${month} is locked...`);
    const { count, error } = await supabase
        .from('attendance_month_snapshots')
        .select('id', { count: 'exact', head: true })
        .eq('year', year)
        .eq('month', month);

    console.log("Locked count in db:", count, "Error:", error);

    console.log(`\nFetching snapshot for Kavya M (${userId}) for ${year}-${month}...`);
    const { data: snapshot, error: snapErr } = await supabase
        .from('attendance_month_snapshots')
        .select('*')
        .eq('employee_id', userId)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

    if (snapErr) {
        console.error("Error fetching snapshot:", snapErr);
    } else if (snapshot) {
        console.log("Snapshot found for Kavya M:");
        console.log(JSON.stringify(snapshot, null, 2));
    } else {
        console.log("No snapshot found for Kavya M.");
    }
}

main().catch(console.error);
