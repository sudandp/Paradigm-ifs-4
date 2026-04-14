
import { api } from '../services/api';

async function findStany() {
  try {
    const users = await api.getUsers();
    const stany = users.find(u => u.name.includes('Stany'));
    if (!stany) {
      console.log('User Stany not found');
      return;
    }
    console.log(`Found Stany: ${stany.id} (${stany.name})`);

    const events = await api.getAllAttendanceEvents('2026-03-01', '2026-03-31 23:59:59');
    const stanyEvents = events.filter(e => String(e.userId) === String(stany.id));

    // Group by date
    const dailyEvents: Record<string, any[]> = {};
    stanyEvents.forEach(e => {
      const date = e.timestamp.split('T')[0];
      if (!dailyEvents[date]) dailyEvents[date] = [];
      dailyEvents[date].push(e);
    });

    // Calculate hours for each day
    Object.keys(dailyEvents).sort().forEach(date => {
      const events = dailyEvents[date];
      const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      let netWorkMinutes = 0;
      let isPunchedIn = false;
      let lastEventTime: Date | null = null;

      sortedEvents.forEach(event => {
        const eventTime = new Date(event.timestamp);
        if (lastEventTime && isPunchedIn) {
          netWorkMinutes += (eventTime.getTime() - lastEventTime.getTime()) / (1000 * 60);
        }
        if (event.type === 'punch-in') isPunchedIn = true;
        if (event.type === 'punch-out') isPunchedIn = false;
        lastEventTime = eventTime;
      });

      const hours = netWorkMinutes / 60;
      if (hours > 14) {
        console.log(`>>> Day ${date}: ${hours.toFixed(2)} hours (OVERTIME DAY)`);
      }
    });

  } catch (error) {
    console.error(error);
  }
}

findStany();
