import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function printSocieties() {
  const { data, error } = await supabase.from('users').select('society_name, organization_name');
  if (error) {
    console.error(error);
  } else {
    const societies = Array.from(new Set((data || []).map(u => u.society_name).filter(Boolean)));
    const orgs = Array.from(new Set((data || []).map(u => u.organization_name).filter(Boolean)));
    console.log('Unique Society Names:', societies);
    console.log('Unique Org Names:', orgs);
  }
}

printSocieties();
