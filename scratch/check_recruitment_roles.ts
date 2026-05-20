import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const { data, error } = await supabase.from('roles').select('id, display_name');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('All Roles:', data);
    console.log('Filtered recruitment:', data?.filter(r => r.id.toLowerCase().includes('recruitment')));
    console.log('Filtered double underscores:', data?.filter(r => r.id.includes('__')));
  }
}

check();
