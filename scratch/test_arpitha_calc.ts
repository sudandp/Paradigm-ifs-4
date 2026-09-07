// Polyfill import.meta.env for Node
(globalThis as any).importMetaEnv = { VITE_SUPABASE_URL: 'https://fmyafuhxlorbafbacywa.supabase.co' };
Object.defineProperty(import.meta, 'env', {
    value: { VITE_SUPABASE_URL: 'https://fmyafuhxlorbafbacywa.supabase.co' }
});

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { format } from 'date-fns';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: user } = await supabase.from('users').select('*').ilike('name', '%Arpitha%').single();
    const { data: settings } = await supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single();
    const attendance = settings?.attendance_settings || {};
    const rules = attendance.rules || attendance.office || {};

    const { data: events } = await supabase.from('attendance_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', '2026-07-20T00:00:00')
        .lte('timestamp', '2026-09-02T23:59:59')
        .order('timestamp', { ascending: true });

    const { data: leaves } = await supabase.from('leave_requests')
        .select('*')
        .eq('user_id', user.id);

    console.log("Events count:", events?.length);

    const { processEmployeeMonth } = await import('../utils/monthlyReportCalculations');
    const { getEarlyDepartureDeductions, calculateWorkingHours } = await import('../utils/attendanceCalculations');

    // Let's test getEarlyDepartureDeductions
    const targetShiftMins = (rules?.minimumHoursFullDay || rules?.dailyWorkingHours?.min || 8) * 60;
    console.log("Target shift mins:", targetShiftMins);
    const earlyDepartureList = getEarlyDepartureDeductions(events as any || [], targetShiftMins, leaves as any || [], leaves as any || [], '2026-08');
    console.log("Early departures count:", earlyDepartureList.length);
    earlyDepartureList.forEach(ed => {
        console.log("Early Departure:", ed.dateStr, ed.formattedWorked, "earlyMins:", ed.earlyMins);
    });

    const report = processEmployeeMonth(
        user as any,
        events as any || [],
        leaves as any || [],
        [],
        2026,
        8,
        [],
        [],
        [],
        [],
        leaves as any || [],
        user.role,
        [],
        rules,
        attendance
    );

    console.log("Statuses for Aug 2026:", report.statuses);
    report.dailyData?.slice(0, 10).forEach(d => {
        console.log(`Day ${d.day}: status=${d.status}, inTime=${d.inTime}, outTime=${d.outTime}, netWorked=${d.netWorkedHours}`);
    });
}

main().catch(console.error);
