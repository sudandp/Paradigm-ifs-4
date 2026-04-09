
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Manual env parsing
const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`${key}\\s*=\\s*"?([^"\\n\\r]+)"?`));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('--- Inspecting User Photos ---');
  // Find users with photo_url
  const { data: users, error } = await supabase.from('users').select('id, name, photo_url').not('photo_url', 'is', null).limit(10);
  
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  if (!users || users.length === 0) {
    console.log('No users found with a photo_url');
    // Try to find ANY user to see the column type/existence
    const { data: anyUsers } = await supabase.from('users').select('*').limit(1);
    console.log('Sample user record keys:', anyUsers?.[0] ? Object.keys(anyUsers[0]) : 'No users found at all');
    return;
  }
  
  users.forEach(u => {
    console.log(`User: ${u.name} (${u.id})`);
    console.log(`Photo URL type: ${typeof u.photo_url}`);
    console.log(`Photo URL value:`, u.photo_url);
    if (typeof u.photo_url === 'object') {
       console.log(`Photo URL object keys: ${Object.keys(u.photo_url)}`);
    }
    console.log('---');
  });
}

run();
