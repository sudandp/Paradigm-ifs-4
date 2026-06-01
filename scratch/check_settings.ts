import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function run() {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 'singleton').maybeSingle();
  if (error) {
    console.error("Error reading settings:", error);
    return;
  }
  console.log("Settings data:", JSON.stringify(data, null, 2));
}

run();
