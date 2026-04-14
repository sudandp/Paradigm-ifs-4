import React, { useState, useEffect } from 'react';
import { format, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, isAfter, isSameDay, isWithinInterval, endOfDay, startOfWeek } from 'date-fns';
import { Download } from 'lucide-react';
import { api } from '../../services/api';
import { processDailyEvents, calculateWorkingHours, isLateCheckIn, isEarlyCheckOut, evaluateAttendanceStatus, getStaffCategory } from '../../utils/attendanceCalculations';
import { getFieldStaffStatus } from '../../utils/fieldStaffTracking';
import type { AttendanceEvent, User, StaffAttendanceRules, UserHoliday, FieldAttendanceViolation } from '../../types';
import Button from '../ui/Button';
import { useSettingsStore } from '../../store/settingsStore';
import { FIXED_HOLIDAYS } from '../../utils/constants';

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
}

const MonthlyHoursReport: React.FC<MonthlyHoursReportProps> = ({ 
  month, year, userId, data: externalData, hideHeader, scopedSettings = [],
  selectedStatus = 'all', selectedSite = 'all', selectedSociety = 'all', selectedRole = 'all'
}) => {
  const [reportData, setReportData] = useState<EmployeeMonthlyData[]>([]);
  const [loading, setLoading] = useState(!externalData);
  const [users, setUsers] = useState<User[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]); // New state for leaves
  const [userHolidaysPool, setUserHolidaysPool] = useState<UserHoliday[]>([]);
  const { attendance, officeHolidays, fieldHolidays, siteHolidays, recurringHolidays } = useSettingsStore();

  const resolveUserRules = (user: User) => {
    const userCategory = getStaffCategory(user.role, user.organizationId, { 
      attendance, 
      missedCheckoutConfig: (attendance as any).missedCheckoutConfig 
    });
    
    // Check if there are scoped settings for this entity or company
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
    } else {
      loadReportData();
    }
  }, [month, year, userId, externalData, selectedStatus, selectedSite, selectedSociety, selectedRole]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      // 1. Fetch auxiliary data in parallel
      const [usersData, leavesDataResponse, userHolidaysData] = await Promise.all([
        api.getUsers(),
        api.getLeaveRequests(),
        api.getAllUserHolidays()
      ]);

      const leavesData = leavesDataResponse?.data || [];
      setUsers(usersData);
      setLeaves(leavesData);
      setUserHolidaysPool(userHolidaysData || []);

      // 2. Filter target users based on props
      let targetUsers = usersData;
      if (userId && userId !== 'all') {
        targetUsers = usersData.filter(u => u.id === userId);
      } else {
        if (selectedRole !== 'all') targetUsers = targetUsers.filter(u => u.role === selectedRole);
        if (selectedSite !== 'all') targetUsers = targetUsers.filter(u => u.organizationId === selectedSite);
        if (selectedSociety !== 'all') targetUsers = targetUsers.filter(u => u.societyId === selectedSociety);
        
        // Use global isActive flag for Active Users Only filter initial filter
        if (selectedStatus === 'ACTIVE_USERS') {
          targetUsers = targetUsers.filter(u => (u as any).isActive !== false);
        }
      }

      // 3. Fetch ALL attendance events for the site/duration in ONE call (Performance Optimization)
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));
      const fetchStartDate = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday buffer
      
      const allEvents = await api.getAllAttendanceEvents(
        format(fetchStartDate, 'yyyy-MM-dd'), 
        format(endDate, 'yyyy-MM-dd HH:mm:ss')
      );

      // 4. Pre-filter exclusions for Management (consistent with dashboard)
      if (userId === undefined || userId === 'all') {
        targetUsers = targetUsers.filter(u => u.role !== 'management');
      }

      // 5. Process data locally for each user using the bulk-fetched events
      let employeeReports: EmployeeMonthlyData[] = targetUsers.map(user => {
        const userEvents = allEvents.filter(e => String(e.userId) === String(user.id));
        const userLeaves = leavesData.filter((l: any) => String(l.userId) === String(user.id) && (l.status === 'approved' || l.leaveStatus === 'approved'));
        
        // Process days locally (no more per-user API calls in the loop)
        return processEmployeeMonth(user, userEvents, userLeaves, userHolidaysData || [], year, month, [], leavesData);
      });

      // 6. FINAL ACTIVITY FILTER: "Active Users Only" must have at least one Present day if selected
      if (selectedStatus === 'ACTIVE_USERS') {
          employeeReports = employeeReports.filter(report => {
              // Defined as having at least one day of tracked attendance (Present, Half Day, etc.)
              // The user said: "if user p for 1 or more they will be active"
              return report.presentDays > 0 || report.halfDays > 0 || report.threeQuarterDays > 0 || report.quarterDays > 0;
          });
      }

      setReportData(employeeReports);
    } catch (error) {
      console.error('Error loading monthly report:', error);
    } finally {
      setLoading(false);
    }
  };

  const processEmployeeMonth = (user: User, events: AttendanceEvent[], userLeaves: any[], userHolidays: any[], year: number, month: number, fieldViolations: FieldAttendanceViolation[] = [], allLeaves: any[] = []): EmployeeMonthlyData => {
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    const dailyData: DailyData[] = [];
    
    let totalGrossWorkDuration = 0;
    let totalNetWorkDuration = 0;
    let totalBreakDuration = 0;
    let totalOT = 0;
    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let threeQuarterDays = 0;
    let quarterDays = 0;
    let holidaysCount = 0;
    const leavesCount = 0;
    let floatingHolidays = 0;
    let lossOfPay = 0;
    let holidayPresents = 0;
    let weekendPresents = 0;
    let sickLeaves = 0;
    let earnedLeaves = 0;
    let compOffs = 0;
    const workFromHomeDays = 0;

    let weekOffs = 0; 

    const shiftCounts: { [key: string]: number } = {};
    let daysPresentInWeek = 0;

    const category = getStaffCategory(user.role);
    const rules = attendance[category];
    const categoryHolidays = category === 'office' ? officeHolidays : category === 'field' ? fieldHolidays : siteHolidays;

  // Helper for robust holiday/leave date matching
  const matchesDate = (targetDate: any, compareDay: Date) => {
    if (!targetDate) return false;
    try {
      const compareStr = format(compareDay, 'yyyy-MM-dd');
      const compareMMDD = format(compareDay, '-MM-dd');
      
      if (typeof targetDate === 'string') {
        // 1. Try exact full date match
        if (targetDate.includes(compareStr)) return true;

        // 2. Try partial MM-DD match (Year agnostic)
        if (targetDate.includes(compareMMDD)) return true;
        if (targetDate.endsWith(compareMMDD)) return true;

        if (targetDate.startsWith('-')) {
          return compareStr.endsWith(targetDate);
        }
        
        const cleanDate = targetDate.split(' ')[0].split('T')[0];
        return cleanDate === compareStr;
      }
      
      // 2. If it's a Date object
      if (targetDate instanceof Date) {
        return format(targetDate, 'yyyy-MM-dd') === compareStr;
      }
      
      return false;
    } catch (e) {
      return false;
    }
  };

    // PRE-CALCULATE daysPresentInWeek for the first week if it started in the previous month
    const monthStartDate = new Date(year, month - 1, 1);
    const weekStartDate = startOfWeek(monthStartDate, { weekStartsOn: 1 }); // Monday
    
    if (isAfter(monthStartDate, weekStartDate)) {
        let checkDate = weekStartDate;
        while (isAfter(monthStartDate, checkDate) && !isSameDay(monthStartDate, checkDate)) {
            const dateStr = format(checkDate, 'yyyy-MM-dd');
            const checkDayName = format(checkDate, 'EEEE').toLowerCase();
            const checkIsWeekend = checkDate.getDay() === 0;

            if (checkIsWeekend) {
                daysPresentInWeek = 0;
            } else {
                const dayEvents = events.filter(e => e.timestamp.startsWith(dateStr));
                
                // 1. Activity check - any activity counts as presence
                const hasActivityCheck = dayEvents.length > 0;

                // 2. Holiday check
                const isFixedHolidayCheck = FIXED_HOLIDAYS.some(fh => {
                    const [m, d] = fh.date.split('-').map(Number);
                    return checkDate.getMonth() === (m - 1) && checkDate.getDate() === d;
                });
                const isConfiguredHolidayCheck = categoryHolidays.some(h => matchesDate(h.date, checkDate));
                const isRecurringHolidayCheck = (user.gender?.toLowerCase() !== 'female') && recurringHolidays.some(rule => {
                    if (rule.day.toLowerCase() !== checkDayName) return false;
                    const occurrence = Math.ceil(checkDate.getDate() / 7);
                    const ruleType = rule.type || 'office';
                    return rule.n === occurrence && ruleType === (category === 'site' ? 'office' : category);
                });

                // 3. Leave check
                const hasApprovedLeaveCheck = userLeaves.some((l: any) => {
                    const startStr = l.startDate || l.date || l.leave_date;
                    const endStr = l.endDate || l.date || l.leave_date;
                    if (!startStr || !endStr) return false;
                    return isWithinInterval(checkDate, { start: startOfDay(new Date(startStr)), end: endOfDay(new Date(endStr)) }) &&
                    l.status === 'approved' &&
                    !['loss of pay', 'loss-of-pay', 'lop'].includes((l.leaveType || l.leave_type || '').toLowerCase());
                });

                const isPoolHolidayCheck = userHolidays.some(uh => {
                    const uhUserId = uh.userId || (uh as any).user_id;
                    const holidayDate = uh.holidayDate || (uh as any).holiday_date;
                    return String(uhUserId) === String(user.id) && matchesDate(holidayDate, checkDate);
                });

                if (hasActivityCheck || isFixedHolidayCheck || isConfiguredHolidayCheck || isRecurringHolidayCheck || hasApprovedLeaveCheck || isPoolHolidayCheck) {
                    daysPresentInWeek++;
                }
            }
            checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
        }
    }

    // Process each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      const isSunday = currentDate.getDay() === 0; // 0 = Sunday
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.timestamp.startsWith(dateStr));
      
      const approvedLeave = userLeaves.find((l: any) => {
          const startStr = l.startDate || l.date || l.leave_date;
          const endStr = l.endDate || l.date || l.leave_date;
          if (!startStr || !endStr) return false;
          return isWithinInterval(currentDate, {
              start: startOfDay(new Date(startStr)),
              end: endOfDay(new Date(endStr))
          });
      });

      // 1. Check holidays
      const isFixedHoliday = FIXED_HOLIDAYS.some(fh => {
          const [m, d] = fh.date.split('-').map(Number);
          return currentDate.getMonth() === (m - 1) && currentDate.getDate() === d;
      });

      const isPoolHoliday = userHolidays.some(uh => {
          const uhUserId = uh.userId || (uh as any).user_id;
          const holidayDate = uh.holidayDate || (uh as any).holiday_date;
          return String(uhUserId) === String(user.id) && matchesDate(holidayDate, currentDate);
      });

      const isConfiguredHoliday = categoryHolidays.some(h => matchesDate(h.date, currentDate));

      const isRecurringHoliday = recurringHolidays.some(rule => {
          if (rule.day.toLowerCase() !== format(currentDate, 'EEEE').toLowerCase()) return false;
          if (rules.floatingLeavesExpiryDate) {
              const expiryDate = startOfDay(new Date(rules.floatingLeavesExpiryDate));
              if (startOfDay(currentDate) > expiryDate) return false;
          }
          const occurrence = Math.ceil(currentDate.getDate() / 7);
          const ruleType = rule.type || 'office';
          return rule.n === occurrence && ruleType === (category === 'site' ? 'office' : category); 
      });

      // Centralized Status Logic
      let status = evaluateAttendanceStatus({
        day: currentDate,
        userId: user.id,
        userCategory: category,
        userRules: rules,
        dayEvents,
        officeHolidays,
        fieldHolidays,
        siteHolidays,
        recurringHolidays,
        userHolidaysPool,
        leaves: allLeaves.length > 0 ? allLeaves : leaves, // Use passed pool or fallback to state
        daysPresentInWeek
      });

      if (status.includes('P') || status === 'Present' || status === 'Half Day' || status === 'H' || (status.includes('L') && !status.includes('1/2A') && status !== 'A')) {
        const increment = (status.includes('1/2') || status === 'Half Day') ? 0.5 : 1;
        daysPresentInWeek += increment;
      }

      const isHoliday = isFixedHoliday || isPoolHoliday || isConfiguredHoliday;
      const hasActivity = dayEvents.length > 0;
      const today = startOfDay(new Date());
      const isFuture = isAfter(currentDate, today);
      const isToday = isSameDay(currentDate, today);

      // Reset daysPresentInWeek on Monday
      if (currentDate.getDay() === 1) daysPresentInWeek = 0;

      let currentDayInTime = '-';
      let currentDayOutTime = '-';
      let currentDayGrossDuration = '-';
      let currentDayBreakIn = '-';
      let currentDayBreakOut = '-';
      let currentDayBreakDuration = '-';
      let currentDayNetWorkedHours = '-';
      let currentDayOT = '-';
      let currentDayShortfall = '-';
      let currentDayShift = '-';

      const formatTime = (hrs: number) => {
        const totalMinutes = Math.round(hrs * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h}:${String(m).padStart(2, '0')}`;
      };

      if (approvedLeave) {
          const isHalfDayLeave = approvedLeave.dayOption === 'half';
          const increment = isHalfDayLeave ? 0.5 : 1;
          const leaveType = (approvedLeave.leaveType || (approvedLeave as any).leave_type || '').toLowerCase();
          const isLOP = ['loss of pay', 'loss-of-pay', 'lop'].includes(leaveType);
          
          if (leaveType === 'sick' || leaveType === 'sick leave') {
              sickLeaves += increment;
          } else if (leaveType === 'comp off' || leaveType === 'comp-off' || leaveType === 'compoff' || leaveType === 'c/o') {
              compOffs++; 
          } else if (leaveType === 'floating' || leaveType === 'floating holiday') {
              floatingHolidays += increment;
          } else if (isLOP) {
              lossOfPay += increment; 
          } else {
              earnedLeaves += increment;
          }

          if (isHalfDayLeave && hasActivity) {
            const { 
              checkIn, checkOut, firstBreakIn, lastBreakIn, workingHours: netHours, breakHours, totalHours: grossHours 
            } = processDailyEvents(dayEvents);
    
            totalNetWorkDuration += netHours;
            totalGrossWorkDuration += grossHours;
            totalBreakDuration += breakHours;
            
            if (netHours >= 4) {
               status = 'P ' + status;
               presentDays += 0.5;
            } else if (netHours > 0) {
               status = '1/2P ' + status;
            }

            currentDayInTime = checkIn ? format(new Date(checkIn), 'HH:mm') : '-';
            currentDayOutTime = checkOut ? format(new Date(checkOut), 'HH:mm') : '-';
            currentDayGrossDuration = grossHours > 0 ? formatTime(grossHours) : '-';
            currentDayBreakIn = firstBreakIn ? format(new Date(firstBreakIn), 'HH:mm') : '-';
            currentDayBreakOut = (processDailyEvents(dayEvents) as any).breakOut ? format(new Date((processDailyEvents(dayEvents) as any).breakOut), 'HH:mm') : '-';
            currentDayBreakDuration = breakHours > 0 ? formatTime(breakHours) : '-';
            currentDayNetWorkedHours = netHours > 0 ? formatTime(netHours) : '-';
            
            const targetNetHours = 4;
            const shortfall = Math.max(0, targetNetHours - netHours);
            currentDayShortfall = (shortfall > 0 && netHours > 0) ? formatTime(shortfall) : '-';
            
            const maxDailyHours = rules.dailyWorkingHours?.max || 9;
            const ot = Math.max(0, netHours - (maxDailyHours / 2));
            totalOT += ot;
            currentDayOT = ot > 0 ? formatTime(ot) : '-';
          }
      } else if (isHoliday) {
          if (!isFuture) {
              if (hasActivity) holidayPresents++;
              else holidaysCount++;
          }
      } else if (isRecurringHoliday) {
          if (!isFuture) {
              if (hasActivity) holidayPresents++;
              else floatingHolidays++;
          }
      } else if (hasActivity) {
        let { 
          checkIn, checkOut, firstBreakIn, lastBreakIn, workingHours: netHours, breakHours, totalHours: grossHours 
        } = processDailyEvents(dayEvents);

        const lastBreakOut = (processDailyEvents(dayEvents) as any).breakOut;
        const duration = netHours;
        currentDayBreakIn = firstBreakIn ? format(new Date(firstBreakIn), 'HH:mm') : '-';
        currentDayBreakOut = lastBreakOut ? format(new Date(lastBreakOut), 'HH:mm') : '-';
        let dailyOt = 0;
        if (checkIn && checkOut) {
          const maxDailyHours = rules.dailyWorkingHours?.max || 9;
          dailyOt = Math.max(0, netHours - maxDailyHours);
          
          // Only accumulate here if not a site-tracked category
          // Site-tracked staff will accumulate in their specific block below
          if (category !== 'field' && category !== 'site') {
            totalNetWorkDuration += duration;
            totalGrossWorkDuration += grossHours;
            totalBreakDuration += breakHours;
          }
        }

        const isDetailedPresent = (checkIn && checkOut) || isToday;
        const shiftThreshold = rules.dailyWorkingHours?.max || 8;

        // Determine if it's a full day or half day for counting
        // Buffer: 15-minute grace window for full day (7h 45m+ counts as full day)
        const isFullDay = netHours >= (shiftThreshold - 0.25);

        // Determine shift type
        let shift = '-';
        if (checkIn) {
          const checkInDate = new Date(checkIn);
          const hour = checkInDate.getHours();
          const minutes = checkInDate.getMinutes();
          const timeVal = hour + minutes / 60;

          if (timeVal >= 5 && timeVal < 8.5) { shift = 'Shift A'; }
          else if (timeVal >= 8.5 && timeVal < 11.5) { shift = 'GS'; }
          else if (timeVal >= 11.5 && timeVal < 20) { shift = 'Shift B'; }
          else { shift = 'Shift C'; }
        }
        if (shift !== '-') {
          shiftCounts[shift] = (shiftCounts[shift] || 0) + 1;
        }

        // --- STATUS DETERMINATION ---
        if (isSunday) {
            status = 'WOP';
            if (!isFuture) weekendPresents++;
        } else if ((category === 'field' || category === 'site') && rules.enableSiteTimeTracking) {
            const fieldViolation = fieldViolations.find(v => format(new Date(v.date), 'yyyy-MM-dd') === dateStr);
            const fieldResult = getFieldStaffStatus(dayEvents, rules, fieldViolation || undefined, user.role);
            
            // Synchronize durations with field tracking findings
            netHours = fieldResult.breakdown.totalActiveMinutes / 60;
            grossHours = fieldResult.breakdown.totalHours;
            breakHours = (fieldResult.breakdown.totalHours * 60 - fieldResult.breakdown.totalActiveMinutes) / 60;
            
            // For site tracking, we still ensure they worked at least the half day minimum
            if (isDetailedPresent) {
               status = fieldResult.status;
            } else {
               status = 'A';
            }
            
            // Update accumulators with corrected site hours
            totalNetWorkDuration += netHours;
            totalGrossWorkDuration += grossHours;
            totalBreakDuration += breakHours;
        } else {
            if (isDetailedPresent) {
                if (isFullDay) {
                    // status already set
                } else if (netHours >= (rules.minimumHoursHalfDay || 4)) {
                    // status already set
                }
            }
        }

        if (status === 'P') presentDays++;
        else if (status === '3/4P') threeQuarterDays++;
        else if (status === '1/2P') halfDays++;
        else if (status === '1/4P') quarterDays++;
        else if (status === 'A') absentDays++;

        currentDayInTime = checkIn ? format(new Date(checkIn), 'HH:mm') : '-';
        currentDayOutTime = checkOut ? format(new Date(checkOut), 'HH:mm') : '-';
        currentDayGrossDuration = grossHours > 0 ? formatTime(grossHours) : '-';
        currentDayBreakDuration = breakHours > 0 ? formatTime(breakHours) : '-';
        currentDayNetWorkedHours = netHours > 0 ? formatTime(netHours) : '-';
        
        const currentOt = Math.max(0, netHours - (rules.dailyWorkingHours?.max || 9));
        totalOT += currentOt;
        currentDayOT = currentOt > 0 ? formatTime(currentOt) : '-';
        
        const targetNetHours = 8;
        const targetShortfallHours = shiftThreshold * 0.75;
        const shortfall = Math.max(0, targetShortfallHours - netHours);
        currentDayShortfall = (shortfall > 0 && netHours > 0 && !isSunday && !isHoliday && !isRecurringHoliday) ? formatTime(shortfall) : '-';
        
        if (checkIn) {
          const checkInDate = new Date(checkIn);
          const hour = checkInDate.getHours();
          const timeVal = hour + checkInDate.getMinutes() / 60;
          currentDayShift = timeVal >= 5 && timeVal < 8.5 ? 'Shift A' : timeVal >= 8.5 && timeVal < 11.5 ? 'GS' : timeVal >= 11.5 && timeVal < 20 ? 'Shift B' : 'Shift C';
          shiftCounts[currentDayShift] = (shiftCounts[currentDayShift] || 0) + 1;
        }

      } else if (status === 'W/O' || status === 'W/P') {
          if (!isFuture) {
              weekOffs++;
          }
          daysPresentInWeek = 0; // Reset
      } else {
          // status already set by evaluateAttendanceStatus
      }

      dailyData.push({
        date: day,
        status,
        inTime: currentDayInTime,
        outTime: currentDayOutTime,
        grossDuration: currentDayGrossDuration,
        breakIn: currentDayBreakIn,
        breakOut: currentDayBreakOut,
        breakDuration: currentDayBreakDuration,
        netWorkedHours: currentDayNetWorkedHours,
        ot: currentDayOT,
        shortfall: currentDayShortfall,
        shift: currentDayShift,
      });
    }

    const totalPayableDays = presentDays + (halfDays * 0.5) + (quarterDays * 0.25) + (threeQuarterDays * 0.75) + holidaysCount + weekOffs + leavesCount;
      
      return {
        employeeId: user.id,
        employeeName: user.name,
        role: user.role,
        totalGrossWorkDuration,
        totalNetWorkDuration,
        totalBreakDuration,
        totalOT,
        presentDays,
        absentDays,
        halfDays,
        threeQuarterDays,
        quarterDays,
        weekOffs,
        holidays: holidaysCount,
        holidayPresents,
        weekendPresents,
        sickLeaves,
        earnedLeaves,
        floatingHolidays,
        compOffs,
        lossOfPays: lossOfPay,
        workFromHomeDays,
        totalPayableDays,
        averageWorkingHrs: presentDays + halfDays + threeQuarterDays + quarterDays > 0 ? totalNetWorkDuration / (presentDays + halfDays + threeQuarterDays + quarterDays) : 0,
        totalDurationPlusOT: totalNetWorkDuration + totalOT,
        shiftCounts,
        dailyData,
        present: presentDays + (halfDays * 0.5) + (quarterDays * 0.25) + (threeQuarterDays * 0.75),
        absent: absentDays,
        weeklyOff: weekOffs,
        leaves: leavesCount,
        lossOfPay: lossOfPay,
        statuses: dailyData.map(d => d.status)
      };
  };

  const exportToExcel = () => {
    // TODO: Implement Excel export using your existing excelExport utility
  };

  if (loading) {
    return <div className="p-8 text-center">Loading report...</div>;
  }

  return (
    <div className="p-6 bg-white min-h-screen">
      {!hideHeader && (
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Monthly Status Report (Detailed Work Duration)</h2>
            <p className="text-gray-600">
              {format(new Date(year, month - 1, 1), 'MMM dd yyyy')} To {format(new Date(year, month - 1, getDaysInMonth(new Date(year, month - 1))), 'MMM dd yyyy')}
            </p>
          </div>
          <Button onClick={exportToExcel}>
            <Download className="mr-2 h-4 w-4" /> Download CSV
          </Button>
        </div>
      )}

      {reportData.map((employee) => (
        <div key={employee.employeeId} className="mb-12 border border-gray-300 rounded-lg p-6 bg-white">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Employee: {employee.employeeId} - {employee.employeeName} 
              <span className="ml-4 text-gray-600 font-normal">Role: {employee.role}</span>
            </h3>
            <div className="text-sm text-gray-700 mt-2">
              <p>
                Total Gross Work Duration: {employee.totalGrossWorkDuration.toFixed(2)} Hrs, 
                Total Net Work Duration: {employee.totalNetWorkDuration.toFixed(2)} Hrs, 
                Total Break Time: {employee.totalBreakDuration.toFixed(2)} Hrs,
                Total OT: {employee.totalOT.toFixed(2)} Hrs
              </p>
              <p>
                Present: {employee.presentDays}, Half Days: {employee.halfDays}, Absent: {employee.absentDays}, WeeklyOff: {employee.weekOffs}, 
                Holidays: {employee.holidays}, Leaves: {employee.leaves}, F/H: {employee.floatingHolidays}, 
                LOP: {employee.lossOfPay}, HP: {employee.holidayPresents}, WOP: {employee.weekendPresents},
                Total Payable Days: {employee.totalPayableDays}
              </p>
              <p>
                Average Working Hrs: {employee.averageWorkingHrs.toFixed(2)} Hrs
              </p>
              <p>
                Shift Count: {Object.entries(employee.shiftCounts).map(([shift, count]) => `${shift} ${count}`).join(' ')}
              </p>
            </div>
          </div>

          {/* Daily grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse border border-gray-300">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="p-2 text-left font-semibold bg-gray-200 text-gray-900 border-r border-gray-300">Status</th>
                  {employee.dailyData.map((day) => (
                    <th key={day.date} className="p-1 text-center font-normal border-l border-gray-300 bg-white text-gray-900">{day.date}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-semibold bg-gray-200 text-gray-900 border-r border-gray-300">Status</td>
                  {employee.dailyData.map((day) => (
                    <td key={day.date} className="p-1 text-center border-l border-gray-300 font-bold text-gray-900">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                day.status === 'P' ? 'bg-green-100 text-green-700' :
                                                day.status === '3/4P' ? 'bg-emerald-100 text-emerald-700' :
                                                day.status === '1/2P' ? 'bg-yellow-100 text-yellow-700' :
                                                day.status === '1/4P' ? 'bg-orange-100 text-orange-700' :
                                                day.status === 'A' ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                                {day.status}
                                            </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-semibold bg-gray-200 text-gray-900 border-r border-gray-300">InTime</td>
                  {employee.dailyData.map((day) => (
                    <td key={day.date} className="p-1 text-center border-l border-gray-300 text-gray-900">{day.inTime}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-semibold bg-gray-200 text-gray-900 border-r border-gray-300">OutTime</td>
                  {employee.dailyData.map((day) => (
                    <td key={day.date} className="p-1 text-center border-l border-gray-300 text-gray-900">{day.outTime}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-semibold bg-gray-200 text-gray-900 border-r border-gray-300 whitespace-nowrap">Gross Dur</td>
                  {employee.dailyData.map((day) => (
                    <td key={day.date} className="p-1 text-center border-l border-gray-300 text-gray-900">{day.grossDuration}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-semibold bg-gray-200 text-gray-900 border-r border-gray-300 whitespace-nowrap">Break In</td>
                  {employee.dailyData.map((day) => (
                    <td key={day.date} className="p-1 text-center border-l border-gray-300 text-gray-900">{day.breakIn}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-semibold bg-gray-200 text-gray-900 border-r border-gray-300">Break Out</td>
                  {employee.dailyData.map((day) => (
                    <td key={day.date} className="p-1 text-center border-l border-gray-300 text-gray-900">{day.breakOut}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-semibold bg-gray-200 text-gray-900 border-r border-gray-300 whitespace-nowrap">Break Dur</td>
                  {employee.dailyData.map((day) => (
                    <td key={day.date} className="p-1 text-center border-l border-gray-300 text-gray-900">{day.breakDuration}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-semibold bg-gray-200 text-gray-900 border-r border-gray-300 whitespace-nowrap">Net Worked Hrs</td>
                  {employee.dailyData.map((day) => (
                    <td key={day.date} className="p-1 text-center border-l border-gray-300 text-gray-900">{day.netWorkedHours}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-semibold bg-gray-200 text-gray-900 border-r border-gray-300 whitespace-nowrap">OT</td>
                  {employee.dailyData.map((day) => (
                    <td key={day.date} className="p-1 text-center border-l border-gray-300 text-gray-900">{day.ot}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-semibold bg-gray-200 text-gray-900 border-r border-gray-300 whitespace-nowrap">Shortfall (75%)</td>
                  {employee.dailyData.map((day) => (
                    <td key={day.date} className={`p-1 text-center border-l border-gray-300 ${day.shortfall !== '-' ? 'text-red-500 font-medium' : 'text-gray-900'}`}>{day.shortfall}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-semibold bg-gray-200 text-gray-900 border-r border-gray-300 whitespace-nowrap">Shift</td>
                  {employee.dailyData.map((day) => (
                    <td key={day.date} className="p-1 text-center border-l border-gray-300 text-gray-900">{day.shift}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MonthlyHoursReport;
