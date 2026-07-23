import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { format, eachDayOfInterval } from 'date-fns';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const userId = '216d264d-b20b-45a1-91b5-09cb47c781fb'; // Veerabhadra T M

    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    const { data: leaves } = await supabase.from('leave_requests').select('*').eq('user_id', userId).eq('status', 'approved');
    const { data: events } = await supabase.from('attendance_events').select('*').eq('user_id', userId).gte('timestamp', '2026-01-01');

    console.log("Veerabhadra User Profile:", {
        name: user.name,
        opening_balance: user.comp_off_opening_balance,
        opening_date: user.comp_off_opening_date
    });

    const compOffLeaves = leaves?.filter(l => l.leave_type === 'Comp Off') || [];
    let compOffUsed = 0;
    compOffLeaves.forEach(l => {
        const s = new Date(l.start_date);
        const e = new Date(l.end_date);
        const days = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const count = l.days_count || l.total_days || (l.day_option === 'half' ? 0.5 : days);
        compOffUsed += count;
    });

    console.log("Total Comp Off Leaves Taken:", compOffUsed);

    // Calculate how much opening balance is needed to make final balance = 3.5
    // targetBalance = (openingBalance + dynamicEarned + manualEarned) - compOffUsed
    // If targetBalance = 3.5, then openingBalance = 3.5 + compOffUsed - dynamicEarned
    // Since current dynamic + manual = 0 for Veerabhadra T M, openingBalance needed = 3.5 + 14.5 = 18.0 days!
    const targetBalance = 3.5;
    const requiredOpeningBalance = targetBalance + compOffUsed;

    console.log(`To achieve verified net balance of ${targetBalance} days:`);
    console.log(`Setting comp_off_opening_balance = ${requiredOpeningBalance} and comp_off_opening_date = '2026-01-01'`);
}

test().catch(console.error);
