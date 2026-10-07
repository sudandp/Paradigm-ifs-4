const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: templates, error } = await supabase.from('email_templates').select('id, name, body_template');
  if (error) {
    console.error('Error fetching templates:', error);
    return;
  }

  for (const t of templates) {
    if ((t.name || '').toLowerCase().includes('bd')) {
      let body = t.body_template || '';
      let changed = false;

      if (body.includes('<table align="center"') || body.includes('margin:0 auto;')) {
        body = body.replace(/<table([^>]*?)align=["']?center["']?/gi, '<table$1align="left"')
                   .replace(/margin:\s*0\s+auto;/gi, 'margin:0 0 24px 0;');
        changed = true;
      }

      if (changed) {
        const { error: upErr } = await supabase
          .from('email_templates')
          .update({ body_template: body, updated_at: new Date().toISOString() })
          .eq('id', t.id);

        if (upErr) {
          console.error(`Error updating template ${t.name} (${t.id}):`, upErr);
        } else {
          console.log(`Successfully updated BD template ${t.name} (${t.id}) to align="left"`);
        }
      } else {
        console.log(`Template ${t.name} (${t.id}) already left-aligned.`);
      }
    }
  }
}

run();
