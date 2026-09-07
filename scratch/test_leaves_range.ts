import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { api } from '../services/api';
import { format, subDays, addDays } from 'date-fns';

async function test() {
    const startDate = new Date(2026, 7, 1);
    const endDate = new Date(2026, 7, 31);
    const leaveQuery = {
        startDate: format(subDays(startDate, 45), 'yyyy-MM-dd'),
        endDate: format(addDays(endDate, 1), 'yyyy-MM-dd')
    };
    console.log('Fetching leaves with query:', leaveQuery);
    const leavesRes = await api.getLeaveRequests(leaveQuery);
    const leaves = leavesRes?.data || [];
    console.log('Total leaves fetched:', leaves.length);

    const arpitha = (await api.getUsers()).find(u => u.name.includes('Arpitha'));
    console.log('Arpitha ID:', arpitha?.id);

    const arpithaLeaves = leaves.filter((l: any) => String(l.userId || l.user_id) === String(arpitha?.id));
    console.log('Arpitha leaves in this range count:', arpithaLeaves.length);
    console.log('Arpitha leaves:', arpithaLeaves);

    // Also check ANY leave that has type 'permission' or 'rp' in the whole system!
    const permLeaves = leaves.filter((l: any) => {
        const t = String(l.leaveType || l.leave_type || '').toLowerCase();
        return t.includes('permission') || t.includes('rp');
    });
    console.log('Permission leaves in total system for this period:', permLeaves.length);
    permLeaves.forEach((pl: any) => {
        console.log('Perm leave:', {
            id: pl.id,
            userId: pl.userId || pl.user_id,
            userName: pl.userName || pl.user_name,
            leaveType: pl.leaveType || pl.leave_type,
            startDate: pl.startDate || pl.start_date,
            endDate: pl.endDate || pl.end_date,
            status: pl.status || pl.leaveStatus
        });
    });
}
test().catch(console.error);
