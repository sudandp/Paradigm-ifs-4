import { api } from '../services/api';

async function findUmaRecords() {
  try {
    const users = await api.getUsers();
    const uma = users.find(u => u.name.toLowerCase().includes('uma'));
    if (!uma) {
      console.log('User Uma not found');
      return;
    }
    console.log(`============================================================`);
    console.log(`USER RECORD:`);
    console.log(JSON.stringify(uma, null, 2));
    console.log(`============================================================`);

    // Let's fetch all events for 2026-05-23
    const start = '2026-05-23T00:00:00.000Z';
    const end = '2026-05-23T23:59:59.999Z';
    const events = await api.getAllAttendanceEvents(start, end);
    const umaEvents = events.filter(e => String(e.userId) === String(uma.id))
                           .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log(`ATTENDANCE EVENTS FOR 2026-05-23 (${umaEvents.length} events):`);
    umaEvents.forEach((e, idx) => {
      console.log(`${idx + 1}. [${e.timestamp}] Type: ${e.type}, WorkType: ${e.workType || (e as any).work_type}, Location: ${e.locationName} (Lat: ${e.latitude}, Lng: ${e.longitude})`);
    });
    console.log(`============================================================`);

    // Let's fetch route history (GPS pings) for 2026-05-23
    const routePoints = await api.getRoutePoints(uma.id, start, end);
    console.log(`ROUTE HISTORY/GPS PINGS FOR 2026-05-23 (${routePoints.length} points):`);
    routePoints.forEach((p, idx) => {
      if (idx < 5 || idx === routePoints.length - 1 || idx % 20 === 0) {
        console.log(`- [${p.timestamp}] Lat: ${p.latitude}, Lng: ${p.longitude}, Battery: ${p.batteryLevel}, Source: ${p.source}, Device: ${p.deviceName}`);
      }
    });
    console.log(`============================================================`);

  } catch (error) {
    console.error(error);
  }
}

findUmaRecords();
