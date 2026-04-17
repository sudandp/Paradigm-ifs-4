import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSmtpConfig() {
  console.log('Checking SMTP configuration...');
  const { data, error } = await supabase
    .from('settings')
    .select('email_config')
    .eq('id', 'singleton')
    .maybeSingle();

  if (error) {
    console.error('Error fetching settings:', error);
    return;
  }

  const config = data?.email_config;
  if (!config) {
    console.log('No email_config found in settings.');
    return;
  }

  console.log('SMTP Config:');
  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  User: ${config.user}`);
  console.log(`  Pass: ${config.pass ? '****' + config.pass.slice(-3) : 'NOT SET'}`);
  console.log(`  From Email: ${config.from_email}`);
  console.log(`  From Name: ${config.from_name}`);
}

checkSmtpConfig();
