import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function test() {
  console.log('--- SIMULATING AUTOMATED BACKGROUND PING FUNCTION ---');
  
  // 1. Fetch settings
  const { data: settingsData, error: settingsError } = await supabase
    .from('settings')
    .select('api_settings')
    .eq('id', 'singleton')
    .single();

  if (settingsError || !settingsData) {
    console.error('Failed to fetch settings:', settingsError);
    return;
  }

  const apiSettings = settingsData.api_settings || {};
  const trackingSettings = apiSettings.automated_tracking || apiSettings.automatedTracking || {};

  console.log('Settings Retrieved:');
  console.log(`- Automated Tracking Enabled: ${trackingSettings.enabled}`);
  console.log(`- Interval Minutes: ${trackingSettings.intervalMinutes || trackingSettings.interval_minutes || 15}`);

  if (!trackingSettings.enabled) {
    console.log('Warning: Automated tracking is currently disabled in the dashboard settings.');
  }

  const intervalMinutes = trackingSettings.intervalMinutes || trackingSettings.interval_minutes || 15;

  // 2. Fetch Active Field Staff
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: events, error: eventsError } = await supabase
    .from('attendance_events')
    .select('user_id, type, timestamp')
    .gte('timestamp', `${todayStr}T00:00:00Z`)
    .order('timestamp', { ascending: false });

  if (eventsError) {
    console.error('Failed to fetch attendance events:', eventsError);
    return;
  }

  const userStatus = new Map<string, string>();
  if (events) {
    for (const event of events) {
      if (event.type === 'punch-in' || event.type === 'punch-out') {
        if (!userStatus.has(event.user_id)) {
          userStatus.set(event.user_id, event.type);
        }
      }
    }
  }

  const activeUserIds: string[] = [];
  for (const [userId, eventType] of userStatus.entries()) {
    if (eventType === 'punch-in') {
      activeUserIds.push(userId);
    }
  }

  console.log(`\nActive/Clocked-In Users Today (${todayStr}):`);
  if (activeUserIds.length === 0) {
    console.log('- No users are currently clocked-in (latest event for today is punch-out or none).');
  } else {
    for (const id of activeUserIds) {
      // Get user name
      const { data: userData } = await supabase.from('profiles').select('name').eq('id', id).single();
      console.log(`- User ID: ${id} (${userData?.name || 'Unknown Name'})`);
    }
  }

  if (activeUserIds.length === 0) {
    console.log('\nCannot calculate pings because no users are active.');
    return;
  }

  // 3. Check threshold pings
  const timeThreshold = new Date(Date.now() - intervalMinutes * 60000).toISOString();
  console.log(`\nPing Threshold (Last ${intervalMinutes} minutes): ${timeThreshold}`);

  const recentlyPingedUsers = new Set<string>();

  // Query tracking logs
  const { data: recentLogs } = await supabase
    .from('tracking_audit_logs')
    .select('target_user_id, requested_at')
    .in('target_user_id', activeUserIds)
    .gte('requested_at', timeThreshold);

  if (recentLogs) {
    for (const log of recentLogs) {
      recentlyPingedUsers.add(log.target_user_id);
    }
  }

  // Query route history
  const { data: recentRoutes } = await supabase
    .from('route_history')
    .select('user_id, timestamp')
    .in('user_id', activeUserIds)
    .gte('timestamp', timeThreshold);

  if (recentRoutes) {
    for (const route of recentRoutes) {
      recentlyPingedUsers.add(route.user_id);
    }
  }

  const usersToPing = activeUserIds.filter(id => !recentlyPingedUsers.has(id));

  console.log('\nAnalysis of Who to Ping:');
  for (const id of activeUserIds) {
    const { data: userData } = await supabase.from('profiles').select('name').eq('id', id).single();
    const name = userData?.name || 'Unknown';
    if (recentlyPingedUsers.has(id)) {
      console.log(`- ${name} (ID: ${id}): SKIPPED (Already sent a signal or was pinged recently)`);
    } else {
      console.log(`- ${name} (ID: ${id}): WILL BE PINGED`);
    }
  }

  console.log(`\nTotal Users that would receive a background ping request right now: ${usersToPing.length}`);
}

test().catch(console.error);
