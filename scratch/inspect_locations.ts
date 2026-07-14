import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data: locations, error } = await supabase
        .from('locations')
        .select('*')
        .or('name.ilike.%paradigm%,name.ilike.%pifs%,name.ilike.%office%');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Locations matching 'paradigm', 'pifs', or 'office':");
    console.log(JSON.stringify(locations, null, 2));
}

main().catch(console.error);
