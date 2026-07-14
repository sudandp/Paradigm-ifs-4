import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("Fetching some permission requests...");
    const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('leave_type', 'Permission')
        .limit(10);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Fetched ${data?.length} permission requests.`);
    data.forEach((r: any, idx: number) => {
        console.log(`\n--- Request #${idx + 1} ---`);
        console.log(`Reason: ${r.reason}`);
        console.log(`Day Option: ${r.day_option}`);
        console.log(`Correction Details:`, JSON.stringify(r.correction_details, null, 2));
    });
}

main().catch(console.error);
