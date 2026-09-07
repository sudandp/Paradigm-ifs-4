import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { api } from '../services/api';
import { processEmployeeMonth, resolveUserRules } from '../utils/monthlyReportCalculations';
import { evaluateAttendanceStatus } from '../utils/attendanceCalculations';

async function test() {
    const versionedGlobalRules = await api.getRuleVersionForMonth(2026, 8);
    const users = await api.getUsers();
    const arpitha = users.find(u => u.name.includes('Arpitha'));
    const rep = processEmployeeMonth(
        arpitha,
        await api.getAttendanceEventsForUsers([arpitha.id], '2026-07-20', '2026-09-02 23:59:59'),
        [],
        [],
        2026,
        8,
        [],
        [],
        [],
        [],
        [],
        arpitha.role,
        [],
        versionedGlobalRules ? { ...versionedGlobalRules } : null,
        null,
        []
    );

    console.log('Arpitha dailyData Day 1 to 5:');
    rep.dailyData?.slice(0, 5).forEach(d => {
        console.log(`Day ${d.day} (${d.date}): status=${d.status}, netWorked=${d.netWorkedHours}, gross=${d.grossDuration}, shift=${d.shift}`);
    });
}
test().catch(console.error);
