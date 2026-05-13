import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data } = await supabase.from('gate_users').select('*');
  if (data) {
    for (const u of data) {
      if (u.face_descriptor && Array.isArray(u.face_descriptor)) {
        let sumSq = 0;
        for (const x of u.face_descriptor) sumSq += x * x;
        console.log(`User ${u.id} - Magnitude: ${Math.sqrt(sumSq)}`);
        console.log(`User ${u.id} - First 3: ${u.face_descriptor.slice(0, 3)}`);
      }
    }
  }
}

check();
