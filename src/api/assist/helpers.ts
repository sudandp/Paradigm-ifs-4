/**
 * Shared helpers for Paradigm Assist data tools: dates (IST), periods, person & site resolution with clarification.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssistCtx, ToolResult, ToolParamSchema } from './types.js';
import { ROLE_LABEL } from './roles.js';

// ------------------------------------------------------------------ data loading
/** Loads every row of a table (paged by 1000). Use only for small/medium tables (users, locations, matrix, finance trackers). */
export async function loadAll<T = any>(sb: SupabaseClient, table: string, cols: string, apply?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q: any = sb.from(table).select(cols);
    if (apply) q = apply(q);
    const { data, error } = await q.range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// ------------------------------------------------------------------ IST dates
export const IST_MS = 5.5 * 3600 * 1000;
/** 'YYYY-MM-DD' in IST for a timestamp. */
export const istDate = (ts: string | Date) => new Date(new Date(ts).getTime() + IST_MS).toISOString().slice(0, 10);
/** 'HH:MM' in IST. */
export const istTime = (ts: string | Date | null | undefined) => ts ? new Date(new Date(ts).getTime() + IST_MS).toISOString().slice(11, 16) : null;
/** UTC ISO bounds for an IST date range (inclusive). */
export const istBounds = (from: string, to: string) => ({
  startUtc: new Date(new Date(`${from}T00:00:00Z`).getTime() - IST_MS).toISOString(),
  endUtc: new Date(new Date(`${to}T23:59:59.999Z`).getTime() - IST_MS).toISOString(),
});
export const todayIst = (now = new Date()) => istDate(now);

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthLabel = (yyyyMmDd: string) => { const [y, m] = yyyyMmDd.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
export const prettyDate = (d: string | null | undefined) => d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null;

export type PeriodKey = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';
export const PERIOD_ENUM: PeriodKey[] = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'custom'];

/** Standard period parameters to spread into a tool's `parameters.properties`. */
export const PERIOD_PARAMS: ToolParamSchema['properties'] = {
  period: { type: 'string', enum: PERIOD_ENUM, description: 'Time period. Default this_month for counts, today for "now/present" questions. Use custom with start_date/end_date for explicit dates or a named month (e.g. "june" → custom 2026-06-01..2026-06-30).' },
  start_date: { type: 'string', description: 'YYYY-MM-DD (custom only)' },
  end_date: { type: 'string', description: 'YYYY-MM-DD (custom only)' },
};

export function periodRange(period: string | undefined, start?: string, end?: string, now = new Date(), fallback: PeriodKey = 'this_month') {
  const n = new Date(now.getTime() + IST_MS);
  const y = n.getUTCFullYear(), m = n.getUTCMonth(), dd = n.getUTCDate();
  const d = (yy: number, mm: number, day: number) => new Date(Date.UTC(yy, mm, day)).toISOString().slice(0, 10);
  const today = d(y, m, dd);
  const dow = (n.getUTCDay() + 6) % 7; // Monday = 0
  const p = (period || fallback) as PeriodKey;
  switch (p) {
    case 'today': return { from: today, to: today, label: `today (${prettyDate(today)})`, single: true };
    case 'yesterday': { const x = d(y, m, dd - 1); return { from: x, to: x, label: `yesterday (${prettyDate(x)})`, single: true }; }
    case 'this_week': return { from: d(y, m, dd - dow), to: today, label: `this week (${prettyDate(d(y, m, dd - dow))} – ${prettyDate(today)})`, single: false };
    case 'last_week': return { from: d(y, m, dd - dow - 7), to: d(y, m, dd - dow - 1), label: `last week (${prettyDate(d(y, m, dd - dow - 7))} – ${prettyDate(d(y, m, dd - dow - 1))})`, single: false };
    case 'last_month': return { from: d(y, m - 1, 1), to: d(y, m, 0), label: monthLabel(d(y, m - 1, 1)), single: false };
    case 'this_year': return { from: d(y, 0, 1), to: today, label: `${y} so far`, single: false };
    case 'custom':
      if (start) { const e = end || start; return { from: start, to: e, label: start === e ? prettyDate(start)! : `${prettyDate(start)} – ${prettyDate(e)}`, single: start === e }; }
    // fallthrough
    default: return { from: d(y, m, 1), to: today, label: `${monthLabel(d(y, m, 1))} (1st – ${prettyDate(today)})`, single: false };
  }
}

// ------------------------------------------------------------------ formatting
export const inr = (n: number | string | null | undefined) => n == null || n === '' ? null : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
/** "Swamy Vivekananda Road, ..., Bengaluru, 560066, India" → "Swamy Vivekananda Road, Bengaluru 560066" */
export function shortAddress(s: string | null | undefined) {
  if (!s) return s ?? null;
  const parts = s.split(',').map(x => x.trim()).filter(Boolean);
  if (parts.length <= 3) return s;
  const pin = parts.find(p => /^\d{6}$/.test(p));
  const city = parts.find(p => /bengaluru|bangalore|hyderabad|pune|chennai|mumbai/i.test(p)) ?? parts[parts.length - 3];
  return `${parts[0]}, ${city}${pin ? ' ' + pin : ''}`;
}

// ------------------------------------------------------------------ person resolution
export interface PersonRow { id: string; name: string; email: string | null; role_id: string; location_id: string | null; status: string | null; phone?: string | null; reporting_manager_id?: string | null }

let peopleCache: { at: number; rows: PersonRow[]; sites: Map<string, string> } | null = null;
export async function peopleDirectory(sb: SupabaseClient) {
  if (peopleCache && Date.now() - peopleCache.at < 5 * 60_000) return peopleCache;
  const [rows, locs] = await Promise.all([
    loadAll<PersonRow>(sb, 'users', 'id, name, email, role_id, location_id, status, phone, reporting_manager_id'),
    loadAll<any>(sb, 'locations', 'id, name'),
  ]);
  peopleCache = { at: Date.now(), rows, sites: new Map(locs.map(l => [l.id, l.name])) };
  return peopleCache;
}

/** Standard person params to spread into a tool's `parameters.properties`. */
export const PERSON_PARAMS: ToolParamSchema['properties'] = {
  person_name: { type: 'string', description: 'Employee name exactly as the user wrote it (e.g. "kavya"). Leave empty when the user asks about themself (I / me / my).' },
  about_self: { type: 'boolean', description: 'true when the user asks about themself.' },
  person_id: { type: 'string', description: 'Internal id. NEVER set this yourself; it is filled by the system after the user picks a person.' },
};

/**
 * Resolves the target person INSIDE the asker's scope.
 * - person_id given (from a clarification click) → re-checked against scope.
 * - about_self / no name → the asker.
 * - several visible matches → clarify (options re-run the same tool with person_id).
 * - zero visible matches → not_found (never reveals people outside scope).
 */
export async function resolvePerson(ctx: AssistCtx, args: Record<string, any>):
  Promise<{ ok: true; person: PersonRow; siteName: string | null } | { ok: false; result: ToolResult }> {
  const dir = await peopleDirectory(ctx.sb);
  const siteOf = (p: PersonRow) => (p.location_id && dir.sites.get(p.location_id)) || null;

  if (args.person_id) {
    const p = dir.rows.find(r => r.id === args.person_id);
    if (!p || !ctx.scope.canSeeUser(p.id)) return { ok: false, result: { kind: 'denied', text: "You don't have access to this employee's records." } };
    return { ok: true, person: p, siteName: siteOf(p) };
  }
  const selfWords = /^(i|me|my|myself|mine|self)$/i;
  if (args.about_self || !args.person_name || selfWords.test(String(args.person_name).trim())) {
    const p = dir.rows.find(r => r.id === ctx.asker.id);
    if (!p) return { ok: false, result: { kind: 'not_found', text: 'Your employee profile was not found.' } };
    return { ok: true, person: p, siteName: siteOf(p) };
  }

  const words = String(args.person_name).toLowerCase().replace(/[^a-z0-9\s.]/g, ' ').split(/\s+/).filter(Boolean);
  const matches = dir.rows.filter(r => r.name && words.every(w => r.name.toLowerCase().includes(w)));
  const visible = matches.filter(r => ctx.scope.canSeeUser(r.id));
  if (!visible.length) {
    return { ok: false, result: ctx.scope.level === 'self'
      ? { kind: 'denied', text: 'You can only view your own records.' }
      : { kind: 'not_found', text: `I couldn't find anyone named "${args.person_name}" in ${ctx.scope.level === 'all' ? 'the employee list' : 'your team or sites'}.` } };
  }
  // prefer active employees when an exact full-name match exists
  const exact = visible.filter(r => r.name.toLowerCase().trim() === words.join(' '));
  if (exact.length === 1) return { ok: true, person: exact[0], siteName: siteOf(exact[0]) };
  if (visible.length === 1) return { ok: true, person: visible[0], siteName: siteOf(visible[0]) };
  return { ok: false, result: {
    kind: 'clarify',
    question: `Which ${args.person_name} do you mean?`,
    options: visible.slice(0, 8).map(r => ({
      label: r.name,
      sublabel: [ROLE_LABEL(r.role_id), siteOf(r), r.status && r.status !== 'active' ? r.status : null].filter(Boolean).join(' · '),
      args: { ...args, person_id: r.id },
    })),
  } };
}

// ------------------------------------------------------------------ site resolution
/** Standard site params. */
export const SITE_PARAMS: ToolParamSchema['properties'] = {
  site_name: { type: 'string', description: 'Client site name as the user wrote it (e.g. "nikoo home"). Empty if not mentioned.' },
  site_exact: { type: 'string', description: 'NEVER set this yourself; filled by the system after the user picks a site.' },
};

/**
 * Picks one site name out of `candidates` (distinct names that exist in the target table),
 * already filtered by the caller to what the asker may see.
 * - site_exact (from a click) must be in candidates.
 * - fuzzy word match; several → clarify; none → not_found.
 * - no site_name: if `ctx.selectedSiteId` maps to a candidate use it, else return null so the tool can decide (e.g. all sites).
 */
export async function resolveSiteName(ctx: AssistCtx, args: Record<string, any>, candidates: string[], noun = 'site'):
  Promise<{ ok: true; site: string | null } | { ok: false; result: ToolResult }> {
  const uniq = [...new Set(candidates.filter(Boolean))].sort();
  if (args.site_exact) {
    return uniq.includes(args.site_exact) ? { ok: true, site: args.site_exact }
      : { ok: false, result: { kind: 'denied', text: "You don't have access to that site's data." } };
  }
  if (!args.site_name) {
    if (ctx.selectedSiteId) {
      const dir = await peopleDirectory(ctx.sb);
      const sel = dir.sites.get(ctx.selectedSiteId);
      const hit = sel && uniq.find(u => u.toLowerCase() === sel.toLowerCase());
      if (hit) return { ok: true, site: hit };
    }
    return { ok: true, site: null };
  }
  const words = String(args.site_name).toLowerCase().replace(/homes?\b/g, 'home').split(/\s+/).filter(w => w.length > 1);
  const matches = uniq.filter(s => { const l = s.toLowerCase(); return words.every(w => l.includes(w)); });
  if (!matches.length) return { ok: false, result: { kind: 'not_found', text: `I couldn't find a ${noun} matching "${args.site_name}" among the sites you have access to.` } };
  const exact = matches.find(s => s.toLowerCase() === String(args.site_name).toLowerCase().trim());
  if (exact || matches.length === 1) return { ok: true, site: exact ?? matches[0] };
  return { ok: false, result: {
    kind: 'clarify', question: `Which "${args.site_name}" ${noun} do you mean?`,
    options: matches.slice(0, 8).map(s => ({ label: s, args: { ...args, site_exact: s } })),
  } };
}

/** Wraps a run function so DB errors become a friendly not_found instead of a 500. */
export function safeRun(fn: (ctx: AssistCtx, args: any) => Promise<ToolResult>) {
  return async (ctx: AssistCtx, args: any): Promise<ToolResult> => {
    try { return await fn(ctx, args); }
    catch (e: any) { console.warn('[Assist tool] error:', e?.message); return { kind: 'not_found', text: 'I could not read that data right now. Please try again in a moment.' }; }
  };
}
