import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  const { data: org, error: err1 } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', 'group_1774003567612')
    .single();
    
  if (err1) {
    console.error('Org Error:', err1.message);
  } else {
    console.log('Organization:', JSON.stringify(org, null, 2));
  }

  const { data: loc, error: err2 } = await supabase
    .from('locations')
    .select('*')
    .eq('id', 'group_1774003567612')
    .single();

  if (err2) {
    console.error('Loc Error:', err2.message);
  } else {
    console.log('Location:', JSON.stringify(loc, null, 2));
  }
}

check();
