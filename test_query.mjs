import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const getEnv = (file) => {
  if (!existsSync(file)) return {};
  const content = readFileSync(file, 'utf8');
  return content.split('\n').reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val.length) {
      let v = val.join('=');
      if (v.startsWith('"') && v.endsWith('"')) {
        v = v.slice(1, -1);
      }
      acc[key.trim()] = v.trim();
    }
    return acc;
  }, {});
};

const env = { ...getEnv('.env'), ...getEnv('.env.local') };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing URL or KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('user_vehicles').select('id, odometer_picture_url');
  console.log("DATA:", JSON.stringify(data, null, 2));
  console.log("ERROR:", error);
}

check();
