import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

const getEventLabel = (type: string, workType?: 'office' | 'field' | 'site'): string => {
    if (workType === 'field' || workType === 'site') {
        const fieldLabels: Record<string, string> = {
            'punch-in': 'Punch In',
            'punch-out': 'Punch Out',
            'site-in': 'Site In',
            'site-out': 'Site Out',
            'site-ot-in': 'Site OT In',
            'site-ot-out': 'Site OT Out',
            'break-in': 'Break-In',
            'break-out': 'Break-Out',
            'live-location': 'Live Tracking',
        };
        return fieldLabels[type] || type.replace('-', ' ');
    }
    const officeLabels: Record<string, string> = {
        'punch-in': 'Punch-In',
        'punch-out': 'Punch-Out',
        'break-in': 'Break-In',
        'break-out': 'Break-Out',
    };
    return officeLabels[type] || type.replace('-', ' ');
};

async function test() {
  const userId = '3535b1fa-8055-4d91-b832-3cf492045033';
  const { data: eventsData } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', '2026-05-23T00:00:00Z')
    .lte('timestamp', '2026-05-23T23:59:59Z');
  
  if (!eventsData) return;

  // Let's mimic parent's filteredEvents logic
  let results = eventsData.map(e => ({
    ...e,
    userId: e.user_id,
    locationName: e.location_name,
    workType: e.work_type,
    batteryLevel: e.battery_level,
    deviceName: e.device_name,
    ipAddress: e.ip_address,
    networkType: e.network_type,
    networkProvider: e.network_provider
  }));

  // Parent sorts userEvents and maps displayType
  results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const processedUserEvents = results.map((e, index) => {
      let displayType = e.type;
      if (displayType === 'punch-in' && e.workType === 'field') displayType = 'site-in';
      else if (displayType === 'punch-out' && e.workType === 'field') displayType = 'site-out';
      
      return {
          ...e,
          displayType,
          userName: 'Uma',
          userRole: 'Field Staff'
      };
  });

  const deduped: typeof processedUserEvents = [];
  for (let i = 0; i < processedUserEvents.length; i++) {
      const current = processedUserEvents[i];
      
      if (current.displayType === 'live-location') {
          const next = processedUserEvents[i + 1];
          if (next && next.displayType === 'live-location') continue;
          deduped.push(current);
      } else {
          const lastPushed = deduped[deduped.length - 1];
          if (lastPushed && lastPushed.displayType === current.displayType) continue;
          deduped.push(current);
      }
  }

  // Parent sorts and returns
  const filteredEvents = deduped.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  console.log("Parent filteredEvents count:", filteredEvents.length);
  console.log("Parent filteredEvents displayTypes and timestamps:");
  filteredEvents.forEach(e => console.log(`  - ${e.displayType} at ${e.timestamp} (coords: ${e.latitude}, ${e.longitude})`));

  // Now mimic RouteView logic
  const events = filteredEvents;
  const selectedUser = userId;

  const userEvents = events
      .filter(e => e.userId === selectedUser && e.latitude && e.longitude)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log("\nRouteView userEvents count:", userEvents.length);
  userEvents.forEach(e => console.log(`  - ${e.displayType} at ${e.timestamp}`));

  const rawUserEvents = events.filter(e => e.userId === selectedUser)
                              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const processedRawUserEvents = rawUserEvents.map((e, index) => {
      const isLast = index === rawUserEvents.length - 1;
      let displayType = e.type;
      if (displayType === 'punch-in' && e.workType === 'field') displayType = 'site-in';
      else if (displayType === 'punch-out' && e.workType === 'field') displayType = 'site-out';
      return { ...e, displayType, isFirst: index === 0, isLast };
  });

  const dedupedAllUserEvents: typeof processedRawUserEvents = [];
  for (let i = 0; i < processedRawUserEvents.length; i++) {
      const current = processedRawUserEvents[i];
      if (current.displayType === 'live-location') {
          const next = processedRawUserEvents[i + 1];
          if (next && next.displayType === 'live-location') continue;
          dedupedAllUserEvents.push(current);
      } else {
          const lastPushed = dedupedAllUserEvents[dedupedAllUserEvents.length - 1];
          if (lastPushed && lastPushed.displayType === current.displayType) continue;
          dedupedAllUserEvents.push(current);
      }
  }

  const allUserEvents = dedupedAllUserEvents.sort((a, b) => {
      const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      if (a.displayType === 'live-location' && b.displayType !== 'live-location') return 1;
      if (b.displayType === 'live-location' && a.displayType !== 'live-location') return -1;
      return 0;
  });

  console.log("\nRouteView allUserEvents count:", allUserEvents.length);
  allUserEvents.forEach(e => console.log(`  - ${e.displayType} at ${e.timestamp}`));

  const mappableEvents = allUserEvents.filter(ev => {
      const src = userEvents.find(e => e.id === ev.id);
      return src && src.latitude && src.longitude;
  });

  console.log("\nRouteView mappableEvents count:", mappableEvents.length);
  mappableEvents.forEach((e, idx) => console.log(`  - Pin ${idx + 1}: ${e.displayType} at ${e.timestamp} (coords: ${e.latitude}, ${e.longitude})`));
}

test();
