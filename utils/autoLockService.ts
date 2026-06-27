import {
  format,
  startOfMonth,
  endOfMonth,
  subDays,
  addDays,
  startOfWeek,
} from 'date-fns';
import { api } from '../services/api';
import { processEmployeeMonth, type EmployeeMonthlyData } from './monthlyReportCalculations';
import type { AttendanceEvent, User, UserHoliday, Role, Holiday, RoutePoint } from '../types';

export interface AutoLockResult {
  lockedCount: number;
  totalCount: number;
  warnings: string[];
  success: boolean;
  message: string;
}

export async function autoLockPreviousMonth(
  year: number,
  month: number,
  currentUser: User
): Promise<AutoLockResult> {
  try {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    // 1. Fetch metadata in parallel
    const [
      usersData,
      leavesDataResponse,
      userHolidaysData,
      rolesData,
      globalHolidaysRes,
      allSiteHolidays,
      orgStructureData,
      scopedSettings,
      versionedGlobalRules,
      recurringHolidaysRes
    ] = await Promise.all([
      api.getUsers(),
      api.getLeaveRequests({ 
        startDate: format(subDays(startDate, 1), 'yyyy-MM-dd'),
        endDate: format(addDays(endDate, 1), 'yyyy-MM-dd')
      }),
      api.getAllUserHolidays({ year }),
      api.getRoles(),
      api.getInitialAppData(),
      api.getAllSiteSpecificHolidays(),
      api.getOrganizationStructure().catch(() => []),
      api.getAllScopedSettings(),
      api.getRuleVersionForMonth(year, month),
      api.getRecurringHolidays().catch(() => [])
    ]);

    const leavesData = leavesDataResponse?.data || [];
    const attendance = globalHolidaysRes?.settings?.attendanceSettings || {};
    
    const storeOfficeHolidays = globalHolidaysRes?.holidays?.filter((h: any) => h.type === 'office') || [];
    const storeFieldHolidays = globalHolidaysRes?.holidays?.filter((h: any) => h.type === 'field') || [];
    const storeSiteHolidays = globalHolidaysRes?.holidays?.filter((h: any) => h.type === 'site') || [];
    const storeRecurringHolidays = recurringHolidaysRes || [];

    const currentMasterHolidays = globalHolidaysRes?.holidays || [];
    const currentOfficeHolidays = storeOfficeHolidays.length ? storeOfficeHolidays : currentMasterHolidays.filter((h: any) => h.type === 'office');
    const currentFieldHolidays = storeFieldHolidays.length ? storeFieldHolidays : currentMasterHolidays.filter((h: any) => h.type === 'field');
    const currentSiteHolidays = storeSiteHolidays.length ? storeSiteHolidays : currentMasterHolidays.filter((h: any) => h.type === 'site');
    const currentRecurringHolidays = storeRecurringHolidays;

    // Filter target users (exclude management role)
    const targetUsers = usersData.filter(u => u.role !== 'management');

    // 2. Fetch events and route points in parallel for all target users
    const targetUserIds = targetUsers.map(u => u.id);
    const fetchStartDate = startOfWeek(subDays(startDate, 15), { weekStartsOn: 1 });

    const [allEvents, routePointsList] = await Promise.all([
      api.getAttendanceEventsForUsers(
        targetUserIds,
        format(fetchStartDate, 'yyyy-MM-dd'), 
        format(new Date(endDate.getTime() + 12 * 60 * 60 * 1000), 'yyyy-MM-dd HH:mm:ss')
      ),
      api.getRoutePointsForUsers(
        targetUserIds,
        format(startDate, 'yyyy-MM-dd'),
        format(new Date(endDate.getTime() + 12 * 60 * 60 * 1000), 'yyyy-MM-dd HH:mm:ss')
      ).catch(() => [] as RoutePoint[])
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
    (leavesData || []).forEach((l: any) => {
        const lUserId = String(l.userId || l.user_id);
        const lStatus = String(l.status || l.leaveStatus || '').toLowerCase();
        const isApproved = ['approved', 'approved_by_reporting', 'approved_by_admin', 'correction_made'].includes(lStatus);
        if (isApproved) {
            if (!leavesByUser.has(lUserId)) leavesByUser.set(lUserId, []);
            leavesByUser.get(lUserId)!.push(l);
        }
    });

    const snapshots: any[] = [];
    const warnings: string[] = [];
    const processedReportData: EmployeeMonthlyData[] = [];

    // 3. Compute calculations for all employees
    for (const user of targetUsers) {
      try {
        const uid = String(user.id);
        const userEvents = eventsByUser.get(uid) || [];
        const userLeaves = leavesByUser.get(uid) || [];
        const userRoutePoints = routePointsByUser.get(uid) || [];

        let resolvedRole = user.role;
        if (user.role && user.role.length > 20 && rolesData.length > 0) {
            const roleObj = rolesData.find((r: any) => r.id === user.role);
            if (roleObj) {
                resolvedRole = roleObj.displayName.toLowerCase().replace(/\s+/g, '_');
            }
        }

        const specificSiteHolidays = allSiteHolidays.filter((sh: any) => sh.siteId === user.organizationId);

        const empReport = processEmployeeMonth(
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
          versionedGlobalRules,
          attendance,
          scopedSettings
        );

        processedReportData.push(empReport);

        snapshots.push({
          employeeId: empReport.employeeId,
          year,
          month,
          dailyData: empReport.dailyData,
          summary: {
            presentDays: empReport.presentDays,
            absentDays: empReport.absentDays,
            halfDays: empReport.halfDays,
            threeQuarterDays: empReport.threeQuarterDays,
            quarterDays: empReport.quarterDays,
            weekOffs: empReport.weekOffs,
            holidays: empReport.holidays,
            holidayPresents: empReport.holidayPresents,
            weekendPresents: empReport.weekendPresents,
            sickLeaves: empReport.sickLeaves,
            earnedLeaves: empReport.earnedLeaves,
            casualLeaves: empReport.casualLeaves,
            floatingHolidays: empReport.floatingHolidays,
            compOffs: empReport.compOffs,
            lossOfPays: empReport.lossOfPays,
            workFromHomeDays: empReport.workFromHomeDays,
            totalPayableDays: empReport.totalPayableDays,
            totalNetWorkDuration: empReport.totalNetWorkDuration,
            totalGrossWorkDuration: empReport.totalGrossWorkDuration,
            totalBreakDuration: empReport.totalBreakDuration,
            totalOT: empReport.totalOT,
            leavesCount: empReport.leaves,
            shiftCounts: empReport.shiftCounts,
          },
          ruleVersionId: versionedGlobalRules?._versionId || undefined,
          lockedBy: currentUser.id,
          lockedByName: currentUser.name || currentUser.email || 'Admin',
        });
      } catch (err: any) {
        console.error(`[AutoLock] Failed calculating user ${user.name || user.id}:`, err);
        warnings.push(user.name || user.id);
      }
    }

    // 4. Batch upsert snapshots
    if (snapshots.length > 0) {
      await api.saveMonthSnapshots(snapshots);
    }

    // 5. Update leave balances
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const employeeIds = processedReportData.map(r => r.employeeId);

    try {
      const prevBalances = await api.getLeaveBalancesBulk(employeeIds, prevYear, prevMonth);
      const balanceMap = new Map();
      prevBalances.forEach((b: any) => balanceMap.set(b.employee_id, b));

      const newBalances = processedReportData.map(emp => {
        const prev = balanceMap.get(emp.employeeId);
        const woEarned = (emp.presentDays + emp.halfDays) * (1 / 6);
        const woAllotted = emp.weekOffs;
        const qualifyingDays = emp.presentDays + emp.halfDays + emp.weekOffs + emp.holidays;
        const elEarned = qualifyingDays * 0.05;
        const elAvailed = emp.earnedLeaves;

        // Apply year-end carry-forward and expiry logic
        // 1. Earned leaves: cap carry-forward at 30 days if entering January
        const rawElOpening = prev ? prev.el_closing : 0;
        const elOpening = month === 1 ? Math.min(30.0, rawElOpening) : rawElOpening;

        // 2. Weekly off: resets to 0 at the end of the year (does not carry forward to January)
        const woOpening = month === 1 ? 0.0 : (prev ? prev.wo_closing : 0);

        return {
          employee_id: emp.employeeId,
          year,
          month,
          el_opening: elOpening,
          el_earned_this_month: elEarned,
          el_availed_this_month: elAvailed,
          wo_opening: woOpening,
          wo_earned_this_month: woEarned,
          wo_allotted_this_month: woAllotted,
        };
      });

      await api.saveLeaveBalances(newBalances);
    } catch (err) {
      console.warn('[AutoLock] Failed to update leave balances:', err);
    }

    return {
      lockedCount: snapshots.length,
      totalCount: targetUsers.length,
      warnings,
      success: true,
      message: `Successfully locked ${snapshots.length} of ${targetUsers.length} employee records.`
    };
  } catch (err: any) {
    console.error('[AutoLock] Process failed completely:', err);
    return {
      lockedCount: 0,
      totalCount: 0,
      warnings: [],
      success: false,
      message: err?.message || 'Lock month calculation failed.'
    };
  }
}
