import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    const { data: users } = await supabase
        .from('users')
        .select('id, name, email')
        .ilike('name', '%Poojashree%');
        
    if (!users || users.length === 0) {
        console.log('User not found');
        return;
    }
    
    console.log('User:', users[0]);
    
    const today = new Date().toISOString().split('T')[0];
    
    const { data: events, error } = await supabase
        .from('attendance_events')
        .select('*')
        .eq('user_id', users[0].id)
        .gte('timestamp', `${today}T00:00:00Z`)
        .order('timestamp', { ascending: true });
        
    console.log('Events today:', JSON.stringify(events, null, 2));
    if (error) console.error(error);
}

checkLogs();
