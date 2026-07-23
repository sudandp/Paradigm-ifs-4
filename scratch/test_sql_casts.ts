import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkTypes() {
  try {
    const { data, error } = await supabase.rpc('check_user_role', { target_roles: ['admin'] });
    console.log('check_user_role test:', error ? error.message : `OK (data: ${data})`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log('check_user_role test exception:', message);
  }
}

checkTypes().catch(console.error);

