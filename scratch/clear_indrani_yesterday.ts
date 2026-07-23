import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, serviceKey);

async function clearYesterdayLog() {
  const userId = '5f616bcd-47b9-4806-9c2a-b4ce0c123825';
  const startIso = '2026-07-21T18:30:00.000Z'; // 2026-07-22 00:00:00 IST
  const endIso = '2026-07-22T18:30:00.000Z';   // 2026-07-22 23:59:59 IST

  console.log('=== CLEARING YESTERDAY (2026-07-22) ATTENDANCE LOGS FOR INDRANI ===');

  // 1. Fetch events to delete
  const { data: toDelete, error: fetchErr } = await supabase
    .from('attendance_events')
    .select('id, timestamp, type')
    .eq('user_id', userId)
    .gte('timestamp', startIso)
    .lte('timestamp', endIso);

  if (fetchErr) {
    console.error('Error fetching records:', fetchErr);
    return;
  }

  console.log('Found records to clear:', toDelete);

  if (!toDelete || toDelete.length === 0) {
    console.log('No records found to delete for 2026-07-22.');
  } else {
    const ids = toDelete.map(r => r.id);
    const { data: deleted, error: deleteErr } = await supabase
      .from('attendance_events')
      .delete()
      .in('id', ids)
      .select();

    if (deleteErr) {
      console.error('Error deleting records:', deleteErr);
    } else {
      console.log('Successfully deleted records:', deleted);
    }
  }

  // 2. Also check and clear any attendance summary row for date 2026-07-22 if exists
  const { data: attSummary } = await supabase
    .from('attendance')
    .select('id')
    .eq('user_id', userId)
    .eq('date', '2026-07-22');

  if (attSummary && attSummary.length > 0) {
    const attIds = attSummary.map(a => a.id);
    const { error: attDeleteErr } = await supabase
      .from('attendance')
      .delete()
      .in('id', attIds);
    if (!attDeleteErr) {
      console.log(`Deleted ${attSummary.length} attendance summary record(s) for 2026-07-22.`);
    }
  }

  // 3. Final Verification
  const { data: finalEvents } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', startIso)
    .lte('timestamp', endIso);

  console.log('\n--- VERIFICATION RESULT ---');
  console.log('Remaining attendance_events for 2026-07-22 IST:', finalEvents?.length || 0);
}

clearYesterdayLog().catch(console.error);
