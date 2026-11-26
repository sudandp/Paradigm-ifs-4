/**
 * Fast-path text utilities: normalisation (incl. common Hinglish/Kannada-in-English words) and
 * date/period extraction. Pure functions, no I/O, no AI.
 */
import { IST_MS, MONTHS } from '../helpers.js';

/** word → canonical English (applied on whole words after lower-casing). */
const SYNONYMS: Record<string, string> = {
  // Hinglish / regional (romanised)
  kitne: 'how many', kitna: 'how much', kitni: 'how many', din: 'days', dino: 'days', dinon: 'days',
  kahan: 'where', kaha: 'where', kidhar: 'where', aaj: 'today', ivattu: 'today', indu: 'today', ninne: 'yesterday',
  kal: 'yesterday', chutti: 'leave', chhutti: 'leave',
  hajir: 'present', haazir: 'present', hazir: 'present', aaya: 'came', aayi: 'came', aya: 'came',
  kaam: 'work', kiya: 'did', mera: 'my', meri: 'my', mere: 'my', mujhe: 'me', nanna: 'my',
  pichle: 'last', pichla: 'last', pichhle: 'last', mahina: 'month', mahine: 'month', hafta: 'week', hafte: 'week',
  // spelling variants / abbreviations
  todays: 'today', tdy: 'today', yday: 'yesterday', ystrdy: 'yesterday', yesterdays: 'yesterday',
  attendence: 'attendance', attandance: 'attendance', atendance: 'attendance', presnt: 'present',
  leaves: 'leave', lv: 'leave', el: 'earned leave', sl: 'sick leave', cl: 'casual leave', compoff: 'comp off', 'comp-off': 'comp off',
  overtime: 'overtime', ot: 'overtime', invoices: 'invoice', invoce: 'invoice', bills: 'bill',
  mgr: 'manager', ph: 'phone', mob: 'mobile', num: 'number',
  wrk: 'work', wrkd: 'worked', workd: 'worked', wroked: 'worked', woked: 'worked',
  tickts: 'tickets', tkt: 'ticket', tkts: 'tickets',
};

/** Lower-case, strip punctuation (keep / - for dates), apply synonyms, collapse spaces. */
export function normalize(q: string): string {
  let s = ` ${q.toLowerCase().replace(/[’'`]s\b/g, '').replace(/[^a-z0-9\s/\-.]/g, ' ').replace(/(\D)\.(\D)/g, '$1 $2')} `;
  s = s.replace(/\s+/g, ' ');
  s = s.split(' ').map(w => SYNONYMS[w] ?? w).join(' ');
  return ` ${s.replace(/\s+/g, ' ').trim()} `;
}

export const has = (n: string, re: RegExp) => re.test(n);

// ------------------------------------------------------------------ periods
const MONTH_RE: [RegExp, number][] = [
  [/\bjan(uary)?\b/, 1], [/\bfeb(ruary)?\b/, 2], [/\bmar(ch)?\b/, 3], [/\bapr(il)?\b/, 4], [/\bmay\b/, 5], [/\bjune?\b/, 6],
  [/\bjuly?\b/, 7], [/\baug(ust)?\b/, 8], [/\bsep(t|tember)?\b/, 9], [/\boct(ober)?\b/, 10], [/\bnov(ember)?\b/, 11], [/\bdec(ember)?\b/, 12],
];

export interface PeriodHit {
  period?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';
  start_date?: string; end_date?: string;
  /** named billing month (for invoice-style tools) */
  month?: number; year?: number;
  /** false when the year was inferred (a month later than now is assumed to be LAST year) */
  yearExplicit?: boolean;
  single?: boolean;
  text?: string; // what was matched (removed before name matching)
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

/** Extracts the time period from a normalised question. Returns {} when none is mentioned. */
export function extractPeriod(n: string, now = new Date()): PeriodHit {
  const ist = new Date(now.getTime() + IST_MS);
  const Y = ist.getUTCFullYear(), M = ist.getUTCMonth() + 1, D = ist.getUTCDate();

  // explicit dates: 25/11/2026, 25-11-26, 2026-11-25
  let m = n.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) { const s = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`; return { period: 'custom', start_date: s, end_date: s, single: true, text: m[0] }; }
  m = n.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (m && +m[2] <= 12 && +m[1] <= 31) {
    const yy = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : Y;
    const s = ymd(yy, +m[2], +m[1]); return { period: 'custom', start_date: s, end_date: s, single: true, text: m[0] };
  }
  // "25 nov" / "nov 25" / "25th november 2026"
  for (const [re, mon] of MONTH_RE) {
    const src = re.source.replace(/^\\b|\\b$/g, '');
    const dm = n.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${src}\\b(?:\\s+(\\d{4}))?`)) || n.match(new RegExp(`\\b${src}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s+(\\d{4}))?`));
    if (dm && +dm[1] >= 1 && +dm[1] <= 31) {
      const yy = dm[2] ? +dm[2] : (mon > M ? Y - 1 : Y);
      const s = ymd(yy, mon, +dm[1]); return { period: 'custom', start_date: s, end_date: s, single: true, month: mon, year: yy, text: dm[0] };
    }
  }
  if (/\b(tomorrow|tmrw|tmw)\b/.test(n)) { const s = ymd(Y, M, D + 1); return { period: 'custom', start_date: s, end_date: s, single: true, text: n.match(/\b(tomorrow|tmrw|tmw)\b/)![0] }; }
  if (/\bnext week\b/.test(n)) { const dow = (new Date(Date.UTC(Y, M - 1, D)).getUTCDay() + 6) % 7; return { period: 'custom', start_date: ymd(Y, M, D - dow + 7), end_date: ymd(Y, M, D - dow + 13), text: 'next week' }; }
  if (/\b(today|now|right now|currently|this morning|so far today)\b/.test(n)) return { period: 'today', single: true, month: M, year: Y, text: 'today' };
  if (/\b(yesterday|day before)\b/.test(n)) {
    if (/\bday before yesterday\b/.test(n)) { const s = ymd(Y, M, D - 2); return { period: 'custom', start_date: s, end_date: s, single: true, text: 'day before yesterday' }; }
    return { period: 'yesterday', single: true, text: 'yesterday' };
  }
  m = n.match(/\b(last|past|previous)\s+(\d{1,3})\s+days?\b/);
  if (m) return { period: 'custom', start_date: ymd(Y, M, D - (+m[2] - 1)), end_date: ymd(Y, M, D), text: m[0] };
  if (/\b(this|current)\s+week\b/.test(n)) return { period: 'this_week', text: 'this week' };
  if (/\b(last|previous|past)\s+week\b/.test(n)) return { period: 'last_week', text: 'last week' };
  if (/\b(last|previous|past)\s+month\b/.test(n)) { const mm = M === 1 ? 12 : M - 1; return { period: 'last_month', month: mm, year: M === 1 ? Y - 1 : Y, text: 'last month' }; }
  if (/\b(this|current)\s+month\b|\bmonth\s+(till|to)\s+date\b|\bmtd\b/.test(n)) return { period: 'this_month', month: M, year: Y, text: 'this month' };
  if (/\b(this|current)\s+year\b|\bytd\b|\bso far this year\b/.test(n)) return { period: 'this_year', text: 'this year' };
  m = n.match(/\b(last|previous)\s+year\b/);
  if (m) return { period: 'custom', start_date: ymd(Y - 1, 1, 1), end_date: ymd(Y - 1, 12, 31), text: m[0] };
  // named month (+ optional year): "june", "june month", "in june 2026"
  for (const [re, mon] of MONTH_RE) {
    const mm = n.match(re);
    if (!mm) continue;
    if (mon === 5 && !/\bmay\s+(month|\d{4})\b|\b(in|of|for|during)\s+may\b/.test(n)) continue; // "may" is also a verb
    const yr = n.match(new RegExp(`${re.source}(?:\\s+month)?\\s+(\\d{4})`));
    const yy = yr ? +yr[yr.length - 1] : (mon > M ? Y - 1 : Y);
    const end = new Date(Date.UTC(yy, mon, 0)).getUTCDate();
    return { period: 'custom', start_date: ymd(yy, mon, 1), end_date: yy === Y && mon === M ? ymd(Y, M, D) : ymd(yy, mon, end), month: mon, year: yy, yearExplicit: !!yr, text: mm[0] };
  }
  return {};
}

export const monthName = (m?: number) => (m ? MONTHS[m - 1] : '');

/** Words that never start a person or site name (intent words, fillers). */
export const STOP = new Set(`a an the of for to in on at by is are was were be been am do does did done how many much what which who whom whose where when why
 me my i mine myself our we us you your he she they them his her their it its this that these those there here and or not no yes please pls kindly tell show give
 get find list check see know can could would should will shall let lets want need any all every each some total number count days day week month year today yesterday
 now last next previous current present absent leave leaves balance work worked works working attendance punch punched in out time came come late early
 where location located gps route travel travelled visited km site sites invoice bill billing value amount billed sent pending status report summary overview
 details detail info information about regarding with from till until since during month's ot overtime shift weekly off holiday holidays manager reporting phone
 contact mobile email joining joined role designation staff employee employees people person team members member reports report ticket tickets open closed
 helpdesk escalate escalation contact device devices biometric cctv offline online lead leads crm followup followups follow up audit audits checklist weather
 gate visitor visitors approval approvals approve request requests unlock correction onboarding recruitment candidate candidates document documents score scores
 performance top bottom rank home homes apartment apartments did has have had get got working hours hour value values much ops operation operations incharge
 in-charge charge handles handle manages manage under responsible total top best first new by wise`.split(/\s+/));
