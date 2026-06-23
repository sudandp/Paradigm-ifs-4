import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function findGroup() {
  // Query all tables to see where this ID might exist
  const { data: tables, error } = await supabase.rpc('get_tables'); // standard helper if exists, otherwise we'll query organizations or groups
  
  // Let's query organization_groups first
  const { data: orgGroups, error: err1 } = await supabase.from('organization_groups').select('*');
  console.log('Org Groups count:', orgGroups?.length);
  console.log('Org Groups:', orgGroups?.slice(0, 10));

  // Let's check if there is an organization_groups record matching group_1774003567612
  const group = orgGroups?.find(g => g.id === 'group_1774003567612');
  console.log('Matched Group:', group);
}

findGroup();
