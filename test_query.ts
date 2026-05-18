import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function test() {
  const { data, error } = await supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single();
  console.log('Error:', error);
  console.log('Settings:', JSON.stringify(data?.attendance_settings, null, 2));
}
test();
