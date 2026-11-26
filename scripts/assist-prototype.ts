/**
 * Paradigm Assist — role-aware answer PROTOTYPE (read-only, does not touch the live chatbot)
 *
 * Usage:
 *   npx tsx scripts/assist-prototype.ts --as "<asker name or email>" "how many days did kavya work"
 *   npx tsx scripts/assist-prototype.ts --as "<asker>" --pick 2 "how many days did kavya work last month"
 *   npx tsx scripts/assist-prototype.ts --as "<asker>" "minimum wage for security guards in karnataka"
 *   npx tsx scripts/assist-prototype.ts --list-askers            (shows some users per role to test with)
 *
 * Flow: resolve asker scope → Gemini picks a tool → find employee inside scope → disambiguate → compute → answer
 *       or: not a Paradigm-data question → Gemini + Google Search (never sends employee names to the web)
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import readline from 'readline';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const GEMINI_KEYS = [1, 2, 3, 4, 5].map(i => process.env[`VITE_API_KEY_${i}`]).filter(Boolean) as string[];
const GEMINI_MODEL = 'gemini-2.5-flash';

// ---------------------------------------------------------------------------- args
const argv = process.argv.slice(2);
const flag = (n: string) => { const i = argv.indexOf(n); if (i < 0) return undefined; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const askerArg = flag('--as');
// --pick can be given several times (or "1,3") for multi-step questions: e.g. site, then month
const picks: number[] = [];
for (let p = flag('--pick'); p !== undefined; p = flag('--pick')) picks.push(...p.split(',').map(Number));
const listAskers = argv.includes('--list-askers'); if (listAskers) argv.splice(argv.indexOf('--list-askers'), 1);
const question = argv.join(' ').trim();

// ---------------------------------------------------------------------------- data
type U = { id: string; name: string; email: string; role_id: string; location_id: string | null; status: string | null;
  reporting_manager_id: string | null; second_reporting_manager_id: string | null; reporting_manager_2_id: string | null; reporting_manager_3_id: string | null };

async function loadAll<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// ---------------------------------------------------------------------------- 1. access scope
const ALL_ACCESS = new Set(['admin', 'super_admin', 'developer', 'management', 'director', 'chief_experience_officer',
  'hr', 'hr_ops', 'hr_onboaring', 'hr_recruitment']);
const TEAM_ACCESS = new Set(['operation_manager', 'reporting_manager', 'site_manager', 'field_officer',
  'technical_manager', 'technical_supervisor', 'admin_manager']);

type Scope = { level: 'all' | 'team' | 'self' | 'none'; userIds: Set<string>; why: string };

function resolveScope(asker: U, users: U[], matrix: any[]): Scope {
  if (asker.role_id === 'unverified') return { level: 'none', userIds: new Set(), why: 'unverified account' };
  if (ALL_ACCESS.has(asker.role_id)) return { level: 'all', userIds: new Set(users.map(u => u.id)), why: `role "${asker.role_id}" = organisation-wide` };
  if (!TEAM_ACCESS.has(asker.role_id)) return { level: 'self', userIds: new Set([asker.id]), why: `role "${asker.role_id}" = own records only` };

  // team = everyone who reports to me directly or indirectly (any of the 4 manager columns)
  const ids = new Set([asker.id]);
  let frontier = [asker.id];
  while (frontier.length) {
    const next = users.filter(u => !ids.has(u.id) && frontier.some(f =>
      [u.reporting_manager_id, u.second_reporting_manager_id, u.reporting_manager_2_id, u.reporting_manager_3_id].includes(f)));
    next.forEach(u => ids.add(u.id));
    frontier = next.map(u => u.id);
  }
  const teamCount = ids.size - 1;
  // + staff at sites allocated to me in the Site Responsibility Matrix
  const mySites = new Set(matrix.filter(m => m.is_active !== false && [m.ops_manager_id, m.site_manager_id, m.field_officer_id,
    m.site_supervisor_id, m.hr_incharge_id].includes(asker.id)).map(m => m.site_id));
  users.filter(u => u.location_id && mySites.has(u.location_id)).forEach(u => ids.add(u.id));
  return { level: 'team', userIds: ids, why: `role "${asker.role_id}": ${teamCount} reportees (recursive) + staff at ${mySites.size} allocated site(s)` };
}

// ---------------------------------------------------------------------------- 2. tools
const IST = 5.5 * 3600 * 1000;
const istDate = (ts: string) => new Date(new Date(ts).getTime() + IST).toISOString().slice(0, 10);

function periodRange(period: string, start?: string, end?: string) {
  const now = new Date(Date.now() + IST);
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const d = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd)).toISOString().slice(0, 10);
  const today = d(y, m, now.getUTCDate());
  switch (period) {
    case 'today': return { from: today, to: today, label: `today (${today})` };
    case 'yesterday': { const yd = d(y, m, now.getUTCDate() - 1); return { from: yd, to: yd, label: `yesterday (${yd})` }; }
    case 'last_month': return { from: d(y, m - 1, 1), to: d(y, m, 0), label: new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric' }) };
    case 'this_year': return { from: d(y, 0, 1), to: today, label: `${y} so far` };
    case 'custom': if (start && end) return { from: start, to: end, label: `${start} to ${end}` };
    // fallthrough
    default: return { from: d(y, m, 1), to: today, label: `${now.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })} (1st to today)` };
  }
}

async function attendanceSummary(userId: string, from: string, to: string) {
  const startUtc = new Date(new Date(`${from}T00:00:00Z`).getTime() - IST).toISOString();
  const endUtc = new Date(new Date(`${to}T23:59:59Z`).getTime() - IST).toISOString();
  const { data, error } = await sb.from('attendance_events').select('timestamp, type, location_name, is_manual')
    .eq('user_id', userId).gte('timestamp', startUtc).lte('timestamp', endUtc).order('timestamp');
  if (error) throw new Error(error.message);
  const byDay = new Map<string, { in?: string; out?: string; manual: boolean; sites: Set<string> }>();
  for (const e of data ?? []) {
    const day = istDate(e.timestamp);
    const r = byDay.get(day) ?? { manual: false, sites: new Set() };
    if (e.type === 'punch-in' && !r.in) r.in = e.timestamp;
    if (e.type === 'punch-out') r.out = e.timestamp;
    if (e.is_manual) r.manual = true;
    if (e.location_name) r.sites.add(e.location_name);
    byDay.set(day, r);
  }
  const worked = [...byDay.entries()].filter(([, r]) => r.in);
  const t = (ts?: string) => ts ? new Date(new Date(ts).getTime() + IST).toISOString().slice(11, 16) + ' IST' : 'not punched';
  if (from === to) {
    const r = byDay.get(from);
    return { present: !!r?.in, punch_in: t(r?.in), punch_out: t(r?.out), is_manual_entry: !!r?.manual, sites: [...(r?.sites ?? [])],
      hours_worked: r?.in && r?.out ? +((new Date(r.out).getTime() - new Date(r.in).getTime()) / 3.6e6).toFixed(1) : null,
      all_events: (data ?? []).map(e => `${t(e.timestamp)} ${e.type}${e.location_name ? ' @ ' + e.location_name : ''}`) };
  }
  const hours = worked.map(([, r]) => r.in && r.out ? (new Date(r.out).getTime() - new Date(r.in).getTime()) / 3.6e6 : 0).filter(h => h > 0 && h < 24);
  return {
    days_worked: worked.length,
    days_with_missing_punch_out: worked.filter(([, r]) => !r.out).length,
    manual_entry_days: worked.filter(([, r]) => r.manual).length,
    avg_hours_per_day: hours.length ? +(hours.reduce((a, b) => a + b, 0) / hours.length).toFixed(1) : null,
    first_day: worked[0]?.[0] ?? null, last_day: worked.at(-1)?.[0] ?? null,
    sites: [...new Set(worked.flatMap(([, r]) => [...r.sites]))].slice(0, 5),
  };
}

// whereabouts: punches + GPS stops (>=15 min within 200 m) named after the nearest Paradigm site
const distM = (a: number, b: number, c: number, d: number) => {
  const R = 6371000, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
async function whereabouts(userId: string, day: string, locs: any[]) {
  const s = new Date(new Date(`${day}T00:00:00Z`).getTime() - IST).toISOString(), e = new Date(new Date(`${day}T23:59:59Z`).getTime() - IST).toISOString();
  const [{ data: ev }, pings] = await Promise.all([
    sb.from('attendance_events').select('timestamp, type, location_name').eq('user_id', userId).gte('timestamp', s).lte('timestamp', e).order('timestamp'),
    (async () => { const out: any[] = []; for (let f = 0; ; f += 1000) {
      const { data } = await sb.from('route_history').select('timestamp, latitude, longitude, accuracy').eq('user_id', userId).gte('timestamp', s).lte('timestamp', e).order('timestamp').range(f, f + 999);
      out.push(...(data ?? [])); if (!data || data.length < 1000) return out; } })(),
  ]);
  const t = (ts: string) => new Date(new Date(ts).getTime() + IST).toISOString().slice(11, 16);
  const place = (lat: number, lng: number) => {
    let best: any = null, bd = Infinity;
    for (const l of locs) { if (l.latitude == null) continue; const d = distM(lat, lng, l.latitude, l.longitude); if (d < bd) { bd = d; best = l; } }
    return best && bd <= Math.max(best.radius ?? 100, 250) ? best.name : `unregistered place (maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)})`;
  };
  const good = pings.filter(p => p.latitude && (p.accuracy == null || p.accuracy < 100));
  const stops: any[] = [];
  let i = 0;
  while (i < good.length) {
    let j = i;
    while (j + 1 < good.length && distM(good[i].latitude, good[i].longitude, good[j + 1].latitude, good[j + 1].longitude) < 200) j++;
    const mins = (new Date(good[j].timestamp).getTime() - new Date(good[i].timestamp).getTime()) / 60000;
    if (mins >= 15) {
      const name = place(good[i].latitude, good[i].longitude);
      const last = stops.at(-1);
      if (last && last.place === name) last.to = t(good[j].timestamp), last.minutes += Math.round(mins);
      else stops.push({ place: name, from: t(good[i].timestamp), to: t(good[j].timestamp), minutes: Math.round(mins) });
    }
    i = j + 1;
  }
  let km = 0; for (let k = 1; k < good.length; k++) { const d = distM(good[k - 1].latitude, good[k - 1].longitude, good[k].latitude, good[k].longitude); if (d < 5000) km += d / 1000; }
  const last = good.at(-1);
  return {
    punches: (ev ?? []).map(x => `${t(x.timestamp)} ${x.type} @ ${x.location_name ?? '—'}`),
    gps_points: pings.length, gps_first: good[0] ? t(good[0].timestamp) : null, gps_last: last ? t(last.timestamp) : null,
    approx_km_travelled: +km.toFixed(1),
    stops_over_15_min: stops,
    last_known_position: last ? `${t(last.timestamp)} at ${place(last.latitude, last.longitude)}` : 'no GPS data',
  };
}

// ---------------------------------------------------------------------------- 3. LLM
async function gemini(body: any) {
  const errs: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const [i, key] of GEMINI_KEYS.entries()) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
      if (r.ok) return r.json();
      errs.push(`key${i + 1}: ${r.status} ${(await r.text()).slice(0, 120).replace(/\s+/g, ' ')}`);
    }
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error(`Gemini failed:\n  ${errs.join('\n  ')}`);
}

const TOOLS = [{
  functionDeclarations: [{
    name: 'get_attendance_summary',
    description: 'Days worked / present / attendance / punches of an employee of Paradigm over a period.',
    parameters: { type: 'OBJECT', properties: {
      person_name: { type: 'STRING', description: 'Employee name as written by user. Empty if the user asks about themselves (I/me/my).' },
      about_self: { type: 'BOOLEAN' },
      period: { type: 'STRING', enum: ['this_month', 'last_month', 'this_year', 'today', 'yesterday', 'custom'], description: 'Default this_month when not stated.' },
      start_date: { type: 'STRING', description: 'YYYY-MM-DD, only for custom' },
      end_date: { type: 'STRING', description: 'YYYY-MM-DD, only for custom' },
    }, required: ['period'] },
  }, {
    name: 'get_employee_whereabouts',
    description: 'WHERE an employee was / is: location, sites visited, GPS route, travel distance on a single day.',
    parameters: { type: 'OBJECT', properties: {
      person_name: { type: 'STRING', description: 'Employee name. Empty if about the user themself.' },
      about_self: { type: 'BOOLEAN' },
      period: { type: 'STRING', enum: ['today', 'yesterday', 'custom'], description: 'Default today.' },
      start_date: { type: 'STRING', description: 'YYYY-MM-DD for custom (single day)' },
    }, required: ['period'] },
  }, {
    name: 'get_site_invoice',
    description: 'Invoice / billing value, billed amount, invoice status or invoice sent date of a client SITE for a billing month.',
    parameters: { type: 'OBJECT', properties: {
      site_name: { type: 'STRING', description: 'Site name as written by the user, e.g. "nikoo homes". Empty if not given.' },
      month: { type: 'INTEGER', description: '1-12. Omit if the user did not say a month.' },
      year: { type: 'INTEGER', description: 'Omit if the user did not say a year.' },
    } },
  }],
}];

// Groq fallback (OpenAI-compatible) when Gemini quota is exhausted
const lowerTypes = (s: any): any => Array.isArray(s) ? s.map(lowerTypes) : s && typeof s === 'object'
  ? Object.fromEntries(Object.entries(s).map(([k, v]) => [k, k === 'type' && typeof v === 'string' ? v.toLowerCase() : lowerTypes(v)])) : s;
async function groq(messages: any[], withTools: boolean) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'openai/gpt-oss-120b', temperature: 0, messages,
      ...(withTools ? { tools: TOOLS[0].functionDeclarations.map(f => ({ type: 'function', function: lowerTypes(f) })), tool_choice: 'auto' } : {}) }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).choices[0].message;
}

async function planQuestion(q: string) {
  try { return await planGemini(q); } catch (e: any) {
    console.log(`  (Gemini unavailable: ${e.message.split('\n')[1]?.trim().slice(0, 60)} → using Groq)`);
    const sys = `You route questions for Paradigm Facility Management's internal assistant. Today is ${new Date().toISOString().slice(0, 10)}. If the question is about a Paradigm employee's attendance/days worked, or a client site's invoice/billing, call the matching tool. Never guess missing arguments — leave them out. Otherwise reply GENERAL.`;
    const m = await groq([{ role: 'system', content: sys }, { role: 'user', content: q }], true);
    const tc = m.tool_calls?.[0];
    return tc ? { tool: tc.function.name, args: JSON.parse(tc.function.arguments || '{}') } : null;
  }
}

async function planGemini(q: string): Promise<{ tool: string; args: any } | null> {
  const res = await gemini({
    systemInstruction: { parts: [{ text: `You route questions for Paradigm Facility Management's internal assistant. Today is ${new Date().toISOString().slice(0, 10)}. If the question is about a Paradigm employee's attendance/days worked, or a client site's invoice/billing, call the matching tool. Never guess missing arguments — leave them out. Otherwise answer with the single word GENERAL.` }] },
    contents: [{ role: 'user', parts: [{ text: q }] }],
    tools: TOOLS, toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
  });
  const fc = res.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall)?.functionCall;
  return fc ? { tool: fc.name, args: fc.args ?? {} } : null;
}

const PHRASE_SYS = 'You are Paradigm Assist. Answer the user ONLY from the JSON facts given. Do not invent numbers. Be short (2-4 lines). Always use the employee\'s full name; never guess gender — use the name or "they" instead of he/she. Mention the period/date. Use markdown bold for key numbers. If facts contain stops, give a short bullet timeline (time range → place, duration) plus km travelled; shorten long street addresses to area + pincode.';
async function phrase(q: string, facts: any) {
  try { return await phraseGemini(q, facts); } catch {
    return (await groq([{ role: 'system', content: PHRASE_SYS }, { role: 'user', content: `Question: ${q}\nFacts: ${JSON.stringify(facts)}` }], false)).content;
  }
}
async function phraseGemini(q: string, facts: any) {
  const res = await gemini({
    systemInstruction: { parts: [{ text: 'You are Paradigm Assist. Answer the user ONLY from the JSON facts given. Do not invent numbers. Be short (2-4 lines). Always use the employee\'s full name; never guess gender — use the name or "they" instead of he/she. Mention the period/date. Use markdown bold for key numbers.' }] },
    contents: [{ role: 'user', parts: [{ text: `Question: ${q}\nFacts: ${JSON.stringify(facts)}` }] }],
  });
  return res.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? JSON.stringify(facts);
}

async function webAnswer(q: string) {
  const res = await gemini({ contents: [{ role: 'user', parts: [{ text: q }] }], tools: [{ google_search: {} }] });
  const cand = res.candidates?.[0];
  const text = cand?.content?.parts?.map((p: any) => p.text).join('') ?? '(no answer)';
  const sources = (cand?.groundingMetadata?.groundingChunks ?? []).map((c: any) => `${c.web?.title} — ${c.web?.uri}`).slice(0, 5);
  return { text, sources };
}

// ---------------------------------------------------------------------------- clarification helper
/** Shows options (chips in the app). Returns 0-based index, or null if the user must re-run with --pick. */
async function choose(options: string[]): Promise<number | null> {
  options.forEach((o, i) => console.log(`  [${i + 1}] ${o}`));
  let n = picks.length ? picks.shift()! : NaN;
  if (Number.isNaN(n) && process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    n = Number(await new Promise<string>(r => rl.question('Pick a number: ', r))); rl.close();
  }
  if (!n || n < 1 || n > options.length) { console.log('\n(re-run with --pick N to choose)'); return null; }
  console.log(`  → you picked [${n}] ${options[n - 1]}`);
  return n - 1;
}

// ---------------------------------------------------------------------------- invoice tool
const FINANCE_ALL = new Set(['admin', 'super_admin', 'developer', 'management', 'director', 'chief_experience_officer',
  'finance', 'finance_manager', 'finance_controller', 'senior_accountant', 'senior_accountant_southwall',
  'accounts_excitative', 'accounts_excitative_invoice', 'accounts_excitative_southwall', 'auditor']);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const inr = (n: number | null | undefined) => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN');

async function invoiceFlow(asker: U, args: any, matrix: any[]) {
  // 1. access: finance/admin = all sites; operation managers = only sites they own in the Responsibility Matrix; others = no
  let allowedSites: Set<string> | 'all';
  if (FINANCE_ALL.has(asker.role_id)) allowedSites = 'all';
  else if (asker.role_id === 'operation_manager')
    allowedSites = new Set(matrix.filter(m => m.ops_manager_id === asker.id).map(m => String(m.site_name).toLowerCase().trim()));
  else { hr('ANSWER'); console.log(`🔒 Invoice and billing data is limited to Finance, Admin and the site's Operations Manager. Your role (${asker.role_id}) can't view it.`); return; }

  const fin = await loadAll<any>('site_finance_tracker', 'site_name, company_name, billing_month, contract_amount, contract_management_fee, billed_amount, billed_management_fee, total_billed_amount, status, remarks, deleted_at');
  const live = fin.filter(r => !r.deleted_at && (allowedSites === 'all' || allowedSites.has(String(r.site_name).toLowerCase().trim())));

  // 2. which site?
  let siteNames = [...new Set(live.map(r => r.site_name as string))].sort();
  if (!args.site_name) {
    hr('CLARIFY'); console.log('Which site do you want the invoice for? (type the site name)'); return;
  }
  const words = String(args.site_name).toLowerCase().split(/\s+/).filter(Boolean);
  const siteMatches = siteNames.filter(s => words.every(w => s.toLowerCase().includes(w)));
  hr('SITE LOOKUP'); console.log(`"${args.site_name}": ${siteMatches.length} site(s) with billing data you can access`);
  if (!siteMatches.length) { hr('ANSWER'); console.log(`I couldn't find billing data for "${args.site_name}" among the sites you have access to.`); return; }
  let site = siteMatches[0];
  if (siteMatches.length > 1) {
    hr('CLARIFY  (chips shown in the app)'); console.log(`Which "${args.site_name}" site do you mean?`);
    const i = await choose(siteMatches); if (i === null) return; site = siteMatches[i];
  }

  // 3. which month?
  const rows = live.filter(r => r.site_name === site).sort((a, b) => b.billing_month.localeCompare(a.billing_month));
  const label = (r: any) => { const [y, m] = r.billing_month.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
  let row: any;
  let candidates = rows;
  if (args.month) candidates = candidates.filter(r => Number(r.billing_month.slice(5, 7)) === Number(args.month));
  if (args.year) candidates = candidates.filter(r => Number(r.billing_month.slice(0, 4)) === Number(args.year));
  if (candidates.length === 1 && args.month) row = candidates[0];
  else {
    hr('CLARIFY  (chips shown in the app)');
    if (!candidates.length) { console.log(`No ${args.month ? MONTHS[args.month - 1] + ' ' : ''}${args.year ?? ''} invoice found for ${site}. Available months:`); candidates = rows; }
    else console.log(`Which month for ${site}?`);
    const list = candidates.slice(0, 6);
    const i = await choose(list.map(label)); if (i === null) return; row = list[i];
  }

  // 4. invoice process status (tracker has no month column → billing month = month of the manager's tentative date)
  const { data: proc } = await sb.from('site_invoice_tracker')
    .select('billing_cycle, manager_tentative_date, manager_received_date, hr_received_date, invoice_prepared_date, invoice_sent_date, invoice_sent_method_remarks, ops_incharge, hr_incharge, invoice_incharge, finance_remarks')
    .eq('site_name', site).is('deleted_at', null)
    .gte('manager_tentative_date', row.billing_month).lt('manager_tentative_date', new Date(Date.UTC(+row.billing_month.slice(0, 4), +row.billing_month.slice(5, 7), 1)).toISOString().slice(0, 10))
    .maybeSingle();

  const facts = {
    site, company: row.company_name, billing_month: label(row),
    contract_amount: inr(row.contract_amount), contract_management_fee: inr(row.contract_management_fee),
    billed_amount: inr(row.billed_amount), billed_management_fee: inr(row.billed_management_fee),
    TOTAL_INVOICE_VALUE: inr(row.total_billed_amount), approval_status: row.status, remarks: row.remarks,
    invoice_process: proc ? { billing_cycle: proc.billing_cycle, attendance_from_manager: proc.manager_received_date, attendance_from_hr: proc.hr_received_date,
      invoice_prepared: proc.invoice_prepared_date, invoice_sent: proc.invoice_sent_date, sent_via: proc.invoice_sent_method_remarks,
      ops_incharge: proc.ops_incharge, invoice_incharge: proc.invoice_incharge } : 'no tracker entry',
  };
  hr('RAW FACTS (from site_finance_tracker + site_invoice_tracker)'); console.log(facts);
  hr(`ANSWER  🗄 Paradigm database · Billing · ${site} · ${label(row)}`); console.log(await phrase(args.__q, facts));
}

// ---------------------------------------------------------------------------- main
const hr =(s = '') => console.log(`\n── ${s} ${'─'.repeat(Math.max(0, 70 - s.length))}`);

async function main() {
  const [users, matrix, locations] = await Promise.all([
    loadAll<U>('users', 'id, name, email, role_id, location_id, status, reporting_manager_id, second_reporting_manager_id, reporting_manager_2_id, reporting_manager_3_id'),
    loadAll<any>('site_responsibility_matrix', 'site_id, site_name, ops_manager_id, site_manager_id, field_officer_id, site_supervisor_id, hr_incharge_id, is_active'),
    loadAll<any>('locations', 'id, name').catch(() => []),
  ]);
  const siteName = (id: string | null) => (id && (locations.find((l: any) => l.id === id)?.name ?? matrix.find(m => m.site_id === id)?.site_name)) || 'No site';

  if (listAskers) {
    const by: Record<string, U[]> = {};
    users.forEach(u => (by[u.role_id] ??= []).push(u));
    for (const [role, list] of Object.entries(by).sort()) console.log(`${role.padEnd(32)} ${list.slice(0, 3).map(u => u.name).join(' | ')}`);
    return;
  }
  if (!askerArg || !question) { console.log('Usage: npx tsx scripts/assist-prototype.ts --as "<name|email>" [--pick N] "<question>"'); return; }

  // ---- who is asking
  const askerMatches = users.filter(u => u.email?.toLowerCase() === askerArg.toLowerCase() || u.name?.toLowerCase().includes(askerArg.toLowerCase()));
  if (askerMatches.length !== 1) { console.log(`Asker "${askerArg}" matched ${askerMatches.length} users:`, askerMatches.map(u => `${u.name} <${u.email}>`)); return; }
  const asker = askerMatches[0];
  const scope = resolveScope(asker, users, matrix);
  hr('ASKER'); console.log(`${asker.name} (${asker.role_id})\nScope: ${scope.level.toUpperCase()} — ${scope.why} → can see ${scope.userIds.size} people`);
  hr('QUESTION'); console.log(question);

  // ---- route
  const plan = await planQuestion(question);
  hr('ROUTE'); console.log(plan ? `Paradigm DATABASE tool → ${plan.tool}(${JSON.stringify(plan.args)})` : 'Not a Paradigm-data question → WEB SEARCH');

  if (!plan) {
    // privacy guard: never send an employee's name to the web
    const tokens = question.toLowerCase().split(/\W+/).filter(t => t.length >= 4);
    const GENERIC = new Set(['security', 'officer', 'facility', 'manager', 'admin', 'guard', 'supervisor', 'technician', 'senior',
      'junior', 'executive', 'field', 'staff', 'site', 'team', 'paradigm', 'office', 'helper', 'driver', 'test', 'user']);
    const leaked = users.find(u => u.name && u.name.toLowerCase().split(/\s+/).some(n => n.length >= 4 && !GENERIC.has(n) && tokens.includes(n)));
    if (leaked) { hr('ANSWER'); console.log('🔒 This question mentions an employee name, so I won\'t search the web with it. Try asking about their attendance/leave.'); return; }
    const w = await webAnswer(question);
    hr('ANSWER  🌐 From the web'); console.log(w.text); if (w.sources.length) console.log('\nSources:\n- ' + w.sources.join('\n- '));
    return;
  }

  if (plan.tool === 'get_site_invoice') return invoiceFlow(asker, { ...plan.args, __q: question }, matrix);

  // ---- resolve the person (inside scope only)
  let target: U | undefined;
  if (plan.args.about_self || !plan.args.person_name) target = asker;
  else {
    const needle = String(plan.args.person_name).toLowerCase();
    const allMatches = users.filter(u => u.name?.toLowerCase().includes(needle));
    const visible = allMatches.filter(u => scope.userIds.has(u.id));
    hr('PERSON LOOKUP');
    console.log(`"${plan.args.person_name}": ${allMatches.length} in whole DB, ${visible.length} visible to this asker  (the asker never sees the first number)`);
    if (!visible.length) {
      hr('ANSWER');
      console.log(scope.level === 'self' ? '🔒 You can only view your own attendance.' : `I couldn't find anyone named "${plan.args.person_name}" in your team or sites.`);
      return;
    }
    if (visible.length === 1) target = visible[0];
    else {
      hr('CLARIFY  (chips shown in the app)');
      console.log(`Which ${plan.args.person_name} do you mean?`);
      const pick = await choose(visible.map(u => `${u.name} · ${u.role_id} · ${siteName(u.location_id)}${u.status && u.status !== 'active' ? ` · ${u.status}` : ''}`));
      if (pick === null) return;
      target = visible[pick];
      if (!target || !scope.userIds.has(target.id)) { console.log('🔒 Not allowed.'); return; }  // re-check on selection
    }
  }

  // ---- run the tool
  const p = periodRange(plan.args.period, plan.args.start_date, plan.args.end_date);
  if (plan.tool === 'get_employee_whereabouts') {
    // GPS is more sensitive than attendance: HR/finance org-wide access does NOT include it
    const TRACK_ALL = new Set(['admin', 'super_admin', 'developer', 'management', 'director', 'chief_experience_officer']);
    if (target!.id !== asker.id && !TRACK_ALL.has(asker.role_id) && !TEAM_ACCESS.has(asker.role_id)) {
      hr('ANSWER'); console.log(`🔒 Location tracking is limited to Admin and the employee's reporting managers. Your role (${asker.role_id}) can't view it.`); return;
    }
    const locs = await loadAll<any>('locations', 'name, latitude, longitude, radius');
    const facts = { employee: target!.name, role: target!.role_id, date: p.label, ...(await whereabouts(target!.id, p.from, locs)) };
    hr('RAW FACTS (attendance_events + route_history GPS, computed in code)'); console.log(facts);
    hr(`ANSWER  🗄 Paradigm database · Field tracking · ${p.label}`); console.log(await phrase(question, facts));
    return;
  }
  const facts = { employee: target!.name, role: target!.role_id, site: siteName(target!.location_id), period: p.label, from: p.from, to: p.to,
    ...(await attendanceSummary(target!.id, p.from, p.to)) };
  hr('RAW FACTS (computed in code, not by AI)'); console.log(facts);
  hr(`ANSWER  🗄 Paradigm database · Attendance · ${p.label}`); console.log(await phrase(question, facts));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
