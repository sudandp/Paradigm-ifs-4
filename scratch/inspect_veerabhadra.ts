import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectVeerabhadra() {
    const { data: users } = await supabase.from('users').select('*').ilike('name', '%veerabhadra t m%');
    console.log("Found user:", users);

    if (!users || users.length === 0) return;

    const u = users[0];
    console.log("User Details:", {
        id: u.id,
        name: u.name,
        email: u.email,
        comp_off_opening_balance: u.comp_off_opening_balance,
        comp_off_opening_date: u.comp_off_opening_date
    });

    const { data: leaves } = await supabase.from('leave_requests').select('*').eq('user_id', u.id).eq('leave_type', 'Comp Off');
    console.log("\nApproved/Pending Comp Off Leaves for Veerabhadra T M:");
    console.table(leaves?.map(l => ({
        id: l.id,
        start_date: l.start_date,
        end_date: l.end_date,
        days_count: l.days_count || l.total_days,
        day_option: l.day_option,
        status: l.status,
        reason: l.reason
    })));

    const { data: logs } = await supabase.from('comp_off_logs').select('*').eq('user_id', u.id);
    console.log("\nExisting Comp Off Logs:", logs);
}

inspectVeerabhadra().catch(console.error);
