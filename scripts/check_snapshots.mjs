import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'e:/backup/onboarding all files/Paradigm Office 4/.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = '5321c6f6-578e-4168-9da8-060148e1587b';

async function checkSnapshotsAndDays() {
  const { data: snaps } = await supabase.from('attendance_month_snapshots')
    .select('year, month, summary, total_payable_days')
    .eq('user_id', userId)
    .eq('year', 2026)
    .order('month', { ascending: true });

  console.log('2026 Snapshots count:', snaps ? snaps.length : 0);
  let totalPayableFromSnaps = 0;
  snaps?.forEach(s => {
    const paydays = s.summary?.totalPayableDays ?? s.total_payable_days ?? s.summary?.present ?? 0;
    totalPayableFromSnaps += paydays;
    console.log('Month ' + s.month + ': paydays = ' + paydays);
  });
  console.log('Total paydays from Jan-Aug snapshots:', totalPayableFromSnaps);
}
checkSnapshotsAndDays();
