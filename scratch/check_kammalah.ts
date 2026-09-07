import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function test() {
  const { data: users } = await supabase.from('users').select('id, name, location_id, organization_name, society_id, society_name').or('name.ilike.%Bhimau%,name.ilike.%Yogesh%');
  console.log('Users:', users);
}
test().catch(console.error);
