import { supabase } from './supabase';

export interface SiteCodeRule {
  id: string;
  prefix: string;          // e.g. "46", "460", "17", "31", "32", "42", "77"
  siteName: string;        // e.g. "Parkwest", "Mahendra Aarna", "Brigade Cornerstone Utopia"
  company?: string;        // e.g. "Paradigm Services", "PIFS", "Southwall Security LLP"
  notes?: string;          // e.g. "Parkwest Shapoorji Pallonji Project in Bangalore"
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const STORAGE_KEY_SITE_CODE_MAPPINGS = 'paradigm_site_code_mappings';

export const DEFAULT_SITE_CODE_RULES: SiteCodeRule[] = [
  {
    id: 'rule-46-parkwest',
    prefix: '46',
    siteName: 'Parkwest',
    company: 'Paradigm Services',
    notes: 'Parkwest Shapoorji Pallonji Project in Bangalore (46000 Series)',
    isActive: true,
    createdAt: '2026-10-05T00:00:00.000Z',
    updatedAt: '2026-10-05T00:00:00.000Z',
  },
  {
    id: 'rule-17-aarna',
    prefix: '17',
    siteName: 'Mahendra Aarna',
    company: 'PIFS',
    notes: 'Mahendra Aarna Electronics City',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'rule-31-utopia-mep',
    prefix: '31',
    siteName: 'Brigade Cornerstone Utopia',
    company: 'PIFS',
    notes: 'Brigade Cornerstone Utopia MEP & Technical Staff',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'rule-32-utopia-sec',
    prefix: '32',
    siteName: 'Brigade Cornerstone Utopia',
    company: 'Southwall Security LLP',
    notes: 'Brigade Cornerstone Utopia Security Staff',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'rule-42-venezia',
    prefix: '42',
    siteName: 'Purva Venezia',
    company: 'PIFS',
    notes: 'Purva Venezia Yelahanka',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'rule-77-nikoo-1',
    prefix: '77',
    siteName: 'Nikoo Homes',
    company: 'PIFS',
    notes: 'Nikoo Homes Thanisandra Phase 1',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'rule-78-nikoo-2',
    prefix: '78',
    siteName: 'Nikoo Homes',
    company: 'PIFS',
    notes: 'Nikoo Homes Thanisandra Phase 2',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'rule-70-silicon',
    prefix: '70',
    siteName: 'Sobha Silicon Oasis',
    company: 'PIFS',
    notes: 'Sobha Silicon Oasis Hosa Road',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'rule-79-nikoopad-1',
    prefix: '79',
    siteName: 'Nikoo Paradigm',
    company: 'Paradigm Services',
    notes: 'Nikoo Paradigm Facility Staff',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'rule-80-nikoopad-2',
    prefix: '80',
    siteName: 'Nikoo Paradigm',
    company: 'Paradigm Services',
    notes: 'Nikoo Paradigm Technical Staff',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'rule-99-dsr-eden',
    prefix: '99',
    siteName: 'Dsr Eden Greens',
    company: 'PIFS',
    notes: 'DSR Eden Greens Carmelaram',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

/**
 * Retrieve active site code rules from local storage with built-in fallbacks.
 */
export function getSiteCodeMappings(): SiteCodeRule[] {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_SITE_CODE_RULES;
    const raw = localStorage.getItem(STORAGE_KEY_SITE_CODE_MAPPINGS);
    if (!raw) return DEFAULT_SITE_CODE_RULES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SITE_CODE_RULES;

    // Merge default rules with custom user rules so default site rules are never lost
    const map = new Map<string, SiteCodeRule>();
    DEFAULT_SITE_CODE_RULES.forEach(r => map.set(r.prefix, r));
    parsed.forEach((r: SiteCodeRule) => {
      if (r.prefix && r.siteName) map.set(r.prefix, r);
    });

    return Array.from(map.values()).sort((a, b) => a.prefix.localeCompare(b.prefix));
  } catch (err) {
    console.warn('[SiteCodeMapping] Error reading localStorage:', err);
    return DEFAULT_SITE_CODE_RULES;
  }
}

/**
 * Save or update a site code mapping rule. Persists locally and synchronizes to Supabase.
 */
export function saveSiteCodeMapping(ruleInput: Omit<SiteCodeRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): SiteCodeRule[] {
  const current = getSiteCodeMappings();
  const cleanPrefix = String(ruleInput.prefix || '').trim().replace(/^#+/, '');
  const cleanSite = String(ruleInput.siteName || '').trim();

  if (!cleanPrefix || !cleanSite) return current;

  const now = new Date().toISOString();
  const ruleId = ruleInput.id || `rule-${cleanPrefix}-${cleanSite.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  const existingIdx = current.findIndex(r => r.id === ruleId || r.prefix === cleanPrefix);
  let updatedList: SiteCodeRule[];

  const newRule: SiteCodeRule = {
    id: ruleId,
    prefix: cleanPrefix,
    siteName: cleanSite,
    company: ruleInput.company?.trim() || undefined,
    notes: ruleInput.notes?.trim() || undefined,
    isActive: ruleInput.isActive ?? true,
    createdAt: existingIdx >= 0 ? current[existingIdx].createdAt : now,
    updatedAt: now,
  };

  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = newRule;
  } else {
    updatedList = [...current, newRule];
  }

  // Save to localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SITE_CODE_MAPPINGS, JSON.stringify(updatedList));
    }
  } catch (err) {
    console.error('[SiteCodeMapping] Error saving to localStorage:', err);
  }

  // Cross-user sync to Supabase
  saveSiteCodeMappingsToSupabase(updatedList);

  // Sync to local attendance API proxy
  syncSiteCodeMappingsToApi(updatedList);

  return updatedList;
}

/**
 * Delete a site code mapping rule by id.
 */
export function deleteSiteCodeMapping(ruleId: string): SiteCodeRule[] {
  const current = getSiteCodeMappings();
  const updatedList = current.filter(r => r.id !== ruleId);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SITE_CODE_MAPPINGS, JSON.stringify(updatedList));
    }
  } catch (err) {
    console.error('[SiteCodeMapping] Error deleting from localStorage:', err);
  }

  saveSiteCodeMappingsToSupabase(updatedList);
  syncSiteCodeMappingsToApi(updatedList);

  return updatedList;
}

/**
 * Reset site code rules back to default factory mappings.
 */
export function resetSiteCodeMappingsToDefault(): SiteCodeRule[] {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SITE_CODE_MAPPINGS, JSON.stringify(DEFAULT_SITE_CODE_RULES));
    }
  } catch (err) {
    console.error('[SiteCodeMapping] Error resetting to defaults:', err);
  }

  saveSiteCodeMappingsToSupabase(DEFAULT_SITE_CODE_RULES);
  syncSiteCodeMappingsToApi(DEFAULT_SITE_CODE_RULES);

  return DEFAULT_SITE_CODE_RULES;
}

/**
 * Sync mappings to Supabase attendance_corrections system record (Zero schema migration needed).
 */
export async function saveSiteCodeMappingsToSupabase(rules: SiteCodeRule[]): Promise<boolean> {
  try {
    const payload = {
      id: 'system-site-code-mappings-v1',
      emp_code: 'SYSTEM_SITE_CODE_MAPPINGS',
      attendance_date: '2099-12-31',
      shift_name: JSON.stringify(rules),
      corrected_by: 'system_admin',
      corrected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('attendance_corrections')
      .upsert(payload, { onConflict: 'emp_code,attendance_date' });

    if (error) {
      console.warn('[SiteCodeMapping] Supabase upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[SiteCodeMapping] Supabase sync exception:', err);
    return false;
  }
}

/**
 * Fetch remote site code mappings from Supabase.
 */
export async function fetchSiteCodeMappingsFromSupabase(): Promise<SiteCodeRule[] | null> {
  try {
    const { data, error } = await supabase
      .from('attendance_corrections')
      .select('shift_name')
      .eq('emp_code', 'SYSTEM_SITE_CODE_MAPPINGS')
      .limit(1);

    if (error || !data || data.length === 0 || !data[0].shift_name) return null;
    const remoteRules = JSON.parse(data[0].shift_name);
    if (Array.isArray(remoteRules) && remoteRules.length > 0) {
      // Merge with default rules
      const map = new Map<string, SiteCodeRule>();
      DEFAULT_SITE_CODE_RULES.forEach(r => map.set(r.prefix, r));
      remoteRules.forEach((r: SiteCodeRule) => {
        if (r.prefix && r.siteName) map.set(r.prefix, r);
      });
      const merged = Array.from(map.values()).sort((a, b) => a.prefix.localeCompare(b.prefix));
      localStorage.setItem(STORAGE_KEY_SITE_CODE_MAPPINGS, JSON.stringify(merged));
      return merged;
    }
    return null;
  } catch (err) {
    console.warn('[SiteCodeMapping] Supabase fetch exception:', err);
    return null;
  }
}

/**
 * Send mappings to Express attendance API so backend PM2 service is also aware.
 */
async function syncSiteCodeMappingsToApi(rules: SiteCodeRule[]): Promise<void> {
  try {
    const payload = rules.map(r => ({ prefix: r.prefix, siteName: r.siteName }));
    await fetch('/api/mssql-site-code-mappings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'paradigm-attendance-secret-2024',
      },
      body: JSON.stringify({ mappings: payload }),
    }).catch(() => null);
  } catch (_) {}
}

/**
 * Dynamically resolves site name for an employee code based on active admin-fed rules.
 * Longest prefix match wins (e.g. "460" takes priority over "46").
 */
export function resolveSiteFromCode(code: string | number | undefined | null, dbSite?: string): { site: string; isSmart: boolean; matchedPrefix?: string } {
  const siteStr = String(dbSite || '').trim();
  // 1. If DB provided an authentic site name that is not General/Default/empty, respect it
  if (siteStr && siteStr !== 'General' && siteStr !== 'Default' && siteStr !== '—' && !siteStr.includes('ΓÇö')) {
    return { site: siteStr, isSmart: false };
  }

  const cleanCode = String(code || '').trim();
  if (!cleanCode) return { site: 'Default', isSmart: false };

  // 2. Query configured prefix rules (sorted by prefix length descending for longest match)
  const rules = getSiteCodeMappings().filter(r => r.isActive);
  const sortedRules = [...rules].sort((a, b) => b.prefix.length - a.prefix.length);

  for (const rule of sortedRules) {
    if (cleanCode.startsWith(rule.prefix)) {
      return { site: rule.siteName, isSmart: true, matchedPrefix: rule.prefix };
    }
  }

  return { site: 'Default', isSmart: false };
}
