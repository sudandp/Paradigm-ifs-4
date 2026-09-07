import { api } from '../services/api';

async function checkGanesha() {
  const users = await api.getUsers();
  const ganesha = users.find(u => u.name?.includes('Ganesha'));
  if (!ganesha) { console.log('Ganesha not found'); return; }

  const events = await api.getAttendanceEventsForUsers([ganesha.id], '2026-08-20', '2026-08-21');
  console.log('Ganesha events on Aug 20:', events.map(e => ({ type: e.type, time: e.timestamp })));
}

checkGanesha().catch(console.error);
