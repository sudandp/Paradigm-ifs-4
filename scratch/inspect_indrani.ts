import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, serviceKey);

async function inspectIndraniJuly21to23() {
  const userId = '5f616bcd-47b9-4806-9c2a-b4ce0c123825';
  
  console.log('--- ALL ATTENDANCE RECORDS FOR INDRANI ---');
  const { data: attData } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  console.log('Attendance Records (Top 10):');
  console.log(attData?.slice(0, 10));

  console.log('\n--- ALL ATTENDANCE EVENTS FOR INDRANI (RECENT) ---');
  const { data: attEvents } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(20);
  console.log(attEvents);

  console.log('\n--- ROUTE HISTORY (RECENT) ---');
  const { data: routes } = await supabase
    .from('route_history')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(10);
  console.log(routes);
}

inspectIndraniJuly21to23().catch(console.error);
