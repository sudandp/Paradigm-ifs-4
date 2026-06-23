import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function printLocations() {
  const { data: users, error } = await supabase
    .from('users')
    .select('name, role_id, location_id, society_name, organization_name')
    .limit(30);

  if (error) {
    console.error(error);
  } else {
    console.log('Sample Users:');
    users.forEach(u => {
      console.log(`Name: ${u.name}, Role: ${u.role_id}, LocID: ${u.location_id}, Society: ${u.society_name}, Org: ${u.organization_name}`);
    });
  }
}

printLocations();
