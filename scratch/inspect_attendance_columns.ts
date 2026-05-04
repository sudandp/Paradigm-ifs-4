
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectAttendanceEventsTable() {
  const { data, error } = await supabase.from('attendance_events').select('*').limit(1);
  if (error) {
    console.error('Error fetching attendance event:', error);
  } else {
    console.log('Attendance Event columns:', Object.keys(data[0] || {}));
  }
}

inspectAttendanceEventsTable();
