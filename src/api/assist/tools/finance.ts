/** Billing extras, CRM, communication logs, audit trail, site summary — owned by the FINANCE/CRM agent */
import type { AssistCtx, AssistTool, ToolResult } from '../types.js';
import { ADMIN_ROLES } from '../roles.js';
import {
  loadAll, inr, monthLabel, istBounds, istDate, istTime, prettyDate, todayIst, periodRange,
  PERIOD_PARAMS, PERSON_PARAMS, SITE_PARAMS, resolvePerson, resolveSiteName, safeRun, peopleDirectory,
} from '../helpers.js';

// =====================================================================================================
// shared helpers
// =====================================================================================================
const norm = (s: any) => String(s ?? '').toLowerCase().trim();
const clip = (s: any, n = 80) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const ym = (d: string) => d.slice(0, 7);
const ymLabel = (m: string) => monthLabel(`${m}-01`);
const money = (n: number) => (n < 0 ? '-' + inr(-n) : inr(n));
const num = (v: any) => (v == null || v === '' || isNaN(Number(v)) ? 0 : Number(v));
const tally = <T>(rows: T[], key: (r: T) => string) => {
  const m: Record<string, number> = {};
  rows.forEach(r => { const k = key(r); m[k] = (m[k] || 0) + 1; });
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) / 86_400_000);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Mirrors services/siteRoutingScope.ts → normalizeCompanyShortName (simplified). Numeric junk → null. */
function companyShort(raw: any): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const c = String(raw).trim().toUpperCase();
  if (/^\d+(\.\d+)?$/.test(c)) return null; // bad import (contract value typed into company column)
  const sw = c.includes('SWLLP') || c.includes('SOUTHWALL') || c.includes('SWIFT WING') || /\bSW\b/.test(c);
  const pifs = c.includes('PIFS') || c.includes('PARADIGM INTEGRATED');
  const ppfms = c.includes('PPFMS') || c.includes('PARADIGM PROPERTY');
  if (pifs && sw) return 'PIFS & SWLLP';
  if (ppfms && sw) return 'PPFMS & SWLLP';
  if (pifs && ppfms) return 'PIFS & PPFMS';
  if (sw) return 'SWLLP';
  if (ppfms) return 'PPFMS';
  if (pifs || c.includes('PARADIGM')) return 'PIFS';
  return String(raw).trim();
}
const companyMatches = (rowCompany: string | null, filter?: string) => {
  if (!filter) return true;
  const f = companyShort(filter) ?? filter.toUpperCase();
  return !!rowCompany && (rowCompany === f || rowCompany.toUpperCase().includes(String(filter).toUpperCase()));
};

/** Ops in-charge names are free text in the invoice tracker ("Isaac", "Issac", "ISSac", "Shilpa M"). Mirrors getCleanRoot in pages/billing/SiteAttendanceTracker.tsx. */
const personRoot = (s: any) => norm(s).replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)[0]?.replace(/^issac$/, 'isaac').replace(/^muruli$/, 'murali').replace(/^pradeepp$/, 'pradeep') ?? '';
const inchargeMatches = (raw: any, filter?: string) => !filter || (!!raw && (personRoot(raw) === personRoot(filter) || norm(raw).includes(norm(filter))));

const cycleMatches = (raw: any, filter?: string) => {
  if (!filter) return true;
  const d = (s: any) => (String(s ?? '').match(/(\d)/) ?? [])[1];
  return !!raw && d(raw) === d(filter);
};

const MONTH_PARAMS: Record<string, any> = {
  month: { type: 'integer', description: 'Billing month number 1-12 when the user names a month ("october" → 10). Omit otherwise.' },
  year: { type: 'integer', description: 'Year, only if the user says it (e.g. 2026).' },
  ...PERIOD_PARAMS,
};

/**
 * Billing months the user asked for (as 'YYYY-MM').
 * month/year → that month (a month later than the current one with no year means last year);
 * period → every month it touches; nothing → the latest month that has data (defaulted = true).
 */
function billingMonths(ctx: AssistCtx, args: any, available: string[]): { months: string[]; label: string; defaulted: boolean } {
  const today = todayIst(ctx.now);
  const cy = Number(today.slice(0, 4)), cm = Number(today.slice(5, 7));
  if (args.month >= 1 && args.month <= 12) {
    const m = Number(args.month);
    const y = Number(args.year) || (m > cm ? cy - 1 : cy);
    const k = `${y}-${String(m).padStart(2, '0')}`;
    return { months: [k], label: ymLabel(k), defaulted: false };
  }
  if (args.year && !args.period) {
    const months = Array.from({ length: 12 }, (_, i) => `${args.year}-${String(i + 1).padStart(2, '0')}`);
    return { months, label: String(args.year), defaulted: false };
  }
  if (args.period) {
    const p = periodRange(args.period, args.start_date, args.end_date, ctx.now);
    const months: string[] = [];
    let y = Number(p.from.slice(0, 4)), m = Number(p.from.slice(5, 7));
    const endK = ym(p.to);
    for (let i = 0; i < 60; i++) {
      const k = `${y}-${String(m).padStart(2, '0')}`;
      months.push(k);
      if (k >= endK) break;
      m++; if (m > 12) { m = 1; y++; }
    }
    const label = months.length === 1 ? ymLabel(months[0]) : `${ymLabel(months[0])} – ${ymLabel(months[months.length - 1])}`;
    return { months, label, defaulted: false };
  }
  const latest = [...available].sort().pop();
  return { months: latest ? [latest] : [], label: latest ? ymLabel(latest) : 'latest month', defaulted: true };
}

// -------------------------------------------------------------------- finance data loaders (scoped)
interface FinRow { site_name: string; company_name: string | null; billing_month: string; contract_amount: number | null; contract_management_fee: number | null; billed_amount: number | null; billed_management_fee: number | null; total_billed_amount: number | null; status: string | null; remarks: string | null; created_by_name?: string | null; updated_by_name?: string | null; updated_at?: string | null; created_at?: string | null }
interface InvRow { site_name: string; company_name: string | null; billing_cycle: string | null; manager_tentative_date: string | null; manager_received_date: string | null; hr_tentative_date: string | null; hr_received_date: string | null; invoice_sharing_tentative_date: string | null; invoice_prepared_date: string | null; invoice_sent_date: string | null; ops_incharge: string | null; hr_incharge: string | null; invoice_incharge: string | null; created_at: string; created_by_name?: string | null; updated_at?: string | null }

/** Scoped, de-duplicated billing rows. The tracker has exact duplicate site+month rows from a bad import
 *  (June 2026: company column holds the contract value) → keep one per site+month (approved first, then newest).
 *  Missing/invalid company → site_invoice_defaults.company_name, else matrix billing_company. */
async function loadFinance(ctx: AssistCtx): Promise<FinRow[] & { dupKeys?: Map<string, number> }> {
  const [rows, defs, mx] = await Promise.all([
    loadAll<FinRow>(ctx.sb, 'site_finance_tracker', 'site_name, company_name, billing_month, contract_amount, contract_management_fee, billed_amount, billed_management_fee, total_billed_amount, status, remarks, created_at, updated_at', q => q.is('deleted_at', null)),
    loadAll<any>(ctx.sb, 'site_invoice_defaults', 'site_name, company_name'),
    loadAll<any>(ctx.sb, 'site_responsibility_matrix', 'site_name, billing_company'),
  ]);
  const coFallback = new Map<string, string>();
  mx.forEach(m => { const c = companyShort(m.billing_company); if (c && m.site_name) coFallback.set(norm(m.site_name), c); });
  defs.forEach(d => { const c = companyShort(d.company_name); if (c && d.site_name) coFallback.set(norm(d.site_name), c); });
  const best = new Map<string, FinRow>();
  const dupKeys = new Map<string, number>();
  const rank = (r: FinRow) => `${norm(r.status) === 'approved' ? 1 : 0}${r.updated_at || r.created_at || ''}`;
  for (const r of rows) {
    if (!r.site_name || !ctx.scope.canSeeFinanceSite(r.site_name)) continue;
    const k = `${norm(r.site_name)}|${r.billing_month}`;
    const cur = best.get(k);
    if (cur) dupKeys.set(k, (dupKeys.get(k) ?? 0) + 1);
    if (!cur || rank(r) > rank(cur)) best.set(k, r);
  }
  const out = [...best.values()].map(r => ({ ...r, company_name: companyShort(r.company_name) ?? coFallback.get(norm(r.site_name)) ?? null })) as FinRow[] & { dupKeys?: Map<string, number> };
  out.dupKeys = dupKeys;
  return out;
}
async function loadInvoices(ctx: AssistCtx): Promise<(InvRow & { bmonth: string })[]> {
  const rows = await loadAll<InvRow>(ctx.sb, 'site_invoice_tracker', 'site_name, company_name, billing_cycle, manager_tentative_date, manager_received_date, hr_tentative_date, hr_received_date, invoice_sharing_tentative_date, invoice_prepared_date, invoice_sent_date, ops_incharge, hr_incharge, invoice_incharge, created_at', q => q.is('deleted_at', null));
  // billing month: same rule as services/api.ts getSiteInvoiceRecords (managerTentativeDate || invoiceSharingTentativeDate || createdAt)
  return rows.filter(r => r.site_name && ctx.scope.canSeeFinanceSite(r.site_name))
    .map(r => ({ ...r, bmonth: ym(r.manager_tentative_date || r.invoice_sharing_tentative_date || r.created_at) }));
}
/** Total billed = total_billed_amount, else billed + billed fee (pages/finance/SiteFinanceTracker.tsx). Contract = amount + fee. */
const billedOf = (r: FinRow) => r.total_billed_amount != null ? num(r.total_billed_amount) : num(r.billed_amount) + num(r.billed_management_fee);
const contractOf = (r: FinRow) => num(r.contract_amount) + num(r.contract_management_fee);

const financeDenied = (ctx: AssistCtx): ToolResult | null => {
  const f = ctx.scope.financeSiteNames;
  if (!ctx.scope.can('finance') || (f !== 'all' && f.size === 0))
    return { kind: 'denied', text: 'Billing and invoice data is limited to Finance, Admin and the site\'s Operations Manager.' };
  return null;
};

// =====================================================================================================
// 1. list_invoice_status
// =====================================================================================================
const listInvoiceStatus: AssistTool = {
  name: 'list_invoice_status',
  module: 'Billing',
  capability: 'finance',
  description: 'Invoice PROCESS status across many sites for a billing month: which invoices are not yet sent / sent / sent late / overdue, which sites\' attendance is still pending from the manager or HR, optionally filtered by company (PIFS, SWLLP, PPFMS), billing cycle or ops in-charge. E.g. "invoices not yet sent for October", "which sites attendance is pending for billing", "invoices sent late in July", "Isaac\'s sites invoice status". Not for one site\'s invoice value (use get_site_invoice) or money totals (use get_billing_totals).',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['not_sent', 'sent', 'sent_late', 'overdue', 'attendance_pending', 'all'], description: 'Which invoices to list. overdue = not sent and sharing due date passed; attendance_pending = manager or HR attendance not yet received. Default all.' },
      company: { type: 'string', description: 'Billing company short name if mentioned: PIFS, SWLLP, PPFMS.' },
      billing_cycle: { type: 'string', description: '"1st", "2nd" or "3rd" billing cycle if mentioned.' },
      ops_incharge: { type: 'string', description: 'Operations in-charge name if the user filters by it (e.g. "isaac").' },
      ...MONTH_PARAMS,
      ...SITE_PARAMS,
    },
  },
  run: safeRun(async (ctx, args) => {
    const d = financeDenied(ctx); if (d) return d;
    const inv = await loadInvoices(ctx);
    let rows = inv;
    if (args.site_name || args.site_exact) {
      const r = await resolveSiteName(ctx, args, inv.map(x => x.site_name));
      if (r.ok === false) return r.result;
      if (r.site) rows = rows.filter(x => x.site_name === r.site);
    }
    const { months, label, defaulted } = billingMonths(ctx, args, inv.map(r => r.bmonth));
    const latest = [...new Set(inv.map(r => r.bmonth))].sort().pop();
    rows = rows.filter(r => months.includes(r.bmonth) && companyMatches(companyShort(r.company_name), args.company)
      && cycleMatches(r.billing_cycle, args.billing_cycle) && inchargeMatches(r.ops_incharge, args.ops_incharge));

    const today = todayIst(ctx.now);
    const isSent = (r: InvRow) => !!r.invoice_sent_date;
    const sharingDelay = (r: InvRow) => r.invoice_sent_date && r.invoice_sharing_tentative_date ? daysBetween(r.invoice_sent_date, r.invoice_sharing_tentative_date) : null;
    const isLate = (r: InvRow) => (sharingDelay(r) ?? 0) > 0;
    const isOverdue = (r: InvRow) => !isSent(r) && !!r.invoice_sharing_tentative_date && r.invoice_sharing_tentative_date.slice(0, 10) <= today;
    const attPending = (r: InvRow) => !isSent(r) && (!r.manager_received_date || !r.hr_received_date);

    // expected sites (site_invoice_defaults) that have no tracker entry for a single requested month
    let missing: string[] = [];
    if (months.length === 1 && !args.site_name && !args.site_exact) {
      const defs = await loadAll<any>(ctx.sb, 'site_invoice_defaults', 'site_name, company_name, billing_cycle, ops_incharge');
      const have = new Set(inv.filter(r => r.bmonth === months[0]).map(r => norm(r.site_name)));
      missing = defs.filter(x => x.site_name && ctx.scope.canSeeFinanceSite(x.site_name) && !have.has(norm(x.site_name))
        && companyMatches(companyShort(x.company_name), args.company) && cycleMatches(x.billing_cycle, args.billing_cycle) && inchargeMatches(x.ops_incharge, args.ops_incharge))
        .map(x => x.site_name).sort();
    }

    const status = args.status || 'all';
    const pick = { not_sent: (r: InvRow) => !isSent(r), sent: isSent, sent_late: isLate, overdue: isOverdue, attendance_pending: attPending, all: () => true }[status as string] ?? (() => true);
    const listed = rows.filter(pick).sort((a, b) => a.site_name.localeCompare(b.site_name));

    if (!rows.length && !missing.length) {
      return { kind: 'not_found', text: `No invoice-tracker entries for ${label}${args.company ? ` (${args.company})` : ''} among the sites you can access.${latest ? ` The latest billing month on record is ${ymLabel(latest)}.` : ''}` };
    }

    const facts: Record<string, any> = {
      billing_month: label,
      ...(defaulted ? { note: 'No month was given, so the latest billing month on record is used.' } : {}),
      filters: { status, company: args.company || 'all', billing_cycle: args.billing_cycle || 'all', ops_incharge: args.ops_incharge || 'all' },
      sites_in_tracker: rows.length,
      sent: rows.filter(isSent).length,
      not_sent: rows.filter(r => !isSent(r)).length,
      overdue_not_sent: rows.filter(isOverdue).length,
      sent_late: rows.filter(isLate).length,
      attendance_pending: rows.filter(attPending).length,
      by_company: Object.fromEntries(Object.entries(tally(rows, r => companyShort(r.company_name) ?? 'Unspecified')).map(([k, n]) => [k, { sites: n, sent: rows.filter(r => (companyShort(r.company_name) ?? 'Unspecified') === k && isSent(r)).length }])),
      [`${status}_count`]: listed.length,
      [`${status}_sites`]: listed.slice(0, 25).map(r => r.site_name),
      ...(listed.length > 25 ? { more_not_listed: listed.length - 25 } : {}),
      ...(missing.length && ['all', 'not_sent', 'attendance_pending'].includes(status)
        ? { not_sent_including_sites_with_no_entry: rows.filter(r => !isSent(r)).length + missing.length, expected_sites_with_no_tracker_entry_yet: missing.length, no_entry_examples: missing.slice(0, 15), no_entry_meaning: 'site has invoice defaults but nothing was entered in the invoice tracker for this month (process not started / not sent)' } : {}),
      access: ctx.scope.financeSiteNames === 'all' ? 'all sites' : `only your ${ctx.scope.financeSiteNames.size} Responsibility-Matrix site(s)`,
    };
    return {
      kind: 'answer', facts, sourceLabel: `Billing · Invoice tracker · ${label}`,
      table: {
        columns: ['Site', 'Company', 'Cycle', 'Ops in-charge', 'Mgr attendance', 'HR attendance', 'Prepared', 'Sent', 'Sharing delay'],
        rows: listed.slice(0, 25).map(r => [r.site_name, companyShort(r.company_name), r.billing_cycle, r.ops_incharge, prettyDate(r.manager_received_date) ?? 'pending', prettyDate(r.hr_received_date) ?? 'pending', prettyDate(r.invoice_prepared_date), prettyDate(r.invoice_sent_date) ?? (isOverdue(r) ? 'NOT SENT (overdue)' : 'not sent'), sharingDelay(r) == null ? null : `${sharingDelay(r)}d`]),
      },
    };
  }),
};

// =====================================================================================================
// 2. get_billing_totals
// =====================================================================================================
const getBillingTotals: AssistTool = {
  name: 'get_billing_totals',
  module: 'Billing',
  capability: 'finance',
  description: 'Money totals and trends from the billing (finance) tracker: total billed / contract value for a month, year or range, grouped by company, site or month, top N sites, contract-vs-billed difference (profit/loss), approval status, and month-over-month trend for one site. E.g. "total billed in June", "billing by company this year", "top 10 sites by billed amount", "contract vs billed difference", "how did Nikoo billing change month to month". Not for invoice sent/pending status (use list_invoice_status) or a single site-month value (use get_site_invoice).',
  parameters: {
    type: 'object',
    properties: {
      group_by: { type: 'string', enum: ['none', 'company', 'site', 'month', 'status'], description: 'Breakdown. "by company" → company, "top sites" → site, trend → month. Default none (or month when a site is given).' },
      top_n: { type: 'integer', description: 'How many rows for top lists (default 10, max 25).' },
      sort_by: { type: 'string', enum: ['billed', 'contract', 'difference'], description: 'Sort for site lists. difference = billed minus contract (use for "most under-billed"/"loss" asks with ascending=true).' },
      ascending: { type: 'boolean', description: 'true for lowest first (e.g. biggest loss).' },
      company: { type: 'string', description: 'PIFS / SWLLP / PPFMS filter if mentioned.' },
      approval_status: { type: 'string', enum: ['pending', 'approved', 'rejected'], description: 'Only records with this approval status.' },
      ...MONTH_PARAMS,
      ...SITE_PARAMS,
    },
  },
  run: safeRun(async (ctx, args) => {
    const d = financeDenied(ctx); if (d) return d;
    const fin = await loadFinance(ctx);
    let rows = fin;
    let site: string | null = null;
    if (args.site_name || args.site_exact) {
      const r = await resolveSiteName(ctx, args, fin.map(x => x.site_name));
      if (r.ok === false) return r.result;
      site = r.site;
      if (site) rows = rows.filter(x => x.site_name === site);
    }
    const available = rows.map(r => ym(r.billing_month));
    // a single site with no month → whole history (trend)
    const sel = site && !args.month && !args.period && !args.year
      ? { months: [...new Set(available)].sort(), label: 'all months on record', defaulted: false }
      : billingMonths(ctx, args, available);
    const latest = [...new Set(available)].sort().pop();
    rows = rows.filter(r => sel.months.includes(ym(r.billing_month)) && companyMatches(companyShort(r.company_name), args.company) && (!args.approval_status || norm(r.status) === args.approval_status));
    if (!rows.length) {
      return { kind: 'not_found', text: `No billing records for ${site ? site + ' · ' : ''}${sel.label}${args.company ? ` (${args.company})` : ''} among the sites you can access.${latest ? ` The latest billing month on record is ${ymLabel(latest)}.` : ''}` };
    }
    const sum = (rs: FinRow[]) => {
      const billed = rs.reduce((s, r) => s + billedOf(r), 0), contract = rs.reduce((s, r) => s + contractOf(r), 0);
      return { billed, contract, diff: billed - contract };
    };
    const t = sum(rows);
    const facts: Record<string, any> = {
      period: sel.label,
      ...(sel.defaulted ? { note: 'No month was given, so the latest billing month on record is used.' } : {}),
      ...(site ? { site } : {}),
      records: rows.length,
      sites: new Set(rows.map(r => r.site_name)).size,
      total_billed: money(t.billed),
      total_contract_value: money(t.contract),
      billed_minus_contract: money(t.diff),
      overall: t.diff >= 0 ? 'billed at or above contract' : 'billed below contract',
      approval_status: tally(rows, r => r.status || 'unknown'),
      access: ctx.scope.financeSiteNames === 'all' ? 'all sites' : `only your ${ctx.scope.financeSiteNames.size} Responsibility-Matrix site(s)`,
    };
    const unknownCo = rows.filter(r => !companyShort(r.company_name)).length;
    if (unknownCo) facts.records_with_unknown_company = unknownCo;
    const dups = rows.reduce((n, r) => n + (fin.dupKeys?.get(`${norm(r.site_name)}|${r.billing_month}`) ?? 0), 0);
    if (dups) facts.duplicate_tracker_rows_ignored = `${dups} (same site + month entered twice; counted once)`;

    const groupBy = args.group_by && args.group_by !== 'none' ? args.group_by : (site || sel.months.length > 1 ? 'month' : 'none');
    let table: { columns: string[]; rows: (string | number | null)[][] } | undefined;
    const n = Math.min(Math.max(Number(args.top_n) || 10, 1), 25);

    if (groupBy === 'company' || groupBy === 'status') {
      const key = (r: FinRow) => groupBy === 'company' ? (companyShort(r.company_name) ?? 'Unspecified') : (r.status || 'unknown');
      const groups = [...new Set(rows.map(key))].map(k => { const rs = rows.filter(r => key(r) === k); return { k, n: new Set(rs.map(r => r.site_name)).size, ...sum(rs) }; }).sort((a, b) => b.billed - a.billed);
      facts[`by_${groupBy}`] = groups.map(g => ({ [groupBy]: g.k, sites: g.n, billed: money(g.billed), contract: money(g.contract), difference: money(g.diff) }));
      table = { columns: [groupBy === 'company' ? 'Company' : 'Approval status', 'Sites', 'Billed', 'Contract', 'Difference'], rows: groups.map(g => [g.k, g.n, money(g.billed), money(g.contract), money(g.diff)]) };
    } else if (groupBy === 'site') {
      const sites = [...new Set(rows.map(r => r.site_name))].map(k => { const rs = rows.filter(r => r.site_name === k); return { k, co: companyShort(rs[0].company_name), months: rs.length, ...sum(rs) }; });
      const sk = args.sort_by === 'contract' ? 'contract' : args.sort_by === 'difference' ? 'diff' : 'billed';
      sites.sort((a, b) => args.ascending ? (a as any)[sk] - (b as any)[sk] : (b as any)[sk] - (a as any)[sk]);
      const top = sites.slice(0, n);
      facts.ranking = `${args.ascending ? 'lowest' : 'top'} ${top.length} of ${sites.length} sites by ${args.sort_by || 'billed'}`;
      facts.sites_ranked = top.map((s, i) => ({ rank: i + 1, site: s.k, billed: money(s.billed), contract: money(s.contract), difference: money(s.diff) }));
      table = { columns: ['#', 'Site', 'Company', 'Billed', 'Contract', 'Difference'], rows: top.map((s, i) => [i + 1, s.k, s.co, money(s.billed), money(s.contract), money(s.diff)]) };
    } else if (groupBy === 'month') {
      const ms = [...new Set(rows.map(r => ym(r.billing_month)))].sort();
      let prev: number | null = null;
      const series = ms.map(m => {
        const s = sum(rows.filter(r => ym(r.billing_month) === m));
        const change = prev == null ? null : s.billed - prev;
        const pct = prev ? Math.round((change! / prev) * 1000) / 10 : null;
        prev = s.billed;
        return { m, ...s, change, pct, sites: new Set(rows.filter(r => ym(r.billing_month) === m).map(r => r.site_name)).size };
      });
      facts.by_month = series.slice(-25).map(x => ({ month: ymLabel(x.m), billed: money(x.billed), contract: money(x.contract), change_vs_previous_month: x.change == null ? null : `${x.change >= 0 ? '+' : ''}${money(x.change)}${x.pct != null ? ` (${x.pct >= 0 ? '+' : ''}${x.pct}%)` : ''}` }));
      if (site) {
        const last = rows.slice().sort((a, b) => b.billing_month.localeCompare(a.billing_month))[0];
        facts.latest_month = { month: ymLabel(ym(last.billing_month)), billed: money(billedOf(last)), status: last.status, remarks: last.remarks ? clip(last.remarks) : null };
      }
      table = { columns: ['Month', ...(site ? [] : ['Sites']), 'Billed', 'Contract', 'Difference', 'Change vs prev'], rows: series.slice(-25).map(x => [ymLabel(x.m), ...(site ? [] : [x.sites]), money(x.billed), money(x.contract), money(x.diff), x.change == null ? null : `${x.change >= 0 ? '+' : ''}${money(x.change)}`]) };
    }
    return { kind: 'answer', facts, sourceLabel: `Billing · ${site ? site + ' · ' : ''}${sel.label}`, ...(table ? { table } : {}) };
  }),
};

// =====================================================================================================
// CRM scoping: admins + client-partnership head see all; other CRM roles see leads assigned to / created by them
// =====================================================================================================
const CRM_ALL = new Set([...ADMIN_ROLES, 'senior_manager_–_client_partnerships']);
const crmSeesAll = (ctx: AssistCtx) => CRM_ALL.has(ctx.asker.role_id);
const CLOSED_STAGES = new Set(['won', 'lost']);

async function ownerFilter(ctx: AssistCtx, ownerName?: string): Promise<{ ok: true; ownerId: string | null; ownerLabel: string | null } | { ok: false; result: ToolResult }> {
  if (!ownerName) return { ok: true, ownerId: crmSeesAll(ctx) ? null : ctx.asker.id, ownerLabel: crmSeesAll(ctx) ? null : ctx.asker.name };
  if (!crmSeesAll(ctx)) {
    if (/^(i|me|my|mine|myself)$/i.test(ownerName.trim()) || norm(ctx.asker.name).includes(norm(ownerName))) return { ok: true, ownerId: ctx.asker.id, ownerLabel: ctx.asker.name };
    return { ok: false, result: { kind: 'denied', text: 'You can only view your own leads and follow-ups.' } };
  }
  const r = await resolvePerson(ctx, { person_name: ownerName, person_id: undefined });
  if (r.ok === false) return { ok: false, result: r.result };
  return { ok: true, ownerId: r.person.id, ownerLabel: r.person.name };
}

// =====================================================================================================
// 3. get_crm_pipeline
// =====================================================================================================
const getCrmPipeline: AssistTool = {
  name: 'get_crm_pipeline',
  module: 'CRM',
  capability: 'crm',
  description: 'Sales pipeline from CRM: leads by stage (New Lead, Contacted, Site Visit Planned, Proposal Sent, Negotiation, Won, Lost) and owner, won/lost conversion, quotations and business referrals. E.g. "leads in proposal stage", "how many leads did we win this year", "conversion rate", "Nakul\'s open leads", "pending quotations". Not for follow-up due dates (use get_crm_followups).',
  parameters: {
    type: 'object',
    properties: {
      stage: { type: 'string', description: 'Lead stage words as the user wrote them (e.g. "negotiation", "proposal", "won", "lost", "open"). Empty for all.' },
      owner_name: { type: 'string', description: 'Sales owner (assigned BD person) if the user names one; "me" for own leads.' },
      client_name: { type: 'string', description: 'A specific lead / client / community name if asked.' },
      period: { type: 'string', enum: ['this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'custom'], description: 'Only leads CREATED in this period (or moved to their stage in it). Omit for all time.' },
      start_date: { type: 'string', description: 'YYYY-MM-DD (custom only)' },
      end_date: { type: 'string', description: 'YYYY-MM-DD (custom only)' },
    },
  },
  run: safeRun(async (ctx, args) => {
    const own = await ownerFilter(ctx, args.owner_name); if (own.ok === false) return own.result;
    const [leads, quotes, refs, dir] = await Promise.all([
      loadAll<any>(ctx.sb, 'crm_leads', 'id, client_name, association_name, status, assigned_to, created_by, source, property_type, city, location, unit_count, deal_value, lost_reason, created_at, stage_updated_at, converted_at'),
      loadAll<any>(ctx.sb, 'crm_quotations', 'lead_id, status, monthly_cost, created_by, created_at'),
      crmSeesAll(ctx) ? loadAll<any>(ctx.sb, 'business_referrals', 'community_name, company_name, status, service_required, total_units, created_at') : Promise.resolve([]),
      peopleDirectory(ctx.sb),
    ]);
    const nameOf = (id: string | null) => (id && dir.rows.find(u => u.id === id)?.name) || 'Unassigned';
    let rows = leads.filter(l => !own.ownerId || l.assigned_to === own.ownerId || (!l.assigned_to && l.created_by === own.ownerId));
    let periodLabel = 'all time';
    if (args.period) {
      const p = periodRange(args.period, args.start_date, args.end_date, ctx.now);
      periodLabel = p.label;
      rows = rows.filter(l => { const d = istDate(l.created_at); const s = l.stage_updated_at ? istDate(l.stage_updated_at) : d; return (d >= p.from && d <= p.to) || (s >= p.from && s <= p.to); });
    }
    if (args.client_name) {
      const w = norm(args.client_name).split(/\s+/).filter(Boolean);
      rows = rows.filter(l => w.every(x => norm(`${l.client_name} ${l.association_name ?? ''}`).includes(x)));
      if (!rows.length) return { kind: 'not_found', text: `No CRM lead matching "${args.client_name}"${own.ownerLabel ? ` for ${own.ownerLabel}` : ''}.` };
    }
    const scopeRows = rows;
    const stages = tally(scopeRows, l => l.status || 'Unknown');
    let stageRows = scopeRows;
    if (args.stage) {
      const s = norm(args.stage);
      stageRows = s === 'open' || s === 'active' ? scopeRows.filter(l => !CLOSED_STAGES.has(norm(l.status)))
        : scopeRows.filter(l => norm(l.status).includes(s) || s.includes(norm(l.status)));
    }
    const won = scopeRows.filter(l => norm(l.status) === 'won').length, lost = scopeRows.filter(l => norm(l.status) === 'lost').length;
    const open = scopeRows.filter(l => !CLOSED_STAGES.has(norm(l.status)));
    const leadIds = new Set(scopeRows.map(l => l.id));
    const myQuotes = quotes.filter(q => leadIds.has(q.lead_id));
    const facts: Record<string, any> = {
      period: periodLabel,
      owner: own.ownerLabel ?? 'all owners',
      total_leads: scopeRows.length,
      by_stage: stages,
      open_pipeline: open.length,
      won, lost,
      win_rate_of_closed: won + lost ? `${Math.round((won / (won + lost)) * 100)}% (${won} won of ${won + lost} closed)` : 'no closed leads',
      open_deal_value: open.some(l => l.deal_value) ? inr(open.reduce((s, l) => s + num(l.deal_value), 0)) : 'deal value not recorded',
      ...(crmSeesAll(ctx) && !own.ownerId ? { leads_by_owner: tally(scopeRows, l => nameOf(l.assigned_to)) } : {}),
      quotations: { total: myQuotes.length, by_status: tally(myQuotes, q => q.status || 'Unknown') },
      ...(crmSeesAll(ctx) ? { business_referrals: { total: refs.length, latest: refs.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5).map(r => `${r.community_name || r.company_name} (${prettyDate(r.created_at)})`) } } : {}),
      top_lost_reasons: tally(scopeRows.filter(l => norm(l.status) === 'lost' && l.lost_reason), l => clip(l.lost_reason, 40)),
    };
    if (args.stage) {
      facts.stage_asked = args.stage;
      facts.leads_in_stage = stageRows.length;
      if (!stageRows.length) facts.stage_note = `No leads in a stage matching "${args.stage}". Stages in use: ${Object.keys(stages).join(', ')}.`;
    }
    const list = stageRows.slice().sort((a, b) => String(b.stage_updated_at || b.created_at).localeCompare(String(a.stage_updated_at || a.created_at))).slice(0, 25);
    return {
      kind: 'answer', facts, sourceLabel: `CRM · Pipeline · ${periodLabel}`,
      table: { columns: ['Client', 'Stage', 'Owner', 'Type', 'Location', 'Units', 'Stage since'], rows: list.map(l => [l.client_name, l.status, nameOf(l.assigned_to), l.property_type, clip(l.location || l.city, 40), l.unit_count, prettyDate(l.stage_updated_at || l.created_at)]) },
    };
  }),
};

// =====================================================================================================
// 4. get_crm_followups
// =====================================================================================================
const getCrmFollowups: AssistTool = {
  name: 'get_crm_followups',
  module: 'CRM',
  capability: 'crm',
  description: 'CRM follow-ups by due date: follow-ups due today, overdue, this week or upcoming, per lead (latest next-follow-up date), plus follow-up activity logged and site-survey checklists pending. E.g. "follow-ups due today", "overdue follow-ups", "which clients should I call this week", "follow-ups for Sobha Clovelly". Not for lead counts by stage (use get_crm_pipeline).',
  parameters: {
    type: 'object',
    properties: {
      when: { type: 'string', enum: ['today', 'overdue', 'this_week', 'next_7_days', 'upcoming', 'all_pending'], description: 'Which due follow-ups. Default today plus overdue counts.' },
      owner_name: { type: 'string', description: 'Sales owner if named; "me" for own.' },
      client_name: { type: 'string', description: 'A specific lead / client name if asked.' },
    },
  },
  run: safeRun(async (ctx, args) => {
    const own = await ownerFilter(ctx, args.owner_name); if (own.ok === false) return own.result;
    const [leads, fus, checks, dir] = await Promise.all([
      loadAll<any>(ctx.sb, 'crm_leads', 'id, client_name, status, assigned_to, created_by'),
      loadAll<any>(ctx.sb, 'crm_followups', 'lead_id, type, outcome, notes, next_followup_date, created_by, created_at'),
      loadAll<any>(ctx.sb, 'crm_checklist_submissions', 'lead_id, status, submitted_by, created_at'),
      peopleDirectory(ctx.sb),
    ]);
    const nameOf = (id: string | null) => (id && dir.rows.find(u => u.id === id)?.name) || 'Unassigned';
    const leadMap = new Map(leads.map(l => [l.id, l]));
    const mine = (l: any) => !own.ownerId || l.assigned_to === own.ownerId || (!l.assigned_to && l.created_by === own.ownerId);
    let visibleLeads = leads.filter(mine);
    if (args.client_name) {
      const w = norm(args.client_name).split(/\s+/).filter(Boolean);
      visibleLeads = visibleLeads.filter(l => w.every(x => norm(l.client_name).includes(x)));
      if (!visibleLeads.length) return { kind: 'not_found', text: `No CRM lead matching "${args.client_name}"${own.ownerLabel ? ` for ${own.ownerLabel}` : ''}.` };
    }
    const visIds = new Set(visibleLeads.map(l => l.id));
    const myFus = fus.filter(f => visIds.has(f.lead_id) || (own.ownerId && f.created_by === own.ownerId && (!args.client_name)));
    // latest follow-up per lead decides the next due date
    const latestByLead = new Map<string, any>();
    for (const f of myFus.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))) latestByLead.set(f.lead_id, f);
    const today = todayIst(ctx.now);
    const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    const weekEnd = addDays(today, 6 - dow);
    const due = [...latestByLead.values()].map(f => ({ f, lead: leadMap.get(f.lead_id) }))
      .filter(x => x.lead && !CLOSED_STAGES.has(norm(x.lead.status)) && x.f.next_followup_date)
      .map(x => ({ ...x, date: String(x.f.next_followup_date).slice(0, 10) }));
    const buckets = {
      today: due.filter(x => x.date === today),
      overdue: due.filter(x => x.date < today),
      this_week: due.filter(x => x.date >= today && x.date <= weekEnd),
      next_7_days: due.filter(x => x.date >= today && x.date <= addDays(today, 7)),
      upcoming: due.filter(x => x.date > today),
      all_pending: due,
    };
    const when = (args.when || 'today') as keyof typeof buckets;
    const list = (buckets[when] ?? buckets.today).slice().sort((a, b) => a.date.localeCompare(b.date));
    const loggedToday = myFus.filter(f => istDate(f.created_at) === today).length;
    const visChecks = checks.filter(c => visIds.has(c.lead_id) || (own.ownerId && c.submitted_by === own.ownerId));
    const facts: Record<string, any> = {
      today: prettyDate(today),
      owner: own.ownerLabel ?? 'all owners',
      showing: when,
      due_today: buckets.today.length,
      overdue: buckets.overdue.length,
      due_rest_of_this_week: buckets.this_week.length,
      open_leads_without_next_followup_date: visibleLeads.filter(l => !CLOSED_STAGES.has(norm(l.status)) && !latestByLead.get(l.id)?.next_followup_date).length,
      followups_logged_today: loggedToday,
      followups_logged_last_7_days: myFus.filter(f => istDate(f.created_at) >= addDays(today, -6)).length,
      ...(buckets.overdue.length ? { oldest_overdue: `${buckets.overdue.sort((a, b) => a.date.localeCompare(b.date))[0].lead.client_name} (due ${prettyDate(buckets.overdue[0].date)}, ${daysBetween(today, buckets.overdue[0].date)} days ago)` } : {}),
      site_survey_checklists: { total: visChecks.length, by_status: tally(visChecks, c => c.status || 'unknown') },
      [`${when}_list`]: list.slice(0, 25).map(x => `${x.lead.client_name} — ${prettyDate(x.date)} (${x.lead.status})`),
      ...(list.length > 25 ? { more_not_listed: list.length - 25 } : {}),
    };
    return {
      kind: 'answer', facts, sourceLabel: `CRM · Follow-ups · ${prettyDate(today)}`,
      table: { columns: ['Client', 'Stage', 'Owner', 'Due', 'Last contact', 'Last outcome'], rows: list.slice(0, 25).map(x => [x.lead.client_name, x.lead.status, nameOf(x.lead.assigned_to), prettyDate(x.date), `${x.f.type} · ${prettyDate(istDate(x.f.created_at))}`, x.f.outcome ? clip(x.f.outcome, 60) : (x.f.notes ? clip(x.f.notes, 60) : null)]) },
    };
  }),
};

// =====================================================================================================
// 5. get_communication_log
// =====================================================================================================
const getCommunicationLog: AssistTool = {
  name: 'get_communication_log',
  module: 'Communication',
  capability: 'comms',
  description: 'Emails, app notifications, push alerts and calls sent to or made by ONE person (or all recorded calls): e.g. "was the payslip email sent to Kavya", "did the monthly attendance report reach Isaac", "notifications Ravi got yesterday", "summarise yesterday\'s calls". Returns only subject/type/status/time (never email bodies, phone numbers or recordings). Not for who-changed-what (use get_audit_trail).',
  parameters: {
    type: 'object',
    properties: {
      ...PERSON_PARAMS,
      channel: { type: 'string', enum: ['all', 'email', 'notification', 'push', 'call'], description: 'Which channel; default all. "call" with no person = all recorded calls in the period.' },
      topic: { type: 'string', description: 'Keyword for the email/notification subject, e.g. "payslip", "offer", "attendance report". Empty if none.' },
      ...PERIOD_PARAMS,
    },
  },
  run: safeRun(async (ctx, args) => {
    const channel = args.channel || 'all';
    const today = todayIst(ctx.now);
    const p = args.period ? periodRange(args.period, args.start_date, args.end_date, ctx.now)
      : { from: addDays(today, -89), to: today, label: `last 90 days (${prettyDate(addDays(today, -89))} – ${prettyDate(today)})` };
    const { startUtc, endUtc } = istBounds(p.from, p.to);
    const kw = args.topic ? String(args.topic).trim() : '';
    const kwRe = kw ? new RegExp(kw.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/s$/, '')).join('|'), 'i') : null;

    // ---- all calls (no person)
    if (channel === 'call' && !args.person_name && !args.person_id && !args.about_self) {
      const { data: recs, error } = await ctx.sb.from('call_recordings').select('id, hr_user_id, duration_seconds, created_at').gte('created_at', startUtc).lte('created_at', endUtc).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      const ids = (recs ?? []).map(r => r.id);
      const { data: trs } = ids.length ? await ctx.sb.from('call_transcripts').select('recording_id, summary, call_outcome, candidate_interest').in('recording_id', ids) : { data: [] as any[] };
      const dir = await peopleDirectory(ctx.sb);
      const tr = new Map((trs ?? []).map((t: any) => [t.recording_id, t]));
      if (!recs?.length) return { kind: 'not_found', text: `No recorded calls in ${p.label}.` };
      return {
        kind: 'answer', sourceLabel: `Communication · Calls · ${p.label}`,
        facts: { period: p.label, calls: recs.length, total_minutes: Math.round(recs.reduce((s, r) => s + num(r.duration_seconds), 0) / 60), by_outcome: tally(recs, r => tr.get(r.id)?.call_outcome || 'no transcript'), summaries: recs.slice(0, 10).map(r => `${prettyDate(istDate(r.created_at))} ${istTime(r.created_at)}: ${clip(tr.get(r.id)?.summary || 'no summary', 100)}`) },
        table: { columns: ['When', 'Made by', 'Duration', 'Outcome', 'Summary'], rows: recs.slice(0, 25).map(r => [`${prettyDate(istDate(r.created_at))} ${istTime(r.created_at)}`, (r.hr_user_id && dir.rows.find(u => u.id === r.hr_user_id)?.name) || null, `${num(r.duration_seconds)}s`, tr.get(r.id)?.call_outcome ?? null, clip(tr.get(r.id)?.summary || '', 80)]) },
      };
    }

    const who = await resolvePerson(ctx, args); if (who.ok === false) return who.result;
    const person = who.person;
    const facts: Record<string, any> = { person: person.name, period: p.label, ...(kw ? { topic: kw } : {}) };
    const rows: (string | number | null)[][] = [];

    if (channel === 'all' || channel === 'email') {
      if (!person.email) facts.email = 'no email address on profile — email log cannot be checked';
      else {
        const { data, error } = await ctx.sb.from('email_logs').select('subject, status, error_message, rule_id, template_id, created_at')
          .ilike('recipient_email', `%${person.email.trim()}%`).gte('created_at', startUtc).lte('created_at', endUtc).order('created_at', { ascending: false }).limit(300);
        if (error) throw error;
        const all = data ?? [];
        const ruleIds = [...new Set(all.map(e => e.rule_id).filter(Boolean))];
        const { data: rules } = ruleIds.length ? await ctx.sb.from('email_schedule_rules').select('id, name').in('id', ruleIds) : { data: [] as any[] };
        const ruleName = new Map((rules ?? []).map((r: any) => [r.id, r.name]));
        const label = (e: any) => `${e.subject ?? ''} ${ruleName.get(e.rule_id) ?? ''}`;
        const hits = kwRe ? all.filter(e => kwRe.test(label(e))) : all;
        facts.emails = {
          total_in_period: all.length,
          ...(kw ? { matching_topic: hits.length } : {}),
          sent: hits.filter(e => e.status === 'sent').length,
          failed: hits.filter(e => e.status !== 'sent').length,
          latest: hits.slice(0, 5).map(e => `${clip(e.subject, 70)} — ${e.status} — ${prettyDate(istDate(e.created_at))} ${istTime(e.created_at)}${ruleName.get(e.rule_id) ? ` (rule: ${ruleName.get(e.rule_id)})` : ''}`),
          ...(kw && !hits.length && all.length ? { other_recent_subjects: [...new Set(all.slice(0, 20).map(e => clip(String(e.subject).replace(/\d.*$/, ''), 50)))].slice(0, 5) } : {}),
        };
        hits.slice(0, 12).forEach(e => rows.push(['Email', `${prettyDate(istDate(e.created_at))} ${istTime(e.created_at)}`, clip(e.subject, 70), e.status]));
      }
    }
    if (channel === 'all' || channel === 'notification') {
      const { data, error } = await ctx.sb.from('notifications').select('message, type, severity, is_read, created_at')
        .eq('user_id', person.id).gte('created_at', startUtc).lte('created_at', endUtc).order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      const all = data ?? [];
      const hits = kwRe ? all.filter(n => kwRe.test(`${n.message} ${n.type}`)) : all;
      facts.app_notifications = {
        total: hits.length, ...(all.length === 500 ? { capped_at: 500 } : {}),
        by_type: tally(hits, n => n.type || 'other'),
        unread: hits.filter(n => !n.is_read).length,
        latest: hits.slice(0, 5).map(n => `${clip(n.message, 70)} — ${prettyDate(istDate(n.created_at))} ${istTime(n.created_at)}`),
      };
      hits.slice(0, 8).forEach(n => rows.push(['Notification', `${prettyDate(istDate(n.created_at))} ${istTime(n.created_at)}`, clip(n.message, 70), n.is_read ? 'read' : 'unread']));
    }
    if (channel === 'all' || channel === 'push') {
      const { data, error } = await ctx.sb.from('automated_notification_logs').select('trigger_type, channel, status, created_at')
        .eq('user_id', person.id).gte('created_at', startUtc).lte('created_at', endUtc).order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      const hits = (data ?? []).filter(a => !kwRe || kwRe.test(a.trigger_type));
      facts.automated_alerts = { total: hits.length, by_trigger: tally(hits, a => `${a.trigger_type} via ${a.channel}`), sent: hits.filter(a => a.status === 'sent').length, failed: hits.filter(a => a.status !== 'sent').length };
      hits.slice(0, 5).forEach(a => rows.push(['Auto alert', `${prettyDate(istDate(a.created_at))} ${istTime(a.created_at)}`, `${a.trigger_type} (${a.channel})`, a.status]));
    }
    if (channel === 'all' || channel === 'call') {
      const [{ data: logs }, { data: recs }] = await Promise.all([
        ctx.sb.from('communication_logs').select('sender_id, receiver_id, type, created_at').or(`sender_id.eq.${person.id},receiver_id.eq.${person.id}`).gte('created_at', startUtc).lte('created_at', endUtc).limit(200),
        ctx.sb.from('call_recordings').select('id, duration_seconds, created_at').eq('hr_user_id', person.id).gte('created_at', startUtc).lte('created_at', endUtc).limit(200),
      ]);
      facts.calls = {
        in_app_calls_or_messages: (logs ?? []).length,
        by_type: tally(logs ?? [], l => `${l.type} ${l.sender_id === person.id ? 'made' : 'received'}`),
        recorded_calls_made: (recs ?? []).length,
      };
      (logs ?? []).slice(0, 5).forEach(l => rows.push(['Call', `${prettyDate(istDate(l.created_at))} ${istTime(l.created_at)}`, `${l.type} ${l.sender_id === person.id ? 'made' : 'received'}`, null]));
    }
    rows.sort((a, b) => String(b[1]).localeCompare(String(a[1])));
    return { kind: 'answer', facts, sourceLabel: `Communication · ${person.name} · ${p.label}`, table: { columns: ['Channel', 'When', 'Subject / message', 'Status'], rows: rows.slice(0, 25) } };
  }),
};

// =====================================================================================================
// 6. get_audit_trail
// =====================================================================================================
const getAuditTrail: AssistTool = {
  name: 'get_audit_trail',
  module: 'Audit trail',
  capability: 'audit_trail',
  description: 'Who-changed-what history: manual attendance edits/leave assignments, impersonation, logins and lockouts, GPS tracking requests, bulk template uploads, and edits to a site\'s billing/invoice records. E.g. "who changed Kavya\'s attendance yesterday", "who edited the Nikoo invoice", "what did Sudhan change this week", "failed logins today". Not for the current attendance or invoice values themselves.',
  parameters: {
    type: 'object',
    properties: {
      area: { type: 'string', enum: ['all', 'attendance', 'impersonation', 'login', 'tracking', 'templates', 'invoice'], description: 'What kind of change. invoice = billing/invoice tracker edits (needs a site). Default all.' },
      ...PERSON_PARAMS,
      person_role: { type: 'string', enum: ['subject', 'actor'], description: 'subject = changes made TO this person\'s records ("who changed Kavya\'s attendance"); actor = changes made BY this person ("what did Sudhan change"). Default subject.' },
      ...SITE_PARAMS,
      ...PERIOD_PARAMS,
    },
  },
  run: safeRun(async (ctx, args) => {
    const area = args.area || (args.site_name || args.site_exact ? 'invoice' : 'all');
    const today = todayIst(ctx.now);
    const p = args.period ? periodRange(args.period, args.start_date, args.end_date, ctx.now)
      : area === 'invoice' ? { from: '2000-01-01', to: today, label: 'all time' }
      : { from: addDays(today, -29), to: today, label: `last 30 days (${prettyDate(addDays(today, -29))} – ${prettyDate(today)})` };
    const { startUtc, endUtc } = istBounds(p.from, p.to);
    const dir = await peopleDirectory(ctx.sb);
    const nameOf = (id: string | null) => (id && dir.rows.find(u => u.id === id)?.name) || (id ? 'unknown user' : null);
    const when = (ts: string) => `${prettyDate(istDate(ts))} ${istTime(ts)}`;
    const rows: (string | number | null)[][] = [];
    const facts: Record<string, any> = { period: p.label, area };

    // ---- billing / invoice edits for a site (trackers carry created_by/updated_by names; revisions tables if present)
    if (area === 'invoice') {
      const [fin, inv] = await Promise.all([
        loadAll<any>(ctx.sb, 'site_finance_tracker', 'id, site_name, billing_month, created_by_name, created_at, updated_by_name, updated_at, deleted_by_name, deleted_at'),
        loadAll<any>(ctx.sb, 'site_invoice_tracker', 'id, site_name, manager_tentative_date, created_by_name, created_at, updated_at, deleted_by_name, deleted_at'),
      ]);
      const r = await resolveSiteName(ctx, args, [...fin, ...inv].map(x => x.site_name).filter(s => ctx.scope.canSeeFinanceSite(s)));
      if (r.ok === false) return r.result;
      if (!r.site) return { kind: 'clarify', question: 'Which site\'s invoice or billing record do you mean?', options: [] };
      const f = fin.filter(x => x.site_name === r.site), i = inv.filter(x => x.site_name === r.site);
      const inP = (ts: string | null) => !!ts && ts >= startUtc && ts <= endUtc;
      const ev: { ts: string; what: string; by: string | null; rec: string }[] = [];
      f.forEach(x => {
        const m = monthLabel(x.billing_month);
        if (inP(x.created_at)) ev.push({ ts: x.created_at, what: 'billing record created', by: x.created_by_name, rec: `Billing ${m}` });
        if (x.updated_at && x.updated_at !== x.created_at && inP(x.updated_at)) ev.push({ ts: x.updated_at, what: 'billing record last edited', by: x.updated_by_name || 'not recorded', rec: `Billing ${m}` });
        if (inP(x.deleted_at)) ev.push({ ts: x.deleted_at, what: 'billing record deleted', by: x.deleted_by_name, rec: `Billing ${m}` });
      });
      i.forEach(x => {
        const m = x.manager_tentative_date ? monthLabel(x.manager_tentative_date.slice(0, 7) + '-01') : '?';
        if (inP(x.created_at)) ev.push({ ts: x.created_at, what: 'invoice-tracker entry created', by: x.created_by_name, rec: `Invoice ${m}` });
        if (x.updated_at && x.updated_at !== x.created_at && inP(x.updated_at)) ev.push({ ts: x.updated_at, what: 'invoice-tracker entry last edited', by: 'not recorded (tracker keeps no editor name)', rec: `Invoice ${m}` });
        if (inP(x.deleted_at)) ev.push({ ts: x.deleted_at, what: 'invoice-tracker entry deleted', by: x.deleted_by_name, rec: `Invoice ${m}` });
      });
      // revision history tables (written by services/api.ts on edit) — optional
      for (const [t, ids] of [['site_finance_revisions', f.map(x => x.id)], ['site_invoice_revisions', i.map(x => x.id)]] as const) {
        if (!ids.length) continue;
        const { data, error } = await ctx.sb.from(t).select('record_id, revised_by_name, diff, revision_number, created_at').in('record_id', ids).gte('created_at', startUtc).lte('created_at', endUtc).limit(100);
        if (!error) (data ?? []).forEach((v: any) => ev.push({ ts: v.created_at, what: `revision #${v.revision_number}: ${Object.keys(v.diff ?? {}).slice(0, 4).join(', ') || 'fields changed'}`, by: v.revised_by_name, rec: t.includes('finance') ? 'Billing' : 'Invoice' }));
      }
      ev.sort((a, b) => b.ts.localeCompare(a.ts));
      facts.site = r.site;
      facts.changes = ev.length;
      facts.editors = tally(ev, e => e.by || 'not recorded');
      facts.latest = ev.slice(0, 8).map(e => `${when(e.ts)} — ${e.rec}: ${e.what} by ${e.by || 'not recorded'}`);
      if (!ev.length) facts.note = `No billing or invoice changes for ${r.site} in ${p.label}. Last change on record: ${[...f, ...i].map(x => x.updated_at || x.created_at).sort().pop() ? when([...f, ...i].map(x => x.updated_at || x.created_at).sort().pop()) : 'none'}.`;
      ev.slice(0, 25).forEach(e => rows.push([when(e.ts), e.rec, e.what, e.by]));
      return { kind: 'answer', facts, sourceLabel: `Audit trail · ${r.site} · ${p.label}`, table: { columns: ['When', 'Record', 'Change', 'By'], rows } };
    }

    // ---- person-based trails
    let pid: string | null = null; let pname: string | null = null;
    if (args.person_name || args.person_id || args.about_self) {
      const who = await resolvePerson(ctx, args); if (who.ok === false) return who.result;
      pid = who.person.id; pname = who.person.name;
    }
    const actor = args.person_role === 'actor';
    if (pname) facts[actor ? 'changes_made_by' : 'changes_to_records_of'] = pname;

    const evs: { ts: string; row: (string | number | null)[] }[] = [];
    const push = (ts: string, area: string, what: string, by: string | null, target: string | null) => evs.push({ ts, row: [when(ts), area, what, by, target] });
    const ev = async (t: string, cols: string, tsCol: string, apply: (q: any) => any) => {
      let q: any = ctx.sb.from(t).select(cols).gte(tsCol, startUtc).lte(tsCol, endUtc).order(tsCol, { ascending: false }).limit(200);
      q = apply(q);
      const { data, error } = await q; if (error) throw error; return (data ?? []) as any[];
    };
    const summary: Record<string, any> = {};
    if (area === 'all' || area === 'attendance') {
      const d = await ev('attendance_audit_logs', 'action, performed_by, target_user_id, details, created_at', 'created_at', q => pid ? q.eq(actor ? 'performed_by' : 'target_user_id', pid) : q);
      summary.attendance_changes = { total: d.length, by_action: tally(d, x => x.action), by_whom: tally(d, x => nameOf(x.performed_by) || 'system') };
      d.forEach(x => { const det = x.details ?? {}; push(x.created_at, 'Attendance', `${x.action}${det.date ? ` for ${prettyDate(det.date)}` : ''}${det.reason ? ` — "${clip(det.reason, 50)}"` : ''}`, nameOf(x.performed_by) || 'system', nameOf(x.target_user_id)); });
    }
    if (area === 'all' || area === 'impersonation') {
      const d = await ev('audit_logs', 'action, performed_by, performed_by_name, target_user, target_user_name, reason, table_name, created_at', 'created_at', q => pid ? q.eq(actor ? 'performed_by' : 'target_user', pid) : q);
      summary.admin_actions = { total: d.length, by_action: tally(d, x => x.action) };
      d.forEach(x => push(x.created_at, 'Admin', `${x.action}${x.table_name ? ` on ${x.table_name}` : ''}${x.reason ? ` — "${clip(x.reason, 40)}"` : ''}`, x.performed_by_name || nameOf(x.performed_by), x.target_user_name || nameOf(x.target_user)));
    }
    if (area === 'all' || area === 'login') {
      const d = await ev('security_audit_logs', 'event_type, user_id, severity, created_at', 'created_at', q => pid ? q.eq('user_id', pid) : q);
      summary.login_security_events = { total: d.length, by_event: tally(d, x => x.event_type) };
      if (area === 'login') d.forEach(x => push(x.created_at, 'Login', x.event_type, nameOf(x.user_id), null));
    }
    if (area === 'all' || area === 'tracking') {
      const d = await ev('tracking_audit_logs', 'admin_id, target_user_id, status, requested_at', 'requested_at', q => pid ? q.eq(actor ? 'admin_id' : 'target_user_id', pid) : q);
      summary.gps_tracking_requests = { total: d.length, by_requester: tally(d, x => nameOf(x.admin_id) || 'unknown') };
      d.forEach(x => push(x.requested_at, 'GPS tracking', `location requested (${x.status})`, nameOf(x.admin_id), nameOf(x.target_user_id)));
    }
    if (area === 'all' || area === 'templates') {
      const d = await ev('template_change_logs', 'template_name, action, user_id, user_name, rows_created, rows_updated, rows_failed, created_at', 'created_at', q => pid ? q.eq('user_id', pid) : q);
      summary.bulk_template_actions = { total: d.length, by_action: tally(d, x => `${x.template_name} ${x.action}`) };
      d.forEach(x => push(x.created_at, 'Bulk template', `${x.template_name} ${x.action}${x.rows_created || x.rows_updated ? ` (+${x.rows_created ?? 0} new, ${x.rows_updated ?? 0} updated)` : ''}`, x.user_name || nameOf(x.user_id), null));
    }
    Object.assign(facts, summary);
    const sorted = evs.sort((a, b) => b.ts.localeCompare(a.ts)).map(e => e.row);
    facts.total_events = sorted.length;
    facts.latest = sorted.slice(0, 8).map(r => `${r[0]} — ${r[1]}: ${r[2]} by ${r[3] ?? 'system'}${r[4] ? ` → ${r[4]}` : ''}`);
    if (!sorted.length) return { kind: 'not_found', text: `No ${area === 'all' ? '' : area + ' '}audit entries${pname ? ` ${actor ? 'by' : 'for'} ${pname}` : ''} in ${p.label}.` };
    return { kind: 'answer', facts, sourceLabel: `Audit trail · ${pname ? pname + ' · ' : ''}${p.label}`, table: { columns: ['When', 'Area', 'Change', 'By', 'Affected person'], rows: sorted.slice(0, 25) } };
  }),
};

// =====================================================================================================
// 7. get_site_summary
// =====================================================================================================
const getSiteSummary: AssistTool = {
  name: 'get_site_summary',
  module: 'Site summary',
  capability: 'ops',
  description: 'ONE combined overview card for a single site: responsible people (ops manager, site manager, HR/accounts in-charge), staff count, today\'s punches, open helpdesk tickets and — only for finance-allowed users — the last invoice month, value and sent status. E.g. "Nikoo Homes summary", "give me an overview of Urban Greens", "how is Brigade Laburnum doing". Not for just a contact/responsibility lookup (use get_site_info) or a detailed list of tickets/absentees/invoice.',
  parameters: { type: 'object', properties: { ...SITE_PARAMS }, required: [] },
  run: safeRun(async (ctx, args) => {
    const [matrix, locs, dir] = await Promise.all([
      loadAll<any>(ctx.sb, 'site_responsibility_matrix', 'site_id, site_name, ops_manager_name, site_manager_name, field_officer_name, site_supervisor_name, hr_incharge_name, accounts_incharge_name, billing_company, billing_cycle, units_count, is_active'),
      loadAll<any>(ctx.sb, 'locations', 'id, name'),
      peopleDirectory(ctx.sb),
    ]);
    const s = ctx.scope;
    const locByName = new Map(locs.map(l => [norm(l.name), l]));
    const opsVisible = (name: string) => { const m = matrix.find(x => norm(x.site_name) === norm(name)); const loc = (m?.site_id && locs.find(l => l.id === m.site_id)) || locByName.get(norm(name)); return s.canSeeSiteName(name) || (!!loc && s.canSeeSiteId(loc.id)); };
    const candidates = new Set<string>();
    matrix.filter(m => m.is_active !== false && opsVisible(m.site_name)).forEach(m => candidates.add(m.site_name));
    locs.filter(l => s.canSeeSiteId(l.id) && s.siteIds !== 'all').forEach(l => candidates.add(l.name));
    if (s.siteIds === 'all') locs.forEach(l => candidates.add(l.name));
    // finance-allowed users may ask about any site they can see the billing of
    if (s.can('finance') && s.financeSiteNames !== 'all') s.financeSiteNames.forEach(n => { const m = matrix.find(x => norm(x.site_name) === n); if (m) candidates.add(m.site_name); });
    let finSites: string[] = [];
    if (s.can('finance')) {
      const { data } = await ctx.sb.from('site_finance_tracker').select('site_name').is('deleted_at', null).limit(5000);
      finSites = [...new Set((data ?? []).map((r: any) => r.site_name as string))].filter(n => s.canSeeFinanceSite(n));
      if (s.financeSiteNames === 'all') finSites.forEach(n => candidates.add(n));
    }
    // de-duplicate case variants
    const uniq = new Map<string, string>(); [...candidates].forEach(c => { if (!uniq.has(norm(c))) uniq.set(norm(c), c); });
    if (!args.site_name && !args.site_exact && !ctx.selectedSiteId) return { kind: 'clarify', question: 'Which site do you want a summary of? (type the site name)', options: [] };
    const r = await resolveSiteName(ctx, args, [...uniq.values()]);
    if (r.ok === false) return r.result;
    if (!r.site) return { kind: 'clarify', question: 'Which site do you want a summary of? (type the site name)', options: [] };
    const site = r.site;

    const m = matrix.find(x => norm(x.site_name) === norm(site) && x.is_active !== false) || matrix.find(x => norm(x.site_name) === norm(site));
    // app locations for this site: the matrix site_id plus every location whose name contains all the site's words
    // (e.g. "Nikoo Homes" → "NIKOO HOMES 1 - Entry", "NIKOO HOMES 1 - Exit"); users.location_id is mostly a group id, so
    // staff are counted from punches at these locations instead.
    const siteWords = norm(site).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);
    const locIds = new Set<string>();
    if (m?.site_id && locs.some(l => l.id === m.site_id)) locIds.add(m.site_id);
    locs.filter(l => { const n = norm(l.name); return siteWords.length && siteWords.every(w => n.includes(w)); }).forEach(l => locIds.add(l.id));
    const canOps = opsVisible(site) || [...locIds].some(id => s.siteIds !== 'all' && s.canSeeSiteId(id));
    const finName = finSites.find(n => norm(n) === norm(site)) ?? null;
    const canFin = s.canSeeFinanceSite(finName ?? site);
    const hidden: string[] = [];
    const facts: Record<string, any> = { site };

    if (canOps) {
      if (m) facts.responsible_people = Object.fromEntries(Object.entries({ ops_manager: m.ops_manager_name, site_manager: m.site_manager_name, field_officer: m.field_officer_name, site_supervisor: m.site_supervisor_name, hr_incharge: m.hr_incharge_name, accounts_incharge: m.accounts_incharge_name }).filter(([, v]) => v));
      else facts.responsible_people = 'site not in the Responsibility Matrix';
      if (m) facts.billing_setup = { company: m.billing_company, cycle: m.billing_cycle, units: m.units_count };
      if (locIds.size) {
        const today = todayIst(ctx.now);
        const { startUtc, endUtc } = istBounds(today, today);
        const since = istBounds(addDays(today, -29), today).startUtc;
        const { data: ev, error } = await ctx.sb.from('attendance_events').select('user_id, type, timestamp').in('location_id', [...locIds]).gte('timestamp', since).lte('timestamp', endUtc).limit(20000);
        if (error) throw error;
        const all = ev ?? [];
        const todays = all.filter(e => e.timestamp >= startUtc);
        const assigned = dir.rows.filter(u => u.location_id && locIds.has(u.location_id) && (!u.status || u.status === 'active')).length;
        const seen = new Set(all.map(e => e.user_id));
        facts.staff = { punched_here_last_30_days: seen.size, ...(assigned ? { assigned_in_profile: assigned } : {}), app_locations_matched: locs.filter(l => locIds.has(l.id)).map(l => l.name).slice(0, 5) };
        facts.today = { date: prettyDate(today), people_punched_in: new Set(todays.filter(e => /in/i.test(e.type)).map(e => e.user_id)).size, punch_events: todays.length, punch_outs: todays.filter(e => /out/i.test(e.type)).length };
        if (s.can('tickets')) {
          const staffIds = [...seen].filter(Boolean).slice(0, 300);
          const { data: tk } = staffIds.length ? await ctx.sb.from('support_tickets').select('status, priority').in('raised_by_id', staffIds).not('status', 'in', '("Resolved","Closed")').limit(500) : { data: [] as any[] };
          facts.open_tickets = { count: (tk ?? []).length, by_priority: tally(tk ?? [], t => t.priority || 'unknown'), note: 'tickets raised by staff who work at this site (tickets have no site field)' };
        }
      } else facts.staff_and_attendance = 'no matching app location (geofence) for this site, so staff and punches are unavailable';
    } else hidden.push('responsible people, staff and attendance (site is outside your team/sites)');

    if (canFin) {
      const { data: fr } = await ctx.sb.from('site_finance_tracker').select('billing_month, total_billed_amount, billed_amount, billed_management_fee, status').is('deleted_at', null).ilike('site_name', finName ?? site).order('billing_month', { ascending: false }).limit(1);
      const last = fr?.[0];
      if (last) {
        const lm = last.billing_month as string;
        const next = new Date(Date.UTC(+lm.slice(0, 4), +lm.slice(5, 7), 1)).toISOString().slice(0, 10);
        const { data: ir } = await ctx.sb.from('site_invoice_tracker').select('invoice_sent_date, invoice_sharing_tentative_date').is('deleted_at', null).ilike('site_name', finName ?? site).gte('manager_tentative_date', lm).lt('manager_tentative_date', next).limit(1);
        const inv = ir?.[0];
        facts.last_invoice = { month: monthLabel(lm), value: inr(last.total_billed_amount ?? num(last.billed_amount) + num(last.billed_management_fee)), approval_status: last.status, sent: inv ? (inv.invoice_sent_date ? `sent ${prettyDate(inv.invoice_sent_date)}` : 'not sent yet') : 'no invoice-tracker entry' };
      } else facts.last_invoice = 'no billing records for this site';
    } else hidden.push(s.can('finance') ? 'invoice/billing (not one of your finance sites)' : 'invoice/billing (finance access only)');

    if (hidden.length) facts.hidden_due_to_access = hidden;
    if (!canOps && !canFin) return { kind: 'denied', text: "You don't have access to that site's data." };
    return { kind: 'answer', facts, sourceLabel: `Site summary · ${site} · ${prettyDate(todayIst(ctx.now))}` };
  }),
};

export const financeTools: AssistTool[] = [listInvoiceStatus, getBillingTotals, getCrmPipeline, getCrmFollowups, getCommunicationLog, getAuditTrail, getSiteSummary];

