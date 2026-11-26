/**
 * Deterministic answer templates (no AI). Every tool's facts can be rendered:
 * specific templates for the most-asked tools, a structured generic renderer for the rest.
 * Wording rule: use the person's name, never he/she.
 */
type F = Record<string, any>;

const b = (x: any) => `**${x}**`;
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const has = (v: any) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length);

const SKIP = new Set(['note', 'notes', 'rule', 'rules', 'meaning', 'privacy_note', 'filters', 'from', 'to', 'access', 'tip', 'no_entry_meaning', 'scope']);
const label = (k: string) => k.replace(/_/g, ' ').replace(/\b(\w)/, m => m.toUpperCase()).replace(/\bot\b/i, 'OT').replace(/\bgps\b/i, 'GPS').replace(/\bkm\b/, 'km');

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

/** Generic structured rendering: headline facts first, nested groups as sub-bullets, notes last in italics. */
export function renderGeneric(facts: F, sourceLabel: string): string {
  const lines: string[] = [];
  const notes: string[] = [];
  for (const [k, v] of Object.entries(facts)) {
    if (!has(v)) continue;
    if (SKIP.has(k)) { if (typeof v === 'string' && /^(note|notes|privacy_note|tip)$/.test(k)) notes.push(v); continue; }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = Object.entries(v).filter(([ik, iv]) => has(iv) && !SKIP.has(ik));
      if (!inner.length) continue;
      const flat = inner.every(([, iv]) => typeof iv !== 'object' || Array.isArray(iv));
      if (flat && inner.length <= 4) { lines.push(`- **${label(k)}:** ${inline(v)}`); continue; }
      lines.push(`- **${label(k)}:**`);
      for (const [ik, iv] of inner) lines.push(`  - ${label(ik)}: ${typeof iv === 'number' ? b(iv) : inline(iv)}`);
      for (const [ik, iv] of Object.entries(v)) if ((ik === 'note' || ik === 'rule' || ik === 'meaning') && typeof iv === 'string') notes.push(iv);
      continue;
    }
    lines.push(`- **${label(k)}:** ${typeof v === 'number' ? b(v) : inline(v)}`);
  }
  return [`**${sourceLabel}**`, '', ...lines, ...(notes.length ? ['', `_${notes.slice(0, 2).join(' ')}_`] : [])].join('\n');
}

// ------------------------------------------------------------------ specific templates
const T: Record<string, (f: F, label: string) => string | null> = {
  get_attendance_summary: f => {
    if ('present' in f) {
      if (!f.present) return `${b(f.employee)} was ${b('not present')} on ${f.date} — no punch-in recorded.`;
      const parts = [`${b(f.employee)} was ${b('present')} on ${f.date}.`, '',
        `- **Punch in:** ${f.punch_in}`, `- **Punch out:** ${f.punch_out}`];
      if (has(f.hours_worked)) parts.push(`- **Hours worked:** ${b(f.hours_worked + ' h')}`);
      if (has(f.sites)) parts.push(`- **Location:** ${inline(f.sites)}`);
      if (f.manual_entry) parts.push('- ⚠ Includes a **manual** attendance entry');
      return parts.join('\n');
    }
    const parts = [`${b(f.employee)} worked ${b(plural(f.days_worked ?? 0, 'day'))} in ${f.period}.`, ''];
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
    return [`Leave balance of ${b(f.employee)} as of ${f.as_of}:`, '', ...rows, ...(f.loss_of_pay_days_this_year ? [`- **Loss of pay this year:** ${f.loss_of_pay_days_this_year} days`] : [])].join('\n');
  },

  get_employee_profile: f => {
    const parts = [`${b(f.name)} — ${f.role ?? ''}${f.status && f.status !== 'active' ? ` (${f.status})` : ''}`, ''];
    if (has(f.reporting_manager)) parts.push(`- **Reporting manager:** ${f.reporting_manager}${has(f.second_reporting_manager) ? ` (2nd: ${f.second_reporting_manager})` : ''}`);
    if (has(f.site_count)) parts.push(`- **Sites responsible for:** ${f.site_count}`);
    if (has(f.joining_date)) parts.push(`- **Joined:** ${f.joining_date}`);
    if (has(f.direct_reports)) parts.push(`- **Direct reports:** ${f.direct_reports}`);
    if (has(f.phone)) parts.push(`- **Phone:** ${f.phone}`);
    if (has(f.email)) parts.push(`- **Email:** ${f.email}`);
    if (has(f.company)) parts.push(`- **Company:** ${f.company}`);
    return parts.join('\n');
  },

  count_employees: f => {
    if (!has(f.count)) return null;
    const parts = [`${b(f.count)} ${f.status && f.status !== 'all' ? f.status + ' ' : ''}employee${f.count === 1 ? '' : 's'} ${has(f.filters) ? `(${inline(f.filters)})` : ''} — ${f.scope ?? ''}`.replace(/\s+/g, ' ').trim()];
    if (f.by_role && typeof f.by_role === 'object' && Object.keys(f.by_role).length > 1) {
      parts.push('', ...Object.entries(f.by_role).slice(0, 10).map(([k, v]) => `- ${k}: ${b(v)}`));
    }
    return parts.join('\n');
  },
};

/** Renders a tool answer without AI. */
export function renderAnswer(tool: string, facts: F, sourceLabel: string): string {
  try {
    const specific = T[tool]?.(facts, sourceLabel);
    if (specific) return specific;
  } catch { /* fall through to generic */ }
  return renderGeneric(facts, sourceLabel);
}
