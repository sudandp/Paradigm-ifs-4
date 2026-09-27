import { supabase } from './supabase';
import { isSecurityGuardWithoutWeekOff } from '../utils/attendanceCalculations';

export interface SiteHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  site: string;
}

const STORAGE_KEY_WEEKLY_OFFS = 'paradigm_employee_weekly_offs';
const STORAGE_KEY_SITE_HOLIDAYS = 'paradigm_site_holidays';

/**
 * Load all employee weekly offs from localStorage, merging any stored records.
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
 * Record a weekly off in attendance_corrections table (non-blocking).
 * Security Guards get NO weekly off — only General Shift Security & Security Officers get week off.
 */
export const recordWeeklyOffInCorrections = async (
  empCode: string,
  dateStr: string,
  empName?: string,
  site?: string,
  designation?: string,
  company?: string
): Promise<void> => {
  try {
    // Standard Security Guards receive NO weekly off!
    if (isSecurityGuardWithoutWeekOff({ designation, department: site, company, empCode })) {
      return;
    }
    const cleanCode = empCode.toLowerCase().trim();
    const payload = {
      id: `corr-wo-${cleanCode}-${dateStr}`,
      emp_code: cleanCode,
      emp_name: empName || null,
      attendance_date: dateStr,
      site: site || null,
      shift_name: 'W/O',
      corrected_by: '6-day cycle policy',
      corrected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    supabase
      .from('attendance_corrections')
      .upsert(payload, { onConflict: 'emp_code,attendance_date' })
      .then(() => {}, () => {});
  } catch {
    // Non-blocking
  }
};

/**
 * Load remote weekly offs from Supabase (employee_weekly_offs and attendance_corrections)
 * and merge them with local storage cache.
 */
export const loadRemoteWeeklyOffs = async (): Promise<Record<string, string[]>> => {
  const localMap = getStoredEmployeeWeeklyOffs();
  try {
    // 1. Check employee_weekly_offs table
    const { data: woData } = await supabase
      .from('employee_weekly_offs')
      .select('emp_code, weekly_offs');

    if (woData && Array.isArray(woData)) {
      woData.forEach((row: any) => {
        const c = String(row.emp_code || '').toLowerCase().trim();
        const dates: string[] = Array.isArray(row.weekly_offs) ? row.weekly_offs : [];
        if (c && dates.length > 0) {
          const existing = localMap[c] || [];
          const merged = Array.from(new Set([...existing, ...dates]));
          localMap[c] = merged;
          localMap[c.replace(/^0+/, '')] = merged;
        }
      });
    }

    // 2. Also check attendance_corrections for W/O shifts
    const { data: corrData } = await supabase
      .from('attendance_corrections')
      .select('emp_code, attendance_date')
      .eq('shift_name', 'W/O');

    if (corrData && Array.isArray(corrData)) {
      corrData.forEach((row: any) => {
        const c = String(row.emp_code || '').toLowerCase().trim();
        const d = String(row.attendance_date || '').trim();
        if (c && d) {
          const existing = localMap[c] || [];
          if (!existing.includes(d)) {
            existing.push(d);
            localMap[c] = existing;
            localMap[c.replace(/^0+/, '')] = existing;
          }
        }
      });
    }

    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY_OFFS, JSON.stringify(localMap));
    } catch {
      // Storage error fallback
    }
  } catch (err) {
    console.warn('[attendanceRosterService] Error loading remote weekly offs:', err);
  }

  return localMap;
};

/**
 * Save an employee's weekly off dates to localStorage, employee_weekly_offs,
 * and attendance_corrections in Supabase.
 */
export const saveEmployeeWeeklyOffs = async (
  empCode: string,
  dates: string[],
  empName?: string,
  siteName?: string
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

  // 1. Sync to employee_weekly_offs table in Supabase
  supabase.from('employee_weekly_offs').upsert(
    { emp_code: cleanCode, weekly_offs: dates, updated_at: new Date().toISOString() },
    { onConflict: 'emp_code' }
  ).then(() => {}, () => {});

  // 2. Sync each date to attendance_corrections table in Supabase
  dates.forEach(d => {
    recordWeeklyOffInCorrections(cleanCode, d, empName, siteName);
  });

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
