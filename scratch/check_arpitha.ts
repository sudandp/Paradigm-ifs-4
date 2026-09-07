import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { format } from 'date-fns';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: user } = await supabase.from('users').select('*').ilike('name', '%Arpitha%').single();
    console.log("Arpitha User:", {
        id: user?.id,
        name: user?.name,
        role: user?.role,
        role_id: user?.role_id,
        location: user?.location,
        organization_id: user?.organization_id
    });

    if (!user) return;

    // Check leave requests for Arpitha
    const { data: leaves } = await supabase.from('leave_requests')
        .select('*')
        .eq('user_id', user.id);
    console.log("Leaves for Arpitha count:", leaves?.length);
    leaves?.forEach(l => {
        console.log("Leave:", {
            id: l.id,
            leave_type: l.leave_type,
            start_date: l.start_date,
            end_date: l.end_date,
            status: l.status,
            day_option: l.day_option,
            reason: l.reason
        });
    });

    // Check events in August 2026
    const { data: events } = await supabase.from('attendance_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', '2026-08-01T00:00:00')
        .lte('timestamp', '2026-08-31T23:59:59')
        .order('timestamp', { ascending: true });
    console.log("Events count in Aug 2026:", events?.length);
    if (events && events.length > 0) {
        console.log("First 3 events:", events.slice(0, 3));
    }
}

main().catch(console.error);
