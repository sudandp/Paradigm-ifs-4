import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'singleton')
    .single();

  if (error) {
    console.error('Error fetching settings:', error);
    return;
  }

  console.log('Settings singleton details:');
  console.log(JSON.stringify(data, null, 2));
}

main();
