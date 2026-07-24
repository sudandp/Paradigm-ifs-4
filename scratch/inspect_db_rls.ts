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

async function tryRPC(name: string, params: any): Promise<any> {
    try {
        const { data, error } = await supabase.rpc(name, params);
        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true, data };
    } catch (err: any) {
        return { success: false, error: err.message || err };
    }
}

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
    
    let result: any = null;
    for (const strategy of strategies) {
        const res = await tryRPC(strategy.name, strategy.params);
        if (res.success) {
            result = res.data;
            console.log(`RPC ${strategy.name} succeeded!`);
            break;
        }
    }
    
    if (result) {
        console.log("POLICIES FOUND:");
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.error("All SQL RPC attempts failed.");
    }
}

main().catch(console.error);
