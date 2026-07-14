import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const userId = "07f61efd-24f2-457e-84b3-d8dafcb556c6"; // Kavya M
    
    // Query without detected_shift_id and is_cached
    const query = supabase.from('attendance_events')
      .select('id, user_id, timestamp, type, work_type, latitude, longitude, location_id, location_name, device_id, checkout_note, attachment_url, is_manual, created_by, reason, is_ot, battery_level, device_name, ip_address, network_type, source, steps, travel_distance')
      .in('user_id', [userId])
      .gte('timestamp', '2026-06-15')
      .lte('timestamp', '2026-07-15 12:00:00')
      .order('timestamp', { ascending: true });

    const { data, error } = await query;
    if (error) {
        console.error("Query failed:", error);
        return;
    }

    console.log(`Query succeeded! Fetched data count: ${data?.length}`);
}

main().catch(console.error);
