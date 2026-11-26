/** Attendance, field tracking, billing invoice value (ported from scripts/assist-prototype.ts) — owned by the CORE agent */
import type { AssistCtx, AssistTool } from '../types.js';
import {
  resolvePerson, periodRange, PERIOD_PARAMS, PERSON_PARAMS, SITE_PARAMS, resolveSiteName, safeRun,
  istBounds, istTime, istDate, inr, monthLabel, loadAll, prettyDate, shortAddress, todayIst, MONTHS,
} from '../helpers.js';
import { ROLE_LABEL } from '../roles.js';

const IN_TYPES = new Set(['punch-in', 'check_in']);
const OUT_TYPES = new Set(['punch-out', 'check_out']);
const hoursBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 3.6e6;
const round1 = (n: number) => Math.round(n * 10) / 10;

async function loadEvents(ctx: AssistCtx, userId: string, from: string, to: string) {
  const { startUtc, endUtc } = istBounds(from, to);
  const out: any[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await ctx.sb.from('attendance_events')
      .select('timestamp, type, location_name, is_manual, work_type')
      .eq('user_id', userId).gte('timestamp', startUtc).lte('timestamp', endUtc)
      .order('timestamp').range(f, f + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

type Day = { in?: string; out?: string; siteIn?: string; manual: boolean; sites: Set<string> };
function groupByDay(events: any[]) {
  const byDay = new Map<string, Day>();
  for (const e of events) {
    const day = istDate(e.timestamp);
    const r = byDay.get(day) ?? { manual: false, sites: new Set<string>() };
    if (IN_TYPES.has(e.type) && !r.in) r.in = e.timestamp;
    if (e.type === 'site-in' && !r.siteIn) r.siteIn = e.timestamp;
    if (OUT_TYPES.has(e.type)) r.out = e.timestamp;
    if (e.is_manual) r.manual = true;
    if (e.location_name) r.sites.add(shortAddress(e.location_name)!);
    byDay.set(day, r);
  }
  return byDay;
}

// ============================================================================ get_attendance_summary
const attendanceSummary: AssistTool = {
  name: 'get_attendance_summary',
  description: 'ONE employee\'s own attendance from punch records: days worked / present count over a period, or for a single day whether they were present, punch-in and punch-out times, hours worked and manual entries. E.g. "how many days did Kavya work this month", "is Ravi present today", "my punch-in time yesterday", "Kavya attendance last month". Not for site-wide headcount/absentee lists, late marks/violations, leave or GPS location.',
  parameters: { type: 'object', properties: { ...PERSON_PARAMS, ...PERIOD_PARAMS } },
  capability: 'attendance',
  module: 'Attendance',
  run: safeRun(async (ctx, args) => {
    const who = await resolvePerson(ctx, args);
    if (who.ok === false) return who.result;
    const p = periodRange(args.period, args.start_date, args.end_date, ctx.now);
    if (p.from > todayIst(ctx.now)) return { kind: 'not_found', text: `${prettyDate(p.from)} is in the future, so there is no attendance yet.` };
    const events = await loadEvents(ctx, who.person.id, p.from, p.to);
    const byDay = groupByDay(events);
    const base = { employee: who.person.name, role: ROLE_LABEL(who.person.role_id), home_site: who.siteName ?? 'not assigned', period: p.label };
    const badge = `Attendance · ${p.single ? prettyDate(p.from) : p.label.replace(/\s*\(.*\)$/, '')}`;

    if (p.single) {
      const r = byDay.get(p.from);
      const firstIn = r?.in ?? r?.siteIn;
      const facts = {
        ...base,
        date: prettyDate(p.from),
        present: !!firstIn,
        punch_in: firstIn ? `${istTime(firstIn)} IST` : 'not punched in',
        punch_out: r?.out ? `${istTime(r.out)} IST` : (firstIn ? 'no punch-out recorded' : 'not punched out'),
        hours_worked: firstIn && r?.out && hoursBetween(firstIn, r.out) > 0 ? round1(hoursBetween(firstIn, r.out)) : null,
        manual_entry: !!r?.manual,
        sites: [...(r?.sites ?? [])],
        events: events.map(e => `${istTime(e.timestamp)} ${e.type}${e.location_name ? ' @ ' + shortAddress(e.location_name) : ''}${e.is_manual ? ' (manual)' : ''}`).slice(0, 30),
      };
      return { kind: 'answer', facts, sourceLabel: badge };
    }

    const days = [...byDay.entries()].filter(([, r]) => r.in || r.siteIn).sort(([a], [b]) => a.localeCompare(b));
    const hours = days.map(([, r]) => { const i = r.in ?? r.siteIn; return i && r.out ? hoursBetween(i, r.out) : 0; }).filter(h => h > 0 && h < 24);
    const facts = {
      ...base,
      from: prettyDate(p.from), to: prettyDate(p.to),
      days_worked: days.length,
      days_with_missing_punch_out: days.filter(([, r]) => !r.out).length,
      manual_entry_days: days.filter(([, r]) => r.manual).length,
      avg_hours_per_day: hours.length ? round1(hours.reduce((a, b) => a + b, 0) / hours.length) : null,
      first_day_worked: days[0] ? prettyDate(days[0][0]) : null,
      last_day_worked: days.length ? prettyDate(days[days.length - 1][0]) : null,
      sites: [...new Set(days.flatMap(([, r]) => [...r.sites]))].slice(0, 5),
    };
    const table = days.length ? {
      columns: ['Date', 'In', 'Out', 'Hours', 'Site'],
      rows: days.slice(-31).map(([d, r]) => {
        const i = r.in ?? r.siteIn;
        const h = i && r.out ? hoursBetween(i, r.out) : 0;
        return [prettyDate(d), istTime(i), r.out ? istTime(r.out) : '—', h > 0 && h < 24 ? round1(h) : null, [...r.sites][0] ?? null] as (string | number | null)[];
      }),
    } : undefined;
    return { kind: 'answer', facts, sourceLabel: badge, table };
  }),
};

// ============================================================================ get_employee_whereabouts
const distM = (a: number, b: number, c: number, d: number) => {
  const R = 6371000, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

let locCache: { at: number; rows: any[] } | null = null;
async function registeredPlaces(ctx: AssistCtx) {
  if (locCache && Date.now() - locCache.at < 10 * 60_000) return locCache.rows;
  // Only real Paradigm sites/offices count as "registered". Most `locations` rows are auto-created geocoded addresses
  // (named like "Street, Area, City, 560066, India"); those are treated as unregistered places for privacy.
  const rows = (await loadAll<any>(ctx.sb, 'locations', 'name, latitude, longitude, radius'))
    .filter(l => l.latitude != null && l.longitude != null && l.name && (String(l.name).match(/,/g) || []).length < 3);
  locCache = { at: Date.now(), rows };
  return rows;
}

const whereabouts: AssistTool = {
  name: 'get_employee_whereabouts',
  description: 'WHERE one employee was or is on a single day, from GPS tracking: places/sites visited with times, stops, km travelled and last known position. E.g. "where is Isaac now", "where was Ravi yesterday", "which sites did I visit today", "how many km did Isaac travel on 20 Nov". Not for attendance counts or punch times only.',
  parameters: {
    type: 'object',
    properties: {
      ...PERSON_PARAMS,
      period: { type: 'string', enum: ['today', 'yesterday', 'custom'], description: 'Single day. Default today. custom + start_date for an explicit date.' },
      start_date: { type: 'string', description: 'YYYY-MM-DD (custom only)' },
    },
  },
  capability: null, // own GPS: everyone; others: 'tracking' (checked below)
  module: 'Field tracking',
  run: safeRun(async (ctx, args) => {
    const who = await resolvePerson(ctx, args);
    if (who.ok === false) return who.result;
    if (who.person.id !== ctx.asker.id && !ctx.scope.can('tracking')) {
      return { kind: 'denied', text: `Location tracking is limited to Admin and the employee's reporting managers. Your role (${ROLE_LABEL(ctx.asker.role_id)}) can't view other employees' locations.` };
    }
    const period = args.period === 'custom' || args.start_date ? 'custom' : (args.period || 'today');
    const p = periodRange(period, args.start_date, args.start_date, ctx.now, 'today');
    const day = p.from;
    if (day > todayIst(ctx.now)) return { kind: 'not_found', text: `${prettyDate(day)} is in the future.` };

    const { startUtc, endUtc } = istBounds(day, day);
    const [events, pings, locs] = await Promise.all([
      loadEvents(ctx, who.person.id, day, day),
      (async () => {
        const out: any[] = [];
        for (let f = 0; ; f += 1000) {
          const { data, error } = await ctx.sb.from('route_history').select('timestamp, latitude, longitude, accuracy')
            .eq('user_id', who.person.id).gte('timestamp', startUtc).lte('timestamp', endUtc).order('timestamp').range(f, f + 999);
          if (error) throw new Error(error.message);
          out.push(...(data ?? []));
          if (!data || data.length < 1000 || out.length >= 20000) return out;
        }
      })(),
      registeredPlaces(ctx),
    ]);
    // the tracked person's own home is used ONLY to suppress it (never returned): a stop there is always unregistered
    const { data: homeRow } = await ctx.sb.from('users').select('home_latitude, home_longitude').eq('id', who.person.id).maybeSingle();
    const home = homeRow?.home_latitude != null && homeRow?.home_longitude != null ? { lat: Number(homeRow.home_latitude), lng: Number(homeRow.home_longitude) } : null;
    const nearHome = (lat: number, lng: number) => !!home && distM(lat, lng, home.lat, home.lng) < 300;

    // working window: first punch-in → last punch-out (open punch: until now for today, else punch-in + 12 h)
    const firstIn = events.find(e => IN_TYPES.has(e.type) || e.type === 'site-in')?.timestamp;
    const lastOut = [...events].reverse().find(e => OUT_TYPES.has(e.type))?.timestamp;
    const winStart = firstIn ? new Date(firstIn).getTime() : null;
    let winEnd: number | null = null;
    if (winStart != null) {
      if (lastOut && new Date(lastOut).getTime() > winStart) winEnd = new Date(lastOut).getTime();
      else winEnd = day === todayIst(ctx.now) ? ctx.now.getTime() : winStart + 12 * 3600_000;
    }
    /** A stop counts as "during working hours" when its midpoint lies inside the punch-in → punch-out window. */
    const inWindow = (a: string, b: string) => {
      if (winStart == null || winEnd == null) return false;
      const mid = (new Date(a).getTime() + new Date(b).getTime()) / 2;
      return mid >= winStart && mid <= winEnd;
    };

    const nearest = (lat: number, lng: number) => {
      let best: any = null, bd = Infinity;
      for (const l of locs) { const d = distM(lat, lng, l.latitude, l.longitude); if (d < bd) { bd = d; best = l; } }
      return { best, dist: bd };
    };
    /** Registered site name, or null for an unregistered place. */
    const registered = (lat: number, lng: number) => {
      if (nearHome(lat, lng)) return null;
      const { best, dist } = nearest(lat, lng);
      return best && dist <= Math.max(Number(best.radius) || 100, 250) ? best.name : null;
    };
    const unregisteredLabel = (lat: number, lng: number) => {
      if (nearHome(lat, lng)) return 'unregistered location';
      const { best, dist } = nearest(lat, lng);
      return best && dist < 20000 ? `unregistered location (~${(dist / 1000).toFixed(1)} km from ${best.name})` : 'unregistered location';
    };
    const OUTSIDE = 'outside working hours';
    const t = (ts: string) => istTime(ts)!;

    const good = pings.filter(p => p.latitude != null && p.longitude != null && (p.accuracy == null || p.accuracy < 100));
    const stops: { place: string; from: string; to: string; minutes: number }[] = [];
    let i = 0;
    while (i < good.length) {
      let j = i;
      while (j + 1 < good.length && distM(good[i].latitude, good[i].longitude, good[j + 1].latitude, good[j + 1].longitude) < 200) j++;
      const mins = (new Date(good[j].timestamp).getTime() - new Date(good[i].timestamp).getTime()) / 60000;
      if (mins >= 15) {
        const reg = registered(good[i].latitude, good[i].longitude);
        // PRIVACY: unregistered places outside the punch-in → punch-out window are never named or located
        const place = reg ?? (inWindow(good[i].timestamp, good[j].timestamp) ? unregisteredLabel(good[i].latitude, good[i].longitude) : OUTSIDE);
        const last = stops[stops.length - 1];
        if (last && last.place === place) { last.to = t(good[j].timestamp); last.minutes += Math.round(mins); }
        else stops.push({ place, from: t(good[i].timestamp), to: t(good[j].timestamp), minutes: Math.round(mins) });
      }
      i = j + 1;
    }
    let km = 0;
    for (let k = 1; k < good.length; k++) { const d = distM(good[k - 1].latitude, good[k - 1].longitude, good[k].latitude, good[k].longitude); if (d < 5000) km += d / 1000; }
    const last = good[good.length - 1];
    let lastPos = 'no GPS data for this day';
    if (last) {
      const reg = registered(last.latitude, last.longitude);
      const place = reg ?? (inWindow(last.timestamp, last.timestamp) ? unregisteredLabel(last.latitude, last.longitude) : OUTSIDE);
      lastPos = `${t(last.timestamp)} IST — ${place}`;
    }

    const facts = {
      employee: who.person.name,
      role: ROLE_LABEL(who.person.role_id),
      date: p.label,
      punches: events.map(e => `${t(e.timestamp)} ${e.type}${e.location_name ? ' @ ' + shortAddress(e.location_name) : ''}`).slice(0, 30),
      working_window: winStart != null ? `${istTime(new Date(winStart))} – ${lastOut ? istTime(lastOut) : 'no punch-out'}` : 'did not punch in',
      gps_points: pings.length,
      gps_first: good[0] ? t(good[0].timestamp) : null,
      gps_last: last ? t(last.timestamp) : null,
      approx_km_travelled: round1(km),
      stops_over_15_min: stops,
      last_known_position: lastPos,
      privacy_note: stops.some(s => s.place === OUTSIDE) || lastPos.endsWith(OUTSIDE) ? 'Places outside working hours that are not Paradigm sites are not shown.' : undefined,
    };
    const table = stops.length ? { columns: ['From', 'To', 'Place', 'Minutes'], rows: stops.map(s => [s.from, s.to, s.place, s.minutes] as (string | number | null)[]) } : undefined;
    return { kind: 'answer', facts, sourceLabel: `Field tracking · ${prettyDate(day)}`, table };
  }),
};

// ============================================================================ get_site_invoice
const siteInvoice: AssistTool = {
  name: 'get_site_invoice',
  description: 'Invoice / billing VALUE and status of ONE client site for ONE billing month: contract amount, billed amount, management fee, total invoice value, approval status, when attendance was received and when the invoice was prepared/sent. E.g. "Nikoo Homes June invoice value", "was the Akshaya Patra October invoice sent", "invoice amount for Habitat last month". Not for lists or totals across many sites (e.g. "invoices not sent", "total billed in October").',
  parameters: {
    type: 'object',
    properties: {
      ...SITE_PARAMS,
      month: { type: 'integer', description: 'Billing month 1-12. Omit if the user did not mention a month (for "last month"/"this month" compute it from today).' },
      year: { type: 'integer', description: 'Billing year, e.g. 2026. Omit if not mentioned.' },
    },
  },
  capability: 'finance',
  module: 'Billing',
  run: safeRun(async (ctx, args) => {
    const fin = await loadAll<any>(ctx.sb, 'site_finance_tracker',
      'site_name, company_name, billing_month, contract_amount, contract_management_fee, billed_amount, billed_management_fee, total_billed_amount, status, remarks, deleted_at',
      q => q.is('deleted_at', null));
    const live = fin.filter(r => r.site_name && r.billing_month && ctx.scope.canSeeFinanceSite(r.site_name));
    if (!live.length) return { kind: 'not_found', text: 'There is no billing data for the sites you have access to.' };

    const candidates = [...new Set(live.map(r => String(r.site_name)))];
    const s = await resolveSiteName(ctx, args, candidates, 'site with billing data');
    if (s.ok === false) return s.result;
    if (!s.site) {
      if (candidates.length <= 8) return { kind: 'clarify', question: 'Which site do you want the invoice for?', options: candidates.sort().map(c => ({ label: c, args: { ...args, site_exact: c } })) };
      return { kind: 'not_found', text: 'Which site do you want the invoice for? Please mention the site name, e.g. "Nikoo Homes June invoice value".' };
    }
    const site = s.site;
    const rows = live.filter(r => r.site_name === site).sort((a, b) => String(b.billing_month).localeCompare(String(a.billing_month)));
    const monthOptions = (list: any[]) => list.slice(0, 6).map(r => ({
      label: monthLabel(r.billing_month), sublabel: inr(r.total_billed_amount) ?? undefined,
      args: { ...args, site_exact: site, month: Number(r.billing_month.slice(5, 7)), year: Number(r.billing_month.slice(0, 4)) },
    }));

    if (!args.month) return { kind: 'clarify', question: `Which billing month for ${site}?`, options: monthOptions(rows) };
    let matches = rows.filter(r => Number(r.billing_month.slice(5, 7)) === Number(args.month));
    if (args.year) matches = matches.filter(r => Number(r.billing_month.slice(0, 4)) === Number(args.year));
    if (!matches.length) {
      return { kind: 'clarify', question: `No ${MONTHS[Number(args.month) - 1] ?? ''} ${args.year ?? ''} invoice found for ${site}. Available months:`.replace(/\s+/g, ' '), options: monthOptions(rows) };
    }
    const row = matches[0]; // latest year with that month
    const bm = String(row.billing_month).slice(0, 10);
    const next = new Date(Date.UTC(+bm.slice(0, 4), +bm.slice(5, 7), 1)).toISOString().slice(0, 10);

    const { data: procRows } = await ctx.sb.from('site_invoice_tracker')
      .select('billing_cycle, manager_tentative_date, manager_received_date, hr_received_date, invoice_prepared_date, invoice_sent_date, invoice_sent_method_remarks, ops_incharge, invoice_incharge')
      .eq('site_name', site).is('deleted_at', null)
      .gte('manager_tentative_date', bm).lt('manager_tentative_date', next)
      .order('manager_tentative_date', { ascending: false }).limit(1);
    const proc = procRows?.[0];

    const facts = {
      site, company: row.company_name, billing_month: monthLabel(bm),
      contract_amount: inr(row.contract_amount), contract_management_fee: inr(row.contract_management_fee),
      billed_amount: inr(row.billed_amount), billed_management_fee: inr(row.billed_management_fee),
      TOTAL_INVOICE_VALUE: inr(row.total_billed_amount), approval_status: row.status, remarks: row.remarks || null,
      invoice_process: proc ? {
        billing_cycle: proc.billing_cycle,
        attendance_from_manager: prettyDate(proc.manager_received_date), attendance_from_hr: prettyDate(proc.hr_received_date),
        invoice_prepared: prettyDate(proc.invoice_prepared_date), invoice_sent: prettyDate(proc.invoice_sent_date) ?? 'not sent yet',
        sent_via: proc.invoice_sent_method_remarks || null, ops_incharge: proc.ops_incharge, invoice_incharge: proc.invoice_incharge,
      } : 'no invoice-tracker entry for this month',
    };
    const table = { columns: ['Item', 'Amount'], rows: [
      ['Contract amount', inr(row.contract_amount)], ['Contract management fee', inr(row.contract_management_fee)],
      ['Billed amount', inr(row.billed_amount)], ['Billed management fee', inr(row.billed_management_fee)],
      ['Total invoice value', inr(row.total_billed_amount)],
    ] as (string | number | null)[][] };
    return { kind: 'answer', facts, sourceLabel: `Billing · ${site} · ${monthLabel(bm)}`, table };
  }),
};

export const attendanceTools: AssistTool[] = [attendanceSummary, whereabouts, siteInvoice];
