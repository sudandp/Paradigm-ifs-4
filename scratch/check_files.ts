
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  const bucket = 'onboarding-documents';
  const folder = 'documents/5321c6f6-578e-4168-9da8-060148e1587b';
  
  console.log(`Listing files in ${bucket}/${folder}:`);
  const { data, error } = await supabase.storage.from(bucket).list(folder);
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log(JSON.stringify(data, null, 2));
    
    // Check if there are subfolders (timestamp folders)
    for (const item of data) {
        if (!item.id) { // likely a folder
            console.log(`\nListing files in ${bucket}/${folder}/${item.name}:`);
            const { data: subData, error: subError } = await supabase.storage.from(bucket).list(`${folder}/${item.name}`);
            if (subError) console.error('Error:', subError.message);
            else console.log(JSON.stringify(subData, null, 2));
        }
    }
  }
}

check();
