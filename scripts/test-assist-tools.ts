/**
 * End-to-end role-matrix test for Paradigm Assist data answers (read-only).
 * Runs real questions through the orchestrator (planner LLM → tool → phrasing) as real users.
 *
 *   npx tsx scripts/test-assist-tools.ts            # all cases
 *   npx tsx scripts/test-assist-tools.ts leave      # only cases whose question/tag contains "leave"
 *
 * Spaces requests out because the free Groq tier has a tokens-per-minute limit.
 */
import { makeDevCtx, TEST_ASKERS } from '../src/api/assist/devctx.js';
import { handleDataQuestion } from '../src/api/assist/orchestrator.js';

type Expect = 'answer' | 'clarify' | 'denied' | 'not_found' | 'general' | 'not_answer';
type Case = { who: keyof typeof TEST_ASKERS; q: string; expect: Expect | Expect[]; tool?: string; alt?: string[]; pick?: number };
// Free Groq tier = 8k tokens/min per model; one data question ≈ 4–5k tokens. Override with ASSIST_TEST_GAP_MS.
const GAP = Number(process.env.ASSIST_TEST_GAP_MS ?? 25000);

const C: Case[] = [
  // attendance / tracking / invoice (core)
  { who: 'admin', q: 'how many days kavya works', expect: 'clarify', tool: 'get_attendance_summary', pick: 2 },
  { who: 'admin', q: 'where is isaac yesterday', expect: 'answer', tool: 'get_employee_whereabouts' },
  { who: 'hr', q: 'where is isaac yesterday', expect: 'denied' },
  { who: 'fieldStaff', q: 'how many days did I work this month', expect: 'answer', tool: 'get_attendance_summary' },
  { who: 'fieldStaff', q: 'how many days kavya worked last month', expect: ['denied', 'not_found'] },
  { who: 'admin', q: 'nikoo home june month invoice value', expect: 'answer', tool: 'get_site_invoice' },
  { who: 'opsManagerNikoo', q: 'nikoo homes june invoice value', expect: 'answer', tool: 'get_site_invoice' },
  { who: 'fieldStaff', q: 'nikoo home june invoice value', expect: 'denied' },
  // HR
  { who: 'admin', q: 'what is isaac leave balance', expect: 'answer', tool: 'get_leave_balance' },
  { who: 'fieldStaff', q: 'my leave balance', expect: 'answer', tool: 'get_leave_balance' },
  { who: 'admin', q: 'who is on leave today', expect: ['answer', 'not_found'], tool: 'get_leave_requests', alt: ['get_site_attendance_today'] },
  { who: 'admin', q: 'who is isaac reporting manager', expect: 'answer', tool: 'get_employee_profile' },
  { who: 'admin', q: 'how many site managers do we have', expect: 'answer', tool: 'count_employees' },
  { who: 'hr', q: 'pending onboarding status', expect: 'answer', tool: 'get_onboarding_status' },
  { who: 'opsManager', q: 'pending onboarding status', expect: 'denied' },
  { who: 'admin', q: 'who has not uploaded PAN card', expect: 'answer', tool: 'get_document_status' },
  { who: 'admin', q: 'overtime hours in october', expect: 'answer', tool: 'get_overtime' },
  { who: 'fieldStaff', q: 'holidays this month', expect: 'answer', tool: 'get_holidays' },
  // Ops
  { who: 'admin', q: 'late comers yesterday', expect: ['answer', 'not_found'], tool: 'get_attendance_exceptions' },
  { who: 'admin', q: 'which biometric devices are offline', expect: 'answer', tool: 'get_device_status' },
  { who: 'admin', q: 'who is the ops manager of nikoo homes', expect: ['answer', 'clarify'], tool: 'get_site_info' },
  { who: 'admin', q: 'open helpdesk tickets', expect: ['answer', 'not_found'], tool: 'get_tickets' },
  { who: 'fieldStaff', q: 'whom should I escalate a lift breakdown to', expect: ['answer', 'not_found', 'general'], tool: 'get_escalation_contacts' },
  { who: 'admin', q: 'pending unlock requests', expect: ['answer', 'not_found'], tool: 'get_attendance_requests' },
  // Finance / CRM / audit
  { who: 'finance', q: 'invoices not sent for july', expect: ['answer', 'not_found'], tool: 'list_invoice_status' },
  { who: 'admin', q: 'total billed amount in june by company', expect: 'answer', tool: 'get_billing_totals' },
  { who: 'hr', q: 'total billed amount in june', expect: 'denied' },
  { who: 'admin', q: 'crm leads by stage', expect: 'answer', tool: 'get_crm_pipeline' },
  { who: 'admin', q: 'overdue crm follow ups', expect: 'answer', tool: 'get_crm_followups' },
  { who: 'opsManager', q: 'crm leads by stage', expect: 'denied' },
  { who: 'admin', q: "who changed kavya m's attendance yesterday", expect: ['answer', 'not_found'], tool: 'get_audit_trail' },
  { who: 'hr', q: "who changed kavya m's attendance yesterday", expect: 'denied' },
  { who: 'admin', q: 'nikoo homes site summary', expect: ['answer', 'clarify'], tool: 'get_site_summary' },
  // general → falls back to KB / web
  { who: 'admin', q: 'hello', expect: 'general' },
  { who: 'admin', q: 'minimum wage for security guards in karnataka 2026', expect: 'general' },
];

const kindOf = (r: any): Expect => !r ? 'general' : r.denied ? 'denied' : r.clarification ? 'clarify'
  : /couldn't find|could not find|no .* found|not found|no records|nothing/i.test(r.message) && !r.table ? 'not_found' : 'answer';

const filter = process.argv[2]?.toLowerCase();
const cases = C.filter(c => !filter || c.q.toLowerCase().includes(filter) || (c.tool ?? '').includes(filter));
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const rows: string[] = [];
let pass = 0;

for (const [i, c] of cases.entries()) {
  const ctx = await makeDevCtx(TEST_ASKERS[c.who], c.q);
  let r: any = null, err = '';
  try { r = await handleDataQuestion(ctx, c.q, []); } catch (e: any) { err = e.message; }
  let kind: Expect = err ? 'not_answer' : kindOf(r);
  let note = '';
  if (r?.clarification && c.pick) {
    const opt = r.clarification.options[c.pick - 1];
    note = `[asked: ${r.clarification.options.map((o: any) => o.label).join(' / ')} → picked ${opt.label}] `;
    await wait(GAP);
    r = await handleDataQuestion(ctx, c.q, [], opt.selection);
    if (kindOf(r) !== 'answer') kind = 'not_answer';   // the pick must produce an answer
  }
  const want = Array.isArray(c.expect) ? c.expect : [c.expect];
  const toolOk = !c.tool || kind !== 'answer' || r?.toolUsed === c.tool || (c.alt ?? []).includes(r?.toolUsed);
  const ok = want.includes(kind) && toolOk;
  if (ok) pass++;
  const msg = note + (err || r?.message || '(→ existing knowledge-base / web flow)').replace(/\s+/g, ' ').slice(0, 110);
  rows.push(`${ok ? '✅' : '❌'} ${String(i + 1).padStart(2)} | ${c.who.padEnd(15)} | ${c.q.padEnd(48)} | ${kind.padEnd(9)} | ${(r?.toolUsed ?? '-').padEnd(26)} | ${msg}`);
  console.log(rows.at(-1));
  if (!ok) console.log(`      expected ${want.join('/')}${c.tool ? ` via ${c.tool}` : ''}`);
  await wait(GAP);
}
console.log(`\n${pass}/${cases.length} passed`);
