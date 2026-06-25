import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === 'object') {
    const n: any = {};
    Object.keys(obj).forEach(k => {
      const camel = k.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      n[camel] = toCamelCase(obj[k]);
    });
    return n;
  }
  return obj;
}

async function main() {
    const { data: settings } = await supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single();
    const camelSettings = toCamelCase(settings?.attendance_settings || {});
    console.log(JSON.stringify(camelSettings, null, 2));
}

main();
