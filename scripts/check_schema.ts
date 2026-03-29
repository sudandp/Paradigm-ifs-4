import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

(async () => {
  const { data, error } = await supabase.from('email_templates').select('*').limit(1);
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error(error);
})();
