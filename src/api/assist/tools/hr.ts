/** Leave, OT, shifts, directory, onboarding/recruitment, documents status, performance — owned by the HR agent */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssistCtx, AssistTool, ToolResult } from '../types.js';
import { ROLE_LABEL } from '../roles.js';
import {
  PERIOD_PARAMS, PERSON_PARAMS, SITE_PARAMS, istBounds, istDate, loadAll, monthLabel, peopleDirectory,
  periodRange, prettyDate, resolvePerson, resolveSiteName, safeRun, todayIst, type PersonRow,
} from '../helpers.js';

// =====================================================================================================
// small shared utilities
// =====================================================================================================
const DAY_MS = 86_400_000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_ROWS = 25;
const dUTC = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
const addDays = (s: string, n: number) => new Date(dUTC(s).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const dowOf = (s: string) => dUTC(s).getUTCDay();
const monthEndOf = (s: string) => { const d = dUTC(s); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10); };
const monthStartOf = (s: string) => `${s.slice(0, 7)}-01`;
const daysIncl = (from: string, to: string) => Math.round((dUTC(to).getTime() - dUTC(from).getTime()) / DAY_MS) + 1;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const lc = (s: any) => String(s ?? '').toLowerCase().trim();
const minsToHHMM = (m: number | null | undefined) => m == null ? null : `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const hoursLabel = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
const countBy = <T,>(rows: T[], key: (r: T) => string | null | undefined) => {
  const m: Record<string, number> = {};
  rows.forEach(r => { const k = key(r) || 'unknown'; m[k] = (m[k] || 0) + 1; });
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};

let rolesCache: { at: number; map: Map<string, string> } | null = null;
async function roleNames(sb: SupabaseClient) {
  if (rolesCache && Date.now() - rolesCache.at < 10 * 60_000) return rolesCache.map;
  const rows = await loadAll<any>(sb, 'roles', 'id, display_name');
  rolesCache = { at: Date.now(), map: new Map(rows.map(r => [r.id, r.display_name])) };
  return rolesCache.map;
}
type Fail = { ok: false; result: ToolResult };
const roleLabelOf = (roles: Map<string, string>, id: string | null | undefined) => id ? (roles.get(id) || ROLE_LABEL(id)) : null;

/** Attendance rules (settings.attendance_settings) — read server-side only to apply HR rules; never returned raw. */
let settingsCache: { at: number; as: any } | null = null;
async function attendanceSettings(sb: SupabaseClient) {
  if (settingsCache && Date.now() - settingsCache.at < 5 * 60_000) return settingsCache.as;
  const { data, error } = await sb.from('settings').select('attendance_settings').eq('id', 'singleton').maybeSingle();
  if (error) throw new Error(`settings: ${error.message}`);
  settingsCache = { at: Date.now(), as: (data as any)?.attendance_settings ?? {} };
  return settingsCache.as;
}

/**
 * NOTE: users.location_id is not a site (every user carries the same group id), so "which site is a person at" comes from
 * the Site Responsibility Matrix (ops manager / site manager / field officer / supervisor / HR / accounts in-charge).
 */
const MATRIX_ROLES: [string, string][] = [['ops_manager_id', 'Ops manager'], ['site_manager_id', 'Site manager'], ['field_officer_id', 'Field officer'], ['site_supervisor_id', 'Supervisor'], ['hr_incharge_id', 'HR in-charge'], ['accounts_incharge_id', 'Accounts in-charge']];
let matrixCache: { at: number; rows: any[] } | null = null;
async function matrixRows(sb: SupabaseClient) {
  if (matrixCache && Date.now() - matrixCache.at < 5 * 60_000) return matrixCache.rows;
  const rows = (await loadAll<any>(sb, 'site_responsibility_matrix', `site_id, site_name, is_active, ${MATRIX_ROLES.map(r => r[0]).join(', ')}`)).filter(r => r.is_active !== false && r.site_name);
  matrixCache = { at: Date.now(), rows };
  return rows;
}
/** person id → [{site, role}] from the matrix */
async function matrixSitesByPerson(sb: SupabaseClient) {
  const map = new Map<string, { site: string; role: string }[]>();
  for (const m of await matrixRows(sb)) for (const [col, label] of MATRIX_ROLES) if (m[col]) { if (!map.has(m[col])) map.set(m[col], []); map.get(m[col])!.push({ site: String(m.site_name).trim(), role: label }); }
  return map;
}
const sitesLabel = (list: { site: string }[] | undefined) => { const s = [...new Set((list ?? []).map(x => x.site))]; return s.length ? s.slice(0, 2).join(', ') + (s.length > 2 ? ` +${s.length - 2}` : '') : null; };
/** Resolve a site_name arg among matrix sites the asker can see → app users allocated to it. ids=null when no site asked. */
async function siteMembers(ctx: AssistCtx, args: Record<string, any>): Promise<{ ok: true; site: string | null; ids: Set<string> | null } | { ok: false; result: ToolResult }> {
  if (!args.site_name && !args.site_exact) return { ok: true, site: null, ids: null };
  const rows = (await matrixRows(ctx.sb)).filter(m => ctx.scope.canSeeSiteName(m.site_name) || (ctx.scope.level === 'all'));
  const s = await resolveSiteName(ctx, args, rows.map(m => String(m.site_name).trim()));
  if (!s.ok) return s as any;
  if (!s.site) return { ok: true, site: null, ids: null };
  const ids = new Set<string>();
  rows.filter(m => String(m.site_name).trim() === s.site).forEach(m => MATRIX_ROLES.forEach(([c]) => m[c] && ids.add(m[c])));
  return { ok: true, site: s.site, ids };
}

/** People the asker may see, as directory rows. */
async function visiblePeople(ctx: AssistCtx) {
  const dir = await peopleDirectory(ctx.sb);
  return { dir, rows: dir.rows.filter(r => ctx.scope.canSeeUser(r.id)) };
}

// =====================================================================================================
// HR-policy helpers ported from the app (pure logic; the originals use the browser client so can't be imported)
// =====================================================================================================

/** Port of utils/attendanceCalculations.ts → isTechnicalRole */
function isTechnicalRole(role?: string | null) {
  if (!role) return false;
  const n = role.toLowerCase();
  return ['technical', 'technician', 'reliever', 'electrician', 'plumber', 'carpenter', 'hvac', 'multitech', 'maintenance'].some(k => n.includes(k));
}

/** Port of utils/attendanceCalculations.ts → isBangaloreLocation */
function isBangaloreLocation(location?: string | null) {
  if (!location) return true;
  const loc = location.trim().toLowerCase();
  if (/\b(hyderabad|hydrabath|mumbai|chennai|delhi|kolkata|pune)\b/.test(loc)) return false;
  return /\b(bangalore|bengaluru|blr|bgl|head office|corporate|hq|karnataka)\b/.test(loc) ||
    loc.includes('bangalore') || loc.includes('bengaluru') || loc.includes('head office') ||
    loc.includes('paradigm integrated') || loc.includes('pifs') || loc.includes('southwall') || loc.includes('ap enterprises') || loc.includes('ppfms');
}

/** Port of utils/attendanceCalculations.ts → getStaffCategory (role mapping from Attendance Rules → Staff Selections) */
function staffCategory(roleId: string, societyId: string | null | undefined, as: any): 'office' | 'field' | 'site' {
  const raw = as?.missed_checkout_config?.role_mapping || as?.missedCheckoutConfig?.roleMapping;
  const mapping = {
    office: raw?.office || ['admin', 'hr', 'finance', 'developer', 'hr_ops', 'management', 'back_office_staff', 'accountant'],
    field: raw?.field || ['field_staff', 'field_officer', 'technical_reliever', 'supervisor', 'site_supervisor', 'operation_manager', 'operations_manager', 'bd', 'business_developer'],
    site: raw?.site || ['site_manager', 'security_guard'],
  };
  const r = lc(roleId);
  if (mapping.office.some((x: string) => lc(x) === r)) return 'office';
  if (mapping.field.some((x: string) => lc(x) === r)) return 'field';
  if (mapping.site.some((x: string) => lc(x) === r)) return 'site';
  if (isTechnicalRole(roleId) || ['field_staff', 'field_officer', 'technical_reliever', 'operations_manager', 'operation_manager', 'bd', 'business_developer'].includes(r) || r.includes('field_') || r.includes('reliever')) return 'field';
  if (['site_manager', 'security_guard', 'supervisor', 'lady_guard'].includes(r) || r.startsWith('site_') || r.includes('guard')) return 'site';
  const office = ['admin', 'hr', 'finance', 'developer', 'hr_ops', 'management', 'super_admin', 'iot_architect', 'accountant', 'senior_accountant',
    'accounts_executive', 'accounts_excitative', 'accounts_excitative_invoice', 'finance_manager', 'hr_onboaring', 'hr_recruitment', 'auditor', 'director',
    'facility_executive', 'pantry_boy'].includes(r) || ['account', 'finance', 'audit', 'billing', 'director', 'office', 'admin', 'management', 'reception', 'developer', 'pantry', 'hr_'].some(k => r.includes(k)) || r === 'hr';
  if (office) return 'office';
  if (societyId && (societyId.startsWith('comp_') || societyId.includes('head_office') || societyId.includes('corporate'))) return 'office';
  if (societyId && !societyId.endsWith('_head_office')) return 'site';
  return 'office';
}

/** utils/constants.ts → FIXED_HOLIDAYS */
const FIXED_HOLIDAYS = [
  { name: 'Republic Day', date: '01-26' }, { name: 'May Day', date: '05-01' }, { name: 'Independence Day', date: '08-15' },
  { name: 'Gandhi Jayanti', date: '10-02' }, { name: 'Karnataka Rajyotsava', date: '11-01' },
];

type Ev = { id: string; timestamp: string; type: string; is_ot?: boolean | null };

/** Port of utils/attendanceDayGrouping.ts → buildAttendanceDayKeyByEventId (single user; IST day keys; night shifts keep the start date). */
function buildDayKeys(events: Ev[]): Record<string, string> {
  const kindOf = (t: string) => t === 'punch-in' || t === 'punch-out' ? 'office_punch' : t === 'site-in' || t === 'site-out' ? 'site' : t === 'site-ot-in' || t === 'site-ot-out' ? 'site_ot' : null;
  const isStart = (t: string) => t === 'punch-in' || t === 'site-in' || t === 'site-ot-in';
  const isEnd = (t: string) => t === 'punch-out' || t === 'site-out' || t === 'site-ot-out';
  const sorted = [...events].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  const open: Record<string, { startKey: string; startMs: number } | undefined> = {};
  const keyById: Record<string, string> = {};
  let lastClosedKey: string | null = null, lastClosedMs = 0;
  for (const e of sorted) {
    const ms = +new Date(e.timestamp);
    const key = istDate(e.timestamp);
    const kind = kindOf(e.type);
    const active = Object.values(open).filter(Boolean) as { startKey: string; startMs: number }[];
    const existing = active.length ? active.reduce((b, c) => c.startMs < b.startMs ? c : b).startKey : null;
    if (kind && isStart(e.type)) {
      if (kind === 'office_punch') {
        for (const k of Object.keys(open)) delete open[k];
        open[kind] = { startKey: key, startMs: ms }; keyById[e.id] = key; continue;
      }
      if (open[kind]) { open[kind] = { startKey: key, startMs: ms }; keyById[e.id] = key; continue; }
      const stale = existing && active.length > 0 && active.every(s => ms - s.startMs > 30 * 3600_000);
      const startKey = existing && !stale ? existing : key;
      open[kind] = { startKey, startMs: ms }; keyById[e.id] = startKey; continue;
    }
    if (kind && isEnd(e.type)) {
      const closed = open[kind]?.startKey || existing || (lastClosedKey && ms - lastClosedMs <= 15 * 60_000 ? lastClosedKey : key);
      keyById[e.id] = closed;
      if (open[kind]?.startKey) { lastClosedKey = open[kind]!.startKey; lastClosedMs = ms; }
      delete open[kind]; continue;
    }
    keyById[e.id] = existing || key;
  }
  return keyById;
}

/** Port of utils/attendanceCalculations.ts → calculateWorkingHours (events fetched without work_type, as the leave engine does). */
function workingHoursOf(events: Ev[], day: string, now: Date): number {
  const sorted = [...events].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  let net = 0, main = false, site = false, brk = false, last: number | null = null;
  const minsBetween = (a: number, b: number) => Math.trunc((b - a) / 60_000);
  for (const e of sorted) {
    const t = +new Date(e.timestamp);
    if (last != null) { let el = minsBetween(last, t); if (el > 30 * 60) el = 0; if ((main || site) && !brk) net += el; }
    switch (e.type) {
      case 'punch-in': main = true; break;
      case 'site-in': site = true; break;
      case 'punch-out': main = false; site = false; brk = false; break;
      case 'site-out': site = false; brk = false; break;
      case 'site-ot-in': site = true; break;
      case 'site-ot-out': site = false; brk = false; break;
      case 'break-in': brk = true; break;
      case 'break-out': brk = false; break;
    }
    last = t;
  }
  const today = todayIst(now);
  const live = day === today || (day === addDays(today, -1) && (main || site));
  if (last != null && live) { let el = minsBetween(last, +now); if (el > 30 * 60) el = 0; if ((main || site) && !brk) net += el; }
  return net / 60;
}

// -----------------------------------------------------------------------------------------------------
// Leave balance — port of services/api.ts → getLeaveBalancesForUser (as of today) + LeaveDashboard card maths
// -----------------------------------------------------------------------------------------------------
async function computeLeaveBalance(sb: SupabaseClient, userId: string, now: Date) {
  const as = await attendanceSettings(sb);
  const roles = await roleNames(sb);
  const { data: u, error } = await sb.from('users').select(`id, name, role_id, gender, joining_date, created_at, organization_name, society_name, society_id, location_id,
    earned_leave_opening_balance, earned_leave_opening_date, sick_leave_opening_balance, sick_leave_opening_date, child_care_leave_opening_balance,
    child_care_leave_opening_date, comp_off_opening_balance, comp_off_opening_date, floating_leave_opening_balance, floating_leave_opening_date,
    companies!users_society_id_fkey(location)`).eq('id', userId).single();
  if (error || !u) throw new Error(`users: ${error?.message}`);
  const user: any = u;
  const comp = Array.isArray(user.companies) ? user.companies[0] : user.companies;
  const companyLocation: string | null = comp?.location ?? null;
  const roleName = roles.get(user.role_id) || user.role_id;
  const staffType = staffCategory(user.role_id, user.society_id, as);
  const rules: any = as?.[staffType] ?? {};
  const isFemale = ['female', 'ladies'].includes(lc(user.gender));
  const isMale = !isFemale;

  const todayStr = todayIst(now);
  const year = Number(todayStr.slice(0, 4));
  const yearStart = `${year}-01-01`;
  const monthEnd = monthEndOf(todayStr);
  const yb = istBounds(yearStart, `${year}-12-31`);

  const [leavesRes, compOffRes, otRes, holRes, recRes, evRes, uhRes] = await Promise.all([
    sb.from('leave_requests').select('leave_type, start_date, end_date, day_option, status, reason').eq('user_id', userId)
      .in('status', ['approved', 'pending_manager_approval', 'pending_hr_confirmation']).gte('start_date', yearStart).lte('start_date', `${year}-12-31`),
    sb.from('comp_off_logs').select('*').eq('user_id', userId).gte('created_at', yearStart).lte('created_at', `${year}-12-31T23:59:59`),
    sb.from('extra_work_logs').select('hours_worked').eq('user_id', userId).eq('claim_type', 'OT').eq('status', 'Approved').gte('work_date', monthStartOf(todayStr)).lte('work_date', monthEnd),
    sb.from('holidays').select('*'),
    sb.from('recurring_holidays').select('*'),
    loadAll<Ev>(sb, 'attendance_events', 'id, timestamp, type', q => q.eq('user_id', userId).gte('timestamp', yb.startUtc).lte('timestamp', yb.endUtc).order('timestamp')),
    sb.from('user_holidays').select('holiday_date, holiday_name').eq('user_id', userId),
  ]);
  let approvedLeaves: any[] = (leavesRes as any).data ?? [];
  const compOffData: any[] = (compOffRes as any).data ?? [];
  const otData: any[] = (otRes as any).data ?? [];
  const holidays: any[] = (holRes as any).data ?? [];
  const recurring: any[] = ((recRes as any).data ?? []).map((r: any) => ({ type: r.role_type, day: r.day, n: r.occurrence }));
  const yearEvents = evRes as Ev[];
  const userHolidays: any[] = (uhRes as any).data ?? [];

  const isNotValid = (from?: string, till?: string) => (!!from && todayStr < from) || (!!till && todayStr > till);
  const floatingValid = (date: string) => {
    const months: number[] | undefined = rules.floating_holiday_months;
    if (months && months.length) return months.includes(Number(date.slice(5, 7)) - 1);
    if (rules.floating_leaves_valid_from && date < rules.floating_leaves_valid_from) return false;
    if (rules.floating_leaves_expiry_date && date > rules.floating_leaves_expiry_date) return false;
    return true;
  };
  // accrualEndDate = now (we always answer "as of today")
  const attendedDates = new Set(yearEvents.filter(e => lc(e.type).includes('check') || lc(e.type).includes('in')).map(e => istDate(e.timestamp)));

  const holidayDates = new Set<string>(holidays.map(h => String(h.date).slice(0, 10)));
  FIXED_HOLIDAYS.forEach(f => holidayDates.add(`${year}-${f.date}`));
  userHolidays.forEach(h => h.holiday_date && holidayDates.add(h.holiday_date));
  const locStr = companyLocation || user.organization_name || user.society_name || 'Bangalore';
  const isBangaloreStaff = (isBangaloreLocation(locStr) || !companyLocation) && (staffType === 'office' || staffType === 'field');
  for (let d = yearStart; d <= monthEnd; d = addDays(d, 1)) {
    const dayName = DAY_NAMES[dowOf(d)];
    const nth = Math.ceil(Number(d.slice(8, 10)) / 7);
    const hit = recurring.some(rh => {
      const is3rdSat = rh.day === 'Saturday' && rh.n === 3;
      if (rh.type && rh.type !== staffType && !is3rdSat) return false;
      if (rh.day !== dayName) return false;
      if (is3rdSat && (!isBangaloreStaff || !isMale || !floatingValid(d))) return false;
      if (rh.n === 0) return true;
      return rh.n === nth;
    }) || (isBangaloreStaff && isMale && dayName === 'Saturday' && nth === 3 && floatingValid(d));
    if (hit) holidayDates.add(d);
  }

  const weeklyOffDays: number[] = rules.weekly_off_days || rules.weeklyOffDays || [0];
  const keyById = buildDayKeys(yearEvents);
  const eventsByDay: Record<string, Ev[]> = {};
  yearEvents.forEach(e => { const k = keyById[e.id]; if (k) (eventsByDay[k] ||= []).push(e); });
  const workDates = new Set(Object.keys(eventsByDay));
  approvedLeaves.forEach(l => { if (lc(l.leave_type).includes('correction') && ['approved', 'correction_made'].includes(lc(l.status))) workDates.add(l.start_date); });
  const fullThreshold = rules.minimum_hours_full_day || rules.daily_working_hours?.min || 8;
  const halfThreshold = rules.minimum_hours_half_day || 4;
  const compCorrectionOn = (date: string) => approvedLeaves.some(l => {
    const t = lc(l.leave_type);
    return (t.includes('comp') || (t.includes('correction') && lc(l.reason).includes('comp'))) && ['approved', 'correction_made'].includes(lc(l.status)) && l.start_date === date;
  });
  const compOffEarnedOn = (date: string) => {
    if (!(weeklyOffDays.includes(dowOf(date)) || holidayDates.has(date))) return 0;
    if (compCorrectionOn(date)) return 1;
    const evs = eventsByDay[date] || [];
    const wh = workingHoursOf(evs, date, now);
    const hasPunch = evs.some(e => ['punch-in', 'site-in', 'check-in', 'site-ot-in'].includes(lc(e.type)));
    return wh >= fullThreshold ? 1 : wh >= halfThreshold ? 0.5 : hasPunch ? 0.5 : 0;
  };

  // ---- Earned Leave (qualifying-day accrual)
  let earnedTotal = rules.annual_earned_leaves || 0, earnedThisMonth = 0, qualifyingDays = 0;
  const elOpening = Number(user.earned_leave_opening_balance || 0);
  const elOpeningDate: string = user.earned_leave_opening_date || yearStart;
  if (rules.earned_leave_accrual) {
    const qualifying = (cutoff: string) => {
      if (cutoff < elOpeningDate) return 0;
      let count = 0, weekWork = 0;
      for (let d = elOpeningDate; d <= cutoff; d = addDays(d, 1)) {
        const dw = dowOf(d);
        const hasPunch = attendedDates.has(d) || workDates.has(d);
        const leave = approvedLeaves.find(l => ['approved', 'correction_made'].includes(lc(l.status)) && d >= l.start_date && d <= l.end_date);
        const lt = leave ? lc(leave.leave_type) : '';
        let q = false;
        if (hasPunch || lt.includes('wfh')) { q = true; weekWork++; }
        else if (holidayDates.has(d) || lt.includes('comp') || lt.includes('earned') || lt.includes('sick')) { q = true; weekWork++; }
        else if (weeklyOffDays.includes(dw) && weekWork >= 4) q = true;
        if (q) count++;
        if (dw === 0) weekWork = 0;
      }
      return count;
    };
    qualifyingDays = qualifying(todayStr);
    const rate = Number(rules.earned_leave_accrual.amount_earned || 1.5) / Number(rules.earned_leave_accrual.days_required || 30);
    earnedTotal = r1(elOpening + qualifyingDays * rate);
    const prevEnd = addDays(monthStartOf(todayStr), -1);
    const earnedPrev = prevEnd >= elOpeningDate ? r1(elOpening + qualifying(prevEnd) * rate) : 0;
    earnedThisMonth = Math.max(0, r1(earnedTotal - earnedPrev));
    if (isNotValid(rules.earned_leaves_valid_from, rules.earned_leaves_expiry_date)) { earnedTotal = 0; earnedThisMonth = 0; }
  }

  // ---- Sick Leave (1 per calendar month, no carry forward; opening balance only for mid-year joiners)
  let sickTotal = 0;
  const slOpenDate: string | null = user.sick_leave_opening_date;
  const midYear = !!slOpenDate && slOpenDate > yearStart && slOpenDate.slice(0, 4) === String(year);
  const slOpening = midYear ? Number(user.sick_leave_opening_balance || 0) : 0;
  const calMonths = (a: string, b: string) => (Number(a.slice(0, 4)) - Number(b.slice(0, 4))) * 12 + (Number(a.slice(5, 7)) - Number(b.slice(5, 7)));
  if (!(slOpenDate && todayStr < slOpenDate)) {
    if (rules.enable_sick_leave_accrual) {
      const open = midYear ? slOpenDate! : yearStart;
      sickTotal = todayStr < open ? 0 : slOpening + calMonths(todayStr, open) + 1;
    } else {
      sickTotal = slOpening + Math.min(rules.annual_sick_leaves || 12, calMonths(todayStr, yearStart) + 1);
    }
  }
  if (isNotValid(rules.sick_leaves_valid_from, rules.sick_leaves_expiry_date)) sickTotal = 0;

  const expiry = {
    earned: isNotValid(rules.earned_leaves_valid_from, rules.earned_leaves_expiry_date),
    sick: isNotValid(rules.sick_leaves_valid_from, rules.sick_leaves_expiry_date),
    floating: !floatingValid(todayStr),
    compOff: isNotValid(rules.comp_off_leaves_valid_from, rules.comp_off_leaves_expiry_date),
  };

  // ---- Blue Leave / floating (3rd Saturday, Bangalore male office/field staff, monthly)
  let thirdSat: string | null = null;
  for (let d = monthStartOf(todayStr), sats = 0; d <= monthEnd; d = addDays(d, 1)) if (dowOf(d) === 6 && ++sats === 3) { thirdSat = d; break; }
  const thirdSatPassed = !!thirdSat && thirdSat <= todayStr;
  let workedThirdSat = !!thirdSat && (attendedDates.has(thirdSat) || workDates.has(thirdSat));
  if (thirdSat && !workedThirdSat) workedThirdSat = approvedLeaves.some(l => l.start_date === thirdSat && ['approved', 'correction_made'].includes(lc(l.status)) && (lc(l.leave_type).includes('correction') || lc(l.leave_type).includes('regularization')));
  const blueEligible = isBangaloreStaff && floatingValid(todayStr) && !isFemale;
  const floatingTotal = blueEligible && thirdSatPassed && workedThirdSat ? (rules.monthly_floating_leaves || 1) : 0;

  const b = {
    earnedUsed: 0, earnedPending: 0, sickUsed: 0, sickPending: 0, floatingUsed: 0, floatingPending: 0,
    compOffUsed: compOffData.filter(l => l.status === 'used' && !l.leave_request_id && (l.date_earned || l.created_at || '').slice(0, 10) <= todayStr).length,
    compOffPending: 0, pinkUsed: 0, pinkPending: 0, childCareUsed: 0, childCarePending: 0, maternityUsed: 0, maternityPending: 0, lopDays: 0,
  };

  // ---- Pink / maternity (female only)
  const joining: string = user.joining_date || String(user.created_at || yearStart).slice(0, 10);
  const pinkTotal = isFemale && todayStr >= joining ? 1 : 0;
  let maternityTotal = 0;
  if (isFemale) {
    const jd = dUTC(joining), td = dUTC(todayStr);
    let tenure = (td.getUTCFullYear() - jd.getUTCFullYear()) * 12 + (td.getUTCMonth() - jd.getUTCMonth());
    if (td.getUTCDate() < jd.getUTCDate()) tenure--;
    if (tenure >= (rules.maternity_min_tenure_months ?? 6)) maternityTotal = (rules.maternity_leave_weeks ?? 26) * 7;
  }

  // ---- usage per leave request (dedupe identical submissions)
  const seen = new Set<string>();
  approvedLeaves = approvedLeaves.filter(l => { const k = `${lc(l.leave_type)}_${l.start_date}_${l.end_date}_${l.day_option || 'full'}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const workingDayAmount = (l: any) => {
    let amt = 0;
    for (let d = l.start_date; d <= l.end_date; d = addDays(d, 1)) if (!weeklyOffDays.includes(dowOf(d)) && !holidayDates.has(d) && !workDates.has(d)) amt += 1;
    return amt;
  };
  for (const l of approvedLeaves) {
    if (l.start_date > todayStr) continue;
    const type = lc(l.leave_type);
    const isEarned = type.includes('earned') || type === 'el';
    if (!isEarned && Number(l.start_date.slice(0, 4)) < year) continue;
    const amount = l.day_option === 'half' ? 0.5
      : (type.includes('comp') || type === 'co' || type.includes('floating') || type === 'fh') ? workingDayAmount(l) : daysIncl(l.start_date, l.end_date);
    const ok = l.status === 'approved', pend = l.status === 'pending_manager_approval' || l.status === 'pending_hr_confirmation';
    let adj = type;
    if (type.includes('sick') || type === 'sl' || type === 's/l') {
      const nth = Math.ceil(Number(l.start_date.slice(8, 10)) / 7);
      if (dowOf(l.start_date) === 6 && nth === 3 && !isFemale && floatingValid(l.start_date)) adj = 'floating';
    }
    const inMonth = l.start_date >= monthStartOf(todayStr) && l.start_date <= monthEnd;
    if (adj.includes('earned') || adj === 'el') {
      if (!expiry.earned || (rules.earned_leaves_expiry_date && l.start_date <= rules.earned_leaves_expiry_date)) { if (ok) b.earnedUsed += amount; if (pend) b.earnedPending += amount; }
    } else if (adj.includes('sick') || adj === 'sl' || adj === 's/l') {
      if (!expiry.sick || (rules.sick_leaves_expiry_date && l.start_date <= rules.sick_leaves_expiry_date)) { if (ok) b.sickUsed += amount; if (pend) b.sickPending += amount; }
    } else if ((adj.includes('floating') || adj === 'fh' || adj.includes('blue leave') || adj === 'hp') && !adj.includes('work')) {
      if (inMonth && (!expiry.floating || floatingValid(l.start_date))) { if (ok) b.floatingUsed += amount; if (pend) b.floatingPending += amount; }
    } else if (type.includes('pink')) {
      if (inMonth) { if (ok) b.pinkUsed += amount; if (pend) b.pinkPending += amount; }
    } else if (type.includes('child')) {
      if (ok) b.childCareUsed += amount; if (pend) b.childCarePending += amount;
    } else if (type.includes('maternity')) {
      if (ok) b.maternityUsed += amount; if (pend) b.maternityPending += amount;
    } else if (type.includes('comp') || type === 'co') {
      if (!expiry.compOff || (rules.comp_off_leaves_expiry_date && l.start_date <= rules.comp_off_leaves_expiry_date)) { if (ok) b.compOffUsed += amount; if (pend) b.compOffPending += amount; }
    } else if (type.includes('loss of pay') || type === 'lop') {
      if (ok) b.lopDays += amount;
    }
  }

  // ---- Comp Off rolling pool (4-day cap, FIFO) — the "active" balance shown on the Leave dashboard
  const coOpening = Number(user.comp_off_opening_balance || 0);
  const coOpenDate: string | null = user.comp_off_opening_date;
  const coEffOpening = coOpenDate && coOpenDate <= todayStr ? coOpening : 0;
  const endMonth = Number(todayStr.slice(5, 7)) - 1;
  let carried = 0, active = 0;
  for (let m = 0; m <= endMonth; m++) {
    const inM = (d: string) => Number(d.slice(0, 4)) === year && Number(d.slice(5, 7)) - 1 === m;
    let carriedAvail = carried, cur = 0;
    if (coOpenDate) { if (inM(coOpenDate)) cur += coEffOpening; } else if (m === 0) cur += coEffOpening;
    workDates.forEach(d => { if (inM(d) && d <= todayStr) cur += compOffEarnedOn(d); });
    compOffData.forEach(lg => {
      if (lg.status !== 'earned') return;
      const ds = lg.date_earned;
      if (ds && workDates.has(ds)) return;
      const d = String(ds || lg.created_at).slice(0, 10);
      if (inM(d) && d <= todayStr) cur += typeof lg.amount === 'number' ? lg.amount : (lg.day_option === 'half' ? 0.5 : 1);
    });
    if (carriedAvail + cur > 4) { const ex = carriedAvail + cur - 4; carriedAvail = Math.max(0, carriedAvail - ex); cur = Math.min(4, cur); }
    let used = 0;
    compOffData.forEach(lg => { if (lg.status === 'used' && !lg.leave_request_id) { const d = String(lg.date_earned || lg.created_at).slice(0, 10); if (inM(d) && d <= todayStr) used += 1; } });
    approvedLeaves.forEach(l => {
      const t = lc(l.leave_type);
      if (!(t.includes('comp') || t === 'co') || !inM(l.start_date) || l.start_date > monthEnd) return;
      if (l.status === 'approved' || l.status === 'correction_made') used += l.day_option === 'half' ? 0.5 : workingDayAmount(l);
    });
    let rem = used;
    if (carriedAvail > 0) { const x = Math.min(carriedAvail, rem); carriedAvail -= x; rem -= x; }
    if (rem > 0 && cur > 0) { const x = Math.min(cur, rem); cur -= x; rem -= x; }
    if (m === endMonth) active = Math.min(4, Math.max(0, carriedAvail + cur));
    else carried = Math.min(4, Math.max(0, carriedAvail + cur));
  }

  // site OT days this month (technical roles) — first site-ot-in + site-ot-out on the same day
  let siteOtDaysThisMonth = 0;
  if (isTechnicalRole(roleName)) {
    const byDate: Record<string, Set<string>> = {};
    yearEvents.forEach(e => { if (e.type === 'site-ot-in' || e.type === 'site-ot-out') { const d = istDate(e.timestamp); if (d >= monthStartOf(todayStr) && d <= monthEnd) (byDate[d] ||= new Set()).add(e.type); } });
    Object.entries(byDate).forEach(([d, t]) => { if (t.has('site-ot-in') && (t.has('site-ot-out') || d === todayStr)) siteOtDaysThisMonth++; });
  }

  // probation (Leave dashboard hides EL & comp-off cards for 3 months after joining)
  const probationEnd = (() => { const j = dUTC(joining); return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth() + 3, j.getUTCDate())).toISOString().slice(0, 10); })();
  const onProbation = todayStr < probationEnd;

  return {
    user, roleName, staffType, todayStr, isFemale, onProbation, probationEnd, isTechnical: isTechnicalRole(roleName),
    earned: { total: earnedTotal, used: b.earnedUsed, pending: b.earnedPending, available: Math.max(0, r1(earnedTotal - b.earnedUsed - b.earnedPending)), accruedThisMonth: earnedThisMonth, qualifyingDays, opening: elOpening, openingDate: elOpeningDate, expired: expiry.earned, rule: rules.earned_leave_accrual },
    sick: { total: sickTotal, used: b.sickUsed, pending: b.sickPending, available: r1(sickTotal - b.sickUsed - b.sickPending), expired: expiry.sick },
    compOff: { active, pending: b.compOffPending, available: Math.max(0, r1(active - b.compOffPending)), usedThisYear: b.compOffUsed },
    blue: { eligible: blueEligible, thirdSaturday: thirdSat, thirdSatPassed, workedThirdSat, total: floatingTotal, used: b.floatingUsed, pending: b.floatingPending, available: Math.max(0, floatingTotal - b.floatingUsed - b.floatingPending) },
    pink: { total: pinkTotal, used: b.pinkUsed, pending: b.pinkPending, available: Math.max(0, pinkTotal - b.pinkUsed - b.pinkPending) },
    maternity: { entitlementDays: maternityTotal, used: b.maternityUsed, pending: b.maternityPending },
    childCare: { opening: Number(user.child_care_leave_opening_balance || 0), used: b.childCareUsed, pending: b.childCarePending },
    lopDaysThisYear: b.lopDays,
    otHoursApprovedThisMonth: r2(otData.reduce((s, l) => s + (Number(l.hours_worked) || 0), 0)),
    siteOtDaysThisMonth,
  };
}

// =====================================================================================================
// 1. get_leave_balance
// =====================================================================================================
const getLeaveBalance: AssistTool = {
  name: 'get_leave_balance',
  module: 'Leave',
  capability: 'leave',
  description: 'Current leave balance of one employee (or the asker): earned leave, sick leave, comp off, blue/floating leave, pink leave — computed with the same rules as the Leave dashboard. Use for "Kavya\'s leave balance", "how many EL do I have", "my comp off balance". NOT for leave history or who is on leave (use get_leave_requests).',
  parameters: {
    type: 'object',
    properties: {
      ...PERSON_PARAMS,
      leave_type: { type: 'string', enum: ['all', 'earned', 'sick', 'comp_off', 'blue', 'pink'], description: 'Which balance the user asked about. Default all.' },
    },
  },
  run: safeRun(async (ctx, args) => {
    const who = await resolvePerson(ctx, args);
    if (!who.ok) return (who as Fail).result;
    const p = who.person;
    ctx.audit({ tool: 'get_leave_balance', args, subjectUserId: p.id, allowed: true });
    const bal = await computeLeaveBalance(ctx.sb, p.id, ctx.now);
    const notes: string[] = [];
    if (bal.onProbation) notes.push(`On probation until ${prettyDate(bal.probationEnd)}; the Leave dashboard hides Earned Leave and Comp Off during probation.`);
    if (bal.isTechnical) notes.push('Comp Off card is hidden for technical roles in the app.');
    notes.push('Earned Leave accrues 1.5 days per 30 qualifying days (worked days, holidays, approved leaves, qualifying weekly offs). Comp Off active pool is capped at 4 days.');
    const blue = bal.blue.eligible
      ? { ...bal.blue, status: !bal.blue.thirdSatPassed ? `3rd Saturday (${prettyDate(bal.blue.thirdSaturday)}) not reached yet — 0 available` : bal.blue.workedThirdSat ? 'Worked on 3rd Saturday — earned for this month (expires at month end)' : 'Did not work on 3rd Saturday — consumed as holiday, 0 available' }
      : { eligible: false, status: 'Not eligible (Blue Leave is for Bangalore male office/field staff in valid months)' };
    const facts: Record<string, any> = {
      employee: p.name, role: bal.roleName, staff_category: bal.staffType, as_of: prettyDate(bal.todayStr),
      earned_leave: { available: bal.earned.available, total_accrued: bal.earned.total, used: bal.earned.used, pending: bal.earned.pending, accrued_this_month: bal.earned.accruedThisMonth, qualifying_days: bal.earned.qualifyingDays, opening_balance: bal.earned.opening, opening_date: bal.earned.openingDate, expired: bal.earned.expired },
      sick_leave: { available: bal.sick.available, total: bal.sick.total, used: bal.sick.used, pending: bal.sick.pending, expired: bal.sick.expired },
      comp_off: { available: bal.compOff.available, active_pool: bal.compOff.active, pending: bal.compOff.pending, max_pool: 4 },
      blue_leave: blue,
      ...(bal.isFemale ? { pink_leave: bal.pink, maternity_leave: bal.maternity, child_care_leave: { ...bal.childCare, note: 'Child-care entitlement depends on child records, which Assist does not read — check the Leave dashboard.' } } : {}),
      loss_of_pay_days_this_year: bal.lopDaysThisYear,
      notes,
    };
    const t = args.leave_type && args.leave_type !== 'all' ? args.leave_type : null;
    if (t) facts.asked_about = t;
    const rows: (string | number | null)[][] = [
      ['Earned Leave', bal.earned.available, bal.earned.total, bal.earned.used, bal.earned.pending],
      ['Sick Leave', bal.sick.available, bal.sick.total, bal.sick.used, bal.sick.pending],
      ['Comp Off', bal.compOff.available, bal.compOff.active, null, bal.compOff.pending],
      ...(bal.blue.eligible ? [['Blue Leave', bal.blue.available, bal.blue.total, bal.blue.used, bal.blue.pending] as any] : []),
      ...(bal.isFemale ? [['Pink Leave', bal.pink.available, bal.pink.total, bal.pink.used, bal.pink.pending] as any] : []),
    ];
    return { kind: 'answer', facts, sourceLabel: `Leave balance · ${prettyDate(bal.todayStr)}`, table: { columns: ['Leave', 'Available', 'Total', 'Used', 'Pending'], rows } };
  }),
};

// =====================================================================================================
// 2. get_leave_requests
// =====================================================================================================
const LEAVE_TYPE_MATCH: Record<string, (t: string) => boolean> = {
  earned: t => t.includes('earned') || t === 'el',
  sick: t => t.includes('sick') || t === 'sl',
  comp_off: t => t.includes('comp'),
  pink: t => t.includes('pink'),
  blue: t => t.includes('blue') || t.includes('floating'),
  loss_of_pay: t => t.includes('loss of pay') || t === 'lop',
  wfh: t => t.includes('wfh'),
  permission: t => t.includes('permission'),
  child_care: t => t.includes('child'),
  correction: t => t.includes('correction'),
};
const PENDING = ['pending_manager_approval', 'pending_hr_confirmation', 'pending_admin_correction'];
/** Not real absences: attendance corrections, short permissions and "Blue Leave Work" (working on 3rd Saturday). */
const NOT_ABSENCE = (t: string) => t.includes('correction') || t.includes('permission') || t.includes('work');
const statusLabel = (s: string) => ({ pending_manager_approval: 'Pending manager', pending_hr_confirmation: 'Pending HR', pending_admin_correction: 'Pending admin correction', correction_made: 'Correction made' } as any)[s] || (s ? s[0].toUpperCase() + s.slice(1) : s);
const leaveDays = (l: any, from: string, to: string) => {
  if (l.day_option === 'half') return 0.5;
  const s = l.start_date > from ? l.start_date : from, e = l.end_date < to ? l.end_date : to;
  return s > e ? 0 : daysIncl(s, e);
};

const getLeaveRequests: AssistTool = {
  name: 'get_leave_requests',
  module: 'Leave',
  capability: 'leave',
  description: 'Leave requests: (a) one person\'s leave history in a period ("Kavya\'s leaves this year", "my sick leaves in October"); (b) leaves waiting for the asker\'s approval ("leaves pending my approval"); (c) who is on leave on a day / in a period ("who is on leave today", "who is on leave this week at Nikoo"). Filter by status or leave type. NOT for balances (get_leave_balance) or punch/attendance days.',
  parameters: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['person_history', 'pending_my_approval', 'on_leave'], description: 'person_history = one person\'s requests; pending_my_approval = requests where the asker is the current approver; on_leave = everyone (in the asker\'s scope) on leave in the period.' },
      ...PERSON_PARAMS,
      ...PERIOD_PARAMS,
      ...SITE_PARAMS,
      status: { type: 'string', enum: ['any', 'approved', 'pending', 'rejected', 'withdrawn', 'cancelled'], description: 'Default any (history) / approved+pending (on_leave).' },
      leave_type: { type: 'string', enum: ['any', ...Object.keys(LEAVE_TYPE_MATCH)], description: 'Leave type filter. Default any.' },
    },
  },
  run: safeRun(async (ctx, args) => {
    const mode = args.mode || (args.person_name || args.person_id || args.about_self ? 'person_history' : 'on_leave');
    const dir = await peopleDirectory(ctx.sb);
    const typeOk = (t: string) => !args.leave_type || args.leave_type === 'any' || (LEAVE_TYPE_MATCH[args.leave_type]?.(lc(t)) ?? true);
    const statusOk = (s: string) => !args.status || args.status === 'any' || (args.status === 'pending' ? PENDING.includes(s) : s === args.status);
    const cols = 'id, user_id, leave_type, start_date, end_date, day_option, status, current_approver_id, created_at';

    if (mode === 'pending_my_approval') {
      const rows = (await loadAll<any>(ctx.sb, 'leave_requests', cols, q => q.eq('current_approver_id', ctx.asker.id).in('status', PENDING).order('start_date')))
        .filter(r => typeOk(r.leave_type));
      ctx.audit({ tool: 'get_leave_requests', args, allowed: true, note: 'pending_my_approval' });
      if (!rows.length) return { kind: 'not_found', text: 'There are no leave requests waiting for your approval right now.' };
      const name = (id: string) => dir.rows.find(r => r.id === id)?.name ?? 'Unknown';
      return {
        kind: 'answer', sourceLabel: 'Leave · pending your approval',
        facts: { pending_count: rows.length, leave_requests: rows.filter(r => !NOT_ABSENCE(lc(r.leave_type))).length, attendance_corrections_and_permissions: rows.filter(r => NOT_ABSENCE(lc(r.leave_type))).length, by_type: countBy(rows, r => r.leave_type), oldest_request: prettyDate(rows.map(r => r.created_at).sort()[0]), employees: [...new Set(rows.map(r => name(r.user_id)))].slice(0, MAX_ROWS) },
        table: { columns: ['Employee', 'Type', 'From', 'To', 'Days', 'Status'], rows: rows.slice(0, MAX_ROWS).map(r => [name(r.user_id), r.leave_type, prettyDate(r.start_date), prettyDate(r.end_date), r.day_option === 'half' ? 0.5 : daysIncl(r.start_date, r.end_date), statusLabel(r.status)]) },
      };
    }

    if (mode === 'on_leave') {
      const per = periodRange(args.period, args.start_date, args.end_date, ctx.now, 'today');
      let people = dir.rows.filter(r => ctx.scope.canSeeUser(r.id));
      const sm = await siteMembers(ctx, args);
      if (!sm.ok) return (sm as Fail).result;
      const site = sm.site;
      if (sm.ids) people = people.filter(r => sm.ids!.has(r.id));
      const ids = new Set(people.map(r => r.id));
      const msites = await matrixSitesByPerson(ctx.sb);
      const rows = (await loadAll<any>(ctx.sb, 'leave_requests', cols, q => q.lte('start_date', per.to).gte('end_date', per.from)))
        .filter(r => ids.has(r.user_id) && !NOT_ABSENCE(lc(r.leave_type)) && typeOk(r.leave_type))
        .filter(r => args.status && args.status !== 'any' ? statusOk(r.status) : (r.status === 'approved' || PENDING.includes(r.status)));
      ctx.audit({ tool: 'get_leave_requests', args, subjectSite: site, allowed: true, note: 'on_leave' });
      const scopeWord = site ? `at ${site}` : ctx.scope.level === 'all' ? 'in the organisation' : ctx.scope.level === 'team' ? 'in your team/sites' : '(your own records)';
      if (!rows.length) return { kind: 'not_found', text: `Nobody ${scopeWord} has an approved or pending leave for ${per.label}.` };
      const wfh = rows.filter(r => lc(r.leave_type).includes('wfh'));
      const leaves = rows.filter(r => !lc(r.leave_type).includes('wfh'));
      const name = (id: string) => dir.rows.find(r => r.id === id)!;
      const siteOf = (id: string) => sitesLabel(msites.get(id));
      return {
        kind: 'answer', sourceLabel: `Leave · ${per.label}`,
        facts: {
          period: per.label, scope: scopeWord, people_on_leave: new Set(leaves.map(r => r.user_id)).size, approved: leaves.filter(r => r.status === 'approved').length,
          pending_approval: leaves.filter(r => PENDING.includes(r.status)).length, by_type: countBy(leaves, r => r.leave_type), work_from_home: new Set(wfh.map(r => r.user_id)).size,
        },
        table: { columns: ['Employee', 'Site', 'Type', 'From', 'To', 'Status'], rows: rows.slice(0, MAX_ROWS).map(r => [name(r.user_id)?.name ?? null, siteOf(r.user_id), r.leave_type + (r.day_option === 'half' ? ' (half day)' : ''), prettyDate(r.start_date), prettyDate(r.end_date), statusLabel(r.status)]) },
      };
    }

    // person_history
    const who = await resolvePerson(ctx, args);
    if (!who.ok) return (who as Fail).result;
    const p = who.person;
    const per = periodRange(args.period, args.start_date, args.end_date, ctx.now, 'this_year');
    const rows = (await loadAll<any>(ctx.sb, 'leave_requests', cols, q => q.eq('user_id', p.id).lte('start_date', per.to).gte('end_date', per.from).order('start_date')))
      .filter(r => typeOk(r.leave_type) && statusOk(r.status));
    ctx.audit({ tool: 'get_leave_requests', args, subjectUserId: p.id, allowed: true });
    if (!rows.length) return { kind: 'not_found', text: `${p.name} has no ${args.leave_type && args.leave_type !== 'any' ? args.leave_type.replace('_', ' ') + ' ' : ''}leave requests for ${per.label}.` };
    const absences = rows.filter(r => !NOT_ABSENCE(lc(r.leave_type)));
    const daysBy: Record<string, number> = {};
    absences.filter(r => r.status === 'approved').forEach(r => { daysBy[r.leave_type] = r1((daysBy[r.leave_type] || 0) + leaveDays(r, per.from, per.to)); });
    return {
      kind: 'answer', sourceLabel: `Leave · ${per.label}`,
      facts: {
        employee: p.name, period: per.label, requests: rows.length, by_status: countBy(rows, r => statusLabel(r.status)),
        approved_leave_days_by_type: daysBy, approved_leave_days_total: r1(Object.values(daysBy).reduce((a, b) => a + b, 0)),
        pending: rows.filter(r => PENDING.includes(r.status)).length, corrections_and_permissions: rows.length - absences.length,
        note: 'Days are calendar days within the period (half-day = 0.5); the Leave dashboard deducts comp off only on working days.',
      },
      table: { columns: ['Type', 'From', 'To', 'Days', 'Status'], rows: rows.slice(-MAX_ROWS).map(r => [r.leave_type, prettyDate(r.start_date), prettyDate(r.end_date), r.day_option === 'half' ? 0.5 : daysIncl(r.start_date, r.end_date), statusLabel(r.status)]) },
    };
  }),
};

// =====================================================================================================
// 3. get_overtime
// =====================================================================================================
type OtStats = { siteOtDays: number; breakdownVisits: number; siteOtHours: number; otPunchDays: number; otPunchHours: number; claims: number; claimsApproved: number; claimsPending: number; claimHours: number };
function siteOtFromEvents(events: Ev[], from: string, to: string, now: Date) {
  // Port of pages/leaves/OTCalendar.tsx: per day, first site-ot-in → next site-ot-out; ≤5h = breakdown visit, >5h = site OT day.
  const sorted = [...events].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  const days = new Map<string, number>();
  sorted.forEach((e, i) => {
    if (e.type !== 'site-ot-in') return;
    const d = istDate(e.timestamp);
    if (d < from || d > to || days.has(d)) return;
    const out = sorted.slice(i + 1).find(x => x.type === 'site-ot-out');
    let mins = 0;
    if (out) mins = Math.max(0, Math.trunc((+new Date(out.timestamp) - +new Date(e.timestamp)) / 60_000));
    else if (d === todayIst(now)) mins = Math.max(0, Math.trunc((+now - +new Date(e.timestamp)) / 60_000));
    days.set(d, mins);
  });
  let siteOtDays = 0, breakdownVisits = 0, totalMins = 0;
  days.forEach(m => { totalMins += m; if (m > 0 && m <= 300) breakdownVisits++; else if (m > 300) siteOtDays++; });
  // OT-cycle punches: punch-in flagged is_ot → next punch-out
  let otPunchDays = 0, otPunchMins = 0;
  sorted.forEach((e, i) => {
    if (e.type !== 'punch-in' || !e.is_ot) return;
    const d = istDate(e.timestamp);
    if (d < from || d > to) return;
    otPunchDays++;
    const out = sorted.slice(i + 1).find(x => x.type === 'punch-out');
    if (out) { const m = Math.trunc((+new Date(out.timestamp) - +new Date(e.timestamp)) / 60_000); if (m > 0 && m < 30 * 60) otPunchMins += m; }
  });
  return { siteOtDays, breakdownVisits, siteOtHours: r2(totalMins / 60), otPunchDays, otPunchHours: r2(otPunchMins / 60) };
}

const getOvertime: AssistTool = {
  name: 'get_overtime',
  module: 'Overtime',
  capability: 'attendance',
  description: 'Overtime / extra work for one person or for the asker\'s whole team in a period: Site OT hours and days, OT-cycle punches, extra-work (OT) claims and the OT hours bank. Use for "Kavya\'s OT this month", "my overtime hours", "OT hours of my team last month". NOT for normal days worked or late marks.',
  parameters: {
    type: 'object',
    properties: {
      ...PERSON_PARAMS,
      team: { type: 'boolean', description: 'true for the asker\'s whole team / everyone they can see ("my team", "all staff").' },
      ...PERIOD_PARAMS,
    },
  },
  run: safeRun(async (ctx, args) => {
    const per = periodRange(args.period, args.start_date, args.end_date, ctx.now, 'this_month');
    const b = istBounds(per.from, addDays(per.to, 1)); // +1 day so a site-ot-out after midnight is found
    const dir = await peopleDirectory(ctx.sb);
    let people: PersonRow[];
    let label: string;
    if (args.team && !args.person_name && !args.person_id) {
      if (ctx.scope.level === 'self') return { kind: 'denied', text: 'You can only view your own overtime.' };
      people = dir.rows.filter(r => ctx.scope.canSeeUser(r.id) && r.status !== 'left');
      label = ctx.scope.level === 'all' ? 'all employees' : 'your team and sites';
    } else {
      const who = await resolvePerson(ctx, args);
      if (!who.ok) return (who as Fail).result;
      people = [who.person]; label = who.person.name;
    }
    const ids = people.map(p => p.id);
    const idSet = new Set(ids);
    const [events, claims, banks] = await Promise.all([
      loadAll<Ev & { user_id: string }>(ctx.sb, 'attendance_events', 'id, user_id, timestamp, type, is_ot', q => { let x = q.gte('timestamp', b.startUtc).lte('timestamp', b.endUtc).or('type.in.(site-ot-in,site-ot-out,punch-out),is_ot.eq.true'); if (ids.length <= 100) x = x.in('user_id', ids); return x; }),
      loadAll<any>(ctx.sb, 'extra_work_logs', 'user_id, work_date, work_type, claim_type, hours_worked, status', q => q.gte('work_date', per.from).lte('work_date', per.to)),
      loadAll<any>(ctx.sb, 'users', 'id, ot_hours_bank', q => q.in('id', ids.slice(0, 500))),
    ]);
    const evBy = new Map<string, Ev[]>();
    events.forEach(e => { if (idSet.has(e.user_id)) { if (!evBy.has(e.user_id)) evBy.set(e.user_id, []); evBy.get(e.user_id)!.push(e); } });
    const stats = new Map<string, OtStats>();
    for (const p of people) {
      const s = siteOtFromEvents(evBy.get(p.id) ?? [], per.from, per.to, ctx.now);
      const c = claims.filter(x => x.user_id === p.id);
      stats.set(p.id, { ...s, claims: c.length, claimsApproved: c.filter(x => x.status === 'Approved').length, claimsPending: c.filter(x => lc(x.status) === 'pending').length, claimHours: r2(c.reduce((a, x) => a + (Number(x.hours_worked) || 0), 0)) });
    }
    const bankOf = new Map(banks.map(x => [x.id, Number(x.ot_hours_bank) || 0]));
    ctx.audit({ tool: 'get_overtime', args, subjectUserId: people.length === 1 ? people[0].id : null, allowed: true });
    const note = 'Site OT: per day, Site-OT-in to Site-OT-out; sessions of 5h or less count as breakdown visits (as on the OT calendar). OT claims are extra-work requests; most have no hours entered. OT-to-comp-off conversion is currently switched off, so the OT hours bank is a legacy figure.';
    if (people.length === 1) {
      const s = stats.get(people[0].id)!;
      if (!s.siteOtDays && !s.breakdownVisits && !s.otPunchDays && !s.claims && !bankOf.get(people[0].id)) return { kind: 'not_found', text: `No overtime recorded for ${people[0].name} in ${per.label} (no Site OT sessions, OT punches or extra-work claims).` };
      return {
        kind: 'answer', sourceLabel: `Overtime · ${per.label}`,
        facts: { employee: people[0].name, period: per.label, site_ot_hours: s.siteOtHours, site_ot_hours_label: hoursLabel(s.siteOtHours), site_ot_days: s.siteOtDays, breakdown_visits: s.breakdownVisits, ot_cycle_punch_days: s.otPunchDays, ot_cycle_punch_hours: s.otPunchHours, extra_work_claims: s.claims, claims_approved: s.claimsApproved, claims_pending: s.claimsPending, claimed_hours: s.claimHours, ot_hours_bank: r2(bankOf.get(people[0].id) || 0), note },
      };
    }
    const withOt = people.filter(p => { const s = stats.get(p.id)!; return s.siteOtHours || s.otPunchDays || s.claims; })
      .sort((a, b) => (stats.get(b.id)!.siteOtHours + stats.get(b.id)!.otPunchHours) - (stats.get(a.id)!.siteOtHours + stats.get(a.id)!.otPunchHours));
    if (!withOt.length) return { kind: 'not_found', text: `No overtime recorded for ${label} in ${per.label}.` };
    const sum = (k: keyof OtStats) => r2(withOt.reduce((a, p) => a + (stats.get(p.id)![k] as number), 0));
    return {
      kind: 'answer', sourceLabel: `Overtime · ${per.label}`,
      facts: { group: label, period: per.label, people_with_ot: withOt.length, of_people: people.length, total_site_ot_hours: sum('siteOtHours'), total_site_ot_days: sum('siteOtDays'), total_breakdown_visits: sum('breakdownVisits'), total_ot_cycle_punch_days: sum('otPunchDays'), total_extra_work_claims: sum('claims'), top: withOt.slice(0, 5).map(p => `${p.name}: ${hoursLabel(stats.get(p.id)!.siteOtHours + stats.get(p.id)!.otPunchHours)}`), note },
      table: { columns: ['Employee', 'Site OT hrs', 'Site OT days', 'Breakdown visits', 'OT punch days', 'OT punch hrs', 'OT claims'], rows: withOt.slice(0, MAX_ROWS).map(p => { const s = stats.get(p.id)!; return [p.name, s.siteOtHours, s.siteOtDays, s.breakdownVisits, s.otPunchDays, s.otPunchHours, s.claims]; }) },
    };
  }),
};

// =====================================================================================================
// 4. get_shift_and_weekly_off
// =====================================================================================================
const getShiftAndWeeklyOff: AssistTool = {
  name: 'get_shift_and_weekly_off',
  module: 'Shifts & rules',
  capability: 'attendance',
  description: 'Shift timings, grace time, working-hour rules and weekly off of a person (or the asker), or the list of configured shifts. Use for "what is Kavya\'s weekly off", "my shift timing", "what is the grace time", "full day hours for site staff", "list of shifts". NOT for whether someone was late or present (attendance/violation tools).',
  parameters: {
    type: 'object',
    properties: {
      ...PERSON_PARAMS,
      list_shifts: { type: 'boolean', description: 'true when the user asks about shifts / grace time in general (not about one person).' },
    },
  },
  run: safeRun(async (ctx, args) => {
    const as = await attendanceSettings(ctx.sb);
    const [shiftMaster, shiftRules] = await Promise.all([
      loadAll<any>(ctx.sb, 'shift_master', 'shift_code, shift_name, start_mins, end_mins, crosses_midnight, grace_minutes, max_duration_hrs, role_category, is_active'),
      loadAll<any>(ctx.sb, 'shift_rule_configs', 'group_name, shift_code, display_timing, expected_hours, min_completed_hours, site_name, target_role'),
    ]);
    const catRules = (cat: string) => {
      const r = as?.[cat] ?? {};
      return {
        full_day_min_hours: r.minimum_hours_full_day ?? null, half_day_min_hours: r.minimum_hours_half_day ?? null,
        daily_working_hours: r.daily_working_hours ? `${r.daily_working_hours.min}–${r.daily_working_hours.max} h` : null,
        office_check_out_time: r.fixed_office_hours?.check_out_time ?? null, lunch_break_minutes: r.lunch_break_duration ?? null,
        shift_grace_minutes: r.shift_grace_minutes ?? null,
        site_shifts: (r.site_shifts || []).map((s: any) => `${s.name} ${s.start_time}–${s.end_time}`),
      };
    };
    const shiftTable = {
      columns: ['Shift', 'Code', 'Timing', 'Grace (min)', 'For'],
      rows: shiftMaster.filter(s => s.is_active !== false).map(s => [s.shift_name, s.shift_code, `${minsToHHMM(s.start_mins)}–${minsToHHMM(s.end_mins)}${s.crosses_midnight ? ' (+1 day)' : ''}`, s.grace_minutes, s.role_category])
        .concat(shiftRules.map(s => [s.group_name, s.shift_code, s.display_timing, null, s.target_role])).slice(0, MAX_ROWS) as any,
    };
    if (args.list_shifts && !args.person_name && !args.person_id) {
      ctx.audit({ tool: 'get_shift_and_weekly_off', args, allowed: true });
      return {
        kind: 'answer', sourceLabel: 'Shifts & attendance rules',
        facts: { biometric_shifts: shiftMaster.length, shift_groups: shiftRules.length, grace_minutes_by_shift: Object.fromEntries(shiftMaster.map(s => [s.shift_name, s.grace_minutes])), site_staff_grace_minutes: as?.site?.shift_grace_minutes ?? null, rules_by_staff_category: { office: catRules('office'), field: catRules('field'), site: catRules('site') } },
        table: shiftTable,
      };
    }
    const who = await resolvePerson(ctx, args);
    if (!who.ok) {
      // site / biometric staff who are not app users: staff_weekly_off (keyed by emp code + site)
      if (args.person_name && ((who as Fail).result.kind === 'not_found' || (who as Fail).result.kind === 'denied')) {
        const words = lc(args.person_name).split(/\s+/).filter(Boolean);
        const swo = (await loadAll<any>(ctx.sb, 'staff_weekly_off', 'staff_name, weekly_off_day, weekly_off_day2, effective_from, department, site'))
          .filter(s => words.every(w => lc(s.staff_name).includes(w)) && ctx.scope.canSeeSiteName(s.site));
        if (swo.length === 1) {
          const s = swo[0];
          ctx.audit({ tool: 'get_shift_and_weekly_off', args, subjectSite: s.site, allowed: true, note: 'staff_weekly_off' });
          return { kind: 'answer', sourceLabel: 'Weekly off roster', facts: { staff: s.staff_name, site: s.site, department: s.department, weekly_off: [DAY_NAMES[s.weekly_off_day], s.weekly_off_day2 != null ? DAY_NAMES[s.weekly_off_day2] : null].filter(Boolean).join(' & '), effective_from: prettyDate(s.effective_from), source: 'Site weekly-off roster (biometric staff)' } };
        }
      }
      return (who as Fail).result;
    }
    const p = who.person;
    const { data: u } = await ctx.sb.from('users').select('role_id, society_id, weekly_off_days, weekly_off_pattern, rule_scope_overrides').eq('id', p.id).single();
    const cat = staffCategory((u as any)?.role_id || p.role_id, (u as any)?.society_id, as);
    const userOff: number[] | null = Array.isArray((u as any)?.weekly_off_days) && (u as any).weekly_off_days.length ? (u as any).weekly_off_days : null;
    const ruleOff: number[] = as?.[cat]?.weekly_off_days || [0];
    const offDays = userOff ?? ruleOff;
    const pattern = (u as any)?.weekly_off_pattern || 'fixed';
    const patternLabel = ({ fixed: 'every week', alternate_saturday: 'plus 1st/3rd/5th Saturdays', '2nd_4th_saturday': 'plus 2nd & 4th Saturdays', rotational: 'rotating weekly' } as any)[pattern] || pattern;
    const recurring = (as?.[cat]?.recurring_holidays || []).map((r: any) => `${['', '1st', '2nd', '3rd', '4th', '5th'][r.n] || 'every'} ${r.day}`);
    ctx.audit({ tool: 'get_shift_and_weekly_off', args, subjectUserId: p.id, allowed: true });
    const rules = catRules(cat);
    return {
      kind: 'answer', sourceLabel: 'Shifts & weekly off',
      facts: {
        employee: p.name, role: ROLE_LABEL(p.role_id), staff_category: cat,
        weekly_off: `${offDays.map(d => DAY_NAMES[d]).join(' & ')} (${patternLabel})`, weekly_off_source: userOff ? 'set on the employee profile' : `default for ${cat} staff`,
        recurring_holidays: recurring, rules, note: cat === 'site' ? 'Site staff work in the site shifts listed; the shift actually worked is detected from punch times.' : 'No individual shift is assigned in the app; timings follow the staff-category rules.',
      },
      ...(cat === 'site' ? { table: shiftTable } : {}),
    };
  }),
};

// =====================================================================================================
// 5. get_holidays
// =====================================================================================================
const getHolidays: AssistTool = {
  name: 'get_holidays',
  module: 'Holidays',
  capability: null,
  description: 'Holiday calendar: fixed company holidays, the optional-holiday pool, the employee\'s own selected holidays and 3rd-Saturday holidays. Use for "upcoming holidays", "holidays this month", "is Friday a holiday", "which holidays did I choose". NOT for leave requests or weekly offs.',
  parameters: {
    type: 'object',
    properties: {
      ...PERSON_PARAMS,
      ...PERIOD_PARAMS,
      upcoming: { type: 'boolean', description: 'true for "next / upcoming holidays" (from today to year end).' },
    },
  },
  run: safeRun(async (ctx, args) => {
    const who = await resolvePerson(ctx, args);
    if (!who.ok) return (who as Fail).result;
    const p = who.person;
    const as = await attendanceSettings(ctx.sb);
    const today = todayIst(ctx.now);
    const year = Number(today.slice(0, 4));
    const per = args.upcoming || (!args.period && !args.start_date) ? { from: today, to: `${year}-12-31`, label: `upcoming (rest of ${year})` } : { ...periodRange(args.period, args.start_date, args.end_date, ctx.now, 'this_month') };
    // holidays are a calendar: "this month / week / year" means the whole period, not just up to today
    if (args.period === 'this_month') { per.to = monthEndOf(per.from); per.label = monthLabel(per.from); }
    if (args.period === 'this_week') { per.to = addDays(per.from, 6); per.label = `this week (${prettyDate(per.from)} – ${prettyDate(per.to)})`; }
    if (args.period === 'this_year') { per.to = `${year}-12-31`; per.label = String(year); }
    if (per.to < per.from) return { kind: 'not_found', text: 'That period has no dates.' };
    const { data: u } = await ctx.sb.from('users').select('role_id, society_id, gender, companies!users_society_id_fkey(location)').eq('id', p.id).single();
    const cat = staffCategory((u as any)?.role_id || p.role_id, (u as any)?.society_id, as);
    const rules = as?.[cat] ?? {};
    const comp: any = Array.isArray((u as any)?.companies) ? (u as any).companies[0] : (u as any)?.companies;
    const male = !['female', 'ladies'].includes(lc((u as any)?.gender));
    const bangalore = (isBangaloreLocation(comp?.location) || !comp?.location) && (cat === 'office' || cat === 'field');
    const floatingValid = (d: string) => { const m: number[] | undefined = rules.floating_holiday_months; if (m?.length) return m.includes(Number(d.slice(5, 7)) - 1); if (rules.floating_leaves_valid_from && d < rules.floating_leaves_valid_from) return false; if (rules.floating_leaves_expiry_date && d > rules.floating_leaves_expiry_date) return false; return true; };
    const [adminHol, siteHol, userHol] = await Promise.all([
      loadAll<any>(ctx.sb, 'holidays', '*'),
      loadAll<any>(ctx.sb, 'site_holidays', '*').catch(() => []),
      loadAll<any>(ctx.sb, 'user_holidays', 'holiday_name, holiday_date', q => q.eq('user_id', p.id)),
    ]);
    const list: { date: string; name: string; kind: string }[] = [];
    for (let y = Number(per.from.slice(0, 4)); y <= Number(per.to.slice(0, 4)); y++) FIXED_HOLIDAYS.forEach(f => list.push({ date: `${y}-${f.date}`, name: f.name, kind: 'Fixed company holiday' }));
    adminHol.forEach(h => h.date && list.push({ date: String(h.date).slice(0, 10), name: h.name || 'Holiday', kind: 'Company holiday' }));
    userHol.forEach(h => list.push({ date: h.holiday_date, name: h.holiday_name, kind: 'Selected optional holiday' }));
    if (bangalore && male) {
      for (let d = monthStartOf(per.from); d <= per.to; d = addDays(monthEndOf(d), 1)) {
        let sats = 0;
        for (let x = d; x <= monthEndOf(d); x = addDays(x, 1)) if (dowOf(x) === 6 && ++sats === 3) { if (floatingValid(x)) list.push({ date: x, name: '3rd Saturday', kind: 'Recurring (3rd Saturday)' }); break; }
      }
    }
    const seen = new Set<string>();
    const inRange = list.filter(h => h.date >= per.from && h.date <= per.to).sort((a, b) => a.date.localeCompare(b.date))
      .filter(h => { const k = h.date + h.name; if (seen.has(k)) return false; seen.add(k); return true; });
    const pool = (rules.holiday_pool || []).map((h: any) => ({ date: `${year}${h.date}`, name: h.name })).filter((h: any) => h.date >= per.from && h.date <= per.to);
    const chosen = new Set(userHol.map(h => h.holiday_date));
    ctx.audit({ tool: 'get_holidays', args, subjectUserId: p.id, allowed: true });
    if (!inRange.length && !pool.length) return { kind: 'not_found', text: `No holidays found for ${per.label}.` };
    return {
      kind: 'answer', sourceLabel: `Holidays · ${per.label}`,
      facts: {
        employee: p.id === ctx.asker.id ? 'you' : p.name, period: per.label, holidays: inRange.length, next_holiday: inRange.find(h => h.date >= today) ? `${inRange.find(h => h.date >= today)!.name} on ${prettyDate(inRange.find(h => h.date >= today)!.date)}` : null,
        selected_optional_holidays_this_year: userHol.filter(h => String(h.holiday_date).startsWith(String(year))).length, optional_holidays_allowed: rules.employee_holidays ?? null,
        optional_pool_in_period_not_selected: pool.filter((h: any) => !chosen.has(h.date)).map((h: any) => `${h.name} (${prettyDate(h.date)})`).slice(0, 10),
        site_holidays_configured: siteHol.length,
        note: 'Company calendar = fixed holidays + holidays the employee picked from the optional pool; 3rd Saturday is a holiday for Bangalore male office/field staff in valid months.',
      },
      table: { columns: ['Date', 'Day', 'Holiday', 'Type'], rows: inRange.slice(0, MAX_ROWS).map(h => [prettyDate(h.date), DAY_NAMES[dowOf(h.date)], h.name, h.kind]) },
    };
  }),
};

// =====================================================================================================
// 6. get_employee_profile
// =====================================================================================================
const getEmployeeProfile: AssistTool = {
  name: 'get_employee_profile',
  module: 'Directory',
  capability: 'directory',
  description: 'Basic profile of one employee (or the asker): role, site, reporting manager(s), joining date, company, employment status, and phone/email when the asker is allowed. Use for "who is Kavya\'s manager", "what is Isaac\'s role / site", "when did Ravi join", "Isaac\'s phone number", "who is my manager". NOT for counting staff (count_employees).',
  parameters: {
    type: 'object',
    properties: {
      ...PERSON_PARAMS,
      fields: { type: 'array', items: { type: 'string' }, description: 'Optional: what was asked, e.g. ["manager"], ["phone"], ["joining_date"], ["site"], ["role"].' },
    },
  },
  run: safeRun(async (ctx, args) => {
    const who = await resolvePerson(ctx, args);
    if (!who.ok) return (who as Fail).result;
    const p = who.person;
    const roles = await roleNames(ctx.sb);
    const dir = await peopleDirectory(ctx.sb);
    const { data: u, error } = await ctx.sb.from('users')
      .select('id, name, email, phone, role_id, organization_name, society_name, location_id, reporting_manager_id, second_reporting_manager_id, reporting_manager_2_id, reporting_manager_3_id, joining_date, status, left_date, exit_reason, biometric_id')
      .eq('id', p.id).single();
    if (error || !u) throw new Error(error?.message);
    const x: any = u;
    const self = p.id === ctx.asker.id;
    const nameOf = (id: string | null) => id ? dir.rows.find(r => r.id === id)?.name ?? null : null;
    const managers = [x.reporting_manager_id, x.second_reporting_manager_id || x.reporting_manager_2_id, x.reporting_manager_3_id].map(nameOf);
    const asked: string[] = (args.fields || []).map((f: string) => lc(f));
    const askedContact = asked.some(f => /phone|mobile|contact|email|number/.test(f)) || /phone|mobile|number|contact|email|call/i.test(ctx.question || '');
    const canContact = self || ctx.scope.can('directory_phone');
    const hrView = ctx.scope.level === 'all';
    const directReports = dir.rows.filter(r => r.reporting_manager_id === p.id && r.status !== 'left');
    const msites = (await matrixSitesByPerson(ctx.sb)).get(p.id) ?? [];
    const siteRoles = Object.entries(msites.reduce((a, m) => { (a[m.role] ||= []).push(m.site); return a; }, {} as Record<string, string[]>))
      .map(([role, list]) => `${role}: ${list.slice(0, 5).join(', ')}${list.length > 5 ? ` +${list.length - 5} more` : ''}`);
    const facts: Record<string, any> = {
      name: x.name, role: roleLabelOf(roles, x.role_id), sites_responsible_for: siteRoles.length ? siteRoles : null, site_count: new Set(msites.map(m => m.site)).size, company: x.organization_name || x.society_name || null,
      reporting_manager: managers[0], second_reporting_manager: managers[1], third_reporting_manager: managers[2],
      joining_date: prettyDate(x.joining_date), employee_code: x.biometric_id || null,
      direct_reports: directReports.length,
    };
    if (hrView || self) { facts.status = x.status || 'active'; if (x.left_date) facts.left_date = prettyDate(x.left_date); if (hrView && x.exit_reason) facts.exit_reason = x.exit_reason; }
    else if (x.status === 'left') facts.status = 'left';
    if (canContact) { facts.phone = x.phone || null; facts.email = x.email || null; }
    else if (askedContact) facts.contact = 'Not shown: your role is not allowed to see other employees\' phone numbers or email.';
    ctx.audit({ tool: 'get_employee_profile', args, subjectUserId: p.id, allowed: true, note: canContact ? 'contact shown' : undefined });
    return { kind: 'answer', facts, sourceLabel: 'Employee directory' };
  }),
};

// =====================================================================================================
// 7. count_employees
// =====================================================================================================
const countEmployees: AssistTool = {
  name: 'count_employees',
  module: 'Directory',
  capability: 'directory',
  description: 'Counts / lists employees the asker can see, filtered by role, site, reporting manager or status. Use for "how many site managers do we have", "staff count at Nikoo", "who reports to me", "list field officers", "how many people left this year". NOT for who is present/absent today (site headcount tool) or for one person\'s profile.',
  parameters: {
    type: 'object',
    properties: {
      role: { type: 'string', description: 'Role as written by the user, e.g. "site manager", "field officer", "security guard". Empty for all roles.' },
      ...SITE_PARAMS,
      reports_to_me: { type: 'boolean', description: 'true for "who reports to me" / "my direct reports".' },
      manager_name: { type: 'string', description: 'Count people reporting directly to this manager (name as written).' },
      status: { type: 'string', enum: ['active', 'left', 'all'], description: 'Default active.' },
    },
  },
  run: safeRun(async (ctx, args) => {
    if (ctx.scope.level === 'self') return { kind: 'denied', text: 'You can only view your own profile, not staff lists or counts.' };
    const roles = await roleNames(ctx.sb);
    const { dir, rows: visible } = await visiblePeople(ctx);
    let people = visible;
    const status = args.status || 'active';
    if (status !== 'all') people = people.filter(r => status === 'left' ? r.status === 'left' : r.status !== 'left');
    const filters: string[] = [];
    if (args.role) {
      const words = lc(args.role).replace(/s\b/g, '').split(/[\s_]+/).filter(Boolean);
      const roleIds = [...roles.keys(), ...new Set(people.map(p => p.role_id))].filter(id => { const l = lc(`${id} ${roles.get(id) ?? ''}`).replace(/_/g, ' '); return words.every(w => l.includes(w)); });
      if (!roleIds.length) return { kind: 'not_found', text: `I couldn't find a role matching "${args.role}".` };
      const set = new Set(roleIds);
      people = people.filter(p => set.has(p.role_id));
      filters.push(`role: ${[...new Set(roleIds.map(r => roleLabelOf(roles, r)))].join(' / ')}`);
    }
    const sm = await siteMembers(ctx, args);
    if (!sm.ok) return (sm as Fail).result;
    const siteName = sm.site;
    if (sm.ids) { people = people.filter(r => sm.ids!.has(r.id)); filters.push(`allocated to site: ${siteName}`); }
    let managerId: string | null = null;
    if (args.reports_to_me) managerId = ctx.asker.id;
    else if (args.manager_name || args.manager_id) {
      const m = await resolvePerson(ctx, { person_name: args.manager_name, person_id: args.manager_id });
      if (!m.ok) {
        const mr = (m as Fail).result;
        if (mr.kind === 'clarify') return { ...mr, options: mr.options.map(o => ({ ...o, args: { ...args, manager_id: o.args.person_id } })) };
        return mr;
      }
      managerId = m.person.id;
    }
    if (managerId) {
      const { data: rel } = await ctx.sb.from('users').select('id, reporting_manager_id, second_reporting_manager_id, reporting_manager_2_id, reporting_manager_3_id');
      const reports = new Set((rel ?? []).filter((r: any) => [r.reporting_manager_id, r.second_reporting_manager_id, r.reporting_manager_2_id, r.reporting_manager_3_id].includes(managerId)).map((r: any) => r.id));
      people = people.filter(p => reports.has(p.id));
      filters.push(`reporting to: ${managerId === ctx.asker.id ? 'you' : dir.rows.find(r => r.id === managerId)?.name}`);
    }
    ctx.audit({ tool: 'count_employees', args, subjectSite: siteName, allowed: true });
    const scopeWord = ctx.scope.level === 'all' ? 'organisation-wide' : 'within your team and sites';
    if (!people.length) return { kind: 'not_found', text: `No ${status === 'left' ? 'former ' : ''}employees match that (${[...filters, scopeWord].join(', ')}).` };
    const msites = await matrixSitesByPerson(ctx.sb);
    const siteOf = (p: PersonRow) => sitesLabel(msites.get(p.id));
    return {
      kind: 'answer', sourceLabel: 'Employee directory',
      facts: { count: people.length, status, filters, scope: scopeWord, by_role: Object.fromEntries(Object.entries(countBy(people, p => roleLabelOf(roles, p.role_id))).slice(0, 12)), listed: Math.min(people.length, MAX_ROWS), ...(siteName ? { note: 'Counts app users allocated to the site in the Site Responsibility Matrix. Guards / housekeeping at the site are not app users — use the site headcount tool for them.' } : {}) },
      table: { columns: ['Name', 'Role', 'Site', 'Status'], rows: people.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, MAX_ROWS).map(p => [p.name, roleLabelOf(roles, p.role_id), siteOf(p), p.status || 'active']) },
    };
  }),
};

// =====================================================================================================
// 8. get_onboarding_status
// =====================================================================================================
const ONB_STATUS: Record<string, string> = { draft: 'Draft (incomplete)', pending: 'Pending verification', verified: 'Verified', rejected: 'Rejected' };
const candName = (o: any) => [o.first_name, o.last_name].map((s: any) => String(s ?? '').trim()).filter(Boolean).join(' ') || String(o.badge_name ?? '').trim() || (o.employee_id ? `Unnamed (${o.employee_id})` : 'Unnamed');
/** onboarding organization_name is free text with case/spacing variants → normalise for grouping & matching */
const normSite = (s: any) => lc(s).replace(/s+/g, ' ');
function siteDisplayNames(rows: any[]) {
  const by = new Map<string, Map<string, number>>();
  rows.forEach(r => { if (!r.organization_name) return; const k = normSite(r.organization_name); if (!by.has(k)) by.set(k, new Map()); const m = by.get(k)!; m.set(r.organization_name.trim(), (m.get(r.organization_name.trim()) || 0) + 1); });
  const disp = new Map<string, string>();
  by.forEach((m, k) => disp.set(k, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]));
  return disp;
}
const HR_DENIED: ToolResult = { kind: 'denied', text: 'HR records (onboarding, recruitment, documents) are available to HR and admin roles only.' };

async function onboardingRows(ctx: AssistCtx, extraCols = '') {
  const rows = await loadAll<any>(ctx.sb, 'onboarding_submissions',
    `id, status, organization_name, enrollment_date, created_at, updated_at, verified_at, portal_sync_status, fcu_status, created_user_id, employee_id, badge_name, first_name:personal->>first_name, last_name:personal->>last_name${extraCols}`);
  // HR/admin see all; anyone else only submissions they (or their team) created or for their matrix sites
  return ctx.scope.level === 'all' ? rows : rows.filter(r => ctx.scope.canSeeUser(r.created_user_id) || ctx.scope.canSeeSiteName(r.organization_name));
}

const getOnboardingStatus: AssistTool = {
  name: 'get_onboarding_status',
  module: 'Onboarding',
  capability: 'hr_records',
  description: 'New-joiner onboarding submissions: counts by status (draft, pending verification, verified, rejected), by site, and lists of pending ones. Use for "pending onboarding for Nikoo", "how many onboardings verified this month", "onboarding status of Ravi (candidate)". NOT for recruitment pipeline stages (get_recruitment_pipeline) or document uploads (get_document_status).',
  parameters: {
    type: 'object',
    properties: {
      ...SITE_PARAMS,
      status: { type: 'string', enum: ['any', 'draft', 'pending', 'verified', 'rejected', 'not_verified'], description: 'not_verified = draft + pending. Default any.' },
      candidate_name: { type: 'string', description: 'New joiner / candidate name if asked about one person.' },
      ...PERIOD_PARAMS,
    },
  },
  run: safeRun(async (ctx, args) => {
    if (!ctx.scope.can('hr_records')) return HR_DENIED;
    let rows = await onboardingRows(ctx);
    const dir = await peopleDirectory(ctx.sb);
    const filters: string[] = [];
    let per: ReturnType<typeof periodRange> | null = null;
    if (args.period || args.start_date) {
      per = periodRange(args.period, args.start_date, args.end_date, ctx.now);
      rows = rows.filter(r => { const d = istDate(r.created_at); return d >= per!.from && d <= per!.to; });
      filters.push(`submitted ${per.label}`);
    }
    if (args.site_name || args.site_exact) {
      const disp = siteDisplayNames(rows);
      const s = await resolveSiteName(ctx, args, [...disp.values()]);
      if (!s.ok) return (s as Fail).result;
      if (s.site) { rows = rows.filter(r => normSite(r.organization_name) === normSite(s.site)); filters.push(`site: ${s.site}`); }
    }
    if (args.candidate_name) {
      const words = lc(args.candidate_name).split(/\s+/).filter(Boolean);
      rows = rows.filter(r => words.every(w => lc(candName(r)).includes(w)));
      filters.push(`candidate: ${args.candidate_name}`);
    }
    const st = args.status || 'any';
    const all = rows;
    if (st !== 'any') { rows = rows.filter(r => st === 'not_verified' ? ['draft', 'pending'].includes(r.status) : r.status === st); filters.push(`status: ${st.replace('_', ' ')}`); }
    ctx.audit({ tool: 'get_onboarding_status', args, allowed: true });
    if (!rows.length) return { kind: 'not_found', text: `No onboarding submissions match${filters.length ? ' (' + filters.join(', ') + ')' : ''}.` };
    const by = (id: string) => dir.rows.find(r => r.id === id)?.name ?? null;
    const sorted = rows.slice().sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    return {
      kind: 'answer', sourceLabel: `Onboarding${per ? ' · ' + per.label : ''}`,
      facts: {
        filters, total: rows.length, by_status: countBy(rows, r => ONB_STATUS[r.status] || r.status), ...(st !== 'any' ? { all_statuses_for_same_filters: countBy(all, r => ONB_STATUS[r.status] || r.status) } : {}),
        by_site: (() => { const d = siteDisplayNames(rows); return Object.fromEntries(Object.entries(countBy(rows, r => d.get(normSite(r.organization_name)) ?? null)).slice(0, 10)); })(), portal_sync: countBy(rows, r => r.portal_sync_status || 'not synced'),
        latest_submission: prettyDate(istDate(rows.map(r => r.created_at).sort().at(-1))),
      },
      table: { columns: ['Candidate', 'Site', 'Status', 'Submitted', 'Enrolled by'], rows: sorted.slice(0, MAX_ROWS).map(r => [candName(r), r.organization_name, ONB_STATUS[r.status] || r.status, prettyDate(istDate(r.created_at)), by(r.created_user_id)]) },
    };
  }),
};

// =====================================================================================================
// 9. get_recruitment_pipeline
// =====================================================================================================
const STAGE_ORDER = ['new', 'contacted', 'screened', 'interview', 'offer', 'joined', 'rejected'];
const getRecruitmentPipeline: AssistTool = {
  name: 'get_recruitment_pipeline',
  module: 'Recruitment',
  capability: 'hr_records',
  description: 'Recruitment / referral pipeline: candidates by stage (new, contacted, screened, interview, offer, joined, rejected), offer/appointment letter status, and one candidate\'s progress. Use for "candidates in interview stage", "how many referrals joined", "status of candidate Ravi", "pending offer letters". NOT for onboarding forms of people already hired (get_onboarding_status).',
  parameters: {
    type: 'object',
    properties: {
      stage: { type: 'string', enum: ['any', ...STAGE_ORDER], description: 'Default any.' },
      candidate_name: { type: 'string', description: 'Candidate name if asked about one candidate.' },
      ...PERIOD_PARAMS,
    },
  },
  run: safeRun(async (ctx, args) => {
    if (!ctx.scope.can('hr_records')) return HR_DENIED;
    const [refs, stages, letters] = await Promise.all([
      loadAll<any>(ctx.sb, 'candidate_referrals', 'id, created_at, referrer_name, candidate_name, candidate_role, site_location, status, current_stage, assigned_hr_id, joining_date, created_by'),
      loadAll<any>(ctx.sb, 'hrm_candidate_stages', 'candidate_id, stage, changed_at'),
      loadAll<any>(ctx.sb, 'hrm_letters', 'candidate_id, letter_type, status, ack_status, issued_at'),
    ]);
    const dir = await peopleDirectory(ctx.sb);
    let rows = ctx.scope.level === 'all' ? refs : refs.filter(r => ctx.scope.canSeeUser(r.created_by) || ctx.scope.canSeeUser(r.assigned_hr_id));
    const filters: string[] = [];
    let per: ReturnType<typeof periodRange> | null = null;
    if (args.period || args.start_date) {
      per = periodRange(args.period, args.start_date, args.end_date, ctx.now);
      rows = rows.filter(r => { const d = istDate(r.created_at); return d >= per!.from && d <= per!.to; });
      filters.push(`referred ${per.label}`);
    }
    if (args.candidate_name) {
      const words = lc(args.candidate_name).split(/\s+/).filter(Boolean);
      rows = rows.filter(r => words.every(w => lc(r.candidate_name).includes(w)));
      filters.push(`candidate: ${args.candidate_name}`);
    }
    const all = rows;
    if (args.stage && args.stage !== 'any') { rows = rows.filter(r => lc(r.current_stage || 'new') === args.stage); filters.push(`stage: ${args.stage}`); }
    ctx.audit({ tool: 'get_recruitment_pipeline', args, allowed: true });
    if (!rows.length) return { kind: 'not_found', text: `No candidates match${filters.length ? ' (' + filters.join(', ') + ')' : ''}. ${all.length} candidate(s) in the pipeline overall.` };
    const lastMove = (id: string) => stages.filter(s => s.candidate_id === id).sort((a, b) => String(b.changed_at).localeCompare(String(a.changed_at)))[0];
    const lettersOf = (id: string) => letters.filter(l => l.candidate_id === id).map(l => `${l.letter_type} (${l.status}${l.ack_status ? ', ' + l.ack_status : ''})`).join(', ') || null;
    const hr = (id: string) => dir.rows.find(r => r.id === id)?.name ?? null;
    const stageCounts = countBy(all, r => lc(r.current_stage || 'new'));
    return {
      kind: 'answer', sourceLabel: `Recruitment${per ? ' · ' + per.label : ''}`,
      facts: {
        filters, candidates: rows.length, pipeline_by_stage: Object.fromEntries(STAGE_ORDER.filter(s => stageCounts[s]).map(s => [s, stageCounts[s]])),
        letters: { total: letters.length, by_status: countBy(letters, l => `${l.letter_type} · ${l.status}`) },
        unassigned_to_hr: rows.filter(r => !r.assigned_hr_id).length,
        note: 'Pipeline = employee referrals (candidate_referrals); stage history from the HRM stage log.',
      },
      table: { columns: ['Candidate', 'Role', 'Site', 'Stage', 'Last moved', 'Referred by', 'HR', 'Letters'], rows: rows.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, MAX_ROWS).map(r => { const lm = lastMove(r.id); return [r.candidate_name, String(r.candidate_role || '').trim() || null, r.site_location || null, r.current_stage || 'new', lm ? prettyDate(istDate(lm.changed_at)) : prettyDate(istDate(r.created_at)), r.referrer_name, hr(r.assigned_hr_id), lettersOf(r.id)]; }) },
    };
  }),
};

// =====================================================================================================
// 10. get_document_status  (STATUS ONLY — presence booleans; never paths, URLs, numbers or images)
// =====================================================================================================
const DOC_TYPES: Record<string, { label: string; has: (o: any) => boolean; required: (o: any) => boolean }> = {
  photo: { label: 'Photo', has: o => !!o.p_photo, required: () => true },
  aadhaar: { label: 'Aadhaar / ID proof (front & back)', has: o => !!o.p_idf && !!o.p_idb, required: () => true },
  pan: { label: 'PAN card', has: o => !!o.p_pan, required: () => true },
  bank_proof: { label: 'Bank proof (cheque / passbook)', has: o => !!o.b_proof, required: () => true },
  pf_uan: { label: 'PF / UAN proof', has: o => !!o.u_doc || !!o.u_slip, required: o => o.u_prev === true || o.u_prev === 'true' },
  esi: { label: 'ESI card', has: o => !!o.e_doc, required: o => o.e_has === true || o.e_has === 'true' },
};
const DOC_COLS = ', p_photo:personal->photo->>name, p_idf:personal->id_proof_front->>name, p_idb:personal->id_proof_back->>name, p_pan:personal->pan_card->>name, b_proof:bank->bank_proof->>name, u_doc:uan->document->>name, u_slip:uan->salary_slip->>name, u_prev:uan->>has_previous_pf, e_doc:esi->document->>name, e_has:esi->>has_esi';

const getDocumentStatus: AssistTool = {
  name: 'get_document_status',
  module: 'Documents',
  capability: 'hr_records',
  description: 'Document UPLOAD STATUS for onboarded staff (photo, Aadhaar, PAN, bank proof, PF/UAN, ESI): which documents a person has uploaded, or who is missing a document type, optionally by site. Use for "who is missing PAN upload", "has Ravi uploaded his Aadhaar", "missing documents at Nikoo". Never shows the documents or their numbers.',
  parameters: {
    type: 'object',
    properties: {
      doc_type: { type: 'string', enum: ['any', ...Object.keys(DOC_TYPES)], description: 'Document type asked about. Default any (all required documents).' },
      candidate_name: { type: 'string', description: 'Employee / new joiner name if asked about one person.' },
      ...SITE_PARAMS,
    },
  },
  run: safeRun(async (ctx, args) => {
    if (!ctx.scope.can('hr_records')) return HR_DENIED;
    let rows = (await onboardingRows(ctx, DOC_COLS)).filter(r => r.status !== 'rejected');
    const filters: string[] = [];
    if (args.site_name || args.site_exact) {
      const disp = siteDisplayNames(rows);
      const s = await resolveSiteName(ctx, args, [...disp.values()]);
      if (!s.ok) return (s as Fail).result;
      if (s.site) { rows = rows.filter(r => normSite(r.organization_name) === normSite(s.site)); filters.push(`site: ${s.site}`); }
    }
    const types = args.doc_type && args.doc_type !== 'any' ? [args.doc_type] : Object.keys(DOC_TYPES);
    const missingOf = (r: any) => types.filter(t => DOC_TYPES[t].required(r) && !DOC_TYPES[t].has(r)).map(t => DOC_TYPES[t].label);
    ctx.audit({ tool: 'get_document_status', args, allowed: true });

    if (args.candidate_name) {
      const words = lc(args.candidate_name).split(/\s+/).filter(Boolean);
      const hits = rows.filter(r => words.every(w => lc(candName(r)).includes(w)));
      if (!hits.length) return { kind: 'not_found', text: `No onboarding record found for "${args.candidate_name}"${filters.length ? ' (' + filters.join(', ') + ')' : ''}. Document status is tracked from onboarding forms.` };
      if (hits.length > 1 && !args.submission_id) {
        return { kind: 'clarify', question: `Which ${args.candidate_name} do you mean?`, options: hits.slice(0, 8).map(h => ({ label: candName(h), sublabel: [h.organization_name, ONB_STATUS[h.status] || h.status, prettyDate(istDate(h.created_at))].filter(Boolean).join(' · '), args: { ...args, submission_id: h.id } })) };
      }
      const h = args.submission_id ? hits.find(x => x.id === args.submission_id) : hits[0];
      if (!h) return { kind: 'denied', text: "You don't have access to that record." };
      const { count } = await ctx.sb.from('user_documents').select('id', { count: 'exact', head: true }).eq('submission_id', h.id);
      return {
        kind: 'answer', sourceLabel: 'Documents · upload status',
        facts: { person: candName(h), site: h.organization_name, onboarding_status: ONB_STATUS[h.status] || h.status, ...(count ? { files_in_document_store: count } : {}), missing: missingOf(h), note: 'Status only — documents themselves are never shown in chat.' },
        table: { columns: ['Document', 'Status'], rows: types.map(t => [DOC_TYPES[t].label, DOC_TYPES[t].has(h) ? 'Uploaded' : DOC_TYPES[t].required(h) ? 'Missing' : 'Not required']) },
      };
    }
    if (!rows.length) return { kind: 'not_found', text: 'No onboarding records found to check documents for.' };
    const missing = rows.map(r => ({ r, miss: missingOf(r) })).filter(x => x.miss.length);
    const perType = Object.fromEntries(types.map(t => [DOC_TYPES[t].label, rows.filter(r => DOC_TYPES[t].required(r) && !DOC_TYPES[t].has(r)).length]));
    if (!missing.length) return { kind: 'answer', sourceLabel: 'Documents · upload status', facts: { filters, people_checked: rows.length, people_missing: 0, message: 'Everyone checked has uploaded the required documents.' } };
    return {
      kind: 'answer', sourceLabel: 'Documents · upload status',
      facts: { filters, people_checked: rows.length, people_missing_any: missing.length, missing_count_by_document: perType, drafts_among_missing: missing.filter(x => x.r.status === 'draft').length, note: 'Based on onboarding forms (rejected forms excluded). PF/UAN and ESI only count where the person declared previous PF / ESI.' },
      table: { columns: ['Person', 'Site', 'Onboarding', 'Missing'], rows: missing.slice(0, MAX_ROWS).map(x => [candName(x.r), x.r.organization_name, ONB_STATUS[x.r.status] || x.r.status, x.miss.join(', ')]) },
    };
  }),
};

// =====================================================================================================
// 11. get_performance_scores
// =====================================================================================================
const getPerformanceScores: AssistTool = {
  name: 'get_performance_scores',
  module: 'Performance',
  capability: 'attendance',
  description: 'Monthly performance scores (overall, attendance, performance, response) of one person, or the top / bottom N in the asker\'s team. Use for "my score this month", "Kavya\'s performance score", "top 5 attendance scores this month", "lowest scores in my team". Everyone may see their own; lists need a manager / HR / admin role.',
  parameters: {
    type: 'object',
    properties: {
      ...PERSON_PARAMS,
      ranking: { type: 'string', enum: ['none', 'top', 'bottom'], description: 'top/bottom for a ranked list; none for one person.' },
      limit: { type: 'integer', description: 'How many people in a ranked list (default 5, max 25).' },
      score_type: { type: 'string', enum: ['overall', 'attendance', 'performance', 'response'], description: 'Default overall.' },
      role_category: { type: 'string', enum: ['any', 'field_staff', 'office_staff'], description: 'Default any.' },
      ...PERIOD_PARAMS,
    },
  },
  run: safeRun(async (ctx, args) => {
    const scoreCol = `${args.score_type && args.score_type !== 'overall' ? args.score_type : 'overall'}_score`;
    const months = [...new Set((await loadAll<any>(ctx.sb, 'employee_scores', 'month')).map(r => String(r.month).slice(0, 10)))].sort();
    if (!months.length) return { kind: 'not_found', text: 'No performance scores have been calculated yet.' };
    const want = args.period || args.start_date ? monthStartOf(periodRange(args.period, args.start_date, args.end_date, ctx.now).from) : monthStartOf(todayIst(ctx.now));
    const month = months.includes(want) ? want : (args.period || args.start_date ? null : months.filter(m => m <= want).at(-1) ?? months.at(-1)!);
    if (!month) return { kind: 'not_found', text: `No scores for ${monthLabel(want)}. Scores exist for ${monthLabel(months[0])} – ${monthLabel(months.at(-1)!)}.` };
    const fmt = (r: any) => ({ overall: r.overall_score, attendance: r.attendance_score, performance: r.performance_score, response: r.response_score });

    if (args.ranking && args.ranking !== 'none') {
      if (ctx.scope.level === 'self') return { kind: 'denied', text: 'You can only see your own score.' };
      const { dir, rows: visible } = await visiblePeople(ctx);
      const vis = new Set(visible.map(v => v.id));
      let rows = (await loadAll<any>(ctx.sb, 'employee_scores', 'user_id, month, overall_score, attendance_score, performance_score, response_score, role_category', q => q.eq('month', month)))
        .filter(r => vis.has(r.user_id) && r[scoreCol] != null);
      if (args.role_category && args.role_category !== 'any') rows = rows.filter(r => r.role_category === args.role_category);
      if (!rows.length) return { kind: 'not_found', text: `No scores for your team in ${monthLabel(month)}.` };
      rows.sort((a, b) => args.ranking === 'bottom' ? a[scoreCol] - b[scoreCol] : b[scoreCol] - a[scoreCol]);
      const n = Math.min(Math.max(Number(args.limit) || 5, 1), MAX_ROWS);
      const name = (id: string) => dir.rows.find(r => r.id === id)?.name ?? null;
      const vals = rows.map(r => Number(r[scoreCol]));
      ctx.audit({ tool: 'get_performance_scores', args, allowed: true });
      return {
        kind: 'answer', sourceLabel: `Performance scores · ${monthLabel(month)}`,
        facts: { month: monthLabel(month), ranking: `${args.ranking} ${n} by ${scoreCol.replace('_', ' ')}`, people_scored: rows.length, average: r1(vals.reduce((a, b) => a + b, 0) / vals.length), scope: ctx.scope.level === 'all' ? 'organisation-wide' : 'your team and sites' },
        table: { columns: ['#', 'Employee', 'Overall', 'Attendance', 'Performance', 'Response', 'Category'], rows: rows.slice(0, n).map((r, i) => [i + 1, name(r.user_id), r.overall_score, r.attendance_score, r.performance_score, r.response_score, ROLE_LABEL(r.role_category || '')]) },
      };
    }
    const who = await resolvePerson(ctx, args);
    if (!who.ok) return (who as Fail).result;
    const p = who.person;
    const hist = (await loadAll<any>(ctx.sb, 'employee_scores', 'month, overall_score, attendance_score, performance_score, response_score, role_category, calculated_at', q => q.eq('user_id', p.id))).sort((a, b) => String(a.month).localeCompare(String(b.month)));
    ctx.audit({ tool: 'get_performance_scores', args, subjectUserId: p.id, allowed: true });
    const cur = hist.find(h => String(h.month).slice(0, 10) === month);
    if (!cur) return { kind: 'not_found', text: `No score for ${p.name} in ${monthLabel(month)}.${hist.length ? ` Latest score: ${hist.at(-1).overall_score} (${monthLabel(String(hist.at(-1).month))}).` : ''}` };
    const { data: peers } = await ctx.sb.from('employee_scores').select('overall_score').eq('month', month).eq('role_category', cur.role_category);
    const better = (peers ?? []).filter((x: any) => x.overall_score > cur.overall_score).length;
    return {
      kind: 'answer', sourceLabel: `Performance scores · ${monthLabel(month)}`,
      facts: { employee: p.name, month: monthLabel(month), ...fmt(cur), category: ROLE_LABEL(cur.role_category || ''), rank_in_category: `${better + 1} of ${(peers ?? []).length}`, previous_month: hist[hist.indexOf(cur) - 1] ? fmt(hist[hist.indexOf(cur) - 1]).overall : null, calculated: prettyDate(istDate(cur.calculated_at)) },
      table: { columns: ['Month', 'Overall', 'Attendance', 'Performance', 'Response'], rows: hist.slice(-6).map(h => [monthLabel(String(h.month)), h.overall_score, h.attendance_score, h.performance_score, h.response_score]) },
    };
  }),
};

export const hrTools: AssistTool[] = [
  getLeaveBalance, getLeaveRequests, getOvertime, getShiftAndWeeklyOff, getHolidays,
  getEmployeeProfile, countEmployees, getOnboardingStatus, getRecruitmentPipeline, getDocumentStatus, getPerformanceScores,
];

// exported for tests
export const __hrInternals = { computeLeaveBalance, staffCategory, buildDayKeys, workingHoursOf, siteOtFromEvents };
