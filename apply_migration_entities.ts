
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
const supabase = createClient(supabaseUrl, supabaseKey)

const sql = `
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'e_shram_number') THEN
        ALTER TABLE public.entities ADD COLUMN e_shram_number text;
    END IF;
    
    -- Ensure doc URL columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'cin_number') THEN ALTER TABLE public.entities ADD COLUMN cin_number text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'cin_doc_url') THEN ALTER TABLE public.entities ADD COLUMN cin_doc_url text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'din_number') THEN ALTER TABLE public.entities ADD COLUMN din_number text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'din_doc_url') THEN ALTER TABLE public.entities ADD COLUMN din_doc_url text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'tin_number') THEN ALTER TABLE public.entities ADD COLUMN tin_number text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'tin_doc_url') THEN ALTER TABLE public.entities ADD COLUMN tin_doc_url text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'udyog_number') THEN ALTER TABLE public.entities ADD COLUMN udyog_number text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'udyog_doc_url') THEN ALTER TABLE public.entities ADD COLUMN udyog_doc_url text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'epfo_doc_url') THEN ALTER TABLE public.entities ADD COLUMN epfo_doc_url text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'esic_doc_url') THEN ALTER TABLE public.entities ADD COLUMN esic_doc_url text; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'e_shram_doc_url') THEN ALTER TABLE public.entities ADD COLUMN e_shram_doc_url text; END IF;
END $$;
`;

async function applyMigration() {
    console.log('Applying SQL migration to entities table...');
    // Note: This requires the exec_sql function to exist on your Supabase project.
    // If it doesn't, you may need to run this manually in the Supabase SQL editor.
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
        console.error('Error applying migration via rpc:', error);
        console.log('Fallback: If rpc exec_sql is not available, please run the SQL manually in Supabase SQL editor.');
    } else {
        console.log('Migration applied successfully.');
    }
}

applyMigration();
