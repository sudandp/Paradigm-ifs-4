import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    const { data, error } = await admin
        .from('attendance_events')
        .select('*')
        .eq('user_id', 'ed8ce87f-1f28-4a3a-a319-4dc502add40d')
        .order('timestamp', { ascending: true });

    if (error) {
        console.error('Fetch error:', error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log('=== Events ===');
        const last10 = data.slice(-10);
        last10.forEach((d: any) => console.log(`${d.id} | ${d.timestamp} | ${d.type} | ${d.work_type}`));
    } else {
        console.log('No data found to inspect columns.');
    }
}

main().catch(console.error);
