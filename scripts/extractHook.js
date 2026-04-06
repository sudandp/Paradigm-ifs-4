const fs = require('fs');
const lines = fs.readFileSync('e:/backup/onboarding all files/Paradigm Office 4/pages/attendance/AttendanceDashboard_Backup.tsx', 'utf-8').split('\n');

let startIdx = lines.findIndex(l => l.includes('const resolveUserRules = useCallback'));
let endIdx = lines.findIndex(l => l.includes('const productivityChartData'));

if (startIdx !== -1 && endIdx !== -1) {
    let hookFileContent = `
import { useMemo, useCallback } from 'react';
import { format, eachDayOfInterval, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { calculateWorkingHours } from '../utils/attendanceCalculations';

export const FIXED_HOLIDAYS = [
    { date: '01-26', name: 'Republic Day' },
    { date: '08-15', name: 'Independence Day' },
    { date: '10-02', name: 'Gandhi Jayanti' },
    { date: '05-01', name: 'May Day' },
    { date: '11-01', name: 'Karnataka Rajyotsava' },
    { date: '12-25', name: 'Christmas Day' },
    { date: '01-01', name: 'New Year' }
];

export function useAttendanceCalculations({
    users, attendanceEvents, dateRange, selectedUser, selectedRole, selectedSite, selectedSociety, selectedStatus, selectedRecordType,
    recurringHolidays, leaves, userHolidaysPool, officeHolidays, fieldHolidays, recentlyActiveUserIds,
    organizations, scopedSettings, fieldViolationsMap
}: any) {
`;

    for (let i = startIdx; i < endIdx; i++) {
        hookFileContent += lines[i] + '\n';
    }

    hookFileContent += `
    return {
        basicReportData, attendanceLogData, monthlyReportData, work_hoursReportData, site_otReportData, auditLogs
    };
}
`;
    // remove errors
    hookFileContent = hookFileContent.replace(/import .*?;\n/g, match => {
        if (match.includes('useMemo') || match.includes('date-fns') || match.includes('calculateWorkingHours')) return match;
        return '';
    });

    fs.writeFileSync('e:/backup/onboarding all files/Paradigm Office 4/hooks/useAttendanceCalculations.ts', hookFileContent);
    console.log('Hook generated successfully!');
} else {
    console.log('Indices not found:', startIdx, endIdx);
}
