import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const snapshotId = '12d71a36-e683-4aab-bbb5-23986ffeedb2';

async function inspectDaily() {
  const { data, error } = await supabase
    .from('attendance_month_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Snapshot for May 2026 for Arpitha:`);
  console.log(`Daily data:`, JSON.stringify(data.daily_data, null, 2));
}

inspectDaily();
