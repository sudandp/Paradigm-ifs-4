import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { api } from '../services/api';
import { resolveUserRules } from '../utils/monthlyReportCalculations';
import { getEarlyDepartureDeductions } from '../utils/attendanceCalculations';

async function test() {
    const versionedGlobalRules = await api.getRuleVersionForMonth(2026, 8);
    const users = await api.getUsers();
    const arpitha = users.find(u => u.name.includes('Arpitha'));
    const versionedUserRules = versionedGlobalRules ? { ...versionedGlobalRules } : null;

    console.log('Arpitha role:', arpitha.role);

    const rules = resolveUserRules(arpitha, arpitha.role, versionedUserRules, []);
    console.log('Resolved rules for Arpitha:', {
        minimumHoursFullDay: rules?.minimumHoursFullDay,
        dailyWorkingHours: rules?.dailyWorkingHours,
        minimumHoursHalfDay: rules?.minimumHoursHalfDay,
        threeQuarterDayHours: rules?.threeQuarterDayHours,
        quarterDayHours: rules?.quarterDayHours,
        gracePeriodMinutes: rules?.gracePeriodMinutes,
        keys: Object.keys(rules || {})
    });
}
test().catch(console.error);
