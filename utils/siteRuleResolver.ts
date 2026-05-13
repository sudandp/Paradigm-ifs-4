// Site Rule Resolver — resolves department/user-level overrides before feeding to evaluateAttendanceStatus()

import type { StaffAttendanceRules, SiteShiftDefinition } from '../types/attendance';
import type { DeptRuleConfig } from '../types/siteAttendance';

/**
 * Find the rule config for a specific department from the dynamic array.
 */
export function getDeptConfig(
  siteRules: StaffAttendanceRules,
  deptId: string
): DeptRuleConfig | undefined {
  const configs = (siteRules as any).deptRuleConfigs as DeptRuleConfig[] | undefined;
  if (!configs || !Array.isArray(configs)) return undefined;
  return configs.find(c => c.deptId === deptId);
}

/**
 * Resolve the effective weekly off days for a staff member.
 * Priority: User override → Department config → Site-wide default
 */
export function resolveWeeklyOffs(
  siteRules: StaffAttendanceRules,
  deptId: string,
  userOverride?: number[]
): number[] {
  if (userOverride && userOverride.length > 0) return userOverride;
  const deptConfig = getDeptConfig(siteRules, deptId);
  if (deptConfig?.weeklyOffDays && deptConfig.weeklyOffDays.length > 0) return deptConfig.weeklyOffDays;
  return siteRules.weeklyOffDays || [0];
}

/**
 * Resolve the effective shift for a staff member.
 * Priority: User's assigned shift → Department default → first configured shift
 */
export function resolveShift(
  siteRules: StaffAttendanceRules,
  deptId: string,
  userShiftId?: string
): SiteShiftDefinition | undefined {
  const shifts = siteRules.siteShifts || [];
  if (!shifts.length) return undefined;

  const deptConfig = getDeptConfig(siteRules, deptId);
  const targetId = userShiftId || deptConfig?.shiftId || shifts[0]?.id;

  return shifts.find(s => s.id === targetId) || shifts[0];
}

/**
 * Resolve the holiday code type for a department.
 */
export function resolveHolidayCodeType(
  siteRules: StaffAttendanceRules,
  deptId: string
): string {
  const deptConfig = getDeptConfig(siteRules, deptId);
  return deptConfig?.holidayCodeType || 'H';
}

/**
 * Resolve whether holidays are payable for this site.
 */
export function resolveHolidayToggle(siteRules: StaffAttendanceRules): boolean {
  return (siteRules as any).siteHolidayToggle ?? true;
}

/**
 * Resolve which leave types a department is eligible for.
 */
export function resolveLeaveEligibility(
  siteRules: StaffAttendanceRules,
  deptId: string
): string[] {
  const deptConfig = getDeptConfig(siteRules, deptId);
  if (deptConfig?.leaveTypes && deptConfig.leaveTypes.length > 0) return deptConfig.leaveTypes;
  return ['S/L', 'C/O'];
}

/**
 * Build a fully resolved StaffAttendanceRules object for a specific staff member.
 * This resolved object can be passed directly to evaluateAttendanceStatus().
 */
export function resolveSiteStaffRules(
  siteRules: StaffAttendanceRules,
  deptId: string,
  userWeeklyOffOverride?: number[],
  userShiftId?: string
): StaffAttendanceRules {
  return {
    ...siteRules,
    weeklyOffDays: resolveWeeklyOffs(siteRules, deptId, userWeeklyOffOverride),
  };
}

/**
 * Check if a staff remark indicates they should be excluded from duty calculations.
 */
export function isExcludedByRemarks(remarks?: string): boolean {
  if (!remarks) return false;
  const exclusions = [
    'long leave', 'hold', 'left', 'terminated', 'resigned',
    'expired', 'temp duty', 'reliever', 'shifted from', 'shifted to'
  ];
  return exclusions.includes(remarks.toLowerCase());
}
