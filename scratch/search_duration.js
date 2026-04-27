
const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://vofpkmscisxpxxskalms.supabase.co', 'SERVICE_ROLE_KEY'); // I need the actual key

async function run() {
  const { data: templates } = await s.from('email_templates').select('*');
  templates.forEach(t => {
    if (t.body_template && t.body_template.includes('Duration')) {
      console.log('FOUND IN TEMPLATE:', t.name, t.id);
      console.log(t.body_template);
    }
  });
}
run();
