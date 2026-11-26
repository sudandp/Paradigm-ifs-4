/**
 * Resolves what the asking user may see. Runs on the SERVER on every chat request — never trust the client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessScope, AskerProfile } from './types.js';
import { capabilitiesFor, scopeLevelFor, FINANCE_ALL_SITES_ROLES } from './roles.js';
import { loadAll } from './helpers.js';

const norm = (s: string | null | undefined) => String(s ?? '').toLowerCase().trim();
/**
 * Loose site key so matrix names match tracker names:
 * "Nikoo Homes 1" / "NIKOO HOMES" / "Shriram Spruthi( PIFS)" → "nikoo home" / "shriram spruthi".
 * Drops bracketed company tags, punctuation, trailing phase/block numbers, plural "homes".
 */
export const siteKey = (s: string | null | undefined) => String(s ?? '').toLowerCase()
  .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\b(phase|block|tower|wing)\s*\d+\b/g, ' ')
  .replace(/\s+\d+\s*$/g, ' ')
  .replace(/\bhomes\b/g, 'home').replace(/\s+/g, ' ').trim();

type Row = { id: string; location_id: string | null; reporting_manager_id: string | null; second_reporting_manager_id: string | null; reporting_manager_2_id: string | null; reporting_manager_3_id: string | null };

// small in-memory cache (users + matrix change rarely); 5 minutes
let cache: { at: number; users: Row[]; matrix: any[]; sitesOfUser: Map<string, Set<string>> } | null = null;
async function loadOrgData(sb: SupabaseClient) {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache;
  const [users, matrix, assignments] = await Promise.all([
    loadAll<Row>(sb, 'users', 'id, location_id, reporting_manager_id, second_reporting_manager_id, reporting_manager_2_id, reporting_manager_3_id'),
    loadAll<any>(sb, 'site_responsibility_matrix', 'site_id, site_name, ops_manager_id, site_manager_id, field_officer_id, site_supervisor_id, hr_incharge_id, accounts_incharge_id, is_active'),
    // users.location_id is an organisation GROUP id (one row, "AP Group"), not a site. The real per-user site
    // assignments are geofences in user_locations, keyed by the same locations.id the matrix uses as site_id.
    loadAll<any>(sb, 'user_locations', 'user_id, location_id').catch(() => []),
  ]);
  const sitesOfUser = new Map<string, Set<string>>();
  for (const a of assignments) if (a.user_id && a.location_id) (sitesOfUser.get(a.user_id) ?? sitesOfUser.set(a.user_id, new Set()).get(a.user_id)!).add(a.location_id);
  cache = { at: Date.now(), users, matrix, sitesOfUser };
  return cache;
}

export async function resolveScope(sb: SupabaseClient, asker: AskerProfile): Promise<AccessScope> {
  const role = asker.role_id || 'unverified';
  const level = scopeLevelFor(role);
  const capabilities = capabilitiesFor(role);
  const { users, matrix, sitesOfUser } = await loadOrgData(sb);
  const activeMatrix = matrix.filter(m => m.is_active !== false);

  let userIds = new Set<string>();
  let siteIds: Set<string> | 'all' = new Set();
  let siteNames: Set<string> | 'all' = new Set();
  let why = '';

  // sites this person is named on in the Responsibility Matrix
  const mine = activeMatrix.filter(m => [m.ops_manager_id, m.site_manager_id, m.field_officer_id, m.site_supervisor_id, m.hr_incharge_id, m.accounts_incharge_id].includes(asker.id));

  if (level === 'all') {
    userIds = new Set(users.map(u => u.id));
    siteIds = 'all'; siteNames = 'all';
    why = `${role}: organisation-wide`;
  } else if (level === 'team') {
    userIds.add(asker.id);
    let frontier = [asker.id];
    while (frontier.length) {
      const f = new Set(frontier);
      const next = users.filter(u => !userIds.has(u.id) && [u.reporting_manager_id, u.second_reporting_manager_id, u.reporting_manager_2_id, u.reporting_manager_3_id].some(x => x && f.has(x)));
      next.forEach(u => userIds.add(u.id));
      frontier = next.map(u => u.id);
    }
    const reportees = userIds.size - 1;
    siteIds = new Set(mine.map(m => m.site_id).filter(Boolean));
    siteNames = new Set(mine.map(m => norm(m.site_name)).filter(Boolean));
    // staff assigned (geofence) to one of my matrix sites
    const mySiteIds = siteIds as Set<string>;
    let siteStaff = 0;
    for (const u of users) {
      if (userIds.has(u.id)) continue;
      const assigned = sitesOfUser.get(u.id);
      if (assigned && [...assigned].some(id => mySiteIds.has(id))) { userIds.add(u.id); siteStaff++; }
    }
    why = `${role}: ${reportees} reportee(s) + ${siteStaff} staff assigned to ${siteNames.size} allocated site(s)`;
  } else if (level === 'self') {
    userIds.add(asker.id);
    const own = sitesOfUser.get(asker.id);
    if (own?.size) siteIds = new Set(own);
    siteNames = new Set(mine.map(m => norm(m.site_name)));
    why = `${role}: own records only`;
  } else {
    why = 'unverified account: no data access';
  }

  let financeSiteNames: Set<string> | 'all' = new Set();
  if (FINANCE_ALL_SITES_ROLES.has(role)) financeSiteNames = 'all';
  else if (role === 'operation_manager') financeSiteNames = new Set(activeMatrix.filter(m => m.ops_manager_id === asker.id).map(m => norm(m.site_name)));

  const keysOf = (s: Set<string> | 'all') => s === 'all' ? 'all' as const : new Set([...s].map(siteKey).filter(Boolean));
  const siteKeys = keysOf(siteNames), financeKeys = keysOf(financeSiteNames);
  const hasKey = (keys: Set<string> | 'all', n: string | null | undefined) => keys === 'all' || (!!n && keys.has(siteKey(n)));

  const scope: AccessScope = {
    level, userIds, siteIds, siteNames, financeSiteNames, capabilities, why,
    can: cap => capabilities.has(cap),
    canSeeUser: id => !!id && userIds.has(id),
    canSeeSiteId: id => siteIds === 'all' || (!!id && siteIds.has(id)),
    canSeeSiteName: n => siteNames === 'all' || (!!n && (siteNames.has(norm(n)) || hasKey(siteKeys, n))),
    canSeeFinanceSite: n => capabilities.has('finance') && (financeSiteNames === 'all' || (!!n && (financeSiteNames.has(norm(n)) || hasKey(financeKeys, n)))),
  };
  return scope;
}

/** For tests: drop the cache. */
export function clearScopeCache() { cache = null; }
