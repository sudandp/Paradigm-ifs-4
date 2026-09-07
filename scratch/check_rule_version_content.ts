import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { api } from '../services/api';

async function test() {
    const v = await api.getRuleVersionForMonth(2026, 8);
    console.log('Version for 2026-08:', v?._versionId);
    console.log('Keys of version:', Object.keys(v || {}));
    if (v?.office) {
        console.log('Office keys:', Object.keys(v.office));
        console.log('Office minimumHoursFullDay:', v.office.minimumHoursFullDay);
        console.log('Office fixedOfficeHours:', v.office.fixedOfficeHours);
    }
    if (v?.rules) {
        console.log('Rules keys:', Object.keys(v.rules));
        console.log('Rules minimumHoursFullDay:', v.rules.minimumHoursFullDay);
    }
    console.log('Direct keys:', {
        minimumHoursFullDay: v?.minimumHoursFullDay,
        dailyWorkingHours: v?.dailyWorkingHours,
        fixedOfficeHours: v?.fixedOfficeHours
    });
}
test().catch(console.error);
