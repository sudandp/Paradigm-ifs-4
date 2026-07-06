import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("=== Fetching Columns ===");
    const { data: columns, error: colError } = await supabase
        .from('information_schema_columns' as any) // we can do RPC or direct raw SQL via a query on pg_catalog or information_schema.columns if we have permissions, or just do a standard query.
        // Wait, supabase might block direct query on information_schema. Let's try select * from roles limit 1.
        .select('*')
        .limit(1); // Wait, this might fail if it's not exposed. Let's fetch one record from roles and settings to see the keys.
        
    console.log("=== Fetching 1 row from roles ===");
    const { data: rolesSample } = await supabase.from('roles').select('*').limit(1);
    console.log("Roles sample keys & data:", rolesSample);

    console.log("=== Fetching 1 row from settings ===");
    const { data: settingsSample } = await supabase.from('settings').select('*').limit(1);
    if (settingsSample && settingsSample[0]) {
        const row = settingsSample[0];
        console.log("Settings keys:", Object.keys(row));
        // Print everything except very long arrays/fields to avoid truncation
        const pruned = { ...row };
        if (pruned.attendance_settings) {
            console.log("attendance_settings keys:", Object.keys(pruned.attendance_settings));
            console.log("attendance_settings.missed_checkout_config or missedCheckoutConfig:");
            console.log("missedCheckoutConfig:", pruned.attendance_settings.missedCheckoutConfig);
            console.log("missed_checkout_config:", pruned.attendance_settings.missed_checkout_config);
            console.log("roleMapping:", pruned.attendance_settings.roleMapping);
            console.log("role_mapping:", pruned.attendance_settings.role_mapping);
            console.log("site:", pruned.attendance_settings.site);
            console.log("field:", pruned.attendance_settings.field);
            console.log("office:", pruned.attendance_settings.office);
        }
    }
}

main().catch(console.error);
