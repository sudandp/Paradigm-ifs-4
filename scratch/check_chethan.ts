import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('name', '%Chethan%');
    
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Chethan V User Data:', JSON.stringify(data, null, 2));
  }
}

check();
