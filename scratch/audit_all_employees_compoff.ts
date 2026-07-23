import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { format, eachDayOfInterval } from 'date-fns';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FIXED_HOLIDAYS = [
  { name: 'May Day', date: '05-01', description: 'May Day / Labor Day' },
];

async function runAudit() {
    console.log("Fetching all users, leaves, comp off logs, holidays, and attendance events...");

    const { data: users, error: uErr } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });

    if (uErr || !users) {
        console.error("Failed to fetch users:", uErr);
        return;
    }

    const { data: holidays } = await supabase.from('holidays').select('*');
    const { data: userHolidays } = await supabase.from('user_holidays').select('*');
    const { data: compOffLogs } = await supabase.from('comp_off_logs').select('*');
    const { data: leaveRequests } = await supabase.from('leave_requests').select('*');
    const { data: attendanceEvents } = await supabase.from('attendance_events').select('*').gte('timestamp', '2026-01-01T00:00:00Z');

    const holidayDatesGlobal = new Set(holidays?.map(h => {
        const dStr = String(h.date);
        if (dStr.includes('T')) return format(new Date(dStr), 'yyyy-MM-dd');
        return format(new Date(dStr.replace(/-/g, '/')), 'yyyy-MM-dd');
    }) || []);

    FIXED_HOLIDAYS.forEach(fh => {
        holidayDatesGlobal.add(`2026-${fh.date}`);
    });

    // Group user holidays by user_id
    const userHolidaysMap = new Map<string, Set<string>>();
    userHolidays?.forEach(uh => {
        if (!userHolidaysMap.has(uh.user_id)) userHolidaysMap.set(uh.user_id, new Set());
        if (uh.holiday_date) userHolidaysMap.get(uh.user_id)!.add(uh.holiday_date);
    });

    // Group comp off logs by user_id
    const compOffLogsMap = new Map<string, any[]>();
    compOffLogs?.forEach(log => {
        if (!compOffLogsMap.has(log.user_id)) compOffLogsMap.set(log.user_id, []);
        compOffLogsMap.get(log.user_id)!.push(log);
    });

    // Group leave requests by user_id
    const leaveRequestsMap = new Map<string, any[]>();
    leaveRequests?.forEach(l => {
        if (!leaveRequestsMap.has(l.user_id)) leaveRequestsMap.set(l.user_id, []);
        leaveRequestsMap.get(l.user_id)!.push(l);
    });

    // Group attendance events by user_id -> dateStr
    const userEventsMap = new Map<string, Map<string, any[]>>();
    attendanceEvents?.forEach(e => {
        if (!userEventsMap.has(e.user_id)) userEventsMap.set(e.user_id, new Map());
        const userDateMap = userEventsMap.get(e.user_id)!;
        const dateStr = format(new Date(e.timestamp), 'yyyy-MM-dd');
        if (!userDateMap.has(dateStr)) userDateMap.set(dateStr, []);
        userDateMap.get(dateStr)!.push(e);
    });

    const auditResults: any[] = [];

    // Pre-calculate 3rd Saturdays for male office staff in 2026
    const intervalDays = eachDayOfInterval({ start: new Date('2026-01-01'), end: new Date() });

    for (const u of users) {
        const uHolidays = new Set(holidayDatesGlobal);
        const customH = userHolidaysMap.get(u.id);
        if (customH) {
            customH.forEach(d => uHolidays.add(d));
        }

        const isFemale = ['female', 'ladies'].includes((u.gender || '').toLowerCase());
        const isMale = !isFemale;
        const roleStr = (u.role || u.role_id || '').toLowerCase();
        const isOfficeStaff = !roleStr.includes('field') && !roleStr.includes('site');

        if (isMale && isOfficeStaff) {
            intervalDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayName = format(day, 'EEEE');
                const nth = Math.ceil(day.getDate() / 7);
                if (dayName === 'Saturday' && nth === 3) {
                    uHolidays.add(dateStr);
                }
            });
        }

        // Calculate dynamic comp off earned in 2026
        const dateEventsMap = userEventsMap.get(u.id) || new Map();
        const userLeaves = leaveRequestsMap.get(u.id) || [];
        const userLogs = compOffLogsMap.get(u.id) || [];

        let dynamicEarnedDays = 0;
        const earnedBreakdown: any[] = [];

        dateEventsMap.forEach((events, dateStr) => {
            const date = new Date(dateStr.replace(/-/g, '/'));
            const dayOfWeek = date.getDay();
            const isSunday = dayOfWeek === 0;
            const isHoliday = uHolidays.has(dateStr);

            if (isSunday || isHoliday) {
                const hasCorrection = userLeaves.some(l => {
                    const lType = String(l.leave_type || '').toLowerCase();
                    const lStatus = String(l.status || '').toLowerCase();
                    const isCompCorrection = (lType.includes('comp') || (lType.includes('correction') && String(l.reason || '').toLowerCase().includes('comp')));
                    return isCompCorrection && (lStatus === 'approved' || lStatus === 'correction_made') && l.start_date === dateStr;
                });

                let earnedAmount = 0;
                let reason = '';

                if (hasCorrection) {
                    earnedAmount = 1;
                    reason = 'Approved Comp Off Correction';
                } else {
                    const hasPunch = events.some(e => ['punch-in', 'site-in', 'check-in', 'site-ot-in'].includes(String(e.type || '').toLowerCase()));
                    let minTime = Infinity;
                    let maxTime = -Infinity;
                    events.forEach(e => {
                        const t = new Date(e.timestamp).getTime();
                        if (t < minTime) minTime = t;
                        if (t > maxTime) maxTime = t;
                    });
                    const workingHours = events.length > 1 ? (maxTime - minTime) / (1000 * 60 * 60) : 0;

                    if (workingHours >= 8) {
                        earnedAmount = 1;
                        reason = `Worked ${workingHours.toFixed(1)}h on ${isSunday ? 'Sunday' : 'Holiday'}`;
                    } else if (workingHours >= 4) {
                        earnedAmount = 0.5;
                        reason = `Worked ${workingHours.toFixed(1)}h on ${isSunday ? 'Sunday' : 'Holiday'}`;
                    } else if (hasPunch) {
                        earnedAmount = 0.5;
                        reason = `Punch present on ${isSunday ? 'Sunday' : 'Holiday'}`;
                    }
                }

                if (earnedAmount > 0) {
                    dynamicEarnedDays += earnedAmount;
                    earnedBreakdown.push({ date: dateStr, amount: earnedAmount, reason });
                }
            }
        });

        // Calculate Comp Off taken/used from approved leave requests
        const compOffLeaves = userLeaves.filter(l => l.leave_type === 'Comp Off');
        const approvedCompOffLeaves = compOffLeaves.filter(l => l.status === 'approved');
        const pendingCompOffLeaves = compOffLeaves.filter(l => l.status?.includes('pending'));
        const rejectedCompOffLeaves = compOffLeaves.filter(l => l.status === 'rejected');

        let compOffDaysUsed = 0;
        approvedCompOffLeaves.forEach(l => {
            const s = new Date(l.start_date);
            const e = new Date(l.end_date);
            const diffDays = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const count = l.days_count || l.total_days || (l.day_option === 'half' ? 0.5 : diffDays);
            compOffDaysUsed += count;
        });

        let compOffDaysPending = 0;
        pendingCompOffLeaves.forEach(l => {
            const s = new Date(l.start_date);
            const e = new Date(l.end_date);
            const diffDays = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const count = l.days_count || l.total_days || (l.day_option === 'half' ? 0.5 : diffDays);
            compOffDaysPending += count;
        });

        // Manual Comp Off logs earned vs used
        const manualLogsEarned = userLogs.filter(l => l.status === 'earned').length;
        const manualLogsUsed = userLogs.filter(l => l.status === 'used').length;
        const openingBalance = u.comp_off_opening_balance || 0;

        const netSystemBalance = dynamicEarnedDays + openingBalance - compOffDaysUsed;

        // Check for anomalies / issues
        const issues: string[] = [];

        if (compOffDaysUsed > (dynamicEarnedDays + openingBalance)) {
            issues.push(`CRITICAL: Negative Comp Off Balance (Taken ${compOffDaysUsed}d > Earned ${dynamicEarnedDays + openingBalance}d)`);
        }

        if (userLogs.length === 0 && (dynamicEarnedDays > 0 || compOffDaysUsed > 0)) {
            issues.push(`NOTICE: Missing explicit DB comp_off_logs records (Uses dynamic attendance fallback)`);
        }

        if (pendingCompOffLeaves.length > 0) {
            issues.push(`PENDING: ${pendingCompOffLeaves.length} pending Comp Off leave request(s) (${compOffDaysPending}d)`);
        }

        // Check for Comp Off leave requested without any corresponding Sunday/Holiday work or log
        compOffLeaves.forEach(l => {
            if (l.status === 'approved') {
                const sDate = l.start_date;
                // Check if reason is specified or manual adjustment
                if (!l.reason || l.reason.trim().length < 5) {
                    issues.push(`WARNING: Comp Off leave on ${sDate} approved with minimal/missing reason`);
                }
            }
        });

        if (issues.length > 0 || compOffLeaves.length > 0 || dynamicEarnedDays > 0) {
            auditResults.push({
                userId: u.id,
                name: u.name,
                email: u.email,
                role: u.role || u.role_id,
                gender: u.gender,
                openingBalance,
                dynamicEarnedDays,
                compOffDaysUsed,
                compOffDaysPending,
                netSystemBalance,
                manualLogsEarned,
                manualLogsUsed,
                totalCompOffRequests: compOffLeaves.length,
                approvedCompOffRequests: approvedCompOffLeaves.length,
                pendingCompOffRequests: pendingCompOffLeaves.length,
                earnedBreakdown,
                compOffLeaves,
                issues
            });
        }
    }

    fs.writeFileSync('scratch/audit_results.json', JSON.stringify(auditResults, null, 2));
    console.log(`Audit complete! Processed ${users.length} users. Identified ${auditResults.length} users with Comp Off activity or potential issues.`);
}

runAudit().catch(console.error);
