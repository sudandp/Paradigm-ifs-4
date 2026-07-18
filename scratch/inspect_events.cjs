const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectEvents() {
  const start = '2026-06-01T00:00:00.000Z';
  const end = '2026-06-30T23:59:59.999Z';
  const { data: events, error } = await supabase
    .from('attendance_events')
    .select('user_id, type, timestamp')
    .gte('timestamp', start)
    .lte('timestamp', end);

  if (error) {
    console.error(error);
  } else {
    console.log(`Total events in June 2026: ${events.length}`);
    const userEventCounts = {};
    events.forEach(e => {
      userEventCounts[e.user_id] = (userEventCounts[e.user_id] || 0) + 1;
    });
    console.log(`Unique users with events in June 2026: ${Object.keys(userEventCounts).length}`);
    
    // Fetch names of these users
    const userIds = Object.keys(userEventCounts);
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name')
        .in('id', userIds);
      console.log('Users with attendance events in June 2026:');
      users.forEach(u => {
        console.log(`- ${u.name} (ID: ${u.id}, Events: ${userEventCounts[u.id]})`);
      });
    }
  }
}

inspectEvents();
