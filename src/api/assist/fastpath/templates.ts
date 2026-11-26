/**
 * Deterministic answer templates (no AI). Every tool's facts can be rendered:
 * a specific, human-sounding template per tool and a tidy generic renderer as the last resort.
 * Wording rules: lead with the direct answer in one bold sentence, then a few short bullets;
 * use the person's name, never he/she; no raw keys; notes in one short italic line at the end.
 * Lists are shown by the UI as a table, so text only mentions "the table below".
 */
type F = Record<string, any>;

const b = (x: any) => `**${x}**`;
const fmt = (x: any) => (typeof x === 'number' && Number.isFinite(x) ? x.toLocaleString('en-IN') : String(x));
const plural = (n: number, one: string, many = one + 's') => `${fmt(n)} ${n === 1 ? one : many}`;
const has = (v: any) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

const SKIP = new Set(['note', 'notes', 'rule', 'rules', 'meaning', 'privacy_note', 'filters', 'from', 'to', 'access', 'tip', 'no_entry_meaning', 'scope', 'group', 'about']);
const ACRONYMS: Record<string, string> = { ot: 'OT', gps: 'GPS', hr: 'HR', crm: 'CRM', ppm: 'PPM', ht: 'HT', id: 'ID', wfh: 'WFH', km: 'km', cctv: 'CCTV', gstin: 'GSTIN', pan: 'PAN', pf: 'PF', esi: 'ESI', uan: 'UAN', sla: 'SLA', ist: 'IST', gst: 'GST' };
const humanKey = (k: string) => k.replace(/_/g, ' ').trim().split(/\s+/).map((w, i) => ACRONYMS[w.toLowerCase()] ?? (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join(' ');
/** Keys that look like codes (SNAKE_CASE / snake_case) are humanised; normal labels are kept. */
const nice = (k: string) => (/^[A-Z0-9_]+$/.test(k) || k.includes('_') ? humanKey(k) : k);
const label = humanKey;
const num = (x: any) => (typeof x === 'number' ? x : Number(x));
const isNum = (x: any) => x !== null && x !== undefined && x !== '' && Number.isFinite(num(x));
const nz = (x: any) => isNum(x) && num(x) > 0;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hrs = (x: any) => { const t = String(x).replace(/\s*h$/i, '').trim(); const m = /^(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)$/.exec(t); return `${m && m[1] === m[2] ? m[1] : t} h`; };
const mins = (m: number) => (m >= 60 && m % 60 === 0 ? `${m / 60} h` : m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
const poss = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
const bposs = (name: string) => `**${name}**${/s$/i.test(name) ? "'" : "'s"}`;
const clipNote = (s: any, n = 160) => (typeof s === 'string' && s ? (s.length > n ? s.slice(0, n - 1) + '…' : s) : null);

/** "Earned 52 · Comp Off 12 …" sorted by count. */
function counts(o: any, max = 6): string {
  if (!o || typeof o !== 'object') return '';
  const e = Object.entries(o).filter(([k, v]) => isNum(v) && num(v) > 0 && !/^[—–-]$/.test(k.trim())).sort((a, c) => num(c[1]) - num(a[1]));
  const shown = e.slice(0, max).map(([k, v]) => `${cap(nice(k).trim())} ${fmt(num(v))}`);
  return shown.join(' · ') + (e.length > max ? ` · +${e.length - max} more` : '');
}
const names = (a: any, max = 5): string => {
  const l: string[] = Array.isArray(a) ? a.map(String) : [];
  return l.slice(0, max).join(', ') + (l.length > max ? ` +${l.length - max} more` : '');
};
/** "today (26 Nov 2026)" stays; "November 2026" -> "in November 2026"; "1 Oct 2026 – 31 Oct 2026" -> "between ... and ...". */
function when(p: any): string {
  const s = String(p ?? '').trim();
  if (!s) return '';
  if (/^last \d+ /i.test(s)) return 'in the ' + s;
  if (/^(today|yesterday|tomorrow|this |last |next |upcoming|the last )/i.test(s)) return s;
  if (/^(any time|all time)$/i.test(s)) return 'overall';
  if (/^[A-Za-z]+ \d{4}\s*[–-]\s*[A-Za-z]+ \d{4}$/.test(s)) return 'from ' + s.replace(/\s*[–-]\s*/, ' to ');
  if (/^\d{1,2} \w+ \d{4}\s*[–-]/.test(s)) return 'between ' + s.replace(/\s*[–-]\s*/, ' and ');
  if (/^\d{1,2} \w+ \d{4}$/.test(s)) return 'on ' + s;
  return 'in ' + s;
}
const whenSkipAll = (p: any) => (/^(all time|any time)$/i.test(String(p ?? '')) ? '' : when(p));
/** Headline, then at most 7 bullets, then one short italic note. */
const out = (head: string, bullets: (string | false | null | undefined)[], note?: string | null) => {
  const bl = bullets.filter(Boolean) as string[];
  return [head, ...(bl.length ? ['', ...bl.slice(0, 7).map(x => (x.startsWith('  ') || x.startsWith('- ') ? x : `- ${x}`))] : []), ...(note ? ['', `_${note}_`] : [])].join('\n');
};

function inline(v: any): string {
  if (!has(v)) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) {
    const items = v.slice(0, 8).map(x => (typeof x === 'object' ? Object.values(x).join(' · ') : String(x)));
    return items.join(', ') + (v.length > 8 ? ` … (+${v.length - 8} more)` : '');
  }
  if (typeof v === 'object') {
    return Object.entries(v).filter(([k, x]) => has(x) && !SKIP.has(k)).map(([k, x]) => `${label(k)}: ${typeof x === 'object' ? inline(x) : x}`).join(' · ');
  }
  return String(v);
}

/** Last-resort rendering for a tool without a specific template: one-line summary, tidy bullets, notes last. */
export function renderGeneric(facts: F, sourceLabel: string): string {
  const lines: string[] = [];
  const notes: string[] = [];
  const COUNT_KEYS = ['count', 'total', 'matching', 'total_count', 'total_events', 'records'];
  const ck = COUNT_KEYS.find(k => isNum(facts[k]));
  const labelLc = sourceLabel.toLowerCase();
  for (const [k, v] of Object.entries(facts)) {
    if (!has(v) || k === ck) continue;
    if (SKIP.has(k)) { if (typeof v === 'string' && /^(note|notes|privacy_note|tip)$/.test(k)) notes.push(v); continue; }
    if (typeof v === 'string' && /^(period|month|date|day)$/.test(k) && labelLc.includes(v.toLowerCase().replace(/\s*\(.*\)$/, ''))) continue;   // the badge already shows it
    if (typeof v === 'string' && /^all (sites|employees|people)/i.test(v) && /^(site|group|about|who)$/.test(k)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = Object.entries(v).filter(([ik, iv]) => has(iv) && !SKIP.has(ik));
      if (!inner.length) continue;
      const flat = inner.every(([, iv]) => typeof iv !== 'object' || Array.isArray(iv));
      if (flat && inner.length <= 4) { lines.push(`- **${label(k)}:** ${inline(v)}`); continue; }
      lines.push(`- **${label(k)}:**`);
      for (const [ik, iv] of inner) lines.push(`  - ${nice(ik)}: ${typeof iv === 'number' ? b(iv) : inline(iv)}`);
      for (const [ik, iv] of Object.entries(v)) if ((ik === 'note' || ik === 'rule' || ik === 'meaning') && typeof iv === 'string') notes.push(iv);
      continue;
    }
    lines.push(`- **${label(k)}:** ${typeof v === 'number' ? b(v) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : inline(v)}`);
  }
  const head = ck ? `**${sourceLabel}** — ${b(facts[ck])} ${label(ck).toLowerCase()}` : `**${sourceLabel}**`;
  return [head, '', ...lines, ...(notes.length ? ['', `_${notes.slice(0, 2).join(' ')}_`] : [])].join('\n');
}

// ------------------------------------------------------------------ specific templates
const T: Record<string, (f: F, label: string) => string | null> = {
  get_attendance_summary: f => {
    if ('present' in f) {
      if (!f.present) return `${b(f.employee)} was ${b('not present')} on ${f.date} — no punch-in recorded.`;
      const parts = [`${b(f.employee)} was ${b('present')} on ${f.date}.`, '',
        `- **Punch in:** ${f.punch_in}`, `- **Punch out:** ${f.punch_out}`];
      if (has(f.hours_worked)) parts.push(`- **Hours worked:** ${b(f.hours_worked + ' h')}`);
      if (has(f.sites)) parts.push(`- **Location:** ${Array.isArray(f.sites) ? f.sites.slice(0, 2).join(' → ') : inline(f.sites)}`);
      if (f.manual_entry) parts.push('- ⚠ Includes a **manual** attendance entry');
      return parts.join('\n');
    }
    const parts = [`${b(f.employee)} worked ${b(plural(f.days_worked ?? 0, 'day'))} ${when(f.period)}.`, ''];
    if (has(f.avg_hours_per_day)) parts.push(`- **Average hours/day:** ${f.avg_hours_per_day} h`);
    if (f.days_with_missing_punch_out) parts.push(`- **Days without punch-out:** ${f.days_with_missing_punch_out}`);
    if (f.manual_entry_days) parts.push(`- **Manual entry days:** ${f.manual_entry_days}`);
    if (has(f.first_day_worked)) parts.push(`- **First / last day worked:** ${f.first_day_worked} → ${f.last_day_worked}`);
    return parts.join('\n');
  },

  get_employee_whereabouts: f => {
    const stops: any[] = f.stops_over_15_min ?? [];
    const parts = [`${b(f.employee)} — ${f.date}`, ''];
    if (has(f.working_window)) parts.push(`- **Working hours:** ${f.working_window}`);
    if (stops.length) {
      parts.push('- **Stops (15 min or more):**');
      for (const s of stops) parts.push(`  - ${s.from}–${s.to} → ${s.place} (${s.minutes >= 60 ? `${Math.floor(s.minutes / 60)} h ${s.minutes % 60} min` : `${s.minutes} min`})`);
    } else parts.push('- No stops of 15 minutes or more recorded.');
    if (has(f.approx_km_travelled)) parts.push(`- **Distance travelled:** ≈ ${b(f.approx_km_travelled + ' km')}`);
    if (has(f.last_known_position)) parts.push(`- **Last known position:** ${f.last_known_position}`);
    if (!f.gps_points) parts.push('- No GPS points were recorded for this day.');
    if (has(f.privacy_note)) parts.push('', `_${f.privacy_note}_`);
    return parts.join('\n');
  },

  get_site_invoice: f => {
    const p = f.invoice_process ?? {};
    const parts = [`${b(f.site)} · ${f.billing_month} — total invoice value ${b(f.TOTAL_INVOICE_VALUE ?? '—')}`, '',
      `- **Billed:** ${f.billed_amount ?? '—'} + management fee ${f.billed_management_fee ?? '—'}`,
      `- **Contract:** ${f.contract_amount ?? '—'} + management fee ${f.contract_management_fee ?? '—'}`,
      `- **Approval:** ${f.approval_status ?? '—'}${has(f.company) ? ` · Company: ${f.company}` : ''}`];
    if (typeof p === 'object' && Object.keys(p).length) {
      parts.push(`- **Invoice:** ${p.invoice_sent ? `sent ${p.invoice_sent}` : 'not sent yet'}${p.invoice_prepared ? ` (prepared ${p.invoice_prepared})` : ''}`);
      if (p.ops_incharge || p.invoice_incharge) parts.push(`- **In-charge:** Ops ${p.ops_incharge ?? '—'} · Invoice ${p.invoice_incharge ?? '—'}`);
    }
    return parts.join('\n');
  },

  get_leave_balance: f => {
    const rows: string[] = [];
    const add = (name: string, o: any, avail = 'available') => { if (o && typeof o === 'object' && has(o[avail])) rows.push(`- **${name}:** ${b(o[avail])} available${has(o.used) ? ` · used ${o.used}` : ''}${o.pending ? ` · pending ${o.pending}` : ''}`); };
    add('Earned leave', f.earned_leave); add('Sick leave', f.sick_leave); add('Comp off', f.comp_off);
    if (f.blue_leave?.eligible) add('Blue leave', f.blue_leave);
    if (f.pink_leave) add('Pink leave', f.pink_leave);
    if (f.child_care_leave) add('Child care leave', f.child_care_leave);
    if (!rows.length) return null;
    const KEY: Record<string, [string, string]> = { earned: ['earned_leave', 'earned leave'], sick: ['sick_leave', 'sick leave'], comp_off: ['comp_off', 'comp off'], blue: ['blue_leave', 'blue leave'], pink: ['pink_leave', 'pink leave'] };
    const ask = KEY[String(f.asked_about ?? '')];
    const o = ask ? f[ask[0]] : null;
    if (o && typeof o === 'object' && has(o.available)) {
      const extra = [nz(o.used) && `used ${o.used}`, nz(o.pending) && `${o.pending} pending approval`, isNum(o.total_accrued) && `${o.total_accrued} accrued so far`, isNum(o.total) && !isNum(o.total_accrued) && `${o.total} in total`, isNum(o.max_pool) && `pool capped at ${o.max_pool}`].filter(Boolean);
      return out(`**${f.employee}** has **${o.available} ${num(o.available) === 1 ? 'day' : 'days'}** of ${ask![1]} available as of ${f.as_of}.`, [
        extra.length > 0 && `**Details:** ${extra.join(' · ')}`,
        nz(o.accrued_this_month) && `**Accrued this month:** ${o.accrued_this_month}`,
        has(o.status) && `${o.status}`,
      ]);
    }
    return [`Leave balance of ${b(f.employee)} as of ${f.as_of}:`, '', ...rows, ...(f.loss_of_pay_days_this_year ? [`- **Loss of pay this year:** ${f.loss_of_pay_days_this_year} days`] : [])].join('\n');
  },

  get_employee_profile: f => {
    // lead with what was asked: "isaac phone number" → the phone line first
    const asked: string[] = Array.isArray(f.asked_fields) ? f.asked_fields : [];
    let lead = '';
    if (asked.includes('phone')) lead = has(f.phone) ? `${b(f.name)}'s phone: ${b(f.phone)}${has(f.email) ? ` · email ${f.email}` : ''}`
      : has(f.contact) ? `🔒 ${f.contact}` : `No phone number is recorded for ${b(f.name)}.`;
    else if (asked.includes('manager')) lead = has(f.reporting_manager) ? `${b(f.name)} reports to ${b(f.reporting_manager)}.` : `No reporting manager is set for ${b(f.name)}.`;
    else if (asked.includes('joining_date')) lead = has(f.joining_date) ? `${b(f.name)} joined on ${b(f.joining_date)}.` : `No joining date is recorded for ${b(f.name)}.`;
    const parts = [...(lead ? [lead, ''] : []), `${b(f.name)} — ${f.role ?? ''}${f.status && f.status !== 'active' ? ` (${f.status})` : ''}`, ''];
    if (has(f.reporting_manager)) parts.push(`- **Reporting manager:** ${f.reporting_manager}${has(f.second_reporting_manager) ? ` (2nd: ${f.second_reporting_manager})` : ''}`);
    if (has(f.site_count)) parts.push(`- **Sites responsible for:** ${f.site_count}`);
    if (has(f.joining_date)) parts.push(`- **Joined:** ${f.joining_date}`);
    if (has(f.direct_reports)) parts.push(`- **Direct reports:** ${f.direct_reports}`);
    if (has(f.phone)) parts.push(`- **Phone:** ${f.phone}`);
    if (has(f.email)) parts.push(`- **Email:** ${f.email}`);
    if (has(f.company)) parts.push(`- **Company:** ${f.company}`);
    return parts.join('\n');
  },


  get_leave_requests: f => {
    if ('pending_count' in f) {
      const c = num(f.pending_count);
      return out(`**${plural(c, 'request')}** ${c === 1 ? 'is' : 'are'} waiting for your approval.`, [
        has(f.by_type) && `**Types:** ${counts(f.by_type)}`,
        nz(f.attendance_corrections_and_permissions) && `**Of these:** ${f.leave_requests ?? 0} leave and ${f.attendance_corrections_and_permissions} attendance correction / permission`,
        has(f.oldest_request) && `⚠ **Oldest request:** raised ${f.oldest_request}`,
        has(f.employees) && `**From:** ${names(f.employees, 6)}`,
        'Details are in the table below.',
      ]);
    }
    if ('people_on_leave' in f) {
      const p = num(f.people_on_leave);
      return out(`**${plural(p, 'person', 'people')}** ${p === 1 ? 'is' : 'are'} on leave ${when(f.period)}${has(f.scope) ? ` ${f.scope}` : ''}.`, [
        `**Requests:** ${f.approved ?? 0} approved · ${f.pending_approval ?? 0} pending approval`,
        has(f.by_type) && `**By type:** ${counts(f.by_type)}`,
        nz(f.work_from_home) && `**Working from home:** ${plural(num(f.work_from_home), 'person', 'people')}`,
        'Details are in the table below.',
      ]);
    }
    if ('requests' in f && has(f.employee)) {
      const corr = num(f.corrections_and_permissions ?? 0);
      const leaves = num(f.requests) - corr;
      const days = num(f.approved_leave_days_total ?? 0);
      const head = days > 0
        ? `**${f.employee}** has taken **${days} ${days === 1 ? 'day' : 'days'}** of approved leave ${when(f.period)}.`
        : `**${f.employee}** has no approved leave days ${when(f.period)}.`;
      return out(head, [
        has(f.approved_leave_days_by_type) && `**By type:** ${Object.entries(f.approved_leave_days_by_type).map(([k, v]) => `${k} ${v}`).join(' · ')}`,
        leaves > 0 && `**Leave requests:** ${leaves}${has(f.by_status) && corr === 0 ? ` (${counts(f.by_status)})` : ''}`,
        nz(f.pending) && `⚠ **Pending approval:** ${f.pending}`,
        corr > 0 && `**Attendance corrections / permissions:** ${corr}`,
        'Request-wise details are in the table below.',
      ], 'Days are calendar days within the period; a half day counts as 0.5.');
    }
    return null;
  },

  get_overtime: f => {
    if ('group' in f || 'people_with_ot' in f) {
      const p = num(f.people_with_ot ?? 0);
      if (!p) return out(`**Nobody** logged overtime ${when(f.period)} (${f.group ?? 'all employees'}).`, [nz(f.total_extra_work_claims) && `**Extra-work claims:** ${f.total_extra_work_claims}`]);
      return out(`**${plural(p, 'person', 'people')}** out of ${f.of_people ?? '—'} logged overtime ${when(f.period)}${num(f.total_site_ot_hours) > 0 ? `, **${f.total_site_ot_hours} h** of site OT in total` : ''}.`, [
        `**Site OT days:** ${f.total_site_ot_days ?? 0} · **Breakdown visits:** ${f.total_breakdown_visits ?? 0}`,
        nz(f.total_ot_cycle_punch_days) && `**OT-cycle punch days:** ${f.total_ot_cycle_punch_days}`,
        nz(f.total_extra_work_claims) && `**Extra-work claims:** ${f.total_extra_work_claims}`,
        has(f.top) && `**Highest:** ${names(f.top, 3)}`,
        'Employee-wise details are in the table below.',
      ], 'Sessions of 5 h or less count as breakdown visits.');
    }
    const h = num(f.site_ot_hours ?? 0);
    const any = h > 0 || nz(f.breakdown_visits) || nz(f.ot_cycle_punch_days) || nz(f.extra_work_claims);
    const head = any
      ? `**${f.employee}** logged **${f.site_ot_hours_label ?? h + ' h'}** of site overtime ${when(f.period)}.`
      : `**${f.employee}** has no overtime recorded ${when(f.period)}.`;
    return out(head, [
      any && `**Site OT days:** ${f.site_ot_days ?? 0} · **Breakdown visits:** ${f.breakdown_visits ?? 0}`,
      nz(f.ot_cycle_punch_days) && `**OT-cycle punches:** ${f.ot_cycle_punch_days} ${num(f.ot_cycle_punch_days) === 1 ? 'day' : 'days'} (${f.ot_cycle_punch_hours ?? 0} h)`,
      nz(f.extra_work_claims) && `**Extra-work claims:** ${f.extra_work_claims} (${f.claims_approved ?? 0} approved, ${f.claims_pending ?? 0} pending${nz(f.claimed_hours) ? `, ${f.claimed_hours} h claimed` : ''})`,
      isNum(f.ot_hours_bank) && `**OT hours bank:** ${f.ot_hours_bank} h (legacy balance)`,
    ], any ? 'Sessions of 5 h or less count as breakdown visits.' : null);
  },

  get_billing_totals: f => {
    if (!has(f.total_billed)) return null;
    const diff = String(f.billed_minus_contract ?? '');
    const neg = diff.startsWith('-');
    const gap = diff && diff.replace(/^-/, '') !== '₹0' ? `${diff.replace(/^-/, '')} ${neg ? 'below' : 'above'} contract` : 'in line with contract';
    const bm: any[] = Array.isArray(f.by_month) ? f.by_month : [];
    const subject = has(f.site) ? `**${f.total_billed}** billed for **${f.site}** ${when(f.period)}` : `**${f.total_billed}** billed ${when(f.period)}`;
    const span = has(f.site) ? (bm.length ? ` over ${plural(bm.length, 'month')}` : '') : ` across ${plural(num(f.sites ?? f.records), 'site')}`;
    const lastM = bm[bm.length - 1];
    const dupN = has(f.duplicate_tracker_rows_ignored) ? String(f.duplicate_tracker_rows_ignored).split(' ')[0] : '';
    const noteBits = [nz(f.records_with_unknown_company) && `${f.records_with_unknown_company} records have no company set`, dupN && `${dupN} duplicate tracker rows were counted once`].filter(Boolean);
    return out(`${subject}${span} — ${gap}.`, [
      `**Contract value:** ${f.total_contract_value ?? '—'}`,
      has(f.approval_status) && `**Approval:** ${counts(f.approval_status)}`,
      Array.isArray(f.by_company) && f.by_company.length > 0 && `**Top company:** ${f.by_company[0].company} — ${f.by_company[0].billed} (${plural(num(f.by_company[0].sites), 'site')})`,
      has(f.ranking) && `**Ranking:** ${f.ranking}`,
      !!lastM && `**Latest month, ${lastM.month}:** ${lastM.billed}${lastM.change_vs_previous_month ? ` — ${String(lastM.change_vs_previous_month).replace(/^([+-]?₹[\d,.]+) \(([^)]+)\)$/, '$1, $2')} vs the month before` : ''}`,
      has(f.latest_month) && !lastM && `**Latest month, ${f.latest_month.month}:** ${f.latest_month.billed}`,
      (Array.isArray(f.by_company) || Array.isArray(f.sites_ranked) || Array.isArray(f.by_status) || bm.length > 0) && 'The breakdown is in the table below.',
    ], noteBits.length ? noteBits.join('; ') + '.' : null);
  },

  list_invoice_status: f => {
    const st = f.filters?.status ?? 'all';
    const mth = f.billing_month ?? '';
    const total = num(f.sites_in_tracker ?? 0);
    const noEntry = num(f.expected_sites_with_no_tracker_entry_yet ?? 0);
    const spec: Record<string, [string, string, string]> = {
      not_sent: ['not_sent_count', 'has not been sent yet', 'have not been sent yet'], sent_late: ['sent_late_count', 'was sent late', 'were sent late'], overdue: ['overdue_count', 'is overdue (past the sharing due date)', 'are overdue (past the sharing due date)'],
      attendance_pending: ['attendance_pending_count', 'is waiting for attendance', 'are waiting for attendance'], sent: ['sent_count', 'has been sent', 'have been sent'], all: ['all_count', 'is in the tracker', 'are in the tracker'],
    };
    const [key, one, many] = spec[st] ?? spec.all;
    const c = num(f[key] ?? total);
    const siteList = f[key.replace('_count', '_sites')];
    let head: string;
    if (total === 0) head = `**No invoices** have been entered in the tracker for ${mth} yet.`;
    else if (c === 0) head = st === 'not_sent' ? `**Every invoice** in the tracker for ${mth} has been sent.` : st === 'sent' ? `**No invoices** have been sent yet for ${mth}.` : `**No invoices** ${many.replace(/^(have not been sent yet)/, 'are pending')} for ${mth}.`;
    else if (st === 'all') head = `**${f.sent ?? 0} of ${total}** sites have sent their ${mth} invoice.`;
    else head = `**${plural(c, 'invoice')}** ${c === 1 ? one : many} for ${mth}.`;
    return out(head, [
      st !== 'all' && st !== 'sent' && c > 0 && Array.isArray(siteList) && c <= 6 && `**Sites:** ${names(siteList, 6)}`,
      st !== 'all' && st !== 'sent' && total > 0 && `**Sent so far:** ${f.sent ?? 0} of ${total} sites`,
      st === 'sent' && total > 0 && `**Out of:** ${total} sites in the tracker`,
      nz(f.not_sent) && st !== 'not_sent' && `⚠ **Not sent:** ${f.not_sent}${nz(f.overdue_not_sent) ? ` (${f.overdue_not_sent} overdue)` : ''}`,
      nz(f.sent_late) && st !== 'sent_late' && `**Sent late:** ${f.sent_late}`,
      nz(f.attendance_pending) && st !== 'attendance_pending' && `**Attendance pending:** ${f.attendance_pending}`,
      noEntry > 0 && `**No tracker entry yet:** ${noEntry} sites have nothing entered for ${mth}`,
      has(f.by_company) && `**By company:** ${Object.entries(f.by_company).map(([k, v]: any) => `${k} ${v.sent}/${v.sites} sent`).join(' · ')}`,
      c > 0 && st !== 'all' && 'The site list is in the table below.',
      c > 0 && st === 'all' && 'Site-wise status is in the table below.',
    ]);
  },

  get_performance_scores: f => {
    if (has(f.employee)) {
      const delta = isNum(f.previous_month) && isNum(f.overall) ? num(f.overall) - num(f.previous_month) : null;
      return out(`**${f.employee}** scores **${f.overall}/100** overall for ${f.month}.`, [
        `**Attendance:** ${f.attendance ?? '—'} · **Performance:** ${f.performance ?? '—'} · **Response:** ${f.response ?? '—'}`,
        has(f.rank_in_category) && `**Rank:** ${f.rank_in_category}${has(f.category) ? ` in ${f.category}` : ''}`,
        delta !== null && `**Last month:** ${f.previous_month} (${delta === 0 ? 'unchanged' : `${delta > 0 ? '+' : ''}${delta} points`})`,
        has(f.calculated) && `**Calculated:** ${f.calculated}`,
        'The month-wise trend is in the table below.',
      ]);
    }
    if (has(f.ranking)) {
      return out(`**${cap(String(f.ranking))}** for ${f.month}.`, [
        `**People scored:** ${f.people_scored ?? '—'} · **Average:** ${f.average ?? '—'}`,
        'The ranked list is in the table below.',
      ]);
    }
    return null;
  },

  get_shift_and_weekly_off: f => {
    if (has(f.staff) && has(f.weekly_off) && !has(f.employee)) {
      return out(`**${f.staff}**'s weekly off is **${f.weekly_off}**.`, [
        has(f.site) && `**Site:** ${f.site}${has(f.department) ? ` · ${f.department}` : ''}`,
        has(f.effective_from) && `**Effective from:** ${f.effective_from}`,
        has(f.source) && `**Source:** ${f.source}`,
      ]);
    }
    if ('biometric_shifts' in f) {
      const g = f.grace_minutes_by_shift ?? {};
      const vals = Object.values(g).filter(isNum).map(num);
      const same = vals.length > 0 && vals.every(v => v === vals[0]);
      const cat = f.rules_by_staff_category ?? {};
      const catLine = (k: string, lab: string) => {
        const r = cat[k]; if (!r || typeof r !== 'object') return false;
        const bits = [has(r.daily_working_hours) && `${hrs(r.daily_working_hours)} a day`, has(r.full_day_min_hours) && `full day at ${r.full_day_min_hours} h`, has(r.half_day_min_hours) && `half day at ${r.half_day_min_hours} h`, has(r.office_check_out_time) && `check-out ${r.office_check_out_time}`].filter(Boolean);
        return bits.length ? `**${lab}:** ${bits.join(' · ')}` : false;
      };
      const head = same ? `**Grace time is ${vals[0]} minutes** on all ${f.biometric_shifts} biometric shifts.` : `**${plural(num(f.biometric_shifts), 'biometric shift')}** are configured across ${plural(num(f.shift_groups ?? 0), 'shift group')}.`;
      return out(head, [
        !same && has(g) && `**Grace minutes:** ${Object.entries(g).map(([k, v]) => `${k} ${v}`).join(' · ')}`,
        isNum(f.site_staff_grace_minutes) && `**Site staff grace:** ${f.site_staff_grace_minutes} min`,
        catLine('office', 'Office staff'), catLine('field', 'Field staff'), catLine('site', 'Site staff'),
        'The shift timings are in the table below.',
      ]);
    }
    if (!has(f.weekly_off)) return null;
    const rec = Array.isArray(f.recurring_holidays) && f.recurring_holidays.length ? ` Recurring holiday: ${f.recurring_holidays.join(', ')}.` : '';
    const r = f.rules ?? {};
    const sites: any[] = Array.isArray(r.site_shifts) ? r.site_shifts : [];
    return out(`${bposs(f.employee)} weekly off is **${f.weekly_off}**.${rec}`, [
      has(r.daily_working_hours) && `**Working hours:** ${hrs(r.daily_working_hours)} per day`,
      (has(r.full_day_min_hours) || has(r.half_day_min_hours)) && `**A day counts as:** full day at ${r.full_day_min_hours ?? '—'} h, half day at ${r.half_day_min_hours ?? '—'} h`,
      has(r.office_check_out_time) && `**Office check-out:** ${r.office_check_out_time}${nz(r.lunch_break_minutes) ? ` (lunch break ${r.lunch_break_minutes} min)` : ''}`,
      nz(r.shift_grace_minutes) && `**Grace time:** ${r.shift_grace_minutes} min`,
      sites.length > 0 && `**Site shifts:** ${sites.map(s => (typeof s === 'object' ? Object.values(s).join(' · ') : s)).slice(0, 4).join('; ')}`,
      has(f.weekly_off_source) && `**Based on:** ${f.weekly_off_source}`,
    ], clipNote(f.note));
  },

  get_holidays: f => {
    const c = num(f.holidays ?? 0);
    const who = has(f.employee) && f.employee !== 'you' ? ` for ${f.employee}` : '';
    const head = c === 0 ? `**No holidays** ${when(f.period)}${who}.` : `**${plural(c, 'holiday')}** ${when(f.period)}${who}.`;
    const pool: any[] = Array.isArray(f.optional_pool_in_period_not_selected) ? f.optional_pool_in_period_not_selected : [];
    return out(head, [
      has(f.next_holiday) && `**Next holiday:** ${f.next_holiday}`,
      isNum(f.selected_optional_holidays_this_year) && isNum(f.optional_holidays_allowed) && `**Optional holidays picked this year:** ${f.selected_optional_holidays_this_year} of ${f.optional_holidays_allowed} allowed${num(f.selected_optional_holidays_this_year) > num(f.optional_holidays_allowed) ? ' ⚠ over the allowance' : ''}`,
      pool.length > 0 && `**Optional holidays not picked in this period:** ${names(pool, 3)}`,
      nz(f.site_holidays_configured) && `**Site-specific holidays:** ${f.site_holidays_configured}`,
      c > 0 && 'The full list is in the table below.',
    ], 'Company calendar plus the optional holidays picked by the employee; 3rd Saturday applies to eligible Bangalore staff.');
  },

  get_site_summary: f => {
    if (!has(f.site)) return null;
    const bs = f.billing_setup ?? {}, rp = f.responsible_people ?? {}, st = f.staff ?? {}, td = f.today ?? {}, tk = f.open_tickets ?? {}, li = f.last_invoice ?? {};
    const sub = [has(bs.units) && `${fmt(num(bs.units))} units`, has(bs.cycle) && bs.cycle, has(bs.company) && bs.company].filter(Boolean).join(' · ');
    const team = [has(rp.ops_manager) && `Ops ${rp.ops_manager}`, has(rp.hr_incharge) && `HR ${rp.hr_incharge}`, has(rp.accounts_incharge) && `Accounts ${rp.accounts_incharge}`].filter(Boolean).join(' · ');
    return out(`**${f.site}**${sub ? ` — ${sub}` : ''}.`, [
      team && `**In charge:** ${team}`,
      has(td.date) && `**Today (${td.date}):** ${plural(num(td.people_punched_in ?? 0), 'person', 'people')} punched in${nz(st.punched_here_last_30_days) ? ` · ${st.punched_here_last_30_days} people punched here in the last 30 days` : ''}`,
      isNum(tk.count) && `**Open tickets:** ${tk.count}${has(tk.by_priority) ? ` (${counts(tk.by_priority)})` : ''}`,
      has(li.month) && `**Last invoice, ${li.month}:** ${li.value ?? '—'}${has(li.approval_status) ? ` · ${li.approval_status}` : ''}${has(li.sent) ? ` · ${li.sent}` : ''}`,
    ]);
  },

  get_site_info: f => {
    if (has(f.person) && 'sites_total' in f) {
      const self = /\(you\)/.test(String(f.person));
      const nm = String(f.person).replace(/\s*\(you\)/, '');
      const n = num(f.sites_total);
      const head = n === 0
        ? (self ? '**You** are not named on any active site in the Site Responsibility Matrix.' : `**${nm}** is not named on any active site in the Site Responsibility Matrix.`)
        : `**${nm}** ${self ? '(you) ' : ''}is responsible for **${plural(n, 'site')}**${has(f.role) ? ` as ${/^[aeiou]/i.test(f.role) ? 'an' : 'a'} ${f.role}` : ''}.`;
      return out(head, [
        n > 0 && has(f.by_responsibility) && `**Responsibility:** ${counts(f.by_responsibility)}`,
        nz(f.matched_by_name_only) && `**Matched by first name only:** ${plural(num(f.matched_by_name_only), 'site')}`,
        n > 0 && 'The site list is in the table below.',
      ], n > 0 ? clipNote(f.note) : null);
    }
    if (has(f.staff) && has(f.weekly_off)) {
      return out(`**${f.staff}**'s weekly off is **${f.weekly_off}**.`, [
        has(f.site) && `**Site:** ${f.site}${has(f.department) ? ` · ${f.department}` : ''}`,
        has(f.effective_from) && `**Effective from:** ${f.effective_from}`,
        has(f.source) && `**Source:** ${f.source}`,
      ]);
    }
    if (!has(f.site)) return null;
    const resp = f.responsibilities && typeof f.responsibilities === 'object' ? Object.entries(f.responsibilities) : [];
    const clean = (v: any) => String(v).replace(/\s*\(name only, not linked to a user\)/, '');
    const assigned = resp.filter(([, v]) => has(v) && !/^not assigned$/i.test(String(v)));
    const missing = resp.filter(([, v]) => !has(v) || /^not assigned$/i.test(String(v))).map(([k]) => k);
    const sub = [has(f.units) && `${fmt(num(f.units))} units`, has(f.city) && f.city, has(f.billing_cycle) && f.billing_cycle].filter(Boolean).join(' · ');
    const fence = f.geo_fence?.address ? `${f.geo_fence.address}${has(f.geo_fence.radius_m) ? ` (${f.geo_fence.radius_m} m radius)` : ''}` : null;
    return out(`**${f.site}**${sub ? ` — ${sub}` : ''}.`, [
      ...assigned.slice(0, 5).map(([k, v]) => `**${k}:** ${clean(v)}`),
      missing.length > 0 && `**Not assigned:** ${missing.join(', ')}`,
      has(f.client_legal_name) && `**Client:** ${f.client_legal_name}${has(f.client_type) ? ` ${f.client_type}` : ''}`,
      (has(f.gstin) || has(f.pan)) && `**Tax IDs:** ${[has(f.gstin) && `GSTIN ${f.gstin}`, has(f.pan) && `PAN ${f.pan}`].filter(Boolean).join(' · ')}`,
      has(f.approved_manpower) && `**Approved manpower:** ${f.approved_manpower}${has(f.takeover_date) ? ` · taken over ${f.takeover_date}` : ''}`,
      fence && `**Geo-fence:** ${fence}`,
    ]);
  },

  get_site_attendance_today: f => {
    const bio = f.biometric ?? {};
    const bioLine = (x: any) => nz(x.present_by_biometric)
      ? `**Biometric:** ${x.present_by_biometric} people (${x.punches ?? 0} punches) across ${plural(num(x.machines ?? 0), 'machine')}${nz(x.machines_offline) ? ` ⚠ ${x.machines_offline} offline` : ''}`
      : (nz(x.machines) ? `**Biometric:** no punches yet on ${plural(num(x.machines), 'machine')}${nz(x.machines_offline) ? ` ⚠ ${x.machines_offline} offline` : ''}` : false);
    if (f.app_users) {
      const a = f.app_users;
      return out(`**${a.present ?? 0} of ${a.staff_counted ?? '—'}** app users are present on ${f.date} (${f.site}) — ${a.absent ?? 0} absent, ${a.late ?? 0} late.`, [
        has(a.not_punched_in) && `**Not punched in:** ${names(a.not_punched_in, 5)}`,
        has(a.on_leave_names) ? `**On leave:** ${names(a.on_leave_names, 5)}` : nz(a.on_leave) && `**On leave:** ${a.on_leave}`,
        nz(a.inactive) && `**Inactive (no punch in 10 days):** ${a.inactive}, not counted as absent`,
        bioLine(bio),
        Array.isArray(bio.sites_with_no_punches) && bio.sites_with_no_punches.length > 0 && `**Biometric sites with no punches:** ${bio.sites_with_no_punches.length}`,
        'Details are in the table below.',
      ], clipNote(a.note));
    }
    if (f.app_punches_at_site) {
      const a = f.app_punches_at_site;
      return out(`**${f.site}** on ${f.date}: ${plural(num(a.people ?? 0), 'person', 'people')} punched in through the app${nz(a.late) ? ` (${a.late} late)` : ''}${nz(bio.present_by_biometric) ? ` and **${bio.present_by_biometric}** on the biometric machines` : ''}.`, [
        bioLine(bio),
        has(bio.last_punch) && `**Last biometric punch:** ${bio.last_punch}`,
        isNum(bio.usual_staff_last_7_days) && `**Usual staff (last 7 days):** ${bio.usual_staff_last_7_days}, of whom about ${bio.usual_staff_without_punch ?? 0} have not punched yet`,
        nz(a.people) && 'Details are in the table below.',
      ], 'Biometric staff are identified by employee code only.');
    }
    return null;
  },

  get_device_status: f => {
    const bio = f.biometric, cc = f.cctv;
    if (!bio && !cc) return null;
    const parts: string[] = [];
    if (bio) parts.push(`**${plural(num(bio.total), 'biometric machine')}** — ${bio.online} online${nz(bio.offline) ? `, ${bio.offline} offline ⚠` : ''}`);
    if (cc) parts.push(`**${plural(num(cc.total), 'CCTV device')}** — ${cc.online} online${nz(cc.offline) ? `, ${cc.offline} offline ⚠` : ''}${nz(cc.cameras) ? ` (${plural(num(cc.cameras), 'camera')})` : ''}`);
    const where = has(f.site) && !/^all sites/i.test(f.site) ? `At ${f.site}: ` : '';
    const nop: any[] = bio?.no_punch_in_last_3_days ?? [], nohb: any[] = bio?.online_but_no_heartbeat_24h ?? [];
    return out(`${where}${parts.join(' · ')}.`, [
      nop.length > 0 && `⚠ **No punch in the last 3 days:** ${plural(nop.length, 'site')} (${names(nop, 4)})`,
      nohb.length > 0 && `⚠ **Shown online but no heartbeat in 24 h:** ${nohb.length} (${names(nohb, 4)})`,
      (num(bio?.total ?? 0) + num(cc?.total ?? 0)) > 0 && 'Device-wise details are in the table below.',
    ]);
  },

  get_tickets: f => {
    const m = num(f.matching ?? 0);
    const sf = f.status_filter === 'all' ? '' : `${f.status_filter} `;
    const about = String(f.about ?? '');
    const who = /^your/i.test(about) ? ' of yours' : /^tickets raised by \/ assigned to (.+)$/i.test(about) ? ` for ${about.replace(/^tickets raised by \/ assigned to /i, '')}` : '';
    const per = whenSkipAll(f.period);
    if (m === 0) return out(`**No ${sf}tickets** found${who.replace(' of yours', ' for you')}${per ? ` ${per}` : ''}.`, [], clipNote(f.note));
    const o = f.overall ?? {};
    return out(`**${plural(m, sf + 'ticket')}**${who}${per ? ` ${per}` : ''}${isNum(o.total) && f.status_filter !== 'all' ? ` (out of ${o.total} in total)` : ''}.`, [
      has(f.by_status) && `**Status:** ${counts(f.by_status)}`,
      has(f.by_priority) && `**Priority:** ${counts(f.by_priority)}`,
      nz(f.unassigned) && `⚠ **Unassigned:** ${f.unassigned}`,
      nz(f.oldest_open_age_days) && `**Oldest open ticket:** ${f.oldest_open_age_days} days old`,
      'Ticket details are in the table below.',
    ]);
  },

  get_escalation_contacts: f => {
    const tiers: any[] = Array.isArray(f.site_escalation_tiers) ? f.site_escalation_tiers : [];
    const issue = has(f.issue) && f.issue !== 'general' ? ` for a ${f.issue} issue` : '';
    const sla = f.helpdesk_sla ?? {};
    const slaLines = (Array.isArray(sla.by_priority) ? sla.by_priority : []).map((s: string) => {
      const m = /^(P\d): respond (\d+) min, resolve (\d+) min$/.exec(s);
      return m ? `${m[1]}: respond in ${mins(+m[2])}, resolve in ${mins(+m[3])}` : s;
    });
    const head = tiers.length
      ? `**Escalation path${issue} at ${f.site}** — ${plural(tiers.length, 'level')}.`
      : `**No site-specific escalation matrix**${issue} — here is the company default.`;
    const bullets: (string | false)[] = tiers.map(t => `**Level ${t.level}:** ${t.name}${has(t.role) ? ` (${t.role})` : ''}${has(t.contact) ? ` — ${t.contact}` : ''}`);
    if (has(sla.escalate_to_role)) bullets.push(`**Helpdesk escalation:** ${sla.escalate_to_role}${has(sla.category) ? ` (${sla.category})` : ''}`);
    if (slaLines.length) bullets.push(`**Response targets:** ${slaLines.join(' · ')}`);
    return out(head, bullets, clipNote(f.tip));
  },

  get_ops_approvals: f => {
    const m = num(f.matching ?? 0);
    const sf = f.status_filter === 'all' ? '' : `${f.status_filter} `;
    const tail = f.which === 'to_approve' ? ' waiting for your decision' : f.which === 'requested' ? ' raised by you' : '';
    const per = whenSkipAll(f.period);
    const vb = f.status_filter === 'pending' ? (m === 1 ? 'is pending' : 'are pending') : f.status_filter === 'approved' ? (m === 1 ? 'has been approved' : 'have been approved') : f.status_filter === 'rejected' ? (m === 1 ? 'was rejected' : 'were rejected') : '';
    const head = m === 0 ? `**No ${sf}approvals**${tail || ' found'}${per ? ` ${per}` : ''}.` : `**${plural(m, 'approval')}** ${vb ? vb + (tail ? ',' : '') : ''}${tail}${per ? ` ${per}` : ''}.`.replace(/\s+\./, '.').replace(/ ,/, ',');
    return out(head, [
      has(f.by_module) && m > 0 && `**By module:** ${counts(f.by_module)}`,
      f.status_filter !== 'all' && has(f.overall_by_status) && `**Other statuses:** ${counts(Object.fromEntries(Object.entries(f.overall_by_status).filter(([k]) => k.toLowerCase() !== String(f.status_filter).toLowerCase())))}`,
      nz(f.pending_waiting_for_you) && `⚠ **Waiting for you:** ${f.pending_waiting_for_you}`,
      m > 0 && 'Details are in the table below.',
    ]);
  },

  get_audits: f => {
    const ht = f.ht_yard_audits, sc = f.site_checklists, pp = f.ppm_checklists;
    if (!ht && !sc && !pp) return null;
    const parts = [ht && plural(num(ht.total), 'HT-yard audit'), sc && plural(num(sc.total), 'site checklist'), pp && plural(num(pp.total), 'PPM checklist')].filter(Boolean) as string[];
    const total = num(ht?.total ?? 0) + num(sc?.total ?? 0) + num(pp?.total ?? 0);
    return out(total === 0 ? '**No audits or checklists** found.' : `**${total} audits & checklists** found: ${parts.join(', ')}.`, [
      ht && nz(ht.total) && `**HT-yard audits:** ${counts(ht.by_status)}${has(ht.latest) ? ` · latest: ${ht.latest}` : ''}`,
      pp && nz(pp.total) && `**PPM checklists by asset:** ${counts(pp.by_asset)}`,
      pp && has(pp.job_templates_active) && `**Active job templates:** ${names(pp.job_templates_active, 6)}`,
      total > 0 && 'Details are in the table below.',
    ], sc?.demo_data ? 'Site checklists currently hold sample (demo) data.' : null);
  },

  get_gate_activity: f => {
    const v = num(f.visitor_entries ?? 0);
    const place = has(f.site) ? ` at ${f.site}` : '';
    const sg = f.staff_gate_punches;
    const head = v === 0
      ? `**No visitor entries**${place} ${when(f.period)}.`
      : `**${plural(v, 'visitor entry', 'visitor entries')}**${place} ${when(f.period)}${nz(f.still_inside) ? ` — ${f.still_inside} still inside` : ''}.`;
    return out(head, [
      has(f.by_type) && `**By type:** ${counts(f.by_type)}`,
      has(f.by_approval) && `**Approval:** ${counts(f.by_approval)}`,
      v === 0 && has(f.last_entry_recorded) && `**Last entry on record:** ${f.last_entry_recorded}`,
      sg && nz(sg.total) && `**Staff gate punches:** ${sg.total} by ${plural(num(sg.people), 'person', 'people')}${has(sg.by_method) ? ` (${counts(sg.by_method)})` : ''}`,
      isNum(f.registered_units) && `**Registered units:** ${f.registered_units}${isNum(f.active_residents) ? ` · active residents ${f.active_residents}` : ''}`,
      v > 0 && 'Entries are in the table below.',
    ]);
  },

  get_weather_alerts: f => {
    const a = num(f.alerts ?? 0);
    const sev = counts(f.by_severity);
    const t = f.tasks ?? {};
    const head = a === 0 ? `**No weather alerts** ${when(f.period)}.` : `**${plural(a, 'weather alert')}** ${when(f.period)}.`;
    return out(head, [
      a > 0 && sev && `**Severity:** ${sev}`,
      a === 0 && has(f.latest_alert_ever) && `**Last alert on record:** ${f.latest_alert_ever}`,
      nz(t.total) && `**Follow-up tasks:** ${t.total}${has(t.by_status) ? ` (${counts(t.by_status).toLowerCase()})` : ''}`,
      nz(t.open_high_urgency) && `⚠ **High-urgency tasks still open:** ${t.open_high_urgency}`,
      (a > 0 || nz(t.total)) && 'Alert and task details are in the table below.',
    ]);
  },

  get_crm_followups: f => {
    const sh = String(f.showing ?? 'today');
    const owner = has(f.owner) && f.owner !== 'all owners' ? ` for ${f.owner}` : '';
    const list = f[`${sh}_list`];
    const listed = Array.isArray(list) ? list.length : null;
    let head: string;
    if (sh === 'overdue') head = num(f.overdue) ? `**${plural(num(f.overdue), 'follow-up')}** ${num(f.overdue) === 1 ? 'is' : 'are'} overdue${owner}.` : `**No overdue follow-ups**${owner}.`;
    else if (sh === 'today') head = num(f.due_today) ? `**${plural(num(f.due_today), 'follow-up')}** due today${owner} (${f.today}).` : `**No follow-ups are due today**${owner} (${f.today}).`;
    else if (sh === 'this_week') { const c = num(f.due_today ?? 0) + num(f.due_rest_of_this_week ?? 0); head = c ? `**${plural(c, 'follow-up')}** due this week${owner}.` : `**No follow-ups are due this week**${owner}.`; }
    else { const c = listed ?? num(f.overdue ?? 0); head = c ? `**${plural(c, 'follow-up')}** ${sh === 'all_pending' ? 'pending' : sh === 'next_7_days' ? 'due in the next 7 days' : 'upcoming'}${owner}.` : `**No follow-ups** ${sh === 'all_pending' ? 'pending' : 'due'}${owner}.`; }
    return out(head, [
      nz(f.overdue) && sh !== 'overdue' && `⚠ **Overdue:** ${f.overdue}${has(f.oldest_overdue) ? ` — oldest: ${f.oldest_overdue}` : ''}`,
      nz(f.overdue) && sh === 'overdue' && has(f.oldest_overdue) && `⚠ **Oldest:** ${f.oldest_overdue}`,
      sh !== 'today' && nz(f.due_today) && `**Due today:** ${f.due_today}`,
      sh !== 'this_week' && nz(f.due_rest_of_this_week) && `**Due later this week:** ${f.due_rest_of_this_week}`,
      nz(f.open_leads_without_next_followup_date) && `**Open leads with no next follow-up date:** ${f.open_leads_without_next_followup_date}`,
      `**Logged:** ${f.followups_logged_today ?? 0} today · ${f.followups_logged_last_7_days ?? 0} in the last 7 days`,
      (listed ?? 0) > 0 && 'Client-wise details are in the table below.',
    ]);
  },

  get_crm_pipeline: f => {
    const t = num(f.total_leads ?? 0);
    const per = whenSkipAll(f.period);
    const owner = has(f.owner) && f.owner !== 'all owners' ? ` for ${f.owner}` : '';
    if (t === 0) return out(`**No leads**${owner}${per ? ` ${per}` : ''}.`, [has(f.stage_note) && String(f.stage_note)]);
    let head: string;
    if (has(f.stage_asked)) {
      const key = Object.keys(f.by_stage ?? {}).find(k => k.toLowerCase().includes(String(f.stage_asked).toLowerCase().replace(/_/g, ' ')));
      head = `**${plural(num(f.leads_in_stage ?? 0), 'lead')}** ${num(f.leads_in_stage) === 1 ? 'is' : 'are'} in the ${key ?? f.stage_asked} stage${owner}${per ? ` ${per}` : ''} (out of ${t} in total).`;
    } else head = `**${plural(t, 'lead')}**${owner}${per ? ` ${per}` : ''} — ${f.open_pipeline ?? 0} open, ${f.won ?? 0} won, ${f.lost ?? 0} lost.`;
    return out(head, [
      has(f.by_stage) && !has(f.stage_asked) && `**By stage:** ${counts(f.by_stage)}`,
      has(f.stage_asked) && `**Pipeline:** ${f.open_pipeline ?? 0} open · ${f.won ?? 0} won · ${f.lost ?? 0} lost`,
      has(f.win_rate_of_closed) && `**Win rate:** ${f.win_rate_of_closed}`,
      has(f.leads_by_owner) && !owner && `**Owners:** ${counts(f.leads_by_owner, 3)}`,
      has(f.top_lost_reasons) && `**Top reasons for losing:** ${counts(f.top_lost_reasons, 3)}`,
      f.quotations && nz(f.quotations.total) && `**Quotations:** ${f.quotations.total}${has(f.quotations.by_status) ? ` (${counts(f.quotations.by_status)})` : ''}`,
      f.business_referrals && nz(f.business_referrals.total) && `**Business referrals:** ${f.business_referrals.total}`,
    ], has(f.open_deal_value) && /not recorded/i.test(String(f.open_deal_value)) ? 'Deal values are not recorded in the CRM.' : null);
  },

  get_communication_log: f => {
    const who = f.person ?? 'this person';
    const per = when(f.period);
    const em = f.emails, ap = f.app_notifications, al = f.automated_alerts, ca = f.calls;
    if (em && has(f.topic)) {
      const m = num(em.matching_topic ?? 0);
      const head = m > 0
        ? `**Yes** — ${plural(m, `${f.topic} email`)} to ${who} ${per} (${em.sent ?? 0} sent${nz(em.failed) ? `, ${em.failed} failed ⚠` : ''}).`
        : `**No ${f.topic} email** to ${who} was found ${per} ⚠.`;
      return out(head, [
        m === 0 && nz(em.total_in_period) && `**Other emails in this period:** ${em.total_in_period}${has(em.other_recent_subjects) ? ` (${names(em.other_recent_subjects, 3)})` : ''}`,
        m === 0 && !nz(em.total_in_period) && 'No emails at all were logged for this person in this period.',
        has(f.email) && String(f.email),
        m > 0 && 'Details are in the table below.',
      ]);
    }
    const bits = [
      em && nz(em.total_in_period) && plural(num(em.total_in_period), 'email'),
      ap && nz(ap.total) && `${plural(num(ap.total), 'app notification')}${nz(ap.unread) ? ` (${ap.unread} unread)` : ''}`,
      al && nz(al.total) && plural(num(al.total), 'automated alert'),
      ca && nz(ca.recorded_calls_made) && plural(num(ca.recorded_calls_made), 'recorded call'),
    ].filter(Boolean) as string[];
    const head = bits.length ? `**${who}** ${per}: ${bits.join(', ')}.` : `**No communication** recorded for ${who} ${per}.`;
    return out(head, [
      em && !nz(em.total_in_period) && 'No emails were logged.',
      ap && has(ap.by_type) && `**Notifications by type:** ${counts(ap.by_type, 4)}`,
      al && nz(al.total) && `**Automated alerts:** ${al.sent ?? 0} sent, ${al.failed ?? 0} failed${nz(al.failed) ? ' ⚠' : ''}`,
      ca && nz(ca.in_app_calls_or_messages) && `**In-app calls / messages:** ${ca.in_app_calls_or_messages}`,
      has(f.email) && String(f.email),
      bits.length > 0 && 'Recent items are in the table below.',
    ]);
  },

  get_audit_trail: f => {
    const total = num(f.total_events ?? f.changes ?? 0);
    const per = whenSkipAll(f.period);
    const noun = (n: number) => (has(f.site) || has(f.changes_to_records_of) || has(f.changes_made_by) ? plural(n, 'change') : plural(n, 'audit event'));
    let subject = '';
    if (has(f.changes_to_records_of)) subject = ` to ${poss(f.changes_to_records_of)} records`;
    else if (has(f.changes_made_by)) subject = ` made by ${f.changes_made_by}`;
    else if (has(f.site)) subject = ` on ${f.site} billing and invoice records`;
    const head = total === 0 ? `**No changes** found${subject}${per ? ` ${per}` : ''}.` : `**${noun(total)}**${subject}${per ? ` ${per}` : ''}.`;
    const SECT: [string, string, string][] = [
      ['attendance_changes', 'Attendance', 'by_action'], ['admin_actions', 'Admin actions', 'by_action'], ['login_security_events', 'Login & security', 'by_event'],
      ['gps_tracking_requests', 'GPS tracking requests', 'by_requester'], ['bulk_template_actions', 'Bulk templates', 'by_action'],
    ];
    const bullets: (string | false)[] = [];
    for (const [k, lab, subk] of SECT) {
      const s = f[k]; if (!s || !nz(s.total)) continue;
      bullets.push(`**${lab}:** ${s.total}${has(s[subk]) ? ` (${counts(s[subk], 4)})` : ''}`);
      if (k === 'attendance_changes' && has(s.by_whom)) bullets.push(`**Attendance changes made by:** ${counts(s.by_whom, 4)}`);
    }
    if (has(f.editors)) {
      const merged: Record<string, number> = {};
      for (const [k, v] of Object.entries(f.editors)) { const key = /^not recorded/i.test(k) ? 'Editor not recorded' : k; merged[key] = (merged[key] ?? 0) + num(v); }
      bullets.push(`**Edited by:** ${counts(merged, 4)}`);
    }
    if (total > 0) bullets.push('The latest changes are in the table below.');
    return out(head, bullets, clipNote(f.note, 200));
  },

  get_document_status: f => {
    const miss = num(f.people_missing_any ?? 0), chk = num(f.people_checked ?? 0);
    const flt = Array.isArray(f.filters) && f.filters.length ? ` (${f.filters.join(', ')})` : '';
    const head = miss === 0 ? `**Everyone** has uploaded their documents — ${chk} people checked${flt}.` : `**${miss} of ${chk}** people${flt} are missing at least one document.`;
    return out(head, [
      has(f.missing_count_by_document) && miss > 0 && `**Missing:** ${counts(f.missing_count_by_document, 6)}`,
      nz(f.drafts_among_missing) && `**Still on a draft onboarding form:** ${f.drafts_among_missing} of them`,
      miss > 0 && 'Who is missing what is in the table below.',
    ], clipNote(f.note, 200));
  },

  get_onboarding_status: f => {
    const t = num(f.total ?? 0);
    const flt = Array.isArray(f.filters) && f.filters.length ? ` (${f.filters.join(', ')})` : '';
    if (t === 0) return out(`**No onboarding forms** found${flt}.`, []);
    const bs = f.by_status ?? {};
    return out(`**${plural(t, 'onboarding form')}**${flt}${Object.keys(bs).length > 1 ? ` — ${counts(bs, 5).toLowerCase()}` : ''}.`, [
      has(f.all_statuses_for_same_filters) && Object.keys(f.all_statuses_for_same_filters).length > Object.keys(bs).length && `**Across all statuses:** ${counts(f.all_statuses_for_same_filters, 5)}`,
      has(f.by_site) && Object.keys(f.by_site).length > 1 && `**Top sites:** ${counts(f.by_site, 4)}`,
      has(f.portal_sync) && `**Portal sync:** ${counts(f.portal_sync)}`,
      has(f.latest_submission) && `**Latest submission:** ${f.latest_submission}`,
      'Candidate-wise details are in the table below.',
    ]);
  },

  get_recruitment_pipeline: f => {
    const c = num(f.candidates ?? 0);
    const flt = Array.isArray(f.filters) && f.filters.length ? ` (${f.filters.join(', ')})` : '';
    const head = c === 0 ? `**No candidates** found${flt}.` : `**${plural(c, 'candidate')}**${flt} in the recruitment pipeline.`;
    const L = f.letters ?? {};
    return out(head, [
      has(f.pipeline_by_stage) && `**Pipeline by stage:** ${counts(f.pipeline_by_stage, 6)}`,
      nz(L.total) && `**Letters:** ${L.total}${has(L.by_status) ? ` (${counts(L.by_status)})` : ''}`,
      nz(f.unassigned_to_hr) && `⚠ **Not assigned to an HR yet:** ${f.unassigned_to_hr}`,
      c > 0 && 'Candidate-wise details are in the table below.',
    ], clipNote(f.note));
  },

  get_attendance_requests: f => {
    const u = f.unlock_requests, c = f.attendance_corrections;
    const who = has(f.about) && f.about !== 'all employees' ? ` for ${f.about}` : '';
    const sf = f.status_filter && f.status_filter !== 'all' ? `${f.status_filter} ` : '';
    const per = whenSkipAll(f.period);
    const ut = num(u?.total ?? 0), ct = num(c?.total ?? 0);
    const bits = [u && ut > 0 && plural(ut, `${sf}unlock request`), c && ct > 0 && plural(ct, `${sf}attendance correction`)].filter(Boolean) as string[];
    const head = bits.length ? `**${bits.join(' and ')}**${who}${per ? ` ${per}` : ''}.` : `**No ${sf}attendance requests**${who}${per ? ` ${per}` : ''}.`;
    return out(head, [
      u && ut > 0 && has(u.by_status) && `**Unlock requests:** ${counts(u.by_status)}`,
      u && nz(u.waiting_for_you) && `⚠ **Waiting for your approval:** ${u.waiting_for_you}`,
      c && ct > 0 && has(c.by_source) && `**Corrections made via:** ${counts(c.by_source, 3)}`,
      c && ct > 0 && has(c.by_site) && `**Top sites:** ${counts(c.by_site, 3)}`,
      c && ct > 0 && has(c.by_change) && `**Changed to:** ${counts(c.by_change, 3)}`,
      bits.length > 0 && 'Request-wise details are in the table below.',
    ], clipNote(c?.note, 200));
  },

  get_attendance_exceptions: f => {
    const S: [string, string, string][] = [['late', 'late arrival', 'late_marks'], ['missed_punch_out', 'missed punch-out', 'days'], ['geo_fence_violations', 'geo-fence violation', 'total'], ['field_site_time_violations', 'field site-time shortfall', 'total']];
    const present = S.filter(([k]) => f[k]);
    if (!present.length) return null;
    const who = has(f.about) && f.about !== 'all employees' ? f.about : '';
    const items = present.map(([k, lab, ck]) => ({ k, lab, c: num(f[k][ck] ?? 0), p: num(f[k].people ?? f[k].people_late ?? 0), s: f[k] }));
    const nonzero = items.filter(i => i.c > 0);
    const per = when(f.period);
    const head = nonzero.length === 0
      ? `**No ${present.length === 1 ? items[0].lab + 's' : 'attendance exceptions'}** ${who ? `for ${who} ` : ''}${per}.`
      : `**${nonzero.map(i => plural(i.c, i.lab)).join(', ')}** ${who ? `for ${who} ` : 'recorded '}${per}.`;
    const bullets: (string | false)[] = [];
    for (const i of nonzero) {
      const most: string[] = Array.isArray(i.s.most) ? i.s.most : Array.isArray(i.s.most_late) ? i.s.most_late : [];
      const multi = most.some(m => !/\(1\)$/.test(m));
      const rule = i.k === 'late' ? ' (first punch-in after 09:30 IST)' : '';
      const who2 = `${plural(i.p, 'person', 'people')}${multi ? ` — most: ${names(most, 3)}` : ''}`;
      bullets.push(nonzero.length === 1 ? `**People affected:** ${fmt(i.p)}${multi ? ` — most: ${names(most, 3)}` : ""}${rule}` : `**${cap(plural(i.c, i.lab))}${rule}:** ${who2}`);
    }
    const strike = f.field_site_time_violations?.reached_monthly_strike_limit?.people;
    if (Array.isArray(strike) && strike.length) bullets.push(`⚠ **Reached the monthly strike limit:** ${names(strike, 4)}`);
    if (nonzero.length) bullets.push('Details are in the table below.');
    const rs = String(f.rows_shown ?? '');
    const m = /^(\d+) of (\d+)/.exec(rs);
    return out(head, bullets, m && m[1] !== m[2] ? `The table shows the latest ${m[1]} of ${m[2]} rows.` : null);
  },

  // ---- improved versions of earlier templates
  count_employees: f => {
    if (!has(f.count)) return null;
    const c = num(f.count);
    const st = f.status && f.status !== 'all' ? `${f.status} ` : '';
    const flt = Array.isArray(f.filters) && f.filters.length ? ` (${f.filters.join(' · ')})` : '';
    const scope = has(f.scope) && !/organisation-wide/i.test(String(f.scope)) ? ` — ${f.scope}` : '';
    const roles = f.by_role && typeof f.by_role === 'object' ? Object.keys(f.by_role).length : 0;
    return out(`**${plural(c, `${st}employee`)}**${flt}${scope}.`, [
      roles > 1 && `**By role:** ${counts(f.by_role, 6)}`,
      nz(f.listed) && c > num(f.listed) ? `Listing the first ${f.listed} in the table below.` : c > 0 && 'The list is in the table below.',
    ]);
  },
};


/** Collapses stray whitespace in every string (names like "Sandeep B " come with trailing spaces). */
function tidy(v: any): any {
  if (typeof v === 'string') return v.replace(/\s+/g, ' ').trim();
  if (Array.isArray(v)) return v.map(tidy);
  if (v && typeof v === 'object') {
    const o: Record<string, any> = {};
    for (const [k, x] of Object.entries(v)) {
      const key = k.replace(/\s+/g, ' ').trim(), val = tidy(x);
      o[key] = typeof val === 'number' && typeof o[key] === 'number' ? o[key] + val : val;   // keys that only differ by spaces are merged
    }
    return o;
  }
  return v;
}

/** Renders a tool answer without AI. */
export function renderAnswer(tool: string, rawFacts: F, sourceLabel: string): string {
  const facts = tidy(rawFacts) as F;
  try {
    const specific = T[tool]?.(facts, sourceLabel);
    if (specific) return specific;
  } catch { /* fall through to generic */ }
  return renderGeneric(facts, sourceLabel);
}
