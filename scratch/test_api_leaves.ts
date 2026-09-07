import { api } from '../services/api';

async function testApi() {
  const startDate = new Date(2026, 7, 1); // Aug 1 2026
  const endDate = new Date(2026, 7, 31); // Aug 31 2026

  const res = await api.getLeaveRequests({
    startDate: '2026-06-15',
    endDate: '2026-09-01'
  });
  console.log('Total leaves returned:', res.data.length);
  const kavyaLeaves = res.data.filter(l => l.userName === 'Kavya M' || l.userId === '07f61efd-24f2-457e-84b3-d8dafcb556c6');
  console.log('Kavya leaves returned:', kavyaLeaves.map(l => ({
    id: l.id,
    type: l.leaveType,
    start: l.startDate,
    end: l.endDate,
    status: l.status,
    userId: l.userId
  })));
}

testApi().catch(console.error);
