import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function clearFaces() {
  const { data, error } = await supabase
    .from('gate_users')
    .update({ face_descriptor: null })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('Error clearing face descriptors:', error);
  } else {
    console.log('Successfully cleared face descriptors for all users.');
  }
}

clearFaces();
