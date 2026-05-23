import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function test() {
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', '%Madhu%');
    
  if (userErr) {
    console.error(userErr);
    return;
  }
  
  console.log("Users found:", users);
  
  if (users && users.length > 0) {
    const userId = users[0].id;
    const todayStr = '2026-05-23';
    
    const { data: events } = await supabase
      .from('attendance_events')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', `${todayStr}T00:00:00Z`)
      .lte('timestamp', `${todayStr}T23:59:59Z`)
      .order('timestamp', { ascending: true });
      
    console.log(`Events for ${users[0].name}:`, events);
    
    const { data: route } = await supabase
      .from('route_history')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', `${todayStr}T00:00:00Z`)
      .lte('timestamp', `${todayStr}T23:59:59Z`)
      .order('timestamp', { ascending: true });
      
    console.log(`Route history length: ${route?.length}`);
    if (route && route.length > 0) {
      console.log("Route history points:", route.map(r => `${r.latitude}, ${r.longitude} at ${r.timestamp}`));
    }
  }
}

test();
