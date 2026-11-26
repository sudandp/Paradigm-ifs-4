/**
 * Fast-path (no AI) test: every catalogue example must be routed by RULES to its tool,
 * then answered end-to-end through the orchestrator with template wording. Read-only.
 *
 *   npx tsx scripts/test-assist-fastpath.ts            # routing + answers as admin
 *   npx tsx scripts/test-assist-fastpath.ts --routing  # routing only (instant)
 *   npx tsx scripts/test-assist-fastpath.ts --show     # print every answer
 */
import { makeDevCtx, TEST_ASKERS } from '../src/api/assist/devctx.js';
import { matchFastPath, RULES, PRIORITY_RULES } from '../src/api/assist/fastpath/index.js';
import { handleDataQuestion } from '../src/api/assist/orchestrator.js';

// make sure no AI call can sneak in: any LLM call would throw
process.env.GROQ_API_KEY = ''; for (const k of ['VITE_API_KEY_1', 'VITE_API_KEY_2', 'VITE_API_KEY_3', 'VITE_API_KEY_4', 'VITE_API_KEY_5', 'GEMINI_API_KEY']) process.env[k] = '';

const routingOnly = process.argv.includes('--routing');
const show = process.argv.includes('--show');
const admin = await makeDevCtx(TEST_ASKERS.admin);

// extra phrasings (not in the catalogue) that should also be caught, + questions that must NOT be caught
const EXTRA: [string, string | null][] = [
  ['kavya kitne din kaam kiya', 'get_attendance_summary'],
  ['isaac kahan hai aaj', 'get_employee_whereabouts'],
  ['meri chutti balance', 'get_leave_balance'],
  ['how many days isaac worked in june', 'get_attendance_summary'],
  ['nikoo invoice value', 'get_site_invoice'],
  ['did kavya m come today', 'get_attendance_summary'],
  ['isaac mobile number', 'get_employee_profile'],
  ['how to do lift rescue', null],
  ['what is the procedure for fire drill', null],
  ['hello', null],
  ['minimum wage for security guards in karnataka 2026', null],
  ['write an email to client about water shortage', null],
];

let ok = 0, total = 0;
const fails: string[] = [];
const rows: { q: string; tool: string; ms: number; kind: string; msg: string }[] = [];

for (const r of [...PRIORITY_RULES, ...RULES]) {
  for (const q of r.examples) {
    total++;
    const m = await matchFastPath(admin.sb, q, admin.now);
    if (m?.tool === r.tool) ok++;
    else fails.push(`ROUTE  "${q}" → ${m ? `${m.tool} (rule ${m.ruleId})` : 'no rule (AI)'} ; expected ${r.tool} [${r.id}]  ${m ? JSON.stringify(m.debug) : ''}`);
  }
}
for (const [q, want] of EXTRA) {
  total++;
  const m = await matchFastPath(admin.sb, q, admin.now);
  if ((m?.tool ?? null) === want) ok++;
  else fails.push(`EXTRA  "${q}" → ${m ? `${m.tool} (rule ${m.ruleId}) ${JSON.stringify(m.debug)}` : 'no rule (AI)'} ; expected ${want ?? 'no rule (AI)'}`);
}
console.log(`ROUTING: ${ok}/${total} correct`);
fails.forEach(f => console.log('  ❌ ' + f));
if (routingOnly) process.exit(0);

// ---- end-to-end answers (template, no AI) as admin
console.log('\nEND-TO-END (admin, no AI):');
for (const r of [...PRIORITY_RULES, ...RULES]) {
  for (const q of r.examples) {
    const t0 = Date.now();
    let res: any = null;
    try { res = await handleDataQuestion(admin, q, []); } catch (e: any) { res = { message: 'ERROR ' + e.message }; }
    const ms = Date.now() - t0;
    const kind = !res ? 'NULL' : res.denied ? 'denied' : res.clarification ? 'clarify' : res.message?.startsWith('ERROR') ? 'ERROR' : 'answer';
    rows.push({ q, tool: res?.toolUsed ?? '-', ms, kind, msg: (res?.message ?? '').replace(/\s+/g, ' ').slice(0, 120) });
    const bad = kind === 'NULL' || kind === 'ERROR' || res?.engine !== 'rules';
    console.log(`${bad ? '❌' : '✅'} ${String(ms).padStart(5)}ms ${kind.padEnd(7)} ${q.padEnd(52)} ${show ? '\n      ' + (res?.message ?? '').replace(/\n/g, '\n      ') : rows.at(-1)!.msg}`);
  }
}
const times = rows.map(r => r.ms).sort((a, b) => a - b);
console.log(`\n${rows.filter(r => r.kind !== 'NULL' && r.kind !== 'ERROR').length}/${rows.length} answered without AI · median ${times[Math.floor(times.length / 2)]} ms · p90 ${times[Math.floor(times.length * 0.9)]} ms`);

// ---- access checks through the fast path
console.log('\nACCESS (fast path):');
const checks: [keyof typeof TEST_ASKERS, string, string][] = [
  ['fieldStaff', 'where is isaac yesterday', 'denied|not_found'],
  ['hr', 'where is isaac yesterday', 'denied'],
  ['fieldStaff', 'nikoo home june month invoice value', 'denied'],
  ['hr', 'total billed amount in june', 'denied'],
  ['opsManager', 'pending onboarding status', 'denied'],
  ['opsManager', 'crm leads by stage', 'denied'],
  ['hr', "who changed kavya m's attendance yesterday", 'denied'],
  ['fieldStaff', 'how many days kavya worked last month', 'denied|not_found'],
  ['fieldStaff', 'my leave balance', 'answer'],
  ['opsManagerNikoo', 'nikoo homes june invoice value', 'answer'],
];
for (const [who, q, want] of checks) {
  const ctx = await makeDevCtx(TEST_ASKERS[who], q);
  const res: any = await handleDataQuestion(ctx, q, []);
  const kind = !res ? 'NULL' : res.denied ? 'denied' : res.clarification ? 'clarify' : /couldn't find|not found/i.test(res.message) ? 'not_found' : 'answer';
  console.log(`${new RegExp(`^(${want})$`).test(kind) ? '✅' : '❌'} ${who.padEnd(15)} ${q.padEnd(45)} ${kind.padEnd(9)} ${(res?.message ?? '').replace(/\s+/g, ' ').slice(0, 90)}`);
}
