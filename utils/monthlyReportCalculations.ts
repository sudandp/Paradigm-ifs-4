import {
  format,
  getDaysInMonth,
  startOfMonth,
  endOfMonth,
  isAfter,
  isSameDay,
  isWithinInterval,
  endOfDay,
  startOfWeek,
  subDays,
  isBefore,
  addDays,
  startOfToday,
  startOfDay,
} from 'date-fns';
import {
  processDailyEvents,
  evaluateAttendanceStatus,
  getStaffCategory,
  calculateDailyPathTravelKm,
} from './attendanceCalculations';
import { getFieldStaffStatus } from './fieldStaffTracking';
import { FIXED_HOLIDAYS } from './constants';
import { buildAttendanceDayKeyByEventId } from './attendanceDayGrouping';
import { detectShift, detectAllShiftsWorked } from './shiftDetection';
import { resolveShift } from './siteRuleResolver';
import type {
  AttendanceEvent,
  User,
  UserHoliday,
  Holiday,
  RoutePoint,
} from '../types';

export const parsePermissionDurationFromReason = (reason: string): number => {
  if (!reason) return 0;
  const text = reason.toLowerCase();
  
  // Try matching formats like "1hr 15 mints", "1 hour 15 mins", "1h 15m", "1 hr 15 mins", "1 hour 15 minutes"
  const hrMinRegex = /(\d+)\s*(?:hr|hour|h)s?\s*(\d+)\s*(?:mint|min|m)/;
  const hrMinMatch = text.match(hrMinRegex);
  if (hrMinMatch) {
    const hrs = parseInt(hrMinMatch[1], 10);
    const mins = parseInt(hrMinMatch[2], 10);
    return hrs * 60 + mins;
  }

  // Try matching only hours: "1.5 hours", "2 hours", "1hr", "1 hour", "1h"
  const hrRegex = /(\d+(?:\.\d+)?)\s*(?:hr|hour|h)/;
  const hrMatch = text.match(hrRegex);
  if (hrMatch) {
    return parseFloat(hrMatch[1]) * 60;
  }

  // Try matching only minutes: "15mints", "30 mintes", "37 minutes", "15m"
  const minRegex = /(\d+)\s*(?:mint|min|m)/;
  const minMatch = text.match(minRegex);
  if (minMatch) {
    return parseInt(minMatch[1], 10);
  }

  return 0;
};

export interface DailyData {
  date: number;
  status: string;
  inTime: string;
  outTime: string;
  grossDuration: string;
  breakIn: string;
  breakOut: string;
  breakDuration: string;
  netWorkedHours: string;
  ot: string;
  shortfall: string;
  shift: string;
  permDuration?: string;
  travelDistance?: number;
  travelDuration?: number;
  isAutoCheckout?: boolean;
  totalSteps?: number;
}

export interface EmployeeMonthlyData {
  employeeId: string;
  employeeName: string;
  userName?: string;
  role?: string;
  statuses: string[];
  totalGrossWorkDuration: number;
  totalNetWorkDuration: number;
  totalBreakDuration: number;
  totalOT: number;
  totalTravelDistance?: number;
  totalTravelDuration?: number;
  totalSteps?: number;
  presentDays: number;
  absentDays: number;
  weekOffs: number;
  holidays: number;
  holidayPresents: number;
  weekendPresents: number;
  halfDays: number;
  threeQuarterDays: number;
  quarterDays: number;
  sickLeaves: number;
  earnedLeaves: number;
  casualLeaves: number;
  floatingHolidays: number;
  compOffs: number;
  lossOfPays: number;
  workFromHomeDays: number;
  totalPayableDays: number;
  averageWorkingHrs: number;
  totalDurationPlusOT: number;
  shiftCounts: { [key: string]: number };
  dailyData: DailyData[];
  present: number;
  absent: number;
  weeklyOff: number;
  leaves: number;
  lossOfPay: number;
  overtimeDays: number;
}

export function resolveUserRules(
  user: User,
  resolvedRole: string | undefined,
  attendance: any,
  scopedSettings: any[]
) {
  const userCategory = getStaffCategory(resolvedRole || user.role, user.societyId || user.organizationId, { 
    attendance, 
    missedCheckoutConfig: (attendance as any).missedCheckoutConfig 
  });
  
  const entitySetting = scopedSettings.find(s => s.scope_type === 'entity' && s.scope_id === user.organizationId);
  if (entitySetting) return entitySetting.settings[userCategory] || attendance[userCategory];

  const companySetting = scopedSettings.find(s => s.scope_type === 'company' && s.scope_id === user.societyId);
  if (companySetting) return companySetting.settings[userCategory] || attendance[userCategory];

  return attendance[userCategory];
}

export function processEmployeeMonth(
  user: User, 
  events: AttendanceEvent[], 
  userLeaves: any[], 
  userHolidays: any[], 
  year: number, 
  month: number, 
  passedOfficeHolidays: any[],
  passedFieldHolidays: any[],
  passedSiteHolidays: any[],
  passedRecurringHolidays: any[],
  allLeaves: any[] = [], 
  resolvedRole: string | undefined,
  routePoints: RoutePoint[] = [],
  versionedUserRules: any | null = null,
  attendance: any = null,
  scopedSettings: any[] = []
): EmployeeMonthlyData {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = endOfMonth(monthStart);
  const today = startOfToday();
  const effectiveEnd = isAfter(monthEnd, today) ? today : monthEnd;
  const daysInPeriod = effectiveEnd.getDate();
  const dailyData: DailyData[] = [];
  
  let totalGrossWorkDuration = 0, totalNetWorkDuration = 0, totalBreakDuration = 0, totalOT = 0, totalTravelDistance = 0, totalTravelDuration = 0, totalSteps = 0;
  let presentDays = 0, absentDays = 0, halfDays = 0, threeQuarterDays = 0, quarterDays = 0, holidaysCount = 0;
  let leavesCount = 0, floatingHolidays = 0, lossOfPay = 0, holidayPresents = 0, weekendPresents = 0;
  let sickLeaves = 0, earnedLeaves = 0, casualLeaves = 0, compOffs = 0, workFromHomeDays = 0, weekOffs = 0, totalPayableDays = 0, overtimeDays = 0;
  
  const rules = resolveUserRules(user, resolvedRole, versionedUserRules || attendance, scopedSettings);
  const category = getStaffCategory(resolvedRole || user.role, user.societyId || user.organizationId, versionedUserRules || attendance);
  const threshold = (rules as any)?.weekendPresentThreshold ?? 3;

  // Ensure we use the best available holiday lists
  const activeOfficeHolidays = passedOfficeHolidays || [];
  const activeFieldHolidays = passedFieldHolidays || [];
  const activeSiteHolidays = passedSiteHolidays || [];
  const activeRecurringHolidays = passedRecurringHolidays || [];

  const bufferStart = subDays(monthStart, 15);
  
  let daysPresentInCurrentWeek = 0;
  let daysActiveInCurrentWeek = 0;
  let daysPresentInPreviousWeek = 0;

  let checkDate = startOfWeek(subDays(monthStart, 15), { weekStartsOn: 1 });
  while (isBefore(checkDate, monthStart)) {
      if (checkDate.getDay() === 1) {
          daysPresentInPreviousWeek = daysActiveInCurrentWeek;
          daysPresentInCurrentWeek = 0;
          daysActiveInCurrentWeek = 0;
      }

      const dateStrStr = format(checkDate, 'yyyy-MM-dd');
      const checkDayName = format(checkDate, 'EEEE');
      
      const isConfiguredHolidayCheck = (category === 'field' ? (rules?.fieldHolidays || []) : (rules?.officeHolidays || [])).some((h: any) => {
          const hVal = String(h.date).split(' ')[0].split('T')[0];
          return hVal === dateStrStr;
      }) || FIXED_HOLIDAYS.some(fh => dateStrStr.endsWith('-' + fh.date));

      const isPoolHolidayCheck = (userHolidays || []).some((uh: any) => {
          const uhUserId = String(uh.userId || uh.user_id || '').trim().toLowerCase();
          const targetUserId = String(user.id).trim().toLowerCase();
          if (uhUserId !== targetUserId) return false;
          const uhDateRaw = String(uh.holidayDate || uh.holiday_date || '').trim();
          return uhDateRaw.includes(dateStrStr);
      });

      const isRecurringCheck = (activeRecurringHolidays || []).some(rule => {
          const ruleDay = String(rule.day || '').toLowerCase();
          if (!rule || ruleDay !== checkDayName.toLowerCase()) return false;
          const occurrence = Math.ceil(checkDate.getDate() / 7);
          const ruleOccurrence = Number(rule.occurrence || rule.n || 0);
          const ruleType = rule.roleType || rule.type || 'office';
          if (ruleType !== category) return false;
          
          if (ruleDay === 'saturday' && ruleOccurrence === 3) {
              const userRoleLower = (user.role || '').toLowerCase();
              if (userRoleLower !== 'admin' && (user.gender || '').toLowerCase() !== 'male') return false;
          }

          const months = rules?.floatingHolidayMonths || [];
          if (months.length > 0 && !months.includes(checkDate.getMonth())) return false;
          
          return ruleOccurrence === occurrence;
      });

      const isHolidayCheck = isConfiguredHolidayCheck || isPoolHolidayCheck || isRecurringCheck;
      const hasApprovedLeaveCheck = allLeaves.some(l => {
          if (String(l.userId) !== String(user.id)) return false;
          if (!l.startDate || !l.endDate) return false;
          try {
              return isWithinInterval(checkDate, { start: startOfDay(new Date(l.startDate)), end: endOfDay(new Date(l.endDate)) }) &&
              !['loss of pay', 'loss-of-pay', 'lop'].includes((l.leaveType || '').toLowerCase());
          } catch (e) {
              return false;
          }
      });
      const hasActivityCheck = events.some(e => e.timestamp.startsWith(dateStrStr));

      if (hasActivityCheck || hasApprovedLeaveCheck || isHolidayCheck) {
          daysActiveInCurrentWeek++;
          const isWfhOrCompOff = allLeaves.some(l => {
              if (String(l.userId) !== String(user.id)) return false;
              if (!l.startDate || !l.endDate) return false;
              try {
                  const type = (l.leaveType || '').toLowerCase();
                  return isWithinInterval(checkDate, { start: startOfDay(new Date(l.startDate)), end: endOfDay(new Date(l.endDate)) }) &&
                  (type.includes('work from home') || type === 'wfh' || type === 'w/h' || type.includes('comp') || type === 'c/o' || type === 'co');
              } catch (e) {
                  return false;
              }
          });
          if (hasActivityCheck || isHolidayCheck || isWfhOrCompOff) {
              daysPresentInCurrentWeek++;
          }
      }
      checkDate = addDays(checkDate, 1);
  }
  
  const shiftCounts: { [key: string]: number } = {};
  const formatTime = (hrs: number) => {
      const totalMinutes = Math.round(hrs * 60);
      const h = Math.floor(totalMinutes / 60), m = totalMinutes % 60;
      return `${h}:${String(m).padStart(2, '0')}`;
  };

  const resolvePayableValue = (s: string): number => {
    // Special handling for RP combined with half-day leaves (user specifically requested RP+0.5EL = full day pay)
    if ((s.includes('RP+') || s.includes('+RP')) && (s.includes('0.5EL') || s.includes('0.5SL') || s.includes('0.5CL') || s.includes('0.5CO') || s.includes('0.5WH'))) {
        return 1.0;
    }

    if (s.includes('+')) return s.split('+').reduce((acc, part) => acc + resolvePayableValue(part.trim()), 0);
    if (['W/P', 'H/P', 'BL/P', 'PL/P'].includes(s)) return 1.5; 
    if (['P', 'W/O', 'WOP', 'H', 'SL', 'S/L', 'EL', 'E/L', 'CL', 'C/L', 'C/O', 'CO', 'W/H', 'WH', 'BL', 'F/H', 'FH', 'PL', 'P/L', 'ML', 'M/L', 'CC', 'C/C', 'CCL'].includes(s)) return 1;
    // Handle half-day leave types (e.g. '0.5SL', '0.5WH', '0.5EL', '0.5CL')
    if (s.startsWith('0.5') && (s.includes('SL') || s.includes('S/L') || s.includes('EL') || s.includes('E/L') || s.includes('CL') || s.includes('C/L') || s.includes('WH') || s.includes('W/H') || s.includes('BL') || s.includes('PL') || s.includes('ML') || s.includes('CCL') || s.includes('CO') || s.includes('C/O'))) return 0.5;
    if (s.includes('SL') || s.includes('S/L') || s.includes('EL') || s.includes('E/L') || s.includes('CL') || s.includes('C/L') || s.includes('C/O') || s.includes('CO') || s.includes('BL') || s.includes('F/H') || s.includes('FH') || s.includes('PL') || s.includes('P/L') || s.includes('ML') || s.includes('M/L') || s.includes('CCL') || s.includes('WH') || s.includes('W/H')) {
        return s.startsWith('0.5') ? 0.5 : 1;
    }
    if (['Half Day', '0.5P', '1/2P', '2/4P'].includes(s)) return 0.5;
    if (s === '3/4P' || s === '0.75P') return 0.75;
    if (s === '1/4P' || s === '0.25P') return 0.25;
    if (s.endsWith('P') && s !== 'LOP') {
      const numericVal = parseFloat(s.slice(0, -1));
      if (!isNaN(numericVal)) return numericVal;
    }
    if (s.endsWith('RP')) {
      if (s === 'RP') return 0;
      const numericVal = parseFloat(s.slice(0, -2));
      if (!isNaN(numericVal)) return numericVal;
    }
    return 0;
  };

  const updateCounters = (s: string) => {
    if (s.includes('+')) {
        // Special case: RP combined with a half-day leave. Since RP+0.5EL means they worked 0.5P but we replaced it with RP,
        // we must manually increment halfDays to account for the physical work.
        if ((s.includes('RP+') || s.includes('+RP')) && (s.includes('0.5EL') || s.includes('0.5SL') || s.includes('0.5CL') || s.includes('0.5CO') || s.includes('0.5WH'))) {
            halfDays++;
        }
        s.split('+').forEach(part => updateCounters(part.trim()));
        return;
    }

    const isHalf = s.startsWith('0.5') || s === 'Half Day' || s === '1/2P' || s === '2/4P';
    const inc = isHalf ? 0.5 : 1;

    if (s === 'P') presentDays++;
    else if (s === 'W/P' || s === 'BL/P' || s === 'PL/P') {
        presentDays++;
        if (s === 'W/P') {
            weekOffs++;
            weekendPresents++;
        } else {
            floatingHolidays += inc;
        }
    }
    else if (s === '3/4P' || s === '0.75P') threeQuarterDays++;
    else if (s === 'Half Day' || s === '0.5P' || s === '1/2P' || s === '2/4P') halfDays++;
    else if (s === '1/4P' || s === '0.25P') quarterDays++;
    else if (s.endsWith('P') && s !== 'LOP' && !s.includes('+') && !s.includes('/')) {
      const val = parseFloat(s.slice(0, -1));
      if (!isNaN(val)) {
        if (val >= 1.0) presentDays++;
        else if (val >= 0.75) threeQuarterDays++;
        else if (val >= 0.5) halfDays++;
        else if (val >= 0.25) quarterDays++;
        else if (val > 0) quarterDays++;
        else absentDays++;
      }
    }
    else if (s === 'A') absentDays++;
    else if (s === 'W/O') weekOffs++;
    else if (s === 'BL' || s === '0.5BL' || s === 'FH' || s === '0.5FH') { floatingHolidays += inc; }
    else if (s === 'PL' || s === '0.5PL') { floatingHolidays += inc; }
    else if (s === 'WOP') { weekOffs++; if (statusToCounterActivity) weekendPresents++; }
    else if (s === 'H') holidaysCount++;
    else if (s === 'H/P') { holidaysCount++; presentDays++; holidayPresents++; }
    else if (s.includes('SL') || s.includes('S/L')) { sickLeaves += inc; leavesCount += inc; }
    else if (s.includes('EL') || s.includes('E/L')) { earnedLeaves += inc; leavesCount += inc; }
    else if (s.includes('CL') || s.includes('C/L')) { casualLeaves += inc; leavesCount += inc; }
    else if (s.includes('BL') || s.includes('F/H') || s.includes('FH')) floatingHolidays += inc;
    else if (s.includes('PL') || s.includes('P/L')) { floatingHolidays += inc; }
    else if (s.includes('C/O') || s.includes('CO')) { compOffs += inc; leavesCount += inc; }
    else if (s.includes('LOP')) lossOfPay += inc;
    else if (s === 'W/H' || s === 'WH') workFromHomeDays += inc;
    else if (s.includes('WFH')) workFromHomeDays += inc;
  };

  let statusToCounterActivity = false;

  const dayKeyMap = buildAttendanceDayKeyByEventId(events);
  const eventsByGroup: Record<string, AttendanceEvent[]> = {};
  events.forEach(e => {
      const key = dayKeyMap[e.id];
      if (!eventsByGroup[key]) eventsByGroup[key] = [];
      eventsByGroup[key].push(e);
  });

  const monthStartStr = format(new Date(year, month - 1, 1), 'yyyy-MM');
  const hasEventsInMonth = events.some(e => (e.timestamp || '').startsWith(monthStartStr));
  const hasLeavesInMonth = allLeaves.length > 0;
  const isZeroActivityMonth = !hasEventsInMonth && !hasLeavesInMonth;

  for (let day = 1; day <= daysInPeriod; day++) {
    const currentDate = new Date(year, month - 1, day);
    if (currentDate.getDay() === 1) {
        daysPresentInPreviousWeek = daysActiveInCurrentWeek;
        daysPresentInCurrentWeek = 0;
        daysActiveInCurrentWeek = 0;
    }

    let currentDayInTime = '-', currentDayOutTime = '-', currentDayGrossDuration = '-', currentDayBreakDuration = '-', currentDayNetWorkedHours = '-', currentDayOT = '-', currentDayShortfall = '-', currentDayShift = '-', currentDayBreakIn = '-', currentDayBreakOut = '-', currentDayPermDuration = '-';
    let currentDayTravelKm = 0;
    let currentDayTravelDuration = 0;
    let currentDaySteps = 0;
    let netHours = 0, grossHours = 0, breakHours = 0;
    let fieldResultStatus = '';
    let resolvedShift: any = null;
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    // Find approved permission for the current day
    const approvedPermissionOnDay = allLeaves.find(l => {
      const lStartDate = l.startDate || l.date || l.leave_date;
      const lEndDate = l.endDate || l.date || l.leave_date;
      if (!lStartDate || !lEndDate) return false;
      const lUserId = l.userId || l.user_id;
      if (String(lUserId) !== String(user.id)) return false;
      const lStatus = String(l.status || l.leaveStatus || '').toLowerCase();
      if (!['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(lStatus)) return false;

      const normalize = (d: any) => {
          if (!d) return '';
          if (typeof d === 'string') return d.substring(0, 10);
          return format(new Date(d), 'yyyy-MM-dd');
      };

      const startDateStr = normalize(lStartDate);
      const endDateStr = normalize(lEndDate);
      return dateStr >= startDateStr && dateStr <= endDateStr && String(l.leaveType || '').toLowerCase().includes('permission');
    });

    if (approvedPermissionOnDay) {
      const permMinutes = parsePermissionDurationFromReason(approvedPermissionOnDay.reason);
      currentDayPermDuration = formatTime(permMinutes / 60);
    }

    const dayEvents = eventsByGroup[dateStr] || [];
    const dayRoutePoints = routePoints.filter(p => isSameDay(new Date(p.timestamp), currentDate));
    const hasActivity = dayEvents.length > 0;
    const isFuture = isAfter(currentDate, startOfDay(new Date()));
    let isAutoCheckout = false;

    if (hasActivity) {
      // Filter out auto-inserted permission events for physical presence calculation
      const actualPunches = dayEvents.filter(e => e.reason !== 'Auto-inserted from approved Permission Request');
      
      const { checkIn: actualIn, checkOut: actualOut, firstBreakIn, breakOut, workingHours: wHours, breakHours: bHrs, totalHours } = processDailyEvents(actualPunches, currentDate);
      
      let baseNetHours = wHours;
      let baseGrossHours = totalHours;
      
      if (approvedPermissionOnDay) {
        const permMinutes = parsePermissionDurationFromReason(approvedPermissionOnDay.reason);
        baseNetHours += (permMinutes / 60);
        baseGrossHours += (permMinutes / 60);
      }

      netHours = baseNetHours;
      grossHours = baseGrossHours;
      breakHours = bHrs;

      // Use all events (including auto-inserted ones) for display of inTime and outTime
      const { checkIn, checkOut } = processDailyEvents(dayEvents, currentDate);
      
      currentDayInTime = checkIn ? format(new Date(checkIn), 'HH:mm') : '-';
      currentDayOutTime = checkOut ? format(new Date(checkOut), 'HH:mm') : '-';
      currentDayBreakIn = firstBreakIn ? format(new Date(firstBreakIn), 'HH:mm') : '-';
      currentDayBreakOut = breakOut ? format(new Date(breakOut), 'HH:mm') : '-';
      
      const siteShifts = (rules as any)?.siteShifts || [];
      const firstPunchIn = dayEvents.find((e: any) => e.type === 'punch-in' || e.type === 'site-in' || e.type === 'site-ot-in');
      
      let matchedShifts: any[] = [];
      if (category === 'site' && checkIn) {
        matchedShifts = detectAllShiftsWorked(checkIn, checkOut, siteShifts, netHours);
      }

      if (category === 'site' && matchedShifts.length > 0) {
        currentDayShift = matchedShifts.map(s => s.name).join(', ');
        matchedShifts.forEach(s => {
          shiftCounts[s.name] = (shiftCounts[s.name] || 0) + 1;
        });
        resolvedShift = matchedShifts[0];
      } else {
        let detectedShift = firstPunchIn ? detectShift(firstPunchIn.timestamp, siteShifts) : null;
        if (!detectedShift && siteShifts.length > 0) {
          detectedShift = resolveShift(rules, user.department || '', (user as any).shiftId) || null;
        }
        const firstPunchTime = new Date(dayEvents[0].timestamp);
        const timeVal = firstPunchTime.getHours() + firstPunchTime.getMinutes() / 60;
        currentDayShift = detectedShift?.name || (timeVal >= 4 && timeVal < 11.5 ? 'Shift GS' : timeVal >= 11.5 && timeVal < 20 ? 'Shift B' : 'Shift C');
        shiftCounts[currentDayShift] = (shiftCounts[currentDayShift] || 0) + 1;
        resolvedShift = detectedShift;
      }

      const uCat = category as string;
      if ((uCat === 'field' || uCat === 'site') && rules?.enableSiteTimeTracking) {
          const effectiveRules = {
            ...rules,
            ...(user.weeklyOffDays && user.weeklyOffDays.length > 0 ? { weeklyOffDays: user.weeklyOffDays } : {})
          };
          const fRes = getFieldStaffStatus(dayEvents, effectiveRules, undefined, user.role, currentDate);
          fieldResultStatus = fRes.status;
      }

      const travelRes = calculateDailyPathTravelKm(dayEvents, dayRoutePoints);
      currentDayTravelKm = travelRes.distance;
      currentDayTravelDuration = travelRes.duration;

      currentDayGrossDuration = formatTime(grossHours);
      currentDayNetWorkedHours = formatTime(netHours);
      currentDayBreakDuration = formatTime(breakHours);
      const maxDailyHours = (rules as any).dailyWorkingHours?.max || 9;
      const ot = Math.max(0, netHours - maxDailyHours);
      
      currentDayShortfall = netHours > 0 && netHours < (maxDailyHours * 0.75) ? 'YES' : '-';
      currentDayOT = ot > 0 ? formatTime(ot) : '-';
      
      const punchOut = [...dayEvents].reverse().find(e => e.type === 'punch-out' || e.type === 'site-out');
      isAutoCheckout = !!(punchOut && (
          punchOut.locationName === 'Auto Check-out' || 
          (punchOut as any).reason?.includes('Auto-checkout') ||
          punchOut.source === 'auto_system' ||
          (punchOut as any).checkoutNote?.includes('Auto punch-out')
      ));

      // Sum daily steps from all punch-out events for this day (works for office, field, site)
      currentDaySteps = dayEvents
          .filter(e => (e.type === 'punch-out' || e.type === 'site-ot-out' || e.type === 'site-out') && (e.steps ?? 0) > 0)
          .reduce((sum, e) => sum + (e.steps || 0), 0);

      // Find approved permission - Handled at start of loop

      if (!isFuture) { 
          totalNetWorkDuration += netHours; 
          totalGrossWorkDuration += grossHours; 
          totalBreakDuration += breakHours;
          totalOT += ot; 
          totalTravelDistance += currentDayTravelKm;
          totalTravelDuration += currentDayTravelDuration;
          totalSteps += currentDaySteps;
          // OT duty count = extra shifts worked beyond first (smarter than binary +1 per day)
          // e.g. Day with [Shift C, Shift A, Shift B] = 3 shifts = +2 OT duties
          if (category === 'site') {
            if (matchedShifts.length > 1) {
              overtimeDays += matchedShifts.length - 1;
            } else if (netHours >= 12) {
              // Fallback when shift config absent: estimate from hours
              const stdShift = (rules as any).dailyWorkingHours?.max || 8;
              overtimeDays += Math.max(1, Math.floor(netHours / stdShift) - 1);
            }
          }

      }
    } else {
      const siteShifts = (rules as any)?.siteShifts || [];
      if (siteShifts.length > 0) {
        resolvedShift = resolveShift(rules, user.department || '', (user as any).shiftId) || null;
      }
      if (approvedPermissionOnDay) {
        const permMinutes = parsePermissionDurationFromReason(approvedPermissionOnDay.reason);
        netHours = permMinutes / 60;
        grossHours = permMinutes / 60;
      }
    }

    const isActiveInPreviousWeek = daysPresentInPreviousWeek >= threshold;

    const effectiveRules = {
      ...rules,
      ...(user.weeklyOffDays && user.weeklyOffDays.length > 0 ? { weeklyOffDays: user.weeklyOffDays } : {})
    };

    let status = evaluateAttendanceStatus({
        day: currentDate, userId: user.id, userCategory: category, userRole: resolvedRole || user.role, userRules: effectiveRules,
        dayEvents, 
        officeHolidays: activeOfficeHolidays, 
        fieldHolidays: activeFieldHolidays, 
        siteHolidays: activeSiteHolidays, 
        recurringHolidays: activeRecurringHolidays,
        userHolidaysPool: userHolidays, leaves: allLeaves, daysPresentInWeek: daysPresentInCurrentWeek,
        isActiveInPreviousWeek,
        workingHours: netHours,
        fieldStatus: fieldResultStatus,
        floatingHolidayMonths: rules?.floatingHolidayMonths,
        userGender: user.gender,
        // BL/PL location rule: only Bangalore office/field staff get Blue/Pink Leave codes
        userLocation: user.location || user.locationName || user.organizationName || user.societyName,
        resolvedShift
    });

    const hasPunchInOnDay = dayEvents.some(e => e.type === 'punch-in' || e.type === 'site-ot-in');
    if (status === 'W/O' && hasPunchInOnDay) status = 'WOP';

    if (isZeroActivityMonth && (status === 'H' || status === 'W/O' || status === 'BL' || status === 'PL' || status === 'FH')) {
      status = 'A';
    }

    const isPresence = status.includes('P') || status === 'Present' || status === 'Half Day' || status === 'H' || status === 'W/H' || status === 'WH' || status.includes('CO');
    const isApprovedLeave = (status.includes('L') && !status.includes('LOP')) || status === 'W/H' || status === 'WH' || status.includes('CO');
    
    if (isPresence || isApprovedLeave) {
      const val = (status.includes('0.5') || status === 'Half Day') ? 0.5 : 1;
      daysActiveInCurrentWeek += val;
      if (isPresence) {
        daysPresentInCurrentWeek += val;
      }
    }

    if (!isFuture) {
        statusToCounterActivity = hasActivity;
        if (status.includes('+')) {
            status.split('+').forEach(p => updateCounters(p.trim()));
        } else {
            updateCounters(status);
        }
        totalPayableDays += resolvePayableValue(status);
    }

    dailyData.push({
      date: day, status, inTime: currentDayInTime, outTime: currentDayOutTime, grossDuration: currentDayGrossDuration,
      breakIn: currentDayBreakIn, breakOut: currentDayBreakOut, breakDuration: currentDayBreakDuration,
      netWorkedHours: currentDayNetWorkedHours, ot: currentDayOT, shortfall: currentDayShortfall, shift: currentDayShift,
      permDuration: (currentDayPermDuration && currentDayPermDuration !== '-') ? currentDayPermDuration : undefined,
      travelDistance: currentDayTravelKm,
      travelDuration: currentDayTravelDuration,
      isAutoCheckout,
      totalSteps: currentDaySteps
    });
  }

  totalPayableDays += overtimeDays;

  const cappedPayableDays = Math.min(getDaysInMonth(monthStart), totalPayableDays);

  return {
    employeeId: user.id, employeeName: user.name, role: user.role, statuses: dailyData.map(d => d.status),
    totalGrossWorkDuration, totalNetWorkDuration, totalBreakDuration, totalOT, totalTravelDistance, totalTravelDuration, totalSteps,
    presentDays, absentDays, weekOffs, holidays: holidaysCount, holidayPresents, weekendPresents,
    halfDays, threeQuarterDays, quarterDays, sickLeaves, earnedLeaves, casualLeaves, floatingHolidays, compOffs,
    lossOfPays: lossOfPay, workFromHomeDays, totalPayableDays: cappedPayableDays,
    averageWorkingHrs: (presentDays + halfDays) > 0 ? totalNetWorkDuration / (presentDays + halfDays) : 0,
    totalDurationPlusOT: totalNetWorkDuration + totalOT,
    shiftCounts, dailyData, 
    present: cappedPayableDays,
    absent: absentDays, 
    weeklyOff: weekOffs,
    leaves: leavesCount, 
    lossOfPay, 
    overtimeDays
  };
}
