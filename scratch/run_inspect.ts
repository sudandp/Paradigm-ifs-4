import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const sql = `
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('notifications', 'security_audit_logs');
`;

async function main() {
    const strategies = [
        { name: 'exec_sql', params: { sql } },
        { name: 'exec_sql', params: { sql_query: sql } },
        { name: 'exec_sql', params: { query: sql } },
        { name: 'execute_sql', params: { sql } },
        { name: 'execute_sql', params: { sql_query: sql } },
        { name: 'run_sql', params: { sql } },
        { name: 'run_sql', params: { sql_query: sql } },
    ];
    
    for (const strategy of strategies) {
        try {
            const { data, error } = await supabase.rpc(strategy.name, strategy.params);
            if (error) {
                console.log(`RPC ${strategy.name} with ${Object.keys(strategy.params)[0]} failed: ${error.message}`);
            } else {
                console.log(`RPC ${strategy.name} with ${Object.keys(strategy.params)[0]} SUCCEEDED:`, data);
                return;
            }
        } catch (err: any) {
            console.log(`RPC ${strategy.name} exception: ${err.message}`);
        }
    }
}

main().catch(console.error);
