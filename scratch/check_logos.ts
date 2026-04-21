
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogos() {
    console.log('Checking Companies...');
    const { data: companies, error: cError } = await supabase.from('companies').select('id, name, logo_url');
    if (cError) {
        console.error('Error fetching companies:', cError);
    } else {
        console.table(companies);
    }

    console.log('\nChecking Entities...');
    const { data: entities, error: eError } = await supabase.from('entities').select('id, name, logo_url');
    if (eError) {
        console.error('Error fetching entities:', eError);
    } else {
        console.table(entities);
    }
}

checkLogos();
