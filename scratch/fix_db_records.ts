import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const userId = '2a82f0cc-effb-4576-917c-72408ea06b45'; // Sanjay Ganapati Naik
    
    // We want to delete duplicate events:
    // 1. Delete e3e0e961-a1d5-45fd-b3e1-c673658c3e82 (duplicate punch-out for Session 2026-07-11)
    const { error: del1Err } = await supabase
        .from('attendance_events')
        .delete()
        .eq('id', 'e3e0e961-a1d5-45fd-b3e1-c673658c3e82');
    
    if (del1Err) console.error("Error deleting e3e0e961:", del1Err);
    else console.log("Deleted duplicate event e3e0e961 successfully");

    // 2. Delete 9ded1fd2-6880-4caf-a456-909e0e829eed (duplicate punch-out for Session 2026-07-10)
    const { error: del2Err } = await supabase
        .from('attendance_events')
        .delete()
        .eq('id', '9ded1fd2-6880-4caf-a456-909e0e829eed');
        
    if (del2Err) console.error("Error deleting 9ded1fd2:", del2Err);
    else console.log("Deleted duplicate event 9ded1fd2 successfully");

    // 3. For 35be6c2f-7e54-40a7-a763-836988614a0c (punch-out for Session 2026-07-10),
    // update the checkout_note to not match "with out applying correction", so the used count decreases.
    const { error: updErr } = await supabase
        .from('attendance_events')
        .update({
            checkout_note: 'user clicked for punch out [SessionDate: 2026-07-10]'
        })
        .eq('id', '35be6c2f-7e54-40a7-a763-836988614a0c');
        
    if (updErr) console.error("Error updating 35be6c2f:", updErr);
    else console.log("Updated event 35be6c2f note successfully");
    
    // Now verify the new count of missed punches/corrections for Sanjay in July 2026
    const { data: attendanceEvents, error: attError } = await supabase
        .from('attendance_events')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', '2026-07-01T00:00:00Z')
        .lte('timestamp', '2026-07-31T23:59:59Z');
        
    if (attError) {
        console.error("Error fetching attendance events:", attError);
        return;
    }
    
    const matchedEvents = attendanceEvents?.filter(e => {
        const note = e.checkout_note || e.checkoutNote || e.note || '';
        return note.toLowerCase().includes('auto closed') || note.toLowerCase().includes('with out applying correction');
    });
    
    console.log("Remaining matched missed punch checkout events (should be exactly 1):");
    console.log(matchedEvents?.map(e => ({ id: e.id, timestamp: e.timestamp, type: e.type, checkout_note: e.checkout_note })));
}

main().catch(console.error);
