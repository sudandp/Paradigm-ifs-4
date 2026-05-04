import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function test() {
  const { data, error } = await supabase.from('users').select('employee_code, name, organization_name').neq('role_id', 'unverified').limit(5);
  console.log('Error:', error);
  console.log('Data count:', data?.length);
  if (data?.length > 0) console.log(data[0]);
}
test();
