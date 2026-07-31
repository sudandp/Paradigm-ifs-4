const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\r').join('').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').replace(/^"|"$/g, '').trim();
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const url = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function run() {
  const { data: settings, error: fetchErr } = await supabase.from('attendance_settings').select('*');
  console.log("CURRENT SETTINGS:", JSON.stringify(settings, null, 2));

  if (settings && settings.length > 0) {
    for (const s of settings) {
      let rules = s.rules || s.office_rules || {};
      if (typeof rules === 'object') {
        rules.maxPermissionDurationHours = 3;
      }
      const updatePayload = { rules };
      if (s.office_rules) updatePayload.office_rules = rules;
      if (s.field_rules) {
        s.field_rules.maxPermissionDurationHours = 3;
        updatePayload.field_rules = s.field_rules;
      }
      
      const { error: updErr } = await supabase
        .from('attendance_settings')
        .update(updatePayload)
        .eq('id', s.id);
      console.log(`Updated setting ID ${s.id}:`, updErr);
    }
  }
}

run();
