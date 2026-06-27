/**
 * ruleEngine.ts — Configurable Field Staff Attendance Rule Engine
 * Module 2: Config inheritance resolver
 *
 * Hierarchy (highest priority wins, walks DOWN the chain):
 *   employee  ← highest priority override
 *   shift
 *   entity    (site / project)
 *   branch
 *   region
 *   company   (client / society)
 *   location  (physical office)
 *   global    ← lowest priority (settings singleton)
 *
 * Usage:
 *   const rules = await resolveEffectiveRules({ userId, staffCategory });
 *   // returns merged StaffAttendanceRules ready to use
 */

import { supabase } from './supabase';
import type { StaffAttendanceRules, AttendanceSettings } from '../types/attendance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScopeType =
  | 'global'
  | 'location'
  | 'company'
  | 'entity'
  | 'region'
  | 'branch'
  | 'shift'
  | 'employee';

/**
 * A single entry in the inheritance chain.
 * The resolver builds this list from the user's profile and org hierarchy.
 */
export interface ScopeEntry {
  scopeType: ScopeType;
  scopeId: string | null;
  label: string;          // for debugging / audit trail
}

export interface TravelRulesConfig {
  id: string;
  scopeType: ScopeType;
  scopeId: string | null;
  city: string | null;

  twoWheelerRate: number;
  fourWheelerPetrolRate: number;
  fourWheelerDieselRate: number;
  publicTransportRate: number;
  companyVehicleRate: number;

  dailyDeductionKm: number;
  applyDeductionPer: 'day' | 'trip' | 'month';
  distanceBufferPct: number;

  enableGoogleMapsValidation: boolean;
  enableTravelReimbursement: boolean;
  enableIdleTimeTracking: boolean;
  maxIdleMinutesPerDay: number;

  minimumSitePct: number | null;
  minimumSiteHours: number | null;
}

export interface ResolvedRules {
  /** The merged StaffAttendanceRules for the user */
  rules: StaffAttendanceRules;
  /** The travel rules resolved for the user */
  travelRules: TravelRulesConfig;
  /** The scope that provided the base rules ('global', 'entity:abc', etc.) */
  resolvedScope: string;
  /** Ordered list of all scopes consulted (for debugging) */
  inheritancePath: string[];
  /** ISO timestamp of when this was computed */
  computedAt: string;
}
export interface ResolveRulesOptions {
  userId: string;
  staffCategory: 'office' | 'field' | 'site' | 'admin' | 'management';
  /** If provided, skip DB cache and recompute */
  forceRefresh?: boolean;
  /** Optional historical date to query past rules instead of live ones */
  effectiveDate?: string;
  /** Preloaded user object to avoid extra fetch */
  user?: {
    id: string;
    roleId: string;
    organizationId?: string | null;
    ruleScope?: string | null;         // entityId, companyId, etc. from user profile
    ruleScopeOverrides?: Record<string, any>;
  };
}
// ---------------------------------------------------------------------------
// Cache helpers (in-memory + DB)
// ---------------------------------------------------------------------------

/** In-memory short-lived cache (resets on page reload) */
const memCache = new Map<string, { resolved: ResolvedRules; expiresAt: number }>();
const MEM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getMemCached(userId: string): ResolvedRules | null {
  const entry = memCache.get(userId);
  if (!entry || entry.expiresAt < Date.now()) {
    memCache.delete(userId);
    return null;
  }
  return entry.resolved;
}

function setMemCache(userId: string, resolved: ResolvedRules): void {
  memCache.set(userId, {
    resolved,
    expiresAt: Date.now() + MEM_CACHE_TTL_MS,
  });
}

export function invalidateRuleCache(userId: string): void {
  memCache.delete(userId);
}

export function invalidateAllRuleCaches(): void {
  memCache.clear();
}

// ---------------------------------------------------------------------------
// DB cache helpers
// ---------------------------------------------------------------------------

async function getDbCached(userId: string): Promise<ResolvedRules | null> {
  try {
    const { data, error } = await supabase
      .from('rule_inheritance_cache')
      .select('resolved_settings, resolved_scope, inheritance_path, computed_at, expires_at')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;

    return {
      rules: data.resolved_settings,
      travelRules: (data.resolved_settings as any).__travelRules || getDefaultTravelRules(),
      resolvedScope: data.resolved_scope,
      inheritancePath: data.inheritance_path || [],
      computedAt: data.computed_at,
    };
  } catch {
    return null;
  }
}

async function setDbCache(userId: string, resolved: ResolvedRules): Promise<void> {
  try {
    await supabase
      .from('rule_inheritance_cache')
      .upsert({
        user_id: userId,
        resolved_settings: {
          ...resolved.rules,
          __travelRules: resolved.travelRules,
        },
        resolved_scope: resolved.resolvedScope,
        inheritance_path: resolved.inheritancePath,
        computed_at: resolved.computedAt,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'user_id' });
  } catch {
    // Cache write failure is non-fatal
  }
}

// ---------------------------------------------------------------------------
// Fallback / default values
// ---------------------------------------------------------------------------

function getDefaultTravelRules(): TravelRulesConfig {
  return {
    id: 'default',
    scopeType: 'global',
    scopeId: null,
    city: null,
    twoWheelerRate: 6,
    fourWheelerPetrolRate: 16,
    fourWheelerDieselRate: 14,
    publicTransportRate: 0,
    companyVehicleRate: 0,
    dailyDeductionKm: 0,
    applyDeductionPer: 'day',
    distanceBufferPct: 5,
    enableGoogleMapsValidation: false,
    enableTravelReimbursement: false,
    enableIdleTimeTracking: false,
    maxIdleMinutesPerDay: 60,
    minimumSitePct: null,
    minimumSiteHours: null,
  };
}

// ---------------------------------------------------------------------------
// Scope chain builder
// ---------------------------------------------------------------------------

/**
 * Fetches the user profile and builds the ordered scope chain to consult.
 * Order: employee → shift → entity → branch → region → company → location → global
 */
async function buildScopeChain(
  userId: string,
  preloadedUser?: ResolveRulesOptions['user']
): Promise<ScopeEntry[]> {
  const chain: ScopeEntry[] = [];

  // 1. Employee-level override (highest priority)
  chain.push({ scopeType: 'employee', scopeId: userId, label: `employee:${userId}` });

  let user = preloadedUser;
  if (!user) {
    const { data } = await supabase
      .from('users')
      .select('id, role_id, organization_id, rule_scope_overrides')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      user = {
        id: data.id,
        roleId: data.role_id,
        organizationId: data.organization_id,
        ruleScopeOverrides: data.rule_scope_overrides,
      };
    }
  }

  if (!user) return [{ scopeType: 'global', scopeId: null, label: 'global' }];

  // 2. Shift-level (if user has an assigned shift scope)
  if ((user.ruleScopeOverrides as any)?.shiftId) {
    chain.push({
      scopeType: 'shift',
      scopeId: (user.ruleScopeOverrides as any).shiftId,
      label: `shift:${(user.ruleScopeOverrides as any).shiftId}`,
    });
  }

  // 3. Entity-level (site / project)
  if (user.organizationId) {
    chain.push({
      scopeType: 'entity',
      scopeId: user.organizationId,
      label: `entity:${user.organizationId}`,
    });

    // 4. Look up entity → company, branch, region via org structure
    const { data: entityData } = await supabase
      .from('entities')
      .select('id, company_id')
      .eq('organization_id', user.organizationId)
      .maybeSingle();

    if (entityData?.company_id) {
      // 5. Branch (if entity has a branch association)
      const branchId = (user.ruleScopeOverrides as any)?.branchId;
      if (branchId) {
        chain.push({ scopeType: 'branch', scopeId: branchId, label: `branch:${branchId}` });
      }

      // 6. Region
      const regionId = (user.ruleScopeOverrides as any)?.regionId;
      if (regionId) {
        chain.push({ scopeType: 'region', scopeId: regionId, label: `region:${regionId}` });
      }

      // 7. Company (client company / society)
      chain.push({
        scopeType: 'company',
        scopeId: entityData.company_id,
        label: `company:${entityData.company_id}`,
      });
    }
  }

  // 8. Location-level (physical office geofence)
  const { data: userLoc } = await supabase
    .from('user_locations')
    .select('location_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (userLoc?.location_id) {
    chain.push({
      scopeType: 'location',
      scopeId: userLoc.location_id,
      label: `location:${userLoc.location_id}`,
    });
  }

  // 9. Global (lowest priority)
  chain.push({ scopeType: 'global', scopeId: null, label: 'global' });

  return chain;
}

// ---------------------------------------------------------------------------
// Settings fetcher — fetches all scoped settings in one query
// ---------------------------------------------------------------------------

async function fetchScopedSettings(): Promise<
  Array<{ scopeType: ScopeType; scopeId: string | null; settings: any }>
> {
  const { data, error } = await supabase
    .from('attendance_settings_scopes')
    .select('scope_type, scope_id, settings');

  if (error || !data) return [];

  return data.map((row) => ({
    scopeType: row.scope_type as ScopeType,
    scopeId: row.scope_id,
    settings: row.settings,
  }));
}

async function fetchGlobalSettings(
  staffCategory: string
): Promise<StaffAttendanceRules | null> {
  const { data } = await supabase
    .from('settings')
    .select('attendance_settings')
    .eq('id', 'singleton')
    .maybeSingle();

  if (!data?.attendance_settings) return null;
  return (data.attendance_settings as AttendanceSettings)[
    staffCategory as keyof AttendanceSettings
  ] as StaffAttendanceRules | null;
}

// ---------------------------------------------------------------------------
// Travel rules resolver
// ---------------------------------------------------------------------------

async function resolveTravelRules(
  scopeChain: ScopeEntry[],
  city?: string | null
): Promise<TravelRulesConfig> {
  const { data } = await supabase
    .from('travel_rules_config')
    .select('*');

  if (!data || data.length === 0) return getDefaultTravelRules();

  const rows = data.map((r) => ({
    id: r.id,
    scopeType: r.scope_type as ScopeType,
    scopeId: r.scope_id,
    city: r.city,
    twoWheelerRate: r.two_wheeler_rate,
    fourWheelerPetrolRate: r.four_wheeler_petrol_rate,
    fourWheelerDieselRate: r.four_wheeler_diesel_rate,
    publicTransportRate: r.public_transport_rate,
    companyVehicleRate: r.company_vehicle_rate,
    dailyDeductionKm: r.daily_deduction_km,
    applyDeductionPer: r.apply_deduction_per,
    distanceBufferPct: r.distance_buffer_pct,
    enableGoogleMapsValidation: r.enable_google_maps_validation,
    enableTravelReimbursement: r.enable_travel_reimbursement,
    enableIdleTimeTracking: r.enable_idle_time_tracking,
    maxIdleMinutesPerDay: r.max_idle_minutes_per_day,
    minimumSitePct: r.minimum_site_pct,
    minimumSiteHours: r.minimum_site_hours,
  }));

  // Walk the same scope chain — find most specific travel rule match
  for (const scope of scopeChain) {
    // Try city-specific first, then city-agnostic
    const cityMatch = city
      ? rows.find(
          (r) =>
            r.scopeType === scope.scopeType &&
            r.scopeId === scope.scopeId &&
            r.city?.toLowerCase() === city.toLowerCase()
        )
      : null;

    const genericMatch = rows.find(
      (r) =>
        r.scopeType === scope.scopeType &&
        r.scopeId === scope.scopeId &&
        !r.city
    );

    if (cityMatch) return cityMatch;
    if (genericMatch) return genericMatch;
  }

  return getDefaultTravelRules();
}

// ---------------------------------------------------------------------------
// Core resolver — deep merge of StaffAttendanceRules
// ---------------------------------------------------------------------------

/**
 * Deep merge two StaffAttendanceRules objects.
 * Fields from `override` take priority; undefined fields fall back to `base`.
 */
function mergeRules(
  base: StaffAttendanceRules,
  override: Partial<StaffAttendanceRules>
): StaffAttendanceRules {
  const result = { ...base };

  for (const key of Object.keys(override) as (keyof StaffAttendanceRules)[]) {
    const val = override[key];
    if (val === undefined || val === null) continue;

    // For array fields, override completely (don't concat)
    if (Array.isArray(val)) {
      (result as any)[key] = val;
      continue;
    }

    // For object fields, shallow merge
    if (typeof val === 'object' && !Array.isArray(val)) {
      (result as any)[key] = {
        ...(typeof (base as any)[key] === 'object' ? (base as any)[key] : {}),
        ...val,
      };
      continue;
    }

    (result as any)[key] = val;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main export: resolveEffectiveRules
// ---------------------------------------------------------------------------

/**
 * Resolves the effective StaffAttendanceRules for a given user.
 *
 * Walks the hierarchy from global → location → company → region → branch
 * → entity → shift → employee, applying overrides at each level.
 * Results are cached (in-memory 5 min, DB 24 hours).
 *
 * @example
 * const { rules, travelRules } = await resolveEffectiveRules({
 *   userId: 'uuid',
 *   staffCategory: 'field',
 * });
 */
async function fetchScopedSettingsHistorical(
  effectiveDate: string
): Promise<Array<{ scopeType: ScopeType; scopeId: string | null; settings: any }>> {
  const { data, error } = await supabase
    .from('attendance_rule_versions')
    .select('scope_type, scope_id, settings')
    .lte('effective_from', effectiveDate)
    .or(`effective_till.is.null,effective_till.gte.${effectiveDate}`);

  if (error || !data) return [];

  return data.map((row) => ({
    scopeType: row.scope_type as ScopeType,
    scopeId: row.scope_id,
    settings: row.settings,
  }));
}

async function fetchGlobalSettingsHistorical(
  staffCategory: string,
  effectiveDate: string
): Promise<StaffAttendanceRules | null> {
  const { data, error } = await supabase
    .from('attendance_rule_versions')
    .select('settings')
    .eq('scope_type', 'global')
    .is('scope_id', null)
    .lte('effective_from', effectiveDate)
    .or(`effective_till.is.null,effective_till.gte.${effectiveDate}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.settings) return null;
  const settings = data.settings as any;
  if (settings[staffCategory]) {
    return settings[staffCategory] as StaffAttendanceRules;
  }
  return settings as StaffAttendanceRules;
}

export async function resolveEffectiveRules(
  options: ResolveRulesOptions
): Promise<ResolvedRules> {
  const { userId, staffCategory, forceRefresh = false, effectiveDate, user } = options;

  // 1. Check in-memory cache (only for live rules)
  if (!forceRefresh && !effectiveDate) {
    const cached = getMemCached(userId);
    if (cached) return cached;
  }

  // 2. Check DB cache (only for live rules)
  if (!forceRefresh && !effectiveDate) {
    const dbCached = await getDbCached(userId);
    if (dbCached) {
      setMemCache(userId, dbCached);
      return dbCached;
    }
  }

  // 3. Build scope chain
  const scopeChain = await buildScopeChain(userId, user);
  const inheritancePath = scopeChain.map((s) => s.label);

  // 4. Fetch global settings as base (either historical or live)
  const globalRules = effectiveDate
    ? await fetchGlobalSettingsHistorical(staffCategory, effectiveDate)
    : await fetchGlobalSettings(staffCategory);

  if (!globalRules) {
    // No settings at all — return safe empty defaults
    const fallback: ResolvedRules = {
      rules: getEmptyRules(),
      travelRules: getDefaultTravelRules(),
      resolvedScope: 'none',
      inheritancePath,
      computedAt: new Date().toISOString(),
    };
    return fallback;
  }

  // 5. Fetch all scoped settings once (either historical or live)
  const allScopedSettings = effectiveDate
    ? await fetchScopedSettingsHistorical(effectiveDate)
    : await fetchScopedSettings();


  // 6. Walk the chain from LOW priority (global) to HIGH priority (employee)
  //    and merge each layer on top
  let merged = { ...globalRules };
  let resolvedScope = 'global';

  // Chain is ordered high→low; reverse for merge (apply low→high)
  const mergeOrder = [...scopeChain].reverse();

  for (const scope of mergeOrder) {
    if (scope.scopeType === 'global') continue; // already applied

    const scopedRow = allScopedSettings.find(
      (s) =>
        s.scopeType === scope.scopeType && s.scopeId === scope.scopeId
    );

    if (!scopedRow) continue;

    // Extract the staff category sub-section if the scoped settings have it
    const scopedRules: Partial<StaffAttendanceRules> =
      (scopedRow.settings as any)[staffCategory] ||
      scopedRow.settings;

    merged = mergeRules(merged, scopedRules);
    resolvedScope = scope.label;
  }

  // 7. Resolve travel rules
  const travelRules = await resolveTravelRules(scopeChain);

  const resolved: ResolvedRules = {
    rules: merged,
    travelRules,
    resolvedScope,
    inheritancePath,
    computedAt: new Date().toISOString(),
  };

  // 8. Cache result
  setMemCache(userId, resolved);
  // Write to DB cache in background (non-blocking)
  setDbCache(userId, resolved).catch(() => {});

  return resolved;
}

// ---------------------------------------------------------------------------
// Batch resolver — for dashboard / reports (multiple users at once)
// ---------------------------------------------------------------------------

/**
 * Resolves effective rules for multiple users in parallel.
 * Uses in-memory cache aggressively to avoid DB round-trips.
 */
export async function resolveEffectiveRulesBatch(
  users: Array<{ userId: string; staffCategory: ResolveRulesOptions['staffCategory'] }>,
  forceRefresh = false
): Promise<Map<string, ResolvedRules>> {
  const results = new Map<string, ResolvedRules>();

  await Promise.allSettled(
    users.map(async ({ userId, staffCategory }) => {
      try {
        const resolved = await resolveEffectiveRules({ userId, staffCategory, forceRefresh });
        results.set(userId, resolved);
      } catch (err) {
        console.warn(`[RuleEngine] Failed to resolve rules for ${userId}:`, err);
      }
    })
  );

  return results;
}

// ---------------------------------------------------------------------------
// Save scoped rules with cache invalidation
// ---------------------------------------------------------------------------

export async function saveScopedRules(
  scopeType: ScopeType,
  scopeId: string | null,
  settings: Partial<AttendanceSettings>,
  meta?: { changedBy: string; changeReason: string; effectiveFrom?: string }
): Promise<void> {
  // Upsert scoped settings
  const { error } = await supabase
    .from('attendance_settings_scopes')
    .upsert(
      {
        scope_type: scopeType,
        scope_id: scopeId,
        settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'scope_type,scope_id' }
    );

  if (error) throw error;

  // Insert versioned entry for audit trail
  if (meta) {
    await supabase.from('attendance_rule_versions').insert({
      scope_type: scopeType,
      scope_id: scopeId,
      settings,
      effective_from: meta.effectiveFrom || new Date().toISOString().slice(0, 10),
      created_by: meta.changedBy,
      change_reason: meta.changeReason,
    });
  }

  // Invalidate in-memory caches (DB cache is invalidated via trigger)
  invalidateAllRuleCaches();
}

// ---------------------------------------------------------------------------
// Travel rules save
// ---------------------------------------------------------------------------

export async function saveTravelRules(
  config: Partial<TravelRulesConfig>,
  changedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('travel_rules_config')
    .upsert(
      {
        scope_type: config.scopeType || 'global',
        scope_id: config.scopeId || null,
        city: config.city || null,
        two_wheeler_rate: config.twoWheelerRate,
        four_wheeler_petrol_rate: config.fourWheelerPetrolRate,
        four_wheeler_diesel_rate: config.fourWheelerDieselRate,
        public_transport_rate: config.publicTransportRate,
        company_vehicle_rate: config.companyVehicleRate,
        daily_deduction_km: config.dailyDeductionKm,
        apply_deduction_per: config.applyDeductionPer,
        distance_buffer_pct: config.distanceBufferPct,
        enable_google_maps_validation: config.enableGoogleMapsValidation,
        enable_travel_reimbursement: config.enableTravelReimbursement,
        enable_idle_time_tracking: config.enableIdleTimeTracking,
        max_idle_minutes_per_day: config.maxIdleMinutesPerDay,
        minimum_site_pct: config.minimumSitePct,
        minimum_site_hours: config.minimumSiteHours,
        created_by: changedBy,
      },
      { onConflict: 'scope_type,scope_id,city' }
    );

  if (error) throw error;

  // Invalidate all caches since travel rules affect the resolved output
  invalidateAllRuleCaches();
}

// ---------------------------------------------------------------------------
// getTravelRules — standalone fetch for travel rules (used by UI forms)
// ---------------------------------------------------------------------------

export async function getTravelRules(
  scopeType: ScopeType = 'global',
  scopeId: string | null = null,
  city: string | null = null
): Promise<TravelRulesConfig> {
  const query = supabase
    .from('travel_rules_config')
    .select('*')
    .eq('scope_type', scopeType);

  const { data } = scopeId
    ? await query.eq('scope_id', scopeId).maybeSingle()
    : await query.is('scope_id', null).maybeSingle();

  if (!data) return getDefaultTravelRules();

  return {
    id: data.id,
    scopeType: data.scope_type,
    scopeId: data.scope_id,
    city: data.city,
    twoWheelerRate: data.two_wheeler_rate,
    fourWheelerPetrolRate: data.four_wheeler_petrol_rate,
    fourWheelerDieselRate: data.four_wheeler_diesel_rate,
    publicTransportRate: data.public_transport_rate,
    companyVehicleRate: data.company_vehicle_rate,
    dailyDeductionKm: data.daily_deduction_km,
    applyDeductionPer: data.apply_deduction_per,
    distanceBufferPct: data.distance_buffer_pct,
    enableGoogleMapsValidation: data.enable_google_maps_validation,
    enableTravelReimbursement: data.enable_travel_reimbursement,
    enableIdleTimeTracking: data.enable_idle_time_tracking,
    maxIdleMinutesPerDay: data.max_idle_minutes_per_day,
    minimumSitePct: data.minimum_site_pct,
    minimumSiteHours: data.minimum_site_hours,
  };
}

// ---------------------------------------------------------------------------
// Helper — empty rules (safe fallback when DB has no settings)
// ---------------------------------------------------------------------------

function getEmptyRules(): StaffAttendanceRules {
  return {
    minimumHoursFullDay: 9,
    minimumHoursHalfDay: 4.5,
    annualEarnedLeaves: 15,
    annualSickLeaves: 10,
    monthlyFloatingLeaves: 0,
    annualCompOffLeaves: 10,
    enableAttendanceNotifications: true,
    sickLeaveCertificateThreshold: 3,
    weeklyOffDays: [0],
    gracePeriodMinutes: 15,
    dailyWorkingHours: { min: 7, max: 9 },
    monthlyTargetHours: 216,
    lunchBreakDuration: 60,
    otConversionThreshold: 8,
  };
}
