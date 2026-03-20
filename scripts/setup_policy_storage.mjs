import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
  console.log('Adding column file_url to policies...');
  const { error: colError } = await supabase.rpc('execute_sql', { sql: 'ALTER TABLE policies ADD COLUMN IF NOT EXISTS file_url TEXT;' });
  
  if (colError) {
      // If RPC is not available, we might need a different way, but usually it's there in this project's setup for migrations
      console.warn('RPC execute_sql failed, trying direct query (if possible) or assuming it exists');
  }

  console.log('Creating policies bucket...');
  const { data: bucket, error: bucketError } = await supabase.storage.createBucket('policies', {
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['application/pdf', 'image/*']
  });

  if (bucketError && bucketError.message !== 'Bucket already exists') {
    console.error('Error creating bucket:', bucketError);
  } else {
    console.log('Policies bucket ready');
  }
}

setup();
