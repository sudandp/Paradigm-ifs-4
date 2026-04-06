
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: 'e:/backup/onboarding all files/Paradigm Office 4/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey || '');

async function checkColumns() {
    const { data: cols, error: colError } = await supabase.from('entities').select('*').limit(1);
    if (colError) {
      console.error('Error fetching columns:', colError);
    } else if (cols && cols.length > 0) {
      console.log('Columns in entities table:', Object.keys(cols[0]));
    } else {
      console.log('No data in entities table to check columns.');
    }
}

checkColumns();
