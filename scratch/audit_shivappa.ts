import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { format, isAfter, isSameDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { getStaffCategory } from '../utils/attendanceCalculations';
import { processDailyEvents } from '../utils/attendanceCalculations';
import { resolveUserRules } from '../utils/monthlyReportCalculations';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Mock the evaluateSiteStaffStatus function with the proposed fix
export function mockEvaluateSiteStaffStatus(params: any): string {
  const { 
    day, userId, user_id, dayEvents, siteHolidays, leaves, userRules, workingHours, fieldStatus,
    daysPresentInWeek, isActiveInPreviousWeek
  } = params;
  const targetUserId = userId || user_id;

  // 1. Check if the day is a Holiday in the Duty Day Master (siteHolidays)
  const dateStr = format(day, 'yyyy-MM-dd');
  const isHoliday = (siteHolidays || []).some((h: any) => {
    if (!h || !h.date) return false;
    const hDateStr = String(h.date);
    if (hDateStr.startsWith('-')) {
      const compareMMDD = format(day, '-MM-dd');
      return dateStr.endsWith(hDateStr) || hDateStr.endsWith(compareMMDD);
    }
    return hDateStr.includes(dateStr);
  });

  // 2. Check Leaves
  const approvedLeave = (leaves || []).find((l: any) => {
    const lStartDate = l.startDate || l.date || l.leave_date;
    const lEndDate = l.endDate || l.date || l.leave_date;
    if (!lStartDate || !lEndDate) return false;
    
    const lUserId = l.userId || l.user_id;
    if (targetUserId && String(lUserId) !== String(targetUserId)) return false;

    const lStatus = String(l.status || l.leaveStatus || '').toLowerCase();
    if (!['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(lStatus)) return false;

    const normalize = (d: any) => typeof d === 'string' ? d.substring(0, 10) : format(new Date(d), 'yyyy-MM-dd');
    return dateStr >= normalize(lStartDate) && dateStr <= normalize(lEndDate);
  });

  // 3. Determine Base Work Status (Shift-based or Hours-based)
  const full = userRules?.minimumHoursFullDay || userRules?.dailyWorkingHours?.min || 8;
  const threeQuarterHrs = userRules?.threeQuarterDayHours ?? (full * 0.75);
  const halfDayHrs = userRules?.minimumHoursHalfDay ?? 5;
  const quarterDayHrs = userRules?.quarterDayHours ?? 2;

  // Credit Permission/Correction hours if correctionDetails are present
  const isApprovedPermission = approvedLeave && String(approvedLeave.leaveType || '').toLowerCase().includes('permission');
  const isApprovedCorrection = approvedLeave && String(approvedLeave.leaveType || '').toLowerCase().includes('correction');
  let effectiveWorkingHours = workingHours || 0;

  if ((isApprovedPermission || isApprovedCorrection) && approvedLeave?.correctionDetails) {
    const getMinutes = (timeStr: string) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    const inMins = getMinutes(approvedLeave.correctionDetails.punchIn);
    const outMins = getMinutes(approvedLeave.correctionDetails.punchOut);
    let diffMins = outMins - inMins;
    if (diffMins < 0) diffMins += 24 * 60;
    if (approvedLeave.correctionDetails.includeBreak && approvedLeave.correctionDetails.breakIn && approvedLeave.correctionDetails.breakOut) {
      const bIn = getMinutes(approvedLeave.correctionDetails.breakIn);
      const bOut = getMinutes(approvedLeave.correctionDetails.breakOut);
      let bDiff = bOut - bIn;
      if (bDiff < 0) bDiff += 24 * 60;
      diffMins -= bDiff;
    }
    effectiveWorkingHours = Math.max(0, diffMins / 60);
  }
  
  let baseWorkStatus = 'A';
  const hasPunchIn = dayEvents.some((e: any) => e.type === 'punch-in');
  const hasPunchOut = dayEvents.some((e: any) => e.type === 'punch-out');

  if (fieldStatus && fieldStatus !== 'A') {
    baseWorkStatus = fieldStatus;
  } else if (effectiveWorkingHours > 0) {
    if (effectiveWorkingHours >= full) baseWorkStatus = 'P';
    else if (effectiveWorkingHours >= threeQuarterHrs) baseWorkStatus = '0.75P';
    else if (effectiveWorkingHours >= halfDayHrs) baseWorkStatus = '0.5P';
    else if (effectiveWorkingHours >= quarterDayHrs) baseWorkStatus = '0.25P';
    else baseWorkStatus = 'A';
  } else if (hasPunchIn && hasPunchOut) {
    baseWorkStatus = 'P'; // Fallback if no hours but complete punch
  }

  // 4. Layer Site Staff Specific Marks
  const dayOfWeek = day.getDay();
  const weeklyOffDays = userRules?.weeklyOffDays || [0];
  const isWeeklyOffDay = weeklyOffDays.includes(dayOfWeek);

  const isFullDayLeave = approvedLeave && approvedLeave.dayOption !== 'half' && approvedLeave.day_option !== 'half';
  const lType = approvedLeave ? String(approvedLeave.leaveType || approvedLeave.type || '').toLowerCase() : '';
  const isCorrectionOrPermission = approvedLeave && (
    lType.includes('correction') || 
    lType.includes('permission') || 
    String(approvedLeave.status || '').toLowerCase() === 'correction_made'
  );

  // NEW RULE: Approved full-day leaves take priority over physical presence
  if (approvedLeave && isFullDayLeave && !isCorrectionOrPermission) {
    if (lType.includes('earned') || lType === 'e/l' || lType === 'el') return 'EL';
    if (lType.includes('sick') || lType === 's/l' || lType === 'sl') return 'SL';
    if (lType.includes('casual') || lType === 'c/l' || lType === 'cl') return 'CL';
    if (lType.includes('comp') || lType === 'c/o' || lType === 'co') return 'CO';
    if (lType.includes('floating') || lType === 'f/h' || lType === 'fh') return 'FH';
    if (lType.includes('pink')) return 'PL';
    if (lType.includes('maternity')) return 'ML';
    if (lType.includes('child care')) return 'CCL';
    return 'EL';
  }

  // FIXED CONDITION: Change check from `baseWorkStatus === 'P' || baseWorkStatus === '0.5P'`
  // to `baseWorkStatus !== 'A'` (which covers '0.75P' and '0.25P' as well).
  if (baseWorkStatus && baseWorkStatus !== 'A') {
    if (isHoliday) {
      return baseWorkStatus === 'P' ? 'H/P' : '0.5H/P';
    }
    if (isWeeklyOffDay) {
      return baseWorkStatus === 'P' ? 'W/P' : 'W/0.5P';
    }
    return baseWorkStatus;
  }

  // If not working, check for Leaves or Weekly Offs
  if (approvedLeave) {
    const lType = String(approvedLeave.leaveType || approvedLeave.type || '').toLowerCase();
    const isHalf = approvedLeave.dayOption === 'half' || approvedLeave.day_option === 'half';
    const prefix = isHalf ? '0.5' : '';
    
    if (lType.includes('permission')) return prefix + 'RP';
    if (lType.includes('correction')) return prefix + 'RC';
    if (lType.includes('earned') || lType === 'e/l' || lType === 'el') return prefix + 'EL';
    if (lType.includes('sick') || lType === 's/l' || lType === 'sl') return prefix + 'SL';
    if (lType.includes('casual') || lType === 'c/l' || lType === 'cl') return prefix + 'CL';
    if (lType.includes('comp') || lType === 'c/o' || lType === 'co') return prefix + 'CO';
    if (lType.includes('floating') || lType === 'f/h' || lType === 'fh') return prefix + 'FH';
    if (lType.includes('pink')) return prefix + 'PL';
    if (lType.includes('maternity')) return prefix + 'ML';
    if (lType.includes('child care')) return prefix + 'CCL';
    return prefix + 'EL';
  }

  // Weekly Off logic
  if (isWeeklyOffDay) {
    const threshold = userRules?.weekendPresentThreshold ?? 3;
    const meetsThreshold = (daysPresentInWeek ?? 0) >= threshold;
    return meetsThreshold ? 'W/O' : 'A';
  }

  if (isHoliday) return 'H';

  return 'A';
}

async function main() {
    console.log("Searching for user Shivappa M...");
    const { data: users } = await supabase
        .from('users')
        .select('*')
        .ilike('name', '%Shivappa%');
        
    if (!users || users.length === 0) return;
    const user = users[0];

    // Get role displayName
    let roleDisplayName = user.role;
    if (user.role && user.role.length > 20) {
        const { data: roleObj } = await supabase.from('roles').select('*').eq('id', user.role).single();
        if (roleObj) roleDisplayName = roleObj.displayName.toLowerCase().replace(/\s+/g, '_');
    }

    // Get settings
    const { data: settingsData } = await supabase.from('settings').select('*').limit(1).single();

    // Get site holidays
    const { data: siteHolidays } = await supabase.from('site_holidays').select('*').eq('site_id', user.organization_id);

    // Fetch leaves
    const { data: leaves } = await supabase.from('leave_requests').select('*').eq('user_id', user.id);

    // Fetch events for June 2026
    const { data: events } = await supabase
        .from('attendance_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', '2026-06-01T00:00:00')
        .lte('timestamp', '2026-06-25T23:59:59')
        .order('timestamp', { ascending: true });

    const userCategory = getStaffCategory(roleDisplayName || user.role, user.organization_id, settingsData.attendance_settings);
    const rules = resolveUserRules(
        { ...user, role: roleDisplayName, organizationId: user.organization_id, societyId: user.society_id } as any,
        roleDisplayName,
        settingsData.attendance_settings,
        []
    );

    console.log("\n--- SIMULATION OF CORRECTED STATUSES ---");
    const daysInPeriod = 24;
    for (let day = 1; day <= daysInPeriod; day++) {
        const currentDate = new Date(2026, 5, day); // June is index 5
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dayEvents = (events || []).filter(e => e.timestamp.startsWith(dateStr));
        const hasActivity = dayEvents.length > 0;

        if (hasActivity) {
            const { workingHours: netHours } = processDailyEvents(dayEvents, currentDate);
            const mockStatus = mockEvaluateSiteStaffStatus({
                day: currentDate,
                userId: user.id,
                userCategory,
                userRole: roleDisplayName,
                userRules: rules,
                dayEvents,
                siteHolidays: siteHolidays || [],
                leaves: leaves || [],
                workingHours: netHours,
            });

            console.log(`June ${day} | Net worked: ${netHours.toFixed(2)} | Simulated Status: ${mockStatus}`);
        }
    }
}

main().catch(console.error);
