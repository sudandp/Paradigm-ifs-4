import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    const { error: err1 } = await admin
        .from('attendance_events')
        .delete()
        .in('id', ['f50935af-b1fc-4b25-b146-3d0a21ee0930', '2dced527-abf0-4e05-b153-db0c2a23aa10']);

    if (err1) {
        console.error('Delete error:', err1.message);
    } else {
        console.log('Deleted successfully');
    }
}

main().catch(console.error);
