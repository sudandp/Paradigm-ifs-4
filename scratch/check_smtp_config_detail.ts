import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSmtpConfigDetail() {
  const { data } = await supabase
    .from('settings')
    .select('email_config')
    .eq('id', 'singleton')
    .maybeSingle();

  console.log('Full Email Config:', JSON.stringify(data?.email_config, null, 2));
}

checkSmtpConfigDetail();
