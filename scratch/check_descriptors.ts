
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkDescriptors() {
  const { data, error } = await supabase
    .from('gate_users')
    .select('user_id, face_descriptor')
    .limit(5);

  if (error) {
    console.error('Error fetching gate users:', error);
    return;
  }

  data.forEach(user => {
    const desc = user.face_descriptor;
    console.log(`User: ${user.user_id}`);
    console.log(`Type: ${typeof desc}, IsArray: ${Array.isArray(desc)}`);
    if (desc) {
      const keys = Object.keys(desc);
      console.log(`Keys length: ${keys.length}`);
      if (Array.isArray(desc)) {
        console.log(`Array length: ${desc.length}`);
        console.log(`First 5: ${desc.slice(0, 5)}`);
      } else {
        console.log(`First 5 keys: ${keys.slice(0, 5)}`);
        console.log(`First value: ${desc[keys[0]]}`);
      }
    }
    console.log('---');
  });
}

checkDescriptors();
