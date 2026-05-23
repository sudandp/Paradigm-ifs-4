import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function test() {
  const { data, error } = await supabase
    .from('attendance_events')
    .select('type');
    
  if (error) {
    console.error(error);
    return;
  }
  
  const types = new Set(data.map(d => d.type));
  console.log("Distinct event types in DB:", Array.from(types));
}

test();
