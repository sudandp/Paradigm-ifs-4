import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function test() {
  const { data, error } = await supabase.from('users')
    .select(`
      id,
      name,
      email,
      society_id,
      society_name,
      location_id,
      role:roles(display_name),
      companies!users_society_id_fkey(location)
    `)
    .eq('email', 'yuvanaidu00@gmail.com')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

test();
