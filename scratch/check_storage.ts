
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Bucket list error:', error);
  } else {
    console.log('Buckets:', data.map(b => b.name));
    
    for (const bucket of data) {
        console.log(`\nFiles in ${bucket.name}:`);
        const { data: files, error: fileError } = await supabase.storage.from(bucket.name).list('documents', { limit: 10 });
        if (fileError) console.error(`Error listing ${bucket.name}:`, fileError.message);
        else console.log(files.map(f => f.name));
    }
  }
}

check();
