const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data: templates, error } = await supabase.from('email_templates').select('id, name, body_template');
  if (error) {
    console.error(error);
    return;
  }
  for (const t of templates) {
    if (t.id === '50d7d5f8-e777-4a3c-89d1-5f7d29427d5b') {
      const idx = t.body_template.indexOf('<table');
      console.log('TABLE TAG:', t.body_template.slice(idx, idx + 350));
    }
  }
}

check();
