
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

async function migrate() {
    console.log('Adding logo_url column to entities table...');
    
    // Check if column already exists
    const { data: checkData, error: checkError } = await supabase.rpc('check_column_exists', {
        t_name: 'entities',
        c_name: 'logo_url'
    });

    // If RPC doesn't exist, we'll just try to add it and catch error
    const { data, error } = await supabase.from('entities').select('logo_url').limit(1);
    
    if (error && error.code === '42703') { // Column does not exist
        console.log('Column missing. Attempting to add via SQL RPC...');
        // We use a general purpose exec SQL RPC if it exists, or we might have to tell the user.
        // In many of our projects we have an 'exec_sql' RPC for migrations.
        const { error: migrationError } = await supabase.rpc('exec_sql', {
            sql_query: 'ALTER TABLE entities ADD COLUMN IF NOT EXISTS logo_url TEXT;'
        });

        if (migrationError) {
            console.error('Migration failed via RPC:', migrationError);
            console.log('Please run this SQL in your Supabase SQL Editor:');
            console.log('ALTER TABLE entities ADD COLUMN IF NOT EXISTS logo_url TEXT;');
        } else {
            console.log('Migration successful!');
        }
    } else if (error) {
        console.error('Error checking column:', error);
    } else {
        console.log('Column already exists.');
    }
}

migrate();
