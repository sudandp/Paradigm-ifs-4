import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.rpc('get_attendance_summary', {
    p_start: '2026-06-01',
    p_end: '2026-06-03'
  });
  if (error) console.error('Supabase Error:', error);
  else console.log('Success:', data);
}
test();
