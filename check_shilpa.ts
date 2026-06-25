import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { format } from 'date-fns';
import { calculateWorkingHours, getStaffCategory } from './utils/attendanceCalculations';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function main() {
    const userId = '94a4f34e-f4d0-42d5-b2c5-7b43419a3325';
    
    // Fetch user
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    console.log("User:", user.name, "Gender:", user.gender, "Role ID:", user.role_id);
    
    // Fetch settings
    const { data: settings } = await supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single();
    const camelSettings = settings ? settings.attendance_settings : {};
    
    // Fetch events
    const { data: events } = await supabase
        .from('attendance_events')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', '2026-01-01T00:00:00')
        .lte('timestamp', '2026-01-31T23:59:59')
        .order('timestamp', { ascending: true });
        
    console.log("Total events fetched:", events?.length);
    
    // Group events by date
    const eventsByDay: Record<string, any[]> = {};
    (events || []).forEach(e => {
        // Just extract YYYY-MM-DD from timestamp
        const dateStr = format(new Date(e.timestamp), 'yyyy-MM-dd');
        if (!eventsByDay[dateStr]) eventsByDay[dateStr] = [];
        eventsByDay[dateStr].push(e);
    });
    
    console.log("--- Daily working hours in Jan 2026 ---");
    for (const [dateStr, dayEvents] of Object.entries(eventsByDay)) {
        const { workingHours } = calculateWorkingHours(dayEvents, new Date(dateStr));
        console.log(`${dateStr}: eventsCount=${dayEvents.length}, workingHours=${workingHours}`);
    }
}

main();
