import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
const supabase = createClient(supabaseUrl, supabaseKey)

const sql = `
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS voip_settings jsonb DEFAULT '{}'::jsonb;
`

async function applyMigration() {
    console.log('Applying SQL migration to settings table...');
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
        console.error('Error applying migration via rpc:', error);
    } else {
        console.log('Migration applied successfully:', data);
    }
}

applyMigration();
