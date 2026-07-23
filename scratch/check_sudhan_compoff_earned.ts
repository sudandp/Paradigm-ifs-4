import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { format } from 'date-fns';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const userId = '5321c6f6-578e-4168-9da8-060148e1587b'; // Sudhan M

    // Fetch all attendance events for Sudhan M
    const { data: events } = await supabase
        .from('attendance_events')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', '2026-01-01T00:00:00Z');

    // Group events by date
    const dateMap = new Map<string, typeof events>();
    events?.forEach(e => {
        const d = format(new Date(e.timestamp), 'yyyy-MM-dd');
        if (!dateMap.has(d)) dateMap.set(d, []);
        dateMap.get(d)!.push(e);
    });

    // Fetch holidays
    const { data: holidays } = await supabase.from('holidays').select('*').gte('date', '2026-01-01');
    const holidayDates = new Set(holidays?.map(h => format(new Date(h.date), 'yyyy-MM-dd')) || []);

    console.log("=== ATTENDANCE ON SUNDAYS & HOLIDAYS (2026) ===");
    let sundayWorkCount = 0;
    let holidayWorkCount = 0;

    const workedSundays: string[] = [];
    const workedHolidays: string[] = [];

    for (const [dateStr, evts] of dateMap.entries()) {
        const d = new Date(dateStr + 'T00:00:00');
        const isSunday = d.getDay() === 0;
        const isHoliday = holidayDates.has(dateStr);

        const hasPunch = evts.some(e => 
            e.type?.toLowerCase().includes('check') || 
            e.type?.toLowerCase().includes('in') || 
            e.type?.toLowerCase().includes('out') ||
            e.type?.toLowerCase().includes('punch')
        );

        if (hasPunch) {
            if (isSunday) {
                sundayWorkCount++;
                workedSundays.push(dateStr);
            } else if (isHoliday) {
                holidayWorkCount++;
                workedHolidays.push(dateStr);
            }
        }
    }

    console.log("Worked Sundays:", workedSundays);
    console.log("Worked Holidays:", workedHolidays);

    // Fetch Comp Off logs
    const { data: compOffLogs } = await supabase.from('comp_off_logs').select('*').eq('user_id', userId);
    console.log("\nComp Off Logs count:", compOffLogs?.length || 0);

    // Fetch OT Hours Bank
    const { data: user } = await supabase.from('users').select('ot_hours_bank, comp_off_opening_balance').eq('id', userId).single();
    console.log("\nOT Hours Bank:", user?.ot_hours_bank);
    console.log("Opening Balance:", user?.comp_off_opening_balance);
}

main().catch(console.error);
