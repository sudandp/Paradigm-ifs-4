import React, { useState, useEffect } from 'react';
import { format, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, isAfter, isSameDay, isWithinInterval, endOfDay, startOfWeek, subDays } from 'date-fns';
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
}

const MonthlyHoursReport: React.FC<MonthlyHoursReportProps> = ({ 
  month, year, userId, data: externalData, hideHeader, scopedSettings = [],
  selectedStatus = 'all', selectedSite = 'all', selectedSociety = 'all', selectedRole = 'all'
}) => {
  const [reportData, setReportData] = useState<EmployeeMonthlyData[]>([]);
  const [loading, setLoading] = useState(!externalData);
  const [, setUsers] = useState<User[]>([]); 
  const [, setLeaves] = useState<any[]>([]); 
  const [userHolidaysPool, setUserHolidaysPool] = useState<UserHoliday[]>([]);
  const { attendance, officeHolidays, fieldHolidays, siteHolidays, recurringHolidays } = useSettingsStore();

  const resolveUserRules = (user: User) => {
    const userCategory = getStaffCategory(user.role, user.organizationId, { 
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
    } else {
      loadReportData();
    }
  }, [month, year, userId, externalData, selectedStatus, selectedSite, selectedSociety, selectedRole]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [usersData, leavesDataResponse, userHolidaysData] = await Promise.all([
        api.getUsers(),
        api.getLeaveRequests(),
        api.getAllUserHolidays()
      ]);

      const leavesData = leavesDataResponse?.data || [];
      setUsers(usersData);
      setLeaves(leavesData || []);
      setUserHolidaysPool(userHolidaysData || []);

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

      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));
      const fetchStartDate = subDays(startOfWeek(startDate, { weekStartsOn: 1 }), 15);
      
      const allEvents = await api.getAllAttendanceEvents(
        format(fetchStartDate, 'yyyy-MM-dd'), 
        format(endDate, 'yyyy-MM-dd HH:mm:ss')
      );

      if (userId === undefined || userId === 'all') {
        targetUsers = targetUsers.filter(u => u.role !== 'management');
      }

      let employeeReports: EmployeeMonthlyData[] = targetUsers.map(user => {
        const userEvents = allEvents.filter(e => String(e.userId) === String(user.id));
        const userLeaves = (leavesData || []).filter((l: any) => String(l.userId) === String(user.id) && (l.status === 'approved' || l.leaveStatus === 'approved'));
        return processEmployeeMonth(user, userEvents, userLeaves, userHolidaysData || [], year, month, [], leavesData || []);
      });

      if (selectedStatus === 'ACTIVE_USERS') {
          employeeReports = employeeReports.filter(report => report.presentDays > 0 || report.halfDays > 0 || report.threeQuarterDays > 0 || report.quarterDays > 0);
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
    
    let totalGrossWorkDuration = 0, totalNetWorkDuration = 0, totalBreakDuration = 0, totalOT = 0;
    let presentDays = 0, absentDays = 0, halfDays = 0, threeQuarterDays = 0, quarterDays = 0, holidaysCount = 0;
    let leavesCount = 0, floatingHolidays = 0, lossOfPay = 0, holidayPresents = 0, weekendPresents = 0;
    let sickLeaves = 0, earnedLeaves = 0, compOffs = 0, workFromHomeDays = 0, weekOffs = 0, totalPayableDays = 0, overtimeDays = 0;
    let daysPresentInPreviousWeek = 0;
    let daysPresentInCurrentWeek = 0;
    
    const category = getStaffCategory(user.role);
    const rules = resolveUserRules(user);
    const threshold = (rules as any)?.weekendPresentThreshold ?? 3;
    const shiftCounts: { [key: string]: number } = {};

    const formatTime = (hrs: number) => {
        const totalMinutes = Math.round(hrs * 60);
        const h = Math.floor(totalMinutes / 60), m = totalMinutes % 60;
        return `${h}:${String(m).padStart(2, '0')}`;
    };

    // 1. Calculate historical activity to determine status for the FIRST week of the month
    const monthStartDate = new Date(year, month - 1, 1);
    const firstWeekStart = startOfWeek(monthStartDate, { weekStartsOn: 1 });
    const historicalWeekStart = new Date(firstWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Count presence in the week BEFORE the first week of the month (the full previous week)
    let checkDate = historicalWeekStart;
    for (let i = 0; i < 7; i++) {
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        const dayEvents = events.filter(e => e.timestamp.startsWith(dateStr));
        if (dayEvents.length > 0) daysPresentInPreviousWeek++;
        checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
    }

    // Count presence in the current week UP TO the month start
    checkDate = firstWeekStart;
    while (isAfter(monthStartDate, checkDate) && !isSameDay(monthStartDate, checkDate)) {
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        const dayEvents = events.filter(e => e.timestamp.startsWith(dateStr));
        if (dayEvents.length > 0) daysPresentInCurrentWeek++;
        checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      
      // Every Monday, rotate the weekly activity counts
      if (currentDate.getDay() === 1) {
          daysPresentInPreviousWeek = daysPresentInCurrentWeek;
          daysPresentInCurrentWeek = 0;
      }

      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayEvents = events.filter(e => e.timestamp.startsWith(dateStr));
      const hasActivity = dayEvents.length > 0;
      const isFuture = isAfter(currentDate, startOfDay(new Date()));
      
      const isActiveInPreviousWeek = daysPresentInPreviousWeek >= threshold;

      let status = evaluateAttendanceStatus({
          day: currentDate, userId: user.id, userCategory: category, userRole: user.role, userRules: rules,
          dayEvents, officeHolidays, fieldHolidays, siteHolidays, recurringHolidays,
          userHolidaysPool: userHolidays, leaves: allLeaves, daysPresentInWeek: daysPresentInCurrentWeek,
          isActiveInPreviousWeek
      });

      if (status.includes('P') || status === 'Present' || status === 'Half Day' || status === 'H' || (status.includes('L') && !status.includes('LOP'))) {
        daysPresentInCurrentWeek += (status.includes('1/2') || status === 'Half Day') ? 0.5 : 1;
      }

      let currentDayInTime = '-', currentDayOutTime = '-', currentDayGrossDuration = '-', currentDayBreakDuration = '-', currentDayNetWorkedHours = '-', currentDayOT = '-', currentDayShortfall = '-', currentDayShift = '-', currentDayBreakIn = '-', currentDayBreakOut = '-';
      let netHours = 0, grossHours = 0, breakHours = 0;

      if (hasActivity) {
        const { checkIn, checkOut, firstBreakIn, breakOut, workingHours, breakHours: bHrs, totalHours } = processDailyEvents(dayEvents);
        netHours = workingHours; grossHours = totalHours; breakHours = bHrs;
        currentDayInTime = checkIn ? format(new Date(checkIn), 'HH:mm') : '-';
        currentDayOutTime = checkOut ? format(new Date(checkOut), 'HH:mm') : '-';
        currentDayBreakIn = firstBreakIn ? format(new Date(firstBreakIn), 'HH:mm') : '-';
        currentDayBreakOut = breakOut ? format(new Date(breakOut), 'HH:mm') : '-';
        
        const firstPunchTime = new Date(dayEvents[0].timestamp);
        const timeVal = firstPunchTime.getHours() + firstPunchTime.getMinutes() / 60;
        currentDayShift = timeVal >= 4 && timeVal < 11.5 ? 'Shift GS' : timeVal >= 11.5 && timeVal < 20 ? 'Shift B' : 'Shift C';
        shiftCounts[currentDayShift] = (shiftCounts[currentDayShift] || 0) + 1;

        if (status === 'W/O') status = 'WOP';

        currentDayGrossDuration = formatTime(grossHours);
        currentDayNetWorkedHours = formatTime(netHours);
        currentDayBreakDuration = formatTime(breakHours);
        const maxDailyHours = (rules as any).dailyWorkingHours?.max || 9;
        const ot = Math.max(0, netHours - maxDailyHours);
        
        // Shortfall (75%) logic: if netHours < 75% of maxDailyHours
        currentDayShortfall = netHours > 0 && netHours < (maxDailyHours * 0.75) ? 'YES' : '-';
        currentDayOT = ot > 0 ? formatTime(ot) : '-';

        if (!isFuture) { 
            totalNetWorkDuration += netHours; 
            totalGrossWorkDuration += grossHours; 
            totalBreakDuration += breakHours;
            totalOT += ot; 
            
            // OT Bonus Day - Only for SITE staff
            if (category === 'site' && netHours > 14) {
              overtimeDays++;
            }
        }
      }

      if (!isFuture) {
          if (status === 'P') presentDays++;
          else if (status === 'W/P') { presentDays++; weekOffs++; weekendPresents++; }
          else if (status === '3/4P') threeQuarterDays++;
          else if (status === '1/2P' || status === 'Half Day') halfDays++;
          else if (status === '1/4P') quarterDays++;
          else if (status === 'A') absentDays++;
          else if (status === 'W/O') weekOffs++;
          else if (status === 'WOP') { weekOffs++; if (hasActivity) weekendPresents++; }
          else if (status === 'H') holidaysCount++;
          else if (status === 'H/P') { holidaysCount++; presentDays++; holidayPresents++; }
          else if (status.includes('S/L')) sickLeaves++;
          else if (status.includes('E/L')) earnedLeaves++;
          else if (status.includes('F/H')) floatingHolidays++;
          else if (status.includes('C/O')) compOffs++;
          else if (status.includes('LOP')) lossOfPay++;
          else if (status.includes('WFH')) workFromHomeDays++;
          
          if (['S/L', '1/2S/L', 'E/L', '1/2E/L', 'C/L', '1/2C/L', 'C/O', '1/2C/O'].includes(status)) {
              leavesCount++;
          }

          totalPayableDays += (['W/P', 'H/P'].includes(status)) ? 2 :
                        (status === 'P' || status === 'W/O' || status === 'WOP' || status === 'H' || ['S/L', 'E/L', 'C/L', 'C/O'].includes(status)) ? 1 : 
                        (status === '1/2P' || status === 'Half Day' || ['1/2S/L', '1/2E/L', '1/2C/L', '1/2C/O'].includes(status)) ? 0.5 : 
                        (status === '3/4P') ? 0.75 : (status === '1/4P') ? 0.25 : 0;
          
          if (day === daysInMonth) {
              totalPayableDays += overtimeDays;
          }
      }

      dailyData.push({
        date: day, status, inTime: currentDayInTime, outTime: currentDayOutTime, grossDuration: currentDayGrossDuration,
        breakIn: currentDayBreakIn, breakOut: currentDayBreakOut, breakDuration: currentDayBreakDuration,
        netWorkedHours: currentDayNetWorkedHours, ot: currentDayOT, shortfall: currentDayShortfall, shift: currentDayShift
      });
    }

    return {
      employeeId: user.id, employeeName: user.name, role: user.role, statuses: dailyData.map(d => d.status),
      totalGrossWorkDuration, totalNetWorkDuration, totalBreakDuration, totalOT,
      presentDays, absentDays, weekOffs, holidays: holidaysCount, holidayPresents, weekendPresents,
      halfDays, threeQuarterDays, quarterDays, sickLeaves, earnedLeaves, floatingHolidays, compOffs,
      lossOfPays: lossOfPay, workFromHomeDays, totalPayableDays,
      averageWorkingHrs: (presentDays + halfDays) > 0 ? totalNetWorkDuration / (presentDays + halfDays) : 0,
      totalDurationPlusOT: totalNetWorkDuration + totalOT,
      shiftCounts, dailyData, present: presentDays + (halfDays * 0.5), absent: absentDays, weeklyOff: weekOffs,
      leaves: leavesCount, lossOfPay, overtimeDays
    };
  };

  const exportToExcel = () => {};

  if (loading) return <div className="p-8 text-center">Loading report...</div>;

  return (
    <div className="p-6 bg-white min-h-screen">
      {!hideHeader && (
        <div className="mb-6 flex justify-between items-center text-gray-900 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Monthly Status Report</h2>
            <p className="text-gray-500 text-sm">{format(new Date(year, month - 1, 1), 'MMMM yyyy')} Report Overview</p>
          </div>
          <Button onClick={exportToExcel} variant="secondary"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
        </div>
      )}

      {reportData.map((employee) => (
        <div key={employee.employeeId} className="mb-10 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="bg-white p-8">
            {/* Header matching image exactly */}
            <div className="mb-6">
                <h3 className="text-[17px] font-normal text-gray-900 leading-tight">
                    <span className="font-bold">Employee:</span> <span className="font-bold">{employee.employeeName}</span> 
                    <span className="ml-4 font-normal text-gray-500">Role: <span className="font-medium text-gray-700 capitalize">{employee.role?.replace(/_/g, ' ')}</span></span>
                </h3>
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
                                Present <span className="bg-emerald-200 text-emerald-900 px-1.5 rounded-sm text-[10px] ml-0.5">{employee.presentDays}</span>
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
                                Leave <span className="bg-violet-200 text-violet-900 px-1.5 rounded-sm text-[10px] ml-0.5">{employee.leaves}</span>
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
                                d.status === 'A' ? 'bg-rose-50 text-rose-600' :
                                d.status === 'W/O' || d.status === 'WOP' ? 'bg-slate-50 text-slate-600' :
                                d.status === 'H' || d.status === 'H/P' ? 'bg-indigo-50 text-indigo-700' :
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
