import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  console.log('Fetching distinct role_ids...');
  const { data, error } = await supabase.from('users').select('role_id');
  if (error) {
    console.error('Error:', error);
  } else {
    const roleCounts: Record<string, number> = {};
    data.forEach((r: any) => {
      roleCounts[r.role_id] = (roleCounts[r.role_id] || 0) + 1;
    });
    console.log('Role counts:', roleCounts);
  }
}

check().catch(console.error);
