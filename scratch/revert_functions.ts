import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase URL or Service Role Key is missing!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
-- Revert RLS helper functions back to SECURITY DEFINER
-- This fixes the 'permission denied for function' errors when non-admins invoke RLS policies.
ALTER FUNCTION public.check_is_admin() SECURITY DEFINER;
ALTER FUNCTION public.check_is_manager_or_above() SECURITY DEFINER;

-- Let's also check and revert others if they exist
DO $$
BEGIN
    BEGIN
        ALTER FUNCTION public.get_my_claim() SECURITY DEFINER;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Function get_my_claim not found or could not be altered';
    END;

    BEGIN
        ALTER FUNCTION public.get_my_role() SECURITY DEFINER;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Function get_my_role not found or could not be altered';
    END;

    BEGIN
        ALTER FUNCTION public.get_my_role_id() SECURITY DEFINER;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Function get_my_role_id not found or could not be altered';
    END;

    BEGIN
        ALTER FUNCTION public.has_role(text) SECURITY DEFINER;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Function has_role not found or could not be altered';
    END;
END $$;
`;

async function applyFix() {
  console.log('Altering SQL functions check_is_admin / check_is_manager_or_above to SECURITY DEFINER...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    console.error('Error executing SQL via RPC:', error);
  } else {
    console.log('SQL functions reverted to SECURITY DEFINER successfully.');
  }
}

applyFix();
