import React, { useState, useEffect } from 'react';
import { format, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, isAfter, isSameDay, isWithinInterval, endOfDay, startOfWeek, subDays, isBefore, addDays, startOfToday } from 'date-fns';
import { Download } from 'lucide-react';
import { api } from '../../services/api';
import { processDailyEvents, calculateWorkingHours, isLateCheckIn, isEarlyCheckOut, evaluateAttendanceStatus, getStaffCategory } from '../../utils/attendanceCalculations';
import { getFieldStaffStatus } from '../../utils/fieldStaffTracking';
import type { AttendanceEvent, User, StaffAttendanceRules, UserHoliday, Role, FieldAttendanceViolation, Holiday } from '../../types';
import Button from '../ui/Button';
import { useSettingsStore } from '../../store/settingsStore';
import { FIXED_HOLIDAYS } from '../../utils/constants';
import { buildAttendanceDayKeyByEventId } from '../../utils/attendanceDayGrouping';
import { useAuthStore } from '../../store/authStore';

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


interface MonthlyHoursReportProps {
  month: number;
  year: number;
  userId?: string;
  data?: EmployeeMonthlyData[];
  hideHeader?: boolean;
  scopedSettings?: any[];
  selectedStatus?: string;
  selectedSite?: string;
  selectedSociety?: string;
  selectedRole?: string;
  onDataLoaded?: (data: EmployeeMonthlyData[]) => void;
  users?: User[];
}

const MonthlyHoursReport: React.FC<MonthlyHoursReportProps> = ({ 
  month, year, userId, data: externalData, hideHeader, scopedSettings = [],
  selectedStatus = 'all', selectedSite = 'all', selectedSociety = 'all', selectedRole = 'all',
  onDataLoaded, users: externalUsers
}) => {
  const [reportData, setReportData] = useState<EmployeeMonthlyData[]>([]);
  const [loading, setLoading] = useState(!externalData);
  const [, setUsers] = useState<User[]>([]); 
  const [, setLeaves] = useState<any[]>([]); 
  const { user: currentUser } = useAuthStore();
  const [userHolidaysPool, setUserHolidaysPool] = useState<UserHoliday[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [masterHolidays, setMasterHolidays] = useState<Holiday[]>([]);
  const { attendance, officeHolidays: storeOfficeHolidays, fieldHolidays: storeFieldHolidays, siteHolidays: storeSiteHolidays, recurringHolidays: storeRecurringHolidays } = useSettingsStore();

  const resolveUserRules = (user: User, resolvedRole?: string) => {
    const userCategory = getStaffCategory(resolvedRole || user.role, user.organizationId, { 
      attendance, 
      missedCheckoutConfig: (attendance as any).missedCheckoutConfig 
    });
    
    const entitySetting = scopedSettings.find(s => s.scope_type === 'entity' && s.scope_id === user.organizationId);
    if (entitySetting) return entitySetting.settings[userCategory] || attendance[userCategory];

    const companySetting = scopedSettings.find(s => s.scope_type === 'company' && s.scope_id === user.societyId);
    if (companySetting) return companySetting.settings[userCategory] || attendance[userCategory];

    return attendance[userCategory];
  };

  useEffect(() => {
    if (externalData) {
      setReportData(externalData);
      setLoading(false);
      if (onDataLoaded) onDataLoaded(externalData);
    } else {
      loadReportData();
    }
  }, [month, year, userId, externalData, selectedStatus, selectedSite, selectedSociety, selectedRole]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const startDate = startOfMonth(new Date(year, month - 1));
      let endDate = endOfMonth(new Date(year, month - 1));
      const today = startOfToday();
      if (isAfter(endDate, today)) endDate = today;

      const [usersData, leavesDataResponse, userHolidaysData, rolesData, globalHolidaysRes] = await Promise.all([
        externalUsers || api.getUsers(),
        api.getLeaveRequests({ 
          startDate: format(subDays(startDate, 1), 'yyyy-MM-dd'),
          endDate: format(addDays(endDate, 1), 'yyyy-MM-dd')
        }),
        api.getAllUserHolidays({ year }),
        api.getRoles(),
        api.getInitialAppData() 
      ]);

      const leavesData = leavesDataResponse?.data || [];
      setUsers(usersData);
      setLeaves(leavesData || []);
      setUserHolidaysPool(userHolidaysData || []);
      setAllRoles(rolesData || []);
      if (globalHolidaysRes?.holidays) {
        setMasterHolidays(globalHolidaysRes.holidays);
      }

      let targetUsers = usersData;
      if (userId && userId !== 'all') {
        targetUsers = usersData.filter(u => u.id === userId);
      } else {
        if (selectedRole !== 'all') targetUsers = targetUsers.filter(u => u.role === selectedRole);
        if (selectedSite !== 'all') targetUsers = targetUsers.filter(u => u.organizationId === selectedSite);
        if (selectedSociety !== 'all') targetUsers = targetUsers.filter(u => u.societyId === selectedSociety);
        if (selectedStatus === 'ACTIVE_USERS') {
          targetUsers = targetUsers.filter(u => (u as any).isActive !== false);
        }
      }

      // End date logic moved up
      // Start fetching from the Monday at least 15 days before the month start to ensure clean weekly blocks
      const fetchStartDate = startOfWeek(subDays(startDate, 15), { weekStartsOn: 1 });
      
      const targetUserIds = targetUsers.map(u => u.id);
      const allEvents = await api.getAttendanceEventsForUsers(
        targetUserIds,
        format(fetchStartDate, 'yyyy-MM-dd'), 
        // Expand 12 hours forward to catch night shift ends
        format(new Date(endDate.getTime() + 12 * 60 * 60 * 1000), 'yyyy-MM-dd HH:mm:ss')
      );

      const eventsByUser = new Map<string, AttendanceEvent[]>();
      allEvents.forEach(e => {
          const uid = String(e.userId);
          if (!eventsByUser.has(uid)) eventsByUser.set(uid, []);
          eventsByUser.get(uid)!.push(e);
      });

      const leavesByUser = new Map<string, any[]>();
      (leavesData || []).forEach((l: any) => {
          const lUserId = String(l.userId || l.user_id);
          const lStatus = String(l.status || l.leaveStatus || '').toLowerCase();
          const isApproved = ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(lStatus);
          
          if (isApproved) {
              if (!leavesByUser.has(lUserId)) leavesByUser.set(lUserId, []);
              leavesByUser.get(lUserId)!.push(l);
          }
      });

      if (userId === undefined || userId === 'all') {
        targetUsers = targetUsers.filter(u => u.role !== 'management');
      }

      // Use local variables to avoid stale state issues during initial load
      const currentMasterHolidays = globalHolidaysRes?.holidays || [];
      const currentOfficeHolidays = (attendance as any)?.office || currentMasterHolidays.filter((h: any) => h.type === 'office');
      const currentFieldHolidays = (attendance as any)?.field || currentMasterHolidays.filter((h: any) => h.type === 'field');
      const currentSiteHolidays = (attendance as any)?.site || currentMasterHolidays.filter((h: any) => h.type === 'site');
      const currentRecurringHolidays = storeRecurringHolidays || [];

      let employeeReports: EmployeeMonthlyData[] = targetUsers.map(user => {
        const uid = String(user.id);
        const userEvents = eventsByUser.get(uid) || [];
        const userLeaves = leavesByUser.get(uid) || [];
        
        // Resolve role name if it's a UUID
        let resolvedRole = user.role;
        if (user.role && user.role.length > 20 && rolesData.length > 0) {
            const roleObj = rolesData.find((r: any) => r.id === user.role);
            if (roleObj) {
                resolvedRole = roleObj.displayName.toLowerCase().replace(/\s+/g, '_');
            }
        }

        return processEmployeeMonth(
          user, 
          userEvents, 
          userLeaves, 
          userHolidaysData || [], 
          year, 
          month, 
          currentOfficeHolidays, 
          currentFieldHolidays, 
          currentSiteHolidays, 
          currentRecurringHolidays,
          leavesData || [], 
          resolvedRole
        );
      });

      if (selectedStatus === 'ACTIVE_USERS') {
          employeeReports = employeeReports.filter(report => report.presentDays > 0 || report.halfDays > 0 || report.threeQuarterDays > 0 || report.quarterDays > 0);
      }

      setReportData(employeeReports);
      if (onDataLoaded) onDataLoaded(employeeReports);
    } catch (error) {
      console.error('Error loading monthly report:', error);
    } finally {
      setLoading(false);
    }
  };

  const processEmployeeMonth = (
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
    resolvedRole?: string
  ): EmployeeMonthlyData => {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = endOfMonth(monthStart);
    const today = startOfToday();
    const effectiveEnd = isAfter(monthEnd, today) ? today : monthEnd;
    const daysInPeriod = effectiveEnd.getDate();
    const dailyData: DailyData[] = [];
    
    let totalGrossWorkDuration = 0, totalNetWorkDuration = 0, totalBreakDuration = 0, totalOT = 0;
    let presentDays = 0, absentDays = 0, halfDays = 0, threeQuarterDays = 0, quarterDays = 0, holidaysCount = 0;
    let leavesCount = 0, floatingHolidays = 0, lossOfPay = 0, holidayPresents = 0, weekendPresents = 0;
    let sickLeaves = 0, earnedLeaves = 0, casualLeaves = 0, compOffs = 0, workFromHomeDays = 0, weekOffs = 0, totalPayableDays = 0, overtimeDays = 0;
    
    const category = getStaffCategory(resolvedRole || user.role, user.organizationId || user.societyId, { attendance });
    const rules = resolveUserRules(user, resolvedRole);
    const threshold = (rules as any)?.weekendPresentThreshold ?? 3;

    // Ensure we use the best available holiday lists (preferring passed ones to avoid stale state)
    const activeOfficeHolidays = passedOfficeHolidays || masterHolidays.filter(h => h.type === 'office');
    const activeFieldHolidays = passedFieldHolidays || masterHolidays.filter(h => h.type === 'field');
    const activeSiteHolidays = passedSiteHolidays || masterHolidays.filter(h => h.type === 'site');
    const activeRecurringHolidays = passedRecurringHolidays || [];

    // Organic initialization from buffer
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
        // 1. Configured & Fixed Holidays
        const isConfiguredHolidayCheck = (category === 'field' ? (rules?.fieldHolidays || []) : (rules?.officeHolidays || [])).some((h: any) => {
            const hVal = String(h.date).split(' ')[0].split('T')[0];
            return hVal === dateStrStr;
        }) || FIXED_HOLIDAYS.some(fh => dateStrStr.endsWith('-' + fh.date));

        // 2. Pool Holidays
        const isPoolHolidayCheck = (userHolidays || []).some((uh: any) => {
            const uhUserId = String(uh.userId || uh.user_id || '').trim().toLowerCase();
            const targetUserId = String(user.id).trim().toLowerCase();
            if (uhUserId !== targetUserId) return false;
            const uhDateRaw = String(uh.holidayDate || uh.holiday_date || '').trim();
            return uhDateRaw.includes(dateStrStr);
        });

        // 3. Recurring Holidays (Blue Leave)
        const checkDayOfMonth = checkDate.getDate();
        const isRecurringCheck = (activeRecurringHolidays || []).some(rule => {
            const ruleDay = String(rule.day || '').toLowerCase();
            if (!rule || ruleDay !== checkDayName.toLowerCase()) return false;
            const occurrence = Math.ceil(checkDayOfMonth / 7);
            const ruleOccurrence = Number(rule.occurrence || rule.n || 0);
            const ruleType = rule.roleType || rule.type || 'office';
            if (ruleType !== category) return false;
            
            // 3rd Saturday Blue Leave applies only to males
            if (ruleDay === 'saturday' && ruleOccurrence === 3) {
                const userRoleLower = (user.role || '').toLowerCase();
                if (userRoleLower !== 'admin' && (user.gender || '').toLowerCase() !== 'male') return false;
            }

            // Apply month gating
            const months = rules?.floatingHolidayMonths || [];
            if (months.length > 0 && !months.includes(checkDate.getMonth())) return false;
            
            return ruleOccurrence === occurrence;
        });

        const isHolidayCheck = isConfiguredHolidayCheck || isPoolHolidayCheck || isRecurringCheck;
        const hasApprovedLeaveCheck = allLeaves.some(l => 
            String(l.userId) === String(user.id) &&
            isWithinInterval(checkDate, { start: startOfDay(new Date(l.startDate)), end: endOfDay(new Date(l.endDate)) }) &&
            !['loss of pay', 'loss-of-pay', 'lop'].includes((l.leaveType || '').toLowerCase())
        );
        const hasActivityCheck = events.some(e => e.timestamp.startsWith(dateStrStr));

        if (hasActivityCheck || hasApprovedLeaveCheck || isHolidayCheck) {
            daysActiveInCurrentWeek++;
            if (hasActivityCheck || isHolidayCheck) {
                daysPresentInCurrentWeek++;
            }
        } else if (hasApprovedLeaveCheck) {
            // WFH should count towards presence threshold for Sunday eligibility
            const wfhLeave = allLeaves.find(l => 
                String(l.userId) === String(user.id) &&
                isWithinInterval(checkDate, { start: startOfDay(new Date(l.startDate)), end: endOfDay(new Date(l.endDate)) }) &&
                (String(l.leaveType || '').toLowerCase().includes('work from home') || String(l.leaveType || '').toLowerCase() === 'wfh')
            );
            if (wfhLeave) {
                daysActiveInCurrentWeek++;
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
      if (['W/P', 'H/P'].includes(s)) return 1.5; 
      if (['P', 'W/O', 'WOP', 'H', 'S/L', 'E/L', 'C/L', 'C/O', '0.5P', 'W/H'].includes(s)) return 1;
      if (s.includes('S/L') || s.includes('E/L') || s.includes('C/L') || s.includes('C/O')) {
          return s.startsWith('1/2') ? 0.5 : 1;
      }
      if (['1/2P', 'Half Day'].includes(s)) return 0.5;
      if (s === '3/4P') return 0.75;
      if (s === '1/4P') return 0.25;
      return 0;
    };

    const updateCounters = (s: string) => {
      const isHalf = s.startsWith('1/2') || s === 'Half Day' || s === '0.5P';
      const inc = isHalf ? 0.5 : 1;

      if (s === 'P') presentDays++;
      else if (s === 'W/P') { presentDays++; weekOffs++; weekendPresents++; }
      else if (s === '3/4P') threeQuarterDays++;
      else if (s === '1/2P' || s === 'Half Day') halfDays++;
      else if (s === '0.5P') { halfDays++; leavesCount += 0.5; }
      else if (s === '1/4P') quarterDays++;
      else if (s === 'A') absentDays++;
      else if (s === 'W/O') weekOffs++;
      else if (s === 'WOP') { weekOffs++; if (statusToCounterActivity) weekendPresents++; }
      else if (s === 'H') holidaysCount++;
      else if (s === 'H/P') { holidaysCount++; presentDays++; holidayPresents++; }
      else if (s.includes('S/L')) { sickLeaves += inc; leavesCount += inc; }
      else if (s.includes('E/L')) { earnedLeaves += inc; leavesCount += inc; }
      else if (s.includes('C/L')) { casualLeaves += inc; leavesCount += inc; }
      else if (s.includes('F/H')) floatingHolidays += inc;
      else if (s.includes('C/O')) { compOffs += inc; leavesCount += inc; }
      else if (s.includes('LOP')) lossOfPay += inc;
      else if (s === 'W/H') workFromHomeDays += inc;
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

    for (let day = 1; day <= daysInPeriod; day++) {
      const currentDate = new Date(year, month - 1, day);
      if (currentDate.getDay() === 1) {
          daysPresentInPreviousWeek = daysActiveInCurrentWeek;
          daysPresentInCurrentWeek = 0;
          daysActiveInCurrentWeek = 0;
      }

      let currentDayInTime = '-', currentDayOutTime = '-', currentDayGrossDuration = '-', currentDayBreakDuration = '-', currentDayNetWorkedHours = '-', currentDayOT = '-', currentDayShortfall = '-', currentDayShift = '-', currentDayBreakIn = '-', currentDayBreakOut = '-';
      let netHours = 0, grossHours = 0, breakHours = 0;
      let fieldResultStatus = '';
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayEvents = eventsByGroup[dateStr] || [];
      const hasActivity = dayEvents.length > 0;
      const isFuture = isAfter(currentDate, startOfDay(new Date()));

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

        currentDayGrossDuration = formatTime(grossHours);
        currentDayNetWorkedHours = formatTime(netHours);
        currentDayBreakDuration = formatTime(breakHours);
        const maxDailyHours = (rules as any).dailyWorkingHours?.max || 9;
        const ot = Math.max(0, netHours - maxDailyHours);
        
        currentDayShortfall = netHours > 0 && netHours < (maxDailyHours * 0.75) ? 'YES' : '-';
        currentDayOT = ot > 0 ? formatTime(ot) : '-';

        if (!isFuture) { 
            totalNetWorkDuration += netHours; 
            totalGrossWorkDuration += grossHours; 
            totalBreakDuration += breakHours;
            totalOT += ot; 
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

      // Only mark WOP if there's an actual punch-in on this day, not just stray events
      const hasPunchInOnDay = dayEvents.some(e => e.type === 'punch-in' || e.type === 'site-ot-in');
      if (status === 'W/O' && hasPunchInOnDay) status = 'WOP';

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
        netWorkedHours: currentDayNetWorkedHours, ot: currentDayOT, shortfall: currentDayShortfall, shift: currentDayShift
      });
    }

    // Add extra bonus for overtime days if site category
    totalPayableDays += overtimeDays;

    return {
      employeeId: user.id, employeeName: user.name, role: user.role, statuses: dailyData.map(d => d.status),
      totalGrossWorkDuration, totalNetWorkDuration, totalBreakDuration, totalOT,
      presentDays, absentDays, weekOffs, holidays: holidaysCount, holidayPresents, weekendPresents,
      halfDays, threeQuarterDays, quarterDays, sickLeaves, earnedLeaves, casualLeaves, floatingHolidays, compOffs,
      lossOfPays: lossOfPay, workFromHomeDays, totalPayableDays,
      averageWorkingHrs: (presentDays + halfDays) > 0 ? totalNetWorkDuration / (presentDays + halfDays) : 0,
      totalDurationPlusOT: totalNetWorkDuration + totalOT,
       shiftCounts, dailyData, 
      present: totalPayableDays,
      absent: absentDays, 
      weeklyOff: weekOffs,
      leaves: leavesCount, 
      lossOfPay, 
      overtimeDays
    };
  };

  const exportToExcel = () => {};

  const isSingleUser = userId && userId !== 'all' && reportData.length > 0;
  const targetEmployeeName = isSingleUser ? reportData[0].employeeName : (userId && userId !== 'all' ? 'Employee Report' : 'ALL EMPLOYEES');
  const targetEmployeeRole = isSingleUser ? reportData[0].role : undefined;

  if (loading) return <div className="p-8 text-center">Loading report...</div>;

  return (
    <div className="p-6 bg-white min-h-screen">
      {!hideHeader && (
        <div className="mb-8 flex justify-between items-start text-gray-900 border-b-[3px] border-gray-950 pb-6">
          <div className="flex flex-col">
            <div className="mt-2 flex flex-col">
              <span className="text-[14px] text-gray-900 font-bold leading-none">{targetEmployeeName}</span>
              {targetEmployeeRole && (
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">{targetEmployeeRole.replace(/_/g, ' ')}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-[24px] font-black tracking-tight text-gray-900 mb-1 leading-none">Monthly Status Report</h2>
            <p className="text-[14px] text-gray-800 font-bold mb-3">Billing Period: {format(new Date(year, month - 1, 1), 'MMMM yyyy')}</p>
            <div className="text-[11px] text-gray-400 space-y-0.5 font-medium mb-4">
               {currentUser && (
                  <>
                    <p>Generated by: {currentUser.name}</p>
                    {currentUser.role && <p className="text-[9px] uppercase">{currentUser.role.replace(/_/g, ' ')}</p>}
                  </>
               )}
               <p>Date: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
            </div>
            <Button onClick={exportToExcel} variant="secondary" className="mt-2"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          </div>
        </div>
      )}

      {reportData.map((employee) => (
        <div key={employee.employeeId} className="mb-10 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="bg-white p-8">
            {/* Header matching image exactly */}
            <div className="mb-6">
                <div className="flex flex-col gap-1.5">
                    <h3 className="text-[17px] font-normal text-gray-900 leading-tight">
                        <span className="font-bold">Name :</span> <span className="font-bold">{employee.employeeName}</span> 
                    </h3>
                    <div className="text-[15px]">
                        <span className="font-normal text-gray-500">Role:</span> <span className="font-medium text-gray-700 capitalize ml-1">{employee.role ? employee.role.replace(/_/g, ' ') : 'Unverified'}</span>
                    </div>
                    <div className="text-[15px]">
                        <span className="font-normal text-gray-500">Billing Cycle:</span> <span className="font-medium text-gray-700 ml-1">{format(new Date(year, month - 1, 1), 'do MMMM')} to {format(endOfMonth(new Date(year, month - 1, 1)), 'do MMMM')}</span>
                    </div>
                </div>
                <div className="mt-5 mb-6 flex flex-wrap xl:flex-nowrap gap-4">
                    {/* Key Time Metrics - Cards */}
                    <div className="flex flex-wrap md:flex-nowrap gap-3">
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-3.5 min-w-[124px] border border-blue-100/60 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-100/50 rounded-full group-hover:scale-125 transition-transform"></div>
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 relative z-10">Net Work</p>
                            <p className="text-2xl font-black text-blue-900 relative z-10 drop-shadow-sm">{employee.totalNetWorkDuration.toFixed(2)}<span className="text-[11px] font-semibold text-blue-700 ml-1">Hrs</span></p>
                        </div>
                        
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3.5 min-w-[124px] border border-emerald-100/60 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-100/50 rounded-full group-hover:scale-125 transition-transform"></div>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 relative z-10">Total OT</p>
                            <p className="text-2xl font-black text-emerald-900 relative z-10 drop-shadow-sm">{employee.totalOT.toFixed(2)}<span className="text-[11px] font-semibold text-emerald-700 ml-1">Hrs</span></p>
                        </div>

                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3.5 min-w-[124px] border border-orange-100/60 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-orange-100/50 rounded-full group-hover:scale-125 transition-transform"></div>
                            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1 relative z-10">Avg Hrs/Day</p>
                            <p className="text-2xl font-black text-orange-900 relative z-10 drop-shadow-sm">{employee.averageWorkingHrs.toFixed(2)}<span className="text-[11px] font-semibold text-orange-700 ml-1">Hrs</span></p>
                        </div>

                        <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-3.5 min-w-[124px] border border-slate-200/60 shadow-sm flex flex-col justify-center relative overflow-hidden">
                            <div className="flex items-end justify-between w-full relative z-10 mb-1.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross</span>
                                <span className="text-sm font-bold text-slate-700">{employee.totalGrossWorkDuration.toFixed(1)}<span className="text-[9px] font-medium ml-0.5">h</span></span>
                            </div>
                            <div className="w-full h-[1px] bg-slate-200 relative z-10"></div>
                            <div className="flex items-end justify-between w-full relative z-10 mt-1.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Break</span>
                                <span className="text-sm font-bold text-slate-700">{employee.totalBreakDuration.toFixed(1)}<span className="text-[9px] font-medium ml-0.5">h</span></span>
                            </div>
                        </div>
                    </div>

                    {/* Day Categories - Badges */}
                    <div className="flex-1 min-w-[320px] rounded-xl bg-slate-50/50 p-4 border border-slate-100 shadow-inner flex flex-col justify-between">
                        <div className="flex justify-between items-center mb-3">
                           <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Attendance Distribution</span>
                           <div className="bg-white px-2.5 py-1 rounded-md shadow-sm border border-slate-200 flex items-center gap-1.5">
                               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payable Days</span>
                               <span className="text-[13px] font-black text-emerald-600">{employee.totalPayableDays}</span>
                           </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md text-[11px] font-bold shadow-sm border border-emerald-200 flex items-center gap-1">
                                Paid Days <span className="bg-emerald-200 text-emerald-900 px-1.5 rounded-sm text-[10px] ml-0.5">{employee.present}</span>
                            </span>
                            {employee.halfDays > 0 && (
                                <span className="px-2.5 py-1 bg-teal-100 text-teal-800 rounded-md text-[11px] font-bold shadow-sm border border-teal-200 flex items-center gap-1">
                                    Half Day <span className="bg-teal-200 text-teal-900 px-1.5 rounded-sm text-[10px] ml-0.5">{employee.halfDays}</span>
                                </span>
                            )}
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-md text-[11px] font-bold shadow-sm border border-rose-200 flex items-center gap-1">
                                Absent <span className="bg-rose-200 text-rose-900 px-1.5 rounded-sm text-[10px] ml-0.5">{employee.absentDays}</span>
                            </span>
                            <span className="px-2.5 py-1 bg-slate-200 text-slate-800 rounded-md text-[11px] font-bold shadow-sm border border-slate-300 flex items-center gap-1">
                                W/O <span className="bg-slate-300 text-slate-900 px-1.5 rounded-sm text-[10px] ml-0.5">{employee.weekOffs}</span>
                            </span>
                            <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-md text-[11px] font-bold shadow-sm border border-indigo-200 flex items-center gap-1">
                                Holiday <span className="bg-indigo-200 text-indigo-900 px-1.5 rounded-sm text-[10px] ml-0.5">{employee.holidays}</span>
                            </span>
                            <span className="px-2.5 py-1 bg-violet-100 text-violet-800 rounded-md text-[11px] font-bold shadow-sm border border-violet-200 flex items-center gap-1">
                                Leave <span className="bg-violet-200 text-violet-900 px-1.5 rounded-sm text-[10px] ml-0.5">{Number(employee.leaves).toFixed(1).replace(/\.0$/, '')}</span>
                            </span>
                            {(employee.floatingHolidays > 0) && (
                                <span className="px-2.5 py-1 bg-fuchsia-100 text-fuchsia-800 rounded-md text-[11px] font-bold shadow-sm border border-fuchsia-200 flex items-center gap-1">
                                    F/H <span className="bg-fuchsia-200 text-fuchsia-900 px-1.5 rounded-sm text-[10px] ml-0.5">{employee.floatingHolidays}</span>
                                </span>
                            )}
                            {(employee.lossOfPays > 0) && (
                                <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-md text-[11px] font-bold shadow-sm border border-red-200 flex items-center gap-1">
                                    LOP <span className="bg-red-200 text-red-900 px-1.5 rounded-sm text-[10px] ml-0.5">{employee.lossOfPays}</span>
                                </span>
                            )}
                            {employee.workFromHomeDays > 0 && (
                                <span className="px-2.5 py-1 bg-teal-100 text-teal-800 rounded-md text-[11px] font-bold shadow-sm border border-teal-200 flex items-center gap-1">
                                    W/H <span className="bg-teal-200 text-teal-900 px-1.5 rounded-sm text-[10px] ml-0.5">{employee.workFromHomeDays}</span>
                                </span>
                            )}
                        </div>
                        
                        {Object.keys(employee.shiftCounts).length > 0 && (
                            <div className="mt-3 text-[11px] flex items-center gap-2">
                                <span className="font-bold text-slate-400 uppercase tracking-wider">Shifts:</span>
                                <div className="flex gap-1.5 flex-wrap">
                                    {Object.entries(employee.shiftCounts).map(([s, c], i) => (
                                        <span key={s} className="bg-white px-2 py-0.5 rounded shadow-sm border border-slate-200 text-slate-600 font-medium">
                                            {s} <span className="text-slate-400 font-light ml-0.5">({c})</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-sm shadow-sm">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-1 px-1 font-semibold text-gray-700 text-[10px] w-16 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">Status</th>
                      {employee.dailyData.map(d => (
                        <th key={d.date} className="p-0.5 text-center font-normal text-gray-500 text-[9px] w-[3%] border-r border-slate-200 last:border-r-0">{d.date}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-[8.5px] tracking-tighter text-gray-700 whitespace-nowrap">
                    <tr className="bg-white border-b border-slate-100">
                      <td className="py-1 px-1 font-semibold text-gray-700 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">Status</td>
                      {employee.dailyData.map(d => (
                        <td key={d.date} className="p-0 text-center border-r border-slate-100 last:border-r-0">
                            <span className={`inline-flex items-center justify-center w-full min-h-[18px] font-bold text-[9px] ${
                                d.status === 'P' ? 'bg-emerald-50 text-emerald-700' :
                                d.status === '0.5P' || d.status === '1/2P' ? 'bg-gradient-to-r from-emerald-100 to-blue-100 text-blue-800' :
                                d.status === 'A' ? 'bg-rose-50 text-rose-600' :
                                d.status === 'W/O' || d.status === 'WOP' ? 'bg-slate-50 text-slate-600' :
                                d.status === 'W/P' ? 'bg-blue-50 text-blue-700' :
                                d.status === 'H' || d.status === 'H/P' ? 'bg-indigo-50 text-indigo-700' :
                                d.status.includes('S/L') ? 'bg-purple-50 text-purple-700' :
                                d.status.includes('E/L') ? 'bg-blue-50 text-blue-700' :
                                d.status.includes('C/O') ? 'bg-teal-50 text-teal-700' :
                                d.status.includes('LOP') ? 'bg-red-50 text-red-700' :
                                d.status === 'W/H' ? 'bg-teal-50 text-teal-700' :
                                'text-gray-500'
                            }`}>
                                {d.status}
                            </span>
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-white border-b border-slate-100">
                      <td className="py-0.5 px-1 font-medium text-gray-600 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">InTime</td>
                      {employee.dailyData.map(d => <td key={d.date} className="p-0.5 text-center border-r border-slate-100 last:border-r-0">{d.inTime !== '-' ? d.inTime : '-'}</td>)}
                    </tr>
                    <tr className="bg-white border-b border-slate-100">
                      <td className="py-0.5 px-1 font-medium text-gray-600 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">OutTime</td>
                      {employee.dailyData.map(d => <td key={d.date} className="p-0.5 text-center border-r border-slate-100 last:border-r-0">{d.outTime !== '-' ? d.outTime : '-'}</td>)}
                    </tr>
                    <tr className="bg-white border-b border-slate-100">
                      <td className="py-0.5 px-1 font-medium text-gray-600 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">Gross Dur</td>
                      {employee.dailyData.map(d => <td key={d.date} className="p-0.5 text-center border-r border-slate-100 last:border-r-0">{d.grossDuration !== '0:00' ? d.grossDuration : '-'}</td>)}
                    </tr>
                    <tr className="bg-white border-b border-slate-100">
                      <td className="py-0.5 px-1 font-medium text-gray-600 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">Break In</td>
                      {employee.dailyData.map(d => <td key={d.date} className="p-0.5 text-center border-r border-slate-100 last:border-r-0">{d.breakIn !== '-' ? d.breakIn : '-'}</td>)}
                    </tr>
                    <tr className="bg-white border-b border-slate-100">
                      <td className="py-0.5 px-1 font-medium text-gray-600 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">Break Out</td>
                      {employee.dailyData.map(d => <td key={d.date} className="p-0.5 text-center border-r border-slate-100 last:border-r-0">{d.breakOut !== '-' ? d.breakOut : '-'}</td>)}
                    </tr>
                    <tr className="bg-white border-b border-slate-100">
                      <td className="py-0.5 px-1 font-medium text-gray-600 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">Break Dur</td>
                      {employee.dailyData.map(d => <td key={d.date} className="p-0.5 text-center border-r border-slate-100 last:border-r-0">{d.breakDuration !== '0:00' ? d.breakDuration : '-'}</td>)}
                    </tr>
                    <tr className="bg-white border-b border-slate-200">
                      <td className="py-0.5 px-1 font-semibold text-gray-800 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">Net Worked</td>
                      {employee.dailyData.map(d => <td key={d.date} className="p-0.5 text-center border-r border-slate-100 last:border-r-0">{d.netWorkedHours !== '0:00' ? d.netWorkedHours : '-'}</td>)}
                    </tr>
                    <tr className="bg-white border-b border-slate-100">
                      <td className="py-0.5 px-1 font-medium text-gray-600 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">OT</td>
                      {employee.dailyData.map(d => <td key={d.date} className="p-0.5 text-center border-r border-slate-100 last:border-r-0">{d.ot}</td>)}
                    </tr>
                    <tr className="bg-white border-b border-slate-100">
                      <td className="py-0.5 px-1 font-medium text-gray-500 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">Shortfall</td>
                      {employee.dailyData.map(d => <td key={d.date} className="p-0.5 text-center border-r border-slate-100 last:border-r-0">{d.shortfall}</td>)}
                    </tr>
                    <tr className="bg-white">
                      <td className="py-0.5 px-1 font-medium text-gray-600 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">Shift</td>
                      {employee.dailyData.map(d => (
                         <td key={d.date} className="p-0.5 text-center text-[7.5px] border-r border-slate-100 last:border-r-0 overflow-hidden text-ellipsis">
                            {d.shift !== '-' ? (
                                d.shift.replace('Shift ', '').substring(0, 4)
                            ) : '-'}
                         </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
            </div>
          </div>
          
          <div className="bg-gray-50/50 px-5 py-2 border-t border-gray-100">
             <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-medium text-gray-500 uppercase tracking-widest">
                <span>Avg Working Hours: <b className="text-gray-900">{employee.averageWorkingHrs.toFixed(1)}h</b></span>
                <span>Site Presence Score: <b className="text-green-600">{((employee.presentDays / employee.dailyData.length) * 100).toFixed(0)}%</b></span>
                <span>Shift Distribution: <b className="text-gray-900">{Object.entries(employee.shiftCounts).map(([s, c]) => `${s}(${c})`).join(' ')}</b></span>
             </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MonthlyHoursReport;
