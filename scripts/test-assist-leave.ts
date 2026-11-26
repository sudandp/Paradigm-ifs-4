/**
 * Apply-leave-from-chat test (DRY RUN ONLY — never writes).
 *   npx tsx scripts/test-assist-leave.ts          # transcripts + checks
 *   npx tsx scripts/test-assist-leave.ts --quiet  # checks only
 * Simulates the controller: the reply's pendingAction is handed to the next typed message, chips are sent as selections.
 * Safety: ASSIST_LEAVE_DRY_RUN=1 is set before any import, AND every insert/update/upsert/delete on the client throws.
 */
process.env.ASSIST_LEAVE_DRY_RUN = '1';
process.env.ASSIST_ENABLE_LEAVE_APPLY = '';
process.env.GROQ_API_KEY = ''; for (const k of ['VITE_API_KEY_1', 'VITE_API_KEY_2', 'VITE_API_KEY_3', 'VITE_API_KEY_4', 'VITE_API_KEY_5', 'GEMINI_API_KEY']) process.env[k] = '';

const { makeDevCtx, TEST_ASKERS } = await import('../src/api/assist/devctx.js');
const { handleDataQuestion } = await import('../src/api/assist/orchestrator.js');
const { matchFastPath } = await import('../src/api/assist/fastpath/index.js');
const { parseLeaveDates } = await import('../src/api/assist/tools/leave-apply.js');

const quiet = process.argv.includes('--quiet');
let pass = 0, fail = 0;
const check = (ok: boolean, what: string) => { ok ? pass++ : fail++; console.log(`${ok ? '  ✅' : '  ❌'} ${what}`); };

function blockWrites(ctx: any) {
  const orig = ctx.sb.from.bind(ctx.sb);
  ctx.sb.from = (t: string) => {
    const q = orig(t);
    for (const m of ['insert', 'update', 'upsert', 'delete']) q[m] = () => { throw new Error(`WRITE BLOCKED: ${m} on ${t}`); };
    return q;
  };
  Object.defineProperty(ctx.sb, 'functions', { get: () => ({ invoke: () => { throw new Error('WRITE BLOCKED: functions.invoke'); } }) });
  return ctx;
}

/** One chat session: typed text or chip label (selection). Keeps the pending draft like the controller does. */
async function session(who: string, title: string) {
  const ctx = blockWrites(await makeDevCtx(who));
  let last: any = null, pending: any = null;
  if (!quiet) console.log(`\n━━━━ ${title} — ${ctx.asker.name} (${ctx.asker.role_id})`);
  const show = (r: any) => {
    if (quiet) return;
    console.log('  🤖 ' + String(r?.message ?? 'null (→ knowledge base)').replace(/\n/g, '\n     '));
    if (r?.clarification) console.log('     [chips] ' + r.clarification.options.map((o: any) => o.sublabel ? `${o.label} (${o.sublabel})` : o.label).join(' | '));
    if (r?.actions?.length) console.log('     [buttons] ' + r.actions.map((a: any) => `${a.label} → ${a.route}`).join(' | '));
    if (r?.pendingAction) console.log(`     (draft saved, awaiting: ${r.pendingAction.awaiting})`);
  };
  return {
    ctx,
    async say(text: string) {
      if (!quiet) console.log(`  👤 ${text}`);
      ctx.question = text;
      last = await handleDataQuestion(ctx, text, [], null, pending);
      pending = last?.pendingAction ?? null;
      show(last); return last;
    },
    async tap(label: string) {
      const o = last?.clarification?.options.find((x: any) => x.label.toLowerCase().startsWith(label.toLowerCase()));
      if (!o) throw new Error(`no chip "${label}" in: ${last?.clarification?.options.map((x: any) => x.label).join(', ')}`);
      if (!quiet) console.log(`  👆 [${o.label}]`);
      last = await handleDataQuestion(ctx, o.label, [], o.selection, null);
      pending = last?.pendingAction ?? null;
      show(last); return last;
    },
    get last() { return last; },
  };
}

const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.parse(today) + n * 86400e3).toISOString().slice(0, 10);

// ---------------------------------------------------------------- date parser
console.log('DATE PARSER (today ' + today + ')');
const dp: [string, string | null, string | null][] = [
  ['tomorrow', plusDays(1), plusDays(1)], ['2 dec to 4 dec', '2026-12-02', '2026-12-04'], ['2-4 dec', '2026-12-02', '2026-12-04'],
  ['dec 2 to 4', '2026-12-02', '2026-12-04'], ['from 29 dec till 2 jan', '2026-12-29', '2027-01-02'], ['02/12/2026', '2026-12-02', '2026-12-02'],
  ['tomorrow for 3 days', plusDays(1), plusDays(3)], ['kal', plusDays(1), plusDays(1)], ['day after tomorrow', plusDays(2), plusDays(2)],
  ['take 1/2 day leave today', today, today], ['Family function', null, null],
];
for (const [t, s, e] of dp) { const r = parseLeaveDates(t, today); check((r?.start ?? null) === s && (r?.end ?? null) === e, `"${t}" → ${r ? `${r.start}..${r.end}` : 'none'}`); }

// ---------------------------------------------------------------- routing
console.log('\nROUTING');
const admin = await makeDevCtx(TEST_ASKERS.admin);
const routes: [string, string | null][] = [
  ['apply leave', 'apply_leave'], ['apply for leave tomorrow', 'apply_leave'], ['i want sick leave from 2 dec to 4 dec', 'apply_leave'],
  ['take half day leave today', 'apply_leave'], ['apply comp off on friday', 'apply_leave'], ['leave lena hai kal', 'apply_leave'],
  ['mujhe kal chutti chahiye', 'apply_leave'], ['apply leave for kavya tomorrow', 'apply_leave'],
  ['cancel my leave request', 'withdraw_leave'],
  ['how is earned leave calculated', 'explain_leave_policy'], ['how are leaves allocated', 'explain_leave_policy'], ['leave rules', 'explain_leave_policy'],
  ['how is attendance marked when i am on leave', 'explain_leave_policy'], ['can i take leave during probation', 'explain_leave_policy'],
  ['what is comp off', 'explain_leave_policy'], ['what is blue leave', 'explain_leave_policy'], ['how many days notice for leave', 'explain_leave_policy'],
  // must NOT be captured by the leave rules
  ['how do i apply leave in the app', null], ['where is apply leave', null], ['my leave balance', 'get_leave_balance'],
  ['meri chutti balance', 'get_leave_balance'], ['who is on leave tomorrow', 'get_leave_requests'], ['leaves pending my approval', 'get_leave_requests'],
  ['how many leaves did kavya take this year', 'get_leave_requests'],
];
for (const [q, want] of routes) {
  const m = await matchFastPath(admin.sb, q, admin.now);
  const got = m?.tool ?? null;
  const ok = want === null ? !['apply_leave', 'withdraw_leave', 'explain_leave_policy'].includes(got as any) : got === want;
  check(ok, `"${q}" → ${got ?? 'none'}${m ? ` ${JSON.stringify(m.args)}` : ''}`);
}

// ---------------------------------------------------------------- RUN 1: field staff, guided, free-text hand-off, confirm (dry run)
{
  const s = await session(TEST_ASKERS.fieldStaff, 'RUN 1: guided apply with typed replies');
  let r = await s.say('apply leave');
  check(!!r?.clarification && r.pendingAction?.awaiting === 'leave_type', 'asks leave type with balance chips');
  r = await s.tap('Earned Leave');
  check(r?.pendingAction?.awaiting === 'dates', 'asks dates');
  r = await s.say('2 dec to 3 dec');
  const awaitingAfterDates = r?.pendingAction?.awaiting;
  check(awaitingAfterDates === 'reason' || !!r?.message?.includes("can't submit"), 'typed dates accepted (multi-day → full day, asks reason)');
  if (awaitingAfterDates === 'reason') {
    r = await s.say('ok');
    check(r?.pendingAction?.awaiting === 'reason', 'too-short reason asked again');
    r = await s.say('Attending a family function in my village');
    const isPreview = r?.clarification?.options?.some((o: any) => o.label === 'Confirm & submit');
    check(isPreview || r?.message?.includes("can't submit"), 'preview card (or a clear validation error)');
    if (isPreview) {
      r = await s.say('yes');
      check(!!r?.clarification && !r?.message?.includes('Dry run'), 'typed "yes" does NOT submit (asks to tap Confirm)');
      r = await s.tap('Confirm & submit');
      check(!!r?.message?.includes('Dry run'), 'confirm chip → dry-run payload');
      const res: any = r;
      (globalThis as any).__payload1 = res;
    }
  }
}

// ---------------------------------------------------------------- RUN 2: one-shot request, half day, typed reason, confirm
{
  const s = await session(TEST_ASKERS.fieldStaff, 'RUN 2: one-shot "take half day leave tomorrow" + LOP');
  let r = await s.say('take half day leave tomorrow');
  check(r?.pendingAction?.awaiting === 'leave_type', 'asks only the missing type');
  r = await s.say('loss of pay');
  check(r?.pendingAction?.awaiting === 'reason', 'typed type accepted, half day kept, asks reason');
  r = await s.tap('Personal work');
  check(!!r?.clarification?.options?.some((o: any) => o.label === 'Confirm & submit'), 'preview');
  r = await s.tap('Confirm & submit');
  check(!!r?.message?.includes('Dry run'), 'dry-run submit');
}

// ---------------------------------------------------------------- validation failures, cancel, sick, someone else
{
  const s = await session(TEST_ASKERS.fieldStaff, 'Past-dated Earned Leave');
  const r = await s.say(`apply earned leave on ${Number(today.slice(8, 10)) > 3 ? `${Number(today.slice(8, 10)) - 3} nov` : 'yesterday'} full day for personal work`);
  // reason not parsed from the first message → may ask reason first
  let x = r;
  if (x?.pendingAction?.awaiting === 'reason') x = await s.say('Personal work at home');
  check(!!x?.message?.includes('past dates'), 'past date refused with the app message');
}
{
  const s = await session(TEST_ASKERS.fieldStaff, 'Comp Off for 5 days (insufficient balance)');
  let r = await s.say('apply comp off from tomorrow for 5 days');
  if (r?.pendingAction?.awaiting === 'reason') r = await s.say('Need rest after site work');
  check(!!r?.message?.match(/Insufficient|comp off balance/i), 'insufficient balance explained with change chips');
  r = await s.say('cancel');
  check(!!r?.message?.includes('cancelled') && !r?.pendingAction, 'typed "cancel" ends the draft');
}
// ---------------------------------------------------------------- SICK LEAVE + MEDICAL CERTIFICATE (storage existence is STUBBED — nothing is uploaded)
{
  const { toolByName } = await import('../src/api/assist/tools/index.js');
  const { certPathShape } = await import('../src/api/assist/tools/leave-apply.js');
  const applyTool = toolByName('apply_leave')!;
  const stubStorage = (ctx: any, existing: string[]) => {
    const rows = existing.map(p => ({ dir: p.slice(0, p.lastIndexOf('/')), name: p.slice(p.lastIndexOf('/') + 1) }));
    Object.defineProperty(ctx.sb, 'storage', { get: () => ({ from: (bucket: string) => ({
      list: async (dir: string, opts: any) => bucket !== 'onboarding-documents' ? { data: [], error: null }
        : { data: rows.filter(r => r.dir === dir && (!opts?.search || r.name.includes(opts.search))).map(r => ({ name: r.name, metadata: { size: 123456, mimetype: r.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' } })), error: null },
    }) }) });
  };
  const s = await session(TEST_ASKERS.fieldStaff, 'SICK LEAVE with certificate (dry run, storage stubbed)');
  const uid = s.ctx.asker.id;
  const okPath = `${uid}/documents/1764000000000/medical_certificate.pdf`;
  const okPath2 = `${uid}/documents/1764000000001/other.pdf`;
  stubStorage(s.ctx, [okPath, okPath2]);
  let r = await s.say('i want sick leave from 2 dec to 4 dec');
  if (r?.pendingAction?.awaiting === 'reason') r = await s.say('High fever and doctor advised rest');
  const eligible = !!r?.upload;
  check(eligible && r.pendingAction?.awaiting === 'certificate', 'eligible sick leave reaches the UPLOAD step (upload spec + pending draft)');
  check(r?.upload?.field === 'doctor_certificate' && r.upload.maxMb === 10 && /pdf/.test(r.upload.accept) && r.upload.selection?.tool === 'apply_leave', 'upload spec: field, accept, maxMb, selection carried');
  check(!r?.clarification?.options?.some((o: any) => o.label === 'Confirm & submit'), 'no Confirm before a certificate is attached');
  if (eligible) {
    const up = r.upload;
    r = await s.say('here you go');
    check(/upload the certificate using the button above/i.test(r?.message ?? '') && !!r?.upload, 'typed reply while upload pending → "upload using the button above"');
    // 1) another user's path refused
    const other = `00000000-0000-0000-0000-000000000000/documents/1764000000000/medical_certificate.pdf`;
    r = await handleDataQuestion(s.ctx, 'x', [], { tool: up.selection.tool, args: { ...up.selection.args, certificate_path: other, certificate_name: 'x.pdf' } });
    check(/not one of your own/i.test(r?.message ?? '') && !!r?.upload && !r?.clarification?.options?.some((o: any) => o.label === 'Confirm & submit'), "another user's path is refused (upload asked again)");
    for (const bad of ['https://evil.example/x.pdf', `${uid}/documents/../../x/doc/1/a.pdf`, `${uid}/documents/1764000000000/a.exe`, `/${okPath}`]) {
      check(certPathShape(uid, bad) === null, `shape refused: ${bad.replace(uid, '<uid>').slice(0, 40)}`);
    }
    check(certPathShape(uid, okPath) === okPath, 'shape accepts the app path pattern <uid>/documents/<ts>/<file>');
    // 2) non-existent path refused
    r = await handleDataQuestion(s.ctx, 'x', [], { tool: up.selection.tool, args: { ...up.selection.args, certificate_path: `${uid}/documents/1764000000999/ghost.pdf`, certificate_name: 'ghost.pdf' } });
    check(/could not find/i.test(r?.message ?? '') && !!r?.upload, 'non-existent object is refused');
    // 3) upload selection → preview shows the file
    r = await handleDataQuestion(s.ctx, 'Uploaded medical_certificate.pdf', [], { tool: up.selection.tool, args: { ...up.selection.args, certificate_path: okPath, certificate_name: 'medical_certificate.pdf' } });
    const confirm = r?.clarification?.options?.find((o: any) => o.label === 'Confirm & submit');
    check(!!confirm && /medical_certificate\.pdf/.test(r?.message ?? '') && !r?.upload, 'upload selection → preview shows the attached file + Confirm');
    if (!quiet) console.log('  🤖 ' + String(r?.message).replace(/\n/g, '\n     '));
    // 4) swapped path after the preview refused (token covers the path)
    r = await handleDataQuestion(s.ctx, 'x', [], { tool: 'apply_leave', args: { ...confirm.selection.args, certificate_path: okPath2 } });
    check(!r?.message?.includes('Dry run') && !!r?.clarification?.options?.some((o: any) => o.label === 'Confirm & submit') && /expired/.test(r?.message ?? ''), 'swapped certificate path after preview → token refused, preview again');
    // 5) confirm → dry-run payload includes doctor_certificate
    r = await handleDataQuestion(s.ctx, 'Confirm & submit', [], confirm.selection);
    check(!!r?.message?.includes('Dry run') && /Certificate attached/.test(r?.message ?? ''), 'confirm chip → dry run mentions the certificate');
    const raw: any = await applyTool.run(s.ctx, confirm.selection.args);
    const row = raw?.facts?.would_insert?.row;
    check(raw?.facts?.dry_run === true && row?.leave_type === 'Sick' && row?.doctor_certificate?.path === okPath && row.doctor_certificate.name === 'medical_certificate.pdf' && row.doctor_certificate.type === 'application/pdf' && typeof row.doctor_certificate.size === 'number',
      'dry-run payload: leave_type Sick + doctor_certificate { name, type, size, path } (app shape)');
    // 6) confirm with the object gone → refused
    stubStorage(s.ctx, []);
    r = await handleDataQuestion(s.ctx, 'Confirm & submit', [], confirm.selection);
    check(!r?.message?.includes('Dry run') && /could not find/i.test(r?.message ?? ''), 'confirm re-checks the object exists');
  }
}
{
  // ineligible: not enough sick balance → the app's reason, NO upload step
  const s = await session(TEST_ASKERS.fieldStaff, 'SICK LEAVE ineligible (balance)');
  let r = await s.say('i want sick leave from 2 dec to 31 jan 2027');
  if (r?.pendingAction?.awaiting === 'reason') r = await s.say('Long illness, doctor advised rest');
  check(/Insufficient Sick balance|can't submit/i.test(r?.message ?? '') && !r?.upload, 'insufficient sick balance → app message, no upload button');
}
{
  // ineligible: probation (finds a real user still in probation; read-only)
  const sb = (await import('../src/api/assist/devctx.js')).serviceClient();
  const since = new Date(Date.now() - 80 * 86400e3).toISOString().slice(0, 10);
  const { data: probs } = await sb.from('users').select('id, name, email, joining_date').gte('joining_date', since).limit(1);
  if (probs?.length) {
    const s = await session(probs[0].email || probs[0].name, 'SICK LEAVE ineligible (probation)');
    let r = await s.say('i want sick leave tomorrow');
    if (r?.pendingAction?.awaiting === 'leave_type') r = await s.say('sick leave');
    check(/probation/i.test(r?.message ?? '') && !r?.upload, 'probation → app message, no upload button');
  } else console.log('  (no user currently in probation — probation case not run)');
}
{
  const s = await session(TEST_ASKERS.admin, 'Someone else');
  const r = await s.say('apply leave for kavya tomorrow');
  check(!!r?.message?.includes('only apply leave for'), 'refuses to apply for another person');
}
{
  const s = await session(TEST_ASKERS.fieldStaff, 'New question in the middle of a draft');
  await s.say('apply leave');
  await s.tap('Loss of Pay');
  const r = await s.say('what is my leave balance?');
  check(r?.toolUsed === 'get_leave_balance', 'a real question while a draft waits is answered normally');
}
{
  const s = await session(TEST_ASKERS.fieldStaff, 'Forged confirm (selection without a valid token)');
  const r = await handleDataQuestion(s.ctx, 'x', [], { tool: 'apply_leave', args: { leave_type: 'lop', start_date: plusDays(1), end_date: plusDays(1), day_option: 'full', reason: 'Personal work', step: 'confirm', confirm_token: 'abc.0123456789abcdef0123456789abcdef' } });
  check(!r?.message?.includes('Dry run') && !!r?.clarification, 'forged token → preview again, nothing submitted');
}
{
  const s = await session(TEST_ASKERS.fieldStaff, 'Withdraw');
  const r = await s.say('cancel my leave request');
  check(!!r?.message, 'withdraw lists pending requests or explains none');
}

// ---------------------------------------------------------------- policy questions
for (const [who, q] of [[TEST_ASKERS.fieldStaff, 'how is earned leave calculated'], [TEST_ASKERS.fieldStaff, 'how is attendance marked when i am on leave'], [TEST_ASKERS.finance, 'can i take leave during probation'], [TEST_ASKERS.fieldStaff, 'what is blue leave'], [TEST_ASKERS.hr, 'leave rules']] as const) {
  const s = await session(who, `Policy: ${q}`);
  const r = await s.say(q);
  check(r?.toolUsed === 'explain_leave_policy' && !!r?.message, `policy answer: ${q}`);
}

const p1 = (globalThis as any).__payload1;
if (p1 && !quiet) console.log('\nWOULD-BE INSERT (run 1): shown in the dry-run facts of apply_leave (see tool result).');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
