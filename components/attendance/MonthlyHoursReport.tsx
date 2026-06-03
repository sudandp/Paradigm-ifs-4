import React, { useState, useEffect } from 'react';
import { format, getDaysInMonth, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, isAfter, isSameDay, isWithinInterval, endOfDay, startOfWeek, subDays, isBefore, addDays, startOfToday } from 'date-fns';
import { Download, Lock, Loader2, Unlock } from 'lucide-react';
import { api } from '../../services/api';
import { processDailyEvents, calculateWorkingHours, isLateCheckIn, isEarlyCheckOut, evaluateAttendanceStatus, getStaffCategory, calculateDailyTravelKm, calculateDailyPathTravelKm } from '../../utils/attendanceCalculations';
import { getFieldStaffStatus } from '../../utils/fieldStaffTracking';
import type { AttendanceEvent, User, StaffAttendanceRules, UserHoliday, Role, FieldAttendanceViolation, Holiday, RoutePoint } from '../../types';
import Button from '../ui/Button';
import { useSettingsStore } from '../../store/settingsStore';
import { FIXED_HOLIDAYS } from '../../utils/constants';
import { buildAttendanceDayKeyByEventId } from '../../utils/attendanceDayGrouping';
import { useAuthStore } from '../../store/authStore';
import {
  processEmployeeMonth,
  resolveUserRules,
  type DailyData,
  type EmployeeMonthlyData
} from '../../utils/monthlyReportCalculations';

export type { DailyData, EmployeeMonthlyData };

const formatDuration = (mins: number): string => {
  if (!mins || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
};


interface MonthlyHoursReportProps {
  month: number;
  year: number;
  userId?: string;
  data?: EmployeeMonthlyData[];
  hideHeader?: boolean;
  scopedSettings?: any[];
  selectedStatus?: string;
  selectedSite?: string;
  selectedCompany?: string;
  selectedLocation?: string;
  selectedRole?: string;
  onDataLoaded?: (data: EmployeeMonthlyData[]) => void;
  users?: User[];
}

const MonthlyHoursReport: React.FC<MonthlyHoursReportProps> = ({ 
  month, year, userId, data: externalData, hideHeader, scopedSettings = [],
  selectedStatus = 'all', selectedSite = 'all', selectedCompany = 'all', selectedLocation = 'all', selectedRole = 'all',
  onDataLoaded, users: externalUsers
}) => {
  const [reportData, setReportData] = useState<EmployeeMonthlyData[]>([]);
  const [loading, setLoading] = useState(!externalData);
  const [isLocking, setIsLocking] = useState(false);
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [, setUsers] = useState<User[]>([]); 
  const [, setLeaves] = useState<any[]>([]); 
  const { user: currentUser } = useAuthStore();
  const [userHolidaysPool, setUserHolidaysPool] = useState<UserHoliday[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [masterHolidays, setMasterHolidays] = useState<Holiday[]>([]);
  const [activeRuleVersionId, setActiveRuleVersionId] = useState<string | null>(null);
  // Map of userId -> Set of dateStr for pending RC/RP requests
  const [pendingCorrectionDates, setPendingCorrectionDates] = useState<Map<string, Set<string>>>(new Map());
  const { attendance, officeHolidays: storeOfficeHolidays, fieldHolidays: storeFieldHolidays, siteHolidays: storeSiteHolidays, recurringHolidays: storeRecurringHolidays } = useSettingsStore();

  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleUnlockMonth = async () => {
    if (!currentUser || !unlockReason.trim()) return;
    setIsUnlocking(true);
    try {
      const monthStart = new Date(year, month - 1, 1);
      await api.unlockMonth(year, month, currentUser.id, unlockReason);
      setIsMonthLocked(false);
      setShowUnlockPrompt(false);
      setUnlockReason('');
      alert(`✅ ${format(monthStart, 'MMMM yyyy')} is now UNLOCKED.`);
      // Reload report data
      loadReportData();
    } catch (error) {
      console.error('Error unlocking month:', error);
      alert('Failed to unlock month. Check console for details.');
    } finally {
      setIsUnlocking(false);
    }
  };

  useEffect(() => {
    if (externalData) {
      setReportData(externalData);
      setLoading(false);
      if (onDataLoaded) onDataLoaded(externalData);
    } else {
      loadReportData();
    }
  }, [month, year, userId, externalData, selectedStatus, selectedSite, selectedCompany, selectedLocation, selectedRole]);
  const resolveUserLocation = (u: User, orgStructure: any[]) => {
    if (u.location || u.locationName) return u.location || u.locationName;
    if (!u.societyId || orgStructure.length === 0) return '';

    for (const group of orgStructure) {
      if (group.companies) {
        for (const company of group.companies) {
          if (company.id === u.societyId) {
            return company.location || '';
          }
        }
      }
    }
    return '';
  };

  const loadReportData = async () => {
    setLoading(true);
    try {
      const startDate = startOfMonth(new Date(year, month - 1));
      let endDate = endOfMonth(new Date(year, month - 1));
      const today = startOfToday();
      if (isAfter(endDate, today)) endDate = today;

      // ── PHASE 1: Check if this month is locked (has snapshots) ──────────────
      // For non-current months, check if snapshots exist. If yes, serve them
      // directly without recalculation so rule changes don't corrupt history.
      const isPastMonth = endOfMonth(new Date(year, month - 1)) < today;
      let lockedStatus = false;
      if (isPastMonth) {
        lockedStatus = await api.isMonthLocked(year, month);
        setIsMonthLocked(lockedStatus);
      }

      if (lockedStatus) {
        // Fetch all users first to get the list of employee IDs
        const usersData = externalUsers || await api.getUsers();
        let targetUsers = usersData;
        if (userId && userId !== 'all') {
          targetUsers = usersData.filter(u => u.id === userId);
        }
        const employeeIds = targetUsers.map(u => u.id);
        const snapshots = await api.getMonthSnapshotsBulk(employeeIds, year, month);

        if (snapshots.length > 0) {
          // Reconstruct EmployeeMonthlyData from snapshots
          const restored: EmployeeMonthlyData[] = snapshots.map(snap => {
            const summary = snap.summary || {};
            const presentDays = summary.presentDays || 0;
            const halfDays = summary.halfDays || 0;
            const totalNetWorkDuration = summary.totalNetWorkDuration || 0;
            const totalOT = summary.totalOT || 0;
            const averageWorkingHrs = summary.averageWorkingHrs ?? (
              (presentDays + halfDays) > 0 ? totalNetWorkDuration / (presentDays + halfDays) : 0
            );

            return {
              ...summary,
              employeeId: snap.employeeId,
              employeeName: targetUsers.find(u => u.id === snap.employeeId)?.name || snap.employeeId,
              role: targetUsers.find(u => u.id === snap.employeeId)?.role,
              statuses: (snap.dailyData || []).map((d: any) => d.status),
              dailyData: snap.dailyData || [],
              shiftCounts: summary.shiftCounts || {},
              
              // Map missing fields/backward compatibility
              averageWorkingHrs,
              totalDurationPlusOT: summary.totalDurationPlusOT ?? (totalNetWorkDuration + totalOT),
              present: summary.present ?? summary.totalPayableDays ?? 0,
              absent: summary.absent ?? summary.absentDays ?? 0,
              weeklyOff: summary.weeklyOff ?? summary.weekOffs ?? 0,
              leaves: summary.leaves ?? summary.leavesCount ?? 0,
              lossOfPay: summary.lossOfPay ?? summary.lossOfPays ?? 0,
              overtimeDays: summary.overtimeDays ?? 0,
            };
          });
          setReportData(restored);
          if (onDataLoaded) onDataLoaded(restored);
          setLoading(false);
          return; // ← skip recalculation entirely
        }
      }

      // ── PHASE 2: Fetch versioned rules for this month ────────────────────────
      // Looks up which rule version was active during (year, month).
      // Falls back to live settings if no version found (backward compat).
      const versionedGlobalRules = await api.getRuleVersionForMonth(year, month);
      if (versionedGlobalRules?._versionId) {
        setActiveRuleVersionId(versionedGlobalRules._versionId);
      }

      const [usersData, leavesDataResponse, userHolidaysData, rolesData, globalHolidaysRes, allSiteHolidays, orgStructureData] = await Promise.all([
        externalUsers || api.getUsers(),
        api.getLeaveRequests({ 
          startDate: format(subDays(startDate, 1), 'yyyy-MM-dd'),
          endDate: format(addDays(endDate, 1), 'yyyy-MM-dd')
        }),
        api.getAllUserHolidays({ year }),
        api.getRoles(),
        api.getInitialAppData(),
        api.getAllSiteSpecificHolidays(),
        api.getOrganizationStructure().catch(() => [])
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
        if (selectedSite !== 'all') targetUsers = targetUsers.filter(u => u.organizationId && u.organizationId.split(',').map(s => s.trim()).includes(selectedSite));
        if (selectedCompany !== 'all') targetUsers = targetUsers.filter(u => u.societyId === selectedCompany);
        if (selectedLocation !== 'all') {
          targetUsers = targetUsers.filter(u => {
            const loc = resolveUserLocation(u, orgStructureData || []);
            return loc && loc.toLowerCase() === selectedLocation.toLowerCase();
          });
        }
        if (selectedStatus === 'ACTIVE_USERS') {
          targetUsers = targetUsers.filter(u => (u as any).isActive !== false);
        }
      }

      // End date logic moved up
      // Start fetching from the Monday at least 15 days before the month start to ensure clean weekly blocks
      const fetchStartDate = startOfWeek(subDays(startDate, 15), { weekStartsOn: 1 });
      
      const targetUserIds = targetUsers.map(u => u.id);
      
      const [allEvents, routePointsList] = await Promise.all([
        api.getAttendanceEventsForUsers(
          targetUserIds,
          format(fetchStartDate, 'yyyy-MM-dd'), 
          // Expand 12 hours forward to catch night shift ends
          format(new Date(endDate.getTime() + 12 * 60 * 60 * 1000), 'yyyy-MM-dd HH:mm:ss')
        ),
        api.getRoutePointsForUsers(
          targetUserIds,
          format(startDate, 'yyyy-MM-dd'),
          format(new Date(endDate.getTime() + 12 * 60 * 60 * 1000), 'yyyy-MM-dd HH:mm:ss')
        ).catch(err => {
          console.warn('Failed to fetch route points for report:', err);
          return [] as RoutePoint[];
        })
      ]);

      const eventsByUser = new Map<string, AttendanceEvent[]>();
      allEvents.forEach(e => {
          const uid = String(e.userId);
          if (!eventsByUser.has(uid)) eventsByUser.set(uid, []);
          eventsByUser.get(uid)!.push(e);
      });

      const routePointsByUser = new Map<string, RoutePoint[]>();
      routePointsList.forEach(rp => {
          const uid = String(rp.userId);
          if (!routePointsByUser.has(uid)) routePointsByUser.set(uid, []);
          routePointsByUser.get(uid)!.push(rp);
      });

      const leavesByUser = new Map<string, any[]>();
      // Track pending Correction / Permission requests separately (for visual indicator)
      const pendingCorrMap = new Map<string, Set<string>>();
      (leavesData || []).forEach((l: any) => {
          const lUserId = String(l.userId || l.user_id);
          const lStatus = String(l.status || l.leaveStatus || '').toLowerCase();
          const lType = String(l.leaveType || l.leave_type || '');
          const isApproved = ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(lStatus);
          const isPendingCorrOrPerm = lType === 'Correction' || lType === 'Permission'
              ? ['pending_manager_approval', 'pending_hr_confirmation', 'pending_admin_correction'].includes(lStatus)
              : false;
          
          if (isApproved) {
              if (!leavesByUser.has(lUserId)) leavesByUser.set(lUserId, []);
              leavesByUser.get(lUserId)!.push(l);
          }
          if (isPendingCorrOrPerm) {
              const dateStr = String(l.startDate || l.start_date || '').substring(0, 10);
              if (dateStr) {
                  if (!pendingCorrMap.has(lUserId)) pendingCorrMap.set(lUserId, new Set());
                  pendingCorrMap.get(lUserId)!.add(dateStr);
              }
          }
      });
      setPendingCorrectionDates(pendingCorrMap);

      if ((userId === undefined || userId === 'all') && selectedRole !== 'management') {
        targetUsers = targetUsers.filter(u => u.role !== 'management');
      }

      // Use local variables to avoid stale state issues during initial load
      const currentMasterHolidays = globalHolidaysRes?.holidays || [];
      const currentOfficeHolidays = storeOfficeHolidays?.length ? storeOfficeHolidays : currentMasterHolidays.filter((h: any) => h.type === 'office');
      const currentFieldHolidays = storeFieldHolidays?.length ? storeFieldHolidays : currentMasterHolidays.filter((h: any) => h.type === 'field');
      const currentSiteHolidays = storeSiteHolidays?.length ? storeSiteHolidays : currentMasterHolidays.filter((h: any) => h.type === 'site');
      const currentRecurringHolidays = storeRecurringHolidays || [];

      let employeeReports: EmployeeMonthlyData[] = targetUsers.map(user => {
        const uid = String(user.id);
        const userEvents = eventsByUser.get(uid) || [];
        const userLeaves = leavesByUser.get(uid) || [];
        const userRoutePoints = routePointsByUser.get(uid) || [];
        
        // Resolve role name if it's a UUID
        let resolvedRole = user.role;
        if (user.role && user.role.length > 20 && rolesData.length > 0) {
            const roleObj = rolesData.find((r: any) => r.id === user.role);
            if (roleObj) {
                resolvedRole = roleObj.displayName.toLowerCase().replace(/\s+/g, '_');
            }
        }

        const specificSiteHolidays = allSiteHolidays.filter((sh: any) => sh.siteId === user.organizationId);

        // Use versioned rules if available, otherwise fall back to live settings
        const versionedUserRules = versionedGlobalRules
          ? { ...versionedGlobalRules }
          : null;

        return processEmployeeMonth(
          user, 
          userEvents, 
          userLeaves, 
          userHolidaysData || [], 
          year, 
          month, 
          currentOfficeHolidays, 
          currentFieldHolidays, 
          specificSiteHolidays.length > 0 ? specificSiteHolidays : currentSiteHolidays,
          currentRecurringHolidays,
          userLeaves,
          resolvedRole,
          userRoutePoints,
          versionedUserRules,
          attendance,
          scopedSettings
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


  const exportToExcel = () => {};

  const isSingleUser = userId && userId !== 'all' && reportData.length > 0;
  const targetEmployeeName = isSingleUser ? reportData[0].employeeName : (userId && userId !== 'all' ? 'Employee Report' : 'ALL EMPLOYEES');
  const targetEmployeeRole = isSingleUser ? reportData[0].role : undefined;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = endOfMonth(monthStart);
  const effectiveEnd = isAfter(monthEnd, startOfToday()) ? startOfToday() : monthEnd;

  const handleLockMonth = async () => {
    if (!reportData || reportData.length === 0) return;
    if (!currentUser) return;
    setIsLocking(true);
    try {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const employeeIds = reportData.map(r => r.employeeId);

      // ── STEP 1: Save full daily status snapshots ─────────────────────────────
      // This is the core of month locking — freeze every employee's daily data
      // so future rule changes cannot retroactively alter this month.
      const snapshots = reportData.map(emp => ({
        employeeId: emp.employeeId,
        year,
        month,
        dailyData: emp.dailyData,
        summary: {
          presentDays: emp.presentDays,
          absentDays: emp.absentDays,
          halfDays: emp.halfDays,
          threeQuarterDays: emp.threeQuarterDays,
          quarterDays: emp.quarterDays,
          weekOffs: emp.weekOffs,
          holidays: emp.holidays,
          holidayPresents: emp.holidayPresents,
          weekendPresents: emp.weekendPresents,
          sickLeaves: emp.sickLeaves,
          earnedLeaves: emp.earnedLeaves,
          casualLeaves: emp.casualLeaves,
          floatingHolidays: emp.floatingHolidays,
          compOffs: emp.compOffs,
          lossOfPays: emp.lossOfPays,
          workFromHomeDays: emp.workFromHomeDays,
          totalPayableDays: emp.totalPayableDays,
          totalNetWorkDuration: emp.totalNetWorkDuration,
          totalGrossWorkDuration: emp.totalGrossWorkDuration,
          totalBreakDuration: emp.totalBreakDuration,
          totalOT: emp.totalOT,
          leavesCount: emp.leaves,
          shiftCounts: emp.shiftCounts,
          // Newly added fields
          averageWorkingHrs: emp.averageWorkingHrs,
          totalDurationPlusOT: emp.totalDurationPlusOT,
          present: emp.present,
          absent: emp.absent,
          weeklyOff: emp.weeklyOff,
          leaves: emp.leaves,
          lossOfPay: emp.lossOfPay,
          overtimeDays: emp.overtimeDays,
        },
        ruleVersionId: activeRuleVersionId || undefined,
        lockedBy: currentUser.id,
        lockedByName: currentUser.name,
      }));

      await api.saveMonthSnapshots(snapshots);

      // ── STEP 2: Save leave balances (existing logic) ─────────────────────────
      const prevBalances = await api.getLeaveBalancesBulk(employeeIds, prevYear, prevMonth);
      const balanceMap = new Map();
      prevBalances.forEach((b: any) => balanceMap.set(b.employee_id, b));

      const newBalances = reportData.map(emp => {
        const prev = balanceMap.get(emp.employeeId);
        const woEarned = (emp.presentDays + emp.halfDays) * (1 / 6);
        const woAllotted = emp.weekOffs;
        const qualifyingDays = emp.presentDays + emp.halfDays + emp.weekOffs + emp.holidays;
        const elEarned = qualifyingDays * 0.05;
        const elAvailed = emp.earnedLeaves;
        return {
          employee_id: emp.employeeId,
          year,
          month,
          el_opening: prev ? prev.el_closing : 0,
          el_earned_this_month: elEarned,
          el_availed_this_month: elAvailed,
          wo_opening: prev ? prev.wo_closing : 0,
          wo_earned_this_month: woEarned,
          wo_allotted_this_month: woAllotted,
        };
      });

      await api.saveLeaveBalances(newBalances);
      setIsMonthLocked(true);
      alert(`✅ ${format(new Date(year, month - 1), 'MMMM yyyy')} is now LOCKED.\n${snapshots.length} employee records frozen.\nFuture rule changes will NOT affect this month.`);
    } catch (error) {
      console.error('Error locking month:', error);
      alert('Failed to lock month. Check console for details.');
    } finally {
      setIsLocking(false);
    }
  };

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
            <p className="text-[14px] text-gray-800 font-bold mb-3">Billing Cycle: {format(new Date(year, month - 1, 1), 'MMMM yyyy')}</p>
            <div className="text-[11px] text-gray-400 space-y-0.5 font-medium mb-4">
               {currentUser && (
                  <>
                    <p>Generated by: {currentUser.name}</p>
                    {currentUser.role && <p className="text-[9px] uppercase">{currentUser.role.replace(/_/g, ' ')}</p>}
                  </>
               )}
               <p>Date: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
            </div>
                <div className="flex gap-2 justify-end mt-2 items-center">
                    {isMonthLocked && (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
                            <Lock className="h-3 w-3" /> FROZEN — Snapshot Active
                        </span>
                    )}
                    <Button onClick={exportToExcel} variant="secondary"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
                    {currentUser?.role === 'admin' && (
                        <>
                            <Button
                              onClick={handleLockMonth}
                              disabled={isLocking || isMonthLocked}
                              className={isMonthLocked ? "bg-emerald-100 text-emerald-700 border border-emerald-300 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700 text-white border-none"}
                            >
                                {isLocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                                {isLocking ? 'Locking...' : isMonthLocked ? 'Month Locked ✓' : 'Lock Month & Freeze'}
                            </Button>
                            {isMonthLocked && (
                                <Button
                                  onClick={() => setShowUnlockPrompt(true)}
                                  disabled={isUnlocking}
                                  className="bg-amber-600 hover:bg-amber-700 text-white border-none"
                                >
                                    <Unlock className="mr-2 h-4 w-4" />
                                    Unlock Month
                                </Button>
                            )}
                        </>
                    )}
                </div>
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
                        <span className="font-normal text-gray-500">Billing Cycle:</span> <span className="font-medium text-gray-700 ml-1">{format(monthStart, 'do MMMM')} to {format(effectiveEnd, 'do MMMM')}</span>
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
                                <>
                                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md text-[11px] font-bold shadow-sm border border-blue-200 flex items-center gap-1">
                                    BL <span className="bg-blue-200 text-blue-900 px-1.5 rounded-sm text-[10px] ml-0.5">{employee.floatingHolidays}</span>
                                </span>
                                <span className="px-2.5 py-1 bg-pink-100 text-pink-700 rounded-md text-[11px] font-bold shadow-sm border border-pink-200 flex items-center gap-1 hidden" aria-label="Pink Leave">
                                    PL
                                </span>
                                </>
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
                            {employee.totalTravelDistance !== undefined && employee.totalTravelDistance > 0 && (
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md text-[11px] font-bold shadow-sm border border-emerald-200 flex items-center gap-1">
                                    Travel <span className="bg-emerald-200 text-emerald-900 px-1.5 rounded-sm text-[10px] ml-0.5">
                                        {employee.totalTravelDistance.toFixed(2)} KM
                                        {employee.totalTravelDuration && employee.totalTravelDuration > 0 ? ` (${formatDuration(employee.totalTravelDuration)})` : ''}
                                    </span>
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
                      <th className="py-1 px-1 font-semibold text-gray-700 text-[10px] w-16 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">Date</th>
                      {employee.dailyData.map(d => (
                        <th key={d.date} className="p-0.5 text-center font-normal text-gray-500 text-[9px] w-[3%] border-r border-slate-200 last:border-r-0">{d.date}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-[8.5px] tracking-tighter text-gray-700 whitespace-nowrap">
                    <tr className="bg-white border-b border-slate-100">
                      <td className="py-1 px-1 font-semibold text-gray-700 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">Status</td>
                      {employee.dailyData.map(d => {
                        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d.date).padStart(2,'0')}`;
                        const hasPendingRC = pendingCorrectionDates.get(employee.employeeId)?.has(dateStr) ?? false;
                        return (
                        <td key={d.date} className="p-0 text-center border-r border-slate-100 last:border-r-0 relative">
                            <span className={`inline-flex items-center justify-center w-full min-h-[18px] font-bold text-[9px] ${
                                d.status === 'P' ? 'bg-emerald-50 text-emerald-700' :
                                d.status === '0.75P' || d.status === '3/4P' ? 'bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-600' :
                                d.status === '0.5P' || d.status === '1/2P' ? 'bg-gradient-to-r from-emerald-100 to-blue-100 text-blue-800' :
                                d.status === '0.25P' || d.status === '1/4P' ? 'bg-gradient-to-r from-blue-100 to-slate-100 text-blue-600' :
                                d.status === 'A' ? 'bg-rose-50 text-rose-600' :
                                d.status === 'W/O' || d.status === 'WOP' ? 'bg-slate-50 text-slate-600' :
                                d.status === 'W/P' ? 'bg-blue-50 text-blue-700' :
                                d.status === 'H' || d.status === 'H/P' ? 'bg-indigo-50 text-indigo-700' :
                                d.status.includes('F/H') ? 'bg-yellow-50 text-yellow-700' :
                                d.status.includes('S/L') ? 'bg-purple-50 text-purple-700' :
                                d.status.includes('E/L') ? 'bg-blue-50 text-blue-700' :
                                d.status.includes('C/O') ? 'bg-teal-50 text-teal-700' :
                                d.status.includes('LOP') ? 'bg-red-50 text-red-700' :
                                d.status === 'W/H' ? 'bg-teal-50 text-teal-700' :
                                d.status.includes('BL') ? 'bg-blue-100 text-blue-800' :
                                d.status.includes('PL') ? 'bg-pink-100 text-pink-700' :
                                d.status.includes('ML') ? 'bg-rose-100 text-rose-700' :
                                d.status.includes('CL') ? 'bg-violet-50 text-violet-700' :
                                d.status.includes('EL') ? 'bg-indigo-50 text-indigo-700' :
                                d.status.includes('SL') ? 'bg-purple-50 text-purple-700' :
                                d.status.includes('RP') ? 'bg-sky-50 text-sky-700' :
                                d.status.includes('RC') ? 'bg-green-50 text-green-700' :
                                'text-gray-500'
                            }`}>
                                {d.status}
                            </span>
                            {/* Pending RC/RP indicator — orange dot */}
                            {hasPendingRC && (
                                <span
                                    title="Pending Correction/Permission request"
                                    className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-orange-400 border border-white shadow-sm"
                                    aria-label="Pending correction or permission request"
                                />
                            )}
                        </td>
                        );
                      })}
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
                      <td className="py-0.5 px-1 font-medium text-gray-600 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">Travel (KM)</td>
                      {employee.dailyData.map(d => (
                        <td 
                          key={d.date} 
                          className="p-0.5 text-center border-r border-slate-100 last:border-r-0 cursor-help" 
                          title={d.travelDistance && d.travelDistance > 0 ? `Distance: ${d.travelDistance.toFixed(2)} KM\nDuration: ${formatDuration(d.travelDuration || 0)}` : undefined}
                        >
                          {d.travelDistance && d.travelDistance > 0 ? d.travelDistance.toFixed(2) : '-'}
                        </td>
                      ))}
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
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-medium text-gray-500 uppercase tracking-widest mb-2">
                 <span>Avg Working Hours: <b className="text-gray-900">{employee.averageWorkingHrs.toFixed(1)}h</b></span>
                 <span>Site Presence Score: <b className="text-green-600">{((employee.presentDays / employee.dailyData.length) * 100).toFixed(0)}%</b></span>
                 <span>Shift Distribution: <b className="text-gray-900">{Object.entries(employee.shiftCounts).map(([s, c]) => `${s}(${c})`).join(' ')}</b></span>
              </div>
              {/* Notation Legend */}
              <div className="border-t border-gray-100 pt-2">
                 <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Notation Reference</p>
                 <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {[
                        { code: 'P',    label: 'Present',              bg: 'bg-emerald-50',  text: 'text-emerald-700' },
                        { code: '1/2P', label: 'Half Day',             bg: 'bg-blue-50',     text: 'text-blue-700'   },
                        { code: '3/4P', label: 'Three-Quarter Day',    bg: 'bg-emerald-50',  text: 'text-emerald-600'},
                        { code: '1/4P', label: 'Quarter Day',          bg: 'bg-sky-50',      text: 'text-sky-600'    },
                        { code: 'A',    label: 'Absent',               bg: 'bg-rose-50',     text: 'text-rose-700'   },
                        { code: 'LOP',  label: 'Loss of Pay',          bg: 'bg-red-50',      text: 'text-red-700'    },
                        { code: 'W/O',  label: 'Weekly Off',           bg: 'bg-slate-100',   text: 'text-slate-600'  },
                        { code: 'H',    label: 'Public Holiday',       bg: 'bg-indigo-50',   text: 'text-indigo-700' },
                        { code: 'H/P',  label: 'Holiday Present',      bg: 'bg-amber-50',    text: 'text-amber-700'  },
                        { code: 'W/P',  label: 'Weekend Present',      bg: 'bg-blue-50',     text: 'text-blue-700'   },
                        { code: 'W/H',  label: 'Work From Home',       bg: 'bg-teal-50',     text: 'text-teal-700'   },
                        { code: 'SL',   label: 'Sick Leave',           bg: 'bg-purple-50',   text: 'text-purple-700' },
                        { code: 'EL',   label: 'Earned Leave',         bg: 'bg-indigo-50',   text: 'text-indigo-700' },
                        { code: 'CL',   label: 'Casual Leave',         bg: 'bg-violet-50',   text: 'text-violet-700' },
                        { code: 'C/O',  label: 'Comp Off',             bg: 'bg-teal-50',     text: 'text-teal-700'   },
                        { code: 'BL',   label: 'Blue Leave (3rd Sat)', bg: 'bg-blue-100',    text: 'text-blue-800'   },
                        { code: 'PL',   label: 'Pink Leave (Female)',  bg: 'bg-pink-100',    text: 'text-pink-700'   },
                        { code: 'ML',   label: 'Maternity Leave',      bg: 'bg-rose-100',    text: 'text-rose-700'   },
                        { code: 'CC',   label: 'Child Care Leave',     bg: 'bg-teal-100',    text: 'text-teal-700'   },
                        { code: 'RP',   label: 'Request Permission',   bg: 'bg-sky-50',      text: 'text-sky-700'    },
                        { code: 'RC',   label: 'Request Correction',   bg: 'bg-green-50',    text: 'text-green-700'  },
                    ].map(({ code, label, bg, text }) => (
                        <span key={code} className={`inline-flex items-center gap-1 ${bg} ${text} rounded px-1.5 py-0.5`}>
                            <span className="text-[8px] font-black">{code}</span>
                            <span className="text-[7px] font-medium text-gray-500">{label}</span>
                        </span>
                    ))}
                 </div>
                 <p className="text-[7px] text-gray-400 mt-1">* Prefix 1/2 = half-day variant. H/P &amp; W/P attract 1.5× payable credit.</p>
                 <div className="flex items-center gap-1.5 mt-1.5">
                     <span className="inline-flex items-center gap-1">
                         <span className="w-2 h-2 rounded-full bg-orange-400 border border-white shadow-sm inline-block"></span>
                         <span className="text-[7px] font-medium text-orange-600">Pending Correction / Permission request</span>
                     </span>
                 </div>
              </div>
           </div>
        </div>
      ))}

      {showUnlockPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-scale-in">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600 border border-amber-100">
                  <Unlock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Unlock Attendance Month</h3>
                  <p className="text-xs text-gray-500">Provide a reason to unlock the frozen record.</p>
                </div>
              </div>
              
              <div className="mb-4">
                <label htmlFor="unlock-reason" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Reason for Unlocking
                </label>
                <textarea
                  id="unlock-reason"
                  rows={4}
                  className="w-full p-3 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all placeholder-gray-400 resize-none"
                  placeholder="e.g., Correction of incorrect punches for employee John Doe, or updating holiday settings..."
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  disabled={isUnlocking}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowUnlockPrompt(false);
                    setUnlockReason('');
                  }}
                  disabled={isUnlocking}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUnlockMonth}
                  disabled={isUnlocking || !unlockReason.trim()}
                  className="bg-amber-600 hover:bg-amber-700 text-white border-none min-w-[100px]"
                >
                  {isUnlocking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Unlocking...
                    </>
                  ) : (
                    'Unlock Month'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyHoursReport;
