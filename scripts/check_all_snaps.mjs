import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const userId = '5321c6f6-578e-4168-9da8-060148e1587b';

async function checkAllSnapshots() {
  const { data: snaps, error } = await supabase.from('attendance_month_snapshots')
    .select('*')
    .eq('employee_id', userId);

  console.log('All snapshots for user:', snaps?.map(s => ({
    year: s.year,
    month: s.month,
    summary: s.summary,
    locked_at: s.locked_at
  })));
}

checkAllSnapshots().catch(console.error);
