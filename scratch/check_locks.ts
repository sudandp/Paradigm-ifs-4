import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function test() {
  const { data: locks, error: lockErr } = await supabase.from('monthly_attendance_locks').select('*');
  console.log('Locks:', locks, 'Lock error:', lockErr);
  const { count, error: countErr } = await supabase.from('month_attendance_snapshots').select('*', { count: 'exact', head: true });
  console.log('Total snapshots in DB:', count, 'Count error:', countErr);
  const { data: augSnaps } = await supabase.from('month_attendance_snapshots').select('employee_id, daily_data, summary').eq('year', 2026).eq('month', 8).limit(5);
  console.log('Aug 2026 snapshots count sample:', augSnaps?.length);
  if (augSnaps && augSnaps.length > 0) {
    console.log('First snap employee_id:', augSnaps[0].employee_id);
    console.log('First snap summary:', augSnaps[0].summary);
    console.log('First snap daily_data sample (first 3 days):', augSnaps[0].daily_data?.slice(0, 3));
  }
  // Check if Arpitha Nair has a snapshot!
  const { data: arpitha } = await supabase.from('users').select('id, name').ilike('name', '%Arpitha%').single();
  if (arpitha) {
    const { data: arpithaSnap } = await supabase.from('month_attendance_snapshots').select('*').eq('employee_id', arpitha.id).eq('year', 2026).eq('month', 8).maybeSingle();
    console.log('Arpitha snap exists?', !!arpithaSnap);
    if (arpithaSnap) {
        console.log('Arpitha snap daily_data statuses (first 10):', arpithaSnap.daily_data?.slice(0, 10).map((d: any) => d.status));
    }
  }
}
test().catch(console.error);
