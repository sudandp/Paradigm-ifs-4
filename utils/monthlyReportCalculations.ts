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
import type {
  AttendanceEvent,
  User,
  UserHoliday,
  Holiday,
  RoutePoint,
} from '../types';

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
  travelDistance?: number;
  travelDuration?: number;
  isAutoCheckout?: boolean;
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
  const userCategory = getStaffCategory(resolvedRole || user.role, user.organizationId, { 
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
  
  let totalGrossWorkDuration = 0, totalNetWorkDuration = 0, totalBreakDuration = 0, totalOT = 0, totalTravelDistance = 0, totalTravelDuration = 0;
  let presentDays = 0, absentDays = 0, halfDays = 0, threeQuarterDays = 0, quarterDays = 0, holidaysCount = 0;
  let leavesCount = 0, floatingHolidays = 0, lossOfPay = 0, holidayPresents = 0, weekendPresents = 0;
  let sickLeaves = 0, earnedLeaves = 0, casualLeaves = 0, compOffs = 0, workFromHomeDays = 0, weekOffs = 0, totalPayableDays = 0, overtimeDays = 0;
  
  const rules = resolveUserRules(user, resolvedRole, versionedUserRules || attendance, scopedSettings);
  const category = getStaffCategory(resolvedRole || user.role, user.organizationId || user.societyId, { attendance: versionedUserRules || attendance });
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
          const isWfh = allLeaves.some(l => {
              if (String(l.userId) !== String(user.id)) return false;
              if (!l.startDate || !l.endDate) return false;
              try {
                  return isWithinInterval(checkDate, { start: startOfDay(new Date(l.startDate)), end: endOfDay(new Date(l.endDate)) }) &&
                  (String(l.leaveType || '').toLowerCase().includes('work from home') || String(l.leaveType || '').toLowerCase() === 'wfh');
              } catch (e) {
                  return false;
              }
          });
          if (hasActivityCheck || isHolidayCheck || isWfh) {
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
    if (s.includes('+')) return s.split('+').reduce((acc, part) => acc + resolvePayableValue(part.trim()), 0);
    if (['W/P', 'W.O/P', 'H/P'].includes(s)) return 1.5; 
    if (['P', 'W/O', 'WOP', 'H', 'SL', 'S/L', 'EL', 'E/L', 'CL', 'C/L', 'C/O', 'CO', '0.5P', '1/2P', 'Half Day', 'W/H', 'WH', 'BL', 'F/H', 'FH', 'PL', 'P/L', 'ML', 'M/L', 'CC', 'C/C', 'CCL'].includes(s)) return 1;
    if (s.includes('SL') || s.includes('S/L') || s.includes('EL') || s.includes('E/L') || s.includes('CL') || s.includes('C/L') || s.includes('C/O') || s.includes('CO') || s.includes('BL') || s.includes('F/H') || s.includes('FH') || s.includes('PL') || s.includes('P/L') || s.includes('ML') || s.includes('M/L') || s.includes('CCL')) {
        return (s.startsWith('1/2') || s.startsWith('0.5')) ? 0.5 : 1;
    }
    if (['1/2P', 'Half Day', '0.5P'].includes(s)) return 0.5;
    if (s === '3/4P' || s === '0.75P') return 0.75;
    if (s === '1/4P' || s === '0.25P') return 0.25;
    return 0;
  };

  const updateCounters = (s: string) => {
    const isHalf = s.startsWith('1/2') || s === 'Half Day' || s === '0.5P' || s.startsWith('0.5');
    const inc = isHalf ? 0.5 : 1;

    if (s === 'P') presentDays++;
    else if (s === 'W/P' || s === 'W.O/P') { presentDays++; weekOffs++; weekendPresents++; }
    else if (s === '3/4P' || s === '0.75P') threeQuarterDays++;
    else if (s === '1/2P' || s === 'Half Day' || s === '0.5P') halfDays++;
    else if (s === '1/4P' || s === '0.25P') quarterDays++;
    else if (s === 'A') absentDays++;
    else if (s === 'W/O') weekOffs++;
    else if (s === 'BL' || s === '1/2BL' || s === 'FH' || s === '0.5FH') { floatingHolidays += inc; weekOffs += inc; }
    else if (s === 'PL' || s === '1/2PL' || s === '0.5PL') { floatingHolidays += inc; weekOffs += inc; }
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

    let currentDayInTime = '-', currentDayOutTime = '-', currentDayGrossDuration = '-', currentDayBreakDuration = '-', currentDayNetWorkedHours = '-', currentDayOT = '-', currentDayShortfall = '-', currentDayShift = '-', currentDayBreakIn = '-', currentDayBreakOut = '-';
    let currentDayTravelKm = 0;
    let currentDayTravelDuration = 0;
    let netHours = 0, grossHours = 0, breakHours = 0;
    let fieldResultStatus = '';
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dayEvents = eventsByGroup[dateStr] || [];
    const dayRoutePoints = routePoints.filter(p => isSameDay(new Date(p.timestamp), currentDate));
    const hasActivity = dayEvents.length > 0;
    const isFuture = isAfter(currentDate, startOfDay(new Date()));
    let isAutoCheckout = false;

    if (hasActivity) {
      const { checkIn, checkOut, firstBreakIn, breakOut, workingHours: wHours, breakHours: bHrs, totalHours } = processDailyEvents(dayEvents, currentDate);
      netHours = wHours; grossHours = totalHours; breakHours = bHrs;
      currentDayInTime = checkIn ? format(new Date(checkIn), 'HH:mm') : '-';
      currentDayOutTime = checkOut ? format(new Date(checkOut), 'HH:mm') : '-';
      currentDayBreakIn = firstBreakIn ? format(new Date(firstBreakIn), 'HH:mm') : '-';
      currentDayBreakOut = breakOut ? format(new Date(breakOut), 'HH:mm') : '-';
      
      const firstPunchTime = new Date(dayEvents[0].timestamp);
      const timeVal = firstPunchTime.getHours() + firstPunchTime.getMinutes() / 60;
      currentDayShift = timeVal >= 4 && timeVal < 11.5 ? 'Shift GS' : timeVal >= 11.5 && timeVal < 20 ? 'Shift B' : 'Shift C';
      shiftCounts[currentDayShift] = (shiftCounts[currentDayShift] || 0) + 1;

      const uCat = category as string;
      if ((uCat === 'field' || uCat === 'site') && rules?.enableSiteTimeTracking) {
          const fRes = getFieldStaffStatus(dayEvents, rules, undefined, user.role, currentDate);
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

      if (!isFuture) { 
          totalNetWorkDuration += netHours; 
          totalGrossWorkDuration += grossHours; 
          totalBreakDuration += breakHours;
          totalOT += ot; 
          totalTravelDistance += currentDayTravelKm;
          totalTravelDuration += currentDayTravelDuration;
          if (category === 'site' && netHours > 14) overtimeDays++;
      }
    }

    const isActiveInPreviousWeek = daysPresentInPreviousWeek >= threshold;

    let status = evaluateAttendanceStatus({
        day: currentDate, userId: user.id, userCategory: category, userRole: resolvedRole || user.role, userRules: rules,
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
        userGender: user.gender
    });

    const hasPunchInOnDay = dayEvents.some(e => e.type === 'punch-in' || e.type === 'site-ot-in');
    if (status === 'W/O' && hasPunchInOnDay) status = 'WOP';

    if (isZeroActivityMonth && (status === 'H' || status === 'W/O' || status === 'BL' || status === 'PL' || status === 'FH')) {
      status = 'A';
    }

    const isPresence = status.includes('P') || status === 'Present' || status === 'Half Day' || status === 'H' || status === 'W/H';
    const isApprovedLeave = (status.includes('L') && !status.includes('LOP')) || status === 'W/H';
    
    if (isPresence || isApprovedLeave) {
      const val = (status.includes('1/2') || status === 'Half Day') ? 0.5 : 1;
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
      travelDistance: currentDayTravelKm,
      travelDuration: currentDayTravelDuration,
      isAutoCheckout
    });
  }

  totalPayableDays += overtimeDays;

  const cappedPayableDays = Math.min(getDaysInMonth(monthStart), totalPayableDays);

  return {
    employeeId: user.id, employeeName: user.name, role: user.role, statuses: dailyData.map(d => d.status),
    totalGrossWorkDuration, totalNetWorkDuration, totalBreakDuration, totalOT, totalTravelDistance, totalTravelDuration,
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
