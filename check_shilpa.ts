import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { format, isSameMonth } from 'date-fns';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const userId = '94a4f34e-f4d0-42d5-b2c5-7b43419a3325';
    
    // Fetch Comp Off leave requests
    const { data: leaves } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('leave_type', 'Comp Off');
        
    // Fetch manual comp off logs
    const { data: manualLogs } = await supabase
        .from('comp_off_logs')
        .select('*')
        .eq('user_id', userId);
        
    // Fetch Attendance Events to find worked holidays/sundays
    const { data: events } = await supabase
        .from('attendance_events')
        .select('timestamp, type')
        .eq('user_id', userId)
        .gte('timestamp', '2026-01-01');

    console.log("--- COMP OFF LEAVES (Taken/Pending) ---");
    const leavesByMonth = {};
    (leaves || []).forEach(l => {
        const m = l.start_date.substring(0, 7);
        if(!leavesByMonth[m]) leavesByMonth[m] = { taken: 0, pending: 0, details: [] };
        let days = 0;
        // Simple day calculation (assuming full days for simplicity in debugging)
        const d1 = new Date(l.start_date);
        const d2 = new Date(l.end_date);
        days = (d2.getTime() - d1.getTime()) / (1000 * 3600 * 24) + 1;
        if(l.status === 'approved') leavesByMonth[m].taken += days;
        if(l.status === 'pending') leavesByMonth[m].pending += days;
        leavesByMonth[m].details.push(`${l.start_date} to ${l.end_date} (${days}d) - ${l.status}`);
    });
    console.log(leavesByMonth);
    
    console.log("\n--- MANUAL COMP OFF GRANTED ---");
    const manualByMonth = {};
    (manualLogs || []).forEach(l => {
        const m = l.date_earned.substring(0, 7);
        if(!manualByMonth[m]) manualByMonth[m] = { days: 0, details: [] };
        manualByMonth[m].days += l.days_earned;
        manualByMonth[m].details.push(`${l.date_earned} (${l.days_earned}d) - ${l.reason}`);
    });
    console.log(manualByMonth);

    // Dynamic Comp Off calculation (simplified)
    console.log("\n--- DYNAMIC COMP OFF (Worked on Sunday/Holiday) ---");
    const attendedDates = new Set((events || []).map(e => format(new Date(e.timestamp), 'yyyy-MM-dd')));
    const dynamicByMonth = {};
    
    // Check Sundays
    attendedDates.forEach(d => {
        const dateObj = new Date(d);
        if (dateObj.getDay() === 0) { // Sunday
            const m = d.substring(0, 7);
            if(!dynamicByMonth[m]) dynamicByMonth[m] = { days: 0, details: [] };
            dynamicByMonth[m].days += 1;
            dynamicByMonth[m].details.push(`${d} (Sunday)`);
        }
    });
    console.log(dynamicByMonth);
}

main();
