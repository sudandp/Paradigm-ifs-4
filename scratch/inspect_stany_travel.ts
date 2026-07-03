import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  try {
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'route_history');

    if (error) {
      // If we can't query pg_policies via standard table client, try using a raw query or information_schema
      console.error('Error querying pg_policies:', error);
      return;
    }

    console.log(`Policies for route_history: ${policies?.length}`);
    console.log(JSON.stringify(policies, null, 2));

  } catch (error) {
    console.error(error);
  }
}

main();
