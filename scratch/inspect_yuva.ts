import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function inspect() {
  const { data: cols, error } = await supabase
    .rpc('get_table_columns', { table_name: 'users' }); // Or direct SQL if we don't have rpc

  // Fallback: query a single user with select('*') and get keys
  const { data: user } = await supabase.from('users').select('*').limit(1).single();

  console.log('User keys:', Object.keys(user || {}));
}

inspect();
