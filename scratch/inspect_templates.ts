
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectTemplates() {
  console.log("--- Inspecting Email Templates ---");
  const { data: templates, error } = await supabase
    .from('email_templates')
    .select('*');
  
  if (error) {
    console.error("Error:", error);
    return;
  }

  templates.forEach(t => {
    console.log(`\nTemplate: ${t.name}`);
    console.log(`ID: ${t.id}`);
    console.log(`Body Template Length: ${t.body_template?.length || 0}`);
    console.log(`Body Snippet: ${t.body_template?.substring(0, 500)}...`);
  });
}

inspectTemplates();
