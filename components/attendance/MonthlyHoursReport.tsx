import React, { useState, useEffect } from 'react';
import { format, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, isAfter, isSameDay, isWithinInterval, endOfDay, startOfWeek } from 'date-fns';
import { Download } from 'lucide-react';
import { api } from '../../services/api';
import { processDailyEvents, calculateWorkingHours, isLateCheckIn, isEarlyCheckOut } from '../../utils/attendanceCalculations';
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
  userName?: string; // For MonthlyReportRow compatibility
  statuses: string[]; // For MonthlyReportRow compatibility
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
  present: number; // legacy if needed
  absent: number; // legacy if needed
  weeklyOff: number; // legacy if needed
  leaves: number; // legacy if needed
  lossOfPay: number; // legacy if needed
}

interface MonthlyHoursReportProps {
  month: number; // 1-12
  year: number;
  userId?: string; // If provided, show single employee; otherwise show all
  data?: EmployeeMonthlyData[]; // If provided, use this data directly
}

const MonthlyHoursReport: React.FC<MonthlyHoursReportProps> = ({ month, year, userId, data: externalData }) => {
  const [reportData, setReportData] = useState<EmployeeMonthlyData[]>([]);
  const [loading, setLoading] = useState(!externalData);
  const [users, setUsers] = useState<User[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]); // New state for leaves
  const [userHolidaysPool, setUserHolidaysPool] = useState<UserHoliday[]>([]);
  const { attendance, officeHolidays, fieldHolidays, siteHolidays, recurringHolidays } = useSettingsStore();

  const getStaffCategory = (role: string): 'office' | 'field' | 'site' => {
    const r = role.toLowerCase();
    if (['admin', 'developer', 'hr', 'operations_manager', 'back_office', 'receptionist', 'site_ops', 'finance'].includes(r)) return 'office';
    if (['field_staff', 'site_manager'].includes(r)) return 'field';
    return 'site';
  };

  useEffect(() => {
    if (externalData) {
      setReportData(externalData);
      setLoading(false);
    } else {
      loadReportData();
    }
  }, [month, year, userId, externalData]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const usersData = await api.getUsers();
      setUsers(usersData);

      // Filter users if userId is provided
      const targetUsers = userId ? usersData.filter(u => u.id === userId) : usersData;

      // Fetch attendance events for the month
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));
      
      const employeeReports: EmployeeMonthlyData[] = [];

      // Fetch leaves for the month
      const { data: leavesData } = await api.getLeaveRequests();
      setLeaves(leavesData || []);

      // Fetch user holidays pool
      const userHolidaysData = await api.getAllUserHolidays();
      setUserHolidaysPool(userHolidaysData || []);

      for (const user of targetUsers) {
        // Fetch events from the start of the week containing the month's first day
        // to correctly calculate W/O for early Sundays.
        const fetchStartDate = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday
        const events = await api.getAttendanceEvents(user.id, format(fetchStartDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd HH:mm:ss'));
        const userLeaves = (leavesData || []).filter((l: any) => l.userId === user.id && l.status === 'approved');

        // Fetch field violations for field staff to check manager acknowledgments
        let fieldViolations: FieldAttendanceViolation[] = [];
        const userCategory = getStaffCategory(user.role);
        if (userCategory === 'field') {
          try {
            fieldViolations = await api.getFieldViolations(user.id);
          } catch (err) {
            console.warn('Could not fetch field violations for', user.id, err);
          }
        }

        // Pass userHolidaysData directly to avoid stale state issues
        const monthlyData = processEmployeeMonth(user, events, userLeaves, userHolidaysData || [], year, month, fieldViolations);
        employeeReports.push(monthlyData);
      }

      setReportData(employeeReports);
    } catch (error) {
      console.error('Error loading monthly report:', error);
    } finally {
      setLoading(false);
    }
  };

  const processEmployeeMonth = (user: User, events: AttendanceEvent[], userLeaves: any[], userHolidays: any[], year: number, month: number, fieldViolations: FieldAttendanceViolation[] = []): EmployeeMonthlyData => {
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    const dailyData: DailyData[] = [];
    
    let totalGrossWorkDuration = 0;
    let totalNetWorkDuration = 0;
    let totalBreakDuration = 0;
    let totalOT = 0;
    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
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
                
                // 1. Activity check
                let hasActivityCheck = false;
                if (dayEvents.length > 0) {
                    const { workingHours: netHours } = processDailyEvents(dayEvents);
                    if (netHours >= (rules.minimumHoursHalfDay || 4)) {
                        hasActivityCheck = true;
                    }
                }

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
                const hasApprovedLeaveCheck = userLeaves.some((l: any) => 
                    isWithinInterval(checkDate, { start: startOfDay(new Date(l.startDate)), end: endOfDay(new Date(l.endDate)) }) &&
                    l.status === 'approved' &&
                    !['loss of pay', 'loss-of-pay', 'lop'].includes((l.leaveType || l.leave_type || '').toLowerCase())
                );

                if (hasActivityCheck || isFixedHolidayCheck || isConfiguredHolidayCheck || isRecurringHolidayCheck || hasApprovedLeaveCheck) {
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
      
      const approvedLeave = userLeaves.find((l: any) => 
          isWithinInterval(currentDate, {
              start: startOfDay(new Date(l.startDate)),
              end: endOfDay(new Date(l.endDate))
          })
      );
      

      // 1. Check FIXED holidays
      const isFixedHoliday = FIXED_HOLIDAYS.some(fh => {
          const [m, d] = fh.date.split('-').map(Number);
          return currentDate.getMonth() === (m - 1) && currentDate.getDate() === d;
      });

      // 2. Check POOL holidays (User selected)
      const isPoolHoliday = userHolidays.some(uh => {
          const uhUserId = uh.userId || (uh as any).user_id;
          const holidayDate = uh.holidayDate || (uh as any).holiday_date;
          return String(uhUserId) === String(user.id) && matchesDate(holidayDate, currentDate);
      });

      // 3. Check Configured holidays (Admin settings)
      const isConfiguredHoliday = categoryHolidays.some(h => 
          matchesDate(h.date, currentDate)
      );

      // 4. Check Recurring holiday (Floating Holiday - Male only)
      const isRecurringHoliday = (user.gender?.toLowerCase() !== 'female') && recurringHolidays.some(rule => {
          if (rule.day.toLowerCase() !== format(currentDate, 'EEEE').toLowerCase()) return false;
          
          // Check expiry
          if (rules.floatingLeavesExpiryDate) {
              const expiryDate = startOfDay(new Date(rules.floatingLeavesExpiryDate));
              if (startOfDay(currentDate) > expiryDate) return false;
          }

          const occurrence = Math.ceil(currentDate.getDate() / 7);
          const ruleType = rule.type || 'office';
          return rule.n === occurrence && ruleType === (category === 'site' ? 'office' : category); 
      });

      const isHoliday = isFixedHoliday || isPoolHoliday || isConfiguredHoliday;

      const hasActivity = dayEvents.length > 0;
      let status = '-';
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

      // Helper to format time
      const formatTime = (hrs: number) => {
        const totalMinutes = Math.round(hrs * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h}:${String(m).padStart(2, '0')}`;
      };

      if (isHoliday) {
          if (hasActivity) {
              status = 'HP';
              if (!isFuture) holidayPresents++;
          } else {
              status = 'H';
              if (!isFuture) holidaysCount++;
          }
          daysPresentInWeek++; // Holidays count for W/O
      } else if (isRecurringHoliday) {
          if (hasActivity) {
              status = 'HP'; // Or FHP? The diff says HP.
              if (!isFuture) holidayPresents++; // Count as holiday present
          } else {
              status = 'F/H';
              if (!isFuture) floatingHolidays++;
          }
          daysPresentInWeek++; // Floating holidays count for W/O
      } else if (approvedLeave) {
          const isHalfDayLeave = approvedLeave.dayOption === 'half';
          const increment = isHalfDayLeave ? 0.5 : 1;
          const prefix = isHalfDayLeave ? '1/2' : '';
          const leaveType = (approvedLeave.leaveType || (approvedLeave as any).leave_type || '').toLowerCase();
          const isLOP = ['loss of pay', 'loss-of-pay', 'lop'].includes(leaveType);
          
          if (leaveType === 'sick' || leaveType === 'sick leave') {
              status = prefix + 'S/L';
              sickLeaves += increment;
          } else if (leaveType === 'comp off' || leaveType === 'comp-off' || leaveType === 'compoff' || leaveType === 'c/o') {
              status = prefix + 'C/O';
              compOffs++; 
          } else if (leaveType === 'floating' || leaveType === 'floating holiday') {
              status = prefix + 'F/H';
              floatingHolidays += increment;
          } else if (isLOP) {
              status = isHalfDayLeave ? '1/2A' : 'A';
              lossOfPay += increment; 
          } else {
              status = prefix + 'E/L';
              earnedLeaves += increment;
          }

          if (!isLOP) daysPresentInWeek += increment; // Paid leaves count for W/O

          // If half day leave, we still want to see if they worked
          if (isHalfDayLeave && hasActivity) {
            const { 
              checkIn, 
              checkOut, 
              firstBreakIn, 
              lastBreakIn, 
              breakOut: lastBreakOut, 
              workingHours: netHours, 
              breakHours, 
              totalHours: grossHours 
            } = processDailyEvents(dayEvents);
    
            totalNetWorkDuration += netHours;
            totalGrossWorkDuration += grossHours;
            totalBreakDuration += breakHours;
            
            // For half-day leave, they are "Present" for the other half if they work >= 4h
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
            currentDayBreakOut = lastBreakOut ? format(new Date(lastBreakOut), 'HH:mm') : '-';
            currentDayBreakDuration = breakHours > 0 ? formatTime(breakHours) : '-';
            currentDayNetWorkedHours = netHours > 0 ? formatTime(netHours) : '-';
            
            // For OT on half-day leave: anything above 4h or just keep use same rule?
            // Usually OT is calculated against full shift. But let's assume 8h target.
            const targetNetHours = 4; // Because 4h is covered by leave
            const shortfall = Math.max(0, targetNetHours - netHours);
            currentDayShortfall = (shortfall > 0 && netHours > 0) ? formatTime(shortfall) : '-';
            
            // OT logic
            const maxDailyHours = rules.dailyWorkingHours?.max || 9;
            const ot = Math.max(0, netHours - (maxDailyHours / 2)); // Shift A is usually 9h, so 4.5h is half?
            totalOT += ot;
            currentDayOT = ot > 0 ? formatTime(ot) : '-';
          }
      } else if (hasActivity) {
        const { 
          checkIn, 
          checkOut, 
          firstBreakIn, 
          lastBreakIn, 
          breakOut: lastBreakOut, 
          workingHours: netHours, 
          breakHours, 
          totalHours: grossHours 
        } = processDailyEvents(dayEvents);

        const duration = netHours;
        currentDayBreakIn = firstBreakIn ? format(new Date(firstBreakIn), 'HH:mm') : '-';
        currentDayBreakOut = lastBreakOut ? format(new Date(lastBreakOut), 'HH:mm') : '-';
        let ot = 0;

        if (checkIn && checkOut) {
          // Calculate OT
          const maxDailyHours = rules.dailyWorkingHours?.max || 9;
          ot = Math.max(0, netHours - maxDailyHours);
          
          totalNetWorkDuration += duration;
          totalGrossWorkDuration += grossHours;
          totalBreakDuration += breakHours;
          totalOT += ot;

          // Count as present only if >= half day hours
          if (duration >= (rules.minimumHoursHalfDay || 4)) {
              presentDays++;
          }
        }

        // Track days present in current week for W/O calculation
        if (duration >= (rules.minimumHoursHalfDay || 4)) {
            daysPresentInWeek++;
        }

        // Determine shift type
        let shift = '-';
        if (checkIn) {
          const checkInDate = new Date(checkIn);
          const hour = checkInDate.getHours();
          const minutes = checkInDate.getMinutes();
          const timeVal = hour + minutes / 60; // Decimal time for comparison

          // Shift A: 7 AM start (+/-). Cutoff < 8:30
          // GS: 9 AM start (+/-). 8:30 - 11:30
          // Shift B: 1 PM start (+/-). 11:30 - 20:00
          // Shift C: 9 PM start (+/-). > 20:00

          if (timeVal >= 5 && timeVal < 8.5) { // 05:00 to 08:30
             shift = 'Shift A'; 
          } else if (timeVal >= 8.5 && timeVal < 11.5) { // 08:30 to 11:30 (9am +/- 2ish)
             shift = 'GS';
          } else if (timeVal >= 11.5 && timeVal < 20) { // 11:30 to 20:00
             shift = 'Shift B';
          } else {
             shift = 'Shift C'; // Night
          }
        }
        if (shift !== '-') {
          shiftCounts[shift] = (shiftCounts[shift] || 0) + 1;
        }

        // --- STATUS DETERMINATION ---
        if (isSunday) {
            status = 'WOP';
            if (!isFuture) weekendPresents++;
        } else if (category === 'field' && rules.enableSiteTimeTracking) {
            // FIELD STAFF: Use site-time-percentage logic
            const dayViolation = fieldViolations.find(v => v.date === dateStr);
            const fieldResult = getFieldStaffStatus(dayEvents, rules, dayViolation);
            status = fieldResult.status;

            if (status === 'P') {
                // presentDays already incremented above via duration check
            } else if (status === '1/2P') {
                halfDays++;
            }
        } else {
            // OFFICE / SITE STAFF: Use hours-based logic
            const fullDayHours = 8; 

            if (duration >= fullDayHours) {
                status = 'P';
            } else if (duration > 0) {
                status = '1/2P';
                halfDays++; 
            } else {
                status = 'A';
            }
        }

        currentDayInTime = checkIn ? format(new Date(checkIn), 'HH:mm') : '-';
        currentDayOutTime = checkOut ? format(new Date(checkOut), 'HH:mm') : '-';
        currentDayGrossDuration = grossHours > 0 ? formatTime(grossHours) : '-';
        currentDayBreakDuration = breakHours > 0 ? formatTime(breakHours) : '-';
        currentDayNetWorkedHours = netHours > 0 ? formatTime(netHours) : '-';
        currentDayOT = ot > 0 ? formatTime(ot) : '-';
        
        const targetNetHours = 8; // User requested 8h net work target for shortfall
        const shortfall = Math.max(0, targetNetHours - netHours);
        currentDayShortfall = (shortfall > 0 && netHours > 0 && !isSunday && !isHoliday && !isRecurringHoliday) ? formatTime(shortfall) : '-';
        
        currentDayShift = shift || '-';

      } else if (isSunday) {
          if (!isFuture) {
              if (daysPresentInWeek >= 3) {
                  status = 'W/O';
                  weekOffs++; // Increment weekOffs counter
              } else {
                  status = 'A';
                  absentDays++;
              }
          }
          daysPresentInWeek = 0; // Reset for next week
      } else {
          // Normal day, no events, no holiday, no leave
          if (!isFuture && !isToday) {
            status = 'A';
            absentDays++;
          }
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

    const averageWorkingHrs = presentDays > 0 ? totalNetWorkDuration / presentDays : 0;

    const totalPayableDays = presentDays + weekOffs + holidaysCount + weekendPresents + holidayPresents + (halfDays * 0.5) 
                             + sickLeaves + earnedLeaves + floatingHolidays + compOffs + workFromHomeDays;

    return {
      employeeId: user.id,
      employeeName: user.name,
      userName: user.name,
      statuses: dailyData.map(d => d.status),
      totalGrossWorkDuration,
      totalNetWorkDuration,
      totalBreakDuration,
      totalOT,
      presentDays,
      halfDays,
      absentDays,
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
      averageWorkingHrs: Math.round(averageWorkingHrs * 100) / 100,
      totalDurationPlusOT: totalNetWorkDuration,
      shiftCounts,
      dailyData,
      present: presentDays,
      absent: absentDays,
      weeklyOff: weekOffs, // legacy support
      leaves: leavesCount,
      lossOfPay
    };
  };

  const exportToExcel = () => {
    // TODO: Implement Excel export using your existing excelExport utility
    console.log('Export to Excel', reportData);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading report...</div>;
  }

  return (
    <div className="p-6 bg-white min-h-screen">
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

      {reportData.map((employee) => (
        <div key={employee.employeeId} className="mb-12 border border-gray-300 rounded-lg p-6 bg-white">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Employee: {employee.employeeId} - {employee.employeeName}</h3>
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
                      <span className={
                        day.status === 'P' || day.status.includes('P ') ? 'text-green-600' : 
                        (day.status === '1/2P' || day.status.includes('1/2P ') || day.status.includes('C/O')) ? 'text-blue-600' : 
                        day.status === 'W/O' ? 'text-gray-500' : 
                        (day.status === 'H' || day.status.includes('H')) ? 'text-orange-600' :
                        day.status.includes('F/H') ? 'text-yellow-600' :
                        (day.status.includes('LOP') || day.status.includes('1/2A') || day.status === 'A') ? 'text-red-500' :
                        'text-red-600'
                      }>
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
                  <td className="p-2 font-semibold bg-gray-200 text-gray-900 border-r border-gray-300 whitespace-nowrap">Shortfall (8h)</td>
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
