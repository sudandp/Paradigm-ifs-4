
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from project root if needed, or assume env vars are available
// Actually, I can just read the env file if I can find it.
// Let's assume the process has env vars from the workspace.

async function main() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-url.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-key';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: users } = await supabase.from('users').select('id, name').ilike('name', '%Ravi%');
    console.log('Users found:', users);

    if (users && users.length > 0) {
        const raviId = users[0].id;
        const { data: events } = await supabase
            .from('attendance_events')
            .select('*')
            .eq('user_id', raviId)
            .gte('timestamp', '2026-04-17T00:00:00Z')
            .lte('timestamp', '2026-04-17T23:59:59Z')
            .order('timestamp', { ascending: true });
        
        console.log('Events for Ravi on 2026-04-17:', JSON.stringify(events, null, 2));
    }
}

main().catch(console.error);
