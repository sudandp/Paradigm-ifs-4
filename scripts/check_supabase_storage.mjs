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

async function checkStorage() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error listing buckets:', error);
  } else {
    console.log('Available buckets:', buckets.map(b => b.name));
  }
}

async function checkPolicyTable() {
  const { data, error } = await supabase.from('policies').select('*').limit(1);
  if (error) {
    console.error('Error checking policies table:', error);
  } else {
    console.log('Policies table structure (first record):', data[0] || 'No records found');
  }
}

async function run() {
  await checkStorage();
  await checkPolicyTable();
}

run();
