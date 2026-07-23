import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, serviceKey);

async function checkYesterdayLogsFullIST() {
  const userId = '5f616bcd-47b9-4806-9c2a-b4ce0c123825';

  console.log('=== CHECKING LOGS FOR INDRANI FOR FULL IST DAY 2026-07-22 ===');

  // IST July 22 00:00:00 to 23:59:59 is 2026-07-21T18:30:00.000Z to 2026-07-22T18:30:00.000Z
  const startIso = '2026-07-21T18:30:00.000Z';
  const endIso = '2026-07-22T18:30:00.000Z';

  // 1. attendance_events
  const { data: events } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', startIso)
    .lte('timestamp', endIso);
  console.log('attendance_events (2026-07-22 IST):', events);

  // 2. attendance table
  const { data: att } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .gte('date', '2026-07-21')
    .lte('date', '2026-07-23');
  console.log('attendance table records around 2026-07-22:', att);

  // 3. site_attendance
  const { data: siteAtt } = await supabase
    .from('site_attendance')
    .select('*')
    .eq('user_id', userId)
    .gte('date', '2026-07-21')
    .lte('date', '2026-07-23');
  console.log('site_attendance records around 2026-07-22:', siteAtt);
}

checkYesterdayLogsFullIST().catch(console.error);
