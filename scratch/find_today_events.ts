import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTodayEvents() {
  const { data, error } = await supabase
    .from('attendance_events')
    .select('id, user_id, timestamp, type, device_name, device_id')
    .gte('timestamp', '2026-05-07T00:00:00Z')
    .lte('timestamp', '2026-05-07T23:59:59Z');

  if (error) {
    console.error('Error fetching today events:', error);
  } else {
    console.log('Today Events fetched:', data);
  }
}

checkTodayEvents();
