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
      const fetchStartDate = startOfWeek(startDate, { weekStartsOn: 1 });
      
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
    let sickLeaves = 0, earnedLeaves = 0, compOffs = 0, workFromHomeDays = 0, weekOffs = 0, totalPayableDays = 0;
    let daysPresentInWeek = 0;

    const category = getStaffCategory(user.role);
    const rules = resolveUserRules(user);
    const shiftCounts: { [key: string]: number } = {};

    const formatTime = (hrs: number) => {
        const totalMinutes = Math.round(hrs * 60);
        const h = Math.floor(totalMinutes / 60), m = totalMinutes % 60;
        return `${h}:${String(m).padStart(2, '0')}`;
    };

    const monthStartDate = new Date(year, month - 1, 1);
    const weekStartDate = startOfWeek(monthStartDate, { weekStartsOn: 1 });
    if (isAfter(monthStartDate, weekStartDate)) {
        let checkDate = weekStartDate;
        while (isAfter(monthStartDate, checkDate) && !isSameDay(monthStartDate, checkDate)) {
            const dateStr = format(checkDate, 'yyyy-MM-dd');
            if (checkDate.getDay() !== 0) {
                const dayEvents = events.filter(e => e.timestamp.startsWith(dateStr));
                if (dayEvents.length > 0) daysPresentInWeek++;
            } else {
                daysPresentInWeek = 0;
            }
            checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
        }
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      if (currentDate.getDay() === 1) daysPresentInWeek = 0;

      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayEvents = events.filter(e => e.timestamp.startsWith(dateStr));
      const hasActivity = dayEvents.length > 0;
      const isFuture = isAfter(currentDate, startOfDay(new Date()));
      
      let status = evaluateAttendanceStatus({
          day: currentDate, userId: user.id, userCategory: category, userRules: rules,
          dayEvents, officeHolidays, fieldHolidays, siteHolidays, recurringHolidays,
          userHolidaysPool, leaves: allLeaves, daysPresentInWeek
      });

      if (status.includes('P') || status === 'Present' || status === 'Half Day' || status === 'H' || (status.includes('L') && !status.includes('LOP'))) {
        daysPresentInWeek += (status.includes('1/2') || status === 'Half Day') ? 0.5 : 1;
      }

      let currentDayInTime = '-', currentDayOutTime = '-', currentDayGrossDuration = '-', currentDayBreakDuration = '-', currentDayNetWorkedHours = '-', currentDayOT = '-', currentDayShift = '-', currentDayBreakIn = '-', currentDayBreakOut = '-';
      let netHours = 0, grossHours = 0, breakHours = 0;

      if (hasActivity) {
        const { checkIn, checkOut, firstBreakIn, lastBreakIn, workingHours, breakHours: bHrs, totalHours } = processDailyEvents(dayEvents);
        netHours = workingHours; grossHours = totalHours; breakHours = bHrs;
        currentDayInTime = checkIn ? format(new Date(checkIn), 'HH:mm') : '-';
        currentDayOutTime = checkOut ? format(new Date(checkOut), 'HH:mm') : '-';
        currentDayBreakIn = firstBreakIn ? format(new Date(firstBreakIn), 'HH:mm') : '-';
        currentDayBreakOut = lastBreakIn ? format(new Date(lastBreakIn), 'HH:mm') : '-';
        
        const firstPunchTime = new Date(dayEvents[0].timestamp);
        const timeVal = firstPunchTime.getHours() + firstPunchTime.getMinutes() / 60;
        currentDayShift = timeVal >= 4 && timeVal < 11.5 ? 'Shift GS' : timeVal >= 11.5 && timeVal < 20 ? 'Shift B' : 'Shift C';
        shiftCounts[currentDayShift] = (shiftCounts[currentDayShift] || 0) + 1;

        if (status === 'W/O') status = 'WOP'; else if (status === 'H') status = 'H/P';

        if ((category === 'field' || category === 'site') && (rules as any).enableSiteTimeTracking) {
            const fieldResult = getFieldStaffStatus(dayEvents, rules, undefined, user.role);
            netHours = fieldResult.breakdown.totalActiveMinutes / 60;
            status = fieldResult.status;
        }

        currentDayGrossDuration = formatTime(grossHours);
        currentDayNetWorkedHours = formatTime(netHours);
        const maxDailyHours = (rules as any).dailyWorkingHours?.max || 9;
        const ot = Math.max(0, netHours - maxDailyHours);
        if (!isFuture) { totalNetWorkDuration += netHours; totalGrossWorkDuration += grossHours; totalOT += ot; currentDayOT = ot > 0 ? formatTime(ot) : '-'; }
      }

      if (!isFuture) {
          if (status === 'P') presentDays++;
          else if (status === '3/4P') threeQuarterDays++;
          else if (status === '1/2P' || status === 'Half Day') halfDays++;
          else if (status === '1/4P') quarterDays++;
          else if (status === 'A') absentDays++;
          else if (status === 'W/O' || status === 'WOP') { weekOffs++; if (hasActivity) weekendPresents++; }
          else if (status === 'H' || status === 'H/P') { holidaysCount++; if (hasActivity) holidayPresents++; }
          else if (status.includes('S/L')) sickLeaves++;
          else if (status.includes('E/L')) earnedLeaves++;
          else if (status.includes('F/H')) floatingHolidays++;
          else if (status.includes('C/O')) compOffs++;
          else if (status.includes('LOP')) lossOfPay++;
          else if (status.includes('WFH')) workFromHomeDays++;
          if (status.includes('L') && !status.includes('LOP')) leavesCount++;

          totalPayableDays += (status === 'P' || status === 'W/O' || status === 'WOP' || status === 'H' || status === 'H/P' || (status.includes('L') && !status.includes('LOP'))) ? 1 : 
                        (status === '1/2P' || status === 'Half Day') ? 0.5 : (status === '3/4P') ? 0.75 : (status === '1/4P') ? 0.25 : 0;
      }

      dailyData.push({
        date: day, status, inTime: currentDayInTime, outTime: currentDayOutTime, grossDuration: currentDayGrossDuration,
        breakIn: currentDayBreakIn, breakOut: currentDayBreakOut, breakDuration: currentDayBreakDuration,
        netWorkedHours: currentDayNetWorkedHours, ot: currentDayOT, shortfall: '-', shift: currentDayShift
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
      leaves: leavesCount, lossOfPay
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
          <div className="bg-gray-50/50 p-5 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-200">
                        {employee.employeeId.slice(-2)}
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900">{employee.employeeName}</h3>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{employee.role} • ID: {employee.employeeId}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white border border-gray-100 p-2 rounded-lg shadow-sm">
                        <p className="text-[10px] text-gray-400 font-semibold mb-1 uppercase">Work Hours</p>
                        <p className="text-xs font-bold text-gray-900">{employee.totalNetWorkDuration.toFixed(1)}h <span className="text-blue-500 font-medium">({employee.totalOT.toFixed(1)}h OT)</span></p>
                    </div>
                    <div className="bg-white border border-gray-100 p-2 rounded-lg shadow-sm">
                        <p className="text-[10px] text-gray-400 font-semibold mb-1 uppercase">Attendance</p>
                        <p className="text-xs font-bold text-gray-900">P:{employee.presentDays} | A:{employee.absentDays} | W:{employee.weekOffs}</p>
                    </div>
                    <div className="bg-white border border-gray-100 p-2 rounded-lg shadow-sm">
                        <p className="text-[10px] text-gray-400 font-semibold mb-1 uppercase">Payable Days</p>
                        <p className="text-xs font-bold text-green-600">{employee.totalPayableDays.toFixed(1)} Days</p>
                    </div>
                    <div className="bg-white border border-gray-100 p-2 rounded-lg shadow-sm">
                        <p className="text-[10px] text-gray-400 font-semibold mb-1 uppercase">Leaves</p>
                        <p className="text-xs font-bold text-orange-600">{employee.leaves} Applied</p>
                    </div>
                </div>
            </div>
          </div>

          <div className="p-4 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 pr-4 font-bold text-gray-400 uppercase tracking-tighter text-[9px] w-12 sticky left-0 bg-white">Day</th>
                  {employee.dailyData.map(d => (
                    <th key={d.date} className="px-1 py-2 text-center font-bold text-gray-900 min-w-[32px]">{String(d.date).padStart(2, '0')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50 group hover:bg-gray-50/50 transition-colors">
                  <td className="py-2 pr-4 font-bold text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50/50">Status</td>
                  {employee.dailyData.map(d => (
                    <td key={d.date} className="px-0.5 py-2 text-center">
                        <span className={`inline-flex items-center justify-center w-full min-h-[24px] rounded-md font-extrabold text-[10px] shadow-sm transform transition-transform hover:scale-110 cursor-default ${
                            d.status === 'P' ? 'bg-green-600 text-white' :
                            d.status === 'A' ? 'bg-red-500 text-white' :
                            d.status === 'W/O' || d.status === 'WOP' ? 'bg-blue-500 text-white' :
                            d.status === 'H' || d.status === 'H/P' ? 'bg-purple-600 text-white' :
                            'bg-gray-200 text-gray-600'
                        }`}>
                            {d.status}
                        </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-50 group hover:bg-gray-50/50 transition-colors">
                  <td className="py-2 pr-4 font-bold text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50/50">Shift In</td>
                  {employee.dailyData.map(d => (
                    <td key={d.date} className="px-0.5 py-2 text-center text-[9px] text-gray-400 font-medium">
                        {d.inTime !== '-' ? (
                            <span className="text-gray-900 font-bold">{d.inTime}</span>
                        ) : '-'}
                    </td>
                  ))}
                </tr>
                <tr className="group hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                  <td className="py-2 pr-4 font-bold text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50/50">Net Hrs</td>
                  {employee.dailyData.map(d => (
                    <td key={d.date} className="px-0.5 py-2 text-center text-[9px] font-bold">
                        <span className={d.netWorkedHours !== '-' && parseFloat(d.netWorkedHours) > 0 ? 'text-blue-600' : 'text-gray-300'}>
                             {d.netWorkedHours}
                        </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
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
