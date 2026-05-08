
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase credentials missing in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRules() {
    const { data: rules, error: rulesError } = await supabase.from('notification_rules').select('*');
    if (rulesError) {
        console.error('Error fetching rules:', rulesError);
    } else {
        console.log('Notification Rules:', JSON.stringify(rules, null, 2));
    }

    const { data: users, error: usersError } = await supabase.from('users').select('id, name, role_id, reporting_manager_id').limit(10);
    if (usersError) {
        console.error('Error fetching users:', usersError);
    } else {
        console.log('Sample Users:', JSON.stringify(users, null, 2));
    }
}

checkRules();
