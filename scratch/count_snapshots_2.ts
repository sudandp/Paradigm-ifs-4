import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function countSnapshots() {
  for (const month of [1, 2, 3]) {
    const { count, error } = await supabase
      .from('attendance_month_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('year', 2026)
      .eq('month', month);

    if (error) {
      console.error(`Error counting snapshots for month ${month}:`, error);
    } else {
      console.log(`Total snapshots for Month ${month} / 2026: ${count}`);
    }
  }
}

countSnapshots();
