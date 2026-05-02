import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { format, endOfMonth, startOfMonth, eachDayOfInterval } from 'date-fns';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // 1. Get the user "Madhushree B M"
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, name, gender, role:roles(display_name)')
        .ilike('name', '%Madhushree%');
        
    if (userError) {
        console.error("User error:", userError);
        return;
    }
    
    if (!users || users.length === 0) {
        console.log("User Madhushree not found.");
        return;
    }
    
    const user = users[0];
    console.log("Found user:", user.name, user.id, "Gender:", user.gender);

    // 2. Fetch Comp Off logs
    const { data: compOffLogs, error: compOffError } = await supabase
        .from('comp_off_logs')
        .select('*')
        .eq('user_id', user.id);
        
    console.log("\n--- COMP OFF LOGS ---");
    console.log(compOffLogs);
    
    // 3. Fetch User Holidays
    const { data: userHolidays, error: holidayError } = await supabase
        .from('user_holidays')
        .select('*')
        .eq('user_id', user.id);
        
    console.log("\n--- USER HOLIDAYS ---");
    console.log(userHolidays);
    
    // 4. Fetch Attendance Events
    const { data: events, error: eventError } = await supabase
        .from('attendance_events')
        .select('timestamp, type')
        .eq('user_id', user.id)
        .gte('timestamp', '2026-01-01');

    if (eventError) {
        console.error("Event error:", eventError);
    }
    console.log(`\n--- ATTENDANCE EVENTS (Count: ${events ? events.length : 'null'}) ---`);
    const attendedDates = new Set((events || []).map(e => format(new Date(e.timestamp), 'yyyy-MM-dd')));
    console.log("Attended Dates:", Array.from(attendedDates));
    
    // Check Sundays
    let sundaysWorked = 0;
    const sundays = [];
    attendedDates.forEach(d => {
        const dateObj = new Date(d);
        if (dateObj.getDay() === 0) { // Sunday
            sundaysWorked++;
            sundays.push(d);
        }
    });
    console.log("\nSundays worked:", sundaysWorked, sundays);
    
    // Check Fixed Holidays
    const FIXED_HOLIDAYS = [
        { name: 'Republic Day', date: '01-26' },
        { name: 'May Day', date: '05-01' },
        { name: 'Independence Day', date: '08-15' },
        { name: 'Gandhi Jayanti', date: '10-02' },
        { name: 'Karnataka Rajyotsava', date: '11-01' },
    ];
    let fixedHolsWorked = 0;
    const fixedHols = [];
    attendedDates.forEach(d => {
        const md = d.substring(5);
        if (FIXED_HOLIDAYS.find(f => f.date === md)) {
            fixedHolsWorked++;
            fixedHols.push(d);
        }
    });
    console.log("\nFixed Holidays worked:", fixedHolsWorked, fixedHols);
    
    // Check User Selected Holidays
    let userHolsWorked = 0;
    const userHols = [];
    (userHolidays || []).forEach(uh => {
        if (attendedDates.has(uh.holiday_date)) {
            userHolsWorked++;
            userHols.push(uh.holiday_date);
        }
    });
    console.log("\nUser Holidays worked:", userHolsWorked, userHols);

    console.log("\nSummary of dynamically earned Comp Offs:");
    console.log("Total:", sundaysWorked + fixedHolsWorked + userHolsWorked);
}

main();
