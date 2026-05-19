import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
const supabase = createClient(supabaseUrl, supabaseKey)

const sql = `
CREATE TABLE IF NOT EXISTS public.site_staff_config_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ctc_per_month NUMERIC NOT NULL,
  weekly_offs_per_week NUMERIC NOT NULL,
  earned_leaves_per_annum INTEGER NOT NULL,
  nfh_per_annum INTEGER NOT NULL,
  nh_billing_config TEXT NOT NULL,
  nh_salary_config TEXT NOT NULL,
  shift TEXT NOT NULL,
  shift_hours INTEGER NOT NULL,
  per_day_billing_rate NUMERIC NOT NULL,
  rate_effective_date DATE NOT NULL,
  per_annum_rate NUMERIC NOT NULL,
  billable_duties_in_year NUMERIC NOT NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and add basic policies
ALTER TABLE public.site_staff_config_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read access to site_staff_config_logs" ON public.site_staff_config_logs;
CREATE POLICY "Allow authenticated read access to site_staff_config_logs" 
    ON public.site_staff_config_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert access to site_staff_config_logs" ON public.site_staff_config_logs;
CREATE POLICY "Allow authenticated insert access to site_staff_config_logs" 
    ON public.site_staff_config_logs FOR INSERT TO authenticated WITH CHECK (true);
`;

async function applyMigration() {
    console.log('Applying SQL migration to create site_staff_config_logs...');
    const { data, error } = await supabase.rpc('execute_sql', { sql });
    
    if (error) {
        console.error('Error applying migration via rpc:', error);
    } else {
        console.log('Migration applied successfully.');
    }
}

applyMigration();
