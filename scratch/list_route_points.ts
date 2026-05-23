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
  const userId = '3535b1fa-8055-4d91-b832-3cf492045033';
  const { data: route } = await supabase
    .from('route_history')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', '2026-05-23T00:00:00Z')
    .lte('timestamp', '2026-05-23T23:59:59Z')
    .order('timestamp', { ascending: true });

  if (route) {
    console.log("All route points:");
    route.forEach((p, idx) => console.log(`  Point ${idx + 1}: ${p.latitude}, ${p.longitude} at ${p.timestamp}`));
  }
}

test();
