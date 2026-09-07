import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
    const { data: ruleVersions, error } = await supabase
        .from('attendance_rule_versions')
        .select('*');
    console.log('Rule versions error:', error);
    console.log('Rule versions count:', ruleVersions?.length);
    ruleVersions?.forEach(rv => {
        console.log('RV:', rv.id, rv.effective_from, rv.effective_to, rv.rules);
    });

    const { data: settings } = await supabase.from('settings').select('*').eq('id', 'singleton').single();
    console.log('attendance_settings top keys:', Object.keys(settings?.attendance_settings || {}));
    console.log('settings keys:', Object.keys(settings || {}));
}
test().catch(console.error);
