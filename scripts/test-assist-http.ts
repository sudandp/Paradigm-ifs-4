/**
 * HTTP end-to-end test for Paradigm Assist (real endpoint, real auth, real DB; leave apply DRY RUN only).
 *   npx tsx scripts/test-assist-http.ts
 * Spawns the endpoint via scripts/_assist-http-server.ts (same route as src/server.ts, minus boot jobs that write to the DB).
 * Signs in ONLY as the owner's own admin account; cleans up the conversations/messages it created.
 */
import * as dotenv from 'dotenv';
dotenv.config(); dotenv.config({ path: '.env.local', override: true });
import { spawn, type ChildProcess } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const URL_ = process.env.VITE_SUPABASE_URL!, ANON = process.env.VITE_SUPABASE_ANON_KEY!, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const svc = createClient(URL_, SVC, { auth: { persistSession: false } });
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER_NAME = 'Sudhan M';

const results: { check: string; ok: boolean; ms?: number; note?: string }[] = [];
const convIds = new Set<string>();
const check = (name: string, ok: boolean, ms?: number, note = '') => {
  results.push({ check: name, ok, ms, note });
  console.log(`${ok ? '  PASS' : '  FAIL'} ${name}${ms != null ? ` [${ms}ms${ms > 2000 ? ' SLOW' : ''}]` : ''}${note ? ' - ' + note : ''}`);
};

function startServer(port: number, env: Record<string, string>): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['--import', 'tsx', 'scripts/_assist-http-server.ts'], {
      env: { ...process.env, PORT: String(port), ASSIST_LEAVE_DRY_RUN: '1', ASSIST_ENABLE_LEAVE_APPLY: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const t = setTimeout(() => reject(new Error('server start timeout')), 60000);
    p.stdout!.on('data', d => { if (String(d).includes('Server running')) { clearTimeout(t); resolve(p); } });
    p.stderr!.on('data', () => {});
    p.on('exit', c => { clearTimeout(t); reject(new Error('server exited ' + c)); });
  });
}
const stop = (p: ChildProcess) => new Promise<void>(r => { p.removeAllListeners('exit'); p.once('exit', () => r()); p.kill(); setTimeout(r, 3000); });

async function post(port: number, token: string | null, body: any) {
  const t0 = Date.now();
  const res = await fetch(`http://127.0.0.1:${port}/api/paradigm-assist`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action: 'chat', modelEngine: 'auto-hybrid', history: [], siteId: null, ...body }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (json?.conversationId && UUID.test(json.conversationId)) convIds.add(json.conversationId);
  return { status: res.status, ms: Date.now() - t0, j: json };
}

const oneLine = (s: any, n = 90) => String(s).slice(0, n).replace(/\n/g, ' ');

async function main() {
  // ---- auth: owner's own account only
  const { data: u } = await svc.from('users').select('id, email').eq('name', OWNER_NAME).limit(2);
  if (!u || u.length !== 1) throw new Error('owner lookup failed (' + (u?.length ?? 0) + ' rows)');
  const ownerId = u[0].id;
  const { data: link, error: le } = await svc.auth.admin.generateLink({ type: 'magiclink', email: u[0].email });
  if (le || !link?.properties?.hashed_token) throw new Error('generateLink failed');
  const { data: sess, error: ve } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
  if (ve || !sess.session) throw new Error('verifyOtp failed');
  const token = sess.session.access_token;

  const preExisting = new Set<string>(((await svc.from('assist_conversations').select('id').eq('user_id', ownerId)).data || []).map((r: any) => r.id));
  const { data: others } = await svc.from('assist_conversations').select('id, user_id').neq('user_id', ownerId).limit(1);
  const otherConv = others?.[0];
  const { count: leaveBefore } = await svc.from('leave_requests').select('id', { count: 'exact', head: true });

  const P1 = 3101, P2 = 3102;
  let s1: ChildProcess | null = null, s2: ChildProcess | null = null;
  try {
    s1 = await startServer(P1, {});
    const T = (name: string, r: any, ok: boolean, note = '') => check(name, ok, r.ms, note);

    console.log('\n1. DATA QUESTIONS');
    for (const q of ['how many days did i work this month', 'where is isaac yesterday', 'nikoo home june month invoice value', 'who is on leave today', 'which biometric devices are offline']) {
      const r = await post(P1, token, { query: q, conversationId: `conv_${Date.now()}` });
      const j = r.j;
      const ok = r.status === 200 && j.route === 'database' && j.engine === 'rules' && !!j.sourceBadge && typeof j.message === 'string' && j.message.length > 10 && !/undefined|NaN|\[object/.test(j.message);
      T(`data: "${q}"`, r, ok, ok ? '' : `status=${r.status} route=${j.route} engine=${j.engine} badge=${!!j.sourceBadge} clar=${!!j.clarification} msg=${oneLine(j.message, 80)}`);
      if (process.env.SHOW) console.log('     ' + oneLine(j.message, 200));
    }

    console.log('\n2. CLARIFICATION ROUND TRIP');
    let r = await post(P1, token, { query: 'how many days kavya works', conversationId: `conv_${Date.now()}` });
    const opts = r.j.clarification?.options;
    T('clarification returns >=2 options', r, Array.isArray(opts) && opts.length >= 2, `opts=${opts?.length}`);
    if (opts?.length >= 2) {
      const first = r.j.conversationId;
      const r2 = await post(P1, token, { query: 'how many days kavya works', conversationId: first, selection: opts[1].selection });
      T('selection -> answer for chosen Kavya', r2, r2.status === 200 && !r2.j.clarification && r2.j.route === 'database' && r2.j.conversationId === first, `msg=${oneLine(r2.j.message)}`);
      T('answer mentions Kavya', r2, /kavya/i.test(r2.j.message || ''));
    }

    console.log('\n3. PERSISTENCE');
    const cid = `conv_${Date.now()}`;
    const a = await post(P1, token, { query: 'who is on leave today', conversationId: cid });
    T('legacy client id -> server UUID', a, UUID.test(a.j.conversationId || ''));
    const b = await post(P1, token, { query: 'which biometric devices are offline', conversationId: a.j.conversationId });
    T('UUID reused keeps same conversation', b, b.j.conversationId === a.j.conversationId);
    const c = await post(P1, token, { query: 'my leave balance', conversationId: cid });
    T('same legacy id (not yet adopted) maps to same conversation', c, c.j.conversationId === a.j.conversationId);
    const { data: msgs } = await svc.from('assist_messages').select('sender').eq('conversation_id', a.j.conversationId);
    const { data: conv } = await svc.from('assist_conversations').select('user_id').eq('id', a.j.conversationId).maybeSingle();
    check('rows exist in assist_conversations / assist_messages', !!conv && conv.user_id === ownerId && (msgs?.length ?? 0) >= 6, undefined, `msgs=${msgs?.length}`);

    console.log('\n4. APP GUIDE');
    r = await post(P1, token, { query: 'where is the invoice option', conversationId: null });
    T('guide: invoice -> Open button with route', r, Array.isArray(r.j.actions) && r.j.actions.some((x: any) => /open/i.test(x.label) && x.route), JSON.stringify(r.j.actions));
    r = await post(P1, token, { query: 'how to do lift rescue', conversationId: null });
    T('lift rescue is NOT a guide', r, r.status === 200 && (r.j.actions?.length ?? 0) === 0 && !/app guide/i.test(r.j.sourceBadge || ''), `route=${r.j.route} badge=${r.j.sourceBadge} actions=${r.j.actions?.length}`);
    console.log('\n5. LEAVE APPLY SWITCH OFF (no ENABLE, no DRY_RUN)');
    await stop(s1); s1 = await startServer(P1, { ASSIST_LEAVE_DRY_RUN: '' });
    r = await post(P1, token, { query: 'apply leave', conversationId: null });
    T('apply leave off -> message + Open Apply Leave', r, /isn.t switched on/i.test(r.j.message || '') && r.j.actions?.some((x: any) => x.label === 'Open Apply Leave' && x.route), oneLine(r.j.message, 60));

    console.log('\n7. SECURITY');
    r = await post(P1, token, { query: 'how many days kavya works', conversationId: null, selection: { tool: 'get_attendance_summary', args: { person_id: randomUUID() } } });
    T('tampered selection person_id ignored/denied', r, r.status === 200 && (r.j.denied === true || !!r.j.clarification || !/\d+\s*(days|present)/i.test(r.j.message || '')), `denied=${r.j.denied} msg=${oneLine(r.j.message, 100)}`);
    if (otherConv) {
      const before = (await svc.from('assist_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', otherConv.id)).count;
      r = await post(P1, token, { query: 'who is on leave today', conversationId: otherConv.id });
      const after = (await svc.from('assist_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', otherConv.id)).count;
      T("another user's conversationId -> new conversation, nothing written there", r, r.status === 200 && r.j.conversationId !== otherConv.id && !!r.j.conversationId && before === after, `before=${before} after=${after}`);
    } else check('foreign conversation test', false, undefined, 'no other-user conversation found');
    r = await post(P1, null, { query: 'hello' });
    T('missing token -> 401', r, r.status === 401);
    r = await post(P1, 'not.a.token', { query: 'hello' });
    T('invalid token -> 401/403', r, r.status === 401 || r.status === 403);

    console.log('\n8. GENERAL');
    r = await post(P1, token, { query: 'hello', conversationId: null });
    T('hello works', r, r.status === 200 && !!r.j.message, `route=${r.j.route} msg=${oneLine(r.j.message, 50)}`);
    r = await post(P1, token, { query: 'what is the procedure for lift rescue', conversationId: null });
    T('knowledge question works', r, r.status === 200 && !!r.j.message, `route=${r.j.route}`);

    await stop(s1); s1 = null;

    console.log('\n6. TYPED-REPLY DRAFT ACROSS SERVER RESTARTS (apply enabled, dry run)');
    const env2 = { ASSIST_ENABLE_LEAVE_APPLY: '1' };
    s2 = await startServer(P2, env2);
    r = await post(P2, token, { query: 'apply leave', conversationId: null });
    const conv6 = r.j.conversationId;
    const typeOpts = r.j.clarification?.options;
    T('apply leave -> type chips', r, !!typeOpts?.length && UUID.test(conv6 || ''), `chips=${typeOpts?.map((o: any) => o.label).join('/')}`);
    r = await post(P2, token, { query: 'apply leave', conversationId: conv6, selection: (typeOpts.find((o: any) => /loss of pay/i.test(o.label)) || typeOpts[0]).selection });
    T('tap type -> asks dates', r, /date|when/i.test(r.j.message || ''), oneLine(r.j.message, 70));
    await stop(s2); s2 = await startServer(P2, env2); // memory lost
    r = await post(P2, token, { query: '2 dec to 3 dec', conversationId: conv6 });
    T('after restart: typed dates continue from DB draft', r, /reason/i.test(r.j.message || ''), oneLine(r.j.message, 80));
    await stop(s2); s2 = await startServer(P2, env2);
    r = await post(P2, token, { query: 'Attending a family function in my village', conversationId: conv6 });
    const confirm = r.j.clarification?.options?.find((o: any) => /confirm/i.test(o.label));
    T('after 2nd restart: reason -> preview with Confirm chip', r, !!confirm, oneLine(r.j.message, 80));
    if (confirm) {
      r = await post(P2, token, { query: 'Attending a family function in my village', conversationId: conv6, selection: confirm.selection });
      T('confirm -> dry-run, nothing saved', r, /nothing was saved/i.test(r.j.message || ''), oneLine(r.j.message, 80));
    }
    const { count: leaveAfter } = await svc.from('leave_requests').select('id', { count: 'exact', head: true });
    check('no leave_requests row created', leaveAfter === leaveBefore, undefined, `${leaveBefore} -> ${leaveAfter}`);
  } finally {
    if (s1) await stop(s1);
    if (s2) await stop(s2);
    const mine = [...convIds].filter(id => !preExisting.has(id));
    if (mine.length) {
      await svc.from('assist_messages').delete().in('conversation_id', mine);
      await svc.from('assist_conversations').delete().in('id', mine);
    }
    console.log(`\ncleanup: removed ${mine.length} conversations`);
    await svc.auth.admin.signOut(token).catch(() => {});
  }
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  const slow = results.filter(r => (r.ms ?? 0) > 2000);
  if (slow.length) console.log('SLOW: ' + slow.map(s => `${s.check} ${s.ms}ms`).join('; '));
  process.exit(failed.length ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e.message); process.exit(2); });
