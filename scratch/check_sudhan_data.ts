import { createClient } from '@supabase/supabase-js';
import { processEmployeeMonth } from '../utils/monthlyReportCalculations';

const resolvePayableValue = (s: string): number => {
    if (!s) return 0;
    
    if (s.includes('+')) return s.split('+').reduce((acc, part) => acc + resolvePayableValue(part.trim()), 0);

    const match = s.match(/^(\d*\.?\d+)P$/);
    if (match) return parseFloat(match[1]);
    if (s === 'P' || s === 'H/P' || s === 'W/P' || s === 'BL/P' || s === 'PL/P' || s === 'W/O') return 1;
    if (s.startsWith('0.5') && (s.includes('SL') || s.includes('S/L') || s.includes('EL') || s.includes('E/L') || s.includes('CL') || s.includes('C/L') || s.includes('WH') || s.includes('W/H') || s.includes('BL') || s.includes('PL') || s.includes('ML') || s.includes('CCL') || s.includes('CO') || s.includes('C/O'))) return 0.5;
    if (s.includes('SL') || s.includes('S/L') || s.includes('EL') || s.includes('E/L') || s.includes('CL') || s.includes('C/L') || s.includes('C/O') || s.includes('CO') || s.includes('BL') || s.includes('F/H') || s.includes('FH') || s.includes('PL') || s.includes('P/L') || s.includes('ML') || s.includes('M/L') || s.includes('CCL') || s.includes('WH') || s.includes('W/H')) {
        return s.startsWith('0.5') ? 0.5 : 1;
    }
    return 0;
};

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const userId = '5321c6f6-578e-4168-9da8-060148e1587b'; // Sudhan M
    const year = 2026;
    const month = 6;
    
    // get user
    const { data: users } = await supabase.from('users').select('*').eq('id', userId);
    const user = users[0];

    // get events
    const start = '2026-06-01';
    const end = '2026-06-30';
    const { data: events } = await supabase.from('attendance_events').select('*').eq('user_id', userId).gte('timestamp', start).lte('timestamp', end + 'T23:59:59');
    
    // get leaves
    const { data: leaves } = await supabase.from('leave_requests').select('*').eq('user_id', userId).gte('start_date', start).lte('start_date', end + 'T23:59:59');

    // get holidays
    const { data: holidays } = await supabase.from('holidays').select('*').gte('date', start).lte('date', end + 'T23:59:59');

    const result = processEmployeeMonth(
        user, 
        events || [], 
        leaves || [], 
        holidays || [], 
        year, 
        month, 
        [], // passedOfficeHolidays
        [], // passedFieldHolidays
        [], // passedSiteHolidays
        [], // passedRecurringHolidays
        leaves || [], // allLeaves
        user.role, 
        [], // routePoints
        null, // versionedUserRules
        { missedCheckoutConfig: {}, office: { dailyWorkingHours: { min: 8, max: 9 }, minimumHoursHalfDay: 4, quarterDayHours: 2, threeQuarterDayHours: 6, gracePeriodMinutes: 15, enableHoursBasedFallback: true } }, // attendance
        [] // scopedSettings
    );

    console.log("Total Payable Days:", result.totalPayableDays || result.summary?.totalPayableDays || (result as any).totalPayableDays);
    console.log("Daily Breakdown:");
    
    const dailyData = result.dailyData || (result as any).dailyData || [];
    
    dailyData.forEach(d => {
        const val = resolvePayableValue(d.status);
        console.log(`Date: ${d.date} | Status: ${d.status} | Value: ${val}`);
    });
}
main();
