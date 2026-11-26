/** Attendance exceptions, biometric/CCTV, site headcount, sites & clients, tickets & escalation, ops approvals/audits, gate, weather — owned by the OPS agent */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssistCtx, AssistTool, ToolResult } from '../types.js';
import {
  resolvePerson, periodRange, PERIOD_PARAMS, PERSON_PARAMS, SITE_PARAMS, resolveSiteName, safeRun,
  istBounds, istTime, istDate, prettyDate, loadAll, peopleDirectory, shortAddress, todayIst, inr, type PersonRow,
} from '../helpers.js';
import { ROLE_LABEL } from '../roles.js';

// ============================================================================ shared internals
const MAX_ROWS = 25;
const IN_TYPES = new Set(['punch-in', 'check_in']);
const OUT_TYPES = new Set(['punch-out', 'check_out']);
const lc = (s: any) => String(s ?? '').toLowerCase().trim();
/** "Nikoo Homes 1 - Entry" → "nikoohome1entry" (for loose site-name comparison across tables). */
const compact = (s: any) => lc(s).replace(/\bhomes\b/g, 'home').replace(/[^a-z0-9]/g, '');
/** Same site under different spellings: equal compact names, or one is a prefix (≥ 8 chars) of the other
 *  ("Nikoo Homes" ↔ "Nikoo Homes H ret", "Purva venezia" ↔ "Purva Venezia"). */
function sameSite(a: any, b: any) {
  const x = compact(a), y = compact(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return s.length >= 8 && l.startsWith(s);
}
const distM = (a: number, b: number, c: number, d: number) => {
  const R = 6371000, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const trunc = (s: any, n = 80) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 864e5);
const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);
const ago = (ts: string | null | undefined, now: Date) => {
  if (!ts) return 'never';
  const m = Math.round((now.getTime() - new Date(ts).getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 0)} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
};
const countBy = <T,>(rows: T[], key: (r: T) => string) => {
  const m: Record<string, number> = {};
  for (const r of rows) { const k = key(r); m[k] = (m[k] ?? 0) + 1; }
  return m;
};

/** Small reference tables (matrix, locations, organizations, entities, devices) cached for 5 minutes. */
let refCache: { at: number; matrix: any[]; locations: any[]; orgs: any[]; entities: any[] } | null = null;
async function refs(sb: SupabaseClient) {
  if (refCache && Date.now() - refCache.at < 5 * 60_000) return refCache;
  const [matrix, locations, orgs, entities] = await Promise.all([
    loadAll<any>(sb, 'site_responsibility_matrix', 'id, site_id, site_name, ops_manager_id, ops_manager_name, site_manager_id, site_manager_name, field_officer_id, field_officer_name, site_supervisor_id, site_supervisor_name, hr_incharge_id, hr_incharge_name, accounts_incharge_id, accounts_incharge_name, billing_cycle, units_count, takeover_date, billing_legal_name, gstin, pan, escalation_tiers, is_active'),
    loadAll<any>(sb, 'locations', 'id, name, address, radius, latitude, longitude'), // never kiosk_pin
    loadAll<any>(sb, 'organizations', 'id, short_name, full_name, manpower_approved_count'),
    loadAll<any>(sb, 'entities', 'id, name, organization_id, location, registration_type, site_takeover_date, status, site_management, gst_number, pan_number'),
  ]);
  refCache = { at: Date.now(), matrix: matrix.filter(m => m.is_active !== false), locations, orgs, entities };
  return refCache;
}

/** May the asker see this site (by locations.id and/or any spelling of its name)? */
function siteVisible(ctx: AssistCtx, name: any, id?: string | null) {
  const s = ctx.scope;
  if (s.siteNames === 'all' || s.siteIds === 'all') return true;
  if (id && s.canSeeSiteId(id)) return true;
  if (!name) return false;
  if (s.canSeeSiteName(name)) return true;
  for (const n of s.siteNames) if (sameSite(n, name)) return true;
  return false;
}

/** Site names the asker may see: matrix names (+ every location name for org-wide askers, + locations by id). */
async function visibleSiteNames(ctx: AssistCtx, extra: string[] = []) {
  const r = await refs(ctx.sb);
  const out = new Set<string>();
  for (const m of r.matrix) if (siteVisible(ctx, m.site_name, m.site_id)) out.add(String(m.site_name).trim());
  for (const l of r.locations) if (siteVisible(ctx, l.name, l.id) && (ctx.scope.siteNames === 'all' || ctx.scope.canSeeSiteId(l.id))) out.add(String(l.name).trim());
  for (const e of extra) if (e && siteVisible(ctx, e)) out.add(String(e).trim());
  return [...out];
}

/** Reads one config value from settings.attendance_settings (internal computation only; the settings row is never exposed). */
let settingsCache: { at: number; checkIn: string; checkInConfigured: boolean; maxViolations: number } | null = null;
async function attendanceRules(sb: SupabaseClient) {
  if (settingsCache && Date.now() - settingsCache.at < 10 * 60_000) return settingsCache;
  const { data } = await sb.from('settings').select('attendance_settings, max_violations_per_month').eq('id', 'singleton').maybeSingle();
  const office = (data as any)?.attendance_settings?.office ?? {};
  const fh = office.fixedOfficeHours ?? office.fixed_office_hours ?? {};
  const configured = fh.checkInTime ?? fh.check_in_time;
  settingsCache = {
    at: Date.now(),
    // utils/reportGenerators.ts attendance_daily + services/queryRouter.ts fetchLateArrivals: late = first punch-in after 09:30 IST unless configured
    checkIn: configured || '09:30', checkInConfigured: !!configured,
    // services/api.ts getGeofencingSettings: max_violations_per_month ?? 3
    maxViolations: Number((data as any)?.max_violations_per_month ?? 3) || 3,
  };
  return settingsCache;
}

/** utils/attendanceCalculations.ts isAttendanceExemptRole: directors / management / super admin don't punch. */
const isExemptRole = (role?: string | null) => {
  const n = String(role ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  return n.includes('director') || n === 'management' || n === 'superadmin';
};

/** Loads rows of a big table for a list of ids in chunks of 100 (each chunk paged by loadAll). */
async function loadIn<T = any>(sb: SupabaseClient, table: string, cols: string, col: string, ids: string[] | null, apply?: (q: any) => any): Promise<T[]> {
  if (ids === null) return loadAll<T>(sb, table, cols, apply);
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    out.push(...await loadAll<T>(sb, table, cols, q => { q = q.in(col, chunk); return apply ? apply(q) : q; }));
  }
  return out;
}

/**
 * People a team/person question is about.
 * - person_name / person_id / about_self → one person (resolvePerson, scope-checked)
 * - self level → only the asker
 * - otherwise every visible active, punching (non-exempt, verified) employee; ids = null means "everyone" (org-wide, no id filter)
 */
async function targetPeople(ctx: AssistCtx, args: Record<string, any>):
  Promise<{ ok: true; people: PersonRow[]; ids: string[] | null; label: string; single: boolean } | { ok: false; result: ToolResult }> {
  if (args.person_name || args.person_id || args.about_self || ctx.scope.level === 'self') {
    const who = await resolvePerson(ctx, args);
    if (who.ok === false) return who;
    return { ok: true, people: [who.person], ids: [who.person.id], label: who.person.id === ctx.asker.id ? 'you' : who.person.name, single: true };
  }
  const dir = await peopleDirectory(ctx.sb);
  const people = dir.rows.filter(r => ctx.scope.canSeeUser(r.id) && r.status !== 'left' && r.role_id !== 'unverified' && !isExemptRole(r.role_id));
  const all = ctx.scope.level === 'all';
  return { ok: true, people, ids: all ? null : people.map(p => p.id), label: all ? 'all employees' : 'your team', single: false };
}

const nameMapOf = async (sb: SupabaseClient) => new Map((await peopleDirectory(sb)).rows.map(r => [r.id, r.name]));

// ============================================================================ 1. get_attendance_exceptions
const attendanceExceptions: AssistTool = {
  name: 'get_attendance_exceptions',
  description: 'Attendance EXCEPTIONS across a team, a site or one person over a period: late comers (first punch-in after office check-in time), missed punch-outs, geo-fence violations and field-staff low-site-time violations, with who has the most. E.g. "late comers today", "who missed punch-out this week", "geo-fence violations at Nikoo this month", "how many times was Ravi late", "violations in my team". Not for days worked / present-or-not of one person (get_attendance_summary) or present/absent headcount (get_site_attendance_today).',
  parameters: {
    type: 'object',
    properties: {
      ...PERSON_PARAMS, ...SITE_PARAMS, ...PERIOD_PARAMS,
      exception_type: { type: 'string', enum: ['all', 'late', 'missed_punch_out', 'geo_fence', 'field_site_time'], description: 'Which exception the user asked about. Default all.' },
    },
  },
  capability: 'attendance',
  module: 'Attendance exceptions',
  run: safeRun(async (ctx, args) => {
    const tgt = await targetPeople(ctx, args);
    if (tgt.ok === false) return tgt.result;
    const p = periodRange(args.period, args.start_date, args.end_date, ctx.now);
    const today = todayIst(ctx.now);
    if (p.from > today) return { kind: 'not_found', text: `${prettyDate(p.from)} is in the future, so there are no exceptions yet.` };
    const type = args.exception_type || 'all';
    const want = (t: string) => type === 'all' || type === t;

    // optional site filter (matches punch locations / violation locations by name)
    let site: string | null = null;
    if (args.site_name || args.site_exact) {
      const rs = await resolveSiteName(ctx, args, await visibleSiteNames(ctx));
      if (rs.ok === false) return rs.result;
      site = rs.site;
    }
    const r = await refs(ctx.sb);
    const locName = new Map(r.locations.map(l => [l.id, l.name]));
    const atSite = (locationId: string | null, locationName: string | null) =>
      !site || sameSite(site, locationId ? locName.get(locationId) : null) || sameSite(site, locationName) || compact(locationName).includes(compact(site));

    const rules = await attendanceRules(ctx.sb);
    const names = await nameMapOf(ctx.sb);
    const visible = new Set(tgt.people.map(x => x.id));
    const inScope = (uid: string) => visible.has(uid);
    const { startUtc, endUtc } = istBounds(p.from, p.to);
    const rows: { date: string; name: string; what: string; detail: string }[] = [];
    let totalRows = 0;
    const facts: Record<string, any> = { period: p.label, about: tgt.label, site: site ?? 'all sites in scope' };

    // ---- late / missed punch-out from attendance_events
    if (want('late') || want('missed_punch_out')) {
      const ev = await loadIn<any>(ctx.sb, 'attendance_events', 'user_id, timestamp, type, location_id, location_name', 'user_id', tgt.ids,
        q => q.in('type', [...IN_TYPES, ...OUT_TYPES]).gte('timestamp', startUtc).lte('timestamp', endUtc).order('timestamp'));
      const days = new Map<string, { uid: string; day: string; in?: any; out?: any }>();
      for (const e of ev) {
        if (!inScope(e.user_id)) continue;
        const day = istDate(e.timestamp);
        const k = `${e.user_id}|${day}`;
        const d: { uid: string; day: string; in?: any; out?: any } = days.get(k) ?? { uid: e.user_id, day };
        if (IN_TYPES.has(e.type) && !d.in) d.in = e;
        if (OUT_TYPES.has(e.type)) d.out = e;
        days.set(k, d);
      }
      const list = [...days.values()].filter(d => d.in && atSite(d.in.location_id, d.in.location_name));
      if (want('late')) {
        const late = list.filter(d => istTime(d.in.timestamp)! > rules.checkIn);
        const per = countBy(late, d => d.uid); totalRows += late.length;
        facts.late = {
          rule: `first punch-in after ${rules.checkIn} IST${rules.checkInConfigured ? '' : ' (default office check-in time)'}`,
          late_marks: late.length, people_late: Object.keys(per).length, days_with_punch_in: list.length,
          most_late: Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([u, n]) => `${names.get(u) ?? 'Unknown'} (${n})`),
        };
        for (const d of late.sort((a, b) => b.in.timestamp.localeCompare(a.in.timestamp)).slice(0, MAX_ROWS))
          rows.push({ date: d.day, name: names.get(d.uid) ?? 'Unknown', what: 'Late', detail: `in ${istTime(d.in.timestamp)} @ ${trunc(shortAddress(d.in.location_name) ?? '—', 40)}` });
      }
      if (want('missed_punch_out')) {
        // prototype rule (scripts/assist-prototype.ts attendanceSummary): a past day with a punch-in but no punch-out
        const missed = list.filter(d => d.day < today && (!d.out || d.out.timestamp < d.in.timestamp));
        const per = countBy(missed, d => d.uid); totalRows += missed.length;
        facts.missed_punch_out = {
          rule: 'past day with a punch-in but no punch-out (today excluded; overnight shifts may show here)',
          days: missed.length, people: Object.keys(per).length,
          most: Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([u, n]) => `${names.get(u) ?? 'Unknown'} (${n})`),
        };
        for (const d of missed.sort((a, b) => b.day.localeCompare(a.day)).slice(0, MAX_ROWS))
          rows.push({ date: d.day, name: names.get(d.uid) ?? 'Unknown', what: 'Missed punch-out', detail: `in ${istTime(d.in.timestamp)} @ ${trunc(shortAddress(d.in.location_name) ?? '—', 40)}` });
      }
    }

    // ---- geo-fence violations (attendance_violations)
    if (want('geo_fence')) {
      const v = await loadIn<any>(ctx.sb, 'attendance_violations', 'user_id, violation_date, location_name, distance_from_geofence, violation_type', 'user_id', tgt.ids,
        q => q.gte('violation_date', startUtc).lte('violation_date', endUtc).order('violation_date', { ascending: false }));
      const vis = v.filter(x => inScope(x.user_id) && atSite(null, x.location_name));
      const per = countBy(vis, x => x.user_id); totalRows += vis.length;
      facts.geo_fence_violations = {
        meaning: 'punch attempted outside the assigned site geo-fence',
        total: vis.length, people: Object.keys(per).length,
        most: Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([u, n]) => `${names.get(u) ?? 'Unknown'} (${n})`),
      };
      for (const x of vis.slice(0, MAX_ROWS))
        rows.push({ date: istDate(x.violation_date), name: names.get(x.user_id) ?? 'Unknown', what: 'Geo-fence', detail: `${trunc(shortAddress(x.location_name) ?? '—', 40)}${x.distance_from_geofence ? ` (${Math.round(x.distance_from_geofence)} m away)` : ''}` });
    }

    // ---- field staff site-time violations (field_attendance_violations; date column is a plain date)
    if (want('field_site_time') && !site) {
      const v = await loadIn<any>(ctx.sb, 'field_attendance_violations', 'user_id, date, violation_type, site_percentage, required_site_percentage, status, escalation_level', 'user_id', tgt.ids,
        q => q.gte('date', p.from).lte('date', p.to).order('date', { ascending: false }));
      const vis = v.filter(x => inScope(x.user_id));
      const per = countBy(vis, x => x.user_id); totalRows += vis.length;
      // services/api.ts (field violation strike check): pending/escalated violations in a month ≥ max_violations_per_month
      const month = today.slice(0, 7);
      const monthOpen = countBy(vis.filter(x => String(x.date).startsWith(month) && ['pending', 'escalated'].includes(lc(x.status))), x => x.user_id);
      facts.field_site_time_violations = {
        meaning: 'field staff spent less than the required % of working time at client sites',
        total: vis.length, people: Object.keys(per).length, by_status: countBy(vis, x => x.status),
        most: Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([u, n]) => `${names.get(u) ?? 'Unknown'} (${n})`),
        reached_monthly_strike_limit: { limit: rules.maxViolations, people: Object.entries(monthOpen).filter(([, n]) => n >= rules.maxViolations).map(([u, n]) => `${names.get(u) ?? 'Unknown'} (${n})`).slice(0, 10) },
      };
      for (const x of vis.slice(0, MAX_ROWS))
        rows.push({ date: x.date, name: names.get(x.user_id) ?? 'Unknown', what: 'Low site time', detail: `${Math.round(x.site_percentage ?? 0)}% at site (needs ${x.required_site_percentage ?? 75}%) · ${x.status}` });
    } else if (want('field_site_time') && site && type === 'field_site_time') {
      facts.field_site_time_violations = { note: 'Field site-time violations are not recorded per site; ask without a site name.' };
    }

    rows.sort((a, b) => b.date.localeCompare(a.date));
    const shown = rows.slice(0, MAX_ROWS);
    facts.rows_shown = `${shown.length} of ${totalRows} exception rows (latest first)`;
    ctx.audit({ tool: 'get_attendance_exceptions', args, subjectUserId: tgt.single ? tgt.people[0].id : null, subjectSite: site, allowed: true });
    return {
      kind: 'answer', facts,
      sourceLabel: `Attendance exceptions · ${p.single ? prettyDate(p.from) : p.label.replace(/\s*\(.*\)$/, '')}`,
      table: shown.length ? { columns: ['Date', 'Employee', 'Exception', 'Detail'], rows: shown.map(x => [prettyDate(x.date), x.name, x.what, x.detail]) } : undefined,
    };
  }),
};

// ============================================================================ 2. get_attendance_requests
const attendanceRequests: AssistTool = {
  name: 'get_attendance_requests',
  description: 'Attendance UNLOCK requests (staff asking a manager to re-open punching) and attendance CORRECTIONS (e.g. weekly-off / shift corrections applied to biometric attendance), with status and approver. E.g. "pending unlock requests for my team", "how many unlock requests were rejected this month", "attendance corrections at Brigade Cornerstone Utopia". Not for leave approvals or ops/report approvals.',
  parameters: {
    type: 'object',
    properties: {
      ...PERSON_PARAMS, ...PERIOD_PARAMS,
      status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'all'], description: 'Default all (pending when the user says pending / waiting / to approve).' },
      request_type: { type: 'string', enum: ['unlock', 'correction', 'all'], description: 'Default all.' },
      site_name: SITE_PARAMS.site_name,
    },
  },
  capability: 'attendance',
  module: 'Attendance requests',
  run: safeRun(async (ctx, args) => {
    const tgt = await targetPeople(ctx, args);
    if (tgt.ok === false) return tgt.result;
    // pending requests are shown regardless of age unless a period is given
    const p = periodRange(args.period, args.start_date, args.end_date, ctx.now, 'this_month');
    const usePeriod = !(args.status === 'pending' && !args.period);
    const { startUtc, endUtc } = istBounds(p.from, p.to);
    const names = await nameMapOf(ctx.sb);
    const status = args.status || 'all';
    const kind = args.request_type || 'all';
    const facts: Record<string, any> = { period: usePeriod ? p.label : 'any time', about: tgt.label, status_filter: status };
    const rows: (string | number | null)[][] = [];

    if (kind !== 'correction') {
      let q = ctx.sb.from('attendance_unlock_requests').select('user_id, manager_id, reason, status, requested_at, responded_at, rejection_reason').order('requested_at', { ascending: false }).limit(2000);
      if (usePeriod) q = q.gte('requested_at', startUtc).lte('requested_at', endUtc);
      if (status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const visible = new Set(tgt.people.map(x => x.id));
      // visible: requester in scope, or (team/all askers, not a single-person question) the asker is the approving manager
      const vis = (data ?? []).filter((x: any) => visible.has(x.user_id) || (!tgt.single && x.manager_id === ctx.asker.id));
      facts.unlock_requests = {
        total: vis.length, by_status: countBy(vis, (x: any) => x.status),
        waiting_for_you: vis.filter((x: any) => x.status === 'pending' && x.manager_id === ctx.asker.id).length,
      };
      for (const x of vis.slice(0, MAX_ROWS) as any[])
        rows.push(['Unlock', prettyDate(istDate(x.requested_at)), names.get(x.user_id) ?? 'Unknown', x.status, names.get(x.manager_id) ?? '—', trunc(x.status === 'rejected' && x.rejection_reason ? `${x.reason} — rejected: ${x.rejection_reason}` : x.reason, 70)]);
    }

    if (kind !== 'unlock') {
      // attendance_corrections are keyed by biometric emp_code / emp_name / site name (no status: they are applied corrections)
      if (status === 'pending' || status === 'rejected') {
        facts.attendance_corrections = { note: 'Attendance corrections are applied directly (they have no pending/rejected status).' };
      } else {
        let site: string | null = null;
        let q = ctx.sb.from('attendance_corrections').select('emp_code, emp_name, attendance_date, site, shift_name, corrected_by, corrected_at').order('attendance_date', { ascending: false }).limit(2000);
        if (usePeriod) q = q.gte('attendance_date', p.from).lte('attendance_date', p.to);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        let vis: any[] = data ?? [];
        if (tgt.single) {
          const { data: me } = await ctx.sb.from('users').select('biometric_id').eq('id', tgt.people[0].id).maybeSingle();
          const code = (me as any)?.biometric_id;
          vis = code ? vis.filter(x => String(x.emp_code) === String(code)) : [];
        } else if (ctx.scope.level !== 'all') {
          vis = vis.filter(x => x.site && siteVisible(ctx, x.site));
        }
        if (args.site_name) {
          const rs = await resolveSiteName(ctx, args, [...new Set(vis.map(x => x.site).filter(Boolean))]);
          if (rs.ok === false) return rs.result;
          site = rs.site;
          if (site) vis = vis.filter(x => sameSite(x.site, site));
        }
        const clean = (s: any) => /^[\[{]/.test(String(s ?? '').trim()) ? 'bulk shift update' : (s ?? '—');
        facts.attendance_corrections = {
          total: vis.length, site: site ?? undefined,
          by_site: countBy(vis, x => x.site ?? 'not set'), by_change: countBy(vis, x => clean(x.shift_name)),
          by_source: countBy(vis, x => /@/.test(x.corrected_by ?? '') ? 'manual (admin)' : (x.corrected_by ?? 'unknown')),
        };
        for (const x of vis.slice(0, Math.max(0, MAX_ROWS - rows.length)))
          rows.push(['Correction', prettyDate(x.attendance_date), x.emp_name ?? `Emp ${x.emp_code}`, 'applied', x.site ?? '—', trunc(`→ ${clean(x.shift_name)} (${/@/.test(x.corrected_by ?? '') ? 'manual' : x.corrected_by})`, 60)]);
      }
    }
    ctx.audit({ tool: 'get_attendance_requests', args, subjectUserId: tgt.single ? tgt.people[0].id : null, allowed: true });
    return {
      kind: 'answer', facts,
      sourceLabel: `Attendance requests · ${usePeriod ? p.label.replace(/\s*\(.*\)$/, '') : 'all pending'}`,
      table: rows.length ? { columns: ['Type', 'Date', 'Employee', 'Status', 'Approver / site', 'Detail'], rows: rows.slice(0, MAX_ROWS) } : undefined,
    };
  }),
};

// ============================================================================ 3. get_site_attendance_today
/** biometric_device_logs.log_date holds IST wall-clock time with a Z suffix (services/api.ts device-log query uses `${date}T00:00:00.000Z`). */
/** A machine belongs to a site when its name is the site name or a more specific variant ("Nikoo Homes H ret" ∈ "Nikoo Homes", but not ∈ "Nikoo Homes 1"). */
const deviceAtSite = (site: string, d: any) => [d.location_name, d.name].some(n => { const c = compact(n), s = compact(site); return !!c && !!s && c.startsWith(s); });
const bioDayBounds = (from: string, to: string) => ({ s: `${from}T00:00:00.000Z`, e: `${to}T23:59:59.999Z` });

const siteAttendanceToday: AssistTool = {
  name: 'get_site_attendance_today',
  description: 'HEADCOUNT for one day at a client site or across the asker\'s team: how many present / absent / on leave / late, and who has not punched in (app punches + site biometric machines). E.g. "who hasn\'t punched in at Nikoo today", "how many present in my team yesterday", "absentees today", "manpower present at Purva Venezia". Not for one named person\'s attendance (get_attendance_summary) or late/violation history over weeks (get_attendance_exceptions).',
  parameters: {
    type: 'object',
    properties: {
      ...SITE_PARAMS,
      period: { type: 'string', enum: ['today', 'yesterday', 'custom'], description: 'Default today. custom = a single date in start_date.' },
      start_date: { type: 'string', description: 'YYYY-MM-DD (custom only)' },
    },
  },
  capability: 'attendance',
  module: 'Site attendance',
  run: safeRun(async (ctx, args) => {
    const p = periodRange(args.period || 'today', args.start_date, args.start_date, ctx.now, 'today');
    const day = p.from;
    const today = todayIst(ctx.now);
    if (day > today) return { kind: 'not_found', text: `${prettyDate(day)} is in the future.` };
    const devices = await loadAll<any>(ctx.sb, 'biometric_devices', 'name, sn, status, last_seen, location_name');
    const visDevices = devices.filter(d => siteVisible(ctx, d.location_name || d.name));

    let site: string | null = null;
    if (args.site_name || args.site_exact) {
      const rs = await resolveSiteName(ctx, args, await visibleSiteNames(ctx, visDevices.map(d => d.location_name || d.name)));
      if (rs.ok === false) return rs.result;
      site = rs.site;
    } else if (ctx.scope.level === 'self') {
      return { kind: 'denied', text: 'You can only view your own attendance. Ask "my attendance today" instead.' };
    }

    const rules = await attendanceRules(ctx.sb);
    const dir = await peopleDirectory(ctx.sb);
    const names = new Map(dir.rows.map(r => [r.id, r.name]));
    const { startUtc, endUtc } = istBounds(day, day);
    const facts: Record<string, any> = { date: prettyDate(day), site: site ?? (ctx.scope.level === 'all' ? 'all sites' : 'your team') };
    const tableRows: (string | number | null)[][] = [];

    // ---------------- app users (attendance_events)
    const tgt = await targetPeople(ctx, {});
    if (tgt.ok === false) return tgt.result;
    const people = tgt.people;
    const ids = people.map(x => x.id);
    const ev = await loadIn<any>(ctx.sb, 'attendance_events', 'user_id, timestamp, type, location_id, location_name', 'user_id', tgt.ids,
      q => q.gte('timestamp', startUtc).lte('timestamp', endUtc).order('timestamp'));
    const r = await refs(ctx.sb);
    const locName = new Map(r.locations.map(l => [l.id, l.name]));
    const visibleIds = new Set(ids);
    const evVis = ev.filter(e => visibleIds.has(e.user_id));
    const firstIn = new Map<string, any>();
    const anyEvent = new Map<string, any>();
    for (const e of evVis) {
      if (!anyEvent.has(e.user_id)) anyEvent.set(e.user_id, e);
      if (IN_TYPES.has(e.type) && !firstIn.has(e.user_id)) firstIn.set(e.user_id, e);
    }
    const lateOf = (uid: string) => { const e = firstIn.get(uid); return !!e && istTime(e.timestamp)! > rules.checkIn; };

    if (site) {
      // app users who punched at this site (users.location_id is mostly a placeholder group, so the roster is not known per site)
      const atSite = [...anyEvent.keys()].filter(uid => evVis.some(e => e.user_id === uid && (sameSite(site, locName.get(e.location_id)) || sameSite(site, e.location_name) || compact(e.location_name).includes(compact(site)))));
      facts.app_punches_at_site = { people: atSite.length, late: atSite.filter(lateOf).length };
      for (const uid of atSite.slice(0, 10)) {
        const e = firstIn.get(uid) ?? anyEvent.get(uid);
        tableRows.push([names.get(uid) ?? 'Unknown', 'Present (app)', istTime(e.timestamp), lateOf(uid) ? 'late' : '']);
      }
    } else {
      // reportGenerators.attendance_daily: present = any punch that day; on leave = approved leave covering the day;
      // inactive = no punch in the 10 days up to the day (not counted absent); absent = the rest. Exempt roles excluded.
      const prior = await loadIn<any>(ctx.sb, 'attendance_events', 'user_id', 'user_id', tgt.ids,
        q => q.gte('timestamp', istBounds(addDays(day, -9), day).startUtc).lte('timestamp', endUtc));
      const recent = new Set(prior.map(x => x.user_id));
      const leaves = await loadIn<any>(ctx.sb, 'leave_requests', 'user_id', 'user_id', tgt.ids,
        q => q.eq('status', 'approved').lte('start_date', day).gte('end_date', day));
      const onLeave = new Set(leaves.map(x => x.user_id).filter(u => visibleIds.has(u)));
      const present = people.filter(x => anyEvent.has(x.id));
      const leave = people.filter(x => !anyEvent.has(x.id) && onLeave.has(x.id));
      const inactive = people.filter(x => !anyEvent.has(x.id) && !onLeave.has(x.id) && !recent.has(x.id));
      const absent = people.filter(x => !anyEvent.has(x.id) && !onLeave.has(x.id) && recent.has(x.id));
      const late = present.filter(x => lateOf(x.id));
      facts.app_users = {
        rules: `present = any punch that day; late = first punch-in after ${rules.checkIn} IST; inactive = no punch in the last 10 days (not counted absent)`,
        staff_counted: people.length, present: present.length, absent: absent.length, on_leave: leave.length, inactive: inactive.length, late: late.length,
        not_punched_in: absent.map(x => x.name).slice(0, MAX_ROWS),
        on_leave_names: leave.map(x => x.name).slice(0, 10),
      };
      if (day === today) facts.app_users.note = 'Day still in progress; people may still punch in.';
      for (const x of absent.slice(0, 15)) tableRows.push([x.name, 'Not punched in', null, ROLE_LABEL(x.role_id)]);
      for (const x of late.slice(0, 10)) tableRows.push([x.name, 'Late', istTime(firstIn.get(x.id).timestamp), ROLE_LABEL(x.role_id)]);
      for (const x of leave.slice(0, 5)) tableRows.push([x.name, 'On leave', null, ROLE_LABEL(x.role_id)]);
    }

    // ---------------- site biometric machines (site staff who don't use the app; no names, only employee codes)
    const devs = site ? visDevices.filter(d => deviceAtSite(site, d)) : (ctx.scope.level === 'all' || ctx.scope.level === 'team' ? visDevices : []);
    if (devs.length) {
      const serials = devs.map(d => String(d.sn).toUpperCase());
      const b = bioDayBounds(day, day);
      const logs = await loadIn<any>(ctx.sb, 'biometric_device_logs', 'emp_code, serial_no, direction, log_date', 'serial_no', [...new Set([...serials, ...devs.map(d => String(d.sn))])],
        q => q.gte('log_date', b.s).lte('log_date', b.e));
      // services/queryRouter.ts fetchSiteRaw: present = distinct emp_code with an 'in' punch
      const presentCodes = new Set(logs.filter(l => lc(l.direction) === 'in').map(l => String(l.emp_code)));
      const anyCodes = new Set(logs.map(l => String(l.emp_code)));
      const bio: Record<string, any> = {
        scope: site ? 'machines at this site' : 'all biometric machines at sites you can see (site staff, not app users)',
        machines: devs.length, machines_offline: devs.filter(d => d.status !== 'online').length,
        present_by_biometric: presentCodes.size, punches: logs.length,
      };
      if (site) {
        // usual staff = distinct employee codes seen on these machines in the previous 7 days (estimate; no site roster table exists)
        const w = bioDayBounds(addDays(day, -7), addDays(day, -1));
        const week = await loadIn<any>(ctx.sb, 'biometric_device_logs', 'emp_code', 'serial_no', [...new Set([...serials, ...devs.map(d => String(d.sn))])],
          q => q.gte('log_date', w.s).lte('log_date', w.e));
        const usual = new Set(week.map(l => String(l.emp_code)));
        const missing = [...usual].filter(c => !anyCodes.has(c));
        bio.usual_staff_last_7_days = usual.size;
        bio.usual_staff_without_punch = missing.length;
        bio.note = 'Biometric staff are identified by employee code only; "usual staff" is an estimate from the previous 7 days.';
        bio.last_punch = logs.length ? String(logs.map(l => l.log_date).sort().at(-1)).slice(11, 16) : null;
        if (missing.length) {
          const { data: known } = await ctx.sb.from('attendance_corrections').select('emp_code, emp_name').in('emp_code', missing.slice(0, 200));
          const kn = new Map((known ?? []).map((k: any) => [String(k.emp_code), k.emp_name]));
          bio.usual_staff_without_punch_codes = missing.slice(0, 15).map(c => kn.get(c) ? `${kn.get(c)} (${c})` : `Emp ${c}`);
        }
      } else {
        const bySerial = countBy(logs.filter(l => lc(l.direction) === 'in'), l => String(l.serial_no).toUpperCase());
        const perSite: Record<string, Set<string>> = {};
        for (const l of logs) if (lc(l.direction) === 'in') {
          const d = devs.find(x => String(x.sn).toUpperCase() === String(l.serial_no).toUpperCase());
          const k = d?.location_name || d?.name || 'Unknown';
          (perSite[k] ??= new Set()).add(String(l.emp_code));
        }
        bio.by_site = Object.entries(perSite).sort((a, b) => b[1].size - a[1].size).slice(0, 15).map(([k, v]) => `${k}: ${v.size}`);
        bio.sites_with_no_punches = devs.filter(d => !bySerial[String(d.sn).toUpperCase()]).map(d => d.location_name || d.name).slice(0, 15);
      }
      facts.biometric = bio;
    } else if (site) {
      facts.biometric = { note: 'No biometric machine is registered for this site.' };
    }
    ctx.audit({ tool: 'get_site_attendance_today', args, subjectSite: site, allowed: true });
    return {
      kind: 'answer', facts,
      sourceLabel: `Site attendance · ${site ? site + ' · ' : ''}${prettyDate(day)}`,
      table: tableRows.length ? { columns: ['Employee', 'Status', 'Punch-in', 'Role'], rows: tableRows.slice(0, MAX_ROWS) } : undefined,
    };
  }),
};

// ============================================================================ 4. get_device_status
const deviceStatus: AssistTool = {
  name: 'get_device_status',
  description: 'Health of attendance HARDWARE: biometric punching machines and CCTV face-recognition units — online/offline, last heartbeat, last punch synced, punches today. E.g. "which biometric devices are offline", "is the Nikoo biometric machine working", "CCTV status", "when did Purva Venezia device last sync". Not for people\'s attendance.',
  parameters: {
    type: 'object',
    properties: {
      ...SITE_PARAMS,
      device_type: { type: 'string', enum: ['biometric', 'cctv', 'all'], description: 'Default all.' },
      status_filter: { type: 'string', enum: ['offline', 'online', 'all'], description: 'offline when the user asks which are down/offline/not working. Default all.' },
    },
  },
  capability: 'ops',
  module: 'Devices',
  run: safeRun(async (ctx, args) => {
    const type = args.device_type || 'all';
    const sf = args.status_filter || 'all';
    const [bioAll, cctvAll] = await Promise.all([
      loadAll<any>(ctx.sb, 'biometric_devices', 'name, sn, status, last_seen, location_name'),
      loadAll<any>(ctx.sb, 'cctv_devices', 'edge_device_id, site_name, location_name, location_id, status, last_seen, is_active, cameras'), // never device_secret / host / urls
    ]);
    const bio = bioAll.filter(d => siteVisible(ctx, d.location_name || d.name));
    const cctv = cctvAll.filter(d => siteVisible(ctx, d.site_name, d.location_id) || siteVisible(ctx, d.location_name));
    if (!bio.length && !cctv.length) return { kind: 'not_found', text: 'No biometric or CCTV devices are registered at the sites you have access to.' };

    let site: string | null = null;
    if (args.site_name || args.site_exact) {
      const rs = await resolveSiteName(ctx, args, [...bio.map(d => d.location_name || d.name), ...cctv.map(d => d.site_name)].filter(Boolean), 'device site');
      if (rs.ok === false) return rs.result;
      site = rs.site;
    }
    const today = todayIst(ctx.now);
    const facts: Record<string, any> = { site: site ?? 'all sites in scope', rule: 'online/offline is the status reported by the device bridge (same as the Device Management page)' };
    const rows: (string | number | null)[][] = [];

    if (type !== 'cctv') {
      let list = site ? bio.filter(d => deviceAtSite(site, d)) : bio;
      // last punch per machine from the last 3 days of logs (log_date = IST wall clock)
      const b = bioDayBounds(addDays(today, -2), today);
      const serials = list.map(d => String(d.sn).toUpperCase());
      const logs = serials.length ? await loadIn<any>(ctx.sb, 'biometric_device_logs', 'serial_no, log_date', 'serial_no', serials, q => q.gte('log_date', b.s).lte('log_date', b.e)) : [];
      const last = new Map<string, string>(); const todayCount: Record<string, number> = {};
      for (const l of logs) {
        const k = String(l.serial_no).toUpperCase();
        if (!last.has(k) || l.log_date > last.get(k)!) last.set(k, l.log_date);
        if (String(l.log_date).startsWith(today)) todayCount[k] = (todayCount[k] ?? 0) + 1;
      }
      const all = list;
      if (sf !== 'all') list = list.filter(d => sf === 'online' ? d.status === 'online' : d.status !== 'online');
      facts.biometric = {
        total: all.length, online: all.filter(d => d.status === 'online').length, offline: all.filter(d => d.status !== 'online').length,
        no_punch_in_last_3_days: all.filter(d => !last.has(String(d.sn).toUpperCase())).map(d => d.location_name || d.name).slice(0, 15),
        online_but_no_heartbeat_24h: all.filter(d => d.status === 'online' && (!d.last_seen || ctx.now.getTime() - new Date(d.last_seen).getTime() > 864e5)).map(d => d.location_name || d.name).slice(0, 15),
      };
      for (const d of list.sort((a, b) => (a.status === 'online' ? 1 : 0) - (b.status === 'online' ? 1 : 0) || String(a.location_name).localeCompare(String(b.location_name))).slice(0, MAX_ROWS)) {
        const k = String(d.sn).toUpperCase();
        const lp = last.get(k);
        rows.push(['Biometric', d.location_name || d.name, d.status ?? 'unknown', ago(d.last_seen, ctx.now), lp ? `${prettyDate(lp)} ${lp.slice(11, 16)}` : 'none in 3 days', todayCount[k] ?? 0]);
      }
    }

    if (type !== 'biometric') {
      let list = site ? cctv.filter(d => sameSite(site, d.site_name) || sameSite(site, d.location_name)) : cctv;
      const { startUtc, endUtc } = istBounds(today, today);
      const info = await Promise.all(list.map(async d => {
        const [{ data: lastRow }, { count }] = await Promise.all([
          ctx.sb.from('cctv_attendance_logs').select('detected_at').eq('edge_device_id', d.edge_device_id).order('detected_at', { ascending: false }).limit(1),
          ctx.sb.from('cctv_attendance_logs').select('id', { count: 'exact', head: true }).eq('edge_device_id', d.edge_device_id).gte('detected_at', startUtc).lte('detected_at', endUtc),
        ]);
        return { d, last: (lastRow as any)?.[0]?.detected_at ?? null, today: count ?? 0 };
      }));
      const all = info;
      const shown = sf === 'all' ? info : info.filter(x => sf === 'online' ? x.d.status === 'online' : x.d.status !== 'online');
      facts.cctv = {
        total: all.length, online: all.filter(x => x.d.status === 'online').length, offline: all.filter(x => x.d.status !== 'online').length,
        cameras: all.reduce((n, x) => n + (Array.isArray(x.d.cameras) ? x.d.cameras.length : 0), 0),
      };
      for (const x of shown.slice(0, Math.max(0, MAX_ROWS - rows.length)))
        rows.push(['CCTV', `${x.d.site_name ?? '—'}${x.d.location_name ? ' · ' + x.d.location_name : ''}`, x.d.status ?? 'unknown', ago(x.d.last_seen, ctx.now), x.last ? `${prettyDate(istDate(x.last))} ${istTime(x.last)}` : 'none', x.today]);
    }
    ctx.audit({ tool: 'get_device_status', args, subjectSite: site, allowed: true });
    return {
      kind: 'answer', facts, sourceLabel: `Devices · ${site ?? 'status'} · ${prettyDate(today)}`,
      table: rows.length ? { columns: ['Type', 'Site', 'Status', 'Last heartbeat', 'Last punch (IST)', 'Punches today'], rows } : undefined,
    };
  }),
};

// ============================================================================ 5. get_site_info
const ROLE_COLS: [string, string][] = [
  ['ops_manager', 'Operations manager'], ['site_manager', 'Site manager'], ['field_officer', 'Field officer'],
  ['site_supervisor', 'Site supervisor'], ['hr_incharge', 'HR in-charge'], ['accounts_incharge', 'Accounts in-charge'],
];

const siteInfo: AssistTool = {
  name: 'get_site_info',
  description: 'Client SITE directory from the Site Responsibility Matrix: who is the ops manager / HR in-charge / accounts in-charge of a site, which or how many sites a person handles, "list my sites", site basics (units, takeover date, billing cycle, city) and vendor/AMC contracts at the site. E.g. "who is the ops manager of Nikoo", "how many sites does Isaac handle", "list my sites", "Aeris contract details". Not for invoice/billing values (get_site_invoice) or an employee\'s own profile.',
  parameters: {
    type: 'object',
    properties: {
      ...SITE_PARAMS,
      person_name: { type: 'string', description: 'Person whose sites are asked about ("how many sites does Isaac handle"). Empty for "my sites" (set about_self).' },
      about_self: { type: 'boolean', description: 'true for "my sites".' },
      person_id: PERSON_PARAMS.person_id,
    },
  },
  capability: 'ops',
  module: 'Sites',
  run: safeRun(async (ctx, args) => {
    const r = await refs(ctx.sb);
    const dir = await peopleDirectory(ctx.sb);
    const byId = new Map(dir.rows.map(u => [u.id, u]));
    const visMatrix = r.matrix.filter(m => siteVisible(ctx, m.site_name, m.site_id));
    const canPhone = ctx.scope.can('directory_phone');
    const holder = (m: any, col: string) => {
      const id = m[`${col}_id`]; const nm = m[`${col}_name`];
      if (!id && !nm) return null;
      const u = id ? byId.get(id) : null;
      return u ? `${u.name}${canPhone && u.phone ? ` (${u.phone})` : ''}${u.status === 'left' ? ' [left]' : ''}` : `${nm} (name only, not linked to a user)`;
    };

    // ---- one site
    if (args.site_name || args.site_exact) {
      const rs = await resolveSiteName(ctx, args, await visibleSiteNames(ctx));
      if (rs.ok === false) return rs.result;
      const site = rs.site!;
      const m = visMatrix.find(x => lc(x.site_name) === lc(site)) ?? visMatrix.find(x => sameSite(x.site_name, site));
      const loc = r.locations.find(l => lc(l.name) === lc(site)) ?? (m?.site_id ? r.locations.find(l => l.id === m.site_id) : null);
      const org = r.orgs.find(o => lc(o.short_name) === lc(m?.site_name ?? site));
      const ent = r.entities.find(e => (org && e.organization_id === org.id) || lc(e.name) === lc(m?.site_name ?? site));
      const fin = ctx.scope.canSeeFinanceSite(m?.site_name ?? site);
      const facts: Record<string, any> = { site: m?.site_name ?? site };
      if (m) {
        facts.responsibilities = Object.fromEntries(ROLE_COLS.map(([c, label]) => [label, holder(m, c) ?? 'not assigned']));
        Object.assign(facts, {
          units: m.units_count ?? null, takeover_date: prettyDate(m.takeover_date), billing_cycle: m.billing_cycle ?? null,
          client_legal_name: m.billing_legal_name ?? null,
        });
        if (fin) { facts.gstin = m.gstin ?? ent?.gst_number ?? null; facts.pan = m.pan ?? ent?.pan_number ?? null; }
      } else facts.responsibilities = 'This site is not in the Site Responsibility Matrix.';
      if (ent) Object.assign(facts, { city: ent.location ?? ent.site_management?.city ?? null, client_type: ent.registration_type ?? null, key_account_manager: ent.site_management?.key_account_manager ?? null, entity_status: ent.status ?? null });
      if (org?.manpower_approved_count != null) facts.approved_manpower = org.manpower_approved_count;
      if (loc) facts.geo_fence = { address: shortAddress(loc.address), radius_m: loc.radius ?? null };
      if (loc) facts.app_users_assigned = dir.rows.filter(u => u.location_id === loc.id && u.status !== 'left').length;
      if (ent) {
        const { data: contracts } = await ctx.sb.from('ops_contracts').select('contract_title, contract_type, vendor_name, start_date, end_date, contract_value, status, payment_frequency, sla_response_time_hours, sla_resolution_time_hours, auto_renewal').eq('entity_id', ent.id);
        facts.contracts = (contracts ?? []).map((c: any) => ({
          title: c.contract_title, type: c.contract_type, vendor: c.vendor_name, status: c.status,
          period: `${prettyDate(c.start_date)} – ${prettyDate(c.end_date)}`, payment: c.payment_frequency,
          sla: c.sla_response_time_hours ? `respond ${c.sla_response_time_hours} h / resolve ${c.sla_resolution_time_hours} h` : null,
          ...(fin ? { value: inr(c.contract_value) } : {}),
        }));
        if (!fin && (contracts ?? []).length) facts.contract_values = 'hidden (finance access required)';
      }
      ctx.audit({ tool: 'get_site_info', args, subjectSite: facts.site, allowed: true });
      return { kind: 'answer', facts, sourceLabel: `Sites · ${facts.site}` };
    }

    // ---- sites of a person ("how many sites does Isaac handle" / "my sites")
    const aboutPerson = args.person_name || args.person_id || args.about_self || ctx.scope.level !== 'all';
    if (aboutPerson) {
      const who = await resolvePerson(ctx, args);
      if (who.ok === false) return who.result;
      const p = who.person;
      const first = lc(p.name).split(/\s+/)[0];
      // name-only matrix rows (no user id) count only when exactly one active employee has this first name
      const firstUnique = first.length >= 4 && dir.rows.filter(u => u.status !== 'left' && lc(u.name).split(/\s+/)[0] === first).length === 1;
      const rows: any[] = [];
      for (const m of r.matrix) {
        const roles = ROLE_COLS.filter(([c]) => m[`${c}_id`] === p.id || (!m[`${c}_id`] && firstUnique && lc(m[`${c}_name`]).split(/[\s/]+/).includes(first))).map(([, l]) => l);
        if (roles.length) rows.push({ site: m.site_name, roles, nameOnly: ROLE_COLS.some(([c]) => !m[`${c}_id`] && firstUnique && lc(m[`${c}_name`]).split(/[\s/]+/).includes(first)) });
      }
      // people other than the asker: only sites the asker may also see (org-wide askers see all)
      const vis = p.id === ctx.asker.id ? rows : rows.filter(x => siteVisible(ctx, x.site));
      const byRole = countBy(vis.flatMap(x => x.roles.map((l: string) => ({ l }))), x => x.l);
      const facts = {
        person: p.id === ctx.asker.id ? `${p.name} (you)` : p.name, role: ROLE_LABEL(p.role_id),
        sites_total: vis.length, by_responsibility: byRole,
        matched_by_name_only: vis.filter(x => x.nameOnly).length || undefined,
        note: vis.some(x => x.nameOnly) ? 'Some matrix rows only carry a first name (not linked to a user id); those were matched by name.' : undefined,
      };
      ctx.audit({ tool: 'get_site_info', args, subjectUserId: p.id, allowed: true });
      if (!vis.length) return { kind: 'answer', facts: { ...facts, sites_total: 0, note: 'Not named on any active site in the Site Responsibility Matrix.' }, sourceLabel: 'Sites · Responsibility Matrix' };
      return {
        kind: 'answer', facts, sourceLabel: `Sites · ${p.name}`,
        table: { columns: ['Site', 'Responsibility'], rows: vis.sort((a, b) => a.site.localeCompare(b.site)).slice(0, MAX_ROWS).map(x => [x.site, x.roles.join(', ')]) },
      };
    }

    // ---- org-wide overview (admin/HR with no site/person)
    const perOps = countBy(r.matrix, m => (m.ops_manager_id && byId.get(m.ops_manager_id)?.name) || `${m.ops_manager_name ?? 'unassigned'} (name only)`);
    const facts = {
      active_sites_in_matrix: r.matrix.length, locations_geofenced: r.locations.length, client_entities: r.entities.length,
      sites_per_ops_manager: Object.entries(perOps).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k}: ${v}`),
      sites_without_linked_ops_manager: r.matrix.filter(m => !m.ops_manager_id).length,
    };
    ctx.audit({ tool: 'get_site_info', args, allowed: true });
    return { kind: 'answer', facts, sourceLabel: 'Sites · Responsibility Matrix' };
  }),
};

// ============================================================================ 6. get_tickets
const CLOSED_TICKET = new Set(['resolved', 'closed']);
const tickets: AssistTool = {
  name: 'get_tickets',
  description: 'Helpdesk / support TICKETS raised in the Paradigm app: open vs closed counts, status, priority, who raised it, who it is assigned to. E.g. "open tickets", "my tickets", "how many high-priority tickets are pending", "tickets closed this month", "tickets assigned to Sudhan". Not for escalation contacts/TAT (get_escalation_contacts) or approvals.',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['open', 'closed', 'all'], description: 'open = not resolved/closed. Default open.' },
      priority: { type: 'string', description: 'Low / Medium / High / Urgent, if the user named one.' },
      person_name: { type: 'string', description: 'Raised by / assigned to this person, if named. Empty for "my tickets" (set about_self).' },
      about_self: { type: 'boolean' },
      person_id: PERSON_PARAMS.person_id,
      period: PERIOD_PARAMS.period, start_date: PERIOD_PARAMS.start_date, end_date: PERIOD_PARAMS.end_date,
    },
  },
  capability: 'tickets',
  module: 'Helpdesk',
  run: safeRun(async (ctx, args) => {
    let person: PersonRow | null = null;
    if (args.person_name || args.person_id || args.about_self || ctx.scope.level === 'self') {
      const who = await resolvePerson(ctx, args);
      if (who.ok === false) return who.result;
      person = who.person;
    }
    let q = ctx.sb.from('support_tickets').select('id, ticket_number, title, category, priority, status, raised_by_id, raised_by_name, raised_at, assigned_to_id, assigned_to_name, resolved_at, closed_at').order('raised_at', { ascending: false }).limit(2000);
    let periodLabel = 'all time';
    if (args.period) {
      const p = periodRange(args.period, args.start_date, args.end_date, ctx.now);
      const b = istBounds(p.from, p.to);
      q = q.gte('raised_at', b.startUtc).lte('raised_at', b.endUtc);
      periodLabel = p.label;
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    // scope: org-wide sees all; team sees tickets raised by / assigned to people in scope; self sees own (tickets carry no site)
    let vis = (data ?? []).filter((t: any) => ctx.scope.level === 'all' || ctx.scope.canSeeUser(t.raised_by_id) || ctx.scope.canSeeUser(t.assigned_to_id));
    if (person) vis = vis.filter((t: any) => t.raised_by_id === person!.id || t.assigned_to_id === person!.id);
    const status = args.status || 'open';
    const scoped = vis;
    if (status !== 'all') vis = vis.filter((t: any) => (status === 'closed') === CLOSED_TICKET.has(lc(t.status)));
    if (args.priority) vis = vis.filter((t: any) => lc(t.priority) === lc(args.priority));
    const now = ctx.now;
    const facts = {
      about: person ? (person.id === ctx.asker.id ? 'your tickets (raised by or assigned to you)' : `tickets raised by / assigned to ${person.name}`) : (ctx.scope.level === 'all' ? 'all tickets' : 'tickets of your team'),
      period: periodLabel, status_filter: status,
      matching: vis.length,
      overall: { total: scoped.length, open: scoped.filter((t: any) => !CLOSED_TICKET.has(lc(t.status))).length, closed: scoped.filter((t: any) => CLOSED_TICKET.has(lc(t.status))).length },
      by_status: countBy(vis, (t: any) => t.status), by_priority: countBy(vis, (t: any) => t.priority ?? 'none'),
      unassigned: vis.filter((t: any) => !t.assigned_to_id && !CLOSED_TICKET.has(lc(t.status))).length,
      oldest_open_age_days: (() => { const o = vis.filter((t: any) => !CLOSED_TICKET.has(lc(t.status))).map((t: any) => t.raised_at).sort()[0]; return o ? Math.floor((now.getTime() - new Date(o).getTime()) / 864e5) : null; })(),
    };
    ctx.audit({ tool: 'get_tickets', args, subjectUserId: person?.id ?? null, allowed: true });
    if (!scoped.length) return { kind: 'answer', facts: { ...facts, note: 'No helpdesk tickets found in your scope.' }, sourceLabel: 'Helpdesk tickets' };
    return {
      kind: 'answer', facts, sourceLabel: `Helpdesk tickets · ${status}`,
      table: vis.length ? {
        columns: ['Ticket', 'Title', 'Priority', 'Status', 'Raised by', 'Assigned to', 'Raised on'],
        rows: vis.slice(0, MAX_ROWS).map((t: any) => [t.ticket_number, trunc(t.title, 60), t.priority, t.status, t.raised_by_name ?? '—', t.assigned_to_name ?? 'unassigned', prettyDate(istDate(t.raised_at))]),
      } : undefined,
    };
  }),
};

// ============================================================================ 7. get_escalation_contacts
const SERVICE_KEYWORDS: [RegExp, string, string][] = [
  // [user words, escalation_matrix.service_type, helpdesk_sla_policies.category]
  [/lift|elevator|power|electric|dg|generator|transformer|mep|ac\b|hvac|air.?con|chiller|plumb|leak|pump|technical/i, 'Technical MEP', ''],
  [/secur|guard|cctv|camera|theft|gate|surveil/i, 'Security & Surveillance', 'General'],
  [/water|stp|sewage|tank|wtp|borewell/i, 'Water & STP Management', 'Plumbing'],
];
const slaCategory = (s: string) => /electric|power|lift|elevator|dg|generator|transformer/i.test(s) ? 'Electrical'
  : /plumb|leak|water|pump|stp|tank/i.test(s) ? 'Plumbing' : /hvac|ac\b|air.?con|chiller/i.test(s) ? 'HVAC' : 'General';

const escalationContacts: AssistTool = {
  name: 'get_escalation_contacts',
  description: 'WHO TO ESCALATE an issue to and how fast: escalation levels (L1–L4), role, contact person and TAT for a site and service (lift, power, security, water/STP), plus helpdesk SLA response/resolution times by category and priority. E.g. "who do I escalate a lift breakdown to", "escalation matrix for security at my site", "what is the SLA for a P1 electrical issue". Not for ticket lists (get_tickets).',
  parameters: {
    type: 'object',
    properties: {
      ...SITE_PARAMS,
      issue: { type: 'string', description: 'The problem or service in the user\'s words, e.g. "lift breakdown", "water leakage", "security".' },
      priority: { type: 'string', enum: ['P1', 'P2', 'P3', 'P4'], description: 'Only if the user named a priority.' },
    },
  },
  capability: null,
  module: 'Escalation',
  run: safeRun(async (ctx, args) => {
    const r = await refs(ctx.sb);
    const locName = new Map(r.locations.map(l => [l.id, l.name]));
    const canContact = ctx.scope.can('directory_phone');
    const [matrixRows, sla] = await Promise.all([
      loadAll<any>(ctx.sb, 'escalation_matrix', 'site_id, city, service_type, level, role_name, contact_person, phone, email, tat_minutes, escalation_trigger, display_order, is_demo'),
      loadAll<any>(ctx.sb, 'helpdesk_sla_policies', 'site_id, category, priority, response_time_minutes, resolution_time_minutes, escalation_contact_role'),
    ]);
    const withSite = matrixRows.map(x => ({ ...x, site: locName.get(x.site_id) ?? null }));
    const visRows = withSite.filter(x => siteVisible(ctx, x.site, x.site_id));
    const visTiers = r.matrix.filter(m => siteVisible(ctx, m.site_name, m.site_id) && Array.isArray(m.escalation_tiers) && m.escalation_tiers.length);

    let site: string | null = null;
    if (args.site_name || args.site_exact) {
      const rs = await resolveSiteName(ctx, args, [...visRows.map(x => x.site), ...visTiers.map(m => m.site_name)].filter(Boolean) as string[]);
      if (rs.ok === false) return rs.result;
      site = rs.site;
    } else {
      const sites = [...new Set([...visRows.map(x => x.site), ...visTiers.map(m => m.site_name)].filter(Boolean))] as string[];
      if (sites.length === 1) site = sites[0];
      else if (sites.length > 1 && sites.length <= 8 && ctx.scope.level !== 'all')
        return { kind: 'clarify', question: 'Which site is this for?', options: sites.map(s => ({ label: s, args: { ...args, site_exact: s } })) };
    }
    const issue = String(args.issue ?? '');
    const svc = SERVICE_KEYWORDS.find(([re]) => re.test(issue))?.[1] ?? null;
    const facts: Record<string, any> = { site: site ?? 'company default (no site-specific matrix)', issue: issue || 'general' };
    if (!site) { const n = new Set([...visRows.map(x => x.site), ...visTiers.map(m => m.site_name)].filter(Boolean)).size; if (n) facts.tip = `Site-specific escalation contacts exist for ${n} of your sites — ask again with the site name.`; }

    let ladder = site ? visRows.filter(x => sameSite(x.site, site)) : [];
    if (svc && ladder.some(x => x.service_type === svc)) ladder = ladder.filter(x => x.service_type === svc);
    const rows = ladder.sort((a, b) => String(a.service_type).localeCompare(String(b.service_type)) || (a.display_order ?? 0) - (b.display_order ?? 0)).slice(0, MAX_ROWS);
    if (rows.length) {
      facts.escalation_matrix = { service: svc ?? 'all services', levels: rows.length, demo_data: rows.some(x => x.is_demo) || undefined };
      if (rows.some(x => x.is_demo)) facts.warning = 'This escalation matrix is marked as DEMO/sample data — confirm with the ops manager.';
    } else if (site) {
      const tier = visTiers.find(m => sameSite(m.site_name, site));
      if (tier) facts.site_escalation_tiers_source = 'Site Responsibility Matrix escalation tiers';
      if (tier) facts.site_escalation_tiers = tier.escalation_tiers.map((t: any) => ({
        level: t.level, name: t.name, role: t.role, ...(canContact ? { contact: t.contact } : {}),
      }));
    }
    if (!canContact && (rows.length || facts.site_escalation_tiers)) facts.contacts = 'phone numbers / emails hidden for your role';

    const cat = slaCategory(issue);
    const seen = new Set<string>();
    let pol = sla.filter(s => !s.site_id && (issue ? s.category === cat : true)).filter(s => { const k = `${s.category}|${s.priority}`; if (seen.has(k)) return false; seen.add(k); return true; });
    if (args.priority) pol = pol.filter(s => s.priority === args.priority);
    if (pol.length) facts.helpdesk_sla = {
      category: issue ? cat : 'all', escalate_to_role: [...new Set(pol.map(s => s.escalation_contact_role))].map(x => ROLE_LABEL(String(x))).join(', '),
      by_priority: pol.sort((a, b) => String(a.priority).localeCompare(String(b.priority))).slice(0, 16).map(s => `${issue ? '' : s.category + ' '}${s.priority}: respond ${s.response_time_minutes} min, resolve ${s.resolution_time_minutes} min`),
    };
    if (!rows.length && !facts.site_escalation_tiers && !pol.length) return { kind: 'not_found', text: 'No escalation matrix or SLA policy is set up for the sites you have access to.' };
    ctx.audit({ tool: 'get_escalation_contacts', args, subjectSite: site, allowed: true });
    return {
      kind: 'answer', facts, sourceLabel: `Escalation${site ? ' · ' + site : ''}`,
      table: rows.length ? {
        columns: ['Service', 'Level', 'Role', 'Contact', 'TAT', 'Trigger'],
        rows: rows.map(x => [x.service_type, x.level, x.role_name, canContact ? [x.contact_person, x.phone, x.email].filter(Boolean).join(' · ') : x.contact_person, x.tat_minutes != null ? `${x.tat_minutes} min` : null, trunc(x.escalation_trigger, 60)]),
      } : undefined,
    };
  }),
};

// ============================================================================ 8. get_ops_approvals
const opsApprovals: AssistTool = {
  name: 'get_ops_approvals',
  description: 'OPERATIONS approval requests (report-access requests, quotations and other ops approvals): what is pending with me, what I requested, approved/rejected counts. E.g. "approvals waiting for me", "pending ops approvals", "was my report access request approved", "quotation approvals this month". Not for leave approvals or attendance unlock requests.',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'all'], description: 'Default pending.' },
      mine: { type: 'string', enum: ['to_approve', 'requested', 'any'], description: 'to_approve = waiting for my decision; requested = raised by me. Default any.' },
      ...PERIOD_PARAMS,
    },
  },
  capability: 'ops',
  module: 'Ops approvals',
  run: safeRun(async (ctx, args) => {
    // never select `comments` (it can contain passcodes)
    let q = ctx.sb.from('ops_approval_requests').select('module_name, title, requested_by, approval_stage, required_role, status, approver_id, created_at, updated_at').order('created_at', { ascending: false }).limit(2000);
    let periodLabel = 'all time';
    if (args.period) {
      const p = periodRange(args.period, args.start_date, args.end_date, ctx.now);
      const b = istBounds(p.from, p.to);
      q = q.gte('created_at', b.startUtc).lte('created_at', b.endUtc);
      periodLabel = p.label;
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const role = lc(ctx.asker.role_id);
    const pending = (x: any) => !['approved', 'rejected', 'cancelled', 'withdrawn'].includes(lc(x.status));
    const forMe = (x: any) => x.approver_id === ctx.asker.id || (pending(x) && !x.approver_id && lc(x.required_role) === role);
    let vis = (data ?? []).filter((x: any) => ctx.scope.level === 'all' || x.requested_by === ctx.asker.id || forMe(x) || ctx.scope.canSeeUser(x.requested_by));
    const mine = args.mine || 'any';
    if (mine === 'to_approve') vis = vis.filter(forMe);
    if (mine === 'requested') vis = vis.filter((x: any) => x.requested_by === ctx.asker.id);
    const scoped = vis;
    const status = args.status || 'pending';
    if (status === 'pending') vis = vis.filter(pending);
    else if (status !== 'all') vis = vis.filter((x: any) => lc(x.status) === status);
    const names = await nameMapOf(ctx.sb);
    const nm = (id: string | null) => id ? (ctx.scope.level === 'all' || ctx.scope.canSeeUser(id) || id === ctx.asker.id ? names.get(id) ?? 'Unknown' : 'another employee') : '—';
    const facts = {
      period: periodLabel, status_filter: status, which: mine,
      matching: vis.length, pending_waiting_for_you: scoped.filter(x => pending(x) && forMe(x)).length,
      overall_by_status: countBy(scoped, (x: any) => x.status), by_module: countBy(vis, (x: any) => x.module_name),
    };
    ctx.audit({ tool: 'get_ops_approvals', args, allowed: true });
    return {
      kind: 'answer', facts, sourceLabel: `Ops approvals · ${status}`,
      table: vis.length ? {
        columns: ['Requested', 'Module', 'Title', 'Requested by', 'Status', 'Approver / role'],
        rows: vis.slice(0, MAX_ROWS).map((x: any) => [prettyDate(istDate(x.created_at)), x.module_name, trunc(x.title, 60), nm(x.requested_by), x.status, x.approver_id ? nm(x.approver_id) : ROLE_LABEL(lc(x.required_role))]),
      } : undefined,
    };
  }),
};

// ============================================================================ 9. get_audits
const audits: AssistTool = {
  name: 'get_audits',
  description: 'Site AUDITS and CHECKLISTS: latest HT yard (electrical substation) audits by site with status and snag count, site checklists (e.g. FM daily round), PPM checklist templates by asset (STP, DG, lift…) and their frequency. E.g. "last HT yard audit at Purva Zenium", "pending audits", "what PPM checklists do we have for STP", "checklists for my site". Not for helpdesk tickets or approvals.',
  parameters: {
    type: 'object',
    properties: {
      ...SITE_PARAMS,
      audit_type: { type: 'string', enum: ['ht_yard', 'ppm', 'checklist', 'all'], description: 'Default all.' },
      asset: { type: 'string', description: 'Asset category for PPM checklists, e.g. "STP", "DG".' },
    },
  },
  capability: 'ops',
  module: 'Audits',
  run: safeRun(async (ctx, args) => {
    const type = args.audit_type || 'all';
    const r = await refs(ctx.sb);
    const locName = new Map(r.locations.map(l => [l.id, l.name]));
    const [ht, cl] = await Promise.all([
      type === 'all' || type === 'ht_yard' ? loadAll<any>(ctx.sb, 'ht_yard_audits', 'site_name, reference_number, audit_date, client_division, status, auditor_name, equipment_instances, snag_items, updated_at') : Promise.resolve([]),
      type === 'all' || type === 'checklist' ? loadAll<any>(ctx.sb, 'checklists', 'title, frequency, target_role, service_type, items, site_id, status, is_demo, updated_at') : Promise.resolve([]),
    ]);
    let visHt = ht.filter(a => siteVisible(ctx, a.site_name));
    let visCl = cl.map(c => ({ ...c, site: c.site_id ? locName.get(c.site_id) ?? null : null })).filter(c => !c.site_id || siteVisible(ctx, c.site, c.site_id));
    let site: string | null = null;
    if (args.site_name || args.site_exact) {
      const rs = await resolveSiteName(ctx, args, [...visHt.map(a => a.site_name), ...visCl.map(c => c.site), ...await visibleSiteNames(ctx)].filter(Boolean) as string[]);
      if (rs.ok === false) return rs.result;
      site = rs.site;
      if (site) { visHt = visHt.filter(a => sameSite(a.site_name, site)); visCl = visCl.filter(c => !c.site_id || sameSite(c.site, site)); }
    }
    const facts: Record<string, any> = { site: site ?? 'all sites in scope' };
    const rows: (string | number | null)[][] = [];
    if (type === 'all' || type === 'ht_yard') {
      visHt.sort((a, b) => String(b.audit_date).localeCompare(String(a.audit_date)));
      facts.ht_yard_audits = { total: visHt.length, by_status: countBy(visHt, a => a.status ?? 'unknown'), latest: visHt[0] ? `${visHt[0].site_name} on ${prettyDate(visHt[0].audit_date)} (${visHt[0].status})` : null };
      for (const a of visHt.slice(0, MAX_ROWS))
        rows.push(['HT yard audit', a.site_name, prettyDate(a.audit_date), a.status, `${a.reference_number ?? ''} · ${a.auditor_name ?? '—'} · ${Array.isArray(a.equipment_instances) ? a.equipment_instances.length : 0} equipment · ${Array.isArray(a.snag_items) ? a.snag_items.length : 0} snags`]);
    }
    if (type === 'all' || type === 'checklist') {
      facts.site_checklists = { total: visCl.length, demo_data: visCl.some(c => c.is_demo) || undefined };
      for (const c of visCl.slice(0, Math.max(0, MAX_ROWS - rows.length)))
        rows.push(['Checklist', c.site ?? 'all sites', c.frequency, c.status, `${c.title} · for ${c.target_role ?? '—'} · ${Array.isArray(c.items) ? c.items.length : 0} items${c.is_demo ? ' · demo' : ''}`]);
    }
    if (type === 'all' || type === 'ppm') {
      // PPM checklists / job templates are company-wide (not per site)
      const [ppm, tpl] = await Promise.all([
        loadAll<any>(ctx.sb, 'ops_asset_ppm_checklists', 'asset_category, checklist_name, frequency, parameters'),
        loadAll<any>(ctx.sb, 'checklist_templates', 'job_type, asset_category, version, is_active'),
      ]);
      const uniq = new Map(ppm.map(x => [`${x.asset_category}|${x.checklist_name}`, x])); // table holds duplicate seed rows
      const list = [...uniq.values()].filter(x => !args.asset || lc(x.asset_category).includes(lc(args.asset)) || lc(x.checklist_name).includes(lc(args.asset)));
      facts.ppm_checklists = { total: list.length, by_asset: countBy(list, x => x.asset_category ?? 'other'), job_templates_active: tpl.filter(t => t.is_active !== false).map(t => `${t.job_type}${t.asset_category ? ' · ' + t.asset_category : ''} v${t.version}`) };
      for (const x of list.slice(0, Math.max(0, MAX_ROWS - rows.length)))
        rows.push(['PPM checklist', 'all sites', x.frequency, null, `${x.checklist_name} (${x.asset_category}) · ${Array.isArray(x.parameters) ? x.parameters.length : 0} checks`]);
    }
    ctx.audit({ tool: 'get_audits', args, subjectSite: site, allowed: true });
    if (!rows.length) return { kind: 'answer', facts: { ...facts, note: 'No audits or checklists recorded for this selection.' }, sourceLabel: 'Audits & checklists' };
    return { kind: 'answer', facts, sourceLabel: `Audits & checklists${site ? ' · ' + site : ''}`, table: { columns: ['Type', 'Site', 'Date / frequency', 'Status', 'Detail'], rows: rows.slice(0, MAX_ROWS) } };
  }),
};

// ============================================================================ 10. get_gate_activity
const gateActivity: AssistTool = {
  name: 'get_gate_activity',
  description: 'GATE / community management at residential sites: visitor and delivery entries (who came, when, approved or not, still inside), staff gate-kiosk punches (face/passcode/QR), registered units and residents counts. E.g. "visitors at Kolte Patil I Towers today", "deliveries this week", "how many visitors are still inside", "gate attendance today". Not for employee attendance totals.',
  parameters: { type: 'object', properties: { ...SITE_PARAMS, ...PERIOD_PARAMS } },
  capability: 'ops',
  module: 'Gate',
  run: safeRun(async (ctx, args) => {
    const p = periodRange(args.period, args.start_date, args.end_date, ctx.now, 'today');
    const { startUtc, endUtc } = istBounds(p.from, p.to);
    const r = await refs(ctx.sb);
    const orgName = new Map(r.orgs.map(o => [o.id, o.short_name || o.full_name]));
    const locName = new Map(r.locations.map(l => [l.id, l.name]));
    const siteOf = (x: any) => (x.organization_id && orgName.get(x.organization_id)) || (x.location_id && locName.get(x.location_id)) || null;
    const [units, residents] = await Promise.all([
      loadAll<any>(ctx.sb, 'gate_units', 'organization_id, location_id'),
      loadAll<any>(ctx.sb, 'gate_residents', 'organization_id, active'), // never names/phones
    ]);
    const { data: entriesAll, error } = await ctx.sb.from('gate_entries')
      .select('organization_id, location_id, visitor_type, visitor_name, entry_gate_name, entry_time, exit_time, approval_status, is_pre_approved') // never visitor_phone / photos / vehicle
      .gte('entry_time', startUtc).lte('entry_time', endUtc).order('entry_time', { ascending: false }).limit(2000);
    if (error) throw new Error(error.message);
    const gateSites = [...new Set([...units, ...residents, ...(entriesAll ?? [])].map(siteOf).filter(Boolean))] as string[];
    const visSites = gateSites.filter(s => siteVisible(ctx, s));
    let site: string | null = null;
    if (args.site_name || args.site_exact) {
      const rs = await resolveSiteName(ctx, args, visSites, 'gate site');
      if (rs.ok === false) return rs.result;
      site = rs.site;
    }
    const inSel = (x: any) => { const s = siteOf(x); return !!s && siteVisible(ctx, s) && (!site || sameSite(s, site)); };
    const entries = (entriesAll ?? []).filter(inSel);
    // staff gate-kiosk punches: people filtered by scope (table has no site column)
    const { data: glogs } = await ctx.sb.from('gate_attendance_logs').select('user_id, method, marked_at, device_info').gte('marked_at', startUtc).lte('marked_at', endUtc).order('marked_at', { ascending: false }).limit(2000);
    const visLogs = site ? [] : (glogs ?? []).filter((g: any) => ctx.scope.canSeeUser(g.user_id));
    const names = await nameMapOf(ctx.sb);

    if (!visSites.length && !visLogs.length) return { kind: 'not_found', text: 'Gate management is not set up at any of the sites you have access to.' };
    let lastEntry: string | null = null;
    if (!entries.length) {
      const { data: last } = await ctx.sb.from('gate_entries').select('organization_id, location_id, entry_time').order('entry_time', { ascending: false }).limit(200);
      const l = (last ?? []).find(inSel);
      lastEntry = l ? `${prettyDate(istDate(l.entry_time))} ${istTime(l.entry_time)}` : null;
    }
    const facts: Record<string, any> = {
      period: p.label, site: site ?? (visSites.length ? visSites.join(', ') : 'none'),
      visitor_entries: entries.length, still_inside: entries.filter((e: any) => !e.exit_time).length,
      by_type: countBy(entries, (e: any) => e.visitor_type ?? 'other'), by_approval: countBy(entries, (e: any) => e.approval_status ?? 'unknown'),
      last_entry_recorded: entries.length ? undefined : lastEntry ?? 'none',
      registered_units: units.filter(inSel).length, active_residents: residents.filter(x => inSel(x) && x.active !== false).length,
    };
    if (!site) facts.staff_gate_punches = { total: visLogs.length, people: new Set(visLogs.map((g: any) => g.user_id)).size, by_method: countBy(visLogs, (g: any) => g.method ?? 'unknown') };
    ctx.audit({ tool: 'get_gate_activity', args, subjectSite: site, allowed: true });
    const rows: (string | number | null)[][] = [
      ...entries.slice(0, MAX_ROWS).map((e: any) => [`${prettyDate(istDate(e.entry_time))} ${istTime(e.entry_time)}`, 'Visitor', `${trunc(e.visitor_name ?? 'Visitor', 40)} (${e.visitor_type ?? '—'})`, siteOf(e), e.exit_time ? `out ${istTime(e.exit_time)}` : `inside · ${e.approval_status ?? ''}`]),
      ...visLogs.slice(0, Math.max(0, MAX_ROWS - entries.length)).map((g: any) => [`${prettyDate(istDate(g.marked_at))} ${istTime(g.marked_at)}`, 'Staff punch', names.get(g.user_id) ?? 'Unknown', null, `${g.method}${g.device_info?.action ? ' · ' + g.device_info.action : ''}`]),
    ];
    return {
      kind: 'answer', facts, sourceLabel: `Gate · ${p.single ? prettyDate(p.from) : p.label.replace(/\s*\(.*\)$/, '')}`,
      table: rows.length ? { columns: ['When (IST)', 'Type', 'Who', 'Site', 'Status'], rows } : undefined,
    };
  }),
};

// ============================================================================ 11. get_weather_alerts
const weatherAlerts: AssistTool = {
  name: 'get_weather_alerts',
  description: 'WEATHER alerts raised for Paradigm sites (rain, heat etc.) and the follow-up weather tasks (secure site, check drainage) with their status. E.g. "any rain alert for my sites", "weather alerts this week", "pending weather tasks at I Tower". Not for general weather forecasts of a city (that is a web question).',
  parameters: { type: 'object', properties: { ...SITE_PARAMS, ...PERIOD_PARAMS } },
  capability: null,
  module: 'Weather',
  run: safeRun(async (ctx, args) => {
    const p = periodRange(args.period, args.start_date, args.end_date, ctx.now, 'this_month');
    const { startUtc, endUtc } = istBounds(p.from, p.to);
    const r = await refs(ctx.sb);
    const locName = new Map(r.locations.map(l => [l.id, l.name]));
    const alertsAll = await loadAll<any>(ctx.sb, 'weather_alerts', 'id, site_id, city_name, latitude, longitude, alert_type, severity, title, message, timing, triggered_at, created_at');
    // alerts carry a free-text city_name (often a short site name like "I Tower") and coordinates: map to the nearest geofenced location within 1.5 km
    const nearest = (a: any) => {
      if (a.latitude == null || a.longitude == null) return null;
      let best: any = null, bd = Infinity;
      for (const l of r.locations) { if (l.latitude == null) continue; const d = distM(a.latitude, a.longitude, l.latitude, l.longitude); if (d < bd) { bd = d; best = l; } }
      return best && bd <= 1500 ? best : null;
    };
    const siteOf = (a: any) => (a.site_id && locName.get(a.site_id)) || a.city_name;
    const altOf = (a: any) => nearest(a);
    const vis = alertsAll.filter(a => siteVisible(ctx, siteOf(a), a.site_id) || (() => { const l = altOf(a); return !!l && (siteVisible(ctx, l.name, l.id) || [...(ctx.scope.siteNames === 'all' ? [] : ctx.scope.siteNames)].some(n => { const a = compact(l.name), b = compact(n); return Math.min(a.length, b.length) >= 6 && (a.includes(b) || b.includes(a)); })); })());
    if (!vis.length) return { kind: 'not_found', text: 'No weather alerts have been raised for the sites you have access to.' };
    let site: string | null = null;
    if (args.site_name || args.site_exact) {
      const rs = await resolveSiteName(ctx, args, vis.map(siteOf).filter(Boolean));
      if (rs.ok === false) return rs.result;
      site = rs.site;
    }
    const sel = vis.filter(a => !site || sameSite(siteOf(a), site));
    const inPeriod = sel.filter(a => { const t = a.triggered_at ?? a.created_at; return t >= startUtc && t <= endUtc; })
      .sort((a, b) => String(b.triggered_at ?? b.created_at).localeCompare(String(a.triggered_at ?? a.created_at)));
    const ids = inPeriod.map(a => a.id);
    const tasks = ids.length ? await loadIn<any>(ctx.sb, 'weather_tasks', 'alert_id, task_name, category, urgency, status, suggested_role, completed_at', 'alert_id', ids) : [];
    const latest = sel.map(a => a.triggered_at ?? a.created_at).sort().at(-1);
    const facts = {
      period: p.label, site: site ?? 'all sites in scope',
      alerts: inPeriod.length, by_severity: countBy(inPeriod, a => a.severity ?? 'unknown'),
      latest_alert_ever: inPeriod.length ? undefined : (latest ? prettyDate(istDate(latest)) : 'none'),
      tasks: { total: tasks.length, by_status: countBy(tasks, t => t.status ?? 'unknown'), open_high_urgency: tasks.filter(t => lc(t.status) !== 'completed' && lc(t.urgency) === 'high').length },
      alert_messages: inPeriod.slice(0, 5).map(a => `${siteOf(a)}: ${trunc(a.message, 120)}`),
    };
    ctx.audit({ tool: 'get_weather_alerts', args, subjectSite: site, allowed: true });
    const rows: (string | number | null)[][] = inPeriod.slice(0, 10).map(a => [prettyDate(istDate(a.triggered_at ?? a.created_at)), siteOf(a), a.severity, trunc(a.title, 50), `${tasks.filter(t => t.alert_id === a.id).length} task(s)`]);
    for (const t of tasks.slice(0, MAX_ROWS - rows.length)) rows.push([null, siteOf(inPeriod.find(a => a.id === t.alert_id)), t.urgency, `Task: ${trunc(t.task_name, 50)}`, `${t.status} · ${t.suggested_role ?? '—'}`]);
    return {
      kind: 'answer', facts, sourceLabel: `Weather alerts · ${p.label.replace(/\s*\(.*\)$/, '')}`,
      table: rows.length ? { columns: ['Date', 'Site', 'Severity / urgency', 'Alert / task', 'Detail'], rows } : undefined,
    };
  }),
};

export const opsTools: AssistTool[] = [
  attendanceExceptions, attendanceRequests, siteAttendanceToday, deviceStatus, siteInfo,
  tickets, escalationContacts, opsApprovals, audits, gateActivity, weatherAlerts,
];
