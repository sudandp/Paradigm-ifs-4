
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co'
// Using the service_role key already present in the project's utility scripts
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
const supabase = createClient(supabaseUrl, supabaseKey)

const sql = `
-- Drop existing view-only admin policy
DROP POLICY IF EXISTS "Admins can view all holiday selections" ON public.user_holidays;
DROP POLICY IF EXISTS "Admins and HR can manage all holiday selections" ON public.user_holidays;

-- Create a comprehensive management policy for Admins and HR
CREATE POLICY "Admins and HR can manage all holiday selections"
    ON public.user_holidays FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role_id IN ('admin', 'hr', 'super_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role_id IN ('admin', 'hr', 'super_admin')
        )
    );
`;

async function applyMigration() {
    console.log('Applying SQL migration to user_holidays RLS...');
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
        console.error('Error applying migration via rpc:', error);
    } else {
        console.log('Migration applied successfully.');
    }
}

applyMigration();
