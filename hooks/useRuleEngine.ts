/**
 * useRuleEngine.ts — React hook for the Configurable Attendance Rule Engine
 * Provides resolved rules, travel rules, and status computation to components.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  resolveEffectiveRules,
  saveScopedRules,
  saveTravelRules,
  getTravelRules,
  invalidateRuleCache,
  type ResolvedRules,
  type ResolveRulesOptions,
  type ScopeType,
  type TravelRulesConfig,
} from '../services/ruleEngine';
import {
  evaluateDayAttendance,
  computeMonthlyPayable,
  isWeeklyOffDay,
  getRecurringHoliday,
  STATUS_DEFINITIONS,
  type DayAttendanceInput,
  type DayAttendanceResult,
  type MonthlyPayableSummary,
  type WeeklyOffPattern,
  type AttendanceStatusCode,
} from '../services/attendanceStatusEngine';
import type { StaffAttendanceRules, AttendanceSettings } from '../types/attendance';

// Re-export engine types for convenience
export type {
  ResolvedRules,
  TravelRulesConfig,
  ScopeType,
  DayAttendanceInput,
  DayAttendanceResult,
  MonthlyPayableSummary,
  AttendanceStatusCode,
  WeeklyOffPattern,
};
export { STATUS_DEFINITIONS, evaluateDayAttendance, computeMonthlyPayable, isWeeklyOffDay, getRecurringHoliday };

// ---------------------------------------------------------------------------
// Hook: useRuleEngine
// ---------------------------------------------------------------------------

interface UseRuleEngineOptions extends ResolveRulesOptions {
  enabled?: boolean; // If false, don't fetch (lazy loading)
}

interface UseRuleEngineResult {
  /** Resolved effective rules for this user */
  rules: StaffAttendanceRules | null;
  /** Resolved travel rules */
  travelRules: TravelRulesConfig | null;
  /** Full resolved rules object (includes metadata) */
  resolved: ResolvedRules | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if resolution failed */
  error: Error | null;
  /** Manually trigger a refresh (bypasses cache) */
  refresh: () => Promise<void>;
  /** Save scoped rules for a specific scope */
  saveRules: (
    scopeType: ScopeType,
    scopeId: string | null,
    settings: Partial<AttendanceSettings>,
    meta?: { changedBy: string; changeReason: string; effectiveFrom?: string }
  ) => Promise<void>;
  /** Save travel rules */
  saveTravelRulesConfig: (config: Partial<TravelRulesConfig>, changedBy: string) => Promise<void>;
}

export function useRuleEngine(options: UseRuleEngineOptions): UseRuleEngineResult {
  const { userId, staffCategory, forceRefresh, enabled = true, user } = options;

  const [resolved, setResolved] = useState<ResolvedRules | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetch = useCallback(
    async (force = false) => {
      if (!userId || !enabled) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await resolveEffectiveRules({
          userId,
          staffCategory,
          forceRefresh: force || forceRefresh,
          user,
        });
        if (mountedRef.current) {
          setResolved(result);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [userId, staffCategory, forceRefresh, enabled, user]
  );

  useEffect(() => {
    fetch();
  }, [fetch]);

  const refresh = useCallback(async () => {
    invalidateRuleCache(userId);
    await fetch(true);
  }, [userId, fetch]);

  const saveRules = useCallback(
    async (
      scopeType: ScopeType,
      scopeId: string | null,
      settings: Partial<AttendanceSettings>,
      meta?: { changedBy: string; changeReason: string; effectiveFrom?: string }
    ) => {
      await saveScopedRules(scopeType, scopeId, settings, meta);
      await refresh();
    },
    [refresh]
  );

  const saveTravelRulesConfig = useCallback(
    async (config: Partial<TravelRulesConfig>, changedBy: string) => {
      await saveTravelRules(config, changedBy);
      await refresh();
    },
    [refresh]
  );

  return {
    rules: resolved?.rules ?? null,
    travelRules: resolved?.travelRules ?? null,
    resolved,
    isLoading,
    error,
    refresh,
    saveRules,
    saveTravelRulesConfig,
  };
}

// ---------------------------------------------------------------------------
// Hook: useRuleEngineForScope
// Lightweight hook for admin UI — loads rules for a specific scope (not user)
// ---------------------------------------------------------------------------

interface UseRuleEngineForScopeOptions {
  scopeType: ScopeType;
  scopeId: string | null;
  staffCategory: 'office' | 'field' | 'site' | 'admin' | 'management';
  enabled?: boolean;
}

interface UseRuleEngineForScopeResult {
  travelRules: TravelRulesConfig | null;
  isLoading: boolean;
  error: Error | null;
  saveTravelRulesConfig: (config: Partial<TravelRulesConfig>, changedBy: string) => Promise<void>;
}

export function useRuleEngineForScope(
  options: UseRuleEngineForScopeOptions
): UseRuleEngineForScopeResult {
  const { scopeType, scopeId, enabled = true } = options;
  const [travelRules, setTravelRules] = useState<TravelRulesConfig | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const rules = await getTravelRules(scopeType, scopeId);
      setTravelRules(rules);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [scopeType, scopeId, enabled]);

  useEffect(() => { fetch(); }, [fetch]);

  const saveTravelRulesConfig = useCallback(
    async (config: Partial<TravelRulesConfig>, changedBy: string) => {
      await saveTravelRules(config, changedBy);
      await fetch();
    },
    [fetch]
  );

  return { travelRules, isLoading, error, saveTravelRulesConfig };
}

// ---------------------------------------------------------------------------
// Hook: useAttendanceStatus
// Evaluates attendance for a specific user + day (real-time, in the UI)
// ---------------------------------------------------------------------------

interface UseAttendanceStatusOptions {
  input: DayAttendanceInput | null;
  rules: StaffAttendanceRules | null;
}

interface UseAttendanceStatusResult {
  result: DayAttendanceResult | null;
  statusDef: typeof STATUS_DEFINITIONS[AttendanceStatusCode] | null;
}

export function useAttendanceStatus(
  options: UseAttendanceStatusOptions
): UseAttendanceStatusResult {
  const { input, rules } = options;

  if (!input || !rules) return { result: null, statusDef: null };

  const result = evaluateDayAttendance(input, rules);
  return {
    result,
    statusDef: STATUS_DEFINITIONS[result.statusCode],
  };
}

// ---------------------------------------------------------------------------
// Hook: useMonthlyPayable
// Computes monthly payable summary from an array of daily results
// ---------------------------------------------------------------------------

interface UseMonthlyPayableOptions {
  dailyResults: DayAttendanceResult[];
  rules: StaffAttendanceRules | null;
}

export function useMonthlyPayable(options: UseMonthlyPayableOptions): MonthlyPayableSummary | null {
  const { dailyResults, rules } = options;
  if (!rules || dailyResults.length === 0) return null;
  return computeMonthlyPayable(dailyResults, rules);
}
