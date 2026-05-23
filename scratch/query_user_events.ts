import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const userId = '3535b1fa-8055-4d91-b832-3cf492045033';
  console.log(`Fetching attendance events for ID: ${userId} on 2026-05-23:`);
  
  const { data: events, error: eventsErr } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', '2026-05-23T00:00:00Z')
    .lte('timestamp', '2026-05-23T23:59:59Z')
    .order('timestamp', { ascending: true });

  if (eventsErr) {
    console.error("Error fetching events:", eventsErr);
  } else {
    console.log("Events:", events);
  }

  console.log(`Fetching route history for ID: ${userId} on 2026-05-23:`);
  const { data: route, error: routeErr } = await supabase
    .from('route_history')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', '2026-05-23T00:00:00Z')
    .lte('timestamp', '2026-05-23T23:59:59Z')
    .order('timestamp', { ascending: true });

  if (routeErr) {
    console.error("Error fetching route:", routeErr);
  } else {
    console.log("Route history length:", route?.length);
    if (route && route.length > 0) {
      console.log("First 3 route points:", route.slice(0, 3));
      console.log("Last 3 route points:", route.slice(-3));
    }
  }
}

check();
