import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// We want to fetch the settings and user profile to calculate the balance of Sinchana KM
async function main() {
    const userId = "c9ffc969-8f2b-48cf-914c-0f30a661ba6f"; // Sinchana KM
    
    // Fetch user profile
    const { data: userProfile } = await admin.from('users').select('*').eq('id', userId).single();
    console.log("User Profile:", userProfile);

    // Fetch leave requests
    const { data: leaves } = await admin.from('leave_requests').select('*').eq('user_id', userId);
    console.log("Leaves count:", leaves?.length);
    
    // Print all leaves and their statuses
    leaves?.forEach((l: any) => {
        console.log(`${l.id} | ${l.leave_type} | ${l.status} | ${l.start_date} to ${l.end_date}`);
    });
}

main().catch(console.error);
