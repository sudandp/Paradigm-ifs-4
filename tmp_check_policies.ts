
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPolicies() {
    console.log('Checking policies for "entities" table...')
    const { data, error } = await supabase.rpc('get_policies', { table_name: 'entities' });
    
    if (error) {
        console.log('RPC get_policies not found. Checking via pg_policies...');
        const { data: policies, error: polError } = await supabase.from('pg_policies').select('*').eq('tablename', 'entities');
        if (polError) {
             // Try a direct SQL query via rpc if available
             const { data: sqlRes, error: sqlError } = await supabase.rpc('exec_sql', { sql: "SELECT * FROM pg_policies WHERE tablename = 'entities'" });
             if (sqlError) {
                 console.error('Could not fetch policies:', sqlError);
             } else {
                 console.log('Policies for entities:', sqlRes);
             }
        } else {
            console.log('Policies for entities:', policies);
        }
    } else {
        console.log('Policies for entities:', data);
    }
}

checkPolicies();
