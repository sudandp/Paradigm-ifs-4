/**
 * Apply-leave-from-chat + leave policy explanation tools. Owned by the LEAVE agent.
 *
 * Every rule here mirrors the app — do not invent policy:
 *   pages/leaves/ApplyLeave.tsx  onSubmit()            (allowed types, probation, duplicate check, date rules, Blue Leave rules,
 *                                                       EL ≥ 7 days, 3-month eligibility, balance + expiry, reason ≥ 10 chars,
 *                                                       half day only for a single day, Sick Leave needs a doctor's certificate)
 *   services/api.ts             submitLeaveRequest()  (opening-date check, per-type balance checks, the insert, the notification)
 *   services/notificationService.ts dispatchNotificationFromRules('leave_request')
 *   services/api.ts             withdrawLeaveRequest() (own request, only while 'pending_manager_approval' — LeaveDashboard)
 *   balances: tools/hr.ts __hrInternals.computeLeaveBalance (port of getLeaveBalancesForUser)
 *
 * SAFETY: only the asker's own leave. Writes happen ONLY on step='confirm' with a server-signed token that was issued
 * on the preview for exactly these values; everything is re-validated on confirm. ASSIST_LEAVE_DRY_RUN=1 → every
 * validation runs and the would-be payload is returned instead of writing.
 */
import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssistCtx, AssistTool, ToolResult, ClarifyOption, AssistAction, AssistUploadSpec } from '../types.js';
import { __hrInternals } from './hr.js';
import { todayIst, prettyDate, safeRun } from '../helpers.js';

const { computeLeaveBalance, staffCategory } = __hrInternals;

// ===================================================================================== constants / small helpers
const DAY_MS = 86_400_000;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dUTC = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
const addDays = (s: string, n: number) => new Date(dUTC(s).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const daysIncl = (a: string, b: string) => Math.round((dUTC(b).getTime() - dUTC(a).getTime()) / DAY_MS) + 1;
const dowOf = (s: string) => dUTC(s).getUTCDay();
const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const isYmd = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(dUTC(s).getTime()) && dUTC(s).toISOString().slice(0, 10) === s;
const ddmmyyyy = (s: string) => `${s.slice(8, 10)}-${s.slice(5, 7)}-${s.slice(0, 4)}`;
const shortDay = (s: string) => `${DOW[dowOf(s)]}, ${prettyDate(s)}`;
const lc = (s: any) => String(s ?? '').toLowerCase().trim();
const r1 = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, w = 'day') => `${n} ${w}${n === 1 ? '' : 's'}`;
const ROUTE_APPLY = '/leaves/apply';
const ROUTE_DASHBOARD = '/leaves/dashboard';
const DRAFT_TTL_MS = 30 * 60_000;
export const isLeaveDryRun = () => process.env.ASSIST_LEAVE_DRY_RUN === '1';

// ===================================================================================== medical certificate (Sick Leave)
/** Mirrors the app: UploadDocument → api.uploadDocument(file, 'onboarding-documents') → `${userId}/documents/${Date.now()}/${name}`;
 *  ApplyLeave stores the UploadedFile as leave_requests.doctor_certificate = { name, type, size, path } (processFilesForUpload).
 *  The form requires the certificate for EVERY Sick Leave request (yup schema), so the chat does too. */
export const CERT_BUCKET = 'onboarding-documents';
export const CERT_MAX_MB = 10;                                     // UploadDocument: "File size must be less than 10MB"
export const CERT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'; // UploadDocument default (jpeg/png/pdf) + webp (the app compresses images to webp)
const CERT_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };
const CERT_MIME_OK = new Set(Object.values(CERT_EXT));
export const CERT_UPLOAD = { field: 'doctor_certificate' as const, accept: CERT_ACCEPT, maxMb: CERT_MAX_MB, label: "Doctor's certificate or prescription" };
export interface CertMeta { name: string; type: string; size: number; path: string }

/** Path must be `<asker id>/documents/<digits>/<file>` (the app's own pattern): no traversal, no URL, no other user's folder. */
export function certPathShape(userId: string, path: any): string | null {
  if (typeof path !== 'string' || !path || path.length > 300) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('/') || path.includes('\\') || path.includes('..') || /[\u0000-\u001f?#%]/.test(path)) return null;
  const parts = path.split('/');
  if (parts.length !== 4 || parts[0] !== userId || parts[1] !== 'documents' || !/^\d{10,16}$/.test(parts[2]) || !parts[3]) return null;
  const ext = parts[3].split('.').pop()!.toLowerCase();
  return CERT_EXT[ext] ? path : null;
}
/** Shape check + the object must really exist in the bucket (service client) with an allowed type and size. */
export async function checkCertificate(sb: SupabaseClient, userId: string, path: any): Promise<{ ok: true; meta: CertMeta } | { ok: false; msg: string }> {
  const okPath = certPathShape(userId, path);
  if (!okPath) return { ok: false, msg: 'That file is not one of your own uploads, so I cannot attach it.' };
  const i = okPath.lastIndexOf('/');
  const dir = okPath.slice(0, i), file = okPath.slice(i + 1);
  const unverifiable = { ok: false as const, msg: 'I could not verify the uploaded file right now. Please try uploading again.' };
  let found: any = null;
  try {
    const { data, error } = await sb.storage.from(CERT_BUCKET).list(dir, { limit: 100, search: file });
    if (error) return unverifiable;
    found = (data ?? []).find((o: any) => o?.name === file) ?? null;
  } catch { return unverifiable; }
  if (!found) return { ok: false, msg: 'I could not find that uploaded file. Please upload the certificate again.' };
  const ext = file.split('.').pop()!.toLowerCase();
  const mime = String(found.metadata?.mimetype || CERT_EXT[ext] || '');
  const size = Number(found.metadata?.size ?? 0);
  if (!CERT_MIME_OK.has(mime)) return { ok: false, msg: 'Only JPG, PNG or PDF certificates are accepted.' };
  if (size > CERT_MAX_MB * 1024 * 1024) return { ok: false, msg: `The file must be smaller than ${CERT_MAX_MB} MB.` };
  return { ok: true, meta: { name: file, type: mime, size, path: okPath } };
}

// ===================================================================================== leave types
/** Chat key → the app's form value (ApplyLeave <select>), the value saved in leave_requests.leave_type, and display label. */
type TypeKey = 'earned' | 'sick' | 'blue' | 'pink' | 'comp_off' | 'lop' | 'wfh' | 'child_care' | 'maternity' | 'correction' | 'permission' | 'blue_leave_work' | 'regularization';
const TYPES: Record<TypeKey, { form: string; db: string; label: string; chat: boolean; balance?: 'earned' | 'sick' | 'compOff' | 'blue' | 'pink'; appOnlyWhy?: string }> = {
  earned: { form: 'Earned', db: 'Earned', label: 'Earned Leave', chat: true, balance: 'earned' },
  sick: { form: 'Sick', db: 'Sick', label: 'Sick Leave', chat: true, balance: 'sick' },
  // ApplyLeave saves the male "Blue Leave" option (form value 'Floating') as leave_type 'Comp Off'
  blue: { form: 'Floating', db: 'Comp Off', label: 'Blue Leave', chat: true, balance: 'blue' },
  pink: { form: 'Pink Leave', db: 'Pink Leave', label: 'Pink Leave', chat: true, balance: 'pink' },
  comp_off: { form: 'Comp Off', db: 'Comp Off', label: 'Comp Off', chat: true, balance: 'compOff' },
  lop: { form: 'Loss of Pay', db: 'Loss of Pay', label: 'Loss of Pay (LOP)', chat: true },
  wfh: { form: 'WFH', db: 'WFH', label: 'Work From Home (WFH)', chat: true },
  child_care: { form: 'Child Care', db: 'Child Care', label: 'Child Care Leave', chat: false, appOnlyWhy: "Child Care Leave depends on your children's records, which the chat can't check." },
  maternity: { form: 'Maternity', db: 'Maternity', label: 'Maternity Leave', chat: false, appOnlyWhy: 'Maternity Leave is currently not offered on the Apply Leave form. Please contact HR.' },
  correction: { form: 'Correction', db: 'Correction', label: 'Request for Correction (RC)', chat: false, appOnlyWhy: 'A correction needs punch times and your attendance logs for that day.' },
  permission: { form: 'Permission', db: 'Permission', label: 'Request for Permission (RP)', chat: false, appOnlyWhy: 'A permission needs exact start/end times checked against your punches.' },
  blue_leave_work: { form: 'Blue Leave Work', db: 'Blue Leave Work', label: 'Work on Blue Leave (3rd Saturday)', chat: false, appOnlyWhy: 'Work on the 3rd Saturday is requested from the Apply Leave form.' },
  regularization: { form: 'Regularization', db: 'Regularization', label: 'Attendance Regularization (RG)', chat: false, appOnlyWhy: 'Regularization needs your punch times for that day.' },
};
const TYPE_KEYS = Object.keys(TYPES) as TypeKey[];

/** Leave type mentioned in free text (null = none; 'casual' = a type the app does not have). */
export function parseLeaveType(raw: string): TypeKey | 'casual' | null {
  const t = ` ${lc(raw).replace(/[^a-z0-9/\s-]/g, ' ').replace(/\s+/g, ' ')} `;
  if (/\b(blue leave work|work(ing)? on (blue leave|(the )?3rd saturday|third saturday))\b/.test(t)) return 'blue_leave_work';
  if (/\bregulari[sz]ation\b/.test(t)) return 'regularization';
  if (/\b(correction|rc)\b/.test(t)) return 'correction';
  if (/\b(permission|rp)\b/.test(t)) return 'permission';
  if (/\b(comp\s*-?\s*off|compoff|c\/o|compensatory( off| leave)?)\b/.test(t)) return 'comp_off';
  if (/\b(earned|el|e\/l|privilege leave|annual leave)\b/.test(t)) return 'earned';
  if (/\b(sick|sl|s\/l|medical leave)\b/.test(t)) return 'sick';
  if (/\b(blue|floating)( leave| holiday)?\b/.test(t)) return 'blue';
  if (/\b(pink|menstrual|period leave)\b/.test(t)) return 'pink';
  if (/\b(loss of pay|lop|unpaid( leave)?|without pay)\b/.test(t)) return 'lop';
  if (/\b(wfh|work from home|w\/h)\b/.test(t)) return 'wfh';
  if (/\b(child ?care|ccl)\b/.test(t)) return 'child_care';
  if (/\bmaternity\b/.test(t)) return 'maternity';
  if (/\b(casual|cl|c\/l)( leave)?\b/.test(t)) return 'casual';
  return null;
}
const asTypeKey = (v: any): TypeKey | null => {
  if (typeof v !== 'string' || !v) return null;
  if ((TYPE_KEYS as string[]).includes(v)) return v as TypeKey;
  const p = parseLeaveType(v);
  return p && p !== 'casual' ? p : null;
};

/** half / full from free text (null = not mentioned). The app only has 'full' | 'half' (no first/second half). */
export function parseDayOption(raw: string): 'full' | 'half' | null {
  const t = lc(raw);
  if (/\b(half|haaf|half-day|halfday)\b|(^|\s)(1\/2|0\.5)\s*day|\b(first|second|1st|2nd) half\b|\bmorning half\b|\bafternoon\b/.test(t)) return 'half';
  if (/\bfull( day)?\b|\bwhole day\b|\bpoora din\b/.test(t)) return 'full';
  return null;
}

// ===================================================================================== date parsing
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const ORD = '(?:st|nd|rd|th)?';
const monIdx = (s: string) => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(s.slice(0, 3)) + 1;
const WEEKDAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1 };

/** No explicit year → the year that puts the date closest to today (2 Dec in late Nov = this year, 5 Jan = next year). */
function inferYear(m: number, d: number, today: string) {
  const Y = Number(today.slice(0, 4));
  let best = Y, bestDiff = Infinity;
  for (const y of [Y - 1, Y, Y + 1]) {
    const s = ymd(y, m, d);
    const diff = Math.abs(dUTC(s).getTime() - dUTC(today).getTime());
    if (diff < bestDiff) { best = y; bestDiff = diff; }
  }
  return best;
}
const validDay = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && ymd(y, m, d).slice(5) === `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Leave dates from free text: "tomorrow", "2 dec to 4 dec", "2-4 dec", "dec 2 to 4", "friday", "next monday",
 * "02/12/2026", "tomorrow for 3 days", "kal" (Hinglish = tomorrow in a leave request), "parso" (day after tomorrow).
 * Returns null when no date is mentioned.
 */
export function parseLeaveDates(raw: string, today: string): { start: string; end: string } | null {
  let t = ` ${lc(raw).replace(/[,;]/g, ' ').replace(/\s+/g, ' ')} `;
  t = t.replace(/\bkal\b/g, 'tomorrow').replace(/\bparso[n]?\b/g, 'day after tomorrow').replace(/\baaj\b/g, 'today').replace(/\btmrw?\b|\btmw\b|\btomorow\b|\btommorow\b|\btommorrow\b/g, 'tomorrow');
  const Y = Number(today.slice(0, 4));
  const mk = (y: number | null, m: number, d: number) => { const yy = y ?? inferYear(m, d, today); return validDay(yy, m, d) ? ymd(yy, m, d) : null; };
  const yr = (s?: string) => (s ? (s.length === 2 ? 2000 + Number(s) : Number(s)) : null);
  const SEP = '\\s*(?:-|–|to|till|until|thru|through|and|&)\\s*';

  // 1) ranges inside one month: "2-4 dec", "2nd to 4th december 2026", "dec 2 to 4"
  let m = t.match(new RegExp(`\\b(\\d{1,2})${ORD}${SEP}(\\d{1,2})${ORD}\\s+(?:of\\s+)?${MON}\\b(?:\\s+(\\d{4}))?`));
  if (m) { const mo = monIdx(m[3]); const a = mk(yr(m[4]), mo, +m[1]), b = mk(yr(m[4]), mo, +m[2]); if (a && b) return { start: a, end: b < a ? mk(Number(a.slice(0, 4)) + 1, mo, +m[2]) ?? b : b }; }
  m = t.match(new RegExp(`\\b${MON}\\s+(\\d{1,2})${ORD}${SEP}(\\d{1,2})${ORD}\\b(?!\\s*[/.:-]?\\s*(?:\\d|${MON}))(?:\\s+(\\d{4}))?`));
  if (m) { const mo = monIdx(m[1]); const a = mk(yr(m[4]), mo, +m[2]), b = mk(yr(m[4]), mo, +m[3]); if (a && b) return { start: a, end: b }; }

  // 2) individual date mentions, in order of appearance
  const hits: { at: number; len: number; date: string }[] = [];
  const add = (re: RegExp, fn: (mm: RegExpExecArray) => string | null) => {
    const g = new RegExp(re.source, 'g');
    let mm: RegExpExecArray | null;
    while ((mm = g.exec(t))) {
      const date = fn(mm);
      if (date && !hits.some(h => mm!.index < h.at + h.len && h.at < mm!.index + mm![0].length)) hits.push({ at: mm.index, len: mm[0].length, date });
    }
  };
  add(/\bday after tomorrow\b/, () => addDays(today, 2));
  add(/\bday before yesterday\b/, () => addDays(today, -2));
  add(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, mm => (validDay(+mm[1], +mm[2], +mm[3]) ? ymd(+mm[1], +mm[2], +mm[3]) : null));
  add(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b(?!\s*(?:day|days|hr|hrs|hour))/, mm => mk(yr(mm[3]), +mm[2], +mm[1]));
  add(new RegExp(`\\b(\\d{1,2})${ORD}\\s+(?:of\\s+)?${MON}\\b(?:\\s+(\\d{4}))?`), mm => mk(yr(mm[3]), monIdx(mm[2]), +mm[1]));
  add(new RegExp(`\\b${MON}\\s+(\\d{1,2})${ORD}\\b(?:\\s+(\\d{4}))?`), mm => mk(yr(mm[3]), monIdx(mm[1]), +mm[2]));
  add(/\btomorrow\b/, () => addDays(today, 1));
  add(/\b(today|tonight)\b/, () => today);
  add(/\byesterday\b/, () => addDays(today, -1));
  add(/\b(?:(this|next|coming|last|previous)\s+)?(sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)(?:day|nesday|sday|urday)?\b/, mm => {
    const want = WEEKDAYS[mm[2]]; if (want === undefined) return null;
    const cur = dowOf(today);
    if (mm[1] === 'last' || mm[1] === 'previous') { let back = (cur - want + 7) % 7; if (back === 0) back = 7; return addDays(today, -back); }
    let fwd = (want - cur + 7) % 7;
    if (mm[1] === 'next' && fwd === 0) fwd = 7;
    return addDays(today, fwd);
  });
  if (!hits.length) return null;
  hits.sort((a, b) => a.at - b.at);
  const start = hits[0].date;
  let end = hits[hits.length - 1].date;
  if (hits.length === 1) {
    // "tomorrow for 3 days" / "3 days from monday"
    const n = t.match(/(?<![/.\d])\b(?:for\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\b/);
    if (n) { const k = /^\d+$/.test(n[1]) ? +n[1] : NUM_WORDS[n[1]]; if (k >= 1 && k <= 60) end = addDays(start, k - 1); }
  }
  void Y;
  return { start, end };
}

// ===================================================================================== data loading
let settingsCache: { at: number; as: any; wf: any } | null = null;
async function loadSettings(sb: SupabaseClient) {
  if (settingsCache && Date.now() - settingsCache.at < 5 * 60_000) return settingsCache;
  const { data, error } = await sb.from('settings').select('attendance_settings, approval_workflow_settings').eq('id', 'singleton').maybeSingle();
  if (error) throw new Error(`settings: ${error.message}`);
  settingsCache = { at: Date.now(), as: (data as any)?.attendance_settings ?? {}, wf: (data as any)?.approval_workflow_settings ?? {} };
  return settingsCache;
}

interface Profile {
  id: string; name: string; role_id: string; gender: string | null; joining_date: string | null; created_at: string | null;
  reporting_manager_id: string | null; society_id: string | null; weekly_off_days: number[] | null;
  earned_leave_opening_date: string | null; sick_leave_opening_date: string | null; comp_off_opening_date: string | null;
  floating_leave_opening_date: string | null; child_care_leave_opening_date: string | null;
}
async function loadProfile(sb: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await sb.from('users').select(`id, name, role_id, gender, joining_date, created_at, reporting_manager_id, society_id, weekly_off_days,
    earned_leave_opening_date, sick_leave_opening_date, comp_off_opening_date, floating_leave_opening_date, child_care_leave_opening_date`).eq('id', userId).single();
  if (error || !data) throw new Error(`users: ${error?.message ?? 'not found'}`);
  return data as any;
}
async function userName(sb: SupabaseClient, id: string | null) {
  if (!id) return null;
  const { data } = await sb.from('users').select('name').eq('id', id).maybeSingle();
  return (data as any)?.name ?? null;
}

interface Ctx2 {
  p: Profile; as: any; wf: any; rules: any; category: 'office' | 'field' | 'site'; isFemale: boolean; isProbation: boolean; probationEnd: string;
  joinDate: string | null; bal: Awaited<ReturnType<typeof computeLeaveBalance>>; today: string;
}
async function loadCtx(ctx: AssistCtx): Promise<Ctx2> {
  const [p, s, bal] = await Promise.all([loadProfile(ctx.sb, ctx.asker.id), loadSettings(ctx.sb), computeLeaveBalance(ctx.sb, ctx.asker.id, ctx.now)]);
  const category = staffCategory(p.role_id, p.society_id, s.as);
  const today = todayIst(ctx.now);
  // ApplyLeave isProbation: today < (joiningDate || createdAt) + 3 months
  const joinDate = (p.joining_date || p.created_at || '').slice(0, 10) || null;
  const probationEnd = joinDate ? (() => { const j = dUTC(joinDate); return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth() + 3, j.getUTCDate())).toISOString().slice(0, 10); })() : '0000-00-00';
  return {
    p, as: s.as, wf: s.wf, rules: s.as?.[category] ?? {}, category, today, bal, joinDate, probationEnd,
    isFemale: ['female', 'ladies'].includes(lc(p.gender)),
    isProbation: !!joinDate && today < probationEnd,
  };
}

/** Available balance shown on the chip / used for the check (null = no balance needed: LOP, WFH). */
function availableFor(c: Ctx2, k: TypeKey): number | null {
  switch (TYPES[k].balance) {
    case 'earned': return c.bal.earned.available;
    case 'sick': return r1(Math.max(0, c.bal.sick.available));
    case 'compOff': return c.bal.compOff.available;
    case 'blue': return c.bal.blue.available;
    case 'pink': return c.bal.pink.available;
    default: return null;
  }
}

/** ApplyLeave <select> options for this user (types offered by the app), in the app's order. */
function appTypesFor(c: Ctx2): TypeKey[] {
  const out: TypeKey[] = [];
  if (!c.isProbation) out.push('earned', 'sick');
  out.push(c.isFemale ? 'pink' : 'blue');
  if (c.p.role_id !== 'technical_reliever') out.push('comp_off');
  out.push('lop');
  if (!c.isProbation && c.category === 'office') out.push('wfh');
  return out;
}

// ===================================================================================== signed confirm token
const SECRET = () => process.env.ASSIST_ACTION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'assist-dev-secret';
const sig = (s: string) => crypto.createHmac('sha256', SECRET()).update(s).digest('hex').slice(0, 32);
function signDraft(userId: string, d: Draft, at = Date.now()) {
  const body = JSON.stringify([userId, d.leave_type, d.start_date, d.end_date, d.day_option, d.reason ?? '', at, d.certificate_path ?? '']);
  return `${at.toString(36)}.${sig(body)}`;
}
function verifyDraft(userId: string, d: Draft, token: any): boolean {
  if (typeof token !== 'string' || !/^[0-9a-z]+\.[0-9a-f]{32}$/.test(token)) return false;
  const at = parseInt(token.split('.')[0], 36);
  if (!Number.isFinite(at) || Date.now() - at > DRAFT_TTL_MS || at - Date.now() > 60_000) return false;
  const expect = signDraft(userId, d, at);
  return crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(token));
}
/** Deterministic request id from the confirm token → a double click inserts the same primary key (second insert fails). */
function idFromToken(token: string) {
  const h = crypto.createHash('sha256').update(`leave_request:${token}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// ===================================================================================== draft
interface Draft { leave_type?: TypeKey; start_date?: string; end_date?: string; day_option?: 'full' | 'half'; reason?: string; certificate_path?: string; certificate_name?: string }
export interface PendingDraft { tool: string; args: Record<string, any>; awaiting: 'leave_type' | 'dates' | 'day_option' | 'reason' | 'certificate' | 'confirm' | 'withdraw_pick' }
type ClarifyWithPending = Extract<ToolResult, { kind: 'clarify' }> & { pending?: PendingDraft };

const draftArgs = (d: Draft): Record<string, any> => Object.fromEntries(Object.entries({
  leave_type: d.leave_type, start_date: d.start_date, end_date: d.end_date, day_option: d.day_option, reason: d.reason,
  certificate_path: d.certificate_path, certificate_name: d.certificate_name,
}).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const without = (d: Draft, ...keys: (keyof Draft)[]) => { const x: any = { ...d }; keys.forEach(k => delete x[k]); return draftArgs(x); };

function clarify(question: string, options: ClarifyOption[], awaiting: PendingDraft['awaiting'] | null, d: Draft, markdown?: string, tool = 'apply_leave', upload?: AssistUploadSpec): ClarifyWithPending {
  const r: ClarifyWithPending = { kind: 'clarify', question, options, ...(markdown ? { markdown } : {}), ...(upload ? { upload } : {}) };
  if (awaiting) r.pending = { tool, args: draftArgs(d), awaiting };
  return r;
}
const cancelOpt = (d: Draft): ClarifyOption => ({ label: 'Cancel', args: { ...draftArgs(d), step: 'cancel' } });
const changeOpts = (d: Draft, which: ('dates' | 'type' | 'day' | 'reason')[]): ClarifyOption[] => [
  ...(which.includes('dates') ? [{ label: 'Change dates', args: without(d, 'start_date', 'end_date', 'day_option') }] : []),
  ...(which.includes('type') ? [{ label: 'Change type', args: without(d, 'leave_type') }] : []),
  ...(which.includes('day') ? [{ label: 'Change full / half day', args: without(d, 'day_option') }] : []),
  ...(which.includes('reason') ? [{ label: 'Change reason', args: without(d, 'reason') }] : []),
  cancelOpt(d),
];
const answer = (markdown: string, facts: Record<string, any> = {}, actions?: AssistAction[], sourceLabel = 'Leave'): ToolResult => ({ kind: 'answer', facts, sourceLabel, markdown, ...(actions?.length ? { actions } : {}) });

/** Sanitises client/planner args (they can come back from the client in a selection — never trusted). */
function readDraft(args: Record<string, any>, today: string): { d: Draft; hint?: string; unknownType?: string } {
  const d: Draft = {};
  let hint: string | undefined, unknownType: string | undefined;
  const lt = args.leave_type;
  if (lt) {
    const k = asTypeKey(lt);
    if (k) d.leave_type = k;
    else if (parseLeaveType(String(lt)) === 'casual' || /casual/i.test(String(lt))) unknownType = 'Casual Leave';
    else unknownType = String(lt).slice(0, 40);
  }
  if (isYmd(args.start_date)) { d.start_date = args.start_date; d.end_date = isYmd(args.end_date) ? args.end_date : args.start_date; }
  else if (typeof args.dates_text === 'string' && args.dates_text.trim()) {
    const r = parseLeaveDates(args.dates_text.slice(0, 200), today);
    if (r) { d.start_date = r.start; d.end_date = r.end; }
  }
  if (args.day_option === 'full' || args.day_option === 'half') d.day_option = args.day_option;
  if (typeof args.reason === 'string' && args.reason.trim()) d.reason = args.reason.replace(/\s+/g, ' ').trim().slice(0, 500);
  // certificate (Sick only). The path is only a CLAIM here — checkCertificate() verifies it on every preview and confirm.
  if (typeof args.certificate_path === 'string' && args.certificate_path) d.certificate_path = args.certificate_path.slice(0, 300);
  if (typeof args.certificate_name === 'string' && args.certificate_name) d.certificate_name = args.certificate_name.replace(/[\u0000-\u001f]/g, '').slice(0, 120);
  if (d.leave_type && d.leave_type !== 'sick') { delete d.certificate_path; delete d.certificate_name; }
  if (typeof args.hint === 'string') hint = args.hint.slice(0, 200);
  return { d, hint, unknownType };
}

// ===================================================================================== holidays / weekly offs in range (for warnings)
const FIXED_HOLIDAYS = [['01-26', 'Republic Day'], ['05-01', 'May Day'], ['08-15', 'Independence Day'], ['10-02', 'Gandhi Jayanti'], ['11-01', 'Karnataka Rajyotsava']];
async function offDaysIn(sb: SupabaseClient, c: Ctx2, from: string, to: string) {
  const weekly: number[] = Array.isArray(c.p.weekly_off_days) && c.p.weekly_off_days.length ? c.p.weekly_off_days : (c.rules.weekly_off_days || [0]);
  const [h, uh] = await Promise.all([
    sb.from('holidays').select('*').gte('date', from).lte('date', to),
    sb.from('user_holidays').select('holiday_date, holiday_name').eq('user_id', c.p.id).gte('holiday_date', from).lte('holiday_date', to),
  ]);
  const hol = new Map<string, string>();
  ((h as any).data ?? []).forEach((x: any) => hol.set(String(x.date).slice(0, 10), x.name || 'Holiday'));
  ((uh as any).data ?? []).forEach((x: any) => hol.set(x.holiday_date, x.holiday_name || 'Holiday'));
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 10; d = addDays(d, 1)) {
    const fixed = FIXED_HOLIDAYS.find(f => d.slice(5) === f[0]);
    if (hol.has(d) || fixed) out.push(`${shortDay(d)} (${hol.get(d) ?? fixed![1]})`);
    else if (weekly.includes(dowOf(d))) out.push(`${shortDay(d)} (weekly off)`);
  }
  return out;
}

// ===================================================================================== validation (ApplyLeave.onSubmit + submitLeaveRequest)
interface Check { errors: { msg: string; fix: ('dates' | 'type' | 'day' | 'reason')[] }[]; warnings: string[]; days: number; before: number | null; after: number | null; approverName: string | null }

async function validate(ctx: AssistCtx, c: Ctx2, d: Required<Pick<Draft, 'leave_type' | 'start_date' | 'end_date' | 'day_option'>> & Draft): Promise<Check> {
  const T = TYPES[d.leave_type];
  const errors: Check['errors'] = [];
  const warnings: string[] = [];
  const err = (msg: string, ...fix: ('dates' | 'type' | 'day' | 'reason')[]) => errors.push({ msg, fix: fix.length ? fix : ['dates', 'type'] });
  const start = d.start_date, end = d.end_date, today = c.today;
  const days = d.day_option === 'half' ? 0.5 : daysIncl(start, end);   // both the form and the server count calendar days

  // yup schema
  if (end < start) err('The end date is before the start date.', 'dates');
  if (d.leave_type !== 'pink' && (!d.reason || d.reason.length < 10)) err('Please give a slightly more detailed reason (at least 10 characters).', 'reason');
  if (daysIncl(start, end) > 60) err('That is a very long range. For leave longer than 60 days please apply in the app or contact HR.', 'dates');

  // 1) probation (form hides Earned / Sick / Child Care / WFH; onSubmit blocks Earned / Sick / Child Care)
  if (c.isProbation && ['earned', 'sick', 'child_care', 'wfh'].includes(d.leave_type)) err(`You cannot apply for ${T.label} during your 3-month probation period (until ${prettyDate(c.probationEnd)}).`, 'type');
  if (!appTypesFor(c).includes(d.leave_type) && !(c.isProbation && ['earned', 'sick', 'wfh'].includes(d.leave_type))) {
    const why = d.leave_type === 'pink' ? 'Pink Leave is only available to female employees.'
      : d.leave_type === 'blue' ? 'Blue Leave is offered to male staff (women get Pink Leave).'
      : d.leave_type === 'comp_off' ? 'Comp Off is not offered for technical relievers.'
      : d.leave_type === 'wfh' ? 'Work From Home is only offered to office staff.' : `${T.label} is not available for your account.`;
    err(why, 'type');
  }

  // 2) duplicate check — same leave type (as saved) overlapping, not rejected / cancelled / withdrawn
  const { data: mine } = await ctx.sb.from('leave_requests').select('id, leave_type, start_date, end_date, status, day_option')
    .eq('user_id', c.p.id).lte('start_date', end).gte('end_date', start);
  const live = ((mine ?? []) as any[]).filter(r => !['rejected', 'cancelled', 'withdrawn'].includes(r.status) && (r.start_date <= end && (r.end_date || r.start_date) >= start));
  const sameType = live.filter(r => r.leave_type === T.db);
  if (sameType.length) {
    const x = sameType[0];
    err(`You already have a ${x.leave_type} request (${String(x.status).replace(/_/g, ' ')}) for ${x.start_date === x.end_date ? prettyDate(x.start_date) : `${prettyDate(x.start_date)} to ${prettyDate(x.end_date)}`}. Please withdraw or cancel it first.`, 'dates');
  }
  const otherType = live.filter(r => r.leave_type !== T.db && !/correction|permission/i.test(r.leave_type));
  if (otherType.length) warnings.push(`You also have a ${otherType[0].leave_type} request (${String(otherType[0].status).replace(/_/g, ' ')}) on these dates.`);

  // 3) date rules (form): Sick, Comp Off, Pink, WFH, LOP, Floating(Blue) → any date; Earned → no past dates; others → ≥ 1 day ahead
  if (d.leave_type === 'earned') { if (start < today) err('Earned Leave cannot be applied for past dates.', 'dates'); }
  else if (!['sick', 'comp_off', 'pink', 'wfh', 'lop', 'blue'].includes(d.leave_type) && start <= today) err('This type of leave must be applied at least one day in advance. Past and present days are not allowed.', 'dates');

  // 4) Blue Leave rules (form + server)
  if (d.leave_type === 'blue') {
    const ms = `${start.slice(0, 7)}-01`;
    let thirdSat: string | null = null;
    for (let x = ms, n = 0; x.slice(0, 7) === start.slice(0, 7); x = addDays(x, 1)) if (dowOf(x) === 6 && ++n === 3) { thirdSat = x; break; }
    const monthEnd = addDays(`${addDays(ms, 32).slice(0, 7)}-01`, -1);
    if (thirdSat) {
      if (today < thirdSat) err(`Blue Leave cannot be applied in advance. You can only apply after working on the 3rd Saturday (${ddmmyyyy(thirdSat)}).`, 'dates', 'type');
      else if (start < thirdSat) err(`Blue Leave can only be applied for dates after the 3rd Saturday (${ddmmyyyy(thirdSat)}) within the same month.`, 'dates');
      else if (start.slice(0, 7) !== end.slice(0, 7)) err('Blue Leave must be taken within the same calendar month and cannot span across months.', 'dates');
      else if (monthEnd < today) err('This Blue Leave has expired. Blue Leave must be used within the same calendar month in which it was earned.', 'dates');
      else {
        const { data: ev } = await ctx.sb.from('attendance_events').select('type').eq('user_id', c.p.id).gte('timestamp', `${thirdSat}T00:00:00Z`).lte('timestamp', `${thirdSat}T23:59:59Z`);
        const worked = ((ev ?? []) as any[]).some(e => ['punch-in', 'site-in', 'punch_in', 'site_in', 'check-in', 'checkin'].includes(lc(e.type)));
        if (!worked) {
          const { data: blw } = await ctx.sb.from('leave_requests').select('leave_type, status').eq('user_id', c.p.id).eq('start_date', thirdSat);
          const ok = ((blw ?? []) as any[]).some(r => ['approved', 'correction_made'].includes(r.status) && /blue leave work|correction|comp/i.test(r.leave_type));
          if (!ok) err(`You did not work on the 3rd Saturday (${ddmmyyyy(thirdSat)}) and are not eligible for Blue Leave.`, 'type');
        }
      }
    }
    // Owner confirmed (26 Nov 2026): saving Blue Leave as Comp Off is intended company policy — informational note, not a warning.
    warnings.push('ℹ Blue Leave is recorded as **Comp Off**, so it uses your Comp Off balance.');
  }

  // 5) Earned Leave: not 7 or more continuous days
  if (d.leave_type === 'earned' && days >= 7) err('You cannot apply for Earned Leave for 7 or more continuous days.', 'dates');

  // 6) Earned / Child Care: only from 3 months after joining (form + server)
  if (['earned', 'child_care'].includes(d.leave_type) && c.joinDate && start < c.probationEnd) err(`You are not eligible to apply for ${T.form} yet. You can only apply for this leave starting from ${ddmmyyyy(c.probationEnd)} (3 months after your joining date).`, 'dates', 'type');

  // 7) server: start date not before the opening date of that balance (by the SAVED type)
  const dbl = lc(T.db);
  const opening = dbl.includes('earned') ? c.p.earned_leave_opening_date : dbl.includes('sick') ? c.p.sick_leave_opening_date
    : dbl.includes('comp') ? c.p.comp_off_opening_date : dbl.includes('child') ? c.p.child_care_leave_opening_date
    : dbl.includes('pink') ? c.joinDate : null;
  if (opening && start < opening.slice(0, 10)) err(`You cannot apply for ${T.db} before your opening date of ${ddmmyyyy(opening.slice(0, 10))}.`, 'dates');

  // 8) balance + expiry (form: all types except LOP / WFH; server: per saved type)
  let before: number | null = null, after: number | null = null;
  if (T.balance) {
    let bal = c.bal;
    // the app reads balances "as of" the start date: monthly allowances (Pink) follow the start month
    if (T.balance === 'pink' && start.slice(0, 7) !== today.slice(0, 7)) bal = await computeLeaveBalance(ctx.sb, c.p.id, new Date(`${start}T06:30:00Z`));
    const expired = T.balance === 'earned' ? bal.earned.expired : T.balance === 'sick' ? bal.sick.expired : T.balance === 'blue' ? !bal.blue.eligible && false : false;
    if (expired) err(`The ${T.form} allocation has expired and is no longer available for use.`, 'type');
    before = T.balance === 'pink' ? bal.pink.available : availableFor({ ...c, bal }, d.leave_type);
    if (before != null && !expired) {
      if (before < days) {
        const tip = d.leave_type === 'comp_off' ? ' Comp Off is earned by working on a weekly off or holiday.' : d.leave_type === 'blue' ? ' Blue Leave is earned by working on the 3rd Saturday.' : '';
        err(`Insufficient ${T.form} balance. You have ${before.toFixed(1)} days available, but requested ${days} ${days === 1 ? 'day' : 'days'}.${tip}`, 'type', 'dates');
      }
      after = r1(before - days);
    }
    if (d.leave_type === 'pink' && !c.isFemale) err('Pink leave is only available to female employees.', 'type');
  }
  // server: Blue is saved as Comp Off → the Comp Off balance check applies too
  if (d.leave_type === 'blue' && c.bal.compOff.available < days) err(`Insufficient comp off balance. Requested: ${days} days, Available: ${c.bal.compOff.available} days.`, 'type');

  // informational
  if (daysIncl(start, end) > 1 && ['earned', 'sick', 'pink', 'lop'].includes(d.leave_type)) {
    const off = await offDaysIn(ctx.sb, c, start, end);
    if (off.length) warnings.push(`These days are inside your range and are counted as leave days too: ${off.join(', ')}.`);
  }
  if (d.leave_type === 'comp_off' && start > today) warnings.push('Comp Off is normally taken after you have earned it by working on a weekly off or holiday.');
  const approverName = await userName(ctx.sb, c.p.reporting_manager_id);
  if (!c.p.reporting_manager_id) warnings.push('No reporting manager is set on your profile, so nobody will be asked to approve this request. Please ask HR to set your reporting manager.');
  return { errors, warnings, days, before, after, approverName };
}

// ===================================================================================== notification (port of dispatchNotificationFromRules('leave_request'))
async function buildLeaveNotifications(sb: SupabaseClient, actor: { id: string; name: string; reportingManagerId: string | null }, leaveTypeDb: string, requestId: string) {
  if (!actor.reportingManagerId) return { notifications: [] as any[], pushUserIds: [] as string[], message: null as string | null };
  const { data: rules } = await sb.from('notification_rules').select('*').eq('event_type', 'leave_request').eq('is_enabled', true);
  const recipients = new Map<string, { sendAlert: boolean; sendPush: boolean }>();
  const addR = (id: string, r: any) => { const e = recipients.get(id) || { sendAlert: false, sendPush: false }; recipients.set(id, { sendAlert: e.sendAlert || !!r.send_alert, sendPush: e.sendPush || !!r.send_push }); };
  for (const r of (rules ?? []) as any[]) {
    if (r.recipient_user_id) {
      if (r.recipient_user_id === 'all') { const { data: all } = await sb.from('users').select('id'); (all ?? []).forEach((u: any) => addR(u.id, r)); }
      else addR(r.recipient_user_id, r);
    } else if (r.recipient_role) {
      if (r.recipient_role === 'direct_manager') addR(actor.reportingManagerId, r);
      else { const { data: us } = await sb.from('users').select('id').eq('role_id', r.recipient_role); (us ?? []).forEach((u: any) => addR(u.id, r)); }
    }
  }
  recipients.delete(actor.id);
  const { data: me } = await sb.from('users').select('photo_url').eq('id', actor.id).maybeSingle();
  const message = `${actor.name || 'An employee'} has submitted a new ${leaveTypeDb} leave request`;
  const notifications = [...recipients.entries()].map(([userId, f]) => ({
    user_id: userId, message, type: f.sendAlert ? 'security' : 'approval_request', link_to: '/my-team', severity: f.sendAlert ? 'High' : 'Low',
    metadata: { leaveRequestId: requestId, title: undefined, employeeName: actor.name || 'Employee', employeePhoto: (me as any)?.photo_url || undefined, employeeId: actor.id, isTeamActivity: false, isSelfNotification: false },
  }));
  // 'approval_request' is in the app's always-push list
  return { notifications, pushUserIds: notifications.map(n => n.user_id), message };
}

// ===================================================================================== apply_leave
const TYPE_PARAM_ENUM = ['earned', 'sick', 'comp_off', 'blue', 'pink', 'lop', 'wfh', 'child_care', 'maternity', 'correction', 'permission'];

async function runApplyLeave(ctx: AssistCtx, args: Record<string, any>): Promise<ToolResult> {
  const today = todayIst(ctx.now);
  const step = ['collect', 'preview', 'confirm', 'cancel'].includes(args.step) ? args.step : 'collect';
  const { d, hint, unknownType } = readDraft(args, today);

  if (step === 'cancel') return answer('Okay, I have cancelled this leave request. Nothing was submitted.', { cancelled: true });

  // v1: only the asker's own leave
  if (typeof args.person_name === 'string' && args.person_name.trim()) {
    const words = lc(args.person_name).split(/\s+/).filter(Boolean);
    const self = /^(i|me|my|myself|self)$/.test(lc(args.person_name)) || words.every(w => lc(ctx.asker.name).includes(w));
    if (!self) {
      ctx.audit({ tool: 'apply_leave', args, allowed: false, note: 'apply for someone else refused' });
      return answer(`I can only apply leave for **you** (${ctx.asker.name}). ${args.person_name} needs to apply from their own account. If you manage their attendance, use the Leave pages in the app.`, { refused: 'other_person' }, [{ label: 'Open Leave dashboard', route: ROUTE_DASHBOARD }]);
    }
  }
  if (ctx.scope.level === 'none' || !ctx.scope.can('leave')) return { kind: 'denied', text: 'Your account cannot apply for leave from the chat.' };

  const c = await loadCtx(ctx);
  const offered = appTypesFor(c);
  const hintLine = hint ? `${hint}\n\n` : '';

  // ---- 1. leave type
  if (unknownType && !d.leave_type) {
    return clarify(`There is no ${unknownType} in the Paradigm app. Which leave type do you want?`, typeOptions(c, offered, d), 'leave_type', d);
  }
  if (!d.leave_type) return clarify(`${hint ? hint + ' ' : ''}Which leave do you want to apply for?`, typeOptions(c, offered, d), 'leave_type', d);
  const T = TYPES[d.leave_type];
  if (!T.chat) {
    return answer(`${T.appOnlyWhy ?? ''} Please apply for **${T.label}** from the Apply Leave page.`.trim(), { app_only: T.label }, [{ label: 'Open Apply Leave', route: ROUTE_APPLY }]);
  }
  if (!offered.includes(d.leave_type)) {
    const why = c.isProbation && ['earned', 'sick', 'wfh'].includes(d.leave_type) ? `You cannot apply for ${T.label} during your 3-month probation period (until ${prettyDate(c.probationEnd)}).`
      : d.leave_type === 'pink' ? 'Pink Leave is only available to female employees.' : d.leave_type === 'blue' ? 'Blue Leave is offered to male staff (women get Pink Leave).'
      : d.leave_type === 'comp_off' ? 'Comp Off is not offered for technical relievers.' : d.leave_type === 'wfh' ? 'Work From Home is only offered to office staff.' : `${T.label} is not available for your account.`;
    return clarify(`${why} Which leave would you like instead?`, typeOptions(c, offered, without(d, 'leave_type') as Draft), 'leave_type', without(d, 'leave_type') as Draft);
  }

  // ---- 2. dates
  if (!d.start_date) {
    const opts: ClarifyOption[] = [['Today', today], ['Tomorrow', addDays(today, 1)], ['Day after tomorrow', addDays(today, 2)]].map(([label, dt]) => ({ label, sublabel: shortDay(dt), args: { ...draftArgs(d), start_date: dt, end_date: dt } }));
    return clarify(`${hintLine}Which date(s) for your **${T.label}**? Pick one below, or type the dates, e.g. "2 Dec to 4 Dec".`, [...opts, cancelOpt(d)], 'dates', d);
  }
  if (d.end_date! < d.start_date) {
    return clarify(`The end date (${prettyDate(d.end_date)}) is before the start date (${prettyDate(d.start_date)}). Please type the dates again, e.g. "2 Dec to 4 Dec".`, [cancelOpt(without(d, 'start_date', 'end_date') as Draft)], 'dates', without(d, 'start_date', 'end_date') as Draft);
  }

  // ---- 3. full / half day (the form shows the Day Option only for a single day)
  const single = d.start_date === d.end_date;
  if (!single) d.day_option = 'full';
  if (single && !d.day_option) {
    return clarify(`${hintLine}Full day or half day on ${shortDay(d.start_date)}?`, [
      { label: 'Full day', args: { ...draftArgs(d), day_option: 'full' } },
      { label: 'Half day', args: { ...draftArgs(d), day_option: 'half' } },
      cancelOpt(d),
    ], 'day_option', d);
  }

  // ---- 4. reason (Pink Leave: the app fills it)
  if (d.leave_type === 'pink') d.reason = 'Pink Leave Request (Menstrual Leave)';
  if (!d.reason || d.reason.length < 10) {
    const q = d.reason ? `"${d.reason}" is a little short. Please type a reason of at least 10 characters, or pick one below.` : `${hintLine}Type a short reason for your leave, or pick one below.`;
    const reasonOpts: ClarifyOption[] = ['Personal work', 'Not feeling well', 'Family function'].map(r => ({ label: r, args: { ...draftArgs(d), reason: r } }));
    return clarify(q, [...reasonOpts, cancelOpt(without(d, 'reason') as Draft)], 'reason', without(d, 'reason') as Draft);
  }

  // ---- 5. validate
  const full = d as Required<Draft>;
  const v = await validate(ctx, c, full);
  if (v.errors.length) {
    const fixes = [...new Set(v.errors.flatMap(e => e.fix))];
    const md = `⚠️ **I can't submit this yet**\n\n${v.errors.map(e => `- ${e.msg}`).join('\n')}`;
    const awaiting = fixes[0] === 'reason' ? 'reason' : fixes[0] === 'type' ? 'leave_type' : 'dates';
    return clarify('What would you like to change?', changeOpts(full, fixes), awaiting, full, md);
  }

  // ---- 5b. medical certificate (Sick Leave: the app requires it on every request). Eligible users only get here.
  let cert: CertMeta | null = null;
  if (full.leave_type === 'sick') {
    const noPath = without(full, 'certificate_path', 'certificate_name') as Draft;
    const askUpload = (lead: string) => clarify(`${lead}Please upload your doctor's certificate or prescription using the button below (JPG, PNG or PDF, up to ${CERT_MAX_MB} MB).`,
      [...changeOpts(noPath, ['dates', 'type'])], 'certificate', noPath, undefined, 'apply_leave', CERT_UPLOAD);
    if (!full.certificate_path) return askUpload(hint ? `${hint} ` : '');
    const chk = await checkCertificate(ctx.sb, ctx.asker.id, full.certificate_path);
    if (chk.ok === false) {
      ctx.audit({ tool: 'apply_leave', args: { step, certificate: 'rejected' }, subjectUserId: c.p.id, allowed: false, note: 'certificate path refused' });
      return askUpload(`⚠️ ${chk.msg} `);
    }
    cert = chk.meta;
  }

  // ---- 6. confirm (chip click only, signed by the preview — the signature covers the certificate path) / preview
  if (step === 'confirm' && verifyDraft(ctx.asker.id, full, args.confirm_token)) {
    return submit(ctx, c, full, v, String(args.confirm_token), cert);
  }
  const token = signDraft(ctx.asker.id, full);
  const md = previewCard(c, full, v, step === 'confirm' ? 'That confirmation has expired, so here is the request again.' : (args.typed_confirm ? 'To submit, please tap **Confirm & submit**.' : null), cert);
  return clarify('Shall I submit this leave request?', [
    { label: 'Confirm & submit', sublabel: 'Sends it to your approver', args: { ...draftArgs(full), step: 'confirm', confirm_token: token } },
    { label: 'Change dates', args: without(full, 'start_date', 'end_date', 'day_option') },
    ...(cert ? [{ label: 'Change certificate', args: without(full, 'certificate_path', 'certificate_name') }] : []),
    { label: 'Change type', args: without(full, 'leave_type') },
    cancelOpt(full),
  ], 'confirm', full, md);
}

function typeOptions(c: Ctx2, offered: TypeKey[], d: Draft): ClarifyOption[] {
  const opts: ClarifyOption[] = offered.map(k => {
    const av = availableFor(c, k);
    const sub = k === 'sick' ? `${av} available · needs medical certificate` : av == null ? (k === 'lop' ? 'no balance needed (unpaid)' : 'no balance needed') : `${av} ${av === 1 ? 'day' : 'days'} available`;
    return { label: TYPES[k].label, sublabel: sub, args: { ...draftArgs(d), leave_type: k } };
  });
  return [...opts, cancelOpt(d)];
}

function previewCard(c: Ctx2, d: Required<Draft>, v: Check, note: string | null, cert: CertMeta | null = null) {
  const T = TYPES[d.leave_type];
  const dates = d.start_date === d.end_date ? shortDay(d.start_date) : `${shortDay(d.start_date)} → ${shortDay(d.end_date)}`;
  const lines = [
    note ? `${note}\n` : null,
    '📝 **Leave request — please check**',
    '',
    `- **Type:** ${T.label}${T.db !== T.form ? ` (saved as "${T.db}")` : ''}`,
    `- **Dates:** ${dates}`,
    `- **Day:** ${d.day_option === 'half' ? 'Half day' : 'Full day'}`,
    `- **Days counted:** ${v.days}`,
    `- **Reason:** ${d.reason}`,
    ...(cert ? [`- **Certificate:** 📎 ${cert.name.replace(/[*`\[\]]/g, '')} (attached)`] : []),
    `- **Approver:** ${v.approverName ? `${v.approverName} (reporting manager)` : 'none set'}`,
    v.before != null ? `- **Balance:** ${v.before} → ${v.after} ${v.after === 1 ? 'day' : 'days'}` : `- **Balance:** not needed for ${T.label}`,
    `- **Status after submit:** Pending manager approval`,
    ...(v.warnings.length ? ['', ...v.warnings.map(w => `⚠️ ${w}`)] : []),
  ];
  return lines.filter(l => l !== null).join('\n');
}

async function submit(ctx: AssistCtx, c: Ctx2, d: Required<Draft>, v: Check, token: string, cert: CertMeta | null = null): Promise<ToolResult> {
  const T = TYPES[d.leave_type];
  const id = idFromToken(token);
  const actions: AssistAction[] = [{ label: 'Open My Leaves', route: ROUTE_DASHBOARD }];
  const already = (when?: string) => answer(`✅ This leave request was already submitted${when ? ` (${when})` : ''}. It is waiting for ${v.approverName ?? 'approval'}.`, { duplicate: true, id }, actions);

  // idempotency: same token → same primary key; also an identical pending request from the last 2 minutes
  const { data: byId } = await ctx.sb.from('leave_requests').select('id').eq('id', id).maybeSingle();
  if (byId) return already();
  const since = new Date(ctx.now.getTime() - 2 * 60_000).toISOString();
  const { data: recent } = await ctx.sb.from('leave_requests').select('id, created_at').eq('user_id', c.p.id).eq('leave_type', T.db)
    .eq('start_date', d.start_date).eq('end_date', d.end_date).eq('day_option', d.day_option).eq('status', 'pending_manager_approval').gte('created_at', since).limit(1);
  if (recent?.length) return already('a moment ago');

  // exactly what ApplyLeave → submitLeaveRequest inserts (toSnakeCase(basePayload) minus user_name + status/approver/history)
  const row = {
    id,
    leave_type: T.db,
    start_date: d.start_date,
    end_date: d.end_date,
    day_option: d.day_option,
    reason: d.reason,
    user_id: c.p.id,
    status: 'pending_manager_approval',
    current_approver_id: c.p.reporting_manager_id || null,
    approval_history: [] as any[],
    // same shape the app stores (UploadedFile after processFilesForUpload): { name, type, size, path }
    ...(cert ? { doctor_certificate: { name: cert.name, type: cert.type, size: cert.size, path: cert.path } } : {}),
    // Owner decision (26 Nov 2026): tag chat-submitted requests so HR/managers can tell them apart.
    created_by: c.p.id,
    created_by_name: `${c.p.name} (with help of Paradigm Assist)`,
    created_by_role: ctx.asker.role_id,
  };
  const notif = await buildLeaveNotifications(ctx.sb, { id: c.p.id, name: c.p.name, reportingManagerId: c.p.reporting_manager_id }, T.db, id);
  const summary = `${T.label} · ${d.start_date === d.end_date ? shortDay(d.start_date) : `${shortDay(d.start_date)} → ${shortDay(d.end_date)}`} · ${d.day_option === 'half' ? 'half day' : plural(v.days)}`;

  if (isLeaveDryRun()) {
    ctx.audit({ tool: 'apply_leave', args: { ...d }, subjectUserId: c.p.id, allowed: true, note: 'DRY RUN — not inserted' });
    return answer(`🧪 **Dry run — nothing was saved.**\n\nThis request passed every check and would be submitted as:\n\n- ${summary}\n- Approver: ${v.approverName ?? 'none'}\n- Status: Pending manager approval\n- Notifications: ${notif.notifications.length}${cert ? '\n- Certificate attached' : ''}`,
      { dry_run: true, would_insert: { table: 'leave_requests', row }, would_notify: notif.notifications, would_push: notif.pushUserIds }, actions);
  }

  const { error } = await ctx.sb.from('leave_requests').insert(row);
  if (error) {
    if ((error as any).code === '23505') return already();
    console.warn('[Assist apply_leave] insert failed:', error.message);
    return answer(`I couldn't submit the request (${error.message}). Please try again or apply from the app.`, { error: error.message }, [{ label: 'Open Apply Leave', route: ROUTE_APPLY }]);
  }
  ctx.audit({ tool: 'apply_leave', args: { ...d }, subjectUserId: c.p.id, allowed: true, note: `inserted leave_requests ${id}` });
  if (notif.notifications.length) {
    try {
      await ctx.sb.from('notifications').insert(notif.notifications);
      ctx.sb.functions.invoke('send-notification', { body: { userIds: notif.pushUserIds, title: 'Paradigm Office', message: notif.message, data: { link: '/my-team', leaveRequestId: id } } })
        .catch((e: any) => console.warn('[Assist apply_leave] push failed:', e?.message));
    } catch (e: any) { console.warn('[Assist apply_leave] notification failed:', e?.message); }
  }
  return answer(`✅ **Leave request submitted.**\n\n- ${summary}\n- Sent to: ${v.approverName ?? 'no approver set — please inform HR'}\n- Status: Pending manager approval${v.after != null ? `\n- Balance after approval: ${v.after}` : ''}\n\nYou can withdraw it from My Leaves while it is pending.`,
    { submitted: true, id, leave_type: T.db, start_date: d.start_date, end_date: d.end_date, day_option: d.day_option }, actions);
}

const applyLeave: AssistTool = {
  name: 'apply_leave',
  module: 'Leave',
  capability: 'leave',
  description: 'APPLY for leave for the asker (creates a leave request after a preview and an explicit Confirm click). Use when the user wants to take / apply / request leave, half day, comp off, WFH, Blue/Pink leave, e.g. "apply leave tomorrow", "I need sick leave from 2 to 4 Dec", "take half day today", "leave lena hai kal". NOT for leave balance (get_leave_balance), leave history (get_leave_requests), how-it-works questions (explain_leave_policy) or "how do I apply in the app" (app guide).',
  parameters: {
    type: 'object',
    properties: {
      leave_type: { type: 'string', enum: TYPE_PARAM_ENUM, description: 'Leave type if the user named one (earned = EL, blue = Blue/floating leave, lop = loss of pay). Empty if not mentioned.' },
      dates_text: { type: 'string', description: 'The date words exactly as the user wrote them, e.g. "tomorrow", "2 dec to 4 dec", "friday".' },
      start_date: { type: 'string', description: 'YYYY-MM-DD if the user gave an exact date.' },
      end_date: { type: 'string', description: 'YYYY-MM-DD (same as start_date for one day).' },
      day_option: { type: 'string', enum: ['full', 'half'], description: 'half for a half-day leave; empty if not mentioned.' },
      reason: { type: 'string', description: 'Reason if the user gave one.' },
      person_name: { type: 'string', description: 'Only if the user asks to apply leave for SOMEONE ELSE (name as written).' },
      step: { type: 'string', enum: ['collect', 'preview', 'cancel'], description: 'Always collect unless the user cancels.' },
      confirm_token: { type: 'string', description: 'NEVER set this yourself.' },
    },
  },
  run: safeRun(runApplyLeave),
};

// ===================================================================================== withdraw_leave (LeaveDashboard → withdrawLeaveRequest)
async function runWithdraw(ctx: AssistCtx, args: Record<string, any>): Promise<ToolResult> {
  if (args.step === 'cancel') return answer('Okay, nothing was withdrawn.', { cancelled: true });
  if (ctx.scope.level === 'none' || !ctx.scope.can('leave')) return { kind: 'denied', text: 'Your account cannot manage leave from the chat.' };
  const actions: AssistAction[] = [{ label: 'Open My Leaves', route: ROUTE_DASHBOARD }];
  // the dashboard shows "Withdraw" only for the user's own requests in 'pending_manager_approval'
  const { data, error } = await ctx.sb.from('leave_requests').select('id, leave_type, start_date, end_date, day_option, status, created_at')
    .eq('user_id', ctx.asker.id).eq('status', 'pending_manager_approval').order('start_date', { ascending: true }).limit(10);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  const label = (r: any) => `${r.leave_type} · ${r.start_date === r.end_date ? shortDay(r.start_date) : `${prettyDate(r.start_date)} → ${prettyDate(r.end_date)}`}${r.day_option === 'half' ? ' (half day)' : ''}`;
  const id = typeof args.request_id === 'string' ? args.request_id : null;
  if (!id) {
    if (!rows.length) return answer('You have no leave requests waiting for manager approval, so there is nothing to withdraw. Approved or rejected requests cannot be withdrawn from the chat — please talk to your manager or HR.', { pending: 0 }, actions);
    return { kind: 'clarify', question: 'Which leave request do you want to withdraw?', options: [...rows.map(r => ({ label: label(r), sublabel: 'Pending manager approval', args: { request_id: r.id } })), { label: 'Cancel', args: { step: 'cancel' } }] };
  }
  const r = rows.find(x => x.id === id);
  if (!r) return answer('That request can no longer be withdrawn (it is not yours, or it is no longer pending manager approval).', {}, actions);
  const token = `${Date.now().toString(36)}.${sig(JSON.stringify([ctx.asker.id, 'withdraw', id, Date.now()]))}`;
  const okToken = (t: any) => {
    if (typeof t !== 'string' || !/^[0-9a-z]+\.[0-9a-f]{32}$/.test(t)) return false;
    const at = parseInt(t.split('.')[0], 36);
    if (Date.now() - at > DRAFT_TTL_MS) return false;
    return t.split('.')[1] === sig(JSON.stringify([ctx.asker.id, 'withdraw', id, at]));
  };
  if (args.step === 'confirm' && okToken(args.confirm_token)) {
    const update = { status: 'withdrawn', current_approver_id: null };
    if (isLeaveDryRun()) {
      ctx.audit({ tool: 'withdraw_leave', args, subjectUserId: ctx.asker.id, allowed: true, note: 'DRY RUN — not updated' });
      return answer(`🧪 **Dry run — nothing was changed.** Would withdraw: ${label(r)}.`, { dry_run: true, would_update: { table: 'leave_requests', id, where: { user_id: ctx.asker.id, status: 'pending_manager_approval' }, set: update } }, actions);
    }
    const { data: upd, error: e2 } = await ctx.sb.from('leave_requests').update(update).eq('id', id).eq('user_id', ctx.asker.id).eq('status', 'pending_manager_approval').select('id');
    if (e2) return answer(`I couldn't withdraw it (${e2.message}). Please try from My Leaves.`, {}, actions);
    if (!upd?.length) return answer('That request was already processed, so it could not be withdrawn.', {}, actions);
    ctx.audit({ tool: 'withdraw_leave', args, subjectUserId: ctx.asker.id, allowed: true, note: `withdrew ${id}` });
    return answer(`✅ Withdrawn: ${label(r)}.`, { withdrawn: true, id }, actions);
  }
  return {
    kind: 'clarify', markdown: `You are about to withdraw:\n\n- **${label(r)}**\n- Status: Pending manager approval`, question: 'Withdraw this request?',
    options: [{ label: 'Yes, withdraw', args: { request_id: id, step: 'confirm', confirm_token: token } }, { label: 'Keep it', args: { step: 'cancel' } }],
  };
}

const withdrawLeave: AssistTool = {
  name: 'withdraw_leave',
  module: 'Leave',
  capability: 'leave',
  description: 'Withdraw / cancel the asker\'s OWN leave request that is still pending manager approval ("cancel my leave request", "withdraw my leave for tomorrow"). Shows the pending requests to pick from, then asks for confirmation.',
  parameters: { type: 'object', properties: { request_id: { type: 'string', description: 'NEVER set this yourself.' }, step: { type: 'string', enum: ['collect', 'cancel'] }, confirm_token: { type: 'string', description: 'NEVER set this yourself.' } } },
  run: safeRun(runWithdraw),
};

// ===================================================================================== explain_leave_policy
type Topic = 'overview' | 'earned' | 'sick' | 'comp_off' | 'blue' | 'pink' | 'maternity' | 'child_care' | 'lop' | 'wfh' | 'half_day' | 'approval' | 'attendance' | 'apply_rules' | 'probation' | 'carry_forward' | 'casual';
const TOPICS: Topic[] = ['overview', 'earned', 'sick', 'comp_off', 'blue', 'pink', 'maternity', 'child_care', 'lop', 'wfh', 'half_day', 'approval', 'attendance', 'apply_rules', 'probation', 'carry_forward', 'casual'];

export function topicFromText(q: string): Topic {
  const t = ` ${lc(q)} `;
  if (/\b(attendance|marked|mark|muster|status code|show(s|n)? (as|in))\b/.test(t) && /\b(leave|holiday|weekly off|week off|half day)\b/.test(t)) return 'attendance';
  if (/\bprobation\b/.test(t)) return 'probation';
  if (/\b(approv|approver|who approves|escalat|manager approval|hr confirmation)\w*/.test(t)) return 'approval';
  if (/\b(notice|in advance|advance|how many days before|before applying|restriction|past date|backdate)\b/.test(t)) return 'apply_rules';
  if (/\b(carry|carried|lapse|expire|expiry|encash)\w*/.test(t)) return 'carry_forward';
  if (/\b(comp\s*-?\s*off|compoff|compensatory)\b/.test(t)) return 'comp_off';
  if (/\b(blue|floating|3rd saturday|third saturday)\b/.test(t)) return 'blue';
  if (/\b(pink|menstrual)\b/.test(t)) return 'pink';
  if (/\bmaternity\b/.test(t)) return 'maternity';
  if (/\bchild ?care\b/.test(t)) return 'child_care';
  if (/\b(loss of pay|lop|unpaid)\b/.test(t)) return 'lop';
  if (/\b(wfh|work from home)\b/.test(t)) return 'wfh';
  if (/\bhalf ?day\b/.test(t)) return 'half_day';
  if (/\b(casual|cl)\b/.test(t)) return 'casual';
  if (/\b(sick|sl|medical)\b/.test(t)) return 'sick';
  if (/\b(earned|el|privilege)\b/.test(t)) return 'earned';
  return 'overview';
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function runExplain(ctx: AssistCtx, args: Record<string, any>): Promise<ToolResult> {
  const topic: Topic = TOPICS.includes(args.topic) ? args.topic : topicFromText(ctx.question || '');
  const personal = ctx.scope.level !== 'none';
  const s = await loadSettings(ctx.sb);
  let c: Ctx2 | null = null;
  if (personal) { try { c = await loadCtx(ctx); } catch (e: any) { console.warn('[Assist explain_leave_policy] personal data unavailable:', e?.message); } }
  const cat = c?.category ?? 'office';
  const R: any = s.as?.[cat] ?? {};
  const acc = R.earned_leave_accrual || {};
  const elAmt = Number(acc.amount_earned || 1.5), elDays = Number(acc.days_required || 30);
  const full = R.minimum_hours_full_day ?? 8, half = R.minimum_hours_half_day ?? 4;
  const certThreshold = R.sick_leave_certificate_threshold ?? 3;
  const floatMonths: number[] | undefined = R.floating_holiday_months;
  const finalRole: string = s.wf?.final_confirmation_role || 'reporting_manager';
  const b = c?.bal;
  const you = (txt: string) => (c ? `\n\n👤 **You:** ${txt}` : '');
  const catLine = c ? `Your rules are the **${cat} staff** rules (from Attendance Rules → staff category of your role).` : '';
  const actions: AssistAction[] = [{ label: 'Open Leave dashboard', route: ROUTE_DASHBOARD }, { label: 'Apply leave', route: ROUTE_APPLY }];

  const sec: Record<Exclude<Topic, 'overview'>, () => string> = {
    earned: () => `**Earned Leave (EL)**\n- Accrues **${elAmt} days for every ${elDays} qualifying days** from your EL opening date.\n- A qualifying day is: a day you punched in (or WFH), a holiday, an approved Earned / Sick / Comp Off leave day, or a weekly off in a week where you already had 4+ qualifying days.\n- Can be applied from **3 months after joining**, not for past dates (today is allowed), and **not for 7 or more continuous days**.${R.earned_leaves_expiry_date ? `\n- Current EL allocation is valid till **${prettyDate(R.earned_leaves_expiry_date)}**.` : ''}` +
      you(b ? `${b.earned.available} days available (accrued ${b.earned.total}${b.earned.opening ? ` incl. opening ${b.earned.opening}` : ''}, used ${b.earned.used}, pending ${b.earned.pending}); ${b.earned.qualifyingDays} qualifying days so far, +${b.earned.accruedThisMonth} this month.` : ''),
    sick: () => `**Sick Leave (SL)**\n- ${R.enable_sick_leave_accrual ? '**1 day per calendar month** (credited monthly from January, or from your opening date if you joined mid-year).' : `Up to ${R.annual_sick_leaves || 12} per year, 1 per month.`} Unused sick leave does not carry into the next year.\n- The Apply Leave form **requires a doctor's certificate or prescription** for every Sick Leave request (the server rule makes it mandatory for ${certThreshold} or more days). You can upload it right in the Paradigm Assist chat when you apply, or in the app form.\n- Not available during the 3-month probation. Any date (past/today/future) is allowed.${R.sick_leaves_expiry_date ? `\n- Valid till **${prettyDate(R.sick_leaves_expiry_date)}**.` : ''}` +
      you(b ? `${r1(b.sick.available)} days available (credited ${b.sick.total}, used ${b.sick.used}, pending ${b.sick.pending}).` : ''),
    comp_off: () => `**Comp Off**\n- Earned by working on a **weekly off or holiday**: ${full}+ hours = 1 day, ${half}+ hours = ½ day, any punch-in = ½ day. Manual grants by HR are added too.\n- The active pool is **capped at 4 days**; anything above 4 lapses, and the oldest credits are used first.\n- Can be applied for any date. Your manager's approval is final (no HR step).\n- Not offered for technical relievers.${R.comp_off_leaves_expiry_date ? `\n- Valid till **${prettyDate(R.comp_off_leaves_expiry_date)}**.` : ''}` +
      you(b ? `${b.compOff.available} days available in your pool (pending ${b.compOff.pending}).` : ''),
    blue: () => `**Blue Leave** (men; Bangalore office & field staff)\n- The **3rd Saturday** is a Blue Leave day. If you **work on the 3rd Saturday** (or have an approved "Work on Blue Leave" request), you get **${R.monthly_floating_leaves || 1} Blue Leave** to take on a later day **in the same month**.\n- It cannot be applied before the 3rd Saturday, cannot span two months and expires at month end.${floatMonths?.length ? `\n- Valid months: ${floatMonths.map(m => MONTH_NAMES[m]).join(', ')}.` : ''}\n- In attendance an unworked 3rd Saturday shows **B/L**; worked shows **B/L/P**. The app saves a Blue Leave request as **Comp Off**.` +
      you(b ? (b.blue.eligible ? `eligible; this month's 3rd Saturday is ${prettyDate(b.blue.thirdSaturday)}${b.blue.thirdSatPassed ? (b.blue.workedThirdSat ? ' (you worked → earned)' : " (you didn't work → not earned)") : ' (not yet)'}; ${b.blue.available} available.` : 'not eligible (Blue Leave is for Bangalore male office/field staff in valid months).') : ''),
    pink: () => `**Pink Leave** (women)\n- **1 day every month** from your joining date; no reason needed (the app fills "Pink Leave Request (Menstrual Leave)").\n- Unused Pink Leave does not carry to the next month. Any date is allowed.` + you(b ? (c!.isFemale ? `${b.pink.available} available this month.` : 'not applicable (Pink Leave is for female employees).') : ''),
    maternity: () => `**Maternity Leave**\n- For women with at least **${R.maternity_min_tenure_months ?? 6} months** of service: **${R.maternity_leave_weeks ?? 26} weeks**.\n- It is currently **not offered on the Apply Leave form** — please contact HR.`,
    child_care: () => `**Child Care Leave**\n- For women with verified children under 15 (children must be on your profile). Not during probation; from 3 months after joining.\n- Apply from the app (the chat cannot check children records).`,
    lop: () => `**Loss of Pay (LOP)**\n- Unpaid leave; no balance needed, any date. Available even during probation.\n- In attendance the day shows **LOP** and is not paid.` + you(b ? `${b.lopDaysThisYear} LOP days approved so far this year.` : ''),
    wfh: () => `**Work From Home (WFH)**\n- Offered to **office staff** only, not during probation; no balance; any date.\n- An approved WFH day shows **WH** in attendance and counts as present.`,
    half_day: () => `**Half day**\n- A half day can be chosen only when the leave is for **a single day**; it counts as **0.5 day**.\n- Attendance: if you also worked part of the day it shows e.g. **0.5P+0.5EL**; if you did not work it shows **0.5EL** (½ leave, ½ absent).\n- If you are already punched in today and apply Sick Leave for today, the form defaults to half day.`,
    approval: () => `**Approval flow**\n1. Your request goes to your **reporting manager**${c ? ` (${c.p.reporting_manager_id ? 'yours: ' + ((ctx as any)._approverName ?? 'set') : 'none set on your profile — ask HR'})` : ''} as "Pending manager approval".\n2. ${finalRole === 'reporting_manager' ? 'Manager approval is **final** (current setting).' : `After the manager approves, it goes to **${finalRole.replace(/_/g, ' ')}** for final confirmation ("Pending HR").`} Comp Off is always final at the manager.\n3. The balance is checked again at approval; if it is not enough the request is **auto-rejected**.\n- You can **withdraw** a request while it is pending manager approval (My Leaves → Withdraw, or ask me "withdraw my leave").`,
    attendance: () => `**How leave shows in attendance**\n- Only **approved** leave changes attendance. Pending or rejected requests don't — an absent day stays **A**.\n- Full-day approved leave shows the leave code for each day of the range: **EL** (Earned), **SL** (Sick), **CO** (Comp Off and Blue Leave), **PL** (Pink), **LOP**, **WH** (WFH), **ML**, **CCL**.\n- Half-day leave: **0.5P+0.5EL** if you worked part of the day, **0.5EL** if not.\n- Other days: holiday **H** (worked: **H/P**), weekly off **W/O** (worked: **W/P**), 3rd Saturday **B/L** for men (worked: **B/L/P**).\n- Leave days are paid except **LOP**.`,
    apply_rules: () => `**Rules when applying**\n- **No fixed notice period.** Earned Leave: today or later (no past dates). Sick, Comp Off, Pink, LOP, WFH: any date, past included. Child Care / other types: at least 1 day in advance. Blue Leave: only after you worked the 3rd Saturday, same month.\n- Reason of at least 10 characters (not needed for Pink Leave).\n- No two requests of the **same type** on overlapping dates.\n- Earned Leave: not 7+ continuous days; only from 3 months after joining.\n- Days are counted as **calendar days** (weekly offs/holidays inside the range count), ½ for a half day.\n- Sick Leave needs a doctor's certificate (upload it in the chat when applying, or in the app).`,
    probation: () => `**Probation (first 3 months after joining)**\n- You **cannot apply** for Earned Leave, Sick Leave, Child Care Leave or WFH (they are hidden on the form).\n- You **can apply** for ${'Pink Leave (women) / Blue Leave (men)'}, Comp Off and Loss of Pay.\n- Earned Leave still accrues from your opening date; you can use it after probation.` +
      you(c ? (c.isProbation ? `you are on probation until **${prettyDate(c.probationEnd)}**.` : `your probation ended on ${prettyDate(c.probationEnd)}.`) : ''),
    carry_forward: () => `**Carry forward & expiry**\n- **Earned Leave:** accrues continuously from your opening date${R.earned_leaves_expiry_date ? `; current allocation valid till ${prettyDate(R.earned_leaves_expiry_date)}` : ''}.\n- **Sick Leave:** monthly credit, **no carry forward** to the next year${R.sick_leaves_expiry_date ? ` (valid till ${prettyDate(R.sick_leaves_expiry_date)})` : ''}.\n- **Comp Off:** rolling pool capped at **4 days**; excess lapses${R.comp_off_leaves_expiry_date ? `; valid till ${prettyDate(R.comp_off_leaves_expiry_date)}` : ''}.\n- **Blue Leave:** must be used in the same month. **Pink Leave:** monthly, no carry forward.\n- Leave encashment is not handled in the app.`,
    casual: () => `There is **no Casual Leave (CL)** in the Paradigm app. The leave types are Earned, Sick, Comp Off, Blue Leave (men) / Pink Leave (women), Loss of Pay, WFH (office staff), Child Care and Maternity.`,
  };

  if (c && topic === 'approval') (ctx as any)._approverName = await userName(ctx.sb, c.p.reporting_manager_id);
  let md: string;
  if (topic === 'overview') {
    const offered = c ? appTypesFor(c).map(k => TYPES[k].label).join(', ') : null;
    md = [`📘 **How leave works at Paradigm**${catLine ? `\n${catLine}` : ''}`,
      `- **Earned Leave:** ${elAmt} days per ${elDays} qualifying days (worked days, holidays, approved EL/SL/CO, qualifying weekly offs).${b ? ` You: **${b.earned.available}** available.` : ''}`,
      `- **Sick Leave:** 1 per month, no carry forward; doctor's certificate required.${b ? ` You: **${r1(b.sick.available)}** available.` : ''}`,
      `- **Comp Off:** earned by working on a weekly off/holiday (${full}h = 1, ${half}h = ½); pool capped at 4.${b ? ` You: **${b.compOff.available}** available.` : ''}`,
      `- **Blue Leave (men):** work the 3rd Saturday → 1 leave later that month. **Pink Leave (women):** 1 per month.`,
      `- **Loss of Pay:** unpaid, no balance. **WFH:** office staff only.`,
      `- **Probation (3 months):** no Earned / Sick / Child Care / WFH.`,
      `- **Approval:** reporting manager${finalRole === 'reporting_manager' ? ' (final)' : ` → ${finalRole.replace(/_/g, ' ')}`}.`,
      offered ? `\nTypes you can apply for now: ${offered}.` : '',
      `\nAsk me "how is earned leave calculated", "how is attendance marked on leave" or "apply leave tomorrow".`].filter(Boolean).join('\n');
  } else md = sec[topic]();

  return { kind: 'answer', facts: { topic }, sourceLabel: 'Leave policy (app rules)', markdown: md, actions };
}

const explainLeavePolicy: AssistTool = {
  name: 'explain_leave_policy',
  module: 'Leave',
  capability: null,
  description: 'Explains HOW leave works, from the real app rules, with the asker\'s own numbers: allocation/accrual of Earned, Sick, Comp Off, Blue, Pink, Maternity, Child Care, LOP, WFH; carry forward/expiry; half day; probation; notice/restrictions when applying; approval flow; how attendance is marked on leave/holiday/weekly-off days. E.g. "how is earned leave calculated", "what is blue leave", "can I take leave during probation", "leave rules". NOT for applying leave or for the balance number alone.',
  parameters: { type: 'object', properties: { topic: { type: 'string', enum: TOPICS, description: 'What the user asks about. overview for general "leave rules / how are leaves allocated".' } } },
  run: safeRun(runExplain),
};

// ===================================================================================== multi-turn hand-off (typed replies to a pending draft)
const CANCEL_RE = /^\s*(cancel|stop|exit|quit|abort|no|nope|never ?mind|forget it|don'?t|do not|band karo|rehne do|mat karo|chhodo|cancel it|cancel this|cancel the request)\b/i;
const QUESTION_RE = /\?\s*$|^\s*(what|how|who|whom|where|when|why|which|show|list|tell me|give me|is|are|does|do|did|can|could|should|will)\b/i;
const YES_RE = /^\s*(yes|yeah|yep|ok|okay|confirm|submit|go ahead|done|sure|haan|ha|theek hai)\b/i;

/**
 * Fills the field a pending draft is waiting for from the user's typed reply.
 * Returns the args to re-run the tool with, or null when the text looks like a new question (the caller answers it normally).
 */
export function resumePendingDraft(p: PendingDraft, text: string, now: Date): { tool: string; args: Record<string, any> } | null {
  const raw = String(text || '').trim().slice(0, 500);
  if (!raw) return null;
  const today = todayIst(now);
  const args = { ...(p.args || {}) };
  if (CANCEL_RE.test(raw)) return { tool: p.tool, args: { ...args, step: 'cancel' } };

  if (p.tool === 'withdraw_leave') return null;
  if (p.tool !== 'apply_leave') return null;

  if (p.awaiting === 'reason') {
    if (QUESTION_RE.test(raw) && raw.length < 120) return null;
    return { tool: p.tool, args: { ...args, reason: raw } };
  }
  if (QUESTION_RE.test(raw) && !parseLeaveDates(raw, today) && !parseLeaveType(raw)) return null;

  // any field the user typed (type / dates / day option) updates the draft
  let changed = false;
  const lt = parseLeaveType(raw);
  if (lt) { args.leave_type = lt === 'casual' ? 'casual' : lt; changed = true; }
  const dates = parseLeaveDates(raw, today);
  if (dates) { args.start_date = dates.start; args.end_date = dates.end; delete args.day_option; changed = true; }
  const dopt = parseDayOption(raw);
  if (dopt) { args.day_option = dopt; changed = true; }
  if (changed) { if (lt === 'casual') { delete args.leave_type; args.leave_type = 'casual'; } return { tool: p.tool, args }; }

  if (p.awaiting === 'confirm' && YES_RE.test(raw)) return { tool: p.tool, args: { ...args, typed_confirm: true } };
  if (p.awaiting === 'certificate') return { tool: p.tool, args: { ...args, hint: 'Please upload the certificate using the button above.' } };
  if (p.awaiting === 'dates') return { tool: p.tool, args: { ...args, hint: `I couldn't read a date in "${raw.slice(0, 40)}".` } };
  if (p.awaiting === 'leave_type') return { tool: p.tool, args: { ...args, hint: `I couldn't match "${raw.slice(0, 40)}" to a leave type.` } };
  if (p.awaiting === 'day_option') return { tool: p.tool, args: { ...args, hint: 'Please pick full day or half day.' } };
  return null;
}

export const leaveApplyTools: AssistTool[] = [applyLeave, withdrawLeave, explainLeavePolicy];

/** For tests. */
export const __leaveInternals = { signDraft, verifyDraft, idFromToken, appTypesFor, loadCtx, validate };
