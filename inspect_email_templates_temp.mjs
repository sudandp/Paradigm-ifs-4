import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const getEnv = (file) => {
  if (!existsSync(file)) return {};
  const content = readFileSync(file, 'utf8');
  return content.split('\n').reduce((acc, line) => {
    const cleanLine = line.replace(/\r$/, '').trim();
    if (!cleanLine || cleanLine.startsWith('#')) return acc;
    const [key, ...val] = cleanLine.split('=');
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
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function check() {
  const { data: template } = await supabase.from('email_templates').select('body_template').eq('id', '0893f101-b400-4986-a3b7-c3128df1bddf').single();
  console.log("BODY TEMPLATE FOR MONTHLY ATTENDANCE REPORT:");
  console.log(template?.body_template);
}

check();
