import { supabase } from './supabase';

export interface SiteHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  site: string;
}

const STORAGE_KEY_WEEKLY_OFFS = 'paradigm_employee_weekly_offs';
const STORAGE_KEY_SITE_HOLIDAYS = 'paradigm_site_holidays';

/**
 * Load all employee weekly offs from localStorage.
 * Returns a Record<empCode, string[] of date strings>
 */
export const getStoredEmployeeWeeklyOffs = (): Record<string, string[]> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WEEKLY_OFFS);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (err) {
    console.warn('[attendanceRosterService] Error reading weekly offs from localStorage:', err);
    return {};
  }
};

/**
 * Save an employee's weekly off dates to localStorage.
 * Supabase backup is fire-and-forget (non-blocking).
 */
export const saveEmployeeWeeklyOffs = async (
  empCode: string,
  dates: string[]
): Promise<Record<string, string[]>> => {
  const current = getStoredEmployeeWeeklyOffs();
  const cleanCode = empCode.toLowerCase().trim();
  const next = {
    ...current,
    [cleanCode]: dates,
    [cleanCode.replace(/^0+/, '')]: dates,
  };

  try {
    localStorage.setItem(STORAGE_KEY_WEEKLY_OFFS, JSON.stringify(next));
  } catch (err) {
    console.warn('[attendanceRosterService] Error writing weekly offs to localStorage:', err);
  }

  // Fire-and-forget Supabase sync
  supabase.from('employee_weekly_offs').upsert(
    { emp_code: cleanCode, weekly_offs: dates, updated_at: new Date().toISOString() },
    { onConflict: 'emp_code' }
  ).then(() => {}, () => {});

  return next;
};

/**
 * Load site holidays from localStorage INSTANTLY.
 * Supabase sync runs in background and updates localStorage for next load.
 */
export const getStoredSiteHolidays = async (_siteName: string): Promise<SiteHoliday[]> => {
  // ─── Read localStorage immediately (no network wait) ───
  let localHolidays: SiteHoliday[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SITE_HOLIDAYS);
    if (raw) localHolidays = JSON.parse(raw) || [];
  } catch {
    // Storage read error fallback
  }

  // ─── Background Supabase sync ───
  supabase.from('holidays').select('*').then(({ data }) => {
    if (!data || !Array.isArray(data) || data.length === 0) return;
    const dbHolidays: SiteHoliday[] = data.map((h: any) => ({
      id: String(h.id || h.date),
      date: h.date,
      name: h.name,
      site: h.type === 'site' || h.site ? (h.site || _siteName) : 'all',
    }));
    const map = new Map<string, SiteHoliday>();
    localHolidays.forEach(h => map.set(`${h.date}-${h.name}`, h));
    dbHolidays.forEach(h => map.set(`${h.date}-${h.name}`, h));
    try {
      localStorage.setItem(STORAGE_KEY_SITE_HOLIDAYS, JSON.stringify(Array.from(map.values())));
    } catch {
      // Storage write error fallback
    }
  }, () => {});

  return localHolidays;
};

/**
 * Save a new site holiday to localStorage instantly.
 * Supabase sync is fire-and-forget.
 */
export const saveSiteHoliday = async (item: {
  date: string;
  name: string;
  site: string;
}): Promise<SiteHoliday[]> => {
  let current: SiteHoliday[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SITE_HOLIDAYS);
    if (raw) current = JSON.parse(raw) || [];
  } catch {
    // Storage read error fallback
  }

  const newHoliday: SiteHoliday = {
    id: `hol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: item.date,
    name: item.name,
    site: item.site,
  };

  // Remove duplicate same date+site, then add new
  const next = [
    ...current.filter(h => !(h.date === item.date && h.site === item.site)),
    newHoliday,
  ];

  try {
    localStorage.setItem(STORAGE_KEY_SITE_HOLIDAYS, JSON.stringify(next));
  } catch {
    // Storage write error fallback
  }

  // Fire-and-forget Supabase sync
  supabase.from('holidays').insert({
    id: newHoliday.id,
    date: item.date,
    name: item.name,
    type: 'site',
    site: item.site,
  }).then(() => {}, () => {});

  return next;
};

/**
 * Delete a site holiday from localStorage instantly.
 * Supabase sync is fire-and-forget.
 */
export const deleteSiteHoliday = async (id: string, _siteName: string): Promise<SiteHoliday[]> => {
  let current: SiteHoliday[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SITE_HOLIDAYS);
    if (raw) current = JSON.parse(raw) || [];
  } catch {
    // Storage read error fallback
  }

  const next = current.filter(h => h.id !== id);

  try {
    localStorage.setItem(STORAGE_KEY_SITE_HOLIDAYS, JSON.stringify(next));
  } catch {
    // Storage write error fallback
  }

  // Fire-and-forget Supabase sync
  supabase.from('holidays').delete().eq('id', id).then(() => {}, () => {});

  return next;
};
