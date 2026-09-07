import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
    const { data: users, error: userError } = await supabase.from('users').select('*');
    console.log('User error:', userError);
    console.log('Total users:', users?.length);
    if (users && users.length > 0) {
        console.log('Cols:', Object.keys(users[0]));
    }
    
    // Check users matching Bangalore
    const bangaloreUsers = users?.filter(u => {
        const loc = u.location || '';
        return loc.toLowerCase().includes('bangalore');
    }) || [];
    console.log('Bangalore users count:', bangaloreUsers.length);
    console.log('Is Arpitha in Bangalore users?', bangaloreUsers.some(u => u.name.includes('Arpitha')));

    // Now check if fetchAll / query with .in('user_id', userIds) works
    const userIds = bangaloreUsers.map(u => u.id);
    const { data: events, error } = await supabase.from('attendance_events')
        .select('id, user_id, timestamp, type')
        .in('user_id', userIds)
        .gte('timestamp', '2026-07-25T00:00:00')
        .lte('timestamp', '2026-09-02T23:59:59');
    console.log('Events error:', error);
    console.log('Events count for Bangalore users:', events?.length);
    
    // Check Arpitha events in this result
    const arpitha = bangaloreUsers.find(u => u.name.includes('Arpitha'));
    const arpithaEvents = events?.filter(e => e.user_id === arpitha?.id) || [];
    console.log('Arpitha events count in batch result:', arpithaEvents.length);
}
test().catch(console.error);
