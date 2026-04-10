import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, biometric_id, biometric_name');
  if (error) console.error(error);
  
  // Try finding by name (case insensitive)
  const ganeshas = data.filter(u => 
    (u.name && u.name.toLowerCase().includes('ganesha')) || 
    (u.biometric_name && u.biometric_name.toLowerCase().includes('ganesha'))
  );
  
  console.log(JSON.stringify(ganeshas, null, 2));
}

main();
