import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { format, eachDayOfInterval } from 'date-fns';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testCompOffDeduction() {
    const userId = '216d264d-b20b-45a1-91b5-09cb47c781fb'; // Veerabhadra T M

    const { data: leaves } = await supabase.from('leave_requests').select('*').eq('user_id', userId).eq('status', 'approved');
    const { data: holidays } = await supabase.from('holidays').select('*');
    const { data: yearEvents } = await supabase.from('attendance_events').select('*').eq('user_id', userId).gte('timestamp', '2026-01-01');

    const holidayDates = new Set(holidays?.map(h => format(new Date(String(h.date).replace(/-/g, '/')), 'yyyy-MM-dd')) || []);
    const weeklyOffDays = [0];

    const workDatesSet = new Set<string>();
    (yearEvents || []).forEach(e => {
        workDatesSet.add(format(new Date(e.timestamp), 'yyyy-MM-dd'));
    });

    console.log("=== COMP OFF LEAVES DEDUCTION CALCULATION ===");
    let totalCompOffUsedCalculated = 0;

    leaves?.filter(l => (l.leave_type || '').toLowerCase().includes('comp')).forEach(leave => {
        let leaveAmount = 0;
        if (leave.day_option === 'half') {
            leaveAmount = 0.5;
        } else {
            const startDate = new Date(leave.start_date.replace(/-/g, '/'));
            const endDate = new Date(leave.end_date.replace(/-/g, '/'));
            const days = eachDayOfInterval({ start: startDate, end: endDate });

            days.forEach(d => {
                const dStr = format(d, 'yyyy-MM-dd');
                const isSunday = weeklyOffDays.includes(d.getDay());
                const isHoliday = holidayDates.has(dStr);
                const hasWork = workDatesSet.has(dStr);

                if (!isSunday && !isHoliday) {
                    if (!hasWork) {
                        leaveAmount += 1;
                    }
                }
            });
        }

        totalCompOffUsedCalculated += leaveAmount;
        console.log(`Leave ID: ${leave.id} | Start: ${leave.start_date} | Option: ${leave.day_option} | Computed Amount: ${leaveAmount} | Reason: ${leave.reason}`);
    });

    console.log(`\nTOTAL COMP OFF USED COMPUTED BY API LOGIC: ${totalCompOffUsedCalculated}`);
}

testCompOffDeduction().catch(console.error);
