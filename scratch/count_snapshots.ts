import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function countSnapshots() {
  const { count, error } = await supabase
    .from('attendance_month_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('year', 2026)
    .eq('month', 5);

  if (error) {
    console.error('Error counting snapshots:', error);
    return;
  }

  console.log(`Total snapshots for May 2026: ${count}`);

  const { count: countApril, error: errorApril } = await supabase
    .from('attendance_month_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('year', 2026)
    .eq('month', 4);

  if (errorApril) {
    console.error('Error counting April snapshots:', errorApril);
    return;
  }

  console.log(`Total snapshots for April 2026: ${countApril}`);
}

countSnapshots();
