import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

(async () => {
  console.log(`URL: ${process.env.VITE_SUPABASE_URL}`);
  console.log(`Key length: ${process.env.VITE_SUPABASE_ANON_KEY?.length}`);
  
  const { count: rulesCount } = await supabase.from('email_schedule_rules').select('*', { count: 'exact', head: true });
  console.log(`Actual total rules (including inactive): ${rulesCount}`);
  
  const { data: allRules } = await supabase.from('email_schedule_rules').select('id, name, is_active');
  console.log('All rules:', JSON.stringify(allRules, null, 2));
})();
